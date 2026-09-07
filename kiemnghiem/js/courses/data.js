/* AI-CLO PTITHCM V11 — course-scoped data access helpers. */
(() => {
'use strict';

async function scopedTopics(chapters, select='*'){
  const ids=chapters.map(x=>x.id).filter(Boolean);
  if(!ids.length)return [];
  return q('topics',select,x=>x.in('chapter_id',ids).order('order_index'));
}

/* Question bank used to fetch every topic in the database then filter in the browser.
 * Keep the existing UI/behavior, but fetch only topics belonging to the active course. */
window.v96QuestionSets=async function(){
  const [items,ch,clos]=await Promise.all([
    q('questions','*, question_options(*)',x=>contentFilter(x).order('created_at',{ascending:false})),
    q('chapters','*',x=>contentFilter(x).order('order_index')),
    q('clos','*',x=>contentFilter(x).order('code'))
  ]);
  const topics=await scopedTopics(ch);
  return {items,ch,topics,clos};
};
})();
