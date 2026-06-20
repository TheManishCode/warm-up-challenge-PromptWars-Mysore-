'use client';

import { useState, useEffect } from 'react';
import { calculateGroceryTotal, evaluateBudget } from '@/lib/utils';

export default function GroceryList() {
  const [plan, setPlan] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedIngredient, setSelectedIngredient] = useState(null); // For substitution modal

  async function fetchData() {
    try {
      const planRes = await fetch('/api/plan');
      const profileRes = await fetch('/api/settings');

      if (planRes.ok) {
        const planData = await planRes.json();
        setPlan(planData);
      } else {
        setPlan(null);
      }

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleChecked = async (itemId, currentChecked) => {
    try {
      const res = await fetch('/api/grocery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, checked: !currentChecked })
      });
      if (res.ok) {
        // Optimistically update local state
        setPlan(prev => {
          if (!prev) return null;
          return {
            ...prev,
            groceryItems: prev.groceryItems.map(g => 
              g.id === itemId ? { ...g, checked: !currentChecked } : g
            )
          };
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleSource = async (itemId, currentSource) => {
    const nextSource = currentSource === 'needed' ? 'pantry' : 'needed';
    try {
      const res = await fetch('/api/grocery', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, source: nextSource })
      });
      if (res.ok) {
        setPlan(prev => {
          if (!prev) return null;
          return {
            ...prev,
            groceryItems: prev.groceryItems.map(g => 
              g.id === itemId ? { ...g, source: nextSource } : g
            )
          };
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-500"></div>
      </div>
    );
  }

  const groceryItems = plan?.groceryItems || [];
  const substitutions = plan?.substitutions || [];
  const budget = profile?.default_budget || 30.00;

  // Compute actual shopping cost: Sum only items we NEED to buy (source: 'needed')
  const totalCost = calculateGroceryTotal(groceryItems);
  const { feasible: budgetFeasibility, diff: budgetDiff } = evaluateBudget(totalCost, budget);

  const totalItems = groceryItems.length;
  const completedItems = groceryItems.filter(g => g.checked || g.source === 'pantry').length;
  const shopProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // Group items by category
  const categories = {};
  groceryItems.forEach(item => {
    const cat = item.category || 'Other';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(item);
  });

  return (
    <div className="flex flex-col gap-8 w-full animate-fade-in relative">
      {plan ? (
        <>
          {/* Budget Feasibility Banner */}
          <div className={`p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 backdrop-blur-md ${
            budgetFeasibility 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
          }`}>
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-widest font-extrabold opacity-60">Budget Feasibility Check</span>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                {budgetFeasibility ? (
                  <>Within Budget ✅</>
                ) : (
                  <>Over Budget ⚠️</>
                )}
              </h2>
              <p className="text-sm opacity-80 mt-1">
                {budgetFeasibility 
                  ? `Your meal plan estimated cost ($${totalCost.toFixed(2)}) is within your daily budget ($${budget.toFixed(2)}).`
                  : `Your plan estimated cost ($${totalCost.toFixed(2)}) exceeds your daily budget ($${budget.toFixed(2)}) by $${budgetDiff.toFixed(2)}.`
                }
              </p>
            </div>
            <div className="text-right flex flex-col items-end gap-1">
              <span className="text-[10px] opacity-60 uppercase font-mono">Shopping Total</span>
              <span className="text-3xl font-extrabold">${totalCost.toFixed(2)}</span>
              <span className="text-xs opacity-60">Estimated grocery sum</span>
            </div>
          </div>

          {/* Shopping Progress Bar */}
          <div className="glass-card rounded-2xl p-4 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-semibold">Shopping Checklist Progress</span>
              <span className="text-cyan-400 font-bold">{completedItems} of {totalItems} items acquired ({shopProgress}%)</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 border border-white/5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-violet-500 to-cyan-400 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${shopProgress}%` }}
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Grocery Checklist */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <div className="glass-card rounded-2xl p-6 flex flex-col gap-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">Ingredients Checklist</h2>
                  <p className="text-slate-400 text-sm mt-1">
                    Check ingredients you already bought, or switch items to "Pantry" to exclude them from budget estimates.
                  </p>
                </div>

                <div className="flex flex-col gap-6">
                  {Object.keys(categories).length > 0 ? (
                    Object.entries(categories).map(([category, items]) => (
                      <div key={category} className="flex flex-col gap-2">
                        <h4 className="text-xs uppercase tracking-wider font-extrabold text-violet-400 border-b border-white/5 pb-2">
                          {category}
                        </h4>
                        <div className="flex flex-col gap-1">
                          {items.map(item => {
                            const hasSub = substitutions.some(s => s.original.toLowerCase() === item.item.toLowerCase());
                            return (
                              <div 
                                key={item.id} 
                                className={`flex items-center justify-between p-3 rounded-xl hover:bg-white/2 transition-all ${
                                  item.checked ? 'opacity-40' : ''
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={item.checked}
                                    onChange={() => handleToggleChecked(item.id, item.checked)}
                                    className="custom-checkbox"
                                    id={`checkbox-${item.id}`}
                                  />
                                  <div className="flex flex-col">
                                    <span className={`text-sm font-semibold text-white ${
                                      item.checked ? 'line-through text-slate-500' : ''
                                    }`}>
                                      {item.item}
                                    </span>
                                    {hasSub && (
                                      <button
                                        onClick={() => setSelectedIngredient(item.item)}
                                        className="text-[10px] text-violet-400 hover:text-violet-300 font-bold tracking-wide text-left hover:underline cursor-pointer"
                                        id={`sub-link-${item.id}`}
                                      >
                                        💡 Alternative Available
                                      </button>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-4">
                                  <span className="text-sm font-bold text-slate-300 font-mono">
                                    ${item.est_cost.toFixed(2)}
                                  </span>
                                  <button
                                    onClick={() => handleToggleSource(item.id, item.source)}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                      item.source === 'pantry'
                                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                        : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                                    }`}
                                    id={`pantry-toggle-${item.id}`}
                                  >
                                    {item.source === 'pantry' ? 'In Pantry' : 'Need to Buy'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 border border-dashed border-white/10 rounded-xl">
                      <span className="text-slate-500 text-sm">No grocery items available.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Substitution Board */}
            <div className="flex flex-col gap-6">
              <div className="glass-card rounded-2xl p-6 flex flex-col gap-4">
                <h3 className="text-lg font-bold text-white">Substitution Guide</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Need alternatives due to cost, dietary limits, or availability? Click on any ingredient marked with 💡 or check the suggestions below:
                </p>
                <div className="flex flex-col gap-3 mt-2">
                  {substitutions.length > 0 ? (
                    substitutions.map((sub, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl border border-white/5 bg-white/2 text-xs flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200">{sub.original}</span>
                          <span className="text-[10px] text-slate-500 font-semibold uppercase">{sub.meal_type}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-violet-400 font-bold">
                          <span>→</span>
                          <span>{sub.substitute}</span>
                        </div>
                        <p className="text-slate-400 mt-1 italic">"{sub.reason}"</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-xs text-slate-600">
                      No active substitutions. Generate a meal plan first.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Substitution Details Modal */}
          {selectedIngredient && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="glass-card rounded-2xl p-6 max-w-sm w-full flex flex-col gap-4 animate-fade-in">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <h4 className="text-lg font-bold text-white">Substitution Details</h4>
                  <button 
                    onClick={() => setSelectedIngredient(null)}
                    className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
                  >
                    ×
                  </button>
                </div>
                {substitutions.filter(s => s.original.toLowerCase() === selectedIngredient.toLowerCase()).map((sub, idx) => (
                  <div key={idx} className="flex flex-col gap-2">
                    <span className="text-xs text-slate-500 uppercase font-mono">For {selectedIngredient}</span>
                    <div className="text-sm font-semibold text-slate-200">
                      We suggest swapping for <span className="text-violet-400 font-bold">{sub.substitute}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-2 bg-white/5 p-3 rounded-xl border border-white/5 leading-relaxed">
                      <strong>Reason:</strong> {sub.reason}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setSelectedIngredient(null)}
                  className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold text-white mt-2 cursor-pointer transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 glass-card rounded-2xl border border-dashed border-white/10">
          <h2 className="text-xl font-bold text-white">No Groceries Needed</h2>
          <p className="text-slate-400 text-sm mt-1 max-w-sm text-center">
            You don't have an active meal plan or grocery items. Plan a day's menu to automatically compile your grocery list.
          </p>
        </div>
      )}
    </div>
  );
}
