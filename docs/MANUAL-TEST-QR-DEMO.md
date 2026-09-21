# Manual test — QR → dKNA (mọi role + kiểm tra từng ví)

Hướng dẫn tái thực thi trên Docker local (`http://localhost:8080`).  
**Demo token — không phải thanh toán thật. Chỉ Solana Devnet.**

## 0. Chuẩn bị

```powershell
cd d:\Travel\kna-docker
docker compose up -d
# Đợi healthy:
docker ps
Invoke-RestMethod http://localhost:4000/health
Invoke-RestMethod http://localhost:4000/chain/status | ConvertTo-Json -Depth 5
```

Kiểm nhanh:

- `demoToken.enabled` = `true`
- Có `balances.guest / provider / community` (số dKNA)
- Web: http://localhost:8080 — banner vàng “Demo token…”

Nếu booking báo *dates not open*: seed lại slot (một lần):

```powershell
$sql = @'
INSERT INTO "AvailabilitySlot" (id, "listingId", date, capacity, booked)
SELECT md5(random()::text || clock_timestamp()::text), l.id,
       (CURRENT_DATE + g.n)::timestamp, 24, 0
FROM "Listing" l
CROSS JOIN generate_series(0, 119) AS g(n)
WHERE l.published = true
ON CONFLICT ("listingId", date) DO NOTHING;
'@
$sql | docker exec -i kna-local-postgres-1 psql -U kna -d kna_dev
```

### Google OAuth (nếu dùng)

Trong Google Cloud → OAuth client **Final_Uni**, thêm origins:

- `http://localhost:8080`
- `https://kna-web.onrender.com` (khi deploy)

Manual này ưu tiên **email/password** bên dưới.

---

## 1. Tài khoản test

Mật khẩu chung: **`changeme123`**

| Role | Email | Màn hình chính | Tiền hiển thị |
|------|--------|----------------|---------------|
| **Guest** | `guest@example.kna` | Travel → Account | “What you have sent…” + số dư dKNA guest |
| **Provider** (homestay Amí H'Bia) | `ami.hbia@example.kna` | Dashboard + Account | Earnings hộ + số dư dKNA provider |
| **Coordinator** | `coordinator@example.kna` | Dashboard (queue) + Account | Platform totals + lịch sử mint |
| Provider khác (tuỳ chọn) | `aduon.sun@example.kna` | Dashboard | Earnings listing của họ |

### Ví demo Devnet (cố định trong env)

| Vai trò | Pubkey | Xem trên Explorer |
|---------|--------|-------------------|
| Guest | `5J9ixFxaUBe1bNDxPec67shUjRce831GgAyoE1Ygyu8V` | [link](https://explorer.solana.com/address/5J9ixFxaUBe1bNDxPec67shUjRce831GgAyoE1Ygyu8V?cluster=devnet) |
| Provider | `ACP16wSVq6au2wjdyQJLren8HY1bKa5Xfiq4majUfuf7` | [link](https://explorer.solana.com/address/ACP16wSVq6au2wjdyQJLren8HY1bKa5Xfiq4majUfuf7?cluster=devnet) |
| Community fund | `3yY8ey4qCgN6kRLdbobDKU78siQJqWgP8Hum1sUcia42` | [link](https://explorer.solana.com/address/3yY8ey4qCgN6kRLdbobDKU78siQJqWgP8Hum1sUcia42?cluster=devnet) |
| Mint dKNA | `6yASZNZd9qTwfBv5Ay61RsGvcTzftZkPxZCHgJ97bf7N` | [link](https://explorer.solana.com/address/6yASZNZd9qTwfBv5Ay61RsGvcTzftZkPxZCHgJ97bf7N?cluster=devnet) |

Tỷ giá demo: **1 dKNA ≈ 1.000 VND**.

Ghi lại số dư **trước** mỗi lần mint (panel trên web hoặc Explorer).

---

## 2. Luồng Guest — đặt chỗ → trả → xem coin

1. Đăng xuất hết session → đăng nhập `guest@example.kna` / `changeme123`.
2. Vào **Travel**, chọn listing **per night** (vd. longhouse Amí H'Bia), chọn ngày còn slot, **Book**.
3. Thấy **VietQR** + `paymentRef` dạng `TWRTCK…` + số tiền VND.
4. Ghi `paymentRef` và `totalVnd` (hoặc copy từ Network tab `POST /bookings`).
5. Giả lập thanh toán thành công (webhook local):

```powershell
$ref = "TWRTCK________"   # dán paymentRef thật
$amount = 500000          # đúng totalVnd booking
$body = @{ paymentRef = $ref; status = "PAID"; amountVnd = $amount } | ConvertTo-Json -Compress
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [Text.Encoding]::UTF8.GetBytes("dev-webhook-hmac-secret")
$sig = -join ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($body)) | ForEach-Object { $_.ToString("x2") })
Invoke-RestMethod http://localhost:4000/payments/webhook -Method POST `
  -Headers @{ "Content-Type"="application/json"; "X-Webhook-Signature"=$sig } -Body $body
```

6. Expect response có `demoTxSigs` (3 signature: provider, community, guest).
7. Vào **Account**:
   - Panel **Demo wallets**: số dư Guest / Provider / Community **tăng**.
   - Panel **Demo mint history**: dòng booking mới + 3 link Explorer.
   - Khối VND “What you have sent…” tăng (sau settle).
8. Mở từng Explorer tx → status **Success / Finalized**.
9. So khớp split (booking 500.000 ₫ ví dụ):
   - Provider ≈ 450 dKNA (≈ 450.000 ₫)
   - Community ≈ 15 dKNA (≈ 15.000 ₫)
   - Guest receipt = **+1 dKNA**

---

## 3. Luồng Provider — kiểm tiền hộ + lịch sử

1. Đăng xuất → `ami.hbia@example.kna` / `changeme123`.
2. **Dashboard**:
   - Panel ví + **Demo mint history** (cùng lịch sử nền tảng).
   - Earnings VND tăng nếu booking của listing họ đã CONFIRMED/PAID.
   - Trong list bookings: link Explorer nếu có `demoTxSigs`.
3. **Account**:
   - Eyebrow kiểu “What has reached your household”.
   - Số dư **Provider wallet** trên panel khớp Explorer.
4. Đối chiếu Explorer provider ATA (token account của mint dKNA trên ví provider).

---

## 4. Luồng Coordinator — nhìn toàn nền tảng

1. Đăng xuất → `coordinator@example.kna` / `changeme123`.
2. **Dashboard**: queue xác nhận booking + panel ví/lịch sử (nếu không phải provider).
3. **Account**:
   - Eyebrow “Platform money on KNĂ”.
   - Số booking đã mint demo, volume VND settle.
   - **Demo mint history** đầy đủ.
4. **Community** (không cần login): ví demo + lịch sử mint cạnh public ledger VND.

---

## 5. Checklist từng ví (sau mỗi lần PAID)

| # | Kiểm tra | Pass? |
|---|----------|-------|
| 1 | Guest dKNA +1 (receipt) trên web panel | ☐ |
| 2 | Provider dKNA tăng ≈ `providerPayoutVnd / 1000` | ☐ |
| 3 | Community dKNA tăng ≈ `communityFundVnd / 1000` | ☐ |
| 4 | 3 tx Explorer `finalized` | ☐ |
| 5 | Guest Account activity có link demo tx | ☐ |
| 6 | Provider Dashboard/Account thấy cùng history | ☐ |
| 7 | Coordinator Account thấy platform totals | ☐ |
| 8 | Community trang công khai thấy history | ☐ |

API nhanh:

```powershell
(Invoke-RestMethod http://localhost:4000/chain/status).demoToken.balances | ConvertTo-Json -Depth 5
(Invoke-RestMethod http://localhost:4000/payments/demo-history).items | Select-Object -First 3 | ConvertTo-Json -Depth 4
```

---

## 6. Phân biệt hai “sổ”

| | Postgres ledger (VND) | Demo mint (dKNA / Devnet) |
|--|----------------------|---------------------------|
| Ý nghĩa | Tiền tour / split nghiệp vụ | Bằng chứng demo on-chain |
| UI | “What you have sent…”, Community ledger | Demo wallets + Demo mint history |
| Thật? | Sổ nội bộ demo DB | Token demo — **không** phải thanh toán Solana thật |

---

## 7. Troubleshooting

| Hiện tượng | Cách xử lý |
|------------|------------|
| `demoToken.enabled=false` | Kiểm tra `secrets/.env.demo-token`, `docker compose up -d --force-recreate api` |
| Webhook 401 | Sai HMAC — secret phải là `dev-webhook-hmac-secret`, body JSON đúng chuỗi đã ký |
| `amount does not match` | `amountVnd` webhook ≠ `booking.totalVnd` |
| Số dư không đổi | Hard refresh; đợi ~20s (panel poll); kiểm `demoTxSigs` trong webhook response |
| Booking “dates not open” | Chạy SQL seed slot mục 0 |
| Google `origin_mismatch` | Thêm `http://localhost:8080` vào OAuth origins |

Liên quan: [`EVIDENCE-DEMO-FLOW.md`](./EVIDENCE-DEMO-FLOW.md), [`AUTH-SETUP.md`](./AUTH-SETUP.md).
