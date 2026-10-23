"""Check scientific settings, path semantics, provenance, and runnable entry points."""
from dataclasses import FrozenInstanceError, replace
from hashlib import sha256
import json
from pathlib import Path
import runpy
import subprocess
import sys
import pandas as pd
import pytest
from experiment.config import AnalysisConfig, load_config
from experiment.preprocessing import load_trials, filter_trials
from experiment.analysis import participant_summary, condition_summary
from experiment.workflow import run_analysis

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = '''[paths]
data = "../data/raw/trials.csv"
output = "../results/test-run"
[preprocessing]
min_rt_s = 0.2
max_rt_s = 2.0
'''


def test_config_paths_are_relative_to_file_not_working_directory(tmp_path, monkeypatch):
    config_dir = tmp_path / 'config'
    config_dir.mkdir()
    path = config_dir / 'analysis.toml'
    path.write_text(TEMPLATE)
    monkeypatch.chdir(ROOT / 'notebooks')
    config = load_config(path)
    assert config.data_path == tmp_path / 'data/raw/trials.csv'
    assert config.output_dir == tmp_path / 'results/test-run'
    assert config.min_rt_s == 0.2
    with pytest.raises(FrozenInstanceError):
        config.min_rt_s = 0.6


@pytest.mark.parametrize('invalid', [
    TEMPLATE.replace('min_rt_s', 'min_rt'),
    TEMPLATE.replace('min_rt_s = 0.2', ''),
    TEMPLATE + '\nextra_rule = 1\n',
    TEMPLATE.replace('[preprocessing]', '[filtering]'),
    TEMPLATE.replace('data = "../data/raw/trials.csv"', 'data = 12'),
    TEMPLATE.replace('output = "../results/test-run"', 'output = ""'),
    TEMPLATE.replace('min_rt_s = 0.2', 'min_rt_s = "0.2"'),
    TEMPLATE.replace('min_rt_s = 0.2', 'min_rt_s = true'),
    TEMPLATE.replace('min_rt_s = 0.2', 'min_rt_s = nan'),
    TEMPLATE.replace('max_rt_s = 2.0', 'max_rt_s = inf'),
    TEMPLATE.replace('min_rt_s = 0.2', 'min_rt_s = 0.0'),
    TEMPLATE.replace('min_rt_s = 0.2', 'min_rt_s = 3.0'),
    TEMPLATE.replace('[paths]', 'paths = false\n[unused]'),
])
def test_bad_configuration_is_rejected_instead_of_using_defaults(tmp_path, invalid):
    path = tmp_path / 'bad.toml'
    path.write_text(invalid)
    with pytest.raises(ValueError):
        load_config(path)


def test_missing_file_does_not_silently_fall_back(tmp_path):
    with pytest.raises(FileNotFoundError):
        load_config(tmp_path / 'missing.toml')


def test_baseline_records_effective_settings_and_preserves_input(tmp_path):
    config = replace(load_config(ROOT / 'config/analysis.toml'), output_dir=tmp_path / 'baseline')
    input_before = config.data_path.read_bytes()
    observed = run_analysis(config)
    expected = condition_summary(participant_summary(filter_trials(load_trials(config.data_path))))
    pd.testing.assert_frame_equal(observed, expected)
    record = json.loads((config.output_dir / 'run.json').read_text())
    assert record['configuration']['min_rt_s'] == 0.2
    assert record['trial_counts'] == {'raw': 3840, 'retained': 3761}
    assert record['input_sha256'] == sha256(input_before).hexdigest()
    assert config.data_path.read_bytes() == input_before
    assert (config.output_dir / 'behavior.svg').is_file()


def test_sensitivity_run_changes_selection_without_overwriting_baseline(tmp_path):
    baseline = replace(load_config(ROOT / 'config/analysis.toml'), output_dir=tmp_path / 'baseline')
    sensitivity = replace(load_config(ROOT / 'config/sensitivity.toml'), output_dir=tmp_path / 'sensitivity')
    run_analysis(baseline)
    baseline_table = (baseline.output_dir / 'conditions.csv').read_bytes()
    run_analysis(sensitivity)
    record = json.loads((sensitivity.output_dir / 'run.json').read_text())
    assert record['trial_counts']['retained'] < 3761
    assert record['configuration']['min_rt_s'] == 0.6
    assert (baseline.output_dir / 'conditions.csv').read_bytes() == baseline_table
    assert (sensitivity.output_dir / 'conditions.csv').read_bytes() != baseline_table


def test_script_runs_from_an_unrelated_directory_and_records_cli_override(tmp_path):
    output_dir = tmp_path / 'override'
    result = subprocess.run([
        sys.executable, str(ROOT / 'scripts/run_analysis.py'),
        '--config', str(ROOT / 'config/analysis.toml'),
        '--min-rt', '0.6', '--output', str(output_dir),
    ], cwd=tmp_path, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    record = json.loads((output_dir / 'run.json').read_text())
    assert record['configuration']['min_rt_s'] == 0.6
    assert record['configuration']['output_dir'] == str(output_dir)
    assert record['config_source'] == str(ROOT / 'config/analysis.toml')


def test_invalid_cli_override_fails_before_creating_outputs(tmp_path):
    output_dir = tmp_path / 'should-not-exist'
    result = subprocess.run([
        sys.executable, str(ROOT / 'scripts/run_analysis.py'),
        '--min-rt', '3', '--max-rt', '2', '--output', str(output_dir),
    ], cwd=tmp_path, capture_output=True, text=True)
    assert result.returncode == 2
    assert '0 < min_rt_s < max_rt_s' in result.stderr
    assert not output_dir.exists()


def test_importing_the_entry_point_does_not_execute_the_analysis(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    namespace = runpy.run_path(str(ROOT / 'scripts/run_analysis.py'), run_name='imported_script')
    assert callable(namespace['main'])
    assert list(tmp_path.iterdir()) == []
