"""Fit an interface to cached paired observations; no receiver training required."""
import argparse
import math
import torch
from unigeom import (RidgeResidualMap, SpatialReadout, PooledReadout, SpatialResampler,
                     fit_statistics, split_trajectories, fit_calibration, calibration_loss)
from unigeom.checkpoint import save_adapter


INTERFACES = ("ridge", "residual", "spatial-readout", "pooled",
              "spatial-fixed", "spatial-conv", "spatial-attention")


def grid_size(tokens):
    grid = math.isqrt(tokens)
    if grid * grid != tokens:
        raise ValueError("Spatial resampling requires a square patch grid")
    return grid


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("features", help="Tensor-only .pt dictionary of cached paired observations")
    parser.add_argument("--interface", choices=INTERFACES, default="residual")
    parser.add_argument("--output", required=True, help="Destination adapter .pt file")
    parser.add_argument("--steps", type=int, default=1000)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--learning-rate", type=float, default=1e-3)
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--ridge-regularization", type=float, default=1e-3)
    parser.add_argument("--validation-fraction", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--hidden-dim", type=int, default=None)
    parser.add_argument("--patch-width", type=int, default=32)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--threads", type=int, default=1)
    args = parser.parse_args()
    if args.threads < 1:
        parser.error("--threads must be positive")
    torch.set_num_threads(args.threads)
    torch.manual_seed(args.seed)
    data = torch.load(args.features, map_location="cpu", weights_only=True)
    if not isinstance(data, dict) or not {"source", "target", "trajectory_ids"} <= data.keys():
        raise ValueError("Expected source, target, trajectory_ids tensors")
    x, y = data["source"], data["target"]
    if any(not isinstance(v, torch.Tensor) or not v.is_floating_point() for v in (x, y)):
        raise ValueError("Source and target must be floating-point tensors")
    if x.ndim not in (3, 4) or y.ndim not in (3, 4) or x.shape[:2] != y.shape[:2]:
        raise ValueError("Features must be [N,H,D] or [N,H,T,C], sharing N and H")
    if len(data["trajectory_ids"]) != len(x):
        raise ValueError("One trajectory ID per paired history window required")
    if ("source_goal" in data) != ("target_goal" in data):
        raise ValueError("Supply both goal tensors or neither")
    if not torch.isfinite(x).all() or not torch.isfinite(y).all():
        raise ValueError("Finite paired features required")
    train, validation = split_trajectories(data["trajectory_ids"], args.validation_fraction, args.seed)
    x, y = x.float().to(args.device), y.float().to(args.device)
    train, validation = train.to(args.device), validation.to(args.device)
    source_goal, target_goal = data.get("source_goal"), data.get("target_goal")
    if source_goal is not None:
        for value, history in ((source_goal, x), (target_goal, y)):
            if (not isinstance(value, torch.Tensor) or not value.is_floating_point()
                    or value.shape != history[:, 0].shape or not torch.isfinite(value).all()):
                raise ValueError("Goal features must match one observed state per window")
        source_goal, target_goal = source_goal.float().to(args.device), target_goal.float().to(args.device)
    source_dim, target_dim = x.shape[-1], y.shape[-1]
    if args.interface in ("ridge", "residual"):
        if x.ndim != 3 or y.ndim != 3:
            raise ValueError("Global interfaces require [N,H,D] tensors")
        adapter = RidgeResidualMap.fit(x[train].flatten(0, 1), y[train].flatten(0, 1),
                                      regularization=args.ridge_regularization,
                                      hidden_dim=args.hidden_dim or 256,
                                      residual=args.interface == "residual")
        scale = 1.0
    else:
        if x.ndim != 4:
            raise ValueError("Spatial source features require [N,H,T,C]")
        if args.interface in ("spatial-readout", "pooled"):
            if y.ndim != 3:
                raise ValueError("Spatial-to-global targets require [N,H,D]")
            adapter = (SpatialReadout(source_dim, target_dim, x.shape[-2], args.patch_width)
                       if args.interface == "spatial-readout" else
                       PooledReadout(source_dim, target_dim, x.shape[-2], args.hidden_dim or 1279))
            target_scale = "scalar"
            scale = 1.0
        else:
            if y.ndim != 4:
                raise ValueError("Spatial targets require [N,H,T,C]")
            source_grid, target_grid = grid_size(x.shape[-2]), grid_size(y.shape[-2])
            mode = {"spatial-fixed": "bilinear", "spatial-conv": "depthwise",
                    "spatial-attention": "attention"}[args.interface]
            if args.hidden_dim is None and (source_dim, target_dim, source_grid, target_grid) == (192,384,16,14):
                adapter = SpatialResampler.lewm(mode)
            elif args.hidden_dim is None and (source_dim, target_dim, source_grid, target_grid) == (768,384,14,14):
                adapter = SpatialResampler.mae(mode)
            else:
                adapter = SpatialResampler(source_dim, target_dim, source_grid, target_grid,
                                           hidden_dim=args.hidden_dim or 256, mode=mode)
            target_scale = "channel"
            scale = float(y[train].double().reshape(-1, target_dim).var(0, unbiased=False).mean().clamp_min(1e-8))
        adapter = adapter.to(args.device)
        adapter.set_statistics(**fit_statistics(x[train], y[train], target_scale=target_scale))
    def goal_kwargs(index):
        return dict(source_goal=None if source_goal is None else source_goal[index],
                    target_goal=None if target_goal is None else target_goal[index],
                    history_weight=float(x.shape[1]), goal_weight=1.0, scale=scale)
    if args.interface != "ridge":
        fit_calibration(adapter, x[train], y[train], steps=args.steps, batch_size=args.batch_size,
                        learning_rate=args.learning_rate, weight_decay=args.weight_decay,
                        seed=args.seed, **goal_kwargs(train))
    adapter.eval()
    with torch.no_grad():
        diagnostic = float(calibration_loss(adapter, x[validation], y[validation], **goal_kwargs(validation)))
    save_adapter(adapter, args.output)
    print(f"Saved adapter to {args.output}")
    print(f"Validation state loss (diagnostic only): {diagnostic:.6g}")


if __name__ == "__main__":
    main()
