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
                        Monitor Investimenti
                    </h1>
                    <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                        La tua centrale operativa per tracciare transazioni, analizzare il portafoglio e monitorare i titoli. Tutto in un unico posto.
                    </p>
                </div>
            </div>

            {/* GRID DI NAVIGAZIONE */}
            <div className="max-w-6xl mx-auto px-8 py-16">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* CARD 1: TRANSAZIONI */}
                    <Link href="/transactions" className="group">
                        <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 transform hover:-translate-y-1 h-full flex flex-col justify-between">
                            <div>
                                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <List size={24} />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-800 mb-3">Transazioni</h3>
                                <p className="text-slate-500 leading-relaxed">
                                    Consulta lo storico completo delle tue operazioni. Filtra per data, ticker o tipo e analizza i costi.
                                </p>
                            </div>
                            <div className="mt-8 flex items-center text-blue-600 font-semibold group-hover:translate-x-2 transition-transform">
                                Vai alle Transazioni <ArrowRight size={18} className="ml-2" />
                            </div>
                        </div>
                    </Link>

                    {/* CARD 2: PORTFOLIO VALUATION */}
                    <Link href="/portfolio_valuation" className="group">
                        <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 transform hover:-translate-y-1 h-full flex flex-col justify-between">
                            <div>
                                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                    <PieChart size={24} />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-800 mb-3">Valutazione Portafoglio</h3>
                                <p className="text-slate-500 leading-relaxed">
                                    Visualizza l'andamento del tuo patrimonio, l'asset allocation e le performance aggregate.
                                </p>
                            </div>
                            <div className="mt-8 flex items-center text-emerald-600 font-semibold group-hover:translate-x-2 transition-transform">
                                Analizza Portafoglio <ArrowRight size={18} className="ml-2" />
                            </div>
                        </div>
                    </Link>

                    {/* CARD 3: SECURITIES INFO */}
                    <Link href="/securities_info" className="group">
                        <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 transform hover:-translate-y-1 h-full flex flex-col justify-between">
                            <div>
                                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 mb-6 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                    <Info size={24} />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-800 mb-3">Info Titoli</h3>
                                <p className="text-slate-500 leading-relaxed">
                                    Dettagli tecnici, dividendi e informazioni fondamentali sui titoli che segui o possiedi.
                                </p>
                            </div>
                            <div className="mt-8 flex items-center text-purple-600 font-semibold group-hover:translate-x-2 transition-transform">
                                Schede Titoli <ArrowRight size={18} className="ml-2" />
                            </div>
                        </div>
                    </Link>

                </div>
            </div>
        </main>
    );
}