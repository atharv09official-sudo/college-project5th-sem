/**
 * Global Risk & Trade Route Map (mapcn MapLibre GL Engine)
 * Features: High-performance vector tiles, dark glassmorphism styling,
 * curved great-circle shipping arcs, dynamic risk hotspots, mode selection (Sea, Air, Road),
 * physical connectivity & feasibility assessment, and instant output recalculation.
 */

import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getCountryCode, getCountryFlagHtml } from './country-flags.js';

const { Map, Marker, Popup, LngLatBounds } = maplibregl;

// 100% Free, reliable dark basemap styles (Esri World Dark Gray, Esri Satellite, OpenFreeMap Vector)
export const MAPCN_STYLES = {
    dark: {
        version: 8,
        name: 'esri-dark-gray',
        sources: {
            'esri-base': {
                type: 'raster',
                tiles: [
                    'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
                ],
                tileSize: 256,
                attribution: '&copy; Esri &copy; OpenStreetMap'
            },
            'esri-ref': {
                type: 'raster',
                tiles: [
                    'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}'
                ],
                tileSize: 256
            }
        },
        layers: [
            {
                id: 'background',
                type: 'background',
                paint: { 'background-color': '#09090b' }
            },
            {
                id: 'esri-base-layer',
                type: 'raster',
                source: 'esri-base',
                minzoom: 0,
                maxzoom: 18,
                paint: { 'raster-opacity': 0.95 }
            },
            {
                id: 'esri-ref-layer',
                type: 'raster',
                source: 'esri-ref',
                minzoom: 0,
                maxzoom: 18,
                paint: { 'raster-opacity': 0.8 }
            }
        ]
    },
    satellite: {
        version: 8,
        name: 'esri-satellite',
        sources: {
            'satellite-tiles': {
                type: 'raster',
                tiles: [
                    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                ],
                tileSize: 256,
                attribution: '&copy; Esri &copy; Maxar'
            }
        },
        layers: [
            {
                id: 'satellite-bg',
                type: 'background',
                paint: { 'background-color': '#000000' }
            },
            {
                id: 'satellite-layer',
                type: 'raster',
                source: 'satellite-tiles',
                minzoom: 0,
                maxzoom: 19
            }
        ]
    },
    vector: 'https://tiles.openfreemap.org/styles/dark'
};

// Major World Country Coordinates Dictionary
const COUNTRY_COORDS = {
    'India': [78.9629, 20.5937],
    'China': [104.1954, 35.8617],
    'United States': [-95.7129, 37.0902],
    'Germany': [10.4515, 51.1657],
    'Netherlands': [5.2913, 52.1326],
    'United Arab Emirates': [53.8478, 23.4241],
    'United Kingdom': [-3.4360, 55.3781],
    'Singapore': [103.8198, 1.3521],
    'Japan': [138.2529, 36.2048],
    'Australia': [133.7751, -25.2744],
    'Brazil': [-51.9253, -14.2350],
    'South Africa': [22.9375, -30.5595]
};

// Fallback global default shipping lanes
const DEFAULT_GLOBAL_LANES = [
    {
        id: 'LANE-IN-NL',
        from: 'India',
        to: 'Netherlands',
        startLng: 72.8777,
        startLat: 19.0760,
        endLng: 4.4777,
        endLat: 51.9244,
        preferred_mode: 'sea',
        riskLevel: 'Low',
        color: '#38bdf8',
        cost: 2850,
        days: 22.0
    },
    {
        id: 'LANE-SH-RTD',
        from: 'China',
        to: 'Netherlands',
        startLng: 121.4737,
        startLat: 31.2304,
        endLng: 4.4777,
        endLat: 51.9244,
        preferred_mode: 'sea',
        riskLevel: 'Medium',
        color: '#fbbf24',
        cost: 3850,
        days: 28.5
    },
    {
        id: 'LANE-MUM-DXB',
        from: 'India',
        to: 'United Arab Emirates',
        startLng: 72.8777,
        startLat: 19.0760,
        endLng: 55.2708,
        endLat: 25.2048,
        preferred_mode: 'sea',
        riskLevel: 'Low',
        color: '#34d399',
        cost: 1450,
        days: 4.2
    },
    {
        id: 'LANE-SIN-LAX',
        from: 'Singapore',
        to: 'United States',
        startLng: 103.8198,
        startLat: 1.3521,
        endLng: -118.2437,
        endLat: 34.0522,
        preferred_mode: 'sea',
        riskLevel: 'Low',
        color: '#38bdf8',
        cost: 4200,
        days: 19.0
    },
    {
        id: 'LANE-MUM-LON',
        from: 'India',
        to: 'United Kingdom',
        startLng: 72.8777,
        startLat: 19.0760,
        endLng: -0.1276,
        endLat: 51.5074,
        preferred_mode: 'air',
        riskLevel: 'Low',
        color: '#818cf8',
        cost: 6200,
        days: 1.5
    }
];

export class GlobalRiskMap {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.map = null;
        this.markers = [];
        this.hotspotMarkers = [];
        this.routes = [];
        this.activeRoute = null;
        this.selectedMode = 'all'; // 'all' | 'sea' | 'air' | 'road'
        this.currentScenario = 'base';
        this.currentStyleIndex = 0;
        this.styleKeys = ['dark', 'satellite', 'vector'];
        this.is3D = false;
        this.currentFeasibility = null;

        // Layer toggles
        this.layers = {
            activeRoutes: true,
            highRiskZones: true,
            portCongestion: false,
            weatherPatterns: false
        };
    }

    async init() {
        if (!this.container) return;

        // Initialize MapLibre GL with dark glass theme (single map, no duplicate wrapping)
        this.map = new Map({
            container: this.containerId,
            style: MAPCN_STYLES.dark,
            center: [30.0, 24.0],
            zoom: 2.3,
            minZoom: 1.5,
            maxZoom: 12,
            pitch: 0,
            bearing: 0,
            renderWorldCopies: false,
            maxBounds: [[-175, -80], [175, 80]],
            attributionControl: false
        });

        this.map.on('load', async () => {
            this.map.resize();
            this.addControls();
            this.setupLayers();
            await this.loadRouteData();
            this.setupEventListeners();
            this.setupSideWindows();
            this.setupCorridorControls();

            // Initial feasibility check for default India -> Netherlands
            this.checkFeasibility('India', 'Netherlands');
        });

        this.map.on('style.load', () => {
            this.setupLayers();
            this.renderRoutesOnMap();
        });

        window.addEventListener('resize', () => this.map?.resize());
    }

    addControls() {
        if (this.container.querySelector('#mapcn-controls')) return;

        const ctrl = document.createElement('div');
        ctrl.id = 'mapcn-controls';
        ctrl.className = 'absolute bottom-8 left-4 md:left-6 z-20 flex flex-col gap-1 bg-[#101012]/95 border border-white/20 rounded-[5px] p-1.5 shadow-2xl backdrop-blur-md';
        ctrl.innerHTML = `
            <button id="ctrl-zoom-in" title="Zoom In" class="w-8 h-8 rounded-[4px] border border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/15 flex items-center justify-center text-gray-300 hover:text-white transition font-mono font-bold text-sm active:scale-95 shadow-xs">＋</button>
            <button id="ctrl-zoom-out" title="Zoom Out" class="w-8 h-8 rounded-[4px] border border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/15 flex items-center justify-center text-gray-300 hover:text-white transition font-mono font-bold text-sm active:scale-95 shadow-xs">－</button>
            <div class="h-px bg-white/10 my-0.5"></div>
            <button id="ctrl-tilt" title="Toggle 3D Perspective" class="w-8 h-8 rounded-[4px] border border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/15 flex items-center justify-center text-gray-300 hover:text-indigo-400 transition text-[10px] font-mono font-bold active:scale-95 shadow-xs">3D</button>
            <button id="ctrl-compass" title="Reset North" class="w-8 h-8 rounded-[4px] border border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/15 flex items-center justify-center text-gray-300 hover:text-white transition text-xs font-mono active:scale-95 shadow-xs">🧭</button>
            <button id="ctrl-recenter" title="Fit All Corridors" class="w-8 h-8 rounded-[4px] border border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/15 flex items-center justify-center text-gray-300 hover:text-white transition text-xs font-mono active:scale-95 shadow-xs">🎯</button>
            <div class="h-px bg-white/10 my-0.5"></div>
            <button id="ctrl-style" title="Switch Basemap Style" class="w-8 h-8 rounded-[4px] border border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/15 flex items-center justify-center text-gray-300 hover:text-white transition text-xs font-mono font-bold active:scale-95 shadow-xs">🗺️</button>
        `;
        this.container.appendChild(ctrl);

        document.getElementById('ctrl-zoom-in')?.addEventListener('click', () => this.map.zoomIn({ duration: 300 }));
        document.getElementById('ctrl-zoom-out')?.addEventListener('click', () => this.map.zoomOut({ duration: 300 }));
        document.getElementById('ctrl-tilt')?.addEventListener('click', () => {
            this.is3D = !this.is3D;
            this.map.easeTo({
                pitch: this.is3D ? 45 : 0,
                bearing: this.is3D ? -15 : 0,
                duration: 600
            });
            const btn = document.getElementById('ctrl-tilt');
            if (btn) btn.classList.toggle('text-indigo-400', this.is3D);
        });
        document.getElementById('ctrl-compass')?.addEventListener('click', () => {
            this.map.easeTo({ bearing: 0, pitch: 0, duration: 400 });
        });
        document.getElementById('ctrl-recenter')?.addEventListener('click', () => this.fitAllRoutes());
        document.getElementById('ctrl-style')?.addEventListener('click', () => this.cycleBasemapStyle());
    }

    cycleBasemapStyle() {
        this.currentStyleIndex = (this.currentStyleIndex + 1) % this.styleKeys.length;
        const key = this.styleKeys[this.currentStyleIndex];
        const style = MAPCN_STYLES[key];
        if (style) {
            this.map.setStyle(style);
        }
    }

    setupLayers() {
        if (!this.map.getSource('global-routes-src')) {
            this.map.addSource('global-routes-src', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });
        }

        if (!this.map.getLayer('global-routes-casing')) {
            this.map.addLayer({
                id: 'global-routes-casing',
                type: 'line',
                source: 'global-routes-src',
                layout: {
                    'line-cap': 'round',
                    'line-join': 'round'
                },
                paint: {
                    'line-color': '#000000',
                    'line-width': ['interpolate', ['linear'], ['zoom'], 2, 5.0, 6, 9.0],
                    'line-opacity': 0.8
                }
            });
        }

        if (!this.map.getLayer('global-routes-line')) {
            this.map.addLayer({
                id: 'global-routes-line',
                type: 'line',
                source: 'global-routes-src',
                layout: {
                    'line-cap': 'round',
                    'line-join': 'round'
                },
                paint: {
                    'line-color': ['get', 'color'],
                    'line-width': ['interpolate', ['linear'], ['zoom'], 2, 3.2, 6, 6.5],
                    'line-opacity': 0.95
                }
            });
        }

        this.map.on('click', 'global-routes-line', (e) => {
            if (e.features && e.features.length > 0) {
                const props = e.features[0].properties;
                const matched = this.routes.find(r => r.id === props.id || r.name === props.name);
                if (matched) {
                    this.selectRoute(matched);
                }
            }
        });

        this.map.on('mouseenter', 'global-routes-line', () => {
            this.map.getCanvas().style.cursor = 'pointer';
        });
        this.map.on('mouseleave', 'global-routes-line', () => {
            this.map.getCanvas().style.cursor = '';
        });
    }

    createArcCoordinates(start, end, numPoints = 50) {
        const [lng1, lat1] = start;
        const [lng2, lat2] = end;
        const coords = [];

        const midLng = (lng1 + lng2) / 2;
        const midLat = (lat1 + lat2) / 2;
        const dLng = lng2 - lng1;
        const dLat = lat2 - lat1;
        const dist = Math.sqrt(dLng * dLng + dLat * dLat);

        const curve = Math.min(dist * 0.16, 15);
        const normalLng = -dLat / (dist || 1);
        const normalLat = dLng / (dist || 1);

        const ctrlLng = midLng + normalLng * curve;
        const ctrlLat = midLat + normalLat * curve;

        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const x = (1 - t) * (1 - t) * lng1 + 2 * (1 - t) * t * ctrlLng + t * t * lng2;
            const y = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * ctrlLat + t * t * lat2;
            coords.push([x, y]);
        }
        return coords;
    }

    async loadRouteData() {
        const routesList = [];

        // 1. Check local storage for recent route context
        let context = null;
        try {
            context = JSON.parse(localStorage.getItem('current_route_context') || 'null');
        } catch (e) {
            context = null;
        }

        let liveAnalysis = null;
        if (context && context.from && context.to) {
            try {
                const res = await fetch('/api/analyze-shipment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        from_country: context.from,
                        to_country: context.to,
                        currency: 'USD',
                        preferred_mode: context.preferred_mode || 'sea'
                    })
                });
                if (res.ok) liveAnalysis = await res.json();
            } catch (e) {
                console.warn('Live analysis fallback:', e);
            }
        }

        if (liveAnalysis && liveAnalysis.coordinates) {
            const riskTier = liveAnalysis.risk_summary?.combined_level || 'Low';
            const color = riskTier === 'High' ? '#f43f5e' : riskTier === 'Medium' ? '#fbbf24' : '#38bdf8';
            const liveRoute = {
                id: 'LIVE-ROUTE',
                name: `${liveAnalysis.from} ➔ ${liveAnalysis.to}`,
                from: liveAnalysis.from,
                to: liveAnalysis.to,
                startLng: liveAnalysis.coordinates.start[1],
                startLat: liveAnalysis.coordinates.start[0],
                endLng: liveAnalysis.coordinates.end[1],
                endLat: liveAnalysis.coordinates.end[0],
                preferred_mode: context?.preferred_mode || 'sea',
                riskLevel: riskTier,
                color: color,
                analysisData: liveAnalysis
            };
            routesList.push(liveRoute);
            this.activeRoute = liveRoute;
        }

        // 2. Saved Allocated Routes
        try {
            const rawAllocated = JSON.parse(localStorage.getItem('allocated_routes') || '[]');
            rawAllocated.forEach(r => {
                if (r.fromCoords && r.toCoords) {
                    routesList.push({
                        id: r.id || `ALLOC-${Math.random().toString(36).substr(2, 6)}`,
                        name: `${r.from} ➔ ${r.to}`,
                        from: r.from,
                        to: r.to,
                        startLng: r.fromCoords[1],
                        startLat: r.fromCoords[0],
                        endLng: r.toCoords[1],
                        endLat: r.toCoords[0],
                        preferred_mode: r.mode || 'sea',
                        riskLevel: r.riskLevel || 'Low',
                        color: r.riskLevel === 'High' ? '#f43f5e' : r.riskLevel === 'Medium' ? '#fbbf24' : '#38bdf8',
                        cost: r.cost,
                        days: r.estimated_days
                    });
                }
            });
        } catch (e) {
            console.warn('Error reading allocated_routes:', e);
        }

        // 3. API Routes
        try {
            const res = await fetch('/api/routes');
            if (res.ok) {
                const apiRoutes = await res.json();
                apiRoutes.forEach(r => {
                    if (r.startLat && r.endLat) {
                        const isDuplicate = routesList.some(ex =>
                            Math.abs(ex.startLat - r.startLat) < 0.1 && Math.abs(ex.endLat - r.endLat) < 0.1
                        );
                        if (!isDuplicate) {
                            routesList.push({
                                id: r.id || `API-${r.from}-${r.to}`,
                                name: `${r.from} ➔ ${r.to}`,
                                from: r.from,
                                to: r.to,
                                startLng: r.startLng,
                                startLat: r.startLat,
                                endLng: r.endLng,
                                endLat: r.endLat,
                                preferred_mode: r.mode || 'sea',
                                riskLevel: r.risk_level || 'Low',
                                color: r.color || (r.risk_level === 'High' ? '#f43f5e' : r.risk_level === 'Medium' ? '#fbbf24' : '#38bdf8'),
                                cost: r.cost,
                                days: r.transit_days
                            });
                        }
                    }
                });
            }
        } catch (e) {
            console.warn('API routes error:', e);
        }

        if (routesList.length === 0) {
            DEFAULT_GLOBAL_LANES.forEach(lane => routesList.push(lane));
        }

        this.routes = routesList;
        if (!this.activeRoute && this.routes.length > 0) {
            this.activeRoute = this.routes[0];
        }

        const badge = document.getElementById('active-routes-count');
        if (badge) badge.textContent = `${this.routes.length} Active`;

        this.renderRoutesOnMap();
        this.renderHubMarkers();
        this.renderHotspots();

        if (this.activeRoute) {
            this.selectRoute(this.activeRoute);
        } else {
            this.fitAllRoutes();
        }
    }

    renderRoutesOnMap() {
        if (!this.map || !this.map.getSource('global-routes-src')) return;

        const features = [];
        if (this.layers.activeRoutes) {
            this.routes.forEach(route => {
                // Filter by mode if specific mode selected
                if (this.selectedMode !== 'all' && route.preferred_mode !== this.selectedMode) {
                    return;
                }

                const isSelected = this.activeRoute && (this.activeRoute.id === route.id || this.activeRoute.name === route.name);
                const arcCoords = this.createArcCoordinates(
                    [route.startLng, route.startLat],
                    [route.endLng, route.endLat]
                );

                let lineColor = isSelected ? '#818cf8' : route.color;
                if (this.selectedMode === 'sea') lineColor = '#38bdf8';
                else if (this.selectedMode === 'air') lineColor = '#818cf8';
                else if (this.selectedMode === 'road') lineColor = '#34d399';

                features.push({
                    type: 'Feature',
                    properties: {
                        id: route.id,
                        name: route.name,
                        color: lineColor,
                        selected: isSelected
                    },
                    geometry: {
                        type: 'LineString',
                        coordinates: arcCoords
                    }
                });
            });
        }

        this.map.getSource('global-routes-src').setData({
            type: 'FeatureCollection',
            features
        });
    }

    renderHubMarkers() {
        this.markers.forEach(m => m.remove());
        this.markers = [];

        this.routes.forEach(route => {
            if (this.selectedMode !== 'all' && route.preferred_mode !== this.selectedMode) return;

            const isSelected = this.activeRoute && (this.activeRoute.id === route.id || this.activeRoute.name === route.name);

            // Origin Marker
            const originEl = document.createElement('div');
            originEl.className = 'group cursor-pointer pointer-events-auto transform transition-transform hover:scale-105';
            originEl.innerHTML = `
                <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[#101012]/95 border ${isSelected ? 'border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)] ring-1 ring-indigo-400/50' : 'border-white/20'} shadow-2xl text-[11px] font-mono font-bold text-white backdrop-blur-md">
                    <span class="w-1.5 h-1.5 rounded-[2px] ${isSelected ? 'bg-indigo-400 animate-ping' : 'bg-indigo-500'}"></span>
                    <span class="truncate max-w-[110px]">${route.from}</span>
                </div>
            `;
            originEl.onclick = () => this.selectRoute(route);

            const mOrigin = new Marker({ element: originEl, anchor: 'bottom' })
                .setLngLat([route.startLng, route.startLat])
                .addTo(this.map);
            this.markers.push(mOrigin);

            // Destination Marker
            const destEl = document.createElement('div');
            destEl.className = 'group cursor-pointer pointer-events-auto transform transition-transform hover:scale-105';
            destEl.innerHTML = `
                <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[#101012]/95 border ${isSelected ? 'border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.5)] ring-1 ring-emerald-400/50' : 'border-white/20'} shadow-2xl text-[11px] font-mono font-bold text-white backdrop-blur-md">
                    <span class="w-1.5 h-1.5 rounded-[2px] ${isSelected ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-500'}"></span>
                    <span class="truncate max-w-[110px]">${route.to}</span>
                </div>
            `;
            destEl.onclick = () => this.selectRoute(route);

            const mDest = new Marker({ element: destEl, anchor: 'bottom' })
                .setLngLat([route.endLng, route.endLat])
                .addTo(this.map);
            this.markers.push(mDest);
        });
    }

    renderHotspots() {
        this.hotspotMarkers.forEach(m => m.remove());
        this.hotspotMarkers = [];

        if (!this.layers.highRiskZones) return;

        const hotspots = [
            { name: 'Red Sea / Bab-el-Mandeb Chokepoint', lng: 43.33, lat: 12.58, risk: 8.8, note: 'Naval escort required • High missile advisory' },
            { name: 'Strait of Malacca Congestion', lng: 101.2, lat: 2.8, risk: 6.4, note: 'High vessel density & shallow draft constraints' },
            { name: 'Panama Canal Draft Restriction', lng: -79.9, lat: 9.1, risk: 7.2, note: 'Drought-induced reservation quotas active' },
            { name: 'English Channel Winter Gale', lng: 0.5, lat: 50.2, risk: 5.6, note: 'Seasonal rough swell delays feeder vessels' }
        ];

        hotspots.forEach(h => {
            const el = document.createElement('div');
            el.className = 'cursor-pointer pointer-events-auto group';
            el.innerHTML = `
                <div class="relative flex items-center justify-center">
                    <span class="absolute w-5 h-5 rounded-[4px] bg-rose-500/25 animate-ping"></span>
                    <div class="w-4 h-4 rounded-[3px] bg-rose-600 border border-white/60 shadow-lg flex items-center justify-center text-white text-[9px] font-mono font-bold">!</div>
                </div>
            `;

            const popup = new Popup({ offset: 15, closeButton: false, className: 'mapcn-dark-popup' })
                .setHTML(`
                    <div class="p-2.5 max-w-xs font-sans text-gray-200">
                        <div class="text-[10px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1">
                            <span>⚠️ Risk Bottleneck</span>
                            <span class="ml-auto font-mono text-xs text-rose-300">${h.risk} / 10</span>
                        </div>
                        <div class="font-bold text-xs text-white mt-1">${h.name}</div>
                        <div class="text-[11px] text-gray-400 mt-0.5 leading-relaxed">${h.note}</div>
                    </div>
                `);

            const marker = new Marker({ element: el, anchor: 'center' })
                .setLngLat([h.lng, h.lat])
                .setPopup(popup)
                .addTo(this.map);

            this.hotspotMarkers.push(marker);
        });
    }

    selectRoute(route) {
        this.activeRoute = route;
        this.renderRoutesOnMap();
        this.renderHubMarkers();
        this.hydrateIntelPanel(route);

        // Sync selectors in Left Panel
        const selOrigin = document.getElementById('corridor-origin');
        const selDest = document.getElementById('corridor-dest');
        if (selOrigin && route.from) {
            let found = Array.from(selOrigin.options).some(o => o.value.toLowerCase() === route.from.toLowerCase());
            if (!found) {
                const opt = document.createElement('option');
                opt.value = route.from;
                opt.textContent = route.from;
                selOrigin.appendChild(opt);
            }
            selOrigin.value = route.from;
        }
        if (selDest && route.to) {
            let found = Array.from(selDest.options).some(o => o.value.toLowerCase() === route.to.toLowerCase());
            if (!found) {
                const opt = document.createElement('option');
                opt.value = route.to;
                opt.textContent = route.to;
                selDest.appendChild(opt);
            }
            selDest.value = route.to;
        }

        // Run feasibility check on this corridor
        this.checkFeasibility(route.from, route.to);

        // Smooth camera fly-to fit route bounds
        const bounds = new LngLatBounds();
        bounds.extend([route.startLng, route.startLat]);
        bounds.extend([route.endLng, route.endLat]);

        this.map.fitBounds(bounds, {
            padding: { top: 120, bottom: 80, left: 360, right: 460 },
            maxZoom: 6.5,
            duration: 1200
        });
    }

    fitAllRoutes() {
        if (!this.routes || this.routes.length === 0) return;
        const bounds = new LngLatBounds();
        this.routes.forEach(r => {
            bounds.extend([r.startLng, r.startLat]);
            bounds.extend([r.endLng, r.endLat]);
        });
        this.map.fitBounds(bounds, {
            padding: { top: 100, bottom: 80, left: 360, right: 440 },
            maxZoom: 5,
            duration: 1000
        });
    }

    async checkFeasibility(fromCountry, toCountry) {
        const badgeEl = document.getElementById('feasibility-badge');
        const indEl = document.getElementById('feasibility-indicator-text');
        const notesEl = document.getElementById('feasibility-notes');

        if (indEl) indEl.textContent = 'Analyzing connectivity...';

        try {
            const res = await fetch(`/api/mode-feasibility?from=${encodeURIComponent(fromCountry)}&to=${encodeURIComponent(toCountry)}`);
            if (res.ok) {
                const data = await res.json();
                this.currentFeasibility = data.feasibility;
                this.updateFeasibilityUI(data.feasibility, fromCountry, toCountry);
                return data;
            }
        } catch (e) {
            console.warn('Feasibility API call error, using client estimation:', e);
        }

        // Client Fallback Logic
        const isIsland = ['Japan', 'Australia', 'United Kingdom'].includes(fromCountry) || ['Japan', 'Australia', 'United Kingdom'].includes(toCountry);
        const isCrossOcean = (fromCountry === 'United States' && toCountry !== 'Brazil') || (toCountry === 'United States' && fromCountry !== 'Brazil');

        const clientFeas = {
            sea: { feasible: true, reason: 'Maritime deep-sea container network active.' },
            air: { feasible: true, reason: 'International direct air freight accessible.' },
            road: {
                feasible: !isIsland && !isCrossOcean,
                reason: (!isIsland && !isCrossOcean)
                    ? 'Contiguous continental highway network accessible.'
                    : 'Separated by oceanic body; contiguous trucking physically impossible.'
            }
        };

        this.currentFeasibility = clientFeas;
        this.updateFeasibilityUI(clientFeas, fromCountry, toCountry);
        return { feasibility: clientFeas };
    }

    updateFeasibilityUI(feas, fromCountry, toCountry) {
        const badgeEl = document.getElementById('feasibility-badge');
        const indEl = document.getElementById('feasibility-indicator-text');
        const notesEl = document.getElementById('feasibility-notes');

        const bSea = document.getElementById('badge-mode-sea');
        const bAir = document.getElementById('badge-mode-air');
        const bRoad = document.getElementById('badge-mode-road');

        if (bSea) bSea.className = `absolute -top-1 -right-1 w-2 h-2 rounded-[2px] border border-[#121214] ${feas.sea?.feasible ? 'bg-emerald-400' : 'bg-rose-500'}`;
        if (bAir) bAir.className = `absolute -top-1 -right-1 w-2 h-2 rounded-[2px] border border-[#121214] ${feas.air?.feasible ? 'bg-emerald-400' : 'bg-rose-500'}`;
        if (bRoad) bRoad.className = `absolute -top-1 -right-1 w-2 h-2 rounded-[2px] border border-[#121214] ${feas.road?.feasible ? 'bg-emerald-400' : 'bg-rose-500'}`;

        if (this.selectedMode === 'road' && !feas.road?.feasible) {
            if (badgeEl) {
                badgeEl.textContent = 'ROAD INFEASIBLE';
                badgeEl.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded-[3px] bg-rose-500/15 text-rose-400 border border-rose-500/30';
            }
            if (indEl) indEl.textContent = '❌ Contiguity Blocked';
            if (notesEl) notesEl.innerHTML = `<span class="text-rose-400 font-semibold">${feas.road?.reason || 'Oceanic barrier blocks road freight.'}</span> Recommended: Switch to Sea (Container) or Air Cargo.`;
        } else if (this.selectedMode === 'sea' && !feas.sea?.feasible) {
            if (badgeEl) {
                badgeEl.textContent = 'SEA INFEASIBLE';
                badgeEl.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded-[3px] bg-rose-500/15 text-rose-400 border border-rose-500/30';
            }
            if (indEl) indEl.textContent = '❌ Maritime Infeasible';
            if (notesEl) notesEl.innerHTML = `<span class="text-rose-400 font-semibold">${feas.sea?.reason}</span>`;
        } else {
            if (badgeEl) {
                badgeEl.textContent = 'CORRIDOR VERIFIED';
                badgeEl.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded-[3px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30';
            }
            if (indEl) indEl.textContent = '✅ Verified Physical Corridor';
            const activeReason = this.selectedMode === 'road' ? feas.road?.reason : this.selectedMode === 'air' ? feas.air?.reason : feas.sea?.reason;
            if (notesEl) notesEl.textContent = activeReason || 'Maritime shipping, air cargo, and multimodal connectivity verified.';
        }
    }

    async recalculateOutput() {
        const selOrigin = document.getElementById('corridor-origin');
        const selDest = document.getElementById('corridor-dest');
        const btnCalc = document.getElementById('btn-recalculate-route');
        const btnText = document.getElementById('calc-btn-text');
        const btnIcon = document.getElementById('calc-btn-icon');

        const from = selOrigin.value;
        const to = selDest.value;

        if (from === to) {
            alert('Origin and Destination cannot be the same terminal.');
            return;
        }

        if (btnText) btnText.textContent = 'Evaluating physical connectivity...';
        if (btnIcon) btnIcon.textContent = '⏳';
        if (btnCalc) btnCalc.disabled = true;

        try {
            // Check Feasibility first
            const feasData = await this.checkFeasibility(from, to);

            // Fetch live analysis & recalculation
            const res = await fetch('/api/analyze-shipment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from_country: from,
                    to_country: to,
                    preferred_mode: this.selectedMode === 'all' ? 'sea' : this.selectedMode,
                    currency: 'USD'
                })
            });

            if (res.ok) {
                const liveData = await res.json();
                const startCoords = liveData.coordinates?.start || [20.59, 78.96];
                const endCoords = liveData.coordinates?.end || [52.13, 5.29];

                const riskTier = liveData.risk_summary?.combined_level || 'Low';
                const chosenMode = this.selectedMode === 'all' ? 'sea' : this.selectedMode;

                let modeCost = 3100;
                let modeDays = 14;
                if (liveData.analysis && liveData.analysis[chosenMode]) {
                    modeCost = liveData.analysis[chosenMode].cost_usd || liveData.analysis[chosenMode].cost;
                    modeDays = liveData.analysis[chosenMode].estimated_days;
                }

                const newRoute = {
                    id: `RECALC-${from.substr(0, 3)}-${to.substr(0, 3)}`,
                    name: `${from} ➔ ${to}`,
                    from: from,
                    to: to,
                    startLng: startCoords[1],
                    startLat: startCoords[0],
                    endLng: endCoords[1],
                    endLat: endCoords[0],
                    preferred_mode: chosenMode,
                    riskLevel: riskTier,
                    color: chosenMode === 'sea' ? '#38bdf8' : chosenMode === 'air' ? '#818cf8' : '#34d399',
                    cost: modeCost,
                    days: modeDays,
                    analysisData: liveData
                };

                // Add or replace in routes list
                const existingIdx = this.routes.findIndex(r => r.from === from && r.to === to);
                if (existingIdx >= 0) {
                    this.routes[existingIdx] = newRoute;
                } else {
                    this.routes.unshift(newRoute);
                }

                this.selectRoute(newRoute);
            }
        } catch (err) {
            console.error('Recalculation error:', err);
        } finally {
            if (btnText) btnText.textContent = 'Check Feasibility & Recalculate';
            if (btnIcon) btnIcon.textContent = '⚡';
            if (btnCalc) btnCalc.disabled = false;
        }
    }

    hydrateIntelPanel(route) {
        const panel = document.getElementById('route-intel-panel');
        if (!panel) return;
        if (this.openRightPanel) {
            this.openRightPanel();
        } else {
            panel.classList.remove('hidden');
        }

        const fromFlag = getCountryFlagHtml(route.from) || '';
        const toFlag = getCountryFlagHtml(route.to) || '';
        const titleEl = document.getElementById('route-intel-title');
        if (titleEl) {
            titleEl.innerHTML = `<span class="inline-flex items-center gap-1">${fromFlag}<span>${route.from}</span></span><span class="text-indigo-400 mx-1">➔</span><span class="inline-flex items-center gap-1">${toFlag}<span>${route.to}</span></span>`;
        }

        // Risk Pill
        const pill = document.getElementById('route-intel-risk-pill');
        const level = route.riskLevel || 'Low';
        pill.textContent = `RISK: ${level.toUpperCase()}`;
        if (level === 'High') {
            pill.className = 'px-2.5 py-0.5 rounded-[3px] border border-rose-500/40 text-xs font-mono font-bold text-rose-400 bg-rose-500/15 shadow-xs whitespace-nowrap';
        } else if (level === 'Medium') {
            pill.className = 'px-2.5 py-0.5 rounded-[3px] border border-amber-500/40 text-xs font-mono font-bold text-amber-400 bg-amber-500/15 shadow-xs whitespace-nowrap';
        } else {
            pill.className = 'px-2.5 py-0.5 rounded-[3px] border border-emerald-500/40 text-xs font-mono font-bold text-emerald-400 bg-emerald-500/15 shadow-xs whitespace-nowrap';
        }

        // Confidence
        const confVal = level === 'High' ? 88 : level === 'Medium' ? 92 : 96;
        document.getElementById('route-intel-confidence-label').textContent = `${confVal}%`;
        const confBar = document.getElementById('route-intel-confidence-bar');
        confBar.style.width = `${confVal}%`;
        confBar.className = level === 'High' ? 'h-full bg-rose-500 rounded-[2px]' : 'h-full bg-emerald-400 rounded-[2px]';

        // Telemetry Summary (Sharp Industrial Telemetry)
        const summaryEl = document.getElementById('route-intel-summary');
        const distKm = route.distanceKm ? Math.round(route.distanceKm).toLocaleString() + ' km' : 'Direct Multimodal';
        const startTerminal = route.startHub || `${route.from} Primary Hub`;
        const endTerminal = route.endHub || `${route.to} Gateway`;
        const riskIdx = level === 'High' ? '7.8' : level === 'Medium' ? '5.2' : '2.1';
        summaryEl.innerHTML = `
            <div class="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div>
                    <span class="text-gray-400 text-[10px] block">ORIGIN HUB</span>
                    <span class="text-white font-semibold truncate block">${startTerminal}</span>
                </div>
                <div>
                    <span class="text-gray-400 text-[10px] block">DESTINATION GATEWAY</span>
                    <span class="text-white font-semibold truncate block">${endTerminal}</span>
                </div>
                <div>
                    <span class="text-gray-400 text-[10px] block">CORRIDOR DISTANCE</span>
                    <span class="text-white font-semibold">${distKm}</span>
                </div>
                <div>
                    <span class="text-gray-400 text-[10px] block">COMPOSITE RISK INDEX</span>
                    <span class="${level === 'High' ? 'text-rose-400' : level === 'Medium' ? 'text-amber-400' : 'text-emerald-400'} font-bold">${riskIdx} / 10.0</span>
                </div>
            </div>
        `;

        // Render Mode Cards
        const modesEl = document.getElementById('route-intel-modes');
        modesEl.innerHTML = '';

        const baseModes = [
            { mode: 'sea', icon: '🚢', label: 'Sea Freight', cost: route.cost || 3400, days: route.days || 18, risk: level, desc: 'Container lane via deep-sea maritime channels.' },
            { mode: 'air', icon: '✈️', label: 'Air Cargo', cost: (route.cost ? route.cost * 2.4 : 7800), days: 2.5, risk: 'Low', desc: 'Direct scheduled international widebody freighter.' },
            { mode: 'road', icon: '🚚', label: 'Intermodal / Road', cost: (route.cost ? route.cost * 1.3 : 4200), days: (route.days ? route.days * 0.6 : 10), risk: 'Medium', desc: 'Overland trucking & rail transit where border contiguous.' }
        ];

        const scenario = this.currentScenario;
        baseModes.forEach(m => {
            let adjustedCost = m.cost;
            let adjustedDays = m.days;
            let adjustedRisk = m.risk;

            if (scenario === 'fuel') {
                adjustedCost = Math.round(m.cost * 1.10);
            } else if (scenario === 'weather') {
                if (m.mode === 'sea' || m.mode === 'air') {
                    adjustedDays = (m.days * 1.25).toFixed(1);
                    adjustedRisk = 'Medium';
                }
            } else if (scenario === 'sanctions') {
                adjustedRisk = 'High';
            }

            const isFeasible = this.currentFeasibility ? this.currentFeasibility[m.mode]?.feasible !== false : true;
            const isSelectedMode = route.preferred_mode === m.mode;

            const card = document.createElement('div');
            card.className = `p-3 rounded-[5px] border transition cursor-pointer active:scale-[0.99] shadow-xs ${
                !isFeasible
                    ? 'bg-rose-950/20 border-rose-500/30 opacity-60 text-gray-400'
                    : isSelectedMode
                    ? 'bg-indigo-950/50 border-indigo-500 ring-1 ring-indigo-500/50 text-white'
                    : 'bg-[#18181b] border-white/10 hover:bg-[#202024] hover:border-white/25 text-gray-300'
                }`;

            card.innerHTML = `
                <div class="flex items-center justify-between font-mono">
                    <div class="flex items-center gap-2">
                        <span class="text-base">${m.icon}</span>
                        <span class="text-xs font-bold text-white uppercase tracking-wider">${m.label}</span>
                    </div>
                    <div>
                        ${!isFeasible
                            ? '<span class="px-2 py-0.5 rounded-[3px] text-[9px] font-mono bg-rose-500/20 text-rose-300 font-bold tracking-wider border border-rose-500/40">BLOCKED</span>'
                            : isSelectedMode
                            ? '<span class="px-2 py-0.5 rounded-[3px] text-[9px] font-mono bg-indigo-600 text-white font-bold tracking-wider border border-indigo-400">ACTIVE</span>'
                            : ''}
                    </div>
                </div>
                <div class="flex items-center justify-between text-xs text-gray-300 mt-2 font-mono">
                    <span class="font-bold text-white">$${adjustedCost.toLocaleString()}</span>
                    <span>${adjustedDays} days</span>
                    <span class="font-bold ${adjustedRisk === 'High' ? 'text-rose-400' : adjustedRisk === 'Medium' ? 'text-amber-400' : 'text-emerald-400'}">${adjustedRisk}</span>
                </div>
                <div class="text-[11px] text-gray-400 mt-1 font-sans">${!isFeasible ? 'Physical barrier: Infeasible for selected corridor' : m.desc}</div>
            `;

            card.onclick = () => {
                if (!isFeasible) {
                    alert(`Selected mode (${m.label}) is physically infeasible for this corridor: ${this.currentFeasibility[m.mode]?.reason}`);
                    return;
                }
                this.selectedMode = m.mode;
                route.preferred_mode = m.mode;
                route.color = m.mode === 'sea' ? '#38bdf8' : m.mode === 'air' ? '#818cf8' : '#34d399';
                this.renderRoutesOnMap();
                this.hydrateIntelPanel(route);
            };

            modesEl.appendChild(card);
        });

        // Route optimization advisory text
        const captainEl = document.getElementById('route-intel-captain');
        captainEl.textContent = `Dispatch guidance: corridor ${route.from} ➔ ${route.to} committed via ${route.preferred_mode.toUpperCase()}. Estimated transit ~${route.days || 14}d under verified physical routing.`;
    }

    async setupCorridorControls() {
        const selOrigin = document.getElementById('corridor-origin');
        const selDest = document.getElementById('corridor-dest');
        const btnSwap = document.getElementById('btn-swap-corridor');
        const btnRecalc = document.getElementById('btn-recalculate-route');

        // Dynamically populate countries list if available
        try {
            const res = await fetch('/api/countries');
            if (res.ok) {
                const list = await res.json();
                if (Array.isArray(list) && list.length > 0 && selOrigin && selDest) {
                    const curOrig = selOrigin.value || 'India';
                    const curDest = selDest.value || 'Netherlands';
                    selOrigin.innerHTML = '';
                    selDest.innerHTML = '';
                    list.forEach(c => {
                        const o1 = document.createElement('option');
                        o1.value = c;
                        o1.textContent = c;
                        if (c === curOrig) o1.selected = true;
                        selOrigin.appendChild(o1);

                        const o2 = document.createElement('option');
                        o2.value = c;
                        o2.textContent = c;
                        if (c === curDest) o2.selected = true;
                        selDest.appendChild(o2);
                    });
                }
            }
        } catch (e) {
            console.warn('Could not load countries for corridor dropdown:', e);
        }

        // Mode Selection Buttons
        document.querySelectorAll('[data-mode-btn]').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.getAttribute('data-mode-btn');
                this.selectedMode = mode;

                // Toggle active styling
                document.querySelectorAll('[data-mode-btn]').forEach(b => {
                    const isActive = b === btn;
                    b.classList.toggle('bg-indigo-600', isActive);
                    b.classList.toggle('text-white', isActive);
                    b.classList.toggle('border-indigo-500', isActive);
                    b.classList.toggle('shadow-lg', isActive);
                    b.classList.toggle('bg-[#18181b]', !isActive);
                    b.classList.toggle('text-gray-300', !isActive);
                    b.classList.toggle('border-white/10', !isActive);
                });

                // Update feasibility explanation and map
                const from = selOrigin.value;
                const to = selDest.value;
                this.checkFeasibility(from, to);
                this.renderRoutesOnMap();
                if (this.activeRoute) {
                    if (mode !== 'all') this.activeRoute.preferred_mode = mode;
                    this.hydrateIntelPanel(this.activeRoute);
                }
            });
        });

        // Origin / Dest Change
        const onLocationChange = () => {
            this.checkFeasibility(selOrigin.value, selDest.value);
        };
        selOrigin?.addEventListener('change', onLocationChange);
        selDest?.addEventListener('change', onLocationChange);

        // Swap Origin & Destination
        btnSwap?.addEventListener('click', () => {
            const tmp = selOrigin.value;
            selOrigin.value = selDest.value;
            selDest.value = tmp;
            onLocationChange();
        });

        // Recalculate Output Button
        btnRecalc?.addEventListener('click', () => {
            this.recalculateOutput();
        });
    }

    setupSideWindows() {
        const leftPanel = document.getElementById('left-panel-container');
        const leftToggle = document.getElementById('btn-toggle-left-panel');
        const leftClose = document.getElementById('btn-close-left-panel');
        const leftBackdrop = document.getElementById('left-panel-backdrop');
        const leftIcon = document.getElementById('left-toggle-icon');

        const rightPanel = document.getElementById('route-intel-panel');
        const rightToggle = document.getElementById('btn-toggle-right-panel');
        const rightClose = document.getElementById('btn-close-intel-panel');
        const rightBackdrop = document.getElementById('right-panel-backdrop');
        const rightIcon = document.getElementById('right-toggle-icon');

        this.openLeftPanel = () => {
            if (!leftPanel) return;
            leftPanel.classList.remove('hidden');
            leftToggle?.setAttribute('aria-expanded', 'true');
            if (leftIcon) leftIcon.textContent = '▼';
            if (leftToggle) leftToggle.classList.add('border-indigo-500', 'bg-indigo-950/40');
            if (window.innerWidth < 768 && leftBackdrop) {
                leftBackdrop.classList.remove('hidden');
            }
        };

        this.closeLeftPanel = () => {
            if (!leftPanel) return;
            leftPanel.classList.add('hidden');
            leftToggle?.setAttribute('aria-expanded', 'false');
            if (leftIcon) leftIcon.textContent = '▶';
            if (leftToggle) leftToggle.classList.remove('border-indigo-500', 'bg-indigo-950/40');
            if (leftBackdrop) leftBackdrop.classList.add('hidden');
        };

        this.toggleLeftPanel = () => {
            if (!leftPanel) return;
            if (leftPanel.classList.contains('hidden')) {
                this.openLeftPanel();
            } else {
                this.closeLeftPanel();
            }
        };

        this.openRightPanel = () => {
            if (!rightPanel) return;
            rightPanel.classList.remove('hidden');
            rightToggle?.setAttribute('aria-expanded', 'true');
            if (rightIcon) rightIcon.textContent = '▼';
            if (rightToggle) rightToggle.classList.add('border-emerald-500', 'bg-emerald-950/40');
            if (window.innerWidth < 768 && rightBackdrop) {
                rightBackdrop.classList.remove('hidden');
            }
        };

        this.closeRightPanel = () => {
            if (!rightPanel) return;
            rightPanel.classList.add('hidden');
            rightToggle?.setAttribute('aria-expanded', 'false');
            if (rightIcon) rightIcon.textContent = '◀';
            if (rightToggle) rightToggle.classList.remove('border-emerald-500', 'bg-emerald-950/40');
            if (rightBackdrop) rightBackdrop.classList.add('hidden');
        };

        this.toggleRightPanel = () => {
            if (!rightPanel) return;
            if (rightPanel.classList.contains('hidden')) {
                this.openRightPanel();
            } else {
                this.closeRightPanel();
            }
        };

        // Attach event listeners
        leftToggle?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleLeftPanel();
        });
        leftClose?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeLeftPanel();
        });
        leftBackdrop?.addEventListener('click', () => this.closeLeftPanel());

        rightToggle?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleRightPanel();
        });
        rightClose?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeRightPanel();
        });
        rightBackdrop?.addEventListener('click', () => this.closeRightPanel());

        // Escape key dismisses open panels
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeLeftPanel();
                this.closeRightPanel();
            }
        });
    }

    setupEventListeners() {
        // Layer Toggles
        document.querySelectorAll('[data-layer]').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const layerKey = e.target.getAttribute('data-layer');
                this.layers[layerKey] = e.target.checked;

                if (layerKey === 'activeRoutes') this.renderRoutesOnMap();
                if (layerKey === 'highRiskZones') this.renderHotspots();
            });
        });

        // Scenario Buttons
        document.querySelectorAll('[data-scenario]').forEach(btn => {
            btn.addEventListener('click', () => {
                const scen = btn.getAttribute('data-scenario');
                this.currentScenario = scen;

                document.querySelectorAll('[data-scenario]').forEach(b => {
                    b.classList.toggle('bg-indigo-600', b === btn);
                    b.classList.toggle('text-white', b === btn);
                    b.classList.toggle('bg-white/5', b !== btn);
                    b.classList.toggle('text-gray-300', b !== btn);
                    b.classList.toggle('border-white/10', b !== btn);
                });

                const note = document.getElementById('route-intel-scenario-note');
                if (note) {
                    if (scen === 'base') note.textContent = 'Nominal operating conditions: standard bunker fuel rates and tariff schedules.';
                    if (scen === 'fuel') note.textContent = 'Simulated fuel shock: +10% bunker adjustment factor (BAF) across maritime and air modes.';
                    if (scen === 'weather') note.textContent = 'Severe weather disruption: +25% transit delay factored into maritime and air routes.';
                    if (scen === 'sanctions') note.textContent = 'Sanctions escalation: sovereign corridor restrictions and heightened customs scrutiny.';
                }

                if (this.activeRoute) {
                    this.hydrateIntelPanel(this.activeRoute);
                }
            });
        });

        // Timeline Slider
        const slider = document.getElementById('route-intel-timeline');
        const lbl = document.getElementById('route-intel-timeline-label');
        if (slider && lbl) {
            slider.addEventListener('input', () => {
                const v = parseInt(slider.value, 10);
                if (v === 0) lbl.textContent = 'Past 30d';
                else if (v === 1) lbl.textContent = 'Today';
                else lbl.textContent = 'Next 14d';
            });
        }
    }
}

// Auto-instantiate when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const map = new GlobalRiskMap('mapcn-global-map');
    map.init();
    window.globalMapCN = map;
});
