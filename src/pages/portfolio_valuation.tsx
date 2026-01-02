import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
    ArrowUpRight, ArrowDownRight, Wallet, Loader2, Search, Filter,
    ChevronDown, Calendar, XCircle, TrendingUp, Settings, Download,
    FileText, FileSpreadsheet, GripVertical, Check
} from 'lucide-react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import * as XLSX from 'xlsx';

// --- CONFIGURAZIONE ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const PYTHON_API_BASE_URL = "https://invest-monitor-api.onrender.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

    const filteredOptions = options.filter(opt => opt.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="relative" ref={dropdownRef}>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{label}</label>
            <button onClick={() => setIsOpen(!isOpen)} className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 flex justify-between items-center outline-none focus:ring-2 focus:ring-blue-500 hover:bg-white transition-colors">
                <span className={`truncate ${selected.length === 0 ? 'text-slate-400' : 'text-slate-800'}`}>
                    {selected.length === 0 ? `Select ${label}...` : `${selected.length} selected`}
                </span>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col max-h-60">
                    <div className="p-2 border-b border-slate-100 bg-white sticky top-0 z-10">
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                            <input type="text" autoFocus placeholder={`Search...`} className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                    <div className="overflow-y-auto flex-1 custom-scrollbar">
                        {filteredOptions.length > 0 ? filteredOptions.map(option => {
                            const isSelected = selected.includes(option);
                            return (
                                <div key={option} onClick={() => toggleOption(option)} className="px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-blue-50 transition-colors text-sm text-slate-700 border-l-2 border-transparent hover:border-blue-500">
                                    <div className={`w-4 h-4 border rounded flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>{isSelected && <Check size={12} className="text-white" />}</div>
                                    <span className="truncate">{option}</span>
                                </div>
                            );
                        }) : <div className="px-4 py-3 text-xs text-slate-400 italic text-center">No results found</div>}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- INTERFACCE ---
interface Transaction {
    ticker: string;
    person: string;
    shares_count: number;
    price_per_share_eur: number;
    operation_sign: number;
    buy_or_sell: number;
    operation_date: string;
    transaction_id: string;
    total_outlay_eur: number;
}

interface PortfolioItem {
    ticker: string;
    y_ticker: string;
    quantity: number;
    avg_price: number;
    avg_date: string | null;
    total_exposure: number;
    current_price: number | null;
    market_value: number;
    gross_value: number;
    profit_loss: number | null;
    performance_perc: number | null;
    total_dividends: number | null;
    is_live_price: boolean;
}

interface ColumnConfig {
    id: keyof PortfolioItem | 'return_perc_fmt' | 'actions'; // actions unused but kept for safety
    label: string;
    visible: boolean;
    width: number;
    align: 'left' | 'right' | 'center';
}

export default function PortfolioValuation() {
    const router = useRouter();

    // Stato Dati
    const [rawTransactions, setRawTransactions] = useState < Transaction[] > ([]);
    const [loadingData, setLoadingData] = useState(true);
    const [pythonData, setPythonData] = useState < Record < string, { price: number, dividends: number, is_live: boolean }>> ({});
    const [loadingPrices, setLoadingPrices] = useState(false);
    const [pricesError, setPricesError] = useState("");

    // Stato Filtri
    const [filters, setFilters] = useState({
        person: [] as string[],
        ticker: [] as string[],
        startDate: '',
        endDate: ''
    });

    // Stato UI Colonne
    const [columns, setColumns] = useState < ColumnConfig[] > ([
        { id: 'ticker', label: 'Ticker', visible: true, width: 120, align: 'left' },
        { id: 'quantity', label: 'Qty', visible: true, width: 80, align: 'right' },
        { id: 'avg_price', label: 'Avg Price', visible: true, width: 100, align: 'right' },
        { id: 'current_price', label: 'Mkt Price', visible: true, width: 100, align: 'right' },
        { id: 'total_exposure', label: 'Exposure', visible: true, width: 110, align: 'right' },
        { id: 'market_value', label: 'Mkt Value', visible: true, width: 110, align: 'right' }, // NEW
        { id: 'gross_value', label: 'Gross Value', visible: true, width: 110, align: 'right' }, // NEW
        { id: 'avg_date', label: 'Avg Date', visible: true, width: 100, align: 'center' },
        { id: 'total_dividends', label: 'Dividends', visible: true, width: 100, align: 'right' },
        { id: 'profit_loss', label: 'P/L (€)', visible: true, width: 100, align: 'right' },
        { id: 'return_perc_fmt' as any, label: 'Return %', visible: true, width: 100, align: 'right' },
    ]);

    const [isColMenuOpen, setIsColMenuOpen] = useState(false);
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);
    const settingsRef = useRef < HTMLDivElement > (null);
    const downloadRef = useRef < HTMLDivElement > (null);

    // Gestione click outside per menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) setIsColMenuOpen(false);
            if (downloadRef.current && !downloadRef.current.contains(event.target as Node)) setIsDownloadOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Init Data
    useEffect(() => {
        const initData = async () => {
            setLoadingData(true);
            try {
                const { data, error } = await supabase.from('transactions').select('*').order('operation_date', { ascending: true });
                if (error) throw error;
                const transactions = data || [];
                setRawTransactions(transactions);

                if (transactions.length > 0) {
                    const dates = transactions.map(t => new Date(t.operation_date).getTime());
                    const min = new Date(Math.min(...dates)).toISOString().split('T')[0];
                    const max = new Date(Math.max(...dates)).toISOString().split('T')[0];
                    const today = new Date().toISOString().split('T')[0];
                    setFilters(prev => ({ ...prev, startDate: min, endDate: today > max ? today : max }));
                }

                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: userProfile } = await supabase.from('users').select('alias').eq('user_id', user.id).maybeSingle();
                    if (userProfile?.alias) setFilters(prev => ({ ...prev, person: [userProfile.alias] }));
                }
            } catch (e) {
                console.error("Error:", e);
            } finally {
                setLoadingData(false);
            }
        };
        initData();
    }, []);

    const uniqueOptions = useMemo(() => {
        const getUnique = (key: keyof Transaction) => Array.from(new Set(rawTransactions.map(t => t[key]).filter(Boolean))).sort();
        return { people: getUnique('person') as string[], tickers: getUnique('ticker') as string[] };
    }, [rawTransactions]);

    // --- MOTORE CALCOLO ---
    const portfolioData = useMemo(() => {
        if (rawTransactions.length === 0) return [];

        const filtered = rawTransactions.filter(t => {
            if (filters.person.length && !filters.person.includes(t.person)) return false;
            if (filters.ticker.length && !filters.ticker.includes(t.ticker)) return false;
            const tDate = t.operation_date ? String(t.operation_date).split('T')[0] : '';
            if (filters.startDate && tDate < filters.startDate) return false;
            if (filters.endDate && tDate > filters.endDate) return false;
            return true;
        });

        const groups: Record<string, { qty: number, cost: number, dates: number[], weights: number[] }> = {};

        filtered.forEach(t => {
            const ticker = t.ticker;
            if (!groups[ticker]) groups[ticker] = { qty: 0, cost: 0, dates: [], weights: [] };
            const qty = Number(t.shares_count || 0);
            const sign = Number(t.operation_sign || 0);
            const price = Number(t.price_per_share_eur || 0);
            const outlay = t.total_outlay_eur !== null ? Number(t.total_outlay_eur) : (price * qty);
            const isReal = Number(t.buy_or_sell) === 1;

            if (isReal) {
                if (sign === 1) {
                    groups[ticker].qty += qty;
                    groups[ticker].cost += outlay;
                    groups[ticker].dates.push(new Date(t.operation_date).getTime());
                    groups[ticker].weights.push(outlay);
                } else {
                    const avg = groups[ticker].qty > 0 ? groups[ticker].cost / groups[ticker].qty : 0;
                    groups[ticker].qty -= qty;
                    groups[ticker].cost -= (avg * qty);
                }
            }
        });

        const items: PortfolioItem[] = Object.keys(groups).map(ticker => {
            const g = groups[ticker];
            if (Math.abs(g.qty) < 0.001) return null;

            const quantity = g.qty;
            const total_exposure = g.cost;
            const avg_price = quantity !== 0 ? total_exposure / quantity : 0;

            let avg_date = null;
            if (g.dates.length > 0) {
                const totalWeight = g.weights.reduce((a, b) => a + b, 0);
                if (totalWeight > 0) {
                    const wSum = g.dates.reduce((acc, date, i) => acc + (date * g.weights[i]), 0);
                    avg_date = new Date(wSum / totalWeight).toISOString().split('T')[0];
                }
            }

            const pyData = pythonData[ticker] || null;
            let current_price = pyData ? pyData.price : null;
            const total_dividends = pyData ? pyData.dividends : null;
            let is_live_price = pyData ? pyData.is_live : false;

            // Fallback se prezzo mancante (Simula logica backend)
            if (current_price === null || current_price === 0) {
                current_price = avg_price;
                is_live_price = false;
            }

            const market_value = current_price * quantity;
            const gross_value = market_value + (total_dividends || 0);
            const profit_loss = gross_value - total_exposure; // Total Return logic
            const performance_perc = total_exposure !== 0 ? (profit_loss / total_exposure) * 100 : 0;

            return {
                ticker, y_ticker: ticker, quantity, avg_price, avg_date,
                total_exposure, current_price, market_value, gross_value,
                profit_loss, performance_perc, total_dividends, is_live_price
            };
        }).filter(Boolean) as PortfolioItem[];

        return items.sort((a, b) => b.total_exposure - a.total_exposure);
    }, [rawTransactions, filters, pythonData]);

    // --- CALCOLO TOTALI ---
    const totals = useMemo(() => {
        return portfolioData.reduce((acc, item) => ({
            exposure: acc.exposure + item.total_exposure,
            market_value: acc.market_value + item.market_value,
            gross_value: acc.gross_value + item.gross_value,
            dividends: acc.dividends + (item.total_dividends || 0),
            profit_loss: acc.profit_loss + (item.profit_loss || 0)
        }), { exposure: 0, market_value: 0, gross_value: 0, dividends: 0, profit_loss: 0 });
    }, [portfolioData]);

    const totalReturnPerc = totals.exposure !== 0 ? (totals.profit_loss / totals.exposure) * 100 : 0;

    // --- FETCH PRICES ---
    const handleSearch = async () => {
        setLoadingPrices(true);
        setPricesError("");
        try {
            const url = new URL(`${PYTHON_API_BASE_URL}/api/portfolio`);
            url.searchParams.append("user_id", "SEARCH_REQ");
            if (filters.endDate) url.searchParams.append("target_date", filters.endDate);
            filters.person.forEach(p => url.searchParams.append("people", p));

            const response = await fetch(url.toString());
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            const result = await response.json();

            const dataMap: Record<string, any> = {};
            if (Array.isArray(result)) {
                result.forEach((p: any) => {
                    if (p.ticker) dataMap[p.ticker] = {
                        price: p.current_price || 0,
                        dividends: p.total_dividends || 0,
                        is_live: p.is_live_price !== undefined ? p.is_live_price : false
                    };
                });
            }
            setPythonData(dataMap);
        } catch (e: any) {
            console.error(e);
            setPricesError("Failed to fetch data.");
        } finally {
            setLoadingPrices(false);
        }
    };

    // --- UTILS ---
    const handleFilterChange = (key: keyof typeof filters, val: any) => setFilters(prev => ({ ...prev, [key]: val }));
    const clearFilters = () => setFilters(prev => ({ ...prev, person: [], ticker: [] }));
    const fmt = (num: number | null) => num !== null ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(num) : '-';
    const fmtPerc = (num: number | null) => num !== null ? `${num > 0 ? '+' : ''}${num.toFixed(2)}%` : '-';

    // --- RESIZING & COLUMNS ---
    const handleResize = useCallback((index: number, newWidth: number) => {
        setColumns(cols => {
            const newCols = [...cols];
            newCols[index] = { ...newCols[index], width: Math.max(50, newWidth) };
            return newCols;
        });
    }, []);

    // Componente Cella Intestazione Resizable
    const ResizableHeader = ({ col, index }: { col: ColumnConfig, index: number }) => {
        const [w, setW] = useState(col.width);

        useEffect(() => setW(col.width), [col.width]);

        const onMouseDown = (e: React.MouseEvent) => {
            e.preventDefault();
            const startX = e.pageX;
            const startW = w;

            const onMouseMove = (e: MouseEvent) => {
                const newWidth = startW + (e.pageX - startX);
                setW(newWidth);
            };

            const onMouseUp = (e: MouseEvent) => {
                const newWidth = startW + (e.pageX - startX);
                handleResize(index, newWidth);
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        return (
            <th style={{ width: w }} className={`px-4 py-3 relative group ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
                {col.label}
                <div
                    onMouseDown={onMouseDown}
                    className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-slate-200 transition-opacity"
                >
                    <GripVertical size={12} className="text-slate-400" />
                </div>
            </th>
        );
    };

    // --- EXPORT ---
    const exportData = (format: 'csv' | 'xlsx') => {
        const visibleCols = columns.filter(c => c.visible && c.id !== 'return_perc_fmt');
        const data = portfolioData.map(row => {
            const r: any = {};
            visibleCols.forEach(col => {
                r[col.label] = (row as any)[col.id];
            });
            return r;
        });

        // Aggiungi riga totale
        const totalRow: any = { 'Ticker': 'TOTAL' };
        visibleCols.forEach(col => {
            if (['total_exposure', 'market_value', 'gross_value', 'total_dividends', 'profit_loss'].includes(String(col.id))) {
                totalRow[col.label] = (totals as any)[col.id === 'total_exposure' ? 'exposure' : col.id === 'total_dividends' ? 'dividends' : col.id];
            }
        });
        data.push(totalRow);

        const ws = XLSX.utils.json_to_sheet(data);
        const filename = `portfolio_valuation_${new Date().toISOString().split('T')[0]}`;

        if (format === 'csv') {
            const csv = XLSX.utils.sheet_to_csv(ws);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url; link.download = `${filename}.csv`; link.click();
        } else {
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Valuation");
            XLSX.writeFile(wb, `${filename}.xlsx`);
        }
        setIsDownloadOpen(false);
    };

    // Filtra colonne visibili
    const visibleColumns = columns.filter(c => c.visible);
    const hasEstimatedPrices = portfolioData.some(p => p.current_price !== null && !p.is_live_price);

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-6 pb-20">
            <div className="max-w-[1920px] mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Wallet className="text-blue-600" /> Portfolio Valuation
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">Real-time analysis of your positions</p>
                    </div>
                    <Link href="/portfolio_valuation/plot" className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 font-medium transition-colors shadow-sm">
                        <TrendingUp size={18} className="text-purple-600" />
                        Plot History
                    </Link>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
                    {/* FILTRI */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                                <div className="flex items-center gap-2 text-slate-800 font-semibold"><Filter size={18} /> Filters</div>
                                {(filters.person.length > 0 || filters.ticker.length > 0) && <button onClick={clearFilters} className="text-xs text-red-500 hover:underline flex items-center gap-1"><XCircle size={12} /> Clear</button>}
                            </div>
                            <div className="space-y-4">
                                <MultiSelect label="Person" options={uniqueOptions.people} selected={filters.person} onChange={(val) => handleFilterChange('person', val)} />
                                <MultiSelect label="Ticker" options={uniqueOptions.tickers} selected={filters.ticker} onChange={(val) => handleFilterChange('ticker', val)} />
                                <div className="pt-2 border-t border-slate-100">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2"><Calendar size={12} className="inline mr-1" /> Date Range</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input type="date" className="w-full p-2 border border-slate-300 rounded text-xs" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} />
                                        <input type="date" className="w-full p-2 border border-slate-300 rounded text-xs" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} />
                                    </div>
                                </div>
                                <button onClick={handleSearch} disabled={loadingPrices || loadingData} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 mt-4">
                                    {loadingPrices ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />} Search Prices
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* TABLE AREA */}
                    <div className="lg:col-span-4 flex flex-col gap-4">
                        {/* Toolbar Tabella (Destra) */}
                        <div className="flex justify-end gap-2 mb-2">
                            {/* Column Visibility Menu */}
                            <div className="relative" ref={settingsRef}>
                                <button onClick={() => setIsColMenuOpen(!isColMenuOpen)} className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600">
                                    <Settings size={18} />
                                </button>
                                {isColMenuOpen && (
                                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2">
                                        <div className="text-xs font-bold text-slate-400 uppercase mb-2 px-2">Visible Columns</div>
                                        {columns.map((col, idx) => (
                                            <div key={col.id} onClick={() => {
                                                const newCols = [...columns];
                                                newCols[idx].visible = !newCols[idx].visible;
                                                setColumns(newCols);
                                            }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer text-sm">
                                                <div className={`w-4 h-4 border rounded flex items-center justify-center ${col.visible ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                                                    {col.visible && <Check size={12} className="text-white" />}
                                                </div>
                                                {col.label}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Download Menu */}
                            <div className="relative" ref={downloadRef}>
                                <button onClick={() => setIsDownloadOpen(!isDownloadOpen)} className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600">
                                    <Download size={18} />
                                </button>
                                {isDownloadOpen && (
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2">
                                        <button onClick={() => exportData('csv')} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded text-sm text-slate-700">
                                            <FileText size={16} className="text-green-500" /> Export CSV
                                        </button>
                                        <button onClick={() => exportData('xlsx')} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded text-sm text-slate-700">
                                            <FileSpreadsheet size={16} className="text-emerald-600" /> Export XLSX
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {pricesError && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-center gap-2"><AlertCircle size={16} /> {pricesError}</div>}

                        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden relative min-h-[300px]">
                            {loadingData && <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center text-slate-500"><Loader2 size={32} className="animate-spin text-blue-600 mb-2" /> <p>Loading...</p></div>}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-200">
                                        <tr>
                                            {columns.map((col, i) => (
                                                col.visible && <ResizableHeader key={col.id} col={col} index={i} />
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {portfolioData.length === 0 && !loadingData ? (
                                            <tr><td colSpan={visibleColumns.length} className="px-6 py-12 text-center text-slate-400">No positions found.</td></tr>
                                        ) : (
                                            portfolioData.map((item) => {
                                                const isProfitable = (item.profit_loss || 0) >= 0;
                                                const isEstimated = !item.is_live_price; // Se non è live, è stimato (o caricato da storico)

                                                return (
                                                    <tr key={item.ticker} className="hover:bg-slate-50/50 transition-colors">
                                                        {columns.map(col => {
                                                            if (!col.visible) return null;
                                                            const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';

                                                            let content: React.ReactNode = '-';
                                                            let cellClass = `px-4 py-3 ${alignClass}`;

                                                            if (col.id === 'ticker') {
                                                                content = <span className="font-bold text-slate-800">{item.ticker}</span>;
                                                            } else if (col.id === 'quantity') {
                                                                content = item.quantity.toFixed(2);
                                                            } else if (col.id === 'avg_price') {
                                                                content = fmt(item.avg_price);
                                                            } else if (col.id === 'current_price') {
                                                                cellClass += ` bg-blue-50/30 ${isEstimated ? 'text-orange-500' : 'text-slate-800'}`;
                                                                content = (
                                                                    <>
                                                                        {fmt(item.current_price)}
                                                                        {isEstimated && <span className="ml-1 text-[10px] align-top">*</span>}
                                                                    </>
                                                                );
                                                            } else if (col.id === 'avg_date') {
                                                                content = <span className="text-xs text-slate-400">{item.avg_date}</span>;
                                                            } else if (col.id === 'profit_loss') {
                                                                cellClass += ` font-bold ${isProfitable ? 'text-emerald-600' : 'text-red-600'}`;
                                                                content = fmt(item.profit_loss);
                                                            } else if (col.id === 'return_perc_fmt' as any) {
                                                                content = (
                                                                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${isProfitable ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                                        {isProfitable ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{fmtPerc(item.performance_perc)}
                                                                    </div>
                                                                );
                                                            } else {
                                                                // Generic number format for Exposure, Market Value, Dividends, Gross
                                                                const val = (item as any)[col.id];
                                                                if (typeof val === 'number') {
                                                                    if (col.id === 'total_dividends') cellClass += " text-blue-700 font-medium bg-yellow-50/30";
                                                                    content = fmt(val);
                                                                }
                                                            }

                                                            return <td key={col.id} className={cellClass}>{content}</td>;
                                                        })}
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                    {/* FOOTER TOTALI */}
                                    {portfolioData.length > 0 && (
                                        <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-800">
                                            <tr>
                                                {columns.map(col => {
                                                    if (!col.visible) return null;
                                                    const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
                                                    let content: React.ReactNode = '';

                                                    if (col.id === 'ticker') content = "TOTAL";
                                                    else if (col.id === 'total_exposure') content = fmt(totals.exposure);
                                                    else if (col.id === 'market_value') content = fmt(totals.market_value);
                                                    else if (col.id === 'gross_value') content = fmt(totals.gross_value);
                                                    else if (col.id === 'total_dividends') content = <span className="text-blue-700">{fmt(totals.dividends)}</span>;
                                                    else if (col.id === 'profit_loss') content = <span className={totals.profit_loss >= 0 ? 'text-emerald-600' : 'text-red-600'}>{fmt(totals.profit_loss)}</span>;
                                                    else if (col.id === 'return_perc_fmt' as any) content = <span className={totals.profit_loss >= 0 ? 'text-emerald-600' : 'text-red-600'}>{fmtPerc(totalReturnPerc)}</span>;

                                                    return <td key={col.id} className={`px-4 py-3 ${alignClass}`}>{content}</td>;
                                                })}
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>

                        <div className="flex justify-between items-start mt-1">
                            <p className="text-slate-400 text-xs italic">
                                Based on {portfolioData.length} open positions.
                            </p>
                            {hasEstimatedPrices && (
                                <div className="text-right">
                                    <p className="text-xs text-orange-500 italic">* Estimated price (Historical Cost used).</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}