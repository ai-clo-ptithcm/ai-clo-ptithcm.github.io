import { buildMarkWorkbook } from './exportMark.js';
import { buildDetailWorkbook } from './exportDetail.js';
import { getExcelJS, saveWorkbook } from './exportCommon.js';
import { addAnswerSheet } from './exportAnswerSheet.js';

async function fetchBuffer(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok) throw new Error('Không tải được mẫu Excel: '+url);return await r.arrayBuffer()}
function safeName(name,used){
  let n=String(name||'Phòng').replace(/[\\\/?*\[\]:]/g,' ').trim().slice(0,31)||'Phòng';
  let base=n,i=2; while(used.has(n)){const suf=` (${i++})`;n=(base.slice(0,31-suf.length)+suf)} used.add(n); return n;
}
function cloneValue(v){if(v===null||v===undefined)return v; if(v instanceof Date)return new Date(v); if(typeof v==='object')return JSON.parse(JSON.stringify(v)); return v}
function copySheet(source,target){
  source.eachRow({includeEmpty:true},(row,r)=>{
    const tr=target.getRow(r); tr.height=row.height;
    row.eachCell({includeEmpty:true},(cell,c)=>{
      const tc=tr.getCell(c); tc.value=cloneValue(cell.value); tc.style=cloneValue(cell.style); tc.numFmt=cell.numFmt; tc.alignment=cloneValue(cell.alignment); tc.border=cloneValue(cell.border); tc.fill=cloneValue(cell.fill); tc.font=cloneValue(cell.font); tc.protection=cloneValue(cell.protection);
    });
  });
  for(let c=1;c<=source.columnCount;c++){target.getColumn(c).width=source.getColumn(c).width; target.getColumn(c).hidden=source.getColumn(c).hidden}
  for(const merge of source.model?.merges||[]){try{target.mergeCells(merge)}catch{}}
  target.pageSetup=cloneValue(source.pageSetup); target.pageMargins=cloneValue(source.pageMargins); target.views=cloneValue(source.views); target.properties=cloneValue(source.properties);
}

function rangeRows(range){
  const rows=[...String(range).matchAll(/[A-Z]+(\d+)/g)].map(m=>Number(m[1]));
  return rows.length?{min:Math.min(...rows),max:Math.max(...rows)}:{min:-1,max:-1};
}

export function copyOfficeHeaderRows(source,target,{detail=false,rowCount=9}={}){
  if(!source||!target)return;

  // Bỏ các merge của mẫu trong vùng đầu để có thể chép đúng nguyên mẫu khảo thí.
  for(const merge of [...(target.model?.merges||[])]){
    const rr=rangeRows(merge);
    if(rr.min>0 && rr.min<=rowCount){try{target.unMergeCells(merge)}catch{}}
  }

  for(let r=1;r<=rowCount;r++){
    const sr=source.getRow(r), tr=target.getRow(r);
    tr.height=sr.height;
    for(let c=1;c<=10;c++){
      const sc=sr.getCell(c), tc=tr.getCell(c);
      tc.value=cloneValue(sc.value);
      tc.style=cloneValue(sc.style);
      tc.numFmt=sc.numFmt;
      tc.alignment=cloneValue(sc.alignment);
      tc.border=cloneValue(sc.border);
      tc.fill=cloneValue(sc.fill);
      tc.font=cloneValue(sc.font);
      tc.protection=cloneValue(sc.protection);
    }
  }

  for(const merge of source.model?.merges||[]){
    const rr=rangeRows(merge);
    if(rr.min>0 && rr.max<=rowCount){try{target.mergeCells(merge)}catch{}}
  }

  if(detail){
    for(let r=1;r<=rowCount;r++) for(let c=1;c<=10;c++){
      const cell=target.getCell(r,c);
      const text=String(cell.text??cell.value??'');
      if(/BẢNG\s*ĐIỂM\s*THEO\s*PHÁCH/i.test(text)){
        cell.value=text.replace(/BẢNG\s*ĐIỂM\s*THEO\s*PHÁCH/ig,'BẢNG ĐIỂM CHI TIẾT');
      }
    }
  }
}

async function loadOfficeWorkbook(buffer){
  if(!buffer)return null;
  try{
    const ExcelJS=getExcelJS();
    const wb=new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    return wb;
  }catch(err){
    console.warn('Không thể dùng file khảo thí làm nguồn phần đầu biểu mẫu:',err);
    return null;
  }
}

function prepareExportStudents(room){
  const students=room.untData.students||[];
  const by=new Map(students.map(s=>[String(Number(s.sbd)),s]));
  const officeRows=room.officeSheet?.rows?.length
    ? room.officeSheet.rows
    : (room.officeSheet?.sbds||[]).map(sbd=>({sbd,note:''}));
  if(!officeRows.length) return students;
  return officeRows.map(entry=>{
    const key=String(Number(entry.sbd));
    const found=by.get(key);
    if(found) return {...found,officeNote:entry.note??''};
    return {sbd:key,result:null,isAbsent:true,officeNote:entry.note??''};
  });
}

function officeWorksheetForRoom(officeWorkbook,room){
  if(!officeWorkbook||!room.officeSheet?.name)return null;
  return officeWorkbook.getWorksheet(room.officeSheet.name)||officeWorkbook.worksheets.find(ws=>ws.name===room.officeSheet.name)||null;
}

export async function exportMarkMulti(answerData, rooms, officeTemplateBuffer=null){
  const ExcelJS=getExcelJS(), master=new ExcelJS.Workbook(), used=new Set();
  const template=await fetchBuffer('templates/MarksTemplate.xlsx');
  const officeWorkbook=await loadOfficeWorkbook(officeTemplateBuffer);
  for(const room of rooms){
    room.untData.exportStudents=prepareExportStudents(room);
    const wb=await buildMarkWorkbook(answerData,room.untData,template);
    const built=wb.worksheets[0];
    const officeSheet=officeWorksheetForRoom(officeWorkbook,room);
    if(officeSheet) copyOfficeHeaderRows(officeSheet,built,{detail:false,rowCount:9});
    const ws=master.addWorksheet(safeName(room.displayName||room.officeSheet?.name||room.fileName,used));
    copySheet(built,ws);
    delete room.untData.exportStudents;
  }
  addAnswerSheet(master,answerData,{sheetName:'Đáp án'});
  await saveWorkbook(master,'Bang-diem-phach.xlsx');
}

export async function exportDetailMulti(answerData,rooms,officeTemplateBuffer=null){
  const ExcelJS=getExcelJS(), master=new ExcelJS.Workbook(), used=new Set();
  const template=await fetchBuffer('templates/DetailTemplate.xlsx');
  const officeWorkbook=await loadOfficeWorkbook(officeTemplateBuffer);
  for(const room of rooms){
    room.untData.exportStudents=prepareExportStudents(room);
    const wb=await buildDetailWorkbook(answerData,room.untData,template);
    const built=wb.worksheets[0];
    const officeSheet=officeWorksheetForRoom(officeWorkbook,room);
    if(officeSheet) copyOfficeHeaderRows(officeSheet,built,{detail:true,rowCount:9});
    const ws=master.addWorksheet(safeName(room.displayName||room.officeSheet?.name||room.fileName,used));
    copySheet(built,ws);
    delete room.untData.exportStudents;
  }
  await saveWorkbook(master,'Bang-diem-chi-tiet.xlsx');
}
