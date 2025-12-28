import { useRouter } from 'next/router';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
    ArrowLeft, BarChart3, Settings, Filter, RefreshCw, XCircle, ChevronDown, Check, Search, Calendar, PieChart as PieIcon,
    LineChart as LineIcon, Clock, Download, FileText, FileSpreadsheet, Image as ImageIcon
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
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
    { key: 'cumulative_cost', label: 'Cumulative Cost (€)', type: 'number' },
    { key: 'total_outlay_eur', label: 'Total Amount (€)', type: 'number' },
    { key: 'purchase_price_per_share_eur', label: 'Price per Share (€)', type: 'number' },
    { key: 'shares_count', label: 'Shares Count', type: 'number' },
    { key: 'cumulative_shares_count', label: 'Cumul. Shares', type: 'number' },
    { key: 'average_price', label: 'Avg Price', type: 'number' },
    { key: 'effective_average_price', label: 'Eff. Avg Price', type: 'number' }
];

// --- COMPONENTE MULTI-SELECT ---
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
        if (selected.includes(option)) {
            onChange(selected.filter(item => item !== option));
        } else {
            onChange([...selected, option]);
        }
    };

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
                                No results found
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
    const chartContainerRef = useRef < HTMLDivElement > (null);
    const downloadMenuRef = useRef < HTMLDivElement > (null);
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);

    // --- STATE VISUALIZZAZIONE (Line vs Pie) ---
    const [chartType, setChartType] = useState < 'line' | 'pie' > ('line');
    const [pieDate, setPieDate] = useState < string > ('');

    const [config, setConfig] = useState({
        x: 'operation_date',
        y: 'cumulative_cost',
        groupBy: 'ticker'
    });

    const [filters, setFilters] = useState < {
        person: string[];
        ticker: string[];
        sector: string[];
        category: string[];
    } > ({
        person: [],
        ticker: [],
        sector: [],
        category: [] // Partiamo vuoti, li riempiamo automaticamente dopo
    });

    // Stato Date Range
    const [dateRange, setDateRange] = useState({
        start: '',
        end: ''
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

            const enrichedData = (data || []).map(t => ({
                ...t,
                cumulative_cost: (t.cumulative_shares_count || 0) * (t.average_price || 0)
            }));

            setRawData(enrichedData);
        } catch (err: any) {
            console.error("Errore fetch:", err);
        } finally {
            setLoading(false);
        }
    };

    // 2. INITIALIZE DEFAULTS (Person & Categories)
    useEffect(() => {
        const initializeDefaults = async () => {
            // A. Imposta Persona (Utente Loggato)
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: userProfile } = await supabase
                        .from('users')
                        .select('alias')
                        .eq('user_id', user.id)
                        .maybeSingle();

                    if (userProfile && userProfile.alias) {
                        setFilters(prev => ({ ...prev, person: [userProfile.alias] }));
                    }
                }
            } catch (e) {
                console.error("Errore user:", e);
            }
        };

        fetchData();
        initializeDefaults();
    }, []);

    // 3. AUTO-SELECT ALL CATEGORIES WHEN DATA LOADS
    useEffect(() => {
        if (rawData.length > 0) {
            const allCategories = Array.from(new Set(rawData.map(item => item.category).filter(Boolean)));
            setFilters(prev => {
                if (prev.category.length === 0) {
                    return { ...prev, category: allCategories };
                }
                return prev;
            });
        }
    }, [rawData]);

    // 4. UNIQUE VALUES
    const uniqueValues = useMemo(() => {
        const getUnique = (key: string) => Array.from(new Set(rawData.map(item => item[key]).filter(Boolean))).sort();
        return {
            people: getUnique('person'),
            tickers: getUnique('ticker'),
            sectors: getUnique('sector'),
            categories: getUnique('category')
        };
    }, [rawData]);

    // 5. AUTO-UPDATE DATE RANGES
    useEffect(() => {
        if (rawData.length === 0) return;

        let dataForDates = rawData.filter(item => {
            if (filters.person.length > 0 && !filters.person.includes(item.person)) return false;
            if (filters.ticker.length > 0 && !filters.ticker.includes(item.ticker)) return false;
            if (filters.sector.length > 0 && !filters.sector.includes(item.sector)) return false;
            if (filters.category.length > 0 && !filters.category.includes(item.category)) return false;
            return true;
        });

        if (dataForDates.length > 0) {
            const dates = dataForDates.map(d => new Date(d.operation_date).getTime());
            const minDate = new Date(Math.min(...dates)).toISOString().split('T')[0];
            const maxDate = new Date(Math.max(...dates)).toISOString().split('T')[0];
            const today = new Date().toISOString().split('T')[0];

            const endDate = today > maxDate ? today : maxDate;

            setDateRange(prev => {
                if (prev.start !== minDate || prev.end !== endDate) {
                    return { start: minDate, end: endDate };
                }
                return prev;
            });

            if (!pieDate) setPieDate(endDate);
        }
    }, [rawData, filters]);


    // 6. MOTORE DI CALCOLO (LINE CHART)
    const { chartData, lines } = useMemo(() => {
        if (!rawData.length || !dateRange.start || !dateRange.end) return { chartData: [], lines: [] };

        let filtered = rawData.filter(item => {
            if (filters.person.length > 0 && !filters.person.includes(item.person)) return false;
            if (filters.ticker.length > 0 && !filters.ticker.includes(item.ticker)) return false;
            if (filters.sector.length > 0 && !filters.sector.includes(item.sector)) return false;
            if (filters.category.length > 0 && !filters.category.includes(item.category)) return false;
            return true;
        });

        const startDateMs = new Date(dateRange.start).getTime();
        const endDateMs = new Date(dateRange.end).getTime();
        const oneDay = 24 * 60 * 60 * 1000;

        const txByDate: Record<string, any[]> = {};
        filtered.forEach(t => {
            const dateKey = new Date(t[config.x]).toISOString().split('T')[0];
            if (!txByDate[dateKey]) txByDate[dateKey] = [];
            txByDate[dateKey].push(t);
        });

        const positionState: Record<string, any> = {};
        const getPositionKey = (t: any) => `${t.person || 'Unknown'}-${t.ticker || 'Unknown'}`;

        // Pre-Scan
        filtered.forEach(t => {
            const tDate = new Date(t[config.x]).getTime();
            if (tDate < startDateMs) {
                const key = getPositionKey(t);
                positionState[key] = t;
            }
        });

        const denseData = [];
        const foundGroups = new Set < string > ();

        for (let time = startDateMs; time <= endDateMs; time += oneDay) {
            const dateObj = new Date(time);
            const dateKey = dateObj.toISOString().split('T')[0];
            const displayX = dateObj.toLocaleDateString();

            const todaysTxs = txByDate[dateKey];
            if (todaysTxs) {
                todaysTxs.forEach(t => {
                    const key = getPositionKey(t);
                    positionState[key] = t;
                });
            }

            const dayValues: Record<string, number> = {};
            let hasData = false;

            Object.values(positionState).forEach(pos => {
                const groupName = config.groupBy ? (pos[config.groupBy] || 'Other') : 'value';
                const val = Number(pos[config.y]) || 0;
                dayValues[groupName] = (dayValues[groupName] || 0) + val;
                foundGroups.add(groupName);
                if (val !== 0) hasData = true;
            });

            denseData.push({ displayX, rawX: time, dateKey, ...dayValues });
        }

        return { chartData: denseData, lines: Array.from(foundGroups).sort() };

    }, [rawData, config, filters, dateRange]);

    // 7. MOTORE DI CALCOLO (PIE CHART)
    const pieChartData = useMemo(() => {
        if (!pieDate || chartData.length === 0) return [];

        const targetRow = chartData.find(row => row.dateKey === pieDate);

        if (!targetRow) return [];

        return lines
            .map(lineKey => ({
                name: lineKey,
                value: targetRow[lineKey] || 0
            }))
            .filter(item => item.value > 0)
            .sort((a, b) => b.value - a.value);

    }, [chartData, pieDate, lines]);

    // 8. TICKS ASSE X
    const xAxisTicks = useMemo(() => {
        if (chartData.length === 0) return [];
        const MAX_TICKS = 8;
        const interval = Math.ceil(chartData.length / MAX_TICKS);
        const ticks = chartData.filter((_, index) => index % interval === 0).map(d => d.displayX);
        const lastDate = chartData[chartData.length - 1].displayX;
        if (ticks[ticks.length - 1] !== lastDate) ticks.push(lastDate);
        return ticks;
    }, [chartData]);

    // --- HANDLERS ---
    const handleFilterChange = (key: keyof typeof filters, value: string[]) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const clearFilters = () => {
        setFilters({ person: [], ticker: [], sector: [], category: [] });
    };

    const hasActiveFilters = filters.person.length > 0 || filters.ticker.length > 0 || filters.sector.length > 0;

    // --- LOGICA EXPORT ---
    const exportData = (format: 'csv' | 'xlsx') => {
        const dataToExport = chartType === 'line' ? chartData : pieChartData;
        if (!dataToExport.length) return;

        if (format === 'csv') {
            const headers = Object.keys(dataToExport[0]).join(',');
            const rows = dataToExport.map(r => Object.values(r).join(',')).join('\n');
            const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `export_${chartType}_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
        } else {
            if (!(window as any).XLSX) return alert("Libreria XLSX in caricamento...");
            const ws = (window as any).XLSX.utils.json_to_sheet(dataToExport);
            const wb = (window as any).XLSX.utils.book_new();
            (window as any).XLSX.utils.book_append_sheet(wb, ws, "Data");
            (window as any).XLSX.writeFile(wb, `export_${chartType}_${new Date().toISOString().split('T')[0]}.xlsx`);
        }
        setIsDownloadOpen(false);
    };

    const exportImage = () => {
        // Seleziona l'elemento SVG dentro il container
        const svgElement = chartContainerRef.current?.querySelector('svg');
        if (!svgElement) return;

        // Clona l'elemento per non sporcare quello visibile
        const clonedSvg = svgElement.cloneNode(true) as SVGElement;

        // Forza lo sfondo bianco e dimensioni esplicite nel clone
        clonedSvg.setAttribute('style', 'background-color: white; font-family: sans-serif;');
        const width = svgElement.getBoundingClientRect().width;
        const height = svgElement.getBoundingClientRect().height;
        clonedSvg.setAttribute('width', width.toString());
        clonedSvg.setAttribute('height', height.toString());

        // Serializzazione
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(clonedSvg);
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const canvas = document.createElement('canvas');
        // Fattore 2 per alta definizione (Retina)
        const scale = 2;
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');

        if (ctx) {
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const img = new Image();
            img.onload = () => {
                ctx.scale(scale, scale);
                ctx.drawImage(img, 0, 0);

                const pngUrl = canvas.toDataURL('image/png');
                const downloadLink = document.createElement('a');
                downloadLink.href = pngUrl;
                downloadLink.download = `invest_monitor_plot_${new Date().toISOString().split('T')[0]}.png`;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);

                // Pulizia
                URL.revokeObjectURL(url);
                setIsDownloadOpen(false);
            };
            img.src = url;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-10">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <BarChart3 className="text-purple-600" /> Plotting
                        </h1>
                    </div>
                    <div className="text-sm text-slate-500">{rawData.length} records loaded</div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6 p-6">

                {/* SIDEBAR */}
                <div className="lg:col-span-1 space-y-6">

                    {/* AXIS SETUP */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2 mb-4 text-slate-800 font-semibold border-b border-slate-100 pb-2">
                            <Settings size={18} /> Axes Setup
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">X Axis (Time)</label>
                                <select className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-purple-500" value={config.x} onChange={(e) => setConfig({ ...config, x: e.target.value })}>
                                    {COLUMNS.filter(c => c.type === 'date').map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Y Axis (Value)</label>
                                <select className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-purple-500" value={config.y} onChange={(e) => setConfig({ ...config, y: e.target.value })}>
                                    {COLUMNS.filter(c => c.type === 'number').map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-purple-600 uppercase mb-1">Group By</label>
                                <select className="w-full p-2 border border-purple-200 bg-purple-50 rounded-lg text-sm text-purple-900 font-medium outline-none focus:ring-2 focus:ring-purple-500" value={config.groupBy} onChange={(e) => setConfig({ ...config, groupBy: e.target.value })}>
                                    <option value="">(None - Single Line)</option>
                                    <option value="ticker">Ticker</option>
                                    <option value="person">Person</option>
                                    <option value="sector">Sector</option>
                                    <option value="category">Category</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* DATE RANGE - REDESIGNED */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2 mb-4 text-slate-800 font-semibold border-b border-slate-100 pb-2">
                            <Clock size={18} className="text-purple-600" /> Time Horizon
                        </div>
                        <div className="flex flex-col gap-4">
                            {/* Start Date */}
                            <div className="relative">
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="text-slate-400 text-[10px] font-bold tracking-wider">FROM</span>
                                    </div>
                                    <input
                                        type="date"
                                        className="w-full pl-12 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all shadow-sm group-hover:border-purple-300"
                                        value={dateRange.start}
                                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                    />
                                </div>
                            </div>
                            {/* End Date */}
                            <div className="relative">
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="text-slate-400 text-[10px] font-bold tracking-wider">TO</span>
                                    </div>
                                    <input
                                        type="date"
                                        className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all shadow-sm group-hover:border-purple-300"
                                        value={dateRange.end}
                                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* FILTERS */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2 text-slate-800 font-semibold"><Filter size={18} /> Filters</div>
                            {hasActiveFilters && <button onClick={clearFilters} className="text-xs text-red-500 hover:underline flex items-center gap-1"><XCircle size={12} /> Clear</button>}
                        </div>
                        <div className="space-y-4">
                            <MultiSelect label="Person" options={uniqueValues.people} selected={filters.person} onChange={(val) => handleFilterChange('person', val)} />
                            <MultiSelect label="Ticker" options={uniqueValues.tickers} selected={filters.ticker} onChange={(val) => handleFilterChange('ticker', val)} />
                            <MultiSelect label="Category" options={uniqueValues.categories} selected={filters.category} onChange={(val) => handleFilterChange('category', val)} />
                            <MultiSelect label="Sector" options={uniqueValues.sectors} selected={filters.sector} onChange={(val) => handleFilterChange('sector', val)} />
                        </div>
                    </div>
                </div>

                {/* CHART */}
                <div className="lg:col-span-3">
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 flex flex-col relative">

                        {/* CHART TYPE TOGGLE & PIE DATE */}
                        {/* --- TOP CONTROL BAR --- */}
                        <div className="flex items-center justify-between mb-8 border-b border-slate-50 pb-4">
                            <div className="w-24"></div> {/* Spacer per bilanciare la riga */}

                            {/* Toggle Centrale (quello che avevi già, ma pulito) */}
                            <div className="flex flex-col items-center gap-3">
                                <div className="flex items-center bg-slate-100 p-1 rounded-xl shadow-inner">
                                    <button onClick={() => setChartType('line')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${chartType === 'line' ? 'bg-white text-purple-600 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}><LineIcon size={16} /> Line</button>
                                    <button onClick={() => setChartType('pie')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${chartType === 'pie' ? 'bg-white text-purple-600 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}><PieIcon size={16} /> Pie</button>
                                </div>
                            </div>

                            {/* Tasto Download a Destra */}
                            <div className="relative" ref={downloadMenuRef}>
                                <button
                                    onClick={() => setIsDownloadOpen(!isDownloadOpen)}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold hover:bg-slate-700 transition-all shadow-md active:scale-95"
                                >
                                    <Download size={18} /> Export
                                </button>

                                {isDownloadOpen && (
                                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 p-2 animate-in fade-in slide-in-from-top-2">
                                        <button onClick={exportImage} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-lg text-sm font-medium text-slate-700">
                                            <ImageIcon size={16} className="text-blue-500" /> Download Image (PNG)
                                        </button>
                                        <div className="h-px bg-slate-100 my-1"></div>
                                        <button onClick={() => exportData('csv')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-lg text-sm font-medium text-slate-700">
                                            <FileText size={16} className="text-green-500" /> Export Data (CSV)
                                        </button>
                                        <button onClick={() => exportData('xlsx')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-lg text-sm font-medium text-slate-700">
                                            <FileSpreadsheet size={16} className="text-emerald-600" /> Export Data (XLSX)
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Il selettore della Snapshot Date rimane subito sotto se chartType === 'pie' */}
                        {chartType === 'pie' && (
                            <div className="flex justify-center mb-6 animate-in zoom-in-95">
                                <div className="relative group max-w-[220px]">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><span className="text-slate-400 text-[10px] font-bold tracking-wider">DATE</span></div>
                                    <input type="date" className="w-full pl-12 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:bg-white focus:border-purple-500 transition-all shadow-sm" value={pieDate} min={dateRange.start} max={dateRange.end} onChange={(e) => setPieDate(e.target.value)} />
                                </div>
                            </div>
                        )}

                        {/* CONTENT */}
                        {/* Aggiunto bg-white e p-4 per garantire che l'export abbia uno sfondo e margini corretti */}
                        <div
                            ref={chartContainerRef}
                            className="w-full h-[500px] bg-white p-4"
                            style={{ height: '540px'}} // Min-width aiuta la stabilità dell'export
                        >
                            {loading ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <RefreshCw className="animate-spin mb-2" size={32} /> <p>Loading data...</p>
                                </div>
                            ) : chartData.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-lg">
                                    <BarChart3 size={48} className="mb-4 opacity-20" />
                                    <p>No data found matching your filters.</p>
                                </div>
                            ) : chartType === 'line' ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="displayX"
                                            ticks={xAxisTicks}
                                            interval={0}
                                            tick={{ fontSize: 12, fill: '#64748b' }}
                                            axisLine={{ stroke: '#e2e8f0' }}
                                            tickLine={false}
                                            dy={10}
                                            angle={0}
                                            textAnchor="middle"
                                        />
                                        <YAxis
                                            tick={{ fontSize: 12, fill: '#64748b' }}
                                            axisLine={{ stroke: '#e2e8f0' }}
                                            tickLine={false}
                                            tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                                        />
                                        <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', padding: '12px' }} />
                                        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '20px' }} />
                                        {lines.map((lineKey, index) => (
                                            <Line
                                                key={lineKey}
                                                type="monotone"
                                                dataKey={lineKey}
                                                name={lineKey === 'value' ? 'Total Value' : lineKey}
                                                stroke={lines.length === 1 ? '#8b5cf6' : COLORS[index % COLORS.length]}
                                                strokeWidth={2.5}
                                                dot={false}
                                                activeDot={{ r: 6 }}
                                                connectNulls={true}
                                                isAnimationActive={false} // Disattivare l'animazione migliora la cattura dell'immagine
                                            />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieChartData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={80}
                                            outerRadius={140}
                                            paddingAngle={2}
                                            dataKey="value"
                                            isAnimationActive={false} // Fondamentale per l'export istantaneo
                                        >
                                            {pieChartData.map((entry, index) => {
                                                const colorIndex = lines.indexOf(entry.name);
                                                const color = colorIndex >= 0 ? COLORS[colorIndex % COLORS.length] : COLORS[index % COLORS.length];
                                                return <Cell key={`cell-${index}`} fill={color} stroke="#fff" strokeWidth={2} />;
                                            })}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value: number) => value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'}
                                            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', padding: '12px' }}
                                        />
                                        <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        {/* FOOTER */}
                        <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
                            {chartType === 'line' ? (
                                <span>Showing {chartData.length} daily points</span>
                            ) : (
                                <span>Snapshot of {pieDate ? new Date(pieDate).toLocaleDateString() : 'selected date'}</span>
                            )}
                            <span>{lines.length} groups analyzed</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}