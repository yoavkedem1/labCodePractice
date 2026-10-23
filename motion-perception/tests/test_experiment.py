from pathlib import Path
import numpy as np
import pandas as pd
import pytest
from experiment.simulation import generate_trials, write_trials
from experiment.preprocessing import load_trials, validate_trials, filter_trials
from experiment.analysis import participant_summary, condition_summary, choice_curve
from experiment.plotting import plot_results

ROOT = Path(__file__).resolve().parents[1]

@pytest.fixture
def trials():
    return generate_trials(participants=3, trials=20)


def test_generation_is_deterministic_and_local():
    np.random.seed(9)
    before = np.random.get_state()[1].copy()
    first = generate_trials()
    second = generate_trials()
    pd.testing.assert_frame_equal(first, second)
    assert len(first) == 3840
    assert first.participant_id.nunique() == 24
    assert not first.equals(generate_trials(seed=202612))
    np.testing.assert_array_equal(before, np.random.get_state()[1])


def test_csv_regeneration_matches_committed_input(tmp_path):
    output = tmp_path / 'nested/trials.csv'
    write_trials(output)
    assert output.read_bytes() == (ROOT / 'data/raw/trials.csv').read_bytes()
    validate_trials(load_trials(output))


@pytest.mark.parametrize(('column','value'), [
    ('condition', 'unknown'), ('stimulus_strength', -0.1),
    ('stimulus_strength', 1.1), ('stimulus_direction', 0),
    ('choice_right', 2), ('correct', 2), ('reaction_time', 0),
    ('reaction_time', -1), ('reaction_time', np.inf),
    ('reaction_time', np.nan), ('participant_id', ''),
])
def test_schema_rejects_invalid_trials(trials, column, value):
    invalid = trials.copy()
    invalid.loc[0, column] = value
    with pytest.raises(ValueError):
        validate_trials(invalid)


def test_schema_rejects_missing_columns_and_empty_input(trials):
    with pytest.raises(ValueError, match='Missing columns'):
        validate_trials(trials.drop(columns='correct'))
    with pytest.raises(ValueError, match='No trials'):
        validate_trials(trials.iloc[:0])


def test_schema_rejects_inconsistent_correctness(trials):
    trials.loc[0, 'correct'] = 1 - trials.loc[0, 'correct']
    with pytest.raises(ValueError, match='disagrees'):
        validate_trials(trials)


def test_schema_rejects_non_numeric_measurement(trials):
    trials['reaction_time'] = trials['reaction_time'].astype(str)
    with pytest.raises(ValueError, match='numeric'):
        validate_trials(trials)


def test_filter_inclusive_boundaries_keeps_errors_and_preserves_input(trials):
    sample = trials.head(6).copy()
    sample['reaction_time'] = [0.19, 0.2, 0.5, 2.0, 2.01, 3.0]
    sample.loc[2, 'choice_right'] = 1 - int(sample.loc[2, 'stimulus_direction'] == 1)
    sample.loc[2, 'correct'] = 0
    before = sample.copy(deep=True)
    clean = filter_trials(sample, min_rt_s=0.2, max_rt_s=2.0)
    assert clean.index.tolist() == [1, 2, 3]
    assert clean.loc[2, 'correct'] == 0
    pd.testing.assert_frame_equal(sample, before)
    clean.loc[1, 'reaction_time'] = 0.3
    pd.testing.assert_frame_equal(sample, before)


@pytest.mark.parametrize(('lower','upper'), [(0,2), (2,1), (1,1), (np.nan,2), (0.2,np.inf)])
def test_invalid_bounds_fail_explicitly(trials, lower, upper):
    with pytest.raises(ValueError, match='bounds'):
        filter_trials(trials, lower, upper)


def test_empty_filtered_set_is_not_reported_as_zero_accuracy(trials):
    with pytest.raises(ValueError, match='No trials remain'):
        filter_trials(trials, 50, 60)


def test_summary_weights_participants_equally_instead_of_pooling():
    sample = pd.DataFrame({
        'participant_id': ['a','b','b','b'], 'condition': ['clear']*4,
        'correct': [1,0,0,0], 'reaction_time': [0.5,0.6,0.7,0.8],
    })
    summary = condition_summary(participant_summary(sample))
    assert summary.loc[0, 'accuracy'] == 0.5  # pooled accuracy would be 0.25
    assert summary.loc[0, 'n_participants'] == 2
    assert summary.loc[0, 'median_rt'] == pytest.approx(0.6)


def test_choice_probabilities_and_group_counts(trials):
    clean = filter_trials(trials)
    participants = participant_summary(clean)
    assert participants.n_trials.sum() == len(clean)
    curve = choice_curve(clean)
    assert curve.choice_right.between(0,1).all()
    assert curve.signed_strength.between(-1,1).all()


def test_plot_is_saved_without_changing_scientific_inputs(trials, tmp_path):
    import matplotlib.pyplot as plt
    clean = filter_trials(trials)
    before = clean.copy(deep=True)
    summary = condition_summary(participant_summary(clean))
    probabilities = choice_curve(clean)
    probabilities_before = probabilities.copy(deep=True)
    fig = plot_results(summary, probabilities)
    output = tmp_path / 'figure.svg'
    fig.savefig(output)
    plt.close(fig)
    assert output.stat().st_size > 1000
    assert len(fig.axes) == 2
    pd.testing.assert_frame_equal(probabilities, probabilities_before)
    for line in fig.axes[1].lines:
        expected = probabilities.loc[probabilities.condition == line.get_label()]
        np.testing.assert_allclose(line.get_xdata(), expected.signed_strength)
        np.testing.assert_allclose(line.get_ydata(), expected.choice_right)
    pd.testing.assert_frame_equal(clean, before)
