"""Exercise local Git lab concepts using a temporary repository and bare remote.

Never contacts GitHub or changes this checkout's history. Also tests a real
conflict and abort so the teaching model is grounded in Git behavior.
"""
from pathlib import Path
import os
import shlex
import json
import re
import sys
import shutil
import subprocess
import tempfile


def run(cwd, *args, ok=True):
    result = subprocess.run(['git', *args], cwd=cwd, capture_output=True, text=True,
        env={**os.environ, 'GIT_CONFIG_NOSYSTEM':'1', 'GIT_CONFIG_GLOBAL':os.devnull,
             'GIT_TERMINAL_PROMPT':'0', 'GIT_MERGE_AUTOEDIT':'no'})
    if ok and result.returncode:
        raise RuntimeError(result.stderr)
    return result

with tempfile.TemporaryDirectory(prefix='workshop-git-') as temp:
    root=Path(temp)
    # Run the guide's exact initial path list against the real downloadable tree.
    repository = Path(__file__).resolve().parents[1]
    baseline = root / 'actual-example'
    shutil.copytree(repository / 'motion-perception', baseline,
        ignore=shutil.ignore_patterns('__pycache__', '.pytest_cache', '*.egg-info', '.ipynb_checkpoints', '.venv'))
    run(baseline, 'init', '-b', 'main')
    run(baseline, 'config', 'user.name', 'Workshop validation')
    run(baseline, 'config', 'user.email', 'workshop@example.invalid')
    add_line = next(line for line in (repository / 'site/git-lab.qmd').read_text().splitlines()
                    if line.startswith('git add README.md'))
    run(baseline, *shlex.split(add_line)[1:])
    run(baseline, 'commit', '-m', 'Initial synthetic project')
    assert run(baseline, 'status', '--short').stdout == '', 'The guide must leave no unstaged project files'
    # Execute the guide's actual scientific config in the copied project.
    run(baseline, 'switch', '-c', 'rt-sensitivity')
    guide = (repository / 'site/git-lab.qmd').read_text()
    config_text = re.search(r'```toml\n(.*?)\n```', guide, re.S).group(1)
    (baseline / 'config/rt-050.toml').write_text(config_text + '\n')
    script = baseline / 'scripts/run_analysis.py'
    subprocess.run([sys.executable, str(script), '--config', str(baseline / 'config/analysis.toml')], check=True, capture_output=True)
    baseline_csv = (baseline / 'results/baseline/conditions.csv').read_bytes()
    subprocess.run([sys.executable, str(script), '--config', str(baseline / 'config/rt-050.toml')], check=True, capture_output=True)
    record = json.loads((baseline / 'results/rt-050/run.json').read_text())
    assert record['configuration']['min_rt_s'] == 0.5
    assert record['trial_counts']['retained'] < 3761
    assert (baseline / 'results/baseline/conditions.csv').read_bytes() == baseline_csv
    run(baseline, 'add', 'config/rt-050.toml')
    run(baseline, 'commit', '-m', 'Add sensitivity configuration')
    assert run(baseline, 'status', '--short').stdout == ''
    work=root/'working'; work.mkdir()
    run(work, 'init','-b','main')
    run(work, 'config','user.name','Workshop validation')
    run(work, 'config','user.email','workshop@example.invalid')
    source=work/'preprocessing.py'; plot=work/'plotting.py'
    source.write_text('min_rt_s = 0.20\n'); plot.write_text('title = "Performance by condition"\n')
    run(work, 'add','preprocessing.py','plotting.py')
    run(work, 'commit','-m','Baseline')
    source.write_text('min_rt_s = 0.20  # seconds, inclusive\n')
    assert 'seconds' in run(work,'diff').stdout
    run(work,'add','preprocessing.py')
    source.write_text('min_rt_s = 0.20  # seconds, inclusive; preserve errors\n')
    assert run(work,'status','--short').stdout.startswith('MM')
    run(work,'commit','-m','Document units')
    assert 'preserve errors' in run(work,'diff').stdout
    run(work,'add','preprocessing.py'); run(work,'commit','-m','Document errors')
    run(work,'switch','-c','clarify-figure')
    plot.write_text('title = "Accuracy by visual noise condition"\n')
    run(work,'add','plotting.py'); run(work,'commit','-m','Clarify label')
    remote=root/'remote.git'; remote.mkdir(); run(remote,'init','--bare','-b','main')
    run(work,'remote','add','origin',str(remote))
    run(work,'push','-u','origin','main'); run(work,'push','-u','origin','clarify-figure')
    reviewer=root/'reviewer'; run(root,'clone',str(remote),str(reviewer))
    run(reviewer,'merge','--ff-only','origin/clarify-figure'); run(reviewer,'push','origin','main')
    run(work,'switch','main'); run(work,'pull','--ff-only','origin','main')
    assert 'visual noise' in plot.read_text()
    run(work,'switch','-c','conflict-a'); source.write_text('min_rt_s = 0.25\n')
    run(work,'add','preprocessing.py'); run(work,'commit','-m','Rule A')
    run(work,'switch','main'); run(work,'switch','-c','conflict-b'); source.write_text('min_rt_s = 0.30\n')
    run(work,'add','preprocessing.py'); run(work,'commit','-m','Rule B')
    assert run(work,'merge','conflict-a',ok=False).returncode == 1
    assert '<<<<<<<' in source.read_text()
    run(work,'merge','--abort'); assert source.read_text() == 'min_rt_s = 0.30\n'
    # Repeat, then resolve and record a real two-parent merge.
    run(work,'merge','conflict-a',ok=False); source.write_text('min_rt_s = 0.25\n')
    run(work,'add','preprocessing.py'); run(work,'commit','-m','Resolve scientifically reviewed rule')
    assert len(run(work,'rev-list','--parents','-n','1','HEAD').stdout.split()) == 3
print('Validated real staging, branch, push, clone, fast-forward pull, conflict, abort, and resolved merge using a temporary local remote.')
