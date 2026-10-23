/** Small, accessible workspace affordances; no UI framework or external assets. */
const paths={
 play:'m9 5 11 7-11 7V5Z',stop:'M6 6h12v12H6z',restart:'M3 10a9 9 0 1 1 2 8M3 4v6h6',
 check:'m5 12 4 4L19 6',folder:'M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
 notebook:'M6 3h13v18H6zM3 6h5M3 10h5M3 14h5M3 18h5M11 7h4M11 11h4',
 code:'m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18',save:'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2ZM7 3v6h10V3M7 21v-8h10v8',
 search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
 sliders:'M4 5h16M4 12h16M4 19h16M8 2v6M16 9v6M10 16v6',
 shield:'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Zm-4 9 3 3 5-6',
 download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
 target:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0ZM12 10v4m-2-2h4',
 git:'M6 3v12a4 4 0 0 0 4 4h5M6 7h8a4 4 0 0 0 4-4M9 3a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM21 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
 cloud:'M6 18a5 5 0 1 1 1-10 6 6 0 0 1 11 1 4.5 4.5 0 0 1 0 9H6Z',
 terminal:'m5 6 6 6-6 6m8 0h6',arrow:'M4 12h16m-6-6 6 6-6 6'
};
function icons(scope=document){
 for(const slot of scope.querySelectorAll('[data-icon]:not([data-icon-ready])')){
  slot.dataset.iconReady='';
  const path=paths[slot.dataset.icon];if(!path)continue;
  slot.innerHTML=`<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
 }
}
icons();
function tabs(root,selector){
 const list=root.querySelector(selector);if(!list)return ()=>{};
 const buttons=[...list.querySelectorAll('[data-pane]')];
 const select=name=>{
  for(const button of buttons){const selected=button.dataset.pane===name;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;}
  for(const pane of root.querySelectorAll('[data-pane-content]'))pane.hidden=pane.dataset.paneContent!==name;
 };
 list.addEventListener('click',e=>{const b=e.target.closest('[data-pane]');if(b)select(b.dataset.pane);});
 list.addEventListener('keydown',e=>{
  const index=buttons.indexOf(e.target);if(index<0||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
  select(buttons[next].dataset.pane);buttons[next].focus();
 });
 select(buttons.find(b=>b.getAttribute('aria-selected')==='true')?.dataset.pane||buttons[0].dataset.pane);
 return select;
}
const notebook=document.querySelector('[data-notebook-lab]');
if(notebook){
 const select=tabs(notebook,'[data-workspace-tabs]');
 const feedback=notebook.querySelector('[data-mission-result]'),summary=notebook.querySelector('[data-check-summary]');
 new MutationObserver(()=>{const state=feedback.dataset.state;summary.hidden=!state;summary.dataset.state=state||'';summary.textContent=state==='passed'?'Passed · view feedback':'Check failed · view feedback';}).observe(feedback,{childList:true});
 const instructions=notebook.querySelector('[data-mission-instructions]');
 if(instructions)instructions.open=matchMedia('(min-width:1200px)').matches;
 const decorate=()=>{
  for(const editor of notebook.querySelectorAll('.code-editor:not([data-lines-ready])')){
   editor.dataset.linesReady='';
   const frame=document.createElement('div');frame.className='editor-frame';
   const gutter=document.createElement('pre');gutter.className='line-gutter';gutter.setAttribute('aria-hidden','true');
   editor.replaceWith(frame);frame.append(gutter,editor);
   const update=()=>{gutter.textContent=Array.from({length:editor.value.split('\n').length},(_,i)=>i+1).join('\n');gutter.scrollTop=editor.scrollTop;};
   editor.addEventListener('input',update);editor.addEventListener('scroll',()=>{gutter.scrollTop=editor.scrollTop;});update();
  }
 };
 const syncGutters=()=>{for(const editor of notebook.querySelectorAll('.code-editor')){const gutter=editor.closest('.editor-frame')?.querySelector('.line-gutter');if(gutter)gutter.textContent=Array.from({length:editor.value.split('\n').length},(_,i)=>i+1).join('\n');}};
 new MutationObserver(()=>{decorate();icons(notebook);}).observe(notebook.querySelector('[data-cells]'),{childList:true});
 notebook.addEventListener('workshop:lesson',e=>{
  decorate();syncGutters();select(e.detail.id==='refactor'?'helper':e.detail.id==='config'?'config':'notebook');
 });
 notebook.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.matches('[data-run-cell],[data-run-all],[data-check-mission]'))select('notebook');
  if(b.matches('[data-solution]'))queueMicrotask(syncGutters);
 },{capture:true});
 decorate();
}
const git=document.querySelector('[data-git-dojo]');
if(git){
 const select=tabs(git,'[data-git-tabs]');
 git.addEventListener('workshop:git-mission',e=>select(e.detail.id==='remote'?'remote':e.detail.id==='branches'||e.detail.id==='conflict'?'history':'changes'));
}
