import {files, GitModel} from './git-model.js';

function saveRule(repo, value) {
  repo.setFile('rule', value);
  repo.stage(['rule']);
  repo.commit(`Set minimum RT to ${value} s`);
}

function step(done, label, instruction, view = 'changes', command = '') {
  return {done: Boolean(done), label, instruction, view, command};
}

const addRule = `git add ${files.rule}`;
const restoreRule = `git restore --staged ${files.rule}`;
const commitRule = 'git commit -m "Compare the RT rule"';

export const missions = [
  {
    id: 'staging', title: 'Stage selectively', view: 'changes',
    goal: 'Commit the 0.50 s minimum reaction time and leave the purple plot edit unstaged.',
    explanation: 'A commit records the versions in the staging area. Your purple plot edit is still in the working tree.',
    steps(repo) {
      const parent = repo.commitAt(repo.head.parents[0]);
      const committed = parent && parent.snapshot.rule !== '0.50' &&
        repo.head.snapshot.rule === '0.50' && repo.head.snapshot.plot === 'teal' &&
        parent.snapshot.plot === 'teal';
      const edited = repo.working.rule === '0.50' && repo.working.plot === 'purple';
      const selective = repo.index.rule === '0.50' && repo.index.plot === 'teal';
      return [
        step(edited, 'Edit both files', 'Save 0.50 s in analysis.toml and purple in plotting.py.'),
        step(selective, 'Stage only the rule', repo.staged.includes('plot')
          ? 'Unstage plotting.py. Keep the purple edit in the working tree.'
          : 'Stage analysis.toml and compare the staged and unstaged diffs.', 'changes',
        repo.staged.includes('plot') ? `git restore --staged ${files.plot}` : addRule),
        step(committed && selective && repo.unstaged.includes('plot'), 'Commit the rule', 'Commit the staged rule with a message that explains the change.', 'changes', commitRule)
      ];
    }
  },
  {
    id: 'branches', title: 'Merge independent work', view: 'history',
    goal: 'Commit an RT rule on a feature branch and a plot change on main, then merge both changes on main.',
    explanation: 'The merge commit has two parents because both branches advanced. Git combined changes to different files.',
    steps(repo) {
      const features = Object.entries(repo.branches).filter(([name]) => name !== 'main');
      const ruleCommit = features.find(([, id]) =>
        repo.commitAt(id).snapshot.rule === '0.30' && repo.commitAt(id).snapshot.plot === 'teal');
      const [feature = 'criteria'] = ruleCommit ?? features[0] ?? [];
      const main = repo.commitAt(repo.branches.main);
      const [mainParent, otherParent] = main.parents.map(id => repo.commitAt(id));
      const merged = mainParent?.snapshot.plot === 'purple' && mainParent.snapshot.rule === '0.20' &&
        otherParent?.snapshot.rule === '0.30' && otherParent.snapshot.plot === 'teal' &&
        main.snapshot.rule === '0.30' && main.snapshot.plot === 'purple';
      const onFeature = repo.current === feature;
      const onMain = repo.current === 'main';
      return [
        step(features.length || merged, 'Create a feature branch', 'Create and switch to a branch at the baseline.', 'history', 'git switch -c criteria'),
        step(ruleCommit || merged, 'Commit 0.30 s on the feature branch', onFeature
          ? 'Save 0.30 s, stage analysis.toml, and commit it on this branch.'
          : `Switch to ${feature}, then edit and commit the rule there.`, onFeature ? 'changes' : 'history', onFeature ? addRule : `git switch ${feature}`),
        step(main.snapshot.plot === 'purple', 'Commit purple on main', onMain
          ? 'Save purple, stage plotting.py, and commit it on main.'
          : 'Switch to main so the plot change has its own history.', onMain ? 'changes' : 'history',
        onMain ? `git add ${files.plot}` : 'git switch main'),
        step(merged && onMain, 'Merge into main', onMain
          ? `Find the shared ancestor, then merge ${feature} into main.`
          : 'Switch to main to inspect the combined history.', 'history', onMain ? `git merge ${feature}` : 'git switch main')
      ];
    }
  },
  {
    id: 'conflict', title: 'Resolve a conflict', view: 'history',
    goal: 'Compare the two changes to the RT rule, choose a final value, and record the merge.',
    explanation: 'The merge commit records your staged resolution and links both parent commits. Choosing the current value still requires staging.',
    setup(repo) {
      repo.branch();
      saveRule(repo, '0.30');
      repo.switchBranch('main');
      saveRule(repo, '0.25');
    },
    steps(repo) {
      const merged = repo.current === 'main' && repo.head.resolvedMerge &&
        repo.head.parents.includes(repo.branches.criteria);
      const conflict = repo.conflict?.source === 'criteria' && repo.current === 'main' ? repo.conflict : null;
      return [
        step(merged || conflict, 'Merge criteria into main', repo.current === 'main'
          ? 'Inspect the common ancestor c0, then merge criteria into main.'
          : 'Switch to main to merge the prepared branch.', 'history',
        repo.current === 'main' ? 'git merge criteria' : 'git switch main'),
        step(merged || conflict?.resolvedKeys.has('rule'), 'Save a resolution', 'Compare the two branch values, then save the value you want to keep.'),
        step(merged || (conflict && !repo.unmerged.length), 'Stage the resolution', 'Stage the resolved analysis.toml so Git can record the merge.', 'changes', addRule),
        step(merged, 'Commit the merge', 'Commit the staged resolution with your own message.', 'changes', 'git commit -m "Explain the chosen RT rule"')
      ];
    }
  },
  {
    id: 'remote', title: 'Share and review', view: 'remote',
    goal: 'Share the prepared feature commit, review and merge its pull request, and synchronize local main.',
    explanation: 'Push shared your feature commit, the pull request updated server main, and pull brought the result into local main.',
    setup(repo) {
      repo.branch();
      saveRule(repo, '0.50');
    },
    steps(repo) {
      const pr = repo.pullRequest;
      const pushed = repo.remote.criteria === repo.branches.criteria;
      const onFeature = repo.current === 'criteria';
      const reviewed = pr?.merged || repo.prReviewCurrent;
      return [
        step(pushed || pr, 'Push the feature branch', onFeature ? 'Push criteria and set its upstream.'
          : 'Switch to criteria to push the prepared feature commit.', onFeature ? 'remote' : 'history',
        onFeature ? 'git push -u origin criteria' : 'git switch criteria'),
        step(pr, 'Open a pull request', onFeature ? 'Open a pull request from the pushed feature branch to main.'
          : 'Switch to criteria to open its pull request.', onFeature ? 'remote' : 'history',
        onFeature ? '' : 'git switch criteria'),
        step(reviewed, 'Review the proposed diff', pr?.reviewedHead
          ? 'The branch tips changed. Read the current diff and record a fresh review.'
          : 'Read the proposed change and record your review.', 'remote'),
        step(pr?.merged, 'Merge on the server', 'Merge the reviewed pull request on origin.', 'remote'),
        step(pr?.merged && repo.current === 'main' && repo.head.id === repo.remote.main,
          'Update local main', repo.current === 'main' ? 'Pull the merged history into local main.'
            : 'Switch to local main, then pull the merged history.', 'remote',
          repo.current === 'main' ? 'git pull --ff-only' : 'git switch main')
      ];
    }
  },
  {
    id: 'recovery', title: 'Recover a change', view: 'changes',
    goal: 'Unstage an RT edit without losing it, then commit it and undo that commit with revert.',
    explanation: 'Unstage preserved the working edit. Revert added a new commit that reversed the saved edit and preserved the original commit.',
    steps(repo, recovery) {
      const head = repo.head;
      const original = head.reverts ? repo.commitAt(head.reverts) : head;
      const base = repo.commitAt(recovery?.base);
      const committed = base && original.parents[0] === base.id && original.snapshot.rule === recovery.rule;
      const reverted = committed && head.reverts === original.id && head.snapshot.rule === base.snapshot.rule;
      const pending = repo.working.rule !== head.snapshot.rule;
      const restaged = repo.staged.includes('rule') && repo.index.rule === recovery?.rule;
      return [
        step(pending || repo.staged.includes('rule') || recovery, 'Edit the rule', 'Save any minimum RT different from the current value in analysis.toml.'),
        step(repo.staged.includes('rule') || recovery, 'Stage the edit', 'Stage analysis.toml.', 'changes', addRule),
        step(recovery, 'Unstage and inspect', 'Unstage analysis.toml. Check that the edited value is still under Unstaged.', 'changes', restoreRule),
        step(committed || restaged, 'Stage it again', recovery && repo.working.rule !== recovery.rule
          ? `Restore your ${recovery.rule} s working edit and stage analysis.toml again.`
          : 'Stage analysis.toml again.', 'changes', addRule),
        step(committed, 'Commit the edit', 'Record the staged rule in a commit.', 'changes', commitRule),
        step(reverted, 'Revert the commit', 'Revert the latest commit, then inspect both commits in Branches.', 'changes', 'git revert HEAD')
      ];
    }
  }
];

export function startMission(mission) {
  const repo = new GitModel();
  mission.setup?.(repo);
  return {mission, repo, recovery: null};
}

export function runMissionAction(session, action) {
  const {repo, mission} = session;
  const before = {head: repo.head, branch: repo.current, staged: repo.staged.includes('rule'), rule: repo.working.rule};
  const output = action(repo);
  if (mission.id === 'recovery' && before.staged && repo.head === before.head &&
    repo.current === before.branch && !repo.staged.includes('rule') &&
    repo.working.rule === before.rule && repo.unstaged.includes('rule')) {
    session.recovery = {base: before.head.id, rule: before.rule};
  }
  return output;
}

export function missionProgress({mission, repo, recovery}) {
  const steps = mission.steps(repo, recovery);
  const next = steps.find(item => !item.done);
  return {steps, next, complete: !next};
}
