import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import API_URL from '../config/api';
import PropTypes from 'prop-types';
import { createChart, ColorType, CandlestickSeries, LineSeries, BarSeries } from 'lightweight-charts';
import { ChevronDown, ChevronRight, Activity } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════
   Accordion Component
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
   Heikin-Ashi Calculation
   ═══════════════════════════════════════════════════════════════════════ */
function toHeikinAshi(data) {
  if (!data || data.length === 0) return [];
  const ha = [];
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const prevHa = i > 0 ? ha[i - 1] : null;
    const haClose = (d.open + d.high + d.low + d.close) / 4;
    const haOpen = prevHa ? (prevHa.open + prevHa.close) / 2 : (d.open + d.close) / 2;
    const haHigh = Math.max(d.high, haOpen, haClose);
    const haLow = Math.min(d.low, haOpen, haClose);
    ha.push({ time: d.time, open: haOpen, high: haHigh, low: haLow, close: haClose });
  }
  return ha;
}

/* ═══════════════════════════════════════════════════════════════════════
   ChartsInner — Main Chart Component
   ═══════════════════════════════════════════════════════════════════════ */
function ChartsInner() {
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState('BTC-USD'); 
  const [selectedInterval, setSelectedInterval] = useState('1d');
  const [chartType, setChartType] = useState('candlestick'); // candlestick | heikin-ashi | line | bar
  const [lastPrice, setLastPrice] = useState(null);
  const [priceChange, setPriceChange] = useState(0);
  const [showTimeframeDropdown, setShowTimeframeDropdown] = useState(false);
  const [showChartTypeDropdown, setShowChartTypeDropdown] = useState(false);
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const seriesRef = useRef(null);
  const rawDataRef = useRef([]);

  /* ─── Full Timeframe Options (TradingView-style) ─── */
  const timeframeGroups = [
    { label: 'Seconds', items: [
      { label: '1s', value: '1m', note: '(uses 1m)' },
      { label: '5s', value: '1m', note: '(uses 1m)' },
      { label: '10s', value: '1m', note: '(uses 1m)' },
      { label: '30s', value: '1m', note: '(uses 1m)' },
    ]},
    { label: 'Minutes', items: [
      { label: '1m', value: '1m' },
      { label: '2m', value: '2m' },
      { label: '3m', value: '5m', note: '(uses 5m)' },
      { label: '5m', value: '5m' },
      { label: '15m', value: '15m' },
      { label: '30m', value: '30m' },
    ]},
    { label: 'Hours', items: [
      { label: '1H', value: '1h' },
      { label: '2H', value: '1h', note: '(uses 1H)' },
      { label: '4H', value: '1h', note: '(uses 1H)' },
    ]},
    { label: 'Days+', items: [
      { label: '1D', value: '1d' },
      { label: '1W', value: '1wk' },
    ]},
  ];

  // Flat list of unique display labels for the dropdown button
  const currentTfLabel = (() => {
    for (const g of timeframeGroups) {
      for (const tf of g.items) {
        if (tf.value === selectedInterval) return tf.label;
      }
    }
    return selectedInterval.toUpperCase();
  })();

  /* ─── Chart Type Options ─── */
  const chartTypes = [
    { label: 'Candlestick', value: 'candlestick' },
    { label: 'Heikin-Ashi', value: 'heikin-ashi' },
    { label: 'Line', value: 'line' },
    { label: 'Bar (OHLC)', value: 'bar' },
  ];

  /* ─── Instrument Categories ─── */
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

  /* ─── Create/Recreate Chart When Anything Changes ─── */
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartInstanceRef.current) {
      try { chartInstanceRef.current.remove(); } catch (e) { /* already removed */ }
      chartInstanceRef.current = null;
      seriesRef.current = null;
    }

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
      crosshair: { mode: 0 },
      timeScale: {
        timeVisible: true,
        secondsVisible: ['1m', '2m', '5m'].includes(selectedInterval),
        borderColor: 'rgba(255, 255, 255, 0.1)',
        rightOffset: 5,
        barSpacing: 8,
      },
      rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.1)' },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    let series;
    if (chartType === 'line') {
      series = chart.addSeries(LineSeries, {
        color: '#D4AF37',
        lineWidth: 2,
      });
    } else if (chartType === 'bar') {
      series = chart.addSeries(BarSeries, {
        upColor: '#10B981',
        downColor: '#EF4444',
      });
    } else {
      // candlestick or heikin-ashi (both use candlestick series)
      series = chart.addSeries(CandlestickSeries, {
        upColor: chartType === 'heikin-ashi' ? '#0EA5E9' : '#10B981',
        downColor: chartType === 'heikin-ashi' ? '#F97316' : '#EF4444',
        borderVisible: false,
        wickUpColor: chartType === 'heikin-ashi' ? '#0EA5E9' : '#10B981',
        wickDownColor: chartType === 'heikin-ashi' ? '#F97316' : '#EF4444',
      });
    }

    chartInstanceRef.current = chart;
    seriesRef.current = series;

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
  }, [selectedAsset, selectedInterval, chartType]);

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
          let ohlcData = priceRes.data.map(d => ({
            time: d.time,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close
          }));
           
          ohlcData.sort((a, b) => a.time - b.time);
          const uniqueData = [];
          const seen = new Set();
          for (const d of ohlcData) {
            if (!seen.has(d.time)) {
              seen.add(d.time);
              uniqueData.push(d);
            }
          }

          rawDataRef.current = uniqueData;
           
          if (seriesRef.current && uniqueData.length > 0) {
            try {
              let displayData = uniqueData;

              if (chartType === 'heikin-ashi') {
                displayData = toHeikinAshi(uniqueData);
              }

              if (chartType === 'line') {
                seriesRef.current.setData(displayData.map(d => ({ time: d.time, value: d.close })));
              } else {
                seriesRef.current.setData(displayData);
              }
              
              chartInstanceRef.current.timeScale().fitContent();
              
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
    const refreshMs = ['1m', '2m', '5m'].includes(selectedInterval) ? 5000 : 15000;
    const interval = setInterval(fetchPrices, refreshMs);
    
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedAsset, selectedInterval, chartType]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handler = () => { setShowTimeframeDropdown(false); setShowChartTypeDropdown(false); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  return (
    <div className="flex gap-6 h-full">
      {/* MAIN CHART AREA */}
      <div className="flex-1 flex flex-col bg-card backdrop-blur-xl border border-molten/20 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
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
          
          <div className="flex items-center gap-2">
            {/* CHART TYPE DROPDOWN */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowChartTypeDropdown(!showChartTypeDropdown); setShowTimeframeDropdown(false); }}
                className="flex items-center gap-2 px-3 py-2 bg-obsidian border border-molten/20 rounded-lg text-xs font-bold text-gray-300 hover:text-white hover:border-molten/40 transition-colors"
              >
                {chartTypes.find(c => c.value === chartType)?.label || 'Candlestick'}
                <ChevronDown size={14} />
              </button>
              {showChartTypeDropdown && (
                <div className="absolute top-full right-0 mt-1 bg-obsidian border border-molten/30 rounded-xl shadow-2xl p-1 z-50 min-w-[160px]" onClick={e => e.stopPropagation()}>
                  {chartTypes.map(ct => (
                    <button
                      key={ct.value}
                      onClick={() => { setChartType(ct.value); setShowChartTypeDropdown(false); }}
                      className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg transition-colors ${chartType === ct.value ? 'bg-molten/20 text-molten' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                    >
                      {ct.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* TIMEFRAME DROPDOWN */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowTimeframeDropdown(!showTimeframeDropdown); setShowChartTypeDropdown(false); }}
                className="flex items-center gap-2 px-3 py-2 bg-obsidian border border-molten/20 rounded-lg text-xs font-bold text-molten hover:border-molten/40 transition-colors"
              >
                {currentTfLabel}
                <ChevronDown size={14} />
              </button>
              {showTimeframeDropdown && (
                <div className="absolute top-full right-0 mt-1 bg-obsidian border border-molten/30 rounded-xl shadow-2xl p-2 z-50 min-w-[200px] max-h-[400px] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
                  {timeframeGroups.map(group => (
                    <div key={group.label} className="mb-2">
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest px-2 py-1">{group.label}</div>
                      {group.items.map(tf => (
                        <button
                          key={tf.label}
                          onClick={() => { setSelectedInterval(tf.value); setShowTimeframeDropdown(false); }}
                          className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-between ${selectedInterval === tf.value ? 'bg-molten/20 text-molten' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                        >
                          <span>{tf.label}</span>
                          {tf.note && <span className="text-[10px] text-gray-600">{tf.note}</span>}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
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
   ═══════════════════════════════════════════════════════════════════════ */
export default function Charts() {
  return (
    <ErrorBoundary>
      <ChartsInner />
    </ErrorBoundary>
  );
}
