package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := application.New(application.Options{
		Name: "gtfs-planner",
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		// Registered with the OS in build/config.yml. Windows passes the opened
		// file as a launch argument, which Wails matches against this list.
		FileAssociations: []string{journeyFileExt},
	})

	gtfsApp := NewApp(app)
	app.RegisterService(application.NewService(gtfsApp))

	app.Event.OnApplicationEvent(events.Common.ApplicationOpenedWithFile, func(event *application.ApplicationEvent) {
		gtfsApp.onFileOpen(event.Context().Filename())
	})

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "gtfs-planner",
		Width:            1024,
		Height:           768,
		BackgroundColour: application.NewRGB(27, 38, 54),
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
