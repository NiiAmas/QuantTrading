// Central API configuration
// In development: uses localhost:8000. In production: uses same-origin relative path for Nginx proxy.
let API_URL = '';

if (import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '') {
    API_URL = import.meta.env.VITE_API_URL;
} else if (import.meta.env.DEV) {
    API_URL = 'http://127.0.0.1:8000';
} else {
    API_URL = '';
}

export default API_URL;
