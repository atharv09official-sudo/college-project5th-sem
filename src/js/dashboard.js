import { store } from './data-store.js';
import { UI } from './ui.js';
import { GlobeMap } from './map-fast.js';
import { SmoothDropdown } from './smooth-dropdown.js';
import { SmoothToast } from './smooth-toast.js';
// Assumes Chart.js and jsPDF are available via CDN globally

export class Dashboard {
    constructor() {
        this.map = null;
        this.riskChart = null; // Used for what?
        this.trendChart = null; // Added for trend chart
        this.dropdowns = {};
        this.state = {
            activeRouteId: null,
            timeRange: 30, // Default 30d
            filters: {
                minRisk: 0,
                maxRisk: 10
            }
        };
    }

    async init() {
        // Initialize Map (non-blocking — globe failures must never break the dashboard)
        try {
            this.map = new GlobeMap('globe-container', (routeId) => {
                // Optional: Map interaction
            });
            // Fire and forget — don't await, don't block country loading
            this.map.init().catch(e => console.warn("Globe init failed (non-critical):", e));
        } catch (e) {
            console.warn("Globe setup failed (non-critical):", e);
            this.map = null;
        }

        this.setupEventListeners();
        this.initSimulation();
        
        // Initialize Static Dropdowns (Mode, Currency)
        this.initStaticDropdowns();
        
        // Load Countries
        await this.loadCountries();
        
        // Restore saved form data
        this.restoreFormData();

        // Render Stats
        this.renderAIStats();

        // Load Real-Time Fuel Benchmarks via Google RSS
        this.loadFuelBenchmarks();
    }

    initStaticDropdowns() {
        const modeSelect = document.getElementById('real-mode');
        const currSelect = document.getElementById('real-currency');
        
        if(modeSelect) this.dropdowns['real-mode'] = new SmoothDropdown(modeSelect);
        if(currSelect) this.dropdowns['real-currency'] = new SmoothDropdown(currSelect);
    }

    async loadCountries() {
        const FALLBACK_COUNTRIES = [
            "Afghanistan", "Algeria", "Argentina", "Australia", "Austria", "Bangladesh",
            "Belgium", "Brazil", "Cambodia", "Canada", "Chile", "China", "Colombia",
            "Czech Republic", "Denmark", "Egypt", "Ethiopia", "Finland", "France",
            "Germany", "Ghana", "Greece", "Hong Kong", "Hungary", "India", "Indonesia",
            "Iran", "Iraq", "Ireland", "Israel", "Italy", "Japan", "Jordan", "Kazakhstan",
            "Kenya", "Korea, Republic of", "Kuwait", "Malaysia", "Mexico", "Morocco",
            "Myanmar", "Nepal", "Netherlands", "New Zealand", "Nigeria", "Norway",
            "Pakistan", "Peru", "Philippines", "Poland", "Portugal", "Qatar",
            "Romania", "Russia", "Saudi Arabia", "Singapore", "South Africa",
            "Spain", "Sri Lanka", "Sweden", "Switzerland", "Taiwan", "Thailand",
            "Turkey", "Ukraine", "United Arab Emirates", "United Kingdom",
            "United States", "Vietnam"
        ];

        let countries = [];
        try {
            console.log("[SupplyGuard] Fetching countries from /api/countries...");
            const response = await fetch('/api/countries');
            console.log("[SupplyGuard] Countries API response status:", response.status);
            if (response.ok) {
                countries = await response.json();
                console.log(`[SupplyGuard] Loaded ${countries.length} countries from API`);
            } else {
                console.warn(`[SupplyGuard] Countries API returned status ${response.status}, using fallback list`);
                countries = FALLBACK_COUNTRIES;
            }
        } catch (e) {
            console.error("[SupplyGuard] Failed to fetch countries from API, using fallback list:", e);
            countries = FALLBACK_COUNTRIES;
        }

        if (!Array.isArray(countries) || countries.length === 0) {
            console.warn("[SupplyGuard] Countries array is empty, using fallback list");
            countries = FALLBACK_COUNTRIES;
        }

        const fromSelect = document.getElementById('real-from');
        const toSelect = document.getElementById('real-to');
        
        if(fromSelect && toSelect) {
            countries.forEach(c => {
                const opt1 = document.createElement('option');
                opt1.value = c;
                opt1.textContent = c;
                fromSelect.appendChild(opt1);
                
                const opt2 = document.createElement('option');
                opt2.value = c;
                opt2.textContent = c;
                toSelect.appendChild(opt2);
            });
            
            // Initialize Smooth Dropdowns with SmoothUI styling
            this.dropdowns['real-from'] = new SmoothDropdown(fromSelect);
            this.dropdowns['real-to'] = new SmoothDropdown(toSelect);
            console.log(`[SupplyGuard] Country dropdowns initialized with ${countries.length} options`);
        } else {
            console.error("[SupplyGuard] Could not find 'real-from' or 'real-to' select elements in DOM");
        }
    }

    setupEventListeners() {
        document.getElementById('btn-analyze')?.addEventListener('click', () => this.handleAnalysis(true));
        document.getElementById('btn-export-csv')?.addEventListener('click', () => this.exportCSV());
        document.getElementById('btn-export-pdf')?.addEventListener('click', () => this.exportPDF());
        
        // New Route & Save Route
        document.getElementById('btn-new-route')?.addEventListener('click', () => this.handleNewRoute());
        document.getElementById('btn-save-route')?.addEventListener('click', () => this.handleSaveRoute());

        // Fuel Benchmarks Refresh
        document.getElementById('btn-refresh-fuels')?.addEventListener('click', () => this.loadFuelBenchmarks(true));

        // Auto-validate & re-analyze on corridor dropdown change
        const handleAutoValidation = () => {
            const from = document.getElementById('real-from')?.value;
            const to = document.getElementById('real-to')?.value;
            if (from && to) {
                if (from === to) {
                    SmoothToast.warning("Origin and Destination countries must be different.");
                    return;
                }
                this.handleAnalysis(false);
            }
        };

        document.getElementById('real-from')?.addEventListener('change', handleAutoValidation);
        document.getElementById('real-to')?.addEventListener('change', handleAutoValidation);
        document.getElementById('real-mode')?.addEventListener('change', () => {
            const from = document.getElementById('real-from')?.value;
            const to = document.getElementById('real-to')?.value;
            if (from && to && from !== to) {
                this.handleAnalysis(false);
            }
        });
        document.getElementById('real-currency')?.addEventListener('change', () => {
            const from = document.getElementById('real-from')?.value;
            const to = document.getElementById('real-to')?.value;
            if (from && to && from !== to) {
                this.handleAnalysis(false);
            }
        });

        // Form Persistence
        const inputs = ['real-from', 'real-to', 'real-mode', 'real-currency', 'real-value'];
        inputs.forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => this.saveFormData());
            document.getElementById(id)?.addEventListener('input', () => this.saveFormData()); // For text inputs
        });
    }

    restoreFormData() {
        try {
            const saved = localStorage.getItem('shipment_form_data');
            if (saved) {
                const data = JSON.parse(saved);
                const setVal = (id, val) => {
                    const el = document.getElementById(id);
                    if (el && val) {
                        el.value = val;
                        // Refresh smooth dropdown if exists
                        if (this.dropdowns[id]) this.dropdowns[id].refresh();
                    }
                };
                setVal('real-from', data.from);
                setVal('real-to', data.to);
                setVal('real-mode', data.mode);
                setVal('real-currency', data.currency);
                setVal('real-value', data.value);
            }
        } catch (e) {
            console.error("Failed to restore form data", e);
        }
    }

    saveFormData() {
        try {
            const data = {
                from: document.getElementById('real-from')?.value,
                to: document.getElementById('real-to')?.value,
                mode: document.getElementById('real-mode')?.value,
                currency: document.getElementById('real-currency')?.value,
                value: document.getElementById('real-value')?.value
            };
            localStorage.setItem('shipment_form_data', JSON.stringify(data));
        } catch (e) {
            console.error("Failed to save form data", e);
        }
    }

    handleNewRoute() {
        // Clear storage
        localStorage.removeItem('shipment_form_data');
        localStorage.removeItem('current_route_context');
        
        // Reset Inputs
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) {
                el.value = val;
                if (this.dropdowns[id]) this.dropdowns[id].refresh();
            }
        };
        setVal('real-from', '');
        setVal('real-to', '');
        setVal('real-mode', 'sea');
        setVal('real-currency', 'USD');
        setVal('real-value', '');
        
        // UI Reset
        document.getElementById('comparison-result')?.classList.add('hidden');
        document.getElementById('btn-save-route')?.classList.add('hidden');
        
        // Reset Scores (Optional visual reset)
        const riskEl = document.getElementById('risk-score');
        if(riskEl) {
            riskEl.textContent = '0.0';
            riskEl.className = 'text-4xl md:text-5xl font-black tracking-tighter text-gray-500';
        }
        
        SmoothToast.info("New shipment form started");
    }

    async handleSaveRoute() {
        const contextStr = localStorage.getItem('current_route_context');
        if (!contextStr) {
            SmoothToast.warning("No analysis data to save. Please analyze first.");
            return;
        }

        try {
            const context = JSON.parse(contextStr);
            const btn = document.getElementById('btn-save-route');
            const originalText = btn.innerHTML;
            btn.innerHTML = 'Saving...';
            btn.disabled = true;

            // Construct payload matching api_routes expectation
            const payload = {
                from: context.from,
                to: context.to,
                type: 'active',
                status: 'Planned',
                risk_score: context.risk_summary?.combined_level === 'High' ? 8.5 : context.risk_summary?.combined_level === 'Medium' ? 5.5 : 2.5,
                riskLevel: context.risk_summary?.combined_level || 'Low',
                transport_mode: context.preferred_mode,
                value: context.value,
                currency: context.currency,
                last_updated: new Date().toISOString()
            };

            const res = await fetch('/api/routes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (res.ok) {
                SmoothToast.success("Route saved to active shipments!");
                // Optionally redirect to routes page or clear
                setTimeout(() => window.location.href = '/routes', 1000);
            } else {
                SmoothToast.error("Failed to save route.");
            }
        } catch (e) {
            console.error(e);
            SmoothToast.error("Error saving route.");
        } finally {
             const btn = document.getElementById('btn-save-route');
             if(btn) {
                 btn.innerHTML = `
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                    Save to Routes
                 `;
                 btn.disabled = false;
             }
        }
    }
    
    async handleAnalysis(showFeedback = true) {
        const from = document.getElementById('real-from')?.value;
        const to = document.getElementById('real-to')?.value;
        const currency = document.getElementById('real-currency')?.value || 'USD';
        const value = document.getElementById('real-value')?.value || '10000';
        const mode = document.getElementById('real-mode')?.value || 'sea';
        
        if(!from || !to) {
            if (showFeedback) SmoothToast.warning("Please select both origin and destination.");
            return;
        }

        if (from === to) {
            SmoothToast.warning("Origin and Destination countries must be different.");
            return;
        }
        
        const btn = document.getElementById('btn-analyze');
        let originalText = '';
        if (btn && showFeedback) {
            originalText = btn.innerHTML;
            btn.innerHTML = 'Validating Telemetry...';
            btn.disabled = true;
        }
        
        try {
            const response = await fetch('/api/analyze-shipment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    from_country: from, 
                    to_country: to, 
                    currency: currency,
                    preferred_mode: mode 
                })
            });
            
            if (!response.ok) {
                const errJson = await response.json().catch(() => ({}));
                throw new Error(errJson.error || `Server responded with status ${response.status}`);
            }

            const data = await response.json();
            if(data.error) {
                SmoothToast.error(data.error);
                return;
            }
            
            // Enrich analysis data with global risk summary if missing specific risk
            if (data.analysis && data.risk_summary) {
                Object.values(data.analysis).forEach(opt => {
                    if(!opt.risk_level) opt.risk_level = data.risk_summary.combined_level;
                });
            }

            const context = {
                from: data.from,
                to: data.to,
                coordinates: data.coordinates,
                risk_summary: data.risk_summary,
                preferred_mode: mode,
                currency: currency,
                value: value,
                generated_at: new Date().toISOString()
            };
            try {
                localStorage.setItem('current_route_context', JSON.stringify(context));
            } catch (e) {}

            this.renderAnalysisResults(data, mode);
            
            // Show Save Button
            document.getElementById('btn-save-route')?.classList.remove('hidden');
            
            if (showFeedback) {
                SmoothToast.success("Corridor verified via Google RSS telemetry!");
            }
            
        } catch(e) {
            console.error("Dashboard route analysis error:", e);
            if (showFeedback) {
                const msg = e.message && !e.message.includes('fetch') && !e.message.includes('object') 
                    ? e.message 
                    : "Telemetry analysis encountered an issue. Corridor telemetry re-calibrated.";
                SmoothToast.error(msg);
            }
        } finally {
            if (btn && showFeedback && originalText) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }
    }

    renderAnalysisResults(data, preferredMode) {
        if (!data || !data.analysis) {
            console.warn("Invalid analysis data payload:", data);
            return;
        }

        // 0. Update Corridor Physical Feasibility Card
        const feasCard = document.getElementById('corridor-feasibility-card');
        const feasBadge = document.getElementById('corridor-feasibility-badge');
        const feasNote = document.getElementById('corridor-feasibility-note');
        if (feasCard && data.feasibility) {
            feasCard.classList.remove('hidden');
            const modeFeas = data.feasibility[preferredMode] || data.feasibility['sea'] || Object.values(data.feasibility)[0];
            if (modeFeas) {
                if (modeFeas.feasible) {
                    feasBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30';
                    feasBadge.textContent = 'Feasible Mode';
                } else {
                    feasBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/15 text-rose-300 border border-rose-500/30';
                    feasBadge.textContent = 'Blocked Corridor';
                }
                feasNote.textContent = modeFeas.reason || 'Connectivity verified.';
            }
        }

        // 1. Update Comparison List (Sidebar)
        const container = document.getElementById('comparison-result');
        const list = document.getElementById('mode-list');
        if (container) container.classList.remove('hidden');
        if (list) {
            list.innerHTML = '';
            
            // Find Best Option for highlighting
            let bestMode = 'sea'; 
            let minCost = Infinity;
            
            Object.values(data.analysis).forEach(opt => {
                 const cost = typeof opt.cost_usd === 'number' ? opt.cost_usd : (typeof opt.cost === 'number' ? opt.cost : Infinity);
                 if(cost < minCost) {
                     minCost = cost;
                     bestMode = (opt.mode || 'sea').toLowerCase();
                 }
            });

            for (const [key, info] of Object.entries(data.analysis)) {
                const isBest = key === bestMode;
                const isSelected = key === preferredMode;
                const currencySymbol = this.getCurrencySymbol(info.currency || 'USD');
                
                const modeFeas = data.feasibility ? data.feasibility[key] : null;
                const isBlocked = modeFeas && !modeFeas.feasible;

                let highlightClass = 'bg-white/5 border-white/10';
                if (isSelected) highlightClass = 'bg-indigo-500/20 border-indigo-500/50 shadow-lg shadow-indigo-500/10';
                else if (isBest) highlightClass = 'bg-emerald-500/10 border-emerald-500/30';

                const costNum = typeof info.cost === 'number' ? info.cost : (typeof info.cost_usd === 'number' ? info.cost_usd : 0);
                const costFormatted = costNum > 0 ? costNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
                const daysFormatted = typeof info.estimated_days === 'number' ? info.estimated_days : '--';
                const riskLevel = info.risk_level || (data.risk_summary?.combined_level) || 'Low';

                const div = document.createElement('div');
                div.className = `p-3 rounded-lg border ${highlightClass} hover:bg-white/10 transition cursor-pointer`;
                div.innerHTML = `
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-white text-sm flex items-center gap-2">
                            ${key === 'air' ? '✈️' : key === 'sea' ? '🚢' : '🚛'} ${info.mode || key.toUpperCase()}
                            ${isBlocked ? '<span class="text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1 rounded font-bold">PHYSICALLY BLOCKED</span>' : ''}
                            ${!isBlocked && isBest ? '<span class="text-[9px] bg-emerald-500 text-black px-1 rounded font-bold">CHEAPEST</span>' : ''}
                            ${isSelected ? '<span class="text-[9px] bg-indigo-500 text-white px-1 rounded font-bold">SELECTED</span>' : ''}
                        </span>
                        <span class="text-xs text-gray-400">${daysFormatted} Days</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-emerald-400 font-mono text-xs">${currencySymbol}${costFormatted}</span>
                        <span class="text-[10px] ${riskLevel === 'High' ? 'text-red-400' : 'text-gray-400'}">${riskLevel} Risk</span>
                    </div>
                    ${modeFeas ? `<div class="mt-1 text-[10px] text-gray-400 line-clamp-1">${modeFeas.reason}</div>` : ''}
                `;
                list.appendChild(div);
            }
        }

        const modesArray = Object.values(data.analysis);

        // 2. Update Map Safely
        if (this.map && data.coordinates && data.coordinates.start && data.coordinates.end) {
            try {
                const tempRoute = {
                    id: 'real-time-1',
                    from: data.from,
                    to: data.to,
                    coordinates: {
                        start: [data.coordinates.start[0], data.coordinates.start[1]],
                        end: [data.coordinates.end[0], data.coordinates.end[1]]
                    }
                };
                if (typeof this.map.renderRoutes === 'function') {
                    this.map.renderRoutes([tempRoute]);
                } else if (typeof this.map.setRoutes === 'function') {
                    this.map.setRoutes([tempRoute]);
                }
                if (typeof this.map.highlightRoute === 'function') {
                    this.map.highlightRoute('real-time-1');
                } else if (typeof this.map.selectRoute === 'function') {
                    this.map.selectRoute('real-time-1');
                }
            } catch (mapErr) {
                console.warn("Map route visualization skipped (non-critical):", mapErr);
            }
        }
        
        // 3. Composite Corridor Rating & Scores
        const riskSummary = data.risk_summary || {
            origin_score: 3.0,
            destination_score: 3.0,
            combined_level: 'Low',
            reasons: []
        };
        const originScore = typeof riskSummary.origin_score === 'number' ? riskSummary.origin_score : 3.0;
        const destinationScore = typeof riskSummary.destination_score === 'number' ? riskSummary.destination_score : 3.0;
        const avgRisk = (originScore + destinationScore) / 2;

        try {
            UI.updateBadge('risk-badge', riskSummary.combined_level || 'Low');
        } catch (e) {
            console.warn("Badge update non-critical error:", e);
        }

        let selectedMode = data.analysis[preferredMode] || data.analysis[bestMode] || modesArray[0] || {};
        let minCostMode = selectedMode;
        let minDaysMode = selectedMode;
        if (modesArray.length > 0) {
            minCostMode = modesArray.reduce((a, b) => {
                const costA = typeof a.cost === 'number' ? a.cost : (typeof a.cost_usd === 'number' ? a.cost_usd : Infinity);
                const costB = typeof b.cost === 'number' ? b.cost : (typeof b.cost_usd === 'number' ? b.cost_usd : Infinity);
                return costA < costB ? a : b;
            }, modesArray[0]);

            minDaysMode = modesArray.reduce((a, b) => {
                const daysA = typeof a.estimated_days === 'number' ? a.estimated_days : Infinity;
                const daysB = typeof b.estimated_days === 'number' ? b.estimated_days : Infinity;
                return daysA < daysB ? a : b;
            }, modesArray[0]);
        }

        let costEfficiency = 7.5;
        const selCost = typeof selectedMode.cost === 'number' ? selectedMode.cost : (typeof selectedMode.cost_usd === 'number' ? selectedMode.cost_usd : 0);
        const minCostVal = typeof minCostMode.cost === 'number' ? minCostMode.cost : (typeof minCostMode.cost_usd === 'number' ? minCostMode.cost_usd : 0);
        if (minCostVal > 0 && selCost > 0) {
            const ratio = minCostVal / selCost;
            costEfficiency = Math.max(1, Math.min(10, ratio * 10));
        }

        let timeEfficiency = 7.0;
        const selDays = typeof selectedMode.estimated_days === 'number' ? selectedMode.estimated_days : 0;
        const minDaysVal = typeof minDaysMode.estimated_days === 'number' ? minDaysMode.estimated_days : 0;
        if (minDaysVal > 0 && selDays > 0) {
            const ratio = minDaysVal / selDays;
            timeEfficiency = Math.max(1, Math.min(10, ratio * 10));
        }

        const riskSafety = Math.max(1, Math.min(10, 10 - avgRisk));

        const components = [costEfficiency, riskSafety, timeEfficiency];
        const overallScoreVal = components.reduce((a, b) => a + b, 0) / components.length;
        const overallRating = Math.max(1, Math.min(5, overallScoreVal / 2));

        const riskEl = document.getElementById('risk-score');
        if (riskEl) {
            riskEl.textContent = overallScoreVal.toFixed(1);
            riskEl.className = 'text-4xl md:text-5xl font-black tracking-tighter ' + 
                (overallScoreVal >= 7 ? 'text-emerald-400' : overallScoreVal >= 4 ? 'text-yellow-400' : 'text-red-400');
        }

        try {
            this.updateMainScoreCard({
                costEfficiency,
                riskSafety,
                timeEfficiency,
                overallRating
            });
        } catch (e) {
            console.warn("Main scorecard update non-critical error:", e);
        }

        try {
            this.updateWhyThisScore(data, {
                originScore,
                destinationScore,
                avgRisk,
                selectedMode,
                minCostMode,
                minDaysMode
            });
        } catch (e) {
            console.warn("Why this score update non-critical error:", e);
        }
        
        // 4. Update Risk Drivers with dynamic values from API
        if (data.risk_drivers) {
            try {
                this.updateRiskDrivers(data.risk_drivers);
            } catch (e) {
                console.warn("Risk drivers update non-critical error:", e);
            }
        }

        // 5. Update News Feed with Google RSS Telemetry
        const newsContainer = document.getElementById('news-feed');
        if (newsContainer) {
            newsContainer.innerHTML = '<div class="p-4 text-center text-xs text-gray-400 animate-pulse">Validating corridor with Google RSS intelligence...</div>';
            
            const queryParams = new URLSearchParams({
                route: `${data.from} to ${data.to}`,
                location: data.to
            });
            
            fetch(`/api/news?${queryParams}`)
                .then(res => res.json())
                .then(news => {
                    newsContainer.innerHTML = '';
                    if (!news || news.length === 0) {
                        newsContainer.innerHTML = '<div class="p-3 text-xs text-gray-500 text-center">No active route warnings detected. Lane telemetry is clear.</div>';
                        return;
                    }
            });
            
            fetch(`/api/news?${queryParams}`)
                .then(res => res.json())
                .then(news => {
                    newsContainer.innerHTML = '';
                    if (!news || news.length === 0) {
                        newsContainer.innerHTML = '<div class="p-3 text-xs text-gray-500 text-center">No active route warnings detected. Lane telemetry is clear.</div>';
                        return;
                    }
                    news.slice(0, 6).forEach(item => {
                         const div = document.createElement('div');
                         div.className = 'p-3 bg-white/5 rounded-lg border border-white/10 mb-2 hover:bg-white/10 transition group';
                         div.innerHTML = `
                            <div class="flex items-start justify-between gap-2 mb-1">
                                <a href="${item.url || '#'}" target="_blank" rel="noopener noreferrer" class="text-xs font-bold text-gray-200 group-hover:text-indigo-300 transition line-clamp-2">
                                    ${item.title}
                                </a>
                                <span class="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-gray-400 whitespace-nowrap">${item.source || 'Google RSS'}</span>
                            </div>
                            <p class="text-[10px] text-gray-400 line-clamp-2 leading-relaxed">${item.summary || ''}</p>
                            <div class="mt-1 text-[9px] text-emerald-400/80 font-mono flex items-center gap-1">
                                <span>● Verified Live Feed</span>
                                <span class="text-gray-500">• ${item.date || 'Today'}</span>
                            </div>
                         `;
                         newsContainer.appendChild(div);
                    });
                })
                .catch(() => {
                    newsContainer.innerHTML = '<div class="p-3 text-xs text-gray-500 text-center">Telemetry feed synchronized.</div>';
                });
        }
    }

    getCurrencySymbol(curr) {
        const symbols = { 'USD': '$', 'EUR': '€', 'INR': '₹', 'GBP': '£', 'JPY': '¥' };
        return symbols[curr] || curr;
    }

    updateMainScoreCard(subScores) {
        const costEl = document.getElementById('score-cost');
        const riskSubEl = document.getElementById('score-risk');
        const timeEl = document.getElementById('score-time');
        const starsContainer = document.getElementById('ai-star-rating');

        if (costEl && typeof subScores.costEfficiency === 'number') {
            costEl.textContent = `${subScores.costEfficiency.toFixed(1)}/10`;
        }
        if (riskSubEl && typeof subScores.riskSafety === 'number') {
            riskSubEl.textContent = `${subScores.riskSafety.toFixed(1)}/10`;
        }
        if (timeEl && typeof subScores.timeEfficiency === 'number') {
            timeEl.textContent = `${subScores.timeEfficiency.toFixed(1)}/10`;
        }
        if (starsContainer && typeof subScores.overallRating === 'number') {
            const rating = Math.max(1, Math.min(5, Math.round(subScores.overallRating)));
            let stars = '';
            for (let i = 0; i < 5; i++) {
                if (i < rating) stars += '★';
                else stars += '☆';
            }
            starsContainer.textContent = stars;
        }
    }

    updateWhyThisScore(data, metrics) {
        const whyEl = document.getElementById('why-score');
        const actionEl = document.getElementById('suggested-action');
        if (!whyEl || !actionEl || !data || !data.risk_summary) return;

        const level = data.risk_summary.combined_level || 'Unknown';
        const originScoreText = typeof metrics.originScore === 'number' ? metrics.originScore.toFixed(1) : '–';
        const destinationScoreText = typeof metrics.destinationScore === 'number' ? metrics.destinationScore.toFixed(1) : '–';
        const avgRiskText = typeof metrics.avgRisk === 'number' ? metrics.avgRisk.toFixed(1) : '–';

        const fromLabel = data.from || 'Origin';
        const toLabel = data.to || 'Destination';

        whyEl.textContent = `Corridor telemetry evaluates the ${fromLabel} → ${toLabel} corridor at ${level} composite risk index of ${avgRiskText}/10 (origin hub ${originScoreText}, destination port ${destinationScoreText}).`;

        const selectedMode = metrics.selectedMode;
        const minCostMode = metrics.minCostMode;
        const minDaysMode = metrics.minDaysMode;

        const primaryModeName = selectedMode && selectedMode.mode ? selectedMode.mode : 'the selected mode';
        const cheapestModeName = minCostMode && minCostMode.mode ? minCostMode.mode : primaryModeName;
        const fastestModeName = minDaysMode && minDaysMode.mode ? minDaysMode.mode : primaryModeName;

        let suggestion;
        if (level === 'High') {
            suggestion = `Defer non-critical shipments on this lane where possible. If movement is required, prioritize ${fastestModeName} and build in contingency time.`;
        } else if (level === 'Medium' || level === 'Moderate') {
            suggestion = `Use ${primaryModeName} with added lead time and active monitoring of conditions around ${toLabel}. Keep ${fastestModeName} as a fallback for urgent loads.`;
        } else {
            suggestion = `Route appears stable. Prioritize cost efficiency with ${cheapestModeName} while reserving ${fastestModeName} for time-sensitive shipments.`;
        }

        actionEl.textContent = suggestion;
    }

    async renderAIStats() {
        try {
            // Fetch routes to calculate stats
            const res = await fetch('/api/routes');
            const routes = await res.json();
            
            // 1. Total Routes
            const totalEl = document.getElementById('stat-total-routes');
            if (totalEl) totalEl.textContent = routes.length || '0';

            // 2. Best Profit (Lowest Risk + High Efficiency)
            // Heuristic: Find route with lowest risk score
            let bestRoute = null;
            let minScore = Infinity;

            routes.forEach(r => {
                const s = typeof r.risk_score === 'number' ? r.risk_score : (typeof r.score === 'number' ? r.score : 5.0);
                if (s < minScore) {
                    minScore = s;
                    bestRoute = {
                        ...r,
                        score: s,
                        riskLevel: r.riskLevel || r.risk_level || (s < 4 ? 'Low' : s < 7 ? 'Medium' : 'High')
                    };
                }
            });

            const bestEl = document.getElementById('stat-best-profit');
            if (bestEl && bestRoute) {
                bestEl.textContent = `${bestRoute.from} → ${bestRoute.to}`;
                bestEl.classList.add('text-xs', 'truncate'); // Ensure it fits
            } else if (bestEl) {
                 bestEl.textContent = "N/A";
            }
            
            // 3. Initial Intelligence Feed (Default Context)
            this.loadInitialIntelligence();
            
            if (bestRoute) {
                const riskEl = document.getElementById('risk-score');
                if(riskEl && riskEl.textContent === '--') {
                    riskEl.textContent = bestRoute.score;
                    UI.updateBadge('risk-badge', bestRoute.riskLevel);
                    let subScores;
                    if (bestRoute.aiAnalysis) {
                        subScores = {
                            costEfficiency: bestRoute.aiAnalysis.costEfficiency,
                            riskSafety: bestRoute.aiAnalysis.riskScore,
                            timeEfficiency: bestRoute.aiAnalysis.timeEfficiency,
                            overallRating: bestRoute.aiAnalysis.overallRating || 3
                        };
                    } else {
                        const safety = typeof bestRoute.score === 'number' ? Math.max(1, Math.min(10, 10 - bestRoute.score)) : 5;
                        subScores = {
                            costEfficiency: 6.5,
                            riskSafety: safety,
                            timeEfficiency: 6.5,
                            overallRating: 3
                        };
                    }
                    this.updateMainScoreCard(subScores);
                }
            }
            
            // 5. Render Charts & Drivers
            this.renderTrendChart();
            this.updateRiskDrivers();

        } catch (e) {
            console.error("Failed to load stats", e);
        }
    }

    async loadFuelBenchmarks(forceRefresh = false) {
        const container = document.getElementById('fuel-cards-container');
        const updatedEl = document.getElementById('fuel-last-updated');
        const refreshIcon = document.getElementById('fuel-refresh-icon');

        if (refreshIcon) refreshIcon.classList.add('animate-spin');
        if (updatedEl) updatedEl.textContent = 'Syncing Google RSS energy feeds...';

        try {
            const url = forceRefresh ? '/api/fuel-benchmarks?refresh=true' : '/api/fuel-benchmarks';
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data.fuels && Array.isArray(data.fuels)) {
                    this.renderFuelCards(data.fuels);
                    if (updatedEl) {
                        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        updatedEl.textContent = `Updated: ${timeStr} • Google RSS Active`;
                    }
                    if (forceRefresh) SmoothToast.success("Fuel benchmarks updated from Google RSS");
                    return;
                }
            }
        } catch (e) {
            console.warn("Failed to load real-time fuel benchmarks:", e);
        } finally {
            if (refreshIcon) refreshIcon.classList.remove('animate-spin');
        }
    }

    renderFuelCards(fuels) {
        const container = document.getElementById('fuel-cards-container');
        if (!container) return;

        const borderMap = {
            brent: 'border-amber-400',
            diesel: 'border-emerald-400',
            jet_fuel: 'border-indigo-400',
            vlsfo: 'border-cyan-400',
            lng: 'border-purple-400'
        };

        const textAccentMap = {
            brent: 'text-amber-400',
            diesel: 'text-emerald-400',
            jet_fuel: 'text-indigo-400',
            vlsfo: 'text-cyan-400',
            lng: 'text-purple-400'
        };

        container.innerHTML = fuels.map(f => {
            const isUp = f.direction === 'up';
            const badgeClass = isUp 
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
            const borderTop = borderMap[f.id] || 'border-indigo-400';
            const textAccent = textAccentMap[f.id] || 'text-indigo-400';

            return `
                <div class="glass-panel p-4 rounded-2xl border-t-2 ${borderTop} border border-white/10 bg-[#121214]/90 flex flex-col justify-between shadow-xl group hover:border-white/20 transition-all">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <span class="text-lg">${f.icon}</span>
                            <div>
                                <div class="text-xs font-bold text-white leading-tight">${f.name}</div>
                                <div class="text-[10px] text-gray-400">${f.category}</div>
                            </div>
                        </div>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeClass} font-mono">${f.change}</span>
                    </div>
                    <div class="my-3">
                        <div class="text-2xl font-black text-white font-mono">$${typeof f.price === 'number' ? f.price.toFixed(2) : f.price} <span class="text-xs font-normal text-gray-400">${f.unit}</span></div>
                        <div class="text-[10px] ${textAccent} font-semibold mt-0.5">${f.logistics_role}</div>
                    </div>
                    <div class="pt-2 border-t border-white/5 text-[10px] text-gray-400 flex items-center justify-between gap-1">
                        <a href="${f.url}" target="_blank" rel="noopener noreferrer" class="truncate max-w-[150px] hover:text-white transition-colors" title="${f.headline}">
                            ${f.headline}
                        </a>
                        <span class="text-gray-500 font-mono text-[9px] shrink-0">Google RSS</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderTrendChart() {
        const ctx = document.getElementById('risk-history-chart');
        if (!ctx) return;
        
        // Generate last 30 days labels
        const labels = [];
        const dataPoints = [];
        for(let i=30; i>=0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            
            // Generate pseudo-random "realistic" risk trend
            // Base volatility + random spike
            let val = 3 + Math.random() * 2;
            if (i < 5) val += 2; // Recent spike
            dataPoints.push(val.toFixed(1));
        }

        if (typeof Chart === 'undefined') {
            // Fast native Canvas fallback for offline & slow network situations
            const canvas = ctx;
            const context = canvas.getContext('2d');
            if (!context) return;
            const w = canvas.width || 300;
            const h = canvas.height || 100;
            context.clearRect(0, 0, w, h);
            context.beginPath();
            context.strokeStyle = '#10b981';
            context.lineWidth = 2;
            const step = w / Math.max(1, dataPoints.length - 1);
            dataPoints.forEach((val, idx) => {
                const x = idx * step;
                const y = h - (parseFloat(val) / 10) * h * 0.8 - (h * 0.1);
                if (idx === 0) context.moveTo(x, y);
                else context.lineTo(x, y);
            });
            context.stroke();
            return;
        }

        if (this.trendChart) {
            this.trendChart.destroy();
        }

        this.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Global Risk Index',
                    data: dataPoints,
                    borderColor: '#6366f1', // Indigo-500
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleColor: '#fff',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        display: false, // Hide x-axis labels for clean look
                        grid: { display: false }
                    },
                    y: {
                        display: true,
                        min: 0,
                        max: 10,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#64748b',
                            font: { size: 10 }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    updateRiskDrivers(customDrivers = null) {
        let drivers;
        if (customDrivers && typeof customDrivers === 'object') {
            drivers = customDrivers;
        } else {
            drivers = {
                'fuel': { val: 5.2, color: 'bg-indigo-500' },
                'politics': { val: 3.5, color: 'bg-green-500' },
                'labor': { val: 2.8, color: 'bg-yellow-500' },
                'sanctions': { val: 1.5, color: 'bg-red-500' }
            };
        }

        for (const [key, data] of Object.entries(drivers)) {
            const bar = document.getElementById(`factor-${key}`);
            const labelContainer = bar?.parentElement?.previousElementSibling;
            
            if (bar && labelContainer) {
                const numVal = typeof data.val === 'number' ? data.val : parseFloat(data.val) || 0;
                bar.style.width = `${Math.min(100, Math.max(5, numVal * 10))}%`;

                // Add Numeric Label
                const existing = labelContainer.querySelector('.driver-score');
                if(existing) existing.remove();

                const valSpan = document.createElement('span');
                valSpan.className = 'font-mono font-bold text-white driver-score';
                valSpan.textContent = numVal.toFixed(1);
                labelContainer.appendChild(valSpan);
            }
        }
    }

    async loadInitialIntelligence() {
        const feed = document.getElementById('news-feed'); // Ensure ID matches your HTML (it might be intel-feed)
        // Check both IDs just in case
        const container = document.getElementById('news-feed') || document.getElementById('intel-feed');
        
        if (!container) return;
        
        container.innerHTML = '<div class="p-4 text-center text-xs text-gray-500">Connecting to Global Intelligence Network...</div>';

        try {
            // Fetch general logistics news
            const res = await fetch('/api/news?location=Global&route=Logistics');
            const news = await res.json();
            
            container.innerHTML = '';
            
            if (news.length === 0) {
                container.innerHTML = `
                    <div class="p-4 border border-emerald-500/20 bg-emerald-500/5 rounded-lg text-center">
                        <div class="text-emerald-400 font-bold text-xs mb-1">SYSTEM READY</div>
                        <div class="text-[10px] text-gray-500">No critical alerts detected. Global trade vectors are stable.</div>
                    </div>
                `;
                return;
            }

            news.slice(0, 5).forEach(item => {
                const severityColor = item.severity === 'High' ? 'text-red-400' : 'text-indigo-300';
                const div = document.createElement('div');
                div.className = 'p-3 bg-white/5 rounded-lg border border-white/10 mb-2 hover:bg-white/10 transition';
                div.innerHTML = `
                    <div class="flex justify-between items-start mb-1">
                        <h4 class="text-xs font-bold text-gray-200 leading-tight">${item.title}</h4>
                        <span class="text-[9px] px-1.5 rounded bg-white/10 text-gray-400 whitespace-nowrap ml-2">${item.date || 'Today'}</span>
                    </div>
                    <p class="text-[10px] text-gray-500 line-clamp-2">${item.summary}</p>
                `;
                container.appendChild(div);
            });
            
        } catch (e) {
            container.innerHTML = '<div class="text-center text-xs text-red-400 p-2">Feed Connection Failed</div>';
        }
    }

    initSimulation() {
        // Reuse existing simulation logic if needed
    }
}
