## Plan: Modularize Map & Sidebar

Split the oversized Map and Sidebar components into smaller composable pieces. Extract search/bounds/hover logic from the map into dedicated hooks and UI subcomponents, and decompose the sidebar into focused panels for actions, station departures, and saved journeys. This keeps state concerns isolated, simplifies JSX, and positions both areas for easier testing and future enhancements.

### Steps

1. Extract `MapSearchPanel` + `useStationSearch` to own search UI/state from Map.tsx (lines 549-640).
2. Create `useFitBounds` hook for station/journey zoom handling plus `JourneyLayers`/`TripLayers` components for map overlays in Map.tsx (lines 644-735).
3. Build `useHoverStationPanel` (timers + hover popup) and `StationHoverOverlay` component to replace inline hover logic in Map.tsx (lines 214-360).
4. Build `JourneyActionsBar` and `useJourneyFileActions` to encapsulate button handlers/modals inside Sidebar.tsx (lines 40-190).
5. Extract `StationDeparturesCard` (with `TripListItem`) to render selected-station departures from Sidebar.tsx (lines 190-360).
6. Create `SavedJourneyTimeline` component handling saved trips, wait math, and removal controls in Sidebar.tsx (lines 360-560).

### Further Considerations

1. Decide where shared trip-color/metadata helpers should live (`components/map` vs `utils/trips`). -> Put them in `utils/trips` for broader accessibility.
2. Clarify whether new hooks belong under `components/map/` or `hooks/` for discoverability. -> Place UI-specific hooks in `components/map/hooks/`
3. Testing strategy: snapshot coverage for new presentational pieces plus unit tests for hooks (search debounce, bounds). -> Let's focus on tests later.
