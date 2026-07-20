// Central API configuration
// In development: uses localhost. In production: uses the deployed backend URL.
let API_URL = 'http://127.0.0.1:8000';
if (import.meta.env.VITE_API_URL !== undefined) {
    API_URL = import.meta.env.VITE_API_URL;
}

export default API_URL;
