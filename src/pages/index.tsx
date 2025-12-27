import Link from 'next/link';
import { PieChart, List, Info, ArrowRight, TrendingUp } from 'lucide-react';

export default function Home() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 font-sans">

            {/* HEADER / HERO SECTION */}
            <div className="bg-white shadow-sm border-b border-gray-200 pb-12 pt-16 px-8 text-center">
                <div className="max-w-4xl mx-auto">
                    <div className="inline-flex items-center justify-center p-3 bg-blue-50 rounded-full mb-6">
                        <TrendingUp size={32} className="text-blue-600" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
                        Investments Monitor
                    </h1>
                    <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                        Your central hub to track transactions, analyze portfolio, and monitor securities. All in one place.
                    </p>
                </div>
            </div>

            {/* NAVIGATION GRID */}
            <div className="max-w-6xl mx-auto px-8 py-16">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* CARD 1: TRANSACTIONS */}
                    <Link href="/transactions" className="group">
                        <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 transform hover:-translate-y-1 h-full flex flex-col justify-between">
                            <div>
                                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <List size={24} />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-800 mb-3">Transactions</h3>
                                <p className="text-slate-500 leading-relaxed">
                                    View your complete trading history. Filter by date, ticker, or type and analyze costs.
                                </p>
                            </div>
                            <div className="mt-8 flex items-center text-blue-600 font-semibold group-hover:translate-x-2 transition-transform">
                                Go to Transactions <ArrowRight size={18} className="ml-2" />
                            </div>
                        </div>
                    </Link>

                    {/* CARD 2: PORTFOLIO VALUATION (Updated Link) */}
                    <Link href="/portfolio_valuation" className="group">
                        <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 transform hover:-translate-y-1 h-full flex flex-col justify-between">
                            <div>
                                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                    <PieChart size={24} />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-800 mb-3">Portfolio Valuation</h3>
                                <p className="text-slate-500 leading-relaxed">
                                    Visualize your wealth trends, asset allocation, and aggregate performance.
                                </p>
                            </div>
                            <div className="mt-8 flex items-center text-emerald-600 font-semibold group-hover:translate-x-2 transition-transform">
                                Analyze Portfolio <ArrowRight size={18} className="ml-2" />
                            </div>
                        </div>
                    </Link>

                    {/* CARD 3: SECURITIES INFO (Updated Link) */}
                    <Link href="/securities_info" className="group">
                        <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 transform hover:-translate-y-1 h-full flex flex-col justify-between">
                            <div>
                                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 mb-6 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                    <Info size={24} />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-800 mb-3">Securities Info</h3>
                                <p className="text-slate-500 leading-relaxed">
                                    Technical details, dividends, and fundamental data on the securities you follow or own.
                                </p>
                            </div>
                            <div className="mt-8 flex items-center text-purple-600 font-semibold group-hover:translate-x-2 transition-transform">
                                View Securities <ArrowRight size={18} className="ml-2" />
                            </div>
                        </div>
                    </Link>

                </div>
            </div>
        </main>
    );
}