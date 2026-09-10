import React, { useState } from 'react';
import { CloudSun, Wind, Droplets, Compass, Search, ChevronRight, RefreshCw, Eye } from 'lucide-react';

interface QuickExitDecoyProps {
  onRestoreSanctuary: () => void;
}

export const QuickExitDecoy: React.FC<QuickExitDecoyProps> = ({ onRestoreSanctuary }) => {
  const [activeTab, setActiveTab] = useState<'weather' | 'recipes' | 'news'>('weather');
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [tapCount, setTapCount] = useState(0);

  const handleHeaderTap = () => {
    const nextCount = tapCount + 1;
    setTapCount(nextCount);
    if (nextCount >= 3) {
      setShowRestorePrompt(true);
      setTapCount(0);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] font-sans pb-12 select-none">
      {/* Decoy Top Navigation */}
      <header 
        onClick={handleHeaderTap}
        className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-xs cursor-default"
      >
        <div className="flex items-center gap-2">
          <CloudSun className="w-6 h-6 text-sky-500" />
          <span className="font-bold text-slate-800 tracking-tight text-lg">Everyday Digest & Weather</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Updated 2m ago</span>
          <RefreshCw className="w-4 h-4 text-slate-400" />
        </div>
      </header>

      {/* Discreet restore banner if activated via triple tap or emergency */}
      {showRestorePrompt && (
        <div className="bg-emerald-50 border-b border-emerald-200 p-3 flex items-center justify-between text-xs text-emerald-900 animate-fadeIn">
          <div className="flex items-center gap-1.5 font-medium">
            <Eye className="w-4 h-4 text-emerald-600" />
            <span>Safety Mode Active. Tap restore to re-open SAHAAS Sanctuary.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRestoreSanctuary}
              className="px-2.5 py-1 bg-emerald-600 text-white rounded font-semibold hover:bg-emerald-700 transition-colors"
            >
              Restore Sanctuary
            </button>
            <button
              onClick={() => setShowRestorePrompt(false)}
              className="text-slate-400 hover:text-slate-600 px-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-md mx-auto px-4 pt-3 flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('weather')}
          className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'weather' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500'
          }`}
        >
          Local Weather
        </button>
        <button
          onClick={() => setActiveTab('recipes')}
          className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'recipes' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500'
          }`}
        >
          Daily Recipes
        </button>
        <button
          onClick={() => setActiveTab('news')}
          className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'news' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500'
          }`}
        >
          City Notes
        </button>
      </div>

      <main className="max-w-md mx-auto px-4 pt-4 flex flex-col gap-4">
        {activeTab === 'weather' && (
          <>
            {/* Weather Card */}
            <div className="bg-gradient-to-br from-sky-400 to-blue-600 text-white rounded-2xl p-5 shadow-sm flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">New Delhi</h2>
                  <p className="text-sky-100 text-sm">Partly Cloudy · Air Quality Moderate</p>
                </div>
                <CloudSun className="w-12 h-12 text-yellow-200" />
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-light tracking-tight">28°</span>
                <span className="text-sky-100 text-lg">Feels like 30°</span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/20 text-xs text-sky-50">
                <div className="flex items-center gap-1">
                  <Droplets className="w-3.5 h-3.5" />
                  <span>Humidity: 62%</span>
                </div>
                <div className="flex items-center gap-1">
                  <Wind className="w-3.5 h-3.5" />
                  <span>Wind: 11 km/h</span>
                </div>
                <div className="flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5" />
                  <span>UV: Low</span>
                </div>
              </div>
            </div>

            {/* 5-Day Forecast */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Weekly Outlook</h3>
              {[
                { day: 'Today', temp: '28° / 19°', condition: 'Sunny intervals' },
                { day: 'Tomorrow', temp: '29° / 20°', condition: 'Clear sky' },
                { day: 'Friday', temp: '27° / 18°', condition: 'Scattered clouds' },
                { day: 'Saturday', temp: '28° / 19°', condition: 'Gentle breeze' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-sm">
                  <span className="font-medium text-slate-700">{item.day}</span>
                  <span className="text-slate-500 text-xs">{item.condition}</span>
                  <span className="font-semibold text-slate-800">{item.temp}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'recipes' && (
          <div className="flex flex-col gap-3">
            {[
              { title: 'Soothing Ginger Lemon Infusion', time: '10 mins', cal: '45 kcal', tag: 'Beverage' },
              { title: 'Nutritious Moong Dal & Spinach Bowl', time: '25 mins', cal: '320 kcal', tag: 'High Protein' },
              { title: 'Comforting Cardamom Oatmeal', time: '15 mins', cal: '210 kcal', tag: 'Breakfast' },
            ].map((recipe, idx) => (
              <div key={idx} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-600 tracking-wider">{recipe.tag}</span>
                  <h4 className="font-semibold text-slate-800 text-sm mt-0.5">{recipe.title}</h4>
                  <p className="text-xs text-slate-400 mt-1">{recipe.time} · {recipe.cal}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300" />
              </div>
            ))}
          </div>
        )}

        {activeTab === 'news' && (
          <div className="flex flex-col gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 text-sm text-slate-700">
              <span className="text-xs text-slate-400">Metro Transport</span>
              <h4 className="font-semibold text-slate-900 mt-1">Yellow line metro service frequency boosted during evening rush hours.</h4>
              <p className="text-xs text-slate-500 mt-1">Trains will run at 2-minute intervals between Rajiv Chowk and HUDA City Centre.</p>
            </div>
          </div>
        )}

        {/* Discreet bottom link to return to Sanctuary without suspicion */}
        <div className="pt-6 text-center">
          <button
            onClick={onRestoreSanctuary}
            className="text-[11px] text-slate-300 hover:text-slate-500 transition-colors py-2 px-4"
          >
            Privacy & Terms · Session #719
          </button>
        </div>
      </main>
    </div>
  );
};
