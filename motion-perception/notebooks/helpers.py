"""Stage B: functions extracted into one module before creating a package."""
import pandas as pd


def clean_trials(trials, min_rt_s=0.2, max_rt_s=2.0):
    """Assumes the supplied workshop CSV schema; Stage C adds full validation."""
    return trials.loc[trials.reaction_time.between(min_rt_s, max_rt_s)].copy()


def summarize(trials):
    participant_metrics = (trials.groupby(["participant_id", "condition"], observed=True)
        .agg(accuracy=("correct", "mean"), median_rt=("reaction_time", "median"),
             n_trials=("correct", "size")).reset_index())
    return (participant_metrics.groupby("condition", observed=True)
        .agg(accuracy=("accuracy", "mean"), sem=("accuracy", "sem"),
             median_rt=("median_rt", "mean"), n_participants=("participant_id", "nunique"))
        .reset_index())


def plot_accuracy(condition_metrics):
    """Draw a precomputed condition_metrics; return the figure to the notebook."""
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(5, 3))
    for i, row in condition_metrics.iterrows():
        ax.errorbar(i, row.accuracy, yerr=1.96 * row["sem"], fmt="o", capsize=5,
                    color={"clear": "#167568", "noisy": "#a44c35"}[row.condition], markersize=9)
    ax.set(xticks=range(len(condition_metrics)), xticklabels=condition_metrics.condition,
           ylim=(0.45, 1), ylabel="Mean participant accuracy", title="Synthetic motion discrimination")
    ax.axhline(0.5, color="gray", linestyle=":")
    ax.spines[["top", "right"]].set_visible(False)
    return fig
