"""Execute and save small synthetic outputs for the distributed notebooks."""
from pathlib import Path
import nbformat
from nbclient import NotebookClient

root = Path(__file__).resolve().parents[1] / 'motion-perception/notebooks'
for path in sorted(root.glob('*.ipynb')):
    notebook = nbformat.read(path, as_version=4)
    NotebookClient(notebook, timeout=120, kernel_name='python3',
        resources={'metadata': {'path': str(root)}}).execute()
    # Avoid publishing a machine-specific interpreter path in saved output.
    for cell in notebook.cells:
        for output in cell.get('outputs', []):
            if output.output_type == 'stream':
                output.text = '\n'.join('Python: workshop .venv (Python 3.11)' if line.startswith('Python:') else line
                                        for line in output.text.split('\n'))
    nbformat.write(notebook, path)
    print(f'Executed and saved {path.name}')
