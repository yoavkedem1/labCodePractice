"""Check generated HTML links/assets/fragments and Python lesson syntax."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import ast
import re
import sys
import tomllib

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site/_site'

class Document(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.ids = set()
        self.links = []
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'):
            self.ids.add(attrs['id'])
        if tag in {'a','link'} and attrs.get('href'):
            self.links.append(attrs['href'])
        if tag in {'img','script','source'} and attrs.get('src'):
            self.links.append(attrs['src'])


def check():
    errors = []
    documents = {p.resolve(): Document(p.read_text()) for p in SITE.rglob('*.html')}
    if len(documents) < 14:
        errors.append('Expected at least 14 rendered lesson/workshop pages')
    count = 0
    for path, document in documents.items():
        for link in document.links:
            url = urlsplit(link)
            if url.scheme or url.netloc or not url.path and not url.fragment:
                continue
            # Relative links are necessary for GitHub Pages repository subpaths.
            if url.path.startswith('/'):
                errors.append(f'{path.name}: root-relative link breaks project Pages: {link}')
                continue
            target = (path.parent / unquote(url.path)).resolve() if url.path else path
            if target.is_dir():
                target /= 'index.html'
            if not target.exists():
                errors.append(f'{path.name}: missing target {link}')
            elif target.suffix == '.html' and url.fragment and unquote(url.fragment) not in documents.get(target, Document('')).ids:
                errors.append(f'{path.name}: missing fragment {link}')
            count += 1
    snippets = 0
    toml_snippets = 0
    for page in (ROOT / 'site').rglob('*.qmd'):
        for match in re.finditer(r'^```(?:python|\{python\})\s*\n(.*?)^```', page.read_text(), re.M | re.S):
            try:
                ast.parse(match.group(1))
                snippets += 1
            except SyntaxError as error:
                errors.append(f'{page.name}: Python syntax: {error}')
    for page in (ROOT / 'site').rglob('*.qmd'):
        for match in re.finditer(r'^```toml\s*\n(.*?)^```', page.read_text(), re.M | re.S):
            try:
                tomllib.loads(match.group(1))
                toml_snippets += 1
            except tomllib.TOMLDecodeError as error:
                errors.append(f'{page.name}: TOML syntax: {error}')
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        raise SystemExit(1)
    print(f'Validated {len(documents)} HTML pages, {count} local links/assets/fragments, and {snippets} Python + {toml_snippets} TOML snippets.')

if __name__ == '__main__':
    check()
