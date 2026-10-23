"""Load and validate raw trials; apply explicit, documented exclusion rules."""
from pathlib import Path
import numpy as np
import pandas as pd

REQUIRED = {"participant_id", "condition", "stimulus_strength", "stimulus_direction",
            "choice_right", "reaction_time", "correct"}


def validate_trials(trials: pd.DataFrame) -> None:
    missing = REQUIRED - set(trials.columns)
    if missing:
        raise ValueError(f"Missing columns: {sorted(missing)}")
    if trials.empty:
        raise ValueError("No trials provided")
    if trials[list(REQUIRED)].isna().any().any():
        raise ValueError("Required fields contain missing values")
    numeric = ["stimulus_strength", "stimulus_direction", "choice_right", "reaction_time", "correct"]
    if not all(pd.api.types.is_numeric_dtype(trials[c]) for c in numeric):
        raise ValueError("Trial measurements must be numeric")
    if not np.isfinite(trials[numeric].to_numpy()).all():
        raise ValueError("Trial measurements must be finite")
    if not trials.condition.isin(["clear", "noisy"]).all():
        raise ValueError("Unknown condition")
    if not trials.stimulus_direction.isin([-1, 1]).all():
        raise ValueError("Direction must be -1 or +1")
    if not trials.choice_right.isin([0, 1]).all() or not trials.correct.isin([0, 1]).all():
        raise ValueError("Choice and correctness must be binary")
    if not trials.stimulus_strength.between(0, 1).all():
        raise ValueError("Strength must lie between 0 and 1")
    if not (trials.reaction_time > 0).all():
        raise ValueError("Reaction time must be positive seconds")
    expected = (trials.choice_right == (trials.stimulus_direction == 1)).astype(int)
    if not (trials.correct == expected).all():
        raise ValueError("Correctness disagrees with direction and choice")
    if not trials.participant_id.map(lambda value: isinstance(value, str) and bool(value.strip())).all():
        raise ValueError("Participant IDs must be nonempty strings")


def load_trials(path: Path | str) -> pd.DataFrame:
    trials = pd.read_csv(path)
    validate_trials(trials)
    return trials


def filter_trials(trials: pd.DataFrame, min_rt_s: float = 0.2, max_rt_s: float = 2.0) -> pd.DataFrame:
    """Return a new trial table within inclusive bounds measured in seconds.

    Retain correct and incorrect trials; never mutate the input. Reject an
    invalid schema, nonfinite/unordered bounds, or an empty retained dataset.
    """
    validate_trials(trials)
    if not (np.isfinite(min_rt_s) and np.isfinite(max_rt_s) and 0 < min_rt_s < max_rt_s):
        raise ValueError("Require finite bounds with 0 < min_rt_s < max_rt_s")
    filtered_trials = trials.loc[trials.reaction_time.between(min_rt_s, max_rt_s)].copy()
    if filtered_trials.empty:
        raise ValueError("No trials remain after filtering")
    return filtered_trials
