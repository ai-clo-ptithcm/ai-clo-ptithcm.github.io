# analyze-assessment — V9.1

Edge Function nhận xét kết quả theo yêu cầu (attempt / student / class).

V9.1 khác V9 ở chỗ dữ liệu CLO / chương / chủ đề được đọc từ `attempt_questions` — snapshot của từng lượt làm — thay vì đọc metadata hiện tại của `questions`.

Nếu function V9 đã được deploy:

1. Giữ nguyên secrets `GEMINI_API_KEY` và `GEMINI_MODEL` (nếu có).
2. Thay nội dung `index.ts` bằng file V9.1.
3. Deploy lại function `analyze-assessment`.

Function vẫn có cache trong `assessment_ai_feedback`, vì vậy không tự gọi Gemini lặp lại nếu dữ liệu nguồn không đổi.
