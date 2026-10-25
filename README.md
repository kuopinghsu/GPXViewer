# GPXViewer

Web app for viewing and editing GPS tracks from GPX, KML, and Polarsteps JSON.

[DEMO](https://apps.kuoping.com/gpx.html)

## Features

- Import track files:
  - GPX (`.gpx`)
  - KML / KMZ (`.kml`, `.kmz`)
  - Polarsteps JSON (`.json`)
- Map display:
  - Flat maps via Leaflet (OSM, CARTO, Satellite)
  - 3D Globe via MapLibre GL
  - Quick map-source switch on the map (top-right)
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
  - Region select → multi-point delete
- Export optimized track to GPX or KML
- Settings dialog (thresholds, map source, CARTO API key)
- Dark/light theme, toasts, keyboard shortcuts

## Project Structure

- [src/template.html](src/template.html) — app HTML shell
- [src/styles.css](src/styles.css) — UI styles
- [src/main.js](src/main.js) — import, optimize, render, edit, export logic
- [build.js](build.js) — inlines assets (Leaflet + MapLibre + app code) into one HTML file
- [Makefile](Makefile) — helper build commands
- [index.html](index.html) — generated output (root)
- [dist/gpx.html](dist/gpx.html) — generated output (dist)

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
- [dist/gpx.html](dist/gpx.html)

## Clean Generated Files

```bash
make clean
```

## Usage

1. Build once (`make build` or `make check`).
2. Open [index.html](index.html) (or [dist/gpx.html](dist/gpx.html)) directly in a browser.
3. Click **Open** (or use the empty-state buttons / drag-and-drop) to import a track, or click **Demo**.
4. Edit on the map (see Help below).
5. Optional: open **Settings** to adjust optimization thresholds and map source.
6. Click **Export GPX** or **Export KML** to download the result.

## Help

### Load a track

- **Open** — choose a `.gpx`, `.kml`, `.kmz`, or Polarsteps `.json` file.
- **Demo** — load the built-in sample track.
- Drag and drop a file onto the map area.
- Empty state also has **Open file** and **Try Demo** buttons.

### Single-point editing

| Action | How |
| --- | --- |
| View details | Left-click a point marker |
| Move a point | Drag the point marker |
| Insert a point | Left-click a track line segment |
| Remove one point | Right-click a point → **Remove Point**, or hover a point and press **Delete** / **Backspace** |

### Multi-point select and delete

1. Load a track.
2. Click **Select** in the toolbar (or press **R**).
3. Drag a box on the map over the points you want. Selected points turn red; the HUD shows the count.
4. Click **Remove**, or press **Delete** / **Backspace**.
5. Confirm in the dialog.

Notes:

- While Select mode is on, map pan is disabled so drag = box select.
- Press **Esc** to exit Select mode and clear the selection.
- At least **2 points** must remain on the track.

### Map sources

- Use the **map source** dropdown (top-right on the map) or **Settings → Map Source**.
- Options: OpenStreetMap, CARTO Dark / Voyager / Light, ArcGIS Satellite, **3D Globe**.
- CARTO basemaps and the 3D Globe need a free [CARTO basemap API key](https://carto.com/basemaps/apikey/).
  - Set it in **Settings → CARTO API Key** (stored encoded in localStorage; never shown again after save).
  - Leave the field blank to keep the saved key; use **Clear** then **Save** to remove it.

### Other UI

- **Undo** / **Redo** — reverse or re-apply edits (`Ctrl+Z` / `Ctrl+Y`).
- **Copy Map** — copy a map snapshot to the clipboard.
- **Theme** — toggle dark / light.
- View presets (bottom-left when zoomed in): Full / Start / End / Top (highest elevation).
- Search (top-left): coordinates or place name (`Ctrl+F`).
- On narrow screens (≤900px), **Export KML**, **Copy Map**, and **About** move under **More**.

### Keyboard shortcuts

Press **?** in the app for the full list. Common ones:

| Shortcut | Action |
| --- | --- |
| `Ctrl+O` | Open file |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `Ctrl+F` | Search |
| `R` | Toggle region select |
| `Delete` / `Backspace` | Remove hovered point or selected points |
| `1`–`4` | Full / Start / End / Highest view |
| `P` | Toggle side panel |
| `Esc` | Exit select mode / close dialogs |
| `?` | Show shortcuts |

## Settings Reference

The **Settings** dialog updates runtime thresholds used by optimization and movement classification.

### Track Cleanup

- **Max Speed (km/h)** (`maxAllowedSpeedKmh`, default `30`)
  - Removes points treated as speed anomalies (except long-distance segments handled by gap logic).
- **Cluster Radius (m)** (`stationaryRadiusMeters`, default `20`)
  - Points within this radius are merged into one center point.
- **Long Gap (m)** (`longGapMeters`, default `100`)
  - If two adjacent points are farther than this distance, a Bezier midpoint is inserted.
- **Simplification Tolerance (m)** (`simplificationToleranceMeters`)
  - Controls redundant-point removal by Bezier fit; smaller values keep more points.
- **Remove Redundant Points** / **Fill Long Gaps (Bezier)** — toggles for those steps.
- **Dwell Threshold (hours)** (`dwellMinMs`, default `1.0 hour`)
  - Stay duration threshold used for dwell detection/highlight.

### Flight Detection

- **Flight Distance (km)** (`flightDistanceKm`, default `600`)
  - Segment is marked as flight if distance is above this threshold.
- **Flight Speed (km/h)** (`flightSpeedKmh`, default `250`)
  - Segment is marked as flight if speed is above this threshold.

### Map

- **Map Source** — flat basemap or 3D Globe (see Help above).
- **CARTO API Key** — required for CARTO / Globe tiles; encoded locally, never displayed after save.

### Save Behavior

- Clicking **Save** applies values immediately.
- If a track is already loaded, the app re-optimizes and rerenders using current settings.
- Map view position/zoom is preserved while rerendering.

## Notes

- The app is designed to run without a web server (`file://` usage).
- Map tiles require internet access.
- CARTO / Globe tiles need a CARTO API key (see Help).
