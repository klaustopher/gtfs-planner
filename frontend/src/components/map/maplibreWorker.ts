import { setWorkerUrl } from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

// ?worker&url, not ?url: the dist worker imports its sibling
// maplibre-gl-shared.mjs, which a plain ?url emit would leave behind.
setWorkerUrl(maplibreWorkerUrl)
