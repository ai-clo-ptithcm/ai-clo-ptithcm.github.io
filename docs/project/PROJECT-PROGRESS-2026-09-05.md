# AI-CLO PTITHCM — TIẾN TRÌNH DỰ ÁN 05/09/2026

> Checkpoint sau chuỗi nâng cấp Assessment V12.3.x. Tài liệu này ghi lại trạng thái mã nguồn, kiến trúc, chức năng đã hoàn thành, việc cần làm trên Supabase và các nguyên tắc tiếp tục phát triển.

## 1. Checkpoint hiện tại

- Repository: `ai-clo-ptithcm/ai-clo-ptithcm.github.io`
- Nhánh chính: `main`
- Commit hiện tại: `a15ce997ab55997a2ba6948603e5f2318e92d15a`
- GitHub Pages: build/deploy thành công sau tối ưu persistence.
- Backend schema checkpoint vẫn là `assessment_schema_version = 12.3.1`.
- Không có migration Supabase mới cho các đợt V12.3.2 → V12.3.6.

## 2. Kiến trúc Assessment hiện tại

Assessment frontend giữ đúng 7 file owner-domain:

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

Các nguyên tắc đã chốt:

- `assessment.js` là owner/router/lifecycle public runtime duy nhất.
- Child modules không tự gán `window.exams`, `window.results`.
- Child modules đăng ký factory qua `window.AICLO_ASSESSMENT_MODULES`.
- Không dùng monkey patch trong Assessment.
- Không đặt MutationObserver trong các Assessment modules.
- Utility xuất đề online đặt riêng tại `js/exams/online-export.js`.
- Supabase Edge Functions tiếp tục self-contained, không phụ thuộc `_shared`.

## 3. Các nâng cấp Assessment đã hoàn thành

### V12.3.1 — Review + AI + lifecycle

- Sửa trạng thái pause/closed tương thích constraint.
- Tách quyền xem lại kết quả thành:
  - `show_review`: xem lại bài + biết đúng/sai.
  - `show_answers`: thêm đáp án đúng + lời giải.
- Hai quyền có dependency UI hợp lý.
- Bổ sung nút `AI nhận xét bài làm`, chỉ gọi khi người dùng chủ động bấm.
- Edge Function `analyze-assessment` kiểm tra `allow_ai_feedback` ở backend.
- Sau submit, danh sách bài của sinh viên được refresh trước khi hiện kết quả.

### V12.3.2 — Builder tools

Online Builder đã có:

- MathJax render sau draw/replace/Gemini/quick edit.
- Hiện `display_code` rõ trên card câu hỏi.
- `Đổi câu`.
- `Tự chọn` câu thay thế đúng slot ma trận.
- `Sửa nhanh` nội dung câu/đáp án/đáp án đúng/lời giải chỉ trong draft bài kiểm tra, không sửa ngân hàng.
- `Gemini sinh câu` giữ cơ chế chỉ lưu khi chấp nhận.

### V12.3.3 — Thiết kế lại Cấu trúc/ma trận

- Chapter dạng card/collapsible.
- Hiện số mục đã chọn trên từng chương.
- Topic grid responsive.
- Chế độ cấu trúc dùng segmented control.
- Ma trận tách thành card riêng.
- Chỉ hiện chương/mục đã chọn.
- Ô ma trận thể hiện dạng `x / y câu có sẵn`.
- Mobile chuyển ma trận thành card dọc, không tràn ngang.

### V12.3.4 — Danh sách bài làm + Excel kết quả

Danh sách bài làm có:

- Sinh viên.
- Lần làm.
- Thời gian bắt đầu/nộp.
- Điểm tổng.
- CLO động theo học phần.
- Trạng thái.
- Thao tác.

Nút `Tải kết quả Excel` có 3 chế độ:

- Điểm cao nhất.
- Tất cả lần làm.
- Điểm trung bình.

Excel dùng ExcelJS, định dạng:

- Times New Roman 12.
- Excel Table thật.
- Đường kẻ đầy đủ.
- Căn lề theo dữ liệu.
- Cột tự căn phù hợp.
- Điểm/CLO < 4 tô đỏ nhạt.
- Khối thông tin bài kiểm tra.
- Khối tổng hợp lớp.
- A4 ngang, fit 1 trang chiều rộng.
- Footer trang.

### V12.3.5 — Xuất đề / Tạo mã đề

Đã có subpage riêng `Xuất đề / Tạo mã đề` từ trang Chi tiết bài kiểm tra.

Chức năng:

- Tạo 1–20 mã đề.
- Mặc định có thể bắt đầu từ 101.
- Cho nhập danh sách mã đề tùy ý.
- Trộn câu.
- Trộn đáp án và tự cập nhật đáp án đúng.
- Preview từng mã đề.
- Dùng frozen snapshot, không rút câu mới.
- Hiện CLO và mã câu.
- Render công thức toán ở preview.

Xuất file:

- TeX cho mã đang xem.
- Excel đáp án + CLO.
- ZIP toàn bộ mã đề.

Excel đáp án có sheet canonical:

```text
Câu | 101 | CLO | 102 | CLO | 103 | CLO | ...
```

và thêm:

- `Thong_tin`
- `Ban_in`

`Ban_in` hỗ trợ bố cục 1 / 2 / 4 khối để tiết kiệm giấy.

## 4. Persistence / giữ màn hình — kiến trúc đã chốt

Chỉ giữ đúng 2 file persistence dùng chung cho toàn web:

```text
js/ui/subpage-state.js
js/ui/form-persistence.js
```

Không tạo thêm persistence file mới trong tương lai nếu không thật sự bắt buộc.

### `subpage-state.js`

Trách nhiệm:

- nhớ workspace/subpage hiện tại;
- nhớ context hệ thống/học phần/view;
- nhớ entity đang mở;
- nhớ vị trí cuộn;
- restore sau page lifecycle khi cần;
- tránh restore đè lên workspace đang còn sống.

V12.3.6 đã tối ưu:

- cache snapshot trong RAM;
- chỉ ghi `sessionStorage` khi state thật sự đổi;
- debounce/coalesce detect;
- save scroll theo idle thay vì ghi liên tục;
- nhận diện thêm các workspace Assessment mới;
- API `register/unregister` để các module toàn web đăng ký workspace vào hạ tầng chung.

### `form-persistence.js`

Trách nhiệm:

- giữ dữ liệu form đang nhập;
- checkbox/radio/select/input/textarea;
- ma trận CLO;
- khôi phục draft khi form mở lại.

V12.3.6 đã tối ưu:

- giảm ghi storage thừa;
- cache snapshot;
- debounce input khoảng 320 ms;
- flush ngay khi tab ẩn/pagehide;
- tối ưu restore ma trận bằng Map;
- giảm observer/polling thừa;
- bổ sung API đăng ký động để các form toàn web dùng chung cơ chế này.

### Nguyên tắc persistence từ nay

- Mọi workspace mới phải đăng ký vào `subpage-state.js`.
- Mọi form/draft UI mới phải dùng `form-persistence.js` hoặc API của file này.
- Không tạo cơ chế giữ màn hình rải rác trong từng module nếu có thể quy về 2 file chung.
- Dữ liệu chính thức luôn lấy Supabase làm nguồn chuẩn.
- UI persistence chỉ giữ vị trí/draft/local recovery.

## 5. Sinh viên làm bài — cơ chế hiện tại

`student-attempt.js` hiện dùng:

- Supabase autosave cho đáp án chính thức.
- `localStorage` để giữ pending answer khi mạng lỗi.
- Khi mở lại bài: lấy dữ liệu server rồi phủ pending local chưa sync.
- Deadline dùng `min(serverDeadline, localDeadline)` để reload không kéo dài thời gian.
- Sau submit thành công, local attempt draft được xóa.

Lưu ý kỹ thuật còn cần hoàn thiện sau:

- exact restore câu đang xem sau browser discard/reload;
- đưa attempt workspace đăng ký đầy đủ vào persistence chung thay vì chỉ dựa vào drawer còn sống.

## 6. Supabase — việc người dùng cần làm

Hai thao tác backend gần nhất phát sinh từ V12.3.1:

1. Chạy:

```text
docs/assessment-v12.3.1-review-ai.sql
```

2. Redeploy:

```text
supabase/functions/analyze-assessment/index.ts
```

Nếu hai việc này đã làm rồi thì hiện tại không cần thao tác Supabase nào thêm cho V12.3.2 → V12.3.6.

## 7. Backup quan trọng

Các checkpoint gần nhất:

- `backup/v12.3.1-before-builder-tools`
- `backup/v12.3.2-before-structure-redesign`
- `backup/v12.3.3-before-results-excel`
- `backup/v12.3.4-before-export-center-final`
- `backup/v12.3.5-before-ui-persistence-opt`

## 8. Trạng thái 10 issue Assessment ban đầu

- #1 Pause DB constraint: đã xử lý trong migration V12.3.1.
- #2 Attempt full-width subpage: chưa hoàn thành.
- #3 Builder math/quick edit/manual pick/code: hoàn thành.
- #4 Structure UI redesign: hoàn thành.
- #5 Attempt list + formatted Excel report: hoàn thành.
- #6 Post-submit stuck state: hoàn thành.
- #7 Chrome tab state preservation: core fix đã làm; persistence chung đã tối ưu thêm ở V12.3.6.
- #8 Split review permissions: hoàn thành.
- #9 AI comment button: hoàn thành.
- #10 Export / variant center: hoàn thành.

## 9. Việc nên làm tiếp

Ưu tiên tiếp theo:

1. Hoàn thiện #2: đưa màn hình làm bài sang full-width subpage thay vì side drawer.
2. Đăng ký chính thức Online Builder / Attempt / Result / Export Center với persistence chung để reload/discard cũng restore tối đa đúng chỗ.
3. Lưu thêm `currentQuestionIndex` cho attempt để SV mở lại đúng câu đang làm.
4. Live-smoke các luồng cần xác thực Supabase/RLS:
   - tạo bài;
   - chỉnh bài;
   - Gemini accept;
   - sinh viên làm/nộp;
   - xem lại bài theo 2 quyền;
   - AI nhận xét;
   - Excel kết quả;
   - Excel đáp án+CLO;
   - ZIP/TeX export.
5. Thử thực tế file Excel đáp án với `/cham-thi-clo`.
6. Compile thử TeX bằng dữ liệu thật có công thức phức tạp.

## 10. Nguyên tắc phát triển tiếp tục

- Backup trước thay đổi rủi ro.
- Làm theo batch nhỏ 2–3 issue.
- Không force push.
- So diff trước merge.
- Assessment chỉ có một owner runtime.
- Không thêm MutationObserver vào Assessment modules.
- AI chỉ gọi khi người dùng chủ động bấm.
- Không để mobile horizontal overflow.
- Giữ bộ lọc, draft, workspace và vị trí người dùng tối đa có thể.
- SQL/Edge Function thay đổi phải nói rõ thao tác Supabase cho người dùng.

---

Checkpoint này dùng làm mốc tiếp tục phát triển sau ngày 05/09/2026.
