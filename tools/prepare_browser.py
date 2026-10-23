"""Copy the real teaching project into a virtual-filesystem manifest."""
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[1]
project = ROOT/'motion-perception'
files = {'data/raw/trials.csv': (project/'data/raw/trials.csv').read_text(),
         'helpers.py': (project/'notebooks/helpers.py').read_text()}
for path in sorted((project/'src/experiment').glob('*.py')):
    files[str(path.relative_to(project))] = path.read_text()
for path in sorted((project/'config').glob('*.toml')):
    files[str(path.relative_to(project))] = path.read_text()
# Distribution metadata permits the real workflow's version record in the browser.
files['src/motion_perception_workshop-1.0.0.dist-info/METADATA'] = 'Metadata-Version: 2.1\nName: motion-perception-workshop\nVersion: 1.0.0\n'
(ROOT/'site/assets/browser-project.json').write_text(json.dumps({'files': files}, ensure_ascii=False))
print('Prepared browser filesystem from the actual dataset, modules, and configs.')
