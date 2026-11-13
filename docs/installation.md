# Installation

UniGeom requires Python 3.10 or newer and PyTorch 2.2 or newer. The `test` extra adds pytest. The package, unit tests, and synthetic examples can run on CPU without downloading model weights.

## CPU environment

Run these commands from the repository root:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install 'torch>=2.2' --index-url https://download.pytorch.org/whl/cpu
python -m pip install -e '.[test]'
python -m pytest -q
python examples/synthetic_calibration.py
```

On Windows, activate the virtual environment with `.venv\Scripts\activate` instead. GitHub Actions runs CPU checks on Python 3.10 and 3.12; the workflow is in [tests.yml](../.github/workflows/tests.yml).

For a minimal installation without test dependencies:

```bash
python -m pip install -e .
```

Install your preferred PyTorch build before installing UniGeom if your application needs a specific accelerator runtime. UniGeom uses tensors and modules on the device selected by your application.

## External models and data

Adapters accept feature tensors. Obtain source and receiver encoders, any receiver dynamics model, preprocessing, and datasets through their upstream projects. UniGeom does not download these assets during installation or testing.

Keep each encoder's input preprocessing and the receiver's action normalization, history length, and prediction step duration consistent with its training configuration. See [integration](integration.md) for feature shapes and the prediction contract.

## Saving adapters

Use the checkpoint helpers to save and restore the adapter's architecture settings and state dictionary. The state dictionary includes fitted normalization statistics and, for ridge maps, the frozen ridge parameters.

```python
from unigeom.checkpoint import save_adapter, load_adapter

save_adapter(adapter, "adapter.pt")
adapter = load_adapter("adapter.pt", device="cpu")
```

`load_adapter` uses `weights_only=True` and returns the adapter in evaluation mode. Only load checkpoints from trusted sources. Keep external model weights separate from the code repository.
