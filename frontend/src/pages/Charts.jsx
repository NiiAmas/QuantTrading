import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import API_URL from '../config/api';
import PropTypes from 'prop-types';
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';
import { ChevronDown, ChevronRight, Activity } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════
   Accordion Component
   (Collapsible section for grouping instruments by asset class)
   ═══════════════════════════════════════════════════════════════════════ */
const Accordion = ({ title, items, selectedAsset, onSelect }) => {
  const [isOpen, setIsOpen] = useState(true);
  
  return (
    <div className="mb-2">
      <button 
        className="flex items-center justify-between w-full p-3 bg-obsidian/60 hover:bg-molten/10 rounded-lg text-sm font-bold text-gray-300 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{title}</span>
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {isOpen && (
        <div className="mt-1 flex flex-col gap-1 pl-2">
          {items.map(item => (
            <button
              key={item.value}
              className={`text-left px-3 py-2 text-xs font-semibold rounded-md transition-colors ${selectedAsset === item.value ? 'bg-molten/20 text-molten border-l-2 border-molten' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
              onClick={() => onSelect(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

Accordion.propTypes = {
  title: PropTypes.string.isRequired,
  items: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
  })).isRequired,
  selectedAsset: PropTypes.string.isRequired,
  onSelect: PropTypes.func.isRequired,
};

/* ═══════════════════════════════════════════════════════════════════════
   Error Boundary
   (Catches rendering errors in the chart and shows a friendly message
    instead of crashing the entire page)
   ═══════════════════════════════════════════════════════════════════════ */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Charts caught error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 text-white bg-red-900/20 rounded-xl m-6 border border-red-500">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Charts Component Crashed</h2>
          <pre className="text-sm bg-black/50 p-4 rounded-lg overflow-x-auto">{this.state.error?.toString()}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   ChartsInner — Main Chart Component
   (Renders a TradingView-style candlestick chart with timeframe selector)
   
   HOW IT WORKS:
     - Chart is DESTROYED and RECREATED when timeframe or asset changes
       (this prevents the "data out of order" bug from lightweight-charts)
     - Each timeframe maps to a specific data period on the backend
     - Chart auto-refreshes: fast intervals (1m, 5m) refresh every 5s,
       longer intervals refresh every 15s
     - Full scrolling, zooming, and crosshair are enabled
   ═══════════════════════════════════════════════════════════════════════ */
function ChartsInner() {
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState('BTC-USD'); 
  const [selectedInterval, setSelectedInterval] = useState('1d');
  const [lastPrice, setLastPrice] = useState(null);
  const [priceChange, setPriceChange] = useState(0);
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const seriesRef = useRef(null);

  /* ─── Timeframe Options ─── */
  const timeframes = [
    { label: '1m', value: '1m' },
    { label: '5m', value: '5m' },
    { label: '15m', value: '15m' },
    { label: '30m', value: '30m' },
    { label: '1H', value: '1h' },
    { label: 'D', value: '1d' },
    { label: 'W', value: '1wk' },
  ];

  /* ─── Instrument Categories (expanded list of tradeable assets) ─── */
  const assetCategories = [
    { title: 'Crypto', items: [
      { label: 'Bitcoin (BTC)', value: 'BTC-USD' }, 
      { label: 'Ethereum (ETH)', value: 'ETH-USD' }, 
      { label: 'Solana (SOL)', value: 'SOL-USD' },
      { label: 'Ripple (XRP)', value: 'XRP-USD' },
      { label: 'Cardano (ADA)', value: 'ADA-USD' },
      { label: 'Dogecoin (DOGE)', value: 'DOGE-USD' },
      { label: 'Polkadot (DOT)', value: 'DOT-USD' },
      { label: 'Avalanche (AVAX)', value: 'AVAX-USD' },
      { label: 'Chainlink (LINK)', value: 'LINK-USD' },
    ]},
    { title: 'Stocks', items: [
      { label: 'Apple (AAPL)', value: 'AAPL' }, 
      { label: 'Nvidia (NVDA)', value: 'NVDA' },
      { label: 'Tesla (TSLA)', value: 'TSLA' },
      { label: 'Microsoft (MSFT)', value: 'MSFT' },
      { label: 'Amazon (AMZN)', value: 'AMZN' },
      { label: 'Alphabet (GOOGL)', value: 'GOOGL' },
      { label: 'Meta (META)', value: 'META' },
      { label: 'AMD (AMD)', value: 'AMD' },
    ]},
    { title: 'Commodities', items: [
      { label: 'Gold', value: 'GC=F' }, 
      { label: 'Silver', value: 'SI=F' },
      { label: 'Crude Oil', value: 'CL=F' },
      { label: 'Natural Gas', value: 'NG=F' },
    ]},
    { title: 'Forex', items: [
      { label: 'EUR/USD', value: 'EURUSD=X' }, 
      { label: 'GBP/USD', value: 'GBPUSD=X' },
      { label: 'USD/JPY', value: 'JPY=X' },
      { label: 'AUD/USD', value: 'AUDUSD=X' },
      { label: 'USD/CAD', value: 'CAD=X' },
    ]},
  ];

  /* ─── Create/Recreate Chart When Timeframe or Asset Changes ─── 
     (The key fix: we DESTROY and RECREATE the chart instance each time,
      which prevents the "data out of order" error from lightweight-charts) */
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Destroy previous chart instance if it exists
    if (chartInstanceRef.current) {
      try { chartInstanceRef.current.remove(); } catch (e) { /* already removed */ }
      chartInstanceRef.current = null;
      seriesRef.current = null;
    }

    // Create fresh chart instance
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      crosshair: {
        mode: 0, // Normal crosshair (follows cursor)
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: selectedInterval === '1m',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        rightOffset: 5,
        barSpacing: 8,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });

    chartInstanceRef.current = chart;
    seriesRef.current = candlestickSeries;

    // Handle window resize
    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      try { chart.remove(); } catch (e) { /* cleanup */ }
    };
  }, [selectedAsset, selectedInterval]);

  /* ─── Fetch Price Data and Update Chart ─── */
  useEffect(() => {
    let cancelled = false;

    const fetchPrices = async () => {
      setLoading(true);
      try {
        const priceRes = await axios.get(
          `${API_URL}/prices?symbol=${selectedAsset}&interval=${selectedInterval}`
        );
        
        if (cancelled) return;

        if (Array.isArray(priceRes.data) && priceRes.data.length > 0) {
          const ohlcData = priceRes.data.map(d => ({
            time: d.time,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close
          }));
           
          // Sort by time and deduplicate
          ohlcData.sort((a, b) => a.time - b.time);
          const uniqueData = [];
          const seen = new Set();
          for (const d of ohlcData) {
            if (!seen.has(d.time)) {
              seen.add(d.time);
              uniqueData.push(d);
            }
          }
           
          if (seriesRef.current && uniqueData.length > 0) {
            try {
              seriesRef.current.setData(uniqueData);
              chartInstanceRef.current.timeScale().fitContent();
              
              // Update the price display in the header
              const last = uniqueData[uniqueData.length - 1];
              const first = uniqueData[0];
              setLastPrice(last.close);
              setPriceChange(((last.close - first.open) / first.open) * 100);
            } catch (e) {
              console.error("Chart setData error:", e);
            }
          }
        } else {
          if (seriesRef.current) seriesRef.current.setData([]);
        }
      } catch (err) {
        console.warn("API Data not found for asset, showing empty chart", err);
        if (seriesRef.current) seriesRef.current.setData([]);
      }
      if (!cancelled) setLoading(false);
    };

    fetchPrices();
    // Fast intervals refresh faster for near-realtime feel
    const refreshMs = ['1m', '5m'].includes(selectedInterval) ? 5000 : 15000;
    const interval = setInterval(fetchPrices, refreshMs);
    
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedAsset, selectedInterval]);

  return (
    <div className="flex gap-6 h-full">
      {/* MAIN CHART AREA */}
      <div className="flex-1 flex flex-col bg-card backdrop-blur-xl border border-molten/20 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        {/* Header: Symbol name + price + timeframe selector */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold uppercase tracking-wider">{selectedAsset}</h2>
            {lastPrice && (
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-white">${lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className={`text-sm font-bold px-2 py-0.5 rounded ${priceChange >= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                  {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
          
          {/* TIMEFRAME SELECTOR */}
          <div className="flex bg-obsidian border border-molten/20 rounded-lg p-1 gap-0.5">
            {timeframes.map(tf => (
              <button
                key={tf.value}
                onClick={() => setSelectedInterval(tf.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold tracking-wider transition-all duration-200 ${
                  selectedInterval === tf.value 
                    ? 'bg-molten text-obsidian shadow-[0_0_10px_rgba(212,175,55,0.3)]' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Container */}
        <div className="flex-1 w-full relative">
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-obsidian/50 backdrop-blur-sm text-gray-500">
              <Activity size={48} className="text-molten mb-4 animate-pulse drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]" />
              <div className="font-bold tracking-widest uppercase mb-2 text-white">Fetching {selectedAsset}</div>
              <div className="text-xs text-gray-400">Interval: {selectedInterval.toUpperCase()}</div>
            </div>
          )}
          <div ref={chartContainerRef} className="w-full h-full absolute inset-0" />
        </div>
      </div>

      {/* RIGHT PANE — Instrument Selector */}
      <div className="w-[300px] bg-obsidian/50 border border-molten/10 rounded-2xl p-4 flex flex-col h-full overflow-hidden shadow-2xl">
        <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-widest text-center border-b border-molten/20 pb-3">
          Instruments
        </h3>
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {assetCategories.map(cat => (
            <Accordion 
              key={cat.title} 
              title={cat.title} 
              items={cat.items} 
              selectedAsset={selectedAsset}
              onSelect={setSelectedAsset} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Charts Export
   (Wraps the chart component in an error boundary for crash protection)
   ═══════════════════════════════════════════════════════════════════════ */
export default function Charts() {
  return (
    <ErrorBoundary>
      <ChartsInner />
    </ErrorBoundary>
  );
}
