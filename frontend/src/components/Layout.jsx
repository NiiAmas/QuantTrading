import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Sun, Moon } from 'lucide-react';
import PropTypes from 'prop-types';
import useAccountStore from '../store/useStore';
import AccountWizardModal from './AccountWizardModal';

export default function Layout({ theme, toggleTheme }) {
  const { isWizardOpen, setWizardOpen } = useAccountStore();
  return (
    <div className={`flex h-screen overflow-hidden relative`}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="flex justify-between items-center px-8 py-5 border-b border-molten/20 bg-obsidian backdrop-blur-md z-10">
          <h2 className="text-xl font-bold">Platform Dashboard</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-success/10 border border-success/20 rounded-full text-success text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_var(--success)]"></span>
              ONLINE
            </div>
            <button onClick={toggleTheme} className="p-2 rounded-lg bg-card border border-molten/20 hover:border-molten hover:text-molten transition-colors">
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-molten/5 via-obsidian to-obsidian">
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
