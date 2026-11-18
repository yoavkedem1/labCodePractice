export const files = {rule: 'config/analysis.toml', plot: 'src/experiment/plotting.py'};

function fileValue(key, value) {
  if (key === 'rule') {
    const rounded = Number(value).toFixed(2);
    if (Number(rounded) > 0 && Number(rounded) < 2) return rounded;
    throw new Error('Enter a minimum RT from 0.01 to 1.99 seconds.');
  }
  if (key === 'plot' && ['teal', 'purple', 'orange'].includes(value)) return value;
  throw new Error('Choose one of the available plot colors.');
}

/** A bounded teaching model of snapshots, the index, and a small commit DAG. */
export class GitModel {
  constructor() {
    const snapshot = {rule: '0.20', plot: 'teal'};
    this.commits = [{id: 'c0', parents: [], branch: 'main', message: 'Synthetic experiment baseline', snapshot}];
    this.branches = {main: 'c0'};
    this.current = 'main';
    this.working = {...snapshot};
    this.index = {...snapshot};
    this.conflict = null;
    this.remote = {main: 'c0'};
    this.tracking = {main: 'c0'};
    this.upstream = {main: 'main'};
    this.pullRequest = null;
  }

  get head() { return this.commitAt(this.branches[this.current]); }
  commitAt(id) { return this.commits.find(commit => commit.id === id); }
  changed(a, b) { return Object.keys(files).filter(key => a[key] !== b[key]); }
  get unmerged() { return this.conflict?.keys.filter(key => !this.conflict.stagedKeys.has(key)) ?? []; }
  get staged() { return this.changed(this.index, this.head.snapshot).filter(key => !this.unmerged.includes(key)); }
  get unstaged() { return this.changed(this.working, this.index).filter(key => !this.unmerged.includes(key)); }
  get dirty() { return Boolean(this.staged.length || this.unstaged.length); }

  ready() {
    if (this.conflict) throw new Error('Finish or abort the merge first.');
  }

  edit(key) {
    if (key === 'rule') {
      const alternate = this.current === 'main' ? '0.25' : '0.30';
      return this.setFile(key, this.working.rule === alternate ? '0.20' : alternate);
    }
    if (key === 'plot') return this.setFile(key, this.working.plot === 'teal' ? 'purple' : 'teal');
    throw new Error('Unknown teaching file.');
  }

  setFile(key, value) {
    this.ready();
    if (!Object.hasOwn(files, key)) throw new Error('Unknown teaching file.');
    const next = fileValue(key, value);
    if (this.working[key] === next) return `${files[key]} is already saved at that value.`;
    this.working[key] = next;
    return `Saved ${files[key]} in the working tree.`;
  }

  stage(keys = Object.keys(files)) {
    for (const key of keys) {
      if (!Object.hasOwn(files, key)) throw new Error('Unknown teaching file.');
      if (this.unmerged.includes(key) && !this.conflict.resolvedKeys.has(key)) {
        throw new Error(`Write a resolution for ${files[key]} before staging it.`);
      }
    }
    for (const key of keys) {
      this.index[key] = this.working[key];
      if (this.conflict?.keys.includes(key)) this.conflict.stagedKeys.add(key);
    }
    return `Staged ${keys.map(key => files[key]).join(', ')}.`;
  }

  unstage(keys = Object.keys(files)) {
    this.ready();
    if (keys.some(key => !Object.hasOwn(files, key))) throw new Error('Unknown file.');
    for (const key of keys) this.index[key] = this.head.snapshot[key];
    return 'Unstaged the selected files. Working edits are preserved.';
  }

  discard(keys) {
    this.ready();
    const paths = Array.isArray(keys) ? keys : [keys];
    if (paths.some(key => !Object.hasOwn(files, key))) throw new Error('Unknown file.');
    for (const key of paths) this.working[key] = this.index[key];
    return 'Restored the selected files from the index. Their unstaged edits were discarded.';
  }

  diff(staged = false) {
    const before = staged ? this.head.snapshot : this.index;
    const after = staged ? this.index : this.working;
    return (staged ? this.staged : this.unstaged).map(key => ({key, before: before[key], after: after[key]}));
  }

  createCommit(branch, snapshot, parents, message, metadata) {
    if (this.commits.length >= 50) throw new Error('This sandbox is limited to 50 commits. Restart this mission to explore again.');
    const commit = {id: `c${this.commits.length}`, parents, branch, message, snapshot: {...snapshot}, ...metadata};
    this.commits.push(commit);
    return commit;
  }

  record(snapshot, parents, message, metadata) {
    const commit = this.createCommit(this.current, snapshot, parents, message, metadata);
    this.branches[this.current] = commit.id;
    return commit;
  }

  commit(message) {
    if (this.unmerged.length) throw new Error('Resolve the conflicting files and stage them before committing, or abort the merge.');
    if (!this.staged.length && !this.conflict) throw new Error('Nothing staged. Edit a file and use git add first.');
    const parents = this.conflict?.parents ?? [this.head.id];
    const commit = this.record(this.index, parents,
      message || (this.conflict ? `Merge ${this.conflict.source} into ${this.current}` : 'Update analysis'),
      this.conflict ? {resolvedMerge: true} : {});
    this.conflict = null;
    return `Created ${commit.id} on ${this.current}. ${this.unstaged.length ? 'Unstaged edits remain in the working tree.' : 'Working tree clean.'}`;
  }

  branch(name = 'criteria', switchToBranch = true) {
    this.ready();
    const parts = name.split('/');
    const valid = /^[A-Za-z0-9_][A-Za-z0-9._/-]{0,63}$/.test(name) &&
      !name.includes('..') && !name.endsWith('.') && name !== 'HEAD' &&
      parts.every(part => part && !part.startsWith('.') && !part.endsWith('.lock'));
    if (!valid) throw new Error('Use a branch name such as criteria or feature/rt-policy.');
    if (Object.hasOwn(this.branches, name)) throw new Error('Branch already exists. Use git switch.');
    if (Object.keys(this.branches).length >= 5) throw new Error('This teaching repository supports five local branches.');
    this.branches[name] = this.head.id;
    if (switchToBranch) this.current = name;
    return `Created ${name} at ${this.head.id}.${switchToBranch ? ` Now on ${name}.` : ''}${this.dirty ? ' Pending edits are preserved.' : ''}`;
  }

  switchBranch(name = this.current === 'main' ? 'criteria' : 'main') {
    this.ready();
    if (!Object.hasOwn(this.branches, name)) throw new Error(`Branch ${name} does not exist. List branches with git branch.`);
    if (this.current === name) return `Already on ${name}.`;
    const target = this.commitAt(this.branches[name]).snapshot;
    const updated = this.changed(target, this.head.snapshot);
    const pending = [...this.staged, ...this.unstaged];
    const blocked = updated.filter(key => pending.includes(key));
    if (blocked.length) {
      throw new Error(`Switch would overlap with pending edits in ${blocked.map(key => files[key]).join(', ')}. Commit or restore those edits first.`);
    }
    for (const key of updated) this.working[key] = this.index[key] = target[key];
    this.current = name;
    return `Switched to ${name} at ${this.head.id}.${pending.length ? ' Pending edits carried over.' : ''}`;
  }

  ancestors(id, seen = new Set()) {
    if (seen.has(id)) return seen;
    seen.add(id);
    for (const parent of this.commitAt(id).parents) this.ancestors(parent, seen);
    return seen;
  }

  mergeBase(first, second) {
    const a = this.ancestors(first);
    const b = this.ancestors(second);
    const common = this.commits.filter(commit => a.has(commit.id) && b.has(commit.id));
    const bases = common.filter(commit =>
      !common.some(other => other !== commit && this.ancestors(other.id).has(commit.id)));
    if (bases.length !== 1) throw new Error('This simulator needs a single merge base.');
    return bases[0];
  }

  combine(ours, theirs, base) {
    const snapshot = {...ours};
    const conflicts = [];
    for (const key of this.changed(ours, theirs)) {
      if (ours[key] === base[key]) snapshot[key] = theirs[key];
      else if (theirs[key] !== base[key]) conflicts.push(key);
    }
    return {snapshot, conflicts};
  }

  checkoutSnapshot(snapshot) {
    this.index = {...snapshot};
    this.working = {...snapshot};
  }

  merge(source = 'criteria') {
    this.ready();
    if (!Object.hasOwn(this.branches, source)) throw new Error(`Branch ${source} does not exist. List branches with git branch.`);
    if (this.dirty) throw new Error('Start this merge with a clean working tree. Commit or restore pending edits first.');
    const ours = this.head;
    const theirs = this.commitAt(this.branches[source]);
    if (this.ancestors(ours.id).has(theirs.id)) return `Already up to date. ${source} is in ${this.current}'s history.`;
    if (this.ancestors(theirs.id).has(ours.id)) {
      this.branches[this.current] = theirs.id;
      this.checkoutSnapshot(theirs.snapshot);
      return `Fast-forwarded ${this.current} to ${source} at ${theirs.id}.`;
    }

    const base = this.mergeBase(ours.id, theirs.id);
    const {snapshot, conflicts} = this.combine(ours.snapshot, theirs.snapshot, base.snapshot);
    const parents = [ours.id, theirs.id];
    if (conflicts.length) {
      this.conflict = {
        parents, source, keys: conflicts, ours: ours.snapshot, theirs: theirs.snapshot,
        resolvedKeys: new Set(), stagedKeys: new Set()
      };
      this.checkoutSnapshot(snapshot);
      return `Merge stopped. Both branches changed ${conflicts.map(key => files[key]).join(', ')} since ${base.id}. Write and stage a resolution, or abort the merge.`;
    }
    const merged = this.record(snapshot, parents, `Merge ${source} into ${this.current}`);
    this.checkoutSnapshot(snapshot);
    return `Created merge commit ${merged.id} with parents ${parents.join(' and ')}.`;
  }

  resolveWorking(values) {
    if (!this.conflict) throw new Error('No merge in progress.');
    const resolutions = Object.entries(values).map(([key, value]) => {
      if (!this.conflict.keys.includes(key)) throw new Error('Choose a file with a merge conflict.');
      return [key, fileValue(key, value)];
    });
    for (const [key, value] of resolutions) {
      this.working[key] = value;
      this.conflict.resolvedKeys.add(key);
      this.conflict.stagedKeys.delete(key);
    }
    return 'Resolution saved to the working file. Stage it to include it in the merge commit.';
  }

  resolve(value) {
    this.resolveWorking({rule: value});
    this.stage();
    this.commit('Resolve rule conflict and merge criteria');
    return `Resolved at ${value} s. The merge commit has two parents.`;
  }

  abort() {
    if (!this.conflict) throw new Error('No merge to abort.');
    this.conflict = null;
    this.checkoutSnapshot(this.head.snapshot);
    return `Merge aborted. Restored the working tree and staging area to ${this.current} at ${this.head.id}.`;
  }

  push(branch, setUpstream = false) {
    this.ready();
    if (!branch && !Object.hasOwn(this.upstream, this.current)) {
      throw new Error(`No upstream for ${this.current}. Run git push -u origin ${this.current}.`);
    }
    branch ??= this.upstream[this.current];
    if (!Object.hasOwn(this.branches, branch)) throw new Error(`Unknown local branch: ${branch}.`);
    const tip = this.branches[branch];
    if (Object.hasOwn(this.remote, branch) && !this.ancestors(tip).has(this.remote[branch])) {
      throw new Error('Push rejected. Fetch and inspect the server history before integrating its changes.');
    }
    this.remote[branch] = tip;
    this.tracking[branch] = tip;
    if (setUpstream) this.upstream[branch] = branch;
    return `Pushed ${branch} to origin/${branch}.${setUpstream ? ` ${branch} now tracks origin/${branch}.` : ''}`;
  }

  fetch() {
    this.tracking = {...this.remote};
    return 'Fetched origin. Remote-tracking branches are up to date.';
  }

  pull(branch) {
    this.ready();
    if (this.dirty) throw new Error('Commit or restore pending edits before pulling in this simulator.');
    if (!branch && !Object.hasOwn(this.upstream, this.current)) {
      throw new Error(`No upstream for ${this.current}. Specify a branch with git pull --ff-only origin BRANCH.`);
    }
    branch ??= this.upstream[this.current];
    this.fetch();
    if (!Object.hasOwn(this.tracking, branch)) throw new Error(`Branch ${branch} does not exist on origin.`);
    const target = this.tracking[branch];
    if (this.ancestors(this.head.id).has(target)) return `Already up to date with origin/${branch}.`;
    if (!this.ancestors(target).has(this.head.id)) {
      throw new Error('git pull --ff-only refused: histories diverged. Inspect the graph and coordinate a merge.');
    }
    this.branches[this.current] = target;
    this.checkoutSnapshot(this.head.snapshot);
    return `Fast-forwarded local ${this.current} to ${target} from origin/${branch}.`;
  }

  colleague(key = 'plot', value = 'orange') {
    if (!Object.hasOwn(files, key)) throw new Error('Unknown teaching file.');
    const parent = this.remote.main;
    const snapshot = {...this.commitAt(parent).snapshot, [key]: fileValue(key, value)};
    const node = this.createCommit('origin/main', snapshot, [parent], 'Labmate updates shared analysis');
    this.remote.main = node.id;
    return `A labmate moved server main to ${node.id}. Fetch to update your local origin/main reference.`;
  }

  openPR() {
    if (this.current === 'main') throw new Error('Switch to the pushed feature branch before opening a pull request.');
    if (this.pullRequest && !this.pullRequest.merged) throw new Error('A pull request is already open.');
    if (this.remote[this.current] !== this.branches[this.current]) throw new Error('Push the current branch before opening a pull request.');
    if (this.ancestors(this.remote.main).has(this.remote[this.current])) throw new Error('No new commits to propose.');
    this.pullRequest = {source: this.current, reviewedHead: null, reviewedBase: null, merged: false};
    return 'Opened the simulated pull request. Review the proposed changes before merging.';
  }

  reviewPR() {
    if (!this.pullRequest || this.pullRequest.merged) throw new Error('Open a pull request first.');
    const pr = this.pullRequest;
    pr.reviewedHead = this.remote[pr.source];
    pr.reviewedBase = this.remote.main;
    return 'Review recorded for these branch tips. New commits on either branch require a fresh review.';
  }

  get prReviewCurrent() {
    const pr = this.pullRequest;
    return Boolean(pr && !pr.merged &&
      pr.reviewedHead === this.remote[pr.source] && pr.reviewedBase === this.remote.main);
  }

  get prComparison() {
    const pr = this.pullRequest;
    if (!pr) return null;
    const head = pr.merged ? pr.reviewedHead : this.remote[pr.source];
    const target = pr.merged ? pr.reviewedBase : this.remote.main;
    const base = this.mergeBase(target, head);
    const snapshot = this.commitAt(head).snapshot;
    const changes = this.changed(snapshot, base.snapshot).map(key =>
      ({key, before: base.snapshot[key], after: snapshot[key]}));
    return {base: base.id, head, target, changes};
  }

  mergePR() {
    const pr = this.pullRequest;
    if (!pr || pr.merged) throw new Error('Open an unmerged pull request first.');
    if (!this.prReviewCurrent) throw new Error('Review is missing or stale. Review the current branch tips.');
    const ours = this.commitAt(this.remote.main);
    const theirs = this.commitAt(this.remote[pr.source]);
    if (this.ancestors(ours.id).has(theirs.id)) throw new Error('The proposed commits are already in main.');
    const base = this.mergeBase(ours.id, theirs.id);
    const {snapshot, conflicts} = this.combine(ours.snapshot, theirs.snapshot, base.snapshot);
    if (conflicts.length) throw new Error('Pull request has a conflict. Resolve it locally and push the result before review.');
    const node = this.createCommit('origin/main', snapshot, [ours.id, theirs.id], `Merge reviewed PR from ${pr.source}`);
    this.remote.main = node.id;
    pr.merged = true;
    return `Merged on the server at ${node.id}. Switch to local main and pull to catch up.`;
  }

  revert() {
    this.ready();
    if (this.dirty) throw new Error('Start revert with a clean working tree.');
    if (this.head.parents.length !== 1) throw new Error('This exercise supports reverting the latest single-parent commit only.');
    const old = this.head;
    const parent = this.commitAt(old.parents[0]);
    const inverse = this.record(parent.snapshot, [old.id], `Revert ${old.id}: ${old.message}`, {reverts: old.id});
    this.checkoutSnapshot(this.head.snapshot);
    return `Created ${inverse.id} to undo ${old.id}. Both commits remain in history.`;
  }
}
