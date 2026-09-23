import { photo } from './media';

/**
 * H'Mông — Sin Suối Hồ, Lai Châu.
 *
 * The model built on self-imposed discipline rather than on a programme or
 * a broadcast. Every photograph here is of H'Mông people at Bắc Hà in Lào
 * Cai, a different province and a different subgroup, and each credit says
 * so — Sin Suối Hồ is not photographed on Commons under a free licence.
 */
export default {
  slug: 'hmong',
  name: { vi: "H'Mông", en: "H'Mông" },
  endonym: 'Hmoob',
  region: { vi: 'Sin Suối Hồ, Lai Châu', en: 'Sin Suối Hồ, Lai Châu' },
  coords: [22.47, 103.53],

  // Indigo-black of the dyed cloth, with the silver of the jewellery.
  theme: {
    kteh: '#3D3A6B',
    ktehHover: '#322F59',
    copper: '#8C8AA6',
    amber: '#C2A83E',
    deep: '#262445',
  },

  provenance: 'research',

  intro: {
    vi: 'Cách trung tâm Lai Châu khoảng 30 km, Sin Suối Hồ — nghĩa là "suối có vàng" — đưa ra một mô hình dựa trên kỷ luật tự giác và đạo đức sinh thái. Điều làm nên khác biệt ở đây không phải cảnh quan mà là một bản hương ước, và việc cộng đồng thực sự thi hành nó.',
    en: 'Some 30 km from Lai Châu town, Sin Suối Hồ — "the stream with gold in it" — runs on self-imposed discipline and an ecological ethic. What sets it apart is not the landscape but a village covenant, and the fact that the community actually enforces it.',
  },

  identity: [
    {
      key: 'bon-khong',
      native: 'Hương ước 4 không',
      title: { vi: 'Hương Ước "4 Không"', en: 'The "Four Nos" Covenant' },
      line: { vi: 'Cộng đồng đồng thuận và thi hành', en: 'Agreed and enforced by the village' },
      body: {
        vi: 'Không uống rượu, không cờ bạc, không hút chích ma tuý, không quan hệ lăng nhăng. Bốn điều được cộng đồng đồng thuận và thực thi nghiêm ngặt, biến bản làng thành một môi trường du lịch an toàn và văn minh — nền tảng đạo đức trước, dịch vụ sau.',
        en: 'No drinking, no gambling, no drugs, no infidelity. Four rules the village agreed on and holds to strictly, which is what makes it a safe and orderly place to visit — the ethics first, the hospitality after.',
      },
      image: photo(
        'Flower Hmongs on market, Vietnam.jpg',
        {
          vi: "Phụ nữ H'Mông Hoa tại phiên chợ vùng cao.",
          en: 'Flower Hmong women at an upland market.',
        },
        {
          author: 'Peter Olshevsky',
          license: 'CC BY-SA 4.0',
          note: {
            vi: "Chụp tại chợ Bắc Hà, Lào Cai — người H'Mông Hoa, không phải Sin Suối Hồ (Lai Châu).",
            en: 'Photographed at Bắc Hà market, Lào Cai — Flower Hmong, not Sin Suối Hồ in Lai Châu.',
          },
        },
      ),
    },
    {
      key: 'nhuom-cham',
      native: 'Nhuộm chàm',
      title: { vi: 'Nhuộm Vải Bằng Lá Rừng', en: 'Dyeing Cloth with Forest Leaves' },
      line: { vi: 'Lá cây Tung qua sủ cổ thụ', en: 'From the old Tung qua sủ trees' },
      body: {
        vi: 'Quy trình nhuộm vải bằng lá cây Tung qua sủ cổ thụ, do hướng dẫn viên bản địa giới thiệu. Tri thức về thảo mộc rừng ở đây là một phần của sinh kế, không phải một tiết mục.',
        en: 'Cloth dyed with leaves from the old Tung qua sủ trees, explained by guides from the village. Knowledge of forest plants here is part of the living, not a set piece.',
      },
      image: photo(
        '2007-12-09 Bac Ha market, Flower Hmong girl.jpg',
        {
          vi: "Một cô gái H'Mông Hoa trong trang phục nhuộm và thêu tay tại chợ Bắc Hà.",
          en: 'A Flower Hmong girl in hand-dyed and embroidered dress at Bắc Hà market.',
        },
        {
          author: 'Arian Zwegers',
          license: 'CC BY 2.0',
          note: {
            vi: "Chụp tại chợ Bắc Hà, Lào Cai — người H'Mông Hoa, không phải Sin Suối Hồ.",
            en: 'Photographed at Bắc Hà market, Lào Cai — Flower Hmong, not Sin Suối Hồ.',
          },
        },
      ),
    },
    {
      key: 'da-so-do',
      native: 'Đá sổ đỏ',
      title: { vi: 'Đá Sổ Đỏ', en: 'The Land-Deed Stones' },
      line: { vi: 'Nhân khẩu khắc lên đá tảng', en: 'Households cut into boulders' },
      body: {
        vi: 'Người H’Mông xưa khắc nhân khẩu lên đá tảng để đánh dấu quyền sở hữu — một hệ thống đăng ký đất đai bằng đá, còn nằm nguyên tại chỗ và đọc được.',
        en: 'The H’Mông here once cut their household numbers into boulders to mark ownership — a land registry in stone, still in place and still legible.',
      },
      image: photo(
        'Flower Hmongs market, Vietnam.jpg',
        {
          vi: "Phiên chợ vùng cao của người H'Mông Hoa.",
          en: 'An upland Flower Hmong market.',
        },
        {
          author: 'Peter Olshevsky',
          license: 'CC BY-SA 4.0',
          note: {
            vi: 'Ảnh tạm — đang chờ ảnh Đá sổ đỏ tại Sin Suối Hồ.',
            en: 'A stand-in until a photograph of the land-deed stones at Sin Suối Hồ arrives.',
          },
        },
      ),
    },
  ],

  places: [
    {
      name: 'Bản Sin Suối Hồ',
      district: 'Xã Sin Suối Hồ, huyện Phong Thổ',
      province: 'Lai Châu',
      coords: [22.47, 103.53],
      blurb: {
        vi: 'Cách trung tâm thành phố Lai Châu khoảng 30 km. Tên bản nghĩa là "suối có vàng". Lưu trú được thiết kế sáng tạo và thân thiện với thiên nhiên — "homestay tổ chim", "tổ ếch".',
        en: 'About 30 km from Lai Châu town; the name means "the stream with gold in it". Its lodgings are built inventively and close to the land — the "bird’s nest" and "frog’s nest" homestays.',
      },
      households: null,
      homestays: null,
      recognition: null,
    },
  ],

  experiences: [
    {
      title: { vi: 'Trekking săn mây', en: 'Trekking for the cloud sea' },
      body: {
        vi: 'Đi xuyên rừng già để săn mây — hoạt động chính, và là lý do phần lớn khách đến vào mùa lạnh.',
        en: 'Through old forest to catch the cloud sea — the main draw, and the reason most visitors come in the cold months.',
      },
      season: { vi: 'Mùa lạnh', en: 'Cold season' },
    },
    {
      title: { vi: 'Thác Trái Tim, thác Tình Yêu', en: 'The Heart and Love waterfalls' },
      body: {
        vi: 'Hai thác nước trong khu vực bản, đi bộ tới được trong ngày.',
        en: 'Two waterfalls within the village’s reach, both walkable in a day.',
      },
      season: null,
    },
    {
      title: { vi: 'Đường đá cổ Pavis', en: 'The old Pavis stone road' },
      body: {
        vi: 'Dạo bước trên con đường đá do người Pháp xây từ những năm 1920, nay là một tuyến đi bộ xuyên lịch sử.',
        en: 'Walking the stone road the French laid in the 1920s, now a path through the history as much as the terrain.',
      },
      season: null,
    },
    {
      title: { vi: 'Homestay tổ chim, tổ ếch', en: 'The nest homestays' },
      body: {
        vi: 'Lưu trú trong các kiến trúc tự thiết kế lấy hình tổ chim, tổ ếch — sáng tạo của chính người trong bản.',
        en: 'Staying in structures shaped as birds’ and frogs’ nests, designed by the villagers themselves.',
      },
      season: null,
    },
  ],

  phrases: [
    {
      native: 'Nyob zoo',
      vi: 'Xin chào',
      en: 'Hello',
      note: {
        vi: 'Đọc gần như "nhô dzô". Lời chào phổ biến nhất.',
        en: 'Sounds close to "nyaw zhong". The most common greeting.',
      },
      etiquette: null,
    },
    {
      native: 'Nyob zoo tij laug / niam laus',
      vi: 'Chào anh / chào chị',
      en: 'Hello, elder brother / elder sister',
      note: {
        vi: 'Dùng với người lớn tuổi hơn, hoặc khi muốn thể hiện sự kính trọng.',
        en: 'For someone older, or wherever respect is meant to be shown.',
      },
      etiquette: null,
    },
    {
      native: 'Ua tsaug',
      vi: 'Cảm ơn',
      en: 'Thank you',
      note: {
        vi: 'Đọc gần như "ua chao". Dùng khi được mời ăn, được chỉ đường, được giúp.',
        en: 'Sounds close to "ua chao". For a meal offered, directions given, help received.',
      },
      etiquette: null,
    },
  ],

  institutions: [],

  sources: ['Báo cáo §2.4', '§3.1', '§4.1'],
};
