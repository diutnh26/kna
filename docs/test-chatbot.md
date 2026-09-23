# Hướng dẫn test Trợ lý ảo (chatbot) trên máy local

Tài liệu này dành cho thành viên đội muốn chạy và test thử chatbot KNĂ
trên máy của mình. Làm theo thứ tự, mất khoảng 15–20 phút cho lần đầu.

## 1. Cần chuẩn bị

| Thứ | Ghi chú |
|---|---|
| **Node.js 24.x** | `node -v` để kiểm tra |
| **PostgreSQL 16+** | Cài bằng installer, hoặc bản ZIP không cần admin — xem `apps/api/README.md` |
| **Gemini API key** | **Mỗi người tự tạo key riêng (miễn phí)** tại <https://aistudio.google.com> → "Get API key". Đừng dùng chung key của người khác — quota free rất thấp và tính theo key. |

## 2. Cài đặt lần đầu

```bash
git clone <repo> && cd kna
npm install

# Tạo 2 database (dùng psql hoặc createdb, tùy bản cài):
createdb kna_dev
createdb kna_test
```

Tạo file cấu hình:

```bash
cp apps/api/.env.example apps/api/.env
```

Mở `apps/api/.env` và sửa:

1. **`DATABASE_URL` / `DIRECT_DATABASE_URL` / `TEST_DATABASE_URL`** — trỏ đúng
   Postgres của bạn. Mặc định là `localhost:5432`; nếu Postgres của bạn chạy
   cổng khác thì đổi cả ba dòng.
2. **`GEMINI_API_KEY`** — dán key bạn vừa tạo.
3. Thêm dòng này (khuyến nghị mạnh — xem mục Quota bên dưới):

   ```
   AI_CHAT_MODEL="gemini-flash-lite-latest"
   ```

> ⚠️ File `.env` đã nằm trong `.gitignore` — **không bao giờ commit key** lên
> GitHub, kể cả vào `.env.example`.

Nạp database và kho tri thức:

```bash
npm run db:generate     # sinh Prisma client
npm run db:migrate      # tạo bảng
npm run db:seed         # nạp dữ liệu demo (hộ dân, dịch vụ, sản phẩm, thẻ kiến thức)
npm run ai:sync         # trích xuất + embed toàn bộ kho tri thức (~500 tài liệu)
```

`ai:sync` là bước quan trọng nhất với chatbot: nó đọc các file PDF/DOCX/MD
trong `apps/api/data/`, nội dung các trang web, hồ sơ quản trị… rồi embed
qua Gemini. Chạy mất 2–5 phút, in tiến độ từng batch. Nếu đứt giữa chừng
(mạng, quota) cứ chạy lại — nó chỉ embed phần còn thiếu.

## 3. Chạy và mở chatbot

Hai terminal:

```bash
npm run dev:api    # API tại http://localhost:4000
npm run dev:web    # Web tại http://localhost:5173
```

Mở **http://localhost:5173/#assistant** và chat.

Kiểm tra nhanh mọi thứ sẵn sàng: mở <http://localhost:4000/chat/health> —
phải thấy `"model": true` và `documents` mỗi ngôn ngữ vài trăm. Nếu
`documents` là 0 → bạn chưa chạy `npm run ai:sync`.

## 4. Test gì? (kèm câu hỏi mẫu)

Chatbot có 4 tầng trả lời, phần chữ nhỏ dưới mỗi câu trả lời cho biết tầng:

| Tầng | Nhãn hiển thị | Nghĩa |
|---|---|---|
| A | "Câu trả lời đã được Hội đồng duyệt" | trả nguyên văn thẻ kiến thức đã duyệt |
| B | "Tổng hợp từ nguồn có trích dẫn" | sinh từ tư liệu, kèm danh sách nguồn bấm được |
| D | "Kiến thức chung — không thuộc kho tư liệu đã duyệt" | kho không có, model trả lời kiến thức chung (không được bịa giá/chính sách KNĂ) |
| C | (từ chối) | chỉ khi không kết nối được model |

Gợi ý kịch bản test:

**Văn hóa Ê Đê (từ tài liệu PDF):**
- *Trang phục truyền thống của người Ê Đê có gì đặc sắc?*
- *Văn học của người Ê Đê gồm những thể loại nào?*
- *Cồng Chiêng là gì?*

**Dịch vụ, sản phẩm, giá & tồn kho (đọc live từ database):**
- *Tôi muốn biết Harvest gong evening*
- *Gùi carrying basket giá bao nhiêu, còn hàng không?*
- *Sản phẩm nào đang còn hàng?*

**Lên lịch trình (agent phân tích điểm đến, số người, ngân sách, sở thích, phương tiện, chỗ ở… + thời tiết thật):**
- *Lên lịch trình 3 ngày cho 4 người, ngân sách 5 triệu, thích dệt thổ cẩm và cồng chiêng, đi xe máy, muốn ngủ homestay nhà dài*

**Chính sách & di chuyển:**
- *Chính sách hủy đặt chỗ của KNĂ như thế nào?*
- *Từ sân bay Buôn Ma Thuột đến Buôn Đôn đi mất bao lâu?*

**Quản trị minh bạch:**
- *Quỹ cộng đồng đã chi tiền vào những việc gì?*
- *Hội đồng quản trị cộng đồng gồm những ai?*

**Đa ngôn ngữ (bot trả lời theo ngôn ngữ của câu hỏi, bất kể nút EN/VI):**
- *What should I know about the traditional costume of the Ede people?*

**Ngoài phạm vi (phải thấy nhãn "Kiến thức chung", và bot gợi ý dịch vụ thật thay vì chối khô):**
- *KNĂ có tour lặn biển không?*
- *What is the capital of France?*

Thấy câu trả lời sai/kỳ → bấm nút **cờ (Flag)** ngay dưới câu trả lời, kèm
lý do. Báo cáo này vào hàng đợi của Hội đồng.

## 5. Dạy thêm kiến thức cho bot

Thả file **`.md` / `.txt` / `.pdf` / `.docx`** vào `apps/api/data/` rồi chạy:

```bash
npm run ai:sync
```

Là xong — bot trả lời được nội dung file đó, kèm trích dẫn. Xóa file + chạy
lại sync thì kiến thức đó biến mất (cơ chế thu hồi).

Muốn biết bot đang **thiếu** kiến thức gì: mọi câu nó không trả lời được từ
kho tư liệu đều tự ghi vào bảng `AssistantGap` (xem qua
`GET /chat/gaps` bằng tài khoản Committee, ví dụ `ami.hbia@example.kna` /
`changeme123`).

## 6. Quota Gemini — đọc kỹ để đỡ tưởng bot hỏng

Key **free** bị giới hạn theo **ngày**: model flash đầy đủ
(`gemini-flash-latest`) chỉ ~20 câu/ngày — test 15 phút là hết, sau đó bot
lỗi hoặc từ chối bất thường. Vì vậy hãy đặt
`AI_CHAT_MODEL="gemini-flash-lite-latest"` như hướng dẫn ở bước 2 (quota
cao hơn nhiều, chất lượng vẫn tốt). Hết quota giữa chừng → đợi sang ngày
hoặc bật billing cho key.

Mỗi lượt hỏi dạng lịch trình tốn ~3 request (phân tích yêu cầu + chọn tool
+ sinh câu trả lời), hỏi đáp thường tốn 1–2.

## 7. Lỗi thường gặp

| Triệu chứng | Nguyên nhân / cách xử lý |
|---|---|
| `/chat/health` trả `documents: 0` | Chưa chạy `npm run ai:sync`, hoặc sync bằng key/model khác với lúc chạy API |
| `Can't reach database server` | Postgres chưa chạy, hoặc sai cổng trong `.env` (cả 3 dòng URL) |
| Bot từ chối mọi câu, kể cả câu dễ | Hết quota Gemini trong ngày (xem mục 6), hoặc `GEMINI_API_KEY` sai |
| `EADDRINUSE :4000` | Còn một tiến trình API cũ — tắt terminal cũ đi |
| Test bằng `curl` tiếng Việt bị từ chối vô lý | Terminal Windows làm hỏng UTF-8 — đặt JSON vào file rồi `curl --data-binary @file.json`, hoặc test qua giao diện web |
| Chạy script trong `apps/api/src/scripts/` không ăn `.env` | Phải chạy từ thư mục `apps/api` (dotenv đọc theo thư mục hiện hành) |

Chạy bộ test tự động (không cần Gemini key):

```bash
npm run test:api    # 135 test, cần kna_test tồn tại
```
