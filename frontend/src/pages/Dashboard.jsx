import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_URL from '../config/api';
import PropTypes from 'prop-types';
import { TrendingUp, TrendingDown, Wallet, PieChart, Activity, Globe as GlobeIcon, DollarSign, BarChart3, Briefcase, Info } from 'lucide-react';
import Globe from 'react-globe.gl';
import useStore from '../store/useStore';
import useAuthStore from '../store/useAuthStore';

const NewsCard = ({ news, onClick }) => {
  const isBullish = news.impact === 'Bullish';
  return (
    <div 
      onClick={() => onClick && onClick(news.id)}
      className="relative bg-card/80 backdrop-blur-md border border-molten/20 p-4 rounded-xl shadow-lg mb-4 hover:border-molten/50 transition-all group cursor-pointer hover:scale-[1.02]"
    >
      <div className="pr-24">
        <h4 className="text-sm font-bold text-white mb-1 group-hover:text-molten transition-colors">{news.headline}</h4>
        <p className="text-xs text-gray-400 line-clamp-2">{news.summary}</p>
      </div>
      <div className={`absolute top-4 right-4 px-2 py-1 rounded-md text-[10px] font-bold uppercase border flex items-center gap-1 ${isBullish ? 'bg-success/10 text-success border-success/30' : 'bg-danger/10 text-danger border-danger/30'}`}>
        {news.ticker} {isBullish ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      </div>
      <div className="mt-3 flex justify-between items-center">
        <span className="text-[10px] text-gray-500 font-mono">{news.time}</span>
        <span className="text-[10px] text-molten/60 font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">Click for details →</span>
      </div>
    </div>
  );
};

NewsCard.propTypes = {
  news: PropTypes.shape({
    headline: PropTypes.string.isRequired,
    summary: PropTypes.string.isRequired,
    ticker: PropTypes.string.isRequired,
    impact: PropTypes.string.isRequired,
    time: PropTypes.string.isRequired,
  }).isRequired,
};

// Reusable tooltip component for financial explanations
const FinTooltip = ({ text }) => (
  <div className="group/tip relative inline-flex ml-1 cursor-help">
    <Info size={12} className="text-gray-500 group-hover/tip:text-molten transition-colors" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2.5 bg-obsidian border border-molten/30 rounded-lg text-[10px] text-gray-300 leading-relaxed shadow-2xl opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-50">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-obsidian border-r border-b border-molten/30 rotate-45 -mt-1"></div>
    </div>
  </div>
);

FinTooltip.propTypes = { text: PropTypes.string.isRequired };

export default function Dashboard() {
  const { accounts, activeAccount: activeAccountId, settings } = useStore();
  const activeAccount = accounts.find(a => a.id === activeAccountId);
  const globeRef = useRef();
  const navigate = useNavigate();
  
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 500, height: 400 });

  // ─── LIVE PORTFOLIO DATA ───
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    updateDimensions();

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', updateDimensions);
    return () => {
      window.removeEventListener('resize', updateDimensions);
      resizeObserver.disconnect();
    };
  }, []);

  const [newsFeed, setNewsFeed] = useState([]);
  const [globalNews, setGlobalNews] = useState([]);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await axios.get(`${API_URL}/news`);
        setGlobalNews(res.data);
      } catch (err) {
        console.error("Failed to load news", err);
      }
    };
    fetchNews();
  }, []);

  // ─── LIVE PORTFOLIO POLLING (every 5 seconds) ───
  useEffect(() => {
    const fetchPortfolio = async () => {
      if (!activeAccountId) return;
      try {
        const token = useAuthStore.getState().token;
        const res = await axios.get(`${API_URL}/accounts/${activeAccountId}/data`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const statsData = res.data.accountStats;
        if (statsData) {
          setStats(statsData);
        }
      } catch (err) {
        console.error("Failed to fetch portfolio data", err);
      }
    };
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 5000);
    return () => clearInterval(interval);
  }, [activeAccountId]);

  useEffect(() => {
    // Dynamic filtering based on active account holdings
    if (activeAccount && globalNews.length > 0) {
      const filtered = globalNews.filter(n => activeAccount.holdings.some(h => n.ticker.includes(h) || h.includes(n.ticker)));
      // If we filter too much out, just show all for the demo
      setNewsFeed(filtered.length > 0 ? filtered : globalNews);
    } else {
      setNewsFeed(globalNews);
    }
  }, [activeAccountId, globalNews]);

  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = !settings.reduceAnimations;
      globeRef.current.controls().autoRotateSpeed = 1.0;
    }
  }, [settings.reduceAnimations]);

  const globeHtmlElements = settings.reduceAnimations ? [] : newsFeed;

  // ─── DERIVED FINANCIAL VALUES ───
  const initialBalance = stats?.initialBalance || activeAccount?.balance || 100000;
  const estimatedTotal = stats?.estimatedTotalValue || activeAccount?.balance || 0;
  const netProfit = stats?.netProfit || 0;
  const unrealizedPnl = stats?.totalUnrealizedPnl || 0;
  const holdingsValue = stats?.holdingsValue || 0;
  const availableCash = stats?.availableMargin || activeAccount?.balance || 0;
  const openTradesCount = stats?.openTradesCount || 0;
  const realizedReturn = stats?.realizedReturn || 0;
  const unrealizedReturn = stats?.unrealizedReturn || 0;

  // Capital distribution for the Money Flow bar
  const distCash = stats?.capitalDistribution?.availableCash || 100;
  const distHoldings = stats?.capitalDistribution?.inHoldings || 0;

  const fmt = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col 2xl:flex-row gap-6 h-full">
      {/* LEFT PANE - KPIs and Globe */}
      <div className="flex-1 flex flex-col gap-5 min-w-0">
        
        {/* ═══ FINANCIAL OVERVIEW ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
          
          {/* Card 1: Total Estimated Value */}
          <div className="bg-card backdrop-blur-xl border border-molten/20 rounded-2xl p-4 lg:p-5 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-molten/10 rounded-xl text-molten shrink-0"><DollarSign size={20} /></div>
              <div className="flex items-center gap-1">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Value</p>
                <FinTooltip text="Your total estimated account worth — cash on hand plus the current market value of all your holdings." />
              </div>
            </div>
            <p className="text-xl lg:text-2xl font-extrabold text-molten font-mono">${fmt(estimatedTotal)}</p>
            <p className="text-[10px] text-gray-500 mt-1.5 font-semibold">Started at ${fmt(initialBalance)}</p>
          </div>

          {/* Card 2: Net Profit (Realized) */}
          <div className="bg-card backdrop-blur-xl border border-molten/20 rounded-2xl p-4 lg:p-5 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2.5 rounded-xl shrink-0 ${netProfit >= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}><TrendingUp size={20} /></div>
              <div className="flex items-center gap-1">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Net Profit</p>
                <FinTooltip text="Confirmed profit from trades that have been closed. This is real money you've earned — not paper gains." />
              </div>
            </div>
            <p className={`text-xl lg:text-2xl font-extrabold font-mono ${netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
              {netProfit >= 0 ? '+' : ''}${fmt(netProfit)}
            </p>
            <p className={`text-[10px] mt-1.5 font-bold ${realizedReturn >= 0 ? 'text-success/70' : 'text-danger/70'}`}>
              {realizedReturn >= 0 ? '+' : ''}{realizedReturn.toFixed(2)}% return
            </p>
          </div>

          {/* Card 3: Open Positions */}
          <div className="bg-card backdrop-blur-xl border border-molten/20 rounded-2xl p-4 lg:p-5 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400 shrink-0"><Briefcase size={20} /></div>
              <div className="flex items-center gap-1">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Open Positions</p>
                <FinTooltip text="Active trades still running. The P&L shown is unrealized — it changes as prices move and locks in when trades close." />
              </div>
            </div>
            <p className="text-xl lg:text-2xl font-extrabold text-white font-mono">{openTradesCount} <span className="text-sm text-gray-400 font-semibold">trades</span></p>
            <p className={`text-[10px] mt-1.5 font-bold ${unrealizedPnl >= 0 ? 'text-success/70' : 'text-danger/70'}`}>
              {unrealizedPnl >= 0 ? '+' : ''}${fmt(unrealizedPnl)} unrealized
            </p>
          </div>

          {/* Card 4: Available Cash */}
          <div className="bg-card backdrop-blur-xl border border-molten/20 rounded-2xl p-4 lg:p-5 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-white/5 rounded-xl text-gray-400 shrink-0"><Wallet size={20} /></div>
              <div className="flex items-center gap-1">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Available Cash</p>
                <FinTooltip text="Cash not currently invested in any trade. This is the amount the bot can use to open new positions." />
              </div>
            </div>
            <p className="text-xl lg:text-2xl font-extrabold text-white font-mono">${fmt(availableCash)}</p>
            <p className="text-[10px] text-gray-500 mt-1.5 font-semibold">For new trades</p>
          </div>
        </div>

        {/* ═══ MONEY FLOW DISTRIBUTION BAR ═══ */}
        <div className="bg-card backdrop-blur-xl border border-molten/20 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <BarChart3 size={14} className="text-molten" /> Capital Distribution
            </h3>
            <div className="flex items-center gap-4 text-[10px] font-bold">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-molten/80"></span><span className="text-gray-400">Cash</span></span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500/80"></span><span className="text-gray-400">In Holdings</span></span>
            </div>
          </div>
          <div className="h-3.5 bg-white/5 rounded-full overflow-hidden flex">
            <div 
              className="h-full bg-gradient-to-r from-molten/90 to-molten/60 transition-all duration-700 ease-out rounded-l-full"
              style={{ width: `${distCash}%` }}
              title={`Available Cash: ${distCash}%`}
            ></div>
            <div 
              className="h-full bg-gradient-to-r from-blue-500/80 to-blue-400/60 transition-all duration-700 ease-out"
              style={{ width: `${distHoldings}%` }}
              title={`In Holdings: ${distHoldings}%`}
            ></div>
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-gray-500 font-mono font-semibold">
            <span>${fmt(availableCash)} cash</span>
            <span>${fmt(holdingsValue)} in holdings</span>
          </div>
        </div>

        {/* Global Market News Globe */}
        <div className="bg-card backdrop-blur-xl border border-molten/20 rounded-2xl p-6 shadow-xl flex-1 flex flex-col relative overflow-hidden min-h-[300px]">
          <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2 relative z-10">
            <GlobeIcon className="text-molten" size={20}/> Geopolitical Data Matrix
          </h2>
          <div ref={containerRef} className="absolute inset-0 top-16 flex items-center justify-center cursor-move">
            <Globe
              ref={globeRef}
              width={dimensions.width}
              height={dimensions.height}
              globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
              bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
              backgroundColor="rgba(0,0,0,0)"
              htmlElementsData={globeHtmlElements}
              htmlLat="lat"
              htmlLng="lng"
              htmlElement={(d) => {
                const el = document.createElement('div');
                const color = d.impact === 'Bullish' ? '#10B981' : d.impact === 'Bearish' ? '#EF4444' : '#F59E0B';
                const bgOpacity = d.impact === 'Bullish' ? 'rgba(16,185,129,0.15)' : d.impact === 'Bearish' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)';
                const borderOpacity = d.impact === 'Bullish' ? 'rgba(16,185,129,0.4)' : d.impact === 'Bearish' ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)';
                
                el.innerHTML = `
                  <div class="relative group cursor-pointer flex items-center justify-center w-8 h-8 rounded-full bg-slate-950/80 border border-white/20 hover:scale-125 hover:border-molten transition-all duration-300 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                    <span class="text-base select-none">${d.emoji || '📰'}</span>
                    <span class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-obsidian" style="background-color: ${color}; box-shadow: 0 0 6px ${color}"></span>
                    
                    <!-- Tooltip Popup -->
                    <div class="absolute bottom-full mb-3 hidden group-hover:block w-72 bg-card/95 backdrop-blur-xl border border-molten/40 p-4 rounded-xl shadow-2xl z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-300 text-left">
                      <div class="flex items-center justify-between gap-2 mb-2">
                        <span class="text-[10px] font-extrabold uppercase tracking-widest text-molten bg-molten/10 px-2 py-0.5 rounded border border-molten/20">${d.ticker}</span>
                        <span class="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border" style="color: ${color}; border-color: ${borderOpacity}; background-color: ${bgOpacity}">${d.impact}</span>
                      </div>
                      <h4 class="text-xs font-bold text-white mb-1.5 leading-snug line-clamp-2">${d.headline}</h4>
                      <p class="text-[10px] text-gray-400 leading-normal line-clamp-3 mb-2">${d.summary}</p>
                      <div class="h-px bg-white/5 my-2"></div>
                      <div class="flex justify-between items-center text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                        <span>👉 Click to read details</span>
                        <span>📍 Lat: ${d.lat.toFixed(1)}, Lng: ${d.lng.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                `;
                
                el.onclick = (e) => {
                  e.stopPropagation();
                  navigate(`/news/${d.id}`);
                };
                
                return el;
              }}
            />
          </div>
        </div>

      </div>

      {/* RIGHT PANE - Contextual News Feed */}
      <div className="w-full 2xl:w-[320px] bg-obsidian/50 border border-molten/10 rounded-2xl p-4 flex flex-col 2xl:h-full max-h-[500px] 2xl:max-h-none overflow-hidden shadow-2xl relative z-10 shrink-0">
        <div className="mb-4 border-b border-molten/20 pb-4">
          <h3 className="text-md font-bold text-white flex items-center gap-2 uppercase tracking-wide">
            <Activity size={18} className="text-molten" /> Contextual Feed
          </h3>
          <p className="text-xs text-gray-400 mt-1">Filtered for {activeAccount?.name}</p>
        </div>
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {newsFeed.map(news => (
            <NewsCard key={news.id} news={news} onClick={(id) => navigate(`/news/${id}`)} />
          ))}
          {newsFeed.length === 0 && (
            <div className="text-gray-500 text-sm text-center mt-10">No specific news for current holdings.</div>
          )}
        </div>
      </div>
    </div>
  );
}
