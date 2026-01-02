import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import {
    Plus, Search, Filter, Settings, Download, X,
    TrendingUp, TrendingDown, GripVertical, Check, ArrowUp, ArrowDown, ChevronRight, ChevronDown,
    FileText, FileSpreadsheet, List, LineChart as LineChartIcon, BarChart3, AlertTriangle, Info,
    Calendar, Loader2, XCircle
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import * as XLSX from 'xlsx';

// IMPORT MODULI CONDIVISI
import { TableSettingsModal } from '../components/TableSettingsModal';
import { useTableLogic } from '../hooks/useTableLogic';
import { ColumnDef, SortRule } from '../types/table';

// --- CONFIGURAZIONE ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const PYTHON_API_URL = "https://invest-monitor-api.onrender.com";

// --- DEFINIZIONE COLONNE ---
const ALL_COLUMNS: ColumnDef[] = [
    { id: 'transaction_id', label: 'ID', visible: false, width: 80, type: 'number', align: 'left' },
    { id: 'operation_date', label: 'Date', visible: true, width: 100, type: 'date', align: 'left' },
    { id: 'ticker', label: 'Ticker', visible: true, width: 80, type: 'text', align: 'left' },
    { id: 'buy_or_sell', label: 'Side', visible: true, width: 80, type: 'text', align: 'center' },
    { id: 'shares_count', label: 'Shares', visible: true, width: 90, type: 'number', align: 'right' },
    { id: 'purchase_price_per_share_eur', label: 'Price (€)', visible: true, width: 100, type: 'number', align: 'right' },
    { id: 'total_outlay_eur', label: 'Total (€)', visible: true, width: 110, type: 'number', align: 'right' },
    { id: 'person', label: 'Person', visible: true, width: 100, type: 'text', align: 'left' },
    { id: 'category', label: 'Category', visible: false, width: 100, type: 'text', align: 'left' },
    { id: 'asset_currency', label: 'Curr.', visible: false, width: 60, type: 'text', align: 'center' },
    { id: 'exchange_rate_at_purchase', label: 'FX Rate', visible: false, width: 80, type: 'number', align: 'right' },
    { id: 'transaction_fees_eur', label: 'Fees (€)', visible: false, width: 80, type: 'number', align: 'right' },
    { id: 'transaction_taxes_eur', label: 'Taxes (€)', visible: false, width: 80, type: 'number', align: 'right' },
    { id: 'platform', label: 'Platform', visible: false, width: 100, type: 'text', align: 'left' },
    { id: 'account_owner', label: 'Account', visible: false, width: 100, type: 'text', align: 'left' },
    { id: 'sector', label: 'Sector', visible: false, width: 100, type: 'text', align: 'left' },
    { id: 'created_at', label: 'Created At', visible: false, width: 120, type: 'date', align: 'left' },
];

const PEOPLE_OPTIONS = ["Ale", "Peppe", "Raff"];

// --- HEADER CELL COMPONENT (ESTRATTO PER PRESTAZIONI E FIX REACT) ---
const HeaderCell = ({
    col, index, rawData, activeSort, columnFilters, activeFilterCol, filterSearchTerm,
    onSort, onResize, onMove, onToggleFilter, onFilterClick, setFilterSearchTerm, onClearFilter, setActiveFilterCol
}: any) => {
    const [w, setW] = useState(col.width);
    const headerFilterRef = useRef < HTMLDivElement > (null);

    useEffect(() => setW(col.width), [col.width]);

    // Click outside per chiudere il filtro locale
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (activeFilterCol === col.id && headerFilterRef.current && !headerFilterRef.current.contains(event.target as Node)) {
                setActiveFilterCol(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [activeFilterCol, col.id, setActiveFilterCol]);

    const uniqueVals = useMemo(() => Array.from(new Set(rawData.map((item: any) => String(item[col.id] || '')))).sort(), [col.id, rawData]);
    const filteredVals = uniqueVals.filter((v: string) => v.toLowerCase().includes(filterSearchTerm.toLowerCase()));

    const handleDragStart = (e: React.DragEvent) => { e.dataTransfer.setData("colIndex", index.toString()); e.dataTransfer.effectAllowed = "move"; };
    const handleDrop = (e: React.DragEvent) => { e.preventDefault(); const fromIndex = parseInt(e.dataTransfer.getData("colIndex")); onMove(fromIndex, index); };

    const onMouseDown = (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        const startX = e.pageX; const startW = w;
        const onMouseMove = (e: MouseEvent) => setW(Math.max(50, startW + (e.pageX - startX)));
        const onMouseUp = (e: MouseEvent) => { onResize(index, Math.max(50, startW + (e.pageX - startX))); document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
        document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
    };

    return (
        <th style={{ width: w }} draggable onDragStart={handleDragStart} onDragOver={e => e.preventDefault()} onDrop={handleDrop} className={`px-4 py-3 relative group cursor-grab active:cursor-grabbing select-none hover:bg-slate-100 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
            <div className={`flex items-center gap-2 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                <span onClick={() => onSort(col.id)} className="cursor-pointer font-bold flex items-center gap-1 hover:text-blue-600 text-xs uppercase tracking-wider text-gray-600">
                    {col.label} {activeSort && (activeSort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </span>
                <button onClick={(e) => { e.stopPropagation(); onFilterClick(col.id); }} className={`p-1 rounded hover:bg-slate-200 transition-opacity ${activeFilterCol === col.id || columnFilters[col.id]?.length ? 'opacity-100 text-blue-600' : 'opacity-0 group-hover:opacity-100 text-slate-400'}`}><Filter size={12} fill={columnFilters[col.id]?.length ? "currentColor" : "none"} /></button>
            </div>
            {activeFilterCol === col.id && (
                <div ref={headerFilterRef} className="absolute top-full left-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-200 z-50 p-2 cursor-default text-left font-normal" onClick={e => e.stopPropagation()}>
                    <div className="relative mb-2"><Search size={12} className="absolute left-2 top-2.5 text-slate-400" /><input autoFocus type="text" placeholder="Search..." className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none" value={filterSearchTerm} onChange={e => setFilterSearchTerm(e.target.value)} /></div>
                    <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
                        {filteredVals.map((val: string) => {
                            const isSel = columnFilters[col.id]?.includes(val);
                            return (<label key={val} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-xs"><div className={`w-3 h-3 border rounded flex items-center justify-center ${isSel ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>{isSel && <Check size={10} className="text-white" />}</div><span className="truncate">{val || '(Empty)'}</span><input type="checkbox" className="hidden" checked={!!isSel} onChange={() => onToggleFilter(col.id, val)} /></label>)
                        })}
                    </div>
                    <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between"><button onClick={() => onClearFilter(col.id)} className="text-xs text-slate-500 hover:text-slate-800">Clear</button><button onClick={() => setActiveFilterCol(null)} className="text-xs text-blue-600 font-medium">Done</button></div>
                </div>
            )}
            <div onMouseDown={onMouseDown} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 group-hover:bg-slate-300 transition-colors z-10" />
        </th>
    );
};


export default function Transactions() {
    const router = useRouter();
    const [supabase, setSupabase] = useState < any > (null);
    const [rawTransactions, setRawTransactions] = useState < any[] > ([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState < string | null > (null);

    // --- VIEW SETTINGS & LOGIC ---
    const [columnFilters, setColumnFilters] = useState < Record < string, string[]>> ({});
    const [activeFilterCol, setActiveFilterCol] = useState < string | null > (null);
    const [filterSearchTerm, setFilterSearchTerm] = useState("");

    // UI States
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPlotModalOpen, setIsPlotModalOpen] = useState(false);
    const [plotConfig, setPlotConfig] = useState({ x: 'operation_date', y: 'total_outlay_eur' });

    // Refs
    const downloadRef = useRef < HTMLDivElement > (null);

    const [formData, setFormData] = useState({
        type: 'Buy', people: [] as string[], security: '', date: new Date().toISOString().split('T')[0],
        price: '', currency: 'EUR', exchange_rate: '1', shares_single: '', shares_multi: {} as Record<string, string>,
        platform: '', account_owner: '', regulated: 'Yes', expenses: '0', taxes: '0',
    });

    // --- INIT ---
    useEffect(() => {
        if (!SUPABASE_URL || !SUPABASE_KEY) {
            setError("Supabase config missing."); setLoading(false); return;
        }

        if (!(window as any).supabase) {
            const script = document.createElement('script');
            script.src = "https://unpkg.com/@supabase/supabase-js@2";
            script.async = true;
            script.onload = () => setSupabase((window as any).supabase.createClient(SUPABASE_URL, SUPABASE_KEY));
            document.body.appendChild(script);
        } else {
            setSupabase((window as any).supabase.createClient(SUPABASE_URL, SUPABASE_KEY));
        }

        if (!(window as any).XLSX) {
            const script = document.createElement('script');
            script.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
            script.async = true;
            document.body.appendChild(script);
        }

        const handleClickOutside = (e: MouseEvent) => {
            if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) setIsDownloadOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch Data
    const fetchTransactions = useCallback(async () => {
        if (!supabase) return;
        setLoading(true);
        try {
            const { data, error } = await supabase.from('transactions').select('*').order('operation_date', { ascending: false });
            if (error) throw error;
            setRawTransactions(data || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => { if (supabase) fetchTransactions(); }, [supabase, fetchTransactions]);

    // --- HOOK TABLE LOGIC ---
    // Passiamo rawTransactions direttamente. L'hook gestisce tutto (filtri, sort, group).
    const {
        viewSettings, setViewSettings, processedRows, visibleColumns
    } = useTableLogic(rawTransactions, ALL_COLUMNS, columnFilters);

    // --- CALCOLO TOTALI ---
    const totals = useMemo(() => {
        const dataRows = processedRows.filter(r => r.type === 'data').map(r => (r as any).data);
        return dataRows.reduce((acc, item) => ({
            total_outlay_eur: acc.total_outlay_eur + (item.total_outlay_eur || 0),
            shares_count: acc.shares_count + (item.shares_count || 0),
            transaction_fees_eur: acc.transaction_fees_eur + (item.transaction_fees_eur || 0),
            transaction_taxes_eur: acc.transaction_taxes_eur + (item.transaction_taxes_eur || 0),
        }), { total_outlay_eur: 0, shares_count: 0, transaction_fees_eur: 0, transaction_taxes_eur: 0 });
    }, [processedRows]);

    // --- CHART DATA PREP ---
    const chartData = useMemo(() => {
        const dataRows = processedRows.filter(r => r.type === 'data').map(r => (r as any).data);
        if (!dataRows.length) return [];
        return [...dataRows]
            .map(item => ({
                ...item,
                displayX: new Date(item[plotConfig.x]).toLocaleDateString('it-IT'),
                valX: item[plotConfig.x],
                valY: Number(item[plotConfig.y]) || 0
            }))
            .sort((a, b) => a.valX < b.valX ? -1 : 1);
    }, [processedRows, plotConfig]);

    // --- ACTIONS ---
    const handleSort = (key: string) => {
        const currentSort = viewSettings.sorts.find(s => s.columnId === key);
        const newDirection = currentSort?.direction === 'asc' ? 'desc' : 'asc';
        setViewSettings(prev => ({ ...prev, sorts: [{ id: 'quick', columnId: key, direction: newDirection }] }));
    };

    const handleResize = useCallback((idx: number, w: number) => {
        setViewSettings(prev => { const cols = [...prev.columns]; cols[idx] = { ...cols[idx], width: w }; return { ...prev, columns: cols }; });
    }, []);

    const moveColumn = useCallback((from: number, to: number) => {
        if (from === to) return;
        setViewSettings(prev => { const cols = [...prev.columns]; const [moved] = cols.splice(from, 1); cols.splice(to, 0, moved); return { ...prev, columns: cols }; });
    }, []);

    const toggleColumnFilter = (colKey: string, value: string) => {
        setColumnFilters(prev => {
            const current = prev[colKey] || [];
            const updated = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
            return { ...prev, [colKey]: updated };
        });
    };

    const handleHeaderFilterClick = (colKey: string | null) => {
        setActiveFilterCol(colKey);
        setFilterSearchTerm("");
    };

    const handleClearColFilter = (colKey: string) => {
        setColumnFilters(prev => ({ ...prev, [colKey]: [] }));
    };

    // --- FORM ACTIONS ---
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const togglePerson = (person: string) => {
        setFormData(prev => {
            const current = prev.people;
            if (current.includes(person)) {
                const newPeople = current.filter(p => p !== person);
                const newShares = { ...prev.shares_multi }; delete newShares[person];
                return { ...prev, people: newPeople, shares_multi: newShares };
            }
            return { ...prev, people: [...current, person] };
        });
    };

    const handleSubmit = async () => {
        if (formData.people.length === 0 || !formData.security || !formData.price) {
            alert("Please fill required fields."); return;
        }
        setLoading(true);
        try {
            const response = await fetch(`${PYTHON_API_URL}/process_transaction`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.detail || "Error");
            alert(result.message); setIsModalOpen(false); await fetchTransactions();
        } catch (e: any) { alert(`Error: ${e.message}`); } finally { setLoading(false); }
    };

    // --- EXPORT ---
    const exportData = (format: 'csv' | 'xlsx') => {
        const dataRows = processedRows.filter(r => r.type === 'data').map(r => (r as any).data);
        const ws = XLSX.utils.json_to_sheet(dataRows);
        const fname = `transactions_${new Date().toISOString().split('T')[0]}`;

        if (format === 'csv') {
            const csv = XLSX.utils.sheet_to_csv(ws);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a'); link.href = url; link.download = `${fname}.csv`; link.click();
        } else {
            const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Data"); XLSX.writeFile(wb, `${fname}.xlsx`);
        }
        setIsDownloadOpen(false);
    };

    // --- RENDER HELPERS ---
    const fmt = (val: any, type: string) => {
        if (val === null || val === undefined) return '-';
        if (type === 'date') return new Date(val).toLocaleDateString('it-IT');
        if (type === 'number') return typeof val === 'number' ? val.toLocaleString('it-IT', { maximumFractionDigits: 2 }) : val;
        return String(val);
    };

    return (
        <main className="min-h-screen p-8 bg-gray-50 font-sans">
            <div className="max-w-[1920px] mx-auto">
                {/* HEADER */}
                <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">Transactions</h1>

                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full font-medium shadow-sm transition-transform hover:-translate-y-0.5"><Plus size={18} /> Add</button>
                        <button onClick={() => setIsPlotModalOpen(true)} className="flex items-center gap-2 bg-white hover:bg-purple-50 text-purple-600 border border-purple-200 px-4 py-2 rounded-full font-medium shadow-sm transition-transform hover:-translate-y-0.5"><LineChartIcon size={18} /> Plot</button>

                        <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 shadow-sm"><Settings size={18} /></button>

                        <div className="relative" ref={downloadRef}>
                            <button onClick={() => setIsDownloadOpen(!isDownloadOpen)} className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 shadow-sm"><Download size={18} /></button>
                            {isDownloadOpen && (<div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2"><button onClick={() => exportData('csv')} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded text-sm text-slate-700"><FileText size={16} className="text-green-500" /> Export CSV</button><button onClick={() => exportData('xlsx')} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded text-sm text-slate-700"><FileSpreadsheet size={16} className="text-emerald-600" /> Export XLSX</button></div>)}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-6">
                    {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>}

                    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden relative min-h-[500px]">
                        {loading && <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center text-slate-500"><Loader2 size={32} className="animate-spin text-blue-600 mb-2" /> <p>Loading...</p></div>}
                        <div className="overflow-x-auto min-h-[500px]">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-200">
                                    <tr>
                                        {visibleColumns.map((col, i) => (
                                            <HeaderCell
                                                key={col.id}
                                                col={col}
                                                index={i}
                                                rawData={rawTransactions}
                                                activeSort={viewSettings.sorts.find(s => s.columnId === col.id)}
                                                columnFilters={columnFilters}
                                                activeFilterCol={activeFilterCol}
                                                filterSearchTerm={filterSearchTerm}
                                                onSort={handleSort}
                                                onResize={handleResize}
                                                onMove={moveColumn}
                                                onToggleFilter={toggleColumnFilter}
                                                onFilterClick={handleHeaderFilterClick}
                                                setFilterSearchTerm={setFilterSearchTerm}
                                                onClearFilter={handleClearColFilter}
                                                setActiveFilterCol={setActiveFilterCol}
                                            />
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {processedRows.map((row: any, idx: number) => {
                                        if (row.type === 'group_header') {
                                            return (<tr key={`group-${idx}`} className="bg-gray-100 border-t border-gray-300"><td colSpan={visibleColumns.length} className="px-4 py-2 font-bold text-gray-700"><div className="flex items-center gap-2" style={{ paddingLeft: `${row.level * 20}px` }}><ChevronRight size={16} /> <span className="text-xs uppercase text-gray-500">{row.field}:</span> {row.value}</div></td></tr>);
                                        }
                                        const item = row.data;
                                        return (
                                            <tr key={item.transaction_id || idx} className="hover:bg-slate-50/50 transition-colors">
                                                {visibleColumns.map(col => {
                                                    const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
                                                    let val = item[col.id];
                                                    let content: React.ReactNode = fmt(val, col.type);

                                                    if (col.id === 'buy_or_sell') content = <span className={`px-2 py-1 rounded-full text-xs font-medium ${val === 'Buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.category || val}</span>;
                                                    else if (col.id === 'ticker') content = <span className="font-bold text-slate-800">{val}</span>;

                                                    return <td key={col.id} className={`px-4 py-3 ${alignClass}`}>{content}</td>;
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                {/* FOOTER TOTALI */}
                                {processedRows.some((r: any) => r.type === 'data') && (
                                    <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-800 sticky bottom-0">
                                        <tr>{visibleColumns.map(col => {
                                            const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
                                            let content: React.ReactNode = '';
                                            if (col.id === 'ticker') content = "TOTAL";
                                            else if (col.id === 'total_outlay_eur') content = fmt(totals.total_outlay_eur, 'number');
                                            else if (col.id === 'shares_count') content = fmt(totals.shares_count, 'number');
                                            else if (col.id === 'transaction_fees_eur') content = fmt(totals.transaction_fees_eur, 'number');
                                            else if (col.id === 'transaction_taxes_eur') content = fmt(totals.transaction_taxes_eur, 'number');
                                            return <td key={col.id} className={`px-4 py-3 ${alignClass}`}>{content}</td>;
                                        })}</tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </div>

                {/* MODALS */}
                <TableSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={viewSettings} onUpdate={setViewSettings} allColumns={ALL_COLUMNS} />

                {/* PLOT MODAL */}
                {isPlotModalOpen && (
                    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-6">
                            <div className="flex justify-between mb-4">
                                <h2 className="text-xl font-bold">Plot Data</h2>
                                <button onClick={() => setIsPlotModalOpen(false)}><X size={24} className="text-gray-400 hover:text-gray-600" /></button>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <select className="p-2 border rounded" value={plotConfig.x} onChange={e => setPlotConfig(p => ({ ...p, x: e.target.value }))}>{ALL_COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
                                <select className="p-2 border rounded" value={plotConfig.y} onChange={e => setPlotConfig(p => ({ ...p, y: e.target.value }))}>{ALL_COLUMNS.filter(c => c.type === 'number').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
                            </div>
                            <div className="h-[400px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="displayX" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="valY" stroke="#8884d8" name={ALL_COLUMNS.find(c => c.id === plotConfig.y)?.label} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}

                {/* ADD TRANSACTION MODAL */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl w-full max-w-2xl p-6 relative">
                            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4"><X size={24} /></button>
                            <h2 className="text-xl font-bold mb-4">Add Transaction</h2>
                            <div className="grid gap-4">
                                <div className="flex gap-2">
                                    <button onClick={() => setFormData(p => ({ ...p, type: 'Buy' }))} className={`flex-1 py-2 rounded border ${formData.type === 'Buy' ? 'bg-green-100 border-green-500 text-green-700' : ''}`}>Buy</button>
                                    <button onClick={() => setFormData(p => ({ ...p, type: 'Sell' }))} className={`flex-1 py-2 rounded border ${formData.type === 'Sell' ? 'bg-red-100 border-red-500 text-red-700' : ''}`}>Sell</button>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    {PEOPLE_OPTIONS.map(p => (
                                        <button key={p} onClick={() => togglePerson(p)} className={`px-3 py-1 rounded border ${formData.people.includes(p) ? 'bg-blue-600 text-white' : ''}`}>{p}</button>
                                    ))}
                                </div>
                                <input placeholder="Ticker (e.g. AAPL)" className="p-2 border rounded" name="security" value={formData.security} onChange={handleInputChange} />
                                <input type="number" placeholder="Price" className="p-2 border rounded" name="price" value={formData.price} onChange={handleInputChange} />
                                <input type="date" className="p-2 border rounded" name="date" value={formData.date} onChange={handleInputChange} />
                                <button onClick={handleSubmit} className="bg-blue-600 text-white py-2 rounded">Submit</button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </main>
    );
}