# GPXViewer

Web app for viewing and editing GPS tracks from GPX, KML, and Polarsteps JSON.

## Features

- Import track files:
  - GPX (`.gpx`)
  - KML (`.kml`)
  - Polarsteps JSON (`.json`)
- Display track on OpenStreetMap (Leaflet)
- Right panel with:
  - Statistics
  - Point details (click point)
  - Log/status
- Track optimization pipeline:
  - Remove high-speed points (`maxAllowedSpeedKmh`)
  - Merge nearby points in a radius (`stationaryRadiusMeters`) into one center point
  - Bezier-based redundant-point reduction
  - Insert Bezier midpoint for long gaps (`longGapMeters`)
  - Dwell detection (stay over configured time)
- Movement marker:
  - Flight segments only (`✈️`)
- Track editing:
  - Right-click point → remove point
  - Drag point marker to move point
  - Click line segment to insert point
- Export optimized track to GPX
- Settings dialog to tune thresholds live
- About dialog

## Project Structure

- [src/template.html](src/template.html) — app HTML shell
- [src/styles.css](src/styles.css) — UI styles
- [src/main.js](src/main.js) — import, optimize, render, edit, export logic
- [build.js](build.js) — inlines assets (Leaflet + app code) into one HTML file
- [Makefile](Makefile) — helper build commands
- [index.html](index.html) — generated output (root)
- [dist/index.html](dist/index.html) — generated output (dist)

## Requirements

- Node.js 18+ (build-time only)
- Browser (run-time)

## Build

```bash
make build
```

or

```bash
node build.js
```

## Validate Build Output

```bash
make check
```

This generates:

- [index.html](index.html)
- [dist/index.html](dist/index.html)

## Clean Generated Files

```bash
make clean
```

## Usage

1. Build once (`make build` or `make check`).
2. Open [index.html](index.html) (or [dist/index.html](dist/index.html)) directly in a browser.
3. Click **Open** to import a GPX/KML/Polarsteps JSON file.
4. Use map interactions:
   - Click point → view details
   - Right-click point → remove
   - Drag point → move
   - Click track line → insert point
5. Optional: open **Settings** to adjust optimization thresholds.
6. Click **Export Optimized GPX** to download result.

## Settings Reference

The **Settings** dialog updates runtime thresholds used by optimization and movement classification.

### Track Cleanup

- **Max Speed (km/h)** (`maxAllowedSpeedKmh`, default `30`)
  - Removes points treated as speed anomalies (except long-distance segments handled by gap logic).
- **Cluster Radius (m)** (`stationaryRadiusMeters`, default `20`)
  - Points within this radius are merged into one center point.
- **Long Gap (m)** (`longGapMeters`, default `100`)
  - If two adjacent points are farther than this distance, a Bezier midpoint is inserted.
- **Bezier Tolerance (m)** (`bezierRedundantToleranceMeters`, default `8`)
  - Controls redundant-point removal by Bezier fit; smaller values keep more points.
- **Dwell Threshold (hours)** (`dwellMinMs`, default `1.0 hour`)
  - Stay duration threshold used for dwell detection/highlight.

### Flight Detection

- **Flight Distance (km)** (`flightDistanceKm`, default `600`)
  - Segment is marked as flight if distance is above this threshold.
- **Flight Speed (km/h)** (`flightSpeedKmh`, default `250`)
  - Segment is marked as flight if speed is above this threshold.

### Save Behavior

- Clicking **Save** applies values immediately.
- If a track is already loaded, the app re-optimizes and rerenders using current settings.
- Map view position/zoom is preserved while rerendering.

## Notes

- The app is designed to run without a web server (`file://` usage).
- OSM tiles require internet access when viewing map tiles.
