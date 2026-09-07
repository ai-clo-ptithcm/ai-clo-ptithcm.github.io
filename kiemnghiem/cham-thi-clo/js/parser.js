// parser.js - Compatibility wrapper.
// Luồng mới dùng normalizeUntData(data, answerData) từ untNormalizer.js.
export { normalizeUntData as parseUntData, validateStudentIds } from "./untNormalizer.js";
