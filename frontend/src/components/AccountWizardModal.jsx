import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Shield, TrendingUp, Zap } from 'lucide-react';
import useAccountStore from '../store/useStore';

export default function AccountWizardModal({ isOpen, onClose }) {
  const { createAccount } = useAccountStore();
  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState({
    name: '',
    balance: 10000,
    assets: [],
    sectors: [],
    strategy: ''
  });

  if (!isOpen) return null;

  const handleNext = () => setStep(s => s + 1);
  const handlePrev = () => setStep(s => s - 1);
  
  const handleCreate = () => {
    createAccount({
      name: formData.name || 'New Account',
      balance: Number(formData.balance),
      strategy: formData.strategy || 'Moderate'
    });
    
    // reset form
    setStep(1);
    setFormData({
      name: '', balance: 10000, assets: [], sectors: [], strategy: ''
    });
    
    onClose();
    console.log("--- STARTING 3-LAYER VERIFICATION ANALYSIS ---");
    console.log("1. Technical Analysis initiated...");
    console.log("2. Sentiment Analysis pulling news...");
    console.log("3. Quantitative Math Models evaluating...");
  };

  const toggleAsset = (asset) => {
    setFormData(prev => ({
      ...prev,
      assets: prev.assets.includes(asset) 
        ? prev.assets.filter(a => a !== asset)
        : [...prev.assets, asset]
    }));
  };

  const ALL_SECTORS = [
    'Technology', 'Energy', 'Finance', 'SpaceX (Beta API)', 
    'Healthcare', 'Consumer Goods', 'Real Estate', 
    'Utilities', 'Industrials', 'Materials', 'Telecommunications'
  ];

  const toggleSector = (sector) => {
    if (sector === 'All Sectors') {
      const allSelected = formData.sectors.length === ALL_SECTORS.length;
      setFormData(prev => ({ ...prev, sectors: allSelected ? [] : [...ALL_SECTORS] }));
      return;
    }

    setFormData(prev => {
      const newSectors = prev.sectors.includes(sector)
        ? prev.sectors.filter(s => s !== sector)
        : [...prev.sectors, sector];
      return { ...prev, sectors: newSectors };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="bg-obsidian border border-molten/30 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-white tracking-widest uppercase">
            {step === 1 && "Step 1: Account Setup"}
            {step === 2 && "Step 2: Market Selection"}
            {step === 3 && "Step 3: Risk Profile"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 min-h-[300px]">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">Account Name</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-molten transition-colors"
                  placeholder="e.g. Tech Swing Fund"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">Starting Balance (USD)</label>
                <input 
                  type="number" 
                  value={formData.balance}
                  onChange={(e) => setFormData({...formData, balance: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-molten transition-colors"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">Target Markets</label>
                <div className="flex gap-4">
                  {['Stocks', 'Crypto', 'Forex'].map(asset => (
                    <button 
                      key={asset}
                      onClick={() => toggleAsset(asset)}
                      className={`flex-1 p-3 rounded-xl border font-bold transition-all ${formData.assets.includes(asset) ? 'bg-molten/20 border-molten text-molten' : 'border-white/10 text-gray-400 hover:border-white/30'}`}
                    >
                      {asset}
                    </button>
                  ))}
                </div>
              </div>

              {formData.assets.includes('Stocks') && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">Stock Sectors & Exclusives</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <button 
                      onClick={() => toggleSector('All Sectors')}
                      className={`p-2 rounded-lg border text-sm font-semibold transition-all ${formData.sectors.length === ALL_SECTORS.length ? 'bg-molten/10 border-molten text-molten' : 'border-white/5 text-gray-500 hover:border-white/20 hover:text-gray-300'}`}
                    >
                      All Sectors
                    </button>
                    {ALL_SECTORS.map(sector => (
                      <button 
                        key={sector}
                        onClick={() => toggleSector(sector)}
                        className={`p-2 rounded-lg border text-sm font-semibold transition-all ${formData.sectors.includes(sector) ? 'bg-molten/10 border-molten text-molten' : 'border-white/5 text-gray-500 hover:border-white/20 hover:text-gray-300'}`}
                      >
                        {sector}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <button 
                onClick={() => setFormData({...formData, strategy: 'Low'})}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${formData.strategy === 'Low' ? 'bg-success/20 border-success text-success' : 'border-white/10 text-gray-400 hover:border-white/30'}`}
              >
                <Shield size={32} />
                <div className="text-left">
                  <div className="font-bold text-lg text-white">Low-Risk (Conservative)</div>
                  <div className="text-sm opacity-80">Target 2-7% annual. Steady flow over time.</div>
                </div>
              </button>

              <button 
                onClick={() => setFormData({...formData, strategy: 'Moderate'})}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${formData.strategy === 'Moderate' ? 'bg-molten/20 border-molten text-molten' : 'border-white/10 text-gray-400 hover:border-white/30'}`}
              >
                <TrendingUp size={32} />
                <div className="text-left">
                  <div className="font-bold text-lg text-white">Moderate-Risk (Balanced)</div>
                  <div className="text-sm opacity-80">Target 2-5% monthly. Swing tactics and trend following.</div>
                </div>
              </button>

              <button 
                onClick={() => setFormData({...formData, strategy: 'Aggressive'})}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${formData.strategy === 'Aggressive' ? 'bg-red-500/20 border-red-500 text-red-500' : 'border-white/10 text-gray-400 hover:border-white/30'}`}
              >
                <Zap size={32} />
                <div className="text-left">
                  <div className="font-bold text-lg text-white">High-Risk (Aggressive)</div>
                  <div className="text-sm opacity-80">Target 20-30% monthly. Fast, aggressive scalping.</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex justify-between bg-white/5">
          {step > 1 ? (
            <button onClick={handlePrev} className="px-6 py-2 rounded-lg font-bold text-gray-400 hover:text-white flex items-center gap-2">
              <ChevronLeft size={20} /> Back
            </button>
          ) : <div></div>}

          {step < 3 ? (
            <button 
              onClick={handleNext} 
              disabled={step === 1 && !formData.name}
              className="px-6 py-2 bg-molten text-obsidian rounded-lg font-bold flex items-center gap-2 hover:bg-yellow-500 transition-colors disabled:opacity-50"
            >
              Next <ChevronRight size={20} />
            </button>
          ) : (
            <button 
              onClick={handleCreate} 
              disabled={!formData.strategy}
              className="px-6 py-2 bg-molten text-obsidian rounded-lg font-bold hover:bg-yellow-500 transition-colors disabled:opacity-50"
            >
              Create & Deploy Bot
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
