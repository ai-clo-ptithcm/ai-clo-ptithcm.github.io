# AI-CLO PTITHCM — TIẾN TRÌNH DỰ ÁN 06/09/2026

> Checkpoint sau chuỗi ổn định Assessment V12.4.x. Tài liệu này kế tiếp `PROJECT-PROGRESS-2026-09-05.md` và ghi trạng thái hiện tại sau khi hoàn tất 5 hạng mục ưu tiên: cache-busting persistence, Attempt full-width, khôi phục đúng câu đang làm, đăng ký Assessment vào shared persistence và đồng bộ tài liệu dự án.

## 1. Checkpoint hiện tại

- Repository: `ai-clo-ptithcm/ai-clo-ptithcm.github.io`
- Nhánh chính: `main`
- Code checkpoint trước đợt tài liệu này: `568166f8489c9583d28d83fd5d6634ca13be5b2f`
- Frontend Assessment owner: `js/assessment.js?v=12.4.3`
- Student Attempt: `js/assessment/student-attempt.js?v=12.4.2`
- Backend schema checkpoint vẫn là `assessment_schema_version = 12.3.1`.
- Không có migration Supabase mới và không cần redeploy Edge Function cho V12.4.0 → V12.4.3.
- GitHub Pages run #610 đã build/deploy thành công cho code checkpoint V12.4.3.

## 2. Kiến trúc Assessment vẫn giữ nguyên

Assessment frontend tiếp tục dùng một owner runtime và các child module:

```text
js/
├─ assessment.js
└─ assessment/
   ├─ common.js
   ├─ online-lifecycle.js
   ├─ online-builder.js
   ├─ final-exam.js
   ├─ student-attempt.js
   └─ results.js
```

Utility xuất đề online vẫn ở:

```text
js/exams/online-export.js
```

Nguyên tắc giữ nguyên:

- `assessment.js` là owner/router/lifecycle public runtime duy nhất.
- Child modules đăng ký factory qua `window.AICLO_ASSESSMENT_MODULES`.
- Không monkey patch Assessment.
- Không đặt `MutationObserver` trong Assessment modules.
- Shared persistence dùng hạ tầng chung, không tạo observer/persistence riêng cho từng Assessment module.
- Supabase Edge Functions tiếp tục self-contained, không phụ thuộc `_shared`.
- Supabase vẫn là nguồn dữ liệu chính thức; local/session persistence chỉ phục vụ workspace, draft và recovery.

## 3. V12.4.0–V12.4.3 đã hoàn thành

### 3.1. Cache-busting persistence

Đã sửa cache key trong `app.html` để trình duyệt luôn lấy đúng bản persistence hiện hành:

```text
js/ui/subpage-state.js?v=12.3.6
js/ui/form-persistence.js?v=12.3.6
```

Mục đích: tránh tình trạng file source đã nâng cấp nhưng HTML vẫn gọi query version cũ, làm người dùng nhận JavaScript cache cũ sau deploy.

### 3.2. Student Attempt chuyển sang full-width subpage

Màn hình sinh viên làm bài không còn nằm trong side drawer.

Hiện tại:

- render trực tiếp trong `#content`;
- có nút `← Danh sách bài kiểm tra`;
- giữ timer, câu hiện tại, CLO, chương/mục, trạng thái autosave;
- giữ jump câu, Trước/Sau, Nộp bài;
- MathJax render lại sau mỗi câu;
- không tạo horizontal overflow mới trên mobile;
- kết quả sau nộp vẫn dùng drawer, vì đây là luồng Result riêng.

File giao diện riêng:

```text
css/exams/student-attempt.css
```

### 3.3. Khôi phục đúng câu sinh viên đang làm

Local attempt draft hiện lưu thêm:

```text
currentQuestionIndex
```

Khi mở lại/reload:

1. đọc payload chính thức từ Supabase;
2. phủ pending answer local chưa đồng bộ;
3. giữ deadline theo `min(serverDeadline, localDeadline)`;
4. đọc `currentQuestionIndex`;
5. clamp chỉ số vào phạm vi hợp lệ;
6. mở lại đúng câu đang làm.

Nếu dữ liệu cũ không có chỉ số hoặc chỉ số hỏng, hệ thống an toàn quay về câu đầu.

Khi sinh viên chuyển bằng jump/Trước/Sau, vị trí câu mới được lưu cùng attempt draft. Sau submit thành công, attempt local draft vẫn được xóa.

### 3.4. Assessment đăng ký chính thức vào shared persistence

`assessment.js` V12.4.3 dùng trực tiếp API:

```text
window.AICLO_SUBPAGE_STATE.register(kind, { detect, isActive, restore })
```

Các workspace đã đăng ký:

- `assessment-detail`
- `assessment-builder`
- `assessment-attempt`
- `assessment-attempt-result`
- `assessment-results`
- `assessment-export`

Cơ chế này cho phép shared persistence biết rõ:

- người dùng đang ở workspace nào;
- entity nào đang mở (`exam_id`, `attempt_id`);
- mode create/edit khi cần;
- cách khôi phục đúng workspace sau page lifecycle/reload/discard.

`assessment.js` dùng tracked wrappers cho Builder/Detail để giữ đúng `exam_id` xuyên qua các lần render và chuyển trang con, kể cả sau khi vừa tạo bài mới.

Các nút quay lại/hủy/đóng Result chủ động xóa workspace state để người dùng không bị tự đưa ngược vào trang con đã thoát.

### 3.5. Không thay đổi backend trong V12.4.x

Chuỗi V12.4.0–V12.4.3 không thay đổi:

- schema;
- RLS;
- RPC;
- Edge Function;
- Gemini model/fallback.

Các RPC làm bài vẫn giữ nguyên:

```text
start_exam_attempt
get_exam_attempt_payload
save_exam_progress
submit_exam_attempt
get_attempt_result
```

## 4. Persistence hiện tại — phân vai rõ ràng

### `js/ui/subpage-state.js`

Phụ trách:

- workspace/subpage đang mở;
- context system/view/subject;
- entity đang mở;
- vị trí cuộn;
- restore workspace;
- registry chung cho các module.

### `js/ui/form-persistence.js`

Phụ trách:

- form đang nhập;
- checkbox/radio/select/input/textarea;
- ma trận CLO;
- restore form draft.

### Local attempt draft

`student-attempt.js` vẫn giữ một local store chuyên biệt cho dữ liệu recovery có tính thời gian/mạng:

- pending answers chưa sync;
- deadline local;
- current question index.

Đây không phải cơ chế navigation song song với shared persistence. Shared persistence nhớ **đang ở Attempt nào**; local attempt draft nhớ **trạng thái phục hồi bên trong lượt làm đó**.

## 5. Trạng thái 10 issue Assessment ban đầu

- #1 Pause DB constraint: hoàn thành.
- #2 Attempt full-width subpage: **hoàn thành V12.4.0**.
- #3 Builder math/quick edit/manual pick/code: hoàn thành.
- #4 Structure UI redesign: hoàn thành.
- #5 Attempt list + formatted Excel report: hoàn thành.
- #6 Post-submit stuck state: hoàn thành.
- #7 Chrome tab state preservation: core fix + shared persistence đã hoàn thiện thêm.
- #8 Split review permissions: hoàn thành.
- #9 AI comment button: hoàn thành.
- #10 Export / variant center: hoàn thành.

Bổ sung sau danh sách issue ban đầu:

- exact current-question restore: **hoàn thành V12.4.2**;
- Assessment shared persistence registration: **hoàn thành V12.4.3**.

## 6. Backup gần nhất

Các backup/checkpoint mới ngày 06/09/2026:

- `backup-before-persistence-cache-bust-20260906`
- `backup-before-student-attempt-fullwidth-20260906`
- `backup-before-current-question-restore-20260906`
- `backup-before-assessment-shared-persistence-20260906`
- `backup-before-docs-checkpoint-20260906`

Các backup V12.3.x trước đó vẫn giữ nguyên.

## 7. Việc nên ưu tiên tiếp theo

Sau khi 5 hạng mục ổn định đã hoàn thành, ưu tiên chuyển sang kiểm thử tích hợp thay vì tiếp tục refactor lớn:

1. Live-smoke bằng tài khoản thật qua Supabase/RLS:
   - tạo bài;
   - chỉnh bài;
   - rút/đổi/tự chọn/Gemini;
   - sinh viên bắt đầu → chuyển câu → reload → tiếp tục đúng câu;
   - autosave khi mạng bình thường và pending local khi lỗi mạng;
   - nộp bài;
   - review theo `show_review` / `show_answers`;
   - AI nhận xét theo yêu cầu;
   - teacher xem từng lượt.
2. Kiểm thử persistence thực tế:
   - reload tại Detail;
   - reload tại Builder edit/create;
   - reload tại Attempt;
   - reload tại Export Center;
   - chủ động bấm Quay lại rồi reload để bảo đảm không restore ngược.
3. Thử file Excel đáp án+CLO thực tế với `/cham-thi-clo`.
4. Compile TeX với câu có công thức phức tạp.
5. Smoke test đổi học phần khi đang ở Assessment để bảo đảm state không lẫn môn.
6. Sau khi smoke ổn mới cân nhắc tối ưu bundle/asset load lớn hơn.

## 8. Nguyên tắc phát triển tiếp tục

- Backup trước thay đổi rủi ro.
- Làm theo batch nhỏ; nếu đã chia thành hạng mục thì hoàn tất từng hạng mục riêng.
- Không force push.
- So diff trước khi chốt.
- Không refactor chỉ vì file lớn nếu chưa có lỗi/điểm nghẽn rõ ràng.
- Assessment chỉ có một owner runtime.
- Không thêm `MutationObserver` vào Assessment modules.
- AI chỉ gọi khi người dùng chủ động bấm.
- Không để mobile horizontal overflow.
- Giữ draft, workspace, filter, scroll và vị trí câu tối đa có thể.
- SQL/Edge Function thay đổi phải tách riêng và nói rõ thao tác Supabase.

## 9. Tài liệu liên quan

- `README.md`
- `PROJECT-PROGRESS-2026-09-05.md` — checkpoint trước V12.4.x
- `PROJECT-STATUS-2026-09-05.md` — trạng thái V12 đầu ngày 05/09
- `VERSION-v12.0.md`
- `HUONG-DAN-CAP-NHAT-V12.md`
- `PROJECT-NOTES-AI-CLO.md`
- `docs/assessment-v12.3.1-review-ai.sql`

---

Checkpoint này là mốc tiếp tục phát triển sau khi hoàn tất 5 hạng mục ổn định ngày 06/09/2026.
