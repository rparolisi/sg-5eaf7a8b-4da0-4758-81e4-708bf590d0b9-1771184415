import { useRouter } from 'next/router';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
    ArrowLeft, BarChart3, Settings, Filter, RefreshCw, XCircle, ChevronDown, Check, Search, Calendar,
    TrendingUp, Activity, DollarSign, PieChart, Download, Image as ImageIcon, FileText, FileSpreadsheet, Clock,
    Loader2
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, ComposedChart
} from 'recharts';
import * as htmlToImage from 'html-to-image';
import * as XLSX from 'xlsx';

// --- CONFIGURAZIONE ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const PYTHON_API_BASE_URL = "https://invest-monitor-api.onrender.com"; // Assicurati che sia corretto

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const COLORS = {
    exposure: "#64748b",    // Slate-500 (Grigio scuro)
    marketValue: "#2563eb", // Blue-600
    pl: "#16a34a",          // Green-600
    dividends: "#d97706"    // Amber-600 (Giallo/Arancio)
};

// --- COMPONENTI UI (MultiSelect) ---
const MultiSelect = ({ label, options, selected, onChange }: { label: string, options: string[], selected: string[], onChange: (val: string[]) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const dropdownRef = useRef < HTMLDivElement > (null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm("");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleOption = (option: string) => {
        onChange(selected.includes(option) ? selected.filter(i => i !== option) : [...selected, option]);
    };

    const filtered = options.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="relative" ref={dropdownRef}>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{label}</label>
            <button onClick={() => setIsOpen(!isOpen)} className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 flex justify-between items-center outline-none focus:ring-2 focus:ring-blue-500 hover:bg-white transition-colors">
                <span className="truncate">{selected.length === 0 ? `All ${label}s` : `${selected.length} selected`}</span>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col max-h-60">
                    <div className="p-2 border-b border-slate-100 bg-white sticky top-0"><div className="relative"><Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" /><input type="text" autoFocus className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md outline-none bg-slate-50" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div></div>
                    <div className="overflow-y-auto flex-1 custom-scrollbar">
                        {filtered.length > 0 ? filtered.map(o => (
                            <div key={o} onClick={() => toggleOption(o)} className="px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-blue-50 text-sm text-slate-700">
                                <div className={`w-4 h-4 border rounded flex items-center justify-center flex-shrink-0 ${selected.includes(o) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>{selected.includes(o) && <Check size={12} className="text-white" />}</div><span className="truncate">{o}</span>
                            </div>
                        )) : <div className="px-4 py-3 text-xs text-slate-400 italic text-center">No results</div>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function PortfolioPlotPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [calculating, setCalculating] = useState(false);
    const [transactions, setTransactions] = useState < any[] > ([]);

    // Configurazione Visualizzazione
    const [visibleSeries, setVisibleSeries] = useState({
        exposure: true,
        marketValue: true,
        pl: true,
        dividends: false
    });

    // Filtri
    const [filters, setFilters] = useState < { person: string[], ticker: string[], category: string[], startDate: string, endDate: string } > ({
        person: [], ticker: [], category: [], startDate: '', endDate: ''
    });

    const [chartData, setChartData] = useState < any[] > ([]);
    const chartContainerRef = useRef < HTMLDivElement > (null);
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);
    const downloadMenuRef = useRef < HTMLDivElement > (null);

    // 1. Fetch Iniziale Transazioni
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const { data } = await supabase.from('transactions').select('*').order('operation_date');
            if (data) {
                setTransactions(data);
                // Imposta date default
                const dates = data.map(t => new Date(t.operation_date).getTime());
                if (dates.length) {
                    const min = new Date(Math.min(...dates)).toISOString().split('T')[0];
                    const today = new Date().toISOString().split('T')[0];
                    setFilters(prev => ({ ...prev, startDate: min, endDate: today }));
                }

                // Imposta Person di default se loggato
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: userProfile } = await supabase.from('users').select('alias').eq('user_id', user.id).maybeSingle();
                    if (userProfile?.alias) setFilters(prev => ({ ...prev, person: [userProfile.alias] }));
                }
            }
            setLoading(false);
        };
        loadData();
    }, []);

    // 2. Opzioni per i filtri
    const options = useMemo(() => {
        const getU = (k: string) => Array.from(new Set(transactions.map(t => t[k]).filter(Boolean))).sort();
        return { people: getU('person'), tickers: getU('ticker'), categories: getU('category') };
    }, [transactions]);

    // 3. Calcolo e Fetch Dati Storici
    const handlePlot = async () => {
        setCalculating(true);
        try {
            // A. Filtra transazioni localmente
            const filteredTxs = transactions.filter(t => {
                if (filters.person.length && !filters.person.includes(t.person)) return false;
                if (filters.ticker.length && !filters.ticker.includes(t.ticker)) return false;
                if (filters.category.length && !filters.category.includes(t.category)) return false;
                return true;
            });

            if (filteredTxs.length === 0) {
                setChartData([]); setCalculating(false); return;
            }

            // B. Identifica Ticker unici nel filtro
            const uniqueTickers = Array.from(new Set(filteredTxs.map(t => t.ticker)));

            // C. Richiedi storico prezzi/divs a Python
            const pyRes = await fetch(`${PYTHON_API_BASE_URL}/api/market_history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tickers: uniqueTickers,
                    start_date: filters.startDate,
                    end_date: filters.endDate
                })
            });

            const marketHistory = await pyRes.json();

            // D. Time Travel Loop
            const startMs = new Date(filters.startDate).getTime();
            const endMs = new Date(filters.endDate).getTime();
            const oneDay = 86400000;

            const txByDate: Record<string, any[]> = {};
            filteredTxs.forEach(t => {
                const d = new Date(t.operation_date).toISOString().split('T')[0];
                if (!txByDate[d]) txByDate[d] = [];
                txByDate[d].push(t);
            });

            // Stato Portfolio per ogni ticker: { qty, cost }
            const state: Record<string, { qty: number, cost: number }> = {};

            // Pre-processamento (Transazioni prima della start_date)
            filteredTxs.forEach(t => {
                if (new Date(t.operation_date).getTime() < startMs) {
                    const tk = t.ticker;
                    if (!state[tk]) state[tk] = { qty: 0, cost: 0 };

                    const qty = Number(t.shares_count);
                    const price = Number(t.price_per_share_eur);
                    const outlay = t.total_outlay_eur !== null ? Number(t.total_outlay_eur) : (price * qty);

                    if (Number(t.buy_or_sell) === 1) {
                        if (Number(t.operation_sign) === 1) { // Buy
                            state[tk].qty += qty;
                            state[tk].cost += outlay;
                        } else { // Sell
                            const avg = state[tk].qty > 0 ? state[tk].cost / state[tk].qty : 0;
                            state[tk].qty -= qty;
                            state[tk].cost -= (qty * avg);
                        }
                    }
                }
            });

            const timeSeries = [];
            let cumulativeDividends = 0; // Accumula nel tempo

            for (let t = startMs; t <= endMs; t += oneDay) {
                const dateIso = new Date(t).toISOString().split('T')[0];
                const displayDate = new Date(t).toLocaleDateString();

                // 1. Applica transazioni del giorno
                if (txByDate[dateIso]) {
                    txByDate[dateIso].forEach(tx => {
                        const tk = tx.ticker;
                        if (!state[tk]) state[tk] = { qty: 0, cost: 0 };
                        const qty = Number(tx.shares_count);
                        const price = Number(tx.price_per_share_eur);
                        const outlay = tx.total_outlay_eur !== null ? Number(tx.total_outlay_eur) : (price * qty);

                        if (Number(tx.buy_or_sell) === 1) {
                            if (Number(tx.operation_sign) === 1) {
                                state[tk].qty += qty;
                                state[tk].cost += outlay;
                            } else {
                                const avg = state[tk].qty > 0 ? state[tk].cost / state[tk].qty : 0;
                                state[tk].qty -= qty;
                                state[tk].cost -= (qty * avg);
                            }
                        }
                    });
                }

                // 2. Calcola valori del giorno
                let dayExposure = 0;
                let dayMarketValue = 0;

                Object.keys(state).forEach(tk => {
                    const pos = state[tk];
                    if (pos.qty < 0.001) return; // Posizione chiusa

                    dayExposure += pos.cost;

                    let closePrice = 0;
                    let divAmount = 0;

                    // Lookup storico da Python
                    if (marketHistory[tk] && marketHistory[tk][dateIso]) {
                        closePrice = marketHistory[tk][dateIso]['Close'] || 0;
                        divAmount = marketHistory[tk][dateIso]['Dividends'] || 0;
                    } else {
                        // Se manca il prezzo (es. weekend), idealmente dovremmo avere un ffill da Python.
                        // Se ancora zero, usiamo cost/qty come fallback (P/L = 0)
                        closePrice = pos.qty > 0 ? pos.cost / pos.qty : 0;
                    }

                    dayMarketValue += (pos.qty * closePrice);

                    if (divAmount > 0) {
                        cumulativeDividends += (pos.qty * divAmount);
                    }
                });

                timeSeries.push({
                    date: displayDate,
                    rawDate: t,
                    exposure: dayExposure,
                    marketValue: dayMarketValue,
                    pl: dayMarketValue - dayExposure,
                    dividends: cumulativeDividends
                });
            }

            setChartData(timeSeries);

        } catch (e) {
            console.error(e);
            alert("Errore nel calcolo del grafico");
        } finally {
            setCalculating(false);
        }
    };

    // --- Export Functions ---
    const exportImage = async () => {
        if (chartContainerRef.current) {
            const dataUrl = await htmlToImage.toPng(chartContainerRef.current, { backgroundColor: 'white', pixelRatio: 2 });
            const link = document.createElement('a');
            link.download = 'portfolio_history.png';
            link.href = dataUrl;
            link.click();
        }
    };

    const exportData = (format: 'csv' | 'xlsx') => {
        if (!chartData.length) return;
        const filename = `portfolio_history_${new Date().toISOString().split('T')[0]}`;
        const ws = XLSX.utils.json_to_sheet(chartData.map(d => ({
            Date: d.date,
            Exposure: d.exposure,
            MarketValue: d.marketValue,
            ProfitLoss: d.pl,
            Dividends: d.dividends
        })));

        if (format === 'csv') {
            const csv = XLSX.utils.sheet_to_csv(ws);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url; link.download = `${filename}.csv`; link.click();
        } else {
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "History");
            XLSX.writeFile(wb, `${filename}.xlsx`);
        }
        setIsDownloadOpen(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-10">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ArrowLeft size={20} /></button>
                        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2"><BarChart3 className="text-purple-600" /> Historical Analysis</h1>
                    </div>
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6 p-6">

                {/* --- FILTRI (Sinistra) --- */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2 mb-4 font-semibold border-b pb-2"><Filter size={18} /> Filters</div>
                        <div className="space-y-4">
                            <MultiSelect label="Person" options={options.people} selected={filters.person} onChange={v => setFilters({ ...filters, person: v })} />
                            <MultiSelect label="Ticker" options={options.tickers} selected={filters.ticker} onChange={v => setFilters({ ...filters, ticker: v })} />
                            <MultiSelect label="Category" options={options.categories} selected={filters.category} onChange={v => setFilters({ ...filters, category: v })} />

                            <div className="pt-2 border-t">
                                <label className="block text-xs font-bold text-slate-500 mb-2">Date Range</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="date" className="w-full p-2 border rounded text-xs" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} />
                                    <input type="date" className="w-full p-2 border rounded text-xs" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} />
                                </div>
                            </div>

                            <button onClick={handlePlot} disabled={calculating} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md flex justify-center items-center gap-2">
                                {calculating ? <Loader2 className="animate-spin" /> : <TrendingUp />} Plot
                            </button>
                        </div>
                    </div>
                </div>

                {/* --- GRAFICO (Centro) --- */}
                <div className="lg:col-span-3">
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 min-h-[600px] flex flex-col relative">
                        <div ref={chartContainerRef} className="w-full h-[550px] bg-white">
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={30} />
                                        <YAxis tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(v: number) => v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })} />
                                        <Legend />

                                        {visibleSeries.exposure && <Area type="monotone" dataKey="exposure" name="Exposure (Cost)" stroke={COLORS.exposure} fill={COLORS.exposure} fillOpacity={0.1} strokeWidth={2} />}
                                        {visibleSeries.marketValue && <Line type="monotone" dataKey="marketValue" name="Market Value" stroke={COLORS.marketValue} strokeWidth={3} dot={false} />}
                                        {visibleSeries.pl && <Line type="monotone" dataKey="pl" name="Profit/Loss" stroke={COLORS.pl} strokeWidth={2} dot={false} />}
                                        {visibleSeries.dividends && <Line type="step" dataKey="dividends" name="Cumul. Dividends" stroke={COLORS.dividends} strokeWidth={2} dot={false} />}

                                    </ComposedChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-400">
                                    <BarChart3 size={64} className="opacity-20 mb-4" />
                                    <p>Select filters and click "Plot" to start.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- CONFIGURAZIONE (Destra) --- */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2 mb-4 font-semibold border-b pb-2"><Settings size={18} /> Visible Metrics</div>
                        <div className="space-y-3">
                            {Object.keys(visibleSeries).map(k => (
                                <label key={k} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded">
                                    <input type="checkbox" checked={visibleSeries[k as keyof typeof visibleSeries]} onChange={() => setVisibleSeries({ ...visibleSeries, [k]: !visibleSeries[k as keyof typeof visibleSeries] })} className="rounded text-blue-600 focus:ring-blue-500" />
                                    <span className="capitalize text-sm font-medium text-slate-700">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2 mb-4 font-semibold border-b pb-2"><Download size={18} /> Export</div>
                        <div className="relative" ref={downloadMenuRef}>
                            <button onClick={() => setIsDownloadOpen(!isDownloadOpen)} className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700">
                                <Download size={16} /> Download...
                            </button>
                            {isDownloadOpen && (
                                <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 p-2">
                                    <button onClick={exportImage} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-lg text-sm text-slate-700"><ImageIcon size={16} className="text-blue-500" /> PNG Image</button>
                                    <button onClick={() => exportData('csv')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-lg text-sm text-slate-700"><FileText size={16} className="text-green-500" /> CSV Data</button>
                                    <button onClick={() => exportData('xlsx')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-lg text-sm text-slate-700"><FileSpreadsheet size={16} className="text-emerald-600" /> XLSX Data</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}