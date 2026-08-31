import { sheetToArray } from './excel.js';

function toNat(v){
  const s=String(v??'').trim();
  if(!/^\d+$/.test(s)) return null;
  return String(Number(s));
}

function compact(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/[^a-z0-9]/g,'')}

function findSbdColumn(data){
  for(let r=0;r<Math.min(data.length,30);r++){
    for(let c=0;c<(data[r]?.length||0);c++){
      const t=compact(data[r][c]);
      if(['sbd','sobaodanh','sophach','maphach','phach'].includes(t)) return {headerRow:r,col:c};
    }
  }
  // fallback: cột có nhiều số tự nhiên nhất
  let best={col:-1,score:0};
  const maxCols=Math.max(0,...data.map(r=>r?.length||0));
  for(let c=0;c<maxCols;c++){
    let ok=0,total=0;
    for(let r=0;r<Math.min(data.length,200);r++){
      const raw=String(data[r]?.[c]??'').trim(); if(!raw) continue; total++; if(/^\d+$/.test(raw)) ok++;
    }
    const score=total?ok/total:0;
    if(ok>=3 && score>best.score) best={col:c,score};
  }
  return best.col>=0?{headerRow:-1,col:best.col}:null;
}


function findNoteColumn(data, preferredRow = -1){
  const aliases=new Set(['ghichu','note','notes']);
  if(preferredRow>=0){
    for(let c=0;c<(data[preferredRow]?.length||0);c++) if(aliases.has(compact(data[preferredRow][c]))) return c;
  }
  for(let r=0;r<Math.min(data.length,30);r++){
    for(let c=0;c<(data[r]?.length||0);c++) if(aliases.has(compact(data[r][c]))) return c;
  }
  return -1;
}

function extractMetadata(data){
  const keys={courseName:['tenhocphan','mon','tenmon'],courseCode:['mahocphan','mamon'],semester:['hocky'],schoolYear:['namhoc'],department:['bomon','khoabomon'],examDate:['ngaythi'],shift:['cathi'],room:['phongthi','phong']};
  const meta={};
  for(let r=0;r<Math.min(data.length,40);r++) for(let c=0;c<(data[r]?.length||0);c++){
    const k=compact(data[r][c]);
    for(const [name,aliases] of Object.entries(keys)) if(!meta[name] && aliases.some(a=>k.includes(a))){
      const right=data[r]?.[c+1]; const below=data[r+1]?.[c]; meta[name]=String(right||below||'').trim();
    }
  }
  return meta;
}

export function parseExamOfficeWorkbook(workbook){
  const sheets=[];
  for(const name of workbook.SheetNames||[]){
    const data=sheetToArray(workbook,name);
    const found=findSbdColumn(data);
    if(!found) continue;
    const sbds=[];
    const rows=[];
    const noteCol=findNoteColumn(data,found.headerRow);
    const seen=new Set();
    for(let r=Math.max(0,found.headerRow+1);r<data.length;r++){
      const s=toNat(data[r]?.[found.col]);
      if(s===null || seen.has(s)) continue;
      seen.add(s);
      const note=noteCol>=0 ? data[r]?.[noteCol] : '';
      sbds.push(s);
      rows.push({sbd:s,note:note??''});
    }
    if(sbds.length) sheets.push({name,sbds,rows,noteColumn:noteCol,metadata:extractMetadata(data)});
  }
  return {sheets};
}

export function suggestOfficeSheet(untData, officeData){
  const roomSbds=new Set((untData.students||[]).map(s=>String(Number(s.sbd))).filter(x=>x!=='NaN'));
  let best=null;
  for(const sheet of officeData?.sheets||[]){
    let hits=0; for(const s of sheet.sbds) if(roomSbds.has(s)) hits++;
    const denom=Math.max(1,Math.min(roomSbds.size,sheet.sbds.length));
    const score=hits/denom;
    if(!best || hits>best.hits || (hits===best.hits && score>best.score)) best={sheet,hits,score};
  }
  return best;
}
