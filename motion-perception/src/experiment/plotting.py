"""Plot already-computed results; never load or filter data here."""
import matplotlib.pyplot as plt

COLORS = {"clear": "#167568", "noisy": "#a44c35"}


def plot_results(condition_metrics, choice_probabilities):
    """Present already-computed metrics without filtering or aggregating trials.

    condition_metrics has condition, accuracy (fraction), and participant SEM.
    choice_probabilities has condition, signed_strength, and P(right) in
    choice_right. Inputs are not modified; the caller owns the returned figure.
    """
    fig, axes = plt.subplots(1, 2, figsize=(9, 3.8), layout="constrained")
    for i, row in condition_metrics.iterrows():
        axes[0].errorbar(i, row.accuracy, yerr=1.96 * row["sem"], fmt="o", capsize=5,
                         color=COLORS[row.condition], markersize=9)
    axes[0].set(xticks=range(len(condition_metrics)), xticklabels=condition_metrics.condition,
                ylim=(0.45, 1), ylabel="Mean participant accuracy", title="Performance by condition")
    axes[0].axhline(0.5, color="gray", linestyle=":", label="Chance")
    for condition, points in choice_probabilities.groupby("condition", observed=True):
        axes[1].plot(points.signed_strength, points.choice_right, "o-",
                     label=condition, color=COLORS[condition])
    axes[1].set(xlabel="Signed motion strength (left ← → right)", ylabel="P(right choice)",
                ylim=(-0.02, 1.02), title="Empirical choice curves")
    axes[1].legend(frameon=False)
    for ax in axes:
        ax.spines[["top", "right"]].set_visible(False)
    fig.suptitle("Synthetic motion discrimination · seed 202611", fontsize=11)
    return fig
