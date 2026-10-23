import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GitModel} from '../site/assets/git-model.js';
import {executeCommand as run,status,diff,missions} from '../site/assets/git-commands.js';
const save=(m,key,value)=>{m.setFile(key,value);m.stage([key]);m.commit(`Update ${key}`);};
const feature=()=>{const m=new GitModel();m.branch('criteria');save(m,'rule','0.30');return m;};
const conflict=()=>{const m=feature();m.switchBranch('main');save(m,'rule','0.25');m.merge('criteria');return m;};
test('selective stage isolates scientific policy from cosmetic working edits',()=>{
 const m=new GitModel();m.setFile('rule','.50');m.setFile('plot','purple');run(m,'git add config/analysis.toml');
 assert.match(diff(m,true),/0.50/);assert.doesNotMatch(diff(m,true),/purple/);assert.match(diff(m),/purple/);
 run(m,'git commit -m "Compare RT policy"');assert(missions[0].check(m));assert.equal(m.remote.main,'c0');
});
test('later edits to a staged file show MM and preserve the earlier staged value',()=>{
 const m=new GitModel();m.setFile('rule','.30');m.stage(['rule']);m.setFile('rule','.50');assert.match(status(m),/MM config/);
 m.commit();assert.equal(m.head.snapshot.rule,'0.30');assert.equal(m.working.rule,'0.50');
});
test('unstage preserves edits; discard restores index rather than HEAD',()=>{
 const m=new GitModel();m.setFile('rule','.30');m.stage();m.setFile('rule','.50');m.discard('rule');assert.equal(m.working.rule,'0.30');
 run(m,'git restore --staged config/analysis.toml');assert.equal(m.working.rule,'0.30');assert.equal(m.index.rule,'0.20');
 m.discard('rule');assert.equal(m.working.rule,'0.20');
});
test('a resolution choosing ours must still be explicitly staged',()=>{
 const m=conflict(),before=m.head.id;m.resolveWorking({rule:'0.25'});assert.throws(()=>m.commit(),/staged/);assert.equal(m.head.id,before);
 m.stage(['plot']);assert.throws(()=>m.commit(),/staged/);m.stage(['rule']);m.commit('Resolve RT conflict');assert(missions[2].check(m));
});
test('changing the resolution after staging makes another stage necessary',()=>{
 const m=conflict();m.resolveWorking({rule:'0.30'});m.stage(['rule']);m.resolveWorking({rule:'0.25'});assert.throws(()=>m.commit(),/staged/);
 m.stage(['rule']);m.commit();assert.equal(m.head.snapshot.rule,'0.25');
});
test('named branches merge into the current branch without moving others',()=>{
 const m=new GitModel();m.branch('policy');save(m,'rule','.30');m.switchBranch('main');m.branch('figure');save(m,'plot','purple');m.merge('policy');
 assert.deepEqual(m.head.snapshot,{rule:'0.30',plot:'purple'});assert.equal(m.branches.main,'c0');assert.equal(m.current,'figure');
});
test('fetch changes knowledge, pull changes the checked-out snapshot',()=>{
 const m=new GitModel();m.colleague();const remote=m.remote.main;assert.equal(m.tracking.main,'c0');assert.equal(m.head.id,'c0');
 run(m,'git fetch origin');assert.equal(m.tracking.main,remote);assert.equal(m.head.id,'c0');assert.equal(m.working.plot,'teal');
 run(m,'git pull --ff-only');assert.equal(m.head.id,remote);assert.equal(m.working.plot,'orange');
});
test('divergent histories reject push and fast-forward pull without losing work',()=>{
 const m=new GitModel();save(m,'rule','.30');const local=m.head.id;m.colleague();assert.throws(()=>m.push(),/rejected/);assert.throws(()=>m.pull(),/diverged/);
 assert.equal(m.head.id,local);assert.equal(m.working.rule,'0.30');assert.equal(m.tracking.main,m.remote.main);
});
test('a PR requires a pushed feature and explicit review',()=>{
 const m=feature();assert.throws(()=>m.openPR(),/Push/);m.push();m.openPR();assert.throws(()=>m.mergePR(),/Review/);m.reviewPR();m.mergePR();
 assert.equal(m.branches.main,'c0');assert.equal(m.tracking.main,'c0');assert.notEqual(m.remote.main,'c0');m.switchBranch('main');m.pull();assert(missions[3].check(m));
});
test('a new source push invalidates the reviewed source tip',()=>{
 const m=feature();m.push();m.openPR();m.reviewPR();save(m,'rule','.50');m.push();assert.throws(()=>m.mergePR(),/stale/);
 m.reviewPR();m.mergePR();assert.equal(m.commits.find(c=>c.id===m.remote.main).snapshot.rule,'0.50');
});
test('a new target commit invalidates review and can combine independent edits',()=>{
 const m=feature();m.push();m.openPR();m.reviewPR();m.colleague();assert.throws(()=>m.mergePR(),/stale/);m.reviewPR();m.mergePR();
 assert.deepEqual(m.commits.find(c=>c.id===m.remote.main).snapshot,{rule:'0.30',plot:'orange'});
});
test('PR conflicts refuse server merge without moving remote main',()=>{
 const m=feature();m.push();m.openPR();m.colleague('rule','0.25');m.reviewPR();const tip=m.remote.main;
 assert.throws(()=>m.mergePR(),/conflict/);assert.equal(m.remote.main,tip);assert.equal(m.pullRequest.merged,false);
});
test('revert preserves original history and recovery mission is earned',()=>{
 const m=new GitModel(),events=[];m.setFile('rule','.50');m.stage();events.push('git restore --staged config/analysis.toml');run(m,events[0]);
 assert.equal(m.working.rule,'0.50');m.stage();m.commit('Alternative policy');const original=m.head.id;run(m,'git revert HEAD');
 assert.equal(m.head.parents[0],original);assert.equal(m.commits.length,3);assert(missions[4].check(m,events));
});
test('supported command parsing handles quoted messages and refuses shell syntax',()=>{
 const m=new GitModel();m.setFile('rule','.30');run(m,'git add config/analysis.toml');run(m,'git commit -m "Compare an alternative RT rule"');assert.equal(m.head.message,'Compare an alternative RT rule');
 for(const command of ['rm -rf anything','git status; echo bad','git add private.csv','git push --force','git pull','git reset --hard'])assert.throws(()=>run(m,command));
});
test('mission 2 checks actual merge state rather than a sequence of clicks',()=>{
 const m=feature();assert.equal(missions[1].check(m),false);m.switchBranch('main');save(m,'plot','purple');m.merge();assert(missions[1].check(m));
});
