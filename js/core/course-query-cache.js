/* AI-CLO PTITHCM — read-through cache for stable app/course data queries. */
(() => {
'use strict';

const PERF=window.AICLO_PERF;
if(!db||!PERF?.memo||db.__aicloCourseQueryCache)return;

const TTL=Object.freeze({
 chapters:5*60*1000,
 topics:5*60*1000,
 clos:5*60*1000,
 questions:3*60*1000,
 subject_members:3*60*1000,
 profiles:2*60*1000,
 exams:30*1000,
 exam_attempts:15*1000,
 activity_logs:60*1000
});
const WRITE_INVALIDATION=new Set([...Object.keys(TTL),'question_options']);
const originalFrom=db.from.bind(db);

const tablePrefix=table=>`course-query:${table}:`;
function invalidateTable(table){
 if(table==='question_options')table='questions';
 PERF.invalidate(tablePrefix(table));
 const sid=state.subjectId;
 if(['chapters','topics','clos'].includes(table)){
  PERF.invalidate('runtime:assessment-meta:');
  PERF.invalidate('runtime:course-dashboard:');
  window.AICLO_VIEW_TRANSITION?.invalidate?.('structure',sid,'course');
  window.AICLO_VIEW_TRANSITION?.invalidate?.('questions',sid,'course');
 }
 if(table==='questions'){
  PERF.invalidate('runtime:course-dashboard:');
  window.AICLO_VIEW_TRANSITION?.invalidate?.('questions',sid,'course');
 }
 if(table==='subject_members'||table==='profiles'){
  PERF.invalidate('runtime:course-dashboard:');
  PERF.invalidate('results:base:');
  window.AICLO_VIEW_TRANSITION?.invalidate?.('users',sid,'course');
  window.AICLO_VIEW_TRANSITION?.invalidate?.('results',sid,'course');
 }
 if(table==='exams'){
  PERF.invalidate('runtime:assessment-list:');
  PERF.invalidate('runtime:course-dashboard:');
  PERF.invalidate('results:base:');
  window.AICLO_VIEW_TRANSITION?.invalidate?.('exams',sid,'course');
  window.AICLO_VIEW_TRANSITION?.invalidate?.('results',sid,'course');
 }
 if(table==='exam_attempts'){
  PERF.invalidate('runtime:assessment-list:');
  PERF.invalidate('runtime:course-dashboard:');
  PERF.invalidate('results:base:');
  PERF.invalidate('results:detail:');
  window.AICLO_VIEW_TRANSITION?.invalidate?.('exams',sid,'course');
  window.AICLO_VIEW_TRANSITION?.invalidate?.('results',sid,'course');
 }
 if(table==='activity_logs')window.AICLO_VIEW_TRANSITION?.invalidate?.('activity',null,'system');
}
function invalidateCourse(){
 for(const table of Object.keys(TTL))PERF.invalidate(tablePrefix(table));
 window.AICLO_VIEW_TRANSITION?.clear?.();
}

function wrapReadBuilder(table,builder){
 if(!builder||typeof builder.then!=='function')return builder;
 const originalThen=builder.then.bind(builder);
 builder.then=function(onFulfilled,onRejected){
  const userId=state.user?.id||'guest';
  const url=builder.url?.toString?.();
  if(!url)return originalThen(onFulfilled,onRejected);
  const key=`${tablePrefix(table)}${userId}:${url}`;
  const execute=()=>new Promise((resolve,reject)=>originalThen(resolve,reject));
  return PERF.memo(key,TTL[table],execute).then(onFulfilled,onRejected);
 };
 return builder;
}

try{
 db.from=function(table){
  const query=originalFrom(table);
  if(!query)return query;

  if(TTL[table]&&typeof query.select==='function'){
   const originalSelect=query.select.bind(query);
   query.select=function(columns,...args){
    const options=args[0];
    const selected=originalSelect(columns,...args);
    if(options?.head)return selected;
    return wrapReadBuilder(table,selected);
   };
  }

  if(WRITE_INVALIDATION.has(table)){
   for(const method of ['insert','update','upsert','delete']){
    if(typeof query[method]!=='function')continue;
    const original=query[method].bind(query);
    query[method]=function(...args){
     /* Activity is append-only in normal use. Keep the 60 s list cache warm after
        inserting a new log instead of forcing a 300-row reload on the next visit. */
     if(!(table==='activity_logs'&&method==='insert'))invalidateTable(table);
     return original(...args);
    };
   }
  }
  return query;
 };
 Object.defineProperty(db,'__aicloCourseQueryCache',{value:true,configurable:false});
}catch(error){
 console.warn('Không cài được cache dữ liệu ứng dụng',error);
 return;
}

db.auth?.onAuthStateChange?.((event)=>{if(event==='SIGNED_OUT')invalidateCourse()});
window.AICLO_COURSE_QUERY_CACHE=Object.freeze({
 invalidateTable,
 invalidateCourse,
 ttl:TTL,
 version:'1.2'
});
})();
