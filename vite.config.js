import { defineConfig } from 'vite';
import { resolve } from 'path';
import { spawn } from 'child_process';
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
    'map',
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
      // Auto-launch Python backend if not already started
      if (!process.env.VITE_DEV_RUNNER) {
        (async () => {
          const isRunning = (await checkPort(5005)) || (await checkPort(8000));
          if (!isRunning) {
            const py = spawn('python', ['app.py'], {
              shell: process.platform === 'win32',
              stdio: 'inherit'
            });
            const killPy = () => {
              if (py && py.pid) {
                if (process.platform === 'win32') {
                  spawn('taskkill', ['/pid', py.pid.toString(), '/T', '/F']);
                } else {
                  py.kill();
                }
              }
            };
            process.on('SIGINT', killPy);
            process.on('SIGTERM', killPy);
            process.on('exit', killPy);
            server.httpServer?.on('close', killPy);
          }
        })();
      }

      // 1. Dashboard page routing
      server.middlewares.use((req, res, next) => {
        const urlObj = new URL(req.url, 'http://localhost');
        const pathname = urlObj.pathname.replace(/^\//, '').replace(/\.html$/, '');
        if (routes.includes(pathname)) {
          req.url = `/dashboard/${pathname}.html` + urlObj.search;
        }
        next();
      });

      // 2. Serve /assets directly with HTTP 206 Partial Content range streaming for MP4 videos and assets
      server.middlewares.use('/assets', (req, res, next) => {
        const cleanUrl = req.url.split('?')[0].replace(/^\//, '');
        const filePath = resolve(__dirname, 'assets', cleanUrl);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const stat = fs.statSync(filePath);
          const ext = path.extname(filePath).toLowerCase();
          const mimeTypes = {
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.ogg': 'video/ogg',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.json': 'application/json',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.woff2': 'font/woff2',
            '.woff': 'font/woff',
            '.ttf': 'font/ttf',
            '.txt': 'text/plain'
          };
          const contentType = mimeTypes[ext] || 'application/octet-stream';
          const range = req.headers.range;

          if (range && ext === '.mp4') {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
            const chunkSize = (end - start) + 1;
            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${stat.size}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunkSize,
              'Content-Type': contentType,
              'Cache-Control': 'no-cache'
            });
            return fs.createReadStream(filePath, { start, end }).pipe(res);
          } else {
            res.writeHead(200, {
              'Content-Length': stat.size,
              'Accept-Ranges': 'bytes',
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=3600'
            });
            return fs.createReadStream(filePath).pipe(res);
          }
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
  optimizeDeps: {
    exclude: ['maplibre-gl']
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
        map: resolve(__dirname, 'dashboard/map.html'),
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
