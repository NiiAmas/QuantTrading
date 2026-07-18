import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../config/api';
import { Activity, Radio, ExternalLink } from 'lucide-react';

export default function NewsFeedPage() {
  const [news, setNews] = useState([]);
  
  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await axios.get(`${API_URL}/news`);
        setNews(res.data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchNews();
    const int = setInterval(fetchNews, 10000); // 10s refresh as requested
    return () => clearInterval(int);
  }, []);
  
  return (
    <div className="flex flex-col gap-6 h-full relative z-10">
      <div className="bg-card backdrop-blur-xl border border-molten/20 rounded-2xl p-6 shadow-xl flex items-center gap-4">
        <Radio className="text-molten animate-pulse" size={32} />
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wider text-white">Live Global News Feed</h1>
          <p className="text-gray-400 text-sm">Real-time aggregated financial intelligence streams</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-2">
         {news.map(n => (
           <div key={n.id} className="bg-obsidian/80 border border-molten/10 p-5 rounded-xl hover:border-molten/50 transition-all hover:-translate-y-1">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold uppercase px-2 py-1 bg-molten/10 text-molten rounded-md">{n.summary}</span>
                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${n.impact === 'Bullish' ? 'bg-success/10 text-success' : n.impact === 'Bearish' ? 'bg-danger/10 text-danger' : 'bg-gray-800 text-gray-400'}`}>{n.impact}</span>
              </div>
              <h3 className="text-sm font-bold text-white mb-3 line-clamp-3">{n.headline}</h3>
              <div className="flex justify-between items-center text-xs text-gray-500 mt-auto pt-2 border-t border-white/5">
                 <span>{n.time}</span>
                 <a href={n.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-molten transition-colors">Source <ExternalLink size={12}/></a>
              </div>
           </div>
         ))}
      </div>
    </div>
  );
}
