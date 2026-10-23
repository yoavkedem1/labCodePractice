const root=document.querySelector('[data-practice-plan]');
if(root){
 const key='research-code-practice-v1',status=root.querySelector('[data-practice-status]');
 const fields=[...root.querySelectorAll('[data-note]')];
 try{const saved=JSON.parse(localStorage.getItem(key)||'{}');for(const field of fields){if(field.type==='checkbox')field.checked=Boolean(saved[field.dataset.note]);else field.value=saved[field.dataset.note]||'';}}catch{status.textContent='Browser storage is unavailable. Download your notes to keep them.';}
 root.addEventListener('input',()=>{try{localStorage.setItem(key,JSON.stringify(Object.fromEntries(fields.map(f=>[f.dataset.note,f.type==='checkbox'?f.checked:f.value]))));status.textContent='Handoff notes saved in this browser.';}catch{status.textContent='Browser storage is unavailable. Download your notes to keep them.';}});
 root.addEventListener('submit',e=>e.preventDefault());
 root.querySelector('[data-export-plan]').addEventListener('click',()=>{
  const notes='# Research / Code · My handoff notes\n\n'+fields.map(f=>f.type==='checkbox'?`- [${f.checked?'x':' '}] ${f.closest('label').textContent.trim()}`:`## ${root.querySelector(`label[for="${f.id}"]`).textContent}\n\n${f.value||'(not yet recorded)'}\n`).join('\n')+'\n';
  const url=URL.createObjectURL(new Blob([notes],{type:'text/markdown'}));const a=document.createElement('a');a.href=url;a.download='research-handoff-notes.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
}
