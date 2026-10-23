"""Coordinate one analysis run; numerical functions remain independent of files."""
from datetime import datetime, timezone
from hashlib import sha256
from importlib.metadata import version
import json
import platform
import matplotlib.pyplot as plt
from experiment.config import AnalysisConfig
from experiment.preprocessing import load_trials, filter_trials
from experiment.analysis import participant_summary, condition_summary, choice_curve
from experiment.plotting import plot_results


def run_analysis(config: AnalysisConfig):
    """Write results and effective settings; return the condition-level table.

    Repeating a run replaces generated files in config.output_dir. Use separate
    output directories for sensitivity analyses so the baseline is preserved.
    """
    raw_trials = load_trials(config.data_path)
    filtered_trials = filter_trials(
        raw_trials, min_rt_s=config.min_rt_s, max_rt_s=config.max_rt_s
    )
    participant_metrics = participant_summary(filtered_trials)
    condition_metrics = condition_summary(participant_metrics)
    choice_probabilities = choice_curve(filtered_trials)
    figure = plot_results(condition_metrics, choice_probabilities)
    try:
        config.output_dir.mkdir(parents=True, exist_ok=True)
        participant_metrics.to_csv(config.output_dir / "participants.csv", index=False)
        condition_metrics.to_csv(config.output_dir / "conditions.csv", index=False)
        figure.savefig(config.output_dir / "behavior.svg", metadata={"Date": None})
    finally:
        plt.close(figure)
    run_record = {
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "config_source": str(config.config_path) if config.config_path else None,
        "configuration": {
            "data_path": str(config.data_path), "output_dir": str(config.output_dir),
            "min_rt_s": config.min_rt_s, "max_rt_s": config.max_rt_s,
            "bounds": "inclusive", "includes_error_trials": True,
        },
        "input_sha256": sha256(config.data_path.read_bytes()).hexdigest(),
        "trial_counts": {"raw": len(raw_trials), "retained": len(filtered_trials)},
        "software": {
            "python": platform.python_version(),
            **{package: version(package) for package in ["numpy", "pandas", "matplotlib", "motion-perception-workshop"]},
        },
    }
    (config.output_dir / "run.json").write_text(json.dumps(run_record, indent=2) + "\n")
    print(f"Retained {len(filtered_trials)} / {len(raw_trials)} trials. "
          f"Bounds: {config.min_rt_s}–{config.max_rt_s} s")
    print(condition_metrics.to_string(index=False))
    return condition_metrics
