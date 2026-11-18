import {files} from './git-model.js';

const supported = 'Supported commands: git status, diff, add, commit, branch, switch, checkout, merge, fetch, pull --ff-only, push, restore, log, and revert HEAD.';

function fileKeys(paths) {
  if (paths[0] === '--') paths = paths.slice(1);
  if (!paths.length) throw new Error('Specify a file path or .');
  const keys = paths.flatMap(path => {
    if (path === '.') return Object.keys(files);
    const file = path.replace(/^\.\//, '');
    const key = Object.keys(files).find(name => files[name] === file);
    if (!key) throw new Error(`Unknown path: ${path}. Use ${Object.values(files).join(' or ')}.`);
    return key;
  });
  return [...new Set(keys)];
}

export function branchStatus(model) {
  const branch = model.current;
  if (!Object.hasOwn(model.upstream, branch)) return branch;
  const upstream = model.upstream[branch];
  if (!Object.hasOwn(model.tracking, upstream)) return branch;
  const local = model.ancestors(model.head.id);
  const remote = model.ancestors(model.tracking[upstream]);
  const ahead = [...local].filter(id => !remote.has(id)).length;
  const behind = [...remote].filter(id => !local.has(id)).length;
  const counts = [ahead ? `ahead ${ahead}` : '', behind ? `behind ${behind}` : ''].filter(Boolean);
  return `${branch}...origin/${upstream}${counts.length ? ` [${counts.join(', ')}]` : ''}`;
}

export function status(model, short = false, showBranch = false) {
  const {staged, unstaged, unmerged} = model;
  if (short) {
    const rows = Object.keys(files).filter(key =>
      staged.includes(key) || unstaged.includes(key) || unmerged.includes(key)).map(key => {
      const flags = unmerged.includes(key) ? 'UU' : (staged.includes(key) ? 'M' : ' ') + (unstaged.includes(key) ? 'M' : ' ');
      return `${flags} ${files[key]}`;
    });
    if (showBranch) rows.unshift(`## ${branchStatus(model)}`);
    return rows.join('\n');
  }
  const list = (title, keys) => keys.length ? `${title}\n${keys.map(key => `  ${files[key]}`).join('\n')}` : '';
  const resolved = model.conflict?.keys.filter(key => model.conflict.stagedKeys.has(key) && !staged.includes(key)) ?? [];
  return [
    `On branch ${model.current}`,
    model.conflict ? `Merging ${model.conflict.source} into ${model.current}` : '',
    list('Unmerged paths:', unmerged),
    list('Changes to be committed:', [...staged, ...resolved]),
    list('Changes not staged for commit:', unstaged),
    !model.dirty && !model.conflict ? 'nothing to commit, working tree clean' : ''
  ].filter(Boolean).join('\n\n');
}

const line = (key, value) => key === 'rule' ? `min_rt_s = ${value}` : `color = "${value}"`;

export function formatDiff(changes) {
  return changes.map(({key, before, after}) =>
    `--- a/${files[key]}\n+++ b/${files[key]}\n- ${line(key, before)}\n+ ${line(key, after)}`).join('\n\n');
}

export function diff(model, staged = false, keys = Object.keys(files)) {
  return formatDiff(model.diff(staged).filter(change => keys.includes(change.key)));
}

export function quoteArgument(value) { return JSON.stringify(value); }

function parseCommand(command) {
  const tokens = [];
  const token = /"((?:[^"\\]|\\.)*)"|'([^']*)'|([^\s"';&|`<>]+)/y;
  let remaining = command.trim();
  while (remaining) {
    token.lastIndex = 0;
    const match = token.exec(remaining);
    if (!match || (remaining[token.lastIndex] && !/\s/.test(remaining[token.lastIndex]))) {
      throw new Error('Enter one Git command. Use matching quotes around messages that contain spaces.');
    }
    tokens.push(match[1]?.replace(/\\(["\\])/g, '$1') ?? match[2] ?? match[3]);
    remaining = remaining.slice(token.lastIndex).trimStart();
  }
  return tokens;
}

export function executeCommand(model, command) {
  if (/[\r\n]/.test(command.trim())) throw new Error('Enter one Git command at a time.');
  const [program, verb, ...args] = parseCommand(command);
  if (program !== 'git') throw new Error('Start with git. ' + supported);
  switch (verb) {
    case 'status':
      if (!args.length) return status(model);
      if (args.length === 1 && ['--short', '-s'].includes(args[0])) return status(model, true);
      if (['-sb', '-bs', '--short --branch', '--branch --short'].includes(args.join(' '))) return status(model, true, true);
      throw new Error('Use git status, git status --short, or git status -sb.');
    case 'diff': {
      const staged = ['--staged', '--cached'].includes(args[0]);
      if (staged) args.shift();
      return diff(model, staged, args.length ? fileKeys(args) : undefined);
    }
    case 'add':
      return model.stage(args.length === 1 && ['-A', '--all'].includes(args[0]) ? undefined : fileKeys(args));
    case 'commit':
      if (args.length === 2 && args[0] === '-m' && args[1].trim()) return model.commit(args[1].trim());
      if (!args.length && model.conflict) return model.commit();
      throw new Error('Use git commit -m "Describe your change".');
    case 'branch':
      if (!args.length || (args.length === 1 && ['-a', '--all', '--list'].includes(args[0]))) {
        const local = Object.keys(model.branches).map(name => `${name === model.current ? '*' : ' '} ${name}`);
        const remote = Object.keys(model.tracking).map(name => `  remotes/origin/${name}`);
        return [...local, ...(args[0] === '--list' || !args.length ? [] : remote)].join('\n');
      }
      if (args.length === 1 && !args[0].startsWith('-')) return model.branch(args[0], false);
      throw new Error('Use git branch to list branches or git branch NAME to create one.');
    case 'switch':
    case 'checkout':
      if (args.length === 2 && args[0] === (verb === 'switch' ? '-c' : '-b')) return model.branch(args[1]);
      if (args.length === 1 && !args[0].startsWith('-')) return model.switchBranch(args[0]);
      throw new Error('Use git switch NAME or git switch -c NAME. The checkout equivalents are git checkout NAME and git checkout -b NAME.');
    case 'merge':
      if (args.length === 1 && args[0] === '--abort') return model.abort();
      if (args.length === 1 && !args[0].startsWith('-')) return model.merge(args[0]);
      throw new Error('Use git merge BRANCH or git merge --abort.');
    case 'fetch':
      if (!args.length || (args.length === 1 && args[0] === 'origin')) return model.fetch();
      throw new Error('Use git fetch origin.');
    case 'pull':
      if (args[0] === '--ff-only' && (args.length === 1 || (args.length === 3 && args[1] === 'origin'))) return model.pull(args[2]);
      throw new Error('Use git pull --ff-only or git pull --ff-only origin BRANCH.');
    case 'push': {
      const setUpstream = ['-u', '--set-upstream'].includes(args[0]);
      if (setUpstream) args.shift();
      if (!setUpstream && (!args.length || (args.length === 1 && args[0] === 'origin'))) return model.push();
      if (args.length === 2 && args[0] === 'origin' && !args[1].startsWith('-')) return model.push(args[1], setUpstream);
      throw new Error('Use git push or git push -u origin BRANCH.');
    }
    case 'restore':
      if (args[0] === '--staged') return model.unstage(fileKeys(args.slice(1)));
      return model.discard(fileKeys(args));
    case 'revert':
      if (args.length === 1 && args[0] === 'HEAD') return model.revert();
      throw new Error('Use git revert HEAD to undo the latest single-parent commit.');
    case 'log': {
      if (args.some(arg => !['--oneline', '--graph', '--all'].includes(arg))) throw new Error('Use git log --oneline --graph --all or git log.');
      const tips = args.includes('--all') ? [...Object.values(model.branches), ...Object.values(model.tracking)] : [model.head.id];
      const reachable = new Set(tips.flatMap(id => [...model.ancestors(id)]));
      return [...model.commits].reverse().filter(commit => reachable.has(commit.id)).map(commit =>
        `${commit.id} ${commit.message}${args.includes('--graph') ? ` [parents: ${commit.parents.join(', ') || 'none'}]` : ''}`).join('\n');
    }
    case 'help':
      return supported;
    default:
      throw new Error(supported);
  }
}
