# Plan: Refactor Nearby Stations to Checkbox Selection

Umstellung von der automatischen Radius-Einstellung auf eine benutzergesteuerte Checkbox-Auswahl für nahegelegene Stationen. Die Anzeige der nahen Stationen erfolgt direkt bei der ausgewählten Station, und Nutzer können explizit auswählen, welche Stationen einbezogen werden sollen.

## Steps

1. **Entferne die Radius-Einstellung aus den Settings**: Lösche das `nearbyStationRadius`-Feld aus [frontend/src/hooks/settingsContext.ts](frontend/src/hooks/settingsContext.ts), [SettingsProvider.tsx](frontend/src/hooks/SettingsProvider.tsx) und dem Slider-Bereich in [SettingsModal.tsx](frontend/src/components/SettingsModal.tsx). Entferne zugehörige Translation-Keys aus [de/translation.json](frontend/src/locales/de/translation.json) und [en/translation.json](frontend/src/locales/en/translation.json).

2. **Füge State-Management für ausgewählte Stationen hinzu**: Erweitere [App.tsx](frontend/src/App.tsx) um `useState<Set<string>>` für die IDs der ausgewählten nahegelegenen Stationen und hole die Liste der nahegelegenen Stationen (200m) via `GetNearbyStations` wenn eine Station selektiert wird.

3. **Erstelle UI-Komponente für Nearby-Station-Checkboxes**: Füge in [StationDeparturesCard.tsx](frontend/src/components/StationDeparturesCard.tsx) eine neue Sektion zwischen Header und Trip-Liste ein, die nahegelegene Stationen mit Checkboxen anzeigt (nur wenn Stationen vorhanden sind).

4. **Modifiziere Trip-Fetching-Logik**: Ändere `tripQueryParams` in [App.tsx](frontend/src/App.tsx) um nur noch Trips für die Haupt-Station plus explizit ausgewählte nahe Stationen zu laden, entweder durch mehrere API-Calls oder durch Anpassung des Backend-Aufrufs.

5. **Erstelle neue Backend-Funktion (optional)**: Füge `GetTripsForStations(stopIDs []string, datetime, limit)` in [app.go](app.go) hinzu, die Trips für mehrere Station-IDs gleichzeitig abruft und merged, um Multiple API-Calls vom Frontend zu vermeiden.

## Further Considerations

1. **Backend-Implementierung**: Option A: Mehrere Frontend-Aufrufe von `GetUpcomingTrips` für jede Station und Frontend-seitiges Merging / Option B: Neue Backend-Funktion `GetTripsForStations` (sauberer, effizienter) / Option C: Umnutzung von `GetUpcomingTripsWithNearby` mit fixem 200m-Radius? -> Eine Methode GetUpcomingTripsForStations wäre am flexibelsten für zukünftige Erweiterungen. Die Methode, die alten Methoden können wir dann entfernen, da wir immer ein Array von Stationen übergeben, im Zweifel halt nur mit einer Station.

2. **Checkbox-State Persistence**: Sollen ausgewählte nahegelegene Stationen über Session-Wechsel hinweg gespeichert werden (localStorage), oder bei jeder neuen Station-Selektion zurückgesetzt werden? -> Die Checkboxen müssen erst mal nicht persistent sein, können wir aber später immer noch hinzufügen.

3. **UI-Platzierung**: Nearby-Checkboxen in [StationDeparturesCard.tsx](frontend/src/components/StationDeparturesCard.tsx) integrieren oder als separates expandierbares Panel/Accordion gestalten? -> Mach mal eine extra box dafür.
