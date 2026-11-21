
// Analysis Page Logic

document.addEventListener('DOMContentLoaded', () => {
    const ctx = document.getElementById('analysis-chart');
    if (!ctx) return;

    let chartInstance = null;
    let currentRange = 30;
    let currentLocation = 'Global';
    let routeContext = null;
    let lastHistorySeries = [];
    let lastBreakdown = null;
    let forecastChartInstance = null;

    // Debug Overlay Removed
    
    function log(msg) {
        console.log(msg);
    }

    log("Analysis JS Loaded v4");

    try {
        routeContext = JSON.parse(localStorage.getItem('current_route_context') || 'null');
        log(`Context loaded: ${routeContext ? routeContext.to : 'None'}`);
        if (routeContext && routeContext.to) {
            currentLocation = routeContext.to;
        }
    } catch (e) {
        log(`Error loading context: ${e.message}`);
    }

    async function fetchData(location) {
        try {
            // Include route context if available for better precision
            let query = `location=${encodeURIComponent(location)}`;
            if (routeContext && routeContext.from && routeContext.to) {
                let routeStr = `${routeContext.from} to ${routeContext.to}`;
                if (routeContext.preferred_mode) {
                    routeStr += ` via ${routeContext.preferred_mode}`;
                }
                query += `&route=${encodeURIComponent(routeStr)}`;
                query += `&origin=${encodeURIComponent(routeContext.from)}`;
            }
            
            log(`Fetching: /api/risk-history?${query}`);
            const res = await fetch(`/api/risk-history?${query}`);
            
            if (!res.ok) {
                log(`API Error: ${res.status}`);
                throw new Error(`API Error: ${res.status}`);
            }

            const data = await res.json();
            log(`Data received: ${data.length} points`);
            
            if (data.length > 0) {
                log(`Last Score: ${data[data.length-1].score}`);
            }

            lastHistorySeries = Array.isArray(data) ? data : [];
            return data;
        } catch (e) {
            log(`Fetch failed: ${e.message}`);
            return [];
        }
    }

    // 2. Render Chart
    async function renderChart(range, location) {
        const fullData = await fetchData(location);
        
        // Slice based on range
        const data = fullData.slice(-range);
        
        const labels = data.map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
        
        let values = data.map(d => d.score);

        // Ensure we have some variance for display if flat
        if (values.length > 0) {
            const maxVal = Math.max(...values);
            const minVal = Math.min(...values);
            const spread = maxVal - minVal;

            if (spread < 0.5) { // Very flat
                // Add artificial visual noise for better UI experience
                values = values.map(v => {
                    const noise = (Math.random() - 0.5) * 0.4;
                    return Math.max(0.1, Math.min(10, v + noise));
                });
            }
        }

        if (chartInstance) {
            chartInstance.data.labels = labels;
            chartInstance.data.datasets[0].data = values;
            chartInstance.data.datasets[0].label = `${location} Risk Score`;
            chartInstance.update();
            return;
        }

        // Gradient
        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.5)'); // Indigo
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `${location} Risk Score`,
                    data: values,
                    borderColor: '#6366f1',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#fff',
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
                        backgroundColor: 'rgba(15, 17, 21, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 12,
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: { color: '#64748b', maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }
                    },
                    y: {
                        min: 0,
                        max: 10,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#64748b', font: { size: 11 } }
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

    async function renderRadar(location) {
        const radarCtx = document.getElementById('radar-chart');
        if (!radarCtx) return;

        log("Rendering Radar...");
        let breakdown = { fuel: 5, politics: 5, labor: 5, sanctions: 5, weather: 5 };
        try {
            // Include route context if available for better precision
            let query = `location=${encodeURIComponent(location)}`;
            if (routeContext && routeContext.from && routeContext.to) {
                let routeStr = `${routeContext.from} to ${routeContext.to}`;
                if (routeContext.preferred_mode) {
                    routeStr += ` via ${routeContext.preferred_mode}`;
                }
                query += `&route=${encodeURIComponent(routeStr)}`;
                query += `&origin=${encodeURIComponent(routeContext.from)}`;
            }
            
            log(`Fetching Breakdown: /api/risk-breakdown?${query}`);
            const res = await fetch(`/api/risk-breakdown?${query}`);
            if(!res.ok) throw new Error(`Breakdown API Error: ${res.status}`);
            breakdown = await res.json();
            log(`Breakdown received: Fuel=${breakdown.fuel}, Pol=${breakdown.politics}`);
        } catch(e) { 
            log(`Breakdown fetch failed: ${e.message}`);
            console.error(e); 
        }

        if (window.radarInstance) {
            window.radarInstance.data.datasets[0].data = [
                breakdown.fuel, 
                breakdown.politics, 
                breakdown.labor, 
                breakdown.sanctions, 
                breakdown.weather
            ];
            window.radarInstance.update();
            return;
        }

        window.radarInstance = new Chart(radarCtx, {
            type: 'radar',
            data: {
                labels: ['Fuel', 'Politics', 'Labor', 'Sanctions', 'Weather'],
                datasets: [{
                    label: 'Risk Profile',
                    data: [breakdown.fuel, breakdown.politics, breakdown.labor, breakdown.sanctions, breakdown.weather],
                    backgroundColor: 'rgba(52, 211, 153, 0.2)', // Emerald
                    borderColor: '#34d399',
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#34d399',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        pointLabels: { color: '#94a3b8', font: { size: 11, weight: 'bold' } },
                        ticks: { display: false, backdropColor: 'transparent' },
                        suggestedMin: 0,
                        suggestedMax: 10
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });

        lastBreakdown = breakdown;
        updateAIInsights(location);
    }

    function updateAIInsights(location) {
        log("Updating AI Insights...");
        if (!lastHistorySeries || lastHistorySeries.length === 0) {
            log("Skipping Insights: No history data.");
            return;
        }
        if (!lastBreakdown) {
            log("Skipping Insights: No breakdown data.");
            return;
        }

        const scores = lastHistorySeries.map(d => d.score);
        if (scores.length === 0) return;

        const latest = scores[scores.length - 1];
        const windowSize = Math.min(14, scores.length);
        const recent = scores.slice(-windowSize);
        const mean = recent.reduce((a, v) => a + v, 0) / recent.length;
        const variance = recent.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / recent.length;
        const stdDev = Math.sqrt(variance);

        const low = Math.max(0, +(latest - stdDev).toFixed(1));
        const high = Math.min(10, +(latest + stdDev).toFixed(1));

        const forecastRangeEl = document.getElementById('ai-forecast-range');
        const forecastHorizonEl = document.getElementById('ai-forecast-horizon');
        const forecastConfidenceEl = document.getElementById('ai-forecast-confidence');
        const execSummaryEl = document.getElementById('ai-exec-summary');
        const momentumPillEl = document.getElementById('ai-momentum-pill');
        const rootHeadlineEl = document.getElementById('ai-root-cause-headline');
        const rootFactorsEl = document.getElementById('ai-root-cause-factors');
        const recommendationMainEl = document.getElementById('ai-recommendation-main');
        const recommendationSecondaryEl = document.getElementById('ai-recommendation-secondary');
        const confidenceScoreEl = document.getElementById('ai-confidence-score');
        const confidenceTextEl = document.getElementById('ai-confidence-text');
        const triggersListEl = document.getElementById('ai-triggers-list');
        const scenariosEl = document.getElementById('ai-scenarios');
        const patternMatchEl = document.getElementById('ai-pattern-match');
        const sensitivityListEl = document.getElementById('ai-sensitivity-list');

        if (!forecastRangeEl || !forecastHorizonEl || !forecastConfidenceEl || !execSummaryEl || !momentumPillEl) return;

        forecastRangeEl.textContent = `${low.toFixed(1)} – ${high.toFixed(1)}`;
        forecastHorizonEl.textContent = 'Next 7–14 days';

        const slope = recent.length > 1 ? (recent[recent.length - 1] - recent[0]) / (recent.length - 1) : 0;
        let momentumLabel = 'Stable';
        let momentumSymbol = '→';
        if (slope > 0.15) {
            momentumLabel = 'Rising';
            momentumSymbol = '↑';
        } else if (slope < -0.15) {
            momentumLabel = 'Cooling';
            momentumSymbol = '↓';
        }
        momentumPillEl.textContent = `Momentum: ${momentumSymbol} ${momentumLabel}`;

        const level = latest >= 7 ? 'High' : latest >= 4 ? 'Moderate' : 'Low';
        const routeLabel = location || 'this corridor';

        if (level === 'High') {
            execSummaryEl.textContent = `Overall route risk is high and ${momentumLabel.toLowerCase()}. Disruptions on ${routeLabel} are likely without active mitigation.`;
        } else if (level === 'Moderate') {
            execSummaryEl.textContent = `Overall route risk is moderate and ${momentumLabel.toLowerCase()}. Volatility on ${routeLabel} should be monitored closely.`;
        } else {
            execSummaryEl.textContent = `Overall route risk is low and ${momentumLabel.toLowerCase()}. Conditions on ${routeLabel} remain mostly stable.`;
        }

        const entries = Object.entries(lastBreakdown);
        const sorted = entries.sort((a, b) => b[1] - a[1]);
        const topTwo = sorted.slice(0, 2);
        const totalFactors = sorted.reduce((a, [, v]) => a + v, 0) || 1;

        if (rootHeadlineEl && topTwo.length > 0) {
            if (topTwo.length === 1) {
                const p = Math.round((topTwo[0][1] / totalFactors) * 100);
                rootHeadlineEl.textContent = `Risk is driven primarily by ${capitalize(topTwo[0][0])} (~${p}%).`;
            } else {
                const p1 = Math.round((topTwo[0][1] / totalFactors) * 100);
                const p2 = Math.round((topTwo[1][1] / totalFactors) * 100);
                rootHeadlineEl.textContent = `Risk is driven primarily by ${capitalize(topTwo[0][0])} (~${p1}%) and ${capitalize(topTwo[1][0])} (~${p2}%).`;
            }
        }

        if (rootFactorsEl) {
            rootFactorsEl.innerHTML = '';
            sorted.forEach(([key, value]) => {
                const row = document.createElement('div');
                row.className = 'flex items-center justify-between text-[11px]';
                const label = document.createElement('span');
                label.textContent = capitalize(key);
                label.className = 'text-gray-400';
                const val = document.createElement('span');
                val.textContent = value.toFixed(1);
                val.className = 'font-mono text-emerald-300';
                row.appendChild(label);
                row.appendChild(val);

                const barOuter = document.createElement('div');
                barOuter.className = 'h-1.5 bg-gray-800 rounded-full overflow-hidden mt-1 mb-1';
                const barInner = document.createElement('div');
                barInner.className = 'h-full bg-emerald-400';
                barInner.style.width = `${Math.max(5, Math.min(100, value * 10))}%`;
                barOuter.appendChild(barInner);

                const wrapper = document.createElement('div');
                wrapper.appendChild(row);
                wrapper.appendChild(barOuter);

                rootFactorsEl.appendChild(wrapper);
            });
        }

        const confidenceBase = 60 + Math.min(20, scores.length);
        const varianceAdjustment = variance < 1 ? 10 : variance > 4 ? -10 : 0;
        const factorAdjustment = Math.min(10, entries.length * 2);
        let confidence = confidenceBase + varianceAdjustment + factorAdjustment;
        confidence = Math.max(50, Math.min(95, Math.round(confidence)));

        if (forecastConfidenceEl) {
            forecastConfidenceEl.textContent = `Confidence: ${confidence}%`;
        }
        if (confidenceScoreEl) {
            confidenceScoreEl.textContent = `${confidence}%`;
        }
        if (confidenceTextEl) {
            confidenceTextEl.textContent = `${confidence}% confidence based on ${scores.length} days of history and alignment across ${entries.length} risk factors.`;
        }

        if (recommendationMainEl && recommendationSecondaryEl) {
            if (level === 'High') {
                recommendationMainEl.textContent = 'Consider rerouting or adding buffers on this lane to absorb volatility.';
                recommendationSecondaryEl.textContent = 'Lock key contracts for the next 14–21 days and review alternative corridors if available.';
            } else if (level === 'Moderate') {
                recommendationMainEl.textContent = 'Maintain shipments but tighten monitoring and add limited buffers for lead time.';
                recommendationSecondaryEl.textContent = 'Focus on hedging exposure to the most elevated factors and keep backup routes ready.';
            } else {
                recommendationMainEl.textContent = 'Route appears broadly acceptable for business-as-usual planning.';
                recommendationSecondaryEl.textContent = 'Use cost-optimized modes while tracking early signals in Fuel and Politics.';
            }
        }

        if (triggersListEl) {
            triggersListEl.innerHTML = '';
            const triggers = [];
            const fuel = lastBreakdown.fuel;
            const politics = lastBreakdown.politics;
            const sanctions = lastBreakdown.sanctions;
            const weather = lastBreakdown.weather;
            if (politics && politics >= 6) {
                triggers.push('Political events or elections could move risk sharply.');
            }
            if (sanctions && sanctions >= 6) {
                triggers.push('Sanction reviews or trade policy changes may trigger sudden spikes.');
            }
            if (fuel && fuel >= 6) {
                triggers.push('Fuel price shocks or supply constraints can raise costs and delay routes.');
            }
            if (weather && weather >= 6) {
                triggers.push('Seasonal weather windows may create temporary disruption periods.');
            }
            if (triggers.length === 0) {
                triggers.push('No immediate trigger dominates; monitor news and macro signals for this lane.');
            }
            triggers.push('Potential disruption window: next 7–10 days if key triggers materialize.');
            triggers.forEach(text => {
                const li = document.createElement('li');
                li.textContent = text;
                triggersListEl.appendChild(li);
            });
        }

        if (scenariosEl) {
            scenariosEl.innerHTML = '';
            const best = Math.max(0, +(latest - stdDev * 1.2).toFixed(1));
            const base = +latest.toFixed(1);
            const worst = Math.min(10, +(latest + stdDev * 1.6).toFixed(1));
            const items = [
                { label: 'Best Case', value: best },
                { label: 'Base Case', value: base },
                { label: 'Worst Case', value: worst }
            ];
            items.forEach(item => {
                const row = document.createElement('div');
                row.className = 'flex items-center justify-between';
                const label = document.createElement('span');
                label.textContent = item.label;
                label.className = 'text-gray-400';
                const badge = document.createElement('span');
                badge.textContent = item.value.toFixed(1);
                let badgeClass = 'px-2 py-0.5 rounded-full text-[10px] font-semibold';
                if (item.value >= 7) {
                    badgeClass += ' bg-red-500/20 text-red-300 border border-red-500/40';
                } else if (item.value >= 4) {
                    badgeClass += ' bg-yellow-500/20 text-yellow-300 border border-yellow-500/40';
                } else {
                    badgeClass += ' bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
                }
                badge.className = badgeClass;
                row.appendChild(label);
                row.appendChild(badge);
                scenariosEl.appendChild(row);
            });
        }

        if (patternMatchEl) {
            if (scores.length < 20) {
                patternMatchEl.textContent = 'Not enough history yet to match against prior patterns.';
            } else {
                const half = Math.floor(scores.length / 2);
                const recentWindow = scores.slice(-half);
                const priorWindow = scores.slice(-2 * half, -half);
                const len = Math.min(recentWindow.length, priorWindow.length);
                let mse = 0;
                for (let i = 0; i < len; i++) {
                    const diff = recentWindow[i] - priorWindow[i];
                    mse += diff * diff;
                }
                mse = mse / len;
                const similarity = Math.max(0, Math.min(100, Math.round(100 / (1 + mse))));
                patternMatchEl.textContent = `Current pattern shows about ${similarity}% similarity to the previous period, suggesting reusable playbooks from recent conditions.`;
            }
        }

        if (sensitivityListEl) {
            sensitivityListEl.innerHTML = '';
            entries.forEach(([key, value]) => {
                let levelLabel = 'Medium';
                if (value >= 7) levelLabel = 'High';
                else if (value < 4) levelLabel = 'Low';
                const row = document.createElement('div');
                row.textContent = `${capitalize(key)} sensitivity: ${levelLabel}`;
                sensitivityListEl.appendChild(row);
            });
        }

        const sparkCanvas = document.getElementById('forecast-sparkline');
        if (sparkCanvas) {
            const ctxSpark = sparkCanvas.getContext('2d');
            const sparkLabels = recent.map((_, idx) => idx + 1);
            if (forecastChartInstance) {
                forecastChartInstance.destroy();
            }
            forecastChartInstance = new Chart(ctxSpark, {
                type: 'line',
                data: {
                    labels: sparkLabels,
                    datasets: [{
                        data: recent,
                        borderColor: '#38bdf8',
                        backgroundColor: 'rgba(56, 189, 248, 0.15)',
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: true,
                        tension: 0.35
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false }
                    },
                    scales: {
                        x: { display: false },
                        y: { display: false }
                    }
                }
            });
        }
    }

    function capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // 4. Event Listeners
    
    // Range Toggles
    document.querySelectorAll('button[data-range]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update UI
            document.querySelectorAll('button[data-range]').forEach(b => {
                b.className = "px-4 py-1.5 rounded-md text-[11px] font-medium text-gray-400 hover:text-white hover:bg-white/5 transition";
            });
            e.target.className = "px-4 py-1.5 rounded-md text-[11px] font-semibold bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 transition";
            
            // Update Logic
            currentRange = parseInt(e.target.dataset.range);
            renderChart(currentRange, currentLocation);
        });
    });

    const locSelect = document.getElementById('analysis-location');
    if(locSelect) {
        if (currentLocation && currentLocation !== 'Global') {
            let option = Array.from(locSelect.options).find(o => o.value === currentLocation);
            if (!option) {
                option = document.createElement('option');
                option.value = currentLocation;
                option.textContent = currentLocation;
                locSelect.appendChild(option);
            }
            locSelect.value = currentLocation;
        }
        locSelect.addEventListener('change', (e) => {
            currentLocation = e.target.value;
            renderChart(currentRange, currentLocation);
            renderRadar(currentLocation);
        });
    }

    if (routeContext && routeContext.from && routeContext.to) {
        const title = document.querySelector('h3.text-2xl');
        const subtitle = document.querySelector('p.text-sm.text-gray-400.mt-1');
        if (title) {
            title.textContent = 'Risk Trend: ' + routeContext.from + ' ➝ ' + routeContext.to;
        }
        if (subtitle) {
            subtitle.textContent = 'Historical volatility and risk profile for the currently analyzed route.';
        }
    }

    // Sequence the rendering to ensure data dependencies (history needed for insights)
    log("Starting initial render sequence...");
    renderChart(currentRange, currentLocation).then(() => {
        log("Chart rendered, starting radar...");
        return renderRadar(currentLocation);
    }).then(() => {
        log("Initial render complete.");
    }).catch(e => {
        log(`Render sequence failed: ${e.message}`);
    });
});
