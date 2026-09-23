import { photo } from './media';

/**
 * Lô Lô — Lô Lô Chải, Lũng Cú, Hà Giang.
 *
 * The only profile with an international award attached, and the only one
 * whose `phrases` array is empty: the research report has no Lô Lô greetings
 * in it. That gap is real and the screen renders it as absence rather than
 * filling it with something plausible.
 */
export default {
  slug: 'lolo',
  name: { vi: 'Lô Lô', en: 'Lô Lô' },
  endonym: 'Mùn Di',
  region: { vi: 'Lô Lô Chải, Lũng Cú, Hà Giang', en: 'Lô Lô Chải, Lũng Cú, Hà Giang' },
  coords: [23.36, 105.31],

  // Indigo and the red of appliqué embroidery, over rammed-earth ochre.
  theme: {
    kteh: '#2E4A7D',
    ktehHover: '#263D68',
    copper: '#B0754A',
    amber: '#D98E36',
    deep: '#1F3355',
  },

  provenance: 'research',

  intro: {
    vi: 'Nằm sát cột cờ Lũng Cú, Lô Lô Chải là minh chứng rằng bảo tồn nghiêm ngặt có thể mang lại danh tiếng toàn cầu. Bí quyết không nằm ở việc làm thêm mà ở việc từ chối: cộng đồng đã từ chối "hiện đại hoá" bừa bãi, giữ nguyên gần 40 ngôi nhà trình tường và chỉ cải tạo công năng bên trong.',
    en: 'Hard against the Lũng Cú flagpole, Lô Lô Chải is the proof that strict conservation can earn a global name. The trick was not in what was added but in what was refused: the community turned down indiscriminate modernisation, kept nearly forty rammed-earth houses standing, and changed only what was inside them.',
  },

  identity: [
    {
      key: 'nha-trinh-tuong',
      native: 'Nhà trình tường',
      title: { vi: 'Nhà Trình Tường', en: 'The Rammed-Earth House' },
      line: { vi: 'Tường đất nện dày 50–60 cm', en: 'Walls of packed earth, 50–60 cm thick' },
      body: {
        vi: 'Tường đất sét nện chặt dày 50–60 cm, mái ngói âm dương. Gần 40 ngôi được giữ nguyên vẹn bên ngoài và cải tạo bên trong thành homestay khép kín — sửa cái ruột, không đụng cái vỏ.',
        en: 'Clay walls rammed to 50–60 cm, under yin-yang tiling. Nearly forty are kept whole on the outside and converted within into self-contained homestays — the inside reworked, the shell untouched.',
      },
      image: photo(
        'Lô Lô Chải 2022 - NKS.jpg',
        {
          vi: 'Làng Lô Lô Chải nhìn từ cột cờ Lũng Cú, mái ngói và tường đất giữa thung lũng đá.',
          en: 'Lô Lô Chải seen from the Lũng Cú flagpole, tiled roofs and earth walls in a valley of stone.',
        },
        { author: 'NKSTTSSHNVN', license: 'CC BY-SA 4.0' },
      ),
    },
    {
      key: 'theu-dap-manh',
      native: 'Thêu đắp mảnh',
      title: { vi: 'Thêu Đắp Mảnh', en: 'Appliqué Embroidery' },
      line: { vi: 'Trang phục phụ nữ Lô Lô đen', en: 'The dress of the Black Lô Lô women' },
      body: {
        vi: 'Hoa văn đắp mảnh phức tạp trên trang phục phụ nữ Lô Lô đen — kỹ thuật ghép từng mảnh vải nhỏ thành hình, tốn hàng tháng cho một bộ, và là thứ thu hút giới nghiên cứu lẫn người mê thủ công.',
        en: 'The dense appliqué on Black Lô Lô women’s dress — small pieces of cloth built into pattern, months of work to a costume, and the thing that draws researchers and craft people alike.',
      },
      image: photo(
        'Trang phuc Lo Lo.jpg',
        {
          vi: 'Trang phục truyền thống của phụ nữ Lô Lô ở Hà Giang.',
          en: 'Traditional women’s dress of the Lô Lô in Hà Giang.',
        },
        { author: 'Viethavvh', license: 'Public domain' },
      ),
    },
    {
      key: 'quy-cong-dong',
      native: 'Quỹ cộng đồng',
      title: { vi: 'Quỹ Phát Triển Cộng Đồng', en: 'The Community Development Fund' },
      line: { vi: 'Trích doanh thu, tái đầu tư', en: 'A cut of revenue, put back in' },
      body: {
        vi: 'Doanh thu du lịch được trích lập thành quỹ, tái đầu tư vào cảnh quan, xử lý rác thải và duy trì các lớp truyền dạy thêu thùa, đánh trống đồng. Đây là cơ chế khiến danh hiệu không chỉ là một tấm biển.',
        en: 'Tourism revenue is set aside into a fund and put back into the landscape, waste handling, and classes that keep embroidery and bronze-drum playing being taught. This is the mechanism that keeps the award from being only a plaque.',
      },
      image: photo(
        'Cột cờ Lũng Cú.JPG',
        {
          vi: 'Cột cờ Lũng Cú trên đỉnh núi, điểm cực bắc của Việt Nam.',
          en: 'The Lũng Cú flagpole on its peak, at Vietnam’s northernmost point.',
        },
        {
          author: 'Leminhel',
          license: 'Public domain',
          note: {
            vi: 'Cột cờ ngay cạnh bản — đang chờ ảnh lớp truyền dạy từ cộng đồng để thay.',
            en: 'The flagpole beside the village, standing in until a photograph of a teaching class arrives from the community.',
          },
        },
      ),
    },
  ],

  places: [
    {
      name: 'Bản Lô Lô Chải',
      district: 'Xã Lũng Cú, huyện Đồng Văn',
      province: 'Hà Giang',
      coords: [23.36, 105.31],
      blurb: {
        vi: 'Nằm sát cột cờ Lũng Cú, điểm cực bắc. Trong hơn 120 hộ dân có 56 hộ trực tiếp làm dịch vụ lưu trú, công suất phục vụ tới 1.000 khách mỗi đêm.',
        en: 'Beside the Lũng Cú flagpole at the country’s northern tip. Of more than 120 households, 56 take guests directly, with capacity for up to 1,000 people a night.',
      },
      households: 120,
      homestays: 56,
      recognition: {
        vi: 'UN Tourism vinh danh "Làng du lịch tốt nhất thế giới năm 2025" (tháng 10/2024), vượt hàng trăm hồ sơ từ 65 quốc gia.',
        en: 'Named a UN Tourism Best Tourism Village for 2025 in October 2024, against hundreds of entries from 65 countries.',
      },
    },
  ],

  experiences: [
    {
      title: { vi: 'Lửa trại và dân ca', en: 'Fire and folk song' },
      body: {
        vi: 'Đêm xuống, bản rộn ràng ánh lửa trại: múa hát các làn điệu dân ca cùng người dân, uống rượu ngô, ăn thắng cố.',
        en: 'After dark the village turns to firelight: folk songs and dancing with the households, corn liquor, thắng cố.',
      },
      season: null,
    },
    {
      title: { vi: 'Dệt vải lanh', en: 'Weaving hemp' },
      body: {
        vi: 'Tìm hiểu quy trình dệt vải lanh — từ sợi đến tấm, trước khi tấm vải thành trang phục.',
        en: 'Following hemp from fibre to cloth, before the cloth becomes dress.',
      },
      season: null,
    },
    {
      title: { vi: 'Thêu đắp mảnh', en: 'Appliqué work' },
      body: {
        vi: 'Ngồi vào lớp truyền dạy thêu hoa văn đắp mảnh, lớp học do quỹ cộng đồng duy trì chứ không mở riêng cho khách.',
        en: 'Sitting in on the appliqué class — kept running by the community fund, not opened for visitors.',
      },
      season: null,
    },
    {
      title: { vi: 'Đánh trống đồng', en: 'The bronze drum' },
      body: {
        vi: 'Trống đồng vẫn được truyền dạy ở đây, một trong số ít nơi còn giữ được thực hành này.',
        en: 'Bronze-drum playing is still taught here, in one of the few places that has kept the practice.',
      },
      season: null,
    },
  ],

  // The research report carries no Lô Lô greetings. Left empty on purpose:
  // the phrasebook section hides itself rather than inventing one.
  phrases: [],

  institutions: [
    {
      name: 'Helvetas',
      role: {
        vi: 'Tổ chức Thụy Sĩ, tư vấn qua dự án ST4SD; giúp thiết lập Quỹ Phát triển Cộng đồng.',
        en: 'The Swiss organisation advising through the ST4SD project; helped set up the Community Development Fund.',
      },
    },
    {
      name: 'UN Tourism',
      role: {
        vi: 'Vinh danh Lô Lô Chải là "Làng du lịch tốt nhất thế giới năm 2025".',
        en: 'Named Lô Lô Chải a Best Tourism Village for 2025.',
      },
    },
  ],

  sources: ['Báo cáo §2.3', '§4.2', '§6.3'],
};
