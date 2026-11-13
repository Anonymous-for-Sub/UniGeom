"""Centered ridge and a zero-initialized SiLU residual in receiver coordinates."""
import torch
from torch import nn


class RidgeResidualMap(nn.Module):
    """Frozen row-vector ridge plus an optional trainable nonlinear correction.

    Default 192 -> 256 -> 192 residual has 98,752 trainable parameters.
    Ridge uses native centered coordinates. Scalar RMS normalization applies
    only to the residual input/output, matching the global interface fit.
    """
    def __init__(self, source_dim=192, target_dim=192, hidden_dim=256, *, residual=True):
        super().__init__()
        if min(source_dim, target_dim, hidden_dim) < 1:
            raise ValueError("Positive dimensions required")
        self.source_dim, self.target_dim = source_dim, target_dim
        self.register_buffer("ridge_weight", torch.zeros(source_dim, target_dim))
        self.register_buffer("source_mean", torch.zeros(source_dim))
        self.register_buffer("target_mean", torch.zeros(target_dim))
        self.register_buffer("source_scale", torch.ones(()))
        self.register_buffer("target_scale", torch.ones(()))
        self.residual = None
        if residual:
            self.residual = nn.Sequential(nn.Linear(source_dim, hidden_dim), nn.SiLU(),
                                          nn.Linear(hidden_dim, target_dim))
            nn.init.zeros_(self.residual[-1].weight)
            nn.init.zeros_(self.residual[-1].bias)

    @classmethod
    def fit(cls, source, target, *, regularization=1e-3, hidden_dim=256, residual=True):
        """Fit only on calibration-training rows; penalty is alpha*trace(X'X)/d."""
        if (source.ndim != 2 or target.ndim != 2 or len(source) != len(target)
                or len(source) < 2 or min(source.shape[-1], target.shape[-1]) < 1
                or not torch.isfinite(source).all() or not torch.isfinite(target).all()
                or not 0 < regularization < float("inf")):
            raise ValueError("Finite paired matrices and positive regularization required")
        if source.device != target.device:
            raise ValueError("Paired features must be on the same device")
        with torch.no_grad():
            x, y = source.detach().double(), target.detach().double()
            mx, my = x.mean(0), y.mean(0)
            x, y = x - mx, y - my
            sx, sy = x.square().mean().sqrt(), y.square().mean().sqrt()
            if min(sx.item(), sy.item()) < 1e-12:
                raise ValueError("Collapsed fit features cannot define normalization")
            cov = x.T @ x
            penalty = regularization * cov.trace() / x.shape[1]
            weight = torch.linalg.solve(cov + penalty * torch.eye(x.shape[1], device=x.device), x.T @ y)
            model = cls(x.shape[1], y.shape[1], hidden_dim, residual=residual).to(source.device)
            for name, value in (("ridge_weight", weight), ("source_mean", mx), ("target_mean", my),
                                ("source_scale", sx), ("target_scale", sy)):
                getattr(model, name).copy_(value)
            return model

    def teacher(self, x):
        """The fixed ridge reference, without the residual correction."""
        if x.ndim < 1 or x.shape[-1] != self.source_dim:
            raise ValueError("Wrong source feature dimension")
        return (x - self.source_mean) @ self.ridge_weight + self.target_mean

    def forward(self, x):
        result = self.teacher(x)
        if self.residual is not None:
            result = result + self.residual((x - self.source_mean) / self.source_scale) * self.target_scale
        return result
