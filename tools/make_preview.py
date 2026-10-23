"""Build the homepage's scientific illustration from the actual example data."""
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from experiment.preprocessing import load_trials, filter_trials
from experiment.analysis import participant_summary, condition_summary

ROOT = Path(__file__).resolve().parents[1]
matplotlib.rcParams['svg.hashsalt'] = 'research-code-workshop'
summary = condition_summary(participant_summary(filter_trials(load_trials(ROOT / 'motion-perception/data/raw/trials.csv'))))
fig, ax = plt.subplots(figsize=(4.5, 2.7), layout='constrained')
fig.patch.set_facecolor('#ffffff')
for i, row in summary.iterrows():
    ax.errorbar(i, row.accuracy, yerr=1.96 * row['sem'], fmt='o', color=['#167568','#a44c35'][i],
                markersize=10, capsize=5, linewidth=1.7)
    ax.text(i, row.accuracy + 0.055, f"{row.accuracy:.1%}", ha='center', fontsize=10, color='#202d2b')
ax.set(xticks=[0,1], xticklabels=['Clear motion','Noisy motion'], xlim=(-0.6,1.6), ylim=(0.45,1),
       ylabel='Participant accuracy')
ax.set_yticks([0.5,0.6,0.7,0.8,0.9,1.0], labels=['50%','60%','70%','80%','90%','100%'])
ax.axhline(0.5, color='#929c94', linestyle=(0,(3,3)), linewidth=.8)
ax.text(1.55,.505,'chance',ha='right',va='bottom',fontsize=8,color='#626d69')
ax.spines[['top','right']].set_visible(False)
ax.spines[['left','bottom']].set_color('#cbd3ca')
ax.tick_params(colors='#626d69',labelsize=9,length=0,pad=8)
ax.yaxis.label.set_color('#626d69')
fig.savefig(ROOT / 'site/assets/preview.svg', metadata={'Date':None})
plt.close(fig)
print('Generated homepage figure from seeded trial data.')
