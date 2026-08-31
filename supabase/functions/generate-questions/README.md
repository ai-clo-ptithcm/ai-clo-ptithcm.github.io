# Edge Function generate-questions

## Triển khai

```bash
supabase functions deploy generate-questions
supabase secrets set GEMINI_API_KEY=YOUR_KEY
supabase secrets set GEMINI_MODEL=gemini-3.7-flash
```

Nếu đã đặt `GEMINI_MODEL=gemini-3.6-flash` và model đó vẫn hoạt động, có thể giữ nguyên. Hàm mặc định dùng `gemini-3.7-flash` khi secret model không tồn tại.

Sau khi triển khai, mở Supabase → Edge Functions → `generate-questions` → Logs để xem lỗi chi tiết nếu có.
