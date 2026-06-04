package gtfsimport

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
)

// Download streams the GTFS feed at url into destPath atomically: it writes to a
// temp file in the same directory and renames it into place on success.
// Byte progress is reported via progress.
func Download(ctx context.Context, url, destPath string, progress ProgressFunc) error {
	dir := filepath.Dir(destPath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("failed to create destination directory: %w", err)
	}

	// Create the temp file in the same directory so the final rename is on the
	// same filesystem (no cross-device copy).
	tmp, err := os.CreateTemp(dir, ".gtfs-download-*.zip")
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}
	tmpPath := tmp.Name()
	defer func() {
		tmp.Close()
		os.Remove(tmpPath) // no-op if it was renamed away
	}()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("failed to build request: %w", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("download request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("server returned status %d", resp.StatusCode)
	}

	pw := &progressWriter{
		w:        tmp,
		total:    resp.ContentLength,
		progress: progress,
	}
	if _, err := io.Copy(pw, resp.Body); err != nil {
		return fmt.Errorf("download failed: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("failed to flush download: %w", err)
	}

	if err := os.Rename(tmpPath, destPath); err != nil {
		return fmt.Errorf("failed to move downloaded file into place: %w", err)
	}
	return nil
}

// progressWriter counts bytes written and reports download progress.
type progressWriter struct {
	w          io.Writer
	total      int64
	downloaded int64
	progress   ProgressFunc
}

func (pw *progressWriter) Write(p []byte) (int, error) {
	n, err := pw.w.Write(p)
	pw.downloaded += int64(n)
	pw.progress.report(Progress{
		Phase:   PhaseDownload,
		Current: pw.downloaded,
		Total:   pw.total,
	})
	return n, err
}
