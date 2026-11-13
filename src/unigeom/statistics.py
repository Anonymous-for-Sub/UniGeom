"""Fixed calibration statistics; pass training features only to fitting routines."""
import torch
from torch import nn


def fit_statistics(source, target, *, target_scale="channel", minimum_scale=1e-4):
    """Estimate channel source scales and channel or scalar receiver scales.

    All axes except the last are observations. For ordered spatial-to-global
    readout use ``target_scale='scalar'``; token-to-token maps use ``'channel'``.
    Split trajectories before calling: this function does not select data roles.
    """
    if minimum_scale <= 0 or target_scale not in ("channel", "scalar"):
        raise ValueError("Positive minimum scale and channel/scalar mode required")
    if any(x.ndim < 2 or x.numel() == 0 or not torch.isfinite(x).all() for x in (source, target)):
        raise ValueError("Nonempty finite feature tensors required")
    with torch.no_grad():
        x = source.detach().double().reshape(-1, source.shape[-1])
        y = target.detach().double().reshape(-1, target.shape[-1])
        sx = x.std(0, unbiased=False).clamp_min(minimum_scale)
        vy = y.var(0, unbiased=False)
        sy = (vy.mean().sqrt() if target_scale == "scalar" else vy.sqrt()).clamp_min(minimum_scale)
        return dict(source_mean=x.mean(0).float(), source_scale=sx.float(),
                    target_mean=y.mean(0).float(), target_scale=sy.float())


class CalibratedMap(nn.Module):
    """Base class for source standardization and native receiver-scale restoration."""
    def __init__(self, source_dim, target_dim, *, scalar_target=False):
        super().__init__()
        if source_dim < 1 or target_dim < 1:
            raise ValueError("Positive feature dimensions required")
        self.source_dim, self.target_dim = source_dim, target_dim
        self.register_buffer("source_mean", torch.zeros(source_dim))
        self.register_buffer("source_scale", torch.ones(source_dim))
        self.register_buffer("target_mean", torch.zeros(target_dim))
        self.register_buffer("target_scale", torch.ones(()) if scalar_target else torch.ones(target_dim))

    @torch.no_grad()
    def set_statistics(self, *, source_mean, source_scale, target_mean, target_scale):
        values = dict(source_mean=source_mean, source_scale=source_scale,
                      target_mean=target_mean, target_scale=target_scale)
        for name, value in values.items():
            value = torch.as_tensor(value)
            if value.shape != getattr(self, name).shape or not torch.isfinite(value).all():
                raise ValueError("Invalid statistic: " + name)
            if name.endswith("scale") and not (value > 0).all():
                raise ValueError("Positive scales required")
        for name, value in values.items():
            getattr(self, name).copy_(torch.as_tensor(value))
        return self

    def standardize(self, x):
        return (x - self.source_mean) / self.source_scale

    def restore(self, y):
        return y * self.target_scale + self.target_mean
