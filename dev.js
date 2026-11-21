#!/usr/bin/env node

/**
 * HETVAYA FlowGrid - Unified Single-Command Development Runner
 * Starts both Python Backend (Flask/FastAPI) and Vite Frontend concurrently.
 * D. Y. Patil Agriculture & Technical University (AIML 2026-27)
 */

import { spawn, spawnSync } from 'child_process';
import { createServer } from 'vite';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BACKEND_SCRIPT = process.env.BACKEND_SCRIPT || (process.env.FASTAPI ? 'run.py' : 'app.py');
const TARGET_PORT = BACKEND_SCRIPT.includes('run.py') ? 8000 : 5005;

let pyProcess = null;
let viteServer = null;

// ANSI Colors
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const INDIGO = '\x1b[38;5;63m';
const GRAY = '\x1b[90m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function log(prefix, msg, color = CYAN) {
    console.log(`${color}${BOLD}[${prefix}]${RESET} ${msg}`);
}

function checkPort(port, host = '127.0.0.1', timeout = 300) {
    return new Promise((resolve) => {
        const socket = net.createConnection(port, host);
        socket.setTimeout(timeout);
        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.on('error', () => resolve(false));
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
    });
}

async function waitForPort(port, maxRetries = 30, delayMs = 250) {
    for (let i = 0; i < maxRetries; i++) {
        if (await checkPort(port)) {
            return true;
        }
        await new Promise((r) => setTimeout(r, delayMs));
    }
    return false;
}

function getPythonCommand() {
    for (const cmd of ['python', 'py', 'python3']) {
        const res = spawnSync(cmd, ['--version']);
        if (!res.error) return cmd;
    }
    return 'python';
}

function cleanup() {
    if (pyProcess && !pyProcess.killed) {
        log('System', 'Shutting down Python backend...', YELLOW);
        if (process.platform === 'win32' && pyProcess.pid) {
            try {
                spawnSync('taskkill', ['/pid', pyProcess.pid.toString(), '/T', '/F']);
            } catch (e) { }
        } else {
            try {
                pyProcess.kill('SIGTERM');
            } catch (e) { }
        }
        pyProcess = null;
    }
    if (viteServer) {
        viteServer.close();
        viteServer = null;
    }
}

process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
});
process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
});
process.on('exit', cleanup);

process.env.VITE_DEV_RUNNER = '1';

async function main() {
    console.clear();
    console.log(`\n${INDIGO}${BOLD}==============================================================================${RESET}`);
    console.log(`  ${BOLD}AI-POWERED SMART TRADE ROUTE OPTIMIZATION SYSTEM${RESET}`);
    console.log(`  ${GRAY}D. Y. Patil Agriculture & Technical University • B.Tech AIML (2026–27)${RESET}`);
    console.log(`  ${GRAY}Guide: Mr. R. S. Todkar • Single-Command Dev Runner${RESET}`);
    console.log(`${INDIGO}${BOLD}==============================================================================${RESET}\n`);

    // 1. Check if backend is already active
    const isAlreadyRunning = (await checkPort(5005)) || (await checkPort(8000));

    if (isAlreadyRunning) {
        const activePort = (await checkPort(5005)) ? 5005 : 8000;
        log('Backend', `Reusing existing server running on port ${activePort}`, GREEN);
    } else {
        const pyCmd = getPythonCommand();
        log('Backend', `Starting Python backend (${BACKEND_SCRIPT}) on port ${TARGET_PORT}...`, CYAN);

        pyProcess = spawn(pyCmd, [BACKEND_SCRIPT], {
            cwd: __dirname,
            env: { ...process.env, PORT: TARGET_PORT.toString() }
        });

        pyProcess.stdout.on('data', (chunk) => {
            const lines = chunk.toString().trimEnd().split('\n');
            lines.forEach((l) => {
                if (l.trim()) console.log(`${GRAY}[backend]${RESET} ${l}`);
            });
        });

        pyProcess.stderr.on('data', (chunk) => {
            const lines = chunk.toString().trimEnd().split('\n');
            lines.forEach((l) => {
                if (l.trim()) console.log(`${YELLOW}[backend]${RESET} ${l}`);
            });
        });

        pyProcess.on('error', (err) => {
            log('Backend', `Failed to start Python: ${err.message}`, YELLOW);
        });

        // Wait for backend port to become ready
        const isReady = await waitForPort(TARGET_PORT);
        if (isReady) {
            log('Backend', `Active and listening on http://127.0.0.1:${TARGET_PORT}`, GREEN);
        } else {
            log('Backend', `Proceeding with launch (port ${TARGET_PORT} will connect shortly)`, YELLOW);
        }
    }

    // 2. Start Vite Dev Server
    log('Frontend', 'Starting Vite development server...', INDIGO);
    try {
        viteServer = await createServer({
            configFile: path.resolve(__dirname, 'vite.config.js')
        });
        await viteServer.listen();

        const vitePort = viteServer.config.server.port || 8067;
        const viteHost = viteServer.config.server.host || '127.0.0.1';
        const baseUrl = `http://${viteHost}:${vitePort}`;

        console.log(`\n${GREEN}${BOLD}✔ SYSTEM READY & ONLINE!${RESET}`);
        console.log(`  ${BOLD}➜ Trade Route Optimizer:${RESET} ${CYAN}${baseUrl}/trade-routes${RESET}`);
        console.log(`  ${BOLD}➜ Operations Dashboard:${RESET}  ${CYAN}${baseUrl}/dashboard${RESET}`);
        console.log(`  ${BOLD}➜ Full Web App Root:${RESET}     ${CYAN}${baseUrl}/${RESET}`);
        console.log(`  ${BOLD}➜ Backend API Service:${RESET}   ${GRAY}http://127.0.0.1:${TARGET_PORT}/${RESET}`);
        console.log(`\n${GRAY}  Press CTRL+C anytime to stop both servers cleanly.${RESET}\n`);
    } catch (err) {
        log('Frontend', `Failed to launch Vite: ${err.message}`, YELLOW);
        cleanup();
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('Fatal initialization error:', err);
    cleanup();
    process.exit(1);
});
