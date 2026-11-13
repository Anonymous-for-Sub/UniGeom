"""State-correspondence calibration with optional observed goal views."""
from dataclasses import dataclass
import math
import torch


def split_trajectories(episode_ids, validation_fraction=0.2, seed=0):
    """Return disjoint train/validation row indices, keeping trajectories intact."""
    ids = torch.as_tensor(episode_ids, device="cpu")
    if ids.ndim != 1 or ids.numel() == 0 or ids.dtype not in (torch.int32, torch.int64):
        raise ValueError("Nonempty integer episode IDs required")
    parents = torch.unique(ids, sorted=True)
    if not 0 < validation_fraction < 1:
        raise ValueError("Validation fraction must be between zero and one")
    count = int((1 - validation_fraction) * len(parents))
    if not 0 < count < len(parents):
        raise ValueError("Need at least one train and one validation trajectory")
    generator = torch.Generator().manual_seed(seed)
    parents = parents[torch.randperm(len(parents), generator=generator)]
    mask = torch.isin(ids, parents[:count])
    return mask.nonzero().flatten(), (~mask).nonzero().flatten()


def state_loss(prediction, target, scale=1.0):
    """Mean squared error in native receiver coordinates, divided by fixed s_B."""
    if prediction.shape != target.shape or prediction.numel() == 0:
        raise ValueError("Matching nonempty state tensors required")
    if not math.isfinite(float(scale)) or float(scale) <= 0:
        raise ValueError("Finite positive fixed loss scale required")
    return (prediction - target.detach()).square().mean() / scale


def calibration_loss(adapter, source, target, *, source_goal=None, target_goal=None,
                     history_weight=3.0, goal_weight=1.0, scale=1.0):
    """History and observed goal-view correspondence; no future-state labels.

    Each group is averaged over its entries before combining group weights.
    A three-frame history and one goal use weights 3:1.
    """
    if not math.isfinite(history_weight) or history_weight <= 0:
        raise ValueError("Positive history weight required")
    loss = state_loss(adapter(source), target, scale)
    if (source_goal is None) != (target_goal is None):
        raise ValueError("Supply both paired goal tensors or neither")
    if source_goal is None:
        return loss
    if not math.isfinite(goal_weight) or goal_weight < 0:
        raise ValueError("Finite nonnegative goal weight required")
    goal_loss = state_loss(adapter(source_goal), target_goal, scale)
    return (history_weight * loss + goal_weight * goal_loss) / (history_weight + goal_weight)


@dataclass(frozen=True)
class CalibrationResult:
    """In-memory optimization outcome; no experiment logs are written."""
    initial_loss: float
    final_loss: float
    steps: int


def fit_calibration(adapter, source, target, *, steps=1000, batch_size=64,
                    learning_rate=1e-3, weight_decay=1e-4, seed=0,
                    source_goal=None, target_goal=None, history_weight=3.0,
                    goal_weight=1.0, scale=1.0, gradient_clip=1.0):
    """Fit an adapter for a fixed update budget with AdamW and paired rows.

    Inputs must already be calibration-training rows, and normalization must
    already be fixed on that split. ``gradient_clip=1`` matches spatial fits;
    set it to ``None`` for an unclipped global fit. This fixed-update utility
    does not reproduce the global experiment's early-stopping selection.
    Frozen encoders/receiver are never passed
    to the optimizer. Checkpoint/architecture selection belongs to the caller.
    """
    if (steps < 0 or batch_size < 1 or learning_rate <= 0 or weight_decay < 0
            or source.ndim < 2 or target.ndim < 2 or len(source) != len(target) or len(source) == 0):
        raise ValueError("Invalid fitting data or optimization settings")
    if (source_goal is None) != (target_goal is None):
        raise ValueError("Supply both paired goal tensors or neither")
    tensors = [source, target] + ([] if source_goal is None else [source_goal, target_goal])
    if any(len(v) != len(source) or v.device != source.device or not torch.isfinite(v).all() for v in tensors):
        raise ValueError("Paired finite tensors on one device with equal row counts required")
    if gradient_clip is not None and (not math.isfinite(gradient_clip) or gradient_clip <= 0):
        raise ValueError("Gradient clip must be positive or None")
    parameters = [p for p in adapter.parameters() if p.requires_grad]
    if not parameters:
        raise ValueError("Adapter has no trainable parameters; ridge fitting is closed-form")
    source, target = source.detach(), target.detach()
    if source_goal is not None:
        source_goal, target_goal = source_goal.detach(), target_goal.detach()
    generator = torch.Generator(device="cpu").manual_seed(seed)
    optimizer = torch.optim.AdamW(parameters, lr=learning_rate, weight_decay=weight_decay)

    def objective(index=None):
        pick = lambda value: value if index is None else value[index]
        return calibration_loss(adapter, pick(source), pick(target),
                                source_goal=None if source_goal is None else pick(source_goal),
                                target_goal=None if target_goal is None else pick(target_goal),
                                history_weight=history_weight, goal_weight=goal_weight, scale=scale)

    with torch.no_grad():
        initial = float(objective())
    adapter.train()
    for _ in range(steps):
        index = torch.randint(len(source), (min(batch_size, len(source)),), generator=generator).to(source.device)
        optimizer.zero_grad(set_to_none=True)
        loss = objective(index)
        if not torch.isfinite(loss):
            raise ValueError("Nonfinite calibration loss")
        loss.backward()
        if gradient_clip is not None:
            torch.nn.utils.clip_grad_norm_(parameters, gradient_clip, error_if_nonfinite=True)
        optimizer.step()
    adapter.eval()
    with torch.no_grad():
        final = float(objective())
    if not math.isfinite(initial) or not math.isfinite(final):
        raise ValueError("Nonfinite calibration loss")
    return CalibrationResult(initial, final, steps)
