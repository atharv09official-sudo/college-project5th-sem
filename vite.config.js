import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';
import path from 'path';
import net from 'net';

function checkPort(port) {
  return new Promise(resolvePort => {
    const s = net.createConnection(port, '127.0.0.1');
    s.setTimeout(300);
    s.on('connect', () => { s.destroy(); resolvePort(true); });
    s.on('error', () => resolvePort(false));
    s.on('timeout', () => { s.destroy(); resolvePort(false); });
  });
}

let cachedTarget = null;
let lastCheck = 0;
async function resolveBackendTarget() {
  const now = Date.now();
  if (cachedTarget && (now - lastCheck < 3000)) {
    return cachedTarget;
  }
  lastCheck = now;
  // If Flask (app.py) is running on 5005, use 5005
  if (await checkPort(5005)) {
    cachedTarget = 'http://127.0.0.1:5005';
    return cachedTarget;
  }
  // If FastAPI (run.py) is running on 8000, use 8000
  if (await checkPort(8000)) {
    cachedTarget = 'http://127.0.0.1:8000';
    return cachedTarget;
  }
  // Default to 5005
  cachedTarget = process.env.API_TARGET || 'http://127.0.0.1:5005';
  return cachedTarget;
}

function dashboardRouter() {
  const routes = [
    'dashboard',
    'trade-routes',
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
      // 1. Dashboard page routing
      server.middlewares.use((req, res, next) => {
        const urlObj = new URL(req.url, 'http://localhost');
        const pathname = urlObj.pathname.replace(/^\//, '').replace(/\.html$/, '');
        if (routes.includes(pathname)) {
          req.url = `/dashboard/${pathname}.html` + urlObj.search;
        }
        next();
      });

      // 2. Serve /assets directly without Vite publicDir notice
      server.middlewares.use('/assets', (req, res, next) => {
        const cleanUrl = req.url.split('?')[0].replace(/^\//, '');
        const filePath = resolve(__dirname, 'assets', cleanUrl);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const mimeTypes = {
            '.mp4': 'video/mp4',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.svg': 'image/svg+xml',
            '.json': 'application/json',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.woff2': 'font/woff2'
          };
          res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
          return fs.createReadStream(filePath).pipe(res);
        }
        next();
      });
    },
    closeBundle() {
      // Copy assets folder into dist/assets for production builds
      const srcDir = resolve(__dirname, 'assets');
      const destDir = resolve(__dirname, 'dist', 'assets');
      if (fs.existsSync(srcDir)) {
        fs.cpSync(srcDir, destDir, { recursive: true });
      }
    }
  };
}

export default defineConfig({
  root: '.',
  publicDir: false,
  plugins: [dashboardRouter()],
  resolve: {
    alias: {
      '/src': resolve(__dirname, 'src'),
      'src': resolve(__dirname, 'src')
    }
  },
  server: {
    host: '127.0.0.1',
    port: 8067,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5005',
        changeOrigin: true,
        router: async () => {
          return await resolveBackendTarget();
        }
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
        tradeRoutes: resolve(__dirname, 'dashboard/trade-routes.html'),
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
