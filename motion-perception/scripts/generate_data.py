"""Run from any directory after installing the package."""
import argparse
from pathlib import Path
from experiment.simulation import SEED, write_trials

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=SEED)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "data/raw/trials.csv")
    args = parser.parse_args()
    write_trials(args.output, args.seed)
    print(f"Wrote fully synthetic data to {args.output}")
