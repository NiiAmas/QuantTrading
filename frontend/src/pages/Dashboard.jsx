import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_URL from '../config/api';
import PropTypes from 'prop-types';
import { TrendingUp, TrendingDown, Wallet, Activity, Globe as GlobeIcon, Briefcase } from 'lucide-react';
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

export default function Dashboard() {
  const { accounts, activeAccount: activeAccountId, settings } = useStore();
  const activeAccount = accounts.find(a => a.id === activeAccountId);
  const globeRef = useRef();
  const navigate = useNavigate();
  
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 500 });

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
  const [loadingNews, setLoadingNews] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await axios.get(`${API_URL}/news`);
        if (res.data && Array.isArray(res.data)) {
          setGlobalNews(res.data);
        }
      } catch (err) {
        console.error("Failed to load news", err);
      } finally {
        setLoadingNews(false);
      }
    };
    fetchNews();
    const interval = setInterval(fetchNews, 30000);
    return () => clearInterval(interval);
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
    if (activeAccount && globalNews.length > 0) {
      const filtered = globalNews.filter(n => (activeAccount.holdings || []).some(h => n.ticker.includes(h) || h.includes(n.ticker)));
      setNewsFeed(filtered.length > 0 ? filtered : globalNews);
    } else {
      setNewsFeed(globalNews);
    }
  }, [activeAccountId, globalNews, activeAccount]);

  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = !settings.reduceAnimations;
      globeRef.current.controls().autoRotateSpeed = 1.0;
    }
  }, [settings.reduceAnimations]);

  const globeHtmlElements = settings.reduceAnimations ? [] : newsFeed;

  const realizedBal = stats?.realizedBalance || activeAccount?.balance || 0;
  const unrealizedBal = stats?.unrealizedBalance || activeAccount?.balance || 0;
  const availCash = stats?.availableMargin || activeAccount?.balance || 0;
  const realizedRet = stats?.realizedReturn || 0;
  const unrealizedRet = stats?.unrealizedReturn || 0;

  const fmt = (n) => (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col lg:flex-row gap-5 h-full min-h-0">
      {/* LEFT PANE - KPIs and Large Globe */}
      <div className="flex-1 flex flex-col gap-5 min-w-0 h-full">
        
        {/* KPI Row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 shrink-0">
          
          {/* Card 1: Account Equity */}
          <div className="bg-card backdrop-blur-xl border border-molten/20 rounded-2xl p-4 xl:p-5 shadow-xl flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-molten/10 rounded-xl text-molten shrink-0"><Wallet size={20} /></div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Account Equity</p>
                <h4 className="text-sm xl:text-base font-bold text-white font-mono">${fmt(unrealizedBal)}</h4>
              </div>
            </div>
            <div className="space-y-1.5 pt-2 border-t border-white/5 text-xs font-mono">
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-[10px] uppercase font-bold tracking-wider">Realized</span>
                <span className="font-semibold text-white">${fmt(realizedBal)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-[10px] uppercase font-bold tracking-wider">Open P&L</span>
                <span className={`font-semibold ${(stats?.totalUnrealizedPnl || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                  {(stats?.totalUnrealizedPnl || 0) >= 0 ? '+' : ''}${fmt(stats?.totalUnrealizedPnl || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center text-molten font-bold">
                <span className="text-[10px] uppercase tracking-wider">Cash Avail</span>
                <span>${fmt(availCash)}</span>
              </div>
            </div>
          </div>
          
          {/* Card 2: Active Investments */}
          <div className="bg-card backdrop-blur-xl border border-molten/20 rounded-2xl p-4 xl:p-5 shadow-xl flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-molten/10 rounded-xl text-molten shrink-0"><Briefcase size={20} /></div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Investments</p>
                <h4 className="text-sm xl:text-base font-bold text-white font-mono">{stats?.openTradesCount || 0} Open Trades</h4>
              </div>
            </div>
            <div className="space-y-1.5 pt-2 border-t border-white/5 text-xs font-mono">
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-[10px] uppercase font-bold tracking-wider">Invested</span>
                <span className="font-semibold text-blue-400">${fmt(stats?.totalInvestedInOpen || 0)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-[10px] uppercase font-bold tracking-wider">Market Value</span>
                <span className="font-semibold text-white">${fmt(stats?.openMarketValue || stats?.holdingsValue || 0)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-[10px] uppercase font-bold tracking-wider">Holdings</span>
                <span className="font-semibold text-white">{activeAccount?.holdings?.length || 0} Assets</span>
              </div>
            </div>
          </div>

          {/* Card 3: Portfolio Return */}
          <div className="bg-card backdrop-blur-xl border border-molten/20 rounded-2xl p-4 xl:p-5 shadow-xl flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2.5 rounded-xl shrink-0 ${unrealizedRet >= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                <Activity size={20} />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Performance</p>
                <h4 className={`text-sm xl:text-base font-bold font-mono ${unrealizedRet >= 0 ? 'text-success' : 'text-danger'}`}>
                  {unrealizedRet >= 0 ? '+' : ''}{unrealizedRet.toFixed(2)}% Total
                </h4>
              </div>
            </div>
            <div className="space-y-1.5 pt-2 border-t border-white/5 text-xs font-mono">
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-[10px] uppercase font-bold tracking-wider">Confirmed</span>
                <span className={`font-semibold ${realizedRet >= 0 ? 'text-success' : 'text-danger'}`}>
                  {realizedRet >= 0 ? '+' : ''}{realizedRet.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-[10px] uppercase font-bold tracking-wider">Unrealized</span>
                <span className={`font-semibold ${(stats?.totalUnrealizedPnl || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                  {(stats?.totalUnrealizedPnl || 0) >= 0 ? '+' : ''}${fmt(stats?.totalUnrealizedPnl || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-[10px] uppercase font-bold tracking-wider">Executed</span>
                <span className="font-semibold text-white">{(stats?.openTradesCount || 0) + (stats?.closedTradesCount || 0)} Trades</span>
              </div>
            </div>
          </div>
        </div>

        {/* Big Geopolitical Data Matrix Globe (stretches to the bottom) */}
        <div className="bg-card backdrop-blur-xl border border-molten/20 rounded-2xl p-5 shadow-xl flex-1 flex flex-col relative overflow-hidden min-h-[320px]">
          <h2 className="text-base lg:text-lg font-bold text-white mb-2 uppercase tracking-wider flex items-center gap-2 relative z-10">
            <GlobeIcon className="text-molten" size={20}/> Geopolitical Data Matrix
          </h2>
          <div ref={containerRef} className="absolute inset-0 top-12 flex items-center justify-center cursor-move">
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

      {/* RIGHT PANE - Slimmer Contextual News Feed Sidebar */}
      <div className="w-full lg:w-[260px] xl:w-[280px] bg-obsidian/50 border border-molten/10 rounded-2xl p-4 flex flex-col h-full overflow-hidden shadow-2xl relative z-10 shrink-0">
        <div className="mb-4 border-b border-molten/20 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide">
            <Activity size={16} className="text-molten" /> Contextual Feed
          </h3>
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">Filtered for {activeAccount?.name}</p>
        </div>
        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {loadingNews && newsFeed.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-card/50 border border-white/5 p-3.5 rounded-xl animate-pulse">
                  <div className="h-4 bg-white/10 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-white/5 rounded w-full mb-1"></div>
                  <div className="h-3 bg-white/5 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {newsFeed.map(news => (
                <NewsCard key={news.id} news={news} onClick={(id) => navigate(`/news/${id}`)} />
              ))}
              {newsFeed.length === 0 && (
                <div className="text-gray-500 text-xs text-center mt-10">No specific news for current holdings.</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
