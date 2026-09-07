/* AI-CLO PTITHCM V12.6.14 — Assessment quick edit writes to the source question first.
   The builder's existing draft override is still invoked after the database save so the
   current exam snapshot cannot overwrite the corrected bank content with an older copy. */
(() => {
  'use strict';

  let activeQuick = null;
  let bypassOriginalSave = false;
  let enhanceQueued = false;
  const OPTION_KEYS = ['A', 'B', 'C', 'D'];

  const escText = value => String(value ?? '').trim();
  const normCode = value => String(value ?? '').trim();

  function currentBuilder() {
    return document.querySelector('.assessment-builder-v122');
  }

  function currentDrawerIsQuickEdit() {
    const title = document.querySelector('#drawerTitle')?.textContent || '';
    return /Sửa nhanh/i.test(title) && !!document.querySelector('#v123EditSave');
  }

  function decorateQuickEditUi() {
    if (!currentDrawerIsQuickEdit()) return;
    const eyebrow = document.querySelector('#drawerEyebrow');
    if (eyebrow) eyebrow.textContent = 'SỬA CÂU HỎI';
    const save = document.querySelector('#v123EditSave');
    if (save && !save.disabled) save.textContent = 'Lưu vào câu hỏi';
    const hint = document.querySelector('#sideDrawer .ub-quick-edit > .hint');
    if (hint) {
      const code = activeQuick?.code || hint.querySelector('b')?.textContent || '';
      hint.innerHTML = `<b>${typeof esc === 'function' ? esc(code) : code}</b> · Sửa trực tiếp câu gốc trong Ngân hàng câu hỏi. Bài kiểm tra hiện tại sẽ dùng nội dung mới sau khi lưu thay đổi.`;
    }
  }

  function decorateBuilderHint(root = currentBuilder()) {
    if (!root) return;
    root.querySelectorAll('.panel-head .hint').forEach(p => {
      if (/Đổi câu\/Gemini chỉ sửa bản nháp/i.test(p.textContent || '')) {
        p.textContent = 'Sửa nhanh cập nhật trực tiếp câu trong Ngân hàng câu hỏi. Đổi câu/Gemini chỉ thay bộ câu của bài; bấm Lưu để cập nhật snapshot trong DB.';
      }
    });
  }

  function queueEnhance() {
    if (enhanceQueued) return;
    enhanceQueued = true;
    requestAnimationFrame(() => {
      enhanceQueued = false;
      decorateQuickEditUi();
      decorateBuilderHint();
    });
  }

  function readQuickForm() {
    const content = escText(document.querySelector('#v123EditContent')?.value);
    const explanation = escText(document.querySelector('#v123EditExplanation')?.value);
    const correct = String(document.querySelector('input[name="v123EditCorrect"]:checked')?.value || '').toUpperCase();
    const options = Object.fromEntries(OPTION_KEYS.map(k => [k, escText(document.querySelector(`[data-v123-edit-option="${k}"]`)?.value)]));
    if (!content) throw new Error('Nội dung câu hỏi không được để trống.');
    for (const k of OPTION_KEYS) if (!options[k]) throw new Error(`Phương án ${k} không được để trống.`);
    if (!OPTION_KEYS.includes(correct)) throw new Error('Cần chọn đáp án đúng.');
    return { content, explanation: explanation || null, correct_answer: correct, options };
  }

  async function resolveQuestion() {
    if (!activeQuick) throw new Error('Không xác định được câu hỏi đang sửa.');
    const code = normCode(activeQuick.code);
    let query = db.from('questions').select('id,subject_id,display_code,chapter_id,topic_id,clo_id,content,correct_answer,explanation,created_by,question_options(id,option_key,content)').eq('subject_id', state.subjectId);
    if (code && !/^Q-/i.test(code)) {
      const { data, error } = await query.eq('display_code', code).maybeSingle();
      if (error) throw error;
      if (data) return data;
    }
    const { data, error } = await db.from('questions').select('id,subject_id,display_code,chapter_id,topic_id,clo_id,content,correct_answer,explanation,created_by,question_options(id,option_key,content)').eq('subject_id', state.subjectId);
    if (error) throw error;
    const prefix = code.replace(/^Q-/i, '').toLowerCase();
    const found = (data || []).find(q => String(q.id || '').toLowerCase().startsWith(prefix) || normCode(q.display_code) === code);
    if (!found) throw new Error(`Không tìm thấy câu ${code || ''} trong Ngân hàng câu hỏi.`);
    return found;
  }

  async function confirmSimilar(question, content) {
    try {
      let result = await db.rpc('find_similar_questions_scoped', {
        p_subject_id: state.subjectId,
        p_chapter_id: question.chapter_id,
        p_topic_id: question.topic_id || null,
        p_content: content,
        p_exclude_id: question.id,
        p_limit: 3,
      });
      if (result.error) {
        result = await db.rpc('find_similar_questions', {
          p_subject_id: state.subjectId,
          p_content: content,
          p_exclude_id: question.id,
          p_limit: 3,
        });
      }
      if (result.error) return true;
      const top = result.data?.[0];
      if (!top || Number(top.similarity_score) < .72) return true;
      if (typeof confirmAction !== 'function') return window.confirm('Có câu hỏi tương tự. Bạn vẫn muốn lưu?');
      return !!(await confirmAction('Phát hiện câu hỏi tương tự', `${top.code || 'Một câu khác'} có độ tương đồng ${Math.round(Number(top.similarity_score) * 100)}%. Bạn vẫn muốn lưu?`, { confirmLabel: 'Vẫn lưu' }));
    } catch {
      return true;
    }
  }

  async function saveSourceQuestion(question, next) {
    if (typeof v96CanManage === 'function' && !v96CanManage(question)) {
      throw new Error('Chỉ người nhập câu hoặc Admin được sửa câu hỏi này.');
    }
    if (!await confirmSimilar(question, next.content)) return false;

    const archived = await db.rpc('archive_question_revision', { p_question_id: question.id });
    if (archived.error) throw archived.error;

    const updatedAt = new Date().toISOString();
    const qr = await db.from('questions').update({
      content: next.content,
      correct_answer: next.correct_answer,
      explanation: next.explanation,
      updated_at: updatedAt,
    }).eq('id', question.id);
    if (qr.error) throw qr.error;

    for (const k of OPTION_KEYS) {
      const old = (question.question_options || []).find(o => String(o.option_key || '').toUpperCase() === k);
      const result = old?.id
        ? await db.from('question_options').update({ content: next.options[k], updated_at: updatedAt }).eq('id', old.id)
        : await db.from('question_options').insert({ question_id: question.id, option_key: k, content: next.options[k] });
      if (result.error) throw result.error;
    }

    window.AICLO_QUESTION_STATE?.invalidate?.(question.id);
    window.logActivity?.('update', 'question', question.id, 'Sửa nhanh từ bài kiểm tra: ' + next.content.slice(0, 120));
    window.dispatchEvent(new CustomEvent('aiclo:question-quick-updated', { detail: { questionId: question.id, source: 'assessment-builder' } }));
    return true;
  }

  async function handleDirectSave(button) {
    let question = null;
    try {
      const next = readQuickForm();
      question = await resolveQuestion();
      button.disabled = true;
      button.textContent = 'Đang lưu vào câu hỏi…';
      const saved = await saveSourceQuestion(question, next);
      if (!saved) {
        button.disabled = false;
        button.textContent = 'Lưu vào câu hỏi';
        return;
      }

      // Sau khi câu gốc đã lưu thành công, cho handler cũ chạy một lần để cập nhật
      // ctx.selected + draftOverrides của Builder. Nhờ vậy lần bấm Lưu bài sẽ snapshot đúng bản mới.
      bypassOriginalSave = true;
      button.disabled = false;
      button.click();
      bypassOriginalSave = false;

      setTimeout(() => {
        if (typeof toast === 'function') toast('Đã cập nhật câu gốc trong Ngân hàng câu hỏi. Bấm “Lưu thay đổi” để đồng bộ snapshot của bài kiểm tra.');
      }, 0);
    } catch (error) {
      console.error(error);
      button.disabled = false;
      button.textContent = 'Lưu vào câu hỏi';
      if (typeof err === 'function') err(error);
      else if (typeof toast === 'function') toast(error?.message || 'Không thể cập nhật câu hỏi.', true);
    } finally {
      if (bypassOriginalSave) bypassOriginalSave = false;
    }
  }

  document.addEventListener('click', event => {
    const quick = event.target.closest?.('[data-v123-quick-edit]');
    if (quick) {
      const card = quick.closest('.v122-question-card');
      activeQuick = {
        index: Number(quick.dataset.v123QuickEdit || 0),
        code: card?.querySelector('.ub-question-code')?.textContent?.trim() || '',
      };
      setTimeout(queueEnhance, 0);
      return;
    }

    const save = event.target.closest?.('#v123EditSave');
    if (!save || bypassOriginalSave || !currentDrawerIsQuickEdit()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    handleDirectSave(save);
  }, true);

  document.addEventListener('DOMContentLoaded', () => {
    const host = document.querySelector('#content');
    if (host) new MutationObserver(queueEnhance).observe(host, { childList: true, subtree: true });
    const drawer = document.querySelector('#sideDrawer');
    if (drawer) new MutationObserver(queueEnhance).observe(drawer, { childList: true, subtree: true, characterData: true });
    queueEnhance();
  }, { once: true });

  window.AICLO_ASSESSMENT_QUICK_EDIT_DIRECT = Object.freeze({ version: '12.6.14' });
})();
