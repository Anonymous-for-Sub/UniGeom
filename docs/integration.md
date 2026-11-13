# Integrating encoders and receiver dynamics

UniGeom consumes paired features and provides adapter modules. Your application supplies the source encoder, receiver encoder for calibration, and receiver dynamics for prediction.

## Prepare paired features

Run both encoders on the same observations using their respective preprocessing. Set them to evaluation mode, disable their parameter gradients, and extract features under `torch.no_grad()`. Preserve episode IDs so train and validation rows can be split by trajectory.

| Route | Source tensor | Target tensor | Adapter |
| --- | --- | --- | --- |
| Global to global | `[N, C_A]` | `[N, C_B]` | `RidgeResidualMap` |
| Spatial to global | `[N, P, C_A]` | `[N, C_B]` | `SpatialReadout` or `PooledReadout` |
| Spatial to spatial | `[N, G_A², C_A]` | `[N, G_B², C_B]` | `SpatialResampler` |

`N` indexes matching observations. Spatial adapters expect patch tokens with channels last, a fixed raster order, and no class token. `SpatialResampler` supports square source and receiver grids. All paired tensors and their adapter must be on the same device; the examples use float32 CPU tensors.

Fit statistics only on calibration-training rows. Validation and held-out features use these fixed statistics. Adapter outputs already include receiver-scale restoration and can be passed to the receiver in its native coordinates.

## Paired-feature training CLI

The [training CLI](../examples/train_paired.py) accepts a `.pt` dictionary with the following keys. Unlike the single-observation API examples below, the CLI keeps an explicit history axis.

| Key | Shape | Meaning |
| --- | --- | --- |
| `source` | `[N, H, C_A]` or `[N, H, P_A, C_A]` | Paired source histories |
| `target` | `[N, H, C_B]` or `[N, H, P_B, C_B]` | Receiver features of the same histories |
| `trajectory_ids` | `[N]` integer tensor | Episode membership for splitting rows |
| `source_goal` (optional) | `[N, C_A]` or `[N, P_A, C_A]` | Source features of observed goals |
| `target_goal` (optional) | `[N, C_B]` or `[N, P_B, C_B]` | Receiver features of the same goals |

Include both goal keys or neither. Each row's observations and goals remain together when splitting trajectories. Supply at least two distinct trajectory IDs so both training and validation sets can be formed.

```bash
python examples/train_paired.py paired_features.pt \
  --interface spatial-attention --output adapter.pt --steps 1000
```

| `--interface` | Mapping |
| --- | --- |
| `ridge` | Global ridge reference |
| `residual` | Global ridge plus residual MLP |
| `spatial-readout` | Ordered tokens to global state |
| `pooled` | Mean-pooled tokens to global state |
| `spatial-fixed` | Bilinear grid conversion and learned channel projection |
| `spatial-conv` | Grid conversion with a depthwise convolution residual |
| `spatial-attention` | Grid conversion with an attention residual |

The CLI runs on CPU by default and fits trainable adapters for a fixed update budget; `ridge` is fitted in closed form. With observed goals, it weights history and goal group means by `H:1`. Validation state error is diagnostic; it does not select a checkpoint or stop training early. Run `python examples/train_paired.py --help` for all options.

Load the saved adapter without manually reconstructing its architecture:

```python
from unigeom.checkpoint import load_adapter

adapter = load_adapter("adapter.pt")
# prediction = adapter(source_features)
```

Use trusted `.pt` files. The checkpoint retains adapter settings, fitted statistics, and parameters.

## Fit a global residual map

This complete example creates synthetic paired observations, makes a trajectory-level split, fits the ridge reference, and trains its nonlinear correction:

```python
import torch
from unigeom import RidgeResidualMap, fit_calibration, split_trajectories

torch.manual_seed(0)
source = torch.randn(128, 8)
target = source @ torch.randn(8, 6) + 0.2 * torch.sin(source[:, :6])
episode_ids = torch.arange(16).repeat_interleave(8)
train, validation = split_trajectories(episode_ids, seed=0)

adapter = RidgeResidualMap.fit(
    source[train], target[train], hidden_dim=32, regularization=1e-3
)
fit_calibration(adapter, source[train], target[train], steps=50, batch_size=32)
with torch.no_grad():
    predicted = adapter(source[validation])
assert predicted.shape == target[validation].shape
```

`RidgeResidualMap.fit` estimates its own centering and scalar residual scales. Its ridge parameters remain frozen when `fit_calibration` updates the residual MLP. Use `residual=False` for the closed-form ridge reference; that map needs no gradient-based calibration. `adapter.teacher(source)` returns the frozen ridge output from a residual map.

## Fit spatial interfaces

For a small spatial-to-global example:

```python
import torch
from unigeom import SpatialReadout, fit_statistics, fit_calibration

torch.manual_seed(0)
source_train = torch.randn(32, 9, 8)
target_train = torch.randn(32, 6)
adapter = SpatialReadout(source_dim=8, target_dim=6, tokens=9, width=4)
adapter.set_statistics(**fit_statistics(
    source_train, target_train, target_scale="scalar"
))
fit_calibration(adapter, source_train, target_train, steps=20, batch_size=8)
assert adapter(source_train[:2]).shape == (2, 6)
```

`PooledReadout` accepts the same input layout and uses a token mean followed by an MLP. Both readout classes require scalar target statistics (`target_scale="scalar"`). `SpatialReadout` preserves the ordered tokens when flattening them.

For token-to-token adaptation, use channelwise statistics and choose a spatial operation:

```python
import torch
from unigeom import SpatialResampler, fit_statistics, fit_calibration

torch.manual_seed(0)
source_train = torch.randn(32, 9, 8)  # 3 x 3 source grid
target_train = torch.randn(32, 4, 6)  # 2 x 2 receiver grid
adapter = SpatialResampler(
    source_dim=8, target_dim=6, source_grid=3, target_grid=2,
    hidden_dim=16, mode="attention", heads=2, head_dim=4,
)
adapter.set_statistics(**fit_statistics(source_train, target_train))
fit_calibration(adapter, source_train, target_train, steps=20, batch_size=8)
assert adapter(source_train[:2]).shape == (2, 4, 6)
```

The available modes are `"attention"`, `"bilinear"`, and `"depthwise"`. Attention adds a zero-initialized residual to the bilinear grid conversion, with fixed positions in queries and keys. Depthwise mode adds a zero-initialized local convolution residual. Every mode applies a learned channel projection and restores receiver scale. Attention requires `source_dim` divisible by four for the positional encoding.

The constructors below provide the corresponding full-size layouts and mode-specific hidden widths:

| Constructor | Source layout | Receiver layout |
| --- | --- | --- |
| `SpatialReadout()` | `[N, 196, 768]` | `[N, 192]` |
| `PooledReadout()` | `[N, 196, 768]` | `[N, 192]` |
| `SpatialResampler.lewm(mode="attention")` | `[N, 256, 192]` | `[N, 196, 384]` |
| `SpatialResampler.mae(mode="attention")` | `[N, 196, 768]` | `[N, 196, 384]` |

Use the `lewm` or `mae` factory with each mode to select its preset width. Changing `mode` on the general constructor keeps the explicitly supplied width.

## State-only calibration with observed goals

`fit_calibration` optimizes receiver-coordinate mean squared error. It receives feature pairs, not encoders or the dynamics model. `scale` is a fixed positive scalar loss divisor; it is separate from the feature normalization buffers.

For paired history tensors `[N, H, ...]` and paired observed goal tensors `[N, ...]`, provide `source_goal` and `target_goal` alongside `source` and `target`. Both goal tensors must have the same row count as the histories. The default `history_weight=3.0` and `goal_weight=1.0` combine group-mean losses at a 3:1 ratio. Goal targets are observed goal views; calibration does not require future-state labels.

`fit_calibration` uses a fixed number of updates and returns a `CalibrationResult`. Choose validation criteria and checkpoints in the calling application. Retain the trajectory split and fitted statistics when applying an adapter to new observations.

## Connect a frozen receiver

`FrozenConnection(source_encoder, adapter, receiver)` freezes the source encoder and receiver parameters and keeps both modules in evaluation mode. Calling `connection.train()` changes adapter mode while retaining that behavior. Source encoding runs without gradients; receiver operations can still carry gradients with respect to mapped states.

Implement these contracts in wrappers around your models:

- `source_encoder(observations)` returns global features or patch tokens while preserving the leading batch and history axes. Flatten and restore these axes inside the wrapper if the encoder accepts only image batches.
- `receiver(history, actions)` receives `[B, H, *state_shape]` and `[B, H, *action_shape]` and returns **one next state**, `[B, *state_shape]`. If the upstream model returns a sequence, select the intended next prediction explicitly in the wrapper.

For `K` prediction steps, `connection.rollout(observations, actions, steps=K)` expects an initial observation history `[B, H, ...]` and actions `[B, H + K - 1, *action_shape]`. Actions include the controls aligned with the observed history. The returned tensor has shape `[B, K, *state_shape]`. Subsequent history windows contain predictions generated by the receiver.

The following CPU example uses cached features as observations and a minimal receiver to show the contract:

```python
import torch
from torch import nn
from unigeom import FrozenConnection, RidgeResidualMap

class Receiver(nn.Module):
    def forward(self, history, actions):
        return history[:, -1] + actions[:, -1]

torch.manual_seed(0)
x = torch.randn(64, 8)
y = x @ torch.randn(8, 6)
adapter = RidgeResidualMap.fit(x, y, residual=False)
connection = FrozenConnection(nn.Identity(), adapter, Receiver()).eval()
observations = torch.randn(2, 3, 8)  # B=2, H=3
actions = torch.randn(2, 6, 6)       # H + K - 1=6 for K=4
with torch.no_grad():
    prediction = connection.rollout(observations, actions, steps=4)
    mapped_goal = connection.encode(torch.randn(2, 8))
assert prediction.shape == (2, 4, 6)
assert mapped_goal.shape == (2, 6)
```

Encode a supplied goal through `connection.encode(goal_observations)` so histories and goals use the same mapped representation. Keep the receiver's action normalization, action grouping, history length, and planning cost in the application. The receiver encoder is used to construct calibration targets; it is not required by this connected online path.

For already mapped histories, `autoregress(receiver, initial_history, actions, steps=K)` exposes the same rollout contract directly. Wrap inference in `torch.no_grad()` to avoid retaining gradient graphs.
