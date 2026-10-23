"""Run the synthetic experiment with reviewed, version-controlled settings."""
import argparse
from dataclasses import replace
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
from experiment.config import load_config
from experiment.workflow import run_analysis


def main(argv=None):
    project_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=project_root / "config/analysis.toml")
    parser.add_argument("--data", type=Path, help="Override input path (relative to the terminal)")
    parser.add_argument("--output", type=Path, help="Override output directory (relative to the terminal)")
    parser.add_argument("--min-rt", type=float, help="Override the minimum RT in seconds")
    parser.add_argument("--max-rt", type=float, help="Override the maximum RT in seconds")
    args = parser.parse_args(argv)
    try:
        config = load_config(args.config)
        overrides = {name: value for name, value in {
            "data_path": args.data.resolve() if args.data else None,
            "output_dir": args.output.resolve() if args.output else None,
            "min_rt_s": args.min_rt, "max_rt_s": args.max_rt,
        }.items() if value is not None}
        config = replace(config, **overrides)
        run_analysis(config)
    except (ValueError, OSError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
