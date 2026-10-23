"""Generate fully synthetic trial data; no participant information is used."""
from pathlib import Path
import numpy as np
import pandas as pd

SEED = 202611


def generate_trials(seed: int = SEED, participants: int = 24, trials: int = 80) -> pd.DataFrame:
    """Generate equal trial counts per participant and condition with a local RNG.

    Direction is -1 (left) or +1 (right). Strength is unsigned coherence.
    A logistic response rule models choice; this is a teaching model, not
    an estimate of human behavior. Sparse RT artifacts illustrate filtering.
    """
    rng = np.random.default_rng(seed)
    records = []
    for participant in range(1, participants + 1):
        bias = rng.normal(0, 0.15)
        sensitivity = rng.normal(5, 0.4)
        for condition, noise in [("clear", 1.0), ("noisy", 1.7)]:
            for _ in range(trials):
                strength = float(rng.choice([0.1, 0.2, 0.4, 0.8]))
                direction = int(rng.choice([-1, 1]))
                prob_right = 1 / (1 + np.exp(-(sensitivity * strength * direction / noise + bias)))
                choice = int(rng.random() < prob_right)
                rt = float(rng.lognormal(np.log(0.65 + 0.25 * noise - 0.3 * strength), 0.22))
                if rng.random() < 0.02:
                    rt = float(rng.choice([0.08, 3.5]))
                records.append((f"sim-{participant:02d}", condition, strength,
                                direction, choice, round(rt, 5), int(choice == (direction == 1))))
    return pd.DataFrame(records, columns=["participant_id", "condition", "stimulus_strength",
        "stimulus_direction", "choice_right", "reaction_time", "correct"])


def write_trials(path: Path, seed: int = SEED) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    generate_trials(seed).to_csv(path, index=False, float_format="%.5f", lineterminator="\n")
