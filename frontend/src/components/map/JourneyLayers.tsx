import { Source, Layer } from 'react-map-gl/maplibre'
import type { FeatureCollection } from 'geojson'

interface JourneyLayersProps {
  journeyLegs: FeatureCollection
  walkingConnections: FeatureCollection
  lineOpacity: number
}

export default function JourneyLayers({ journeyLegs, walkingConnections, lineOpacity }: JourneyLayersProps) {
  if (!journeyLegs && !walkingConnections) {
    return null
  }

  return (
    <>
      <Source id="walking-connections" type="geojson" data={walkingConnections}>
        <Layer
          id="walking-connections"
          type="line"
          layout={{
            'line-cap': 'round',
            'line-join': 'round',
          }}
          paint={{
            'line-color': '#6b7280',
            'line-width': 3,
            'line-opacity': 0.7,
            'line-dasharray': [2, 2],
          }}
        />
      </Source>

      <Source id="journey-legs" type="geojson" data={journeyLegs}>
        <Layer
          id="journey-legs"
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
    </>
  )
}
