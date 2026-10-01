
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const src=fs.readFileSync(new URL('../js/core.js',import.meta.url),'utf8');
const m=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
assert.equal(m.normalize('001','mssv'),'001');
assert.equal(m.normalize('+84 912 345 678','phone'),'0912345678');
assert.equal(m.normalize('1/2/2000','dob'),'2000-02-01');
assert.equal(m.normalize('31/2/2000','dob'),'');
assert.equal(m.normalize('29/2/2000','dob'),'2000-02-29');
assert.deepEqual(m.parseTSV('"a\nb"\t"c""d"\n001\t8\n'),[['a\nb','c"d'],['001','8']]);
assert.equal(m.tableFromMatrix([['title'],['MSSV','Điểm'],['001',8]],1).rows[0][0],'001');
m.validateTable(['MSSV','Điểm'],[['001','8']],[1],[{column:0,type:'mssv'}]);
assert.throws(()=>m.validateTable(['MSSV','Điểm'],[['001','8'],['001','9']],[1],[{column:0,type:'mssv'}]),/trùng/);
assert.throws(()=>m.validateTable(['MSSV','Điểm'],[['','8']],[1],[{column:0,type:'mssv'}]),/trống/);
assert.throws(()=>m.validateTable(['MSSV','MSSV'],[['001','8']],[1],[{column:0,type:'mssv'}]),/trùng/);
m.validateTable(['MSSV','Mã','Điểm'],[['001','abc','8'],['001','def','9']],[2],[{column:0,type:'mssv'},{column:1,type:'code'}]);
console.log('Core data validation passed.');
