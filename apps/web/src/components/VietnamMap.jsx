import { useTranslation } from 'react-i18next';
import {
  MAINLAND,
  DAK_LAK,
  BUON_MA_THUOT,
  HOANG_SA,
  TRUONG_SA,
  PHU_QUOC,
  CON_DAO,
} from '../lib/geography';

/**
 * Where Đắk Lắk is, for a reader who has never placed it.
 *
 * A schematic outline, not survey data. The coordinates in lib/geography
 * are traced by hand at roughly one point per 50–100 km, enough to make the
 * country recognisable and Đắk Lắk findable, and not enough to settle a
 * boundary question. A caption used to say so on the page; it was removed
 * on request, so this comment is now the only place it is written down.
 * Worth restoring if the outline ever starts being read as authoritative.
 *
 * Drawn inline rather than with a mapping library on purpose: no tile
 * server to reach on venue wifi, no dependency, and the palette is the
 * project's own rather than something overridden after the fact.
 *
 * Shares its coordinates with InteractiveMap through lib/geography, so the
 * province drawn here and the province drawn over the imagery are the
 * same trace rather than two that can drift apart.
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
