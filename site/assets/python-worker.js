import {loadPyodide} from './python-runtime/pyodide.mjs';
let python;
async function initialize(files) {
  self.postMessage({type:'status',text:'Loading the local Python runtime and scientific packages…'});
  python = await loadPyodide({indexURL:new URL('./python-runtime/',import.meta.url).href});
  await python.loadPackage(['numpy','pandas','matplotlib']);
  const project = await fetch(new URL('./browser-project.json',import.meta.url));
  if(!project.ok) throw new Error('Browser project files are missing. Rebuild the site.');
  const bundled = (await project.json()).files;
  for(const [path,content] of Object.entries({...bundled,...files})) {
    const destination = `/workshop/${path}`;
    python.FS.mkdirTree(destination.substring(0,destination.lastIndexOf('/')));
    python.FS.writeFile(destination,content);
  }
  python.runPython(`
import os, sys, ast, io, contextlib, traceback, base64, json
os.chdir('/workshop')
sys.dont_write_bytecode = True
sys.path[:0] = ['/workshop/src', '/workshop']
import matplotlib
matplotlib.use('agg')
import matplotlib.pyplot as _plt
import pandas as _pd
import numpy as _np
_user_globals = {'__name__': '__main__'}
class _CappedOutput(io.StringIO):
    def write(self, value):
        if self.tell() + len(value) > 16000:
            raise RuntimeError('Cell output exceeded 16,000 characters; summarize the result instead.')
        return super().write(value)
def _execute_cell(source):
    output, error_output = _CappedOutput(), _CappedOutput()
    error, figures = '', []
    with contextlib.redirect_stdout(output), contextlib.redirect_stderr(error_output):
        try:
            tree = ast.parse(source, filename='<workshop cell>')
            last = tree.body.pop() if tree.body and isinstance(tree.body[-1], ast.Expr) else None
            exec(compile(tree, '<workshop cell>', 'exec'), _user_globals)
            if last:
                value = eval(compile(ast.Expression(last.value), '<workshop cell>', 'eval'), _user_globals)
                if value is not None:
                    print(repr(value)[:8000])
        except BaseException:
            error = traceback.format_exc(limit=8)
        try:
            for number in _plt.get_fignums()[:3]:
                buffer = io.BytesIO()
                _plt.figure(number).savefig(buffer, format='png', dpi=100, bbox_inches='tight')
                if buffer.tell() < 1500000:
                    figures.append(base64.b64encode(buffer.getvalue()).decode())
        except BaseException:
            error += traceback.format_exc(limit=3)
        finally:
            _plt.close('all')
    variables = []
    for name, value in list(_user_globals.items()):
        if name.startswith('_') or isinstance(value, type(sys)):
            continue
        try:
            description = f'{type(value).__name__}, shape={value.shape}' if isinstance(value, (_pd.DataFrame, _pd.Series)) else repr(value)[:100]
        except Exception:
            description = type(value).__name__
        variables.append({'name':name, 'value':description})
    return json.dumps({'stdout':output.getvalue(), 'stderr':error_output.getvalue(), 'error':error, 'figures':figures, 'variables':variables[-30:]})
`);
  return python.runPython("__import__('json').dumps({'python':sys.version.split()[0], 'numpy':_np.__version__, 'pandas':_pd.__version__, 'matplotlib':matplotlib.__version__})");
}
self.onmessage = async ({data}) => {
  try {
    let result;
    if(data.action === 'init') result = await initialize(data.files);
    else if(!python) throw new Error('Start Python first.');
    else if(data.action === 'run') {
      python.globals.set('_cell_source',data.code);
      result = python.runPython('_execute_cell(_cell_source)');
    } else if(data.action === 'save') {
      if(!['helpers.py','config/analysis.toml'].includes(data.path)) throw new Error('Unknown workshop file.');
      python.FS.writeFile(`/workshop/${data.path}`,data.content);
      if(data.path === 'helpers.py') python.runPython("import importlib; importlib.invalidate_caches(); sys.modules.pop('helpers',None)");
      result = JSON.stringify({saved:data.path});
    } else throw new Error('Unknown kernel request.');
    self.postMessage({id:data.id,result});
  } catch(error) {self.postMessage({id:data.id,error:error.message});}
};
