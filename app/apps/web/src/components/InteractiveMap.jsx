import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DAK_LAK, BUON_MA_THUOT, ETHNICITY_SITES } from '../lib/geography';
import { useEthnicity } from '../context/useEthnicity';

/**
 * Read an accent colour as it currently stands.
 *
 * Leaflet draws into a canvas with plain strings and cannot follow a CSS
 * custom property the way an SVG attribute can, so the value is sampled at
 * the moment the layer is built. That means these shapes step to the new
 * palette rather than easing into it — acceptable, because the layers are
 * being torn down and rebuilt on the same switch anyway.
 */
function accent(name, fallback) {
  if (typeof getComputedStyle !== 'function') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

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
  const { slug } = useEthnicity();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlayRef = useRef(null);
  const [failed, setFailed] = useState(false);

  // The map itself is built once. Switching ethnicity replaces the overlay
  // in the effect below rather than tearing the whole thing down: a rebuilt
  // Leaflet instance refetches every tile, which on venue wifi is a grey
  // square for a second or two on every tab press.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const map = L.map(el, {
      // Overwritten by fitBounds below; Leaflet needs a view before layers.
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

    mapRef.current = map;
    overlayRef.current = L.layerGroup().addTo(map);

    // Leaflet measures the container on creation. Inside a grid column that
    // is still settling, that measurement can be short, which leaves a band
    // of unrendered tiles down one edge until the next interaction.
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(el);

    return () => {
      resize.disconnect();
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  // What is drawn on top, and where the view sits. Rerun on every switch.
  useEffect(() => {
    const map = mapRef.current;
    const overlay = overlayRef.current;
    if (!map || !overlay) return;

    overlay.clearLayers();

    const site = ETHNICITY_SITES[slug];
    const kteh = accent('--c-kteh', '#C8302E');
    const amber = accent('--c-amber', '#E8A33D');

    // Every community now has its province drawn. Ê Đê keeps the
    // post-merger shape here — this map shows the province as it is on
    // today's administrative map, while the schematic beside it shows the
    // pre-merger ground the platform actually works in. The two differing
    // is the point, not an oversight.
    const outline = slug === 'ede' ? DAK_LAK : site?.area;

    if (outline) {
      const province = L.polygon(outline, {
        color: kteh,
        weight: 2,
        fillColor: kteh,
        fillOpacity: 0.15,
      }).addTo(overlay);

      // Frame the province rather than trusting a fixed zoom. These range
      // from Trà Vinh at about 2,300 km² to Đắk Lắk at 18,100, so no single
      // zoom level suits them all — and deriving the view from the polygon
      // means the next boundary change reframes itself.
      map.flyToBounds(province.getBounds(), { padding: [12, 12], duration: 0.8 });
    } else if (site) {
      map.flyTo(site.coords, 11, { duration: 0.8 });
    }

    if (site) {
      // Night stroke rather than a bare saffron dot: the tiles under this
      // are light, and saffron on near-white loses its edge.
      L.circleMarker(site.coords, {
        radius: 6,
        color: '#1A1614',
        weight: 2,
        fillColor: amber,
        fillOpacity: 1,
      })
        .addTo(overlay)
        .bindTooltip(site.label, { direction: 'top', offset: [0, -8] });
    }
  }, [slug, t]);

  return (
    <div className="relative w-full aspect-square overflow-hidden rounded-sm">
      <div ref={containerRef} className="absolute inset-0 bg-ink-raised" />
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-ink-raised px-6 text-center">
          <p className="text-sm text-bone/55 leading-relaxed max-w-xs">
            {t('explore.map.interactiveUnavailable')}
          </p>
        </div>
      )}
    </div>
  );
}
