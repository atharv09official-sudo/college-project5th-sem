/**
 * mapcn - Modern MapLibre GL UI Component for HETVAYA FlowGrid
 * Inspired by AnmolSaini16/mapcn (shadcn/ui for Maps)
 * Features: Dark-mode vector tiles, custom shadcn DOM markers, glowing GeoJSON route lines,
 * 3D pitch controls, interactive popups, smooth camera animations, and robust 2D Canvas fallback.
 */

import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
const { Map, Marker, Popup, LngLatBounds } = maplibregl;

// Robust, 100% Free basemap styles: Esri Dark Gray, Esri Satellite, and OpenFreeMap vector
export const MAPCN_STYLES = {
    dark: {
        version: 8,
        name: 'mapcn-dark-gray',
        sources: {
            'esri-dark-gray-base': {
                type: 'raster',
                tiles: [
                    'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
                ],
                tileSize: 256,
                attribution: '&copy; Esri &copy; OpenStreetMap'
            },
            'esri-dark-gray-ref': {
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
                paint: { 'background-color': '#0d0e12' }
            },
            {
                id: 'esri-base',
                type: 'raster',
                source: 'esri-dark-gray-base',
                minzoom: 0,
                maxzoom: 18,
                paint: {
                    'raster-opacity': 0.95
                }
            },
            {
                id: 'esri-ref',
                type: 'raster',
                source: 'esri-dark-gray-ref',
                minzoom: 0,
                maxzoom: 18,
                paint: {
                    'raster-opacity': 0.8
                }
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
    vector: 'https://tiles.openfreemap.org/styles/dark'
};

export const MAPCN_FALLBACK_DARK_STYLE = MAPCN_STYLES.dark;

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

/**
 * Predefined Maharashtra Core Freight Corridors (Base Infrastructure Grid).
 * Guaranteed to connect all trade hubs instantly without waiting for network API latency.
 */
export const PREDEFINED_CORRIDORS = [
    { from: "MUM_JNPT", to: "MUM_PANVEL", distance_km: 28.5, name: "JNPT Port Access Corridor (NH-348)", is_ghat: false },
    { from: "MUM_CENTRAL", to: "MUM_PANVEL", distance_km: 42.0, name: "Sion-Panvel Expressway", is_ghat: false },
    { from: "MUM_BHIWANDI", to: "MUM_THANE", distance_km: 16.5, name: "Bhiwandi-Thane Bypass (NH-848)", is_ghat: false },
    { from: "MUM_THANE", to: "MUM_PANVEL", distance_km: 34.0, name: "Thane-Belapur Corridor", is_ghat: false },
    { from: "MUM_BHIWANDI", to: "MUM_PANVEL", distance_km: 48.0, name: "JNPT-Bhiwandi Dedicated Freight Route (NH-48 Ext)", is_ghat: false },
    { from: "MUM_PANVEL", to: "KHANDALA", distance_km: 54.0, name: "Mumbai-Pune Expressway (Ghat Section)", is_ghat: true },
    { from: "MUM_PANVEL", to: "KHANDALA", distance_km: 58.5, name: "Old NH-48 Khopoli Ghat Highway", is_ghat: true },
    { from: "KHANDALA", to: "LONAVALA", distance_km: 5.2, name: "Khandala-Lonavala Crest Section", is_ghat: false },
    { from: "LONAVALA", to: "PUNE_CHAKAN", distance_km: 46.0, name: "Lonavala-Talegaon-Chakan Industrial Highway", is_ghat: false },
    { from: "LONAVALA", to: "PUNE_CITY", distance_km: 64.0, name: "Mumbai-Pune Expressway (Pune Foothills)", is_ghat: false },
    { from: "PUNE_CHAKAN", to: "PUNE_CITY", distance_km: 32.0, name: "Pune Ring Road Link", is_ghat: false },
    { from: "PUNE_CITY", to: "SHIRWAL", distance_km: 52.0, name: "NH-48 Pune-Shirwal Expressway", is_ghat: false },
    { from: "SHIRWAL", to: "SATARA", distance_km: 60.0, name: "NH-48 Shirwal-Satara Corridor (Khambatki Ghat)", is_ghat: true },
    { from: "SATARA", to: "KARAD", distance_km: 54.0, name: "NH-48 6-Lane Concrete Highway", is_ghat: false },
    { from: "KARAD", to: "KOLHAPUR", distance_km: 72.0, name: "NH-48 Karad-Kolhapur Industrial Corridor", is_ghat: false },
    { from: "KOLHAPUR", to: "BELAGAVI", distance_km: 105.0, name: "NH-48 Golden Quadrilateral (Karnataka Border)", is_ghat: false },
    { from: "KOLHAPUR", to: "GOA_MORMUGAO", distance_km: 210.0, name: "NH-748 Amboli Ghat Trade Route", is_ghat: true },
    { from: "MUM_THANE", to: "KASARA", distance_km: 78.0, name: "NH-160 Mumbai-Agra Highway (Shahapur Corridor)", is_ghat: false },
    { from: "KASARA", to: "IGATPURI", distance_km: 16.0, name: "Thal Ghat (Kasara Ghat) Heavy Monsoon Section", is_ghat: true },
    { from: "IGATPURI", to: "NASHIK", distance_km: 48.0, name: "NH-160 Plateau Highway", is_ghat: false },
    { from: "NASHIK", to: "PUNE_CHAKAN", distance_km: 175.0, name: "NH-60 Nashik-Pune Industrial Corridor", is_ghat: false },
    { from: "NASHIK", to: "AURANGABAD", distance_km: 190.0, name: "Samruddhi Mahamarg (Expressway Spur)", is_ghat: false },
    { from: "PUNE_CITY", to: "AHMEDNAGAR", distance_km: 122.0, name: "State Highway 27 Pune-Nagar 4-Lane", is_ghat: false },
    { from: "AHMEDNAGAR", to: "AURANGABAD", distance_km: 114.0, name: "NH-753F Ahmednagar-Aurangabad Corridor", is_ghat: false },
    { from: "AURANGABAD", to: "JALNA", distance_km: 62.0, name: "Samruddhi Expressway Central Link", is_ghat: false },
    { from: "JALNA", to: "NAGPUR", distance_km: 420.0, name: "Hindu Hrudaysamrat Balasaheb Thackeray Samruddhi Mahamarg", is_ghat: false },
    { from: "PUNE_CITY", to: "SOLAPUR", distance_km: 250.0, name: "NH-65 Pune-Solapur 4-Lane Highway", is_ghat: false },
    { from: "SOLAPUR", to: "KOLHAPUR", distance_km: 235.0, name: "NH-166 Solapur-Sangli-Kolhapur Industrial Route", is_ghat: false },
    { from: "MUM_THANE", to: "SURAT", distance_km: 265.0, name: "NH-48 Western Freight Corridor (Mumbai-Gujarat)", is_ghat: false },
    { from: "SURAT", to: "AHMEDABAD", distance_km: 260.0, name: "NE-1 / NH-48 Vadodara-Ahmedabad Expressway", is_ghat: false }
];

const MAPCN_DARK_STYLE = MAPCN_STYLES.dark;

function hasWebGL() {
    try {
        const c = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) {
        return true;
    }
}

export class MapCN {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.options = Object.assign({
            center: [73.5, 18.9], // Central Maharashtra Trade Corridor centroid (Mumbai-Pune-Nashik)
            zoom: 7.4,
            pitch: 0, // Clean planar perspective for zero distortion
            bearing: 0,
            interactive: true
        }, options);

        this.map = null;
        this.markers = [];
        this.nodes = Object.values(PREDEFINED_MAHARASHTRA_COORDINATES);
        this.corridors = PREDEFINED_CORRIDORS;
        this.currentOriginId = null;
        this.currentDestId = null;
        this.is3D = false;
        this.currentStyle = 'dark';
        this.routeBadgeMarker = null;
        this.cachedRecommended = null;
        this.cachedAlternatives = [];
        this._triedFallbackStyle = false;
        this.isFallback = false;
        this.fallbackCanvas = null;
        this.fallbackCtx = null;
        this.routeGeometryCache = new Map();
        this.routeRenderVersion = 0;
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
                    this.map?.resize();
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
                    fadeDuration: 0,
                    renderWorldCopies: false
                });

                this.map.on('load', complete);
                this.map.on('styledata', () => {
                    if (this.map.isStyleLoaded()) complete();
                });

                this.map.on('error', (e) => {
                    const msg = e?.error?.message || String(e);
                    console.debug('[mapcn] Map note:', msg);
                });

                // Safety timeout: ensure layers & controls mount even if event timing varies
                setTimeout(() => {
                    if (!settled && this.map) complete();
                }, 1500);
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
        const corridorsToUse = (this.corridors && this.corridors.length > 0) ? this.corridors : PREDEFINED_CORRIDORS;
        const features = [];
        corridorsToUse.forEach((c) => {
            const fromId = c.from_node || c.from || c.source;
            const toId = c.to_node || c.to || c.target;
            const uObj = this.nodes.find(n => n.id === fromId);
            const vObj = this.nodes.find(n => n.id === toId);
            const u = this.getNodeCoords(fromId, uObj);
            const v = this.getNodeCoords(toId, vObj);
            if (u && v && typeof u.lat === 'number' && typeof v.lat === 'number') {
                features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: [[u.lng, u.lat], [v.lng, v.lat]]
                    },
                    properties: {
                        corridor_id: c.corridor_code || c.corridor_id || c.name || `${fromId}-${toId}`,
                        name: c.corridor_name || c.name || `${fromId}-${toId}`,
                        distance_km: c.distance_km || 0,
                        is_ghat: !!(c.is_ghat || c.is_ghat_section)
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
            this.map.once('styledata', () => {
                if (this.map.isStyleLoaded()) this.initLayers();
            });
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
                id: 'network-corridors-line',
                type: 'line',
                source: 'network-corridors',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': '#93c5fd',
                    'line-width': 1.8,
                    'line-opacity': 0.55,
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

        // 2. Direct Origin-Destination Transit Corridor Preview Line
        if (!this.map.getSource('preview-corridor')) {
            this.map.addSource('preview-corridor', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });

            this.map.addLayer({
                id: 'preview-corridor-glow',
                type: 'line',
                source: 'preview-corridor',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': '#34d399',
                    'line-width': 6.0,
                    'line-opacity': 0.3,
                    'line-blur': 3
                }
            });

            this.map.addLayer({
                id: 'preview-corridor-line',
                type: 'line',
                source: 'preview-corridor',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': '#34d399',
                    'line-width': 2.5,
                    'line-opacity': 0.85,
                    'line-dasharray': [3, 2]
                }
            });
        }

        // 3. Alternative Routes Source & Layer
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

        // 4. Recommended Route Source & Glow Casing Layers
        if (!this.map.getSource('recommended-route')) {
            this.map.addSource('recommended-route', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });

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
        const parent = this.container?.closest('.mapcn-container-wrapper') || this.container;
        if (!parent || parent.querySelector('#mapcn-controls-overlay')) return;

        const controlWrapper = document.createElement('div');
        controlWrapper.id = 'mapcn-controls-overlay';
        controlWrapper.className = 'absolute top-3 right-3 z-20 flex flex-col gap-1.5 pointer-events-auto';
        controlWrapper.innerHTML = `
            <div class="flex flex-col rounded-[4px] bg-[#121214]/90 backdrop-blur-md border border-white/10 shadow-2xl overflow-hidden divide-y divide-white/5 font-mono text-xs">
                <button id="mapcn-zoom-in" title="Zoom In" class="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition rounded-[3px]">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                </button>
                <button id="mapcn-zoom-out" title="Zoom Out" class="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition rounded-[3px]">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path></svg>
                </button>
                <button id="mapcn-pitch-toggle" title="Toggle 3D / 2D Perspective" class="w-8 h-8 flex items-center justify-center text-indigo-400 hover:text-indigo-300 hover:bg-white/10 transition text-[10px] font-bold rounded-[3px]">
                    3D
                </button>
                <button id="mapcn-compass" title="Reset North Orientation" class="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-sky-400 hover:bg-white/10 transition text-[11px] rounded-[3px]">
                    🧭
                </button>
                <button id="mapcn-style-toggle" title="Cycle Basemap (Dark / Sat / Light)" class="w-8 h-8 flex items-center justify-center text-amber-400 hover:text-amber-300 hover:bg-white/10 transition text-[9px] font-bold uppercase rounded-[3px]">
                    SAT
                </button>
                <button id="mapcn-recenter" title="Recenter Corridors" class="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-emerald-400 hover:bg-white/10 transition rounded-[3px]">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                </button>
                <button id="mapcn-fullscreen" title="Toggle Fullscreen" class="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition rounded-[3px]">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                </button>
            </div>
        `;

        parent.appendChild(controlWrapper);

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
        const styles = ['dark', 'satellite', 'vector'];
        const labels = { dark: 'SAT', satellite: 'VEC', vector: 'DRK' };
        const currentIdx = styles.indexOf(this.currentStyle);
        const nextStyle = styles[(currentIdx + 1) % styles.length];
        this.currentStyle = nextStyle;

        this.map.setStyle(MAPCN_STYLES[this.currentStyle]);
        this.map.once('styledata', () => {
            if (this.map.isStyleLoaded()) {
                this.initLayers();
            }
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
            el.className = 'mapcn-marker group cursor-pointer relative pointer-events-auto';

            if (isOrigin) {
                // High-visibility Warehouse Origin Asset Marker (Centered above GPS coordinate)
                el.innerHTML = `
                    <div class="mapcn-node-pin flex flex-col items-center pointer-events-auto z-30">
                        <div class="px-2 py-0.5 mb-1 rounded bg-[#0a1812]/95 border border-emerald-500/70 text-[10px] font-mono font-bold text-emerald-300 shadow-2xl whitespace-nowrap flex items-center gap-1.5 backdrop-blur-md">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span>ORIGIN WAREHOUSE: ${node.name.split(' ')[0]}</span>
                        </div>
                        <div class="relative flex items-center justify-center">
                            <span class="absolute w-8 h-8 rounded-full bg-emerald-500/40 animate-ping pointer-events-none"></span>
                            <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white flex items-center justify-center shadow-xl shadow-emerald-500/60 border-2 border-white text-sm font-bold z-10 transition-transform group-hover:scale-110">
                                🏭
                            </div>
                        </div>
                    </div>
                `;
            } else if (isDest) {
                // High-visibility Store Destination Asset Marker (Centered above GPS coordinate)
                el.innerHTML = `
                    <div class="mapcn-node-pin flex flex-col items-center pointer-events-auto z-30">
                        <div class="px-2 py-0.5 mb-1 rounded bg-[#1a0a10]/95 border border-rose-500/70 text-[10px] font-mono font-bold text-rose-300 shadow-2xl whitespace-nowrap flex items-center gap-1.5 backdrop-blur-md">
                            <span class="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                            <span>DEST STORE: ${node.name.split(' ')[0]}</span>
                        </div>
                        <div class="relative flex items-center justify-center">
                            <span class="absolute w-8 h-8 rounded-full bg-rose-500/40 animate-ping pointer-events-none"></span>
                            <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-600 to-rose-400 text-white flex items-center justify-center shadow-xl shadow-rose-500/60 border-2 border-white text-sm font-bold z-10 transition-transform group-hover:scale-110">
                                🏬
                            </div>
                        </div>
                    </div>
                `;
            } else if (isGhat) {
                // Mountain Pass / Ghat Hazard Node
                el.innerHTML = `
                    <div class="mapcn-node-pin flex flex-col items-center pointer-events-auto z-20">
                        <div class="hidden group-hover:block px-1.5 py-0.5 mb-1 rounded bg-black/90 border border-amber-500/40 text-[9px] font-mono text-amber-300 whitespace-nowrap shadow z-20">
                            ⛰️ ${node.name}
                        </div>
                        <div class="w-5 h-5 rounded-full bg-amber-500/30 border border-amber-400 flex items-center justify-center text-[10px] text-amber-300 shadow">
                            ⛰️
                        </div>
                    </div>
                `;
            } else if (isPort) {
                // Major Sea Port / Container Hub
                el.innerHTML = `
                    <div class="mapcn-node-pin flex flex-col items-center pointer-events-auto z-20">
                        <div class="hidden group-hover:block px-1.5 py-0.5 mb-1 rounded bg-black/90 border border-cyan-500/40 text-[9px] font-mono text-cyan-300 whitespace-nowrap shadow z-20">
                            ⚓ ${node.name}
                        </div>
                        <div class="w-4 h-4 rounded-full bg-cyan-500/30 border border-cyan-400 flex items-center justify-center text-[9px] text-cyan-300 shadow">
                            ⚓
                        </div>
                    </div>
                `;
            } else {
                // Standard Transit Junction / Regional Node
                el.innerHTML = `
                    <div class="mapcn-node-pin flex flex-col items-center pointer-events-auto z-10">
                        <div class="hidden group-hover:block px-1.5 py-0.5 mb-1 rounded bg-[#121214]/90 border border-white/10 text-[9px] font-mono text-gray-200 whitespace-nowrap shadow z-20">
                            ${node.name.split(' ')[0]}
                        </div>
                        <div class="w-2.5 h-2.5 rounded-full bg-slate-400/60 border border-slate-200/40 hover:scale-150 hover:bg-indigo-400 transition-transform"></div>
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

            const coords = this.getNodeCoords(node.id, node);
            const lngLat = coords ? [coords.lng, coords.lat] : [node.lng, node.lat];

            const marker = new Marker({ element: el, anchor: 'center' })
                .setLngLat(lngLat)
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
                // Update direct preview corridor line
                const previewSource = this.map.getSource('preview-corridor');
                if (previewSource) {
                    previewSource.setData({
                        type: 'FeatureCollection',
                        features: [{
                            type: 'Feature',
                            geometry: {
                                type: 'LineString',
                                coordinates: [[u.lng, u.lat], [v.lng, v.lat]]
                            },
                            properties: { name: 'Transit Preview Corridor' }
                        }]
                    });
                }

                // Explicit bounding box with balanced margins
                const minLng = Math.min(u.lng, v.lng);
                const maxLng = Math.max(u.lng, v.lng);
                const minLat = Math.min(u.lat, v.lat);
                const maxLat = Math.max(u.lat, v.lat);
                const padLng = Math.max(0.4, (maxLng - minLng) * 0.4);
                const padLat = Math.max(0.4, (maxLat - minLat) * 0.4);

                this.map.fitBounds([
                    [minLng - padLng, minLat - padLat],
                    [maxLng + padLng, maxLat + padLat]
                ], {
                    padding: { top: 90, bottom: 70, left: 70, right: 70 },
                    maxZoom: 9.6,
                    duration: 600
                });
            } catch (e) {
                console.warn('[mapcn] highlightSelection fitBounds warning:', e);
            }
        }
    }

    fitToCorridors() {
        if (this.isFallback || !this.map) return;
        try {
            const allCoords = this.nodes.length > 0 ? this.nodes : Object.values(PREDEFINED_MAHARASHTRA_COORDINATES);
            let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
            allCoords.forEach(n => {
                const c = this.getNodeCoords(n.id, n);
                if (c && typeof c.lng === 'number' && typeof c.lat === 'number') {
                    if (c.lng < minLng) minLng = c.lng;
                    if (c.lng > maxLng) maxLng = c.lng;
                    if (c.lat < minLat) minLat = c.lat;
                    if (c.lat > maxLat) maxLat = c.lat;
                }
            });
            if (minLng < maxLng && minLat < maxLat) {
                this.map.fitBounds([
                    [minLng - 0.25, minLat - 0.25],
                    [maxLng + 0.25, maxLat + 0.25]
                ], {
                    padding: { top: 70, bottom: 60, left: 60, right: 60 },
                    duration: 700
                });
            }
        } catch (e) { }
    }

    resetView() {
        this.fitToCorridors();
    }

    async getRoadRouteCoordinates(waypoints) {
        if (!Array.isArray(waypoints) || waypoints.length < 2) return null;
        const coords = waypoints
            .filter(point => Number.isFinite(Number(point.lng)) && Number.isFinite(Number(point.lat)))
            .map(point => [Number(point.lng), Number(point.lat)]);
        if (coords.length < 2) return null;

        const key = coords.map(point => point.join(',')).join(';');
        if (this.routeGeometryCache.has(key)) return this.routeGeometryCache.get(key);

        try {
            const path = coords.map(point => point.join(',')).join(';');
            const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson&steps=false`, {
                signal: AbortSignal.timeout(5000)
            });
            if (!response.ok) return null;
            const data = await response.json();
            const roadCoords = data.code === 'Ok' ? data.routes?.[0]?.geometry?.coordinates : null;
            if (!Array.isArray(roadCoords) || roadCoords.length < 2) return null;
            this.routeGeometryCache.set(key, roadCoords);
            return roadCoords;
        } catch (error) {
            return null;
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
        const renderVersion = ++this.routeRenderVersion;

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

        const updateRoadGeometry = async () => {
            const routes = [recommendedRoute, ...rankedRoutes.filter(route => !route.is_recommended)];
            const geometries = await Promise.all(routes.map(route => this.getRoadRouteCoordinates(route?.waypoints)));
            if (renderVersion !== this.routeRenderVersion || !this.map) return;

            const recCoords = geometries[0];
            if (recCoords?.length > 1) {
                this.map.getSource('recommended-route')?.setData({
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        geometry: { type: 'LineString', coordinates: recCoords },
                        properties: {
                            name: recommendedRoute?.name,
                            distance_km: recommendedRoute?.distance_km,
                            cost_inr: recommendedRoute?.total_cost_inr
                        }
                    }]
                });
            }

            const palette = ['#10b981', '#f59e0b', '#a855f7'];
            const alternatives = routes.slice(1).flatMap((route, index) => {
                const coordinates = geometries[index + 1] || route.waypoints?.map(point => [point.lng, point.lat]);
                if (!coordinates || coordinates.length < 2) return [];
                return [{
                    type: 'Feature',
                    geometry: { type: 'LineString', coordinates },
                    properties: { color: palette[index % palette.length], name: route.name, distance_km: route.distance_km }
                }];
            });
            this.map.getSource('alt-routes')?.setData({ type: 'FeatureCollection', features: alternatives });
        };
        updateRoadGeometry();

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
        const renderVersion = ++this.routeRenderVersion;
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
                this.getRoadRouteCoordinates(route.waypoints).then(roadCoords => {
                    if (!roadCoords || renderVersion !== this.routeRenderVersion || !this.map) return;
                    this.map.getSource('recommended-route')?.setData({
                        type: 'FeatureCollection',
                        features: [{
                            type: 'Feature',
                            geometry: { type: 'LineString', coordinates: roadCoords },
                            properties: { name: route.name, distance_km: route.distance_km }
                        }]
                    });
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

        ctx.fillStyle = '#0d0e12';
        ctx.fillRect(0, 0, w, h);

        const minLat = 15.2, maxLat = 22.0;
        const minLng = 72.5, maxLng = 80.0;
        const pad = 45;
        const toXY = (lat, lng) => ({
            x: pad + ((lng - minLng) / (maxLng - minLng)) * (w - 2 * pad),
            y: h - (pad + ((lat - minLat) / (maxLat - minLat)) * (h - 2 * pad))
        });

        // Corridors
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        this.corridors.forEach(c => {
            const fromId = c.from_hub || c.from_node || c.from || c.source;
            const toId = c.to_hub || c.to_node || c.to || c.target;
            const u = this.nodes.find(n => n.id === fromId);
            const v = this.nodes.find(n => n.id === toId);
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
