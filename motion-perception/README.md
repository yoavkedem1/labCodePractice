# Motion perception · clean research code workshop

For researchers who already write analysis code and have completed introductory programming. The workshop practices meaningful names, explicit function contracts, configuration, notebook-to-module extraction, tests, and Git review. All trials are synthetic; the scientific comparison is descriptive.

## Install and run

Use Python **3.11** (3.12 declared compatible). From this directory:

```sh
python -m venv .venv
# macOS / Linux
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
python scripts/generate_data.py
python scripts/run_analysis.py --config config/analysis.toml
python scripts/run_analysis.py --config config/sensitivity.toml
python -m pytest
python -m jupyterlab
```

Use `python3.11` or `py -3.11` to create the environment if that is your platform's launcher. Select the same environment's kernel in Jupyter. To recreate the tested Python 3.11 package resolution, install `python -m pip install -r requirements-lock.txt` before `python -m pip install --no-deps -e .`. This pins dependencies; also record the OS, Python version, source revision, input provenance, and scientific settings.

## Compare the stages

- **A:** `notebooks/01_exploration.ipynb` is deliberately repetitive and uses weak intermediate names. Review it, rename without changing results, and extract the repeated policy.
- **B:** `02_refactored.ipynb` uses `notebooks/helpers.py` and a dictionary of named bounds. Inputs and calculations are explicit. This is a reasonable small-project structure.
- **C:** `03_project.ipynb` calls the installed `experiment` package and loads the same `config/analysis.toml` as the script. It displays diagnostics and compares a separate sensitivity policy without overwriting the baseline.

Start Jupyter from this project root or `notebooks/`. Each notebook resolves its root explicitly; Stage B makes one documented directory adjustment for the neighboring helper import if necessary. Restart and run all after editing modules. The tests run each stage in an independent kernel and compare accuracy, SEM, participant-weighted RT, and counts at `1e-12` tolerance.

## Configuration and run records

`config/analysis.toml` defines the baseline: inclusive **0.2–2.0 s** RTs, with errors retained. `config/sensitivity.toml` uses **0.6–2.0 s** and a distinct output directory. It is an exploratory teaching example, not a justified scientific replacement.

Paths inside TOML resolve from the config file's directory. The default config is located from the script, so `python /absolute/project/scripts/run_analysis.py` works even when launched elsewhere. For a custom config, pass its relative or absolute location explicitly. A typo, missing key, nonnumeric/nonfinite bound, or invalid bound order stops before outputs are written.

Results go to `results/baseline/` or `results/sensitivity/`:

- `conditions.csv`: equal-weight mean participant metrics by condition.
- `participants.csv`: one row per participant and condition.
- `behavior.svg`: descriptive accuracy and empirical choice curves.
- `run.json`: effective bounds and paths, inclusion policy, input SHA-256 hash, trial counts, UTC time, and software versions.

Explicit CLI options override the file; relative `--data` and `--output` paths resolve from the terminal directory. For example: `python scripts/run_analysis.py --min-rt 0.6 --output results/quick-check`. The JSON records the resolved values, not just a copy of the source file. Prefer a named committed config for a result you will reuse. Repeating a run replaces files in its output directory. Raw inputs are never overwritten by analysis.

Baseline reference: **3,761 / 3,840** retained trials; mean participant accuracy approximately **0.808111** clear and **0.713384** noisy. `data/README.md` documents units, generation seed, weighting, and limitations. Figure error bars are ±1.96 participant SEM; lines join empirical P(right), with no fitted psychometric model or paired inferential test.

## Responsibilities and collaboration

`config.py` parses settings; `preprocessing.py` validates/filters tables; `analysis.py` computes metrics; `plotting.py` presents them; `workflow.py` coordinates a file-producing run; `scripts/` handles CLI arguments. Numerical functions receive explicit tables and values instead of reading globals or config files. Importing the script does not execute the analysis.

Commit source, tests, documentation, named configs, and this small synthetic CSV. Ignore `.venv`, caches, and local generated outputs. Archive run records with results when required by your research workflow; a hash does not preserve data, and pinned dependencies do not document the scientific policy. Track the code revision in run notes or release metadata too.

No private lab repository is needed. The downloadable project has no `.git` directory; initialize your own practice repository and follow the workshop Git lab to add `config/rt-050.toml` on a branch, inspect and explain the changed selection, and propose it for review separately from a mechanical refactor.
