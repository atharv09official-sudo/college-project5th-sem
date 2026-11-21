
export class SmoothToast {
    static init() {
        if (document.getElementById('smooth-toast-container')) return;
        
        const container = document.createElement('div');
        container.id = 'smooth-toast-container';
        container.className = 'fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none';
        document.body.appendChild(container);
    }

    static show(message, type = 'info', duration = 4000) {
        this.init();
        
        const container = document.getElementById('smooth-toast-container');
        
        // Define styles based on type
        const styles = {
            success: {
                icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>',
                color: 'text-emerald-400',
                border: 'border-emerald-500/50',
                bg: 'bg-emerald-500/10'
            },
            error: {
                icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>',
                color: 'text-red-400',
                border: 'border-red-500/50',
                bg: 'bg-red-500/10'
            },
            warning: {
                icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>',
                color: 'text-yellow-400',
                border: 'border-yellow-500/50',
                bg: 'bg-yellow-500/10'
            },
            info: {
                icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>',
                color: 'text-blue-400',
                border: 'border-blue-500/50',
                bg: 'bg-blue-500/10'
            }
        };

        const style = styles[type] || styles.info;

        const toast = document.createElement('div');
        toast.className = `
            pointer-events-auto
            flex items-center gap-3 p-4 min-w-[320px] max-w-md
            bg-[#18181b] border ${style.border} rounded-xl shadow-2xl shadow-black/50
            backdrop-blur-md transform transition-all duration-500 ease-out
            translate-y-10 opacity-0 scale-95
        `;
        
        toast.innerHTML = `
            <div class="flex-shrink-0 w-8 h-8 rounded-full ${style.bg} flex items-center justify-center ${style.color}">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    ${style.icon}
                </svg>
            </div>
            <div class="flex-grow">
                <p class="text-sm font-medium text-gray-200">${message}</p>
            </div>
            <button class="flex-shrink-0 text-gray-500 hover:text-white transition-colors" onclick="this.parentElement.remove()">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        `;

        container.appendChild(toast);

        // Animate In
        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-10', 'opacity-0', 'scale-95');
        });

        // Auto Dismiss
        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-x-full');
            setTimeout(() => {
                if (toast.parentElement) toast.remove();
            }, 500);
        }, duration);
    }

    static success(msg, duration) { this.show(msg, 'success', duration); }
    static error(msg, duration) { this.show(msg, 'error', duration); }
    static warning(msg, duration) { this.show(msg, 'warning', duration); }
    static info(msg, duration) { this.show(msg, 'info', duration); }
}
