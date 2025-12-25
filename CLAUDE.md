# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an application that helps users to work with GTFS data by visualizing the data on a map layer.

## Technologies Used

The application is written in Go and uses Wails for building desktop applications. It also utilizes SQLite for data storage and manipulation.

The frontend application is built using React, TypeScript and MapLibre GL for map rendering.

## Data Structure

- `gtfs-data/feeds/` - Raw GTFS feed ZIP files (downloaded transit data)
- `gtfs-data/sqlite/` - SQLite database containing parsed GTFS data (`gtfs.sqlite`)

Both directories use `.gitkeep` files to maintain structure while ignoring actual data files.

## GTFS Context

GTFS is a standard format for public transit schedules and geographic information. The SQLite database likely contains tables for: agencies, routes, stops, stop_times, trips, calendar, calendar_dates, shapes, and other transit-related entities.
