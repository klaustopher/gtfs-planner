package timeutil

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

const ISO8601Format = "2006-01-02T15:04:05"

// ParseISO8601 parses an ISO 8601 datetime string (without timezone) into a time.Time
func ParseISO8601(datetime string) (time.Time, error) {
	return time.ParseInLocation(ISO8601Format, datetime, time.Local)
}

// FormatISO8601 formats a time.Time to ISO 8601 string (without timezone)
func FormatISO8601(t time.Time) string {
	return t.Format(ISO8601Format)
}

// NormalizeGTFSTime converts a GTFS time (which can be >= 24:00:00) to
// a proper ISO 8601 datetime, given the service date.
//
// GTFS times like "25:30:00" mean 1:30 AM the next day.
//
// Parameters:
//   - gtfsTime: time in "HH:MM:SS" format, where HH can be >= 24
//   - serviceDate: the date in YYYYMMDD format (from calendar)
//
// Returns: ISO 8601 datetime string "2006-01-02T15:04:05"
func NormalizeGTFSTime(gtfsTime string, serviceDate string) (string, error) {
	parts := strings.Split(gtfsTime, ":")
	if len(parts) != 3 {
		return "", fmt.Errorf("invalid GTFS time format: %s", gtfsTime)
	}

	hours, err := strconv.Atoi(parts[0])
	if err != nil {
		return "", fmt.Errorf("invalid hours: %s", parts[0])
	}
	minutes, err := strconv.Atoi(parts[1])
	if err != nil {
		return "", fmt.Errorf("invalid minutes: %s", parts[1])
	}
	seconds, err := strconv.Atoi(parts[2])
	if err != nil {
		return "", fmt.Errorf("invalid seconds: %s", parts[2])
	}

	if len(serviceDate) != 8 {
		return "", fmt.Errorf("invalid service date format: %s", serviceDate)
	}
	year, err := strconv.Atoi(serviceDate[0:4])
	if err != nil {
		return "", fmt.Errorf("invalid year in service date: %s", serviceDate)
	}
	month, err := strconv.Atoi(serviceDate[4:6])
	if err != nil {
		return "", fmt.Errorf("invalid month in service date: %s", serviceDate)
	}
	day, err := strconv.Atoi(serviceDate[6:8])
	if err != nil {
		return "", fmt.Errorf("invalid day in service date: %s", serviceDate)
	}

	// Calculate days to add and normalized hours
	daysToAdd := hours / 24
	normalizedHours := hours % 24

	// Create base date and add time
	baseDate := time.Date(year, time.Month(month), day, normalizedHours, minutes, seconds, 0, time.Local)
	resultDate := baseDate.AddDate(0, 0, daysToAdd)

	return FormatISO8601(resultDate), nil
}

// ExtractDateAndTime extracts YYYYMMDD date and HH:MM:SS time from ISO 8601 datetime
func ExtractDateAndTime(datetime string) (date string, timeStr string, err error) {
	t, err := ParseISO8601(datetime)
	if err != nil {
		return "", "", err
	}
	date = t.Format("20060102")
	timeStr = t.Format("15:04:05")
	return date, timeStr, nil
}

// GetPreviousDayOvernightParams returns the previous day's date and the equivalent
// overnight time threshold for querying GTFS trips that span midnight.
//
// For example, if querying at 00:05:00 on 2025-12-22:
// - prevDate = "20251221"
// - overnightTime = "24:05:00"
//
// This allows finding trips from the previous day's service that have departure
// times >= 24:00:00 (which represent early morning times the next calendar day).
func GetPreviousDayOvernightParams(datetime string) (prevDate string, overnightTime string, err error) {
	t, err := ParseISO8601(datetime)
	if err != nil {
		return "", "", err
	}

	// Get previous day
	prevDay := t.AddDate(0, 0, -1)
	prevDate = prevDay.Format("20060102")

	// Calculate overnight time: add 24 hours to current time
	hours := t.Hour() + 24
	minutes := t.Minute()
	seconds := t.Second()
	overnightTime = fmt.Sprintf("%02d:%02d:%02d", hours, minutes, seconds)

	return prevDate, overnightTime, nil
}

// GetNextDay returns the next day's date in YYYYMMDD format.
// For example, if date is "20251221", it returns "20251222".
func GetNextDay(date string) (string, error) {
	if len(date) != 8 {
		return "", fmt.Errorf("invalid date format: %s (expected YYYYMMDD)", date)
	}

	year, err := strconv.Atoi(date[0:4])
	if err != nil {
		return "", fmt.Errorf("invalid year in date: %s", date)
	}
	month, err := strconv.Atoi(date[4:6])
	if err != nil {
		return "", fmt.Errorf("invalid month in date: %s", date)
	}
	day, err := strconv.Atoi(date[6:8])
	if err != nil {
		return "", fmt.Errorf("invalid day in date: %s", date)
	}

	// Create date and add one day
	currentDate := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.Local)
	nextDay := currentDate.AddDate(0, 0, 1)

	return nextDay.Format("20060102"), nil
}
