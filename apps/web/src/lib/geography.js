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
// Still drawn by VietnamMap, which was left alone deliberately when the
// boundary above was corrected. That means the two maps on Explore show
// different provinces side by side, the schematic one not reaching the
// sea. Known, and worth closing: point VietnamMap at DAK_LAK instead.
export const DAK_LAK_PRE_MERGER = [
  [13.30, 107.90], [13.22, 108.40], [12.95, 108.92], [12.60, 108.95],
  [12.35, 108.62], [12.20, 108.20], [12.25, 107.80], [12.50, 107.55],
  [12.90, 107.50], [13.15, 107.62],
];

export const BUON_MA_THUOT = [12.68, 108.05];

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
