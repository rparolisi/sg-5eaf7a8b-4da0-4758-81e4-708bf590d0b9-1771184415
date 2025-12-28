import { useRouter } from 'next/router';
import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
    ArrowLeft, BarChart3, Settings, Filter, RefreshCw, XCircle
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// --- CONFIGURAZIONE SUPABASE ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
// Istanza unica del client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- PALETTE COLORI ---
const COLORS = [
    "#2563eb", "#dc2626", "#16a34a", "#d97706", "#9333ea",
    "#0891b2", "#db2777", "#4b5563", "#84cc16", "#7c3aed"
];

// --- DEFINIZIONE COLONNE ---
const COLUMNS = [
    { key: 'operation_date', label: 'Date', type: 'date' },
    { key: 'ticker', label: 'Ticker', type: 'text' },
    { key: 'person', label: 'Person', type: 'text' },
    { key: 'sector', label: 'Sector', type: 'text' },
    { key: 'total_outlay_eur', label: 'Total Amount (€)', type: 'number' },
    { key: 'purchase_price_per_share_eur', label: 'Price per Share (€)', type: 'number' },
    { key: 'shares_count', label: 'Shares Count', type: 'number' },
    { key: 'cumulative_shares_count', label: 'Cumul. Shares', type: 'number' },
    { key: 'average_price', label: 'Avg Price', type: 'number' },
    { key: 'effective_average_price', label: 'Eff. Avg Price', type: 'number' }
];

export default function PlotPage() {
    const router = useRouter();
    // RIMOSSO: const [supabase, setSupabase] = useState<any>(null);  <-- CAUSA DELL'ERRORE

    const [loading, setLoading] = useState(true);
    const [rawData, setRawData] = useState < any[] > ([]);

    // --- STATO CONFIGURAZIONE GRAFICO ---
    const [config, setConfig] = useState({
        x: 'operation_date',
        y: 'total_outlay_eur',
        groupBy: 'ticker'
    });

    // --- STATO FILTRI ---
    const [filters, setFilters] = useState({
        person: '',
        ticker: '',
        sector: ''
    });

    // 1. FETCH DATA DA SUPABASE
    const fetchData = async () => {
        setLoading(true);
        try {
            // Usa la variabile 'supabase' globale definita a riga 14
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .order('operation_date', { ascending: true });

            if (error) throw error;
            setRawData(data || []);
        } catch (err: any) {
            console.error("Errore fetch:", err);
            // alert("Errore caricamento dati: " + err.message); // Commentato per evitare popup fastidiosi in dev
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // 2. ESTRAZIONE VALORI UNICI PER I FILTRI
    const uniqueValues = useMemo(() => {
        const getUnique = (key: string) => Array.from(new Set(rawData.map(item => item[key]).filter(Boolean))).sort();
        return {
            people: getUnique('person'),
            tickers: getUnique('ticker'),
            sectors: getUnique('sector')
        };
    }, [rawData]);

    // 3. ELABORAZIONE DATI (Filter -> Group -> Format)
    const { chartData, lines } = useMemo(() => {
        if (!rawData.length) return { chartData: [], lines: [] };

        // A. FILTRAGGIO
        let filtered = rawData.filter(item => {
            if (filters.person && item.person !== filters.person) return false;
            if (filters.ticker && item.ticker !== filters.ticker) return false;
            if (filters.sector && item.sector !== filters.sector) return false;
            return true;
        });

        // B. RAGGRUPPAMENTO E FORMATTAZIONE
        if (!config.groupBy) {
            const data = filtered.map(t => ({
                xAxis: t[config.x],
                displayX: new Date(t[config.x]).toLocaleDateString(),
                value: Number(t[config.y]) || 0
            }));
            return { chartData: data, lines: ['value'] };
        }

        const groupedMap: Record<string, any> = {};
        const allGroups = new Set < string > ();

        filtered.forEach(t => {
            const xVal = t[config.x];
            if (!xVal) return;

            const groupName = t[config.groupBy] || 'Other';
            const yVal = Number(t[config.y]) || 0;

            allGroups.add(groupName);

            if (!groupedMap[xVal]) {
                groupedMap[xVal] = {
                    xAxis: xVal,
                    displayX: new Date(xVal).toLocaleDateString(),
                    rawX: t[config.x]
                };
            }
            groupedMap[xVal][groupName] = yVal;
        });

        const finalData = Object.values(groupedMap).sort((a: any, b: any) => {
            if (a.rawX < b.rawX) return -1;
            if (a.rawX > b.rawX) return 1;
            return 0;
        });

        return { chartData: finalData, lines: Array.from(allGroups) };

    }, [rawData, config, filters]);

    // --- HANDLERS ---
    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const clearFilters = () => {
        setFilters({ person: '', ticker: '', sector: '' });
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-10">

            {/* --- HEADER --- */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <BarChart3 className="text-purple-600" />
                            Analytics & Plotting
                        </h1>
                    </div>
                    <div className="text-sm text-slate-500">
                        {rawData.length} records loaded
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6 p-6">

                {/* --- LEFT SIDEBAR: CONTROLS & FILTERS --- */}
                <div className="lg:col-span-1 space-y-6">

                    {/* 1. AXIS CONFIGURATION */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2 mb-4 text-slate-800 font-semibold border-b border-slate-100 pb-2">
                            <Settings size={18} /> Axes Setup
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">X Axis (Time)</label>
                                <select
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-purple-500"
                                    value={config.x}
                                    onChange={(e) => setConfig({ ...config, x: e.target.value })}
                                >
                                    {COLUMNS.filter(c => c.type === 'date').map(c => (
                                        <option key={c.key} value={c.key}>{c.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Y Axis (Value)</label>
                                <select
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-purple-500"
                                    value={config.y}
                                    onChange={(e) => setConfig({ ...config, y: e.target.value })}
                                >
                                    {COLUMNS.filter(c => c.type === 'number').map(c => (
                                        <option key={c.key} value={c.key}>{c.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-purple-600 uppercase mb-1">Group By</label>
                                <select
                                    className="w-full p-2 border border-purple-200 bg-purple-50 rounded-lg text-sm text-purple-900 font-medium outline-none focus:ring-2 focus:ring-purple-500"
                                    value={config.groupBy}
                                    onChange={(e) => setConfig({ ...config, groupBy: e.target.value })}
                                >
                                    <option value="">(None - Single Line)</option>
                                    <option value="ticker">Ticker</option>
                                    <option value="person">Person</option>
                                    <option value="sector">Sector</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 2. DATA FILTERS */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2 text-slate-800 font-semibold">
                                <Filter size={18} /> Filters
                            </div>
                            {(filters.person || filters.ticker || filters.sector) && (
                                <button onClick={clearFilters} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                                    <XCircle size={12} /> Clear
                                </button>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Person</label>
                                <select
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500"
                                    value={filters.person}
                                    onChange={(e) => handleFilterChange('person', e.target.value)}
                                >
                                    <option value="">All People</option>
                                    {uniqueValues.people.map((p: any) => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ticker</label>
                                <select
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500"
                                    value={filters.ticker}
                                    onChange={(e) => handleFilterChange('ticker', e.target.value)}
                                >
                                    <option value="">All Tickers</option>
                                    {uniqueValues.tickers.map((t: any) => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sector</label>
                                <select
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500"
                                    value={filters.sector}
                                    onChange={(e) => handleFilterChange('sector', e.target.value)}
                                >
                                    <option value="">All Sectors</option>
                                    {uniqueValues.sectors.map((s: any) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- RIGHT SIDE: CHART --- */}
                <div className="lg:col-span-3">
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 min-h-[600px] flex flex-col relative">

                        {loading && (
                            <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center text-slate-400">
                                <RefreshCw className="animate-spin mb-2" size={32} />
                                <p>Loading data...</p>
                            </div>
                        )}

                        {!loading && chartData.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-lg">
                                <BarChart3 size={48} className="mb-4 opacity-20" />
                                <p>No data found matching your filters.</p>
                                <button onClick={clearFilters} className="mt-4 text-blue-600 font-medium hover:underline">
                                    Clear Filters
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="mb-6 text-center">
                                    <h2 className="text-lg font-bold text-slate-800">
                                        {COLUMNS.find(c => c.key === config.y)?.label} over Time
                                    </h2>
                                    <p className="text-sm text-slate-500">
                                        Grouped by <span className="font-semibold text-purple-600 uppercase">{config.groupBy || 'Total'}</span>
                                    </p>
                                </div>

                                <div className="flex-1 w-full" style={{ minHeight: '450px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis
                                                dataKey="displayX"
                                                tick={{ fontSize: 12, fill: '#64748b' }}
                                                axisLine={false}
                                                tickLine={false}
                                                dy={10}
                                                angle={-15}
                                                textAnchor="end"
                                            />
                                            <YAxis
                                                tick={{ fontSize: 12, fill: '#64748b' }}
                                                axisLine={false}
                                                tickLine={false}
                                                tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                                    borderRadius: '12px',
                                                    border: 'none',
                                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                                    padding: '12px'
                                                }}
                                            />
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} />

                                            {lines.map((lineKey, index) => (
                                                <Line
                                                    key={lineKey}
                                                    type="monotone"
                                                    dataKey={lineKey}
                                                    name={lineKey === 'value' ? 'Total Value' : lineKey}
                                                    stroke={lines.length === 1 ? '#8b5cf6' : COLORS[index % COLORS.length]}
                                                    strokeWidth={2.5}
                                                    dot={{ r: 3, strokeWidth: 0, fill: lines.length === 1 ? '#8b5cf6' : COLORS[index % COLORS.length] }}
                                                    activeDot={{ r: 7, strokeWidth: 0 }}
                                                    connectNulls={true}
                                                />
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
                                    <span>Showing {chartData.length} time points</span>
                                    <span>{lines.length} lines plotted</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}