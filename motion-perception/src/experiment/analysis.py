"""Participant-level descriptive summaries; no population inference is implied."""
import pandas as pd


def participant_summary(trials: pd.DataFrame) -> pd.DataFrame:
    """Return one row per participant and condition without changing trials.

    accuracy is a fraction; median_rt is seconds and includes error trials.
    n_trials is the denominator used for the accuracy calculation.
    """
    return (trials.groupby(["participant_id", "condition"], observed=True)
            .agg(accuracy=("correct", "mean"), median_rt=("reaction_time", "median"),
                 n_trials=("correct", "size")).reset_index())


def condition_summary(participant_metrics: pd.DataFrame) -> pd.DataFrame:
    """Give each participant equal weight, rather than pooling all trials."""
    return (participant_metrics.groupby("condition", observed=True)
            .agg(accuracy=("accuracy", "mean"), sem=("accuracy", "sem"),
                 median_rt=("median_rt", "mean"), n_participants=("participant_id", "nunique"))
            .reset_index())


def choice_curve(trials: pd.DataFrame) -> pd.DataFrame:
    """Empirical P(right) by signed strength, averaged across participants."""
    data = trials.assign(signed_strength=trials.stimulus_strength * trials.stimulus_direction)
    individual = (data.groupby(["participant_id", "condition", "signed_strength"], observed=True)
                  .choice_right.mean().reset_index())
    return (individual.groupby(["condition", "signed_strength"], observed=True)
            .choice_right.mean().reset_index())
