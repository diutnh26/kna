import { photo } from './media';

/**
 * Khmer — Trà Vinh, Sóc Trăng, An Giang, in the Mekong Delta.
 *
 * The only profile not built on a village. Here the institution is the
 * pagoda, which is why `places` names temples rather than hamlets.
 */
export default {
  slug: 'khmer',
  name: { vi: 'Khmer', en: 'Khmer' },
  endonym: 'ខ្មែរ',
  region: {
    vi: 'Trà Vinh · Sóc Trăng · An Giang, Đồng bằng sông Cửu Long',
    en: 'Trà Vinh · Sóc Trăng · An Giang, the Mekong Delta',
  },
  coords: [9.93, 106.34],

  // The gold and saffron of the pagodas, against temple vermilion.
  theme: {
    kteh: '#B8860B',
    ktehHover: '#9A7009',
    copper: '#C87941',
    amber: '#E8B33D',
    deep: '#7A4A0E',
  },

  provenance: 'research',

  intro: {
    vi: 'Khác với không gian núi rừng, mô hình du lịch của người Khmer ở Tây Nam Bộ xoay quanh thiết chế Phật giáo Nam tông. Ngôi chùa không chỉ là cơ sở thờ tự mà còn là trung tâm giáo dục, nơi lưu trữ di sản và không gian sinh hoạt văn hoá của cả cộng đồng — nên đến với người Khmer là đến với ngôi chùa trước.',
    en: 'Away from the uplands, Khmer tourism in the south-west turns on Theravada Buddhism. The pagoda is not only a place of worship but the community’s school, its archive and its social space — so coming to the Khmer means coming to the pagoda first.',
  },

  identity: [
    {
      key: 'chua-nam-tong',
      native: 'វត្ត — Wat',
      title: { vi: 'Chùa Nam Tông', en: 'The Theravada Pagoda' },
      line: { vi: 'Thờ tự, trường học, kho di sản', en: 'Worship, school, archive' },
      body: {
        vi: 'Ngôi chùa đối với người Khmer là trung tâm giáo dục và lưu trữ di sản, không chỉ là nơi thờ tự. Chùa Âng ở Trà Vinh — tên Khmer là Angkorajaborey — là một trong những ngôi chùa cổ nhất của hệ thống này.',
        en: 'For the Khmer the pagoda is the centre of learning and the keeping of heritage, not only of worship. Chùa Âng in Trà Vinh — Angkorajaborey in Khmer — is among the oldest of them.',
      },
      image: photo(
        'Chùa Âng.jpg',
        {
          vi: 'Chùa Âng bên ao Bà Om, Trà Vinh, mái chồng nhiều tầng kiểu Khmer.',
          en: 'Chùa Âng beside Ao Bà Om in Trà Vinh, its tiered Khmer roofline.',
        },
        { author: 'Bùi Thụy Đào Nguyên', license: 'CC BY-SA 3.0' },
      ),
    },
    {
      key: 'ngu-am',
      native: 'ភ្លេងពិណពាទ្យ',
      title: { vi: 'Nhạc Ngũ Âm', en: 'The Five-Tone Ensemble' },
      line: { vi: 'Dàn nhạc lễ của cộng đồng', en: 'The community’s ceremonial band' },
      body: {
        vi: 'Dàn nhạc ngũ âm đi cùng mọi nghi lễ lớn, từ đám cưới đến lễ hội chùa. Du khách hoà vào nhịp điệu của nó, rồi học các động tác uyển chuyển của điệu múa lăm-thôn.',
        en: 'The five-tone ensemble accompanies every major rite, from weddings to temple festivals. Visitors fall in with its rhythm, then learn the slow turns of the lăm-thôn dance.',
      },
      image: photo(
        'Marriage of Khmer Krom, musicians (Trà Vinh).jpg',
        {
          vi: 'Các nhạc công Khmer chơi trong một đám cưới ở Trà Vinh.',
          en: 'Khmer musicians playing at a wedding in Trà Vinh.',
        },
        {
          author: 'Don',
          license: 'CC BY-SA 3.0',
          note: {
            vi: 'Nhạc công trong lễ cưới — không phải dàn ngũ âm đầy đủ trong lễ hội chùa.',
            en: 'A wedding band rather than a full five-tone ensemble at a temple festival.',
          },
        },
      ),
    },
    {
      key: 'tranh-tuong',
      native: 'Tranh tường',
      title: { vi: 'Tranh Tường Và Lá Buông', en: 'Wall Painting and Palm Leaf' },
      line: { vi: 'Kinh sách và tích Phật', en: 'Scripture and the life of the Buddha' },
      body: {
        vi: 'Tường chùa kể lại cuộc đời Phật Thích Ca bằng tranh; kinh sách được vẽ và khắc trên lá buông. Cả hai đều là nghề đang được truyền lại, và đều mở cho khách thử.',
        en: 'Pagoda walls tell the life of the Buddha in paint; scripture is drawn and cut onto palm leaf. Both are crafts still being handed on, and both are open to visitors to try.',
      },
      image: photo(
        'Tranh tường trong chùa Âng.jpg',
        {
          vi: 'Tranh tường vẽ cuộc đời Phật Thích Ca trong chùa Âng.',
          en: 'Wall paintings of the life of the Buddha inside Chùa Âng.',
        },
        { author: 'Bùi Thụy Đào Nguyên', license: 'CC BY-SA 3.0' },
      ),
    },
  ],

  places: [
    {
      name: 'Chùa Âng (Angkorajaborey)',
      district: 'TP. Trà Vinh',
      province: 'Trà Vinh',
      coords: [9.92, 106.33],
      blurb: {
        vi: 'Ngôi chùa Khmer cổ bên ao Bà Om, một trong những công trình tiêu biểu nhất của hệ thống chùa Nam tông ở Trà Vinh.',
        en: 'An old Khmer pagoda beside Ao Bà Om, among the most notable of the Theravada temples in Trà Vinh.',
      },
      households: null,
      homestays: null,
      recognition: null,
    },
    {
      name: 'Chùa Vàm Rây',
      district: 'Huyện Trà Cú',
      province: 'Trà Vinh',
      coords: [9.72, 106.28],
      blurb: {
        vi: 'Điểm tham quan kiến trúc chùa chiền được đưa vào các Trung tâm Văn hoá – Du lịch Cộng đồng đang xúc tiến ở địa phương.',
        en: 'A temple-architecture stop being folded into the community culture-and-tourism centres the province is setting up.',
      },
      households: null,
      homestays: null,
      recognition: null,
    },
  ],

  experiences: [
    {
      title: { vi: 'Múa lăm-thôn và hoá thân Apsara', en: 'Lăm-thôn, and becoming Apsara' },
      body: {
        vi: 'Học các động tác uyển chuyển của điệu lăm-thôn; nghệ nhân bản địa trang điểm và khoác trang phục rực rỡ để khách hoá thân thành vũ nữ Apsara.',
        en: 'Learning the slow turns of lăm-thôn; local artists paint and dress visitors as Apsara dancers.',
      },
      season: null,
    },
    {
      title: { vi: 'Gốm không bàn xoay', en: 'Pottery without a wheel' },
      body: {
        vi: 'Làm gốm thủ công không dùng bàn xoay — thợ đi vòng quanh khối đất thay vì xoay nó, một kỹ thuật hiếm còn giữ được.',
        en: 'Handbuilt pottery made without a wheel — the potter walks around the clay instead of turning it, a technique few places still hold.',
      },
      season: null,
    },
    {
      title: { vi: 'Vẽ tranh trên lá buông', en: 'Painting on palm leaf' },
      body: {
        vi: 'Vẽ và khắc trên lá buông, chất liệu ghi kinh sách truyền thống của người Khmer.',
        en: 'Drawing and cutting on palm leaf, the material Khmer scripture has always been kept on.',
      },
      season: null,
    },
    {
      title: { vi: 'Đua ghe Ngo', en: 'The Ngo boat races' },
      body: {
        vi: 'Tham gia hoặc cổ vũ đua ghe Ngo trong dịp lễ — không khí thể thao cộng đồng sôi động nhất trong năm.',
        en: 'Racing or cheering the Ngo boats at festival time — the loudest communal sport of the year.',
      },
      season: { vi: 'Dịp Oóc Om Bóc', en: 'At Oóc Om Bóc' },
    },
    {
      title: { vi: 'Chôl Chnăm Thmây', en: 'Chôl Chnăm Thmây' },
      body: {
        vi: 'Lễ đón năm mới của người Khmer, một trong hai lễ hội lớn nhất mà các mô hình du lịch ở đây xoay quanh.',
        en: 'The Khmer new year, one of the two great festivals the tourism here is built around.',
      },
      season: { vi: 'Tháng 4', en: 'April' },
    },
    {
      title: { vi: 'Oóc Om Bóc', en: 'Oóc Om Bóc' },
      body: {
        vi: 'Lễ cúng trăng, đi liền với đua ghe Ngo.',
        en: 'The moon-worship festival, which the Ngo races belong to.',
      },
      season: { vi: 'Rằm tháng 10 âm lịch', en: 'Tenth lunar month' },
    },
  ],

  phrases: [
    {
      native: 'Chumreap Suor',
      vi: 'Xin chào',
      en: 'Hello',
      note: {
        vi: 'Lời chào trang trọng, dùng trong mọi hoàn cảnh với người mới gặp.',
        en: 'The formal greeting, for anyone newly met.',
      },
      etiquette: {
        vi: 'Đi kèm nghi thức Sampeah: chắp hai lòng bàn tay như hình búp sen đặt trước ngực và cúi nhẹ đầu. Đây là tàn dư của triết lý Phật giáo, vinh danh Phật tánh trong mỗi con người — tay chắp càng cao thì mức tôn kính càng lớn.',
        en: 'Said with the sampeah: palms together like a lotus bud at the chest, head slightly bowed. It comes from Buddhist thought, honouring the Buddha-nature in the person before you — the higher the hands, the greater the respect.',
      },
    },
    {
      native: 'Or-cun',
      vi: 'Cảm ơn',
      en: 'Thank you',
      note: {
        vi: 'Lời biểu thị sự biết ơn sâu sắc, thường đi kèm nụ cười.',
        en: 'A deep thank-you, usually given with a smile.',
      },
      etiquette: null,
    },
  ],

  institutions: [],

  sources: ['Báo cáo §2.5', '§3.1', '§4.2'],
};
