/* AI-CLO PTITHCM V12.3 — Assessment shared pure utilities. */
(() => {
  "use strict";

  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];

  const escapeHtml = (s) =>
    window.esc
      ? esc(s)
      : String(s ?? "").replace(
          /[&<>"']/g,
          (c) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            })[c],
        );

  const formatDateTime = (v) =>
    v
      ? new Intl.DateTimeFormat("vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh",
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(v))
      : "—";

  const localInput = (v) => {
    if (!v) return "";
    const d = new Date(v);
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
  };

  const toIsoOrNull = (v) => (v ? new Date(v).toISOString() : null);
  const findById = (rows, id) => rows.find((x) => x.id === id);

  const shuffle = (rows) => {
    const a = [...rows];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const modeLabel = (v) =>
    ({
      common_fixed: "Đề chung cố định",
      student_fixed: "Đề riêng theo sinh viên",
      attempt_random: "Rút lại mỗi lần làm",
    })[v] || "Đề chung cố định";

  const structureLabel = (v) =>
    v === "chapter_pool" ? "CLO chung các mục được chọn" : "CLO cho mỗi mục";

  const statusMeta = (x) => {
    if (x.status === "draft")
      return { code: "draft", label: "Bản nháp", className: "" };
    if (x.status === "closed")
      return { code: "closed", label: "Tạm dừng", className: "red" };
    const now = Date.now();
    const opens = x.opens_at ? new Date(x.opens_at).getTime() : null;
    const closes = x.closes_at ? new Date(x.closes_at).getTime() : null;
    if (opens && now < opens)
      return { code: "upcoming", label: "Sắp mở", className: "" };
    if (closes && now > closes)
      return { code: "expired", label: "Đã hết hạn", className: "red" };
    return { code: "active", label: "Đang mở", className: "green" };
  };

  const validOptions = (q) => {
    const keys = (q.question_options || []).map((o) =>
      String(o.option_key || "").toUpperCase(),
    );
    return (
      keys.length === 4 &&
      new Set(keys).size === 4 &&
      ["A", "B", "C", "D"].every((k) => keys.includes(k)) &&
      keys.includes(String(q.correct_answer || "").toUpperCase())
    );
  };

  const poolSnapshot = (q, sets) => ({
    question_id: q.id,
    display_code: q.display_code || null,
    chapter_id: q.chapter_id,
    chapter_name: findById(sets.chapters, q.chapter_id)?.name || null,
    topic_id: q.topic_id,
    topic_name: findById(sets.topics, q.topic_id)?.name || null,
    clo_id: q.clo_id,
    clo_code: findById(sets.clos, q.clo_id)?.code || null,
    content: q.content,
    correct_answer: String(q.correct_answer || "").toUpperCase(),
    explanation: q.explanation || null,
    options: (q.question_options || [])
      .map((o) => ({
        key: String(o.option_key || "").toUpperCase(),
        content: o.content,
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  });

  const snapshotQuestion = (row) => {
    const raw = Array.isArray(row?.options) ? row.options : [];
    return {
      id: row.question_id || row.id,
      display_code: row.display_code || null,
      chapter_id: row.chapter_id,
      topic_id: row.topic_id,
      clo_id: row.clo_id,
      content: row.content || "",
      correct_answer: String(row.correct_answer || "").toUpperCase(),
      explanation: row.explanation || null,
      question_options: raw
        .map((o) => ({
          option_key: String(o.key || o.option_key || "").toUpperCase(),
          content: o.content || "",
        }))
        .filter((o) => o.option_key),
    };
  };

  window.AICLO_ASSESSMENT_COMMON = Object.freeze({
    qs,
    qsa,
    escapeHtml,
    formatDateTime,
    localInput,
    toIsoOrNull,
    findById,
    shuffle,
    modeLabel,
    structureLabel,
    statusMeta,
    validOptions,
    poolSnapshot,
    snapshotQuestion,
  });
})();
