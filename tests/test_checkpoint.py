import subprocess
import sys
from pathlib import Path
import pytest
import torch
from unigeom import RidgeResidualMap, SpatialReadout, PooledReadout, SpatialResampler
from unigeom.checkpoint import save_adapter, load_adapter


@pytest.mark.parametrize("kind", ["ridge", "residual", "readout", "pooled", "attention", "bilinear", "depthwise"])
def test_interface_roundtrip(kind, tmp_path):
    torch.manual_seed(7)
    if kind in ("ridge", "residual"):
        x = torch.randn(12, 8)
        model = RidgeResidualMap.fit(x, x @ torch.randn(8, 6), residual=kind == "residual")
    else:
        x = torch.randn(2, 3, 4, 8)
        if kind == "readout":
            model = SpatialReadout(8, 6, 4, 3)
        elif kind == "pooled":
            model = PooledReadout(8, 6, 4, 9)
        else:
            model = SpatialResampler(8, 6, 2, 3, 11, mode=kind, head_dim=4)
    path = tmp_path / "adapter.pt"
    save_adapter(model, path)
    restored = load_adapter(path)
    assert type(restored) is type(model)
    torch.testing.assert_close(restored(x), model(x), rtol=0, atol=0)
    assert not restored.training


def test_reject_unknown_checkpoint(tmp_path):
    path = tmp_path / "unsupported.pt"
    torch.save({"format_version": 99}, path)
    with pytest.raises(ValueError):
        load_adapter(path)


@pytest.mark.parametrize("kind", ["ridge", "residual", "spatial-readout", "pooled", "spatial-fixed", "spatial-conv", "spatial-attention"])
def test_paired_training_cli(kind, tmp_path):
    x = torch.randn(12, 3, 8) if kind in ("ridge", "residual") else torch.randn(12, 3, 4, 8)
    y = 2*x+1
    if kind in ("spatial-readout", "pooled"):
        y = y.mean(-2)
    cache, output = tmp_path / "pairs.pt", tmp_path / "adapter.pt"
    torch.save(dict(source=x, target=y, source_goal=x[:, -1], target_goal=y[:, -1],
                    trajectory_ids=torch.arange(6).repeat_interleave(2)), cache)
    script = Path(__file__).resolve().parents[1] / "examples" / "train_paired.py"
    subprocess.run([sys.executable, str(script), str(cache), "--interface", kind,
                    "--output", str(output), "--steps", "3"], check=True, capture_output=True, text=True)
    model = load_adapter(output)
    assert model(x).shape == y.shape
    assert torch.isfinite(model(x)).all()
