package gtfsimport

// Phase distinguishes the two long-running operations a consumer may report on.
type Phase string

const (
	PhaseDownload Phase = "download"
	PhaseImport   Phase = "import"
)

// Progress is a single progress sample. For downloads, Current/Total are bytes.
// For imports, Current is the number of rows processed for File and Total is -1
// (the row count is unknown while streaming).
type Progress struct {
	Phase   Phase  `json:"phase"`
	File    string `json:"file"`    // e.g. "stop_times.txt"; "" for downloads
	Current int64  `json:"current"` // download: bytes; import: rows
	Total   int64  `json:"total"`   // -1 when unknown
	Message string `json:"message"`
}

// ProgressFunc receives progress samples. It is called frequently and must be
// cheap and non-blocking. A nil ProgressFunc is valid (no reporting).
type ProgressFunc func(Progress)

func (f ProgressFunc) report(p Progress) {
	if f != nil {
		f(p)
	}
}
