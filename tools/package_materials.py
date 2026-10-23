"""Produce deterministic, portable archives. Never include local or sensitive state."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
SKIP = {'.git', '.venv', '.quarto', '_site', '__pycache__', '.pytest_cache',
        '.ipynb_checkpoints', 'node_modules', '.DS_Store', 'downloads', 'python-runtime'}


def include(path):
    parts = path.relative_to(ROOT).parts
    if any(part in SKIP or part.endswith('.egg-info') for part in parts):
        return False
    if 'results' in parts or 'processed' in parts:
        return path.name == '.gitkeep'
    return path.is_file() and path.name != 'browser-project.json' and path.suffix not in {'.pyc', '.zip'}


def archive(source, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(destination, 'w', ZIP_DEFLATED) as bundle:
        for path in sorted(source.rglob('*')):
            if include(path):
                info = ZipInfo(str(path.relative_to(source.parent)), date_time=(2026, 1, 1, 0, 0, 0))
                info.compress_type = ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                bundle.writestr(info, path.read_bytes())
    print(f'Packaged {destination.name}: {destination.stat().st_size:,} bytes')

if __name__ == '__main__':
    archive(ROOT / 'motion-perception', ROOT / 'site/downloads/motion-perception.zip')
    archive(ROOT, ROOT / 'site/downloads/workshop-source.zip')
