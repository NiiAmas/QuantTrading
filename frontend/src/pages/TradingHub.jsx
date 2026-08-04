import React, { useState, useEffect } from 'react';
import axios from 'axios';
import useAccountStore from '../store/useStore';
import useAuthStore from '../store/useAuthStore';
import API_URL from '../config/api';
import { Activity, ShieldCheck, Zap, Briefcase, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';

export default function TradingHub() {
  const { accounts, activeAccount: activeAccountId } = useAccountStore();
  const activeAccount = accounts.find(a => a.id === activeAccountId);
  
  // Dummy data generated based on the active account type for the demo
  const [positions, setPositions] = useState([]);
  const [tradeLedger, setTradeLedger] = useState([]);
  const [tradeTab, setTradeTab] = useState('Open');
  const [assetTab, setAssetTab] = useState('Holding');
  const [expandedAsset, setExpandedAsset] = useState(null);

  useEffect(() => {
    const fetchHubData = async () => {
      if (activeAccountId) {
        try {
          const token = useAuthStore.getState().token;
          const res = await axios.get(`${API_URL}/accounts/${activeAccountId}/data`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setPositions(res.data.positions || []);
          setTradeLedger(res.data.tradeLedger || []);
        } catch(e) {
          console.error(e);
        }
      }
    };
    fetchHubData();
    const interval = setInterval(fetchHubData, 5000);
    return () => clearInterval(interval);
  }, [activeAccountId]);

  if (!activeAccount) return <div className="p-10 text-center font-bold text-gray-400">No account selected. Please select or create an account.</div>;

  return (
    <div className="flex flex-col gap-6 h-full relative">
      {/* Bot Scanner Animation Header */}
      <div className="bg-obsidian/80 border border-molten/30 rounded-2xl p-4 shadow-2xl relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-success/5 pointer-events-none"></div>
        {/* The Scanning Strobing Light */}
        <div className="absolute top-0 left-0 w-full h-[3px] bg-white/5">
          <div className="h-full w-[15%] bg-success shadow-[0_0_20px_4px_var(--success)] scanner-animation"></div>
        </div>
        <div className="flex items-center justify-between relative z-10 pl-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-success/20 rounded-xl text-success shadow-[0_0_15px_rgba(16,185,129,0.2)] border border-success/30">
              <Activity size={24} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
                Engine Active <span className="w-2 h-2 rounded-full bg-success animate-ping"></span>
              </h2>
              <p className="text-xs text-gray-400 font-mono tracking-wide">Running 3-Layer Verification on {activeAccount.name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Left Pane - Portfolio Holdings */}
        <div className="flex-1 flex flex-col gap-4 bg-card border border-molten/20 rounded-2xl p-6 overflow-hidden shadow-xl">
          <div className="flex items-center justify-between border-b border-molten/20 pb-3">
            <h3 className="text-lg font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Briefcase className="text-molten" size={20}/> Asset Holdings
            </h3>
            <div className="flex gap-2 bg-obsidian p-1 rounded-lg border border-white/5">
              <button 
                onClick={() => { setAssetTab('Holding'); setExpandedAsset(null); }}
                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${assetTab === 'Holding' ? 'bg-molten/20 text-molten' : 'text-gray-500 hover:text-white'}`}
              >
                Holding
              </button>
              <button 
                onClick={() => { setAssetTab('Sold'); setExpandedAsset(null); }}
                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${assetTab === 'Sold' ? 'bg-molten/20 text-molten' : 'text-gray-500 hover:text-white'}`}
              >
                Sold
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <div className="grid grid-cols-1 gap-4">
              {assetTab === 'Holding' && positions.map(pos => (
                <div key={pos.asset} className="bg-obsidian border border-white/5 rounded-xl p-4 transition-colors shadow-lg">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xl font-bold text-white">{pos.asset}</h4>
                        <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-300 uppercase tracking-wider font-bold">{pos.class}</span>
                      </div>
                      <div className={`text-sm font-bold flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg ${pos.pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                        {pos.pnl >= 0 ? '+' : '-'}${Math.abs(pos.pnl).toLocaleString()} {pos.pnl >= 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3 text-sm border-t border-white/5 pt-3">
                      <div>
                        <div className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">Total Coins/Shares</div>
                        <div className="text-white font-mono font-semibold">{pos.shares}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">Avg Entry</div>
                        <div className="text-white font-mono font-semibold">${pos.avgPrice.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">Total Value</div>
                        <div className="text-molten font-mono font-bold text-lg">${pos.value.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {assetTab === 'Sold' && (() => {
                const closedTradesGrouped = tradeLedger.filter(t => t.status === 'Closed' && t.type === 'Long' && !t.pair.includes('=X') && !t.pair.includes('=F')).reduce((acc, t) => {
                  if (!acc[t.pair]) {
                    acc[t.pair] = { asset: t.pair, trades: [], totalPnl: 0, totalShares: 0 };
                  }
                  acc[t.pair].trades.push(t);
                  acc[t.pair].totalPnl += t.pnlDollars;
                  acc[t.pair].totalShares += t.quantity;
                  return acc;
                }, {});
                const soldAssets = Object.values(closedTradesGrouped);

                if (soldAssets.length === 0) return <div className="text-center text-gray-500 font-bold mt-10">No sold assets yet.</div>;

                return soldAssets.map(pos => (
                  <div key={pos.asset} className="bg-obsidian border border-white/5 rounded-xl p-4 transition-colors shadow-lg">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xl font-bold text-gray-400">{pos.asset} <span className="text-[10px] uppercase ml-2 bg-gray-800 text-gray-300 border border-gray-600 px-2 py-0.5 rounded">Sold Out</span></h4>
                        </div>
                        <div className={`text-sm font-bold flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg ${pos.totalPnl >= 0 ? 'text-success' : 'text-danger'}`}>
                          {pos.totalPnl >= 0 ? '+' : '-'}${Math.abs(pos.totalPnl).toLocaleString()} {pos.totalPnl >= 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3 text-sm border-t border-white/5 pt-3">
                        <div>
                          <div className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">Total Slices Sold</div>
                          <div className="text-white font-mono font-semibold">{pos.trades.length}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">Total Realized P&L</div>
                          <div className={`font-mono font-bold text-lg ${pos.totalPnl >= 0 ? 'text-success' : 'text-danger'}`}>
                            {pos.totalPnl >= 0 ? '+' : ''}${pos.totalPnl.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              })()}

              {assetTab === 'Holding' && positions.length === 0 && (
                <div className="text-center text-gray-500 font-bold mt-10">Waiting for 3-layer verification to execute first trade...</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Pane - Trade Ledger */}
        <div className="flex-1 flex flex-col gap-4 bg-card border border-molten/20 rounded-2xl p-6 overflow-hidden shadow-xl">
          <div className="flex items-center justify-between border-b border-molten/20 pb-3">
            <h3 className="text-lg font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Zap className="text-molten" size={20}/> Active Trade Ledger
            </h3>
            <div className="flex gap-2 bg-obsidian p-1 rounded-lg border border-white/5">
              <button 
                onClick={() => setTradeTab('Open')}
                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${tradeTab === 'Open' ? 'bg-molten/20 text-molten' : 'text-gray-500 hover:text-white'}`}
              >
                Open
              </button>
              <button 
                onClick={() => setTradeTab('Closed')}
                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${tradeTab === 'Closed' ? 'bg-molten/20 text-molten' : 'text-gray-500 hover:text-white'}`}
              >
                Closed
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <div className="space-y-4">
              {tradeLedger.filter(t => t.status === tradeTab).map(trade => (
                <div key={trade.id} className="bg-obsidian border border-white/5 rounded-xl p-4 flex flex-col gap-2 shadow-lg">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-white text-lg">{trade.pair}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider border ${trade.type.includes('Long') ? 'bg-success/10 text-success border-success/30' : 'bg-danger/10 text-danger border-danger/30'}`}>
                        {trade.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-[10px] text-gray-400 font-mono text-right flex flex-col">
                        <span>Opened: {new Date(trade.openedAt).toLocaleString()}</span>
                        {trade.closedAt && <span>Closed: {new Date(trade.closedAt).toLocaleString()}</span>}
                      </div>
                      <div className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${trade.status === 'Open' ? 'bg-molten/20 text-molten border border-molten/30' : 'bg-gray-800 text-gray-400 border border-gray-600'}`}>
                        {trade.status}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-end mt-2">
                    <div className="flex gap-4">
                      <div className="bg-white/5 px-3 py-1.5 rounded-lg">
                        <div className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-0.5">Entry</div>
                        <div className="text-white font-mono text-sm">${trade.entry.toLocaleString()}</div>
                      </div>
                      <div className="bg-white/5 px-3 py-1.5 rounded-lg">
                        <div className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-0.5">Current</div>
                        <div className="text-white font-mono text-sm">${trade.current.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-0.5">Total P&L</div>
                      <div className={`font-mono font-bold text-xl drop-shadow-md ${trade.pnl.includes('-') ? 'text-danger' : 'text-success'}`}>
                        {trade.pnl} <span className="text-sm">({trade.pnlDollars >= 0 ? '+' : ''}${trade.pnlDollars.toLocaleString()})</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {tradeLedger.filter(t => t.status === tradeTab).length === 0 && (
                <div className="text-center text-gray-500 font-bold mt-10">No {tradeTab.toLowerCase()} trades in ledger.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
