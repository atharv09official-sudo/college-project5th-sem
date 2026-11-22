/**
 * mapcn - Modern MapLibre GL UI Component for HETVAYA FlowGrid
 * Inspired by AnmolSaini16/mapcn (shadcn/ui for Maps)
 * Features: Dark-mode vector tiles, custom shadcn DOM markers, glowing GeoJSON route lines,
 * 3D pitch controls, interactive popups, smooth camera animations, and robust 2D Canvas fallback.
 */

import * as maplibregl from 'maplibre-gl';
const { Map, Marker, Popup, LngLatBounds } = maplibregl;

// Robust, 100% Free basemap styles: OpenFreeMap Dark vector, Esri Satellite, and Dark Invert OSM
export const MAPCN_FALLBACK_DARK_STYLE = {
    version: 8,
    name: 'mapcn-dark-fallback',
    sources: {
        'osm-tiles': {
            type: 'raster',
            tiles: [
                'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors'
        }
    },
    layers: [
        {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#0d0e12' }
        },
        {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19,
            paint: {
                'raster-opacity': 0.38,
                'raster-contrast': 0.25,
                'raster-brightness-max': 0.4
            }
        }
    ]
};

export const MAPCN_STYLES = {
    dark: 'https://tiles.openfreemap.org/styles/dark',
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
                attribution: '&copy; Esri &copy; Maxar'
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
    fallback: MAPCN_FALLBACK_DARK_STYLE
};

/**
 * Predefined Maharashtra & West-Central India Freight Corridors Coordinates Dictionary.
 * Guarantees zero geocoding latency, 100% offline accuracy, and failsafe map rendering without Google Maps API keys.
 */
export const PREDEFINED_MAHARASHTRA_COORDINATES = {
    'MUM_JNPT': { id: 'MUM_JNPT', name: 'JNPT Port (Nhava Sheva)', city: 'Navi Mumbai', state: 'Maharashtra', lat: 18.9499, lng: 72.9515, hub_type: 'PORT', defaultRole: 'warehouse', icon: '⚓' },
    'MUM_BHIWANDI': { id: 'MUM_BHIWANDI', name: 'Bhiwandi Central Mega Hub', city: 'Bhiwandi', state: 'Maharashtra', lat: 19.2813, lng: 73.0483, hub_type: 'LOGISTICS_HUB', defaultRole: 'warehouse', icon: '🏭' },
    'MUM_CENTRAL': { id: 'MUM_CENTRAL', name: 'Mumbai Central Distribution Node', city: 'Mumbai', state: 'Maharashtra', lat: 18.9696, lng: 72.8193, hub_type: 'URBAN_HUB', defaultRole: 'store', icon: '🏬' },
    'MUM_THANE': { id: 'MUM_THANE', name: 'Thane Freight Terminal', city: 'Thane', state: 'Maharashtra', lat: 19.2183, lng: 72.9781, hub_type: 'TRANSIT_JUNCTION', defaultRole: 'warehouse', icon: '🏭' },
    'MUM_PANVEL': { id: 'MUM_PANVEL', name: 'Panvel Expressway Gateway', city: 'Panvel', state: 'Maharashtra', lat: 18.9894, lng: 73.1175, hub_type: 'TRANSIT_JUNCTION', defaultRole: 'transit', icon: '🔄' },
    'KHANDALA': { id: 'KHANDALA', name: 'Khandala Western Ghat Summit', city: 'Khandala', state: 'Maharashtra', lat: 18.7610, lng: 73.3742, hub_type: 'GHAT_PASS', defaultRole: 'ghat', icon: '⛰️' },
    'LONAVALA': { id: 'LONAVALA', name: 'Lonavala Transit Node', city: 'Lonavala', state: 'Maharashtra', lat: 18.7557, lng: 73.4091, hub_type: 'TRANSIT_JUNCTION', defaultRole: 'transit', icon: '🔄' },
    'PUNE_CHAKAN': { id: 'PUNE_CHAKAN', name: 'Chakan Auto MIDC Hub', city: 'Pune', state: 'Maharashtra', lat: 18.7606, lng: 73.8636, hub_type: 'INDUSTRIAL_HUB', defaultRole: 'warehouse', icon: '🏭' },
    'PUNE_CITY': { id: 'PUNE_CITY', name: 'Pune Logistics Terminal (Hadapsar)', city: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567, hub_type: 'REGIONAL_HUB', defaultRole: 'store', icon: '🏬' },
    'SHIRWAL': { id: 'SHIRWAL', name: 'Shirwal MIDC Junction', city: 'Shirwal', state: 'Maharashtra', lat: 18.1364, lng: 73.9856, hub_type: 'TRANSIT_JUNCTION', defaultRole: 'transit', icon: '🔄' },
    'SATARA': { id: 'SATARA', name: 'Satara Southern Hub', city: 'Satara', state: 'Maharashtra', lat: 17.6805, lng: 74.0183, hub_type: 'REGIONAL_HUB', defaultRole: 'store', icon: '🏬' },
    'KARAD': { id: 'KARAD', name: 'Karad NH-48 Junction', city: 'Karad', state: 'Maharashtra', lat: 17.2885, lng: 74.1834, hub_type: 'TRANSIT_JUNCTION', defaultRole: 'transit', icon: '🔄' },
    'KOLHAPUR': { id: 'KOLHAPUR', name: 'Kolhapur Trade Terminal (Shiroli MIDC)', city: 'Kolhapur', state: 'Maharashtra', lat: 16.7050, lng: 74.2433, hub_type: 'BORDER_HUB', defaultRole: 'store', icon: '🏬' },
    'KASARA': { id: 'KASARA', name: 'Kasara Ghat Pass (Thal Ghat)', city: 'Kasara', state: 'Maharashtra', lat: 19.6543, lng: 73.4831, hub_type: 'GHAT_PASS', defaultRole: 'ghat', icon: '⛰️' },
    'IGATPURI': { id: 'IGATPURI', name: 'Igatpuri Mountain Hub', city: 'Igatpuri', state: 'Maharashtra', lat: 19.6967, lng: 73.5594, hub_type: 'TRANSIT_JUNCTION', defaultRole: 'transit', icon: '🔄' },
    'NASHIK': { id: 'NASHIK', name: 'Nashik Ambad MIDC Terminal', city: 'Nashik', state: 'Maharashtra', lat: 19.9975, lng: 73.7898, hub_type: 'REGIONAL_HUB', defaultRole: 'store', icon: '🏬' },
    'AHMEDNAGAR': { id: 'AHMEDNAGAR', name: 'Ahmednagar Central Junction', city: 'Ahmednagar', state: 'Maharashtra', lat: 19.0952, lng: 74.7496, hub_type: 'REGIONAL_HUB', defaultRole: 'transit', icon: '🔄' },
    'AURANGABAD': { id: 'AURANGABAD', name: 'Chhatrapati Sambhajinagar (Aurangabad DMIC)', city: 'Aurangabad', state: 'Maharashtra', lat: 19.8762, lng: 75.3433, hub_type: 'INDUSTRIAL_HUB', defaultRole: 'warehouse', icon: '🏭' },
    'JALNA': { id: 'JALNA', name: 'Jalna Dry Port & Steel Hub', city: 'Jalna', state: 'Maharashtra', lat: 19.8347, lng: 75.8816, hub_type: 'DRY_PORT', defaultRole: 'warehouse', icon: '🏭' },
    'SOLAPUR': { id: 'SOLAPUR', name: 'Solapur Textile Hub', city: 'Solapur', state: 'Maharashtra', lat: 17.6599, lng: 75.9064, hub_type: 'REGIONAL_HUB', defaultRole: 'store', icon: '🏬' },
    'NAGPUR': { id: 'NAGPUR', name: 'Nagpur MIHAN Multi-Modal Hub', city: 'Nagpur', state: 'Maharashtra', lat: 21.1458, lng: 79.0882, hub_type: 'NATIONAL_HUB', defaultRole: 'warehouse', icon: '🏭' },
    'SURAT': { id: 'SURAT', name: 'Surat Hazira Port Hub', city: 'Surat', state: 'Gujarat', lat: 21.1702, lng: 72.8311, hub_type: 'PORT', defaultRole: 'warehouse', icon: '⚓' },
    'AHMEDABAD': { id: 'AHMEDABAD', name: 'Ahmedabad Sanand Logistics Park', city: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714, hub_type: 'NATIONAL_HUB', defaultRole: 'warehouse', icon: '🏭' },
    'BELAGAVI': { id: 'BELAGAVI', name: 'Belagavi Karnataka Border Hub', city: 'Belagavi', state: 'Karnataka', lat: 15.8497, lng: 74.4977, hub_type: 'BORDER_HUB', defaultRole: 'store', icon: '🏬' },
    'GOA_MORMUGAO': { id: 'GOA_MORMUGAO', name: 'Mormugao Port (Goa)', city: 'Mormugao', state: 'Goa', lat: 15.4124, lng: 73.8052, hub_type: 'PORT', defaultRole: 'warehouse', icon: '⚓' }
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
        this._triedFallbackStyle = false;
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
                    const msg = e?.error?.message || String(e);
                    console.warn('[mapcn] Map warning:', msg);
                    // Automatic fail-over to zero-key dark canvas raster style if vector fails
                    if (!this.map.isStyleLoaded() && !this._triedFallbackStyle) {
                        this._triedFallbackStyle = true;
                        console.info('[mapcn] Switching to fallback dark style');
                        this.map.setStyle(MAPCN_FALLBACK_DARK_STYLE);
                    }
                });

                // Fail-safe timeout: 3500ms allows vector styles sufficient time to resolve
                setTimeout(complete, 3500);
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

    buildCorridorFeatures() {
        const features = [];
        this.corridors.forEach((c) => {
            const uObj = this.nodes.find(n => n.id === c.from_node);
            const vObj = this.nodes.find(n => n.id === c.to_node);
            const u = this.getNodeCoords(c.from_node, uObj);
            const v = this.getNodeCoords(c.to_node, vObj);
            if (u && v && typeof u.lat === 'number' && typeof v.lat === 'number') {
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
        return features;
    }

    getNodeCoords(nodeId, nodeObj = null) {
        if (nodeObj && typeof nodeObj.lat === 'number' && typeof nodeObj.lng === 'number' && !isNaN(nodeObj.lat) && !isNaN(nodeObj.lng)) {
            return {
                lat: nodeObj.lat,
                lng: nodeObj.lng,
                name: nodeObj.name || nodeId,
                city: nodeObj.city || '',
                hub_type: nodeObj.hub_type || 'HUB'
            };
        }
        const pre = PREDEFINED_MAHARASHTRA_COORDINATES[nodeId];
        if (pre) {
            return {
                lat: pre.lat,
                lng: pre.lng,
                name: pre.name,
                city: pre.city,
                hub_type: pre.hub_type
            };
        }
        return null;
    }

    initLayers() {
        if (!this.map) return;
        if (!this.map.isStyleLoaded()) {
            this.map.once('style.load', () => this.initLayers());
            return;
        }

        const corridorFeatures = this.buildCorridorFeatures();

        // 1. Corridors GeoJSON Source (Base Road Network)
        if (!this.map.getSource('network-corridors')) {
            this.map.addSource('network-corridors', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: corridorFeatures }
            });

            this.map.addLayer({
                id: 'network-corridors-glow',
                type: 'line',
                source: 'network-corridors',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': '#38bdf8',
                    'line-width': 3.5,
                    'line-opacity': 0.25,
                    'line-blur': 2
                }
            });

            this.map.addLayer({
                id: 'network-corridors-line',
                type: 'line',
                source: 'network-corridors',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': '#93c5fd',
                    'line-width': 1.6,
                    'line-opacity': 0.45,
                    'line-dasharray': [2, 2]
                }
            });
        } else {
            try {
                this.map.getSource('network-corridors').setData({
                    type: 'FeatureCollection',
                    features: corridorFeatures
                });
            } catch (e) { }
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
                    'line-width': 3.5,
                    'line-opacity': 0.8,
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
                    'line-opacity': 0.5,
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
                    'line-width': 5,
                    'line-opacity': 1.0
                }
            });
        }

        // Re-apply cached optimization routes if present
        if (this.cachedRecommended) {
            this.setOptimizationRoutes(this.cachedRecommended, this.cachedAlternatives);
        }

        // Re-render DOM markers
        if (this.nodes.length > 0) {
            this.renderMarkers();
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
        const styles = ['dark', 'satellite', 'fallback'];
        const labels = { dark: 'SAT', satellite: 'MIN', fallback: 'DRK' };
        const currentIdx = styles.indexOf(this.currentStyle);
        const nextStyle = styles[(currentIdx + 1) % styles.length];
        this.currentStyle = nextStyle;

        this.map.setStyle(MAPCN_STYLES[this.currentStyle]);
        this.map.once('style.load', () => {
            this.initLayers();
        });

        const btn = document.getElementById('mapcn-style-toggle');
        if (btn) btn.textContent = labels[this.currentStyle] || 'STY';
    }

    setNetwork(nodes, corridors) {
        const rawNodes = (nodes && nodes.length > 0) ? nodes : Object.values(PREDEFINED_MAHARASHTRA_COORDINATES);
        this.nodes = rawNodes.map(n => {
            const coords = this.getNodeCoords(n.id, n);
            return {
                ...n,
                lat: coords ? coords.lat : n.lat,
                lng: coords ? coords.lng : n.lng,
                hub_type: n.hub_type || (coords ? coords.hub_type : 'LOGISTICS_HUB')
            };
        });
        this.corridors = corridors || [];

        if (this.isFallback) {
            this.render2DFallback();
            return;
        }

        try {
            const source = this.map?.getSource('network-corridors');
            if (source) {
                source.setData({
                    type: 'FeatureCollection',
                    features: this.buildCorridorFeatures()
                });
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
            const isPort = (node.hub_type === 'PORT') || (node.id || '').includes('JNPT') || (node.id || '').includes('MORMUGAO') || (node.id || '').includes('SURAT');

            const el = document.createElement('div');
            el.className = 'mapcn-marker group cursor-pointer relative';

            if (isOrigin) {
                // High-visibility Warehouse Origin Asset Marker
                el.innerHTML = `
                    <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
                        <span class="absolute w-10 h-10 rounded-full bg-emerald-500/40 animate-ping pointer-events-none"></span>
                        <div class="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-700 to-emerald-500 text-white flex items-center justify-center shadow-2xl shadow-emerald-500/70 border-2 border-white text-base font-bold z-10 transition-transform group-hover:scale-110">
                            🏭
                        </div>
                        <div class="absolute left-10 px-2.5 py-1 rounded-lg bg-[#0a1410]/95 border border-emerald-500/60 text-[11px] font-mono font-bold text-emerald-300 shadow-2xl whitespace-nowrap z-20 flex items-center gap-1.5 backdrop-blur-md">
                            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span>ORIGIN WAREHOUSE: ${node.name.split(' ')[0]}</span>
                        </div>
                    </div>
                `;
            } else if (isDest) {
                // High-visibility Store Destination Asset Marker
                el.innerHTML = `
                    <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
                        <span class="absolute w-10 h-10 rounded-full bg-rose-500/40 animate-ping pointer-events-none"></span>
                        <div class="w-9 h-9 rounded-full bg-gradient-to-tr from-rose-700 to-rose-500 text-white flex items-center justify-center shadow-2xl shadow-rose-500/70 border-2 border-white text-base font-bold z-10 transition-transform group-hover:scale-110">
                            🏬
                        </div>
                        <div class="absolute left-10 px-2.5 py-1 rounded-lg bg-[#180a0f]/95 border border-rose-500/60 text-[11px] font-mono font-bold text-rose-300 shadow-2xl whitespace-nowrap z-20 flex items-center gap-1.5 backdrop-blur-md">
                            <span class="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span>
                            <span>DEST STORE: ${node.name.split(' ')[0]}</span>
                        </div>
                    </div>
                `;
            } else if (isGhat) {
                // Mountain Pass / Ghat Hazard Node
                el.innerHTML = `
                    <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
                        <div class="w-5 h-5 rounded-full bg-amber-500/25 border border-amber-400 flex items-center justify-center text-xs text-amber-300 font-bold shadow-lg shadow-amber-500/30">
                            ⛰️
                        </div>
                        <div class="hidden group-hover:flex absolute left-6 px-2 py-0.5 rounded bg-black/90 border border-amber-500/40 text-[9px] font-mono text-amber-300 whitespace-nowrap z-20 items-center gap-1">
                            <span>⛰️ Ghat Summit:</span> ${node.name}
                        </div>
                    </div>
                `;
            } else if (isPort) {
                // Major Sea Port / Container Hub
                el.innerHTML = `
                    <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
                        <div class="w-4 h-4 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-[10px] text-cyan-300 shadow">
                            ⚓
                        </div>
                        <div class="hidden group-hover:block absolute left-5 px-1.5 py-0.5 rounded bg-black/85 border border-cyan-500/30 text-[9px] font-mono text-cyan-300 whitespace-nowrap z-20">
                            ${node.name}
                        </div>
                    </div>
                `;
            } else {
                // Standard Transit Junction / Regional Node
                el.innerHTML = `
                    <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
                        <div class="w-2.5 h-2.5 rounded-full bg-slate-400/60 border border-slate-200/40 hover:scale-150 hover:bg-indigo-400 transition-transform"></div>
                        <div class="hidden group-hover:block absolute left-4 px-1.5 py-0.5 rounded bg-[#121214]/90 border border-white/10 text-[9px] font-mono text-gray-200 whitespace-nowrap z-20">
                            ${node.name.split(' ')[0]}
                        </div>
                    </div>
                `;
            }

            const headerRole = isOrigin ? '🏭 Origin Warehouse Terminal' : isDest ? '🏬 Destination Store Terminal' : isGhat ? '⛰️ Western Ghat Corridor' : isPort ? '⚓ Major Sea Port' : (node.hub_type || 'Regional Hub');
            const headerColor = isOrigin ? 'text-emerald-400' : isDest ? 'text-rose-400' : isGhat ? 'text-amber-400' : isPort ? 'text-cyan-400' : 'text-indigo-400';

            const popupHTML = `
                <div class="p-3 bg-[#121214]/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur-md text-xs font-sans min-w-[220px]">
                    <div class="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-white/10">
                        <span class="text-[10px] font-mono uppercase font-bold ${headerColor}">
                            ${headerRole}
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
                            class="py-1 px-2 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono transition text-center font-bold">
                            🏭 Set Origin
                        </button>
                        <button onclick="window.setAsDestination && window.setAsDestination('${node.id}')"
                            class="py-1 px-2 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-mono transition text-center font-bold">
                            🏬 Set Dest
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

        const u = this.getNodeCoords(originId, this.nodes.find(n => n.id === originId));
        const v = this.getNodeCoords(destId, this.nodes.find(n => n.id === destId));
        if (u && v && this.map) {
            try {
                const bounds = new LngLatBounds();
                bounds.extend([u.lng, u.lat]);
                bounds.extend([v.lng, v.lat]);
                this.map.fitBounds(bounds, {
                    padding: { top: 80, bottom: 80, left: 80, right: 80 },
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
            const coords = this.getNodeCoords(node.id, node);
            const pt = toXY(coords ? coords.lat : node.lat, coords ? coords.lng : node.lng);
            const isOrigin = this.currentOriginId === node.id;
            const isDest = this.currentDestId === node.id;

            ctx.beginPath();
            ctx.fillStyle = isOrigin ? '#10b981' : isDest ? '#ef4444' : '#64748b';
            ctx.arc(pt.x, pt.y, isOrigin || isDest ? 6.5 : 3.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = isOrigin ? '#34d399' : isDest ? '#f87171' : '#94a3b8';
            ctx.font = isOrigin || isDest ? 'bold 11px -apple-system, sans-serif' : '10px -apple-system, sans-serif';
            const label = isOrigin
                ? `🏭 ${node.name.split(' ')[0]} (Warehouse)`
                : isDest
                    ? `🏬 ${node.name.split(' ')[0]} (Store)`
                    : node.name.split(' ')[0];
            ctx.fillText(label, pt.x + 8, pt.y + 3);
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
