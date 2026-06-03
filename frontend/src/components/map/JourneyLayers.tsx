import { Source, Layer } from 'react-map-gl/maplibre'
import type { FeatureCollection } from 'geojson'

interface JourneyLayersProps {
  journeyLegs: FeatureCollection
  walkingConnections: FeatureCollection
  lineOpacity: number
  // Render the journey as a faint light-gray backdrop (used while editing the
  // journey, so the route so far stays visible without dominating the map).
  ghost?: boolean
}

const GHOST_COLOR = '#b6bcc6'

export default function JourneyLayers({ journeyLegs, walkingConnections, lineOpacity, ghost = false }: JourneyLayersProps) {
  if (!journeyLegs && !walkingConnections) {
    return null
  }

  return (
    <>
      <Source id="walking-connections" type="geojson" data={walkingConnections}>
        <Layer
          id="walking-connections"
          type="line"
          beforeId="stops-layer"
          layout={{
            'line-cap': 'round',
            'line-join': 'round',
          }}
          paint={{
            'line-color': ghost ? GHOST_COLOR : '#6b7280',
            'line-width': 3,
            'line-opacity': ghost ? 0.45 : 0.7,
            'line-dasharray': [2, 2],
          }}
        />
      </Source>

      <Source id="journey-legs" type="geojson" data={journeyLegs}>
        <Layer
          id="journey-legs"
          type="line"
          beforeId="stops-layer"
          layout={{
            'line-cap': 'round',
            'line-join': 'round',
          }}
          paint={{
            'line-color': ghost ? GHOST_COLOR : ['get', 'line_color'],
            'line-width': ghost ? 5 : ['get', 'line_width'],
            'line-opacity': ghost ? 0.6 : lineOpacity,
          }}
        />
      </Source>
    </>
  )
}
