# Research / Code

A complete static Python and Git workshop for neuroscience and psychology researchers, designed for a 90-minute lab meeting in November 2026 and about three hours of self-paced study. Participants have completed introductory programming and already write analysis code. One synthetic motion-discrimination experiment evolves from a repetitive notebook into a reusable, tested Python package with reviewed TOML settings. The focus is meaningful names, scientific intent, function contracts, notebook-to-module extraction, shared configuration, and Git review.

## What's here

- `site/`: Quarto homepage, setup, six substantive lessons, Git lab, live notebook lab, Git practice room, handoff plan, workshop schedule, and downloads/reference page.
- `site/assets/`: responsive light/dark design, data-derived scientific SVG, browser quizzes, and a snapshot-based Git simulator with staging, branches, fast-forwards, merges, conflicts, and recovery.
- `motion-perception/`: 3,840 fully synthetic trials (seed 202611), three executed notebooks, intermediate helpers, the installed `experiment` package, CLI analysis, tests, a tested dependency resolution, validated baseline/sensitivity configs, and effective run records.
- `tools/`: reproducible archives, notebook execution, site/link/snippet checks, scientific illustration generation, and a real local Git workflow check.
- `.github/workflows/validate-and-deploy.yml`: validation and optional GitHub Pages deployment after the owner uploads this repository.

There is no backend, database, login, or paid service. Lessons are Markdown/Quarto; interactive behavior is plain JavaScript with no build tool. Quarto supplies navigation, search, highlighted/copied code, tabs, and theme switching. The live notebook lab runs real Python in a dedicated Web Worker using Pyodide 0.27.7 with bundled NumPy/pandas/Matplotlib. At build time, a download recipe fetches about 32 MB from the pinned official distribution and verifies wheel hashes. The built website serves these assets itself; browser execution needs no external CDN. A first build needs internet. Serving the built directory locally allows practice without external network access; no service worker/offline browser cache is promised.

Website: [Research / Code on GitHub Pages](https://yoavkedem1.github.io/labCodePractice/).

## Run locally

Requirements: **Python 3.11** (3.12 also declared compatible), **Node 20+**, **Git 2.28+**, and **Quarto 1.8.27**. Install Quarto from <https://quarto.org/docs/get-started/>. From this repository root:

```sh
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -r motion-perception/requirements-lock.txt
python -m pip install --no-deps -e ./motion-perception
python tools/build.py
python -m http.server 8765 --bind 127.0.0.1 --directory site/_site
```

Open <http://127.0.0.1:8765>. On Windows, create the environment with `py -3.11 -m venv .venv` and activate with `.venv\Scripts\Activate.ps1`. If activation is blocked, call the environment's Python by its full path. `QUARTO_BIN` can point `tools/build.py` to an alternate Quarto executable. A build first prepares the pinned Python runtime and virtual project manifest, regenerates the downloadable archives, renders Quarto, then validates local links, assets, fragments, and Python/TOML snippet syntax. Download archives are generated, not tracked.

For content development after a first build, `quarto preview site` refreshes changes. After changing Python, notebooks, or downloadable material, rerun the relevant checks and `python tools/build.py`. Regenerate the homepage's scientific figure with `python tools/make_preview.py` if the dataset or calculation changes. Stop a local preview with Ctrl+C.

## Run the research example

Using the same activated environment:

```sh
python motion-perception/scripts/generate_data.py
python motion-perception/scripts/run_analysis.py --config motion-perception/config/analysis.toml
python motion-perception/scripts/run_analysis.py --config motion-perception/config/sensitivity.toml
python -m pytest motion-perception/tests -q
cd motion-perception
python -m jupyterlab
```

Open the three notebooks in `notebooks/` and select this environment's kernel. Each runs in a fresh kernel and reports the same participant-weighted condition summary. Stage A intentionally uses ambiguous names and duplicates policy and calculations; B uses `notebooks/helpers.py` and named settings; C calls the installed package with the same TOML configuration as the CLI. The script writes `conditions.csv`, `participants.csv`, `behavior.svg`, and `run.json` under `motion-perception/results/baseline/`. Raw data are never overwritten by analysis. Regeneration intentionally replaces the synthetic raw CSV.

Read [the example README](motion-perception/README.md) and [data dictionary](motion-perception/data/README.md) for exact units, exclusion rules, and scientific limits. The data use no real participants. Figure error bars describe ±1.96 participant SEM; the choice curves are empirical, not fitted psychometric models. The comparison is not a paired inferential test.

## Browser labs

Open `/notebook-lab.html`: four missions cover hidden state, extraction into a saved module, validated configuration, and fresh-kernel handoff with a Matplotlib figure. Execution has a 15-second limit and Stop terminates the worker. Python 3.12.7, NumPy 2.0.2, pandas 2.2.3, and Matplotlib 3.8.4 differ from the local project's lock. This is ordinary Python cell execution, not a complete Jupyter frontend: magics, widgets, interactive input, arbitrary installs, and host-filesystem access are not implemented.

Open `/git-playground.html`: five state-checked missions include a bounded command console and distinct working/index/HEAD snapshots, inspectable commits, conflict resolution, a simulated server, PR diff/review, and synchronization. No GitHub actions are sent. `/practice.html` connects the exercises to a real notebook, peer handoff, and suggested day 2/week 1/month 1 retrieval prompts; these do not schedule reminders.

The source ZIP excludes the downloaded runtime and generated virtual-filesystem manifest. `tools/build.py` regenerates both. Run `tools/fetch_pyodide.py` before the workshop while connected, then serve the complete built directory. Runtime provenance is recorded in `site/assets/python-runtime/runtime-manifest.json`; the CPython license is retained separately, and dependency licenses ship in the upstream wheels. See `site/assets/PYTHON-RUNTIME.md`.

## Configuration is part of the lesson

`motion-perception/config/analysis.toml` is the unchanged 0.2–2.0 s baseline; `config/sensitivity.toml` demonstrates a stricter 0.6 s minimum with a separate output directory. Paths inside these files resolve from the config location. The loader rejects misspelled/missing keys and invalid numeric bounds. Both notebook and CLI load it at their entry point and pass explicit values into reusable calculations.

Each run's `run.json` records effective settings (including CLI overrides), exact input hash, counts, timestamp, and software versions. The Git lab adds a new 0.5 s config and explains the scientific consequence in review. It does not combine a variable rename/refactor with a policy change. Read module 1 for a code-review exercise and module 4 for configuration and path semantics.

## Validate

From the repository root, with its environment active:

```sh
python -m pip check
python -m pytest motion-perception/tests -q
npm test
python tools/check_git_lab.py
python tools/check_browser_lessons.py
python tools/build.py
```

The Python suite covers deterministic generation, byte-identical CSV regeneration, schema failures, inclusive RT boundaries, error retention, input immutability, participant weighting, plot production, config validation, config-relative paths, CLI override provenance, separate sensitivity outputs, import safety, and all three notebooks executed in independent kernels with numerical equivalence checks. The 25 Git model/command tests cover selective staging, later edits, explicit staged conflict resolution, named branches, merges, abort, fetch/pull, divergent push rejection, PR review becoming stale, server-only merges, and recovery. The browser-lesson checker executes all four solutions, verifies stale-state and removed-error failures, and validates notebook export schemas. The real Git lab check uses only disposable directories and a temporary bare local remote—no GitHub authentication or upload.

To refresh saved notebook outputs after a deliberate analysis change: `python tools/execute_notebooks.py`. Review output diffs before sharing. This uses local Jupyter kernel sockets; constrained environments must permit localhost communication. The standalone archives exclude Git metadata, virtual environments, caches, and generated results. Install the extracted project's dependencies into a fresh environment when testing a handoff.

Browser QA checks the responsive homepage, mobile navigation, search, dark mode, code tabs, quiz feedback, checklist, downloads, and simulator. See `VALIDATION.md` for the checks actually executed in this implementation. Do not treat a configured CI workflow as a CI run: hosted jobs run only after upload.

## GitHub Pages

This repository is configured to publish at <https://yoavkedem1.github.io/labCodePractice/> using GitHub Actions. Its current default and publishing branch is `codex/research-workshop`.

Pushes to `codex/research-workshop` or `main` run the validation and deployment workflow. Pull requests validate without deploying. To publish manually, open **Actions → Validate workshop and deploy Pages → Run workflow** and select the publishing branch. **Settings → Pages → Build and deployment** uses **GitHub Actions**.

The workflow installs Python, Node, and Quarto; runs the scientific notebooks, Git tests, browser lesson solutions, and real Git exercise; builds the site and downloads; then deploys only after validation succeeds. The pinned browser Python runtime is fetched during the build and served with the site. The deployment job alone receives Pages/OIDC write permissions. Relative resources support the `/labCodePractice/` repository subpath.

For a copy hosted in another repository, enable Pages with GitHub Actions and update the workflow's branch filter to that repository's publishing branch. Deployment history and validation results are available in [GitHub Actions](https://github.com/yoavkedem1/labCodePractice/actions).

## Design and teaching decisions

A slate-and-blue design, clear sans-serif typography, restrained surfaces, and a scientific illustration give the workshop a consistent visual identity. The notebook lab groups files into keyboard-accessible tabs with a task rail, kernel toolbar, line-number gutters, output panels, and nearby check feedback. The Git room groups changes, history, and review into tabs with a companion command console. Narrow screens stack the workspaces and collapse detailed instructions. Modules share objectives, research examples, exercises with hints and revealed explanations, takeaways, and onward links. Introductory Python syntax is assumed. Optional explanations address tooling and package mechanics; extensions address scientific and maintenance tradeoffs. Semantic HTML, visible focus, reduced-motion support, responsive layouts, and text alternatives complement Quarto's built-in navigation.

The simulator is bounded to two teaching files, five local branches, and 50 commits. It never executes Git or modifies a real filesystem. Real Git commands and scientific decision-making remain explicit in the Git lab. Git state resets on reload; Python source edits/predictions and personal handoff notes are saved in localStorage when available. Kernel variables are temporary. Both lab notebooks and handoff notes can be exported. No account is required.

## License

Code and teaching text: MIT, see `LICENSE`. Synthetic data: CC0 1.0, see `motion-perception/DATA-LICENSE.md`. External documentation remains under its respective licenses.
