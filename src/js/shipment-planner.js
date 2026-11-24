// Shipment Planner Logic
import { GlobeMap } from './map-fast.js';
import { SmoothToast } from './smooth-toast.js';
import { UI } from './ui.js';
import { SmoothDropdown } from './smooth-dropdown.js';
import { getCountryCode, getCountryFlagHtml } from './country-flags.js';

export class ShipmentPlanner {
    constructor() {
        this.state = {
            mode: 'sea',
            originCountry: '',
            destCountry: '',
            originPort: null,
            destPort: null,
            portsData: {}
        };
        
        this.map = null;
        
        // Dropdown Controls
        this.originDropdown = null;
        this.destDropdown = null;
        this.originPortDropdown = null;
        this.destPortDropdown = null;

        this.init();
    }

    async init() {
        // Init Smooth Dropdowns for selects on page
        SmoothDropdown.initAll();

        // Init 3D Globe
        this.map = new GlobeMap('globe-container');
        this.map.init();
        
        // Init UI Components
        if (UI && UI.initProfileMenu) {
            UI.initProfileMenu();
        }
        
        await this.loadCountries();
        this.setupListeners();
    }

    async loadCountries() {
        try {
            const res = await fetch('/api/countries');
            const countries = await res.json();
            
            // Initialize Country Dropdowns
            this.originDropdown = this.initDropdown('origin-dropdown', countries, (val) => {
                const input = document.getElementById('origin-country');
                input.value = val;
                input.dispatchEvent(new Event('change'));
            });

            this.destDropdown = this.initDropdown('dest-dropdown', countries, (val) => {
                const input = document.getElementById('dest-country');
                input.value = val;
                input.dispatchEvent(new Event('change'));
            });

            // Initialize Port Dropdowns (Empty initially)
            this.originPortDropdown = this.initDropdown('origin-port-dropdown', [], (val) => {
                this.handlePortSelect(val, 'origin');
            });
            
            this.destPortDropdown = this.initDropdown('dest-port-dropdown', [], (val) => {
                this.handlePortSelect(val, 'dest');
            });

        } catch (e) {
            console.error("Failed to load countries", e);
        }
    }

    initDropdown(containerId, initialOptions, onSelect) {
        const container = document.getElementById(containerId);
        if (!container) return null;

        const button = container.querySelector('button');
        const menuDiv = container.querySelector('div.absolute'); // The dropdown menu container
        const searchInput = menuDiv.querySelector('input');
        const listDiv = menuDiv.querySelector('.options-list');
        const selectedText = button.querySelector('.selected-text');

        let currentOptions = initialOptions || [];

        // Toggle
        button.addEventListener('click', (e) => {
            if (button.disabled) return;
            e.stopPropagation();
            // Close others
            document.querySelectorAll('[id$="-dropdown"] div.absolute').forEach(el => {
                if (el !== menuDiv) el.classList.add('hidden');
            });
            menuDiv.classList.toggle('hidden');
            if (!menuDiv.classList.contains('hidden')) {
                searchInput.value = ''; // Clear search on open
                renderOptions(''); // Reset list
                searchInput.focus();
            }
        });

        // Populate Options
        const renderOptions = (filter = '') => {
            listDiv.innerHTML = '';
            const filtered = currentOptions.filter(o => o.toLowerCase().includes(filter.toLowerCase()));
            
            if (filtered.length === 0) {
                listDiv.innerHTML = '<div class="px-3 py-2 text-xs text-gray-500 text-center">No results found</div>';
                return;
            }

            filtered.forEach(opt => {
                const div = document.createElement('div');
                div.className = 'px-3 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white cursor-pointer rounded transition-colors flex items-center gap-2';
                const flagHtml = getCountryCode(opt) ? getCountryFlagHtml(opt) : '';
                div.innerHTML = `${flagHtml}<span class="truncate">${opt}</span>`;
                
                div.addEventListener('click', () => {
                    selectedText.innerHTML = `${flagHtml}<span class="align-middle">${opt}</span>`;
                    selectedText.classList.remove('text-gray-400'); // If it was placeholder style
                    selectedText.classList.add('text-white');
                    menuDiv.classList.add('hidden');
                    onSelect(opt);
                });
                listDiv.appendChild(div);
            });
        };

        // Search Listener
        searchInput.addEventListener('input', (e) => {
            renderOptions(e.target.value);
        });
        
        // Prevent menu close when clicking input
        searchInput.addEventListener('click', (e) => e.stopPropagation());

        // Global Click to Close
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                menuDiv.classList.add('hidden');
            }
        });

        return {
            updateOptions: (newOptions) => {
                currentOptions = newOptions;
                // If menu is open, refresh? For now, let's assume it refreshes on next open or we can force it
                // But usually options update when menu is closed (after country selection)
            },
            setDisabled: (isDisabled, placeholderText = null) => {
                button.disabled = isDisabled;
                if (isDisabled) {
                    button.classList.add('opacity-50', 'cursor-not-allowed');
                } else {
                    button.classList.remove('opacity-50', 'cursor-not-allowed');
                }
                if (placeholderText) {
                    selectedText.textContent = placeholderText;
                    if(isDisabled || placeholderText === "Select Port/Hub...") {
                         selectedText.classList.add('text-gray-400');
                         selectedText.classList.remove('text-white');
                    } else {
                         selectedText.classList.remove('text-gray-400');
                         selectedText.classList.add('text-white');
                    }
                }
            },
            reset: (placeholderText = "Select...") => {
                selectedText.textContent = placeholderText;
                selectedText.classList.add('text-gray-400');
                selectedText.classList.remove('text-white');
                currentOptions = [];
            }
        };
    }

    setupListeners() {
        // Mode Selection
        document.querySelectorAll('input[name="mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.state.mode = e.target.value;
                this.refreshPorts('origin');
                this.refreshPorts('dest');
                this.updateModeVisuals(e.target.value);
            });
        });

        // Country Selection (Hidden inputs triggered by custom dropdowns)
        document.getElementById('origin-country').addEventListener('change', (e) => this.handleCountryChange(e.target.value, 'origin'));
        document.getElementById('dest-country').addEventListener('change', (e) => this.handleCountryChange(e.target.value, 'dest'));
        
        // Analyze
        document.getElementById('btn-analyze').addEventListener('click', () => this.analyze());
        
        // Save
        document.getElementById('btn-save-route').addEventListener('click', () => this.saveRoute());
    }

    updateModeVisuals(mode) {
        // Change ambient lighting or globe colors based on mode
        // Placeholder for visual flair
    }

    async handleCountryChange(country, type) {
        if(type === 'origin') {
            this.state.originCountry = country;
            this.state.originPort = null;
        } else {
            this.state.destCountry = country;
            this.state.destPort = null;
        }
        
        await this.fetchPorts(country, type);
    }

    handlePortSelect(portName, type) {
        const country = type === 'origin' ? this.state.originCountry : this.state.destCountry;
        
        if (!country || !this.state.portsData[country]) return;
        
        const ports = this.state.portsData[country][this.state.mode];
        if (!ports) return;

        const coords = ports[portName];
        
        if (coords) {
            const portData = { name: portName, coords };
            
            if(type === 'origin') {
                this.state.originPort = portData;
                // Optional: Fly globe to point
            } else {
                this.state.destPort = portData;
            }
        }
    }

    async fetchPorts(country, type) {
        const dropdown = type === 'origin' ? this.originPortDropdown : this.destPortDropdown;
        if(dropdown) dropdown.setDisabled(true, "Loading ports...");
        
        if (!country) {
            if(dropdown) dropdown.setDisabled(true, "Select Port/Hub...");
            return;
        }

        try {
            if (!this.state.portsData[country]) {
                const res = await fetch(`/api/ports/${encodeURIComponent(country)}`);
                this.state.portsData[country] = await res.json();
            }
            this.refreshPorts(type);
        } catch (e) {
            console.error(e);
            if(dropdown) dropdown.setDisabled(true, "Failed to load");
        }
    }

    refreshPorts(type) {
        const country = type === 'origin' ? this.state.originCountry : this.state.destCountry;
        const dropdown = type === 'origin' ? this.originPortDropdown : this.destPortDropdown;
        
        if (!dropdown) return;

        if (!country || !this.state.portsData[country]) {
            dropdown.setDisabled(true, "Select Port/Hub...");
            return;
        }

        const ports = this.state.portsData[country][this.state.mode] || {};
        
        if (Object.keys(ports).length === 0) {
             dropdown.setDisabled(true, "No specific hubs found");
             return;
        }

        const portNames = Object.keys(ports);
        dropdown.updateOptions(portNames);
        dropdown.setDisabled(false, "Select Port/Hub...");
    }

    async analyze() {
        if (!this.state.originCountry || !this.state.destCountry) {
            SmoothToast.warning("Please select origin and destination.");
            return;
        }

        const btn = document.getElementById('btn-analyze');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<span class="animate-pulse">CALCULATING VECTORS...</span>';
        btn.disabled = true;

        try {
            const payload = {
                from_country: this.state.originCountry,
                to_country: this.state.destCountry,
                currency: document.getElementById('currency').value,
                from_port: this.state.originPort?.name,
                to_port: this.state.destPort?.name,
                from_coords: this.state.originPort?.coords,
                to_coords: this.state.destPort?.coords,
                preferred_mode: this.state.mode
            };

            const res = await fetch('/api/analyze-shipment', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            // Artificial Delay for "Computation" effect
            setTimeout(() => {
                this.animateResults(data);
                btn.innerHTML = originalHTML;
                btn.disabled = false;
            }, 1200);

        } catch (e) {
            SmoothToast.error(e.message);
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    }

    animateResults(data) {
        const modeKey = this.state.mode;
        const analysis = data.analysis[modeKey];
        
        if(!analysis) return;

        // 1. Render Route on Globe
        const route = {
            id: 'planned-1',
            coordinates: data.coordinates,
            from: data.from_port || data.from,
            to: data.to_port || data.to
        };
        
        // Use the map instance to render
        const mapRoute = {
            id: 'new-plan',
            from: route.from,
            to: route.to,
            coordinates: {
                start: data.coordinates.start,
                end: data.coordinates.end
            }
        };
        
        if(this.map && this.map.world) {
            this.map.renderRoutes([mapRoute]);
        }

        // 2. Animate Score Gauge
        const riskScore = analysis.risk_score || 2.5; // Fallback
        const riskLevel = analysis.risk_level || "Low";
        
        const ring = document.getElementById('score-ring');
        const val = document.getElementById('score-val');
        const label = document.getElementById('score-label');
        
        // Calculate stroke offset (Total 351)
        const offset = 351 - ((riskScore / 10) * 351);
        ring.style.strokeDashoffset = offset;
        
        // Color based on risk
        if(riskScore > 7) {
            ring.classList.remove('text-indigo-500', 'text-emerald-500', 'text-yellow-500');
            ring.classList.add('text-red-500');
            label.className = "px-3 py-1 rounded-full bg-red-500/20 border border-red-500/50 text-xs font-bold text-red-400";
        } else if (riskScore > 4) {
            ring.classList.remove('text-indigo-500', 'text-emerald-500', 'text-red-500');
            ring.classList.add('text-yellow-500');
            label.className = "px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/50 text-xs font-bold text-yellow-400";
        } else {
            ring.classList.remove('text-indigo-500', 'text-red-500', 'text-yellow-500');
            ring.classList.add('text-emerald-500');
            label.className = "px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-xs font-bold text-emerald-400";
        }
        
        label.textContent = `${riskLevel.toUpperCase()} RISK DETECTED`;
        val.textContent = riskScore.toFixed(1);

        // 3. Update Stats with counting animation
        this.animateValue("stat-dist", 0, analysis.distance_km, 1000, " km");
        this.animateValue("stat-time", 0, analysis.estimated_days, 1000, " Days");
        
        const curr = document.getElementById('currency').value;
        const symbols = { 'USD': '$', 'EUR': '€', 'INR': '₹', 'GBP': '£' };
        const symbol = symbols[curr] || curr;
        this.animateValue("stat-cost", 0, analysis.cost, 1000, "", symbol);
        
        // Enable Save
        const saveBtn = document.getElementById('btn-save-route');
        saveBtn.disabled = false;
        saveBtn.classList.remove('opacity-20');
        
        // Update opacity of stats
        document.getElementById('stat-cost').classList.remove('opacity-50');
        document.getElementById('stat-time').classList.remove('opacity-50');
        document.getElementById('stat-dist').classList.remove('opacity-50');

        // Store result
        this.currentResult = {
            id: Date.now().toString(),
            from: data.from_port || data.from,
            to: data.to_port || data.to,
            fromCoords: data.coordinates.start,
            toCoords: data.coordinates.end,
            mode: this.state.mode,
            riskScore: riskScore,
            riskLevel: riskLevel,
            stats: analysis,
            timestamp: new Date().toISOString()
        };

        const context = {
            from: data.from,
            to: data.to,
            from_port: data.from_port,
            to_port: data.to_port,
            coordinates: data.coordinates,
            risk_summary: data.risk_summary,
            preferred_mode: this.state.mode,
            generated_at: new Date().toISOString()
        };
        try {
            localStorage.setItem('current_route_context', JSON.stringify(context));
        } catch (e) {}
    }

    animateValue(id, start, end, duration, suffix = "", prefix = "") {
        const obj = document.getElementById(id);
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const val = Math.floor(progress * (end - start) + start);
            obj.innerHTML = prefix + val.toLocaleString() + suffix;
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    saveRoute() {
        if (!this.currentResult) return;
        const routes = JSON.parse(localStorage.getItem('allocated_routes') || '[]');
        routes.unshift(this.currentResult);
        localStorage.setItem('allocated_routes', JSON.stringify(routes));
        
        const btn = document.getElementById('btn-save-route');
        btn.textContent = "ROUTE ALLOCATED ✓";
        btn.classList.add('bg-emerald-500', 'text-white');
        
        setTimeout(() => {
            window.location.href = '/routes';
        }, 1000);
    }
}

new ShipmentPlanner();
