"""Ordered and pooled readouts, and residual spatial resampling interfaces."""
import math
import torch
from torch import nn
from torch.nn import functional as F
from .statistics import CalibratedMap


def position_encoding(grid, dim):
    """Fixed two-dimensional sine/cosine positions used in queries and keys."""
    if grid < 1 or dim < 4 or dim % 4:
        raise ValueError("Positive grid and channel dimension divisible by four required")
    y, x = torch.meshgrid(torch.linspace(-1, 1, grid), torch.linspace(-1, 1, grid), indexing="ij")
    freq = torch.exp(-math.log(10000) * torch.arange(dim // 4) / (dim // 4))
    return torch.cat([(x.flatten()[:, None] * freq).sin(), (x.flatten()[:, None] * freq).cos(),
                      (y.flatten()[:, None] * freq).sin(), (y.flatten()[:, None] * freq).cos()], -1)


class SpatialReadout(CalibratedMap):
    """Project each token, GELU, flatten in order, then map to a global state.

    Defaults implement the 196 x 768 MAE -> 192 receiver interface.
    """
    def __init__(self, source_dim=768, target_dim=192, tokens=196, width=32):
        super().__init__(source_dim, target_dim, scalar_target=True)
        if min(tokens, width) < 1:
            raise ValueError("Positive token count and width required")
        self.tokens = tokens
        self.patch = nn.Linear(source_dim, width)
        self.output = nn.Linear(tokens * width, target_dim)

    def forward(self, x):
        if x.ndim < 2 or x.shape[-2:] != (self.tokens, self.source_dim):
            raise ValueError("Wrong ordered token layout")
        return self.restore(self.output(F.gelu(self.patch(self.standardize(x))).flatten(-2)))


class PooledReadout(CalibratedMap):
    """Token mean followed by a GELU MLP; invariant to input token permutations."""
    def __init__(self, source_dim=768, target_dim=192, tokens=196, hidden_dim=1279):
        super().__init__(source_dim, target_dim, scalar_target=True)
        if min(tokens, hidden_dim) < 1:
            raise ValueError("Positive token count and hidden dimension required")
        self.tokens = tokens
        self.hidden = nn.Linear(source_dim, hidden_dim)
        self.output = nn.Linear(hidden_dim, target_dim)

    def forward_pooled(self, x):
        if x.ndim < 1 or x.shape[-1] != self.source_dim:
            raise ValueError("Wrong pooled feature dimension")
        return self.restore(self.output(F.gelu(self.hidden(self.standardize(x)))))

    def forward(self, x):
        if x.ndim < 2 or x.shape[-2:] != (self.tokens, self.source_dim):
            raise ValueError("Wrong source token layout")
        return self.forward_pooled(x.mean(-2))


class SpatialResampler(CalibratedMap):
    """Bilinear grid conversion plus optional attention or depthwise residual.

    The attention output projection starts at zero. No layer normalization,
    dropout or extra feed-forward block is added. Defaults match the
    16x16x192 -> 14x14x384 residual-attention interface.
    """
    def __init__(self, source_dim=192, target_dim=384, source_grid=16, target_grid=14,
                 hidden_dim=256, *, mode="attention", heads=2, head_dim=32):
        super().__init__(source_dim, target_dim)
        if mode not in ("attention", "bilinear", "depthwise"):
            raise ValueError("Unknown spatial mode")
        if min(source_grid, target_grid, hidden_dim, heads, head_dim) < 1:
            raise ValueError("Positive grid sizes and widths required")
        self.source_grid, self.target_grid, self.mode = source_grid, target_grid, mode
        self.heads, self.head_dim = heads, head_dim
        self.projection = nn.Sequential(nn.Linear(source_dim, hidden_dim), nn.GELU(),
                                        nn.Linear(hidden_dim, target_dim))
        if mode == "depthwise":
            self.spatial = nn.Conv2d(source_dim, source_dim, 3, padding=1, groups=source_dim)
            nn.init.zeros_(self.spatial.weight)
            nn.init.zeros_(self.spatial.bias)
        if mode == "attention":
            self.q = nn.Linear(source_dim, heads * head_dim)
            self.k = nn.Linear(source_dim, heads * head_dim)
            self.v = nn.Linear(source_dim, heads * head_dim)
            self.out = nn.Linear(heads * head_dim, source_dim)
            nn.init.zeros_(self.out.weight)
            nn.init.zeros_(self.out.bias)
            self.register_buffer("source_position", position_encoding(source_grid, source_dim))
            self.register_buffer("target_position", position_encoding(target_grid, source_dim))

    @classmethod
    def lewm(cls, mode="attention"):
        """Parameter-matched LeWM spatial designs from the paper."""
        widths = {"bilinear": 342, "depthwise": 339, "attention": 256}
        if mode not in widths:
            raise ValueError("Unknown spatial mode")
        return cls(hidden_dim=widths[mode], mode=mode)

    @classmethod
    def mae(cls, mode="attention"):
        """Parameter-matched 14x14x768 MAE spatial designs from the supplement."""
        widths = {"bilinear": 427, "depthwise": 421, "attention": 256}
        if mode not in widths:
            raise ValueError("Unknown spatial mode")
        return cls(768, 384, 14, 14, hidden_dim=widths[mode], mode=mode)

    def forward(self, tokens):
        if tokens.ndim < 2 or tokens.shape[-2:] != (self.source_grid ** 2, self.source_dim):
            raise ValueError("Wrong source patch grid or channels")
        leading = tokens.shape[:-2]
        x = self.standardize(tokens).reshape(-1, self.source_grid ** 2, self.source_dim)
        grid = x.transpose(1, 2).reshape(-1, self.source_dim, self.source_grid, self.source_grid)
        if self.source_grid != self.target_grid:
            grid = F.interpolate(grid, size=(self.target_grid, self.target_grid),
                                 mode="bilinear", align_corners=False)
        if self.mode == "depthwise":
            grid = grid + self.spatial(grid)
        y = grid.flatten(2).transpose(1, 2)
        if self.mode == "attention":
            def split_heads(value):
                return value.reshape(len(value), -1, self.heads, self.head_dim).transpose(1, 2)
            q = split_heads(self.q(y + self.target_position))
            k = split_heads(self.k(x + self.source_position))
            v = split_heads(self.v(x))
            weights = ((q @ k.transpose(-1, -2)) / math.sqrt(self.head_dim)).softmax(-1)
            attended = (weights @ v).transpose(1, 2).reshape(len(x), self.target_grid ** 2, -1)
            y = y + self.out(attended)
        return self.restore(self.projection(y)).reshape(*leading, self.target_grid ** 2, self.target_dim)
