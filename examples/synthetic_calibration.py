"""CPU example: fit real UniGeom adapters, restore native coordinates and roll out.

Run after installation: python examples/synthetic_calibration.py
Synthetic feature pairs illustrate the API, not paper performance.
"""
import torch
from torch import nn
from unigeom import (FrozenConnection, RidgeResidualMap, SpatialResampler,
                     fit_calibration, fit_statistics, split_trajectories)


class SourceEncoder(nn.Module):
    def forward(self, observations):
        # These synthetic observations already represent cached source features.
        return observations


class Receiver(nn.Module):
    def forward(self, history, actions):
        # A supplied frozen receiver uses its own normalization and conventions.
        return history[:, -1] + actions[:, -1]


def main():
    torch.set_num_threads(1)
    torch.manual_seed(7)
    x = torch.randn(256, 8)
    y = x @ torch.randn(8, 6) + 0.3 * torch.sin(x[:, :6]) + 2
    train, validation = split_trajectories(torch.arange(32).repeat_interleave(8), seed=7)
    adapter = RidgeResidualMap.fit(x[train], y[train], hidden_dim=32)
    fit_calibration(adapter, x[train], y[train], steps=100, learning_rate=3e-3)
    with torch.no_grad():
        error = (adapter(x[validation]) - y[validation]).square().mean()
    print(f"Synthetic held-out state MSE: {error.item():.6f}")
    connection = FrozenConnection(SourceEncoder(), adapter, Receiver()).eval()
    history = x[:6].reshape(2, 3, 8)
    actions = torch.randn(2, 6, 6) * 0.01
    with torch.no_grad():
        predictions = connection.rollout(history, actions, steps=4)
        goal = connection.encode(x[6:8])
        costs = (predictions[:, -1] - goal).square().mean(-1)
    print("Receiver rollout shape:", tuple(predictions.shape))
    print("Goal cost shape:", tuple(costs.shape))

    # Train the residual attention architecture on small token grids on CPU.
    tokens = torch.randn(24, 9, 8)
    target = torch.randn(24, 4, 6)
    spatial = SpatialResampler(8, 6, 3, 2, hidden_dim=16, head_dim=4)
    spatial.set_statistics(**fit_statistics(tokens, target))
    fit_calibration(spatial, tokens, target, steps=20, batch_size=8)
    print("Spatial prediction shape:", tuple(spatial(tokens[:2]).shape))


if __name__ == "__main__":
    main()
