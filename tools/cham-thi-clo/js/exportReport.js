import { getExcelJS, saveWorkbook, orderedCloList, cloDisplayName, exportSbdValue } from './exportCommon.js';
import { addAnswerSheet } from './exportAnswerSheet.js';

function colLetter(n){let s='';while(n>0){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)}return s}
function styleTitle(cell){cell.font={bold:true,size:15,color:{argb:'FF17365D'}};}
function styleSection(row){row.eachCell(c=>{c.font={bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1E5AA8'}};c.alignment={vertical:'middle',wrapText:true}})}
function box(range){range.eachCell(c=>{c.border={top:{style:'thin',color:{argb:'FFD9E2F0'}},left:{style:'thin',color:{argb:'FFD9E2F0'}},bottom:{style:'thin',color:{argb:'FFD9E2F0'}},right:{style:'thin',color:{argb:'FFD9E2F0'}}};c.alignment={vertical:'middle',wrapText:true}})}

function addAllWorkSheet(wb,answerData,rooms){
  const ws=wb.addWorksheet('Toàn bộ bài làm');
  const total=Number(answerData.totalQuestion||0), clos=orderedCloList(answerData);
  const cloPairs=clos.map((raw,i)=>({raw,label:cloDisplayName(raw,i)}));
  const headers=['Phòng / File','SBD','Mã đề',...Array.from({length:total},(_,i)=>`Câu ${i+1}`),'Số câu đúng','GPA',...cloPairs.map(x=>x.label)];
  ws.addRow(headers);styleSection(ws.getRow(1));
  for(const room of rooms){
    for(const s of [...(room.untData.students||[])].sort((a,b)=>Number(a.sbd)-Number(b.sbd))){
      const row=[room.displayName||room.fileName,exportSbdValue(s.sbd),s.examCode,...(s.answers||[]).slice(0,total),s.result?.correct??null,s.result?.marks?.GPA??null,...cloPairs.map(c=>s.result?.marks?.[c.raw]??null)];
      ws.addRow(row);
    }
  }
  ws.views=[{state:'frozen',xSplit:3,ySplit:1}];
  ws.getColumn(1).width=26;ws.getColumn(2).width=10;ws.getColumn(3).width=10;
  for(let c=4;c<=3+total;c++) ws.getColumn(c).width=8;
  ws.getColumn(4+total).width=13;ws.getColumn(5+total).width=10;for(let i=0;i<clos.length;i++) ws.getColumn(6+total+i).width=10;
  if(ws.rowCount>1){ws.getRange?.('A1');}
  return {ws,headers,clos,total,cloPairs};
}

function addBm33Sheet(wb,answerData,allInfo,review={}){
  const ws=wb.addWorksheet('BM33 - Báo cáo');
  const {headers,clos,cloPairs,total}=allInfo; const dataSheet="'Toàn bộ bài làm'"; const first=2,last=Math.max(2,allInfo.ws.rowCount);
  const idx=(name)=>headers.indexOf(name)+1;
  const gpaCol=colLetter(idx('GPA')); const correctCol=colLetter(idx('Số câu đúng'));
  const gpaRange=`${dataSheet}!$${gpaCol}$${first}:$${gpaCol}$${last}`;
  ws.columns=[{width:34},{width:18},{width:18},{width:18},{width:18},{width:22},{width:22}];
  ws.getCell('A1').value='BIỂU MẪU BM33 - BÁO CÁO PHÂN TÍCH KẾT QUẢ THI';styleTitle(ws.getCell('A1'));ws.mergeCells('A1:G1');
  const info=[['Tên học phần','...'],['Mã học phần','...'],['Số tín chỉ','...'],['Học kỳ/Năm học','...'],['Giảng viên phụ trách','...'],['Khoa/Bộ môn','...']];
  let r=3;for(const [k,v] of info){ws.getCell(r,1).value=k;ws.getCell(r,2).value=v;r++}
  r++;
  ws.getCell(r,1).value='Tỷ trọng theo học phần (%) - giảng viên nhập';ws.mergeCells(r,1,r,3);styleSection(ws.getRow(r));r++;
  const weightStart=r;
  for(const pair of cloPairs){ws.getCell(r,1).value=pair.label;ws.getCell(r,2).value='...';r++}
  ws.getCell(r,1).value='GPA';ws.getCell(r,2).value='...';r++;
  ws.getCell(r,1).value='Tổng tỷ trọng';
  const weightCells=Array.from({length:clos.length+1},(_,i)=>`B${weightStart+i}`).join(',');
  ws.getCell(r,2).value={formula:`IF(COUNT(${weightCells})=0,"...",SUM(${weightCells}))`};
  r+=2;

  ws.getCell(r,1).value='1. Thống kê điểm thi';ws.getCell(r,2).value='Giá trị';styleSection(ws.getRow(r));r++;
  const stats=[
    ['Số sinh viên dự thi',{formula:`COUNT(${gpaRange})`}],
    ['Điểm trung bình',{formula:`IFERROR(AVERAGE(${gpaRange}),"")`}],
    ['Điểm cao nhất',{formula:`IFERROR(MAX(${gpaRange}),"")`}],
    ['Điểm thấp nhất',{formula:`IFERROR(MIN(${gpaRange}),"")`}],
    ['Tỷ lệ đạt (≥4.0/10)',{formula:`IFERROR(COUNTIF(${gpaRange},">=4")/COUNT(${gpaRange}),0)`}],
    ['Tỷ lệ không đạt (<4.0/10)',{formula:`IFERROR(COUNTIF(${gpaRange},"<4")/COUNT(${gpaRange}),0)`}]
  ];
  for(const [k,v] of stats){ws.getCell(r,1).value=k;ws.getCell(r,2).value=v;if(String(k).startsWith('Tỷ lệ')) ws.getCell(r,2).numFmt='0.0%';else if(k!=='Số sinh viên dự thi') ws.getCell(r,2).numFmt='0.0';r++}
  r++;

  ws.getCell(r,1).value='2.1 Phân bố điểm thi theo xếp loại';ws.getCell(r,2).value='Số lượng';ws.getCell(r,3).value='Tỷ lệ';styleSection(ws.getRow(r));r++;
  const cats=[['Kém',`COUNTIF(${gpaRange},"<4")`],['Yếu',`COUNTIFS(${gpaRange},">=4",${gpaRange},"<5")`],['Trung bình',`COUNTIFS(${gpaRange},">=5",${gpaRange},"<7")`],['Khá',`COUNTIFS(${gpaRange},">=7",${gpaRange},"<8")`],['Giỏi',`COUNTIFS(${gpaRange},">=8",${gpaRange},"<9")`],['Xuất sắc',`COUNTIF(${gpaRange},">=9")`]];
  const catStart=r;for(const [n,f] of cats){ws.getCell(r,1).value=n;ws.getCell(r,2).value={formula:f};ws.getCell(r,3).value={formula:`IFERROR(B${r}/COUNT(${gpaRange}),0)`};ws.getCell(r,3).numFmt='0.0%';r++}
  r++;

  ws.getCell(r,1).value='2.2 Thống kê mức đạt theo CLO';for(let i=0;i<5;i++)ws.getCell(r,i+2).value=`Mức ${i}`;styleSection(ws.getRow(r));r++;
  for(const pair of cloPairs){
    const clo=pair.label; const c=colLetter(idx(clo)),range=`${dataSheet}!$${c}$${first}:$${c}$${last}`;ws.getCell(r,1).value=clo;
    const fs=[`COUNTIF(${range},"<4")`,`COUNTIFS(${range},">=4",${range},"<5.5")`,`COUNTIFS(${range},">=5.5",${range},"<7")`,`COUNTIFS(${range},">=7",${range},"<8.5")`,`COUNTIF(${range},">=8.5")`];
    fs.forEach((f,i)=>ws.getCell(r,i+2).value={formula:`IFERROR(${f}/COUNT(${range}),0)`});for(let i=2;i<=6;i++)ws.getCell(r,i).numFmt='0.0%';r++;
  }
  r++;
  ws.getCell(r,1).value='Điều kiện đạt các mức CLO';ws.getCell(r,2).value='Mức 0: <4';ws.getCell(r,3).value='Mức 1: 4–<5.5';ws.getCell(r,4).value='Mức 2: 5.5–<7';ws.getCell(r,5).value='Mức 3: 7–<8.5';ws.getCell(r,6).value='Mức 4: ≥8.5';styleSection(ws.getRow(r));r+=2;

  ws.getCell(r,1).value='3. Phân tích độ khó & độ phân hóa';ws.getCell(r,2).value='CLO';ws.getCell(r,3).value='Tỷ lệ trả lời đúng / đạt (%)';ws.getCell(r,4).value='Độ khó';ws.getCell(r,5).value='Độ phân hóa';ws.getCell(r,6).value='Nhận xét';styleSection(ws.getRow(r));r++;
  for(const pair of cloPairs){const clo=pair.label; const c=colLetter(idx(clo)),range=`${dataSheet}!$${c}$${first}:$${c}$${last}`;ws.getCell(r,1).value='...';ws.getCell(r,2).value=clo;ws.getCell(r,3).value={formula:`IFERROR(AVERAGE(${range})/10,0)`};ws.getCell(r,3).numFmt='0.0%';ws.getCell(r,4).value='...';ws.getCell(r,5).value='...';ws.getCell(r,6).value='...';r++}
  r++;

  ws.getCell(r,1).value='4. Mức độ đạt chuẩn đầu ra (CLO)';ws.getCell(r,2).value='Tỷ lệ SV đạt (%)';ws.getCell(r,3).value='Mức độ đạt yêu cầu (≥70%)';ws.getCell(r,4).value='Nhận xét';styleSection(ws.getRow(r));r++;
  for(const pair of cloPairs){const clo=pair.label; const c=colLetter(idx(clo)),range=`${dataSheet}!$${c}$${first}:$${c}$${last}`;ws.getCell(r,1).value=clo;ws.getCell(r,2).value={formula:`IFERROR(COUNTIF(${range},">=4")/COUNT(${range}),0)`};ws.getCell(r,2).numFmt='0.0%';ws.getCell(r,3).value={formula:`IF(B${r}>=70%,"Đạt","Chưa đạt")`};ws.getCell(r,4).value='...';r++}
  r++;
  ws.getCell(r,1).value='5. Nhận xét của giảng viên chấm thi/giảng dạy';styleSection(ws.getRow(r));r++;
  ['Mức độ phù hợp giữa đề thi và đề cương học phần','Tính phân hóa, bao quát nội dung','Tình huống phát sinh trong thi/chấm thi'].forEach(t=>{ws.getCell(r,1).value=t;ws.getCell(r,2).value='...';ws.mergeCells(r,2,r,7);r++});
  r++;
  ws.getCell(r,1).value='6. Khuyến nghị cải tiến';styleSection(ws.getRow(r));r++;
  ['Đối với ngân hàng đề thi','Đối với giảng dạy học phần','Đối với chương trình đào tạo'].forEach(t=>{ws.getCell(r,1).value=t;ws.getCell(r,2).value='...';ws.mergeCells(r,2,r,7);r++});
  r++;
  ws.getCell(r,1).value='Ghi chú';ws.getCell(r,2).value='Các ô “...” là nội dung giảng viên nhập hoặc có thể được AI hỗ trợ ở phiên bản sau. Các ô thống kê đã gắn công thức Excel.';ws.mergeCells(r,2,r,7);
  for(let rr=3;rr<=r;rr++){for(let cc=1;cc<=7;cc++){const cell=ws.getCell(rr,cc);cell.border={top:{style:'thin',color:{argb:'FFE2E8F0'}},left:{style:'thin',color:{argb:'FFE2E8F0'}},bottom:{style:'thin',color:{argb:'FFE2E8F0'}},right:{style:'thin',color:{argb:'FFE2E8F0'}}};cell.alignment={vertical:'middle',wrapText:true}}}
  for(let rr=3;rr<=8;rr++){ws.getCell(rr,2).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF7D6'}}}
  for(let rr=weightStart;rr<weightStart+clos.length+1;rr++){ws.getCell(rr,2).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF7D6'}}}
  ws.views=[{state:'frozen',ySplit:1}];
  applyBm33Review(ws,review);
  return ws;
}

function applyBm33Review(ws,review={}){
  const notes=review.notes||{},meta=review.metadata||{},stats=review.stats||{};
  const fieldRows={courseName:3,courseCode:4,credits:5,semester:6,teacher:7,department:8};
  for(const [name,row] of Object.entries(fieldRows))if(meta[name])ws.getCell(row,2).value=String(meta[name]).slice(0,160);
  const find=(label)=>{
    for(let r=1;r<=ws.rowCount;r++)if(String(ws.getCell(r,1).value||'')===label)return r;
    return -1;
  };
  // The existing report has template placeholders. Fill only reviewed text cells.
  const setNext=(heading,key,index=0)=>{
    const r=find(heading);if(r>0 && notes[key])ws.getCell(r+1+index,2).value=String(notes[key]).slice(0,1800);
  };
  setNext('5. Nhận xét của giảng viên chấm thi/giảng dạy','alignment',0);
  setNext('5. Nhận xét của giảng viên chấm thi/giảng dạy','coverage',1);
  setNext('5. Nhận xét của giảng viên chấm thi/giảng dạy','incidents',2);
  setNext('6. Khuyến nghị cải tiến','bank',0);
  setNext('6. Khuyến nghị cải tiến','teaching',1);
  setNext('6. Khuyến nghị cải tiến','curriculum',2);
  const section3=find('3. Phân tích độ khó & độ phân hóa');
  for(const [i,clo] of (stats.itemsByClo||[]).entries()){
    const r=section3+1+i;if(section3<0||r>ws.rowCount)continue;
    if(clo.rate!=null)ws.getCell(r,3).value=Number(clo.rate);
    if(clo.rate!=null)ws.getCell(r,4).value=clo.rate>=.8?'Tương đối dễ':clo.rate<.3?'Tương đối khó':'Trung bình';
    if(clo.discrimination!=null)ws.getCell(r,5).value=Number(clo.discrimination);
    else ws.getCell(r,5).value='Chưa đủ mẫu';
    if(notes.difficulty)ws.getCell(r,6).value=String(notes.difficulty).slice(0,1800);
  }
  const section4=find('4. Mức độ đạt chuẩn đầu ra (CLO)');
  if(section4>0){
    for(const [i,clo] of (stats.clos||[]).entries()){
      if(clo.passRate!=null){
        ws.getCell(section4+1+i,2).value=Number(clo.passRate);
        ws.getCell(section4+1+i,2).numFmt='0.0%';
      }
      if(notes.clo)ws.getCell(section4+1+i,4).value=String(notes.clo).slice(0,1800);
    }
  }
  const last=ws.rowCount+2;
  ws.getCell(last,1).value='Lưu ý';
  ws.getCell(last,2).value='Các nhận xét AI chỉ là gợi ý; giảng viên chịu trách nhiệm kiểm duyệt. Thống kê và điểm không do AI quyết định.';
  ws.mergeCells(last,2,last,7);
}

function addItemAnalysis(wb,stats){
  if(!Array.isArray(stats?.items)||!stats.items.length)return;
  const ws=wb.addWorksheet('Phân tích câu hỏi');
  ws.addRow(['Mã đề','Câu','CLO','Số bài','Số đúng','Tỷ lệ đúng','Độ phân hóa D']);
  styleSection(ws.getRow(1));
  for(const item of stats.items){
    const row=ws.addRow([item.code,item.question,item.clo,item.responses,item.correct,item.rate,item.discrimination]);
    row.getCell(6).numFmt='0.0%'; row.getCell(7).numFmt='0.000';
  }
  ws.columns=[{width:14},{width:10},{width:12},{width:14},{width:14},{width:18},{width:20}];
  ws.views=[{state:'frozen',ySplit:1}];
}

export function buildReportWorkbook(answerData,rooms,review={}){
  const ExcelJS=getExcelJS(),wb=new ExcelJS.Workbook();wb.calcProperties={fullCalcOnLoad:true,forceFullCalc:true};
  addAnswerSheet(wb,answerData,{sheetName:'Đáp án'});
  const all=addAllWorkSheet(wb,answerData,rooms);
  addBm33Sheet(wb,answerData,all,review);
  addItemAnalysis(wb,review.stats);
  return wb;
}

export async function exportReport(answerData,rooms,review={}){
  const wb=buildReportWorkbook(answerData,rooms,review);
  await saveWorkbook(wb,'Bao-cao-phan-tich-ket-qua-thi.xlsx');
}
