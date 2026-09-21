# Backlog — việc còn phải làm

Ghi nhận từ team (2026-09-20). Chưa làm / chưa đủ cho product.

## Nền tảng còn thiếu

### 1. Đăng ký tài khoản + OAuth

- [x] Luồng **đăng ký** tài khoản mới (cookie session + soft email verify)
- [x] **OAuth Google** (optional khi `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID` set)
- [ ] OAuth Facebook / liên kết social khác (chưa)
- [x] Session HttpOnly + refresh token DB — xem [`AUTH-SETUP.md`](./AUTH-SETUP.md)

> Facebook và provider-role linking vẫn mở. Google create/link/login đã có.

### 2. Phương thức thanh toán

- [x] VietQR bank QR (`PAYMENT_PROVIDER=vietqr`) + webhook `/payments/webhook` + coordinator verify
- [x] Hackathon Approach A: demo SPL mint trên Solana **devnet** sau PAID (`demo-token.ts`) — banner “Demo token — không phải thanh toán thật”
- [x] Số dư dKNA + lịch sử mint trên Account / Dashboard / Community (mọi role) — xem [`MANUAL-TEST-QR-DEMO.md`](./MANUAL-TEST-QR-DEMO.md)
- [ ] Cổng merchant thật (MoMo / VNPay) khi có tài khoản hộ pilot
- [ ] Mainnet / settlement thật (không nằm trong demo mint)

### 3. Địa chỉ ví

- [x] Link Phantom wallet (cookie session) + Explorer link trên Account (`GuestReceiptPanel`)
- [ ] Hiển thị ví Provider / Community Fund trên hồ sơ công khai
- [ ] Phân biệt rõ vai trò ví khách vs Provider / quỹ / KNĂ trong UX product

---

## Lịch sprint

### 1. 20–22/9 — Hoàn thiện luồng tiền đi

**Business path**

```
Traveler (địa chỉ ví của khách)
  → Booking
  → Payment
  → Impact (địa chỉ ví của Provider / Community Fund)
```

**Technical path**

```
Frontend → API → Wallet → Transaction
  → KNĂ program → PDA → CPI → Token Program
  → Community Fund + KNĂ's wallet
```

Checklist:

- [ ] Traveler có địa chỉ ví gắn tài khoản
- [ ] Booking tạo được và nối sang Payment
- [ ] Payment settle → ghi nhận Impact (Provider + Community Fund)
- [ ] On-chain: Wallet → tx → program KNĂ → PDA → CPI → Token Program
- [ ] Phân phối đúng tới Community Fund + ví KNĂ (và Provider theo split)

### 2. 23–24/9 — Polishing UI và tính năng khác

- [ ] Thêm / hủy **giỏ hàng**
- [ ] Cập nhật **ảnh sản phẩm** (và các media liên quan)
- [ ] Chỉnh UI còn lại (polish trải nghiệm guest / provider)

---

Liên quan: Track 2 trust layer (`/wallet`, Phantom, Squads) đã có cho operator; các mục trên mở rộng thành luồng tiền + UX product đầy đủ.
