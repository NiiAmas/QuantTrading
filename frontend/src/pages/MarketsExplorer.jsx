import React, { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import API_URL from '../config/api';
import { Search } from 'lucide-react';

const TrendSparkline = ({ data, color }) => (
  <div className="w-24 h-8">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

export default function MarketsExplorer() {
  const [activeTab, setActiveTab] = useState('All');
  const [marketData, setMarketData] = useState([]);
  const [loading, setLoading] = useState(true);

  const tabs = ['All', 'Stocks', 'Crypto', 'Forex'];

  useEffect(() => {
    const fetchMarketData = async () => {
      setLoading(true);
      try {
        // ACTUAL API CALL
        const res = await axios.get(`${API_URL}/explorer?assetClass=${activeTab}`);
        setMarketData(res.data);
      } catch (err) {
        console.warn("Backend explorer endpoint not yet implemented. Falling back to empty state.");
        setMarketData([]);
      }
      setLoading(false);
    };
    
    fetchMarketData();
  }, [activeTab]);

  return (
    <div className="bg-card backdrop-blur-xl border border-molten/20 rounded-2xl p-6 shadow-xl h-full flex flex-col relative z-10">
      <div className="flex justify-between items-center mb-6 border-b border-molten/20 pb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold uppercase tracking-wider">Market Screener</h2>
          <div className="flex bg-obsidian border border-molten/20 rounded-lg p-1">
            {tabs.map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1 rounded-md text-sm font-bold transition-colors ${activeTab === tab ? 'bg-molten text-obsidian' : 'text-gray-400 hover:text-white'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" placeholder="Search tickers..." className="bg-obsidian border border-molten/20 text-white text-sm rounded-lg pl-10 pr-4 py-2 w-64 focus:outline-none focus:border-molten" />
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-lg border border-molten/10 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-molten animate-pulse font-bold tracking-widest">LOADING API DATA...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-obsidian/80 text-xs uppercase tracking-wider text-molten sticky top-0 z-10">
                <th className="p-4 border-b border-molten/20">Ticker</th>
                <th className="p-4 border-b border-molten/20">Asset Class</th>
                <th className="p-4 border-b border-molten/20">Current Price</th>
                <th className="p-4 border-b border-molten/20">24h Change</th>
                <th className="p-4 border-b border-molten/20">7-Day Trend</th>
                <th className="p-4 border-b border-molten/20">Tech Score</th>
                <th className="p-4 border-b border-molten/20">Quant Score</th>
                <th className="p-4 border-b border-molten/20">Sentiment Score</th>
              </tr>
            </thead>
            <tbody>
              {marketData.map(row => {
                const isPositive = row.change > 0;
                const trendColor = isPositive ? '#10B981' : '#EF4444';
                const trendData = row.trend.map((val, i) => ({ i, value: val }));

                return (
                  <tr key={row.ticker} className="border-b border-molten/5 hover:bg-molten/5 transition-colors group cursor-pointer">
                    <td className="p-4 font-bold text-white group-hover:text-molten transition-colors">{row.ticker}</td>
                    <td className="p-4 text-gray-400 text-sm">{row.class}</td>
                    <td className="p-4 text-gray-300 font-mono">
                      {row.price < 10 ? row.price.toFixed(4) : row.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`p-4 font-bold ${isPositive ? 'text-success' : 'text-danger'}`}>
                      {isPositive ? '+' : ''}{row.change}%
                    </td>
                    <td className="p-4">
                      <TrendSparkline data={trendData} color={trendColor} />
                    </td>
                    <td className="p-4 text-gray-300 font-mono">
                      {Math.floor(Math.random() * (99 - 70 + 1) + 70)}%
                    </td>
                    <td className="p-4 text-gray-300">{row.qScore}</td>
                    <td className={`p-4 font-bold ${row.sScore > 0 ? 'text-success' : row.sScore < 0 ? 'text-danger' : 'text-molten'}`}>
                      {row.sScore > 0 ? '+' : ''}{row.sScore}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
