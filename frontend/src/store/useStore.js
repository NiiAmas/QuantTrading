import { create } from 'zustand';
import axios from 'axios';
import useAuthStore from './useAuthStore';
import API_URL from '../config/api';

const useAccountStore = create((set, get) => ({
  accounts: [],
  activeAccount: null,
  globalBalance: 0,
  isWizardOpen: false,
  settings: JSON.parse(localStorage.getItem('platformSettings')) || {
    // System UI
    reduceAnimations: false,
    baseCurrency: 'USD',
    compactMode: false,
    // Risk Management
    blockWeekend: true,
    maxDrawdown: 5,
    slippageTolerance: 0.5,
    // Alerts & Notifications
    emailReports: false,
    tradeAlerts: true,
    signalAlerts: false,
    telegramWebhook: '',
    // API Keys (stored locally only — never sent to backend)
    alpacaApiKey: '',
    alpacaSecretKey: '',
    binanceApiKey: '',
    binanceSecretKey: '',
    newsApiKey: '',
  },
  
  updateSettings: (newSettings) => set((state) => {
    const updated = { ...state.settings, ...newSettings };
    localStorage.setItem('platformSettings', JSON.stringify(updated));
    return { settings: updated };
  }),

  setWizardOpen: (open) => set({ isWizardOpen: open }),
  setActiveAccount: (id) => set({ activeAccount: id }),
  clearStore: () => set({ accounts: [], activeAccount: null, globalBalance: 0 }),
  
  fetchAccounts: async () => {
    try {
      const token = useAuthStore.getState().token;
      const res = await axios.get(`${API_URL}/accounts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const accounts = res.data;
      const globalBalance = accounts.reduce((acc, curr) => acc + curr.balance, 0);
      set({ 
        accounts, 
        globalBalance,
        activeAccount: get().activeAccount || (accounts.length > 0 ? accounts[0].id : null)
      });
    } catch (err) {
      console.error("Failed to fetch accounts", err);
      if (err.response?.status === 401) {
        useAuthStore.getState().logout();
      }
    }
  },

  createAccount: async (accountData) => {
    try {
      const token = useAuthStore.getState().token;
      const res = await axios.post(`${API_URL}/accounts`, accountData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const newAcc = res.data;
      set((state) => ({ 
        accounts: [...state.accounts, newAcc],
        globalBalance: state.globalBalance + newAcc.balance,
        activeAccount: newAcc.id
      }));
    } catch (err) {
      console.error("Failed to create account", err);
    }
  },

  deleteAccount: async (id) => {
    try {
      const token = useAuthStore.getState().token;
      await axios.delete(`${API_URL}/accounts/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      set((state) => {
        const filtered = state.accounts.filter(a => a.id !== id);
        const globalBalance = filtered.reduce((acc, curr) => acc + curr.balance, 0);
        return {
          accounts: filtered,
          globalBalance,
          activeAccount: state.activeAccount === id ? (filtered.length > 0 ? filtered[0].id : null) : state.activeAccount
        };
      });
    } catch (err) {
      console.error("Failed to delete account", err);
    }
  },

  updateAccount: async (id, updatedData) => {
    try {
      const token = useAuthStore.getState().token;
      const res = await axios.put(`${API_URL}/accounts/${id}`, updatedData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      set((state) => {
        const updatedAccounts = state.accounts.map(a => a.id === id ? { ...a, ...res.data } : a);
        return {
          accounts: updatedAccounts,
          activeAccount: state.activeAccount === id ? res.data.id : state.activeAccount
        };
      });
    } catch (err) {
      console.error("Failed to update account", err);
    }
  }
}));

export default useAccountStore;
