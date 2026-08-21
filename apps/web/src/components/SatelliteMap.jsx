import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DAK_LAK, BUON_MA_THUOT } from '../lib/geography';

/**
 * Đắk Lắk from above, beside the schematic that says where it is.
 *
 * The two maps answer different questions on purpose. VietnamMap places the
 * province in the country and works with no network at all. This one shows
 * what the place looks like — plateau, forest, the red basalt the coffee
 * grows in — and cannot work without one.
 *
 * That asymmetry is the whole reason this is a second element rather than a
 * replacement. If the tiles do not arrive, the section still answers the
 * question it was added for, and this frame says plainly that imagery is
 * missing rather than showing an empty grey box.
 *
 * Loaded lazily from Explore, so the landing page does not pay for Leaflet.
 *
 * The province outline and the city marker come from lib/geography rather
 * being restated here. Leaflet takes [lat, lng] and so does that file, so
 * they are the same numbers in both maps by construction: the red shape a
 * reader sees on the left is the red shape they see on the right.
 */

// Esri's World Imagery basemap. No account and no key, and it is the only
// free satellite layer with usable resolution over rural Vietnam — OSM has
// no imagery at all, and Sentinel through most brokers wants a token.
// Attribution is a condition of use, so it is rendered, not optional.
const TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

// 16 rather than the 19 the service advertises. Coverage over the Central
// Highlands thins out well before that, and a grey tile at full zoom looks
// broken in a way a slightly softer one does not.
const MAX_ZOOM = 16;

export default function SatelliteMap() {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const map = L.map(el, {
      center: BUON_MA_THUOT,
      zoom: 8,
      minZoom: 7,
      maxZoom: MAX_ZOOM,
      // The province is the subject. Without this a stray scroll leaves the
      // reader over open sea with no way back that is obvious.
      maxBounds: L.latLngBounds([11.4, 106.6], [14.1, 109.9]),
      maxBoundsViscosity: 0.9,
      // Scroll belongs to the page here. A map that swallows the wheel
      // traps a reader who was only scrolling past it.
      scrollWheelZoom: false,
      attributionControl: true,
    });

    const tiles = L.tileLayer(TILE_URL, {
      maxZoom: MAX_ZOOM,
      attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
    });

    // One failed tile is normal at a boundary; a wall of them is not.
    let errors = 0;
    tiles.on('tileerror', () => {
      errors += 1;
      if (errors > 3) setFailed(true);
    });
    tiles.on('tileload', () => {
      errors = 0;
    });
    tiles.addTo(map);

    L.polygon(DAK_LAK, {
      color: '#C8302E',
      weight: 2,
      fillColor: '#C8302E',
      fillOpacity: 0.12,
    }).addTo(map);

    L.circleMarker(BUON_MA_THUOT, {
      radius: 6,
      color: '#E8A33D',
      weight: 2,
      fillColor: '#E8A33D',
      fillOpacity: 1,
    })
      .addTo(map)
      .bindTooltip(t('explore.map.buonMaThuot'), { direction: 'top', offset: [0, -8] });

    // Leaflet measures the container on creation. Inside a grid column that
    // is still settling, that measurement can be short, which leaves a band
    // of unrendered tiles down one edge until the next interaction.
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(el);

    return () => {
      resize.disconnect();
      map.remove();
    };
  }, [t]);

  return (
    <div className="relative w-full aspect-square overflow-hidden rounded-sm">
      <div ref={containerRef} className="absolute inset-0 bg-[#241F1C]" />
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-[#241F1C] px-6 text-center">
          <p className="text-sm text-[#F5EDDD]/55 leading-relaxed max-w-xs">
            {t('explore.map.satelliteUnavailable')}
          </p>
        </div>
      )}
    </div>
  );
}
