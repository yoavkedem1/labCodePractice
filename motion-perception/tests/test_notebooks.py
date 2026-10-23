"""Execute all educational stages in independent kernels and compare results."""
from pathlib import Path
import json
import sys
import nbformat
from nbclient import NotebookClient
import pandas as pd
import pytest
from experiment.preprocessing import load_trials, filter_trials
from experiment.analysis import participant_summary, condition_summary

ROOT = Path(__file__).resolve().parents[1]

@pytest.mark.parametrize('name', ['01_exploration', '02_refactored', '03_project'])
def test_fresh_kernel_matches_package_result(name):
    notebook = nbformat.read(ROOT / 'notebooks' / f'{name}.ipynb', as_version=4)
    nbformat.validate(notebook)
    executed = NotebookClient(notebook, timeout=120, kernel_name='python3',
        resources={'metadata': {'path': str(ROOT / 'notebooks')}}).execute()
    output = ''.join(o.get('text','') for cell in executed.cells if cell.cell_type == 'code'
                     for o in cell.get('outputs',[]) if o.output_type == 'stream')
    kernel_python = next(line.removeprefix('Python: ') for line in output.splitlines()
                         if line.startswith('Python: '))
    assert Path(kernel_python).resolve() == Path(sys.executable).resolve(), 'Notebook used another environment'
    encoded = next(line.removeprefix('SUMMARY_JSON=') for line in output.splitlines()
                   if line.startswith('SUMMARY_JSON='))
    observed = pd.DataFrame(json.loads(encoded))
    clean = filter_trials(load_trials(ROOT / 'data/raw/trials.csv'))
    expected = condition_summary(participant_summary(clean))
    pd.testing.assert_frame_equal(observed, expected, check_dtype=False, atol=1e-12, rtol=1e-12)
    assert f'RETAINED={len(clean)}' in output
    assert any(o.output_type == 'display_data' and 'image/png' in o.data
               for cell in executed.cells if cell.cell_type == 'code'
               for o in cell.get('outputs', []))
