
export class SmoothDropdown {
    constructor(selectElement) {
        this.select = selectElement;
        this.options = Array.from(selectElement.options);
        this.selectedOption = this.options.find(opt => opt.selected) || this.options[0];
        
        // Hide original select
        this.select.classList.add('hidden');
        
        // Create container
        this.container = document.createElement('div');
        this.container.className = 'relative w-full group';
        this.select.parentNode.insertBefore(this.container, this.select);
        this.container.appendChild(this.select); // Move select inside to keep context
        
        this.initUI();
        this.setupEvents();
    }
    
    initUI() {
        // Trigger Button
        this.trigger = document.createElement('button');
        this.trigger.type = 'button';
        this.trigger.className = `
            w-full flex items-center justify-between 
            bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 
            text-sm text-gray-200 
            hover:bg-black/30 hover:border-white/20
            focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50
            transition-all duration-200 ease-in-out shadow-sm
        `;
        
        this.label = document.createElement('span');
        this.label.className = 'truncate';
        this.label.textContent = this.selectedOption.text;
        
        const icon = document.createElement('svg');
        icon.className = 'w-4 h-4 text-gray-500 transition-transform duration-200';
        icon.fill = 'none';
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('stroke', 'currentColor');
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>';
        this.icon = icon;
        
        this.trigger.appendChild(this.label);
        this.trigger.appendChild(icon);
        this.container.appendChild(this.trigger);
        
        // Dropdown Menu
        this.menu = document.createElement('div');
        this.menu.className = `
            absolute z-50 mt-1 w-full 
            bg-[#18181b] border border-white/10 rounded-lg shadow-xl shadow-black/50
            backdrop-blur-xl
            transform origin-top scale-95 opacity-0 invisible
            transition-all duration-200 ease-out
            max-h-60 flex flex-col
        `;
        
        // Search Input (Sticky top) - Only if many options
        if (this.options.length > 10) {
            this.searchContainer = document.createElement('div');
            this.searchContainer.className = 'p-2 border-b border-white/5 sticky top-0 bg-[#18181b] z-10';
            this.searchInput = document.createElement('input');
            this.searchInput.type = 'text';
            this.searchInput.placeholder = 'Search...';
            this.searchInput.className = 'w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-500 transition-colors';
            this.searchContainer.appendChild(this.searchInput);
            this.menu.appendChild(this.searchContainer);
        } else {
            this.searchInput = null;
        }
        
        // Options List
        this.list = document.createElement('div');
        this.list.className = 'overflow-y-auto custom-scrollbar p-1';
        this.renderOptions(this.options);
        this.menu.appendChild(this.list);
        
        this.container.appendChild(this.menu);
    }
    
    renderOptions(options) {
        this.list.innerHTML = '';
        if (options.length === 0) {
            const noRes = document.createElement('div');
            noRes.className = 'px-3 py-2 text-xs text-gray-500 text-center';
            noRes.textContent = 'No results found';
            this.list.appendChild(noRes);
            return;
        }
        
        options.forEach(opt => {
            // Skip placeholder if it has empty value
            if (!opt.value && opt.text.includes('Select')) return;
            
            const item = document.createElement('div');
            item.className = `
                px-3 py-2 text-sm rounded cursor-pointer transition-colors duration-150
                ${opt.selected ? 'bg-indigo-500/10 text-indigo-400' : 'text-gray-300 hover:bg-white/5 hover:text-white'}
            `;
            item.textContent = opt.text;
            item.onclick = () => {
                this.selectOption(opt);
            };
            this.list.appendChild(item);
        });
    }
    
    setupEvents() {
        // Toggle
        this.trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });
        
        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.close();
            }
        });
        
        // Search filter
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const filtered = this.options.filter(opt => opt.text.toLowerCase().includes(term));
                this.renderOptions(filtered);
            });
        }
        
        // Keyboard nav (Basic)
        this.trigger.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                e.preventDefault();
                this.open();
                if (this.searchInput) this.searchInput.focus();
            }
        });
    }
    
    selectOption(option) {
        // Update hidden select
        this.select.value = option.value;
        this.select.dispatchEvent(new Event('change')); // Notify listeners
        
        // Update UI
        this.label.textContent = option.text;
        this.selectedOption = option;
        
        // Update selection styles in list
        // Re-rendering is easiest to ensure search filter is cleared or state is correct
        if (this.searchInput) this.searchInput.value = '';
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
        this.menu.classList.remove('invisible', 'scale-95', 'opacity-0');
        this.menu.classList.add('scale-100', 'opacity-100');
        this.icon.classList.add('rotate-180');
        this.trigger.classList.add('border-indigo-500', 'ring-1', 'ring-indigo-500/50');
        
        // Focus search
        if (this.searchInput) {
            setTimeout(() => this.searchInput.focus(), 50);
        }
    }
    
    close() {
        this.menu.classList.add('scale-95', 'opacity-0', 'invisible');
        this.menu.classList.remove('scale-100', 'opacity-100');
        this.icon.classList.remove('rotate-180');
        this.trigger.classList.remove('border-indigo-500', 'ring-1', 'ring-indigo-500/50');
    }
    
    // Public method to refresh options if select is updated externally
    refresh() {
        this.options = Array.from(this.select.options);
        this.renderOptions(this.options);
        // Update label if selection changed
        const current = this.options.find(opt => opt.selected);
        if (current) {
            this.label.textContent = current.text;
        }
    }
}
