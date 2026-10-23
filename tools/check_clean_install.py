"""Validate the distributed archive in a new directory and Python environment.

Requires network or a pip cache. Does not reuse the developer environment.
Kept separate from normal tests because it downloads a full notebook runtime.
"""
from pathlib import Path
import os
import subprocess
import sys
import tempfile
import venv
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
archive = ROOT / 'site/downloads/motion-perception.zip'
with tempfile.TemporaryDirectory(prefix='workshop-clean-') as temp:
    folder = Path(temp)
    with ZipFile(archive) as bundle:
        assert all(not Path(n).is_absolute() and '..' not in Path(n).parts for n in bundle.namelist())
        assert not any('/.venv/' in n or '/.git/' in n for n in bundle.namelist())
        bundle.extractall(folder)
    project = folder / 'motion-perception'
    venv.create(folder / 'environment', with_pip=True)
    python = folder / 'environment' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    env = {**os.environ, 'MPLBACKEND':'Agg', 'MPLCONFIGDIR':str(folder/'mpl'),
           'IPYTHONDIR':str(folder/'ipython')}
    commands = [
        ['-m','pip','install','-q','-r','requirements-lock.txt'],
        ['-m','pip','install','-q','--no-deps','-e','.'],
        ['-m','pip','check'],
        ['scripts/generate_data.py'], ['scripts/run_analysis.py'], ['-m','pytest','-q'],
    ]
    for args in commands:
        print('Fresh environment:', 'python ' + ' '.join(args), flush=True)
        subprocess.run([str(python),*args],cwd=project,env=env,check=True)
    assert (project/'results/baseline/conditions.csv').is_file()
    assert (project/'results/baseline/run.json').is_file()
print('Clean archive installation, regeneration, analysis, and all tests passed.')
