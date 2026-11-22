/**
 * mapcn - Modern MapLibre GL UI Component for HETVAYA FlowGrid
 * Inspired by AnmolSaini16/mapcn (shadcn/ui for Maps)
 * Features: Dark-mode vector tiles, custom shadcn DOM markers, glowing GeoJSON route lines,
 * 3D pitch controls, interactive popups, smooth camera animations, and robust 2D Canvas fallback.
 */

import * as maplibregl from 'maplibre-gl';
const { Map, Marker, Popup, LngLatBounds } = maplibregl;

// mapcn Base Styles: High-contrast Dark, Esri Satellite, and Clean Light
export const MAPCN_STYLES = {
    dark: {
        version: 8,
        name: 'mapcn-dark',
        sources: {
            'basemap-tiles': {
                type: 'raster',
                tiles: [
                    'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                    'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                    'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
                ],
                tileSize: 256,
                attribution: '&copy; CARTO &copy; OpenStreetMap'
            }
        },
        layers: [
            {
                id: 'background',
                type: 'background',
                paint: { 'background-color': '#0d0e12' }
            },
            {
                id: 'basemap-layer',
                type: 'raster',
                source: 'basemap-tiles',
                minzoom: 0,
                maxzoom: 20
            }
        ]
    },
    satellite: {
        version: 8,
        name: 'mapcn-satellite',
        sources: {
            'basemap-tiles': {
                type: 'raster',
                tiles: [
                    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                ],
                tileSize: 256,
                attribution: '&copy; Esri, Maxar, Earthstar'
            }
        },
        layers: [
            {
                id: 'background',
                type: 'background',
                paint: { 'background-color': '#000000' }
            },
            {
                id: 'basemap-layer',
                type: 'raster',
                source: 'basemap-tiles',
                minzoom: 0,
                maxzoom: 19
            }
        ]
    },
    light: {
        version: 8,
        name: 'mapcn-light',
        sources: {
            'basemap-tiles': {
                type: 'raster',
                tiles: [
                    'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                    'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
                ],
                tileSize: 256,
                attribution: '&copy; CARTO &copy; OpenStreetMap'
            }
        },
        layers: [
            {
                id: 'background',
                type: 'background',
                paint: { 'background-color': '#f8fafc' }
            },
            {
                id: 'basemap-layer',
                type: 'raster',
                source: 'basemap-tiles',
                minzoom: 0,
                maxzoom: 20
            }
        ]
    }
};

const MAPCN_DARK_STYLE = MAPCN_STYLES.dark;

function hasWebGL() {
    try {
        const c = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) {
        return false;
    }
}

export class MapCN {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.options = Object.assign({
            center: [74.45, 18.65], // Maharashtra freight center
            zoom: 6.8,
            pitch: 28,
            bearing: -5,
            interactive: true
        }, options);

        this.map = null;
        this.markers = [];
        this.nodes = [];
        this.corridors = [];
        this.currentOriginId = null;
        this.currentDestId = null;
        this.is3D = true;
        this.currentStyle = 'dark';
        this.routeBadgeMarker = null;
        this.cachedRecommended = null;
        this.cachedAlternatives = [];
        this.isFallback = false;
        this.fallbackCanvas = null;
        this.fallbackCtx = null;
    }

    async init() {
        if (!this.container) return null;

        // If WebGL is not available, launch high-performance 2D Canvas fallback directly
        if (!hasWebGL()) {
            console.warn('[mapcn] WebGL unsupported. Initializing 2D Canvas fallback.');
            this.init2DFallback();
            return null;
        }

        return new Promise((resolve) => {
            let settled = false;
            const complete = () => {
                if (settled) return;
                settled = true;
                try {
                    this.initLayers();
                    this.addCustomControls();
                } catch (e) {
                    console.warn('[mapcn] Post-init hook warning:', e);
                }
                resolve(this.map);
            };

            try {
                this.map = new Map({
                    container: this.containerId,
                    style: MAPCN_DARK_STYLE,
                    center: this.options.center,
                    zoom: this.options.zoom,
                    pitch: this.options.pitch,
                    bearing: this.options.bearing,
                    attributionControl: false,
                    trackResize: false // Prevent infinite ResizeObserver loop
                });

                this.map.on('load', complete);
                this.map.on('style.load', complete);

                this.map.on('error', (e) => {
                    console.warn('[mapcn] Tile warning (non-fatal):', e?.error?.message || e);
                });

                // Fail-safe timeout: never block app initialization longer than 700ms
                setTimeout(complete, 700);
            } catch (err) {
                console.warn('[mapcn] MapLibre GL failed to mount. Falling back to 2D Canvas:', err);
                this.init2DFallback();
                resolve(null);
            }
        });
    }

    init2DFallback() {
        this.isFallback = true;
        if (!this.container) return;
        this.container.innerHTML = '';

        this.fallbackCanvas = document.createElement('canvas');
        this.fallbackCanvas.style.width = '100%';
        this.fallbackCanvas.style.height = '100%';
        this.fallbackCanvas.style.display = 'block';
        this.container.appendChild(this.fallbackCanvas);
        this.fallbackCtx = this.fallbackCanvas.getContext('2d');

        const resize = () => {
            const rect = this.container.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            this.fallbackCanvas.width = rect.width * dpr;
            this.fallbackCanvas.height = rect.height * dpr;
            if (this.fallbackCtx) this.fallbackCtx.scale(dpr, dpr);
            this.render2DFallback();
        };

        resize();
        window.addEventListener('resize', resize);
    }

    initLayers() {
        if (!this.map) return;
        if (!this.map.isStyleLoaded()) {
            this.map.once('style.load', () => this.initLayers());
            return;
        }

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
                    'line-width': 9,
                    'line-opacity': 0.45,
                    'line-blur': 3
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
        }
    }

    addCustomControls() {
        if (!this.container || this.container.querySelector('#mapcn-controls-overlay')) return;

        const controlWrapper = document.createElement('div');
        controlWrapper.id = 'mapcn-controls-overlay';
        controlWrapper.className = 'absolute top-3 right-3 z-20 flex flex-col gap-1.5 pointer-events-auto';
        controlWrapper.innerHTML = `
            <div class="flex flex-col rounded-xl bg-[#121214]/90 backdrop-blur-md border border-white/10 shadow-2xl overflow-hidden divide-y divide-white/5 font-mono text-xs">
                <button id="mapcn-zoom-in" title="Zoom In" class="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                </button>
                <button id="mapcn-zoom-out" title="Zoom Out" class="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path></svg>
                </button>
                <button id="mapcn-pitch-toggle" title="Toggle 3D / 2D Perspective" class="w-8 h-8 flex items-center justify-center text-indigo-400 hover:text-indigo-300 hover:bg-white/10 transition text-[10px] font-bold">
                    3D
                </button>
                <button id="mapcn-compass" title="Reset North Orientation" class="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-sky-400 hover:bg-white/10 transition text-[11px]">
                    🧭
                </button>
                <button id="mapcn-style-toggle" title="Cycle Basemap (Dark / Sat / Light)" class="w-8 h-8 flex items-center justify-center text-amber-400 hover:text-amber-300 hover:bg-white/10 transition text-[9px] font-bold uppercase">
                    SAT
                </button>
                <button id="mapcn-recenter" title="Recenter Corridors" class="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-emerald-400 hover:bg-white/10 transition">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                </button>
                <button id="mapcn-fullscreen" title="Toggle Fullscreen" class="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                </button>
            </div>
        `;

        this.container.appendChild(controlWrapper);

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
        document.getElementById('mapcn-compass')?.addEventListener('click', () => {
            this.map?.easeTo({
                bearing: 0,
                pitch: this.is3D ? 35 : 0,
                duration: 500
            });
        });
        document.getElementById('mapcn-style-toggle')?.addEventListener('click', () => {
            this.cycleStyle();
        });
        document.getElementById('mapcn-recenter')?.addEventListener('click', () => {
            this.resetView();
        });
        document.getElementById('mapcn-fullscreen')?.addEventListener('click', () => {
            const wrapper = this.container.closest('.mapcn-container-wrapper') || this.container;
            if (!document.fullscreenElement) {
                wrapper.requestFullscreen?.().catch(() => {});
            } else {
                document.exitFullscreen?.().catch(() => {});
            }
        });
    }

    cycleStyle() {
        if (this.isFallback || !this.map) return;
        const styles = ['dark', 'satellite', 'light'];
        const labels = { dark: 'SAT', satellite: 'LGT', light: 'DRK' };
        const currentIdx = styles.indexOf(this.currentStyle);
        const nextStyle = styles[(currentIdx + 1) % styles.length];
        this.currentStyle = nextStyle;

        this.map.setStyle(MAPCN_STYLES[this.currentStyle]);
        this.map.once('style.load', () => {
            this.initLayers();
            if (this.nodes.length > 0) {
                this.setNetwork(this.nodes, this.corridors);
            }
            if (this.cachedRecommended) {
                this.setOptimizationRoutes(this.cachedRecommended, this.cachedAlternatives);
            }
        });

        const btn = document.getElementById('mapcn-style-toggle');
        if (btn) btn.textContent = labels[this.currentStyle] || 'STY';
    }

    setNetwork(nodes, corridors) {
        this.nodes = nodes || [];
        this.corridors = corridors || [];

        if (this.isFallback) {
            this.render2DFallback();
            return;
        }

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

        try {
            const source = this.map?.getSource('network-corridors');
            if (source) {
                source.setData({ type: 'FeatureCollection', features });
            }
        } catch (e) { }

        this.renderMarkers();
    }

    renderMarkers() {
        if (!this.map || this.isFallback) return;

        this.markers.forEach(m => m.remove());
        this.markers = [];

        this.nodes.forEach(node => {
            const isOrigin = this.currentOriginId === node.id;
            const isDest = this.currentDestId === node.id;
            const isGhat = (node.name || '').toLowerCase().includes('ghat') || (node.id || '').includes('KASARA') || (node.id || '').includes('KHANDALA');

            const el = document.createElement('div');
            el.className = 'mapcn-marker group cursor-pointer relative';

            if (isOrigin) {
                el.innerHTML = `
                    <div class="relative flex items-center justify-center">
                        <span class="absolute w-7 h-7 rounded-full bg-emerald-500/30 animate-ping pointer-events-none"></span>
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
                        <span class="absolute w-7 h-7 rounded-full bg-rose-500/30 animate-ping pointer-events-none"></span>
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
                        <div class="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center text-[9px] text-amber-300 font-bold">
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

            const popupHTML = `
                <div class="p-3 bg-[#121214]/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur-md text-xs font-sans min-w-[210px]">
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
                    <div class="mt-2.5 pt-2 border-t border-white/10 grid grid-cols-2 gap-1.5">
                        <button onclick="window.setAsOrigin && window.setAsOrigin('${node.id}')"
                            class="py-1 px-2 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono transition text-center font-bold">
                            ▲ Set Origin
                        </button>
                        <button onclick="window.setAsDestination && window.setAsDestination('${node.id}')"
                            class="py-1 px-2 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[10px] font-mono transition text-center font-bold">
                            ● Set Dest
                        </button>
                    </div>
                </div>
            `;

            const popup = new Popup({
                offset: 14,
                closeButton: false,
                className: 'mapcn-shadcn-popup'
            }).setHTML(popupHTML);

            const marker = new Marker({ element: el })
                .setLngLat([node.lng, node.lat])
                .setPopup(popup)
                .addTo(this.map);

            this.markers.push(marker);
        });
    }

    highlightSelection(originId, destId) {
        this.currentOriginId = originId;
        this.currentDestId = destId;

        if (this.isFallback) {
            this.render2DFallback();
            return;
        }

        this.renderMarkers();

        const u = this.nodes.find(n => n.id === originId);
        const v = this.nodes.find(n => n.id === destId);
        if (u && v && this.map) {
            try {
                const bounds = new LngLatBounds();
                bounds.extend([u.lng, u.lat]);
                bounds.extend([v.lng, v.lat]);
                this.map.fitBounds(bounds, {
                    padding: { top: 70, bottom: 70, left: 70, right: 70 },
                    maxZoom: 9.5,
                    duration: 800
                });
            } catch (e) { }
        }
    }

    setOptimizationRoutes(recommendedRoute, rankedRoutes = []) {
        this.cachedRecommended = recommendedRoute;
        this.cachedAlternatives = rankedRoutes;

        if (this.isFallback) {
            this.fallbackRecommended = recommendedRoute;
            this.fallbackAlternatives = rankedRoutes;
            this.render2DFallback();
            return;
        }

        if (!this.map) return;

        // 1. Recommended Route
        try {
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

                if (coords.length > 1) {
                    const bounds = new LngLatBounds();
                    coords.forEach(coord => bounds.extend(coord));
                    this.map.fitBounds(bounds, {
                        padding: { top: 75, bottom: 75, left: 60, right: 60 },
                        maxZoom: 10,
                        duration: 900
                    });

                    // Add dynamic route midpoint badge (signature @mapcn/map component)
                    if (this.routeBadgeMarker) {
                        this.routeBadgeMarker.remove();
                        this.routeBadgeMarker = null;
                    }
                    const midIdx = Math.floor(coords.length / 2);
                    const midCoord = coords[midIdx];
                    const badgeEl = document.createElement('div');
                    badgeEl.className = 'mapcn-route-badge pointer-events-auto cursor-pointer animate-fade-in';
                    badgeEl.innerHTML = `
                        <div class="px-2.5 py-1 rounded-full bg-[#121214]/95 border border-indigo-500/50 text-[11px] font-mono font-bold text-white shadow-2xl flex items-center gap-1.5 backdrop-blur-md hover:scale-105 transition-transform">
                            <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span>
                            <span class="text-indigo-300">⚡ ${recommendedRoute.distance_km ? recommendedRoute.distance_km.toFixed(0) : '--'} km</span>
                            <span class="text-gray-400">•</span>
                            <span class="text-sky-300">${recommendedRoute.travel_time_hours ? recommendedRoute.travel_time_hours.toFixed(1) : '--'} h</span>
                        </div>
                    `;
                    this.routeBadgeMarker = new Marker({ element: badgeEl, anchor: 'center' })
                        .setLngLat(midCoord)
                        .addTo(this.map);
                }
            }
        } catch (e) { }

        // 2. Alternative Routes
        try {
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
        } catch (e) { }
    }

    selectCandidateRoute(route) {
        if (this.isFallback) {
            this.fallbackRecommended = route;
            this.render2DFallback();
            return;
        }

        if (!this.map || !route || !route.waypoints) return;
        try {
            const recSource = this.map.getSource('recommended-route');
            if (recSource) {
                const coords = route.waypoints.map(w => [w.lng, w.lat]);
                recSource.setData({
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates: coords
                        },
                        properties: {
                            name: route.name,
                            distance_km: route.distance_km
                        }
                    }]
                });

                if (coords.length > 1) {
                    const bounds = new LngLatBounds();
                    coords.forEach(w => bounds.extend(w));
                    this.map.fitBounds(bounds, {
                        padding: { top: 75, bottom: 75, left: 60, right: 60 },
                        maxZoom: 10,
                        duration: 700
                    });

                    // Update midpoint badge
                    if (this.routeBadgeMarker) {
                        this.routeBadgeMarker.remove();
                        this.routeBadgeMarker = null;
                    }
                    const midIdx = Math.floor(coords.length / 2);
                    const midCoord = coords[midIdx];
                    const badgeEl = document.createElement('div');
                    badgeEl.className = 'mapcn-route-badge pointer-events-auto cursor-pointer animate-fade-in';
                    badgeEl.innerHTML = `
                        <div class="px-2.5 py-1 rounded-full bg-[#121214]/95 border border-indigo-500/50 text-[11px] font-mono font-bold text-white shadow-2xl flex items-center gap-1.5 backdrop-blur-md hover:scale-105 transition-transform">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                            <span class="text-indigo-300">⚡ ${route.distance_km ? route.distance_km.toFixed(0) : '--'} km</span>
                            <span class="text-gray-400">•</span>
                            <span class="text-sky-300">${route.travel_time_hours ? route.travel_time_hours.toFixed(1) : '--'} h</span>
                        </div>
                    `;
                    this.routeBadgeMarker = new Marker({ element: badgeEl, anchor: 'center' })
                        .setLngLat(midCoord)
                        .addTo(this.map);
                }
            }
        } catch (e) { }
    }

    resetView() {
        if (this.isFallback) return;
        this.map?.easeTo({
            center: this.options.center,
            zoom: this.options.zoom,
            pitch: this.options.pitch,
            bearing: this.options.bearing,
            duration: 800
        });
    }

    render2DFallback() {
        if (!this.fallbackCtx || !this.fallbackCanvas) return;
        const ctx = this.fallbackCtx;
        const w = this.fallbackCanvas.width / (window.devicePixelRatio || 1);
        const h = this.fallbackCanvas.height / (window.devicePixelRatio || 1);

        ctx.clearRect(0, 0, w, h);

        const minLat = 15.2, maxLat = 22.0;
        const minLng = 72.5, maxLng = 80.0;
        const pad = 45;
        const toXY = (lat, lng) => ({
            x: pad + ((lng - minLng) / (maxLng - minLng)) * (w - 2 * pad),
            y: h - (pad + ((lat - minLat) / (maxLat - minLat)) * (h - 2 * pad))
        });

        // Corridors
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        this.corridors.forEach(c => {
            const u = this.nodes.find(n => n.id === c.from_node);
            const v = this.nodes.find(n => n.id === c.to_node);
            if (u && v) {
                const p1 = toXY(u.lat, u.lng);
                const p2 = toXY(v.lat, v.lng);
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
            }
        });
        ctx.stroke();

        // Recommended route
        if (this.fallbackRecommended && this.fallbackRecommended.waypoints) {
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 4;
            ctx.beginPath();
            this.fallbackRecommended.waypoints.forEach((wp, idx) => {
                const pt = toXY(wp.lat, wp.lng);
                if (idx === 0) ctx.moveTo(pt.x, pt.y);
                else ctx.lineTo(pt.x, pt.y);
            });
            ctx.stroke();
        }

        // Nodes
        this.nodes.forEach(node => {
            const pt = toXY(node.lat, node.lng);
            const isOrigin = this.currentOriginId === node.id;
            const isDest = this.currentDestId === node.id;

            ctx.beginPath();
            ctx.fillStyle = isOrigin ? '#10b981' : isDest ? '#ef4444' : '#64748b';
            ctx.arc(pt.x, pt.y, isOrigin || isDest ? 6 : 3.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = isOrigin ? '#34d399' : isDest ? '#f87171' : '#94a3b8';
            ctx.font = '10px -apple-system, sans-serif';
            ctx.fillText(node.name.split(' ')[0], pt.x + 8, pt.y + 3);
        });
    }

    destroy() {
        if (this.routeBadgeMarker) {
            this.routeBadgeMarker.remove();
            this.routeBadgeMarker = null;
        }
        this.markers.forEach(m => m.remove());
        this.markers = [];
        this.map?.remove();
        this.map = null;
    }
}
