import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DAK_LAK, BUON_MA_THUOT } from '../lib/geography';

/**
 * Đắk Lắk on a real map, beside the schematic that places it.
 *
 * The two answer different questions on purpose. VietnamMap is a traced
 * outline that works with no network at all and shows the country as a
 * shape. This one has roads, towns and terrain, opens on the province and
 * zooms out to the whole country, and cannot work without a connection.
 *
 * That asymmetry is why this is a second frame rather than a replacement.
 * If the tiles do not arrive the section still answers the question it was
 * added for, and this frame says the map is missing rather than showing an
 * empty grey box.
 *
 * Loaded lazily from Explore, so the landing page does not pay for Leaflet.
 *
 * The province outline and the city marker come from lib/geography rather
 * than being restated here. Leaflet takes [lat, lng] and so does that file,
 * so the red shape a reader sees on the left is the red shape they see on
 * the right, by construction rather than by care.
 */

// CARTO's Voyager basemap: the closest free equivalent to the default
// Google Maps styling, which is what this frame is meant to look like.
// Google's own tiles need a Maps JavaScript API key with billing attached,
// so they are not an option for a project with no merchant account yet.
//
// No key, and attribution to both OpenStreetMap and CARTO is a condition
// of use, so it is rendered rather than optional.
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

// Down to the whole country and a little beyond. At zoom 5 a frame this
// size holds Vietnam end to end; 4 leaves headroom for a narrow phone,
// where the same zoom would clip the north.
const MIN_ZOOM = 4;
const MAX_ZOOM = 18;

export default function InteractiveMap() {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const map = L.map(el, {
      center: BUON_MA_THUOT,
      zoom: 8,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      // Wide enough that it never fights the view at the zooms actually in
      // use, and tight enough that nobody ends up in the Atlantic with no
      // obvious way back. It was pinned to the province before this map
      // could zoom out; that would now block the thing it exists to do.
      maxBounds: L.latLngBounds([-5, 90], [35, 130]),
      maxBoundsViscosity: 0.7,
      // Scroll belongs to the page. A map that swallows the wheel traps a
      // reader who was only scrolling past it.
      scrollWheelZoom: false,
      attributionControl: true,
    });

    const tiles = L.tileLayer(TILE_URL, {
      subdomains: 'abcd',
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      detectRetina: true,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>',
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
      fillOpacity: 0.15,
    }).addTo(map);

    // Night stroke rather than a bare saffron dot: the tiles under this are
    // light, and saffron on near-white loses its edge.
    L.circleMarker(BUON_MA_THUOT, {
      radius: 6,
      color: '#1A1614',
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
            {t('explore.map.interactiveUnavailable')}
          </p>
        </div>
      )}
    </div>
  );
}
