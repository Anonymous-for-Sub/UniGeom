"""Save interface configuration and tensor weights without a model-code pickle."""
from pathlib import Path
import torch
from .global_maps import RidgeResidualMap
from .spatial_maps import SpatialReadout, PooledReadout, SpatialResampler


_CLASSES = {cls.__name__: cls for cls in
            (RidgeResidualMap, SpatialReadout, PooledReadout, SpatialResampler)}


def save_adapter(adapter, path):
    """Save architecture, fixed statistics and weights; omit training data/logs."""
    config = dict(source_dim=adapter.source_dim, target_dim=adapter.target_dim)
    if type(adapter) is RidgeResidualMap:
        config.update(hidden_dim=adapter.residual[0].out_features if adapter.residual is not None else 256,
                      residual=adapter.residual is not None)
    elif type(adapter) is SpatialReadout:
        config.update(tokens=adapter.tokens, width=adapter.patch.out_features)
    elif type(adapter) is PooledReadout:
        config.update(tokens=adapter.tokens, hidden_dim=adapter.hidden.out_features)
    elif type(adapter) is SpatialResampler:
        config.update(source_grid=adapter.source_grid, target_grid=adapter.target_grid,
                      hidden_dim=adapter.projection[0].out_features, mode=adapter.mode,
                      heads=adapter.heads, head_dim=adapter.head_dim)
    else:
        raise TypeError("Unsupported interface class")
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(dict(format_version=1, interface=type(adapter).__name__, config=config,
                    state_dict={k: v.detach().cpu() for k, v in adapter.state_dict().items()}), path)


def load_adapter(path, *, device="cpu"):
    """Restore a supported interface using restricted tensor/config loading."""
    payload = torch.load(path, map_location="cpu", weights_only=True)
    if not isinstance(payload, dict) or payload.get("format_version") != 1:
        raise ValueError("Unsupported adapter checkpoint format")
    name = payload.get("interface")
    if name not in _CLASSES or not isinstance(payload.get("config"), dict):
        raise ValueError("Unsupported interface configuration")
    adapter = _CLASSES[name](**payload["config"])
    adapter.load_state_dict(payload["state_dict"], strict=True)
    return adapter.to(device).eval()
