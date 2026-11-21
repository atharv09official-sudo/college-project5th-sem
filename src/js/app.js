import { UI } from './ui.js';
import { Dashboard } from './dashboard.js';
import { Settings } from './settings.js';

const initApp = () => {
    // Initialize UI utilities (Theme, Modals)
    UI.init();

    // Check if we are on the dashboard page
    const isDashboard = document.getElementById('dashboard-app');
    
    if (isDashboard) {
        const dashboard = new Dashboard();
        dashboard.init();
    }

    // Check if we are on the settings page
    if (window.location.pathname.includes('/settings')) {
        const settings = new Settings();
        settings.init();
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
