---
default: major
---

# Upgrade to Wails v3

The app is now built on Wails v3. On Linux it requires GTK4 and WebKitGTK 6.0
(Ubuntu 24.04+, Debian 13+, Fedora, Arch); the separate webkit2gtk 4.0 and 4.1
downloads are replaced by a single `gtfs-planner_<version>_linux_<arch>.tar.gz`
per architecture, and distributions that only ship webkit2gtk 4.0 (e.g. Ubuntu
22.04) are no longer supported.
