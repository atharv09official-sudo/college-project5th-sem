/**
 * SUPPLYGUARD AI - SMART TRADE ROUTE OPTIMIZATION SYSTEM
 * Interactive Multi-Criteria Decision Engine & Real-Time Telemetry Bridge
 */

import { MapCN } from './mapcn.js';
import { SmoothDropdown } from './smooth-dropdown.js';

let networkNodes = [];
let networkCorridors = [];
let currentOptimizationResult = null;
let currentHighlightedRoute = null;
let mapcn = null;

// DOM Elements
const originSelect = document.getElementById('origin-select');
const destSelect = document.getElementById('destination-select');
const weightInput = document.getElementById('weight-input');
const tonIndicator = document.getElementById('ton-indicator');
const volumeInput = document.getElementById('volume-input');
const vehicleSelect = document.getElementById('vehicle-select');
const vehicleSpecsHint = document.getElementById('vehicle-specs-hint');
const deadlineInput = document.getElementById('deadline-input');

const sliderTime = document.getElementById('slider-time');
const sliderCost = document.getElementById('slider-cost');
const sliderDist = document.getElementById('slider-dist');
const sliderRisk = document.getElementById('slider-risk');
const lblTime = document.getElementById('lbl-weight-time');
const lblCost = document.getElementById('lbl-weight-cost');
const lblDist = document.getElementById('lbl-weight-dist');
const lblRisk = document.getElementById('lbl-weight-risk');
const btnNormalize = document.getElementById('btn-normalize-weights');

const optForm = document.getElementById('optimization-form');
const btnSubmit = document.getElementById('btn-submit-optimize');
const btnText = document.getElementById('btn-text');

// Hover & Breadcrumb
const hoverInfo = document.getElementById('hover-node-info');
const breadcrumbSteps = document.getElementById('breadcrumb-steps');

// Recommendation Cards
const recRouteName = document.getElementById('rec-route-name');
const recAlgoBadge = document.getElementById('rec-algo-badge');
const recDist = document.getElementById('rec-dist');
const recTime = document.getElementById('rec-time');
const recCost = document.getElementById('rec-cost');
const recRisk = document.getElementById('rec-risk');
const recExplanation = document.getElementById('rec-explanation');
const costFuel = document.getElementById('cost-fuel');
const costToll = document.getElementById('cost-toll');
const costDriver = document.getElementById('cost-driver');
const costMaint = document.getElementById('cost-maint');
const warningsBox = document.getElementById('warnings-box');

// ML Analytics
const mlDelayVal = document.getElementById('ml-delay-val');
const mlRiskTier = document.getElementById('ml-risk-tier');
const mlFuelBurn = document.getElementById('ml-fuel-burn');

// Matrix & History
const comparisonTbody = document.getElementById('comparison-tbody');
const historyContainer = document.getElementById('history-container');
const btnRefreshHistory = document.getElementById('btn-refresh-history');
const btnExportCsv = document.getElementById('btn-export-csv');
const btnExportTxt = document.getElementById('btn-export-txt');

// Tab and Live Dashboard Telemetry Elements
const tabBtnOptimizer = document.getElementById('tab-btn-optimizer');
const tabBtnDashboard = document.getElementById('tab-btn-dashboard');
const tabViewOptimizer = document.getElementById('tab-view-optimizer');
const tabViewDashboard = document.getElementById('tab-view-dashboard');
const btnSyncDashboardNow = document.getElementById('btn-sync-dashboard-now');
const btnQuickResync = document.getElementById('btn-quick-resync');
const headerSyncStatus = document.getElementById('header-sync-status');

const dashCorridorFrom = document.getElementById('dash-corridor-from');
const dashCorridorTo = document.getElementById('dash-corridor-to');
const dashRiskBadge = document.getElementById('dash-risk-badge');
const dashRiskLevel = document.getElementById('dash-risk-level');
const dashModeBadge = document.getElementById('dash-mode-badge');
const dashValueDisplay = document.getElementById('dash-value-display');
const dashCurrencyDisplay = document.getElementById('dash-currency-display');
const dashFeasibilityPill = document.getElementById('dash-feasibility-pill');
const dashModalMatrix = document.getElementById('dash-modal-matrix');
const dashFuelGrid = document.getElementById('dash-fuel-grid');
const dashNewsFeed = document.getElementById('dash-news-feed');
const dashNewsCount = document.getElementById('dash-news-count');

// ==========================================
// 1. Initial Load & Setup
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    setupSliders();
    setupWeightIndicator();
    setupVehicleHints();
    setupTabs();

    // 0. Auto-initialize custom smooth dropdowns
    SmoothDropdown.initAll();

    // 1. Load data first so form dropdowns and history are immediately functional
    await loadNetworkData();
    await loadHistory();

    // 2. Reactive origin/destination selection updates
    const updateBreadcrumb = () => {
        if (!originSelect || !destSelect || !breadcrumbSteps) return;
        const uText = originSelect.options[originSelect.selectedIndex]?.textContent || originSelect.value;
        const vText = destSelect.options[destSelect.selectedIndex]?.textContent || destSelect.value;
        if (originSelect.value && destSelect.value) {
            breadcrumbSteps.innerHTML = `<span class="text-emerald-300 font-bold font-mono">${uText}</span> <span class="text-gray-400">➔</span> <span class="text-rose-300 font-bold font-mono">${vText}</span> <span class="text-[10px] text-gray-500 font-normal ml-1.5">(Optimized)</span>`;
        }
    };

    const onSelectionChange = () => {
        if (mapcn) {
            mapcn.highlightSelection(originSelect.value, destSelect.value);
        }
        updateBreadcrumb();
    };
    originSelect.addEventListener('change', onSelectionChange);
    destSelect.addEventListener('change', onSelectionChange);

    // 3. Mount mapcn Map Component
    try {
        mapcn = new MapCN('mapcn-trade-map', {
            center: [73.5, 18.9],
            zoom: 7.4,
            pitch: 0
        });
        await mapcn.init();
        if (networkNodes.length > 0) {
            mapcn.setNetwork(networkNodes, networkCorridors);
        }
        mapcn.highlightSelection(originSelect.value, destSelect.value);
        updateBreadcrumb();

        // Safety layout synchronization
        setTimeout(() => {
            mapcn.map?.resize();
            mapcn.highlightSelection(originSelect.value, destSelect.value);
            updateBreadcrumb();
        }, 200);
    } catch (e) {
        console.warn('[trade-routes] mapcn init error:', e);
    }

    // 4. Auto-execute initial optimization so the right panel is populated immediately on page load
    await executeOptimization({ silent: true });

    // 5. Hydrate Live Dashboard telemetry tab from live session and APIs
    await loadLiveDashboardData();
});

// ==========================================
// 2. Load Road Network Data (Module 2)
// ==========================================
async function loadNetworkData() {
    try {
        const res = await fetch('/api/v1/trade-routes/network-nodes');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        networkNodes = data.nodes || [];
        networkCorridors = data.corridors || [];

        // Populate dropdowns with categorized visual assets (Warehouse 🏭 vs Store 🏬)
        originSelect.innerHTML = '<option value="">Select Origin Warehouse / Terminal</option>';
        destSelect.innerHTML = '<option value="">Select Destination Retail Store / Hub</option>';

        const getRoleIcon = (node) => {
            if (node.hub_type === 'PORT' || (node.id || '').includes('PORT') || (node.id || '').includes('JNPT')) return '⚓';
            if (node.hub_type === 'GHAT_PASS' || (node.id || '').includes('KASARA') || (node.id || '').includes('KHANDALA')) return '⛰️';
            if (node.hub_type === 'LOGISTICS_HUB' || node.hub_type === 'INDUSTRIAL_HUB' || node.hub_type === 'DRY_PORT' || (node.id || '').includes('BHIWANDI') || (node.id || '').includes('CHAKAN')) return '🏭';
            return '🏬';
        };

        networkNodes.forEach(node => {
            const icon = getRoleIcon(node);
            const opt1 = document.createElement('option');
            opt1.value = node.id;
            opt1.textContent = `${icon} ${node.name} (${node.city})`;
            originSelect.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = node.id;
            opt2.textContent = `${icon} ${node.name} (${node.city})`;
            destSelect.appendChild(opt2);
        });

        // Set realistic defaults (Bhiwandi Central Warehouse -> Pune Logistics Store)
        originSelect.value = 'MUM_BHIWANDI';
        destSelect.value = 'PUNE_CITY';

        // Refresh custom smooth dropdowns with newly populated network hubs
        if (originSelect._smoothDropdown) originSelect._smoothDropdown.refresh();
        if (destSelect._smoothDropdown) destSelect._smoothDropdown.refresh();
        if (vehicleSelect._smoothDropdown) vehicleSelect._smoothDropdown.refresh();

        if (mapcn) {
            mapcn.setNetwork(networkNodes, networkCorridors);
            mapcn.highlightSelection(originSelect.value, destSelect.value);
        }
    } catch (err) {
        showToast(`Failed to load network hubs: ${err.message}`, 'error');
    }
}

// ==========================================
// 3. Sliders & Dynamic Weight Handling
// ==========================================
function setupSliders() {
    if (!sliderTime || !sliderCost || !sliderDist || !sliderRisk) return;

    const updateLabels = () => {
        if (lblTime) lblTime.textContent = `${sliderTime.value}%`;
        if (lblCost) lblCost.textContent = `${sliderCost.value}%`;
        if (lblDist) lblDist.textContent = `${sliderDist.value}%`;
        if (lblRisk) lblRisk.textContent = `${sliderRisk.value}%`;
    };

    [sliderTime, sliderCost, sliderDist, sliderRisk].forEach(slider => {
        if (slider) slider.addEventListener('input', updateLabels);
    });

    if (btnNormalize) {
        btnNormalize.addEventListener('click', () => {
            const sum = parseFloat(sliderTime.value) + parseFloat(sliderCost.value) + parseFloat(sliderDist.value) + parseFloat(sliderRisk.value);
            if (sum > 0) {
                sliderTime.value = Math.round((parseFloat(sliderTime.value) / sum) * 100);
                sliderCost.value = Math.round((parseFloat(sliderCost.value) / sum) * 100);
                sliderDist.value = Math.round((parseFloat(sliderDist.value) / sum) * 100);
                sliderRisk.value = 100 - (parseInt(sliderTime.value) + parseInt(sliderCost.value) + parseInt(sliderDist.value));
                updateLabels();
                showToast('Weights normalized to 100%', 'info');
            }
        });
    }
}

function setupWeightIndicator() {
    weightInput.addEventListener('input', () => {
        const kg = parseFloat(weightInput.value) || 0;
        tonIndicator.textContent = `${(kg / 1000.0).toFixed(2)} T`;
    });
}

function setupVehicleHints() {
    const hints = {
        'LCV_TATA_ACE': 'Max Payload: 1.5 Tons | Max Volume: 8.5 m³ | 14.5 km/l',
        'MCV_EICHER_14T': 'Max Payload: 5.0 Tons | Max Volume: 24.0 m³ | 7.8 km/l',
        'HCV_BHARATBENZ_16T': 'Max Payload: 16.0 Tons | Max Volume: 45.0 m³ | 4.5 km/l',
        'TRAILER_40FT': 'Max Payload: 32.0 Tons | Max Volume: 80.0 m³ | 3.2 km/l (Ghat restricted)',
        'EV_CARGO_VAN': 'Max Payload: 1.0 Tons | Max Volume: 6.0 m³ | Zero Emission EV'
    };

    vehicleSelect.addEventListener('change', () => {
        vehicleSpecsHint.textContent = hints[vehicleSelect.value] || '';
    });
}

// ==========================================
// 4. Tab Switching & Live Telemetry Controls
// ==========================================
function setupTabs() {
    if (!tabBtnOptimizer || !tabBtnDashboard) return;

    const selectTab = (activeTab) => {
        if (activeTab === 'optimizer') {
            tabBtnOptimizer.className = 'flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 bg-indigo-600 text-white shadow-md shadow-indigo-600/30';
            tabBtnDashboard.className = 'flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition flex items-center justify-center gap-2';
            tabViewOptimizer?.classList.remove('hidden');
            tabViewDashboard?.classList.add('hidden');
        } else {
            tabBtnDashboard.className = 'flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 bg-emerald-600 text-white shadow-md shadow-emerald-600/30';
            tabBtnOptimizer.className = 'flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition flex items-center justify-center gap-2';
            tabViewDashboard?.classList.remove('hidden');
            tabViewOptimizer?.classList.add('hidden');
            loadLiveDashboardData();
        }
    };

    tabBtnOptimizer.addEventListener('click', () => selectTab('optimizer'));
    tabBtnDashboard.addEventListener('click', () => selectTab('dashboard'));

    btnSyncDashboardNow?.addEventListener('click', () => loadLiveDashboardData(true));
    btnQuickResync?.addEventListener('click', () => loadLiveDashboardData(true));
}

// ==========================================
// 5. Route Optimization Executor
// ==========================================
async function executeOptimization(options = {}) {
    const origin = originSelect?.value || 'MUM_BHIWANDI';
    const dest = destSelect?.value || 'PUNE_CITY';
    const weightKg = parseFloat(weightInput?.value) || 3500;
    const volumeM3 = parseFloat(volumeInput?.value) || 14.0;
    const vehicle = vehicleSelect?.value || 'MCV_EICHER_14T';
    const deadlineHours = deadlineInput?.value ? parseFloat(deadlineInput.value) : null;

    if (!origin || !dest) {
        if (!options.silent) showToast('Please select both Origin and Destination hubs.', 'warning');
        return;
    }
    if (origin === dest) {
        if (!options.silent) showToast('Origin and Destination cannot be the same hub.', 'warning');
        return;
    }

    let wTime = 0.35, wCost = 0.35, wDist = 0.15, wRisk = 0.15;
    if (sliderTime && sliderCost && sliderDist && sliderRisk) {
        const sumWeights = parseFloat(sliderTime.value) + parseFloat(sliderCost.value) + parseFloat(sliderDist.value) + parseFloat(sliderRisk.value);
        const norm = sumWeights > 0 ? sumWeights : 100.0;
        wTime = parseFloat(sliderTime.value) / norm;
        wCost = parseFloat(sliderCost.value) / norm;
        wDist = parseFloat(sliderDist.value) / norm;
        wRisk = parseFloat(sliderRisk.value) / norm;
    }

    if (btnSubmit) btnSubmit.disabled = true;
    if (btnText) btnText.textContent = 'Computing Dijkstra & A* Paths...';

    try {
        const payload = {
            origin: origin,
            destination: dest,
            shipment_weight_kg: weightKg,
            shipment_volume_m3: volumeM3,
            vehicle_type: vehicle,
            delivery_deadline_hours: deadlineHours,
            weight_time: wTime,
            weight_cost: wCost,
            weight_dist: wDist,
            weight_risk: wRisk
        };

        const res = await fetch('/api/v1/trade-routes/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || `Server returned ${res.status}`);
        }

        const data = await res.json();
        currentOptimizationResult = data;
        renderOptimizationResults(data);
        if (!options.silent) {
            showToast('Route optimization completed successfully!', 'success');
        }
        await loadHistory();
    } catch (err) {
        if (!options.silent) {
            showToast(err.message, 'error');
        }
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
        if (btnText) btnText.textContent = 'Execute Dijkstra & A* Optimization';
    }
}

optForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await executeOptimization({ silent: false });
});

// ==========================================
// 6. Render Optimization Results
// ==========================================
function renderOptimizationResults(data) {
    const rec = data.recommended_route;
    const ranked = data.ranked_routes || [];
    const ml = data.predictive_analytics || {};

    if (!rec) return;

    // 1. Recommended Route Card
    if (recRouteName) recRouteName.textContent = rec.name;
    if (recAlgoBadge) recAlgoBadge.textContent = `${rec.algorithm} Algorithm`;
    if (recDist) recDist.textContent = `${rec.distance_km.toFixed(1)} km`;
    if (recTime) recTime.textContent = `${rec.travel_time_hours.toFixed(1)} h`;
    if (recCost) recCost.textContent = `₹${Math.round(rec.total_cost_inr).toLocaleString('en-IN')}`;
    if (recRisk) recRisk.textContent = `${rec.risk_score.toFixed(1)} / 10`;

    if (recExplanation) {
        recExplanation.textContent = rec.explanation || 'Optimal compromise across travel time, fuel expenditure, and corridor reliability.';
    }

    const cb = rec.cost_breakdown || {};
    if (costFuel) costFuel.textContent = `₹${(cb.fuel_cost_inr || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    if (costToll) costToll.textContent = `₹${(cb.toll_charges_inr || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    if (costDriver) costDriver.textContent = `₹${(cb.driver_cost_inr || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    if (costMaint) costMaint.textContent = `₹${(cb.maintenance_cost_inr || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

    // Warnings Box
    if (rec.warnings && rec.warnings.length > 0) {
        warningsBox?.classList.remove('hidden');
        if (warningsBox) {
            warningsBox.innerHTML = `
                <div class="font-semibold mb-1 flex items-center gap-1">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    Corridor & Operational Warnings
                </div>
                <ul class="list-disc pl-4 space-y-0.5">
                    ${rec.warnings.map(w => `<li>${w}</li>`).join('')}
                </ul>
            `;
        }
    } else {
        warningsBox?.classList.add('hidden');
    }

    // 2. Predictive Analytics Card
    if (mlDelayVal) mlDelayVal.textContent = `${ml.predicted_delay_minutes || 0} min`;
    if (mlRiskTier) mlRiskTier.textContent = ml.delay_risk_category || 'LOW';
    if (mlFuelBurn) mlFuelBurn.textContent = `${(ml.fuel_multiplier || 1.0).toFixed(2)}x`;

    // 3. Breadcrumb
    if (breadcrumbSteps) {
        breadcrumbSteps.textContent = (rec.path_names || []).join(' ➔ ');
    }

    // 4. Comparison Table
    if (comparisonTbody) {
        comparisonTbody.innerHTML = '';
        ranked.forEach((r) => {
            const tr = document.createElement('tr');
            tr.className = r.is_recommended
                ? 'bg-indigo-950/30 font-medium hover:bg-white/5 cursor-pointer border-l-2 border-indigo-500'
                : 'hover:bg-white/5 cursor-pointer';

            tr.innerHTML = `
                <td class="flex items-center gap-1.5 py-2">
                    <span class="w-1.5 h-1.5 rounded-full ${r.is_recommended ? 'bg-indigo-400' : 'bg-gray-500'}"></span>
                    <span class="${r.is_recommended ? 'text-indigo-300 font-semibold' : 'text-gray-200'}">${r.name}</span>
                </td>
                <td class="font-mono text-gray-300">${r.distance_km.toFixed(1)}k</td>
                <td class="font-mono text-sky-300">${r.travel_time_hours.toFixed(1)}h</td>
                <td class="font-mono text-emerald-300">₹${Math.round(r.total_cost_inr).toLocaleString('en-IN')}</td>
                <td class="font-mono text-gray-400">${(r.multi_objective_score || 0).toFixed(3)}</td>
            `;

            tr.addEventListener('click', () => {
                currentHighlightedRoute = r;
                if (mapcn) {
                    mapcn.selectCandidateRoute(r);
                }
                updateRouteHud(r);
                if (breadcrumbSteps) {
                    breadcrumbSteps.textContent = (r.path_names || []).join(' ➔ ');
                }
            });

            comparisonTbody.appendChild(tr);
        });
    }

    currentHighlightedRoute = rec;
    if (mapcn) {
        mapcn.setOptimizationRoutes(rec, ranked);
    }
    updateRouteHud(rec);
}

function updateRouteHud(r) {
    const hud = document.getElementById('mapcn-route-hud');
    if (!hud || !r) return;
    hud.classList.remove('hidden');
    const hudCode = document.getElementById('hud-route-code');
    const hudName = document.getElementById('hud-route-name');
    const hudDist = document.getElementById('hud-dist');
    const hudTime = document.getElementById('hud-time');
    const hudCost = document.getElementById('hud-cost');
    const hudRisk = document.getElementById('hud-risk');

    if (hudCode) hudCode.textContent = r.algorithm || (r.is_recommended ? 'Recommended' : 'Alternative');
    if (hudName) hudName.textContent = r.name;
    if (hudDist) hudDist.textContent = `${r.distance_km.toFixed(1)} km`;
    if (hudTime) hudTime.textContent = `${r.travel_time_hours.toFixed(1)} h`;
    if (hudCost) hudCost.textContent = `₹${Math.round(r.total_cost_inr).toLocaleString('en-IN')}`;
    if (hudRisk) hudRisk.textContent = `${r.risk_score.toFixed(1)} / 10`;
}

// Global Hub Fast Pickers for @mapcn/map Popups
window.setAsOrigin = (nodeId) => {
    if (originSelect) {
        originSelect.value = nodeId;
        originSelect.dispatchEvent(new Event('change'));
        showToast(`Origin set to: ${nodeId}`, 'info');
    }
};

window.setAsDestination = (nodeId) => {
    if (destSelect) {
        destSelect.value = nodeId;
        destSelect.dispatchEvent(new Event('change'));
        showToast(`Destination set to: ${nodeId}`, 'info');
    }
};

// ==========================================
// 7. Interactive Vector Map Controls
// ==========================================
document.getElementById('btn-zoom-reset')?.addEventListener('click', () => {
    if (mapcn) {
        mapcn.resetView();
    }
});

// ==========================================
// 8. Report Export Handlers
// ==========================================
btnExportCsv?.addEventListener('click', async () => {
    if (!currentOptimizationResult) {
        showToast('Please run an optimization first before exporting.', 'warning');
        return;
    }
    try {
        const res = await fetch('/api/v1/trade-routes/export-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                optimization_result: currentOptimizationResult,
                format: 'csv'
            })
        });
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Trade_Route_Matrix_${Date.now()}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        showToast('Comparison CSV downloaded.', 'success');
    } catch (err) {
        showToast(`Export error: ${err.message}`, 'error');
    }
});

btnExportTxt?.addEventListener('click', async () => {
    if (!currentOptimizationResult) {
        showToast('Please run an optimization first before exporting.', 'warning');
        return;
    }
    try {
        const res = await fetch('/api/v1/trade-routes/export-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                optimization_result: currentOptimizationResult,
                format: 'txt'
            })
        });
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Trade_Route_Summary_${Date.now()}.txt`;
        a.click();
        window.URL.revokeObjectURL(url);
        showToast('Route summary report downloaded.', 'success');
    } catch (err) {
        showToast(`Export error: ${err.message}`, 'error');
    }
});

// ==========================================
// 9. History Loader
// ==========================================
async function loadHistory() {
    try {
        const res = await fetch('/api/v1/trade-routes/history?limit=5');
        if (!res.ok) return;
        const data = await res.json();
        const items = data.history || [];

        if (!historyContainer) return;

        if (items.length === 0) {
            historyContainer.innerHTML = '<div class="text-[11px] text-gray-500 italic">No prior optimization requests in session.</div>';
            return;
        }

        historyContainer.innerHTML = '';
        items.forEach(h => {
            const div = document.createElement('div');
            div.className = 'p-2 rounded bg-white/5 border border-white/5 hover:border-indigo-500/40 cursor-pointer transition flex items-center justify-between text-xs';
            div.innerHTML = `
                <div>
                    <div class="font-medium text-white">${h.origin} ➔ ${h.destination}</div>
                    <div class="text-[10px] text-gray-400 font-mono">${(h.shipment_weight_kg / 1000.0).toFixed(1)}T • ${h.vehicle_type}</div>
                </div>
                <div class="text-right font-mono">
                    <div class="text-indigo-400 font-bold">${h.recommended_route ? `${h.recommended_route.distance_km.toFixed(0)} km` : '--'}</div>
                    <div class="text-[10px] text-gray-500">${h.recommended_route ? `${h.recommended_route.travel_time_hours.toFixed(1)}h` : ''}</div>
                </div>
            `;
            div.addEventListener('click', async () => {
                const detailRes = await fetch(`/api/v1/trade-routes/history/${h.request_code}`);
                if (detailRes.ok) {
                    showToast(`Loaded historical request: ${h.request_code}`, 'info');
                }
            });
            historyContainer.appendChild(div);
        });
    } catch (err) {
        console.error('Failed to load history:', err);
    }
}

btnRefreshHistory?.addEventListener('click', loadHistory);

// ==========================================
// 10. Live Dashboard Telemetry Synchronization
// ==========================================
async function loadLiveDashboardData(showFeedback = false) {
    try {
        if (headerSyncStatus) {
            headerSyncStatus.textContent = 'Syncing Live Telemetry...';
        }

        // 1. Check localStorage for current shipment context or saved routes
        let context = null;
        try {
            const rawContext = localStorage.getItem('current_route_context');
            if (rawContext) context = JSON.parse(rawContext);
        } catch (e) {}

        let formData = null;
        try {
            const rawForm = localStorage.getItem('shipment_form_data');
            if (rawForm) formData = JSON.parse(rawForm);
        } catch (e) {}

        // 2. Fetch active corridors from /api/routes if context is missing
        let activeRoute = null;
        try {
            const routesRes = await fetch('/api/routes');
            if (routesRes.ok) {
                const routesList = await routesRes.json();
                if (Array.isArray(routesList) && routesList.length > 0) {
                    activeRoute = routesList[0];
                }
            }
        } catch (e) {}

        const fromCountry = context?.from || formData?.from || activeRoute?.from || 'India';
        const toCountry = context?.to || formData?.to || activeRoute?.to || 'Netherlands';
        const preferredMode = context?.preferred_mode || formData?.mode || activeRoute?.transport_mode || 'sea';
        const currency = context?.currency || formData?.currency || activeRoute?.currency || 'USD';
        const cargoValue = context?.value || formData?.value || '10,000';

        if (dashCorridorFrom) dashCorridorFrom.textContent = fromCountry;
        if (dashCorridorTo) dashCorridorTo.textContent = toCountry;
        if (dashModeBadge) dashModeBadge.textContent = `${preferredMode.toUpperCase()} FREIGHT`;
        if (dashValueDisplay) dashValueDisplay.textContent = cargoValue ? `${currency === 'USD' ? '$' : '₹'}${Number(cargoValue).toLocaleString()}` : '$10,000';
        if (dashCurrencyDisplay) dashCurrencyDisplay.textContent = currency;

        // Fetch /api/analyze-shipment to get exact multi-modal breakdown and live risk
        let analysisData = null;
        try {
            const anaRes = await fetch('/api/analyze-shipment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from_country: fromCountry,
                    to_country: toCountry,
                    preferred_mode: preferredMode,
                    currency: currency
                })
            });
            if (anaRes.ok) {
                analysisData = await anaRes.json();
            }
        } catch (e) {}

        // Populate Risk Score Badge
        const riskSummary = analysisData?.risk_summary || context?.risk_summary || (activeRoute ? { combined_level: activeRoute.riskLevel || 'Low', origin_score: activeRoute.risk_score || 2.1 } : null);
        if (riskSummary) {
            const score = riskSummary.origin_score || riskSummary.composite_score || 2.1;
            const level = riskSummary.combined_level || 'Low';
            if (dashRiskBadge) dashRiskBadge.textContent = `${score.toFixed(1)} / 10`;
            if (dashRiskLevel) {
                dashRiskLevel.textContent = `${level} Risk`;
                dashRiskLevel.className = level.toLowerCase().includes('high') ? 'text-[9px] text-rose-400 font-semibold' : (level.toLowerCase().includes('medium') ? 'text-[9px] text-amber-400 font-semibold' : 'text-[9px] text-emerald-400 font-semibold');
            }
        }

        // Populate Multi-modal Matrix
        if (dashModalMatrix) {
            const modes = analysisData?.analysis || {
                sea: { cost: 3400, days: 18, risk_level: 'Low', description: 'Deep-sea container transit' },
                air: { cost: 7800, days: 2.5, risk_level: 'Low', description: 'Express air cargo' },
                road: { cost: 4200, days: 10, risk_level: 'Medium', description: 'Multimodal landbridge' }
            };

            dashModalMatrix.innerHTML = Object.entries(modes).map(([mKey, mVal]) => {
                const isSelected = mKey.toLowerCase() === preferredMode.toLowerCase();
                const icon = mKey === 'sea' ? '🚢' : (mKey === 'air' ? '✈️' : '🚛');
                const badgeColor = (mVal.risk_level || 'Low').toLowerCase().includes('high') ? 'text-rose-400' : ((mVal.risk_level || 'Low').toLowerCase().includes('medium') ? 'text-amber-400' : 'text-emerald-400');
                return `
                    <div class="p-2 rounded-lg border ${isSelected ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/5 bg-[#18181b]'} flex items-center justify-between text-xs">
                        <div class="flex items-center gap-2">
                            <span>${icon}</span>
                            <div>
                                <div class="font-medium text-white flex items-center gap-1.5">
                                    <span class="capitalize">${mKey} Freight</span>
                                    ${isSelected ? '<span class="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">ACTIVE</span>' : ''}
                                </div>
                                <div class="text-[10px] text-gray-400">${mVal.days || '--'} days transit</div>
                            </div>
                        </div>
                        <div class="text-right font-mono">
                            <div class="font-bold text-white">${currency === 'USD' ? '$' : '₹'}${Number(mVal.cost || 0).toLocaleString()}</div>
                            <div class="text-[10px] ${badgeColor}">${mVal.risk_level || 'Low'}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // 3. Fetch Google RSS Fuel Benchmarks
        try {
            const fuelRes = await fetch('/api/fuel-benchmarks');
            if (fuelRes.ok) {
                const fuelData = await fuelRes.json();
                const fuels = fuelData.fuels || [];
                if (dashFuelGrid && fuels.length > 0) {
                    dashFuelGrid.innerHTML = fuels.map(f => {
                        const isUp = f.direction === 'up';
                        const changeColor = isUp ? 'text-rose-400' : 'text-emerald-400';
                        const arrow = isUp ? '▲' : '▼';
                        return `
                            <div class="bg-[#18181b] p-2.5 rounded-lg border border-white/5 hover:border-white/10 transition">
                                <div class="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                                    <span class="flex items-center gap-1 truncate font-medium text-gray-200">
                                        <span>${f.icon || '⛽'}</span>
                                        <span class="truncate">${f.name}</span>
                                    </span>
                                    <span class="${changeColor}">${arrow} ${f.change || ''}</span>
                                </div>
                                <div class="text-sm font-bold text-white font-mono">
                                    $${typeof f.price === 'number' ? f.price.toFixed(2) : f.price} <span class="text-[10px] text-gray-400 font-normal">${f.unit || ''}</span>
                                </div>
                                <div class="text-[9px] text-gray-500 truncate mt-0.5" title="${f.headline || f.source}">
                                    ${f.source || 'Google RSS'}
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            }
        } catch (e) {
            console.warn('[trade-routes] fuel benchmarks fetch error:', e);
        }

        // 4. Fetch Live Corridor Intelligence News Stream
        try {
            const newsRes = await fetch(`/api/news?location=${encodeURIComponent(fromCountry)}&route=${encodeURIComponent(toCountry)}`);
            if (newsRes.ok) {
                const newsData = await newsRes.json();
                const articles = Array.isArray(newsData) ? newsData : (newsData.news || newsData.articles || []);
                if (dashNewsFeed) {
                    if (articles.length === 0) {
                        dashNewsFeed.innerHTML = '<div class="text-[11px] text-gray-500 italic py-2">No active hazard alerts for this corridor.</div>';
                    } else {
                        if (dashNewsCount) dashNewsCount.textContent = `${articles.length} Wire Alerts`;
                        dashNewsFeed.innerHTML = articles.slice(0, 5).map(a => `
                            <div class="p-2 rounded bg-white/5 border border-white/5 text-[11px] space-y-1">
                                <div class="font-medium text-white line-clamp-2">${a.title || a.headline}</div>
                                <div class="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                                    <span>${a.source || 'Google RSS'}</span>
                                    <span>${a.published || a.date || 'Recent'}</span>
                                </div>
                            </div>
                        `).join('');
                    }
                }
            }
        } catch (e) {
            console.warn('[trade-routes] news fetch error:', e);
        }

        const nowStr = new Date().toLocaleTimeString();
        if (headerSyncStatus) {
            headerSyncStatus.textContent = `Dashboard Telemetry: Synchronized (${nowStr})`;
        }

        if (showFeedback) {
            showToast('Telemetry refreshed from live dashboard!', 'success');
        }
    } catch (err) {
        console.error('Failed to load live dashboard data:', err);
        if (headerSyncStatus) {
            headerSyncStatus.textContent = 'Dashboard Telemetry: Offline Fallback';
        }
        if (showFeedback) {
            showToast('Telemetry sync failed. Using cached corridor data.', 'warning');
        }
    }
}

// ==========================================
// 11. Toast Notifications
// ==========================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    const borderColors = {
        success: 'border-emerald-500/50 text-emerald-300 bg-[#121214]',
        error: 'border-red-500/50 text-red-300 bg-[#121214]',
        warning: 'border-amber-500/50 text-amber-300 bg-[#121214]',
        info: 'border-indigo-500/50 text-indigo-300 bg-[#121214]'
    };

    toast.className = `p-3 rounded-xl border ${borderColors[type] || borderColors.info} shadow-xl backdrop-blur text-xs flex items-center gap-2 max-w-sm transition transform translate-y-2`;
    toast.textContent = message;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
