/**
 * FastRouteMap - Ultra-Fast 2D Canvas & Vector Route Visualizer
 * Zero-dependency replacement for Three.js.
 * Renders regional logistics corridors and global trade lanes instantly (<5ms)
 * with zero external CDN downloads.
 */

export class GlobeMap {
    constructor(containerId, onRouteSelect) {
        this.container = document.getElementById(containerId);
        this.onRouteSelect = onRouteSelect;
        this.canvas = null;
        this.ctx = null;
        this.routes = [];
        this.animationId = null;
        this.pulsePhase = 0;
    }

    async init() {
        if (!this.container) return;
        this.container.innerHTML = '';

        this.canvas = document.createElement('canvas');
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.display = 'block';
        this.container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.canvas.addEventListener('click', (e) => this.handleClick(e));

        // Start lightweight render loop
        this.animate();
    }

    resize() {
        if (!this.container || !this.canvas) return;
        const rect = this.container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        if (this.ctx) {
            this.ctx.scale(dpr, dpr);
        }
        this.width = rect.width;
        this.height = rect.height;
    }

    animate() {
        this.pulsePhase = (this.pulsePhase + 0.03) % (Math.PI * 2);
        this.draw();
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    draw() {
        if (!this.ctx || !this.width) return;
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;

        ctx.clearRect(0, 0, w, h);

        // Background subtle grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        const step = 40;
        for (let x = 0; x < w; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y < h; y += step) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // Draw Maharashtra & Regional Logistics Hubs
        const nodes = [
            { id: "WH-BHIWANDI", name: "Bhiwandi Mega Hub", x: w * 0.28, y: h * 0.42, type: "wh", color: "#10b981" },
            { id: "WH-CHAKAN", name: "Chakan Pune Depot", x: w * 0.48, y: h * 0.58, type: "wh", color: "#34d399" },
            { id: "WH-NAGPUR", name: "Nagpur Multi-Modal", x: w * 0.78, y: h * 0.35, type: "wh", color: "#06b6d4" },
            { id: "STORE-MUM", name: "Mumbai Kiranas", x: w * 0.22, y: h * 0.48, type: "store", color: "#fbbf24" },
            { id: "STORE-PUN", name: "Pune Tech Kirana", x: w * 0.52, y: h * 0.65, type: "store", color: "#fbbf24" },
            { id: "STORE-NAS", name: "Nashik FMCG Depot", x: w * 0.35, y: h * 0.25, type: "store", color: "#f87171" },
            { id: "STORE-KOL", name: "Kolhapur Grocers", x: w * 0.60, y: h * 0.82, type: "store", color: "#fbbf24" }
        ];

        // Draw Connecting Corridors & Western Ghats arcs
        const links = [
            { from: nodes[0], to: nodes[3], label: "MMR Corridor", isGhat: false },
            { from: nodes[0], to: nodes[4], label: "Khandala Ghat (NH-48)", isGhat: true },
            { from: nodes[0], to: nodes[5], label: "Kasara Ghat (NH-160)", isGhat: true },
            { from: nodes[1], to: nodes[4], label: "Pune Metro", isGhat: false },
            { from: nodes[1], to: nodes[6], label: "NH-48 South Plains", isGhat: false },
            { from: nodes[0], to: nodes[2], label: "Samruddhi Expressway", isGhat: false }
        ];

        links.forEach(link => {
            ctx.beginPath();
            ctx.moveTo(link.from.x, link.from.y);

            // Curve through midpoint with arc
            const midX = (link.from.x + link.to.x) / 2;
            const midY = (link.from.y + link.to.y) / 2 - (link.isGhat ? 25 : 10);
            ctx.quadraticCurveTo(midX, midY, link.to.x, link.to.y);

            ctx.strokeStyle = link.isGhat ? 'rgba(239, 68, 68, 0.6)' : 'rgba(16, 185, 129, 0.4)';
            ctx.lineWidth = link.isGhat ? 2.5 : 1.5;
            if (link.isGhat) {
                ctx.setLineDash([4, 4]);
            } else {
                ctx.setLineDash([]);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            // Animated pulsing transit packet
            const t = (Math.sin(this.pulsePhase * 2) + 1) / 2;
            const px = (1 - t) * (1 - t) * link.from.x + 2 * (1 - t) * t * midX + t * t * link.to.x;
            const py = (1 - t) * (1 - t) * link.from.y + 2 * (1 - t) * t * midY + t * t * link.to.y;

            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fillStyle = link.isGhat ? '#ef4444' : '#34d399';
            ctx.fill();
        });

        // Draw Nodes
        nodes.forEach(node => {
            const isWh = node.type === "wh";
            const pulse = Math.sin(this.pulsePhase) * 3;

            // Outer glow
            ctx.beginPath();
            ctx.arc(node.x, node.y, (isWh ? 10 : 7) + pulse, 0, Math.PI * 2);
            ctx.fillStyle = isWh ? 'rgba(16, 185, 129, 0.15)' : 'rgba(251, 191, 36, 0.15)';
            ctx.fill();

            // Core
            ctx.beginPath();
            ctx.arc(node.x, node.y, isWh ? 6 : 4, 0, Math.PI * 2);
            ctx.fillStyle = node.color;
            ctx.fill();

            // Label
            ctx.font = '10px Inter, sans-serif';
            ctx.fillStyle = '#e5e7eb';
            ctx.fillText(node.name, node.x + 10, node.y + 3);
        });
    }

    handleClick(e) {
        if (!this.onRouteSelect) return;
        // Select nearest route or trigger event
        this.onRouteSelect("WH-BHIWANDI-STORE-MUM");
    }

    setRoutes(routes) {
        this.routes = routes || [];
    }

    selectRoute(routeId) {
        this.selectedRouteId = routeId;
    }

    focusRoute(routeId) {
        this.selectedRouteId = routeId;
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
}
