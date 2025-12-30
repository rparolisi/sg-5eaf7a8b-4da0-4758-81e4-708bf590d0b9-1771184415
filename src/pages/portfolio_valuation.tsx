import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle, Wallet, Loader2 } from 'lucide-react';
import { useRouter } from 'next/router';
import Link from 'next/link';

// --- CONFIGURAZIONE ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// !!! SOSTITUISCI CON IL TUO URL RENDER REALE !!!
const PYTHON_API_BASE_URL = "https://invest-monitor-api.onrender.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Interfaccia dei dati che arrivano dal backend Python
interface PortfolioItem {
    ticker: string;
    y_ticker: string;
    quantity: number;
    avg_price: number;
    avg_date: string | null;
    total_exposure: number;
    current_price: number;
    profit_loss: number;
    performance_perc: number;
}

export default function PortfolioValuation() {
    const [data, setData] = useState < PortfolioItem[] > ([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const router = useRouter();

    useEffect(() => {
        fetchPortfolio();
    }, []);

    const fetchPortfolio = async () => {
        setLoading(true);
        setError("");
        try {
            // 1. Verifica utente loggato
            const { data: { user } } = await supabase.auth.getUser();

            // Se vuoi, puoi decommentare per forzare il login
            // if (!user) { router.push('/login'); return; }

            const userId = user ? user.id : "anon";

            // 2. Chiama il Backend Python
            const response = await fetch(`${PYTHON_API_BASE_URL}/api/portfolio?user_id=${userId}`);

            if (!response.ok) {
                throw new Error(`Errore Server: ${response.statusText}`);
            }

            const result = await response.json();

            // Ordina per Esposizione decrescente
            const sortedData = Array.isArray(result)
                ? result.sort((a: PortfolioItem, b: PortfolioItem) => b.total_exposure - a.total_exposure)
                : [];

            setData(sortedData);

        } catch (err: any) {
            console.error(err);
            setError("Impossibile contattare il server di analisi. Verifica che il backend Python su Render sia attivo.");
        } finally {
            setLoading(false);
        }
    };

    // Helper formattazione
    const fmt = (num: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(num);
    const fmtPerc = (num: number) => `${num > 0 ? '+' : ''}${num.toFixed(2)}%`;

    // Calcolo Totali KPI
    const totalPortfolioValue = data.reduce((sum, item) => sum + (item.current_price * item.quantity), 0);
    const totalPnL = data.reduce((sum, item) => sum + item.profit_loss, 0);

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-6 pb-20">
            <div className="max-w-7xl mx-auto">

                {/* --- HEADER SECTION --- */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <Wallet className="text-blue-600" /> Portfolio Valuation
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Analisi live delle posizioni aperte (prezzi Yahoo Finance)
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* KPI BOX: Valore Totale */}
                        <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm text-right min-w-[140px]">
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Value</p>
                            <p className="text-lg font-bold text-slate-800">{fmt(totalPortfolioValue)}</p>
                        </div>

                        {/* KPI BOX: Profit/Loss Totale */}
                        <div className={`bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm text-right min-w-[140px] border-l-4 ${totalPnL >= 0 ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total P&L</p>
                            <p className={`text-lg font-bold ${totalPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {totalPnL > 0 ? '+' : ''}{fmt(totalPnL)}
                            </p>
                        </div>

                        {/* Tasto Refresh */}
                        <button
                            onClick={fetchPortfolio}
                            disabled={loading}
                            className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                            title="Aggiorna Dati"
                        >
                            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>

                {/* --- ERROR MESSAGE --- */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                        <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-bold">Errore di connessione</p>
                            <p className="text-sm">{error}</p>
                            <p className="text-xs mt-2 text-red-500">Nota: Su Render Free Tier, il server va in pausa dopo 15 min. Attendi un minuto e riprova.</p>
                        </div>
                    </div>
                )}

                {/* --- DATA TABLE --- */}
                <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden relative min-h-[300px]">

                    {/* Loading Overlay */}
                    {loading && (
                        <div className="absolute inset-0 bg-white/90 z-20 flex flex-col items-center justify-center text-slate-500 backdrop-blur-sm">
                            <Loader2 size={40} className="animate-spin text-blue-600 mb-3" />
                            <p className="font-medium">Calcolo ponderato e recupero prezzi live...</p>
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4">Ticker</th>
                                    <th className="px-6 py-4 text-right">Qty</th>
                                    <th className="px-6 py-4 text-right">Avg Price</th>
                                    <th className="px-6 py-4 text-right">Mkt Price</th>
                                    <th className="px-6 py-4 text-right">Exposure</th>
                                    <th className="px-6 py-4 text-right">Mkt Value</th>
                                    <th className="px-6 py-4 text-center">Avg Date</th>
                                    <th className="px-6 py-4 text-right">P/L (€)</th>
                                    <th className="px-6 py-4 text-right">Return %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {!loading && data.length === 0 && !error ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-16 text-center text-slate-400">
                                            <div className="flex flex-col items-center justify-center">
                                                <Wallet size={48} className="mb-4 opacity-20" />
                                                <p className="text-lg font-medium text-slate-500">Nessuna posizione aperta trovata.</p>
                                                <p className="text-sm mb-6">Inizia aggiungendo le tue transazioni.</p>
                                                <Link href="/transactions?add=true" className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition font-medium">
                                                    Aggiungi Transazione
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    data.map((item) => {
                                        const isProfitable = item.profit_loss >= 0;
                                        const marketValue = item.current_price * item.quantity;

                                        return (
                                            <tr key={item.ticker} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-800 text-base">{item.ticker}</div>
                                                    {/* Mostra il ticker Yahoo se diverso da quello interno */}
                                                    {item.ticker !== item.y_ticker && (
                                                        <div className="text-[10px] text-slate-400 bg-slate-100 inline-block px-1 rounded mt-1" title="Ticker utilizzato su Yahoo Finance">
                                                            {item.y_ticker}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right text-slate-600 font-medium">{item.quantity}</td>
                                                <td className="px-6 py-4 text-right text-slate-500">{fmt(item.avg_price)}</td>
                                                <td className="px-6 py-4 text-right font-bold text-slate-700">{fmt(item.current_price)}</td>
                                                <td className="px-6 py-4 text-right text-slate-500">{fmt(item.total_exposure)}</td>
                                                <td className="px-6 py-4 text-right font-medium text-slate-800">{fmt(marketValue)}</td>
                                                <td className="px-6 py-4 text-center text-slate-400 text-xs">
                                                    {item.avg_date ? new Date(item.avg_date).toLocaleDateString() : '-'}
                                                </td>
                                                <td className={`px-6 py-4 text-right font-bold ${isProfitable ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {fmt(item.profit_loss)}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${isProfitable ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                        {isProfitable ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                                        {fmtPerc(item.performance_perc)}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}