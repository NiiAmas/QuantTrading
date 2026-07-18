import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Shield, TrendingUp, Zap, Trash2 } from 'lucide-react';
import useAccountStore from '../store/useStore';

export default function EditAccountModal({ isOpen, onClose, account }) {
  const { updateAccount, deleteAccount } = useAccountStore();
  const [name, setName] = useState('');
  const [strategy, setStrategy] = useState('Moderate');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    if (account) {
      setName(account.name || '');
      setStrategy(account.type || 'Moderate'); // In frontend store, strategy is mapped to 'type'
    }
    setShowConfirmDelete(false);
  }, [account, isOpen]);

  if (!isOpen || !account) return null;

  const handleSave = () => {
    updateAccount(account.id, {
      name: name.trim() || 'Unnamed Account',
      strategy: strategy
    });
    onClose();
  };

  const handleDelete = () => {
    deleteAccount(account.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md transition-all duration-300">
      <div className="bg-obsidian border border-molten/30 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-lg font-bold text-white tracking-widest uppercase flex items-center gap-2">
            <ShieldAlert size={20} className="text-molten" /> Account Settings
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 space-y-6">
          {!showConfirmDelete ? (
            <>
              {/* Account Name */}
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">Account Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-molten transition-colors font-semibold"
                  placeholder="e.g. Day Trading Account"
                />
              </div>

              {/* Risk Level / Strategy */}
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest">Risk Profile</label>
                <div className="space-y-3">
                  <button 
                    onClick={() => setStrategy('Low')}
                    className={`w-full flex items-center gap-4 p-3 rounded-xl border transition-all ${strategy === 'Low' ? 'bg-success/20 border-success text-success' : 'border-white/5 text-gray-400 hover:border-white/15'}`}
                  >
                    <Shield size={24} />
                    <div className="text-left">
                      <div className="font-bold text-sm text-white">Low-Risk (Conservative)</div>
                      <div className="text-xs opacity-75">Target 2-7% annual. Steady flow.</div>
                    </div>
                  </button>

                  <button 
                    onClick={() => setStrategy('Moderate')}
                    className={`w-full flex items-center gap-4 p-3 rounded-xl border transition-all ${strategy === 'Moderate' ? 'bg-molten/20 border-molten text-molten' : 'border-white/5 text-gray-400 hover:border-white/15'}`}
                  >
                    <TrendingUp size={24} />
                    <div className="text-left">
                      <div className="font-bold text-sm text-white">Moderate-Risk (Balanced)</div>
                      <div className="text-xs opacity-75">Target 2-5% monthly. Swing tactics.</div>
                    </div>
                  </button>

                  <button 
                    onClick={() => setStrategy('Aggressive')}
                    className={`w-full flex items-center gap-4 p-3 rounded-xl border transition-all ${strategy === 'Aggressive' ? 'bg-red-500/20 border-red-500 text-red-500' : 'border-white/5 text-gray-400 hover:border-white/15'}`}
                  >
                    <Zap size={24} />
                    <div className="text-left">
                      <div className="font-bold text-sm text-white">High-Risk (Aggressive)</div>
                      <div className="text-xs opacity-75">Target 20-30% monthly. Fast scalping.</div>
                    </div>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Delete Confirmation UI */
            <div className="py-6 text-center space-y-4 animate-in fade-in duration-200">
              <div className="w-16 h-16 bg-danger/10 border border-danger/30 text-danger rounded-full flex items-center justify-center mx-auto mb-2">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-white uppercase tracking-wider">Delete Sub-Account?</h3>
              <p className="text-sm text-gray-400 max-w-sm mx-auto leading-relaxed">
                Are you sure you want to delete <span className="text-white font-bold">"{account.name}"</span>? All history, trades, and assets associated with this sub-account will be permanently deleted. This action cannot be undone.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex justify-between bg-white/5">
          {!showConfirmDelete ? (
            <>
              <button 
                onClick={() => setShowConfirmDelete(true)} 
                className="px-4 py-2 border border-danger/30 text-danger/80 hover:text-danger hover:bg-danger/10 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors"
              >
                <Trash2 size={16} /> Delete
              </button>
              <div className="flex gap-3">
                <button onClick={onClose} className="px-5 py-2 rounded-lg font-bold text-sm text-gray-400 hover:text-white transition-colors">
                  Cancel
                </button>
                <button 
                  onClick={handleSave} 
                  disabled={!name.trim()}
                  className="px-5 py-2 bg-molten text-obsidian rounded-lg font-extrabold text-sm hover:bg-yellow-500 transition-colors disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </>
          ) : (
            <>
              <button 
                onClick={() => setShowConfirmDelete(false)} 
                className="px-5 py-2 rounded-lg font-bold text-sm text-gray-400 hover:text-white transition-colors"
              >
                Go Back
              </button>
              <button 
                onClick={handleDelete} 
                className="px-6 py-2 bg-danger text-white rounded-lg font-extrabold text-sm hover:bg-red-600 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.3)]"
              >
                Confirm Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
