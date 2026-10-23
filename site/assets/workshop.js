import './ui.js';
if(document.querySelector('[data-notebook-lab]')) import('./notebook-lab.js');
if(document.querySelector('[data-git-dojo]')) import('./git-playground.js');
if(document.querySelector('[data-practice-plan]')) import('./practice.js');

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

for (const form of document.querySelectorAll('.quiz')) {
  const feedback = form.querySelector('.quiz-feedback');
  form.addEventListener('change', () => { feedback.textContent = ''; });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const selected = form.querySelector('input:checked');
    if (!selected) { feedback.textContent = 'Choose an answer first.'; return; }
    const correct = selected.value === form.dataset.answer;
    feedback.textContent = `${correct ? 'Correct.' : 'Try another answer.'} ${form.dataset.explanation}`;
    feedback.dataset.correct = String(correct);
  });
}

for (const checklist of document.querySelectorAll('[data-checklist]')) {
  const boxes = [...checklist.querySelectorAll('input')];
  checklist.addEventListener('change', () => {
    const checked = boxes.filter(b => b.checked).length;
    checklist.querySelector('[role=status]').textContent = `${checked} of ${boxes.length} checked${checked === boxes.length ? ' · Ready for the handoff.' : ''}`;
  });
}

// Keep long reference commands scrollable within the page at narrow widths.
for (const table of document.querySelectorAll('main table')) {
  const wrapper = document.createElement('div');
  const heading = table.closest('section')?.querySelector('h2,h3')?.textContent.replace(/Anchor\s*$/, '').trim();
  wrapper.className = 'table-scroll';
  wrapper.setAttribute('role', 'region');
  wrapper.setAttribute('aria-label', `${heading || 'Reference'} table; scroll horizontally if needed`);
  wrapper.tabIndex = 0;
  table.replaceWith(wrapper);
  wrapper.append(table);
}
