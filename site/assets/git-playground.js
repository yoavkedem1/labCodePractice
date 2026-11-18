import {files} from './git-model.js';
import {executeCommand, formatDiff, quoteArgument} from './git-commands.js';
import {missionProgress, missions, runMissionAction, startMission} from './git-missions.js';
import {tabs} from './ui.js';

const root = document.querySelector('[data-git-dojo]');
const q = selector => root.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g,
  char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[char]);
const names = {rule: 'analysis.toml', plot: 'plotting.py'};
const views = {changes: 'Changes', history: 'Branches', remote: 'Remote & pull request'};
const valueLabel = (key, value) => key === 'rule' ? `${value} s` : value;

const sessions = new Map();
let session;
let view;
const selectView = tabs(root, '[data-git-tabs]', name => {
  view = name;
  if (session) {
    session.view = name;
    renderGuide();
  }
});
const input = q('[data-command-input]');
const terminal = q('#git-terminal');
const terminalButton = q('[data-toggle-terminal]');

function setText(node, value) {
  if (node.textContent !== value) node.textContent = value;
}

function setCommand(button, command) {
  button.dataset.command = command;
  button.title = command;
}

function setOptions(select, options, placeholder) {
  const previous = select.value;
  select.replaceChildren(...(options.length
    ? options.map(([value, label]) => new Option(label, value))
    : [new Option(placeholder, '')]));
  if (options.some(([value]) => value === previous)) select.value = previous;
  select.disabled = !options.length;
}

function renderGuide() {
  const {steps, next, complete} = missionProgress(session);
  q('[data-mission-steps]').innerHTML = steps.map(item => `
    <li data-step-state="${item.done ? 'done' : item === next ? 'current' : 'pending'}"${item === next ? ' aria-current="step"' : ''}>
      <span aria-hidden="true">${item.done ? '✓' : item === next ? '→' : ''}</span>
      ${item.done ? '<span class="visually-hidden">Completed. </span>' : ''}${escape(item.label)}
    </li>`).join('');
  const instruction = q('[data-next-instruction]');
  instruction.dataset.complete = String(complete);
  setText(instruction, complete ? `Mission complete. ${session.mission.explanation}` : next.instruction);
  const jump = q('[data-open-next]');
  jump.hidden = complete || next.view === view;
  if (!jump.hidden) {
    jump.dataset.view = next.view;
    setText(jump, `Open ${views[next.view]}`);
  }
  const hint = q('[data-step-hint]');
  const command = next?.command ?? '';
  if (q('[data-hint-command]').textContent !== command) hint.open = false;
  hint.hidden = !command;
  setText(q('[data-hint-command]'), command);
  q('[data-next-mission]').hidden = !complete || session.mission === missions.at(-1);
}

function renderChanges() {
  const {repo} = session;
  const {conflict} = repo;
  const conflictArea = q('[data-dojo-conflict]');
  conflictArea.hidden = !conflict;
  q('[data-edit-files]').hidden = Boolean(conflict);
  const conflictFiles = q('[data-conflict-files]');
  if (conflictFiles.renderedConflict !== conflict) {
    conflictFiles.innerHTML = conflict ? conflict.keys.map(key => {
      const label = key === 'rule' ? 'Resolved minimum reaction time (seconds)' : 'Resolved plot color';
      const editor = key === 'rule'
        ? '<input id="resolve-rule" name="value" type="number" min="0.01" max="1.99" step="0.01" required>'
        : '<select id="resolve-plot" name="value"><option>teal</option><option>purple</option><option>orange</option></select>';
      return `<section class="git-conflict-file" data-conflicting-file="${key}">
        <h3><code>${files[key]}</code></h3>
        <dl><div><dt>Current · ${escape(repo.current)}</dt><dd>${valueLabel(key, conflict.ours[key])}</dd></div>
        <div><dt>Incoming · ${escape(conflict.source)}</dt><dd>${valueLabel(key, conflict.theirs[key])}</dd></div></dl>
        <form data-resolve-form="${key}">
          <label for="resolve-${key}">${label}</label>
          <div class="git-inline">${editor}<button type="submit">Save resolution</button></div>
        </form>
        <div class="git-actions"><button type="button" data-stage-resolution="${key}">Stage resolution</button>
        <span data-resolution-state></span></div>
      </section>`;
    }).join('') : '';
    for (const form of conflictFiles.querySelectorAll('[data-resolve-form]')) {
      form.elements.value.value = repo.working[form.dataset.resolveForm];
    }
    conflictFiles.renderedConflict = conflict;
  }
  if (conflict) {
    setText(q('[data-conflict-title]'), `Resolve the merge of ${conflict.source} into ${repo.current}`);
    for (const key of conflict.keys) {
      const row = q(`[data-conflicting-file="${key}"]`);
      const staged = conflict.stagedKeys.has(key);
      const saved = conflict.resolvedKeys.has(key);
      const stage = row.querySelector('[data-stage-resolution]');
      stage.disabled = !saved || staged;
      setCommand(stage, `git add ${files[key]}`);
      setText(row.querySelector('[data-resolution-state]'), staged ? 'Resolution staged' : saved
        ? `Saved ${valueLabel(key, repo.working[key])}. Ready to stage.` : 'Compare the values and save your choice.');
    }
  }

  for (const key of Object.keys(files)) {
    const field = q(`[data-edit-form="${key}"]`).elements.value;
    if (field.dataset.saved !== repo.working[key]) {
      field.value = repo.working[key];
      field.dataset.saved = repo.working[key];
    }
  }

  const stagedResolutions = conflict ? [...conflict.stagedKeys] : [];
  for (const type of ['unstaged', 'staged']) {
    const staged = type === 'staged';
    const changes = repo.diff(staged);
    const keys = staged ? [...new Set([...repo.staged, ...stagedResolutions])] : repo.unstaged;
    q(`[data-empty="${type}"]`).hidden = keys.length > 0;
    setText(q(`[data-change-count="${type}"]`), keys.length ? String(keys.length) : '');
    for (const key of Object.keys(files)) {
      const row = q(`[data-change-list="${type}"] [data-file-row="${key}"]`);
      row.hidden = !keys.includes(key);
      const change = changes.find(item => item.key === key);
      const from = change ? valueLabel(key, change.before) : '';
      const to = valueLabel(key, staged ? repo.index[key] : repo.working[key]);
      setText(row.querySelector('[data-change-value]'), change ? `${from} → ${to}` : `${to} · merge resolution`);
      setText(row.querySelector('pre'), change ? formatDiff([change]) : 'The staged resolution keeps the current branch value.');
      for (const button of row.querySelectorAll('button')) button.disabled = Boolean(conflict) && (staged || button.hasAttribute('data-discard'));
    }
  }

  const commit = q('[data-commit-form]');
  const commitKeys = [...new Set([...repo.staged, ...stagedResolutions])];
  const canCommit = !repo.unmerged.length && Boolean(commitKeys.length || conflict);
  commit.querySelector('button').disabled = !canCommit;
  setText(q('[data-commit-summary]'), repo.unmerged.length ? 'Stage all resolutions before committing.'
    : commitKeys.length ? `Ready to commit on ${repo.current} · ${commitKeys.map(key =>
        `${names[key]} (${valueLabel(key, repo.index[key])})`).join(', ')}`
      : 'Stage a file to include it in a commit.');
  commit.elements.message.placeholder = conflict ? `Merge ${conflict.source} into ${repo.current}` : 'Describe the change';
  commit.elements.message.required = !conflict;

  const recovery = q('[data-recovery-tools]');
  recovery.hidden = !repo.head.parents.length && session.mission.id !== 'recovery';
  recovery.querySelector('button').disabled = repo.head.parents.length !== 1 || repo.dirty || Boolean(conflict);
}

function renderMerge() {
  const {repo} = session;
  const source = q('[data-merge-target]').value;
  const button = q('[data-merge-branch]');
  button.disabled = !source || Boolean(repo.conflict);
  setCommand(button, source ? `git merge ${source}` : '');
  setText(button, source ? `Merge ${source} into ${repo.current}` : 'Merge');
  const direction = q('[data-merge-base]');
  if (!source) {
    setText(direction, 'Create another branch to merge.');
    return;
  }
  try {
    const base = repo.mergeBase(repo.head.id, repo.branches[source]);
    setText(direction, `Shared ancestor · ${base.id}`);
  } catch (error) {
    setText(direction, error.message);
  }
}

function renderBranches() {
  const {repo} = session;
  const refs = Object.entries(repo.branches);
  const choices = refs.filter(([branch]) => branch !== repo.current).map(([branch, tip]) => [branch, `${branch} · ${tip}`]);
  setOptions(q('[data-switch-target]'), choices, 'No other branches');
  setOptions(q('[data-merge-target]'), choices, 'No other branches');
  q('[data-switch-branch]').disabled = !choices.length || Boolean(repo.conflict);
  setCommand(q('[data-switch-branch]'), choices.length ? `git switch ${q('[data-switch-target]').value}` : '');
  q('[data-branch-form] button').disabled = Boolean(repo.conflict);
  setText(q('[data-local-refs]'), refs.map(([name, id]) =>
    `${name} → ${id}${name === repo.current ? ' (current)' : ''}`).join(' · '));
  renderMerge();

  const reachable = new Set([...refs, ...Object.entries(repo.tracking)].flatMap(([, tip]) => [...repo.ancestors(tip)]));
  const commits = repo.commits.filter(commit => reachable.has(commit.id));
  const lanes = [...new Set(['main', ...commits.map(commit => commit.branch)])];
  const width = (commits.length - 1) * 92 + 170;
  const height = lanes.length * 52 + 28;
  const points = new Map(commits.map((commit, i) => [commit.id, [26 + i * 92, 30 + lanes.indexOf(commit.branch) * 52]]));
  const edges = commits.flatMap(commit => {
    const [x, y] = points.get(commit.id);
    return commit.parents.map(parent => {
      const [px, py] = points.get(parent);
      return `<path d="M ${px} ${py} C ${px + 36} ${py}, ${x - 36} ${y}, ${x} ${y}"/>`;
    });
  }).join('');
  const nodes = commits.map(commit => {
    const [x, y] = points.get(commit.id);
    const branches = refs.filter(([, id]) => id === commit.id).map(([name]) => name);
    const label = branches.join(' · ');
    return `<g><circle cx="${x}" cy="${y}" r="6" data-current="${commit.id === repo.head.id}"/>
      <text x="${x}" y="${y - 12}">${escape(label)}</text><text x="${x}" y="${y + 20}">${commit.id}</text></g>`;
  }).join('');
  q('[data-dojo-graph]').innerHTML = `<svg width="${width}" height="${height}" aria-hidden="true">${edges}${nodes}</svg>`;
  const inspector = q('[data-commit-list]');
  setOptions(inspector, [...commits].reverse().map(commit => [commit.id, `${commit.id} · ${commit.message}`]));
  inspector.value = reachable.has(session.inspected) ? session.inspected : repo.head.id;
  renderInspector();
}

function renderInspector() {
  const {repo} = session;
  const commit = repo.commitAt(q('[data-commit-list]').value);
  setText(q('[data-inspected-commit]'), `${commit.id} · ${commit.message}
Parents: ${commit.parents.join(', ') || 'none'}

# ${files.rule}
min_rt_s = ${commit.snapshot.rule}
max_rt_s = 2.00

# ${files.plot}
color = "${commit.snapshot.plot}"`);
}

function renderRemote() {
  const {repo} = session;
  const refs = entries => entries.map(([name, id]) => `<li><strong>${escape(name)}</strong> <code>${id}</code></li>`).join('');
  q('[data-local-remote-refs]').innerHTML = refs(Object.entries(repo.branches));
  q('[data-server-refs]').innerHTML = refs(Object.entries(repo.remote));
  setText(q('[data-tracking-refs]'), `Last known from fetch or push · ${Object.entries(repo.tracking).map(([name, id]) => `origin/${name} → ${id}`).join(' · ')}`);
  const push = q('[data-remote-push]');
  const tracks = Object.hasOwn(repo.upstream, repo.current);
  setText(push, `Push ${repo.current}`);
  setCommand(push, tracks ? 'git push' : `git push -u origin ${repo.current}`);
  q('[data-remote-switch]').hidden = repo.current === 'main';
  q('[data-remote-pull]').disabled = repo.current !== 'main' || Boolean(repo.conflict);
  push.disabled = Boolean(repo.conflict);

  const pr = repo.pullRequest;
  const open = q('[data-git-action="open-pr"]');
  const state = q('[data-pr-state]');
  const review = q('[data-git-action="review-pr"]');
  const merge = q('[data-git-action="merge-pr"]');
  const ready = repo.current !== 'main' && repo.remote[repo.current] === repo.head.id &&
    !repo.ancestors(repo.remote.main).has(repo.head.id);
  open.hidden = Boolean(pr && !pr.merged) || Boolean(pr?.merged && !ready);
  open.disabled = !ready;
  state.hidden = !pr;
  q('[data-pr-review]').hidden = !pr;
  if (!pr) {
    setText(q('[data-pr-summary]'), ready ? `Propose merging ${repo.current} into main on the server.`
      : 'Push a feature branch with new commits to open a pull request.');
    return;
  }

  const current = repo.prReviewCurrent;
  const stale = !pr.merged && pr.reviewedHead && !current;
  state.dataset.state = pr.merged || current ? 'ready' : stale ? 'stale' : 'open';
  setText(state, pr.merged ? 'Merged' : current ? 'Reviewed' : stale ? 'Review stale' : 'Awaiting review');
  review.hidden = pr.merged;
  merge.hidden = pr.merged;
  review.disabled = current;
  merge.disabled = !current;
  try {
    const {base, head, target, changes} = repo.prComparison;
    setText(q('[data-pr-summary]'), `${pr.source} ${head} → main ${target} · shared ancestor ${base}${stale ? '. Review the updated branch tips.' : ''}`);
    setText(q('[data-pr-diff]'), formatDiff(changes) || 'No proposed file changes.');
  } catch (error) {
    setText(q('[data-pr-summary]'), error.message);
    setText(q('[data-pr-diff]'), '');
    review.disabled = true;
    merge.disabled = true;
  }
}

function render() {
  const {repo} = session;
  setText(q('[data-dojo-head]'), `${repo.current} · ${repo.head.id}`);
  renderGuide();
  renderChanges();
  renderBranches();
  renderRemote();
}

function updateLog() {
  const log = q('[data-command-log]');
  log.textContent = session.log.join('\n\n');
  log.scrollTop = log.scrollHeight;
}

function report(message, command = '', failed = false) {
  q('[data-git-command]').hidden = !command;
  setText(q('[data-git-command]'), command);
  setText(q('[data-git-feedback]'), message);
  q('.git-feedback').dataset.error = String(failed);
}

function perform(command, action = repo => executeCommand(repo, command), typed = false) {
  const beforeConflict = session.repo.conflict;
  let output;
  let failed = false;
  try {
    output = runMissionAction(session, action);
  } catch (error) {
    failed = true;
    output = error.message;
  }
  session.log.push(`$ ${command}${output ? `\n${failed ? 'Error: ' : ''}${output}` : ''}`);
  if (session.log.length > 100) session.log.shift();
  updateLog();
  const visibleOutput = typed && !failed
    ? (output || 'Command completed with no output.')
    : output || 'No changes.';
  report(visibleOutput, command, failed);
  const stopped = !beforeConflict && session.repo.conflict;
  if (stopped) selectView('changes');
  render();
  if (stopped && !typed) q('[data-conflict-title]').focus();
  return !failed;
}

function chooseMission(id, restart = false) {
  const mission = missions.find(item => item.id === id) ?? missions[0];
  if (session) {
    session.message = q('#commit-message').value;
    session.branch = q('#branch-name').value;
    session.commandDraft = input.value;
  }
  if (restart || !sessions.has(mission.id)) {
    sessions.set(mission.id, {...startMission(mission), view: mission.view, log: [], commands: [],
      message: '', branch: 'criteria', commandDraft: ''});
  }
  session = sessions.get(mission.id);
  session.historyPosition = session.commands.length;
  session.typedDraft = '';
  q('#commit-message').value = session.message;
  q('#branch-name').value = session.branch;
  input.value = session.commandDraft;
  q('[data-git-mission]').value = mission.id;
  setText(q('[data-mission-goal]'), mission.goal);
  for (const editor of root.querySelectorAll('[data-edit-form] input, [data-edit-form] select')) delete editor.dataset.saved;
  q('[data-step-hint]').open = false;
  q('[data-recovery-tools]').open = false;
  for (const details of root.querySelectorAll('[data-change-list] details, .git-inspector, .git-extra')) details.open = false;
  updateLog();
  report(restart ? 'Mission restarted.' : '');
  selectView(session.view);
  render();
  const url = new URL(location.href);
  if (url.searchParams.get('mission') !== mission.id && (mission.id !== 'staging' || url.searchParams.has('mission'))) {
    url.searchParams.set('mission', mission.id);
    history.replaceState(null, '', url);
  }
}

for (const type of ['unstaged', 'staged']) {
  const staged = type === 'staged';
  q(`[data-change-list="${type}"]`).innerHTML = Object.entries(files).map(([key, path]) => `
    <article class="git-change" data-file-row="${key}" hidden>
      <code>${path}</code><span data-change-value></span>
      <details><summary aria-label="View ${type} diff for ${names[key]}">View diff</summary><pre></pre></details>
      <div class="git-actions">
        <button type="button" data-move-file="${key}" data-command="${staged ? 'git restore --staged' : 'git add'} ${path}"
          aria-label="${staged ? 'Unstage' : 'Stage'} ${names[key]}">${staged ? 'Unstage' : 'Stage'}</button>
        ${staged ? '' : `<button type="button" class="text-action" data-discard data-command="git restore ${path}"
          aria-label="Discard unstaged edit in ${names[key]}">Discard edit</button>`}
      </div>
    </article>`).join('');
}

for (const button of root.querySelectorAll('[data-command]')) button.title = button.dataset.command;

q('[data-git-mission]').replaceChildren(...missions.map(mission => new Option(mission.title, mission.id)));
q('[data-git-mission]').addEventListener('change', event => chooseMission(event.target.value));
q('[data-switch-target]').addEventListener('change', event => setCommand(q('[data-switch-branch]'), `git switch ${event.target.value}`));
q('[data-merge-target]').addEventListener('change', renderMerge);
q('[data-commit-list]').addEventListener('change', event => {
  session.inspected = event.target.value;
  renderInspector();
});

terminalButton.addEventListener('click', () => {
  terminal.hidden = !terminal.hidden;
  terminalButton.setAttribute('aria-expanded', String(!terminal.hidden));
  if (!terminal.hidden) {
    updateLog();
    input.focus();
  }
});
terminal.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    terminal.hidden = true;
    terminalButton.setAttribute('aria-expanded', 'false');
    terminalButton.focus();
  }
});
input.addEventListener('keydown', event => {
  if (!['ArrowUp', 'ArrowDown'].includes(event.key) || !session.commands.length) return;
  event.preventDefault();
  const {commands, historyPosition} = session;
  if (event.key === 'ArrowUp' && historyPosition === commands.length) session.typedDraft = input.value;
  session.historyPosition = Math.min(commands.length, Math.max(0, historyPosition + (event.key === 'ArrowUp' ? -1 : 1)));
  input.value = commands[session.historyPosition] ?? session.typedDraft;
  input.setSelectionRange(input.value.length, input.value.length);
});

root.addEventListener('submit', event => {
  const form = event.target;
  event.preventDefault();
  if (form.matches('[data-command-form]')) {
    const command = input.value.trim();
    if (!command) return;
    if (session.commands.at(-1) !== command) session.commands.push(command);
    session.historyPosition = session.commands.length;
    session.typedDraft = '';
    input.value = '';
    perform(command, undefined, true);
    input.focus();
  } else if (form.matches('[data-edit-form]')) {
    const key = form.dataset.editForm;
    perform(`Save ${files[key]}`, repo => repo.setFile(key, form.elements.value.value));
  } else if (form.matches('[data-resolve-form]')) {
    const key = form.dataset.resolveForm;
    perform(`Save resolution for ${files[key]}`, repo => repo.resolveWorking({[key]: form.elements.value.value}));
  } else if (form.matches('[data-branch-form]')) {
    perform(`git switch -c ${quoteArgument(form.elements.branch.value.trim())}`);
  } else if (form.matches('[data-commit-form]')) {
    const message = form.elements.message.value.trim();
    if (perform(message ? `git commit -m ${quoteArgument(message)}` : 'git commit')) {
      form.elements.message.value = '';
      if (session.mission.id === 'recovery') q('[data-recovery-tools]').open = true;
    }
  }
});

root.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.hasAttribute('data-open-next')) {
    const target = button.dataset.view;
    selectView(target);
    q(`[data-pane="${target}"]`).focus();
  } else if (button.hasAttribute('data-next-mission')) {
    chooseMission(missions[missions.indexOf(session.mission) + 1].id);
    q('[data-git-mission]').focus();
  } else if (button.dataset.command) {
    const row = button.closest('[data-file-row]');
    const staged = button.closest('[data-change-list="staged"]');
    if (perform(button.dataset.command)) {
      if (button.dataset.moveFile) {
        const target = q(`[data-change-list="${staged ? 'unstaged' : 'staged'}"] [data-file-row="${button.dataset.moveFile}"]`);
        if (!target.hidden) target.querySelector('summary').focus();
        else if (row.hidden) q('#commit-message').focus();
      } else if (button.hasAttribute('data-stage-resolution') || (row?.hidden && button.hasAttribute('data-discard'))) {
        q('#commit-message').focus();
      }
    }
  } else {
    switch (button.dataset.gitAction) {
      case 'restart':
        chooseMission(session.mission.id, true);
        break;
      case 'open-pr':
        if (perform('Open simulated pull request', repo => repo.openPR())) q('[data-git-action="review-pr"]').focus();
        break;
      case 'review-pr':
        if (perform('Record pull request review', repo => repo.reviewPR())) q('[data-git-action="merge-pr"]').focus();
        break;
      case 'merge-pr':
        if (perform('Merge pull request on server', repo => repo.mergePR())) {
          q(session.repo.current === 'main' ? '[data-remote-pull]' : '[data-remote-switch]').focus();
        }
        break;
      case 'colleague':
        perform('Add a commit on server main', repo => repo.colleague());
        break;
    }
  }
});

chooseMission(new URLSearchParams(location.search).get('mission'));
