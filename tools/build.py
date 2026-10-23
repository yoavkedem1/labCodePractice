"""Build all downloadable materials and render the Quarto website."""
from pathlib import Path
import os
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]

def run(*args):
    subprocess.run(args, cwd=ROOT, check=True)

if __name__ == '__main__':
    run(sys.executable, 'tools/fetch_pyodide.py')
    run(sys.executable, 'tools/prepare_browser.py')
    run(sys.executable, 'tools/package_materials.py')
    run(os.environ.get('QUARTO_BIN', 'quarto'), 'render', 'site')
    run(sys.executable, 'tools/check_site.py')
