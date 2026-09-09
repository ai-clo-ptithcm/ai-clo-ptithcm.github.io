/* AI-CLO PTITHCM V12.6.45 — AI question variants workspace. */
(() => {
  "use strict";

  const STYLE_HREF = "css/questions/ai-clone.css?v=12.6.45";
  const escHtml = (value) => (typeof esc === "function" ? esc(value ?? "") : String(value ?? ""));
  const keys = ["A", "B", "C", "D"];

  function ensureStyle() {
    if (document.querySelector(`link[href="${STYLE_HREF}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = STYLE_HREF;
    link.dataset.aicloAiClone = "1";
    document.head.appendChild(link);
  }

  function optionMap(question) {
    return Object.fromEntries((question?.question_options || []).map((o) => [o.option_key, o.content]));
  }

  function scopeOptions(value = "practice") {
    const normalized = ["practice", "secure_exam", "both"].includes(value) ? value : "practice";
    return `<option value="practice" ${normalized === "practice" ? "selected" : ""}>Luyện tập - kiểm tra</option><option value="secure_exam" ${normalized === "secure_exam" ? "selected" : ""}>🔒 Đề thi - bảo mật</option><option value="both" ${normalized === "both" ? "selected" : ""}>Cả hai ngân hàng</option>`;
  }

  function sourceHtml(source, sets) {
    const chapter = sets.ch.find((x) => x.id === source.chapter_id);
    const topic = sets.topics.find((x) => x.id === source.topic_id);
    const clo = sets.clos.find((x) => x.id === source.clo_id);
    const opts = optionMap(source);
    return `<section class="ai-clone-source"><div class="ai-clone-source-head"><div><small>CÂU MẪU</small><h4>${escHtml(typeof questionCode === "function" ? questionCode(source) : source.display_code || "Câu hỏi")}</h4></div><div class="detail-meta"><span class="badge red">${escHtml(clo?.code || "—")}</span><span class="badge">${escHtml(chapter?.name || "—")}</span><span class="badge">${escHtml(topic?.name || "—")}</span></div></div><div class="ai-clone-source-content">${escHtml(source.content)}</div><div class="ai-clone-source-options">${keys.map((k) => `<div class="${source.correct_answer === k ? "correct" : ""}"><b>${k}</b><span>${escHtml(opts[k] || "")}</span></div>`).join("")}</div></section>`;
  }

  function configurationHtml(source) {
    return `<section class="ai-clone-config"><div class="ai-clone-section-head"><div><h4>Thiết lập nhân bản</h4><p>Tạo nhiều câu cùng dạng toán nhưng thay dữ liệu, hàm số hoặc tham số. Các câu chỉ được lưu sau khi bạn duyệt.</p></div></div><div class="ai-clone-config-grid"><label class="field">Số lượng câu<input id="aiCloneCount" type="number" min="1" max="10" step="1" value="3"></label><label class="field">Mức biến đổi<select id="aiCloneVariation"><option value="close">Gần dạng câu gốc</option><option value="balanced" selected>Vừa phải</option><option value="strong">Thay dữ liệu mạnh</option></select></label><label class="field">Nơi lưu khi duyệt<select id="aiCloneScope">${scopeOptions(source.question_scope)}</select></label><label class="field wide">Yêu cầu bổ sung<textarea id="aiCloneRequirements" rows="3" placeholder="Ví dụ: dùng hàm lượng giác; hệ số nguyên; không dùng căn; khó hơn một mức; thay hoàn toàn dữ kiện về hàm số…"></textarea></label></div><div class="ai-clone-config-actions"><button id="aiCloneGenerate" type="button" class="ai-btn">✦ Tạo câu nhân bản</button></div></section>`;
  }

  function variantCard(item, index) {
    return `<article class="ai-clone-card" data-ai-clone-card="${index}"><div class="ai-clone-card-head"><label class="ai-clone-select"><input type="checkbox" data-ai-clone-select="${index}" checked><span>Chọn câu ${index + 1}</span></label><span class="badge">Dự thảo AI</span></div><label class="field">Nội dung<textarea data-ai-clone-content="${index}" rows="3">${escHtml(item.content)}</textarea></label><div class="ai-clone-options">${keys.map((k) => `<label class="field"><span>Phương án ${k}</span><input data-ai-clone-option="${index}|${k}" value="${escHtml(item.options?.[k] || "")}"></label>`).join("")}</div><div class="ai-clone-card-bottom"><label class="field">Đáp án đúng<select data-ai-clone-correct="${index}">${keys.map((k) => `<option ${item.correct_answer === k ? "selected" : ""}>${k}</option>`).join("")}</select></label><label class="field ai-clone-explanation">Lời giải<textarea data-ai-clone-explanation="${index}" rows="2">${escHtml(item.explanation || "")}</textarea></label></div></article>`;
  }

  function readVariant(root, index, source) {
    return {
      content: root.querySelector(`[data-ai-clone-content="${index}"]`)?.value.trim() || "",
      options: Object.fromEntries(keys.map((k) => [k, root.querySelector(`[data-ai-clone-option="${index}|${k}"]`)?.value.trim() || ""])),
      correct_answer: root.querySelector(`[data-ai-clone-correct="${index}"]`)?.value || "A",
      explanation: root.querySelector(`[data-ai-clone-explanation="${index}"]`)?.value.trim() || "",
      chapter_id: source.chapter_id,
      topic_id: source.topic_id,
      clo_id: source.clo_id,
    };
  }

  async function findNearDuplicate(source, content) {
    const scoped = await db.rpc("find_similar_questions_scoped", {
      p_subject_id: state.subjectId,
      p_chapter_id: source.chapter_id,
      p_topic_id: source.topic_id || null,
      p_content: content,
      p_exclude_id: null,
      p_limit: 1,
    });
    if (!scoped.error) return scoped.data?.[0] || null;
    const fallback = await db.rpc("find_similar_questions", {
      p_subject_id: state.subjectId,
      p_content: content,
      p_exclude_id: null,
      p_limit: 1,
    });
    if (fallback.error) throw fallback.error;
    return fallback.data?.[0] || null;
  }

  async function saveSelected(root, source, variants) {
    const selected = variants.map((_, index) => index).filter((index) => root.querySelector(`[data-ai-clone-select="${index}"]`)?.checked);
    if (!selected.length) return toast("Hãy chọn ít nhất một câu để lưu.", true);
    const scope = root.querySelector("#aiCloneScope")?.value || source.question_scope || "practice";
    const saveButton = root.querySelector("#aiCloneSave");
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = "Đang kiểm tra và lưu…";
    }
    try {
      const rows = [];
      for (const index of selected) {
        const item = readVariant(root, index, source);
        if (!item.content || keys.some((k) => !item.options[k])) throw new Error(`Câu ${index + 1} chưa đủ nội dung hoặc phương án.`);
        const near = await findNearDuplicate(source, item.content);
        const similarity = Number(near?.similarity_score || 0);
        if (similarity >= 0.9) {
          const ok = await confirmAction("Câu nhân bản gần trùng", `Câu ${index + 1} gần giống ${near.code || "một câu đã có"} (${Math.round(similarity * 100)}%). Bạn vẫn muốn lưu?`, { confirmLabel: "Vẫn lưu" });
          if (!ok) continue;
        }
        rows.push({ index, item });
      }
      if (!rows.length) throw new Error("Không còn câu nào được chọn để lưu.");
      for (const { item } of rows) {
        const questionRow = {
          subject_id: state.subjectId,
          chapter_id: item.chapter_id,
          topic_id: item.topic_id,
          clo_id: item.clo_id,
          content: item.content,
          explanation: item.explanation || null,
          correct_answer: item.correct_answer,
          created_by: state.user.id,
          status: "draft",
          approval_status: "draft",
          question_scope: scope,
          origin_type: "gemini",
          updated_at: new Date().toISOString(),
        };
        const { data: created, error: createError } = await db.from("questions").insert(questionRow).select("id").single();
        if (createError) throw createError;
        const { error: optionError } = await db.from("question_options").insert(keys.map((k) => ({ question_id: created.id, option_key: k, content: item.options[k] })));
        if (optionError) throw optionError;
        window.logActivity?.("create", "question", created.id, `AI nhân bản từ ${typeof questionCode === "function" ? questionCode(source) : source.id}: ${item.content.slice(0, 100)}`);
      }
      window.AICLO_QUESTION_STATE?.invalidate?.();
      toast(`Đã lưu ${rows.length} câu AI nhân bản ở trạng thái Bản nháp.`);
      await v96QuestionDetail(source, root.__aiCloneSets);
    } catch (error) {
      err(error);
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = "Lưu các câu đã chọn";
      }
    }
  }

  async function generate(root, source) {
    const button = root.querySelector("#aiCloneGenerate");
    const results = root.querySelector("#aiCloneResults");
    const count = Math.max(1, Math.min(10, Number(root.querySelector("#aiCloneCount")?.value || 3)));
    const variation = root.querySelector("#aiCloneVariation")?.value || "balanced";
    const requirements = root.querySelector("#aiCloneRequirements")?.value.trim() || "";
    if (button) {
      button.disabled = true;
      button.textContent = "✦ Gemini đang tạo…";
    }
    results.innerHTML = '<div class="ai-clone-loading"><b>Đang tạo các câu cùng dạng…</b><span>AI đang thay dữ liệu và tự tính lại đáp án, lời giải.</span></div>';
    try {
      const { data, error } = await db.functions.invoke("generate-question-variants", {
        body: {
          source_question_id: source.id,
          count,
          variation_level: variation,
          additional_requirements: requirements,
        },
      });
      if (error) throw error;
      if (!data?.success || !Array.isArray(data.variants) || !data.variants.length) throw new Error(data?.error || "AI chưa tạo được câu biến thể.");
      root.__aiCloneVariants = data.variants;
      results.innerHTML = `<div class="ai-clone-results-head"><div><h4>Kết quả AI nhân bản</h4><p>${data.generated_count || data.variants.length}/${data.requested_count || count} câu · Model: ${escHtml(data.model || "Gemini")}. Kiểm tra kỹ trước khi lưu.</p></div><button id="aiCloneRegenerate" class="secondary" type="button">↻ Tạo lại</button></div><div class="ai-clone-list">${data.variants.map(variantCard).join("")}</div><div class="ai-clone-savebar"><span>Chỉ các câu được tích chọn mới được lưu.</span><button id="aiCloneSave" type="button" class="primary">Lưu các câu đã chọn</button></div>`;
      renderMath?.(results);
      root.querySelector("#aiCloneRegenerate")?.addEventListener("click", () => generate(root, source));
      root.querySelector("#aiCloneSave")?.addEventListener("click", () => saveSelected(root, source, root.__aiCloneVariants || []));
    } catch (error) {
      err(error);
      results.innerHTML = '<div class="ai-clone-error"><b>Chưa tạo được câu nhân bản.</b><span>Kiểm tra Edge Function generate-question-variants và thử lại.</span></div>';
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "✦ Tạo câu nhân bản";
      }
    }
  }

  async function open(source, sets) {
    ensureStyle();
    if (!source?.id) return toast("Không xác định được câu hỏi gốc.", true);
    if (!Array.isArray(source.question_options)) {
      try {
        source = await window.AICLO_QUESTION_STATE?.hydrateQuestion?.(source) || source;
      } catch (error) {
        return err(error);
      }
    }
    captureQuestionFilters?.();
    questionWorkspace("AI nhân bản câu hỏi", "Tạo nhiều câu cùng dạng từ một câu mẫu; thay dữ liệu toán học nhưng giữ đúng kỹ năng và CLO.", `<div id="aiCloneWorkspace" class="ai-clone-workspace">${sourceHtml(source, sets)}${configurationHtml(source)}<section id="aiCloneResults" class="ai-clone-results"><div class="ai-clone-empty"><b>Chưa tạo biến thể</b><span>Chọn số lượng và yêu cầu, sau đó nhấn “Tạo câu nhân bản”.</span></div></section></div>`);
    const root = document.querySelector("#aiCloneWorkspace");
    if (!root) return;
    root.__aiCloneSets = sets;
    root.__aiCloneSource = source;
    const back = document.querySelector("#questionBack");
    if (back) {
      back.textContent = "← Chi tiết câu hỏi";
      back.onclick = () => v96QuestionDetail(source, sets);
    }
    root.querySelector("#aiCloneGenerate")?.addEventListener("click", () => generate(root, source));
    renderMath?.(root);
    window.AICLO_SUBPAGE_STATE?.remember?.("question-ai-clone", { entityType: "question", entityId: source.id });
  }

  const api = Object.freeze({ open });
  window.AICLO_AI_CLONE = api;
  window.v126AiCloneQuestion = (source, sets) => open(source, sets);
})();
