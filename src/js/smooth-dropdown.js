/**
 * SmoothDropdown Component
 * Replaces native browser <select> elements with an accessible, high-performance,
 * dark glassmorphic custom dropdown with optional search and animated chevron.
 */

export class SmoothDropdown {
    constructor(selectElement) {
        if (!selectElement) return;

        // Prevent duplicate wrapping
        if (selectElement._smoothDropdown) {
            return selectElement._smoothDropdown;
        }

        this.select = selectElement;
        this.select._smoothDropdown = this;
        this.options = Array.from(selectElement.options);
        this.selectedOption = this.options.find(opt => opt.selected) || this.options[0] || { value: '', text: '' };

        // Hide original select but keep in DOM for form submission & standard APIs
        this.select.classList.add('hidden');
        this.select.style.display = 'none';
        this.select.setAttribute('aria-hidden', 'true');
        this.select.tabIndex = -1;

        // Container
        this.container = document.createElement('div');
        this.container.className = 'relative w-full group select-none text-left';
        this.select.parentNode.insertBefore(this.container, this.select);
        this.container.appendChild(this.select);

        this.initUI();
        this.setupEvents();
    }

    initUI() {
        // Trigger Button
        this.trigger = document.createElement('button');
        this.trigger.type = 'button';
        this.trigger.className = `
            w-full flex items-center justify-between 
            bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 
            text-xs font-mono text-gray-200 
            hover:bg-[#202024] hover:border-white/20
            focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50
            transition-all duration-150 ease-in-out shadow-sm
        `;

        this.label = document.createElement('span');
        this.label.className = 'truncate pr-2 font-sans text-xs text-gray-200 font-medium';
        this.label.textContent = this.selectedOption ? this.selectedOption.text : 'Select...';

        const icon = document.createElement('svg');
        icon.className = 'w-3.5 h-3.5 text-gray-400 transition-transform duration-200 flex-shrink-0';
        icon.fill = 'none';
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('stroke', 'currentColor');
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path>';
        this.icon = icon;

        this.trigger.appendChild(this.label);
        this.trigger.appendChild(icon);
        this.container.appendChild(this.trigger);

        // Dropdown Menu
        this.menu = document.createElement('div');
        this.menu.className = `
            absolute left-0 right-0 z-[80] mt-1.5 w-full 
            bg-[#121214]/98 border border-white/15 rounded-xl shadow-2xl shadow-black/80
            backdrop-blur-2xl
            transform origin-top scale-95 opacity-0 invisible
            transition-all duration-150 ease-out
            max-h-64 flex flex-col overflow-hidden
        `;

        // Search Input (if options > 6)
        if (this.options.length > 6) {
            this.searchContainer = document.createElement('div');
            this.searchContainer.className = 'p-2 border-b border-white/10 sticky top-0 bg-[#121214] z-10';
            this.searchInput = document.createElement('input');
            this.searchInput.type = 'text';
            this.searchInput.placeholder = 'Search options...';
            this.searchInput.className = 'w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors';
            this.searchContainer.appendChild(this.searchInput);
            this.menu.appendChild(this.searchContainer);
        } else {
            this.searchInput = null;
        }

        // Options List
        this.list = document.createElement('div');
        this.list.className = 'overflow-y-auto custom-scrollbar p-1 space-y-0.5';
        this.renderOptions(this.options);
        this.menu.appendChild(this.list);

        this.container.appendChild(this.menu);
    }

    renderOptions(options) {
        this.list.innerHTML = '';
        if (options.length === 0) {
            const noRes = document.createElement('div');
            noRes.className = 'px-3 py-2 text-xs text-gray-500 text-center font-sans';
            noRes.textContent = 'No matching options';
            this.list.appendChild(noRes);
            return;
        }

        options.forEach(opt => {
            // Skip placeholder if other valid options exist
            if (!opt.value && opt.text.toLowerCase().includes('select') && options.length > 1) {
                return;
            }

            const isSelected = opt.value === this.select.value || opt.selected;
            const item = document.createElement('div');
            item.className = `
                px-3 py-2 text-xs rounded-lg cursor-pointer transition-colors duration-150 flex items-center justify-between font-sans
                ${isSelected ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30' : 'text-gray-300 hover:bg-white/10 hover:text-white'}
            `;

            const itemText = document.createElement('span');
            itemText.className = 'truncate pr-2';
            itemText.textContent = opt.text;
            item.appendChild(itemText);

            if (isSelected) {
                const check = document.createElement('span');
                check.className = 'text-indigo-400 font-bold text-xs flex-shrink-0';
                check.textContent = '✓';
                item.appendChild(check);
            }

            item.onclick = (e) => {
                e.stopPropagation();
                this.selectOption(opt);
            };
            this.list.appendChild(item);
        });
    }

    setupEvents() {
        // Toggle menu
        this.trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.close();
            }
        });

        // Search input filter
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const filtered = this.options.filter(opt => opt.text.toLowerCase().includes(term));
                this.renderOptions(filtered);
            });
            this.searchInput.addEventListener('click', (e) => e.stopPropagation());
        }

        // Keyboard navigation
        this.trigger.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                e.preventDefault();
                this.open();
                if (this.searchInput) this.searchInput.focus();
            } else if (e.key === 'Escape') {
                this.close();
            }
        });

        // Listen for programmatic value change on the select
        this.select.addEventListener('change', () => {
            const current = Array.from(this.select.options).find(opt => opt.value === this.select.value) ||
                            this.select.options[this.select.selectedIndex];
            if (current && this.label) {
                this.label.textContent = current.text;
                this.selectedOption = current;
                this.renderOptions(this.options);
            }
        });

        // MutationObserver for options added/removed dynamically
        this.observer = new MutationObserver(() => {
            this.refresh();
        });
        this.observer.observe(this.select, { childList: true });
    }

    selectOption(option) {
        this.select.value = option.value;
        Array.from(this.select.options).forEach(opt => {
            opt.selected = (opt.value === option.value);
        });
        this.label.textContent = option.text;
        this.selectedOption = option;

        // Dispatch change and input events
        this.select.dispatchEvent(new Event('change', { bubbles: true }));
        this.select.dispatchEvent(new Event('input', { bubbles: true }));

        // Trigger inline onchange if present
        if (typeof this.select.onchange === 'function') {
            this.select.onchange();
        }

        if (this.searchInput) {
            this.searchInput.value = '';
        }
        this.renderOptions(this.options);
        this.close();
    }

    toggle() {
        if (this.menu.classList.contains('invisible')) {
            this.open();
        } else {
            this.close();
        }
    }

    open() {
        // Close any other open dropdowns first
        document.querySelectorAll('.smooth-dropdown-open').forEach(openContainer => {
            if (openContainer !== this.container) {
                const inst = openContainer.querySelector('select')?._smoothDropdown;
                if (inst) inst.close();
            }
        });

        this.container.classList.add('z-50', 'smooth-dropdown-open');
        this.menu.classList.remove('invisible', 'scale-95', 'opacity-0');
        this.menu.classList.add('scale-100', 'opacity-100');
        this.icon.classList.add('rotate-180');
        this.trigger.classList.add('border-indigo-500', 'ring-1', 'ring-indigo-500/50');

        if (this.searchInput) {
            setTimeout(() => this.searchInput.focus(), 60);
        }
    }

    close() {
        this.container.classList.remove('z-50', 'smooth-dropdown-open');
        this.menu.classList.add('scale-95', 'opacity-0', 'invisible');
        this.menu.classList.remove('scale-100', 'opacity-100');
        this.icon.classList.remove('rotate-180');
        this.trigger.classList.remove('border-indigo-500', 'ring-1', 'ring-indigo-500/50');
    }

    refresh() {
        this.options = Array.from(this.select.options);
        const current = this.options.find(opt => opt.value === this.select.value) ||
                        this.options.find(opt => opt.selected) ||
                        this.options[0];
        if (current && this.label) {
            this.label.textContent = current.text;
            this.selectedOption = current;
        }

        // Check if search should be created if options grew > 6
        if (this.options.length > 6 && !this.searchInput) {
            this.searchContainer = document.createElement('div');
            this.searchContainer.className = 'p-2 border-b border-white/10 sticky top-0 bg-[#121214] z-10';
            this.searchInput = document.createElement('input');
            this.searchInput.type = 'text';
            this.searchInput.placeholder = 'Search options...';
            this.searchInput.className = 'w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors';
            this.searchContainer.appendChild(this.searchInput);
            this.menu.insertBefore(this.searchContainer, this.list);
            this.searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const filtered = this.options.filter(opt => opt.text.toLowerCase().includes(term));
                this.renderOptions(filtered);
            });
            this.searchInput.addEventListener('click', (e) => e.stopPropagation());
        }

        this.renderOptions(this.options);
    }

    /**
     * Auto-instantiates SmoothDropdown for all selects in root container
     */
    static initAll(root = document) {
        const selects = root.querySelectorAll('select:not([data-no-smooth]):not(.no-smooth)');
        const instances = [];
        selects.forEach(select => {
            if (!select._smoothDropdown && select.offsetParent !== null) {
                instances.push(new SmoothDropdown(select));
            } else if (!select._smoothDropdown) {
                // If currently hidden/in background tab, still initialize
                instances.push(new SmoothDropdown(select));
            }
        });
        return instances;
    }
}

// Attach to global window
if (typeof window !== 'undefined') {
    window.SmoothDropdown = SmoothDropdown;
}
