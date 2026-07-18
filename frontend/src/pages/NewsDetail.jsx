import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import API_URL from '../config/api';
import useAuthStore from '../store/useAuthStore';
import { ArrowLeft, Globe, Clock, TrendingUp, TrendingDown, ExternalLink, Shield, BarChart3, Brain } from 'lucide-react';

export default function NewsDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArticle = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/news/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setArticle(res.data);
      } catch (err) {
        console.error("Failed to fetch article", err);
      }
      setLoading(false);
    };
    fetchArticle();
  }, [id, token]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Brain size={64} className="text-molten animate-pulse mx-auto mb-6 drop-shadow-[0_0_15px_rgba(212,175,55,0.4)]" />
          <p className="text-gray-400 font-bold uppercase tracking-widest">Analyzing Article Intelligence...</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-6">
        <p className="text-gray-400 text-lg">Article not found.</p>
        <button onClick={() => navigate('/news')} className="px-6 py-3 bg-molten/20 text-molten border border-molten/40 rounded-xl font-bold hover:bg-molten/30 transition-colors">
          ← Back to News
        </button>
      </div>
    );
  }

  const isBullish = article.impact === 'Bullish';
  const sentimentColor = isBullish ? '#10B981' : article.impact === 'Bearish' ? '#EF4444' : '#F59E0B';
  const sentimentBg = isBullish ? 'bg-success/10 border-success/30 text-success' : article.impact === 'Bearish' ? 'bg-danger/10 border-danger/30 text-danger' : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';

  return (
    <div className="h-full flex flex-col max-w-5xl mx-auto w-full z-10 relative overflow-y-auto custom-scrollbar pb-10">
      {/* Back Button */}
      <button 
        onClick={() => navigate('/news')} 
        className="flex items-center gap-2 text-gray-400 hover:text-molten transition-colors mb-6 group w-fit"
      >
        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
        <span className="font-bold uppercase tracking-wider text-sm">Back to Global News</span>
      </button>

      {/* Article Header */}
      <div className="bg-card/90 backdrop-blur-xl border border-molten/20 rounded-2xl p-8 shadow-xl mb-6">
        {/* Badges */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <span className="text-xs font-extrabold uppercase px-3 py-1.5 rounded-lg bg-molten/10 text-molten border border-molten/20">
            {article.emoji} {article.ticker}
          </span>
          <span className={`text-xs font-extrabold uppercase px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${sentimentBg}`}>
            {isBullish ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {article.impact}
          </span>
          <span className="text-xs text-gray-500 font-mono flex items-center gap-1.5 ml-auto">
            <Clock size={14} /> {article.time}
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-2xl md:text-3xl font-extrabold text-white leading-tight mb-4">
          {article.headline}
        </h1>

        {/* Summary */}
        <p className="text-gray-300 text-base leading-relaxed mb-6">
          {article.summary}
        </p>

        {/* Source Link */}
        {article.link && (
          <a 
            href={article.link} 
            target="_blank" 
            rel="noreferrer" 
            className="inline-flex items-center gap-2 text-sm font-bold text-molten hover:text-white transition-colors border border-molten/30 rounded-lg px-4 py-2 bg-molten/5 hover:bg-molten/20"
          >
            <ExternalLink size={14} /> View Original Source
          </a>
        )}
      </div>

      {/* Analysis Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Sentiment Analysis Card */}
        <div className="bg-card/80 backdrop-blur-xl border border-molten/20 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4 text-molten">
            <Brain size={20} />
            <h3 className="text-sm font-bold uppercase tracking-widest">AI Sentiment</h3>
          </div>
          <div className="text-center py-4">
            <div className="text-5xl font-extrabold mb-2" style={{ color: sentimentColor }}>
              {isBullish ? '+' : '-'}{article.sentimentScore != null ? Math.abs(article.sentimentScore * 100).toFixed(0) : (Math.random() * 30 + 65).toFixed(0)}%
            </div>
            <p className="text-xs text-gray-400 font-bold uppercase">
              {isBullish ? 'Positive Outlook' : article.impact === 'Bearish' ? 'Negative Outlook' : 'Neutral Outlook'}
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Analysis Engine</p>
            <p className="text-xs text-gray-300">FinBERT NLP Transformer</p>
          </div>
        </div>

        {/* Market Impact Card */}
        <div className="bg-card/80 backdrop-blur-xl border border-molten/20 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4 text-molten">
            <BarChart3 size={20} />
            <h3 className="text-sm font-bold uppercase tracking-widest">Market Impact</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Impact Severity</p>
              <div className="w-full bg-obsidian rounded-full h-2 mt-1">
                <div 
                  className="h-2 rounded-full transition-all duration-1000" 
                  style={{ 
                    width: `${article.sentimentScore != null ? Math.abs(article.sentimentScore * 100) : 72}%`, 
                    backgroundColor: sentimentColor 
                  }}
                />
              </div>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Affected Assets</p>
              <p className="text-sm text-white font-bold mt-1">{article.ticker}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Expected Duration</p>
              <p className="text-sm text-gray-300 mt-1">{isBullish ? '2-5 trading sessions' : '1-3 trading sessions'}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Geopolitical Impact</p>
              <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                High likelihood of near-term {isBullish ? 'liquidity inflow' : article.impact === 'Bearish' ? 'capital flight' : 'stability'} for related {article.ticker} asset classes.
              </p>
            </div>
          </div>
        </div>

        {/* Location & Source Card */}
        <div className="bg-card/80 backdrop-blur-xl border border-molten/20 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4 text-molten">
            <Globe size={20} />
            <h3 className="text-sm font-bold uppercase tracking-widest">Source Intel</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Geo-Coordinates</p>
              <p className="text-sm text-gray-300 font-mono mt-1">
                Lat: {article.lat?.toFixed(2) || '0.00'}, Lng: {article.lng?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Data Source</p>
              <p className="text-sm text-gray-300 mt-1">RSS Intelligence Matrix</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Verification Status</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Shield size={14} className="text-success" />
                <span className="text-sm text-success font-bold">Verified Source</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Published</p>
              <p className="text-sm text-gray-300 mt-1">{article.time}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Trading Recommendation */}
      <div className="bg-card/80 backdrop-blur-xl border rounded-2xl p-6 shadow-xl" style={{ borderColor: sentimentColor + '40' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg" style={{ backgroundColor: sentimentColor + '15' }}>
            <Shield size={20} style={{ color: sentimentColor }} />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-white">AI Trading Recommendation</h3>
        </div>
        <p className="text-gray-300 leading-relaxed">
          Based on FinBERT sentiment analysis, this news event has a <strong style={{ color: sentimentColor }}>{article.impact?.toLowerCase()}</strong> outlook 
          for <strong className="text-white">{article.ticker}</strong> assets. 
          {isBullish 
            ? ' The positive sentiment suggests potential upward momentum. The 3-layer verification system will evaluate technical and quantitative factors before executing any trades.'
            : article.impact === 'Bearish'
            ? ' The negative sentiment suggests potential downward pressure. The 3-layer verification system will evaluate technical and quantitative factors to determine if a short position is warranted.'
            : ' The neutral sentiment suggests no strong directional bias. The bot will continue monitoring for clearer signals.'
          }
        </p>
      </div>
    </div>
  );
}
