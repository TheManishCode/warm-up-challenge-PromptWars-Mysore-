import { getUserProfile, getActivePlan } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const profile = await getUserProfile();
  const activePlan = await getActivePlan();

  return (
    <div className="flex flex-col gap-10 animate-fade-in">
      {/* Hero Section */}
      <section className="text-center py-10 max-w-3xl mx-auto flex flex-col gap-4">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-violet-400 via-pink-400 to-cyan-300 bg-clip-text text-transparent">
          Plan Smart. Cook Better. Eat Well.
        </h1>
        <p className="text-slate-400 text-lg sm:text-xl font-normal leading-relaxed">
          Welcome to SavorPlan, your persistent cooking assistant. Optimize your weekly meal routine, manage grocery lists, track budgets, and find instant substitutions.
        </p>
      </section>

      {/* Profile & Plan Summaries */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Profile Info */}
        <div className="glass-card rounded-2xl p-6 flex flex-col justify-between gap-6">
          <div className="flex flex-col gap-2">
            <div className="text-violet-400 text-xs font-bold uppercase tracking-widest">
              User Profile
            </div>
            <h2 className="text-2xl font-bold text-white">Your Preferences</h2>
            <p className="text-slate-400 text-sm mt-1">
              Configure these preferences to help SavorPlan generate custom meal plans.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex items-center justify-between py-2 border-b border-white/5 text-sm">
                <span className="text-slate-400">Dietary Restrictions</span>
                <span className="text-slate-200 font-semibold capitalize">
                  {profile.dietary_restrictions.join(', ') || 'None'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/5 text-sm">
                <span className="text-slate-400">Household Size</span>
                <span className="text-slate-200 font-semibold">
                  {profile.household_size} {profile.household_size === 1 ? 'person' : 'people'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/5 text-sm">
                <span className="text-slate-400">Daily Target Budget</span>
                <span className="text-emerald-400 font-bold">
                  ${Number(profile.default_budget).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          <a
            href="/settings"
            className="w-full text-center py-2.5 rounded-xl text-sm font-semibold border border-white/10 hover:bg-white/5 transition-all text-slate-200 hover:text-white"
          >
            Update Profile
          </a>
        </div>

        {/* Active Plan Status */}
        <div className="glass-card rounded-2xl p-6 flex flex-col justify-between gap-6">
          <div className="flex flex-col gap-2">
            <div className="text-cyan-400 text-xs font-bold uppercase tracking-widest">
              Active Meal Plan
            </div>
            <h2 className="text-2xl font-bold text-white">Current Status</h2>
            <p className="text-slate-400 text-sm mt-1">
              View your current active meal schedule and generated cooking requirements.
            </p>
            
            {activePlan ? (
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex items-center justify-between py-2 border-b border-white/5 text-sm">
                  <span className="text-slate-400">Plan Date</span>
                  <span className="text-slate-200 font-semibold">{activePlan.date}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5 text-sm">
                  <span className="text-slate-400">Meals Scheduled</span>
                  <span className="text-slate-200 font-semibold">{activePlan.meals.length} meals</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5 text-sm">
                  <span className="text-slate-400">Grocery List Status</span>
                  <span className="text-slate-200 font-semibold">
                    {activePlan.groceryItems.filter(g => g.checked).length} of {activePlan.groceryItems.length} purchased
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-6 text-center py-6 border border-dashed border-white/10 rounded-xl bg-white/2">
                <span className="text-slate-500 text-sm block">No active meal plan.</span>
                <span className="text-slate-400 text-xs block mt-1">Generate a plan to get started.</span>
              </div>
            )}
          </div>

          {activePlan ? (
            <div className="flex gap-4">
              <a
                href="/plan"
                className="flex-1 text-center py-2.5 rounded-xl text-sm font-semibold gradient-btn text-white"
              >
                Go to Plan
              </a>
              <a
                href="/grocery-list"
                className="flex-1 text-center py-2.5 rounded-xl text-sm font-semibold border border-white/10 hover:bg-white/5 text-slate-200 hover:text-white transition-all"
              >
                Grocery List
              </a>
            </div>
          ) : (
            <a
              href="/plan"
              className="w-full text-center py-2.5 rounded-xl text-sm font-semibold gradient-btn text-white"
            >
              Plan Your First Day
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
