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
        layout={{
          'line-cap': 'round',
          'line-join': 'round',
        }}
        paint={{
          'line-color': ['get', 'line_color'],
          'line-width': ['get', 'line_width'],
          'line-opacity': lineOpacity,
        }}
      />
    </Source>
  )
}
