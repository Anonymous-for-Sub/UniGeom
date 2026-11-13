"""UniGeom: calibrated interfaces for frozen representations and dynamics."""
from .calibration import (CalibrationResult, calibration_loss, fit_calibration,
                          split_trajectories, state_loss)
from .connection import FrozenConnection, autoregress
from .global_maps import RidgeResidualMap
from .spatial_maps import PooledReadout, SpatialReadout, SpatialResampler
from .statistics import fit_statistics

__all__ = ["CalibrationResult", "calibration_loss", "fit_calibration", "split_trajectories",
           "state_loss", "FrozenConnection", "autoregress", "RidgeResidualMap", "PooledReadout",
           "SpatialReadout", "SpatialResampler", "fit_statistics"]
__version__ = "0.1.0"
