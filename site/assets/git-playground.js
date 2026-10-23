import {GitModel} from './git-model.js';
import {files,status,diff,executeCommand,missions} from './git-commands.js';
const root=document.querySelector('[data-git-dojo]');
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
if(root){
 const q=s=>root.querySelector(s);let model=new GitModel(),events=[],selected='c0',mission=missions[0];
 function log(command,text){events.push(command);q('[data-command-log]').textContent+=`> ${command}\n${text}\n\n`;q('[data-command-log]').scrollTop=q('[data-command-log]').scrollHeight;}
 function perform(command,callback){try{const text=callback?callback():executeCommand(model,command);log(command,text);q('[data-git-feedback]').textContent=text;}catch(error){log(command,`Stopped: ${error.message}`);q('[data-git-feedback]').textContent=error.message;}render();}
 function snapshot(value){return `# config/analysis.toml\nmin_rt_s = ${value.rule}\nmax_rt_s = 2.00\n\n# src/experiment/plotting.py\ncolor = "${value.plot}"`;}
 function render(){
   q('[data-dojo-head]').textContent=`HEAD → ${model.current} → ${model.head.id}`;
   q('[data-working-snapshot]').textContent=snapshot(model.working);q('[data-index-snapshot]').textContent=snapshot(model.index);q('[data-head-snapshot]').textContent=snapshot(model.head.snapshot);
   q('[data-dojo-status]').textContent=status(model);q('[data-unstaged-diff]').textContent=diff(model);q('[data-staged-diff]').textContent=diff(model,true);
   const branchSelect=q('[data-switch-target]'),mergeSelect=q('[data-merge-target]');
   const old=mergeSelect.value;branchSelect.replaceChildren();mergeSelect.replaceChildren();
   for(const name of Object.keys(model.branches)){
     const option=document.createElement('option');option.value=name;option.textContent=name;branchSelect.append(option);if(name!==model.current)mergeSelect.append(option.cloneNode(true));
   }
   branchSelect.value=model.current;if([...mergeSelect.options].some(o=>o.value===old))mergeSelect.value=old;
   const reachable=new Set();for(const tip of [...Object.values(model.branches),...Object.values(model.tracking)])for(const id of model.ancestors(tip))reachable.add(id);
   const visible=model.commits.filter(c=>reachable.has(c.id));const lanes=['main',...Object.keys(model.branches).filter(b=>b!=='main'),'origin/main'];
   const width=Math.max(580,visible.length*105+90),height=Math.max(180,lanes.length*65+30);
   const point=c=>({x:55+visible.indexOf(c)*105,y:40+Math.max(0,lanes.indexOf(c.branch))*65});
   const edges=visible.flatMap(c=>c.parents.map(id=>{const p=point(model.commits.find(n=>n.id===id)),n=point(c);return `<path d="M ${p.x} ${p.y} C ${p.x+40} ${p.y},${n.x-40} ${n.y},${n.x} ${n.y}"/>`;})).join('');
   const nodes=visible.map(c=>{const p=point(c);const labels=[...Object.entries(model.branches).filter(([,id])=>id===c.id).map(([name])=>name+(name===model.current?' ← HEAD':'')),...Object.entries(model.tracking).filter(([,id])=>id===c.id).map(([name])=>`origin/${name}`)];return `<g><circle cx="${p.x}" cy="${p.y}" r="9" fill="${c.branch==='main'?'#167568':'#ad623f'}"/><text x="${p.x}" y="${p.y+24}" text-anchor="middle">${c.id}</text><text x="${p.x}" y="${p.y-17}" text-anchor="${p.x<100?'start':'middle'}">${escape(labels.join(' · '))}</text></g>`;}).join('');
   q('[data-dojo-graph]').innerHTML=`<svg viewBox="0 0 ${width} ${height}" style="width:${width}px;height:${height}px" aria-hidden="true">${edges}${nodes}</svg>`;
   q('[data-commit-list]').innerHTML=[...visible].reverse().map(c=>`<li><button type="button" data-inspect="${c.id}">${escape(`${c.id} · ${c.message}`)}</button> <small>parents ${escape(c.parents.join(', ')||'none')}</small></li>`).join('');
   const inspected=model.commits.find(c=>c.id===selected)||model.head;
   q('[data-inspected-commit]').textContent=`${inspected.id} · ${inspected.message}\nParents: ${inspected.parents.join(', ')||'none'}\n${snapshot(inspected.snapshot)}`;
   q('[data-remote-refs]').textContent=`SERVER origin\n${Object.entries(model.remote).map(([b,id])=>`${b} → ${id}`).join('\n')}\n\nLOCAL remote-tracking references (last fetch/push)\n${Object.entries(model.tracking).map(([b,id])=>`origin/${b} → ${id}`).join('\n')}\n\nA server change does not move your local branch.`;
   const pr=model.pullRequest;
   if(pr){const source=model.commits.find(c=>c.id===model.remote[pr.source]),target=model.commits.find(c=>c.id===model.remote.main);q('[data-pr-diff]').textContent=`${pr.merged?'MERGED':'OPEN'} · ${pr.source} → main\nCurrent source ${source.id}; target ${target.id}\nReviewed source ${pr.reviewedHead||'none'}; target ${pr.reviewedBase||'none'}\n\n${Object.keys(files).filter(k=>source.snapshot[k]!==target.snapshot[k]).map(k=>`${files[k]}: ${target.snapshot[k]} → ${source.snapshot[k]}`).join('\n')||'No snapshot differences at current tips.'}`;}else q('[data-pr-diff]').textContent='No simulated pull request. Push a feature branch, then open one.';
   q('[data-dojo-conflict]').hidden=!model.conflict;
   if(model.conflict){q('[data-conflict-markers]').textContent=model.conflict.keys.map(k=>`${files[k]}\n<<<<<<< ${model.current}\n${model.conflict.ours[k]}\n=======\n${model.conflict.theirs[k]}\n>>>>>>> incoming branch`).join('\n\n');}
 }
 function selectMission(id){mission=missions.find(m=>m.id===id)||missions[0];model=new GitModel();events=[];selected='c0';q('[data-mission-goal]').textContent=mission.goal;q('[data-mission-hint]').textContent=mission.hint;delete q('[data-mission-check]').dataset.state;q('[data-mission-check]').textContent='Not checked yet. Predict, act, inspect, then explain.';q('[data-command-log]').textContent='';q('[data-git-feedback]').textContent='Sandbox reset to the cloned baseline. All activity is simulated.';if(mission.id==='remote')q('[data-remote-panel]').open=true;render();root.dispatchEvent(new CustomEvent('workshop:git-mission',{detail:{id:mission.id}}));}
 const missionNames={staging:'1 · Stage one change',branches:'2 · Branch & merge',conflict:'3 · Resolve a conflict',remote:'4 · Share & review',recovery:'5 · Recover a change'};
 q('[data-git-mission]').innerHTML=missions.map(m=>`<option value="${m.id}">${missionNames[m.id]}</option>`).join('');
 q('[data-git-mission]').addEventListener('change',e=>selectMission(e.target.value));
 root.addEventListener('submit',e=>{e.preventDefault();if(e.target.matches('[data-command-form]')){const input=q('[data-command-input]');perform(input.value);input.value='';}});
 root.addEventListener('click',e=>{
   const b=e.target.closest('button');if(!b)return;
   if(b.dataset.inspect){selected=b.dataset.inspect;render();return;}
   if(b.dataset.command){perform(b.dataset.command);return;}
   switch(b.dataset.gitAction){
    case 'rule':perform('edit config/analysis.toml',()=>model.setFile('rule',q('[data-rule-value]').value));break;
    case 'plot':perform('edit src/experiment/plotting.py',()=>model.setFile('plot',q('[data-plot-value]').value));break;
    case 'stage':perform(`git add ${q('[data-stage-file]').value}`);break;
    case 'unstage':perform(`git restore --staged ${q('[data-stage-file]').value}`);break;
    case 'discard':{const key=q('[data-stage-file]').value;if(key==='.')q('[data-git-feedback]').textContent='Choose one file before discarding its unstaged changes.';else perform(`git restore ${key}`);break;}
    case 'commit':perform(`git commit -m ${JSON.stringify(q('[data-commit-message]').value||'Describe the scientific change')}`);break;
    case 'branch':perform(`git switch -c ${q('[data-branch-name]').value}`);break;
    case 'switch':perform(`git switch ${q('[data-switch-target]').value}`);break;
    case 'merge':perform(`git merge ${q('[data-merge-target]').value}`);break;
    case 'resolve':perform('write resolved working file',()=>model.resolveWorking({rule:Number(q('[data-resolution-rule]').value).toFixed(2),plot:q('[data-resolution-plot]').value}));break;
    case 'colleague':perform('labmate commits on origin/main',()=>model.colleague());break;
    case 'open-pr':perform('open simulated pull request',()=>model.openPR());break;
    case 'review-pr':perform('review the current source and target tips',()=>model.reviewPR());break;
    case 'merge-pr':perform('merge reviewed pull request on origin',()=>model.mergePR());break;
    case 'check':q('[data-mission-check]').dataset.state=mission.check(model,events)?'passed':'error';q('[data-mission-check]').textContent=mission.check(model,events)?`Passed · ${mission.explanation}\nExplain this to your partner before the next mission.`:`Not yet. ${mission.goal}\nInspect status, the two diffs, and the branch pointers.`;break;
    case 'reset':selectMission(mission.id);break;
   }
 });
 const initial=new URLSearchParams(location.search).get('mission')||'staging';q('[data-git-mission]').value=missions.some(m=>m.id===initial)?initial:'staging';selectMission(initial);
}
