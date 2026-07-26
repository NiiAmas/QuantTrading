import { create } from 'zustand';
import axios from 'axios';
import API_URL from '../config/api';

/* ═══════════════════════════════════════════════════════════
   Helper: Check if a JWT token is still valid (not expired)
   ═══════════════════════════════════════════════════════════ */
function isTokenValid(token) {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // exp is in seconds, Date.now() is in ms
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════
   Initialize: Check stored token on first load
   ═══════════════════════════════════════════════════════════ */
const storedToken = localStorage.getItem('token');
const tokenValid = isTokenValid(storedToken);

// Clean up invalid tokens
if (storedToken && !tokenValid) {
  localStorage.removeItem('token');
}

const useAuthStore = create((set) => ({
  token: tokenValid ? storedToken : null,
  isAuthenticated: tokenValid,
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);
      
      const res = await axios.post(`${API_URL}/auth/login`, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      const token = res.data.access_token;
      // Always persist to localStorage for 30-day sessions
      localStorage.setItem('token', token);
      
      set({ token, isAuthenticated: true, loading: false });
      return true;
    } catch (err) {
      set({ error: err.response?.data?.detail || 'Login failed', loading: false });
      return false;
    }
  },

  register: async (email, password, pin) => {
    set({ loading: true, error: null });
    try {
      const res = await axios.post(`${API_URL}/auth/register`, { email, password, pin });
      const token = res.data.access_token;
      
      localStorage.setItem('token', token);
      
      set({ token, isAuthenticated: true, loading: false });
      return true;
    } catch (err) {
      set({ error: err.response?.data?.detail || 'Registration failed', loading: false });
      return false;
    }
  },

  googleLogin: async (email) => {
    set({ loading: true, error: null });
    try {
      const res = await axios.post(`${API_URL}/auth/google`, { email });
      const token = res.data.access_token;
      
      localStorage.setItem('token', token);
      
      set({ token, isAuthenticated: true, loading: false });
      return true;
    } catch (err) {
      set({ error: err.response?.data?.detail || 'Google Login failed', loading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    set({ token: null, isAuthenticated: false });
    import('./useStore').then((m) => {
      m.default.getState().clearStore();
    });
  }
}));

export default useAuthStore;
