import { SmoothDropdown } from './smooth-dropdown.js';

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SmoothDropdown.initAll());
} else {
    SmoothDropdown.initAll();
}

const metricSelector = '.text-metric-lg, #risk-score, #stat-best-profit, #stat-total-rows, [id^="kpi-"], #ai-confidence-score';
const metrics = new Set(document.querySelectorAll(metricSelector));

metrics.forEach((metric) => {
    let previousValue = metric.textContent;
    const observer = new MutationObserver(() => {
        const currentValue = metric.textContent;
        if (currentValue === previousValue) return;
        previousValue = currentValue;
        metric.classList.remove('value-updated');
        void metric.offsetWidth;
        metric.classList.add('value-updated');
    });

    observer.observe(metric, { subtree: true, childList: true, characterData: true });
});
