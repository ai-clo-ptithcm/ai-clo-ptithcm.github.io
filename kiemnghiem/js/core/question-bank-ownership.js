/* AI-CLO PTITHCM V12.6.2 — compatibility bridge for shared question-bank ownership.
   Legacy modules may still filter content tables by subject_id. For the active
   course, transparently route those filters to question_bank_id and enrich
   legacy inserts with the active bank id. */
(() => {
  'use strict';
  if (!db || db.__aicloQuestionBankBridgeV1262) return;

  const CONTENT_TABLES = new Set(['chapters', 'clos', 'questions']);
  const originalFrom = db.from.bind(db);
  const currentBankId = (subjectId = state?.subjectId) => {
    try {
      return typeof questionBankId === 'function' ? questionBankId(subjectId) : null;
    } catch {
      return null;
    }
  };

  const enrichInsert = (table, value) => {
    if (!CONTENT_TABLES.has(table)) return value;
    const bankId = currentBankId();
    if (!bankId) return value;
    const enrichRow = (row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
      return {
        ...row,
        ...(row.subject_id == null && state?.subjectId ? { subject_id: state.subjectId } : {}),
        ...(row.question_bank_id == null ? { question_bank_id: bankId } : {}),
      };
    };
    return Array.isArray(value) ? value.map(enrichRow) : enrichRow(value);
  };

  const wrap = (builder, table) => {
    if (!builder || typeof builder !== 'object') return builder;
    return new Proxy(builder, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (prop === 'then' || prop === 'catch' || prop === 'finally') {
          return typeof value === 'function' ? value.bind(target) : value;
        }
        if (typeof value !== 'function') return value;
        return (...args) => {
          if (
            prop === 'eq' &&
            CONTENT_TABLES.has(table) &&
            args[0] === 'subject_id' &&
            String(args[1] ?? '') === String(state?.subjectId ?? '')
          ) {
            const bankId = currentBankId(args[1]);
            if (bankId) args = ['question_bank_id', bankId];
          }
          if (prop === 'insert' && CONTENT_TABLES.has(table) && args.length) {
            args[0] = enrichInsert(table, args[0]);
          }
          const result = value.apply(target, args);
          return result && typeof result === 'object' ? wrap(result, table) : result;
        };
      },
    });
  };

  db.from = (table) => wrap(originalFrom(table), String(table || ''));
  Object.defineProperty(db, '__aicloQuestionBankBridgeV1262', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  window.AICLO_QUESTION_BANK_OWNERSHIP = Object.freeze({
    version: '12.6.2',
    currentBankId,
  });
})();
