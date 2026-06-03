// Station map markers, one per transport category. The dominant category is
// precomputed per station by the importer (stops.station_category) and surfaced
// as the `category` GeoJSON property; the map picks an icon via a `match`
// expression on it (see stationCategoryIconExpression).
//
// Colors follow common German transit conventions (S-Bahn green, U-Bahn blue,
// DB rail red, the green/yellow "H" Haltestelle sign for bus/generic). These are
// rendered into data-URI images, not CSS, so they intentionally live here rather
// than in variables.css.
import type { ExpressionSpecification } from 'maplibre-gl'

const PIN_W = 28
const PIN_H = 36

// Shared teardrop pin shape (24x24 design grid, drawn into a -2 padded viewBox).
const PIN_PATH =
  'M12 0C5.37 0 0 5.37 0 12c0 8 12 20 12 20s12-12 12-20c0-6.63-5.37-12-12-12z'

function pin(fill: string, inner: string): string {
  return `<svg width="${PIN_W}" height="${PIN_H}" viewBox="-2 -2 28 36" xmlns="http://www.w3.org/2000/svg">
  <path d="${PIN_PATH}" fill="${fill}" stroke="#ffffff" stroke-width="2"/>
  ${inner}
</svg>`
}

// A bold letter on a white rounded sign (used for the "H" Haltestelle look).
function signLetter(letter: string, signFill: string, textFill: string): string {
  return `<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="${signFill}"/>
  <text x="12" y="15.4" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle" fill="${textFill}">${letter}</text>`
}

// A bold white letter directly on the colored pin (S-Bahn / U-Bahn logo look).
function glyphLetter(letter: string): string {
  return `<text x="12" y="16" font-family="Arial, sans-serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#ffffff">${letter}</text>`
}

// A small white train (cab with two windows, a stripe and two wheels), built from
// primitives so it renders reliably at marker scale.
const TRAIN_GLYPH = `<g>
  <rect x="7.5" y="6.3" width="9" height="8.8" rx="2.2" fill="#ffffff"/>
  <rect x="8.8" y="7.8" width="2.5" height="2.6" rx="0.5" fill="#e3000f"/>
  <rect x="12.7" y="7.8" width="2.5" height="2.6" rx="0.5" fill="#e3000f"/>
  <rect x="8.8" y="11.3" width="6.4" height="1.7" rx="0.7" fill="#e3000f"/>
  <circle cx="9.7" cy="16" r="1.15" fill="#ffffff"/>
  <circle cx="14.3" cy="16" r="1.15" fill="#ffffff"/>
</g>`

// A small white boat (hull, mast and sail) for ferries.
const BOAT_GLYPH = `<g fill="#ffffff">
  <path d="M6.4 13.2h11.2l-1.5 3.3a1 1 0 0 1-.91.59H8.81a1 1 0 0 1-.91-.59z"/>
  <rect x="11.3" y="6" width="1.3" height="6.4"/>
  <path d="M12.6 6.6l3.1 4.4h-3.1z"/>
</g>`

const RAIL_RED = '#e3000f'
const SBAHN_GREEN = '#008d4f'
const UBAHN_BLUE = '#1457c8'
const TRAM_RED = '#c2185b'
const BUS_BLUE = '#1457c8'
const BUS_YELLOW = '#ffd400'
const FERRY_BLUE = '#0a6cb0'
const GENERIC_GREEN = '#10b981'

export interface MarkerIcon {
  name: string
  svg: string
}

// All registered station marker images.
export const STATION_MARKER_ICONS: MarkerIcon[] = [
  { name: 'marker-rail', svg: pin(RAIL_RED, TRAIN_GLYPH) },
  { name: 'marker-sbahn', svg: pin(SBAHN_GREEN, glyphLetter('S')) },
  { name: 'marker-ubahn', svg: pin(UBAHN_BLUE, glyphLetter('U')) },
  { name: 'marker-tram', svg: pin(TRAM_RED, glyphLetter('T')) },
  { name: 'marker-bus', svg: pin(BUS_BLUE, signLetter('H', BUS_YELLOW, BUS_BLUE)) },
  { name: 'marker-ferry', svg: pin(FERRY_BLUE, BOAT_GLYPH) },
  { name: 'marker-generic', svg: pin(GENERIC_GREEN, signLetter('H', '#ffffff', GENERIC_GREEN)) },
]

// Maps the `category` feature property to a marker image name. Categories mirror
// the backend's routeTypeCategoryExpr / frontend transportCategory ids. Unknown
// or missing categories fall back to the generic Haltestelle marker.
export const stationCategoryIconExpression: ExpressionSpecification = [
  'match',
  ['get', 'category'],
  101, 'marker-rail',
  106, 'marker-rail',
  2, 'marker-rail',
  12, 'marker-rail',
  109, 'marker-sbahn',
  1, 'marker-ubahn',
  0, 'marker-tram',
  3, 'marker-bus',
  11, 'marker-bus',
  4, 'marker-ferry',
  'marker-generic',
]
