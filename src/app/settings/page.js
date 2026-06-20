'use client';

import { useState, useEffect } from 'react';

const DIETARY_OPTIONS = [
  { id: 'Vegan', label: 'Vegan' },
  { id: 'Vegetarian', label: 'Vegetarian' },
  { id: 'Gluten-Free', label: 'Gluten-Free' },
  { id: 'Dairy-Free', label: 'Dairy-Free' },
  { id: 'Keto', label: 'Keto' },
  { id: 'Low-Carb', label: 'Low-Carb' }
];

export default function Settings() {
  const [profile, setProfile] = useState({
    dietary_restrictions: [],
    household_size: 1,
    default_budget: 30.00,
    gemini_api_key: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Fetch settings on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        }
      } catch (err) {
        console.error('Failed to load profile settings', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleDietToggle = (optionId) => {
    const isSelected = profile.dietary_restrictions.includes(optionId);
    const updatedRestrictions = isSelected
      ? profile.dietary_restrictions.filter(r => r !== optionId)
      : [...profile.dietary_restrictions, optionId];
    
    setProfile({ ...profile, dietary_restrictions: updatedRestrictions });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      if (res.ok) {
        setMessage('Preferences saved successfully! ✅');
      } else {
        setMessage('Failed to save settings. ⚠️');
      }
    } catch (err) {
      console.error(err);
      setMessage('Failed to save settings due to network error.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto w-full animate-fade-in">
      <div className="glass-card rounded-2xl p-8 flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Profile Settings</h1>
          <p className="text-slate-400 text-sm mt-1">
            Personalize your culinary experience. These values guide our AI planner and budget reports.
          </p>
        </div>

        {message && (
          <div className={`p-4 rounded-xl text-sm font-semibold border ${
            message.includes('successfully') 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Household Size */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-200">Household Size</label>
            <input
              type="number"
              min="1"
              max="20"
              value={profile.household_size}
              onChange={(e) => setProfile({ ...profile, household_size: parseInt(e.target.value) || 1 })}
              className="glow-input rounded-xl px-4 py-3 text-sm"
              required
              id="settings-household"
            />
            <span className="text-xs text-slate-500">How many people are you cooking for? (Scales ingredients & costs)</span>
          </div>

          {/* Daily Budget */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-200">Daily Target Budget ($ USD)</label>
            <input
              type="number"
              step="0.01"
              min="1"
              value={profile.default_budget}
              onChange={(e) => setProfile({ ...profile, default_budget: parseFloat(e.target.value) || 0 })}
              className="glow-input rounded-xl px-4 py-3 text-sm"
              required
              id="settings-budget"
            />
            <span className="text-xs text-slate-500">Your total target budget for breakfast, lunch, and dinner.</span>
          </div>

          {/* Dietary Restrictions */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-200">Dietary Restrictions</label>
            <div className="grid grid-cols-2 gap-3 mt-1">
              {DIETARY_OPTIONS.map((opt) => {
                const checked = profile.dietary_restrictions.includes(opt.id);
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => handleDietToggle(opt.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-sm font-semibold transition-all ${
                      checked 
                        ? 'border-violet-500 bg-violet-500/10 text-violet-300' 
                        : 'border-white/10 bg-white/2 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center ${
                      checked ? 'bg-violet-500 border-violet-500' : 'border-slate-600'
                    }`}>
                      {checked && (
                        <svg className="w-2.5 h-2.5 text-white fill-current" viewBox="0 0 20 20">
                          <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
                        </svg>
                      )}
                    </span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Gemini API Key */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-200">Gemini API Key (Optional)</label>
            <input
              type="password"
              placeholder={profile.gemini_api_key ? '••••••••••••••••••••••••' : 'Enter your Gemini API Key'}
              value={profile.gemini_api_key}
              onChange={(e) => setProfile({ ...profile, gemini_api_key: e.target.value })}
              className="glow-input rounded-xl px-4 py-3 text-sm font-mono"
              id="settings-apikey"
            />
            <span className="text-xs text-slate-500">
              Saves key locally to bypass default mock dataset. We never leak or share this key.
            </span>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-xl font-bold text-white gradient-btn mt-4 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            id="settings-save-btn"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving Preferences...
              </>
            ) : (
              'Save Preferences'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
