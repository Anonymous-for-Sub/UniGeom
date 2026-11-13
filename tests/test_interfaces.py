import copy
import pytest
import torch
from torch import nn
from torch.nn import functional as F
from unigeom import (FrozenConnection, PooledReadout, RidgeResidualMap, SpatialReadout,
                     SpatialResampler, autoregress, calibration_loss, fit_calibration,
                     fit_statistics, split_trajectories)


def test_ridge_recovers_affine_transform_and_residual_initializes_to_teacher():
    torch.manual_seed(2)
    x = torch.randn(200, 5)
    y = x @ torch.randn(5, 3) + torch.randn(3)
    model = RidgeResidualMap.fit(x, y, regularization=1e-8)
    torch.testing.assert_close(model(x), y, atol=2e-6, rtol=2e-6)
    torch.testing.assert_close(model(x), model.teacher(x), atol=0, rtol=0)
    assert not dict(model.named_parameters()).keys() & {"ridge_weight", "source_mean"}
    model(x).square().mean().backward()
    assert model.residual[-1].weight.grad.abs().sum() > 0


def test_paper_readout_and_global_parameter_counts():
    assert sum(p.numel() for p in RidgeResidualMap().parameters()) == 98752
    assert isinstance(RidgeResidualMap().residual[1], nn.SiLU)
    assert sum(p.numel() for p in SpatialReadout().parameters()) == 1229024
    assert sum(p.numel() for p in PooledReadout().parameters()) == 1229311
    for factory in (SpatialResampler.lewm, SpatialResampler.mae):
        counts = [sum(p.numel() for p in factory(mode).parameters())
                  for mode in ("bilinear", "depthwise", "attention")]
        assert (max(counts) - min(counts)) / min(counts) < .002


def test_pooled_invariance_and_ordered_spatial_information():
    torch.manual_seed(3)
    tokens = torch.randn(2, 4, 8)
    permutation = torch.tensor([3, 1, 0, 2])
    pooled = PooledReadout(8, 3, 4, 12)
    spatial = SpatialReadout(8, 3, 4, 2)
    torch.testing.assert_close(pooled(tokens), pooled(tokens[:, permutation]))
    assert not torch.allclose(spatial(tokens), spatial(tokens[:, permutation]))


def test_spatial_native_scale_restoration_and_history_axes():
    model = SpatialResampler(8, 6, 3, 2, hidden_dim=10)
    x = torch.randn(2, 3, 9, 8)
    model.set_statistics(source_mean=torch.ones(8), source_scale=torch.full((8,), 2.),
                         target_mean=torch.full((6,), 5.), target_scale=torch.full((6,), 3.))
    standard = (x - 1) / 2
    grid = F.interpolate(standard.reshape(-1, 9, 8).transpose(1, 2).reshape(-1, 8, 3, 3),
                         size=(2, 2), mode="bilinear", align_corners=False)
    expected = model.projection(grid.flatten(2).transpose(1, 2)) * 3 + 5
    torch.testing.assert_close(model(x), expected.reshape(2, 3, 4, 6), atol=0, rtol=0)


@pytest.mark.parametrize("mode", ["attention", "depthwise"])
def test_residual_starts_as_bilinear_then_learns(mode):
    torch.manual_seed(8)
    model = SpatialResampler(8, 6, 3, 2, hidden_dim=12, mode=mode, head_dim=4)
    baseline = SpatialResampler(8, 6, 3, 2, hidden_dim=12, mode="bilinear")
    baseline.projection.load_state_dict(model.projection.state_dict())
    x = torch.randn(2, 9, 8)
    torch.testing.assert_close(model(x), baseline(x), atol=0, rtol=0)
    model(x).square().mean().backward()
    output_layer = model.out if mode == "attention" else model.spatial
    assert output_layer.weight.grad.abs().sum() > 0


def test_attention_matches_explicit_two_head_formula_after_residual_changes():
    torch.manual_seed(11)
    model = SpatialResampler(8, 6, 3, 2, hidden_dim=10, head_dim=4)
    nn.init.normal_(model.out.weight)
    x = torch.randn(2, 9, 8)
    q0 = F.interpolate(x.transpose(1, 2).reshape(2, 8, 3, 3), size=(2, 2),
                       mode="bilinear", align_corners=False).flatten(2).transpose(1, 2)
    q, k, v = model.q(q0 + model.target_position), model.k(x + model.source_position), model.v(x)
    pieces = []
    for h in range(2):
        sl = slice(h * 4, (h + 1) * 4)
        weights = ((q[..., sl] @ k[..., sl].transpose(-1, -2)) / 2).softmax(-1)
        pieces.append(weights @ v[..., sl])
    expected = model.projection(q0 + model.out(torch.cat(pieces, -1)))
    torch.testing.assert_close(model(x), expected)


def test_fit_statistics_training_only_and_atomic_validation():
    x, y = torch.randn(12, 4, 8), torch.randn(12, 3)
    stats = fit_statistics(x[:8], y[:8], target_scale="scalar")
    torch.testing.assert_close(stats["source_mean"], x[:8].mean((0, 1)))
    torch.testing.assert_close(stats["target_scale"], y[:8].var(0, unbiased=False).mean().sqrt())
    model = SpatialReadout(8, 3, 4, 2).set_statistics(**stats)
    before = copy.deepcopy(model.state_dict())
    bad = dict(stats, source_mean=torch.ones(8), target_scale=torch.tensor(0.))
    with pytest.raises(ValueError):
        model.set_statistics(**bad)
    for key, value in before.items():
        torch.testing.assert_close(model.state_dict()[key], value, atol=0, rtol=0)


def test_trajectory_split_has_no_parent_overlap_and_is_reproducible():
    ids = torch.arange(10).repeat_interleave(3)
    train, validation = split_trajectories(ids, seed=4)
    assert not set(ids[train].tolist()) & set(ids[validation].tolist())
    assert len(train) + len(validation) == len(ids)
    assert torch.equal(train, split_trajectories(ids, seed=4)[0])


def test_history_goal_weighting_uses_observed_targets():
    source, target = torch.zeros(2, 3, 4), torch.ones(2, 3, 4)
    goal, target_goal = torch.zeros(2, 4), torch.full((2, 4), 2.)
    loss = calibration_loss(nn.Identity(), source, target, source_goal=goal, target_goal=target_goal)
    torch.testing.assert_close(loss, torch.tensor(1.75))


def test_calibration_reduces_state_error_and_preserves_ridge_buffers():
    torch.manual_seed(9)
    x = torch.randn(64, 4)
    y = x + .5 * x.square()
    model = RidgeResidualMap.fit(x, y, hidden_dim=16)
    before = {k: v.clone() for k, v in model.named_buffers()}
    result = fit_calibration(model, x, y, steps=120, learning_rate=.02, batch_size=64)
    assert result.final_loss < .4 * result.initial_loss
    for key, value in model.named_buffers():
        torch.testing.assert_close(value, before[key], atol=0, rtol=0)


class Receiver(nn.Module):
    def __init__(self):
        super().__init__()
        self.gain = nn.Parameter(torch.tensor(2.))

    def forward(self, history, actions):
        return history[:, -1] + self.gain * actions[:, -1]


def test_autoregression_uses_predictions_and_correct_action_windows():
    initial = torch.zeros(2, 3, 4)
    actions = torch.arange(6.).reshape(1, 6, 1).expand(2, 6, 4)
    output = autoregress(Receiver(), initial, actions)
    expected = (2 * actions[:, 2:]).cumsum(1)
    torch.testing.assert_close(output, expected)
    assert output.shape == (2, 4, 4)


def test_frozen_connection_preserves_input_gradients_but_not_backbone_gradients():
    encoder = nn.Sequential(nn.Linear(4, 4), nn.Dropout(.5))
    adapter = nn.Linear(4, 4)
    receiver = Receiver()
    connection = FrozenConnection(encoder, adapter, receiver)
    connection.train()
    assert not encoder.training and not receiver.training and adapter.training
    initial = torch.randn(2, 3, 4)
    actions = torch.ones(2, 5, 4)
    before = {k: v.clone() for k, v in receiver.state_dict().items()}
    connection.rollout(initial, actions).square().mean().backward()
    assert adapter.weight.grad.abs().sum() > 0
    assert all(p.grad is None and not p.requires_grad for p in encoder.parameters())
    assert receiver.gain.grad is None and not receiver.gain.requires_grad
    for key, value in receiver.state_dict().items():
        torch.testing.assert_close(value, before[key], atol=0, rtol=0)


@pytest.mark.parametrize("bad_actions", [torch.zeros(2, 1, 4), torch.zeros(3, 5, 4)])
def test_rollout_rejects_bad_action_alignment(bad_actions):
    with pytest.raises(ValueError):
        autoregress(Receiver(), torch.zeros(2, 3, 4), bad_actions)


def test_rollout_requires_explicit_single_next_state_wrapper():
    with pytest.raises(ValueError, match="one finite next state"):
        autoregress(lambda history, actions: history, torch.zeros(2, 3, 4), torch.zeros(2, 5, 4))
