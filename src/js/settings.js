
/**
 * Settings Page Logic
 * Handles profile data population and settings management
 */

import { SmoothToast } from './smooth-toast.js';

export class Settings {
    init() {
        this.initProfile();
        this.initButtons();
        this.initPreferences();
    }

    async initProfile() {
        const profileName = document.getElementById('settings-profile-name');
        const profileEmail = document.getElementById('settings-profile-email');
        const userName = document.getElementById('settings-user-name');
        const userRole = document.getElementById('settings-user-role');

        if (!profileName) return; // Not on settings page or elements missing

        const updateUI = (user) => {
            if (!user) return;
            
            if (user.name) {
                if (profileName) profileName.textContent = user.name;
                if (userName) userName.textContent = user.name;
            }
            
            if (user.email) {
                if (profileEmail) profileEmail.textContent = user.email;
            }
            
            if (user.role) {
                if (userRole) {
                    userRole.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
                }
            }
        };

        // 1. Try local storage first
        try {
            const localSession = JSON.parse(localStorage.getItem('user_session'));
            if (localSession) {
                updateUI(localSession);
            }
        } catch (e) {
            console.error("Settings: Error parsing local session", e);
        }

        // 2. Fetch fresh data
        try {
            const response = await fetch('/api/auth/me');
            if (response.ok) {
                const data = await response.json();
                if (data.ok && data.user) {
                    localStorage.setItem('user_session', JSON.stringify(data.user));
                    updateUI(data.user);
                }
            }
        } catch (error) {
            console.error('Settings: Failed to fetch user data', error);
        }
    }

    initButtons() {
        // Edit Profile
        const btnEditProfile = document.getElementById('btn-edit-profile');
        if (btnEditProfile) {
            btnEditProfile.addEventListener('click', () => {
                SmoothToast.info('Profile editing is coming soon!');
            });
        }

        // Invite User
        const btnInviteUser = document.getElementById('btn-invite-user');
        if (btnInviteUser) {
            btnInviteUser.addEventListener('click', () => {
                SmoothToast.info('User invitation system coming soon!');
            });
        }

        // Edit User Row
        const editUserBtns = document.querySelectorAll('.btn-edit-user');
        editUserBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                SmoothToast.info('User management actions coming soon!');
            });
        });

        // Save Weights
        const btnSaveWeights = document.getElementById('btn-save-weights');
        if (btnSaveWeights) {
            btnSaveWeights.addEventListener('click', () => {
                // Simulate saving
                const btnText = btnSaveWeights.textContent;
                btnSaveWeights.textContent = 'Saving...';
                btnSaveWeights.disabled = true;
                
                setTimeout(() => {
                    SmoothToast.success('Risk model weights saved successfully!');
                    btnSaveWeights.textContent = btnText;
                    btnSaveWeights.disabled = false;
                }, 800);
            });
        }
    }

    initPreferences() {
        // Dark Mode
        const darkModeToggle = document.getElementById('settings-dark-mode');
        const isDark = document.documentElement.classList.contains('dark');
        
        if (darkModeToggle) {
            darkModeToggle.checked = isDark;
            darkModeToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    document.documentElement.classList.add('dark');
                    localStorage.setItem('theme', 'dark');
                    SmoothToast.success('Dark mode enabled');
                } else {
                    document.documentElement.classList.remove('dark');
                    localStorage.setItem('theme', 'light');
                    SmoothToast.success('Light mode enabled');
                }
            });
        }

        // Currency
        const currencySelect = document.getElementById('currency-select');
        if (currencySelect) {
            const savedCurrency = localStorage.getItem('app_currency') || 'USD';
            currencySelect.value = savedCurrency;

            currencySelect.addEventListener('change', (e) => {
                localStorage.setItem('app_currency', e.target.value);
                SmoothToast.success(`Currency updated to ${e.target.value}`);
            });
        }

        // Language
        const langSelect = document.getElementById('lang-select');
        if (langSelect) {
            const savedLang = localStorage.getItem('app_lang') || 'en';
            langSelect.value = savedLang;

            langSelect.addEventListener('change', (e) => {
                localStorage.setItem('app_lang', e.target.value);
                SmoothToast.success(`Language preference saved`);
            });
        }
    }
}
