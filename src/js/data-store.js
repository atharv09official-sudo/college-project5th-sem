/**
 * Data Store Module
 * Handles fetching mock data and managing local storage state.
 */

export class DataStore {
    constructor() {
        this.routes = [];
        this.news = [];
        this.locations = [];
        this.selectedRouteId = null;
    }

    async init() {
        try {
            await Promise.all([
                this.fetchRoutes(),
                this.fetchNews()
            ]);
            this.buildLocations();
            console.log('DataStore initialized');
        } catch (error) {
            console.error('Failed to initialize DataStore:', error);
        }
    }

    async fetchRoutes() {
        // Prioritize backend API, fallback to mock data if needed (though API serves the same data now)
        const endpoints = ['/api/routes', '/src/data/mock-routes.json'];
        for (const url of endpoints) {
            try {
                const response = await fetch(url);
                if (!response.ok) continue;
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    this.routes = data;
                    // Normalize data structure if needed (ensure numeric IDs are strings if mixed)
                    this.routes.forEach(r => r.id = String(r.id));
                    return this.routes;
                }
            } catch (error) {
                console.error('Error fetching routes from', url, error);
            }
        }
        this.routes = [];
        return [];
    }

    async fetchNews() {
        // Prioritize backend API
        const endpoints = ['/api/news', '/src/data/mock-news.json'];
        for (const url of endpoints) {
            try {
                const response = await fetch(url);
                if (!response.ok) continue;
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    this.news = data;
                    return this.news;
                }
            } catch (error) {
                console.error('Error fetching news from', url, error);
            }
        }
        this.news = [];
        return [];
    }

    buildLocations() {
        const locationConfig = {
            India: { id: 'in-nhava-sheva', label: 'Nhava Sheva (JNPT), India' },
            China: { id: 'cn-shanghai', label: 'Shanghai Port, China' },
            USA: { id: 'us-los-angeles', label: 'Port of Los Angeles, USA' },
            Netherlands: { id: 'nl-rotterdam', label: 'Port of Rotterdam, Netherlands' },
            Brazil: { id: 'br-santos', label: 'Port of Santos, Brazil' },
            Germany: { id: 'de-hamburg', label: 'Port of Hamburg, Germany' },
            'United Kingdom': { id: 'gb-london-gateway', label: 'London Gateway, United Kingdom' }
        };

        const countries = new Set();
        this.routes.forEach(r => {
            if (r.from) countries.add(r.from);
            if (r.to) countries.add(r.to);
        });

        const locations = [];
        countries.forEach(country => {
            const config = locationConfig[country];
            if (config) {
                locations.push({
                    id: config.id,
                    label: config.label,
                    country: country
                });
            } else {
                const id = country.toLowerCase().replace(/\s+/g, '-');
                locations.push({
                    id: id,
                    label: country,
                    country: country
                });
            }
        });

        this.locations = locations;
    }

    getAllRoutes() {
        return this.routes;
    }

    getRouteById(id) {
        return this.routes.find(r => r.id === id);
    }

    getAllLocations() {
        return this.locations;
    }

    getLocationById(id) {
        return this.locations.find(l => l.id === id);
    }

    getRouteByLocations(fromLocationId, toLocationId) {
        const from = this.getLocationById(fromLocationId);
        const to = this.getLocationById(toLocationId);
        if (!from || !to) return null;
        return this.routes.find(r => r.from === from.country && r.to === to.country) || null;
    }

    getNewsByIds(ids) {
        if (!ids || ids.length === 0) return [];
        return this.news.filter(n => ids.includes(n.id));
    }

    setSelectedRoute(id) {
        this.selectedRouteId = id;
        localStorage.setItem('selectedRouteId', id);
    }

    getSelectedRoute() {
        if (!this.selectedRouteId) {
            this.selectedRouteId = localStorage.getItem('selectedRouteId');
        }
        // Default to first route if none selected or invalid
        if (!this.selectedRouteId && this.routes.length > 0) {
            this.selectedRouteId = this.routes[0].id;
        }
        return this.getRouteById(this.selectedRouteId);
    }

    saveBookmarkedRoute(routeId) {
        let bookmarks = JSON.parse(localStorage.getItem('bookmarkedRoutes') || '[]');
        if (!bookmarks.includes(routeId)) {
            bookmarks.push(routeId);
            localStorage.setItem('bookmarkedRoutes', JSON.stringify(bookmarks));
            return true;
        }
        return false;
    }

    removeBookmarkedRoute(routeId) {
        let bookmarks = JSON.parse(localStorage.getItem('bookmarkedRoutes') || '[]');
        const index = bookmarks.indexOf(routeId);
        if (index > -1) {
            bookmarks.splice(index, 1);
            localStorage.setItem('bookmarkedRoutes', JSON.stringify(bookmarks));
            return true;
        }
        return false;
    }

    getBookmarkedRoutes() {
        return JSON.parse(localStorage.getItem('bookmarkedRoutes') || '[]');
    }
}

export const store = new DataStore();
