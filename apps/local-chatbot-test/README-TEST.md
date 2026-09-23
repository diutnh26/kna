# KNĂ — Bench test chatbot Gemini dưới local

Thư mục này là **môi trường test độc lập** cho trợ lý AI: một server nhỏ
(`server.ts`) chạy **đúng pipeline production** (LangGraph 3 tầng +
Gemini + RAG trên kho tri thức đã duyệt) và một trang chat tĩnh
(`public/index.html`). Không mock gì cả — trả lời đúng ở đây nghĩa là
trả lời đúng trên website thật, vì cùng một mã nguồn
(`apps/api/src/ai/*`) được import trực tiếp.

Xoá cả thư mục này đi thì hệ thống chính vẫn chạy y nguyên.

## 0. Yêu cầu

- Node 24, PostgreSQL local đang chạy (portable Postgres của dự án chạy ở
  port **5433** — xem `DATABASE_URL` trong `apps/api/.env`).
- `GEMINI_API_KEY` đã đặt trong `apps/api/.env` (lấy tại
  https://aistudio.google.com/apikey). Server này đọc **chính file .env
  của apps/api** — không có bản sao thứ hai để lệch nhau.

## 1. Cài đặt (một lần)

```bash
# từ gốc repo — gói Gemini (@langchain/google-genai, @google/generative-ai)
# đã khai báo sẵn trong apps/api; lệnh này cài cho toàn workspace:
npm install
```

## 2. Chuẩn bị dữ liệu (một lần, và sau mỗi lần seed)

```bash
npm run db:migrate --workspace apps/api    # schema (nếu chưa)
npm run db:seed   --workspace apps/api     # dữ liệu demo — LƯU Ý: xoá sạch vector store
npm run ai:sync   --workspace apps/api     # nhúng (embed) kho tri thức bằng Gemini
npm run ai:calibrate --workspace apps/api  # kiểm tra ngưỡng với embeddings mới
```

`ai:sync` bắt buộc chạy lại sau khi đổi provider/model embedding — retrieval
lọc theo đúng model + số chiều đã ghi trên từng vector, nên corpus cũ
(bge-m3) sẽ "vô hình" với Gemini cho tới khi sync xong.

## 3. Chạy bench

```bash
npm run dev:chatbot-test        # từ gốc repo
# hoặc: npm run dev --workspace apps/local-chatbot-test
```

Mở **http://localhost:4100** (đổi port bằng `CHATBOT_TEST_PORT`).

Trang chat cũng trỏ được vào API chính đang chạy (`npm run dev:api`) để
test đúng server production: **http://localhost:4100/?api=http://localhost:4000**

## 4. Kịch bản test gợi ý

| Câu hỏi | Kỳ vọng |
|---|---|
| "Tôi nên chào người lớn tuổi thế nào?" | **Tier A** — trả nguyên văn câu Hội đồng duyệt |
| "Cồng Chiêng là gì?" | **Tier A/B** — có nguồn |
| "Tôi có thể đặt homestay nào, giá mỗi đêm bao nhiêu?" | **Tier B** — đọc bảng listing thật, trích dẫn [#n] |
| "và ở đó thì sao?" (hỏi nối tiếp) | Memory hoạt động — câu được viết lại rồi mới truy vấn |
| "Thủ đô của Pháp là gì?" | **Tier C** — từ chối, không bịa |

Tier hiển thị ngay dưới mỗi câu trả lời. Nếu banner báo *"Chỉ trả lời câu
đã được duyệt"* → key Gemini chưa đặt/sai; *"Kho tri thức trống"* → chưa
chạy `ai:sync`.

## 5. Sau khi test xong → deploy

Không cần đổi code, chỉ đổi biến môi trường:

1. **Render (API `kna-api`)**: thêm `GEMINI_API_KEY` trong dashboard
   (render.yaml đã khai báo `sync: false`). CORS đã cấu hình qua
   `CORS_ORIGIN`.
2. **Chạy sync cho DB production một lần**: `DATABASE_URL=<Neon> npm run
   ai:sync --workspace apps/api` (embed corpus bằng đúng model server sẽ
   dùng).
3. **Web (`kna-web`)**: không cần gì thêm — UI gọi API qua `VITE_API_URL`
   (đã bake lúc build). Giao diện Assistant có sẵn của website đã được nối
   vào endpoint `/chat` (luồng 3 tầng), **tuyệt đối không** đưa
   `GEMINI_API_KEY` vào bất kỳ biến `VITE_*` nào — Vite nhúng chúng vào
   bundle công khai.

## 6. Cấu hình linh hoạt

Tất cả đọc từ `apps/api/.env`:

```
GEMINI_API_KEY=...            # bật provider gemini tự động
AI_PROVIDER=gemini|ollama|off # ghi đè autodetect nếu muốn
AI_CHAT_MODEL=gemini-flash-latest
AI_EMBED_MODEL=gemini-embedding-001
AI_EMBED_DIMENSIONS=3072
AI_CURATED_THRESHOLD / AI_EVIDENCE_THRESHOLD  # chỉ chỉnh sau khi ai:calibrate
```
