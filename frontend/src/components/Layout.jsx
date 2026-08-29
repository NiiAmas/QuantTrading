import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Sun, Moon, Menu, X } from 'lucide-react';
import PropTypes from 'prop-types';
import useAccountStore from '../store/useStore';
import AccountWizardModal from './AccountWizardModal';

export default function Layout({ theme, toggleTheme }) {
  const { isWizardOpen, setWizardOpen } = useAccountStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Mobile backdrop */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar - hidden on mobile unless toggled */}
      <div className={`
        ${isMobile ? 'fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out' : 'relative'}
        ${isMobile && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} isMobile={isMobile} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        <header className="flex justify-between items-center px-4 sm:px-6 lg:px-8 py-4 lg:py-5 border-b border-molten/20 bg-obsidian backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-3">
            {isMobile && (
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg bg-card border border-molten/20 hover:border-molten hover:text-molten transition-colors lg:hidden"
              >
                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            )}
            <h2 className="text-lg lg:text-xl font-bold">Platform Dashboard</h2>
          </div>
          <div className="flex items-center gap-3 lg:gap-4">
            <div className="flex items-center gap-2 px-2 sm:px-3 py-1 bg-success/10 border border-success/20 rounded-full text-success text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_var(--success)]"></span>
              <span className="hidden sm:inline">ONLINE</span>
            </div>
            <button onClick={toggleTheme} className="p-2 rounded-lg bg-card border border-molten/20 hover:border-molten hover:text-molten transition-colors">
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-molten/5 via-obsidian to-obsidian">
          <Outlet />
        </main>
      </div>
      <AccountWizardModal isOpen={isWizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}

Layout.propTypes = {
  theme: PropTypes.string.isRequired,
  toggleTheme: PropTypes.func.isRequired,
};
