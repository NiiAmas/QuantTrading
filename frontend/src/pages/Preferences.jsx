import React, { useState, useEffect } from 'react';
import { Settings, Key, ShieldAlert, Bell, Terminal, Save, PowerOff, Check } from 'lucide-react';
import useStore from '../store/useStore';

/* ═══════════════════════════════════════════════════════════════════════
   Preferences Page — Platform Settings
   (All settings persist to localStorage via Zustand store)
   
   FIXES APPLIED:
     - Default tab is now "API Integrations" (first tab, not last)
     - ALL toggles are wired to localSettings state (email, animations, etc.)
     - Settings save to localStorage on "Apply Changes" click
     - Settings survive page refresh and tab switches
   ═══════════════════════════════════════════════════════════════════════ */
export default function Preferences() {
  const { settings, updateSettings } = useStore();
  // FIX: Default to first tab instead of last
  const [activeTab, setActiveTab] = useState('API Integrations');
  const [saved, setSaved] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);

  // Sync from store when it changes externally
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = () => {
    updateSettings(localSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // Helper to update a single setting field
  const updateField = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const tabs = ['API Integrations', 'Risk Management', 'Alerts & Notifications', 'System UI'];

  // Reusable toggle component
  const Toggle = ({ settingKey, label, description }) => (
    <div className="bg-obsidian border border-white/5 p-5 rounded-xl flex justify-between items-center">
      <div>
        <h3 className="text-white font-bold">{label}</h3>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input 
          type="checkbox" 
          className="sr-only peer" 
          checked={!!localSettings[settingKey]} 
          onChange={(e) => updateField(settingKey, e.target.checked)} 
        />
        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-molten"></div>
      </label>
    </div>
  );

  // Reusable slider component
  const Slider = ({ settingKey, label, description, min, max, step = 1, suffix = '%' }) => (
    <div className="bg-obsidian border border-white/5 p-5 rounded-xl">
      <h3 className="text-white font-bold mb-2">{label}</h3>
      <p className="text-xs text-gray-500 mb-4">{description}</p>
      <div className="flex items-center gap-4">
        <input 
          type="range" 
          min={min} 
          max={max} 
          step={step} 
          value={localSettings[settingKey] ?? min} 
          onChange={(e) => updateField(settingKey, parseFloat(e.target.value))} 
          className="flex-1 accent-molten" 
        />
        <span className="text-xl font-bold font-mono text-molten min-w-[60px] text-right">
          {(localSettings[settingKey] ?? min).toFixed(step < 1 ? 1 : 0)}{suffix}
        </span>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col gap-4 sm:gap-6 max-w-5xl mx-auto w-full z-10 relative">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-widest uppercase flex items-center gap-2 sm:gap-3">
            <Settings className="text-molten shrink-0" size={24} /> Platform Preferences
          </h1>
          <p className="text-gray-400 mt-1 sm:mt-2 text-xs sm:text-sm">Configure core engine parameters, API bridges, and global fail-safes.</p>
        </div>
        <button className="px-4 sm:px-6 py-2 bg-danger/10 text-danger border border-danger/30 rounded-lg font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-danger hover:text-white transition-colors text-xs sm:text-sm shrink-0">
          <PowerOff size={16} /> <span className="hidden sm:inline">Global</span> Kill Switch
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 flex-1 min-h-0">
        {/* Left Sidebar for Settings Tabs (horizontal on mobile) */}
        <div className="w-full lg:w-64 bg-card border border-molten/20 rounded-2xl p-3 lg:p-4 flex flex-row lg:flex-col gap-2 shrink-0 overflow-x-auto lg:overflow-visible">
          {tabs.map(tab => {
            const getIcon = () => {
              if (tab === 'API Integrations') return <Key size={18} />;
              if (tab === 'Risk Management') return <ShieldAlert size={18} />;
              if (tab === 'Alerts & Notifications') return <Bell size={18} />;
              return <Terminal size={18} />;
            };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-3 w-full p-3 rounded-xl font-bold transition-all text-sm ${activeTab === tab ? 'bg-molten/20 text-molten border border-molten/50' : 'text-gray-400 border border-transparent hover:bg-white/5 hover:text-gray-300'}`}
              >
                {getIcon()} {tab}
              </button>
            );
          })}
        </div>

        {/* Main Settings Panel */}
        <div className="flex-1 bg-card border border-molten/20 rounded-2xl p-4 sm:p-6 lg:p-8 overflow-y-auto custom-scrollbar relative">
          
          {activeTab === 'API Integrations' && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-xl font-bold text-white uppercase tracking-wider mb-6 border-b border-white/10 pb-4">Broker & Data Connectors</h2>
              
              <div className="space-y-6">
                <div className="bg-obsidian border border-white/5 p-5 rounded-xl">
                  <h3 className="text-molten font-bold mb-1">Alpaca Trading API (Stocks)</h3>
                  <p className="text-xs text-gray-500 mb-4">Required to execute live stock trades.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">API Key</label>
                      <input 
                        type="password" 
                        placeholder="PKB..." 
                        value={localSettings.alpacaApiKey || ''} 
                        onChange={(e) => updateField('alpacaApiKey', e.target.value)} 
                        className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1 font-mono text-sm" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Secret Key</label>
                      <input 
                        type="password" 
                        placeholder="****************" 
                        value={localSettings.alpacaSecretKey || ''} 
                        onChange={(e) => updateField('alpacaSecretKey', e.target.value)} 
                        className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1 font-mono text-sm" 
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-obsidian border border-white/5 p-5 rounded-xl">
                  <h3 className="text-molten font-bold mb-1">Binance / Coinbase API (Crypto)</h3>
                  <p className="text-xs text-gray-500 mb-4">Required for cryptocurrency arbitrage and execution.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">API Key</label>
                      <input 
                        type="password" 
                        placeholder="xyz..." 
                        value={localSettings.binanceApiKey || ''} 
                        onChange={(e) => updateField('binanceApiKey', e.target.value)} 
                        className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1 font-mono text-sm" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Secret Key</label>
                      <input 
                        type="password" 
                        placeholder="****************" 
                        value={localSettings.binanceSecretKey || ''} 
                        onChange={(e) => updateField('binanceSecretKey', e.target.value)} 
                        className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1 font-mono text-sm" 
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-obsidian border border-white/5 p-5 rounded-xl">
                  <h3 className="text-molten font-bold mb-1">NewsAPI Key (Sentiment Engine)</h3>
                  <p className="text-xs text-gray-500 mb-4">Powers the financial news ingestion layer for FinBERT AI analysis.</p>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">NewsAPI Key</label>
                    <input 
                      type="password" 
                      placeholder="4870e71a..." 
                      value={localSettings.newsApiKey || ''} 
                      onChange={(e) => updateField('newsApiKey', e.target.value)} 
                      className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1 font-mono text-sm" 
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Risk Management' && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-xl font-bold text-white uppercase tracking-wider mb-6 border-b border-white/10 pb-4">Global Account Safeguards</h2>
              
              <div className="space-y-6">
                <Slider 
                  settingKey="maxDrawdown" 
                  label="Max Daily Drawdown" 
                  description="If the global portfolio drops by this percentage in a single day, all active bots will halt trading immediately."
                  min={1} max={20} step={0.5} 
                />

                <Slider 
                  settingKey="slippageTolerance" 
                  label="Slippage Tolerance" 
                  description="Maximum acceptable price movement between order dispatch and fill."
                  min={0.1} max={5.0} step={0.1} 
                />
                
                <Toggle 
                  settingKey="blockWeekend" 
                  label="Block Weekend Crypto Trading" 
                  description="Prevent the engine from taking crypto trades on Sat/Sun due to low liquidity."
                />
              </div>
            </div>
          )}

          {activeTab === 'Alerts & Notifications' && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-xl font-bold text-white uppercase tracking-wider mb-6 border-b border-white/10 pb-4">Communication Hooks</h2>
              
              <div className="space-y-6">
                <div className="bg-obsidian border border-white/5 p-5 rounded-xl">
                  <h3 className="text-molten font-bold mb-1">Telegram Webhook</h3>
                  <p className="text-xs text-gray-500 mb-4">Send real-time trade execution receipts to a Telegram channel.</p>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Bot Token URL</label>
                    <input 
                      type="text" 
                      placeholder="https://api.telegram.org/bot..." 
                      value={localSettings.telegramWebhook || ''} 
                      onChange={(e) => updateField('telegramWebhook', e.target.value)} 
                      className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1 font-mono text-sm" 
                    />
                  </div>
                </div>

                <Toggle 
                  settingKey="emailReports" 
                  label="Email Trade Receipts" 
                  description="Receive a daily EOD (End of Day) report of all bot activity sent to your registered email."
                />

                <Toggle 
                  settingKey="tradeAlerts" 
                  label="Trade Execution Alerts" 
                  description="Get notified in-app when the bot opens or closes a position."
                />

                <Toggle 
                  settingKey="signalAlerts" 
                  label="AI Signal Alerts" 
                  description="Get notified when FinBERT generates a strong BUY or SELL signal."
                />
              </div>
            </div>
          )}

          {activeTab === 'System UI' && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-xl font-bold text-white uppercase tracking-wider mb-6 border-b border-white/10 pb-4">Interface Preferences</h2>
              
              <div className="space-y-6">
                <Toggle 
                  settingKey="reduceAnimations" 
                  label="Reduce Animations" 
                  description="Disables the glowing globe and scanner bars for lower CPU usage."
                />

                <div className="bg-obsidian border border-white/5 p-5 rounded-xl">
                  <h3 className="text-white font-bold mb-2">Base Currency</h3>
                  <p className="text-xs text-gray-500 mb-4">Currency used for global portfolio calculation.</p>
                  <select 
                    value={localSettings.baseCurrency || 'USD'} 
                    onChange={(e) => updateField('baseCurrency', e.target.value)} 
                    className="bg-white/5 border border-white/10 rounded p-2 text-white outline-none"
                  >
                    <option value="USD">USD - United States Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="JPY">JPY - Japanese Yen</option>
                  </select>
                </div>

                <Toggle 
                  settingKey="compactMode" 
                  label="Compact Mode" 
                  description="Use a more compact layout with smaller cards and tighter spacing."
                />
              </div>
            </div>
          )}

          {/* Save Button — fixed to bottom */}
          <div className="sticky bottom-0 pt-6 pb-2 bg-gradient-to-t from-card via-card to-transparent">
            <button 
              onClick={handleSave}
              className={`px-8 py-3 rounded-lg font-bold uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl float-right ${saved ? 'bg-success text-white scale-95' : 'bg-molten text-obsidian hover:bg-yellow-500'}`}
            >
              {saved ? <><Check size={18} /> Saved!</> : <><Save size={18} /> Apply Changes</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
