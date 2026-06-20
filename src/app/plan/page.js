'use client';

import { useState, useEffect } from 'react';

export default function Plan() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [swapRequests, setSwapRequests] = useState({}); // Stores swap text per mealId
  const [swapping, setSwapping] = useState({}); // Stores loading state per mealId

  async function fetchPlan() {
    try {
      const res = await fetch('/api/plan');
      if (res.ok) {
        const data = await res.json();
        setPlan(data);
      } else {
        setPlan(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPlan();
  }, []);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPrompt })
      });
      if (res.ok) {
        const data = await res.json();
        setPlan(data);
        setCustomPrompt('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleSwap = async (mealId) => {
    const text = swapRequests[mealId];
    if (!text || !text.trim()) return;

    setSwapping({ ...swapping, [mealId]: true });
    try {
      const res = await fetch('/api/plan/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mealId, requestText: text })
      });
      if (res.ok) {
        const data = await res.json();
        setPlan(data);
        setSwapRequests({ ...swapRequests, [mealId]: '' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSwapping({ ...swapping, [mealId]: false });
    }
  };

  // Helper to determine cooking readiness of a meal
  const getMealStatus = (mealId) => {
    if (!plan || !plan.groceryItems) return { status: 'unknown', missingCount: 0, items: [] };
    const mealItems = plan.groceryItems.filter(g => g.meal_id === mealId);
    
    // Missing items are those that we need to buy (source: 'needed') and are not checked off yet
    const missing = mealItems.filter(g => g.source === 'needed' && !g.checked);
    
    return {
      status: missing.length === 0 ? 'ready' : 'missing',
      missingCount: missing.length,
      items: mealItems
    };
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-500"></div>
      </div>
    );
  }

  // Calculate global cooking readiness percentage
  const totalMeals = plan?.meals?.length || 0;
  const readyMeals = plan?.meals?.filter(m => getMealStatus(m.id).status === 'ready').length || 0;
  const progressPercent = totalMeals > 0 ? Math.round((readyMeals / totalMeals) * 100) : 0;

  return (
    <div className="flex flex-col gap-8 w-full animate-fade-in">
      {/* Planner Header & Input Canvas */}
      <div className="glass-card rounded-2xl p-6 md:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex flex-col gap-2 max-w-lg">
          <div className="text-violet-400 text-xs font-bold uppercase tracking-widest">
            AI Meal Planner
          </div>
          <h1 className="text-3xl font-extrabold text-white">Your Cooking Canvas</h1>
          <p className="text-slate-400 text-sm">
            Generate and edit your personalized recipe routines. Check ingredient availability in real-time, or swap out individual items.
          </p>
        </div>
        <form onSubmit={handleGenerate} className="flex-1 flex items-center gap-3 w-full lg:max-w-xl">
          <input
            type="text"
            placeholder="e.g., Make it low-sodium, vegan, or quick prep..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="glow-input flex-1 rounded-xl px-4 py-3 text-sm"
            disabled={generating}
            id="plan-custom-prompt"
          />
          <button
            type="submit"
            disabled={generating}
            className="gradient-btn px-6 py-3 rounded-xl font-bold text-white text-sm whitespace-nowrap disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            id="plan-generate-btn"
          >
            {generating ? (
              <>
                <div className="animate-spin rounded-full h-4.5 w-4.5 border-b-2 border-white"></div>
                Planning...
              </>
            ) : (
              'Plan My Day'
            )}
          </button>
        </form>
      </div>

      {plan ? (
        <div className="flex flex-col gap-8">
          {/* Progress Canvas Widget */}
          <div className="glass-card rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 border-l-4 border-l-cyan-500">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-white">Daily Readiness</h2>
              <p className="text-slate-400 text-xs">
                Shows the percentage of meals that have 100% of their ingredients checked off or available in your pantry.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-sm font-semibold text-slate-200">
                  {readyMeals} of {totalMeals} meals ready
                </span>
                <span className="text-xs text-slate-500">
                  Manage groceries to update readiness
                </span>
              </div>
              <div className="relative w-16 h-16 flex items-center justify-center rounded-full bg-slate-900 border border-white/5">
                <span className="text-sm font-extrabold text-cyan-400">{progressPercent}%</span>
                <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="rgba(255,255,255,0.03)"
                    strokeWidth="4"
                    fill="transparent"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="var(--secondary)"
                    strokeWidth="4"
                    fill="transparent"
                    strokeDasharray={175}
                    strokeDashoffset={175 - (175 * progressPercent) / 100}
                    className="transition-all duration-500 ease-out"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Meals Canvas Board */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {['breakfast', 'lunch', 'dinner'].map((type) => {
              const meal = plan.meals.find((m) => m.type === type);
              if (!meal) return null;

              const isSwapping = swapping[meal.id];
              const swapText = swapRequests[meal.id] || '';
              const { status, missingCount, items } = getMealStatus(meal.id);

              return (
                <div
                  key={meal.id}
                  className="glass-card rounded-2xl p-6 flex flex-col justify-between gap-6 border-t-4 border-t-violet-500/80 relative"
                >
                  <div className="flex flex-col gap-4">
                    {/* Meal Header */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-widest font-extrabold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                        {type}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">🕒 {meal.cook_time || 'N/A'}</span>
                    </div>

                    {/* Meal details */}
                    <div>
                      <h3 className="text-xl font-bold text-white leading-tight">{meal.name}</h3>
                      <p className="text-slate-400 text-xs leading-relaxed mt-1.5">{meal.description}</p>
                    </div>

                    {/* Dynamic Availability Status Badge */}
                    <div className="flex items-center gap-2 mt-1">
                      {status === 'ready' ? (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Ready to Cook 🍳
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                          Missing {missingCount} item{missingCount > 1 ? 's' : ''} 🛒
                        </span>
                      )}
                    </div>

                    {/* Embedded Ingredients List (Visual Checklist summary) */}
                    <div className="flex flex-col gap-1.5 bg-white/2 p-3 rounded-xl border border-white/5 mt-1">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500">Ingredients Overview</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {items.map((it) => {
                          const available = it.source === 'pantry' || it.checked;
                          return (
                            <span 
                              key={it.id} 
                              className={`text-[10px] px-2 py-0.5 rounded border transition-all ${
                                available 
                                  ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400/80 line-through' 
                                  : 'bg-white/2 border-white/5 text-slate-400'
                              }`}
                            >
                              {it.item}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Swap Meal Form */}
                  <div className="flex flex-col gap-2 border-t border-white/5 pt-4 mt-2">
                    <span className="text-xs text-slate-400 font-semibold">Change this recipe?</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g., swap to chicken penne"
                        value={swapText}
                        onChange={(e) =>
                          setSwapRequests({ ...swapRequests, [meal.id]: e.target.value })
                        }
                        className="glow-input flex-1 px-3 py-1.5 rounded-lg text-xs"
                        disabled={isSwapping}
                        id={`swap-input-${meal.id}`}
                      />
                      <button
                        onClick={() => handleSwap(meal.id)}
                        disabled={isSwapping || !swapText.trim()}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-all cursor-pointer"
                        id={`swap-btn-${meal.id}`}
                      >
                        {isSwapping ? 'Swapping...' : 'Swap'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-20 glass-card rounded-2xl border border-dashed border-white/10">
          <svg
            className="w-16 h-16 text-slate-600 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <h2 className="text-xl font-bold text-white">No Active Meal Plan</h2>
          <p className="text-slate-400 text-sm mt-1 max-w-sm text-center">
            You don't have an active menu plan. Select your settings and tap the "Plan My Day" button above to generate one.
          </p>
        </div>
      )}
    </div>
  );
}
