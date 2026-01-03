//go:build darwin
// +build darwin

package geolocation

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Foundation -framework CoreLocation
#import <Foundation/Foundation.h>
#import <CoreLocation/CoreLocation.h>
#include <stdlib.h>

// Simple location result structure
typedef struct {
    double latitude;
    double longitude;
    int success;
} LocationData;

// Synchronous location fetching with timeout
static LocationData getLocationSync() {
    LocationData result = {0, 0, 0};

    // Check if location services are enabled
    if (![CLLocationManager locationServicesEnabled]) {
        return result;
    }

    CLLocationManager *manager = [[CLLocationManager alloc] init];
    manager.desiredAccuracy = kCLLocationAccuracyKilometer;

    // Check authorization status (use instance method, not deprecated class method)
    CLAuthorizationStatus status;
    if (@available(macOS 11.0, *)) {
        status = [manager authorizationStatus];
    } else {
        #pragma clang diagnostic push
        #pragma clang diagnostic ignored "-Wdeprecated-declarations"
        status = [CLLocationManager authorizationStatus];
        #pragma clang diagnostic pop
    }

    // If authorization has not been determined, request it and give user time to respond
    if (status == kCLAuthorizationStatusNotDetermined) {
        if (@available(macOS 10.15, *)) {
            [manager requestWhenInUseAuthorization];

            // Wait up to 10 seconds for user to grant permission
            // This gives the user enough time to interact with the dialog
            for (int i = 0; i < 20; i++) {
                [NSThread sleepForTimeInterval:0.5];
                if (@available(macOS 11.0, *)) {
                    status = [manager authorizationStatus];
                } else {
                    #pragma clang diagnostic push
                    #pragma clang diagnostic ignored "-Wdeprecated-declarations"
                    status = [CLLocationManager authorizationStatus];
                    #pragma clang diagnostic pop
                }
                if (status != kCLAuthorizationStatusNotDetermined) {
                    break;
                }
            }
        }
    }

    // If denied or restricted, fail immediately
    if (status == kCLAuthorizationStatusDenied ||
        status == kCLAuthorizationStatusRestricted) {
        [manager release];
        return result;
    }

    // If still not determined after waiting, fail (user didn't respond)
    if (status == kCLAuthorizationStatusNotDetermined) {
        [manager release];
        return result;
    }

    // Try to get last known location (quick)
    CLLocation *location = [manager location];
    if (location != nil) {
        result.latitude = location.coordinate.latitude;
        result.longitude = location.coordinate.longitude;
        result.success = 1;
    }

    [manager release];
    return result;
}
*/
import "C"
import "fmt"

func getNativeLocation() (LocationResult, error) {
	data := C.getLocationSync()

	if data.success == 0 {
		return LocationResult{}, fmt.Errorf("failed to get native location")
	}

	return LocationResult{
		Latitude:  float64(data.latitude),
		Longitude: float64(data.longitude),
	}, nil
}
