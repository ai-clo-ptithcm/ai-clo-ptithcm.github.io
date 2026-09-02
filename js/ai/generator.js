/* AI-CLO PTITHCM v10.1 */
(() => {
  'use strict';

  async function functionError(error, fallback) {
    let payload = null;
    const response = error?.context;
    try {
      payload = response?.clone ? await response.clone().json() : null;
    } catch (_) {
      try {
        const text = response?.clone ? await response.clone().text() : '';
        if (text) payload = { error: text };
      } catch (_) {}
    }

    const message = payload?.error || payload?.message || error?.message || fallback;
    if (/non-2xx status code/i.test(message || '')) {
      return new Error(`${fallback}. Edge Function không trả về chi tiết lỗi; hãy kiểm tra Logs của hàm generate-questions.`);
    }
    return new Error(message || fallback);
  }

  async function invokeDetailed(name, body) {
    const { data, error } = await db.functions.invoke(name, { body });
    if (error) throw await functionError(error, 'Không thể gọi Gemini');
    if (!data?.success) throw new Error(data?.error || 'Gemini không tạo được câu hỏi');
    return data;
  }

  window.aiGenerateForm = function aiGenerateFormV101(sets) {
    if (!sets.ch.length || !sets.clos.length) {
      return toast('Học phần cần có chương và CLO trước khi tạo câu hỏi', true);
    }

    captureQuestionFilters();
    questionWorkspace(
      'Tạo câu hỏi bằng Gemini',
      'Thiết lập yêu cầu và tạo bản nháp trực tiếp trong trang.',
      `<form id="aiForm" class="form-grid v10-ai-page">
        <div class="ai-note wide"><b>Gemini chỉ tạo bản nháp.</b><span>AI đối chiếu các câu cùng phạm vi để tránh lặp; hệ thống kiểm tra độ tương đồng lần cuối khi giảng viên xác nhận.</span></div>
        <label class="field">Chương<select name="chapter_id" id="aiChapter" required>${sets.ch.map(v => `<option value="${v.id}">${esc(v.order_index)}. ${esc(v.name)}</option>`).join('')}</select></label>
        <label class="field">Chủ đề<select name="topic_id" id="aiTopic"></select></label>
        <label class="field">CLO<select name="clo_id" id="aiClo" required>${sets.clos.map(v => `<option value="${v.id}">${esc(v.code)}</option>`).join('')}</select></label>
        <label class="field">Số câu<select name="count"><option>5</option><option selected>10</option></select></label>
        <div id="cloDescription" class="clo-description wide"></div>
        <label class="field wide">Yêu cầu bổ sung<textarea name="additional_requirements" placeholder="Ví dụ: 4 câu lý thuyết, 6 câu vận dụng cơ bản…"></textarea></label>
        <div id="aiErrorBox" class="v101-function-error wide hidden" role="alert"></div>
        <div class="form-actions"><button type="button" id="cancelAiGenerate" class="secondary">Hủy</button><button class="ai-btn" id="aiSubmit">✦ Sinh câu hỏi</button></div>
      </form>`
    );

    const fillTopics = () => {
      $('#aiTopic').innerHTML = '<option value="">Tất cả chủ đề trong chương</option>' + sets.topics
        .filter(t => t.chapter_id === $('#aiChapter').value)
        .map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
    };
    const showClo = () => {
      const clo = sets.clos.find(c => c.id === $('#aiClo').value);
      $('#cloDescription').innerHTML = `<b>${esc(clo?.code || '')}</b><span>${esc(clo?.description || '')}</span>`;
      renderMath($('#cloDescription'));
    };

    fillTopics();
    showClo();
    $('#aiChapter').onchange = fillTopics;
    $('#aiClo').onchange = showClo;
    $('#cancelAiGenerate').onclick = backToQuestionList;
    $('#aiForm').onsubmit = async event => {
      event.preventDefault();
      const button = $('#aiSubmit');
      const errorBox = $('#aiErrorBox');
      const values = Object.fromEntries(new FormData(event.target));
      button.disabled = true;
      button.textContent = 'Gemini đang tạo…';
      errorBox.classList.add('hidden');
      errorBox.textContent = '';

      try {
        const data = await invokeDetailed('generate-questions', {
          subject_id: state.subjectId,
          chapter_id: values.chapter_id,
          topic_id: values.topic_id || null,
          clo_id: values.clo_id,
          count: Number(values.count),
          additional_requirements: values.additional_requirements || ''
        });
        toast(`Đã tạo ${data.total} câu chờ duyệt`);
        reviewBatch(data.batch_id, 0);
      } catch (error) {
        errorBox.textContent = error?.message || 'Không thể sinh câu hỏi.';
        errorBox.classList.remove('hidden');
        err(error);
        button.disabled = false;
        button.textContent = '✦ Sinh câu hỏi';
      }
    };
  };
})();
