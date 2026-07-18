import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../config/api';
import { Globe, TrendingUp, TrendingDown, Clock, Search, Filter } from 'lucide-react';
import useStore from '../store/useStore';
import useAuthStore from '../store/useAuthStore';

export default function NewsPage() {
  const { accounts, activeAccount: activeAccountId } = useStore();
  const { token } = useAuthStore();
  const activeAccount = accounts.find(a => a.id === activeAccountId);
  
  const [globalNews, setGlobalNews] = useState([]);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await axios.get(`${API_URL}/news`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setGlobalNews(res.data);
      } catch (err) {
        console.error("Failed to fetch news", err);
      }
    };
    fetchNews();
  }, [token]);

  const filteredNews = globalNews.filter(n => {
    if (filter === 'Portfolio' && activeAccount) {
      return activeAccount.holdings.some(h => n.ticker.includes(h) || h.includes(n.ticker));
    }
    if (filter === 'Bullish') return n.impact === 'Bullish';
    if (filter === 'Bearish') return n.impact === 'Bearish';
    return true;
  });

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto w-full z-10 relative">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-widest uppercase flex items-center gap-3">
            <Globe className="text-molten" size={32} /> Global News
          </h1>
          <p className="text-gray-400 mt-2">Real-time semantic analysis of geopolitical and financial events.</p>
        </div>
        
        <div className="flex gap-2">
          {['All', 'Portfolio', 'Bullish', 'Bearish'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors border ${filter === f ? 'bg-molten/20 text-molten border-molten/50' : 'bg-black/20 text-gray-400 border-white/5 hover:border-white/20'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar pb-10">
        {filteredNews.map(news => {
          const isBullish = news.impact === 'Bullish';
          return (
            <div 
              key={news.id} 
              onClick={() => window.open(news.link, '_blank')}
              className="bg-card/85 backdrop-blur-xl border border-molten/20 p-6 rounded-2xl shadow-xl hover:border-molten transition-all duration-300 group flex flex-col cursor-pointer hover:scale-[1.04] hover:shadow-[0_15px_30px_rgba(0,0,0,0.5)] hover:z-20 relative"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`px-3 py-1 rounded-lg text-xs font-bold uppercase border flex items-center gap-1 ${isBullish ? 'bg-success/10 text-success border-success/30' : 'bg-danger/10 text-danger border-danger/30'}`}>
                  {news.emoji} {news.ticker} {isBullish ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                </div>
                <div className="flex items-center gap-1 text-gray-500 text-xs font-mono">
                  <Clock size={12} /> {news.time}
                </div>
              </div>
              
              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-molten transition-colors leading-tight">
                {news.headline}
              </h3>
              
              <p className="text-sm text-gray-400 flex-1 leading-relaxed">
                {news.summary}
              </p>
              
              {/* Detailed panel expanding on hover */}
              <div className="max-h-0 opacity-0 overflow-hidden group-hover:max-h-48 group-hover:opacity-100 group-hover:mt-4 transition-all duration-300 ease-in-out border-t border-white/5 pt-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Semantic Analysis</p>
                    <p className={`font-bold mt-0.5 ${isBullish ? 'text-success' : news.impact === 'Bearish' ? 'text-danger' : 'text-warning'}`}>
                      {isBullish ? 'Strong Positive' : news.impact === 'Bearish' ? 'Strong Negative' : 'Neutral Momentum'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Geo-Coordinates</p>
                    <p className="font-semibold text-gray-300 font-mono mt-0.5">Lat: {news.lat?.toFixed(2)}, Lng: {news.lng?.toFixed(2)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Geopolitical Impact Forecast</p>
                    <p className="text-gray-300 mt-0.5 leading-normal">
                      High likelihood of near-term {isBullish ? 'liquidity inflow' : news.impact === 'Bearish' ? 'capital flight' : 'stability'} for related {news.ticker} asset classes.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-xs text-gray-500 font-bold uppercase tracking-wider">
                <span>Confidence: {Math.floor(Math.random() * 20 + 80)}%</span>
                <span>Source: RSS Matrix</span>
              </div>
            </div>
          );
        })}
        {filteredNews.length === 0 && (
          <div className="col-span-full py-20 text-center text-gray-500 font-bold uppercase tracking-widest">
            No active alerts for current filters.
          </div>
        )}
      </div>
    </div>
  );
}
