/**
 * UI Helpers Module
 * Handles theme toggling, modals, and generic UI interactions.
 */

export const UI = {
    init() {
        this.initTheme();
        this.initModals();
        this.initScroll();
        this.initSession();
        this.initHeroVideo();
        this.initMobileMenu();
        this.initProfileMenu();
    },

    initProfileMenu() {
        const btn = document.getElementById('profile-menu-btn');
        const menu = document.getElementById('profile-menu-dropdown');
        const logoutBtn = document.getElementById('btn-logout');

        if (btn && menu) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.classList.toggle('hidden');
            });

            // Close on click outside
            document.addEventListener('click', (e) => {
                if (!btn.contains(e.target) && !menu.contains(e.target)) {
                    menu.classList.add('hidden');
                }
            });

            // Close on link click
            const links = menu.querySelectorAll('a');
            links.forEach(link => {
                link.addEventListener('click', () => {
                    menu.classList.add('hidden');
                });
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    await fetch('/api/auth/logout', { method: 'POST' });
                    localStorage.removeItem('user_session'); // Clear local cache
                    window.location.href = '/login.html';
                } catch (e) {
                    console.error('Logout failed', e);
                    window.location.href = '/login.html'; // Fallback
                }
            });
        }
    },

    initMobileMenu() {
        const toggleBtn = document.getElementById('mobile-menu-toggle');
        const menu = document.getElementById('mobile-menu');
        const closeBtn = document.getElementById('mobile-menu-close-btn');
        const closeOverlay = document.getElementById('mobile-menu-close');

        if (toggleBtn && menu) {
            toggleBtn.addEventListener('click', () => {
                menu.classList.remove('hidden');
                document.body.classList.add('overflow-hidden');
            });

            const closeMenu = () => {
                menu.classList.add('hidden');
                document.body.classList.remove('overflow-hidden');
            };

            if (closeBtn) closeBtn.addEventListener('click', closeMenu);
            if (closeOverlay) closeOverlay.addEventListener('click', closeMenu);

            // Close on link click
            const links = menu.querySelectorAll('a');
            links.forEach(link => link.addEventListener('click', closeMenu));
        }
    },

    async initSession() {
        const userDisplays = document.querySelectorAll('.text-xs.font-medium.text-gray-100');
        const emailDisplays = document.querySelectorAll('.text-xs.text-gray-400.truncate');

        const updateUI = (user) => {
            if (user && user.name) {
                userDisplays.forEach(el => {
                    // Update if it's the default or generic
                    if (el.textContent.trim() === 'System User' || el.textContent.trim() !== user.name) {
                        el.textContent = user.name;
                    }
                });
                
                if (user.email) {
                    emailDisplays.forEach(el => {
                         // Update if it's the default or generic
                         if (el.textContent.includes('@supplyguard.ai') || el.textContent.trim() !== user.email) {
                             el.textContent = user.email;
                         }
                    });
                }
            }
        };

        // 1. Try to load from local storage for immediate display
        try {
            const localSession = JSON.parse(localStorage.getItem('user_session'));
            if (localSession) {
                updateUI(localSession);
            }
        } catch (e) {
            console.error("Error parsing local session", e);
        }

        // 2. Fetch fresh data from backend to ensure accuracy
        try {
            const response = await fetch('/api/auth/me');
            if (response.ok) {
                const data = await response.json();
                if (data.ok && data.user) {
                    // Update localStorage with fresh data
                    localStorage.setItem('user_session', JSON.stringify(data.user));
                    // Update UI with fresh data
                    updateUI(data.user);
                }
            } else if (response.status === 401) {
                // Session invalid, redirect to login
                localStorage.removeItem('user_session');
                // Optional: window.location.href = '/login'; 
                // We won't force redirect here to avoid loops if something is weird, 
                // but usually dashboard is protected anyway.
            }
        } catch (error) {
            console.error('Failed to validate session:', error);
        }

        // Logout Logic
        // Handled by initProfileMenu
    },

    initScroll() {
        const backToTopBtn = document.getElementById('back-to-top');
        
        if (backToTopBtn) {
            window.addEventListener('scroll', () => {
                if (window.scrollY > 300) {
                    backToTopBtn.classList.remove('opacity-0', 'invisible', 'translate-y-10');
                } else {
                    backToTopBtn.classList.add('opacity-0', 'invisible', 'translate-y-10');
                }
            });

            backToTopBtn.addEventListener('click', () => {
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            });
        }
    },

    initTheme() {
        const themeToggle = document.getElementById('theme-toggle');
        const html = document.documentElement;
        
        // Check localStorage or system preference
        const savedTheme = localStorage.getItem('theme');
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme === 'light') {
            html.classList.remove('dark');
        } else {
            html.classList.add('dark'); // Default to dark (Mac-style)
        }

        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                html.classList.toggle('dark');
                const isDark = html.classList.contains('dark');
                localStorage.setItem('theme', isDark ? 'dark' : 'light');
            });
        }
    },

    initModals() {
        const openButtons = document.querySelectorAll('[data-modal-target]');
        const closeButtons = document.querySelectorAll('[data-modal-close]');

        openButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = btn.getAttribute('data-modal-target');
                const modal = document.getElementById(targetId);
                if (modal) {
                    modal.classList.remove('hidden');
                    modal.classList.add('flex');
                    document.body.classList.add('overflow-hidden'); // Prevent background scroll
                }
            });
        });

        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal');
                this.closeModal(modal);
            });
        });

        // Close on outside click
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target);
            }
        });
    },

    initHeroVideo() {
        const pathname = window.location.pathname || '';
        const isLanding =
            pathname === '/' ||
            pathname === '/index.html' ||
            pathname === '/dashboard/index.html';

        if (!isLanding) return;

        const heroSection = document.querySelector('main > section.relative.overflow-hidden');
        if (!heroSection) return;

        if (heroSection.querySelector('.hero-video-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'hero-video-wrapper';

        const video = document.createElement('video');
        video.className = 'hero-video';
        video.src = '/assets/all.mp4';
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;

        wrapper.appendChild(video);
        heroSection.insertBefore(wrapper, heroSection.firstChild);
    },

    closeModal(modal) {
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            document.body.classList.remove('overflow-hidden');
        }
    },

    showLoading(elementId) {
        const el = document.getElementById(elementId);
        if (el) {
            el.innerHTML = `
                <div class="flex items-center justify-center h-full">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                </div>
            `;
        }
    },

    updateBadge(elementId, level) {
        const el = document.getElementById(elementId);
        if (!el) return;

        el.className = 'px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider';
        
        switch (level.toLowerCase()) {
            case 'low':
                el.classList.add('bg-green-500/20', 'text-green-400', 'border', 'border-green-500/30');
                break;
            case 'medium':
                el.classList.add('bg-yellow-500/20', 'text-yellow-400', 'border', 'border-yellow-500/30');
                break;
            case 'high':
                el.classList.add('bg-red-500/20', 'text-red-400', 'border', 'border-red-500/30');
                break;
            default:
                el.classList.add('bg-gray-500/20', 'text-gray-400');
        }
        el.textContent = level;
    }
};
