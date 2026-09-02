# AI-CLO PTITHCM — V11

**Checkpoint:** 02/09/2026  
**Runtime commit đã deploy thành công:** `e71e973bea14c09d561eb86d2a9c542e693829d3`  
**GitHub Pages:** run #169 — success

## Trạng thái

V11 tập trung tái cấu trúc frontend, tối ưu tải ban đầu và cải thiện cảm nhận chuyển màn hình mà không thay đổi nghiệp vụ cốt lõi.

### Đã hoàn tất

- Dọn và đổi tên semantic các JS/CSS versioned chính.
- Gộp CSS theo chức năng, giữ nguyên cascade.
- Lazy-load XLSX và JSZip.
- Lazy-load MathJax theo nhu cầu render LaTeX.
- Thêm lớp UX giữ nội dung cũ trong lúc view sidebar mới tải dữ liệu, giảm nháy `Đang tải dữ liệu…` toàn trang.
- Sửa phạm vi AI feedback theo đúng `subject_id` để tránh lẫn nhận xét giữa học phần.

### Không thay đổi

- Không migration Supabase mới.
- Không deploy Edge Function mới cho checkpoint này.
- Không đổi Gemini model/quota/fallback.

## Tài liệu

- [`HUONG-DAN-CAP-NHAT-V11.md`](HUONG-DAN-CAP-NHAT-V11.md)
- [`V11-TECHNICAL-NOTES.md`](V11-TECHNICAL-NOTES.md)

## Bước tiếp theo

Tạm dừng refactor rộng. Quan sát web thực tế trên desktop/mobile và ghi nhận các điểm UX, loading, responsive hoặc nghiệp vụ còn chưa tốt; sau đó sửa từng vấn đề cụ thể từ checkpoint này.
