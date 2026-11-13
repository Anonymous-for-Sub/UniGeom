"""Connect frozen source features to a frozen receiver without future leakage."""
import torch
from torch import nn


def autoregress(receiver, initial_history, actions, *, steps=None):
    """Roll out receiver-coordinate states from an observed history once.

    ``initial_history`` is [batch, H, *state_shape]. ``actions`` is
    [batch, H+K-1, *action_shape], including controls aligned with the observed
    history. Each receiver call takes H states and H aligned actions and must
    return ONE next state [batch, *state_shape]. Wrap receivers that return a
    sequence with explicit ``[:, -1]`` selection. Actions are already in the
    receiver's native convention; this function does not normalize or regroup.

    Gradients through frozen receiver operations remain available. Use
    ``torch.no_grad()`` at inference to avoid retaining an autograd graph.
    """
    if (initial_history.ndim < 3 or actions.ndim < 3 or initial_history.shape[0] != actions.shape[0]
            or initial_history.shape[1] < 1 or initial_history.shape[0] < 1):
        raise ValueError("Nonempty matching batches and a nonempty history required")
    history_length = initial_history.shape[1]
    available = actions.shape[1] - history_length + 1
    steps = available if steps is None else steps
    if not isinstance(steps, int) or not 1 <= steps <= available:
        raise ValueError("Insufficient aligned actions for requested rollout")
    if not torch.isfinite(initial_history).all() or not torch.isfinite(actions).all():
        raise ValueError("Finite states and actions required")
    history, output = initial_history, []
    for step in range(steps):
        prediction = receiver(history, actions[:, step:step + history_length])
        if prediction.shape != initial_history[:, -1].shape or not torch.isfinite(prediction).all():
            raise ValueError("Receiver must return one finite next state in native coordinates")
        output.append(prediction)
        history = torch.cat((history[:, 1:], prediction[:, None]), dim=1)
    return torch.stack(output, dim=1)


class FrozenConnection(nn.Module):
    """Frozen source encoder -> trainable interface -> frozen native receiver.

    The source encoder's ``forward`` returns vectors or ordered patch tokens.
    The receiver's ``forward(history, actions)`` returns one next state. Provide
    lightweight wrappers for external model APIs; their preprocessing, action
    grouping and normalizers remain the responsibility of those wrappers.
    Neither the source predictor nor the receiver encoder is needed online.
    """
    def __init__(self, source_encoder, adapter, receiver):
        super().__init__()
        self.source_encoder = source_encoder
        self.adapter = adapter
        self.receiver = receiver
        self.source_encoder.requires_grad_(False).eval()
        self.receiver.requires_grad_(False).eval()

    def train(self, mode=True):
        super().train(mode)
        self.source_encoder.eval()
        self.receiver.eval()
        return self

    def encode(self, observations):
        """The same path encodes both observed histories and goal observations."""
        with torch.no_grad():
            features = self.source_encoder(observations)
        return self.adapter(features)

    def forward(self, observations, actions):
        return self.receiver(self.encode(observations), actions)

    def rollout(self, observations, actions, *, steps=None):
        return autoregress(self.receiver, self.encode(observations), actions, steps=steps)
