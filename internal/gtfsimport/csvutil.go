package gtfsimport

import (
	"bufio"
	"encoding/csv"
	"io"
	"strings"
)

// headerIndex maps normalized GTFS column names to their position in a CSV row.
// GTFS does not guarantee column order, so all access is by name.
type headerIndex map[string]int

// newCSVReader wraps r in a CSV reader tolerant of the quirks seen in real
// German GTFS feeds: mixed quoting, optional/trailing columns, and a possible
// UTF-8 BOM on the first header field. It returns the reader and the parsed
// header index.
func newCSVReader(r io.Reader) (*csv.Reader, headerIndex, error) {
	cr := csv.NewReader(bufio.NewReaderSize(r, 1<<20))
	cr.FieldsPerRecord = -1 // rows may omit trailing optional columns
	cr.LazyQuotes = true    // tolerate stray quotes
	cr.ReuseRecord = true   // avoid per-row allocation for huge files

	header, err := cr.Read()
	if err != nil {
		return nil, nil, err
	}

	idx := make(headerIndex, len(header))
	for i, name := range header {
		idx[normalizeHeader(name)] = i
	}
	return cr, idx, nil
}

// normalizeHeader strips a UTF-8 BOM and surrounding whitespace and lower-cases
// the column name.
func normalizeHeader(name string) string {
	name = strings.TrimPrefix(name, "\ufeff")
	return strings.ToLower(strings.TrimSpace(name))
}

// get returns the trimmed value of the named column for row, or "" if the
// column is absent or the row is too short.
func (h headerIndex) get(row []string, name string) string {
	i, ok := h[name]
	if !ok || i >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[i])
}

// has reports whether the named column exists in the header.
func (h headerIndex) has(name string) bool {
	_, ok := h[name]
	return ok
}
