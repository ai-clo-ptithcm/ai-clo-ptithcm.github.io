/* AI-CLO PTITHCM — bulk question import from Excel with preview and safe per-question rollback. */
(() => {
'use strict';

const MAX_ROWS = 1000;
const OPTION_KEYS = ['A','B','C','D'];

const normalize = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ');

const normalizeQuestion = value => normalize(value).replace(/[“”‘’]/g, "'");
const safeFileName = value => String(value || 'hoc-phan')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .replace(/[^a-zA-Z0-9_-]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 70) || 'hoc-phan';

async function getXLSX() {
  if (window.XLSX) return window.XLSX;
  if (window.AICLO_OFFICE_LIBS?.xlsx) return window.AICLO_OFFICE_LIBS.xlsx();
  throw new Error('Không tải được thư viện Excel.');
}

function activeBank() {
  const bank = window.AICLO_V105?.activeBank?.();
  return ['practice','secure_exam','both'].includes(bank) ? bank : 'practice';
}

function bankLabel(scope) {
  if (scope === 'secure_exam') return 'Đề thi - bảo mật';
  if (scope === 'both') return 'Cả hai';
  return 'Luyện tập - kiểm tra';
}

function approvalLabel(status) {
  if (status === 'approved') return 'Đã duyệt';
  if (status === 'pending') return 'Chờ duyệt';
  return 'Bản nháp';
}

function readField(row, ...names) {
  for (const name of names) {
    if (row?.[name] != null) return String(row[name]).trim();
  }
  return '';
}

function parseScope(raw, fallback) {
  const text = String(raw || '').trim();
  const key = normalize(text);
  if (!text) return fallback;
  if (text === 'both' || key.includes('ca hai')) return 'both';
  if (text === 'secure_exam' || key.includes('de thi') || key.includes('bao mat')) return 'secure_exam';
  if (text === 'practice' || key.includes('luyen tap') || key.includes('kiem tra')) return 'practice';
  return null;
}

function parseApproval(raw) {
  const text = String(raw || '').trim();
  const key = normalize(text);
  if (!text || text === 'draft' || key.includes('ban nhap')) return 'draft';
  if (text === 'pending' || key.includes('cho duyet')) return 'pending';
  if (text === 'approved' || key.includes('da duyet')) return 'approved';
  return null;
}

function findChapter(text, chapters) {
  const normalized = normalize(text);
  const numberOnly = String(text || '').replace(/\D/g, '');
  return chapters.find(ch => normalize(ch.name) === normalized)
    || chapters.find(ch => numberOnly && String(ch.order_index) === numberOnly)
    || null;
}

function findTopic(text, chapter, topics) {
  if (!chapter) return null;
  const normalized = normalize(text);
  return topics.find(topic => topic.chapter_id === chapter.id && normalize(topic.name) === normalized) || null;
}

function findClo(text, clos) {
  const code = String(text || '').trim().toUpperCase();
  return clos.find(clo => String(clo.code || '').trim().toUpperCase() === code) || null;
}

function parseRow(row, sets, rowNo, fallbackScope) {
  const chapterText = readField(row, 'Chương', 'Chuong');
  const topicText = readField(row, 'Chủ đề', 'Chu de', 'Chủ đề/Mục', 'Chu de/Muc');
  const cloText = readField(row, 'CLO');
  const chapter = findChapter(chapterText, sets.ch || []);
  const topic = findTopic(topicText, chapter, sets.topics || []);
  const clo = findClo(cloText, sets.clos || []);
  const content = readField(row, 'Nội dung', 'Noi dung');
  const options = Object.fromEntries(OPTION_KEYS.map(key => [key, readField(row, key)]));
  const answerRaw = readField(row, 'Đáp án', 'Dap an').toUpperCase();
  const correctAnswer = OPTION_KEYS.includes(answerRaw) ? answerRaw : '';
  const scope = parseScope(readField(row, 'Ngân hàng', 'Ngan hang', 'Nhóm sử dụng', 'Nhom su dung'), fallbackScope);
  const approval = parseApproval(readField(row, 'Trạng thái', 'Trang thai'));
  const errors = [];

  if (!chapterText) errors.push('thiếu Chương');
  else if (!chapter) errors.push('không tìm thấy Chương');
  if (!topicText) errors.push('thiếu Chủ đề');
  else if (!topic) errors.push('không tìm thấy Chủ đề trong Chương');
  if (!cloText) errors.push('thiếu CLO');
  else if (!clo) errors.push('CLO không hợp lệ');
  if (!content) errors.push('thiếu nội dung');
  OPTION_KEYS.forEach(key => { if (!options[key]) errors.push(`thiếu phương án ${key}`); });
  if (!correctAnswer) errors.push('Đáp án phải là A, B, C hoặc D');
  if (!scope) errors.push('Ngân hàng không hợp lệ');
  if (!approval) errors.push('Trạng thái không hợp lệ');

  return {
    rowNo,
    chapter,
    topic,
    clo,
    content,
    options,
    correct_answer: correctAnswer,
    explanation: readField(row, 'Lời giải', 'Loi giai') || null,
    question_scope: scope || fallbackScope,
    approval_status: approval || 'draft',
    errors
  };
}

function flagDuplicates(parsed, existingItems = []) {
  const existing = new Set(existingItems.map(item => normalizeQuestion(item.content)).filter(Boolean));
  const seen = new Map();
  parsed.forEach(item => {
    const key = normalizeQuestion(item.content);
    if (!key) return;
    if (existing.has(key)) item.errors.push('trùng nội dung với câu đã có trong học phần');
    if (seen.has(key)) item.errors.push(`trùng nội dung với dòng ${seen.get(key)}`);
    else seen.set(key, item.rowNo);
  });
}

async function downloadTemplate(sets) {
  const XLSX = await getXLSX();
  const fallbackScope = activeBank();
  const firstChapter = sets.ch?.[0];
  const firstTopic = sets.topics?.find(topic => topic.chapter_id === firstChapter?.id);
  const sample = [{
    'Chương': firstChapter?.name || 'Chương 1',
    'Chủ đề': firstTopic?.name || 'Mục 1.1',
    'CLO': sets.clos?.[0]?.code || 'CLO1',
    'Nội dung': 'Nội dung câu hỏi',
    'A': 'Phương án A',
    'B': 'Phương án B',
    'C': 'Phương án C',
    'D': 'Phương án D',
    'Đáp án': 'A',
    'Lời giải': 'Giải thích ngắn',
    'Ngân hàng': bankLabel(fallbackScope),
    'Trạng thái': 'Bản nháp'
  }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sample), 'Cau_hoi');

  const chapterTopicRows = [];
  for (const chapter of sets.ch || []) {
    for (const topic of (sets.topics || []).filter(item => item.chapter_id === chapter.id)) {
      chapterTopicRows.push({'Chương': chapter.name, 'Chủ đề': topic.name});
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(chapterTopicRows), 'Chuong_Chu_de');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((sets.clos || []).map(clo => ({
    'CLO': clo.code,
    'Mô tả': clo.description || '',
    'Mô tả ngắn': clo.short_description || ''
  }))), 'CLO');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    {'Ngân hàng': 'Luyện tập - kiểm tra', 'Giá trị': 'practice'},
    {'Ngân hàng': 'Đề thi - bảo mật', 'Giá trị': 'secure_exam'},
    {'Ngân hàng': 'Cả hai', 'Giá trị': 'both'}
  ]), 'Huong_dan');

  XLSX.writeFile(wb, `Mau-nhap-cau-hoi-${safeFileName(activeSubject()?.name)}.xlsx`);
}

function previewHtml(parsed) {
  const bad = parsed.filter(item => item.errors.length);
  const goodCount = parsed.length - bad.length;
  return `<div class="import-summary"><b>Đã đọc ${parsed.length} câu</b><span class="badge green">Hợp lệ ${goodCount}</span><span class="badge ${bad.length ? 'red' : 'green'}">Có lỗi ${bad.length}</span></div>
    <div class="table-wrap"><table><thead><tr><th>Dòng</th><th>Chương · Chủ đề</th><th>CLO</th><th>Nội dung</th><th>Ngân hàng</th><th>Kiểm tra</th></tr></thead><tbody>
      ${parsed.map(item => `<tr class="${item.errors.length ? 'import-bad' : ''}"><td>${item.rowNo}</td><td>${esc(item.chapter?.name || '—')}<br><small>${esc(item.topic?.name || '—')}</small></td><td>${esc(item.clo?.code || '—')}</td><td>${esc(item.content.slice(0, 120))}</td><td>${esc(bankLabel(item.question_scope))}</td><td>${item.errors.length ? esc(item.errors.join('; ')) : '✓ Hợp lệ'}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="form-actions"><button id="confirmQuestionImport" class="primary" ${goodCount ? '' : 'disabled'}>Nhập ${goodCount} câu hợp lệ</button></div>`;
}

async function insertOne(item, subjectId) {
  const approval = item.approval_status;
  const {data: question, error: questionError} = await db.from('questions').insert({
    subject_id: subjectId,
    chapter_id: item.chapter.id,
    topic_id: item.topic.id,
    clo_id: item.clo.id,
    content: item.content,
    correct_answer: item.correct_answer,
    explanation: item.explanation,
    created_by: state.user.id,
    status: approval === 'approved' ? 'active' : 'draft',
    question_scope: item.question_scope,
    approval_status: approval,
    approved_by: approval === 'approved' ? state.user.id : null,
    approved_at: approval === 'approved' ? new Date().toISOString() : null
  }).select().single();
  if (questionError) throw questionError;

  const {error: optionsError} = await db.from('question_options').insert(OPTION_KEYS.map(key => ({
    question_id: question.id,
    option_key: key,
    content: item.options[key]
  })));
  if (!optionsError) return question;

  const {error: rollbackError} = await db.from('questions').delete().eq('id', question.id);
  if (rollbackError) console.error('Question import rollback failed', rollbackError);
  throw new Error(`Không lưu được A–D: ${optionsError.message || 'lỗi không xác định'}`);
}

async function importRows(parsed, subjectId, button, preview) {
  const good = parsed.filter(item => !item.errors.length);
  if (!good.length) return;
  const accepted = await confirmAction('Nhập câu hỏi', `Lưu ${good.length} câu hợp lệ vào học phần hiện tại? Các dòng lỗi sẽ bị bỏ qua.`, {confirmLabel: 'Nhập câu hỏi'});
  if (!accepted) return;

  button.disabled = true;
  const failures = [];
  let success = 0;
  for (let index = 0; index < good.length; index++) {
    const item = good[index];
    button.textContent = `Đang nhập ${index + 1}/${good.length}…`;
    try {
      await insertOne(item, subjectId);
      success++;
    } catch (error) {
      console.error('Bulk question import row failed', item.rowNo, error);
      failures.push({rowNo: item.rowNo, message: error?.message || 'Không lưu được câu hỏi'});
    }
  }

  window.logActivity?.('bulk_import', 'question', null, `Nhập hàng loạt ${success}/${good.length} câu hỏi`, success === good.length ? 'success' : 'warning', null, {subject_id: subjectId});

  if (!failures.length) {
    closeModal();
    toast(`Đã nhập ${success} câu hỏi`);
    await render();
    return;
  }

  preview.innerHTML = `<div class="panel"><h4>Kết quả nhập</h4><p><b>Thành công:</b> ${success}/${good.length} câu.</p><p class="hint">Các câu lỗi không được giữ lại nếu chưa lưu đủ 4 phương án A–D.</p>${failures.length ? `<div class="table-wrap"><table><thead><tr><th>Dòng</th><th>Lỗi</th></tr></thead><tbody>${failures.map(item => `<tr><td>${item.rowNo}</td><td>${esc(item.message)}</td></tr>`).join('')}</tbody></table></div>` : ''}<div class="form-actions"><button id="closeQuestionImport" class="primary">Đóng và làm mới</button></div></div>`;
  $('#closeQuestionImport').onclick = async () => { closeModal(); await render(); };
}

async function readWorkbook(file, sets, subjectId, preview) {
  const XLSX = await getXLSX();
  const workbook = XLSX.read(await file.arrayBuffer(), {type: 'array'});
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error('File Excel không có sheet dữ liệu.');
  const rows = XLSX.utils.sheet_to_json(firstSheet, {defval: ''})
    .filter(row => Object.values(row).some(value => String(value).trim()));
  if (!rows.length) throw new Error('Không tìm thấy dòng câu hỏi nào trong file.');
  if (rows.length > MAX_ROWS) throw new Error(`File có ${rows.length} dòng. Mỗi lần chỉ nhập tối đa ${MAX_ROWS} câu.`);

  const fallbackScope = activeBank();
  const parsed = rows.map((row, index) => parseRow(row, sets, index + 2, fallbackScope));
  flagDuplicates(parsed, sets.items || []);
  preview.innerHTML = previewHtml(parsed);
  const button = $('#confirmQuestionImport');
  if (button) button.onclick = () => importRows(parsed, subjectId, button, preview);
}

function open(sets) {
  if (!sets || !state.subjectId) return toast('Hãy chọn học phần trước khi nhập câu hỏi.', true);
  const subjectId = state.subjectId;
  modal('Nhập hàng loạt câu hỏi', `<div class="question-import"><p>Nhập bằng file <b>.xlsx</b> hoặc <b>.xls</b>. Mỗi dòng gồm Chương, Chủ đề, CLO, nội dung, A–D và đáp án.</p><div class="toolbar"><button id="downloadQuestionImportTemplate" class="secondary" type="button">↓ Tải Excel mẫu</button><label class="file-button">Chọn file Excel<input id="questionImportFile" type="file" accept=".xlsx,.xls" hidden></label></div><div id="questionImportPreview"><p class="hint">File chỉ được kiểm tra và xem trước. Hệ thống chưa lưu gì cho đến khi bạn nhấn “Nhập câu hỏi”.</p></div></div>`);

  $('#downloadQuestionImportTemplate').onclick = async () => {
    try { await downloadTemplate(sets); }
    catch (error) { err(error); }
  };
  $('#questionImportFile').onchange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const preview = $('#questionImportPreview');
    preview.innerHTML = '<div class="panel">Đang kiểm tra file Excel…</div>';
    try { await readWorkbook(file, sets, subjectId, preview); }
    catch (error) { preview.innerHTML = `<div class="panel"><b>Không đọc được file</b><p>${esc(error?.message || 'File Excel không hợp lệ.')}</p></div>`; err(error); }
  };
}

const api = Object.freeze({open, downloadTemplate, parseRow});
window.AICLO_QUESTION_IMPORT = api;

// Compatibility bridge for the current question-bank button. The implementation now lives here.
window.v102BulkImportQuestions = open;
})();
