import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GitModel} from '../site/assets/git-model.js';
const save = (m, key) => {m.edit(key); m.stage(); m.commit();};

test('commit snapshots the index while preserving edits made after staging', () => {
  const m = new GitModel(); m.edit('rule'); m.stage(); m.edit('plot'); m.commit();
  assert.equal(m.head.snapshot.rule,'0.25'); assert.equal(m.head.snapshot.plot,'teal');
  assert.equal(m.working.plot,'purple'); assert.deepEqual(m.unstaged,['plot']);
  assert.deepEqual(m.staged,[]);
});
test('commit requires a staged change', () => {
  const m = new GitModel(); m.edit('rule'); assert.throws(() => m.commit(), /Nothing staged/);
});
test('branch creation moves HEAD without making a commit', () => {
  const m = new GitModel(); m.branch();
  assert.equal(m.current,'criteria'); assert.equal(m.commits.length,1);
  assert.equal(m.branches.criteria,m.branches.main);
});
test('branch and switch require clean work in this bounded model', () => {
  const m = new GitModel(); m.edit('rule'); assert.throws(() => m.branch(), /Commit/);
  m.stage(); m.commit(); m.branch(); m.edit('plot'); assert.throws(() => m.switchBranch(), /Commit/);
});
test('fast-forward advances main without inventing a merge commit', () => {
  const m = new GitModel(); m.branch(); save(m,'rule'); m.switchBranch();
  assert.match(m.merge(), /Fast-forward/); assert.equal(m.commits.length,2);
  assert.equal(m.branches.main,m.branches.criteria); assert.equal(m.head.snapshot.rule,'0.30');
  assert.match(m.merge(), /Already up to date/);
});
test('three-way merge retains changes from separate files with two parents', () => {
  const m = new GitModel(); m.branch(); save(m,'rule'); m.switchBranch(); save(m,'plot');
  const oldMain=m.head.id; const feature=m.branches.criteria; m.merge();
  assert.deepEqual(m.head.parents,[oldMain,feature]);
  assert.deepEqual(m.head.snapshot,{rule:'0.30',plot:'purple'}); assert.equal(m.dirty,false);
});
test('conflicting edits stop branch advancement until resolved', () => {
  const m = new GitModel(); m.branch(); save(m,'rule'); m.switchBranch(); save(m,'rule');
  const oldHead=m.head.id; assert.match(m.merge(), /Merge stopped/);
  assert.equal(m.head.id,oldHead); assert.equal(m.commits.length,3);
  assert.throws(() => m.commit(), /Resolve or abort/);
  m.resolve('0.25'); assert.equal(m.head.snapshot.rule,'0.25');
  assert.equal(m.head.parents.length,2); assert.equal(m.conflict,null);
});
test('abort preserves the pre-merge branch snapshot and history', () => {
  const m = new GitModel(); m.branch(); save(m,'rule'); m.switchBranch(); save(m,'rule');
  const oldHead=m.head.id; m.merge(); m.abort();
  assert.equal(m.head.id,oldHead); assert.equal(m.commits.length,3);
  assert.equal(m.dirty,false); assert.equal(m.conflict,null);
});
test('identical edits on diverged branches merge without a conflict', () => {
  const m = new GitModel(); m.branch(); save(m,'plot'); m.switchBranch(); save(m,'plot');
  m.merge(); assert.equal(m.conflict,null); assert.equal(m.head.parents.length,2);
});
test('a changed merge base is used after an earlier merge', () => {
  const m = new GitModel(); m.branch(); save(m,'rule'); m.switchBranch(); m.merge();
  save(m,'plot'); m.switchBranch(); m.edit('rule'); m.stage(); m.commit(); m.switchBranch();
  m.merge(); assert.equal(m.conflict,null); assert.deepEqual(m.head.snapshot,{rule:'0.20',plot:'purple'});
});
