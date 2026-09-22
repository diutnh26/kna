import { useTranslation } from 'react-i18next';
import {
  MAINLAND,
  ETHNICITY_SITES,
  HOANG_SA,
  TRUONG_SA,
  PHU_QUOC,
  CON_DAO,
} from '../lib/geography';
import { ETHNICITIES } from '../content/ethnicities';
import { useEthnicity } from '../context/useEthnicity';

/**
 * Where these communities are, for a reader who has never placed them.
 *
 * A schematic outline, not survey data. The coordinates in lib/geography
 * are traced by hand at roughly one point per 50–100 km, enough to make the
 * country recognisable and each site findable, and not enough to settle a
 * boundary question. A caption used to say so on the page; it was removed
 * on request, so this comment is now the only place it is written down.
 * Worth restoring if the outline ever starts being read as authoritative.
 *
 * Drawn inline rather than with a mapping library on purpose: no tile
 * server to reach on venue wifi, no dependency, and the palette is the
 * project's own rather than something overridden after the fact.
 *
 * Shares its coordinates with InteractiveMap through lib/geography, so the
 * shapes drawn here and the shapes drawn over the imagery are the same
 * trace rather than two that can drift apart.
 *
 * The five sites are all drawn at once, with the selected one raised. Only
 * showing the current site would hide the thing the map is best placed to
 * say — that these communities sit most of the length of the country
 * apart, from Lũng Cú at 23.4°N to Trà Vinh at 9.9°N.
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

// Where each site's label sits relative to its marker. The northern three
// crowd together against the Chinese border and would overprint each other
// if they all sat to the same side, so they are fanned by hand.
const LABEL_OFFSET = {
  lolo: { dx: 10, dy: -14, anchor: 'start' },
  hmong: { dx: -10, dy: 4, anchor: 'end' },
  tay: { dx: 10, dy: 20, anchor: 'start' },
  ede: { dx: 14, dy: 6, anchor: 'start' },
  khmer: { dx: -12, dy: 16, anchor: 'end' },
};

export default function VietnamMap() {
  const { t } = useTranslation();
  const { slug, select } = useEthnicity();
  const workArea = t('explore.map.workArea', { returnObjects: true });
  const area = ETHNICITY_SITES[slug]?.area;

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

      {/* The province the selected community sits in. Filled rather than
          outlined, because at this scale an unfilled boundary of a small
          northern province is a squiggle nobody can find.

          For Ê Đê this is the pre-2025 province deliberately — not the one
          the zoomable map draws, which reaches the coast after the merger
          with Phú Yên. This is the ground actually covered. */}
      {area && (
        <path
          d={shape(area)}
          fill="var(--c-kteh)"
          stroke="var(--c-kteh)"
          strokeWidth="2"
          strokeLinejoin="round"
          style={{ transition: 'fill 500ms ease, stroke 500ms ease' }}
        />
      )}

      {/* Offshore islands. Drawn before the site markers so that a marker
          near the coast sits above them rather than behind. */}
      <g fill="var(--c-copper)" style={{ transition: 'fill 500ms ease' }}>
        {HOANG_SA.map(([lat, lon]) => (
          <circle key={`hs-${lat}-${lon}`} cx={x(lon)} cy={y(lat)} r="3.5" />
        ))}
        {TRUONG_SA.map(([lat, lon]) => (
          <circle key={`ts-${lat}-${lon}`} cx={x(lon)} cy={y(lat)} r="3.5" />
        ))}
        <circle cx={x(PHU_QUOC[1])} cy={y(PHU_QUOC[0])} r="4.5" />
        <circle cx={x(CON_DAO[1])} cy={y(CON_DAO[0])} r="3.5" />
      </g>

      {/* The five sites. Clicking one switches the whole page to it, which
          makes the map a second switcher for anyone who thinks in places
          rather than in names. */}
      {ETHNICITIES.map((profile) => {
        const site = ETHNICITY_SITES[profile.slug];
        if (!site) return null;
        const [lat, lon] = site.coords;
        const active = profile.slug === slug;
        const offset = LABEL_OFFSET[profile.slug] ?? { dx: 12, dy: 5, anchor: 'start' };

        return (
          <g
            key={profile.slug}
            onClick={() => select(profile.slug)}
            className="cursor-pointer"
            style={{ transition: 'opacity 500ms ease', opacity: active ? 1 : 0.42 }}
          >
            {/* Generous invisible hit area. The visible dot is 6 units
                across, which on a phone is far under a fingertip. */}
            <circle cx={x(lon)} cy={y(lat)} r="26" fill="transparent" />

            {active && (
              <circle
                cx={x(lon)}
                cy={y(lat)}
                r="13"
                fill="none"
                stroke="var(--c-amber)"
                strokeOpacity="0.45"
                strokeWidth="2"
              />
            )}
            <circle
              cx={x(lon)}
              cy={y(lat)}
              r={active ? 6 : 4}
              fill={active ? 'var(--c-amber)' : '#F5EDDD'}
              fillOpacity={active ? 1 : 0.7}
              style={{ transition: 'r 300ms ease, fill 500ms ease' }}
            />
            <text
              x={x(lon) + offset.dx}
              y={y(lat) + offset.dy}
              textAnchor={offset.anchor}
              fontSize={active ? 22 : 17}
              fontWeight={active ? 600 : 400}
              fill={active ? 'var(--c-amber)' : '#F5EDDD'}
              fillOpacity={active ? 1 : 0.55}
              fontFamily="'Be Vietnam Pro', sans-serif"
              style={{ transition: 'fill 500ms ease' }}
            >
              {site.label}
            </text>
          </g>
        );
      })}

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

      {/* Why the Đắk Lắk outline stops short of the coast while the zoomable
          map beside it does not. The filled shape is the pre-merger
          province, which is the area KNĂ actually operates in, so the
          difference is the point rather than an oversight. Only shown
          alongside the shape it qualifies. */}
      {slug === 'ede' && (
        <g fontSize="16" fill="#F5EDDD" fillOpacity="0.5" fontFamily="'Be Vietnam Pro', sans-serif">
          {workArea.map((line, i) => (
            <text key={line} x={x(109.7)} y={y(11.0) + i * 22}>
              {line}
            </text>
          ))}
        </g>
      )}
    </svg>
  );
}
