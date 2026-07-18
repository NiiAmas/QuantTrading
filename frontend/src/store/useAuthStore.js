import { create } from 'zustand';
import axios from 'axios';
import API_URL from '../config/api';


const useAuthStore = create((set) => ({
  token: localStorage.getItem('token') || sessionStorage.getItem('token') || null,
  isAuthenticated: !!(localStorage.getItem('token') || sessionStorage.getItem('token')),
  loading: false,
  error: null,

  login: async (email, password, rememberMe) => {
    set({ loading: true, error: null });
    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);
      
      const res = await axios.post(`${API_URL}/auth/login`, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      const token = res.data.access_token;
      if (rememberMe) {
        localStorage.setItem('token', token);
      } else {
        sessionStorage.setItem('token', token);
      }
      
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

  googleLogin: async (email, rememberMe) => {
    set({ loading: true, error: null });
    try {
      const res = await axios.post(`${API_URL}/auth/google`, { email });
      const token = res.data.access_token;
      
      if (rememberMe) {
        localStorage.setItem('token', token);
      } else {
        sessionStorage.setItem('token', token);
      }
      
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
