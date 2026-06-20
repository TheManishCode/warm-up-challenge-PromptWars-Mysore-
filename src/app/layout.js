import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "SavorPlan — AI Cooking To-Do List",
  description: "A persistent, budget-smart meal planner and grocery coordinator powered by Gemini.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#06060c] text-slate-100">
        {/* Navigation Panel */}
        <header className="glass-nav sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-cyan-400 flex items-center justify-center font-bold text-white shadow-lg shadow-violet-500/20">
                  S
                </div>
                <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-violet-400 bg-clip-text text-transparent">
                  SavorPlan
                </span>
                <span className="text-[10px] uppercase tracking-widest bg-violet-500/10 text-violet-400 border border-violet-500/20 px-1.5 py-0.5 rounded font-mono">
                  Warmup
                </span>
              </div>
              <nav className="flex space-x-1 sm:space-x-4">
                <a
                  href="/plan"
                  className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                  id="nav-plan"
                >
                  Meal Plan
                </a>
                <a
                  href="/grocery-list"
                  className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                  id="nav-grocery"
                >
                  Grocery List
                </a>
                <a
                  href="/settings"
                  className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                  id="nav-settings"
                >
                  Settings
                </a>
              </nav>
            </div>
          </div>
        </header>

        {/* Content Container */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
