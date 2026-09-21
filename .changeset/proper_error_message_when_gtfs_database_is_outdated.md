---
default: minor
---

# Proper error message, when GTFS database is outdated

When starting with an outdated GTFS database it displayed that the file is valid for `-77 days`. Fixed with a proper message
that the database is expired and offer to download a fresh one
