const ANSWERS = new Set(['A', 'B', 'C', 'D']);
const CLOS = new Set(['CLO1', 'CLO2', 'CLO3']);

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeCode(value) {
  const raw = String(value ?? '').replace(/\s+/g, '');
  if (!raw) return '';
  return /^\d+$/.test(raw) ? raw.padStart(3, '0') : raw.toUpperCase();
}

function normalizeAnswer(value) {
  return String(value ?? '').replace(/\s+/g, '').toUpperCase();
}

function normalizeClo(value) {
  const raw = String(value ?? '').replace(/\s+/g, '').toUpperCase();
  if (/^[123]$/.test(raw)) return `CLO${raw}`;
  const match = raw.match(/^CLO([123])$/);
  return match ? `CLO${match[1]}` : raw;
}

function blankRow(versionCount) {
  return Array.from({ length: versionCount }, () => ({ answer: '', clo: '' }));
}

function clampQuestionCount(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 200) {
    throw new Error('Số câu phải là số nguyên từ 1 đến 200.');
  }
  return n;
}

export function createDirectAnswerGrid({
  host,
  questionInput,
  applyQuestionButton,
  verticalButton,
  horizontalButton,
  validateButton,
  clearButton,
  statusElement,
  validationElement,
  onChange = () => {}
}) {
  let questionCount = clampQuestionCount(questionInput?.value || 30);
  let orientation = 'vertical';
  let codes = ['101', '102', '103', '104'];
  let data = Array.from({ length: questionCount }, () => blankRow(codes.length));
  let validationTouched = false;

  function ensureShape() {
    while (data.length < questionCount) data.push(blankRow(codes.length));
    if (data.length > questionCount) data.length = questionCount;
    for (let q = 0; q < data.length; q++) {
      while (data[q].length < codes.length) data[q].push({ answer: '', clo: '' });
      if (data[q].length > codes.length) data[q].length = codes.length;
    }
  }

  function updateStatus() {
    if (!statusElement) return;
    statusElement.textContent = `${questionCount} câu • ${codes.length} mã đề • ${orientation === 'vertical' ? 'Dọc' : 'Ngang'}`;
  }

  function setValidationMessage(kind, text) {
    if (!validationElement) return;
    validationElement.classList.remove('is-ok', 'is-error', 'is-neutral');
    validationElement.classList.add(kind === 'ok' ? 'is-ok' : kind === 'error' ? 'is-error' : 'is-neutral');
    const textNode = validationElement.querySelector('[data-validation-text]');
    if (textNode) textNode.textContent = text;
  }

  function codeInputHtml(code, versionIndex, compact = false) {
    return `<input class="direct-code-input${compact ? ' direct-code-input--compact' : ''}" data-version="${versionIndex}" value="${esc(code)}" aria-label="Mã đề ${versionIndex + 1}">`;
  }

  function cellInputHtml(value, versionIndex, questionIndex, kind) {
    return `<input class="direct-grid-input" data-version="${versionIndex}" data-question="${questionIndex}" data-kind="${kind}" value="${esc(value)}" autocomplete="off" spellcheck="false" aria-label="${kind === 'answer' ? 'Đáp án' : 'CLO'} câu ${questionIndex + 1}, mã đề ${esc(codes[versionIndex])}">`;
  }

  function renderVertical() {
    const header = codes.map((code, v) => `
      <th class="direct-version-head direct-version-head--${(v % 4) + 1}">
        <div class="direct-version-title"><span>Mã đề</span>${codeInputHtml(code, v)}</div>
        <div class="direct-version-subtitle">Đáp án</div>
      </th>
      <th class="direct-version-head direct-version-head--${(v % 4) + 1}">CLO</th>`).join('');

    const rows = data.map((row, q) => `
      <tr>
        <td class="direct-question-cell">${q + 1}</td>
        ${row.map((entry, v) => `
          <td>${cellInputHtml(entry.answer, v, q, 'answer')}</td>
          <td>${cellInputHtml(entry.clo, v, q, 'clo')}</td>`).join('')}
      </tr>`).join('');

    host.innerHTML = `
      <div class="direct-grid-scroll">
        <table class="direct-excel-grid direct-excel-grid--vertical">
          <thead><tr><th class="direct-question-head">Câu</th>${header}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function renderHorizontal() {
    const questionHeaders = Array.from({ length: questionCount }, (_, i) => `<th class="direct-horizontal-question">${i + 1}</th>`).join('');
    const rows = codes.map((code, v) => `
      <tr>
        <td class="direct-horizontal-label"><span>Mã đề</span>${codeInputHtml(code, v, true)}</td>
        ${Array.from({ length: questionCount }, (_, q) => `<td>${cellInputHtml(data[q][v].answer, v, q, 'answer')}</td>`).join('')}
      </tr>
      <tr class="direct-clo-row">
        <td class="direct-horizontal-label direct-horizontal-label--clo">CLO</td>
        ${Array.from({ length: questionCount }, (_, q) => `<td>${cellInputHtml(data[q][v].clo, v, q, 'clo')}</td>`).join('')}
      </tr>`).join('');

    host.innerHTML = `
      <div class="direct-grid-scroll">
        <table class="direct-excel-grid direct-excel-grid--horizontal">
          <thead><tr><th class="direct-question-head">Câu</th>${questionHeaders}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function render() {
    ensureShape();
    if (orientation === 'vertical') renderVertical();
    else renderHorizontal();
    verticalButton?.classList.toggle('is-active', orientation === 'vertical');
    horizontalButton?.classList.toggle('is-active', orientation === 'horizontal');
    updateStatus();
    if (validationTouched) validate({ announce: false });
    else setValidationMessage('neutral', 'Chưa kiểm tra dữ liệu. Có thể dán trực tiếp từ Excel bằng Ctrl+V.');
  }

  function findVisibleCodeInput(versionIndex) {
    return host.querySelector(`.direct-code-input[data-version="${versionIndex}"]`);
  }

  function findVisibleCell(versionIndex, questionIndex, kind) {
    return host.querySelector(`.direct-grid-input[data-version="${versionIndex}"][data-question="${questionIndex}"][data-kind="${kind}"]`);
  }

  function normalizeVisibleInput(input) {
    if (!input) return;
    if (input.classList.contains('direct-code-input')) {
      const v = Number(input.dataset.version);
      const value = normalizeCode(input.value);
      codes[v] = value;
      input.value = value;
      return;
    }
    const v = Number(input.dataset.version);
    const q = Number(input.dataset.question);
    const kind = input.dataset.kind;
    const value = kind === 'answer' ? normalizeAnswer(input.value) : normalizeClo(input.value);
    data[q][v][kind] = value;
    input.value = value;
  }

  function syncFromDom() {
    host.querySelectorAll('.direct-code-input').forEach(normalizeVisibleInput);
    host.querySelectorAll('.direct-grid-input').forEach(normalizeVisibleInput);
  }

  function clearValidationMarks() {
    host.querySelectorAll('.direct-code-input, .direct-grid-input').forEach(input => {
      input.classList.remove('is-missing', 'is-invalid');
      input.removeAttribute('title');
    });
  }

  function mark(input, type, message) {
    if (!input) return;
    input.classList.add(type === 'missing' ? 'is-missing' : 'is-invalid');
    input.title = message;
  }

  function validateSingleInput(input) {
    if (!input) return;
    normalizeVisibleInput(input);
    input.classList.remove('is-missing', 'is-invalid');
    input.removeAttribute('title');

    if (input.classList.contains('direct-code-input')) {
      const v = Number(input.dataset.version);
      const code = codes[v];
      if (!code) {
        mark(input, 'missing', `Mã đề ${v + 1} đang để trống.`);
        return;
      }
      const duplicate = codes.findIndex((item, index) => index !== v && normalizeCode(item) === code);
      if (duplicate >= 0) {
        const message = `Mã đề ${code} bị trùng.`;
        mark(input, 'invalid', message);
        mark(findVisibleCodeInput(duplicate), 'invalid', message);
      }
      return;
    }

    const v = Number(input.dataset.version);
    const q = Number(input.dataset.question);
    const kind = input.dataset.kind;
    const value = data[q][v][kind];
    if (!value) {
      mark(input, 'missing', `Mã đề ${codes[v] || v + 1}, câu ${q + 1}: thiếu ${kind === 'answer' ? 'đáp án' : 'CLO'}.`);
      return;
    }
    if (kind === 'answer' && !ANSWERS.has(value)) {
      mark(input, 'invalid', `Đáp án “${value}” sai; chỉ nhận A, B, C, D.`);
    }
    if (kind === 'clo' && !CLOS.has(value)) {
      mark(input, 'invalid', `CLO “${value}” sai; chỉ nhận CLO1, CLO2, CLO3.`);
    }
  }

  function validate({ announce = true } = {}) {
    validationTouched = true;
    syncFromDom();
    clearValidationMarks();

    const errors = [];
    const missing = [];
    const seenCodes = new Map();

    codes = codes.map(normalizeCode);
    codes.forEach((code, v) => {
      const input = findVisibleCodeInput(v);
      if (input) input.value = code;
      if (!code) {
        const message = `Mã đề ${v + 1} đang để trống.`;
        missing.push(message);
        mark(input, 'missing', message);
        return;
      }
      if (seenCodes.has(code)) {
        const first = seenCodes.get(code);
        const message = `Mã đề ${code} bị trùng.`;
        errors.push(message);
        mark(input, 'invalid', message);
        mark(findVisibleCodeInput(first), 'invalid', message);
      } else seenCodes.set(code, v);
    });

    for (let q = 0; q < questionCount; q++) {
      for (let v = 0; v < codes.length; v++) {
        const answer = normalizeAnswer(data[q][v].answer);
        const clo = normalizeClo(data[q][v].clo);
        data[q][v].answer = answer;
        data[q][v].clo = clo;

        const answerInput = findVisibleCell(v, q, 'answer');
        const cloInput = findVisibleCell(v, q, 'clo');
        if (answerInput) answerInput.value = answer;
        if (cloInput) cloInput.value = clo;

        if (!answer) {
          const message = `Mã đề ${codes[v] || v + 1}, câu ${q + 1}: thiếu đáp án.`;
          missing.push(message);
          mark(answerInput, 'missing', message);
        } else if (!ANSWERS.has(answer)) {
          const message = `Mã đề ${codes[v] || v + 1}, câu ${q + 1}: đáp án “${answer}” sai; chỉ nhận A, B, C, D.`;
          errors.push(message);
          mark(answerInput, 'invalid', message);
        }

        if (!clo) {
          const message = `Mã đề ${codes[v] || v + 1}, câu ${q + 1}: thiếu CLO.`;
          missing.push(message);
          mark(cloInput, 'missing', message);
        } else if (!CLOS.has(clo)) {
          const message = `Mã đề ${codes[v] || v + 1}, câu ${q + 1}: CLO “${clo}” sai; chỉ nhận CLO1, CLO2, CLO3.`;
          errors.push(message);
          mark(cloInput, 'invalid', message);
        }
      }
    }

    const ok = errors.length === 0 && missing.length === 0;
    if (ok) {
      setValidationMessage('ok', `Dữ liệu hợp lệ: ${questionCount} câu, ${codes.length} mã đề.`);
    } else {
      setValidationMessage('error', `Còn ${missing.length} ô thiếu và ${errors.length} lỗi dữ liệu. Ô vàng = thiếu, ô đỏ = sai.`);
      if (announce) {
        const preview = [...errors, ...missing].slice(0, 8).join('\n');
        const suffix = errors.length + missing.length > 8 ? '\n…' : '';
        alert(`${preview}${suffix}`);
      }
    }
    return { ok, errors, missing };
  }

  function notifyChanged() {
    onChange();
    if (validationTouched) validate({ announce: false });
  }

  function applyQuestionCount() {
    try {
      syncFromDom();
      questionCount = clampQuestionCount(questionInput.value);
      ensureShape();
      validationTouched = false;
      render();
      notifyChanged();
    } catch (error) {
      alert(error.message);
      questionInput.value = questionCount;
    }
  }

  function setOrientation(next) {
    if (next === orientation) return;
    syncFromDom();
    orientation = next;
    render();
  }

  function clearAll() {
    if (!confirm('Xóa toàn bộ đáp án và CLO đang nhập?')) return;
    data = Array.from({ length: questionCount }, () => blankRow(codes.length));
    validationTouched = false;
    render();
    onChange();
  }

  function setCellFromPaste(input, value) {
    input.value = value;
    normalizeVisibleInput(input);
  }

  function pasteMatrix(target, text) {
    const matrix = String(text ?? '')
      .replace(/\r/g, '')
      .split('\n')
      .filter((row, index, arr) => !(index === arr.length - 1 && row === ''))
      .map(row => row.split('\t'));
    if (!matrix.length) return false;

    const rowElements = [...host.querySelectorAll('tbody tr')];
    const startRow = rowElements.indexOf(target.closest('tr'));
    if (startRow < 0) return false;
    const startRowInputs = [...rowElements[startRow].querySelectorAll('.direct-grid-input')];
    const startCol = startRowInputs.indexOf(target);
    if (startCol < 0) return false;

    const changedInputs = [];
    matrix.forEach((rowValues, rowOffset) => {
      const row = rowElements[startRow + rowOffset];
      if (!row) return;
      const inputs = [...row.querySelectorAll('.direct-grid-input')];
      rowValues.forEach((value, colOffset) => {
        const input = inputs[startCol + colOffset];
        if (input) {
          setCellFromPaste(input, value);
          changedInputs.push(input);
        }
      });
    });
    changedInputs.forEach(validateSingleInput);
    onChange();
    if (validationTouched) validate({ announce: false });
    return true;
  }

  function getStore({ requireValid = true } = {}) {
    const check = validate({ announce: false });
    if (requireValid && !check.ok) {
      const first = [...check.errors, ...check.missing][0] || 'Dữ liệu chưa hợp lệ.';
      throw new Error(`${first}\nHãy sửa các ô màu đỏ/vàng rồi thử lại.`);
    }
    const store = { exams: {} };
    codes.forEach((code, v) => {
      store.exams[code] = {
        answers: data.map(row => row[v].answer),
        clos: data.map(row => row[v].clo)
      };
    });
    return store;
  }

  function setStore(store) {
    const entries = Object.entries(store?.exams || {});
    if (!entries.length) return;
    codes = entries.map(([code]) => normalizeCode(code));
    questionCount = Math.max(1, ...entries.map(([, exam]) => Math.max(exam.answers?.length || 0, exam.clos?.length || 0)));
    questionInput.value = questionCount;
    data = Array.from({ length: questionCount }, (_, q) => entries.map(([, exam]) => ({
      answer: normalizeAnswer(exam.answers?.[q] ?? ''),
      clo: normalizeClo(exam.clos?.[q] ?? '')
    })));
    validationTouched = false;
    render();
  }

  host.addEventListener('input', event => {
    const input = event.target.closest('.direct-grid-input, .direct-code-input');
    if (!input) return;
    input.classList.remove('is-missing', 'is-invalid');
    onChange();
  });

  host.addEventListener('blur', event => {
    const input = event.target.closest('.direct-grid-input, .direct-code-input');
    if (!input) return;
    validateSingleInput(input);
    if (validationTouched) validate({ announce: false });
  }, true);

  host.addEventListener('paste', event => {
    const target = event.target.closest('.direct-grid-input');
    if (!target) return;
    const text = event.clipboardData?.getData('text/plain') || '';
    if (!text.includes('\t') && !text.includes('\n')) return;
    event.preventDefault();
    pasteMatrix(target, text);
  });

  applyQuestionButton?.addEventListener('click', applyQuestionCount);
  questionInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyQuestionCount();
    }
  });
  verticalButton?.addEventListener('click', () => setOrientation('vertical'));
  horizontalButton?.addEventListener('click', () => setOrientation('horizontal'));
  validateButton?.addEventListener('click', () => validate({ announce: true }));
  clearButton?.addEventListener('click', clearAll);

  render();

  return {
    getStore,
    setStore,
    validate,
    render,
    getQuestionCount: () => questionCount,
    getOrientation: () => orientation
  };
}
