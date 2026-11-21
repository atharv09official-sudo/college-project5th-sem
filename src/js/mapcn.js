/**
 * mapcn - Modern MapLibre GL UI Component for HETVAYA FlowGrid
 * Inspired by AnmolSaini16/mapcn (shadcn/ui for Maps)
 * Features: Dark-mode vector tiles, custom shadcn DOM markers, glowing GeoJSON route lines,
 * 3D pitch controls, interactive popups, and smooth camera animations.
 */

import * as maplibregl from 'maplibre-gl';
const { Map, Marker, Popup, LngLatBounds } = maplibregl;

// Dark basemap style (CARTO Dark Matter - Fast, reliable, zero API key)
const CARTO_DARK_STYLE = {
    version: 8,
    name: 'Carto Dark Matter',
    sources: {
        'carto-dark': {
            type: 'raster',
            tiles: [
                'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }
    },
    layers: [
        {
            id: 'carto-dark-tiles',
            type: 'raster',
            source: 'carto-dark',
            minzoom: 0,
            maxzoom: 20
        }
    ]
};

// Fallback dark style for offline or slow network conditions
const FALLBACK_DARK_STYLE = {
    version: 8,
    name: 'Fallback Dark',
    sources: {},
    layers: [
        {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#0d0e12' }
        }
    ]
};

export class MapCN {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.options = Object.assign({
            center: [74.45, 18.65], // Maharashtra freight center
            zoom: 6.8,
            pitch: 28, // 3D perspective pitch
            bearing: -5,
            interactive: true
        }, options);

        this.map = null;
        this.markers = [];
        this.popups = [];
        this.nodes = [];
        this.corridors = [];
        this.currentOriginId = null;
        this.currentDestId = null;
        this.is3D = true;
    }

    async init() {
        if (!this.container) return null;

        return new Promise((resolve) => {
            try {
                this.map = new maplibregl.Map({
                    container: this.containerId,
                    style: CARTO_DARK_STYLE,
                    center: this.options.center,
                    zoom: this.options.zoom,
                    pitch: this.options.pitch,
                    bearing: this.options.bearing,
                    attributionControl: false
                });

                this.map.on('load', () => {
                    this.initLayers();
                    this.addCustomControls();
                    resolve(this.map);
                });

                this.map.on('error', (e) => {
                    console.warn('[mapcn] Map error, falling back to local dark style:', e);
                    try {
                        this.map.setStyle(FALLBACK_DARK_STYLE);
                    } catch (err) { }
                });
            } catch (err) {
                console.error('[mapcn] Failed to initialize MapLibre GL:', err);
                resolve(null);
            }
        });
    }

    initLayers() {
        if (!this.map) return;

        // 1. Corridors GeoJSON Source (Base Road Network)
        if (!this.map.getSource('network-corridors')) {
            this.map.addSource('network-corridors', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });

            this.map.addLayer({
                id: 'network-corridors-glow',
                type: 'line',
                source: 'network-corridors',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': '#38bdf8',
                    'line-width': 3,
                    'line-opacity': 0.15,
                    'line-blur': 2
                }
            });

            this.map.addLayer({
                id: 'network-corridors-line',
                type: 'line',
                source: 'network-corridors',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': '#ffffff',
                    'line-width': 1.2,
                    'line-opacity': 0.22,
                    'line-dasharray': [2, 2]
                }
            });
        }

        // 2. Alternative Routes Source & Layer
        if (!this.map.getSource('alt-routes')) {
            this.map.addSource('alt-routes', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });

            this.map.addLayer({
                id: 'alt-routes-line',
                type: 'line',
                source: 'alt-routes',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': ['get', 'color'],
                    'line-width': 3,
                    'line-opacity': 0.65,
                    'line-dasharray': [4, 3]
                }
            });
        }

        // 3. Recommended Route Source & Glow Casing Layers
        if (!this.map.getSource('recommended-route')) {
            this.map.addSource('recommended-route', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });

            // Outer Neon Glow
            this.map.addLayer({
                id: 'recommended-route-glow',
                type: 'line',
                source: 'recommended-route',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': '#6366f1',
                    'line-width': 10,
                    'line-opacity': 0.45,
                    'line-blur': 4
                }
            });

            // Core Line
            this.map.addLayer({
                id: 'recommended-route-core',
                type: 'line',
                source: 'recommended-route',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': '#818cf8',
                    'line-width': 4.5,
                    'line-opacity': 0.95
                }
            });

            // Ghat Hazard Segments Overlay
            this.map.addLayer({
                id: 'recommended-route-ghats',
                type: 'line',
                source: 'recommended-route',
                filter: ['==', ['get', 'is_ghat'], true],
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': '#f59e0b',
                    'line-width': 6,
                    'line-opacity': 0.85
                }
            });
        }
    }

    addCustomControls() {
        if (!this.container) return;

        // Custom shadcn/ui glass controls overlay
        const controlWrapper = document.createElement('div');
        controlWrapper.className = 'absolute top-3 right-3 z-20 flex flex-col gap-1.5 pointer-events-auto';
        controlWrapper.innerHTML = `
            <div class="flex flex-col rounded-lg bg-[#121214]/85 backdrop-blur-md border border-white/10 shadow-xl overflow-hidden divide-y divide-white/5 font-mono text-xs">
                <button id="mapcn-zoom-in" title="Zoom In" class="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                </button>
                <button id="mapcn-zoom-out" title="Zoom Out" class="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path></svg>
                </button>
                <button id="mapcn-pitch-toggle" title="Toggle 3D / 2D Perspective" class="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-indigo-400 hover:bg-white/10 transition text-[10px] font-bold">
                    3D
                </button>
                <button id="mapcn-recenter" title="Recenter Corridors" class="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-emerald-400 hover:bg-white/10 transition">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                </button>
            </div>
        `;

        this.container.appendChild(controlWrapper);

        // Control listeners
        document.getElementById('mapcn-zoom-in')?.addEventListener('click', () => {
            this.map?.zoomIn({ duration: 300 });
        });
        document.getElementById('mapcn-zoom-out')?.addEventListener('click', () => {
            this.map?.zoomOut({ duration: 300 });
        });
        document.getElementById('mapcn-pitch-toggle')?.addEventListener('click', () => {
            this.is3D = !this.is3D;
            this.map?.easeTo({
                pitch: this.is3D ? 35 : 0,
                duration: 600
            });
            const btn = document.getElementById('mapcn-pitch-toggle');
            if (btn) btn.textContent = this.is3D ? '3D' : '2D';
        });
        document.getElementById('mapcn-recenter')?.addEventListener('click', () => {
            this.resetView();
        });
    }

    setNetwork(nodes, corridors) {
        this.nodes = nodes || [];
        this.corridors = corridors || [];

        // Build GeoJSON LineStrings for base corridors
        const features = [];
        this.corridors.forEach((c) => {
            const u = this.nodes.find(n => n.id === c.from_node);
            const v = this.nodes.find(n => n.id === c.to_node);
            if (u && v) {
                features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: [[u.lng, u.lat], [v.lng, v.lat]]
                    },
                    properties: {
                        corridor_id: c.corridor_id,
                        highway: c.highway_code,
                        distance_km: c.distance_km,
                        is_ghat: c.is_ghat_section
                    }
                });
            }
        });

        const source = this.map?.getSource('network-corridors');
        if (source) {
            source.setData({ type: 'FeatureCollection', features });
        }

        this.renderMarkers();
    }

    renderMarkers() {
        if (!this.map) return;

        // Clear existing markers
        this.markers.forEach(m => m.remove());
        this.markers = [];

        this.nodes.forEach(node => {
            const isOrigin = this.currentOriginId === node.id;
            const isDest = this.currentDestId === node.id;
            const isGhat = node.name.toLowerCase().includes('ghat') || node.id.includes('KASARA') || node.id.includes('KHANDALA');

            const el = document.createElement('div');
            el.className = 'mapcn-marker group cursor-pointer relative';

            if (isOrigin) {
                el.innerHTML = `
                    <div class="relative flex items-center justify-center">
                        <span class="absolute w-8 h-8 rounded-full bg-emerald-500/30 animate-ping"></span>
                        <div class="w-6 h-6 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-lg shadow-emerald-500/50 border-2 border-white text-xs font-bold z-10">
                            ▲
                        </div>
                        <div class="absolute left-7 px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/40 text-[10px] font-mono font-bold text-emerald-300 shadow-md whitespace-nowrap z-20">
                            ${node.name.split(' ')[0]} (Origin)
                        </div>
                    </div>
                `;
            } else if (isDest) {
                el.innerHTML = `
                    <div class="relative flex items-center justify-center">
                        <span class="absolute w-8 h-8 rounded-full bg-rose-500/30 animate-ping"></span>
                        <div class="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/50 border-2 border-white text-xs font-bold z-10">
                            ●
                        </div>
                        <div class="absolute left-7 px-2 py-0.5 rounded bg-rose-950/90 border border-rose-500/40 text-[10px] font-mono font-bold text-rose-300 shadow-md whitespace-nowrap z-20">
                            ${node.name.split(' ')[0]} (Dest)
                        </div>
                    </div>
                `;
            } else if (isGhat) {
                el.innerHTML = `
                    <div class="relative flex items-center justify-center">
                        <div class="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center text-[9px] text-amber-300">
                            ⚠
                        </div>
                        <div class="hidden group-hover:block absolute left-5 px-1.5 py-0.5 rounded bg-black/80 border border-amber-500/30 text-[9px] font-mono text-amber-300 whitespace-nowrap z-20">
                            ${node.name}
                        </div>
                    </div>
                `;
            } else {
                el.innerHTML = `
                    <div class="relative flex items-center justify-center">
                        <div class="w-2.5 h-2.5 rounded-full bg-slate-400/60 border border-slate-200/40 hover:scale-150 hover:bg-indigo-400 transition-transform"></div>
                        <div class="hidden group-hover:block absolute left-4 px-1.5 py-0.5 rounded bg-[#121214]/90 border border-white/10 text-[9px] font-mono text-gray-200 whitespace-nowrap z-20">
                            ${node.name.split(' ')[0]}
                        </div>
                    </div>
                `;
            }

            // Shadcn Style Interactive Popup
            const popupHTML = `
                <div class="p-3 bg-[#121214]/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur-md text-xs font-sans min-w-[200px]">
                    <div class="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-white/10">
                        <span class="text-[10px] font-mono uppercase font-bold ${isOrigin ? 'text-emerald-400' : isDest ? 'text-rose-400' : isGhat ? 'text-amber-400' : 'text-indigo-400'}">
                            ${isOrigin ? 'Origin Terminal' : isDest ? 'Destination Terminal' : isGhat ? 'Ghat Corridor' : node.hub_type || 'Trade Hub'}
                        </span>
                        <span class="text-[9px] text-gray-500 font-mono">${node.id}</span>
                    </div>
                    <div class="font-bold text-white text-sm mb-0.5">${node.name}</div>
                    <div class="text-gray-400 text-xs mb-2">${node.city || 'Maharashtra'}, India</div>
                    <div class="grid grid-cols-2 gap-1 text-[10px] font-mono bg-white/5 p-1.5 rounded border border-white/5">
                        <div class="text-gray-400">Lat: <span class="text-white">${node.lat.toFixed(4)}</span></div>
                        <div class="text-gray-400">Lng: <span class="text-white">${node.lng.toFixed(4)}</span></div>
                    </div>
                </div>
            `;

            const popup = new maplibregl.Popup({
                offset: 14,
                closeButton: false,
                className: 'mapcn-shadcn-popup'
            }).setHTML(popupHTML);

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([node.lng, node.lat])
                .setPopup(popup)
                .addTo(this.map);

            this.markers.push(marker);
        });
    }

    highlightSelection(originId, destId) {
        this.currentOriginId = originId;
        this.currentDestId = destId;
        this.renderMarkers();

        // Fit camera to origin & destination
        const u = this.nodes.find(n => n.id === originId);
        const v = this.nodes.find(n => n.id === destId);
        if (u && v && this.map) {
            const bounds = new maplibregl.LngLatBounds();
            bounds.extend([u.lng, u.lat]);
            bounds.extend([v.lng, v.lat]);
            this.map.fitBounds(bounds, {
                padding: { top: 90, bottom: 90, left: 70, right: 70 },
                maxZoom: 9.5,
                duration: 900
            });
        }
    }

    setOptimizationRoutes(recommendedRoute, rankedRoutes = []) {
        if (!this.map) return;

        // 1. Render Recommended Route
        const recSource = this.map.getSource('recommended-route');
        if (recSource && recommendedRoute && recommendedRoute.waypoints) {
            const coords = recommendedRoute.waypoints.map(w => [w.lng, w.lat]);
            recSource.setData({
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: coords
                    },
                    properties: {
                        name: recommendedRoute.name,
                        distance_km: recommendedRoute.distance_km,
                        cost_inr: recommendedRoute.total_cost_inr
                    }
                }]
            });

            // Auto-fit bounds to recommended corridor
            if (coords.length > 1) {
                const bounds = new maplibregl.LngLatBounds();
                coords.forEach(coord => bounds.extend(coord));
                this.map.fitBounds(bounds, {
                    padding: { top: 80, bottom: 80, left: 60, right: 60 },
                    maxZoom: 10,
                    duration: 1100
                });
            }
        }

        // 2. Render Alternative Routes
        const altSource = this.map.getSource('alt-routes');
        if (altSource && Array.isArray(rankedRoutes)) {
            const altFeatures = [];
            const palette = ['#10b981', '#f59e0b', '#a855f7'];

            rankedRoutes.forEach((route, idx) => {
                if (route.is_recommended || !route.waypoints) return;
                altFeatures.push({
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: route.waypoints.map(w => [w.lng, w.lat])
                    },
                    properties: {
                        color: palette[idx % palette.length],
                        name: route.name,
                        distance_km: route.distance_km
                    }
                });
            });

            altSource.setData({
                type: 'FeatureCollection',
                features: altFeatures
            });
        }
    }

    selectCandidateRoute(route) {
        if (!this.map || !route || !route.waypoints) return;
        const recSource = this.map.getSource('recommended-route');
        if (recSource) {
            recSource.setData({
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: route.waypoints.map(w => [w.lng, w.lat])
                    },
                    properties: {
                        name: route.name,
                        distance_km: route.distance_km
                    }
                }]
            });

            const bounds = new maplibregl.LngLatBounds();
            route.waypoints.forEach(w => bounds.extend([w.lng, w.lat]));
            this.map.fitBounds(bounds, {
                padding: { top: 75, bottom: 75, left: 60, right: 60 },
                maxZoom: 10,
                duration: 800
            });
        }
    }

    resetView() {
        if (!this.map) return;
        this.map.easeTo({
            center: this.options.center,
            zoom: this.options.zoom,
            pitch: this.options.pitch,
            bearing: this.options.bearing,
            duration: 800
        });
    }

    resize() {
        this.map?.resize();
    }

    destroy() {
        this.markers.forEach(m => m.remove());
        this.markers = [];
        this.map?.remove();
        this.map = null;
    }
}
