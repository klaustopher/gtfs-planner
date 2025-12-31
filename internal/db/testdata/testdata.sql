-- Test data for bus-planning database tests
--
-- This file contains minimal test data to support all test cases.
-- Each section documents which test(s) it supports.

-- ============================================================================
-- STOPS
-- ============================================================================

-- Berlin area stations for TestGetStops, TestGetStationDetails, TestSearchStations
-- (52.4-52.6 lat, 13.3-13.5 lon)
INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, location_type, parent_station) VALUES
    ('berlin_parent_1', 'Berlin Hauptbahnhof', 52.525, 13.369, 1, NULL),
    ('berlin_child_1a', 'Berlin Hauptbahnhof Gleis 1', 52.525, 13.369, 0, 'berlin_parent_1'),
    ('berlin_parent_2', 'Berlin Alexanderplatz', 52.521, 13.411, 1, NULL),
    ('berlin_child_2a', 'Berlin Alexanderplatz U2', 52.521, 13.411, 0, 'berlin_parent_2'),
    ('berlin_parent_3', 'Berlin Friedrichstraße', 52.520, 13.387, 1, NULL);

-- Siegen area stations for TestGetUpcomingTrips (50.8-51.0 lat, 8.0-8.4 lon)
INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, location_type, parent_station) VALUES
    ('siegen_parent_1', 'Siegen Hauptbahnhof', 50.875, 8.015, 1, NULL),
    ('siegen_child_1a', 'Siegen Hauptbahnhof Gleis 1', 50.875, 8.015, 0, 'siegen_parent_1');

-- Station for TestCalendarWeekdayFiltering
-- Station 610626 (Haunstetten, Nord)
INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, location_type, parent_station) VALUES
    ('610626', 'Haunstetten, Nord', 48.333, 10.900, 1, NULL);

-- Station for TestCalendarDateExclusion
-- Station 32830 (Blumenthal, Schule)
INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, location_type, parent_station) VALUES
    ('32830', 'Blumenthal, Schule', 51.500, 8.200, 1, NULL);

-- Station for TestCalendarDateAddition
-- Station 278696 (Neustadt (b Coburg))
INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, location_type, parent_station) VALUES
    ('278696', 'Neustadt (b Coburg)', 50.330, 11.120, 1, NULL);

-- Station for TestOvernightTrips
-- Station 494889 (Augsburg, Königsplatz)
INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, location_type, parent_station) VALUES
    ('494889', 'Augsburg, Königsplatz', 48.365, 10.895, 1, NULL);

-- Station for TestExcludeTripsEndingAtStation
-- Station 419232 (Siegen ZOB)
INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, location_type, parent_station) VALUES
    ('419232', 'Siegen ZOB', 50.877, 8.019, 1, NULL);

-- Additional stations needed as trip endpoints
INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, location_type, parent_station) VALUES
    ('end_station_1', 'Endstation Eins', 48.400, 10.950, 1, NULL),
    ('end_station_2', 'Endstation Zwei', 51.550, 8.250, 1, NULL),
    ('end_station_3', 'Endstation Drei', 50.380, 11.170, 1, NULL),
    ('end_station_4', 'Endstation Vier', 48.420, 10.940, 1, NULL),
    ('start_station_1', 'Startstation Eins', 50.850, 8.000, 1, NULL),
    ('siegen_upstream', 'Siegen Upstream Station', 50.860, 8.010, 1, NULL);

-- ============================================================================
-- ROUTES
-- ============================================================================

-- Routes for various tests
INSERT INTO routes (route_id, route_short_name, route_long_name, route_type, route_color, route_text_color) VALUES
    ('route_berlin_1', 'S1', 'S-Bahn Linie 1', 1, 'DB71AC', 'FFFFFF'),
    ('route_berlin_2', 'U2', 'U-Bahn Linie 2', 1, 'FF6600', 'FFFFFF'),
    ('route_siegen_1', 'Bus 1', 'Siegener Buslinie 1', 3, '00AA00', 'FFFFFF'),
    ('route_191', 'R191', 'Regionalbahn 191', 2, '0066CC', 'FFFFFF'),
    ('route_101', 'R101', 'Regionalbahn 101', 2, 'CC0066', 'FFFFFF'),
    ('route_1030', 'R1030', 'Regionalbahn 1030', 2, '006633', 'FFFFFF'),
    ('route_940', 'N940', 'Nachtbus 940', 3, '333366', 'FFFFFF'),
    ('route_sb4', 'SB4', 'Schnellbus 4', 3, 'FF9900', 'FFFFFF'),
    ('route_c105', 'C105', 'Citybus 105', 3, '009999', 'FFFFFF');

-- ============================================================================
-- CALENDAR (Regular weekly schedules)
-- ============================================================================

-- Service for Berlin routes (daily)
INSERT INTO calendar (service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date) VALUES
    ('service_berlin', 1, 1, 1, 1, 1, 1, 1, '20250101', '20261231');

-- Service for Siegen routes (daily)
INSERT INTO calendar (service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date) VALUES
    ('service_siegen', 1, 1, 1, 1, 1, 1, 1, '20250101', '20261231');

-- Service 191: Mon-Fri only, valid 2026-01-07 to 2026-01-19
-- For TestCalendarWeekdayFiltering
INSERT INTO calendar (service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date) VALUES
    ('191', 1, 1, 1, 1, 1, 0, 0, '20260107', '20260119');

-- Service 101: Tue and Fri only, valid 2025-12-23 to 2026-01-16
-- For TestCalendarDateExclusion
INSERT INTO calendar (service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date) VALUES
    ('101', 0, 1, 0, 0, 1, 0, 0, '20251223', '20260116');

-- Service 1030: Thu and Fri only, valid 2025-12-25 to 2026-01-05
-- For TestCalendarDateAddition
INSERT INTO calendar (service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date) VALUES
    ('1030', 0, 0, 0, 1, 1, 0, 0, '20251225', '20260105');

-- Service 940: Sunday only, valid 2025-12-20 to 2026-01-19
-- For TestOvernightTrips
INSERT INTO calendar (service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date) VALUES
    ('940', 0, 0, 0, 0, 0, 0, 1, '20251220', '20260119');

-- ============================================================================
-- CALENDAR_DATES (Exceptions to regular schedules)
-- ============================================================================

-- Exception for Service 101: Remove service on 2025-12-26 (Friday)
-- For TestCalendarDateExclusion
INSERT INTO calendar_dates (service_id, date, exception_type) VALUES
    ('101', '20251226', 2);

-- Exception for Service 1030: Add service on 2026-01-05 (Monday)
-- For TestCalendarDateAddition
INSERT INTO calendar_dates (service_id, date, exception_type) VALUES
    ('1030', '20260105', 1);

-- ============================================================================
-- TRIPS
-- ============================================================================

-- Trips for Berlin (daily service)
INSERT INTO trips (trip_id, route_id, service_id, trip_headsign, direction_id, shape_id) VALUES
    ('trip_berlin_1', 'route_berlin_1', 'service_berlin', 'Oranienburg', 0, 'shape_berlin_1'),
    ('trip_berlin_2', 'route_berlin_2', 'service_berlin', 'Ruhleben', 1, 'shape_berlin_2');

-- Trips for Siegen (daily service)
INSERT INTO trips (trip_id, route_id, service_id, trip_headsign, direction_id, shape_id) VALUES
    ('trip_siegen_1', 'route_siegen_1', 'service_siegen', 'Siegen ZOB', 0, 'shape_siegen_1');

-- Trip 1036941 for TestCalendarWeekdayFiltering
-- Departs from station 610626 at 08:34:00, service 191 (Mon-Fri)
INSERT INTO trips (trip_id, route_id, service_id, trip_headsign, direction_id) VALUES
    ('1036941', 'route_191', '191', 'Endstation Eins', 0);

-- Trip 154627 for TestCalendarDateExclusion
-- Departs from station 32830 at 08:27:00, service 101 (Tue, Fri)
INSERT INTO trips (trip_id, route_id, service_id, trip_headsign, direction_id) VALUES
    ('154627', 'route_101', '101', 'Endstation Zwei', 0);

-- Trip 991667 for TestCalendarDateAddition
-- Departs from station 278696 at 10:07:00, service 1030 (Thu, Fri + exception Mon 2026-01-05)
INSERT INTO trips (trip_id, route_id, service_id, trip_headsign, direction_id) VALUES
    ('991667', 'route_1030', '1030', 'Endstation Drei', 0);

-- Trip 1214020 for TestOvernightTrips
-- Departs from station 494889 at 24:05:00, service 940 (Sunday)
INSERT INTO trips (trip_id, route_id, service_id, trip_headsign, direction_id) VALUES
    ('1214020', 'route_940', '940', 'Endstation Vier', 0);

-- Trip 1014198 for TestExcludeTripsEndingAtStation (should be EXCLUDED - ends at 419232)
-- This trip ENDS at Siegen ZOB
INSERT INTO trips (trip_id, route_id, service_id, trip_headsign, direction_id) VALUES
    ('1014198', 'route_sb4', '191', 'Siegen ZOB', 0);

-- Trip 1493872 for TestExcludeTripsEndingAtStation (should be INCLUDED - starts at 419232)
-- This trip STARTS at Siegen ZOB
INSERT INTO trips (trip_id, route_id, service_id, trip_headsign, direction_id) VALUES
    ('1493872', 'route_c105', '191', 'Endstation Eins', 0);

-- ============================================================================
-- STOP_TIMES
-- ============================================================================

-- Stop times for Berlin trips
INSERT INTO stop_times (trip_id, arrival_time, departure_time, stop_id, stop_sequence) VALUES
    ('trip_berlin_1', '08:00:00', '08:01:00', 'berlin_parent_1', 0),
    ('trip_berlin_1', '08:10:00', '08:11:00', 'berlin_parent_2', 1),
    ('trip_berlin_1', '08:20:00', '08:21:00', 'berlin_parent_3', 2),
    ('trip_berlin_2', '09:00:00', '09:01:00', 'berlin_parent_2', 0),
    ('trip_berlin_2', '09:15:00', '09:16:00', 'berlin_parent_1', 1);

-- Stop times for Siegen trips
INSERT INTO stop_times (trip_id, arrival_time, departure_time, stop_id, stop_sequence) VALUES
    ('trip_siegen_1', '08:00:00', '08:01:00', 'siegen_parent_1', 0),
    ('trip_siegen_1', '08:30:00', '08:30:00', '419232', 1);

-- Stop times for trip 1036941 (TestCalendarWeekdayFiltering)
-- Departs from 610626 at 08:34, ends at end_station_1
INSERT INTO stop_times (trip_id, arrival_time, departure_time, stop_id, stop_sequence) VALUES
    ('1036941', '08:30:00', '08:34:00', '610626', 0),
    ('1036941', '08:45:00', '08:46:00', 'end_station_1', 1);

-- Stop times for trip 154627 (TestCalendarDateExclusion)
-- Departs from 32830 at 08:27, ends at end_station_2
INSERT INTO stop_times (trip_id, arrival_time, departure_time, stop_id, stop_sequence) VALUES
    ('154627', '08:25:00', '08:27:00', '32830', 0),
    ('154627', '08:55:00', '08:55:00', 'end_station_2', 1);

-- Stop times for trip 991667 (TestCalendarDateAddition)
-- Departs from 278696 at 10:07, ends at end_station_3
INSERT INTO stop_times (trip_id, arrival_time, departure_time, stop_id, stop_sequence) VALUES
    ('991667', '10:05:00', '10:07:00', '278696', 0),
    ('991667', '10:35:00', '10:35:00', 'end_station_3', 1);

-- Stop times for trip 1214020 (TestOvernightTrips)
-- Departs from 494889 at 24:05:00 (after midnight, Sunday's service)
INSERT INTO stop_times (trip_id, arrival_time, departure_time, stop_id, stop_sequence) VALUES
    ('1214020', '24:00:00', '24:05:00', '494889', 0),
    ('1214020', '24:35:00', '24:35:00', 'end_station_4', 1);

-- Stop times for trip 1014198 (TestExcludeTripsEndingAtStation - ENDS at 419232)
-- This trip should be EXCLUDED because 419232 is the final stop
INSERT INTO stop_times (trip_id, arrival_time, departure_time, stop_id, stop_sequence) VALUES
    ('1014198', '10:00:00', '10:01:00', 'start_station_1', 0),
    ('1014198', '10:15:00', '10:16:00', 'siegen_upstream', 1),
    ('1014198', '10:39:00', '10:39:00', '419232', 2);

-- Stop times for trip 1493872 (TestExcludeTripsEndingAtStation - STARTS at 419232)
-- This trip should be INCLUDED because 419232 is the first stop
INSERT INTO stop_times (trip_id, arrival_time, departure_time, stop_id, stop_sequence) VALUES
    ('1493872', '10:20:00', '10:24:00', '419232', 0),
    ('1493872', '10:35:00', '10:36:00', 'siegen_upstream', 1),
    ('1493872', '10:50:00', '10:50:00', 'end_station_1', 2);

-- ============================================================================
-- SHAPES (Route geometry)
-- ============================================================================

-- Simple shape for Berlin S1
INSERT INTO shapes (shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence) VALUES
    ('shape_berlin_1', 52.525, 13.369, 0),
    ('shape_berlin_1', 52.523, 13.380, 1),
    ('shape_berlin_1', 52.521, 13.411, 2);

-- Simple shape for Berlin U2
INSERT INTO shapes (shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence) VALUES
    ('shape_berlin_2', 52.521, 13.411, 0),
    ('shape_berlin_2', 52.523, 13.390, 1),
    ('shape_berlin_2', 52.525, 13.369, 2);

-- Simple shape for Siegen bus
INSERT INTO shapes (shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence) VALUES
    ('shape_siegen_1', 50.875, 8.015, 0),
    ('shape_siegen_1', 50.876, 8.017, 1),
    ('shape_siegen_1', 50.877, 8.019, 2);
