export const files={rule:'config/analysis.toml',plot:'src/experiment/plotting.py'};
export function fileKeys(paths){
 if(!paths.length)throw new Error('Specify a file path or .');
 if(paths.length===1&&paths[0]==='.')return ['rule','plot'];
 return paths.map(path=>{const key=Object.keys(files).find(k=>files[k]===path||k===path);if(!key)throw new Error(`This model has two teaching files; unknown path: ${path}`);return key;});
}
export function status(model){
 return `On branch ${model.current}\n`+Object.keys(files).map(key=>`${model.conflict?.keys.includes(key)&&!model.conflict.staged?'UU':`${model.staged.includes(key)?'M':' '}${model.unstaged.includes(key)?'M':' '}`} ${files[key]}`).join('\n')+(!model.dirty&&!model.conflict?'\nWorking tree clean.':'');
}
export function diff(model,staged=false){
 const changes=model.diff(staged);
 return changes.length?changes.map(c=>`${files[c.key]}\n--- ${staged?'HEAD':'index'}\n+++ ${staged?'index':'working file'}\n- ${c.before}\n+ ${c.after}`).join('\n\n'):'No differences in this comparison.';
}
export function executeCommand(model,command){
 if(/[;|`\n]/.test(command))throw new Error('This is a bounded Git simulator, not a shell. Run one supported command at a time.');
 const tokens=command.match(/"(?:[^"\\]|\\.)*"|'[^']*'|[^\s]+/g)||[];
 const args=tokens.map(t=>t.startsWith('"')?JSON.parse(t):t.startsWith("'")?t.slice(1,-1):t);
 if(args.shift()!=='git')throw new Error('Start with git. This console does not execute operating-system commands.');
 const verb=args.shift();
 switch(verb){
  case 'status': if(args.length)throw new Error('Use git status without extra arguments in this console.');return status(model);
  case 'diff': if(args.some(a=>a!=='--staged'))throw new Error('Use git diff or git diff --staged.');return diff(model,args.includes('--staged'));
  case 'add': return model.stage(fileKeys(args));
  case 'commit': if(args.length!==2||args[0]!=='-m'||!args[1].trim())throw new Error('Use git commit -m "A meaningful message"');return model.commit(args[1]);
  case 'switch': if(args[0]==='-c'&&args.length===2)return model.branch(args[1]);if(args.length===1)return model.switchBranch(args[0]);throw new Error('Use git switch NAME or git switch -c NAME.');
  case 'merge': if(args.length===1&&args[0]==='--abort')return model.abort();if(args.length===1)return model.merge(args[0]);throw new Error('Use git merge BRANCH.');
  case 'fetch': if(args.length>1||args.length&&args[0]!=='origin')throw new Error('The simulated remote is origin.');return model.fetch();
  case 'pull': if(args.join(' ')!=='--ff-only')throw new Error('Use git pull --ff-only; this model does not silently choose a merge or rebase policy.');return model.pull();
  case 'push': {
   if(args[0]==='-u')args.shift();
   if(args.length&&args.shift()!=='origin')throw new Error('The simulated remote is origin; force push is not supported.');
   if(args.length>1)throw new Error('Use git push -u origin BRANCH.');return model.push(args[0]||model.current);
  }
  case 'restore': if(args[0]==='--staged'){args.shift();return model.unstage(fileKeys(args));}if(args.length===1)return model.discard(fileKeys(args)[0]);throw new Error('Use git restore PATH or git restore --staged PATH.');
  case 'revert': if(args.join(' ')==='HEAD')return model.revert();throw new Error('This exercise supports git revert HEAD for a single-parent commit.');
  case 'log': {
   if(args.some(a=>!['--oneline','--graph','--all'].includes(a)))throw new Error('Supported flags: --oneline --graph --all.');
   const reachable=new Set();for(const id of args.includes('--all')?[...Object.values(model.branches),...Object.values(model.tracking)]:[model.head.id])for(const ancestor of model.ancestors(id))reachable.add(ancestor);
   return [...model.commits].reverse().filter(c=>reachable.has(c.id)).map(c=>`${c.id} ${c.message} [parents: ${c.parents.join(', ')||'none'}]`).join('\n');
  }
  default: throw new Error('Supported: status, diff, add, commit, switch, merge, fetch, pull --ff-only, push, restore, log, revert HEAD.');
 }
}
export const missions=[
 {id:'staging',title:'1 · Commit only the scientific change',goal:'Change the rule to 0.50 and the plot to purple. Stage and commit only the rule. Leave the plot unstaged.',hint:'Use git add config/analysis.toml, then inspect git diff --staged and git diff before committing.',explanation:'A commit records the index, not every saved file. A focused policy change is easier to review than a mixed scientific and cosmetic edit.',check:m=>m.head.snapshot.rule==='0.50'&&m.head.snapshot.plot==='teal'&&m.working.plot==='purple'&&m.unstaged.includes('plot')},
 {id:'branches',title:'2 · Combine independent work',goal:'Create criteria, commit a rule of 0.30 there, then switch to main and commit a purple plot. Merge criteria into main.',hint:'Create criteria before either branch changes. Commit each edit before switching. The two branches should diverge from the baseline.',explanation:'The merge base explains what each branch changed. Separate-file changes can combine into a two-parent merge; both scientific and visual results still need review.',check:m=>m.current==='main'&&m.head.parents.length===2&&m.head.snapshot.rule==='0.30'&&m.head.snapshot.plot==='purple'},
 {id:'conflict',title:'3 · Resolve, stage, then commit',goal:'Create criteria and commit rule 0.30. On main commit rule 0.25. Merge criteria, inspect the conflicting versions, write a resolution, stage it, and commit the merge.',hint:'A written resolution is not yet a staged resolution. Inspect the conflict panel, then use git add config/analysis.toml and git commit.',explanation:'Git cannot choose the scientific policy for you. Removing conflict markers, testing the decision, staging, and committing are distinct steps.',check:m=>m.current==='main'&&!m.conflict&&m.head.parents.length===2&&/conflict|resolve/i.test(m.head.message)},
 {id:'remote',title:'4 · Share, review, merge, synchronize',goal:'Create criteria, change and commit the rule, push criteria, open a PR, inspect its diff and record review, merge on the server, then switch to main and pull --ff-only.',hint:'Push does not open a PR. A server merge does not move local main. Open the Remote & review panel to review the exact branch tips.',explanation:'Local branches, remote branches, and remote-tracking pointers are distinct. Review can become stale when either proposed or target history changes.',check:m=>Boolean(m.pullRequest?.merged)&&m.current==='main'&&m.head.id===m.remote.main&&m.tracking.main===m.remote.main},
 {id:'recovery',title:'5 · Recover without erasing history',goal:'Edit and stage the rule. Unstage it and confirm the working edit remains. Commit it with a meaningful message, then revert HEAD.',hint:'git restore --staged config/analysis.toml preserves working edits. After the commit, git revert HEAD adds an inverse commit.',explanation:'Unstaging, discarding unstaged edits, and reverting a commit solve different problems. Revert preserves the original history and is suitable for reviewed shared changes.',check:(m,events)=>events.some(e=>e.includes('restore --staged'))&&m.head.message.startsWith('Revert ')&&m.head.snapshot.rule==='0.20'&&m.commits.length>=3}
];
