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
    this.remote = {main: "c0"};
    this.tracking = {main: "c0"};
    this.pullRequest = null;
  }
  get head() { return this.commits.find(c => c.id === this.branches[this.current]); }
  changed(a, b) { return Object.keys(a).filter(k => a[k] !== b[k]); }
  get staged() { return this.changed(this.index, this.head.snapshot); }
  get unstaged() { return this.changed(this.working, this.index); }
  get dirty() { return Boolean(this.staged.length || this.unstaged.length); }
  ready() { if (this.conflict) throw new Error('Resolve or abort the merge first.'); }
  edit(key) {
    this.ready();
    if (key === 'rule') {
      const alternate = this.current === 'main' ? '0.25' : '0.30';
      this.working.rule = this.working.rule === alternate ? '0.20' : alternate;
    } else if (key === 'plot') {
      this.working.plot = this.working.plot === 'teal' ? 'purple' : 'teal';
    } else throw new Error('Unknown teaching file.');
    return `Working file changed: ${key === 'rule' ? `min_rt_s = ${this.working.rule} s` : `plot color = ${this.working.plot}`}. Stage it to include this version in a commit.`;
  }
  stage(keys = Object.keys(this.working)) {
    for (const key of keys) {
      if (!(key in this.working)) throw new Error('Unknown teaching file.');
      if (this.conflict?.keys.includes(key) && !this.conflict.resolved) throw new Error('Resolve the conflicting file before staging.');
      this.index[key] = this.working[key];
      if(this.conflict?.keys.includes(key)) this.conflict.stagedKeys.add(key);
    }
    if (this.conflict && this.conflict.keys.every(key => this.conflict.stagedKeys.has(key) && this.index[key] === this.working[key])) this.conflict.staged = this.conflict.resolved;
    return `Staged ${keys.join(', ')}. Further working edits stay unstaged until added again.`;
  }
  record(snapshot, parents, message) {
    if (this.commits.length >= 50) throw new Error('This sandbox is limited to 50 commits. Reset to explore again.');
    const commit = {id: `c${this.commits.length}`, parents, branch: this.current, message, snapshot: {...snapshot}};
    this.commits.push(commit);
    this.branches[this.current] = commit.id;
    return commit;
  }
  commit(message) {
    if(this.conflict && !this.conflict.staged) throw new Error('Resolve or abort the merge; resolved files must be staged before committing.');
    if (!this.staged.length && !this.conflict) throw new Error('Nothing staged. Edit a file and use git add first.');
    const changed = this.staged.join(' + ');
    const parents = this.conflict ? this.conflict.parents : [this.head.id];
    const commit = this.record(this.index, parents, message || (this.conflict ? 'Resolve conflict and merge' : `Update ${changed}`));
    this.conflict = null;
    return `Created ${commit.id} on ${this.current} from the staged snapshot. ${this.unstaged.length ? 'Later working edits remain unstaged.' : 'The working tree is clean.'} No remote was updated.`;
  }
  branch(name = "criteria") {
    this.ready();
    if(!/^[a-z][a-z0-9-]{0,24}$/.test(name)) throw new Error('Use a short lowercase branch name with letters, numbers, and hyphens.');
    if(this.branches[name]) throw new Error('Branch already exists. Use git switch.');
    if(Object.keys(this.branches).length >= 5) throw new Error('This teaching model supports five local branches. Reset to explore again.');
    if (this.dirty) throw new Error('Commit your changes before branching in this teaching model.');
    this.branches[name] = this.head.id;
    this.current = name;
    return `Created ${name} at the current commit and switched HEAD. No new commit was created.`;
  }
  switchBranch(name) {
    this.ready();
    name = name || (this.current === 'main' ? 'criteria' : 'main');
    if(!this.branches[name]) throw new Error('Create the target branch first.');
    if (this.dirty) throw new Error('Commit your changes before switching in this teaching model.');
    this.current = name;
    this.index = {...this.head.snapshot};
    this.working = {...this.head.snapshot};
    return `HEAD now points to ${this.current}; working files match its tip ${this.head.id}.`;
  }
  ancestors(id, seen = new Set()) {
    if (seen.has(id)) return seen;
    seen.add(id);
    this.commits.find(c => c.id === id).parents.forEach(p => this.ancestors(p, seen));
    return seen;
  }
  merge(source = "criteria") {
    this.ready();
    if (source === this.current) return "Already up to date.";
    if (!this.branches[source]) throw new Error('Create the source branch first.');
    if (this.dirty) throw new Error('Start the merge with a clean working tree.');
    const ours = this.head;
    const theirs = this.commits.find(c => c.id === this.branches[source]);
    const ourAncestors = this.ancestors(ours.id);
    const theirAncestors = this.ancestors(theirs.id);
    if (ourAncestors.has(theirs.id)) return `Already up to date: ${source} is already in ${this.current}’s history.`;
    if (theirAncestors.has(ours.id)) {
      this.branches[this.current] = theirs.id;
      this.index = {...theirs.snapshot};
      this.working = {...theirs.snapshot};
      return `Fast-forward: ${this.current} moved to ${source}’s tip. No merge commit was needed.`;
    }
    // In this bounded model, the newest common ancestor is the merge base.
    const common = this.commits.filter(c => ourAncestors.has(c.id) && theirAncestors.has(c.id));
    const bases = common.filter(c => !common.some(other => c.id !== other.id && this.ancestors(other.id).has(c.id)));
    if(bases.length !== 1) throw new Error('This bounded model does not resolve multiple merge bases.');
    const base = bases[0];
    const snapshot = {...ours.snapshot};
    const conflicts = [];
    for (const key of Object.keys(snapshot)) {
      if (ours.snapshot[key] === theirs.snapshot[key]) continue;
      if (ours.snapshot[key] === base.snapshot[key]) snapshot[key] = theirs.snapshot[key];
      else if (theirs.snapshot[key] !== base.snapshot[key]) conflicts.push(key);
    }
    if (conflicts.length) {
      this.conflict = {parents: [ours.id, theirs.id], snapshot, keys: conflicts, ours:ours.snapshot, theirs:theirs.snapshot, resolved:false, staged:false, stagedKeys:new Set()};
      return `Merge stopped: both branches changed ${conflicts.join(' and ')} differently since ${base.id}. Choose the intended final rule, then record the resolved merge, or abort.`;
    }
    const merged = this.record(snapshot, [ours.id, theirs.id], `Merge ${source} into ${this.current}`);
    this.index = {...snapshot}; this.working = {...snapshot};
    return `Created ${merged.id}, a merge commit with two parents. The separate rule and plot changes are both included.`;
  }
  resolveWorking(values) {
    if (!this.conflict) throw new Error('No unresolved merge.');
    const snapshot = {...this.conflict.snapshot, ...values};
    if(!Number.isFinite(Number(snapshot.rule)) || Number(snapshot.rule)<=0 || Number(snapshot.rule)>=2) throw new Error('The minimum RT must lie between 0 and 2 seconds.');
    if(!['teal','purple','orange'].includes(snapshot.plot)) throw new Error('Choose a teaching plot color.');
    this.working = snapshot;
    this.conflict.resolved = true;
    this.conflict.staged = false;
    this.conflict.stagedKeys.clear();
    return 'Resolution written to the working files. Inspect it, stage the resolved file, then commit the merge.';
  }
  resolve(value) {
    this.resolveWorking({rule:value}); this.stage(); this.commit('Resolve rule conflict and merge criteria');
    return `Resolved at ${value} s. The merge commit has two parents.`;
  }
  abort() {
    if (!this.conflict) throw new Error('No merge to abort.');
    this.conflict = null;
    this.index = {...this.head.snapshot}; this.working = {...this.head.snapshot};
    return `Merge aborted. ${this.current} and the working files are back at the pre-merge snapshot; branch history is intact.`;
  }

  setFile(key, value) {
    this.ready();
    if(key==='rule') {
      if(!Number.isFinite(Number(value)) || Number(value)<=0 || Number(value)>=2) throw new Error('Minimum RT must be between 0 and 2 seconds.');
      this.working.rule=Number(value).toFixed(2);
    } else if(key==='plot' && ['teal','purple','orange'].includes(value)) this.working.plot=value;
    else throw new Error('Unknown file or invalid value.');
    return 'Changed the working file. The index and HEAD are unchanged.';
  }
  unstage(keys = Object.keys(this.index)) {
    this.ready();
    for(const key of keys) {if(!(key in this.index)) throw new Error('Unknown file.');this.index[key]=this.head.snapshot[key];}
    return 'Unstaged the selected file; working edits are preserved.';
  }
  discard(key) {
    this.ready();if(!(key in this.working))throw new Error('Unknown file.');
    this.working[key]=this.index[key];
    return 'Restored the working file from the index. Its unstaged edit was discarded.';
  }
  diff(staged=false) {
    const before=staged?this.head.snapshot:this.index;
    const after=staged?this.index:this.working;
    return this.changed(after,before).map(key=>({key,before:before[key],after:after[key]}));
  }
  push(branch=this.current) {
    this.ready();
    if(!this.branches[branch])throw new Error('Unknown local branch.');
    const remoteTip=this.remote[branch];
    if(remoteTip && !this.ancestors(this.branches[branch]).has(remoteTip)) throw new Error('Push rejected: remote history is not an ancestor. Fetch and inspect divergence; do not force push.');
    this.remote[branch]=this.branches[branch];this.tracking[branch]=this.branches[branch];
    return `Pushed ${branch}. The origin branch and its local remote-tracking reference were updated.`;
  }
  fetch() {this.tracking={...this.remote};return 'Fetched origin: remote-tracking pointers updated. Local branch, index, and working files did not move.';}
  pull() {
    this.ready();if(this.dirty)throw new Error('Commit or preserve changes before pulling in this model.');
    this.fetch();const target=this.tracking[this.current];
    if(!target)throw new Error('This branch has no counterpart on origin. Push it first.');
    if(this.ancestors(this.head.id).has(target))return 'Already up to date; local history contains the remote tip.';
    if(!this.ancestors(target).has(this.head.id))throw new Error('git pull --ff-only refused: histories diverged. Inspect the graph and coordinate a merge.');
    this.branches[this.current]=target;this.index={...this.head.snapshot};this.working={...this.head.snapshot};
    return 'Fast-forward pull updated the local branch, index, and working files.';
  }
  colleague(key='plot',value='orange') {
    if(this.commits.length>=50) throw new Error('Reset the sandbox after 50 commits.');
    if(!['rule','plot'].includes(key))throw new Error('Unknown teaching file.');
    if(key==='rule'){if(!Number.isFinite(Number(value))||Number(value)<=0||Number(value)>=2)throw new Error('Minimum RT must be between 0 and 2 seconds.');value=Number(value).toFixed(2);}
    else if(!['teal','purple','orange'].includes(value))throw new Error('Choose a teaching plot color.');
    const parent=this.remote.main;
    const snapshot={...this.commits.find(c=>c.id===parent).snapshot,[key]:value};
    const node={id:`c${this.commits.length}`,parents:[parent],branch:'origin/main',message:'Labmate updates shared analysis',snapshot};
    this.commits.push(node);this.remote.main=node.id;
    return 'A labmate committed on the simulated server. Your local files and origin/main tracking reference are still unchanged until fetch.';
  }
  openPR() {
    if(this.current==='main')throw new Error('Create and push a feature branch before opening a pull request.');
    if(this.remote[this.current]!==this.branches[this.current])throw new Error('Push the current branch tip before opening a pull request.');
    if(this.ancestors(this.remote.main).has(this.remote[this.current]))throw new Error('No new commits to propose.');
    this.pullRequest={source:this.current,head:this.remote[this.current],base:this.remote.main,reviewedHead:null,reviewedBase:null,merged:false};
    return 'Opened a simulated pull request to main. Review the proposed change before merging.';
  }
  reviewPR() {
    if(!this.pullRequest || this.pullRequest.merged)throw new Error('Open a pull request first.');
    const pr=this.pullRequest;
    pr.reviewedHead=this.remote[pr.source];pr.reviewedBase=this.remote.main;
    return 'Review recorded for the current source and target tips. New commits require another review.';
  }
  mergePR() {
    const pr=this.pullRequest;
    if(!pr || pr.merged)throw new Error('Open an unmerged pull request first.');
    if(pr.reviewedHead!==this.remote[pr.source] || pr.reviewedBase!==this.remote.main)throw new Error('Review is missing or stale. Review the current source and target tips.');
    const ours=this.commits.find(c=>c.id===this.remote.main),theirs=this.commits.find(c=>c.id===this.remote[pr.source]);
    if(this.ancestors(ours.id).has(theirs.id))throw new Error('The proposed commits are already in main.');
    const common=this.commits.filter(c=>this.ancestors(ours.id).has(c.id)&&this.ancestors(theirs.id).has(c.id));
    const bases=common.filter(c=>!common.some(other=>c.id!==other.id&&this.ancestors(other.id).has(c.id)));
    if(bases.length!==1)throw new Error('Multiple merge bases are outside this model.');
    const snapshot={...ours.snapshot};
    for(const key of Object.keys(snapshot)){
      if(ours.snapshot[key]===theirs.snapshot[key])continue;
      if(ours.snapshot[key]===bases[0].snapshot[key])snapshot[key]=theirs.snapshot[key];
      else if(theirs.snapshot[key]!==bases[0].snapshot[key])throw new Error('Pull request has a conflict. Resolve it locally and push the result before review.');
    }
    if(this.commits.length>=50)throw new Error('Reset the sandbox after 50 commits.');
    const node={id:`c${this.commits.length}`,parents:[ours.id,theirs.id],branch:'origin/main',message:`Merge reviewed PR from ${pr.source}`,snapshot};
    this.commits.push(node);this.remote.main=node.id;pr.merged=true;
    return 'Merged on the simulated server using a two-parent merge commit. Local main has not moved; switch to main and pull --ff-only.';
  }
  revert() {
    this.ready();if(this.dirty)throw new Error('Start revert with a clean working tree.');
    if(this.head.parents.length!==1)throw new Error('This exercise supports reverting the latest single-parent commit only.');
    const old=this.head, parent=this.commits.find(c=>c.id===old.parents[0]);
    this.record(parent.snapshot,[old.id],`Revert ${old.id}: ${old.message}`);
    this.index={...this.head.snapshot};this.working={...this.head.snapshot};
    return 'Created an inverse commit. The original commit remains in history; nothing was erased.';
  }
}
