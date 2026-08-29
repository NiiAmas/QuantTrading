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
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 bg-success/20 rounded-xl text-success shadow-[0_0_15px_rgba(16,185,129,0.2)] border border-success/30 shrink-0">
              <Activity size={20} className="animate-pulse sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
                Engine Active <span className="w-2 h-2 rounded-full bg-success animate-ping"></span>
              </h2>
              <p className="text-[10px] sm:text-xs text-gray-400 font-mono tracking-wide truncate">Running 3-Layer Verification on {activeAccount.name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* Left Pane - Portfolio Holdings */}
        <div className="flex-1 flex flex-col gap-4 bg-card border border-molten/20 rounded-2xl p-4 sm:p-6 overflow-hidden shadow-xl min-w-0">
          <div className="flex items-center justify-between border-b border-molten/20 pb-3 gap-2">
            <h3 className="text-base lg:text-lg font-bold text-white uppercase tracking-widest flex items-center gap-2 shrink-0">
              <Briefcase className="text-molten" size={20}/> <span className="hidden sm:inline">Asset</span> Holdings
            </h3>
            <div className="flex gap-1 sm:gap-2 bg-obsidian p-1 rounded-lg border border-white/5 shrink-0">
              <button 
                onClick={() => { setAssetTab('Holding'); setExpandedAsset(null); }}
                className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${assetTab === 'Holding' ? 'bg-molten/20 text-molten' : 'text-gray-500 hover:text-white'}`}
              >
                Holding
              </button>
              <button 
                onClick={() => { setAssetTab('Sold'); setExpandedAsset(null); }}
                className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${assetTab === 'Sold' ? 'bg-molten/20 text-molten' : 'text-gray-500 hover:text-white'}`}
              >
                Sold
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
            <div className="grid grid-cols-1 gap-4">
              {assetTab === 'Holding' && positions.map(pos => {
                const isExpanded = expandedAsset === pos.asset;
                const assetTrades = tradeLedger.filter(t => t.pair === pos.asset && t.status === 'Open');
                
                return (
                  <div 
                    key={pos.asset} 
                    className={`bg-obsidian border rounded-xl p-3 sm:p-4 transition-all shadow-lg cursor-pointer ${isExpanded ? 'border-molten/50 bg-obsidian/90' : 'border-white/5 hover:border-white/20'}`}
                    onClick={() => setExpandedAsset(isExpanded ? null : pos.asset)}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <h4 className="text-lg sm:text-xl font-bold text-white truncate">{pos.asset}</h4>
                          <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-300 uppercase tracking-wider font-bold shrink-0">{pos.class}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`text-xs sm:text-sm font-bold flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg shrink-0 ${pos.pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                            {pos.pnl >= 0 ? '+' : '-'}${Math.abs(pos.pnl).toLocaleString()} {pos.pnl >= 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
                          </div>
                          <ChevronRight size={16} className={`text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-90 text-molten' : ''}`} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3 text-sm border-t border-white/5 pt-3">
                        <div className="min-w-0">
                          <div className="text-gray-500 text-[9px] sm:text-[10px] uppercase font-bold tracking-widest">Total Coins/Shares</div>
                          <div className="text-white font-mono font-semibold text-xs sm:text-sm truncate">{pos.shares}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-gray-500 text-[9px] sm:text-[10px] uppercase font-bold tracking-widest">Avg Entry</div>
                          <div className="text-white font-mono font-semibold text-xs sm:text-sm truncate">${pos.avgPrice.toLocaleString()}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-gray-500 text-[9px] sm:text-[10px] uppercase font-bold tracking-widest">Total Value</div>
                          <div className="text-molten font-mono font-bold text-sm sm:text-lg truncate">${pos.value.toLocaleString()}</div>
                        </div>
                      </div>

                      {/* Expandable Dropdown: Individual Buy Orders & Timestamps */}
                      {isExpanded && (
                        <div className="mt-4 pt-3 border-t border-white/10 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-1">
                            <span>Execution History ({assetTrades.length} buy lots)</span>
                            <span className="text-molten">Live Active Slices</span>
                          </div>
                          {assetTrades.map((t, idx) => (
                            <div key={t.id || idx} className="bg-card/70 border border-white/5 rounded-lg p-2.5 flex flex-wrap justify-between items-center gap-2 text-xs font-mono">
                              <div>
                                <div className="text-white font-semibold flex items-center gap-2">
                                  <span className="text-success font-bold">BUY</span> {t.quantity} shares @ ${t.entry.toLocaleString()}
                                </div>
                                <div className="text-[10px] text-gray-400 mt-0.5">
                                  Bought: {new Date(t.openedAt).toLocaleString()}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={`font-bold ${t.pnlDollars >= 0 ? 'text-success' : 'text-danger'}`}>
                                  {t.pnlDollars >= 0 ? '+' : ''}${t.pnlDollars.toLocaleString()} ({t.pnl})
                                </div>
                                <div className="text-[10px] text-gray-400">Current: ${t.current.toLocaleString()}</div>
                              </div>
                            </div>
                          ))}
                          {assetTrades.length === 0 && (
                            <div className="text-center text-gray-500 text-xs py-2">Consolidated holding from position management.</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

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

                return soldAssets.map(pos => {
                  const isExpanded = expandedAsset === pos.asset;
                  return (
                    <div 
                      key={pos.asset} 
                      className={`bg-obsidian border rounded-xl p-3 sm:p-4 transition-all shadow-lg cursor-pointer ${isExpanded ? 'border-molten/50 bg-obsidian/90' : 'border-white/5 hover:border-white/20'}`}
                      onClick={() => setExpandedAsset(isExpanded ? null : pos.asset)}
                    >
                      <div>
                        <div className="flex justify-between items-start mb-2 gap-2">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <h4 className="text-lg sm:text-xl font-bold text-gray-400">{pos.asset}</h4>
                            <span className="text-[10px] uppercase bg-gray-800 text-gray-300 border border-gray-600 px-2 py-0.5 rounded shrink-0">Sold Out</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`text-xs sm:text-sm font-bold flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg shrink-0 ${pos.totalPnl >= 0 ? 'text-success' : 'text-danger'}`}>
                              {pos.totalPnl >= 0 ? '+' : '-'}${Math.abs(pos.totalPnl).toLocaleString()} {pos.totalPnl >= 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
                            </div>
                            <ChevronRight size={16} className={`text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-90 text-molten' : ''}`} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-3 text-sm border-t border-white/5 pt-3">
                          <div>
                            <div className="text-gray-500 text-[9px] sm:text-[10px] uppercase font-bold tracking-widest">Total Slices Sold</div>
                            <div className="text-white font-mono font-semibold">{pos.trades.length}</div>
                          </div>
                          <div>
                            <div className="text-gray-500 text-[9px] sm:text-[10px] uppercase font-bold tracking-widest">Total Realized P&L</div>
                            <div className={`font-mono font-bold text-base sm:text-lg ${pos.totalPnl >= 0 ? 'text-success' : 'text-danger'}`}>
                              {pos.totalPnl >= 0 ? '+' : ''}${pos.totalPnl.toLocaleString()}
                            </div>
                          </div>
                        </div>

                        {/* Expandable Dropdown: Individual Sold Slices with Buy/Sell Dates */}
                        {isExpanded && (
                          <div className="mt-4 pt-3 border-t border-white/10 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-1">
                              <span>Sell Log ({pos.trades.length} closed trades)</span>
                              <span className="text-success">Profit Realized</span>
                            </div>
                            {pos.trades.map((t, idx) => (
                              <div key={t.id || idx} className="bg-card/70 border border-white/5 rounded-lg p-2.5 flex flex-wrap justify-between items-center gap-2 text-xs font-mono">
                                <div>
                                  <div className="text-white font-semibold flex items-center gap-2">
                                    <span className="text-molten font-bold">SOLD</span> {t.quantity} shares @ ${t.current.toLocaleString()} (Entry: ${t.entry.toLocaleString()})
                                  </div>
                                  <div className="text-[10px] text-gray-400 mt-0.5 space-x-2">
                                    <span>Bought: {new Date(t.openedAt).toLocaleString()}</span>
                                    <span>•</span>
                                    <span>Sold: {new Date(t.closedAt).toLocaleString()}</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`font-bold ${t.pnlDollars >= 0 ? 'text-success' : 'text-danger'}`}>
                                    {t.pnlDollars >= 0 ? '+' : ''}${t.pnlDollars.toLocaleString()} ({t.pnl})
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              })()}

              {assetTab === 'Holding' && positions.length === 0 && (
                <div className="text-center text-gray-500 font-bold mt-10">Waiting for 3-layer verification to execute first trade...</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Pane - Trade Ledger */}
        <div className="flex-1 flex flex-col gap-4 bg-card border border-molten/20 rounded-2xl p-4 sm:p-6 overflow-hidden shadow-xl min-w-0">
          <div className="flex items-center justify-between border-b border-molten/20 pb-3 gap-2">
            <h3 className="text-base lg:text-lg font-bold text-white uppercase tracking-widest flex items-center gap-2 shrink-0">
              <Zap className="text-molten" size={20}/> <span className="hidden sm:inline">Active</span> Trade Ledger
            </h3>
            <div className="flex gap-1 sm:gap-2 bg-obsidian p-1 rounded-lg border border-white/5 shrink-0">
              <button 
                onClick={() => setTradeTab('Open')}
                className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${tradeTab === 'Open' ? 'bg-molten/20 text-molten' : 'text-gray-500 hover:text-white'}`}
              >
                Open
              </button>
              <button 
                onClick={() => setTradeTab('Closed')}
                className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${tradeTab === 'Closed' ? 'bg-molten/20 text-molten' : 'text-gray-500 hover:text-white'}`}
              >
                Closed
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
            <div className="space-y-4">
              {tradeLedger.filter(t => t.status === tradeTab).map(trade => (
                <div key={trade.id} className="bg-obsidian border border-white/5 rounded-xl p-3 sm:p-4 flex flex-col gap-2 shadow-lg">
                  {/* Trade Header */}
                  <div className="flex flex-wrap justify-between items-center border-b border-white/5 pb-2 gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <span className="font-bold text-white text-base sm:text-lg truncate">{trade.pair}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider border shrink-0 ${trade.type.includes('Long') ? 'bg-success/10 text-success border-success/30' : 'bg-danger/10 text-danger border-danger/30'}`}>
                        {trade.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="text-[9px] sm:text-[10px] text-gray-400 font-mono text-right flex flex-col">
                        <span>Opened: {new Date(trade.openedAt).toLocaleString()}</span>
                        {trade.closedAt && <span>Closed: {new Date(trade.closedAt).toLocaleString()}</span>}
                      </div>
                      <div className={`text-[10px] font-bold uppercase tracking-wider px-2 sm:px-3 py-1 rounded-full shrink-0 ${trade.status === 'Open' ? 'bg-molten/20 text-molten border border-molten/30' : 'bg-gray-800 text-gray-400 border border-gray-600'}`}>
                        {trade.status}
                      </div>
                    </div>
                  </div>
                  {/* Trade Details */}
                  <div className="flex flex-wrap justify-between items-end mt-2 gap-3">
                    <div className="flex gap-3 sm:gap-4 flex-wrap">
                      <div className="bg-white/5 px-2 sm:px-3 py-1.5 rounded-lg">
                        <div className="text-gray-500 text-[9px] sm:text-[10px] uppercase font-bold tracking-widest mb-0.5">Entry</div>
                        <div className="text-white font-mono text-xs sm:text-sm">${trade.entry.toLocaleString()}</div>
                      </div>
                      <div className="bg-white/5 px-2 sm:px-3 py-1.5 rounded-lg">
                        <div className="text-gray-500 text-[9px] sm:text-[10px] uppercase font-bold tracking-widest mb-0.5">Current</div>
                        <div className="text-white font-mono text-xs sm:text-sm">${trade.current.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-500 text-[9px] sm:text-[10px] uppercase font-bold tracking-widest mb-0.5">Total P&L</div>
                      <div className={`font-mono font-bold text-lg sm:text-xl drop-shadow-md ${trade.pnl.includes('-') ? 'text-danger' : 'text-success'}`}>
                        {trade.pnl} <span className="text-xs sm:text-sm">({trade.pnlDollars >= 0 ? '+' : ''}${trade.pnlDollars.toLocaleString()})</span>
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
