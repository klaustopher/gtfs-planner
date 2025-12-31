package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/charmbracelet/bubbles/progress"
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/spf13/cobra"
)

var downloadCmd = &cobra.Command{
	Use:   "download",
	Short: "Download GTFS feed from configured URL",
	Long:  `Downloads the latest GTFS feed ZIP file from the URL specified in the config.`,
	Run:   runDownload,
}

// downloadModel is the Bubble Tea model for the download progress UI
type downloadModel struct {
	config      *Config
	progress    progress.Model
	spinner     spinner.Model
	downloaded  int64
	totalSize   int64
	done        bool
	err         error
	filename    string
	startTime   time.Time
	lastUpdate  time.Time
	downloadMsg string
}

type downloadProgressMsg struct {
	downloaded int64
	total      int64
}

type downloadCompleteMsg struct {
	err error
}

type tickMsg time.Time

func initialDownloadModel(cfg *Config) downloadModel {
	p := progress.New(
		progress.WithDefaultGradient(),
		progress.WithWidth(50),
	)
	s := spinner.New()
	s.Spinner = spinner.Dot
	s.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("63"))

	return downloadModel{
		config:     cfg,
		progress:   p,
		spinner:    s,
		filename:   cfg.FeedPath,
		startTime:  time.Now(),
		lastUpdate: time.Now(),
	}
}

func (m downloadModel) Init() tea.Cmd {
	return tea.Batch(
		m.spinner.Tick,
		startDownload(m.config),
		tickCmd(),
	)
}

func tickCmd() tea.Cmd {
	return tea.Tick(100*time.Millisecond, func(t time.Time) tea.Msg {
		return tickMsg(t)
	})
}

func (m downloadModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		if msg.String() == "ctrl+c" || msg.String() == "q" {
			return m, tea.Quit
		}

	case tickMsg:
		if !m.done {
			return m, tickCmd()
		}

	case downloadProgressMsg:
		m.downloaded = msg.downloaded
		m.totalSize = msg.total
		m.lastUpdate = time.Now()
		return m, nil

	case downloadCompleteMsg:
		m.done = true
		m.err = msg.err
		return m, tea.Quit

	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd

	case progress.FrameMsg:
		progressModel, cmd := m.progress.Update(msg)
		m.progress = progressModel.(progress.Model)
		return m, cmd
	}

	return m, nil
}

func (m downloadModel) View() string {
	var s string

	s += titleStyle.Render("GTFS Feed Download") + "\n\n"

	if m.err != nil {
		s += errorStyle.Render("Error: "+m.err.Error()) + "\n"
		return s
	}

	if m.done {
		elapsed := time.Since(m.startTime)
		s += successStyle.Render("✓ Download complete!") + "\n\n"
		s += labelStyle.Render("File:") + valueStyle.Render(m.filename) + "\n"
		s += labelStyle.Render("Size:") + valueStyle.Render(formatBytes(m.downloaded)) + "\n"
		s += labelStyle.Render("Time:") + valueStyle.Render(elapsed.Round(time.Millisecond).String()) + "\n"
		return s
	}

	// Show spinner and URL
	s += m.spinner.View() + " Downloading from:\n"
	s += infoStyle.Render("  "+m.config.FeedURL) + "\n\n"

	// Progress bar
	if m.totalSize > 0 {
		percent := float64(m.downloaded) / float64(m.totalSize)
		s += m.progress.ViewAs(percent) + "\n\n"

		// Stats
		elapsed := time.Since(m.startTime)
		speed := float64(m.downloaded) / elapsed.Seconds()

		s += labelStyle.Render("Downloaded:") + valueStyle.Render(fmt.Sprintf("%s / %s", formatBytes(m.downloaded), formatBytes(m.totalSize))) + "\n"
		s += labelStyle.Render("Speed:") + valueStyle.Render(formatBytes(int64(speed))+"/s") + "\n"

		if speed > 0 {
			remaining := float64(m.totalSize-m.downloaded) / speed
			s += labelStyle.Render("ETA:") + valueStyle.Render(time.Duration(remaining*float64(time.Second)).Round(time.Second).String()) + "\n"
		}
	} else {
		s += m.spinner.View() + " Connecting...\n"
		s += labelStyle.Render("Downloaded:") + valueStyle.Render(formatBytes(m.downloaded)) + "\n"
	}

	s += "\n" + infoStyle.Render("Press q or Ctrl+C to cancel")

	return s
}

func formatBytes(bytes int64) string {
	const (
		KB = 1024
		MB = KB * 1024
		GB = MB * 1024
	)

	switch {
	case bytes >= GB:
		return fmt.Sprintf("%.2f GB", float64(bytes)/GB)
	case bytes >= MB:
		return fmt.Sprintf("%.2f MB", float64(bytes)/MB)
	case bytes >= KB:
		return fmt.Sprintf("%.2f KB", float64(bytes)/KB)
	default:
		return fmt.Sprintf("%d B", bytes)
	}
}

// progressWriter wraps an io.Writer to track download progress
type progressWriter struct {
	writer     io.Writer
	total      int64
	downloaded int64
	program    *tea.Program
}

func (pw *progressWriter) Write(p []byte) (int, error) {
	n, err := pw.writer.Write(p)
	pw.downloaded += int64(n)

	if pw.program != nil {
		pw.program.Send(downloadProgressMsg{
			downloaded: pw.downloaded,
			total:      pw.total,
		})
	}

	return n, err
}

var downloadProgram *tea.Program

func startDownload(cfg *Config) tea.Cmd {
	return func() tea.Msg {
		// Ensure directory exists
		if err := cfg.EnsureDirectories(); err != nil {
			return downloadCompleteMsg{err: err}
		}

		// Create temp file
		tmpFile, err := os.CreateTemp("", "gtfs-download-*.zip")
		if err != nil {
			return downloadCompleteMsg{err: fmt.Errorf("failed to create temp file: %w", err)}
		}
		tmpPath := tmpFile.Name()

		// Start HTTP request
		resp, err := http.Get(cfg.FeedURL)
		if err != nil {
			tmpFile.Close()
			os.Remove(tmpPath)
			return downloadCompleteMsg{err: fmt.Errorf("failed to start download: %w", err)}
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			tmpFile.Close()
			os.Remove(tmpPath)
			return downloadCompleteMsg{err: fmt.Errorf("server returned status %d", resp.StatusCode)}
		}

		// Set up progress writer
		pw := &progressWriter{
			writer:  tmpFile,
			total:   resp.ContentLength,
			program: downloadProgram,
		}

		// Copy with progress
		_, err = io.Copy(pw, resp.Body)
		tmpFile.Close()

		if err != nil {
			os.Remove(tmpPath)
			return downloadCompleteMsg{err: fmt.Errorf("download failed: %w", err)}
		}

		// Move temp file to final location
		if err := os.Rename(tmpPath, cfg.FeedPath); err != nil {
			// Try copy if rename fails (cross-device)
			if err := copyFile(tmpPath, cfg.FeedPath); err != nil {
				os.Remove(tmpPath)
				return downloadCompleteMsg{err: fmt.Errorf("failed to save file: %w", err)}
			}
			os.Remove(tmpPath)
		}

		return downloadCompleteMsg{err: nil}
	}
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

func runDownload(cmd *cobra.Command, args []string) {
	cfg, err := LoadConfig(cfgFile)
	if err != nil {
		fmt.Println(errorStyle.Render("Error loading config: " + err.Error()))
		os.Exit(1)
	}

	m := initialDownloadModel(cfg)
	downloadProgram = tea.NewProgram(m)

	finalModel, err := downloadProgram.Run()
	if err != nil {
		fmt.Println(errorStyle.Render("Error: " + err.Error()))
		os.Exit(1)
	}

	// Check if download completed successfully
	if dm, ok := finalModel.(downloadModel); ok && dm.err != nil {
		os.Exit(1)
	}
}
