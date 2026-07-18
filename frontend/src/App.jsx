import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Charts from './pages/Charts';
import MarketsExplorer from './pages/MarketsExplorer';
import TradingHub from './pages/TradingHub';
import Preferences from './pages/Preferences';
import AuthPage from './pages/AuthPage';
import NewsPage from './pages/NewsPage';
import NewsDetail from './pages/NewsDetail';
import useAccountStore from './store/useStore';
import useAuthStore from './store/useAuthStore';

export default function App() {
  const { fetchAccounts } = useAccountStore();
  const { isAuthenticated } = useAuthStore();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  
  useEffect(() => { localStorage.setItem('theme', theme); }, [theme]);
  
  useEffect(() => {
    if (isAuthenticated) {
      fetchAccounts();
    }
  }, [fetchAccounts, isAuthenticated]);

  const toggleTheme = () => {
    setTheme(prev => {
      const newTheme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
      return newTheme;
    });
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.className = `bg-obsidian text-text-main transition-colors duration-300`;
  }, []);

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout theme={theme} toggleTheme={toggleTheme} />}>
          <Route index element={<Dashboard />} />
          <Route path="trading-hub" element={<TradingHub />} />
          <Route path="news" element={<NewsPage />} />
          <Route path="news/:id" element={<NewsDetail />} />
          <Route path="charts" element={<Charts />} />
          <Route path="markets" element={<MarketsExplorer />} />
          <Route path="settings" element={<Preferences />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}