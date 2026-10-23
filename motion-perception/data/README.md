# Fully synthetic data

`raw/trials.csv` contains 3,840 simulated trials: 24 fictitious participants × 2 conditions × 80 trials. Seed: **202611**, generated with NumPy's local `default_rng`. No human data or identifiers are used. Regenerate with `python scripts/generate_data.py` after installation.

| Column | Meaning |
| --- | --- |
| participant_id | Fictitious identifier, `sim-01` through `sim-24` |
| condition | `clear` or `noisy` (larger noise reduces modeled sensitivity) |
| stimulus_strength | Unsigned motion coherence: 0.1, 0.2, 0.4, 0.8 |
| stimulus_direction | -1 left; +1 right |
| choice_right | 1 right; 0 left |
| reaction_time | Positive seconds; occasional simulated timing artifacts |
| correct | 1 if choice matches direction; 0 otherwise |

Preprocessing retains inclusive RT bounds 0.2–2.0 s and includes errors. Accuracy is computed within participant and condition, then averaged across participants. Error bars are ±1.96 participant SEM, an approximate descriptive interval, not a paired condition test. Lines join empirical probabilities; no psychometric model is fitted. This simulation cannot establish any fact about human perception.

Raw data are immutable inputs. `processed/` and `results/` are generated locally and ignored by Git. This small synthetic raw CSV is intentionally version controlled; real restricted data require an approved storage/access process.
