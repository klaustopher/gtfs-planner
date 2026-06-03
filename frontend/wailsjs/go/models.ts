export namespace geolocation {
	
	export class LocationResult {
	    latitude: number;
	    longitude: number;
	    source: string;
	    city?: string;
	    country?: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new LocationResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.latitude = source["latitude"];
	        this.longitude = source["longitude"];
	        this.source = source["source"];
	        this.city = source["city"];
	        this.country = source["country"];
	        this.error = source["error"];
	    }
	}

}

export namespace main {
	
	export class DatabaseInfo {
	    path: string;
	    exists: boolean;
	    sizeBytes: number;
	
	    static createFrom(source: any = {}) {
	        return new DatabaseInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.exists = source["exists"];
	        this.sizeBytes = source["sizeBytes"];
	    }
	}
	export class DatabaseStatus {
	    exists: boolean;
	    hasData: boolean;
	    firstDate: string;
	    lastDate: string;
	    daysRemaining: number;
	    state: string;
	
	    static createFrom(source: any = {}) {
	        return new DatabaseStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.exists = source["exists"];
	        this.hasData = source["hasData"];
	        this.firstDate = source["firstDate"];
	        this.lastDate = source["lastDate"];
	        this.daysRemaining = source["daysRemaining"];
	        this.state = source["state"];
	    }
	}
	export class LoadJourneyResult {
	    journey?: models.JourneyData;
	    filePath: string;
	
	    static createFrom(source: any = {}) {
	        return new LoadJourneyResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.journey = this.convertValues(source["journey"], models.JourneyData);
	        this.filePath = source["filePath"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace models {
	
	export class Coordinate {
	    lat: number;
	    lon: number;
	
	    static createFrom(source: any = {}) {
	        return new Coordinate(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.lat = source["lat"];
	        this.lon = source["lon"];
	    }
	}
	export class MapView {
	    longitude: number;
	    latitude: number;
	    zoom: number;
	
	    static createFrom(source: any = {}) {
	        return new MapView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.longitude = source["longitude"];
	        this.latitude = source["latitude"];
	        this.zoom = source["zoom"];
	    }
	}
	export class SavedTripData {
	    tripId: string;
	    routeId: string;
	    startStationId: string;
	    departureDateTime: string;
	    endStationId: string;
	    arrivalDateTime: string;
	
	    static createFrom(source: any = {}) {
	        return new SavedTripData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tripId = source["tripId"];
	        this.routeId = source["routeId"];
	        this.startStationId = source["startStationId"];
	        this.departureDateTime = source["departureDateTime"];
	        this.endStationId = source["endStationId"];
	        this.arrivalDateTime = source["arrivalDateTime"];
	    }
	}
	export class JourneyData {
	    version: number;
	    createdAt: string;
	    modifiedAt: string;
	    savedTrips: SavedTripData[];
	    selectedStationId?: string;
	    currentDateTime: string;
	    mapView?: MapView;
	
	    static createFrom(source: any = {}) {
	        return new JourneyData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.createdAt = source["createdAt"];
	        this.modifiedAt = source["modifiedAt"];
	        this.savedTrips = this.convertValues(source["savedTrips"], SavedTripData);
	        this.selectedStationId = source["selectedStationId"];
	        this.currentDateTime = source["currentDateTime"];
	        this.mapView = this.convertValues(source["mapView"], MapView);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class Route {
	    route_id: string;
	    route_short_name: string;
	    route_long_name: string;
	    route_desc: string;
	    route_type: number;
	    route_color: string;
	    route_text_color: string;
	
	    static createFrom(source: any = {}) {
	        return new Route(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.route_id = source["route_id"];
	        this.route_short_name = source["route_short_name"];
	        this.route_long_name = source["route_long_name"];
	        this.route_desc = source["route_desc"];
	        this.route_type = source["route_type"];
	        this.route_color = source["route_color"];
	        this.route_text_color = source["route_text_color"];
	    }
	}
	export class RouteGeometry {
	    route_id: string;
	    route_short_name: string;
	    route_long_name: string;
	    route_color: string;
	    coordinates: Coordinate[];
	
	    static createFrom(source: any = {}) {
	        return new RouteGeometry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.route_id = source["route_id"];
	        this.route_short_name = source["route_short_name"];
	        this.route_long_name = source["route_long_name"];
	        this.route_color = source["route_color"];
	        this.coordinates = this.convertValues(source["coordinates"], Coordinate);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Stop {
	    stop_id: string;
	    stop_name: string;
	    stop_lat: number;
	    stop_lon: number;
	
	    static createFrom(source: any = {}) {
	        return new Stop(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.stop_id = source["stop_id"];
	        this.stop_name = source["stop_name"];
	        this.stop_lat = source["stop_lat"];
	        this.stop_lon = source["stop_lon"];
	    }
	}
	export class RoutesData {
	    routes: RouteGeometry[];
	    stations: Stop[];
	
	    static createFrom(source: any = {}) {
	        return new RoutesData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.routes = this.convertValues(source["routes"], RouteGeometry);
	        this.stations = this.convertValues(source["stations"], Stop);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class StationDetails {
	    stop_id: string;
	    stop_name: string;
	    stop_lat: number;
	    stop_lon: number;
	    routes: Route[];
	
	    static createFrom(source: any = {}) {
	        return new StationDetails(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.stop_id = source["stop_id"];
	        this.stop_name = source["stop_name"];
	        this.stop_lat = source["stop_lat"];
	        this.stop_lon = source["stop_lon"];
	        this.routes = this.convertValues(source["routes"], Route);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class StopTime {
	    stop_id: string;
	    stop_name: string;
	    stop_lat: number;
	    stop_lon: number;
	    arrival_datetime: string;
	    departure_datetime: string;
	    stop_sequence: number;
	    platform_code: string;
	
	    static createFrom(source: any = {}) {
	        return new StopTime(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.stop_id = source["stop_id"];
	        this.stop_name = source["stop_name"];
	        this.stop_lat = source["stop_lat"];
	        this.stop_lon = source["stop_lon"];
	        this.arrival_datetime = source["arrival_datetime"];
	        this.departure_datetime = source["departure_datetime"];
	        this.stop_sequence = source["stop_sequence"];
	        this.platform_code = source["platform_code"];
	    }
	}
	export class TripDetails {
	    trip_id: string;
	    route_id: string;
	    route_type: number;
	    route_color: string;
	    display_name: string;
	    destination: string;
	    headsign: string;
	    stop_times: StopTime[];
	
	    static createFrom(source: any = {}) {
	        return new TripDetails(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.trip_id = source["trip_id"];
	        this.route_id = source["route_id"];
	        this.route_type = source["route_type"];
	        this.route_color = source["route_color"];
	        this.display_name = source["display_name"];
	        this.destination = source["destination"];
	        this.headsign = source["headsign"];
	        this.stop_times = this.convertValues(source["stop_times"], StopTime);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class UpcomingTrip {
	    trip_id: string;
	    route_id: string;
	    route_type: number;
	    route_color: string;
	    departure_datetime: string;
	    headsign: string;
	    display_name: string;
	    destination: string;
	    start_station_id: string;
	    start_station_name: string;
	    service_date: string;
	    coordinates: Coordinate[];
	    stop_times: StopTime[];
	
	    static createFrom(source: any = {}) {
	        return new UpcomingTrip(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.trip_id = source["trip_id"];
	        this.route_id = source["route_id"];
	        this.route_type = source["route_type"];
	        this.route_color = source["route_color"];
	        this.departure_datetime = source["departure_datetime"];
	        this.headsign = source["headsign"];
	        this.display_name = source["display_name"];
	        this.destination = source["destination"];
	        this.start_station_id = source["start_station_id"];
	        this.start_station_name = source["start_station_name"];
	        this.service_date = source["service_date"];
	        this.coordinates = this.convertValues(source["coordinates"], Coordinate);
	        this.stop_times = this.convertValues(source["stop_times"], StopTime);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class UpcomingTripsData {
	    trips: UpcomingTrip[];
	    stations: Stop[];
	
	    static createFrom(source: any = {}) {
	        return new UpcomingTripsData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.trips = this.convertValues(source["trips"], UpcomingTrip);
	        this.stations = this.convertValues(source["stations"], Stop);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

