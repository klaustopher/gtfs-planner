package main

// appVersion is the released version. It is bumped by knope together with
// wails.json and frontend/package.json; see knope.toml.
const appVersion = "1.1.0"

// GetAppVersion returns the version this build was released as.
func (a *App) GetAppVersion() string {
	return appVersion
}
