import { useTranslation } from 'react-i18next';

/**
 * Where Đắk Lắk is, for a reader who has never placed it.
 *
 * A schematic outline, not survey data. The coordinates below are traced
 * by hand at roughly one point per 50–100 km, which is enough to make the
 * country recognisable and Đắk Lắk findable, and not enough to settle a
 * boundary question. The caption says so on the page rather than only
 * here, because a map that looks authoritative and is not is worse than
 * one that admits its own scale.
 *
 * Drawn inline rather than with a mapping library on purpose: no tile
 * server to reach on venue wifi, no dependency, and the palette is the
 * project's own rather than something overridden after the fact.
 *
 * Replacing this with real geodata later means swapping the arrays for
 * projected GeoJSON; nothing below the projection cares where the points
 * came from.
 */

// Equirectangular. At Vietnam's latitudes a degree of longitude is about
// 96–110 km against 110 km for a degree of latitude, so square pixels are
// within a few percent of true and the country does not look stretched.
const LON_MIN = 101.5;
const LON_MAX = 117.5;
const LAT_MIN = 7.4;
const LAT_MAX = 23.8;
const SCALE = 50; // SVG units per degree

const W = (LON_MAX - LON_MIN) * SCALE;
const H = (LAT_MAX - LAT_MIN) * SCALE;

const x = (lon) => (lon - LON_MIN) * SCALE;
const y = (lat) => (LAT_MAX - lat) * SCALE;

/** [lat, lon] pairs to a closed SVG path. */
const shape = (points) =>
  points
    .map(([lat, lon], i) => `${i ? 'L' : 'M'}${x(lon).toFixed(1)},${y(lat).toFixed(1)}`)
    .join(' ') + ' Z';

// Mainland, traced clockwise from the north-west. The northern and western
// edges are the borders with China, Laos and Cambodia; the rest is coast.
const MAINLAND = [
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

// Đắk Lắk. Roughly 12.2°–13.35°N, 107.5°–108.95°E.
const DAK_LAK = [
  [13.30, 107.90], [13.22, 108.40], [12.95, 108.92], [12.60, 108.95],
  [12.35, 108.62], [12.20, 108.20], [12.25, 107.80], [12.50, 107.55],
  [12.90, 107.50], [13.15, 107.62],
];

const BUON_MA_THUOT = [12.68, 108.05];

// Named islands rather than a scatter, so the clusters sit where the real
// ones do. Not every feature in either group, which no map at this scale
// shows.
const HOANG_SA = [
  [16.83, 112.34], [16.53, 111.60], [16.67, 112.73], [16.45, 111.71],
  [15.78, 111.20], [16.03, 112.51],
];

const TRUONG_SA = [
  [11.43, 114.33], [11.05, 114.28], [10.18, 114.37], [9.88, 114.33],
  [9.55, 112.89], [8.64, 111.92], [7.88, 112.92], [11.40, 116.40],
  [10.72, 115.82], [9.20, 113.80],
];

// The two largest offshore islands. Small, but their absence is the kind
// of gap a reader from here notices.
const PHU_QUOC = [10.22, 103.96];
const CON_DAO = [8.69, 106.60];

export default function VietnamMap() {
  const { t } = useTranslation();

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto max-w-[520px]"
      role="img"
      aria-label={t('explore.map.alt')}
    >
      <title>{t('explore.map.alt')}</title>

      {/* Graticule. Faint, and only every five degrees: enough to read the
          map as a map rather than a logo, quiet enough to stay behind it. */}
      <g stroke="#F5EDDD" strokeOpacity="0.07" strokeWidth="1">
        {[105, 110, 115].map((lon) => (
          <line key={lon} x1={x(lon)} y1={0} x2={x(lon)} y2={H} />
        ))}
        {[10, 15, 20].map((lat) => (
          <line key={lat} x1={0} y1={y(lat)} x2={W} y2={y(lat)} />
        ))}
      </g>

      {/* Mainland */}
      <path
        d={shape(MAINLAND)}
        fill="#F5EDDD"
        fillOpacity="0.09"
        stroke="#F5EDDD"
        strokeOpacity="0.35"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Đắk Lắk */}
      <path
        d={shape(DAK_LAK)}
        fill="#C8302E"
        stroke="#C8302E"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Buôn Ma Thuột */}
      <circle cx={x(BUON_MA_THUOT[1])} cy={y(BUON_MA_THUOT[0])} r="6" fill="#E8A33D" />
      <circle
        cx={x(BUON_MA_THUOT[1])}
        cy={y(BUON_MA_THUOT[0])}
        r="13"
        fill="none"
        stroke="#E8A33D"
        strokeOpacity="0.45"
        strokeWidth="2"
      />

      {/* Offshore islands */}
      <g fill="#B87333">
        {HOANG_SA.map(([lat, lon]) => (
          <circle key={`hs-${lat}-${lon}`} cx={x(lon)} cy={y(lat)} r="3.5" />
        ))}
        {TRUONG_SA.map(([lat, lon]) => (
          <circle key={`ts-${lat}-${lon}`} cx={x(lon)} cy={y(lat)} r="3.5" />
        ))}
        <circle cx={x(PHU_QUOC[1])} cy={y(PHU_QUOC[0])} r="4.5" />
        <circle cx={x(CON_DAO[1])} cy={y(CON_DAO[0])} r="3.5" />
      </g>

      {/* Labels. Font sizes are in user units, so they scale with the map
          rather than needing a breakpoint of their own. */}
      <g fontSize="21" fill="#F5EDDD" fillOpacity="0.55" fontFamily="'Be Vietnam Pro', sans-serif">
        <text x={x(112.0)} y={y(17.6)} textAnchor="middle">
          {t('explore.map.hoangSa')}
        </text>
        <text x={x(114.2)} y={y(12.4)} textAnchor="middle">
          {t('explore.map.truongSa')}
        </text>
      </g>

      {/* Both labels sit out in the sea to the east. The coast at these
          latitudes reaches about 109.2°E, so they start at 109.7 to keep
          clear of the outline rather than printing over it. */}
      <text
        x={x(109.7)}
        y={y(13.15)}
        fontSize="24"
        fill="#C8302E"
        fontFamily="'Be Vietnam Pro', sans-serif"
        fontWeight="600"
      >
        {t('explore.map.dakLak')}
      </text>

      <text
        x={x(109.7)}
        y={y(11.75)}
        fontSize="20"
        fill="#E8A33D"
        fillOpacity="0.9"
        fontFamily="'Be Vietnam Pro', sans-serif"
      >
        {t('explore.map.buonMaThuot')}
      </text>

      {/* Leaders from each label back to what it names, which neither can
          sit on top of at this scale without covering it. */}
      <path
        d={`M${x(109.6)},${y(13.08)} L${x(108.8)},${y(12.95)}`}
        stroke="#C8302E"
        strokeOpacity="0.6"
        strokeWidth="1.5"
      />
      <path
        d={`M${x(109.6)},${y(11.85)} L${x(108.2)},${y(12.55)}`}
        stroke="#E8A33D"
        strokeOpacity="0.4"
        strokeWidth="1.5"
      />
    </svg>
  );
}
