/**
 * AI-POWERED SMART TRADE ROUTE OPTIMIZATION SYSTEM
 * Frontend Interactive Controller & mapcn Map Renderer
 * D. Y. Patil Agriculture & Technical University (AIML 2026-27)
 */

import { MapCN } from './mapcn.js';

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

// Modal Elements
const modalAcademic = document.getElementById('modal-academic');
const btnOpenModal = document.getElementById('btn-academic-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnModalOk = document.getElementById('btn-modal-ok');

// ==========================================
// 1. Initial Load & Setup
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    setupSliders();
    setupWeightIndicator();
    setupVehicleHints();
    setupModal();

    // 1. Load data first so form dropdowns and history are immediately functional
    await loadNetworkData();
    await loadHistory();

    // 2. Reactive origin/destination selection updates
    const onSelectionChange = () => {
        if (mapcn) {
            mapcn.highlightSelection(originSelect.value, destSelect.value);
        }
    };
    originSelect.addEventListener('change', onSelectionChange);
    destSelect.addEventListener('change', onSelectionChange);

    // 3. Mount mapcn Map Component
    try {
        mapcn = new MapCN('mapcn-trade-map', {
            center: [74.5, 18.6],
            zoom: 6.8,
            pitch: 28
        });
        await mapcn.init();
        if (networkNodes.length > 0) {
            mapcn.setNetwork(networkNodes, networkCorridors);
            mapcn.highlightSelection(originSelect.value, destSelect.value);
        }
    } catch (e) {
        console.warn('[trade-routes] mapcn init error:', e);
    }
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
    const updateLabels = () => {
        lblTime.textContent = `${sliderTime.value}%`;
        lblCost.textContent = `${sliderCost.value}%`;
        lblDist.textContent = `${sliderDist.value}%`;
        lblRisk.textContent = `${sliderRisk.value}%`;
    };

    [sliderTime, sliderCost, sliderDist, sliderRisk].forEach(slider => {
        slider.addEventListener('input', updateLabels);
    });

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
// 4. Form Submission & Route Optimization
// ==========================================
optForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const origin = originSelect.value;
    const dest = destSelect.value;
    const weightKg = parseFloat(weightInput.value);
    const volumeM3 = parseFloat(volumeInput.value);
    const vehicle = vehicleSelect.value;
    const deadlineHours = deadlineInput.value ? parseFloat(deadlineInput.value) : null;

    if (!origin || !dest) {
        showToast('Please select both Origin and Destination hubs.', 'warning');
        return;
    }
    if (origin === dest) {
        showToast('Origin and Destination cannot be the same hub.', 'warning');
        return;
    }

    const sumWeights = parseFloat(sliderTime.value) + parseFloat(sliderCost.value) + parseFloat(sliderDist.value) + parseFloat(sliderRisk.value);
    const norm = sumWeights > 0 ? sumWeights : 100.0;
    const wTime = parseFloat(sliderTime.value) / norm;
    const wCost = parseFloat(sliderCost.value) / norm;
    const wDist = parseFloat(sliderDist.value) / norm;
    const wRisk = parseFloat(sliderRisk.value) / norm;

    btnSubmit.disabled = true;
    btnText.textContent = 'Computing Dijkstra & A* Paths...';

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
        showToast('Route optimization completed successfully!', 'success');
        await loadHistory();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btnSubmit.disabled = false;
        btnText.textContent = 'Execute Dijkstra & A* Optimization';
    }
});

// ==========================================
// 5. Render Optimization Results (Modules 7, 8, 9)
// ==========================================
function renderOptimizationResults(data) {
    const rec = data.recommended_route;
    const ranked = data.ranked_routes || [];
    const ml = data.predictive_analytics || {};

    // 1. Recommended Route Card
    recRouteName.textContent = rec.name;
    recAlgoBadge.textContent = `${rec.algorithm} Algorithm`;
    recDist.textContent = `${rec.distance_km.toFixed(1)} km`;
    recTime.textContent = `${rec.travel_time_hours.toFixed(1)} h`;
    recCost.textContent = `₹${rec.total_cost_inr.toLocaleString('en-IN')}`;
    recRisk.textContent = `${rec.risk_score.toFixed(1)} / 10`;

    recExplanation.textContent = rec.explanation || 'Optimal compromise across travel time, fuel expenditure, and corridor reliability.';

    const cb = rec.cost_breakdown || {};
    costFuel.textContent = `₹${(cb.fuel_cost_inr || 0).toLocaleString('en-IN')}`;
    costToll.textContent = `₹${(cb.toll_charges_inr || 0).toLocaleString('en-IN')}`;
    costDriver.textContent = `₹${(cb.driver_cost_inr || 0).toLocaleString('en-IN')}`;
    costMaint.textContent = `₹${(cb.maintenance_cost_inr || 0).toLocaleString('en-IN')}`;

    // Warnings Box
    if (rec.warnings && rec.warnings.length > 0) {
        warningsBox.classList.remove('hidden');
        warningsBox.innerHTML = `
            <div class="font-semibold mb-1 flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                Corridor & Operational Warnings
            </div>
            <ul class="list-disc pl-4 space-y-0.5">
                ${rec.warnings.map(w => `<li>${w}</li>`).join('')}
            </ul>
        `;
    } else {
        warningsBox.classList.add('hidden');
    }

    // 2. Predictive Analytics Card (Module 8)
    mlDelayVal.textContent = `${ml.predicted_delay_minutes || 0} min`;
    mlRiskTier.textContent = ml.delay_risk_category || 'LOW';
    mlFuelBurn.textContent = `${(ml.fuel_multiplier || 1.0).toFixed(2)}x`;

    // 3. Breadcrumb
    breadcrumbSteps.textContent = (rec.path_names || []).join(' ➔ ');

    // 4. Comparison Table (Module 4)
    comparisonTbody.innerHTML = '';
    ranked.forEach((r, idx) => {
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
            breadcrumbSteps.textContent = (r.path_names || []).join(' ➔ ');
        });

        comparisonTbody.appendChild(tr);
    });

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
// 6. Interactive Vector Map Rendering (Module 9 via mapcn)
// ==========================================
document.getElementById('btn-zoom-reset')?.addEventListener('click', () => {
    if (mapcn) {
        mapcn.resetView();
    }
});

// ==========================================
// 7. Report Export Handlers (Module 11)
// ==========================================
btnExportCsv.addEventListener('click', async () => {
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

btnExportTxt.addEventListener('click', async () => {
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
        showToast('Academic report downloaded.', 'success');
    } catch (err) {
        showToast(`Export error: ${err.message}`, 'error');
    }
});

// ==========================================
// 8. History Loader (Module 10)
// ==========================================
async function loadHistory() {
    try {
        const res = await fetch('/api/v1/trade-routes/history?limit=5');
        if (!res.ok) return;
        const data = await res.json();
        const items = data.history || [];

        if (items.length === 0) {
            historyContainer.innerHTML = '<div class="text-[11px] text-gray-500 italic">No prior optimization requests.</div>';
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
                    const detail = await detailRes.json();
                    showToast(`Loaded historical request: ${h.request_code}`, 'info');
                }
            });
            historyContainer.appendChild(div);
        });
    } catch (err) {
        console.error('Failed to load history:', err);
    }
}

btnRefreshHistory.addEventListener('click', loadHistory);

// ==========================================
// 9. Academic Modal & Toast Utilities
// ==========================================
function setupModal() {
    btnOpenModal.addEventListener('click', () => modalAcademic.classList.remove('hidden'));
    btnCloseModal.addEventListener('click', () => modalAcademic.classList.add('hidden'));
    btnModalOk.addEventListener('click', () => modalAcademic.classList.add('hidden'));
    modalAcademic.addEventListener('click', (e) => {
        if (e.target === modalAcademic) modalAcademic.classList.add('hidden');
    });
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
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
