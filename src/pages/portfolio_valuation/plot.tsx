import { useRouter } from 'next/router';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
    ArrowLeft, BarChart3, Settings, Filter, ChevronDown, Check, Search,
    TrendingUp, Download, Image as ImageIcon, FileText, FileSpreadsheet, Loader2
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, ComposedChart, ReferenceLine
} from 'recharts';
import * as htmlToImage from 'html-to-image';
import * as XLSX from 'xlsx';

// --- CONFIGURAZIONE ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const PYTHON_API_BASE_URL = "https://invest-monitor-api.onrender.com"; // VERIFICA IL TUO URL

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const COLORS = {
    exposure: "#94a3b8",    // Slate-400 (Linea Esposizione)
    grossValue: "#8b5cf6",  // Violet-500 (Nuova linea Gross Value)
    marketValue: "#3b82f6", // Blue-500 (Linea Valore Mercato - Tratteggiata)
    dividends: "#f59e0b",   // Amber-500 (Dividendi - Tratteggiata)
    plAreaPos: "#22c55e",   // Green-500 (Area Profitto)
    plAreaNeg: "#ef4444"    // Red-500 (Area Perdita)
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
                            <div key={o} onClick={() => toggleOption(o)} className="px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-blue-50 text-sm text-slate-700 hover:text-blue-600 transition-colors">
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
    // DEFAULT: Gross Value e Exposure attivi. P&L (Area), Market Value e Dividends spenti.
    const [visibleSeries, setVisibleSeries] = useState({
        grossValue: true,
        exposure: true,
        plArea: false, // Area Profit/Loss
        marketValue: false,
        dividends: false
    });

    // Filtri (Rimosso category)
    const [filters, setFilters] = useState < { person: string[], ticker: string[], startDate: string, endDate: string } > ({
        person: [], ticker: [], startDate: '', endDate: ''
    });

    const [chartData, setChartData] = useState < any[] > ([]);
    const chartContainerRef = useRef < HTMLDivElement > (null);
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);
    const downloadMenuRef = useRef < HTMLDivElement > (null);

    // 1. Fetch Iniziale Transazioni
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // FIX: Aggiunto .limit(10000) per evitare che Supabase tagli i dati a 1000 righe
                const { data } = await supabase
                    .from('transactions')
                    .select('transaction_id, operation_date, ticker, person, category')
                    .order('operation_date')
                    .limit(10000);

                if (data) {
                    setTransactions(data);
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
            } catch (e) {
                console.error("Error loading initial data", e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // 2. Opzioni per i filtri (Uniche)
    const options = useMemo(() => {
        const getU = (k: string) => Array.from(new Set(transactions.map(t => t[k]).filter(Boolean))).sort();
        return {
            people: getU('person'),
            tickers: getU('ticker')
        };
    }, [transactions]);

    // 3. Calcolo e Fetch Dati Storici (CHIAMATA AL BACKEND)
    const handlePlot = async () => {
        setCalculating(true);
        try {
            // A. Filtra transazioni localmente
            const filteredTxs = transactions.filter(t => {
                if (filters.person.length && !filters.person.includes(t.person)) return false;
                if (filters.ticker.length && !filters.ticker.includes(t.ticker)) return false;
                return true;
            });

            if (filteredTxs.length === 0) {
                setChartData([]);
                setCalculating(false);
                alert("Nessuna transazione trovata con questi filtri.");
                return;
            }

            // B. Identifica Ticker unici nel filtro
            const uniqueTickers = Array.from(new Set(filteredTxs.map(t => t.ticker)));

            // C. Richiedi storico completo a Python
            console.log("Calling Python API for Portfolio History...");

            const pyRes = await fetch(`${PYTHON_API_BASE_URL}/api/portfolio_history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tickers: uniqueTickers,
                    people: filters.person.length > 0 ? filters.person : null,
                    // NON inviamo categories, così il backend usa il default (tutte)
                    start_date: filters.startDate,
                    end_date: filters.endDate
                })
            });

            if (!pyRes.ok) throw new Error("Errore API Python");

            const historyData = await pyRes.json();

            // Arricchimento Dati: Calcolo Gross Value se non presente o derivato
            // Gross Value = Market Value + Accumulated Dividends
            const enrichedData = historyData.map((d: any) => ({
                ...d,
                gross_value: d.market_value + (d.dividends || 0)
            }));

            console.log("Received & Enriched Data:", enrichedData);
            setChartData(enrichedData);

        } catch (e) {
            console.error(e);
            alert("Errore nel calcolo del grafico. Verifica che il server Python sia attivo.");
        } finally {
            setCalculating(false);
        }
    };

    // --- Export Functions ---
    const exportImage = async () => {
        if (chartContainerRef.current) {
            try {
                const dataUrl = await htmlToImage.toPng(chartContainerRef.current, { backgroundColor: 'white', pixelRatio: 2 });
                const link = document.createElement('a');
                link.download = `portfolio_history_${new Date().toISOString().split('T')[0]}.png`;
                link.href = dataUrl;
                link.click();
                setIsDownloadOpen(false);
            } catch (error) {
                console.error('oops, something went wrong!', error);
            }
        }
    };

    const exportData = (format: 'csv' | 'xlsx') => {
        if (!chartData.length) return;
        const filename = `portfolio_history_${new Date().toISOString().split('T')[0]}`;

        // Formatta i dati per l'export
        const exportSet = chartData.map(d => ({
            Date: d.date,
            "Gross Value (€)": d.gross_value,
            "Total Exposure (€)": d.exposure,
            "Market Value (€)": d.market_value,
            "Profit/Loss (€)": d.profit_loss,
            "Accumulated Dividends (€)": d.dividends
        }));

        const ws = XLSX.utils.json_to_sheet(exportSet);

        if (format === 'csv') {
            const csv = XLSX.utils.sheet_to_csv(ws);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url; link.download = `${filename}.csv`; link.click();
        } else {
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Portfolio History");
            XLSX.writeFile(wb, `${filename}.xlsx`);
        }
        setIsDownloadOpen(false);
    };

    // Gestione chiusura menu download
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
                setIsDownloadOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Helper per gradiente P&L (Verde/Rosso)
    const gradientOffset = () => {
        const dataMax = Math.max(...chartData.map((i) => i.profit_loss));
        const dataMin = Math.min(...chartData.map((i) => i.profit_loss));

        if (dataMax <= 0) return 0;
        if (dataMin >= 0) return 1;

        return dataMax / (dataMax - dataMin);
    };

    const off = gradientOffset();

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-10">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <BarChart3 className="text-purple-600" /> Historical Analysis
                        </h1>
                    </div>
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6 p-6">

                {/* --- FILTRI (Sinistra) --- */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2 mb-4 font-semibold border-b pb-2 text-slate-700">
                            <Filter size={18} /> Filters
                        </div>
                        <div className="space-y-4">
                            <MultiSelect label="Person" options={options.people} selected={filters.person} onChange={v => setFilters({ ...filters, person: v })} />
                            <MultiSelect label="Ticker" options={options.tickers} selected={filters.ticker} onChange={v => setFilters({ ...filters, ticker: v })} />

                            <div className="pt-2 border-t border-slate-100">
                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Date Range</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="date" className="w-full p-2 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} />
                                    <input type="date" className="w-full p-2 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} />
                                </div>
                            </div>

                            <button
                                onClick={handlePlot}
                                disabled={calculating || loading}
                                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md flex justify-center items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {calculating ? <Loader2 className="animate-spin" size={18} /> : <TrendingUp size={18} />}
                                {calculating ? "Calculating..." : "Plot History"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* --- GRAFICO (Centro) --- */}
                <div className="lg:col-span-3">
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 min-h-[600px] flex flex-col relative">
                        <div ref={chartContainerRef} className="w-full h-[550px] bg-white p-2">
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                        <defs>
                                            <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset={off} stopColor={COLORS.plAreaPos} stopOpacity={0.3} />
                                                <stop offset={off} stopColor={COLORS.plAreaNeg} stopOpacity={0.3} />
                                            </linearGradient>
                                        </defs>

                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 11, fill: '#64748b' }}
                                            minTickGap={30}
                                            axisLine={{ stroke: '#e2e8f0' }}
                                            tickLine={false}
                                        />
                                        <YAxis
                                            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                                            tick={{ fontSize: 11, fill: '#64748b' }}
                                            axisLine={{ stroke: '#e2e8f0' }}
                                            tickLine={false}
                                        />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', padding: '12px' }}
                                            formatter={(v: number, name: string) => [
                                                v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }),
                                                name
                                            ]}
                                            labelStyle={{ color: '#1e293b', fontWeight: 'bold', marginBottom: '8px' }}
                                        />
                                        <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                                        <ReferenceLine y={0} stroke="#cbd5e1" />

                                        {/* PROFIT/LOSS AREA (Differenza tra Gross ed Exposure) */}
                                        {/* Viene renderizzata prima così sta sotto le linee */}
                                        {visibleSeries.plArea && (
                                            <Area
                                                type="monotone"
                                                dataKey="profit_loss"
                                                name="Profit/Loss Area"
                                                stroke="none"
                                                fill="url(#splitColor)"
                                                activeDot={false}
                                            />
                                        )}

                                        {/* EXPOSURE (Linea Solida Grigia) */}
                                        {visibleSeries.exposure && (
                                            <Line
                                                type="monotone"
                                                dataKey="exposure"
                                                name="Exposure (Cost)"
                                                stroke={COLORS.exposure}
                                                strokeWidth={2}
                                                dot={false}
                                                activeDot={{ r: 6 }}
                                            />
                                        )}

                                        {/* GROSS VALUE (Nuova Linea Solida Viola) */}
                                        {visibleSeries.grossValue && (
                                            <Line
                                                type="monotone"
                                                dataKey="gross_value"
                                                name="Gross Value"
                                                stroke={COLORS.grossValue}
                                                strokeWidth={3}
                                                dot={false}
                                                activeDot={{ r: 6 }}
                                            />
                                        )}

                                        {/* MARKET VALUE (Linea Blu Tratteggiata) */}
                                        {visibleSeries.marketValue && (
                                            <Line
                                                type="monotone"
                                                dataKey="market_value"
                                                name="Market Value"
                                                stroke={COLORS.marketValue}
                                                strokeWidth={2}
                                                strokeDasharray="5 5"
                                                dot={false}
                                                activeDot={{ r: 6 }}
                                            />
                                        )}

                                        {/* DIVIDENDS (Linea Arancione Tratteggiata a scalini) */}
                                        {visibleSeries.dividends && (
                                            <Line
                                                type="step"
                                                dataKey="dividends"
                                                name="Cumul. Dividends"
                                                stroke={COLORS.dividends}
                                                strokeWidth={2}
                                                strokeDasharray="5 5"
                                                dot={false}
                                                activeDot={{ r: 6 }}
                                            />
                                        )}

                                    </ComposedChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <BarChart3 size={64} className="opacity-20 mb-4" />
                                    <p className="font-medium text-lg">Ready to analyze</p>
                                    <p className="text-sm">Select filters on the left and click "Plot History" to start.</p>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Stats Footer */}
                    {chartData.length > 0 && (
                        <div className="flex justify-between text-xs text-slate-400 px-2 mt-2">
                            <span>{chartData.length} daily points calculated</span>
                            <span>Source: Yahoo Finance & Internal DB</span>
                        </div>
                    )}
                </div>

                {/* --- CONFIGURAZIONE (Destra) --- */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2 mb-4 font-semibold border-b pb-2 text-slate-700">
                            <Settings size={18} /> Visible Metrics
                        </div>
                        <div className="space-y-3">
                            {Object.keys(visibleSeries).map(k => (
                                <label key={k} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-50 rounded transition-colors group">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={visibleSeries[k as keyof typeof visibleSeries]}
                                            onChange={() => setVisibleSeries({ ...visibleSeries, [k]: !visibleSeries[k as keyof typeof visibleSeries] })}
                                            className="peer h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                    </div>
                                    <span className="capitalize text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">
                                        {k.replace(/([A-Z])/g, ' $1').replace('plArea', 'P&L Area').trim()}
                                    </span>
                                    {/* Pallino colore legenda */}
                                    <div className="ml-auto w-2 h-2 rounded-full" style={{
                                        backgroundColor: k === 'plArea' ? COLORS.plAreaPos : COLORS[k as keyof typeof COLORS]
                                    }}></div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2 mb-4 font-semibold border-b pb-2 text-slate-700">
                            <Download size={18} /> Export
                        </div>
                        <div className="relative" ref={downloadMenuRef}>
                            <button onClick={() => setIsDownloadOpen(!isDownloadOpen)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors">
                                <Download size={16} /> Download Options...
                            </button>
                            {isDownloadOpen && (
                                <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 p-2 animate-in fade-in slide-in-from-top-2">
                                    <button onClick={exportImage} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-lg text-sm text-slate-700 transition-colors">
                                        <ImageIcon size={16} className="text-blue-500" /> Download PNG Image
                                    </button>
                                    <div className="h-px bg-slate-100 my-1"></div>
                                    <button onClick={() => exportData('csv')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-lg text-sm text-slate-700 transition-colors">
                                        <FileText size={16} className="text-green-500" /> Export Data (CSV)
                                    </button>
                                    <button onClick={() => exportData('xlsx')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-lg text-sm text-slate-700 transition-colors">
                                        <FileSpreadsheet size={16} className="text-emerald-600" /> Export Data (XLSX)
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}