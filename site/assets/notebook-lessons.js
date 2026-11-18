export const lessons = [
  {id:'state',title:'Run notebook cells',minutes:'8 min',
    goal:'See how running cells out of order can leave a result out of date.',
    steps:[
      {action:'run-all',instruction:'Run all cells with the original minimum of 0.2 seconds and note the retained count.'},
      {action:'continue',output:2,predict:true,instruction:'Look at the retained count in cell 3. What do you expect to happen if you change the minimum but leave the filtering cell alone?'},
      {action:'edit-cell',cell:0,instruction:'In cell 1, change min_rt_s from 0.2 to 0.6. Run just cell 1 to apply the new setting.'},
      {action:'run-cell',cell:2,instruction:'Run cell 3 to print the new setting beside the retained count. Leave cell 2 alone for now.'},
      {action:'continue',output:2,instruction:'Compare cell 3 with the baseline. Why did the setting change while the retained count stayed the same?'},
      {action:'fresh-run',instruction:'Restart Python and run all cells in order so cell 2 recalculates the table with the new minimum.'},
      {action:'check',output:2,instruction:'Look at the new count in cell 3. Check that it agrees with the 0.6-second rule.'}
    ],
    baseline:'For the original baseline, set min_rt_s to 0.2 in cell 1.',
    recovery:'Set min_rt_s to 0.6 in cell 1, then use Restart & run all in Notebook tools and check again.',
    hint:'A name assigned in cell 2 still refers to the old filtered table. Editing or executing cell 1 does not recompute cell 2.',
    explanation:'The filter depends on min_rt_s at execution time. At 0.6 s a fresh run retains 3,461 trials. A saved output does not prove its dependent cells used the displayed configuration.',
    cells:[{title:'Load inputs and choose the policy',code:`import pandas as pd
raw_trials = pd.read_csv("data/raw/trials.csv")
min_rt_s = 0.2
max_rt_s = 2.0
print(f"Current policy: {min_rt_s}–{max_rt_s} seconds")`},
    {title:'Create a derived table',code:`filtered_trials = raw_trials.loc[
    raw_trials.reaction_time.between(min_rt_s, max_rt_s)
].copy()
print(f"Filtered at this execution: {len(filtered_trials)} trials")`},
    {title:'Inspect the result and its assumptions',code:`print(f"Displayed policy: {min_rt_s}–{max_rt_s} seconds")
print(f"Existing table: {len(filtered_trials)} retained trials")
print(filtered_trials.groupby("condition").size())`}],
    check:`assert min_rt_s == 0.6, "Try the alternative minimum: set min_rt_s to 0.6 in cell 1."
assert len(raw_trials) == 3840, "Keep the synthetic raw table intact."
expected_count = len(raw_trials.loc[raw_trials.reaction_time.between(min_rt_s, max_rt_s)])
assert len(filtered_trials) == expected_count, f"Stale result: expected {expected_count} trials from the current policy, got {len(filtered_trials)}. Rerun dependent cells or restart and run all."
print("Policy and table agree: 3,461 trials. Explain why the previous result was stale.")`,
    solution:{cells:[`import pandas as pd
raw_trials = pd.read_csv("data/raw/trials.csv")
min_rt_s = 0.6
max_rt_s = 2.0
print(f"Current policy: {min_rt_s}–{max_rt_s} seconds")`]}},
  {id:'refactor',title:'Extract a Python function',minutes:'12 min',file:'helper',
    goal:'Move the reaction-time filter into a reusable function and verify that the results match.',
    steps:[
      {action:'edit-file',file:'helper',instruction:'In helpers.py, replace the unfinished line in clean_trials. Return a new table with all trials inside the inclusive bounds, including incorrect responses. Then save the file.'},
      {action:'run-all',instruction:'Run the notebook to import your saved function and use it to calculate the condition summary.'},
      {action:'check',output:1,instruction:'Check that the function includes both boundary values, retains errors, leaves the input intact, and reproduces the summary.'}
    ],
    recovery:'Review clean_trials and save helpers.py. Run all cells again to import the updated function, then retry the check.',
    hint:'Use trials.loc[trials.reaction_time.between(min_rt_s, max_rt_s)].copy(). Keep both correct and incorrect trials. Saving a file does not rerun an existing import binding.',
    explanation:'The extraction has one responsibility: select rows from explicit inputs. The notebook owns file loading and policy. Boundary and summary checks catch plausible scientific regressions.',
    helper:`def clean_trials(trials, min_rt_s=0.2, max_rt_s=2.0):
    """Return a new table within inclusive RT bounds, including errors."""
    raise NotImplementedError("Extract the RT filter here, then save the module")`,
    cells:[{title:'Import the extracted function',code:`import pandas as pd
from helpers import clean_trials
from experiment.analysis import participant_summary, condition_summary
raw_trials = pd.read_csv("data/raw/trials.csv")`},
    {title:'Run the analysis through its explicit interface',code:`filtered_trials = clean_trials(raw_trials, min_rt_s=0.2, max_rt_s=2.0)
participant_metrics = participant_summary(filtered_trials)
condition_metrics = condition_summary(participant_metrics)
print(condition_metrics.to_string(index=False))`}],
    check:`import pandas as pd
from experiment.preprocessing import filter_trials as reference_filter
before = raw_trials.copy(deep=True)
boundary_trials = raw_trials.head(4).copy()
boundary_trials["reaction_time"] = [0.19, 0.2, 2.0, 2.01]
retained = clean_trials(boundary_trials, min_rt_s=0.2, max_rt_s=2.0)
assert retained.index.tolist() == [1, 2], "Bounds must be inclusive; keep 0.2 and 2.0 exactly."
expected = reference_filter(raw_trials, min_rt_s=0.2, max_rt_s=2.0)
observed = clean_trials(raw_trials, min_rt_s=0.2, max_rt_s=2.0)
pd.testing.assert_frame_equal(observed, expected)
pd.testing.assert_frame_equal(raw_trials, before)
expected_summary = condition_summary(participant_summary(expected))
pd.testing.assert_frame_equal(condition_metrics, expected_summary, atol=1e-12, rtol=1e-12)
print("Boundary, error-retention, input-immutability, and summary checks passed.")`,
    solution:{helper:`def clean_trials(trials, min_rt_s=0.2, max_rt_s=2.0):
    """Return a new table within inclusive RT bounds (seconds), including errors."""
    return trials.loc[trials.reaction_time.between(min_rt_s, max_rt_s)].copy()`}},
  {id:'config',title:'Change a setting',minutes:'10 min',file:'config',
    goal:'Change the analysis using a settings file and give the alternative run its own output location.',
    steps:[
      {action:'run-all',instruction:'Run all cells and note the retained count with the original minimum of 0.2 seconds.'},
      {action:'edit-file',file:'config',instruction:'In analysis.toml, set min_rt_s to 0.6 and change output to "../results/sensitivity". Save the file so the notebook can read it.'},
      {action:'run-all',instruction:'Rerun the notebook to load the saved settings and count the trials under the new rule.'},
      {action:'check',output:1,instruction:'Check the new trial count and output location. What does recording the new rule help your labmate verify?'}
    ],
    baseline:'For the original baseline, save min_rt_s = 0.2 and output = "../results/baseline" in analysis.toml.',
    recovery:'Set min_rt_s to 0.6 and output to "../results/sensitivity", then save analysis.toml and run all cells again.',
    hint:'Change the file, not a hardcoded number in the filter call. load_config resolves paths relative to the TOML file and rejects missing/unknown keys.',
    explanation:'A shared settings file records the choices behind the result and gives the alternative run its own output path. After the check, try misspelling min_rt_s, saving, and rerunning to see how the loader catches a typo.',
    cells:[{title:'Load and inspect the run specification',code:`from experiment.config import load_config
from experiment.preprocessing import load_trials, filter_trials
from experiment.analysis import participant_summary, condition_summary
config = load_config("config/analysis.toml")
print(config)
raw_trials = load_trials(config.data_path)`},
    {title:'Pass settings to reusable computation',code:`filtered_trials = filter_trials(raw_trials, min_rt_s=config.min_rt_s, max_rt_s=config.max_rt_s)
condition_metrics = condition_summary(participant_summary(filtered_trials))
print(f"Retained {len(filtered_trials)} / {len(raw_trials)} trials")
print(condition_metrics.to_string(index=False))`}],
    check:`assert config.min_rt_s == 0.6, "Edit and save the TOML minimum to 0.6, then reload the config."
assert str(config.output_dir).endswith("/results/sensitivity"), "Use ../results/sensitivity so this choice has its own output directory."
assert len(raw_trials) == 3840 and len(filtered_trials) == 3461, "Rerun the analysis after reloading the saved config."
assert filtered_trials.correct.eq(0).any(), "Accuracy must include errors."
print("The saved config drives the stricter selection: 3,461 trials, with an independent output path.")`,
    solution:{config:`[paths]
data = "../data/raw/trials.csv"
output = "../results/sensitivity"

[preprocessing]
min_rt_s = 0.6
max_rt_s = 2.0
`}},
  {id:'handoff',title:'Reproduce a figure',minutes:'10 min',file:'config',freshCheck:true,
    goal:'Reproduce the baseline figure from the notebook you would give a labmate.',
    steps:[
      {action:'continue',predict:true,instruction:'Read the three cells. What needs to be available for this notebook to produce the figure in a fresh Python session?'},
      {action:'check',label:'Run and check figure',output:2,instruction:'Start a fresh Python session, run every cell in order, and check that the participant summaries and figure match the baseline.'}
    ],
    recovery:'Fix the first cell with an error and retry. If you changed analysis.toml, save the baseline settings before running the check.',
    hint:'Every input must be created by these saved cells. Use the installed experiment modules in the virtual project, with config/analysis.toml.',
    explanation:'A fresh-kernel run tests the saved procedure rather than a lucky session state. Numeric equivalence and a real plot support the handoff; scientific interpretation still requires judgment.',
    cells:[{title:'Declare all dependencies and inputs',code:`from experiment.config import load_config
from experiment.preprocessing import load_trials, filter_trials
from experiment.analysis import participant_summary, condition_summary, choice_curve
from experiment.plotting import plot_results
config = load_config("config/analysis.toml")
raw_trials = load_trials(config.data_path)`},
    {title:'Compute before presenting',code:`filtered_trials = filter_trials(raw_trials, min_rt_s=config.min_rt_s, max_rt_s=config.max_rt_s)
participant_metrics = participant_summary(filtered_trials)
condition_metrics = condition_summary(participant_metrics)
choice_probabilities = choice_curve(filtered_trials)
print(condition_metrics.to_string(index=False))`},
    {title:'Present and interpret',code:`figure = plot_results(condition_metrics, choice_probabilities)
# Figures from this cell appear below; no browser-specific plotting API is needed.
print("Synthetic data; equal participant weighting; descriptive intervals, not a paired test.")`}],
    check:`import math
assert len(raw_trials) == 3840 and len(filtered_trials) == 3761
scores = condition_metrics.set_index("condition").accuracy
assert math.isclose(scores["clear"], 0.808111, abs_tol=1e-6)
assert math.isclose(scores["noisy"], 0.713384, abs_tol=1e-6)
assert len(figure.axes) == 2, "Create the two-panel figure in your saved notebook."
assert participant_metrics.participant_id.nunique() == 24
print("Fresh-kernel handoff passed: baseline data, participant summaries, and scientific figure reproduced.")`,solution:{}}
];

export function notebookExport(lesson, sources) {
  return {nbformat:4,nbformat_minor:5,metadata:{kernelspec:{display_name:'Python 3',language:'python',name:'python3'}},
    cells:[{cell_type:'markdown',id:'context',metadata:{},source:[`# ${lesson.title}\n\n${lesson.goal}\n\nExported from the browser workshop. Use the downloaded motion-perception project and its environment for local execution. Save the exported helpers.py and analysis.toml into the corresponding project paths. Browser runtime versions may differ from the local lock.\n`]},
      ...sources.map((source,i)=>({cell_type:'code',id:`cell-${i+1}`,metadata:{},source:source.split(/(?<=\n)/),execution_count:null,outputs:[]}))]};
}
