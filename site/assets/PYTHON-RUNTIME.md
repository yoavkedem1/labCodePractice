# Browser Python runtime

The workshop bundles the official Pyodide **0.27.7** distribution from
https://cdn.jsdelivr.net/pyodide/v0.27.7/full/ using `tools/fetch_pyodide.py`.
Core assets are version-pinned. Wheel SHA-256 checksums are verified against
the distribution's pyodide-lock.json. runtime-manifest.json records downloaded
files, byte counts, and hashes. The built site serves them locally.

Pyodide is MPL-2.0 licensed; its upstream license is retained in the runtime.
The CPython license is retained separately as LICENSE-CPYTHON. Scientific
dependencies retain their own licenses in the bundled wheel archives. These are separate
from the workshop's MIT teaching source and CC0 synthetic dataset.

The browser version set is Python 3.12.7, NumPy 2.0.2, pandas 2.2.3, Matplotlib
3.8.4. It differs from the local project's lock. All teaching project source,
data, and configuration in browser-project.json come from motion-perception/;
prepare_browser.py regenerates that virtual filesystem at build time.

The worker runs Python on the learner's device. Source edits are stored in
localStorage when available; variables and virtual filesystem state last only
until restart. The controller reapplies the editors on a fresh kernel.
No analytics, accounts, or backend execution are used.
