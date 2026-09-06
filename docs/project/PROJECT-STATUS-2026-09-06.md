# AI-CLO PTITHCM — TRẠNG THÁI DỰ ÁN 06/09/2026

## Mốc hiện tại

Dự án đang ở checkpoint frontend **V12.4.24**.

- Repository: `ai-clo-ptithcm/ai-clo-ptithcm.github.io`
- Nhánh chuẩn: `main`
- Commit checkpoint: `874d1f13c2d1c0e363ceb421a01a83915497a41e`
- GitHub Pages run #688: **success**
- Backend Assessment checkpoint: `assessment_schema_version = 12.3.1`
- Không có migration Supabase hoặc redeploy Edge Function mới cho đợt frontend/CSS V12.4.x gần nhất.

## Hai giai đoạn chính đã hoàn thành ngày 06/09

### 1. Ổn định Assessment và persistence

- Sửa cache-busting persistence dùng chung.
- Student Attempt chuyển sang full-width subpage trong `#content`.
- Attempt giữ Supabase autosave, pending local khi lỗi mạng và deadline không bị kéo dài do reload.
- Lưu/khôi phục `currentQuestionIndex` để mở lại đúng câu đang làm.
- Assessment đăng ký Detail / Builder / Attempt / Attempt Result / Results / Export với `AICLO_SUBPAGE_STATE`.
- Builder/Detail theo dõi đúng `exam_id` xuyên qua render.
- Các nút quay lại/hủy/đóng Result chủ động xóa workspace state để không restore ngược.
- Không thêm `MutationObserver` vào Assessment child modules.

### 2. Hoàn tất refactor CSS ownership

Đã xử lý toàn bộ các cụm lớn:

- shell/header/sidebar/footer/Drawer;
- Auth/Login;
- Course Structure;
- Question Bank;
- Notification/Activity;
- Dashboard/Profile/Members;
- Assessment/detail compatibility;
- dialog/modal/confirm;
- app layout và UI primitives;
- brand/logo;
- generic responsive layout system.

Kết quả:

- `css/ui/final-layer.css` đã bị loại khỏi runtime và xóa.
- `css/public.css` không còn load trong `app.html`.
- `css/app.css` chỉ còn base controls/form primitives.
- `css/app-brand.css` là sole owner logo/brand.
- `css/ui/application.css` là sole owner app geometry/layout.
- `css/ui/primitives.css` sở hữu panel/table/stats/toolbar/badge/toast…
- `css/ui/shell.css` sở hữu sidebar/header/footer/Drawer chrome.
- `css/ui/layout-system.css` chỉ còn generic `.aiclo-*`, không còn selector module.
- CSS nghiệp vụ đã trở về đúng thư mục domain.

## Kiến trúc Assessment hiện tại

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

- `assessment.js` là owner runtime duy nhất.
- Child modules đăng ký factory qua `window.AICLO_ASSESSMENT_MODULES`.
- Supabase là nguồn dữ liệu chính thức.
- Local/session chỉ giữ UI state, draft và recovery.

## Persistence hiện tại

Shared:

```text
js/ui/subpage-state.js
js/ui/form-persistence.js
```

Attempt local recovery chỉ giữ:

- pending answers chưa sync;
- deadline local;
- `currentQuestionIndex`.

Không tạo navigation persistence thứ ba.

## CSS hiện tại

Khoảng:

- **61 source CSS** trong `css/`;
- ~226 KB source chưa nén;
- `app.html` link trực tiếp khoảng 47 stylesheet (~164 KB source);
- `css/legacy/` là archive only.

Dung lượng không lớn. Nếu cần tối ưu request trong tương lai, ưu tiên **build/deploy bundle**, không nhập thủ công source CSS trở lại thành file lớn.

## Backend / Supabase

Không thay đổi trong chuỗi refactor CSS/documentation gần nhất:

- schema;
- RLS;
- RPC;
- Edge Functions;
- Gemini model/fallback.

Edge Functions tiếp tục phải self-contained, không phụ thuộc `_shared`.

## Tổ chức repository

- `README.md` — checkpoint hiện tại và điểm vào tài liệu.
- `docs/releases/` — lịch sử phiên bản/hướng dẫn nâng cấp.
- `docs/project/ARCHITECTURE-AI-CLO.md` — kiến trúc hệ thống hiện hành.
- `docs/project/PROJECT-NOTES-AI-CLO.md` — quyết định kỹ thuật/UI ưu tiên.
- `docs/project/TECHNICAL-AGREEMENTS.md` — quy tắc kỹ thuật bắt buộc.
- `docs/project/PROJECT-PROGRESS-2026-09-06.md` — tiến trình chi tiết trong ngày.
- `supabase/migrations/`, `schema/`, `policies/`, `functions/`, `docs/` — backend theo chức năng.

## Việc tiếp theo

Không nên tiếp tục refactor CSS chỉ vì muốn giảm số file. Ưu tiên **kiểm thử tích hợp thực tế**:

1. Desktop/mobile shell sau refactor.
2. Login/Auth.
3. Question Bank desktop/mobile, filter, card/table, quick edit.
4. Assessment Detail / Builder / Student Attempt.
5. Reload/discard/tab switch tại các subpage.
6. Teacher/student với Supabase/RLS.
7. Đổi học phần không lẫn state/feedback.
8. Excel đáp án+CLO với `/cham-thi-clo`.
9. Compile TeX với câu có công thức phức tạp.
10. Sau smoke test mới cân nhắc bundle CSS/asset nếu profiling cho thấy cần.

## Tài liệu cần đọc trước khi sửa

1. `PROJECT-NOTES-AI-CLO.md`
2. `ARCHITECTURE-AI-CLO.md`
3. `TECHNICAL-AGREEMENTS.md`
4. file status/progress hiện tại
5. code mới nhất trên `main`

---

Checkpoint này ghi nhận dự án sau khi hoàn tất **Assessment stabilization + CSS ownership refactor V12.4.24**.
