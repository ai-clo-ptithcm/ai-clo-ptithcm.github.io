/* AI-CLO PTITHCM V11 — course-scoped data access for structure/question-bank screens. */
(() => {
'use strict';

async function scopedTopics(chapters, select='*'){
  const ids=chapters.map(x=>x.id).filter(Boolean);
  if(!ids.length)return [];
  return q('topics',select,x=>x.in('chapter_id',ids).order('order_index'));
}

/* Replace legacy question-bank set loader which previously fetched all topics
 * from every course and filtered them in the browser. */
window.v96QuestionSets=async function(){
  const [items,ch,clos]=await Promise.all([
    q('questions','*, question_options(*)',x=>x.eq('subject_id',state.subjectId).order('created_at',{ascending:false})),
    q('chapters','*',x=>x.eq('subject_id',state.subjectId).order('order_index')),
    q('clos','*',x=>x.eq('subject_id',state.subjectId).order('code'))
  ]);
  const topics=await scopedTopics(ch);
  return {items,ch,topics,clos};
};

/* Keep structure rendering behavior intact while moving topic filtering to DB. */
window.structure=async function(c){
  if(!state.subjectId){c.replaceChildren(empty());return}
  const [ch,clos]=await Promise.all([
    q('chapters','*',x=>x.eq('subject_id',state.subjectId).order('order_index')),
    q('clos','*',x=>x.eq('subject_id',state.subjectId).order('code'))
  ]);
  const relevantTopics=await scopedTopics(ch);

  c.innerHTML=`<div class="grid2"><section class="panel"><div class="panel-head"><h3>Chương và chủ đề</h3>${canTeach()?'<button id="addChapter" class="primary">+ Chương</button>':''}</div><div id="chapterList" class="structure-list">${ch.map(x=>{let ts=relevantTopics.filter(t=>t.chapter_id===x.id);return `<div class="structure-chapter"><div class="structure-chapter-head"><div><b>${esc(x.order_index)}. ${esc(x.name)}</b><small>${ts.length} chủ đề</small></div>${canTeach()?`<div class="structure-actions"><button data-topic="${x.id}">+ Chủ đề</button><button data-edit-chapter="${x.id}">Sửa</button><button class="danger-link" data-delete-chapter="${x.id}">Xóa</button></div>`:''}</div><div class="topic-list">${ts.map(t=>`<div class="topic-row"><span>${esc(t.order_index)}. ${esc(t.name)}</span>${canTeach()?`<span><button data-edit-topic="${t.id}">Sửa</button><button class="danger-link" data-delete-topic="${t.id}">Xóa</button></span>`:''}</div>`).join('')||'<small>Chưa có chủ đề</small>'}</div></div>`}).join('')||'<div class="empty">Chưa có chương.</div>'}</div></section><section class="panel"><div class="panel-head"><h3>Chuẩn đầu ra CLO</h3>${canTeach()?'<button id="addClo" class="primary">+ CLO</button>':''}</div><div id="cloList">${clos.map(x=>`<div class="clo-card"><div><b>${esc(x.code)}</b><p>${esc(x.description)}</p></div>${canTeach()?`<div class="row-actions"><button data-edit-clo="${x.id}">Sửa</button><button class="danger-link" data-delete-clo="${x.id}">Xóa</button></div>`:''}</div>`).join('')||'<div class="empty">Chưa có CLO.</div>'}</div></section></div>`;

  $('#addChapter')?.addEventListener('click',()=>chapterForm());
  $('#addClo')?.addEventListener('click',()=>cloForm());
  $('#chapterList')?.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.topic)topicForm(b.dataset.topic);
    if(b.dataset.editChapter)chapterForm(ch.find(x=>x.id===b.dataset.editChapter));
    if(b.dataset.deleteChapter)remove('chapters',b.dataset.deleteChapter,'chương');
    if(b.dataset.editTopic)topicForm(relevantTopics.find(x=>x.id===b.dataset.editTopic)?.chapter_id,relevantTopics.find(x=>x.id===b.dataset.editTopic));
    if(b.dataset.deleteTopic)remove('topics',b.dataset.deleteTopic,'chủ đề');
  });
  $('#cloList')?.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.editClo)cloForm(clos.find(x=>x.id===b.dataset.editClo));
    if(b.dataset.deleteClo)remove('clos',b.dataset.deleteClo,'CLO');
  });
};
})();
