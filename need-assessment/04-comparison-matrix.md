# Ma trận: nhu cầu nghiên cứu ↔ module KNĂ

Cách đọc cột:

- **Nhu cầu (N):** 1 = nhiễu / không phải lỗ hổng Tây Nguyên; 5 = lỗ hổng lặp lại trên nhiều nguồn độc lập.
- **Khớp KNĂ (K):** 1 = không đụng; 5 = thiết kế nhằm đúng lỗ đó.
- **Bằng chứng (B):** 1 = báo chí / suy diễn; 5 = nghiên cứu hiện trường Tây Nguyên hoặc USSH/RMIT peer-reviewed.
- **Cần thiết ròng:** round(0.5N + 0.3K + 0.2B). Module điểm cao nhưng K thấp = “ngành cần, KNĂ chưa làm”. Module N thấp = “đừng build sớm”.

---

## 1. Module Phase 1 (MVP)

| Nhu cầu ngành (nguồn) | Module KNĂ | N | K | B | Ròng | Nhận xét |
|---|---|---|---|---|---|---|
| CBT manh mún, thiếu tổ chức chia lợi ích minh bạch (Đặng 2024; Nguyễn 2025) | Sổ cái công khai, chỉ hiện giao dịch đã tất toán | 5 | 5 | 4 | **4.8** | Đúng bệnh “ledger hiện tiền chưa chuyển” đã sửa 8/2026 |
| Tác nhân ngoài nắm kênh và lợi nhuận (Nguyễn 2025; OTA 80%; Ba Bể 2026) | Booking P2P, phí 5% | 5 | 5 | 4 | **4.8** | 5% vs 15–20% OTA; chưa có số Đắk Lắk |
| Cộng đồng muốn quyết định, không chỉ bán (Nguyễn et al. 2025 JCHMSD; workshop Lak) | Hội đồng Ê Đê, KNĂ 0 phiếu | 5 | 5 | 5 | **5.0** | Khớp vốn chính trị — ưu tiên #1–2 hiện trường |
| Khách CBT Tây Nguyên bị kéo bởi trải nghiệm văn hóa (Lang 2024 USSH; JoTS 2023 n=745) | Archive do già làng duyệt; không dàn lễ; phrasebook | 5 | 5 | 5 | **5.0** | Trụ cầu mạnh nhất trong toàn bộ corpus |
| Nghề thủ công generic / đứt OCOP (RMIT Lo Lo 2026; Oanh 2022 Akŏ Dhông; Phan 2024) | Marketplace 95% + chứng nhận hội đồng | 4 | 5 | 4 | **4.3** | Cùng nguyên lý RMIT, khác tộc |
| Lợi ích không lan ra cả buôn, hộ cạnh tranh lẻ (Tuôr 2025; Asker/CBT theory) | Quỹ cộng đồng 3% + phút họp công khai | 4 | 4 | 3 | **3.8** | Cơ chế có; chưa chứng minh 3% đủ / công bằng |
| Homestay không có kênh trực tiếp, dính OTA/Facebook (Ba Bể 2026) | App đặt chỗ + coordinator queue | 5 | 4 | 3 | **4.3** | Analog khác tỉnh; coordinator = giả định năng lực người |
| Xác minh chủ nhà / chống diễn “văn hóa thuê” | Verified provider theo mùa | 4 | 4 | 3 | **3.8** | Nghiên cứu kêu authenticity; quy trình xác minh là giả định vận hành |
| Đào tạo kỹ năng dịch vụ & số (Nguyễn 2025 human capital; RMIT GREAT; Tuôr) | Dashboard hộ (đã dịch VI) | 5 | 2 | 5 | **3.9** | **Lỗ lớn:** UI ≠ đào tạo. RMIT/USSH đều xếp skill trên tool |
| Kết nối lữ hành / DMC (Hoang et al. 2023 RMIT; Tuôr) | Cổng ra 1 B2B partner | 4 | 2 | 4 | **3.2** | Nhu cầu cao, **chưa có sản phẩm B2B** |
| Thanh toán khớp ví hộ VN | ManualSettlementGateway | 5 | 3 | 3 | **3.8** | Thủ công đúng pilot; không scale; blocker đã tự nhận |
| i18n / khách nội địa + quốc tế (Lang: thông tin & tiếp cận) | EN·VI, 143 keys, test | 4 | 5 | 4 | **4.3** | Dashboard từng English-only — đã sửa, khớp bằng chứng cầu |
| Không rating sao / bảo vệ chủ nhà | Feedback vào họp tháng, không sao | 3 | 5 | 2 | **3.4** | Phù hợp văn hóa; ít paper đo hiệu ứng |

## 2. Module Phase 2+ (cố ý trì hoãn)

| Nhu cầu | Module | N | K (thiết kế) | B | Ròng | Có nên kéo vào MVP? |
|---|---|---|---|---|---|---|
| Tương tác chủ–khách kém (Nguyễn 2024 JCU) | Trợ lý AI etiquette, RAG archive đã duyệt | 3 | 4 | 4 | 3.5 | **Không.** Quy tắc nhà + archive đã che phần lớn |
| Hành vi xanh / khí hậu là pull #2 (Lang 2024) | Carbon tracker → dự án buôn | 3 | 4 | 4 | 3.5 | **Không** cho beachhead. Hữu ích báo cáo ESG Phase 3 |
| “Proof of impact” bị nghi ngờ | Blockchain sau 1 tháng song song sổ cái | 2 | 3 | 2 | 2.3 | **Không.** Minh bạch ≠ chain. Đúng khi dự án để sau |
| Nhân bản buôn | Multi-tenant Phase 3 | 4 | — | 3 | — | Sau khi 1 buôn chạy; Nghị quyết 2026–2030 sẽ hỏi đúng cái này |
| Chứng chỉ số authenticity | Digital certificates | 3 | — | 3 | — | Hội đồng giấy trước; RMIT cho thấy chuyện *kể* quan trọng hơn QR |

## 3. So sánh KNĂ với “cái đang có” trên thị trường

| Việc khách / hộ cần | Booking.com / Agoda | Facebook inbox | Tour DMC | Nghị quyết 08 (hạ tầng) | KNĂ |
|---|---|---|---|---|---|
| Tìm hộ Ê Đê | Có nếu hộ lên OTA | Có, rời | Gói sẵn | Không | Có, verified |
| Hoa hồng ở lại buôn | 15–20% ra nước ngoài | 0% nhưng không sổ | DMC lấy phần lớn | Không | 5% + 3% quỹ |
| Sổ chia doanh thu công khai | Không | Không | Không | Không | Có |
| Hội đồng cộng đồng phủ quyết nội dung | Không | Không | Không | Ban QL buôn (hành chính) | Có, 0 phiếu KNĂ |
| Archive già làng | Không | Không | Script tour | Bảo tàng / lễ | Có |
| Đào tạo vận hành | Không | Không | Tập huấn tỉnh rời | Tập huấn kỹ năng | **Yếu** |
| Thanh toán ví VN | Có (OTA) | CK / MoMo tự do | Qua công ty | Không | Thủ công |

KNĂ không thắng OTA ở *tầm phủ*. KNĂ thắng ở *chỗ OTA cấu trúc không làm*: quyền, sổ, quỹ, archive. Đó là lý do “cần thiết” — niche đúng, không phải thị phần.

## 4. Bản đồ nguồn × trụ KNĂ

Đánh dấu: ● neo chính · ○ hỗ trợ · — không đụng

| Nguồn | P2P booking | Sổ cái / quỹ | Hội đồng | Archive văn hóa | Marketplace | Đào tạo | B2B |
|---|---|---|---|---|---|---|---|
| Lang 2024 USSH (cầu CBT TN) | ○ | — | — | ● | — | — | — |
| JoTS 2023 Lang & Long | ○ | — | — | ● | — | — | ○ |
| Thắng / Oanh 2022 Akŏ Dhông | ○ | — | ○ | ○ | ● | ○ | — |
| RMIT Lo Lo Chai 2026 | — | — | ● | ● | ● | ● | — |
| RMIT GREAT Lào Cai | — | — | — | — | — | ● | — |
| Hoang et al. 2023 RMIT lữ hành | — | — | — | — | — | — | ● |
| Nguyễn 2025 DLU Lak | ○ | ● | ● | ○ | ○ | ● | ○ |
| Nguyễn et al. 2025 JCHMSD | ○ | ○ | ● | ○ | — | ○ | — |
| Đặng 2024 CBT TN | ○ | ● | ● | ○ | — | ○ | — |
| Phan 2024 agritourism Đắk Lắk | ○ | — | — | ○ | ○ | ● | — |
| Ba Bể 2026 OBS | ● | — | — | — | — | ● | — |
| OTA 80% / leakage | ● | ● | — | — | — | — | — |
| NQ 08 + Tuôr | — | ○ | ○ | — | — | ● | ● |
