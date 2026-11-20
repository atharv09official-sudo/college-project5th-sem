import { defineConfig } from 'vite';
import { resolve } from 'path';

function dashboardRouter() {
  const routes = [
    'dashboard',
    'plan-generator',
    'inventory-health',
    'kirana-pos',
    'road-risk',
    'import-studio',
    'routes',
    'analysis',
    'compare',
    'intelligence',
    'reports',
    'settings',
    'shipment-planner',
    'login',
    'signup'
  ];

  return {
    name: 'dashboard-router',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const urlObj = new URL(req.url, 'http://localhost');
        const pathname = urlObj.pathname.replace(/^\//, '').replace(/\.html$/, '');
        if (routes.includes(pathname)) {
          req.url = `/dashboard/${pathname}.html` + urlObj.search;
        }
        next();
      });
    }
  };
}

export default defineConfig({
  root: '.',
  publicDir: 'assets',
  plugins: [dashboardRouter()],
  resolve: {
    alias: {
      '/src': resolve(__dirname, 'src'),
      'src': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboardIndex: resolve(__dirname, 'dashboard/index.html'),
        dashboard: resolve(__dirname, 'dashboard/dashboard.html'),
        planGenerator: resolve(__dirname, 'dashboard/plan-generator.html'),
        inventoryHealth: resolve(__dirname, 'dashboard/inventory-health.html'),
        kiranaPos: resolve(__dirname, 'dashboard/kirana-pos.html'),
        roadRisk: resolve(__dirname, 'dashboard/road-risk.html'),
        importStudio: resolve(__dirname, 'dashboard/import-studio.html'),
        routes: resolve(__dirname, 'dashboard/routes.html'),
        analysis: resolve(__dirname, 'dashboard/analysis.html'),
        compare: resolve(__dirname, 'dashboard/compare.html'),
        intelligence: resolve(__dirname, 'dashboard/intelligence.html'),
        reports: resolve(__dirname, 'dashboard/reports.html'),
        settings: resolve(__dirname, 'dashboard/settings.html'),
        shipmentPlanner: resolve(__dirname, 'dashboard/shipment-planner.html'),
        login: resolve(__dirname, 'dashboard/login.html'),
        signup: resolve(__dirname, 'dashboard/signup.html')
      }
    }
  }
});
