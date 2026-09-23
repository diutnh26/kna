import { photo } from './media';

/**
 * Ê Đê — Đắk Lắk, Tây Nguyên.
 *
 * The profile the other four are measured against. Its prose was written
 * with the community and reviewed by the Committee; it moved here from the
 * locale files unchanged, so that `provenance: 'community'` below means
 * something the other profiles cannot yet claim.
 */
export default {
  slug: 'ede',
  name: { vi: 'Ê Đê', en: 'Ê Đê' },
  endonym: 'Anak Êđê',
  region: {
    vi: 'Đắk Lắk, Tây Nguyên',
    en: 'Đắk Lắk, the Central Highlands',
  },
  coords: [12.68, 108.05],

  // Kteh red and Gong copper — the palette the product was designed in.
  theme: {
    kteh: '#C8302E',
    ktehHover: '#A82826',
    copper: '#B87333',
    amber: '#E8A33D',
    deep: '#6B1A1A',
  },

  // Contributed by Ê Đê households, reviewed by the Community Governance
  // Committee before publication. The other four profiles are compiled from
  // a research report and say so.
  provenance: 'community',

  intro: {
    vi: 'Người Ê Đê giữ một hệ thống tri thức bản địa mà trung tâm là ngôi nhà dài và thiết chế mẫu hệ. Du lịch cộng đồng ở Buôn Akŏ Dhông và Buôn Trí không dựng lại quá khứ cho khách xem — nó mở cửa một nếp sống đang tiếp diễn, nơi chiều dài ngôi nhà vẫn đo bằng số thế hệ phụ nữ đã sống dưới mái đó.',
    en: 'The Ê Đê keep a body of knowledge built around the longhouse and the matrilineal family. Community tourism at Buôn Akŏ Dhông and Buôn Trí does not stage the past for visitors — it opens a way of living that is still going on, where the length of a house is still measured in the generations of women who have lived under it.',
  },

  identity: [
    {
      key: 'ching-kram',
      native: 'Ching Kram',
      title: { vi: 'Cồng Chiêng', en: 'Cồng Chiêng' },
      line: { vi: 'UNESCO ghi danh năm 2005', en: 'Recognised by UNESCO in 2005' },
      body: {
        vi: 'Cồng chiêng ở đây không phải nhạc cụ mà là tiếng nói. Mỗi bộ được chỉnh theo một gia đình, đánh lên trong lễ sinh, mùa gặt và tang ma, và người nghe đọc nó như đọc một lá thư. Trong tín ngưỡng Ê Đê, đó là ngôn ngữ giữa con người và thế giới siêu nhiên.',
        en: 'A gong is not an instrument here. It is a voice. Each set is tuned to a family, played at births, harvests and funerals, and read by listeners the way a letter is read. In Ê Đê belief it is the language between people and the world beyond.',
      },
      image: photo(
        'Congchieng01.JPG',
        {
          vi: 'Lễ hội cồng chiêng ở Đắk Lắk, những người đánh chiêng đi thành hàng.',
          en: 'A gong festival in Đắk Lắk, players moving in procession.',
        },
        { author: 'Đỗ Tuấn Hưng', license: 'CC BY-SA 3.0' },
      ),
    },
    {
      key: 'kna',
      native: 'Knă',
      title: { vi: 'Nhà Dài', en: 'The Long House' },
      line: { vi: 'Kiến trúc của gia đình mẫu hệ', en: 'Architecture of the matrilineal family' },
      body: {
        vi: 'Ngôi nhà lớn lên cùng gia đình. Mỗi lần một người con gái lấy chồng, nhà được nối thêm một gian — nên chiều dài của nhà dài ghi lại bao nhiêu thế hệ đã sống dưới mái đó. Cầu thang cái đặt phía trước, đẽo hình đôi bầu vú và vành trăng khuyết, dành cho khách và nam giới; cầu thang đực khuất phía sau, cho sinh hoạt của phụ nữ trong nhà.',
        en: 'A house grows with its family. New sections are added as daughters marry, so the length of a longhouse records how many generations have lived under it. The female stair stands at the front, carved with a pair of breasts and a crescent moon, for guests and for men; the male stair sits hidden behind, for the household’s women.',
      },
      image: photo(
        'Dan toc hoc 19.jpg',
        {
          vi: 'Một ngôi nhà dài Ê Đê với cầu thang gỗ và sàn nâng cao.',
          en: 'An Ê Đê longhouse with its carved wooden stair and raised floor.',
        },
        {
          author: 'Rungbachduong',
          license: 'CC BY-SA 3.0',
          note: {
            vi: 'Chụp tại Bảo tàng Dân tộc học Việt Nam, Hà Nội — nhà dài phục dựng, không phải tại buôn.',
            en: 'Photographed at the Vietnam Museum of Ethnology, Hanoi — a reconstructed longhouse, not one in a buôn.',
          },
        },
      ),
    },
    {
      key: 'mnga',
      native: 'Mnga',
      title: { vi: 'Dệt Thổ Cẩm', en: 'Weaving' },
      line: { vi: 'Hoa văn là chữ viết', en: 'Pattern as written record' },
      body: {
        vi: 'Hoa văn trên tấm dệt không phải trang trí. Nó ghi dòng họ, vị thế và những gì gia đình đã đi qua — một cách viết có trước chữ viết, và vẫn đọc được với người biết đọc.',
        en: 'Motifs are not decoration. They record lineage, standing, and what a family has lived through — a way of writing that came before script, and that is still legible to anyone taught to read it.',
      },
      image: photo(
        'Ruou can jars in E De long house.png',
        {
          vi: 'Những ché rượu cần đặt trong lòng một ngôi nhà dài Ê Đê.',
          en: 'Jars of rượu cần standing inside an Ê Đê longhouse.',
        },
        {
          author: 'Bình Giang',
          license: 'Public domain',
          note: {
            vi: 'Ảnh nội thất nhà dài — đang chờ ảnh khung dệt từ buôn để thay.',
            en: 'A longhouse interior standing in until a photograph of a loom arrives from the buôn.',
          },
        },
      ),
    },
  ],

  places: [
    {
      name: 'Buôn Akŏ Dhông',
      district: 'TP. Buôn Ma Thuột',
      province: 'Đắk Lắk',
      coords: [12.69, 108.04],
      blurb: {
        vi: 'Buôn được xem là giàu đẹp nhất Đắk Lắk, nằm ngay trong lòng thành phố. Nhà dài được giữ và vẫn có người ở; mô hình du lịch lồng cồng chiêng bên bếp lửa, rượu cần và dệt thổ cẩm thành sinh kế cho hàng chục hộ.',
        en: 'Held to be the most prosperous buôn in Đắk Lắk, and sitting inside the city itself. Its longhouses are kept and still lived in; the tourism model folds gongs by the hearth, rượu cần and weaving into a living for dozens of households.',
      },
      households: null,
      homestays: null,
      recognition: null,
    },
    {
      name: 'Buôn Trí',
      district: 'Xã Krông Na, huyện Buôn Đôn',
      province: 'Đắk Lắk',
      coords: [12.9, 107.8],
      blurb: {
        vi: 'Nằm ở Buôn Đôn, vùng gắn với nghề săn và thuần dưỡng voi trước đây, nay chuyển sang du lịch sinh thái gắn với Vườn quốc gia Yok Đôn.',
        en: 'In Buôn Đôn, a region once known for the capture and keeping of elephants, now turning towards ecological tourism around Yok Đôn National Park.',
      },
      households: null,
      homestays: null,
      recognition: null,
    },
  ],

  experiences: [
    {
      title: { vi: 'Vòng xoang bên bếp lửa', en: 'The xoang circle by the fire' },
      body: {
        vi: 'Tham gia vòng xoang quanh đống lửa, nghe cồng chiêng ngân giữa đại ngàn. Các buổi diễn xướng tái hiện một phần lễ hội nông nghiệp, khách được mời uống rượu cần — biểu tượng của sự chia sẻ.',
        en: 'Join the xoang circle around the fire and hear the gongs carry across the forest. The performances re-enact part of the agricultural festivals, and guests are offered rượu cần, the drink that stands for sharing.',
      },
      season: null,
    },
    {
      title: { vi: 'Nghe ra tiếng chiêng mẹ', en: 'Hearing the mother gong' },
      body: {
        vi: 'Học cách nhận ra âm của chiêng cái — chiêng mẹ — trong một bộ chiêng, thứ phân biệt người nghe quen với người nghe lần đầu.',
        en: 'Learning to pick out the voice of the chiêng cái, the mother gong, within a set — the thing that separates a practised listener from a first-time one.',
      },
      season: null,
    },
    {
      title: { vi: 'Đan gùi tre', en: 'Weaving a carrying basket' },
      body: {
        vi: 'Ngồi với người đan và thử đan gùi tre, vật dụng đi rẫy hằng ngày chứ không phải đồ lưu niệm.',
        en: 'Sitting with a weaver to try a bamboo gùi — the basket carried to the fields daily, not a souvenir.',
      },
      season: null,
    },
    {
      title: { vi: 'Lễ cúng bến nước', en: 'The water-wharf rite' },
      body: {
        vi: 'Bến nước là nơi buôn lấy nước và là một trong những nghi lễ nông nghiệp quan trọng nhất trong vòng đời Ê Đê.',
        en: 'The bến nước is where a buôn draws its water, and its rite is among the most important in the Ê Đê agricultural year.',
      },
      season: null,
    },
  ],

  phrases: [
    {
      native: 'Hê drei',
      vi: 'Xin chào',
      en: 'Hello',
      note: {
        vi: 'Lời chào phổ quát, dùng được bất kỳ lúc nào trong ngày khi gặp người trong buôn.',
        en: 'The universal greeting, usable at any hour when meeting someone in the buôn.',
      },
      etiquette: null,
    },
    {
      native: 'Bơni',
      vi: 'Cảm ơn',
      en: 'Thank you',
      note: {
        vi: 'Lời cảm ơn thông dụng.',
        en: 'The everyday thank-you.',
      },
      etiquette: {
        vi: 'Bắt buộc đi kèm cử chỉ hơi cúi đầu, thể hiện sự khiêm tốn.',
        en: 'Must be said with a slight bow of the head, which carries the humility.',
      },
    },
    {
      native: 'Kâo bi mơak',
      vi: 'Tôi rất vui khi ở đây',
      en: 'I am glad to be here',
      note: {
        vi: 'Câu mang tính nghi thức, nói ngay khoảnh khắc bước chân vào cửa nhà dài.',
        en: 'A formal line, spoken at the moment of stepping through the longhouse door.',
      },
      etiquette: null,
    },
    {
      native: 'Ơ ami',
      vi: 'Người mẹ đáng kính',
      en: 'Elder mother',
      note: {
        vi: 'Đại từ xưng hô trang trọng nhất, dùng với người phụ nữ lớn tuổi nhất trong nhà dài — người đứng đầu trong chế độ mẫu hệ.',
        en: 'The most formal form of address, for the eldest woman in the longhouse — the head of the household under matrilineal descent.',
      },
      etiquette: null,
    },
    {
      native: 'Kâo lui',
      vi: 'Tôi xin phép rời đi',
      en: 'I am leaving now',
      note: {
        vi: 'Lời chào tạm biệt.',
        en: 'The parting greeting.',
      },
      etiquette: {
        vi: 'Phải nói khi đang đứng ở cầu thang chuẩn bị bước xuống — tuyệt đối không đợi ra đến cổng, vì ngôi nhà dài có ranh giới thiêng của nó.',
        en: 'Said while standing on the stair about to step down — never held until the gate, because the longhouse has a threshold of its own.',
      },
    },
  ],

  institutions: [],

  sources: ['Báo cáo §2.1', '§3.1', '§3.2', '§4.2'],
};
