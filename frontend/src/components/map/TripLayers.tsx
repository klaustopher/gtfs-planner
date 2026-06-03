import { Source, Layer } from 'react-map-gl/maplibre'
import type { FeatureCollection } from 'geojson'

interface TripLayersProps {
  data: FeatureCollection
  lineOpacity: number
}

export default function TripLayers({ data, lineOpacity }: TripLayersProps) {
  if (!data) {
    return null
  }

  return (
    <Source id="trip-lines" type="geojson" data={data}>
      <Layer
        id="trip-lines"
        type="line"
        beforeId="stops-layer"
        layout={{
          'line-cap': 'round',
          'line-join': 'round',
        }}
        paint={{
          'line-color': ['get', 'line_color'],
          'line-width': ['get', 'line_width'],
          // Constant screen-space offset so overlapping lines stay separated at
          // every zoom level (a metre-based geometry offset vanishes when zoomed out).
          'line-offset': ['get', 'line_offset'],
          'line-opacity': lineOpacity,
        }}
      />
    </Source>
  )
}
