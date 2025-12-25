package timeutil

import (
	"testing"
	"time"
)

func TestNormalizeGTFSTime(t *testing.T) {
	tests := []struct {
		name        string
		gtfsTime    string
		serviceDate string
		want        string
		wantErr     bool
	}{
		{
			name:        "normal time",
			gtfsTime:    "14:30:00",
			serviceDate: "20251225",
			want:        "2025-12-25T14:30:00",
			wantErr:     false,
		},
		{
			name:        "midnight",
			gtfsTime:    "00:00:00",
			serviceDate: "20251225",
			want:        "2025-12-25T00:00:00",
			wantErr:     false,
		},
		{
			name:        "time just before midnight",
			gtfsTime:    "23:59:59",
			serviceDate: "20251225",
			want:        "2025-12-25T23:59:59",
			wantErr:     false,
		},
		{
			name:        "GTFS time 24:00 (next day midnight)",
			gtfsTime:    "24:00:00",
			serviceDate: "20251225",
			want:        "2025-12-26T00:00:00",
			wantErr:     false,
		},
		{
			name:        "GTFS time 25:30 (1:30 AM next day)",
			gtfsTime:    "25:30:00",
			serviceDate: "20251225",
			want:        "2025-12-26T01:30:00",
			wantErr:     false,
		},
		{
			name:        "GTFS time 26:45 (2:45 AM next day)",
			gtfsTime:    "26:45:30",
			serviceDate: "20251225",
			want:        "2025-12-26T02:45:30",
			wantErr:     false,
		},
		{
			name:        "GTFS time crossing year boundary",
			gtfsTime:    "25:00:00",
			serviceDate: "20251231",
			want:        "2026-01-01T01:00:00",
			wantErr:     false,
		},
		{
			name:        "invalid GTFS time format",
			gtfsTime:    "14:30",
			serviceDate: "20251225",
			want:        "",
			wantErr:     true,
		},
		{
			name:        "invalid service date format",
			gtfsTime:    "14:30:00",
			serviceDate: "2025-12-25",
			want:        "",
			wantErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NormalizeGTFSTime(tt.gtfsTime, tt.serviceDate)
			if (err != nil) != tt.wantErr {
				t.Errorf("NormalizeGTFSTime() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("NormalizeGTFSTime() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestExtractDateAndTime(t *testing.T) {
	tests := []struct {
		name     string
		datetime string
		wantDate string
		wantTime string
		wantErr  bool
	}{
		{
			name:     "normal datetime",
			datetime: "2025-12-25T14:30:00",
			wantDate: "20251225",
			wantTime: "14:30:00",
			wantErr:  false,
		},
		{
			name:     "midnight",
			datetime: "2025-12-26T00:00:00",
			wantDate: "20251226",
			wantTime: "00:00:00",
			wantErr:  false,
		},
		{
			name:     "invalid format",
			datetime: "2025-12-25 14:30:00",
			wantDate: "",
			wantTime: "",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotDate, gotTime, err := ExtractDateAndTime(tt.datetime)
			if (err != nil) != tt.wantErr {
				t.Errorf("ExtractDateAndTime() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if gotDate != tt.wantDate {
				t.Errorf("ExtractDateAndTime() date = %v, want %v", gotDate, tt.wantDate)
			}
			if gotTime != tt.wantTime {
				t.Errorf("ExtractDateAndTime() time = %v, want %v", gotTime, tt.wantTime)
			}
		})
	}
}

func TestParseAndFormatISO8601(t *testing.T) {
	original := "2025-12-25T14:30:00"

	parsed, err := ParseISO8601(original)
	if err != nil {
		t.Fatalf("ParseISO8601() error = %v", err)
	}

	if parsed.Year() != 2025 || parsed.Month() != time.December || parsed.Day() != 25 {
		t.Errorf("ParseISO8601() date = %v, want 2025-12-25", parsed)
	}
	if parsed.Hour() != 14 || parsed.Minute() != 30 || parsed.Second() != 0 {
		t.Errorf("ParseISO8601() time = %v, want 14:30:00", parsed)
	}

	formatted := FormatISO8601(parsed)
	if formatted != original {
		t.Errorf("FormatISO8601() = %v, want %v", formatted, original)
	}
}
