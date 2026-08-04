import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../config/api';
import useAccountStore from '../store/useStore';
import useAuthStore from '../store/useAuthStore';
import { BarChart3, TrendingUp, TrendingDown, Filter, ChevronDown, ChevronUp, Search, Calendar, ArrowUpDown } from 'lucide-react';

export default function TradeAnalysis() {
  const { accounts, activeAccount: activeAccountId } = useAccountStore();
  const activeAccount = accounts.find(a => a.id === activeAccountId);
  const [trades, setTrades] = useState([]);
  const [positions, setPositions] = useState([]);
  const [accountStats, setAccountStats] = useState(null);
  const [expandedTrade, setExpandedTrade] = useState(null);
  const [filterCategory, setFilterCategory] = useState('All'); // All, Holding, Long, Short
  const [filterAsset, setFilterAsset] = useState('All');
  const [sortBy, setSortBy] = useState('date'); // date, pnl, asset
  const [sortDir, setSortDir] = useState('desc');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!activeAccountId) return;
      try {
        const token = useAuthStore.getState().token;
        const res = await axios.get(`${API_URL}/accounts/${activeAccountId}/data`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTrades(res.data.tradeLedger || []);
        setPositions(res.data.positions || []);
        setAccountStats(res.data.accountStats || null);
      } catch (e) {
        console.error("Failed to fetch trade analysis data", e);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [activeAccountId]);

  // Get unique assets for filter
  const uniqueAssets = [...new Set(trades.map(t => t.pair))];

  // Helper to categorize trades for the UI
  const getTradeCategory = (t) => {
    const isCrypto = t.pair.endsWith('-USD');
    const isForex = t.pair.includes('=X');
    const isCommodity = t.pair.includes('=F');
    const isStock = !isCrypto && !isForex && !isCommodity;
    
    // Shorts are always Shorts
    if (!t.type?.includes('Long')) return 'Short';
    
    // Longs on Crypto/Stocks are physical spot Holdings
    if (isCrypto || isStock) return 'Holding';
    
    // Longs on Forex/Commodities are leveraged Longs
    return 'Long';
  };

  // Filter & Sort
  let filtered = trades.filter(t => {
    const category = getTradeCategory(t);
    if (filterCategory !== 'All' && category !== filterCategory) return false;
    if (filterAsset !== 'All' && t.pair !== filterAsset) return false;
    if (searchQuery && !t.pair.toLowerCase().includes(searchQuery.toLowerCase()) && !t.reasoning?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  filtered.sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'date') cmp = new Date(a.openedAt || 0) - new Date(b.openedAt || 0);
    else if (sortBy === 'pnl') cmp = (a.pnlDollars || 0) - (b.pnlDollars || 0);
    else if (sortBy === 'asset') cmp = a.pair.localeCompare(b.pair);
    return sortDir === 'desc' ? -cmp : cmp;
  });

  const toggleSort = (field) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('desc'); }
  };

  const totalPnl = filtered.reduce((acc, t) => acc + (t.pnlDollars || 0), 0);
  const winCount = filtered.filter(t => (t.pnlDollars || 0) > 0).length;
  const lossCount = filtered.filter(t => (t.pnlDollars || 0) < 0).length;
  const winRate = filtered.length > 0 ? ((winCount / filtered.length) * 100).toFixed(1) : '0.0';

  if (!activeAccount) return <div className="p-10 text-center font-bold text-gray-400">No account selected. Please select or create an account.</div>;

  return (
    <div className="flex flex-col gap-6 h-full relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-widest uppercase flex items-center gap-3">
            <BarChart3 className="text-molten" size={28} /> Trade Analysis
          </h1>
          <p className="text-gray-400 text-sm mt-1">Detailed breakdown of every transaction on <span className="text-white font-bold">{activeAccount.name}</span></p>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border border-molten/20 rounded-xl p-4 shadow-lg">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Total Trades</p>
          <p className="text-2xl font-bold text-white">{filtered.length}</p>
        </div>
        <div className="bg-card border border-molten/20 rounded-xl p-4 shadow-lg">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Win Rate</p>
          <p className={`text-2xl font-bold ${parseFloat(winRate) >= 50 ? 'text-success' : 'text-danger'}`}>{winRate}%</p>
        </div>
        <div className="bg-card border border-molten/20 rounded-xl p-4 shadow-lg">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Wins / Losses</p>
          <p className="text-2xl font-bold text-white"><span className="text-success">{winCount}</span> / <span className="text-danger">{lossCount}</span></p>
        </div>
        <div className="bg-card border border-molten/20 rounded-xl p-4 shadow-lg">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Total P&L</p>
          <p className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-success' : 'text-danger'}`}>{totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-molten/20 rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Return (Real / Unreal)</p>
          <p className="text-xl font-bold">
            <span className={(accountStats?.realizedReturn || 0) >= 0 ? 'text-success' : 'text-danger'}>{accountStats?.realizedReturn || 0}%</span>
            <span className="text-gray-500 mx-1">/</span>
            <span className={(accountStats?.unrealizedReturn || 0) >= 0 ? 'text-success' : 'text-danger'}>{accountStats?.unrealizedReturn || 0}%</span>
          </p>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search trades..."
            className="w-full bg-obsidian border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-molten transition-colors"
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-1 bg-obsidian border border-white/10 rounded-lg p-1">
          {['All', 'Holding', 'Long', 'Short'].map(s => (
            <button
              key={s}
              onClick={() => setFilterCategory(s)}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${filterCategory === s ? 'bg-molten/20 text-molten' : 'text-gray-500 hover:text-white'}`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Asset Filter */}
        <select
          value={filterAsset}
          onChange={e => setFilterAsset(e.target.value)}
          className="bg-obsidian border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-gray-300 focus:outline-none focus:border-molten cursor-pointer"
        >
          <option value="All">All Assets</option>
          {uniqueAssets.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        {/* Sort Buttons */}
        <button onClick={() => toggleSort('date')} className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${sortBy === 'date' ? 'bg-molten/10 text-molten border-molten/30' : 'border-white/10 text-gray-500 hover:text-white'}`}>
          <Calendar size={12} /> Date {sortBy === 'date' && (sortDir === 'desc' ? <ChevronDown size={12}/> : <ChevronUp size={12}/>)}
        </button>
        <button onClick={() => toggleSort('pnl')} className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${sortBy === 'pnl' ? 'bg-molten/10 text-molten border-molten/30' : 'border-white/10 text-gray-500 hover:text-white'}`}>
          <ArrowUpDown size={12} /> P&L {sortBy === 'pnl' && (sortDir === 'desc' ? <ChevronDown size={12}/> : <ChevronUp size={12}/>)}
        </button>
      </div>

      {/* Trade Table */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-card border border-molten/20 rounded-2xl shadow-xl">
        <div className="divide-y divide-white/5">
          {filtered.map(trade => {
            const isExpanded = expandedTrade === trade.id;
            const isProfitable = (trade.pnlDollars || 0) >= 0;
            return (
              <div
                key={trade.id}
                className={`transition-colors ${isExpanded ? 'bg-white/5' : 'hover:bg-white/[0.02]'}`}
              >
                {/* Trade Row */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer"
                  onClick={() => setExpandedTrade(isExpanded ? null : trade.id)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border ${isProfitable ? 'bg-success/10 text-success border-success/30' : 'bg-danger/10 text-danger border-danger/30'}`}>
                      {isProfitable ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{trade.pair}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider border ${getTradeCategory(trade) === 'Holding' ? (trade.status === 'Open' ? 'bg-success/10 text-success border-success/30' : 'bg-gray-800 text-gray-400 border-gray-600') : getTradeCategory(trade) === 'Long' ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' : 'bg-danger/10 text-danger border-danger/30'}`}>
                          {getTradeCategory(trade) === 'Holding' ? (trade.status === 'Open' ? 'BOUGHT (HOLDING)' : 'SOLD (HOLDING)') : getTradeCategory(trade) === 'Long' ? (trade.status === 'Open' ? 'OPEN LONG' : 'CLOSED LONG') : trade.status === 'Open' ? 'OPEN SHORT' : 'CLOSED SHORT'}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                        {trade.openedAt ? new Date(trade.openedAt).toLocaleString() : 'N/A'}
                        {trade.closedAt && <span> → {new Date(trade.closedAt).toLocaleString()}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Entry</div>
                      <div className="text-sm text-white font-mono">${trade.entry?.toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Current</div>
                      <div className="text-sm text-white font-mono">${trade.current?.toLocaleString()}</div>
                    </div>
                    <div className="text-right min-w-[100px]">
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">P&L</div>
                      <div className={`text-sm font-bold font-mono ${isProfitable ? 'text-success' : 'text-danger'}`}>
                        {trade.pnl} ({isProfitable ? '+' : ''}${trade.pnlDollars?.toLocaleString()})
                      </div>
                    </div>
                    <div className="text-gray-500">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="bg-obsidian/80 rounded-xl p-5 border border-white/5 space-y-4">
                      {/* Trade Details Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Quantity</div>
                          <div className="text-white font-mono font-semibold">{trade.quantity}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Entry Price</div>
                          <div className="text-white font-mono font-semibold">${trade.entry?.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">{trade.status === 'Closed' ? 'Exit Price' : 'Current Price'}</div>
                          <div className="text-white font-mono font-semibold">${trade.current?.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Percentage P&L</div>
                          <div className={`font-mono font-bold ${isProfitable ? 'text-success' : 'text-danger'}`}>{trade.pnl}</div>
                        </div>
                        {trade.stopLoss && (
                          <div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Stop Loss</div>
                            <div className="text-danger font-mono font-semibold">${trade.stopLoss?.toLocaleString()}</div>
                          </div>
                        )}
                        {trade.takeProfit && (
                          <div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Take Profit</div>
                            <div className="text-success font-mono font-semibold">${trade.takeProfit?.toLocaleString()}</div>
                          </div>
                        )}
                        <div>
                          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Opened At</div>
                          <div className="text-gray-300 font-mono text-xs">{trade.openedAt ? new Date(trade.openedAt).toLocaleString() : 'N/A'}</div>
                        </div>
                        {trade.closedAt && (
                          <div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Closed At</div>
                            <div className="text-gray-300 font-mono text-xs">{new Date(trade.closedAt).toLocaleString()}</div>
                          </div>
                        )}
                      </div>

                      {/* AI Reasoning Breakdown */}
                      {trade.reasoning && (
                        <div className="border-t border-white/5 pt-4">
                          <div className="text-[10px] text-molten font-bold uppercase tracking-widest mb-3 flex items-center gap-1">
                            <BarChart3 size={12} /> AI Trade Analysis Breakdown
                          </div>
                          <div className="space-y-3 bg-black/30 p-4 rounded-xl border border-white/5">
                            <div>
                              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">
                                {getTradeCategory(trade) === 'Holding' ? 'Why we bought this asset:' : getTradeCategory(trade) === 'Long' ? 'Why we took this long:' : 'Why we took this short:'}
                              </span>
                              <p className="text-sm text-gray-200 leading-relaxed">
                                {trade.reasoning}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="p-16 text-center text-gray-500 font-bold uppercase tracking-widest">
              {trades.length === 0 ? 'No trades executed yet. The AI bot is analyzing markets...' : 'No trades match the current filters.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
