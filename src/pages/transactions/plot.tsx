import { useRouter } from 'next/router';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
    ArrowLeft, BarChart3, Settings, Filter, RefreshCw, XCircle, ChevronDown, Check, Search
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// --- CONFIGURAZIONE SUPABASE ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
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
    { key: 'category', label: 'Category', type: 'text' },
    { key: 'total_outlay_eur', label: 'Total Amount (€)', type: 'number' },
    { key: 'purchase_price_per_share_eur', label: 'Price per Share (€)', type: 'number' },
    { key: 'shares_count', label: 'Shares Count', type: 'number' },
    { key: 'cumulative_shares_count', label: 'Cumul. Shares', type: 'number' },
    { key: 'average_price', label: 'Avg Price', type: 'number' },
    { key: 'effective_average_price', label: 'Eff. Avg Price', type: 'number' }
];

// --- COMPONENTE MULTI-SELECT CON RICERCA ---
const MultiSelect = ({ label, options, selected, onChange }: { label: string, options: string[], selected: string[], onChange: (val: string[]) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState(""); // Stato per la ricerca
    const dropdownRef = useRef < HTMLDivElement > (null);

    // Chiude il menu se clicchi fuori
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm(""); // Resetta la ricerca quando chiudi
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleOption = (option: string) => {
        if (selected.includes(option)) {
            onChange(selected.filter(item => item !== option));
        } else {
            onChange([...selected, option]);
        }
    };

    // Filtra le opzioni in base al testo inserito
    const filteredOptions = options.filter(opt =>
        opt.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="relative" ref={dropdownRef}>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{label}</label>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 flex justify-between items-center outline-none focus:ring-2 focus:ring-purple-500 hover:bg-white transition-colors"
            >
                <span className={`truncate ${selected.length === 0 ? 'text-slate-400' : 'text-slate-800'}`}>
                    {selected.length === 0 ? `Select ${label}...` : `${selected.length} selected`}
                </span>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col max-h-80">

                    {/* BARRA DI RICERCA (Sticky in alto) */}
                    <div className="p-2 border-b border-slate-100 bg-white sticky top-0 z-10">
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                            <input
                                type="text"
                                autoFocus
                                placeholder={`Search ${label}...`}
                                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-slate-50"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* LISTA OPZIONI (Scrollabile) */}
                    <div className="overflow-y-auto flex-1 custom-scrollbar">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(option => {
                                const isSelected = selected.includes(option);
                                return (
                                    <div
                                        key={option}
                                        onClick={() => toggleOption(option)}
                                        className="px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-purple-50 transition-colors text-sm text-slate-700 border-l-2 border-transparent hover:border-purple-500"
                                    >
                                        <div className={`w-4 h-4 border rounded flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-purple-600 border-purple-600' : 'border-slate-300'}`}>
                                            {isSelected && <Check size={12} className="text-white" />}
                                        </div>
                                        <span className="truncate">{option}</span>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="px-4 py-3 text-xs text-slate-400 italic text-center">
                                No results found for "{searchTerm}"
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- PAGINA PRINCIPALE ---
export default function PlotPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [rawData, setRawData] = useState < any[] > ([]);

    // --- STATO CONFIGURAZIONE GRAFICO ---
    const [config, setConfig] = useState({
        x: 'operation_date',
        y: 'total_outlay_eur',
        groupBy: 'ticker'
    });

    // --- STATO FILTRI ---
    const [filters, setFilters] = useState < {
        person: string[];
        ticker: string[];
        sector: string[];
        category: string[];
    } > ({
        person: [],
        ticker: [],
        sector: [],
        category: []
    });

    // 1. FETCH DATA
    const fetchData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .order('operation_date', { ascending: true });

            if (error) throw error;
            setRawData(data || []);
        } catch (err: any) {
            console.error("Errore fetch:", err);
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
            sectors: getUnique('sector'),
            categories: getUnique('category')
        };
    }, [rawData]);

    // 3. ELABORAZIONE DATI (Filter -> Group -> Format)
    const { chartData, lines } = useMemo(() => {
        if (!rawData.length) return { chartData: [], lines: [] };

        // A. FILTRAGGIO
        let filtered = rawData.filter(item => {
            if (filters.person.length > 0 && !filters.person.includes(item.person)) return false;
            if (filters.ticker.length > 0 && !filters.ticker.includes(item.ticker)) return false;
            if (filters.sector.length > 0 && !filters.sector.includes(item.sector)) return false;
            if (filters.category.length > 0 && !filters.category.includes(item.category)) return false;
            return true;
        });

        // B. RAGGRUPPAMENTO
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
    const handleFilterChange = (key: keyof typeof filters, value: string[]) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const clearFilters = () => {
        setFilters({ person: [], ticker: [], sector: [], category: [] });
    };

    const hasActiveFilters = filters.person.length > 0 || filters.ticker.length > 0 || filters.sector.length > 0 || filters.category.length > 0;

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
                            Plotting
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

                    {/* AXIS CONFIG */}
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
                                    <option value="category">Category</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* FILTERS MULTIPLI CON CERCA */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2 text-slate-800 font-semibold">
                                <Filter size={18} /> Filters
                            </div>
                            {hasActiveFilters && (
                                <button onClick={clearFilters} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                                    <XCircle size={12} /> Clear
                                </button>
                            )}
                        </div>

                        <div className="space-y-4">
                            <MultiSelect
                                label="Person"
                                options={uniqueValues.people}
                                selected={filters.person}
                                onChange={(val) => handleFilterChange('person', val)}
                            />
                            <MultiSelect
                                label="Ticker"
                                options={uniqueValues.tickers}
                                selected={filters.ticker}
                                onChange={(val) => handleFilterChange('ticker', val)}
                            />
                            <MultiSelect
                                label="Category"
                                options={uniqueValues.categories}
                                selected={filters.category}
                                onChange={(val) => handleFilterChange('category', val)}
                            />
                            <MultiSelect
                                label="Sector"
                                options={uniqueValues.sectors}
                                selected={filters.sector}
                                onChange={(val) => handleFilterChange('sector', val)}
                            />
                        </div>
                    </div>
                </div>

                {/* --- RIGHT SIDE: CHART --- */}
                <div className="lg:col-span-3">
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 flex flex-col relative">

                        {loading && (
                            <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center text-slate-400">
                                <RefreshCw className="animate-spin mb-2" size={32} />
                                <p>Loading data...</p>
                            </div>
                        )}

                        {!loading && chartData.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-lg py-20">
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

                                {/* Grafico con altezza fissa */}
                                <div className="w-full h-[500px]" style={{ height: '500px' }}>
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