import { orderedCloList } from './exportCommon.js';

function styleHeader(cell){cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1E5AA8'}};cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};}
function border(cell){cell.border={top:{style:'thin',color:{argb:'FFD9E2F0'}},left:{style:'thin',color:{argb:'FFD9E2F0'}},bottom:{style:'thin',color:{argb:'FFD9E2F0'}},right:{style:'thin',color:{argb:'FFD9E2F0'}}};}

export function addAnswerSheet(workbook,answerData,{sheetName='Đáp án',position='last'}={}){
  const existing=workbook.getWorksheet(sheetName);if(existing) workbook.removeWorksheet(existing.id);
  const ws=workbook.addWorksheet(sheetName);
  const codes=Object.keys(answerData?.exams||{}), total=Number(answerData?.totalQuestion||0);
  ws.getCell('A1').value='ĐÁP ÁN ĐÃ DÙNG ĐỂ CHẤM';ws.getCell('A1').font={bold:true,size:15};ws.mergeCells(1,1,1,Math.max(4,total+1));
  ws.getCell('A2').value='Nguồn đáp án';ws.getCell('B2').value=answerData?.sourceLabel||answerData?.sheetName||answerData?.layout||'—';
  ws.getCell('A3').value='Số mã đề';ws.getCell('B3').value=codes.length;
  ws.getCell('A4').value='Số câu';ws.getCell('B4').value=total;
  ws.getCell('A5').value='Thời điểm xuất';ws.getCell('B5').value=new Date();ws.getCell('B5').numFmt='dd/mm/yyyy hh:mm';
  const headerRow=7;ws.getCell(headerRow,1).value='Câu';styleHeader(ws.getCell(headerRow,1));
  for(let q=1;q<=total;q++){const c=ws.getCell(headerRow,q+1);c.value=q;styleHeader(c)}
  let r=8;
  for(const code of codes){
    const exam=answerData.exams[code];
    ws.getCell(r,1).value=code;styleHeader(ws.getCell(r,1));
    for(let q=1;q<=total;q++){ws.getCell(r,q+1).value=exam.questions?.[q]?.answer||'';border(ws.getCell(r,q+1));ws.getCell(r,q+1).alignment={horizontal:'center'}}
    r++;
    ws.getCell(r,1).value='CLO';styleHeader(ws.getCell(r,1));
    for(let q=1;q<=total;q++){ws.getCell(r,q+1).value=exam.questions?.[q]?.clo||'';border(ws.getCell(r,q+1));ws.getCell(r,q+1).alignment={horizontal:'center'}}
    r++;
  }
  ws.getColumn(1).width=16;for(let c=2;c<=total+1;c++) ws.getColumn(c).width=6;
  ws.views=[{state:'frozen',xSplit:1,ySplit:7}];
  return ws;
}
