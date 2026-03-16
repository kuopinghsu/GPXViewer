const appState = {
  map: null,
  layers: {
    track: null,
    points: null,
    transport: null
  },
  rawPoints: [],
  optimizedPoints: [],
  selectedMarker: null,
  fileName: '',
  contextMenuPointIndex: -1
};

const METERS_PER_KM = 1000;
const MS_PER_HOUR = 3600000;

const COORD_EPSILON = 1e-7; // ~1 cm precision

let settings = {
  maxAllowedSpeedKmh: 30,
  stationaryRadiusMeters: 20,
  longGapMeters: 100,
  bezierRedundantToleranceMeters: 8,
  dwellMinMs: 3600000,
  flightDistanceKm: 600,
  flightSpeedKmh: 250
};

const fileInputEl = document.getElementById('fileInput');
const exportBtnEl = document.getElementById('exportBtn');
const statsEl = document.getElementById('stats');
const pointInfoEl = document.getElementById('pointInfo');
const logEl = document.getElementById('log');
const statusBarEl = document.getElementById('statusBar');
const pointContextMenuEl = document.getElementById('pointContextMenu');
const removePointBtnEl = document.getElementById('removePointBtn');
const settingsBtnEl = document.getElementById('settingsBtn');
const aboutBtnEl = document.getElementById('aboutBtn');
const settingsDialogEl = document.getElementById('settingsDialog');
const aboutDialogEl = document.getElementById('aboutDialog');
const settingsCloseBtnEl = document.getElementById('settingsCloseBtn');
const settingsCancelBtnEl = document.getElementById('settingsCancelBtn');
const settingsSaveBtnEl = document.getElementById('settingsSaveBtn');
const aboutCloseBtnEl = document.getElementById('aboutCloseBtn');
const mapEmptyStateEl = document.getElementById('mapEmptyState');
const panelCollapseBtnEl = document.getElementById('panelCollapseBtn');
const copyMapBtnEl = document.getElementById('copyMapBtn');
const mapWrapEl = document.querySelector('.map-wrap');
const settingMaxAllowedSpeedKmhEl = document.getElementById('settingMaxAllowedSpeedKmh');
const settingStationaryRadiusMetersEl = document.getElementById('settingStationaryRadiusMeters');
const settingLongGapMetersEl = document.getElementById('settingLongGapMeters');
const settingBezierToleranceMetersEl = document.getElementById('settingBezierToleranceMeters');
const settingDwellMinHoursEl = document.getElementById('settingDwellMinHours');
const settingFlightDistanceKmEl = document.getElementById('settingFlightDistanceKm');
const settingFlightSpeedKmhEl = document.getElementById('settingFlightSpeedKmh');

initMap();
wireEvents();

function initMap() {
  appState.map = L.map('map', { preferCanvas: true }).setView([25.03, 121.56], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
    crossOrigin: 'anonymous'
  }).addTo(appState.map);

  appState.layers.track = L.layerGroup().addTo(appState.map);
  appState.layers.points = L.layerGroup().addTo(appState.map);
  appState.layers.transport = L.layerGroup().addTo(appState.map);
}

function wireEvents() {
  fileInputEl.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    await handleImport(file);
  });

  exportBtnEl.addEventListener('click', () => {
    if (!appState.optimizedPoints.length) {
      return;
    }
    exportGpx(appState.optimizedPoints, appState.fileName);
  });

  removePointBtnEl.addEventListener('click', () => {
    removePointFromTrack(appState.contextMenuPointIndex);
    hidePointContextMenu();
  });

  settingsBtnEl.addEventListener('click', () => {
    populateSettingsForm();
    openDialog(settingsDialogEl);
  });

  aboutBtnEl.addEventListener('click', () => {
    openDialog(aboutDialogEl);
  });

  settingsCloseBtnEl.addEventListener('click', () => {
    closeDialog(settingsDialogEl);
  });

  settingsCancelBtnEl.addEventListener('click', () => {
    closeDialog(settingsDialogEl);
  });

  settingsSaveBtnEl.addEventListener('click', () => {
    saveSettingsFromForm();
  });

  if (aboutCloseBtnEl) {
    aboutCloseBtnEl.addEventListener('click', () => {
      closeDialog(aboutDialogEl);
    });
  }

  settingsDialogEl.addEventListener('click', (event) => {
    if (event.target === settingsDialogEl) {
      closeDialog(settingsDialogEl);
    }
  });

  aboutDialogEl.addEventListener('click', (event) => {
    if (event.target === aboutDialogEl) {
      closeDialog(aboutDialogEl);
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeDialog(settingsDialogEl);
      closeDialog(aboutDialogEl);
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 'o') {
      event.preventDefault();
      fileInputEl.click();
    }
  });

  mapWrapEl.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    mapWrapEl.classList.add('drag-over');
  });

  mapWrapEl.addEventListener('dragleave', (event) => {
    if (!mapWrapEl.contains(event.relatedTarget)) {
      mapWrapEl.classList.remove('drag-over');
    }
  });

  mapWrapEl.addEventListener('drop', async (event) => {
    event.preventDefault();
    mapWrapEl.classList.remove('drag-over');
    const file = event.dataTransfer.files?.[0];
    if (file) {
      await handleImport(file);
    }
  });

  panelCollapseBtnEl.addEventListener('click', () => {
    const panel = panelCollapseBtnEl.parentElement;
    const collapsing = !panel.classList.contains('collapsed');
    panel.classList.toggle('collapsed', collapsing);
    panelCollapseBtnEl.title = collapsing ? 'Expand panel' : 'Collapse panel';
    panelCollapseBtnEl.setAttribute('aria-label', collapsing ? 'Expand panel' : 'Collapse panel');
  });

  copyMapBtnEl.addEventListener('click', copyMapToClipboard);

  document.addEventListener('click', () => {
    hidePointContextMenu();
  });

  window.addEventListener('resize', () => {
    hidePointContextMenu();
  });

  appState.map.on('click', () => {
    hidePointContextMenu();
  });

  appState.map.on('contextmenu', () => {
    hidePointContextMenu();
  });
}

function openDialog(dialogElement) {
  dialogElement.hidden = false;
}

function closeDialog(dialogElement) {
  dialogElement.hidden = true;
}

function populateSettingsForm() {
  settingMaxAllowedSpeedKmhEl.value = settings.maxAllowedSpeedKmh;
  settingStationaryRadiusMetersEl.value = settings.stationaryRadiusMeters;
  settingLongGapMetersEl.value = settings.longGapMeters;
  settingBezierToleranceMetersEl.value = settings.bezierRedundantToleranceMeters;
  settingDwellMinHoursEl.value = (settings.dwellMinMs / MS_PER_HOUR).toFixed(2);
  settingFlightDistanceKmEl.value = settings.flightDistanceKm;
  settingFlightSpeedKmhEl.value = settings.flightSpeedKmh;
}

function saveSettingsFromForm() {
  const nextSettings = {
    maxAllowedSpeedKmh: Number(settingMaxAllowedSpeedKmhEl.value),
    stationaryRadiusMeters: Number(settingStationaryRadiusMetersEl.value),
    longGapMeters: Number(settingLongGapMetersEl.value),
    bezierRedundantToleranceMeters: Number(settingBezierToleranceMetersEl.value),
    dwellMinMs: Number(settingDwellMinHoursEl.value) * MS_PER_HOUR,
    flightDistanceKm: Number(settingFlightDistanceKmEl.value),
    flightSpeedKmh: Number(settingFlightSpeedKmhEl.value)
  };

  const invalid = Object.values(nextSettings).some((value) => !Number.isFinite(value) || value <= 0);
  if (invalid) {
    setStatus('Invalid settings values. Please use numbers greater than 0.');
    return;
  }

  settings = { ...settings, ...nextSettings };
  closeDialog(settingsDialogEl);

  if (appState.rawPoints.length >= 2) {
    const optimized = optimizePoints(appState.rawPoints);
    if (optimized.length >= 2) {
      appState.optimizedPoints = optimized;
      renderTrack(optimized, { preserveView: true });
      renderStats(appState.rawPoints, optimized);
      setStatus('Settings saved and track re-optimized.');
      return;
    }
  }

  setStatus('Settings saved.');
}

async function handleImport(file) {
  try {
    setStatus(`Loading ${file.name}...`);
    const text = await file.text();
    const ext = file.name.toLowerCase().split('.').pop();

    let rawPoints;
    if (ext === 'gpx') {
      rawPoints = parseGpx(text);
    } else if (ext === 'kml') {
      rawPoints = parseKml(text);
    } else if (ext === 'json') {
      rawPoints = parsePolarstepsJson(text);
    } else {
      throw new Error('Unsupported file format. Please use .gpx, .kml, or Polarsteps .json');
    }

    if (rawPoints.length < 2) {
      throw new Error('Track must contain at least 2 points.');
    }

    const optimized = optimizePoints(rawPoints);
    if (optimized.length < 2) {
      throw new Error('Optimization removed too many points; unable to render track.');
    }

    appState.rawPoints = rawPoints;
    appState.optimizedPoints = optimized;
    appState.fileName = file.name;
    renderTrack(optimized, { centerOnFirst: true });
    renderStats(rawPoints, optimized);

    if (mapEmptyStateEl) {
      mapEmptyStateEl.hidden = true;
    }
    exportBtnEl.disabled = false;
    setStatus(`Imported ${rawPoints.length} points, optimized to ${optimized.length} points.`);
  } catch (error) {
    setStatus(`Error: ${error.message}`);
    exportBtnEl.disabled = true;
  }
}

function parsePolarstepsJson(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error('Invalid JSON.');
  }

  const records = extractCoordinateRecords(parsed);
  if (records.length < 2) {
    throw new Error('Polarsteps JSON does not contain enough GPS points.');
  }

  const firstValidTime = records.find((record) => record.time instanceof Date && !Number.isNaN(record.time.getTime()))?.time;

  const points = records
    .reduce((acc, record, index) => {
      const lat = Number(record.lat);
      const lon = Number(record.lon);
      const ele = Number(record.ele ?? 0);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return acc;
      }

      const previousTime = acc.length > 0 ? acc[acc.length - 1].time : (firstValidTime ?? new Date());
      const time =
        record.time instanceof Date && !Number.isNaN(record.time.getTime())
          ? record.time
          : new Date(previousTime.getTime() + 60000);

      acc.push({
        id: index,
        lat,
        lon,
        ele: Number.isFinite(ele) ? ele : 0,
        time,
        isDwell: false,
        dwellMs: 0,
        speedKmh: 0
      });
      return acc;
    }, [])
    .sort((a, b) => a.time - b.time);

  return dedupeByTimeAndLocation(points);
}

function extractCoordinateRecords(input) {
  const records = [];
  const stack = [input];
  const dedupe = new Set();

  while (stack.length) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    if (Array.isArray(current)) {
      for (let i = current.length - 1; i >= 0; i -= 1) {
        stack.push(current[i]);
      }
      continue;
    }

    if (typeof current !== 'object') {
      continue;
    }

    const record = readCoordinateRecord(current);
    if (record) {
      const timeKey = record.time ? record.time.getTime() : 'none';
      const key = `${record.lat.toFixed(7)}|${record.lon.toFixed(7)}|${timeKey}`;
      if (!dedupe.has(key)) {
        dedupe.add(key);
        records.push(record);
      }
      continue;
    }

    Object.values(current).forEach((value) => {
      if (value && typeof value === 'object') {
        stack.push(value);
      }
    });
  }

  return records;
}

function readCoordinateRecord(node) {
  const directCoord = readCoordFromObject(node);
  if (directCoord) {
    return directCoord;
  }

  const locationNode = node.location && typeof node.location === 'object' ? node.location : null;
  if (locationNode) {
    const locCoord = readCoordFromObject(locationNode);
    if (locCoord) {
      const parentTime = readTimeFromObject(node);
      return {
        lat: locCoord.lat,
        lon: locCoord.lon,
        ele: locCoord.ele,
        time: parentTime ?? locCoord.time
      };
    }
  }

  return null;
}

function readCoordFromObject(node) {
  const coords = readCoordinatesArray(node.coordinates);
  if (coords) {
    return {
      lat: coords.lat,
      lon: coords.lon,
      ele: coords.ele,
      time: readTimeFromObject(node)
    };
  }

  const lat = pickNumeric(node, ['lat', 'latitude']);
  const lon = pickNumeric(node, ['lon', 'lng', 'longitude']);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  const ele = pickNumeric(node, ['ele', 'elevation', 'alt', 'altitude']);
  return {
    lat,
    lon,
    ele: Number.isFinite(ele) ? ele : 0,
    time: readTimeFromObject(node)
  };
}

function readCoordinatesArray(value) {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }

  const lon = numberFromUnknown(value[0]);
  const lat = numberFromUnknown(value[1]);
  const ele = numberFromUnknown(value[2]);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return {
    lat,
    lon,
    ele: Number.isFinite(ele) ? ele : 0
  };
}

function readTimeFromObject(node) {
  const keys = ['time', 'timestamp', 'datetime', 'date', 'created_at', 'updated_at', 'local_time', 'recorded_at'];
  for (const key of keys) {
    if (!(key in node)) {
      continue;
    }
    const parsed = parseTimeValue(node[key]);
    if (parsed) {
      return parsed;
    }
  }
  return null;
}

function pickNumeric(node, keys) {
  for (const key of keys) {
    if (!(key in node)) {
      continue;
    }
    const value = numberFromUnknown(node[key]);
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return Number.NaN;
}

function numberFromUnknown(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : Number.NaN;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  return Number.NaN;
}

function parseTimeValue(value) {
  if (value == null) {
    return null;
  }

  if (typeof value === 'number') {
    const ms = value < 1000000000000 ? value * 1000 : value;
    const time = new Date(ms);
    return Number.isNaN(time.getTime()) ? null : time;
  }

  if (typeof value === 'string') {
    const numeric = Number(value.trim());
    if (Number.isFinite(numeric) && value.trim() !== '') {
      return parseTimeValue(numeric);
    }

    const time = new Date(value);
    return Number.isNaN(time.getTime()) ? null : time;
  }

  return null;
}

function parseGpx(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
  const parseError = xml.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid GPX XML.');
  }

  const trkpts = Array.from(xml.querySelectorAll('trkpt'));
  return trkpts
    .map((node, index) => {
      const lat = Number(node.getAttribute('lat'));
      const lon = Number(node.getAttribute('lon'));
      const ele = Number(node.querySelector('ele')?.textContent ?? 0);
      const timeText = node.querySelector('time')?.textContent;
      const time = timeText ? new Date(timeText) : null;
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !time || Number.isNaN(time.getTime())) {
        return null;
      }
      return {
        id: index,
        lat,
        lon,
        ele,
        time,
        isDwell: false,
        dwellMs: 0,
        speedKmh: 0
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);
}

function parseKml(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
  const parseError = xml.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid KML XML.');
  }

  const whenNodes = Array.from(xml.querySelectorAll('when'));
  const coordNodes = Array.from(xml.querySelectorAll('gx\\:coord, coord'));

  if (whenNodes.length && coordNodes.length && whenNodes.length === coordNodes.length) {
    const points = [];
    for (let i = 0; i < whenNodes.length; i += 1) {
      const time = new Date(whenNodes[i].textContent.trim());
      const [lonText, latText, eleText] = coordNodes[i].textContent.trim().split(/\s+/);
      const lat = Number(latText);
      const lon = Number(lonText);
      const ele = Number(eleText ?? 0);
      if (Number.isFinite(lat) && Number.isFinite(lon) && !Number.isNaN(time.getTime())) {
        points.push({
          id: i,
          lat,
          lon,
          ele,
          time,
          isDwell: false,
          dwellMs: 0,
          speedKmh: 0
        });
      }
    }
    if (points.length) {
      return points;
    }
  }

  const coordinateBlock = xml.querySelector('LineString > coordinates');
  if (!coordinateBlock) {
    throw new Error('KML does not contain a Track or LineString coordinates.');
  }

  // KML LineString has no timestamps; assign synthetic 1-minute intervals from epoch 0
  return coordinateBlock.textContent
    .trim()
    .split(/\s+/)
    .map((coord, index) => {
      const [lonText, latText, eleText] = coord.split(',');
      const lat = Number(latText);
      const lon = Number(lonText);
      const ele = Number(eleText ?? 0);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
      }
      return {
        id: index,
        lat,
        lon,
        ele,
        time: new Date(index * 60000),
        isDwell: false,
        dwellMs: 0,
        speedKmh: 0
      };
    })
    .filter(Boolean);
}

function optimizePoints(rawPoints) {
  const cleaned = removeIllegalSpeedPoints(rawPoints);
  const bezierReduced = removeRedundantPointsByBezier(cleaned);
  const reduced = reduceStationaryPoints(bezierReduced);
  const densified = insertBezierPointsForLongGaps(reduced);
  return annotateSpeed(densified);
}

function removeRedundantPointsByBezier(points) {
  if (points.length < 3) {
    return points.slice();
  }

  const kept = [points[0]];

  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = kept[kept.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    const prevNeighbor = kept.length >= 2 ? kept[kept.length - 2] : prev;
    const nextNeighbor = i + 2 < points.length ? points[i + 2] : next;

    const control1 = {
      lat: prev.lat + (next.lat - prevNeighbor.lat) / 6,
      lon: prev.lon + (next.lon - prevNeighbor.lon) / 6
    };
    const control2 = {
      lat: next.lat - (nextNeighbor.lat - prev.lat) / 6,
      lon: next.lon - (nextNeighbor.lon - prev.lon) / 6
    };

    const fittedMid = cubicBezierPoint(prev, control1, control2, next, 0.5);
    const deviationMeters = haversineMeters(curr, fittedMid);

    if (deviationMeters > settings.bezierRedundantToleranceMeters) {
      kept.push(curr);
    }
  }

  kept.push(points[points.length - 1]);
  return dedupeByTimeAndLocation(kept);
}

function cubicBezierPoint(p0, p1, p2, p3, t) {
  const omt = 1 - t;
  const omt2 = omt * omt;
  const t2 = t * t;

  return {
    lat: omt2 * omt * p0.lat + 3 * omt2 * t * p1.lat + 3 * omt * t2 * p2.lat + t2 * t * p3.lat,
    lon: omt2 * omt * p0.lon + 3 * omt2 * t * p1.lon + 3 * omt * t2 * p2.lon + t2 * t * p3.lon
  };
}

function removeIllegalSpeedPoints(points) {
  if (points.length < 2) {
    return points.slice();
  }

  const result = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const prev = result[result.length - 1];
    const candidate = points[i];
    const dtHours = (candidate.time - prev.time) / MS_PER_HOUR;

    if (dtHours <= 0) {
      continue;
    }

    const distanceMeters = haversineMeters(prev, candidate);
    const speedKmh = haversineKm(prev, candidate) / dtHours;
    const isLongDistanceMovement = distanceMeters > settings.longGapMeters;

    if (speedKmh <= settings.maxAllowedSpeedKmh || isLongDistanceMovement) {
      result.push(candidate);
    }
  }

  return result;
}

function reduceStationaryPoints(points) {
  if (points.length < 2) {
    return points.slice();
  }

  const output = [];
  let i = 0;

  while (i < points.length) {
    let j = i;
    let clusterLatSum = 0;
    let clusterLonSum = 0;

    while (j < points.length) {
      const point = points[j];
      const nextCount = j - i + 1;
      const centroid = {
        lat: (clusterLatSum + point.lat) / nextCount,
        lon: (clusterLonSum + point.lon) / nextCount
      };

      let fitsCircle = true;
      for (let k = i; k <= j; k += 1) {
        if (haversineMeters(points[k], centroid) > settings.stationaryRadiusMeters) {
          fitsCircle = false;
          break;
        }
      }

      if (!fitsCircle) {
        break;
      }

      clusterLatSum += point.lat;
      clusterLonSum += point.lon;
      j += 1;
    }

    if (j - i >= 2) {
      const cluster = points.slice(i, j);
      const centerPoint = createClusterCenterPoint(cluster);
      const duration = cluster[cluster.length - 1].time - cluster[0].time;

      output.push({
        ...centerPoint,
        isDwell: duration >= settings.dwellMinMs,
        dwellMs: duration >= settings.dwellMinMs ? duration : 0
      });

      i = j;
      continue;
    }

    output.push({ ...points[i], isDwell: false, dwellMs: 0 });
    i += 1;
  }

  return dedupeByTimeAndLocation(output);
}

function createClusterCenterPoint(cluster) {
  let latSum = 0;
  let lonSum = 0;
  let eleSum = 0;

  for (const point of cluster) {
    latSum += point.lat;
    lonSum += point.lon;
    eleSum += Number.isFinite(Number(point.ele)) ? Number(point.ele) : 0;
  }

  const center = {
    lat: latSum / cluster.length,
    lon: lonSum / cluster.length
  };

  const startTime = cluster[0].time.getTime();
  const endTime = cluster[cluster.length - 1].time.getTime();
  const centerTime = new Date((startTime + endTime) / 2);

  return {
    id: `cluster-${startTime}-${endTime}-${cluster.length}`,
    lat: center.lat,
    lon: center.lon,
    ele: eleSum / cluster.length,
    time: centerTime,
    isDwell: false,
    dwellMs: 0,
    speedKmh: 0
  };
}

function insertBezierPointsForLongGaps(points) {
  if (points.length < 2) {
    return points.slice();
  }

  const output = [points[0]];

  for (let i = 1; i < points.length; i += 1) {
    const start = points[i - 1];
    const end = points[i];
    const segmentDistanceMeters = haversineMeters(start, end);

    if (segmentDistanceMeters > settings.longGapMeters) {
      const prev = i - 2 >= 0 ? points[i - 2] : start;
      const next = i + 1 < points.length ? points[i + 1] : end;
      const bezierPoint = buildBezierMidPoint(prev, start, end, next, i);
      output.push(bezierPoint);
    }

    output.push(end);
  }

  return dedupeByTimeAndLocation(output);
}

function buildBezierMidPoint(prev, start, end, next, segmentIndex) {
  const control = {
    lat: start.lat + 0.25 * (next.lat - prev.lat),
    lon: start.lon + 0.25 * (next.lon - prev.lon)
  };

  const t = 0.5;
  const omt = 1 - t;
  const lat = omt * omt * start.lat + 2 * omt * t * control.lat + t * t * end.lat;
  const lon = omt * omt * start.lon + 2 * omt * t * control.lon + t * t * end.lon;

  const eleStart = Number.isFinite(Number(start.ele)) ? Number(start.ele) : 0;
  const eleEnd = Number.isFinite(Number(end.ele)) ? Number(end.ele) : eleStart;
  const time = new Date((start.time.getTime() + end.time.getTime()) / 2);

  return {
    id: `bezier-${segmentIndex}-${start.time.getTime()}-${end.time.getTime()}`,
    lat,
    lon,
    ele: (eleStart + eleEnd) / 2,
    time,
    isDwell: false,
    dwellMs: 0,
    speedKmh: 0
  };
}

function dedupeByTimeAndLocation(points) {
  const deduped = [];
  for (const point of points) {
    const last = deduped[deduped.length - 1];
    if (
      last &&
      last.time.getTime() === point.time.getTime() &&
      Math.abs(last.lat - point.lat) < COORD_EPSILON &&
      Math.abs(last.lon - point.lon) < COORD_EPSILON
    ) {
      continue;
    }
    deduped.push(point);
  }
  return deduped;
}

function annotateSpeed(points) {
  return points.map((point, index) => {
    if (index === 0) {
      return { ...point, speedKmh: 0 };
    }
    const prev = points[index - 1];
    const dtHours = (point.time - prev.time) / MS_PER_HOUR;
    const speedKmh = dtHours > 0 ? haversineKm(prev, point) / dtHours : 0;
    return { ...point, speedKmh };
  });
}

function renderTrack(points, options = {}) {
  const { centerOnFirst = false, preserveView = false } = options;
  const previousCenter = preserveView ? appState.map.getCenter() : null;
  const previousZoom = preserveView ? appState.map.getZoom() : null;

  appState.layers.track.clearLayers();
  appState.layers.points.clearLayers();
  appState.layers.transport.clearLayers();

  const latlngs = points.map((p) => [p.lat, p.lon]);

  const trackLine = L.polyline(latlngs, {
    color: '#22c55e',
    weight: 4,
    opacity: 0.8
  }).addTo(appState.layers.track);

  trackLine.on('click', (event) => {
    insertPointOnNearestSegment(event.latlng);
  });

  trackLine.on('mouseover', () => {
    appState.map.getContainer().style.cursor = 'crosshair';
  });

  trackLine.on('mouseout', () => {
    appState.map.getContainer().style.cursor = '';
  });

  const movementSegments = classifyMovementSegments(points);

  points.forEach((point, index) => {
    const size = point.isDwell ? calcDwellSize(point.dwellMs) : 10;
    const classNames = ['point-marker', point.isDwell ? 'dwell-marker' : ''].join(' ').trim();

    const marker = L.marker([point.lat, point.lon], {
      draggable: true,
      icon: L.divIcon({
        className: '',
        html: `<div class="${classNames}" style="width:${size}px;height:${size}px"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      })
    });

    marker.on('click', () => {
      hidePointContextMenu();
      selectMarker(marker, point);
      showPointInfo(point, index, movementSegments);
    });

    marker.on('contextmenu', (event) => {
      if (event.originalEvent) {
        event.originalEvent.preventDefault();
      }
      showPointContextMenu(event, index);
    });

    marker.on('dragstart', () => {
      hidePointContextMenu();
    });

    marker.on('dragend', (event) => {
      const latlng = event.target.getLatLng();
      movePointInTrack(index, latlng);
    });

    marker.addTo(appState.layers.points);
  });

  movementSegments.forEach((segment) => {
    const mid = midpoint(segment.start, segment.end);
    const icon = L.divIcon({
      className: '',
      html: `<div class="transport-icon" title="${segment.type}">${segment.emoji}</div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    L.marker([mid.lat, mid.lon], { icon }).addTo(appState.layers.transport);
  });

  const firstPoint = points[0];
  if (centerOnFirst && firstPoint) {
    appState.map.setView([firstPoint.lat, firstPoint.lon], appState.map.getZoom());
  } else if (preserveView && previousCenter && Number.isFinite(previousZoom)) {
    appState.map.setView(previousCenter, previousZoom, { animate: false });
  }
}

function insertPointOnNearestSegment(targetLatLng) {
  const points = appState.optimizedPoints;
  if (!points || points.length < 2) {
    return;
  }

  const segmentIndex = findNearestSegmentIndex(points, targetLatLng);
  if (segmentIndex < 0) {
    return;
  }

  const start = points[segmentIndex];
  const end = points[segmentIndex + 1];
  const projectedLatLng = projectLatLngToSegment(start, end, targetLatLng);
  const midTime = new Date((start.time.getTime() + end.time.getTime()) / 2);
  const startEle = Number.isFinite(Number(start.ele)) ? Number(start.ele) : 0;
  const endEle = Number.isFinite(Number(end.ele)) ? Number(end.ele) : startEle;

  const insertedPoint = {
    id: `insert-${Date.now()}-${segmentIndex}`,
    lat: projectedLatLng.lat,
    lon: projectedLatLng.lng,
    ele: (startEle + endEle) / 2,
    time: midTime,
    isDwell: false,
    dwellMs: 0,
    speedKmh: 0
  };

  const updated = points.slice();
  updated.splice(segmentIndex + 1, 0, insertedPoint);

  const reAnnotated = annotateSpeed(updated);
  appState.optimizedPoints = reAnnotated;
  renderTrack(reAnnotated, { preserveView: true });
  renderStats(appState.rawPoints.length ? appState.rawPoints : reAnnotated, reAnnotated);
  setStatus(`Point inserted between ${segmentIndex} and ${segmentIndex + 1}.`);
}

function movePointInTrack(index, latlng) {
  if (!Number.isInteger(index) || index < 0 || index >= appState.optimizedPoints.length) {
    return;
  }

  const updated = appState.optimizedPoints.map((point, pointIndex) => {
    if (pointIndex !== index) {
      return point;
    }
    return {
      ...point,
      lat: latlng.lat,
      lon: latlng.lng
    };
  });

  const reAnnotated = annotateSpeed(updated);
  appState.optimizedPoints = reAnnotated;
  renderTrack(reAnnotated, { preserveView: true });
  renderStats(appState.rawPoints.length ? appState.rawPoints : reAnnotated, reAnnotated);
  pointInfoEl.textContent = 'Point moved. Click a point on map to see GPS details.';
  setStatus(`Point ${index} moved.`);
}

function findNearestSegmentIndex(points, targetLatLng) {
  if (!points || points.length < 2) {
    return -1;
  }

  const target = appState.map.latLngToLayerPoint(targetLatLng);
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = appState.map.latLngToLayerPoint([points[i].lat, points[i].lon]);
    const b = appState.map.latLngToLayerPoint([points[i + 1].lat, points[i + 1].lon]);
    const distance = pointToSegmentDistance(target, a, b);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function projectLatLngToSegment(start, end, targetLatLng) {
  const target = appState.map.latLngToLayerPoint(targetLatLng);
  const a = appState.map.latLngToLayerPoint([start.lat, start.lon]);
  const b = appState.map.latLngToLayerPoint([end.lat, end.lon]);
  const projected = closestPointOnSegment(target, a, b);
  return appState.map.layerPointToLatLng(projected);
}

function pointToSegmentDistance(point, a, b) {
  const closest = closestPointOnSegment(point, a, b);
  const dx = point.x - closest.x;
  const dy = point.y - closest.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function closestPointOnSegment(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abLen2 = abx * abx + aby * aby;

  if (abLen2 === 0) {
    return { x: a.x, y: a.y };
  }

  const apx = point.x - a.x;
  const apy = point.y - a.y;
  let t = (apx * abx + apy * aby) / abLen2;
  t = Math.max(0, Math.min(1, t));

  return {
    x: a.x + abx * t,
    y: a.y + aby * t
  };
}

function showPointContextMenu(event, pointIndex) {
  appState.contextMenuPointIndex = pointIndex;
  const originalEvent = event.originalEvent;
  if (!originalEvent) {
    return;
  }

  const x = originalEvent.clientX;
  const y = originalEvent.clientY;
  pointContextMenuEl.style.left = `${x}px`;
  pointContextMenuEl.style.top = `${y}px`;
  pointContextMenuEl.hidden = false;
}

function hidePointContextMenu() {
  appState.contextMenuPointIndex = -1;
  pointContextMenuEl.hidden = true;
}

function removePointFromTrack(index) {
  if (!Number.isInteger(index) || index < 0 || index >= appState.optimizedPoints.length) {
    return;
  }

  if (appState.optimizedPoints.length <= 2) {
    setStatus('Cannot remove point: at least 2 points are required.');
    return;
  }

  const updated = appState.optimizedPoints.filter((_, pointIndex) => pointIndex !== index);
  const reAnnotated = annotateSpeed(updated);

  appState.optimizedPoints = reAnnotated;
  renderTrack(reAnnotated, { preserveView: true });
  renderStats(appState.rawPoints.length ? appState.rawPoints : reAnnotated, reAnnotated);
  pointInfoEl.textContent = 'Point removed. Click a point on map to see GPS details.';
  setStatus(`Point ${index} removed.`);
}

function classifyMovementSegments(points) {
  const segments = [];
  for (let i = 1; i < points.length; i += 1) {
    const start = points[i - 1];
    const end = points[i];
    const distanceKm = haversineKm(start, end);
    const dtHours = (end.time - start.time) / MS_PER_HOUR;
    const speed = dtHours > 0 ? distanceKm / dtHours : 0;
    if (distanceKm >= settings.flightDistanceKm || speed >= settings.flightSpeedKmh) {
      segments.push({
        start,
        end,
        distanceKm,
        speed,
        type: 'flight',
        emoji: '✈️'
      });
    }
  }
  return segments;
}

function showPointInfo(point, index, movementSegments) {
  const nearestSegment = movementSegments[index - 1] || movementSegments[index] || null;
  pointInfoEl.innerHTML = [
    `<div><strong>Index:</strong> ${index}</div>`,
    `<div><strong>Time:</strong> ${point.time.toISOString()}</div>`,
    `<div><strong>Latitude:</strong> ${point.lat.toFixed(6)}</div>`,
    `<div><strong>Longitude:</strong> ${point.lon.toFixed(6)}</div>`,
    `<div><strong>Elevation:</strong> ${Number(point.ele || 0).toFixed(1)} m</div>`,
    `<div><strong>Speed:</strong> ${point.speedKmh.toFixed(1)} km/h</div>`,
    `<div><strong>Dwell:</strong> ${point.isDwell ? formatDuration(point.dwellMs) : 'No'}</div>`,
    `<div><strong>Movement:</strong> ${nearestSegment ? nearestSegment.type : 'N/A'}</div>`
  ].join('');
}

function selectMarker(marker, point) {
  if (appState.selectedMarker) {
    const oldNode = appState.selectedMarker.getElement()?.firstChild;
    if (oldNode) {
      oldNode.classList.remove('selected-marker');
    }
  }
  appState.selectedMarker = marker;
  const node = marker.getElement()?.firstChild;
  if (node) {
    node.classList.add('selected-marker');
  }

  marker.bindPopup(`<strong>${point.time.toISOString()}</strong><br>${point.lat.toFixed(6)}, ${point.lon.toFixed(6)}`).openPopup();
}

function renderStats(rawPoints, optimizedPoints) {
  const totalDistanceKm = totalDistance(optimizedPoints);
  const durationMs = optimizedPoints[optimizedPoints.length - 1].time - optimizedPoints[0].time;
  const avgSpeed = durationMs > 0 ? totalDistanceKm / (durationMs / MS_PER_HOUR) : 0;
  const maxSpeed = optimizedPoints.reduce((max, p) => Math.max(max, p.speedKmh || 0), 0);
  const dwellCount = optimizedPoints.filter((p) => p.isDwell).length;

  const row = (label, value) =>
    `<div class="stat-row"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>`;

  statsEl.innerHTML = [
    row('Raw points', rawPoints.length),
    row('Optimized points', optimizedPoints.length),
    row('Distance', `${totalDistanceKm.toFixed(2)} km`),
    row('Duration', formatDuration(durationMs)),
    row('Avg speed', `${avgSpeed.toFixed(2)} km/h`),
    row('Max speed', `${maxSpeed.toFixed(2)} km/h`),
    row(`Stay > ${(settings.dwellMinMs / MS_PER_HOUR).toFixed(1)}hr`, dwellCount)
  ].join('');
}

function serializeTrkpt(p) {
  return `      <trkpt lat="${p.lat}" lon="${p.lon}">\n        <ele>${Number(p.ele || 0)}</ele>\n        <time>${p.time.toISOString()}</time>\n      </trkpt>`;
}

function exportGpx(points, sourceFileName) {
  const safeName = sourceFileName.replace(/\.[^.]+$/, '');
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="GPXViewer" xmlns="http://www.topografix.com/GPX/1/1">\n  <trk>\n    <name>${escapeXml(safeName)}-optimized</name>\n    <trkseg>\n${points.map(serializeTrkpt).join('\n')}\n    </trkseg>\n  </trk>\n</gpx>`;

  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}-optimized.gpx`;
  a.click();
  URL.revokeObjectURL(url);
}

function totalDistance(points) {
  let sum = 0;
  for (let i = 1; i < points.length; i += 1) {
    sum += haversineKm(points[i - 1], points[i]);
  }
  return sum;
}

function calcDwellSize(dwellMs) {
  const minSize = 16;
  const maxSize = 34;
  const maxHours = 24;
  const hours = Math.min(dwellMs / MS_PER_HOUR, maxHours);
  return minSize + ((maxSize - minSize) * hours) / maxHours;
}

function midpoint(a, b) {
  return { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = degToRad(b.lat - a.lat);
  const dLon = degToRad(b.lon - a.lon);
  const lat1 = degToRad(a.lat);
  const lat2 = degToRad(b.lat);

  const sinSqSum =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(sinSqSum), Math.sqrt(1 - sinSqSum));
  return R * c;
}

function haversineMeters(a, b) {
  return haversineKm(a, b) * METERS_PER_KM;
}

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) {
    return '0m';
  }
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (days) {
    parts.push(`${days}d`);
  }
  if (hours || days) {
    parts.push(`${hours}h`);
  }
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function copyMapToClipboard() {
  const mapContainer = appState.map.getContainer();
  const canvases = Array.from(mapContainer.querySelectorAll('canvas'));

  if (!canvases.length) {
    setStatus('Nothing to capture: no map canvas found.');
    return;
  }

  const ref = canvases[0];
  const width = ref.width;
  const height = ref.height;

  const composite = document.createElement('canvas');
  composite.width = width;
  composite.height = height;
  const ctx = composite.getContext('2d');

  for (const canvas of canvases) {
    try {
      ctx.drawImage(canvas, 0, 0, width, height);
    } catch {
      // skip tainted layer (should not occur with crossOrigin: 'anonymous')
    }
  }

  composite.toBlob(async (blob) => {
    if (!blob) {
      setStatus('Map capture failed.');
      return;
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setStatus(`Map view copied to clipboard (${width}×${height}px).`);
    } catch (err) {
      setStatus(`Copy failed: ${err.message}`);
    }
  }, 'image/png');
}

function setStatus(message) {
  if (statusBarEl) {
    statusBarEl.textContent = message;
  }
  const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.textContent = `${time} — ${message}`;
  logEl.insertBefore(entry, logEl.firstChild);
  while (logEl.children.length > 50) {
    logEl.removeChild(logEl.lastChild);
  }
}
