import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
    ArrowUpRight, ArrowDownRight, Wallet, Loader2, Search, Filter,
    ChevronDown, Calendar, XCircle, TrendingUp, Settings, Download,
    FileText, FileSpreadsheet, Check, ArrowUp, ArrowDown, ChevronRight,
    AlertCircle, ChevronLeft, ChevronsLeft, ChevronsRight, RefreshCw
} from 'lucide-react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import * as XLSX from 'xlsx';

// IMPORT NUOVI MODULI
import { TableSettingsModal } from '../components/TableSettingsModal';
import { useTableLogic } from '../hooks/useTableLogic';
import { ColumnDef } from '../types/table';

// --- CONFIGURAZIONE ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const PYTHON_API_BASE_URL = "https://invest-monitor-api.onrender.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- COMPONENTE MULTI-SELECT (Locale per Sidebar filtri) ---
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
        if (selected.includes(option)) onChange(selected.filter(item => item !== option));
        else onChange([...selected, option]);
    };

    const filteredOptions = options.filter(opt => opt.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="relative" ref={dropdownRef}>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{label}</label>
            <button onClick={() => setIsOpen(!isOpen)} className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 flex justify-between items-center outline-none focus:ring-2 focus:ring-blue-500 hover:bg-white transition-colors">
                <span className={`truncate ${selected.length === 0 ? 'text-slate-400' : 'text-slate-800'}`}>{selected.length === 0 ? `Select ${label}...` : `${selected.length} selected`}</span>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col max-h-60">
                    <div className="p-2 border-b border-slate-100 bg-white sticky top-0 z-10">
                        <div className="relative"><Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" /><input type="text" autoFocus className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                    </div>
                    <div className="overflow-y-auto flex-1 custom-scrollbar">
                        {filteredOptions.length > 0 ? filteredOptions.map(o => (
                            <div key={o} onClick={() => toggleOption(o)} className="px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-blue-50 transition-colors text-sm text-slate-700 border-l-2 border-transparent hover:border-blue-500">
                                <div className={`w-4 h-4 border rounded flex items-center justify-center flex-shrink-0 ${selected.includes(o) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>{selected.includes(o) && <Check size={12} className="text-white" />}</div><span className="truncate">{o}</span>
                            </div>
                        )) : <div className="px-4 py-3 text-xs text-slate-400 italic text-center">No results found</div>}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- DEFINIZIONE COLONNE ---
const INITIAL_COLUMNS: ColumnDef[] = [
    { id: 'ticker', label: 'Ticker', visible: true, width: 120, type: 'text', align: 'left' },
    { id: 'quantity', label: 'Qty', visible: true, width: 80, type: 'number', align: 'right' },
    { id: 'avg_price', label: 'Avg Price', visible: true, width: 100, type: 'number', align: 'right' },
    { id: 'current_price', label: 'Mkt Price', visible: true, width: 100, type: 'number', align: 'right' },
    { id: 'total_exposure', label: 'Exposure', visible: true, width: 110, type: 'number', align: 'right' },
    { id: 'market_value', label: 'Mkt Value', visible: true, width: 110, type: 'number', align: 'right' },
    { id: 'gross_value', label: 'Gross Value', visible: true, width: 110, type: 'number', align: 'right' },
    { id: 'avg_date', label: 'Avg Date', visible: true, width: 100, type: 'date', align: 'center' },
    { id: 'total_dividends', label: 'Dividends', visible: true, width: 100, type: 'number', align: 'right' },
    { id: 'profit_loss', label: 'P/L (€)', visible: true, width: 100, type: 'number', align: 'right' },
    { id: 'performance_perc', label: 'Return %', visible: true, width: 100, type: 'number', align: 'right' },
    { id: 'person', label: 'Person', visible: false, width: 100, type: 'text', align: 'left' },
];

export default function PortfolioValuation() {
    const router = useRouter();

    // Dati Base
    const [rawTransactions, setRawTransactions] = useState < any[] > ([]);
    const [loadingData, setLoadingData] = useState(true);
    const [pythonData, setPythonData] = useState < Record < string, { price: number, dividends: number, is_live: boolean }>> ({});
    const [loadingPrices, setLoadingPrices] = useState(false);
    const [pricesError, setPricesError] = useState("");
    const [isUpdatingMarket, setIsUpdatingMarket] = useState(false); // Nuovo stato per il bottone Update

    // Filtri Sidebar
    const [filters, setFilters] = useState({ person: [] as string[], ticker: [] as string[], startDate: '', endDate: '' });

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);
    const downloadRef = useRef < HTMLDivElement > (null);

    // Filtri Rapidi Header
    const [columnFilters, setColumnFilters] = useState < Record < string, string[]>> ({});
    const [activeFilterCol, setActiveFilterCol] = useState < string | null > (null);
    const [filterSearchTerm, setFilterSearchTerm] = useState("");
    const headerFilterRef = useRef < HTMLDivElement > (null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (downloadRef.current && !downloadRef.current.contains(event.target as Node)) setIsDownloadOpen(false);
            if (headerFilterRef.current && !headerFilterRef.current.contains(event.target as Node)) setActiveFilterCol(null);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- INIT DATA ---
    const initData = useCallback(async () => {
        setLoadingData(true);
        try {
            const { data, error } = await supabase.from('transactions').select('*').order('operation_date', { ascending: true });
            if (error) throw error;
            setRawTransactions(data || []);

            if (data && data.length > 0) {
                const dates = data.map((t: any) => new Date(t.operation_date).getTime());
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
        } catch (e) { console.error(e); } finally { setLoadingData(false); }
    }, []);

    useEffect(() => {
        initData();
    }, [initData]);

    const uniqueOptions = useMemo(() => {
        const getU = (key: string) => Array.from(new Set(rawTransactions.map(t => t[key]).filter(Boolean))).sort();
        return { people: getU('person'), tickers: getU('ticker') };
    }, [rawTransactions]);

    // --- AGGREGAZIONE DATI ---
    const basePortfolioData = useMemo(() => {
        if (rawTransactions.length === 0) return [];

        const filtered = rawTransactions.filter(t => {
            if (filters.person.length && !filters.person.includes(t.person)) return false;
            if (filters.ticker.length && !filters.ticker.includes(t.ticker)) return false;
            const tDate = t.operation_date ? String(t.operation_date).split('T')[0] : '';
            if (filters.startDate && tDate < filters.startDate) return false;
            if (filters.endDate && tDate > filters.endDate) return false;
            return true;
        });

        const groups: Record<string, any> = {};
        filtered.forEach(t => {
            const key = `${t.ticker}|${t.person}`;
            if (!groups[key]) groups[key] = { ticker: t.ticker, person: t.person, qty: 0, cost: 0, dates: [], weights: [] };

            const qty = Number(t.shares_count || 0);
            const sign = Number(t.operation_sign || 0);
            const price = Number(t.price_per_share_eur || 0);
            const outlay = t.total_outlay_eur !== null ? Number(t.total_outlay_eur) : (price * qty);

            if (Number(t.buy_or_sell) === 1) {
                if (sign === 1) {
                    groups[key].qty += qty; groups[key].cost += outlay;
                    groups[key].dates.push(new Date(t.operation_date).getTime()); groups[key].weights.push(outlay);
                } else {
                    const avg = groups[key].qty > 0 ? groups[key].cost / groups[key].qty : 0;
                    groups[key].qty -= qty; groups[key].cost -= (avg * qty);
                }
            }
        });

        return Object.values(groups).map(g => {
            if (Math.abs(g.qty) < 0.001) return null;
            const quantity = g.qty;
            const total_exposure = g.cost;
            const avg_price = quantity !== 0 ? total_exposure / quantity : 0;
            let avg_date = null;
            if (g.dates.length > 0) {
                const totalWeight = g.weights.reduce((a: number, b: number) => a + b, 0);
                if (totalWeight > 0) {
                    const wSum = g.weights.reduce((acc: number, w: number, i: number) => acc + (g.dates[i] * w), 0);
                    avg_date = new Date(wSum / totalWeight).toISOString().split('T')[0];
                }
            }

            const pyData = pythonData[g.ticker] || null;
            let current_price = pyData ? pyData.price : null;
            const total_dividends = pyData ? pyData.dividends : null;
            let is_live_price = pyData ? pyData.is_live : false;

            if (current_price === null || current_price === 0) { current_price = avg_price; is_live_price = false; }

            const market_value = current_price * quantity;
            const gross_value = market_value + (total_dividends || 0);
            const profit_loss = gross_value - total_exposure;
            const performance_perc = total_exposure !== 0 ? (profit_loss / total_exposure) * 100 : 0;

            return {
                id: `${g.ticker}-${g.person}`,
                ticker: g.ticker, y_ticker: g.ticker, person: g.person,
                quantity, avg_price, avg_date, total_exposure, current_price,
                market_value, gross_value, profit_loss, performance_perc, total_dividends, is_live_price
            };
        }).filter(Boolean);
    }, [rawTransactions, filters, pythonData]);

    // --- USO CUSTOM HOOK ---
    const {
        viewSettings,
        setViewSettings,
        paginatedRows,
        allFilteredRows,
        exportableRows,
        visibleColumns,
        pagination,
        setPagination,
        totalRows,
        totalPages
    } = useTableLogic(basePortfolioData, INITIAL_COLUMNS, 25);

    // --- CALCOLO TOTALI ---
    const totals = useMemo(() => {
        const dataRows = allFilteredRows.filter(r => r.type === 'data').map(r => (r as any).data);
        return dataRows.reduce((acc, item) => ({
            exposure: acc.exposure + item.total_exposure,
            market_value: acc.market_value + item.market_value,
            gross_value: acc.gross_value + item.gross_value,
            dividends: acc.dividends + (item.total_dividends || 0),
            profit_loss: acc.profit_loss + (item.profit_loss || 0)
        }), { exposure: 0, market_value: 0, gross_value: 0, dividends: 0, profit_loss: 0 });
    }, [allFilteredRows]);

    const totalReturnPerc = totals.exposure !== 0 ? (totals.profit_loss / totals.exposure) * 100 : 0;

    // --- ACTIONS ---
    const handleSearch = async () => {
        setLoadingPrices(true);
        setPricesError("");
        try {
            const url = new URL(`${PYTHON_API_BASE_URL}/api/portfolio`);
            url.searchParams.append("user_id", "SEARCH_REQ");
            if (filters.endDate) url.searchParams.append("target_date", filters.endDate);
            filters.person.forEach(p => url.searchParams.append("people", p));
            const response = await fetch(url.toString());
            const result = await response.json();
            const dataMap: Record<string, any> = {};
            if (Array.isArray(result)) {
                result.forEach((p: any) => { if (p.ticker) dataMap[p.ticker] = { price: p.current_price || 0, dividends: p.total_dividends || 0, is_live: p.is_live_price ?? false }; });
            }
            setPythonData(dataMap);
        } catch (e: any) { setPricesError("Failed to fetch data."); } finally { setLoadingPrices(false); }
    };

    // --- NUOVA FUNZIONE: TRIGGER AGGIORNAMENTO MERCATO ---
    const triggerUpdateMarketData = async () => {
        setIsUpdatingMarket(true);
        try {
            const response = await fetch(`${PYTHON_API_BASE_URL}/api/cron/update_market_data`);
            const data = await response.json();

            if (response.ok) {
                alert(`Update successful! Updated ${data.tickers_updated || 0} tickers.`);
                // Ricarica i dati locali e se necessario rilancia la ricerca prezzi
                initData();
                if (Object.keys(pythonData).length > 0) {
                    handleSearch();
                }
            } else {
                alert(`Update failed: ${data.error || "Unknown error"}`);
            }
        } catch (error) {
            console.error("Failed to update market data", error);
            alert("Network error while trying to update market data.");
        } finally {
            setIsUpdatingMarket(false);
        }
    };

    const exportData = (format: 'csv' | 'xlsx') => {
        const ws = XLSX.utils.json_to_sheet(exportableRows);
        const filename = `portfolio_valuation_${new Date().toISOString().split('T')[0]}`;
        if (format === 'csv') {
            const csv = XLSX.utils.sheet_to_csv(ws);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a'); link.href = url; link.download = `${filename}.csv`; link.click();
        } else {
            const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Valuation"); XLSX.writeFile(wb, `${filename}.xlsx`);
        }
        setIsDownloadOpen(false);
    };

    const fmt = (num: number | null) => num !== null ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(num) : '-';
    const fmtPerc = (num: number | null) => num !== null ? `${num > 0 ? '+' : ''}${num.toFixed(2)}%` : '-';
    const hasEstimatedPrices = basePortfolioData.some(p => p.current_price !== null && !p.is_live_price);

    // --- HEADER CELL COMPONENT ---
    const HeaderCell = ({ col, index, moveColumn, resizeColumn }: any) => {
        const [w, setW] = useState(col.width);
        useEffect(() => setW(col.width), [col.width]);

        const uniqueVals = useMemo(() => Array.from(new Set(basePortfolioData.map(item => String((item as any)[col.id])))).sort(), [col.id]);
        const filteredVals = uniqueVals.filter(v => v.toLowerCase().includes(filterSearchTerm.toLowerCase()));

        const handleDragStart = (e: React.DragEvent) => { e.dataTransfer.setData("colIndex", index.toString()); e.dataTransfer.effectAllowed = "move"; };
        const handleDrop = (e: React.DragEvent) => { e.preventDefault(); const fromIndex = parseInt(e.dataTransfer.getData("colIndex")); moveColumn(fromIndex, index); };

        const onMouseDown = (e: React.MouseEvent) => {
            e.preventDefault(); e.stopPropagation();
            const startX = e.pageX; const startW = w;
            const onMouseMove = (e: MouseEvent) => setW(Math.max(50, startW + (e.pageX - startX)));
            const onMouseUp = (e: MouseEvent) => { resizeColumn(index, Math.max(50, startW + (e.pageX - startX))); document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
            document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
        };

        const activeSort = viewSettings.sorts.find(s => s.columnId === col.id);

        return (
            <th style={{ width: w }} draggable onDragStart={handleDragStart} onDragOver={e => e.preventDefault()} onDrop={handleDrop} className={`px-4 py-3 relative group cursor-grab active:cursor-grabbing select-none hover:bg-slate-100 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
                <div className={`flex items-center gap-2 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                    <span onClick={() => setViewSettings(prev => ({ ...prev, sorts: [{ id: 'quick', columnId: col.id, direction: activeSort?.direction === 'asc' ? 'desc' : 'asc' }] }))} className="cursor-pointer font-bold flex items-center gap-1 hover:text-blue-600 text-xs uppercase tracking-wider text-gray-600">
                        {col.label} {activeSort && (activeSort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); setActiveFilterCol(activeFilterCol === col.id ? null : col.id); setFilterSearchTerm(""); }} className={`p-1 rounded hover:bg-slate-200 transition-opacity ${activeFilterCol === col.id || columnFilters[col.id]?.length ? 'opacity-100 text-blue-600' : 'opacity-0 group-hover:opacity-100 text-slate-400'}`}><Filter size={12} fill={columnFilters[col.id]?.length ? "currentColor" : "none"} /></button>
                </div>
                {activeFilterCol === col.id && (
                    <div ref={headerFilterRef} className="absolute top-full left-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-200 z-50 p-2 cursor-default text-left font-normal" onClick={e => e.stopPropagation()}>
                        <div className="relative mb-2"><Search size={12} className="absolute left-2 top-2.5 text-slate-400" /><input autoFocus type="text" placeholder="Search..." className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none" value={filterSearchTerm} onChange={e => setFilterSearchTerm(e.target.value)} /></div>
                        <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
                            {filteredVals.map(val => {
                                const isSel = columnFilters[col.id]?.includes(val);
                                return (<label key={val} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-xs"><div className={`w-3 h-3 border rounded flex items-center justify-center ${isSel ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>{isSel && <Check size={10} className="text-white" />}</div><span className="truncate">{val || '(Empty)'}</span><input type="checkbox" className="hidden" checked={!!isSel} onChange={() => setColumnFilters(prev => { const cur = prev[col.id] || []; return { ...prev, [col.id]: cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val] }; })} /></label>)
                            })}
                        </div>
                        <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between"><button onClick={() => setColumnFilters(prev => ({ ...prev, [col.id]: [] }))} className="text-xs text-slate-500 hover:text-slate-800">Clear</button><button onClick={() => setActiveFilterCol(null)} className="text-xs text-blue-600 font-medium">Done</button></div>
                    </div>
                )}
                <div onMouseDown={onMouseDown} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 group-hover:bg-slate-300 transition-colors z-10" />
            </th>
        );
    };

    const moveColumn = useCallback((from: number, to: number) => {
        setViewSettings(prev => {
            const cols = [...prev.columns];
            const [moved] = cols.splice(from, 1);
            cols.splice(to, 0, moved);
            return { ...prev, columns: cols };
        });
    }, []);

    const resizeColumn = useCallback((idx: number, w: number) => {
        setViewSettings(prev => {
            const cols = [...prev.columns];
            cols[idx] = { ...cols[idx], width: w };
            return { ...prev, columns: cols };
        });
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-6 pb-20">
            <div className="max-w-[1920px] mx-auto">

                {/* --- HEADER AGGIORNATO (LAYOUT A 3 COLONNE) --- */}
                {/* --- HEADER AGGIORNATO (LAYOUT A 3 COLONNE BILANCIATE) --- */}
                {/* --- HEADER (Tasti a Destra) --- */}
                <div className="flex flex-col md:flex-row flex-wrap gap-4 justify-between items-center mb-6">

                    {/* SINISTRA: Titolo */}
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Wallet className="text-blue-600" /> Portfolio Valuation
                        </h1>
                    </div>

                    {/* DESTRA: Tutti i pulsanti raggruppati */}
                    <div className="flex items-center gap-3">

                        {/* Tasto Update Prices */}
                        <button
                            onClick={triggerUpdateMarketData}
                            disabled={isUpdatingMarket}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium shadow-sm transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:transform-none text-sm"
                        >
                            {isUpdatingMarket ? <Loader2 size={16} className="animate-spin text-white" /> : <RefreshCw size={16} className="text-white" />}
                            <span>Update</span>
                        </button>

                        {/* Tasto Plot History */}
                        <Link href="/portfolio_valuation/plot" className="flex items-center gap-2 px-4 py-2 bg-white border border-purple-200 text-purple-600 hover:bg-purple-50 rounded-full font-medium shadow-sm transition-transform hover:-translate-y-0.5 text-sm">
                            <TrendingUp size={16} />
                            <span>Plot</span>
                        </Link>

                        {/* Separatore verticale opzionale per pulizia visiva */}
                        <div className="h-6 w-px bg-slate-300 mx-1"></div>

                        {/* Tasto Settings */}
                        <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 shadow-sm transition-colors" title="View Settings">
                            <Settings size={18} />
                        </button>

                        {/* Tasto Download */}
                        <div className="relative" ref={downloadRef}>
                            <button onClick={() => setIsDownloadOpen(!isDownloadOpen)} className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 shadow-sm transition-colors">
                                <Download size={18} />
                            </button>
                            {isDownloadOpen && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100">
                                    <button onClick={() => exportData('csv')} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded text-sm text-slate-700 transition-colors">
                                        <FileText size={16} className="text-green-500" /> Export CSV
                                    </button>
                                    <button onClick={() => exportData('xlsx')} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded text-sm text-slate-700 transition-colors">
                                        <FileSpreadsheet size={16} className="text-emerald-600" /> Export XLSX
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
                    {/* FILTRI SIDEBAR */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2"><div className="flex items-center gap-2 text-slate-800 font-semibold"><Filter size={18} /> Filters</div><button onClick={() => setFilters({ person: [], ticker: [], startDate: '', endDate: '' })} className="text-xs text-red-500 hover:underline flex items-center gap-1"><XCircle size={12} /> Clear</button></div>
                            <div className="space-y-4">
                                <MultiSelect label="Person" options={uniqueOptions.people} selected={filters.person} onChange={(val) => setFilters(p => ({ ...p, person: val }))} />
                                <MultiSelect label="Ticker" options={uniqueOptions.tickers} selected={filters.ticker} onChange={(val) => setFilters(p => ({ ...p, ticker: val }))} />
                                <div className="pt-2 border-t border-slate-100">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2"><Calendar size={12} className="inline mr-1" /> Date Range</label>
                                    <div className="grid grid-cols-2 gap-2"><input type="date" className="w-full p-2 border border-slate-300 rounded text-xs" value={filters.startDate} onChange={(e) => setFilters(p => ({ ...p, startDate: e.target.value }))} /><input type="date" className="w-full p-2 border border-slate-300 rounded text-xs" value={filters.endDate} onChange={(e) => setFilters(p => ({ ...p, endDate: e.target.value }))} /></div>
                                </div>
                                <button onClick={handleSearch} disabled={loadingPrices || loadingData} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 mt-4">{loadingPrices ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />} Search Prices</button>
                            </div>
                        </div>
                    </div>

                    {/* TABLE AREA */}
                    <div className="lg:col-span-4 flex flex-col gap-4">
                        {pricesError && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-center gap-2"><AlertCircle size={16} /> {pricesError}</div>}
                        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden relative min-h-[400px]">
                            {loadingData && <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center text-slate-500"><Loader2 size={32} className="animate-spin text-blue-600 mb-2" /> <p>Loading...</p></div>}
                            <div className="overflow-x-auto min-h-[400px]">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-200">
                                        <tr>
                                            {viewSettings.columns.map((col, i) => (
                                                col.visible && <HeaderCell key={col.id} col={col} index={i} moveColumn={moveColumn} resizeColumn={resizeColumn} />
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {/* Usa paginatedRows qui */}
                                        {paginatedRows.length === 0 && !loadingData ? (<tr><td colSpan={visibleColumns.length} className="px-6 py-12 text-center text-slate-400">No positions found.</td></tr>) : (
                                            paginatedRows.map((row: any, idx: number) => {
                                                if (row.type === 'group_header') {
                                                    return (<tr key={`group-${row.key}-${idx}`} className="bg-gray-100 border-t border-gray-300"><td colSpan={visibleColumns.length} className="px-4 py-2 font-bold text-gray-700"><div className="flex items-center gap-2" style={{ paddingLeft: `${row.level * 20}px` }}><ChevronRight size={16} className="text-gray-500" /><span className="text-xs uppercase text-gray-500">{row.field}:</span>{row.value}</div></td></tr>);
                                                }
                                                const item = row.data;
                                                const isProfitable = (item.profit_loss || 0) >= 0;
                                                const isEstimated = !item.is_live_price;
                                                return (
                                                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                                        {visibleColumns.map(col => {
                                                            const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
                                                            let content: React.ReactNode = '-';
                                                            let cellClass = `px-4 py-3 ${alignClass}`;
                                                            if (col.id === 'ticker') content = <span className="font-bold text-slate-800">{item.ticker}</span>;
                                                            else if (col.id === 'person') content = <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full text-xs">{item.person}</span>;
                                                            else if (col.id === 'quantity') content = item.quantity.toFixed(2);
                                                            else if (col.id === 'avg_price') content = fmt(item.avg_price);
                                                            else if (col.id === 'current_price') { cellClass += ` bg-blue-50/30 ${isEstimated ? 'text-orange-500' : 'text-slate-800'}`; content = <>{fmt(item.current_price)}{isEstimated && <span className="ml-1 text-[10px] align-top">*</span>}</>; }
                                                            else if (col.id === 'avg_date') content = <span className="text-xs text-slate-400">{item.avg_date}</span>;
                                                            else if (col.id === 'profit_loss') { cellClass += ` font-bold ${isProfitable ? 'text-emerald-600' : 'text-red-600'}`; content = fmt(item.profit_loss); }
                                                            else if (col.id === 'performance_perc') { content = (<div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${isProfitable ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{isProfitable ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{fmtPerc(item.performance_perc)}</div>); }
                                                            else { const val = item[col.id]; if (typeof val === 'number') { if (col.id === 'total_dividends') cellClass += " text-blue-700 font-medium bg-yellow-50/30"; content = fmt(val); } else if (val) content = String(val); }
                                                            return <td key={col.id} className={cellClass}>{content}</td>;
                                                        })}
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                    {/* Footer totali: usa allFilteredRows */}
                                    {allFilteredRows.some((r: any) => r.type === 'data') && (
                                        <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-800 sticky bottom-0">
                                            <tr>{visibleColumns.map(col => {
                                                const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
                                                let content: React.ReactNode = '';
                                                if (col.id === 'ticker') content = "TOTAL";
                                                else if (col.id === 'total_exposure') content = fmt(totals.exposure);
                                                else if (col.id === 'market_value') content = fmt(totals.market_value);
                                                else if (col.id === 'gross_value') content = fmt(totals.gross_value);
                                                else if (col.id === 'total_dividends') content = <span className="text-blue-700">{fmt(totals.dividends)}</span>;
                                                else if (col.id === 'profit_loss') content = <span className={totals.profit_loss >= 0 ? 'text-emerald-600' : 'text-red-600'}>{fmt(totals.profit_loss)}</span>;
                                                else if (col.id === 'performance_perc') content = <span className={totals.profit_loss >= 0 ? 'text-emerald-600' : 'text-red-600'}>{fmtPerc(totalReturnPerc)}</span>;
                                                return <td key={col.id} className={`px-4 py-3 ${alignClass}`}>{content}</td>;
                                            })}</tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                            {/* Pagination Controls */}
                            <div className="border-t border-slate-200 bg-white p-3 flex flex-wrap items-center justify-between gap-4 select-none">
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <span>Rows per page:</span>
                                    <select
                                        className="border border-slate-300 rounded p-1 outline-none bg-white font-medium text-slate-700 focus:border-blue-500"
                                        value={pagination.pageSize}
                                        onChange={(e) => setPagination(p => ({ ...p, pageSize: Number(e.target.value), page: 1 }))}
                                    >
                                        {[10, 25, 50, 100, 500].map(size => (
                                            <option key={size} value={size}>{size}</option>
                                        ))}
                                        <option value={totalRows}>All ({totalRows})</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm text-slate-500">
                                        Page <b>{pagination.page}</b> of <b>{totalPages || 1}</b>
                                        <span className="mx-2 text-slate-300">|</span>
                                        Total: <b>{totalRows}</b> rows
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => setPagination(p => ({ ...p, page: 1 }))} disabled={pagination.page === 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"><ChevronsLeft size={18} /></button>
                                        <button onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))} disabled={pagination.page === 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"><ChevronLeft size={18} /></button>
                                        <button onClick={() => setPagination(p => ({ ...p, page: Math.min(totalPages, p.page + 1) }))} disabled={pagination.page >= totalPages} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"><ChevronRight size={18} /></button>
                                        <button onClick={() => setPagination(p => ({ ...p, page: totalPages }))} disabled={pagination.page >= totalPages} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"><ChevronsRight size={18} /></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-between items-start mt-1">
                            <p className="text-slate-400 text-xs italic">Based on {allFilteredRows.filter((r: any) => r.type === 'data').length} open positions.</p>
                            {hasEstimatedPrices && (<div className="text-right"><p className="text-xs text-orange-500 italic">* Estimated price (Historical Cost used).</p></div>)}
                        </div>
                    </div>
                </div>

                <TableSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={viewSettings} onUpdate={setViewSettings} allColumns={INITIAL_COLUMNS} />
            </div>
        </div>
    );
}