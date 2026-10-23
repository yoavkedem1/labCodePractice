# Implementation and validation record

Executed locally on **22 October 2026**, macOS arm64, Python **3.11.8**, Node **25.9.0**, Quarto **1.8.27**.

## Audience and configuration revision

The revised course assumes participants have completed introductory programming and already write analysis code. Core lessons now begin with a code review and focus on meaningful names, units, table state and aggregation level, explicit contracts, side effects, extraction boundaries, and shared configuration. Introductory variable/function definitions and toy syntax exercises were removed. Optional preparation addresses tooling rather than repeating a programming course.

The functioning example now includes `config/analysis.toml`, `config/sensitivity.toml`, `experiment.config`, and `experiment.workflow`. Both Stage C and the CLI load the same validated settings. Paths resolve from the config file; explicit CLI values override it and are recorded in `run.json`. Calculations and plotting are separate: plots receive precomputed metrics and choice probabilities. Baseline and alternative runs use distinct output directories. The Git lab adds `config/rt-050.toml` and a scientific explanation on a branch instead of only editing a label.

## Delivered

Fourteen complete Quarto pages: homepage, setup, six modules, practical Git lab, live Python notebook lab, expanded Git practice room, personal handoff plan, 90-minute workshop schedule, and downloads/reference. Browser features include searchable navigation, light/dark themes, highlighted and copyable code, keyboard-operated three-stage code tabs, five feedback quizzes, hints and revealed solutions, a reproducibility checklist, and an interactive Git DAG with staging, branches, fast-forwards, merges, conflicts, resolution, abort, and reset.

The research example includes a deterministic fully synthetic CSV, a documented generator, three executed notebooks, intermediate helpers, an installable `experiment` package, a command-line analysis, scientific figures, a data dictionary, tests, and pinned dependencies. Download archives include all code and learning materials without Git metadata, environments, caches, or generated analysis results. The complete source is MIT licensed; the synthetic CSV is CC0.

## Interactive workshop revision

The live notebook lab uses Pyodide 0.27.7 in a module Web Worker and runs actual Python against the real synthetic CSV, package modules, helper editor, and validated TOML. Four missions cover stale notebook state, module extraction, configuration, and a fresh-kernel handoff with an actual Matplotlib image. Individual cells, persistent variables, execution counters, errors, Stop/restart, numerical checks, hints/solutions, local source persistence, and .ipynb/helper/config exports are implemented. Runtime files are pinned, served from the built site, and total approximately 32.4 MB. Wheel checksums are verified against the upstream lock; runtime provenance and licenses are retained.

The Git room adds selective staging, both diffs, three snapshot panels, named branches, inspectable commit snapshots, explicit write/stage/commit conflict resolution, a bounded command console, remote/server/tracking distinctions, push/fetch/fast-forward pull, PR diff/review, stale-review checks, server merge, and recovery. Five missions check resulting model state. It remains a simulation, not a Git engine or a GitHub connection.

A personal capstone/handoff worksheet, exportable notes, partner explanations, and suggested day 2/week 1/month 1 retrieval tasks connect practice to a real research notebook. The 90-minute run sheet selects missions and reserves time for prediction and explanation. No reminders were scheduled.

## Checks actually run

| Check | Result |
| --- | --- |
| Quarto build | All 14 pages rendered successfully |
| HTML targets, resources, and fragments | 1,025 local references checked; all resolve; no root-relative links |
| Lesson Python syntax | All 13 Python blocks and 2 TOML blocks parsed successfully |
| Config and workflow behavior | Unknown/missing keys, numeric validity, config-relative paths, CLI overrides, input hash, output separation, and safe script import checked |
| Python test suite | **49 passed**, including three independent notebook kernels with interpreter-path assertions |
| Headless notebook execution | All three notebooks embed figures even when the parent uses `MPLBACKEND=Agg` |
| Stage equivalence | Accuracy, SEM, participant-weighted RT, counts match the package to `1e-12` |
| Data regeneration | Generated CSV byte-identical to distributed input |
| Dependencies | `pip check`: no broken requirements |
| Fresh downloadable installation | New temporary directory and Python environment; installed lock + project, regenerated data, ran analysis, all **49 tests passed** |
| JavaScript Git model | **25 tests passed** |
| Browser lesson solutions | All four execute under local CPython; stale tables and removed error trials fail the intended checks; all exports validate with nbformat |
| Browser Python | Actual WebAssembly Python 3.12.7 / pandas 2.2.3 / NumPy 2.0.2 / Matplotlib 3.8.4 loads and runs all four missions |
| Real Git exercise | Exact baseline file list including config leaves the real example clean; the actual TOML exercise executes at 0.5 s without overwriting baseline; temporary local repositories verify staging, branches, push, clone, fast-forward pull, conflict, abort, resolved two-parent merge |
| Archives | Safe paths; environments, Git metadata, and build output excluded |
| HTTP preview | Homepage responds 200; project downloaded through browser |

Baseline analysis: **3,761 / 3,840** retained trials. Mean participant accuracy: clear **0.808111**, noisy **0.713384**. Mean participant median RT: clear **0.786242 s**, noisy **0.970044 s**. All observations are synthetic and no population inference is claimed. The 0.6 s sensitivity run retains **3,461** trials, with accuracies approximately **0.791955** clear and **0.713874** noisy. This illustrates a method change; it is not a new baseline or a recommended scientific exclusion rule.

## Browser checks actually performed

Used the local static server and the in-app browser, at the default desktop size (1280 × 720) and a **390 × 844** phone viewport.

- Navigated the sidebar and mobile sidebar menu; checked all eleven pages have one H1.
- Checked each page for document-level horizontal overflow at phone width. Fixed the setup and resource tables with accessible, keyboard-focusable horizontal scroll regions.
- Switched code-explorer tabs and moved between them using ArrowLeft.
- Created divergent branches, triggered a conflict, resolved it, and verified the two-parent merge in the displayed history.
- Checked the revised naming/aggregation quiz feedback and configuration explorer. Earlier staging/checklist interactions remain covered by the retained components and tests.
- Searched for “staging”; the Git lesson and practical Git lab appear.
- Switched light/dark themes; corrected mobile breadcrumb contrast and supplied readable dark syntax colors.
- Inspected browser error/warning logs during interactions: none reported.
- Refreshed desktop/mobile homepage screenshots and added a configuration-lesson screenshot in `docs/screenshots/`.

## Additional browser checks for the live labs

- Ran the baseline in real Pyodide: 3,761 retained trials. Edited the minimum to 0.6, reran cells 1 and 3 while skipping 2, and observed the expected stale-table failure. Restart & Run All produced 3,461 and passed.
- Edited and saved helpers.py, imported it into cells, and passed boundary, error-retention, input-preservation, and full-summary checks.
- Saved an invalid TOML key and observed the exact missing/unknown-key error, repaired it, reran, and passed the 0.6 s sensitivity mission.
- Fresh handoff ran from an empty kernel, reproduced baseline summaries, rendered the actual two-panel Matplotlib PNG, and passed.
- Stopped an infinite-loop cell without blocking the page. Fixed an issue where reset source was not immediately persisted; reset followed by reload now restores starter code.
- Downloaded a real browser-exported four-cell .ipynb and validated it with nbformat. Saved handoff text and a checkbox, reloaded, verified persistence, and downloaded Markdown notes.
- Completed all five Git missions through the UI and command console: selective staging, independent-branch merging, explicit conflict resolution, remote review/synchronization, and recovery. An unstaged resolution refused commit; a labmate server commit invalidated review; reviewed merge moved server main while local main stayed behind until pull.
- Checked the new notebook/Git/practice pages and revised homepage at 390 px with no document-level horizontal overflow. Long source remains scrollable inside editors. Saved notebook mobile/desktop and Git screenshots in docs/screenshots/.
- Checked new lab console error/warning logs: none during successful runtime and simulation interactions. Screenshots and layout checks do not establish cross-browser compatibility.

## Deployment and limits

The GitHub Actions workflow is prepared to validate PRs and deploy successful main/manual builds to GitHub Pages. It follows the official [custom Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) and [Quarto website](https://quarto.org/docs/websites/) architecture. The repository has now been uploaded to https://github.com/yoavkedem1/labCodePractice, and Pages is configured to deploy through GitHub Actions from codex/research-workshop. Hosted validation succeeded on 23 October 2026; deployment status is recorded in GitHub Actions. No remote PR was needed for this initially empty repository.

Native Python 3.12, Windows, and Linux installations were not executed on this machine; Python 3.11 on macOS was checked both directly and in a clean archive environment. The CI configuration targets Ubuntu/Python 3.11, and the hosted validation job passed on 23 October 2026. Platform markers cover the macOS-only lock entries; other platforms may resolve additional platform dependencies.

The tested Matplotlib/pyparsing combination emits **14 upstream deprecation warnings** under pytest, with no failures. The Git sandbox is intentionally limited to two teaching files, five local branches, and 50 commits. Git repository state resets on reload. Notebook source/predictions and handoff notes persist in localStorage when available; kernel variables are temporary. The browser runtime version set differs from the local dependency lock, and this is disclosed beside the lab and in exported notebooks. The browser is not full Jupyter: magics, widgets, interactive input, arbitrary installs, and host-filesystem access are not implemented. Each cell has a 15-second execution limit. A first source build needs internet to fetch the runtime; the complete built site serves it locally. An offline service-worker cache and hosted cross-browser tests are not implemented. The scientific example is descriptive synthetic data, not a validation of a human experiment or fitted psychometric model.


## Visual and interaction redesign

Replaced the paper/serif theme with a consistent slate-and-blue system, sans-serif headings, lighter navigation, clearer selected states, grouped controls, updated homepage, and matching light/dark surfaces. The learning content and scientific implementation remain intact.

The notebook UI now has a task rail, keyboard-accessible file/inspector tabs, grouped kernel controls, line-number gutters, dedicated output panels, a compact export menu, and a feedback link beside the check action. The Git UI has changes/history/remote tabs and a companion simulated console. Native controls, visible focus, and responsive stacking remain available. Quarto's automatic margin-aside transformation was detected in visual QA and avoided by using explicitly labeled complementary panels.

Redesign validation: 14-page build; 1,025 internal references and 13 Python/2 TOML snippets checked. All 25 Git model tests still pass. Browser checks exercised helper saving/import, keyboard file-tab navigation, fresh-kernel Matplotlib output, selective staging, and the push/review/merge/pull workflow with the new DOM. All 14 pages have one H1 and no document-level horizontal overflow at 390 px. The scientific Python source was not changed in this visual revision; the earlier 49-test result applies to that unchanged code. Updated screenshots are stored separately with a modern- prefix.
