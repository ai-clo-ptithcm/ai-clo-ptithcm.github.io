/* AI-CLO PTITHCM V11 — Admin export of the complete course question bank. */
(() => {
'use strict';

const safeFileName=value=>String(value||'Hoc-phan').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'')||'Hoc-phan';
const viTime=value=>value?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'medium'}).format(new Date(value)):'';
const profileName=(map,id)=>id?(map.get(id)?.full_name||map.get(id)?.email||id):'';
const originLabel=value=>({lecturer:'Giảng viên biên soạn',gemini:'Gemini hỗ trợ',academy:'Câu hỏi Học viện'}[value]||value||'');
const scopeLabel=value=>({practice:'Luyện tập - kiểm tra',secure_exam:'Đề thi - bảo mật',both:'Cả hai ngân hàng'}[value]||value||'');
const approvalLabel=value=>({draft:'Bản nháp',pending:'Chờ duyệt',approved:'Đã duyệt',archived:'Lưu trữ'}[value]||value||'');
const statusLabel=value=>({active:'Hoạt động',draft:'Bản nháp',archived:'Lưu trữ'}[value]||value||'');

async function optionalQuery(table,columns,build){
 try{return await q(table,columns,build)}catch(error){console.warn(`Không tải được ${table} khi xuất ngân hàng:`,error);return[]}
}
function setSheetLayout(sheet,widths){
 sheet['!cols']=widths.map(w=>({wch:w}));
 const range=window.XLSX.utils.decode_range(sheet['!ref']||'A1');
 if(range.e.r>=0)sheet['!autofilter']={ref:window.XLSX.utils.encode_range({s:{r:0,c:0},e:{r:range.e.r,c:range.e.c}})};
}
async function exportQuestionBank(target={}){
 if(role()!=='admin')return toast('Chỉ Admin được xuất toàn bộ ngân hàng câu hỏi.',true);
 const requested=target?.bank||null,subject=requested?state.subjects.find(s=>s.question_bank_id===requested.id):activeSubject();
 const bank=requested||subject?.question_banks||null,bankId=bank?.id||subject?.question_bank_id||null;
 if(!bankId)return toast('Không xác định được ngân hàng câu hỏi.',true);
 const confirmed=await confirmAction(
  'Xuất toàn bộ ngân hàng câu hỏi?',
  'File Excel bao gồm cả câu luyện tập, đáp án và Ngân hàng đề thi - bảo mật. Hãy lưu trữ file ở nơi an toàn.',
  {confirmLabel:'Xuất Excel'}
 );
 if(!confirmed)return;
 const button=target?.button||$('#exportQuestionBank');
 const originalButtonText=button?.textContent;
 if(button){button.disabled=true;button.textContent='Đang chuẩn bị Excel…'}
 try{
  const XLSXLib=window.XLSX||(window.AICLO_OFFICE_LIBS?.xlsx?await window.AICLO_OFFICE_LIBS.xlsx():null);
  if(!XLSXLib)throw new Error('Không tải được thư viện Excel.');
  const sid=subject?.id||null,bankFilter=x=>x.eq('question_bank_id',bankId);
  const [questions,chapters,clos]=await Promise.all([
   q('questions','*, question_options(*)',x=>bankFilter(x).order('created_at',{ascending:true})),
   q('chapters','*',x=>bankFilter(x).order('order_index')),
   q('clos','*',x=>bankFilter(x).order('code'))
  ]);
  const chapterIds=chapters.map(x=>x.id).filter(Boolean);
  const topics=chapterIds.length?await q('topics','*',x=>x.in('chapter_id',chapterIds).order('order_index')):[];
  const revisions=questions.length?await optionalQuery('question_revisions','*',x=>x.in('question_id',questions.map(q=>q.id)).order('changed_at',{ascending:true})):[];
  const profileIds=[...new Set([
   ...questions.flatMap(x=>[x.created_by,x.approved_by,x.verified_by]),
   ...revisions.map(x=>x.changed_by)
  ].filter(Boolean))];
  const profiles=profileIds.length?await optionalQuery('profiles','id,full_name,email',x=>x.in('id',profileIds)):[];
  const profileMap=new Map(profiles.map(x=>[x.id,x]));
  const chapterMap=new Map(chapters.map(x=>[x.id,x])),topicMap=new Map(topics.map(x=>[x.id,x])),cloMap=new Map(clos.map(x=>[x.id,x]));
  const rows=questions.map((item,index)=>{
   const options=Object.fromEntries((item.question_options||[]).map(x=>[String(x.option_key||'').toUpperCase(),x.content]));
   return {
    'STT':index+1,
    'Mã câu hỏi':item.display_code||questionCode(item.id),
    'UUID nội bộ':item.id,
    'Nội dung câu hỏi':item.content||'',
    'Phương án A':options.A||'',
    'Phương án B':options.B||'',
    'Phương án C':options.C||'',
    'Phương án D':options.D||'',
    'Đáp án đúng':item.correct_answer||'',
    'Lời giải / Giải thích':item.explanation||'',
    'Chương':chapterMap.get(item.chapter_id)?.name||'',
    'Thứ tự chương':chapterMap.get(item.chapter_id)?.order_index??'',
    'Chủ đề':topicMap.get(item.topic_id)?.name||'',
    'Thứ tự chủ đề':topicMap.get(item.topic_id)?.order_index??'',
    'CLO':cloMap.get(item.clo_id)?.code||'',
    'Mô tả CLO':cloMap.get(item.clo_id)?.description||'',
    'Ngân hàng':scopeLabel(item.question_scope),
    'Trạng thái duyệt':approvalLabel(item.approval_status),
    'Trạng thái sử dụng':statusLabel(item.status),
    'Nguồn câu hỏi':originLabel(item.origin_type),
    'Câu Học viện chính thức':item.is_official?'Có':'Không',
    'Người nhập':profileName(profileMap,item.created_by),
    'Email người nhập':profileMap.get(item.created_by)?.email||'',
    'Người duyệt':profileName(profileMap,item.approved_by),
    'Ngày duyệt':viTime(item.approved_at),
    'Admin xác minh':profileName(profileMap,item.verified_by),
    'Ngày xác minh':viTime(item.verified_at),
    'Mã phiên AI':item.ai_batch_id||'',
    'Ngày tạo':viTime(item.created_at),
    'Ngày cập nhật':viTime(item.updated_at||item.created_at)
   };
  });
  const revisionRows=revisions.map((revision,index)=>({
   'STT':index+1,
   'Mã câu hỏi':questions.find(x=>x.id===revision.question_id)?.display_code||questionCode(revision.question_id),
   'UUID câu hỏi':revision.question_id,
   'Lần chỉnh sửa':revision.revision_no,
   'Người chỉnh sửa':profileName(profileMap,revision.changed_by),
   'Thời điểm':viTime(revision.changed_at),
   'Bản chụp đầy đủ (JSON)':JSON.stringify(revision.snapshot||{})
  }));
  const practice=questions.filter(x=>['practice','both'].includes(x.question_scope)).length;
  const secure=questions.filter(x=>['secure_exam','both'].includes(x.question_scope)).length;
  const info=[
   {'Thông tin':'Ngân hàng câu hỏi','Giá trị':bank?.name||subject?.question_banks?.name||''},
   {'Thông tin':'Mã ngân hàng','Giá trị':bank?.code||subject?.question_banks?.code||''},
   {'Thông tin':'Học phần đại diện','Giá trị':subject?.name||'Không có'},
   {'Thông tin':'Học kỳ','Giá trị':subject?.semester||''},
   {'Thông tin':'Năm học','Giá trị':subject?.academic_year||''},
   {'Thông tin':'Mã học phần nội bộ','Giá trị':sid},
   {'Thông tin':'Thời điểm xuất','Giá trị':viTime(new Date())},
   {'Thông tin':'Người xuất','Giá trị':state.profile?.full_name||state.profile?.email||state.user?.email||''},
   {'Thông tin':'Tổng số câu duy nhất','Giá trị':questions.length},
   {'Thông tin':'Xuất hiện trong ngân hàng luyện tập','Giá trị':practice},
   {'Thông tin':'Xuất hiện trong ngân hàng đề thi bảo mật','Giá trị':secure},
   {'Thông tin':'Câu dùng ở cả hai ngân hàng','Giá trị':questions.filter(x=>x.question_scope==='both').length},
   {'Thông tin':'Câu đã duyệt','Giá trị':questions.filter(x=>x.approval_status==='approved').length},
   {'Thông tin':'Câu Học viện chính thức','Giá trị':questions.filter(x=>x.is_official).length},
   {'Thông tin':'Số phiên bản lịch sử','Giá trị':revisions.length},
   {'Thông tin':'Cảnh báo bảo mật','Giá trị':'File có thể chứa câu hỏi và đáp án của Ngân hàng đề thi - bảo mật. Chỉ lưu hành nội bộ.'}
  ];
  const workbook=XLSXLib.utils.book_new();
  const bankName=bank?.name||subject?.question_banks?.name||subject?.name||'Ngân hàng';
  workbook.Props={Title:`Ngân hàng câu hỏi - ${bankName}`,Subject:'Sao lưu ngân hàng câu hỏi AI-CLO PTITHCM',Author:state.profile?.full_name||state.user?.email||'Admin',CreatedDate:new Date()};
  const questionSheet=XLSXLib.utils.json_to_sheet(rows),revisionSheet=XLSXLib.utils.json_to_sheet(revisionRows),infoSheet=XLSXLib.utils.json_to_sheet(info);
  setSheetLayout(questionSheet,[7,14,38,60,38,38,38,38,12,55,28,13,28,13,12,45,25,20,20,24,18,28,30,28,20,28,20,38,22,22]);
  setSheetLayout(revisionSheet,[7,14,38,14,28,22,90]);
  setSheetLayout(infoSheet,[38,85]);
  XLSXLib.utils.book_append_sheet(workbook,questionSheet,'Cau_hoi');
  XLSXLib.utils.book_append_sheet(workbook,revisionSheet,'Lich_su');
  XLSXLib.utils.book_append_sheet(workbook,infoSheet,'Thong_tin');
  const filename=`Ngan-hang-${safeFileName(bankName)}_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSXLib.writeFile(workbook,filename);
  window.logActivity?.('export','question_bank',bankId,`Admin xuất toàn bộ ngân hàng ${bankName}: ${questions.length} câu, gồm ${secure} câu trong ngân hàng bảo mật`,'success',sid,{question_bank_id:bankId,questions:questions.length,practice,secure,revisions:revisions.length});
  toast(`Đã xuất ${questions.length} câu hỏi ra Excel`);
 }catch(error){err(error)}
 finally{if(button){button.disabled=false;button.textContent=originalButtonText||'↓ Xuất ngân hàng Excel'}}
}

const previousQuestions=window.questions;
window.questions=async function(c){
 await previousQuestions(c);
 if(role()!=='admin'||state.view!=='questions'||!state.subjectId)return;
 const actions=$('.bank-actions',c);if(!actions||$('#exportQuestionBank',actions))return;
 const button=document.createElement('button');
 button.id='exportQuestionBank';button.type='button';button.className='secondary';button.textContent='↓ Xuất ngân hàng Excel';
 const firstAction=$('#scanDuplicates',actions);firstAction?actions.insertBefore(button,firstAction):actions.appendChild(button);
 button.onclick=()=>exportQuestionBank({button});
};

window.AICLO_QUESTION_EXPORT=Object.freeze({exportAll:exportQuestionBank,exportBank:(bank,button)=>exportQuestionBank({bank,button})});
})();
