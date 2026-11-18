import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GitModel} from '../site/assets/git-model.js';
import {executeCommand as run,diff} from '../site/assets/git-commands.js';
import {missions, missionProgress, startMission, runMissionAction} from '../site/assets/git-missions.js';
const lesson = id => startMission(missions.find(mission => mission.id === id));
const act = (session, command) => runMissionAction(session, repo => run(repo, command));
const save=(m,key,value)=>{m.setFile(key,value);m.stage([key]);m.commit(`Update ${key}`);};
const feature=()=>{const m=new GitModel();m.branch('criteria');save(m,'rule','0.30');return m;};
const conflict=()=>{const m=feature();m.switchBranch('main');save(m,'rule','0.25');m.merge('criteria');return m;};
test('selective stage isolates scientific policy from cosmetic working edits',()=>{
 const session=lesson('staging'),m=session.repo;m.setFile('rule','.50');m.setFile('plot','purple');run(m,'git add config/analysis.toml');
 assert.match(diff(m,true),/0.50/);assert.doesNotMatch(diff(m,true),/purple/);assert.match(diff(m),/purple/);
 run(m,'git commit -m "Compare RT policy"');assert(missionProgress(session).complete);assert.equal(m.remote.main,'c0');
});
test('later edits to a staged file show MM and preserve the earlier staged value',()=>{
 const m=new GitModel();m.setFile('rule','.30');m.stage(['rule']);m.setFile('rule','.50');assert.match(run(m,'git status --short'),/MM config/);
 m.commit();assert.equal(m.head.snapshot.rule,'0.30');assert.equal(m.working.rule,'0.50');
});
test('unstage preserves edits; discard restores index rather than HEAD',()=>{
 const m=new GitModel();m.setFile('rule','.30');m.stage();m.setFile('rule','.50');m.discard('rule');assert.equal(m.working.rule,'0.30');
 run(m,'git restore --staged config/analysis.toml');assert.equal(m.working.rule,'0.30');assert.equal(m.index.rule,'0.20');
 m.discard('rule');assert.equal(m.working.rule,'0.20');
});
test('a resolution choosing ours must still be explicitly staged',()=>{
 const session=lesson('conflict'),m=session.repo;m.merge('criteria');const before=m.head.id;m.resolveWorking({rule:'0.25'});assert.throws(()=>m.commit(),/stage/);assert.equal(m.head.id,before);
 m.stage(['plot']);assert.throws(()=>m.commit(),/stage/);m.stage(['rule']);m.commit('Keep the existing threshold');assert(missionProgress(session).complete);
});
test('changing the resolution after staging makes another stage necessary',()=>{
 const m=conflict();m.resolveWorking({rule:'0.30'});m.stage(['rule']);m.resolveWorking({rule:'0.25'});assert.throws(()=>m.commit(),/stage/);
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
 const session=lesson('remote'),m=session.repo;assert.throws(()=>m.openPR(),/Push/);run(m,'git push -u origin criteria');m.openPR();assert.throws(()=>m.mergePR(),/Review/);m.reviewPR();m.mergePR();
 assert.equal(m.branches.main,'c0');assert.equal(m.tracking.main,'c0');assert.notEqual(m.remote.main,'c0');m.switchBranch('main');m.pull();assert(missionProgress(session).complete);
});
test('a new source push invalidates the reviewed source tip',()=>{
 const m=feature();run(m,'git push -u origin criteria');m.openPR();m.reviewPR();save(m,'rule','.50');m.push();assert.throws(()=>m.mergePR(),/stale/);
 m.reviewPR();m.mergePR();assert.equal(m.commits.find(c=>c.id===m.remote.main).snapshot.rule,'0.50');
});
test('a new target commit invalidates review and can combine independent edits',()=>{
 const m=feature();run(m,'git push -u origin criteria');m.openPR();m.reviewPR();m.colleague();assert.throws(()=>m.mergePR(),/stale/);m.reviewPR();m.mergePR();
 assert.deepEqual(m.commits.find(c=>c.id===m.remote.main).snapshot,{rule:'0.30',plot:'orange'});
});
test('PR conflicts refuse server merge without moving remote main',()=>{
 const m=feature();run(m,'git push -u origin criteria');m.openPR();m.colleague('rule','0.25');m.reviewPR();const tip=m.remote.main;
 assert.throws(()=>m.mergePR(),/conflict/);assert.equal(m.remote.main,tip);assert.equal(m.pullRequest.merged,false);
});
test('revert preserves original history and earns recovery after a real unstage', () => {
 const session=lesson('recovery'),m=session.repo;
 m.setFile('rule','.50');
 act(session,'git add config/analysis.toml');
 act(session,'git restore --staged -- config/analysis.toml');
 assert.equal(m.working.rule,'0.50');
 assert.equal(missionProgress(session).next.label,'Stage it again');
 act(session,'git add .');
 act(session,'git commit -m "Alternative policy"');
 const original=m.head.id;
 act(session,'git revert HEAD');
 assert.equal(m.head.reverts,original);
 assert.equal(m.commits.length,3);
 assert(missionProgress(session).complete);
});

test('recovery rejects no-op unstaging, failed commands and a message that only says revert', () => {
 const session=lesson('recovery'),m=session.repo;
 m.setFile('rule','.50');
 act(session,'git restore --staged config/analysis.toml');
 act(session,'git add .');
 assert.throws(()=>act(session,'git restore --staged missing.toml'), /Unknown path/);
 act(session,'git restore --staged src/experiment/plotting.py');
 assert.equal(missionProgress(session).next.label,'Unstage and inspect');
 act(session,'git commit -m "Revert HEAD"');
 act(session,'git revert HEAD');
 assert.equal(session.recovery,null);
 assert.equal(missionProgress(session).complete,false);
});
test('supported command parsing handles quoted messages and refuses shell syntax',()=>{
 const m=new GitModel();m.setFile('rule','.30');run(m,'git add config/analysis.toml');run(m,'git commit -m "Compare an alternative RT rule"');assert.equal(m.head.message,'Compare an alternative RT rule');
 for(const command of ['rm -rf anything','git status; echo bad','git add private.csv','git push --force','git pull','git reset --hard'])assert.throws(()=>run(m,command));
});
test('mission 2 checks actual merge state rather than a sequence of clicks',()=>{
 const session=lesson('branches'),m=session.repo;
 run(m,'git checkout -b feature/rt-policy');save(m,'rule','0.30');
 assert.equal(missionProgress(session).complete,false);m.switchBranch('main');save(m,'plot','purple');
 m.merge('feature/rt-policy');assert(missionProgress(session).complete);
});

test('short status and diff options match the staged and unstaged file versions', () => {
 const m=new GitModel();
 assert.equal(run(m,'git status --short'),'');
 assert.equal(run(m,'git status -sb'),'## main...origin/main');
 m.setFile('rule','0.30');
 run(m,'git add -- config/analysis.toml');
 m.setFile('rule','0.50');
 m.setFile('plot','orange');
 assert.equal(run(m,'git status -sb'), '## main...origin/main\nMM config/analysis.toml\n M src/experiment/plotting.py');
 assert.match(run(m,'git diff --cached -- config/analysis.toml'), /min_rt_s = 0\.30/);
 assert.match(run(m,'git diff config/analysis.toml'), /min_rt_s = 0\.50/);
 assert.equal(run(m,'git diff --staged -- src/experiment/plotting.py'),'');
 assert.throws(()=>run(m,'git add . missing.txt'),/Unknown path/);
 assert.deepEqual(m.staged,['rule']);
});

test('branch without switch and checkout aliases share model state', () => {
 const m = new GitModel();
 assert.equal(run(m,'git branch'), '* main');
 run(m,'git branch criteria');
 assert.equal(m.current,'main');
 run(m,'git checkout criteria');
 assert.match(run(m,'git branch -a'), /\* criteria[\s\S]*remotes\/origin\/main/);
 run(m,'git checkout -b feature/next');
 assert.equal(m.current,'feature/next');
});

test('first push sets upstream only when asked and fetch remains distinct from pull', () => {
 const m=feature();
 assert.throws(()=>run(m,'git push'), /git push -u origin criteria/);
 run(m,'git push origin criteria');
 assert.throws(()=>run(m,'git push'), /No upstream/);
 run(m,'git push --set-upstream origin criteria');
 assert.match(run(m,'git status -sb'), /criteria\.\.\.origin\/criteria/);
 save(m,'rule','0.50');
 assert.match(run(m,'git status -sb'), /ahead 1/);
 run(m,'git push');
 assert.equal(m.remote.criteria,m.head.id);
 m.switchBranch('main');
 m.colleague();
 run(m,'git fetch origin');
 assert.match(run(m,'git status -sb'), /behind 1/);
 run(m,'git pull --ff-only origin main');
 assert.equal(m.head.id,m.remote.main);
});

test('an unresolved file blocks stage-all, then remains unmerged until explicitly staged', () => {
 const m=feature();
 m.setFile('plot','purple');m.stage();m.commit('Set purple');
 m.switchBranch('main');
 save(m,'rule','0.25');
 m.merge('criteria');
 assert.deepEqual(m.staged,['plot']);
 assert.match(run(m,'git status --short'), /UU config\/analysis.toml/);
 assert.throws(()=>run(m,'git add .'), /Write a resolution/);
 m.resolveWorking({rule:'0.25'});
 assert.match(run(m,'git status --short'), /UU config\/analysis.toml/);
 run(m,'git add config/analysis.toml');
 assert.doesNotMatch(run(m,'git status --short'), /UU/);
 run(m,'git commit -m "Retain the minimum; include the figure update"');
 assert.deepEqual(m.head.snapshot,{rule:'0.25',plot:'purple'});
});

test('pull request compares the source to the merge base and freezes its diff after merge', () => {
 const session=lesson('remote'),m=session.repo;
 run(m,'git push -u origin criteria');m.openPR();m.reviewPR();
 m.colleague();
 assert.equal(missionProgress(session).next.label,'Review the proposed diff');
 assert.equal(m.prComparison.base,'c0');
 assert.equal(m.prComparison.target,m.remote.main);
 assert.deepEqual(m.prComparison.changes,[{key:'rule',before:'0.20',after:'0.50'}]);
 m.reviewPR();
 const reviewed=m.prComparison;
 m.mergePR();
 m.colleague('rule','0.70');
 assert.deepEqual(m.prComparison,reviewed);
});

test('mission starting states and restart are independent', () => {
 const staging=lesson('staging'),conflict=lesson('conflict'),remote=lesson('remote');
 assert.equal(staging.repo.head.id,'c0');
 assert.deepEqual(conflict.repo.branches,{main:'c2',criteria:'c1'});
 assert.equal(remote.repo.current,'criteria');
 assert.equal(remote.repo.remote.main,'c0');
 assert.equal(remote.repo.head.id,'c1');
 act(conflict,'git merge criteria');
 act(conflict,'git merge --abort');
 assert.equal(missionProgress(conflict).next.label,'Merge criteria into main');
 staging.repo.setFile('rule','0.50');
 assert.equal(lesson('staging').repo.working.rule,'0.20');
 assert.equal(staging.repo.working.rule,'0.50');
});
