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
        document.getElementById('btn-analyze')?.addEventListener('click', () => this.handleAnalysis());
        document.getElementById('btn-export-csv')?.addEventListener('click', () => this.exportCSV());
        document.getElementById('btn-export-pdf')?.addEventListener('click', () => this.exportPDF());
        
        // New Route & Save Route
        document.getElementById('btn-new-route')?.addEventListener('click', () => this.handleNewRoute());
        document.getElementById('btn-save-route')?.addEventListener('click', () => this.handleSaveRoute());

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
    
    async handleAnalysis() {
        const from = document.getElementById('real-from').value;
        const to = document.getElementById('real-to').value;
        const currency = document.getElementById('real-currency').value;
        const value = document.getElementById('real-value').value;
        const mode = document.getElementById('real-mode').value;
        
        if(!from || !to) {
            SmoothToast.warning("Please select both origin and destination.");
            return;
        }
        
        const btn = document.getElementById('btn-analyze');
        const originalText = btn.innerHTML;
        btn.innerHTML = 'Analyzing...';
        btn.disabled = true;
        
        try {
            const response = await fetch('/api/analyze-shipment', {
                method: 'POST',
                body: JSON.stringify({ 
                    from_country: from, 
                    to_country: to, 
                    currency: currency,
                    preferred_mode: mode 
                })
            });
            
            const data = await response.json();
            if(data.error) {
                SmoothToast.error(data.error);
                return;
            }
            
            // Fix undefined Risk issue by ensuring riskLevel is passed or defaulting
            // The backend returns risk_summary which has combined_level
            // But we iterate over analysis modes
            
            // Enrich analysis data with global risk summary if missing specific risk
            Object.values(data.analysis).forEach(opt => {
                if(!opt.risk_level) opt.risk_level = data.risk_summary.combined_level;
            });

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
            
            SmoothToast.success("Analysis completed successfully!");
            
        } catch(e) {
            console.error(e);
            SmoothToast.error("Analysis failed. Please try again.");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    renderAnalysisResults(data, preferredMode) {
        // 1. Update Comparison List (Sidebar)
        const container = document.getElementById('comparison-result');
        const list = document.getElementById('mode-list');
        container.classList.remove('hidden');
        list.innerHTML = '';
        
        // Find Best Option for highlighting
        let bestMode = 'sea'; 
        // Simple heuristic: Lowest Cost
        let minCost = Infinity;
        
        Object.values(data.analysis).forEach(opt => {
             if(opt.cost_usd < minCost) {
                 minCost = opt.cost_usd;
                 bestMode = opt.mode.toLowerCase();
             }
        });

        for (const [key, info] of Object.entries(data.analysis)) {
            const isBest = key === bestMode;
            const isSelected = key === preferredMode;
            const currencySymbol = this.getCurrencySymbol(info.currency);
            
            let highlightClass = 'bg-white/5 border-white/10';
            if (isSelected) highlightClass = 'bg-indigo-500/20 border-indigo-500/50 shadow-lg shadow-indigo-500/10';
            else if (isBest) highlightClass = 'bg-emerald-500/10 border-emerald-500/30';

            const div = document.createElement('div');
            div.className = `p-3 rounded-lg border ${highlightClass} hover:bg-white/10 transition cursor-pointer`;
            div.innerHTML = `
                <div class="flex justify-between items-center mb-1">
                    <span class="font-bold text-white text-sm flex items-center gap-2">
                        ${key === 'air' ? '✈️' : key === 'sea' ? '🚢' : '🚛'} ${info.mode}
                        ${isBest ? '<span class="text-[9px] bg-emerald-500 text-black px-1 rounded font-bold">CHEAPEST</span>' : ''}
                        ${isSelected ? '<span class="text-[9px] bg-indigo-500 text-white px-1 rounded font-bold">SELECTED</span>' : ''}
                    </span>
                    <span class="text-xs text-gray-400">${info.estimated_days} Days</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-emerald-400 font-mono text-xs">${currencySymbol}${info.cost.toLocaleString()}</span>
                    <span class="text-[10px] ${info.risk_level === 'High' ? 'text-red-400' : 'text-gray-500'}">${info.risk_level} Risk</span>
                </div>
            `;
            // Add click handler to select this mode details?
            list.appendChild(div);
        }

        const modesArray = Object.values(data.analysis);

        // 2. Update Map
        if (this.map && data.coordinates) {
            const tempRoute = {
                id: 'real-time-1',
                from: data.from,
                to: data.to,
                coordinates: {
                    start: [data.coordinates.start[0], data.coordinates.start[1]],
                    end: [data.coordinates.end[0], data.coordinates.end[1]]
                }
            };
            this.map.renderRoutes([tempRoute]);
            this.map.highlightRoute('real-time-1');
        }
        
        const originScore = typeof data.risk_summary.origin_score === 'number' ? data.risk_summary.origin_score : null;
        const destinationScore = typeof data.risk_summary.destination_score === 'number' ? data.risk_summary.destination_score : null;
        let avgRisk = null;
        if (originScore !== null && destinationScore !== null) {
            avgRisk = (originScore + destinationScore) / 2;
        }

        UI.updateBadge('risk-badge', data.risk_summary.combined_level);

        let selectedMode = data.analysis[preferredMode] || data.analysis[bestMode] || modesArray[0];
        let minCostMode = selectedMode;
        let minDaysMode = selectedMode;
        if (modesArray.length > 0) {
            minCostMode = modesArray.reduce((a, b) => (a.cost < b.cost ? a : b), modesArray[0]);
            minDaysMode = modesArray.reduce((a, b) => (a.estimated_days < b.estimated_days ? a : b), modesArray[0]);
        }

        let costEfficiency = null;
        if (minCostMode && selectedMode && typeof selectedMode.cost === 'number' && selectedMode.cost > 0) {
            const ratio = minCostMode.cost / selectedMode.cost;
            costEfficiency = Math.max(1, Math.min(10, ratio * 10));
        }

        let timeEfficiency = null;
        if (minDaysMode && selectedMode && typeof selectedMode.estimated_days === 'number' && selectedMode.estimated_days > 0) {
            const ratio = minDaysMode.estimated_days / selectedMode.estimated_days;
            timeEfficiency = Math.max(1, Math.min(10, ratio * 10));
        }

        let riskSafety = null;
        if (avgRisk !== null) {
            riskSafety = Math.max(1, Math.min(10, 10 - avgRisk));
        }

        const components = [];
        if (typeof costEfficiency === 'number') components.push(costEfficiency);
        if (typeof riskSafety === 'number') components.push(riskSafety);
        if (typeof timeEfficiency === 'number') components.push(timeEfficiency);

        let overallRating = 3;
        let overallScoreVal = 0;

        if (components.length > 0) {
            const avg = components.reduce((a, b) => a + b, 0) / components.length;
            overallScoreVal = avg;
            overallRating = Math.max(1, Math.min(5, avg / 2));
        }

        const riskEl = document.getElementById('risk-score');
        if (riskEl) {
            riskEl.textContent = overallScoreVal.toFixed(1);
            // Dynamic color based on score
            riskEl.className = 'text-4xl md:text-5xl font-black tracking-tighter ' + 
                (overallScoreVal >= 7 ? 'text-emerald-400' : overallScoreVal >= 4 ? 'text-yellow-400' : 'text-red-400');
        }

        this.updateMainScoreCard({
            costEfficiency,
            riskSafety,
            timeEfficiency,
            overallRating
        });

        this.updateWhyThisScore(data, {
            originScore,
            destinationScore,
            avgRisk,
            selectedMode,
            minCostMode,
            minDaysMode
        });
        
        // 4. Update News Feed
        // Trigger news fetch for the route
        const newsContainer = document.getElementById('news-feed');
        newsContainer.innerHTML = '<div class="p-4 text-center text-xs text-gray-500">Fetching live intelligence...</div>';
        
        const queryParams = new URLSearchParams({
            route: `${data.from} to ${data.to}`,
            location: data.to
        });
        
        fetch(`/api/news?${queryParams}`)
            .then(res => res.json())
            .then(news => {
                newsContainer.innerHTML = '';
                news.slice(0, 10).forEach(item => {
                     // Reuse render logic or simple append
                     const div = document.createElement('div');
                     div.className = 'p-3 bg-white/5 rounded-lg border border-white/10 mb-2';
                     div.innerHTML = `<h4 class="text-xs font-bold text-gray-200">${item.title}</h4><p class="text-[10px] text-gray-500">${item.summary.substring(0,80)}...</p>`;
                     newsContainer.appendChild(div);
                });
            });
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

        whyEl.textContent = `AI classified the ${fromLabel} → ${toLabel} corridor as ${level} risk with an average score of ${avgRiskText}/10 (origin ${originScoreText}, destination ${destinationScoreText}).`;

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
                if (r.score < minScore) {
                    minScore = r.score;
                    bestRoute = r;
                }
            });

            const bestEl = document.getElementById('stat-best-profit');
            if (bestEl && bestRoute) {
                bestEl.textContent = `${bestRoute.from} -> ${bestRoute.to}`;
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

    updateRiskDrivers() {
        // Mock values for drivers (would come from API in prod)
        const drivers = {
            'fuel': { val: 7.8, color: 'bg-indigo-500' },
            'politics': { val: 4.2, color: 'bg-green-500' },
            'labor': { val: 6.5, color: 'bg-yellow-500' },
            'sanctions': { val: 8.9, color: 'bg-red-500' }
        };

        for (const [key, data] of Object.entries(drivers)) {
            const bar = document.getElementById(`factor-${key}`);
            const labelContainer = bar?.parentElement?.previousElementSibling;
            
            if (bar && labelContainer) {
                // Animate Width
                setTimeout(() => {
                    bar.style.width = `${data.val * 10}%`;
                }, 500);

                // Add Numeric Label
                // Remove existing if any
                const existing = labelContainer.querySelector('.driver-score');
                if(existing) existing.remove();

                const valSpan = document.createElement('span');
                valSpan.className = 'font-mono font-bold text-white driver-score';
                valSpan.textContent = data.val.toFixed(1);
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
