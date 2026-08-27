# Hồ sơ dự án KNĂ (đối tượng đánh giá)

## KNĂ là gì

Hệ sinh thái du lịch vòng tuần hoàn do cộng đồng sở hữu, xây với người **Ê Đê** tại **Đắk Lắk**. Tên lấy từ nhà dài (knă) — trung tâm kiến trúc và quyền mẫu hệ. Đội NEXUS, UEF, BKI 2026.

Giả thuyết cốt lõi (một giả thuyết / phase): khách đặt và trả tiền *trực tiếp* cho hộ; hộ vẫn liên lạc được qua nền tảng; phần chia doanh thu đọc được công khai. Không phải blockchain, không phải AI, không phải carbon — những thứ đó bị loại khỏi MVP có chủ ý.

## Năm trụ mà nghiên cứu sẽ đối chiếu

| Trụ | Cách KNĂ làm | Phí / quyền |
|---|---|---|
| Đặt chỗ peer-to-peer | Hộ tự giá, tự ngày, tự nội quy nhà | KNĂ xác minh; coordinator xác nhận |
| Chợ thủ công | Tồn kho, checkout | Hộ giữ **95%**; phí nền tảng 5% |
| Sổ cái minh bạch | Bảng chia doanh thu công khai, tính server-side | Chỉ hiện giao dịch đã tất toán |
| Quỹ cộng đồng | Trích từ booking | **3%** Community Fund |
| Kho lưu trữ văn hóa | Đóng góp hộ; Hội đồng duyệt trước khi xuất bản | KNĂ không bỏ phiếu |
| Quản trị | Ủy ban do buôn đề cử, nhiệm kỳ 1 năm | Nhân sự KNĂ: **0 phiếu** |

Phase 2 (chỉ sau khi pilot đạt cổng ra): blockchain song song 1 tháng với sổ cái giấy/DB; trợ lý AI đúng 2 việc (lịch trình, ứng xử) trên archive đã duyệt; carbon gắn dự án cộng đồng thực.

## Cổng ra hiện trường (chưa đạt — không đạt bằng code)

- 100+ booking hoàn tất trong 3 tháng pilot
- ≥80% provider vẫn hoạt động cuối pilot
- Khảo sát sau chuyến: bảng minh bạch ảnh hưởng quyết định đặt
- 1 đối tác B2B (Intermèdes hoặc Lua Viet Tours) đưa đoàn qua nền tảng

## Hiện trạng kỹ thuật liên quan đánh giá nhu cầu

- Booking, marketplace, sổ cái, archive, dashboard: đã build.
- Thanh toán: `ManualSettlementGateway` — khách thỏa thuận với hộ, coordinator ghi nhận. Đúng với pilot; **chưa** MoMo/VNPay vì phụ thuộc ví của buôn.
- Không email xác nhận, chưa reset mật khẩu, media chưa có pipeline lưu trữ.
- Dữ liệu demo không phải dữ liệu hiện trường.

Đánh giá nhu cầu trong folder này **không** chấm chất lượng code. Nó chấm: nếu xây xong và đưa vào buôn, có giải quyết việc mà nghiên cứu Việt Nam đang kêu hay không.
