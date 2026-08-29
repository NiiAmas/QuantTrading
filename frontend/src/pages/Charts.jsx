import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Activity } from 'lucide-react';
import PropTypes from 'prop-types';

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
   ChartsInner — Main Chart Component
   ═══════════════════════════════════════════════════════════════════════ */
function ChartsInner() {
  const [selectedAsset, setSelectedAsset] = useState('BINANCE:BTCUSD'); 

  /* ─── Instrument Categories ─── */
  const assetCategories = [
    { title: 'Crypto', items: [
      { label: 'Bitcoin (BTC)', value: 'BINANCE:BTCUSD' }, 
      { label: 'Ethereum (ETH)', value: 'BINANCE:ETHUSD' }, 
      { label: 'Solana (SOL)', value: 'BINANCE:SOLUSD' },
      { label: 'Ripple (XRP)', value: 'BINANCE:XRPUSD' },
      { label: 'Cardano (ADA)', value: 'BINANCE:ADAUSD' },
      { label: 'Dogecoin (DOGE)', value: 'BINANCE:DOGEUSD' },
      { label: 'Polkadot (DOT)', value: 'BINANCE:DOTUSD' },
      { label: 'Avalanche (AVAX)', value: 'BINANCE:AVAXUSD' },
      { label: 'Chainlink (LINK)', value: 'BINANCE:LINKUSD' },
    ]},
    { title: 'Stocks', items: [
      { label: 'Apple (AAPL)', value: 'NASDAQ:AAPL' }, 
      { label: 'Nvidia (NVDA)', value: 'NASDAQ:NVDA' },
      { label: 'Tesla (TSLA)', value: 'NASDAQ:TSLA' },
      { label: 'Microsoft (MSFT)', value: 'NASDAQ:MSFT' },
      { label: 'Amazon (AMZN)', value: 'NASDAQ:AMZN' },
      { label: 'Alphabet (GOOGL)', value: 'NASDAQ:GOOGL' },
      { label: 'Meta (META)', value: 'NASDAQ:META' },
      { label: 'AMD (AMD)', value: 'NASDAQ:AMD' },
    ]},
    { title: 'Commodities', items: [
      { label: 'Gold', value: 'OANDA:XAUUSD' }, 
      { label: 'Silver', value: 'OANDA:XAGUSD' },
      { label: 'Crude Oil', value: 'NYMEX:CL1!' },
      { label: 'Natural Gas', value: 'NYMEX:NG1!' },
    ]},
    { title: 'Forex', items: [
      { label: 'EUR/USD', value: 'FX:EURUSD' }, 
      { label: 'GBP/USD', value: 'FX:GBPUSD' },
      { label: 'USD/JPY', value: 'FX:USDJPY' },
      { label: 'AUD/USD', value: 'FX:AUDUSD' },
      { label: 'USD/CAD', value: 'FX:USDCAD' },
    ]},
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-full">
      {/* MAIN CHART AREA */}
      <div className="flex-1 flex flex-col bg-card border border-molten/20 rounded-2xl p-2 shadow-xl relative overflow-hidden min-h-[400px]">
        {/* Chart Container */}
        <div className="flex-1 w-full relative">
          <iframe 
            src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_123&symbol=${selectedAsset}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=131722&studies=%5B%5D&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=1&showpopupbutton=1&locale=en`}
            width="100%" 
            height="100%" 
            frameBorder="0" 
            allowTransparency="true" 
            scrolling="no" 
            allowFullScreen
          ></iframe>
        </div>
      </div>

      {/* RIGHT PANE — Instrument Selector */}
      <div className="w-full lg:w-[280px] xl:w-[300px] bg-obsidian/50 border border-molten/10 rounded-2xl p-4 flex flex-col lg:h-full max-h-[300px] lg:max-h-none overflow-hidden shadow-2xl shrink-0">
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

export default function Charts() {
  return <ChartsInner />;
}
