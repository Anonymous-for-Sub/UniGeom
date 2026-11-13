# UniGeom

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](pyproject.toml)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.2%2B-orange.svg)](pyproject.toml)
[![tests](https://github.com/Anonymous-for-Sub/UniGeom/actions/workflows/tests.yml/badge.svg)](https://github.com/Anonymous-for-Sub/UniGeom/actions/workflows/tests.yml)
[![Project page: planned](https://img.shields.io/badge/Project_page-planned-lightgrey.svg)](#project-links)
[![arXiv: planned](https://img.shields.io/badge/arXiv-planned-lightgrey.svg)](#project-links)

PyTorch interfaces that map frozen visual representations into the native state space of a frozen receiver dynamics model. Fit adapters from paired features of the same observations, then use the receiver's existing prediction and action conventions.

The package includes:

- Global ridge maps with an optional trainable residual MLP.
- Ordered spatial and pooled readouts from token grids to global states.
- Token-to-token resampling with residual attention, fixed bilinear interpolation, or a depthwise convolution residual.
- Calibration statistics, state-only adapter fitting, and frozen receiver rollout utilities.

## Install

```bash
git clone https://github.com/Anonymous-for-Sub/UniGeom.git
cd UniGeom
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install 'torch>=2.2' --index-url https://download.pytorch.org/whl/cpu
python -m pip install -e '.[test]'
python -m pytest -q
python examples/synthetic_calibration.py
```

See [installation](docs/installation.md) for environment and dependency details.

## A small CPU example

This example uses synthetic paired vectors and requires no pretrained models or datasets.

```python
import torch
from unigeom import RidgeResidualMap

torch.manual_seed(0)
source = torch.randn(64, 8)                 # [observations, source channels]
target = source @ torch.randn(8, 6) + 0.1  # [observations, receiver channels]

adapter = RidgeResidualMap.fit(source, target, residual=False)
mapped = adapter(torch.randn(4, 8))
assert mapped.shape == (4, 6)
```

The [synthetic example](examples/synthetic_calibration.py) also trains a residual map, fits a small spatial adapter, and runs autoregressive prediction through a frozen receiver.

## Train on paired features

Save paired tensors in a `.pt` dictionary with keys `source`, `target`, and `trajectory_ids`. The training CLI expects an explicit history axis: global features are `[N, H, C]`, and patch features are `[N, H, P, C]`. See the [cache format and interface options](docs/integration.md#paired-feature-training-cli).

```bash
python examples/train_paired.py paired_features.pt \
  --interface spatial-attention --output adapter.pt --steps 1000
```

```python
from unigeom.checkpoint import load_adapter

adapter = load_adapter("adapter.pt")
# mapped = adapter(source_features)
```

The CLI runs on CPU by default, splits by trajectory, and fits normalization on training rows. Load only trusted feature caches and checkpoints.

## Feature layouts

Each paired row comes from the **same observation**. Spatial tokens follow a consistent raster order, with any class token removed before adapting them.

| Interface | Source features | Receiver features |
| --- | --- | --- |
| `RidgeResidualMap` | `[N, C_A]` | `[N, C_B]` |
| `SpatialReadout`, `PooledReadout` | `[N, P, C_A]` | `[N, C_B]` |
| `SpatialResampler` | `[N, G_A², C_A]` | `[N, G_B², C_B]` |

Here `N` is the number of paired observations, `P` is the source token count, and `G_A` / `G_B` are square grid sizes. Split trajectories into calibration and evaluation sets before fitting statistics or adapters. Adapter outputs are restored to receiver coordinates before prediction.

See [integration](docs/integration.md) for calibration, encoder extraction, spatial adapter choices, and rollout contracts.

## Project links

The project page and arXiv entry are planned. Links will be added here when available.

## License

This code is available under the [MIT license](LICENSE). External encoders, receiver models, datasets, and their weights retain their respective licenses.
