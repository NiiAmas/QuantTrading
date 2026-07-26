import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Activity, LayoutDashboard, LineChart, Globe, Briefcase, ShieldAlert, Settings, ChevronDown, Plus, Wallet, LogOut, Compass, BarChart3 } from 'lucide-react';
import useAccountStore from '../store/useStore';
import useAuthStore from '../store/useAuthStore';
import AccountWizardModal from './AccountWizardModal';
import EditAccountModal from './EditAccountModal';

export default function Sidebar() {
  const { accounts, activeAccount, setActiveAccount, setWizardOpen } = useAccountStore();
  const { logout } = useAuthStore();
  const [showAccounts, setShowAccounts] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  
  const currentAccount = accounts.find(a => a.id === activeAccount);

  const navItems = [
    { id: 'dashboard', name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
    { id: 'trading-hub', name: 'Trading Hub', icon: <Briefcase size={20} />, path: '/trading-hub' },
    { id: 'news', name: 'News', icon: <Globe size={20} />, path: '/news' },
    { id: 'analysis', name: 'Analysis', icon: <BarChart3 size={20} />, path: '/analysis' },
    { id: 'charts', name: 'Charts', icon: <LineChart size={20} />, path: '/charts' },
    { id: 'markets', name: 'Market Explorer', icon: <Compass size={20} />, path: '/markets' },
    { id: 'settings', name: 'Settings', icon: <Settings size={20} />, path: '/settings' },
  ];

  return (
    <aside className="w-64 bg-obsidian backdrop-blur-xl border-r border-molten/20 flex flex-col py-6 shrink-0 h-full relative z-20">
      <div className="flex items-center gap-3 px-6 mb-8">
        <Activity size={28} className="text-molten" />
        <h2 className="text-xl font-extrabold text-white tracking-tight">QUANT<span className="text-molten">TRADING</span></h2>
      </div>

      {/* Account Switcher */}
      <div className="px-4 mb-8 relative">
        <button 
          onClick={() => setShowAccounts(!showAccounts)}
          className="w-full flex items-center justify-between bg-card border border-molten/20 hover:border-molten/50 transition-colors p-3 rounded-xl"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-molten/10 rounded-lg text-molten"><Wallet size={16}/></div>
            <div className="text-left">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Active Account</p>
              <p className="text-sm font-bold text-white">{currentAccount?.name}</p>
            </div>
          </div>
          <ChevronDown size={16} className={`text-gray-400 transition-transform ${showAccounts ? 'rotate-180' : ''}`} />
        </button>

        {showAccounts && (
          <div className="absolute top-full left-4 right-4 mt-2 bg-obsidian border border-molten/30 rounded-xl shadow-2xl p-2 z-50 overflow-hidden backdrop-blur-3xl">
            {accounts.map(acc => (
              <div 
                key={acc.id}
                className={`group/item w-full p-1.5 rounded-lg mb-1 flex justify-between items-center transition-colors ${activeAccount === acc.id ? 'bg-molten/20 text-molten' : 'hover:bg-white/5 text-gray-300'}`}
              >
                <button 
                  onClick={() => { setActiveAccount(acc.id); setShowAccounts(false); }}
                  className="flex-1 text-left font-semibold text-sm truncate pr-2"
                >
                  {acc.name}
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs opacity-60 font-mono">${acc.balance.toLocaleString()}</span>
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setEditingAccount(acc); 
                      setShowAccounts(false); 
                    }}
                    className="opacity-0 group-hover/item:opacity-100 p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
                    title="Account Settings"
                  >
                    <Settings size={13} />
                  </button>
                </div>
              </div>
            ))}
            <div className="h-px bg-molten/20 my-2"></div>
            <button 
              onClick={() => { setWizardOpen(true); setShowAccounts(false); }} 
              className="w-full flex items-center gap-2 p-2 text-sm font-bold text-molten hover:bg-molten/10 rounded-lg transition-colors"
            >
              <Plus size={16} /> Create New Account
            </button>
          </div>
        )}
      </div>

      <nav className="flex flex-col gap-2 px-4 flex-1">
        {navItems.map(tab => (
          <NavLink 
            key={tab.name}
            to={tab.path} 
            className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-lg font-semibold transition-all duration-200 ${isActive ? 'bg-molten/20 text-molten border-l-4 border-molten' : 'text-gray-400 hover:bg-molten/10 hover:text-white'}`}
          >
            {tab.icon}
            <span>{tab.name}</span>
          </NavLink>
        ))}
      </nav>
      <div className="px-4 mt-auto">
        <button 
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 p-3 bg-danger/10 text-danger border border-danger/20 rounded-xl font-bold hover:bg-danger hover:text-white transition-colors"
        >
          <LogOut size={18} /> Sign Out
        </button>
      </div>

      <EditAccountModal 
        isOpen={editingAccount !== null} 
        onClose={() => setEditingAccount(null)} 
        account={editingAccount} 
      />
    </aside>
  );
}
