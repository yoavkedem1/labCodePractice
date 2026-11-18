import {lessons, notebookExport} from './notebook-lessons.js';
import {tabs} from './ui.js';

const root = document.querySelector('[data-notebook-lab]');
const q = selector => root.querySelector(selector);
const selectPane = tabs(root, '[data-workspace-tabs]');
const filePaths = {helper: 'helpers.py', config: 'config/analysis.toml'};
const baseConfig = '[paths]\ndata = "../data/raw/trials.csv"\noutput = "../results/baseline"\n\n[preprocessing]\nmin_rt_s = 0.2\nmax_rt_s = 2.0\n';
const baseHelper = 'def clean_trials(trials, min_rt_s=0.2, max_rt_s=2.0):\n    return trials.loc[trials.reaction_time.between(min_rt_s, max_rt_s)].copy()\n';
const storageKey = 'research-code-notebook-v1';
const pythonLoadTimeout = 300000;
const guide = q('[data-guide-action]');
const feedback = q('[data-guide-feedback]');
const stepPanel = q('#current-step');
const executedSources = new Map();
const pending = new Map();

let saved;
try {
  saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {};
} catch {
  saved = {};
}

let lesson;
let stepIndex = 0;
let files;
let errorCell;
let worker;
let ready = false;
let busy = false;
let sequence = 0;
let execution = 0;

const currentStep = () => lesson.steps[stepIndex];
const cellAt = index => q(`[data-cell="${index}"]`);
const cellEditor = index => cellAt(index).querySelector('[data-cell-code]');
const fileEditor = file => q(`[data-${file}]`);
const sources = () => [...root.querySelectorAll('[data-cell-code]')].map(editor => editor.value);
const focusStep = () => stepPanel.focus();

function persist() {
  saved[lesson.id] = {
    sources: sources(),
    helper: fileEditor('helper').value,
    config: fileEditor('config').value,
    prediction: q('[data-prediction]').value,
    files
  };
  try {
    localStorage.setItem(storageKey, JSON.stringify(saved));
  } catch {
    q('.lab-footnote').textContent = 'Browser storage is unavailable. Export your work to keep a copy.';
  }
}

function message(text) {
  q('[data-kernel-status]').textContent = text;
}

function controls() {
  q('.kernel-line').dataset.state = busy ? 'busy' : ready ? 'ready' : 'idle';
  for (const button of root.querySelectorAll('[data-run-cell], [data-run-all], [data-guide-action], [data-save-file], [data-scenario], [data-solution], [data-reset-lesson], [data-step-index]')) {
    button.disabled = busy;
  }
  q('[data-stop-python]').hidden = !busy || !worker;
  for (const editor of root.querySelectorAll('[data-cell-code], [data-helper], [data-config]')) {
    editor.readOnly = busy;
  }
}

function markOutputsStale() {
  for (const output of root.querySelectorAll('[data-cell-output]:not(:empty)')) {
    output.dataset.stale = 'true';
  }
}

function terminate(reason) {
  worker?.terminate();
  worker = null;
  ready = false;
  execution = 0;
  executedSources.clear();
  for (const request of pending.values()) {
    clearTimeout(request.timer);
    request.reject(new Error(reason));
  }
  pending.clear();
  q('[data-variables]').textContent = 'No live variables.';
  q('[data-execution-log]').textContent = 'No cells run yet.';
  for (const count of root.querySelectorAll('[data-cell-count]')) count.textContent = 'In [ ]';
  markOutputsStale();
  message(reason);
  controls();
}

function request(action, values = {}, timeout = 15000) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      terminate(action === 'init' ? 'Python did not finish downloading. Check your connection or run the downloaded project in Jupyter.' : 'Python stopped because the action timed out.');
    }, timeout);
    pending.set(id, {resolve, reject, timer});
    worker.postMessage({id, action, ...values});
  });
}

async function start() {
  if (ready) return;
  const activeWorker = new Worker(new URL('./python-worker.js', import.meta.url), {type: 'module'});
  worker = activeWorker;
  worker.onmessage = ({data}) => {
    if (worker !== activeWorker) return;
    if (data.type === 'status') {
      message(data.text);
      return;
    }
    const item = pending.get(data.id);
    if (!item) return;
    clearTimeout(item.timer);
    pending.delete(data.id);
    if (data.error) item.reject(new Error(data.error));
    else item.resolve(JSON.parse(data.result));
  };
  worker.onerror = () => {
    if (worker === activeWorker) terminate('Python could not load. Reload the page if retrying does not help.');
  };
  controls();
  message('Starting Python…');
  const projectFiles = Object.fromEntries(Object.entries(filePaths).map(([file, path]) => [path, files[file]]));
  await request('init', {files: projectFiles}, pythonLoadTimeout);
  ready = true;
}

function guideLabel(step) {
  if (step.label) return step.label;
  switch (step.action) {
    case 'edit-cell': return `Edit cell ${step.cell + 1}`;
    case 'edit-file': return `Open ${filePaths[step.file].split('/').at(-1)}`;
    case 'run-cell': return `Run cell ${step.cell + 1}`;
    case 'run-all': return 'Run all cells';
    case 'fresh-run': return 'Restart & run all';
    case 'check': return 'Check your work';
    case 'continue': return 'Continue';
  }
}

function renderOutputLink() {
  const button = q('[data-view-output]');
  const outputIndex = errorCell ?? currentStep()?.output ?? lesson.steps.at(-1).output;
  const output = cellAt(outputIndex)?.querySelector('[data-cell-output]');
  button.hidden = !output?.childElementCount;
  if (!button.hidden) {
    button.dataset.viewOutput = outputIndex;
    button.textContent = `View cell ${outputIndex + 1} output`;
  }
}

function showFeedback(text = '', state = '', trace = '', cell) {
  feedback.textContent = text;
  feedback.dataset.state = state;
  errorCell = cell;
  q('[data-error-details]').open = false;
  q('[data-error-details]').hidden = !trace;
  q('[data-error-trace]').textContent = trace;
  renderOutputLink();
}

function showStep(index, switchPane = true) {
  stepIndex = index;
  const step = currentStep();
  const completed = !step;
  const lastExercise = lesson === lessons.at(-1);
  q('[data-step-progress]').textContent = completed ? 'Exercise complete' : `Step ${index + 1} of ${lesson.steps.length}`;
  q('[data-step-instruction]').textContent = completed ? lesson.explanation : step.instruction;
  q('[data-step-prediction]').hidden = !step?.predict;
  guide.hidden = completed && lastExercise;
  q('[data-continue-git]').hidden = !completed || !lastExercise;
  if (!guide.hidden) guide.textContent = completed ? 'Next notebook exercise' : guideLabel(step);
  for (const [i, button] of [...root.querySelectorAll('[data-step-index]')].entries()) {
    if (i === index) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  }
  const targetCell = step?.cell ?? step?.output;
  for (const cell of root.querySelectorAll('[data-cell]')) {
    cell.toggleAttribute('data-step-cell', Number(cell.dataset.cell) === targetCell);
  }
  if (switchPane) selectPane(step?.file || 'notebook');
  renderOutputLink();
}

function advance(action, target) {
  const step = currentStep();
  if (!step) return;
  const matches = step.action === action
    || (action === 'run-cell' && step.action === 'edit-cell')
    || (action === 'fresh-run' && step.action === 'run-all');
  if (!matches || (step.cell ?? step.file) !== target) return;
  showStep(stepIndex + 1);
  focusStep();
}

async function act(action) {
  if (busy) return;
  busy = true;
  controls();
  showFeedback();
  try {
    await action();
    if (ready) message('Python ready.');
    if (feedback.dataset.state === 'error') focusStep();
  } catch (error) {
    if (worker) terminate('The Python session was cleared.');
    showFeedback(`${error.message} Run again to start a fresh Python session.`, 'error');
    focusStep();
  } finally {
    busy = false;
    controls();
    persist();
    if (location.hash !== `#${lesson.id}`) chooseFromLocation();
  }
}

function showOutput(result, container) {
  const text = document.createElement('pre');
  text.textContent = [result.stdout, result.stderr, result.error].filter(Boolean).join('\n') || 'Finished with no printed output.';
  container.replaceChildren(text);
  delete container.dataset.stale;
  container.dataset.error = String(Boolean(result.error));
  for (const png of result.figures) {
    const img = document.createElement('img');
    img.src = `data:image/png;base64,${png}`;
    img.alt = 'Scientific figure generated by this Python cell';
    container.append(img);
  }
  q('[data-variables]').textContent = result.variables.map(variable => `${variable.name}: ${variable.value}`).join('\n') || 'No user variables.';
}

function errorSummary(trace) {
  return trace.trim().split('\n').at(-1);
}

async function runCell(index, recovery = 'Fix this cell and run it again.') {
  await start();
  message(`Running cell ${index + 1}…`);
  const cell = cellAt(index);
  const code = cellEditor(index).value;
  const count = ++execution;
  cell.querySelector('[data-cell-count]').textContent = `In [${count}]`;
  const result = await request('run', {code});
  const log = q('[data-execution-log]');
  if (count === 1) log.textContent = '';
  log.textContent += `In [${count}] → cell ${index + 1}${result.error ? ' · error' : ''}\n`;
  showOutput(result, cell.querySelector('[data-cell-output]'));
  if (result.error) {
    executedSources.delete(index);
    showFeedback(`Cell ${index + 1}: ${errorSummary(result.error)} ${recovery}`, 'error', result.error, index);
    return false;
  }
  executedSources.set(index, code);
  renderOutputLink();
  return true;
}

async function runAll(fresh = false, recovery = 'Fix this cell, then run all cells again.') {
  selectPane('notebook');
  if (fresh) terminate('Starting a fresh Python session…');
  for (let index = 0; index < lesson.cells.length; index++) {
    if (!await runCell(index, recovery)) return false;
  }
  return true;
}

async function saveFile(file) {
  const content = fileEditor(file).value;
  if (content !== files[file]) {
    if (ready) await request('save', {path: filePaths[file], content});
    files[file] = content;
    executedSources.clear();
    markOutputsStale();
  }
  showFeedback(`Saved ${filePaths[file]}.`, 'success');
  advance('edit-file', file);
}

async function checkLesson() {
  if (lesson.file && fileEditor(lesson.file).value !== files[lesson.file]) {
    showFeedback(`Save ${filePaths[lesson.file]} before checking.`, 'error');
    return;
  }
  if (lesson.freshCheck) {
    if (!await runAll(true, lesson.recovery)) return;
  } else if (!ready || sources().some((code, index) => executedSources.get(index) !== code)) {
    showFeedback('Use Run all cells in Notebook tools to run the current notebook, then check again.', 'error');
    return;
  }
  message('Checking your work…');
  const result = await request('run', {code: lesson.check});
  if (result.error) {
    showFeedback(`${errorSummary(result.error)} ${lesson.recovery}`, 'error', result.error);
    return;
  }
  advance('check');
  showFeedback(result.stdout.trim(), 'success');
}

function renderCells(work) {
  q('[data-cells]').replaceChildren(...lesson.cells.map((spec, index) => {
    const cell = document.createElement('section');
    cell.className = 'live-cell';
    cell.dataset.cell = index;
    const bar = document.createElement('div');
    bar.className = 'cell-toolbar';
    const count = document.createElement('span');
    count.dataset.cellCount = '';
    count.textContent = 'In [ ]';
    const label = document.createElement('label');
    label.htmlFor = `python-cell-${index}`;
    label.textContent = `${index + 1}. ${spec.title}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.runCell = index;
    button.textContent = `Run cell ${index + 1}`;
    const editor = document.createElement('textarea');
    editor.id = label.htmlFor;
    editor.dataset.cellCode = '';
    editor.className = 'code-editor';
    editor.spellcheck = false;
    editor.rows = Math.min(14, Math.max(4, spec.code.split('\n').length));
    editor.value = work?.sources?.[index] ?? spec.code;
    const output = document.createElement('div');
    output.className = 'cell-output';
    output.dataset.cellOutput = '';
    output.tabIndex = -1;
    output.setAttribute('aria-label', `Cell ${index + 1} output`);
    bar.append(count, label, button);
    cell.append(bar, editor, output);
    return cell;
  }));
}

function choose(id, {navigate = false, reset = false} = {}) {
  const next = lessons.find(item => item.id === id) || lessons[0];
  if (busy || (next === lesson && !reset)) return;
  if (lesson && !reset) persist();
  lesson = next;
  if (navigate) history.pushState(null, '', `#${lesson.id}`);
  terminate('Python starts when you run code.');
  const work = reset ? undefined : saved[lesson.id];
  fileEditor('helper').value = work?.helper ?? lesson.helper ?? baseHelper;
  fileEditor('config').value = work?.config ?? baseConfig;
  // Older drafts stored the file text only, and used it on the next fresh session.
  files = {
    helper: work?.files?.helper ?? fileEditor('helper').value,
    config: work?.files?.config ?? fileEditor('config').value
  };
  q('[data-prediction]').value = work?.prediction ?? '';
  q('[data-exercise-progress]').textContent = `Exercise ${lessons.indexOf(lesson) + 1} of ${lessons.length} · ${lesson.minutes}`;
  q('[data-lab-title]').textContent = lesson.title;
  q('[data-lab-goal]').textContent = lesson.goal;
  q('[data-lab-hint]').textContent = lesson.hint;
  q('[data-lab-explanation]').textContent = lesson.explanation;
  q('[data-solution]').hidden = !Object.keys(lesson.solution).length;
  for (const panel of root.querySelectorAll('[data-mission-instructions], [data-hint-panel], [data-solution-panel], .workspace-options')) {
    panel.open = false;
  }
  for (const button of root.querySelectorAll('[data-scenario]')) {
    button.setAttribute('aria-pressed', String(button.dataset.scenario === lesson.id));
  }
  q('[data-lab-steps]').replaceChildren(...lesson.steps.map((step, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.stepIndex = index;
    button.className = 'text-action';
    button.textContent = step.instruction;
    item.append(button);
    return item;
  }));
  renderCells(work);
  showStep(0);
  const changedCells = work?.sources?.some((code, index) => code !== lesson.cells[index]?.code);
  const changedFiles = fileEditor('helper').value !== (lesson.helper ?? baseHelper) || fileEditor('config').value !== baseConfig;
  if (reset) showFeedback('Starter code restored.');
  else if (changedCells || changedFiles || work?.prediction) {
    const baseline = (changedCells || changedFiles) && lesson.baseline ? ` ${lesson.baseline}` : '';
    showFeedback(`Draft restored. Python variables start empty.${baseline}`);
  } else showFeedback();
  controls();
  root.dispatchEvent(new Event('workshop:lesson'));
  if (navigate || reset) q('[data-lab-title]').focus();
}

function loadSolution() {
  if (!window.confirm('Replace the exercise code with the worked solution? Your prediction will be kept.')) return;
  const solution = lesson.solution;
  solution.cells?.forEach((code, index) => { cellEditor(index).value = code; });
  for (const file of Object.keys(filePaths)) {
    if (solution[file]) fileEditor(file).value = solution[file];
  }
  terminate('Python will start fresh on the next run.');
  const next = lesson.steps.findIndex(step => step.action === 'edit-file' || step.action === 'fresh-run');
  showStep(next);
  showFeedback('Worked solution loaded. Follow the current step to try it.');
  persist();
  root.dispatchEvent(new Event('workshop:lesson'));
  focusStep();
}

function download(kind) {
  const notebook = kind === 'notebook';
  const text = notebook ? JSON.stringify(notebookExport(lesson, sources()), null, 2) : fileEditor(kind).value;
  const url = URL.createObjectURL(new Blob([text], {type: notebook ? 'application/x-ipynb+json' : 'text/plain'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = notebook ? `workshop-${lesson.id}.ipynb` : filePaths[kind].split('/').at(-1);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function performGuideAction() {
  const step = currentStep();
  if (!step) {
    choose(lessons[lessons.indexOf(lesson) + 1].id, {navigate: true});
    return;
  }
  switch (step.action) {
    case 'continue':
      showFeedback();
      advance('continue');
      break;
    case 'edit-cell':
      selectPane('notebook');
      cellEditor(step.cell).focus();
      break;
    case 'edit-file':
      selectPane(step.file);
      fileEditor(step.file).focus();
      break;
    case 'run-cell':
      runSingleCell(step.cell);
      break;
    case 'run-all':
    case 'fresh-run':
      runNotebook(step.action === 'fresh-run');
      break;
    case 'check':
      act(checkLesson);
      break;
  }
}

function runNotebook(fresh) {
  act(async () => {
    if (await runAll(fresh)) advance(fresh ? 'fresh-run' : 'run-all');
  });
}

function runSingleCell(index) {
  act(async () => {
    if (await runCell(index)) advance('run-cell', index);
  });
}

root.addEventListener('input', event => {
  if (event.target.matches('[data-cell-code], [data-helper], [data-config]')) {
    markOutputsStale();
    showFeedback();
    if (!currentStep()) {
      showStep(lesson.steps.length - 1, false);
      showFeedback(lesson.freshCheck ? 'Code changed. Run the fresh check again.' : 'Code changed. Run it again before checking.');
    }
  }
  if (event.target.matches('textarea')) persist();
});

root.addEventListener('keydown', event => {
  if (event.target.matches('[data-cell-code]') && event.key === 'Enter' && event.shiftKey) {
    event.preventDefault();
    runSingleCell(Number(event.target.closest('[data-cell]').dataset.cell));
  }
});

root.addEventListener('click', event => {
  if (event.target.closest('.back-to-step')) {
    event.preventDefault();
    focusStep();
    return;
  }
  const button = event.target.closest('button');
  if (!button) return;
  if (button.hasAttribute('data-stop-python')) {
    terminate('Python stopped. Your code is still in the editors.');
    return;
  }
  if (button.hasAttribute('data-view-output')) {
    selectPane('notebook');
    cellAt(Number(button.dataset.viewOutput)).querySelector('[data-cell-output]').focus();
    return;
  }
  if (busy) return;
  if (button === guide) performGuideAction();
  else if (button.hasAttribute('data-step-index')) {
    q('[data-mission-instructions]').open = false;
    showFeedback();
    showStep(Number(button.dataset.stepIndex));
    focusStep();
  } else if (button.hasAttribute('data-run-cell')) runSingleCell(Number(button.dataset.runCell));
  else if (button.hasAttribute('data-run-all')) {
    q('.workspace-options').open = false;
    runNotebook(button.dataset.runAll === 'fresh');
  } else if (button.hasAttribute('data-save-file')) act(() => saveFile(button.dataset.saveFile));
  else if (button.hasAttribute('data-inspect')) {
    q('.workspace-options').open = false;
    selectPane('inspect');
    q('#tab-inspect').focus();
  } else if (button.hasAttribute('data-scenario')) choose(button.dataset.scenario, {navigate: true});
  else if (button.hasAttribute('data-solution')) loadSolution();
  else if (button.hasAttribute('data-reset-lesson')) {
    if (window.confirm('Restore starter code and clear the prediction for this exercise?')) {
      choose(lesson.id, {reset: true});
      persist();
    }
  } else if (button.hasAttribute('data-download')) download(button.dataset.download);
});

function chooseFromLocation() {
  const id = location.hash.slice(1);
  if (id && !lessons.some(item => item.id === id)) return;
  if (busy) {
    terminate('Python stopped because you opened another exercise.');
    return;
  }
  choose(id);
}

choose(location.hash.slice(1));
window.addEventListener('popstate', chooseFromLocation);
window.addEventListener('hashchange', chooseFromLocation);
