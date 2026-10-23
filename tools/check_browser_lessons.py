"""Execute the browser lesson source/solutions with the actual Python project.

This checks pedagogy and export format under local CPython. Browser worker,
WebAssembly loading, and figure rendering are separately tested in the UI.
"""
from pathlib import Path
import ast
import importlib
import json
import os
import subprocess
import sys
from tempfile import TemporaryDirectory
import nbformat

ROOT = Path(__file__).resolve().parents[1]
subprocess.run([sys.executable, 'tools/prepare_browser.py'], cwd=ROOT, check=True)
script = "import {lessons,notebookExport} from './site/assets/notebook-lessons.js'; console.log(JSON.stringify(lessons.map(l=>({...l,notebook:notebookExport(l,l.cells.map(c=>c.code))}))));"
lessons = json.loads(subprocess.check_output(['node','--input-type=module','-e',script],cwd=ROOT))
files=json.loads((ROOT/'site/assets/browser-project.json').read_text())['files']
original=Path.cwd()
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
for lesson in lessons:
    nbformat.validate(nbformat.from_dict(lesson['notebook']))
    for cell in lesson['cells']:
        ast.parse(cell['code'])
    ast.parse(lesson['check'])
    with TemporaryDirectory(prefix='workshop-browser-lesson-') as directory:
        work=Path(directory)
        for name,content in files.items():
            dest=work/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(content)
        solution=lesson['solution']
        (work/'helpers.py').write_text(solution.get('helper',lesson.get('helper',files['helpers.py'])))
        (work/'config/analysis.toml').write_text(solution.get('config',files['config/analysis.toml']))
        sources=[c['code'] for c in lesson['cells']]
        for i,source in enumerate(solution.get('cells',[])):
            sources[i]=source
        os.chdir(work);sys.path.insert(0,str(work));sys.modules.pop('helpers',None);importlib.invalidate_caches()
        namespace={'__name__':'__main__'}
        try:
            if lesson['id']=='state':
                baseline={}
                for cell in lesson['cells']:exec(cell['code'],baseline)
                exec(sources[0],baseline);exec(sources[2],baseline)
                try:exec(lesson['check'],baseline)
                except AssertionError as error:assert 'Stale result' in str(error)
                else:raise AssertionError('The hidden-state check must detect a stale derived table')
            for source in sources:exec(source,namespace)
            exec(lesson['check'],namespace)
            if lesson['id']=='refactor':
                # A plausible but wrong "correct trials only" helper must fail.
                good=namespace['clean_trials']
                namespace['clean_trials']=lambda table,min_rt_s,max_rt_s: good(table,min_rt_s,max_rt_s).query('correct == 1')
                try:exec(lesson['check'],namespace)
                except AssertionError:pass
                else:raise AssertionError('The refactor check must catch removed errors')
            print(f"PASS: {lesson['id']} · solution and notebook export")
        finally:
            plt.close('all');sys.path.remove(str(work));os.chdir(original);sys.modules.pop('helpers',None)
print('All four browser lesson solutions, intentional failure checks, and exported notebook schemas passed.')
