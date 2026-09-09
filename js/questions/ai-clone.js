/* AI-CLO PTITHCM V12.6.46 — AI question variants with sequential review. */
(() => {
  "use strict";

  const STYLE_HREF = "css/questions/ai-clone.css?v=12.6.46";
  const escHtml = (value) => (typeof esc === "function" ? esc(value ?? "") : String(value ?? ""));
  const keys = ["A", "B", "C", "D"];
  const validScope = (value) => ["practice", "secure_exam", "both"].includes(value) ? value : "practice";
  const scopeLabel = (value) => value === "secure_exam" ? "🔒 Đề thi - bảo mật" : value === "both" ? "Cả hai ngân hàng" : "Luyện tập - kiểm tra";

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
    const normalized = validScope(value);
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
    return `<section class="ai-clone-config"><div class="ai-clone-section-head"><div><h4>Thiết lập nhân bản</h4><p>Tạo nhiều câu cùng dạng toán nhưng thay dữ liệu, hàm số hoặc tham số. Sau khi sinh, từng câu sẽ được duyệt giống luồng “Tạo bằng Gemini”.</p></div></div><div class="ai-clone-config-grid"><label class="field">Số lượng câu<input id="aiCloneCount" type="number" min="1" max="10" step="1" value="3"></label><label class="field">Mức biến đổi<select id="aiCloneVariation"><option value="close">Gần dạng câu gốc</option><option value="balanced" selected>Vừa phải</option><option value="strong">Thay dữ liệu mạnh</option></select></label><label class="field">Nơi lưu khi duyệt<select id="aiCloneScope">${scopeOptions(source.question_scope)}</select></label><label class="field wide">Yêu cầu bổ sung<textarea id="aiCloneRequirements" rows="3" placeholder="Ví dụ: dùng hàm lượng giác; hệ số nguyên; không dùng căn; khó hơn một mức; thay hoàn toàn dữ kiện về hàm số…"></textarea></label></div><div class="ai-clone-config-actions"><button id="aiCloneGenerate" type="button" class="ai-btn">✦ Tạo câu nhân bản</button></div></section>`;
  }

  function readEditor(source) {
    return {
      content: String(document.querySelector("#draftContent")?.value || "").trim(),
      options: Object.fromEntries(keys.map((k) => [k, String(document.querySelector(`#draft${k}`)?.value || "").trim()])),
      correct_answer: document.querySelector("#draftCorrect")?.value || "A",
      explanation: String(document.querySelector("#draftExplanation")?.value || "").trim(),
      chapter_id: source.chapter_id,
      topic_id: source.topic_id,
      clo_id: source.clo_id,
    };
  }

  async function ensureReviewFlow() {
    if (window.AICLO_AI_REVIEW_FLOW) return window.AICLO_AI_REVIEW_FLOW;
    await window.AICLO_FEATURES?.loadAiReviewFlow?.();
    return window.AICLO_AI_REVIEW_FLOW || null;
  }

  function nextPending(variants, pos) {
    for (let i = pos + 1; i < variants.length; i++) if ((variants[i]._review_status || "pending") === "pending") return i;
    for (let i = 0; i < pos; i++) if ((variants[i]._review_status || "pending") === "pending") return i;
    return -1;
  }

  function previousPending(variants, pos) {
    for (let i = pos - 1; i >= 0; i--) if ((variants[i]._review_status || "pending") === "pending") return i;
    return -1;
  }

  function nextForwardPending(variants, pos) {
    for (let i = pos + 1; i < variants.length; i++) if ((variants[i]._review_status || "pending") === "pending") return i;
    return -1;
  }

  async function saveDraftQuestion(source, item, scope) {
    const questionRow = {
      subject_id: state.subjectId,
      chapter_id: source.chapter_id,
      topic_id: source.topic_id,
      clo_id: source.clo_id,
      content: item.content,
      explanation: item.explanation || null,
      correct_answer: item.correct_answer,
      created_by: state.user.id,
      status: "draft",
      approval_status: "draft",
      question_scope: validScope(scope),
      origin_type: "gemini",
      updated_at: new Date().toISOString(),
    };
    const { data: created, error: createError } = await db.from("questions").insert(questionRow).select("id").single();
    if (createError) throw createError;
    const { error: optionError } = await db.from("question_options").insert(keys.map((k) => ({ question_id: created.id, option_key: k, content: item.options[k] })));
    if (optionError) {
      await db.from("questions").delete().eq("id", created.id);
      throw optionError;
    }
    window.logActivity?.("create", "question", created.id, `AI nhân bản từ ${typeof questionCode === "function" ? questionCode(source) : source.id}: ${item.content.slice(0, 100)}`);
    return created.id;
  }

  async function finishReview(source, sets, variants) {
    const saved = variants.filter((x) => x._review_status === "saved").length;
    const skipped = variants.filter((x) => x._review_status === "skipped").length;
    window.AICLO_QUESTION_STATE?.invalidate?.();
    toast(`Đã duyệt xong: lưu nháp ${saved}, bỏ qua ${skipped}.`);
    await v96QuestionDetail(source, sets);
  }

  async function showVariantReview(source, sets, variants, pos, scope, model = "Gemini") {
    const item = variants[pos];
    if (!item) return finishReview(source, sets, variants);
    const chapter = sets.ch.find((x) => x.id === source.chapter_id);
    const clo = sets.clos.find((x) => x.id === source.clo_id);
    const saved = variants.filter((x) => x._review_status === "saved").length;
    const skipped = variants.filter((x) => x._review_status === "skipped").length;
    const pending = variants.length - saved - skipped;
    const prevPos = previousPending(variants, pos);
    const nextPos = nextForwardPending(variants, pos);
    const sourceCode = typeof questionCode === "function" ? questionCode(source) : source.display_code || "Câu mẫu";

    questionWorkspace(
      "Duyệt câu AI nhân bản",
      `Câu ${pos + 1}/${variants.length} · Đã lưu nháp ${saved} · Bỏ qua ${skipped} · Còn ${pending} câu chờ duyệt`,
      `<div class="review-wrap ai-review-page ai-clone-review-page">
        <div class="review-progress"><b>Câu ${pos + 1}/${variants.length}</b><span>Đã lưu nháp: ${saved} · Bỏ qua: ${skipped} · Chờ duyệt: ${pending}</span></div>
        <div class="review-tags"><span class="badge red">${escHtml(clo?.code || "")}</span><span class="badge">${escHtml(chapter?.name || "")}</span><span class="badge ai-review-scope">${escHtml(scopeLabel(scope))}</span><span class="badge">Từ ${escHtml(sourceCode)}</span></div>
        <section class="ai-review-editor">
          <div class="ai-note"><b>Xem trước công thức · ${escHtml(model)}</b><div>${escHtml(item.content)}</div>${keys.map((k) => `<div><b>${k}.</b> ${escHtml(item.options?.[k] || "")}</div>`).join("")}${item.explanation ? `<div><b>Lời giải:</b> ${escHtml(item.explanation)}</div>` : ""}</div>
          <label class="field">Nội dung<textarea id="draftContent">${escHtml(item.content)}</textarea></label>
          <div class="review-options">${keys.map((k) => `<label class="${item.correct_answer === k ? "correct" : ""}"><b>${k}</b><input id="draft${k}" value="${escHtml(item.options?.[k] || "")}"></label>`).join("")}</div>
          <div class="ai-review-answer-row"><label class="field">Đáp án đúng<select id="draftCorrect">${keys.map((k) => `<option ${item.correct_answer === k ? "selected" : ""}>${k}</option>`).join("")}</select></label><label class="field">Lời giải<textarea id="draftExplanation">${escHtml(item.explanation || "")}</textarea></label></div>
        </section>
        <section class="ai-similar-panel ai-text-similar-panel"><div class="ai-similar-head"><div><h4>3 câu gần giống nhất</h4><p id="aiTextSimilarityStatus">Đang kiểm tra…</p><small>Đối chiếu tự động bằng độ giống văn bản trong cùng chủ đề.</small></div><button id="recheckTextDuplicate" class="secondary" type="button">Kiểm tra lại văn bản</button></div><div id="aiTextSimilarResults"><p class="ai-similar-empty checking">Đang đối chiếu văn bản…</p></div></section>
        <section class="ai-similar-panel ai-semantic-panel"><div class="ai-similar-head"><div><h4>Kiểm tra giống về nội dung</h4><p id="aiSemanticStatus">Chỉ gọi AI khi giảng viên nhấn nút.</p><small>Kiểm tra bản chất toán học/vật lý, dạng bài và hướng giải; phù hợp với câu nhân bản.</small></div><button id="checkSemanticSimilarity" class="ai-btn" type="button">✦ AI kiểm tra giống về nội dung</button></div><div id="aiSemanticSimilarity"></div></section>
        <div class="review-actions ai-review-actions"><button class="secondary" id="prevDraft" ${prevPos < 0 ? "disabled" : ""}>← Câu trước</button><button class="danger" id="rejectDraft">Bỏ qua</button><button class="primary" id="approveDraft">Lưu bản nháp</button><button class="secondary" id="nextDraft" ${nextPos < 0 ? "disabled" : ""}>Câu sau →</button></div>
      </div>`
    );

    renderMath?.(document.querySelector(".ai-clone-review-page"));
    const back = document.querySelector("#questionBack");
    if (back) {
      back.textContent = "← Chi tiết câu hỏi";
      back.onclick = () => v96QuestionDetail(source, sets);
    }

    const flow = await ensureReviewFlow();
    const batch = { subject_id: state.subjectId, chapter_id: source.chapter_id, topic_id: source.topic_id, clo_id: source.clo_id };
    const draft = { ...item, topic_id: source.topic_id };
    if (flow?.runTextSimilarityCheck) flow.runTextSimilarityCheck(batch, draft, { silent: true });
    document.querySelector("#recheckTextDuplicate")?.addEventListener("click", () => flow?.runTextSimilarityCheck?.(batch, draft));
    document.querySelector("#checkSemanticSimilarity")?.addEventListener("click", () => flow?.runSemanticSimilarityCheck?.(batch, draft));

    const syncItem = () => {
      const edited = readEditor(source);
      Object.assign(item, edited);
      return edited;
    };
    ["#draftContent", "#draftExplanation", "#draftCorrect", "#draftA", "#draftB", "#draftC", "#draftD"].forEach((selector) => {
      const node = document.querySelector(selector);
      node?.addEventListener("input", syncItem);
      node?.addEventListener("change", syncItem);
    });
    document.querySelector("#draftContent")?.addEventListener("input", () => {
      const status = document.querySelector("#aiTextSimilarityStatus");
      if (status) status.textContent = "Nội dung đã thay đổi · hãy kiểm tra lại.";
      const semantic = document.querySelector("#aiSemanticSimilarity");
      if (semantic) semantic.innerHTML = '<p class="ai-similar-empty checking">Nội dung đã thay đổi; hãy kiểm tra AI lại nếu cần.</p>';
      const semanticStatus = document.querySelector("#aiSemanticStatus");
      if (semanticStatus) semanticStatus.textContent = "Kết quả AI cũ không còn áp dụng.";
    });

    if (prevPos >= 0) document.querySelector("#prevDraft").onclick = () => { syncItem(); showVariantReview(source, sets, variants, prevPos, scope, model); };
    if (nextPos >= 0) document.querySelector("#nextDraft").onclick = () => { syncItem(); showVariantReview(source, sets, variants, nextPos, scope, model); };

    document.querySelector("#rejectDraft").onclick = async () => {
      syncItem();
      item._review_status = "skipped";
      toast("Đã bỏ qua câu nhân bản");
      const next = nextPending(variants, pos);
      if (next >= 0) return showVariantReview(source, sets, variants, next, scope, model);
      return finishReview(source, sets, variants);
    };

    document.querySelector("#approveDraft").onclick = async () => {
      const button = document.querySelector("#approveDraft");
      button.disabled = true;
      try {
        const edited = syncItem();
        if (!edited.content) throw new Error("Nội dung câu hỏi không được để trống.");
        if (keys.some((k) => !edited.options[k])) throw new Error("Cần nhập đủ bốn phương án A–D.");
        if (!source.topic_id) throw new Error("Câu hỏi gốc chưa được gắn chủ đề.");

        if (flow?.runTextSimilarityCheck) {
          const checked = await flow.runTextSimilarityCheck(batch, draft, { silent: true });
          if (!checked?.ok) {
            const go = await confirmAction("Chưa kiểm tra được câu trùng", "Hệ thống chưa kiểm tra được độ giống văn bản. Bạn vẫn muốn lưu câu này vào bản nháp?", { confirmLabel: "Vẫn lưu nháp" });
            if (!go) { button.disabled = false; return; }
          } else {
            const high = (checked.rows || []).filter((x) => Number(x.similarity_score || 0) >= 0.75);
            if (high.length) {
              const top = Math.round(Math.max(...high.map((x) => Number(x.similarity_score || 0))) * 100);
              const go = await confirmAction("Phát hiện câu tương tự", `Có ${high.length} câu có độ giống văn bản cao, cao nhất ${top}%. Bạn vẫn muốn lưu câu này vào bản nháp?`, { confirmLabel: "Vẫn lưu nháp" });
              if (!go) { button.disabled = false; return; }
            }
          }
        }

        item._saved_question_id = await saveDraftQuestion(source, edited, scope);
        item._review_status = "saved";
        window.AICLO_QUESTION_STATE?.invalidate?.();
        toast(`Đã lưu bản nháp vào ${scopeLabel(scope)}`);
        const next = nextPending(variants, pos);
        if (next >= 0) return showVariantReview(source, sets, variants, next, scope, model);
        return finishReview(source, sets, variants);
      } catch (error) {
        err(error);
        button.disabled = false;
      }
    };
  }

  async function generate(root, source, sets) {
    const button = root.querySelector("#aiCloneGenerate");
    const results = root.querySelector("#aiCloneResults");
    const count = Math.max(1, Math.min(10, Number(root.querySelector("#aiCloneCount")?.value || 3)));
    const variation = root.querySelector("#aiCloneVariation")?.value || "balanced";
    const requirements = root.querySelector("#aiCloneRequirements")?.value.trim() || "";
    const scope = validScope(root.querySelector("#aiCloneScope")?.value || source.question_scope || "practice");
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
      if (error) {
        let detail;
        try { detail = await error.context?.json(); } catch {}
        throw new Error(detail?.error || error.message);
      }
      if (!data?.success || !Array.isArray(data.variants) || !data.variants.length) throw new Error(data?.error || "AI chưa tạo được câu biến thể.");
      const variants = data.variants.map((item) => ({ ...item, _review_status: "pending" }));
      await ensureReviewFlow();
      return showVariantReview(source, sets, variants, 0, scope, data.model || "Gemini");
    } catch (error) {
      err(error);
      results.innerHTML = '<div class="ai-clone-error"><b>Chưa tạo được câu nhân bản.</b><span>Kiểm tra Edge Function generate-question-variants và thử lại.</span></div>';
    } finally {
      if (button && document.body.contains(button)) {
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
    questionWorkspace("AI nhân bản câu hỏi", "Tạo nhiều câu cùng dạng từ một câu mẫu; sau khi sinh sẽ duyệt từng câu giống chức năng Tạo bằng Gemini.", `<div id="aiCloneWorkspace" class="ai-clone-workspace">${sourceHtml(source, sets)}${configurationHtml(source)}<section id="aiCloneResults" class="ai-clone-results"><div class="ai-clone-empty"><b>Chưa tạo biến thể</b><span>Chọn số lượng và yêu cầu, sau đó nhấn “Tạo câu nhân bản”.</span></div></section></div>`);
    const root = document.querySelector("#aiCloneWorkspace");
    if (!root) return;
    const back = document.querySelector("#questionBack");
    if (back) {
      back.textContent = "← Chi tiết câu hỏi";
      back.onclick = () => v96QuestionDetail(source, sets);
    }
    root.querySelector("#aiCloneGenerate")?.addEventListener("click", () => generate(root, source, sets));
    renderMath?.(root);
    window.AICLO_SUBPAGE_STATE?.remember?.("question-ai-clone", { entityType: "question", entityId: source.id });
  }

  const api = Object.freeze({ open });
  window.AICLO_AI_CLONE = api;
  window.v126AiCloneQuestion = (source, sets) => open(source, sets);
})();
