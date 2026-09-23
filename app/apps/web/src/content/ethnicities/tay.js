import { photo } from './media';

/**
 * Tày — Bản Liền, Bắc Hà, Lào Cai.
 *
 * The case study in what mass media plus a development project does to a
 * village economy. Compiled from the research report, not contributed by
 * Bản Liền, which `provenance` records.
 */
export default {
  slug: 'tay',
  name: { vi: 'Tày', en: 'Tày' },
  endonym: 'Cần Tày',
  region: { vi: 'Bản Liền, Bắc Hà, Lào Cai', en: 'Bản Liền, Bắc Hà, Lào Cai' },
  coords: [22.45, 104.35],

  // Shan tea green and palm-thatch, against the same bone and ink.
  theme: {
    kteh: '#3F6146',
    ktehHover: '#35543B',
    copper: '#7A8B4F',
    amber: '#C9A227',
    deep: '#2A3F2E',
  },

  provenance: 'research',

  intro: {
    vi: 'Bản Liền là ví dụ điển hình về việc một vùng quê nghèo cất cánh nhờ truyền thông đại chúng cộng với một dự án phát triển làm nền. Trước đây các hộ chủ yếu bám rẫy bám rừng; sau chương trình "Gia đình HaHa", xã trở thành tâm điểm tìm kiếm trên mạng xã hội. Điều giữ cho nó không sụp xuống thành hiện tượng nhất thời là phần ít ai nhìn thấy: vốn vi mô và đào tạo.',
    en: 'Bản Liền is the clearest case of a poor commune lifting off on mass media with a development project underneath it. Households here lived off the fields and the forest; after the television series "Gia đình HaHa", the commune became a search-trend. What keeps it from collapsing back into a passing fad is the part nobody sees: microfinance and training.',
  },

  identity: [
    {
      key: 'shan-tuyet',
      native: 'Chè Shan tuyết',
      title: { vi: 'Chè Shan Tuyết', en: 'Shan Tuyết Tea' },
      line: { vi: 'Sao trên chảo gang, bếp củi', en: 'Fired in an iron pan over wood' },
      body: {
        vi: 'Chè cổ thụ hái trên núi cao, rồi sao bằng chảo gang trên bếp củi — công đoạn quyết định vị, và là thứ du khách được đứng vào làm chứ không chỉ đứng xem.',
        en: 'Ancient tea trees picked high on the slopes, then fired in a cast-iron pan over a wood fire — the step that decides the flavour, and one visitors are put to work at rather than shown.',
      },
      image: photo(
        'Che Shan tuyet.JPG',
        {
          vi: 'Búp chè Shan tuyết phủ lông trắng đặc trưng.',
          en: 'Shan Tuyết tea buds with their characteristic white down.',
        },
        {
          author: 'VuThiAnh',
          license: 'Public domain',
          note: {
            vi: 'Ảnh chụp tại Hà Nội, không phải trên nương chè Bản Liền.',
            en: 'Photographed in Hanoi, not on the Bản Liền slopes.',
          },
        },
      ),
    },
    {
      key: 'nha-san',
      native: 'Rườn sàn',
      title: { vi: 'Nhà Sàn Lá Cọ', en: 'The Palm-Thatch Stilt House' },
      line: { vi: 'Nơi ở, và nơi đón khách', en: 'A home, and where guests sleep' },
      body: {
        vi: 'Nhà sàn truyền thống lợp lá cọ, nay là hạ tầng lưu trú của cả xã. Việc chuyển một ngôi nhà đang ở thành chỗ đón khách mà không biến nó thành khách sạn là phần khó nhất của mô hình này.',
        en: 'The traditional stilt house under palm thatch, now the commune’s entire lodging stock. Turning a house people live in into a house that takes guests, without turning it into a hotel, is the hard part of this model.',
      },
      image: photo(
        'Pac Ngoi homestay.JPG',
        {
          vi: 'Một ngôi nhà sàn của người Tày bên bờ sông.',
          en: 'A Tày stilt house on a riverbank.',
        },
        {
          author: 'Ba Be National Park',
          license: 'CC BY-SA 3.0',
          note: {
            vi: 'Chụp ở Pác Ngòi, Ba Bể (Bắc Kạn) — làng Tày, nhưng không phải Bản Liền.',
            en: 'Photographed at Pác Ngòi, Ba Bể (Bắc Kạn) — a Tày village, but not Bản Liền.',
          },
        },
      ),
    },
    {
      key: 'hat-then',
      native: 'Hát Then',
      title: { vi: 'Hát Then', en: 'Then Singing' },
      line: { vi: 'Hát cùng đàn tính', en: 'Sung to the tính lute' },
      body: {
        vi: 'Lối hát nghi lễ đi cùng đàn tính, vừa là diễn xướng vừa là thực hành tín ngưỡng — không phải tiết mục dựng riêng cho khách.',
        en: 'A ritual song form carried by the tính lute, at once performance and religious practice — not a number written for visitors.',
      },
      image: photo(
        'Then Singing.JPG',
        {
          vi: 'Buổi hát Then của người Tày với đàn tính.',
          en: 'A Tày Then performance with the tính lute.',
        },
        { author: 'Ba Be National Park', license: 'CC BY-SA 3.0' },
      ),
    },
  ],

  places: [
    {
      name: 'Xã Bản Liền',
      district: 'Huyện Bắc Hà',
      province: 'Lào Cai',
      coords: [22.45, 104.35],
      blurb: {
        vi: 'Xã vùng cao của người Tày, nổi lên từ năm 2025 nhờ chương trình truyền hình thực tế và dự án CRED. Lưu trú trong nhà sàn lá cọ; homestay điển hình là của gia đình chị Vàng Thị Thông.',
        en: 'A Tày upland commune that rose to notice through a reality series and the CRED project. Guests stay in palm-thatch stilt houses; the best-known homestay is the household of Vàng Thị Thông.',
      },
      households: null,
      homestays: null,
      recognition: null,
    },
  ],

  experiences: [
    {
      title: { vi: 'Lội ruộng cấy lúa', en: 'Into the paddy' },
      body: {
        vi: 'Được trang bị nông cụ và trực tiếp lội ruộng cấy lúa, nhổ sắn — đúng những việc mà người trong xã làm trong ngày hôm đó.',
        en: 'Handed the tools and put into the paddy to plant rice and pull cassava — whatever the commune is actually doing that day.',
      },
      season: { vi: 'Theo vụ', en: 'Seasonal' },
    },
    {
      title: { vi: 'Hái và sao chè', en: 'Picking and firing tea' },
      body: {
        vi: 'Hái chè Shan tuyết rồi sao bằng chảo gang trên bếp củi, học cách canh lửa và tay đảo.',
        en: 'Picking Shan Tuyết then firing it in a cast-iron pan over wood, learning the heat and the hand.',
      },
      season: null,
    },
    {
      title: { vi: 'Đan nón cọ, lợp mái', en: 'Palm hats and roofing' },
      body: {
        vi: 'Đan nón cọ và lợp mái nhà bằng lá cọ — kỹ năng bảo trì ngôi nhà, không phải lớp thủ công cho khách.',
        en: 'Weaving palm hats and laying palm thatch — house maintenance, not a craft class.',
      },
      season: null,
    },
    {
      title: { vi: 'Ném đá trên suối, tắm suối', en: 'Stone-skipping and the stream' },
      body: {
        vi: 'Buổi chiều là các trò dân dã: thi ném đá trên suối, tắm suối mát. Phần "chữa lành" của mô hình nằm ở đây chứ không ở spa.',
        en: 'Afternoons go to plain games: skipping stones, swimming in the cold stream. The "healing" in this model is here, not in a spa.',
      },
      season: null,
    },
  ],

  phrases: [
    {
      native: 'Xo Tuông',
      vi: 'Xin chào',
      en: 'Hello',
      note: {
        vi: 'Lời chào tiêu chuẩn, lịch sự và trang trọng, dùng với người lạ hoặc khách phương xa.',
        en: 'The standard greeting, polite and formal, for strangers and visitors from far off.',
      },
      etiquette: null,
    },
    {
      native: 'Chào Pì noọng',
      vi: 'Chào anh chị em',
      en: 'Hello, brothers and sisters',
      note: {
        vi: '"Pì" là người lớn tuổi hơn, "noọng" là người nhỏ tuổi hơn. Dùng khi đã quen hoặc trong không khí thân mật.',
        en: '"Pì" is the elder, "noọng" the younger. Used once acquainted, or where the mood is warm.',
      },
      etiquette: null,
    },
    {
      native: 'Có dú rườn a?',
      vi: 'Có ở nhà không đấy?',
      en: 'Are you home?',
      note: {
        vi: 'Người Tày chuộng chào bằng câu hỏi thăm tình hình thực tế hơn là lời chào khuôn sáo. Một biến thể khác: "Noọng pây hâư è?" — Em đi đâu đấy?',
        en: 'The Tày prefer to greet by asking after what you are actually doing rather than with a set phrase. Another form: "Noọng pây hâư è?" — Where are you off to?',
      },
      etiquette: {
        vi: 'Đây là lời chào, không phải câu tra hỏi. Trả lời qua loa cũng được — điều được hỏi là sự có mặt của bạn, không phải lịch trình.',
        en: 'This is a greeting, not an interrogation. A vague answer is fine — what is being asked after is your presence, not your schedule.',
      },
    },
  ],

  institutions: [
    {
      name: 'CRED',
      role: {
        vi: 'Dự án Tăng cường sinh kế: cấp vốn vi mô và đào tạo vận hành buồng phòng, cách tương tác với khách, kỹ năng quảng bá trên nền tảng số.',
        en: 'A livelihoods project: microfinance plus training in running rooms, dealing with guests, and promotion on digital platforms.',
      },
    },
    {
      name: { vi: 'Đầu bếp khách sạn 5 sao', en: 'Five-star hotel chefs' },
      role: {
        vi: 'Chuẩn hoá ẩm thực: giúp người Tày nêm nếm gia vị địa phương hợp khẩu vị số đông du khách mà vẫn giữ tính nguyên bản.',
        en: 'Standardising the cooking: helping season local dishes to a broader palate without losing what makes them local.',
      },
    },
  ],

  sources: ['Báo cáo §2.2', '§3.1', '§3.2', '§4.1'],
};
