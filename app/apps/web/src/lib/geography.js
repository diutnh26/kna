/**
 * Where things are, as [latitude, longitude] pairs.
 *
 * One file so the two maps cannot disagree. VietnamMap projects these into
 * an SVG and InteractiveMap hands them to Leaflet, which takes [lat, lng] in
 * the same order, so the red shape on the schematic and the red shape over
 * the imagery are the same numbers rather than two traces that drifted.
 *
 * Hand-traced at roughly one point per 50–100 km. That is enough to make
 * the country recognisable and the province findable, and not enough to
 * settle a boundary question. Nothing on the page says so any more, the
 * captions having been removed, so it is recorded here instead.
 *
 * Real geodata later means replacing the arrays here and nothing else.
 */

// Mainland Vietnam, clockwise from the north-west. The northern and western
// edges are the borders with China, Laos and Cambodia; the rest is coast.
export const MAINLAND = [
  [22.40, 102.15], [22.79, 102.95], [22.58, 103.32], [22.81, 104.45],
  [23.35, 105.32], [22.92, 105.90], [22.80, 106.50], [22.47, 106.72],
  [21.95, 107.90], [21.52, 107.45], [20.95, 106.80], [20.25, 106.55],
  [19.80, 105.90], [19.05, 105.80], [18.30, 105.72], [17.50, 106.60],
  [16.90, 107.10], [16.10, 108.28], [15.50, 108.72], [14.80, 109.10],
  [13.80, 109.22], [13.00, 109.30], [12.65, 109.45], [11.90, 109.20],
  [11.30, 108.90], [10.90, 108.30], [10.40, 107.40], [10.30, 106.80],
  [9.80, 106.60], [9.30, 106.20], [8.80, 105.30], [8.57, 104.85],
  [9.00, 104.85], [9.50, 105.05], [10.00, 104.90], [10.40, 104.48],
  [10.90, 104.90], [11.50, 105.80], [11.95, 106.15], [12.30, 106.00],
  [13.00, 107.50], [14.00, 107.40], [14.70, 107.52], [15.30, 107.30],
  [16.00, 106.60], [16.60, 106.52], [17.30, 105.60], [18.20, 105.10],
  [19.00, 104.50], [19.70, 104.02], [20.30, 103.90], [20.90, 104.02],
  [21.30, 103.00], [21.70, 102.80],
];

// Đắk Lắk as it is now. The 2025 provincial merger absorbed Phú Yên, so
// the province runs from the Cambodian border to the East Sea and has a
// coastline for the first time: roughly 12.2°–13.47°N, 107.48°–109.37°E,
// about 18,100 km². Traced clockwise from the north-west corner.
//
// Traced off the boundary Google Maps draws, not from an official
// dataset, so it is the right province at the wrong precision. Good
// enough to show the shape and the reach to the coast; not good enough
// to measure. Replace with published GeoJSON when there is any.
export const DAK_LAK = [
  [13.30, 107.50], [13.33, 107.80], [13.28, 108.15], [13.22, 108.45],
  [13.18, 108.70], [13.28, 108.85], [13.40, 109.02], [13.46, 109.18],
  [13.47, 109.28], [13.30, 109.31], [13.15, 109.33], [13.05, 109.34],
  [12.95, 109.37], [12.88, 109.34], [12.84, 109.15], [12.80, 108.98],
  [12.68, 108.95], [12.55, 108.93], [12.40, 108.72], [12.28, 108.40],
  [12.22, 108.10], [12.25, 107.85], [12.42, 107.62], [12.70, 107.52],
  [13.00, 107.48], [13.15, 107.55],
];

// The province before the merger, landlocked and stopping short of the
// coast at about 108.95°E.
//
// Still the operating area. KNĂ works with buôn inside the old boundary,
// not the coastal districts Phú Yên brought in, so VietnamMap draws this
// one and labels it as where the platform works. The two maps on Explore
// therefore show different shapes on purpose: this is the ground covered,
// DAK_LAK is the province on today's administrative map.
export const DAK_LAK_PRE_MERGER = [
  [13.30, 107.90], [13.22, 108.40], [12.95, 108.92], [12.60, 108.95],
  [12.35, 108.62], [12.20, 108.20], [12.25, 107.80], [12.50, 107.55],
  [12.90, 107.50], [13.15, 107.62],
];

export const BUON_MA_THUOT = [12.68, 108.05];

// ── Provincial outlines for the other four communities ──────────────
//
// Traced from published data rather than by hand, unlike the Đắk Lắk
// shapes above: these are simplified from the pre-2025 provincial boundary
// set in nguyenduy1133/Free-GIS-Data, which derives from the Vietnam
// Administrative Units Reference Map. Douglas–Peucker down to 30 points
// each — the same coarseness as the hand traces, and for the same reason:
// enough to recognise the province, not enough to settle a border.
//
// Pre-2025 boundaries on purpose. Each community is described by the
// district it was in when the research was written (Bắc Hà, Đồng Văn,
// Phong Thổ, Trà Cú), and the 2025 mergers folded several of these
// provinces into larger ones. Drawing today's map would put Lô Lô Chải
// inside a Tuyên Quang that did not exist when the village was named a
// Best Tourism Village.
//
// Pulling Đắk Lắk from the same source came out at 12.16–13.40°N,
// 107.48–108.99°E against the hand trace's 12.20–13.30°N, 107.50–108.95°E
// — close enough to trust the set. The hand trace is kept rather than
// replaced, so the province KNĂ actually works in stays exactly as drawn.

export const LAO_CAI = [
  [22.843, 104.262],
  [22.742, 104.267],
  [22.613, 104.458],
  [22.529, 104.413],
  [22.485, 104.472],
  [22.426, 104.465],
  [22.349, 104.579],
  [22.244, 104.55],
  [22.22, 104.627],
  [22.088, 104.561],
  [22.199, 104.427],
  [22.177, 104.383],
  [21.948, 104.431],
  [21.878, 104.354],
  [21.941, 104.282],
  [21.95, 104.212],
  [21.89, 104.194],
  [21.926, 103.998],
  [22.14, 103.936],
  [22.313, 103.765],
  [22.393, 103.762],
  [22.409, 103.603],
  [22.471, 103.553],
  [22.527, 103.594],
  [22.597, 103.525],
  [22.797, 103.638],
  [22.508, 103.976],
  [22.738, 104.047],
  [22.814, 104.119],
  [22.843, 104.262],
];

export const HA_GIANG = [
  [23.384, 105.329],
  [23.159, 105.57],
  [23.008, 105.489],
  [22.991, 105.373],
  [22.881, 105.266],
  [22.755, 105.468],
  [22.628, 105.494],
  [22.605, 105.314],
  [22.696, 105.146],
  [22.289, 105.045],
  [22.351, 104.897],
  [22.187, 104.895],
  [22.167, 104.776],
  [22.262, 104.715],
  [22.291, 104.608],
  [22.243, 104.551],
  [22.349, 104.579],
  [22.439, 104.454],
  [22.531, 104.413],
  [22.613, 104.458],
  [22.711, 104.339],
  [22.853, 104.574],
  [22.824, 104.729],
  [22.952, 104.864],
  [23.125, 104.8],
  [23.183, 104.91],
  [23.151, 104.949],
  [23.27, 105.08],
  [23.264, 105.229],
  [23.384, 105.329],
];

export const LAI_CHAU = [
  [22.807, 103.333],
  [22.579, 103.57],
  [22.412, 103.601],
  [22.409, 103.745],
  [22.14, 103.936],
  [21.968, 103.983],
  [21.907, 103.885],
  [21.771, 103.965],
  [21.698, 103.915],
  [21.826, 103.695],
  [21.995, 103.648],
  [22.031, 103.543],
  [21.98, 103.474],
  [22.157, 103.387],
  [22.111, 103.286],
  [22.04, 103.281],
  [22.103, 103.1],
  [22.028, 102.985],
  [22.108, 102.924],
  [22.088, 102.776],
  [22.231, 102.736],
  [22.256, 102.66],
  [22.169, 102.672],
  [22.257, 102.518],
  [22.549, 102.319],
  [22.781, 102.497],
  [22.609, 102.86],
  [22.485, 102.927],
  [22.449, 103.072],
  [22.807, 103.333],
];

export const TRA_VINH = [
  [10.012, 106.33],
  [9.922, 106.48],
  [9.8, 106.596],
  [9.745, 106.561],
  [9.674, 106.578],
  [9.611, 106.552],
  [9.557, 106.498],
  [9.528, 106.411],
  [9.539, 106.403],
  [9.529, 106.376],
  [9.541, 106.379],
  [9.58, 106.341],
  [9.594, 106.314],
  [9.584, 106.302],
  [9.649, 106.211],
  [9.778, 106.068],
  [9.921, 105.952],
  [9.906, 105.994],
  [9.934, 106.018],
  [9.944, 106.072],
  [9.962, 106.083],
  [9.94, 106.111],
  [9.962, 106.13],
  [10.025, 106.133],
  [10.026, 106.191],
  [10.005, 106.212],
  [10.025, 106.23],
  [10.045, 106.221],
  [10.083, 106.239],
  [10.012, 106.33],
];


// The four communities the platform reaches beyond Đắk Lắk, keyed by the
// slug their profile in content/ethnicities carries.
//
// Each carries both a point and the province it sits in. The point is the
// village; the outline is the province, and the two say different things —
// a marker claims only where a settlement is, while a filled boundary is a
// claim about where a border runs. Both are drawn because a reader who has
// never placed Lũng Cú needs the province to find it by, and the village to
// know what is actually being described.
//
// Coordinates are village-centre to about a kilometre, read off the places
// named in the research report. Good enough to put the marker on the right
// valley; not good enough to navigate by.
export const ETHNICITY_SITES = {
  ede: { coords: BUON_MA_THUOT, label: 'Buôn Ma Thuột', area: DAK_LAK_PRE_MERGER },
  tay: { coords: [22.45, 104.35], label: 'Bản Liền', area: LAO_CAI },
  lolo: { coords: [23.36, 105.31], label: 'Lô Lô Chải', area: HA_GIANG },
  hmong: { coords: [22.47, 103.53], label: 'Sin Suối Hồ', area: LAI_CHAU },
  khmer: { coords: [9.93, 106.34], label: 'Trà Vinh', area: TRA_VINH },
};

// Named islands rather than a scatter, so the clusters sit where the real
// ones do. Not every feature in either group, which no map at this scale
// shows.
export const HOANG_SA = [
  [16.83, 112.34], [16.53, 111.60], [16.67, 112.73], [16.45, 111.71],
  [15.78, 111.20], [16.03, 112.51],
];

export const TRUONG_SA = [
  [11.43, 114.33], [11.05, 114.28], [10.18, 114.37], [9.88, 114.33],
  [9.55, 112.89], [8.64, 111.92], [7.88, 112.92], [11.40, 116.40],
  [10.72, 115.82], [9.20, 113.80],
];

// The two largest offshore islands. Small, but their absence is the kind
// of gap a reader from here notices.
export const PHU_QUOC = [10.22, 103.96];
export const CON_DAO = [8.69, 106.60];
