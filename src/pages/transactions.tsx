import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import {
    Plus, Settings, Download, X,
    ArrowUp, ArrowDown, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight,
    FileText, FileSpreadsheet, LineChart as LineChartIcon, AlertTriangle,
    Loader2
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import * as XLSX from 'xlsx';

// IMPORT MODULI CONDIVISI
import { TableSettingsModal } from '../components/TableSettingsModal';
import { useTableLogic } from '../hooks/useTableLogic';
import { ColumnDef } from '../types/table';

// --- CONFIGURAZIONE ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const PYTHON_API_URL = "https://invest-monitor-api.onrender.com";

const PEOPLE_OPTIONS = ["Ale", "Peppe", "Raff"];

// --- HEADER CELL COMPONENT ---
const HeaderCell = ({ col, index, activeSort, onSort, onResize, onMove, currencySymbol }: any) => {
    const [w, setW] = useState(col.width);

    useEffect(() => setW(col.width), [col.width]);

    const handleDragStart = (e: React.DragEvent) => { e.dataTransfer.setData("colIndex", index.toString()); e.dataTransfer.effectAllowed = "move"; };
    const handleDrop = (e: React.DragEvent) => { e.preventDefault(); const fromIndex = parseInt(e.dataTransfer.getData("colIndex")); onMove(fromIndex, index); };

    const onMouseDown = (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        const startX = e.pageX; const startW = w;
        const onMouseMove = (e: MouseEvent) => setW(Math.max(50, startW + (e.pageX - startX)));
        const onMouseUp = (e: MouseEvent) => { onResize(index, Math.max(50, startW + (e.pageX - startX))); document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
        document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
    };

    // Replace placeholder currency in label
    const label = col.label.replace('(User)', `(${currencySymbol})`);

    return (
        <th style={{ width: w }} draggable onDragStart={handleDragStart} onDragOver={e => e.preventDefault()} onDrop={handleDrop} className={`px-4 py-3 relative group cursor-grab active:cursor-grabbing select-none hover:bg-slate-100 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
            <div className={`flex items-center gap-2 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`} onClick={() => onSort(col.id)}>
                <span className="cursor-pointer font-bold flex items-center gap-1 hover:text-blue-600 text-xs uppercase tracking-wider text-gray-600">
                    {label} {activeSort && (activeSort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </span>
            </div>
            <div onMouseDown={onMouseDown} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 group-hover:bg-slate-300 transition-colors z-10" />
        </th>
    );
};

export default function Transactions() {
    const router = useRouter();
    const [supabase, setSupabase] = useState < any > (null);
    const [userId, setUserId] = useState < string | null > (null);
    const [userCurrency, setUserCurrency] = useState('EUR'); // Default
    const [rawTransactions, setRawTransactions] = useState < any[] > ([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState < string | null > (null);

    // --- DEFINIZIONE COLONNE (AGGIORNATA CON _user_curr) ---
    // Usiamo "(User)" come placeholder che verrà sostituito dal simbolo reale
    const ALL_COLUMNS: ColumnDef[] = useMemo(() => [
        { id: 'id', label: 'ID', visible: false, width: 80, type: 'number', align: 'left' },
        { id: 'operation_date', label: 'Date', visible: true, width: 100, type: 'date', align: 'left' },
        { id: 'ticker', label: 'Ticker', visible: true, width: 80, type: 'text', align: 'left' },
        { id: 'buy_or_sell', label: 'Side', visible: true, width: 80, type: 'text', align: 'center' },
        { id: 'shares_count', label: 'Shares', visible: true, width: 90, type: 'number', align: 'right' },
        { id: 'price_per_share_user_curr', label: 'Price (User)', visible: true, width: 110, type: 'number', align: 'right' },
        { id: 'total_outlay_user_curr', label: 'Total (User)', visible: true, width: 120, type: 'number', align: 'right' },
        { id: 'person', label: 'Person', visible: true, width: 100, type: 'text', align: 'left' },
        { id: 'asset_currency', label: 'Asset Curr.', visible: false, width: 80, type: 'text', align: 'center' },
        { id: 'price_per_share_asset_curr', label: 'Price (Asset)', visible: false, width: 110, type: 'number', align: 'right' },
        { id: 'exchange_rate_at_purchase', label: 'FX Rate', visible: false, width: 80, type: 'number', align: 'right' },
        { id: 'transaction_fees_user_curr', label: 'Fees (User)', visible: false, width: 90, type: 'number', align: 'right' },
        { id: 'transaction_taxes_user_curr', label: 'Taxes (User)', visible: false, width: 90, type: 'number', align: 'right' },
        { id: 'platform', label: 'Platform', visible: false, width: 100, type: 'text', align: 'left' },
        { id: 'account_owner', label: 'Account', visible: false, width: 100, type: 'text', align: 'left' },
        { id: 'category', label: 'Category', visible: false, width: 100, type: 'text', align: 'left' },
        { id: 'created_at', label: 'Created At', visible: false, width: 120, type: 'date', align: 'left' },
        { id: 'transaction_id', label: 'Trans_ID', visible: false, width: 80, type: 'number', align: 'left' },
    ], []);

    // --- UI STATES ---
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPlotModalOpen, setIsPlotModalOpen] = useState(false);
    // Updated plot config to new column names
    const [plotConfig, setPlotConfig] = useState({ x: 'operation_date', y: 'total_outlay_user_curr' });

    const downloadRef = useRef < HTMLDivElement > (null);

    const [formData, setFormData] = useState({
        type: 'Buy', people: [] as string[], security: '', date: new Date().toISOString().split('T')[0],
        price: '', currency: 'EUR', exchange_rate: '1', shares_single: '', shares_multi: {} as Record<string, string>,
        platform: '', account_owner: '', regulated: 'Yes', expenses: '0', taxes: '0',
    });

    // --- INIT ---
    useEffect(() => {
        if (!SUPABASE_URL || !SUPABASE_KEY) {
            setError("Supabase config missing.");
            setLoading(false);
            return;
        }

        const client = createClient(SUPABASE_URL, SUPABASE_KEY);
        setSupabase(client);

        const initSession = async () => {
            const { data: { session } } = await client.auth.getSession();
            if (session) {
                setUserId(session.user.id);
                // Fetch User Currency Preference
                const { data } = await client.from('users').select('currency').eq('user_id', session.user.id).single();
                if (data?.currency) setUserCurrency(data.currency);
            }
        };
        initSession();

        if (!(window as any).XLSX) {
            const script = document.createElement('script');
            script.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
            script.async = true;
            document.body.appendChild(script);
        }

        const handleClickOutside = (e: MouseEvent) => {
            if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) {
                setIsDownloadOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch Data
    const fetchTransactions = useCallback(async () => {
        if (!supabase) return;
        setLoading(true);
        try {
            // RLS automatically filters by user_id
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

    useEffect(() => {
        if (router.isReady && router.query.add === 'true') {
            setIsModalOpen(true);
            router.replace('/transactions', undefined, { shallow: true });
        }
    }, [router.isReady, router.query.add]);

    // --- HOOK TABLE LOGIC ---
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
    } = useTableLogic(rawTransactions, ALL_COLUMNS, 25);

    // --- CALCOLO TOTALI (Aggiornato con nuovi nomi colonne) ---
    const totals = useMemo(() => {
        const dataRows = allFilteredRows.filter(r => r.type === 'data').map(r => (r as any).data);
        return dataRows.reduce((acc, item) => ({
            total_outlay_user_curr: acc.total_outlay_user_curr + (item.total_outlay_user_curr || 0),
            shares_count: acc.shares_count + (item.shares_count || 0),
            transaction_fees_user_curr: acc.transaction_fees_user_curr + (item.transaction_fees_user_curr || 0),
            transaction_taxes_user_curr: acc.transaction_taxes_user_curr + (item.transaction_taxes_user_curr || 0),
        }), { total_outlay_user_curr: 0, shares_count: 0, transaction_fees_user_curr: 0, transaction_taxes_user_curr: 0 });
    }, [allFilteredRows]);

    // --- CHART DATA PREP ---
    const chartData = useMemo(() => {
        const dataRows = allFilteredRows.filter(r => r.type === 'data').map(r => (r as any).data);
        if (!dataRows.length) return [];
        return [...dataRows]
            .map(item => ({
                ...item,
                displayX: new Date(item[plotConfig.x]).toLocaleDateString('it-IT'),
                valX: item[plotConfig.x],
                valY: Number(item[plotConfig.y]) || 0
            }))
            .sort((a, b) => a.valX < b.valX ? -1 : 1);
    }, [allFilteredRows, plotConfig]);

    // --- ACTIONS ---
    const handleSort = (key: string) => {
        const currentSort = viewSettings.sorts.find(s => s.columnId === key);
        const newDirection = currentSort?.direction === 'asc' ? 'desc' : 'asc';
        setViewSettings(prev => ({ ...prev, sorts: [{ id: 'quick', columnId: key, direction: newDirection }] }));
    };

    const handleResize = useCallback((idx: number, w: number) => {
        setViewSettings(prev => {
            const cols = [...prev.columns]; cols[idx] = { ...cols[idx], width: w }; return { ...prev, columns: cols };
        });
    }, []);

    const moveColumn = useCallback((from: number, to: number) => {
        if (from === to) return;
        setViewSettings(prev => {
            const cols = [...prev.columns]; const [moved] = cols.splice(from, 1); cols.splice(to, 0, moved); return { ...prev, columns: cols };
        });
    }, []);

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

        if (!userId) {
            alert("User not logged in."); return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${PYTHON_API_URL}/process_transaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    user_id: userId
                })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.detail || "Error");

            alert(result.message);
            setIsModalOpen(false);
            await fetchTransactions();
        } catch (e: any) { alert(`Error: ${e.message}`); } finally { setLoading(false); }
    };

    // --- EXPORT ---
    const exportData = (format: 'csv' | 'xlsx') => {
        const ws = XLSX.utils.json_to_sheet(exportableRows);
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
        // Usiamo la valuta utente per formattare
        if (type === 'number') {
            return typeof val === 'number'
                ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: userCurrency }).format(val)
                : val;
        }
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

                        <div className="h-6 w-px bg-slate-300 mx-1"></div>

                        <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 shadow-sm"><Settings size={18} /></button>

                        <div className="relative" ref={downloadRef}>
                            <button onClick={() => setIsDownloadOpen(!isDownloadOpen)} className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 shadow-sm"><Download size={18} /></button>
                            {isDownloadOpen && (<div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2"><button onClick={() => exportData('csv')} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded text-sm text-slate-700"><FileText size={16} className="text-green-500" /> Export CSV</button><button onClick={() => exportData('xlsx')} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded text-sm text-slate-700"><FileSpreadsheet size={16} className="text-emerald-600" /> Export XLSX</button></div>)}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-6">
                    {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>}

                    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden relative flex flex-col min-h-[500px]">
                        {loading && <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center text-slate-500"><Loader2 size={32} className="animate-spin text-blue-600 mb-2" /> <p>Loading...</p></div>}

                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-200">
                                    <tr>
                                        {visibleColumns.map((col, i) => (
                                            <HeaderCell
                                                key={col.id}
                                                col={col}
                                                index={i}
                                                activeSort={viewSettings.sorts.find(s => s.columnId === col.id)}
                                                onSort={handleSort}
                                                onResize={handleResize}
                                                onMove={moveColumn}
                                                currencySymbol={userCurrency === 'USD' ? '$' : userCurrency === 'GBP' ? '£' : '€'}
                                            />
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {paginatedRows.map((row: any, idx: number) => {
                                        if (row.type === 'group_header') {
                                            return (<tr key={`group-${idx}`} className="bg-gray-100 border-t border-gray-300"><td colSpan={visibleColumns.length} className="px-4 py-2 font-bold text-gray-700"><div className="flex items-center gap-2" style={{ paddingLeft: `${row.level * 20}px` }}><ChevronRight size={16} /> <span className="text-xs uppercase text-gray-500">{row.field}:</span> {row.value}</div></td></tr>);
                                        }
                                        const item = row.data;
                                        return (
                                            <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                                                {visibleColumns.map(col => {
                                                    const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
                                                    const val = item[col.id];
                                                    let content: React.ReactNode = fmt(val, col.type);

                                                    if (col.id === 'buy_or_sell') content = <span className={`px-2 py-1 rounded-full text-xs font-medium ${val === 'Buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.category || val}</span>;
                                                    else if (col.id === 'ticker') content = <span className="font-bold text-slate-800">{val}</span>;

                                                    return <td key={col.id} className={`px-4 py-3 ${alignClass}`}>{content}</td>;
                                                })}
                                            </tr>
                                        );
                                    })}

                                    {paginatedRows.length === 0 && !loading && (
                                        <tr><td colSpan={visibleColumns.length} className="p-8 text-center text-gray-400">No transactions found.</td></tr>
                                    )}
                                </tbody>

                                {allFilteredRows.some((r: any) => r.type === 'data') && (
                                    <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-800 sticky bottom-0">
                                        <tr>{visibleColumns.map(col => {
                                            const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
                                            let content: React.ReactNode = '';
                                            if (col.id === 'ticker') content = "TOTAL";
                                            else if (col.id === 'total_outlay_user_curr') content = fmt(totals.total_outlay_user_curr, 'number');
                                            else if (col.id === 'shares_count') content = fmt(totals.shares_count, 'number');
                                            else if (col.id === 'transaction_fees_user_curr') content = fmt(totals.transaction_fees_user_curr, 'number');
                                            else if (col.id === 'transaction_taxes_user_curr') content = fmt(totals.transaction_taxes_user_curr, 'number');
                                            return <td key={col.id} className={`px-4 py-3 ${alignClass}`}>{content}</td>;
                                        })}</tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        {/* Pagination Section (Identica a prima) */}
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
                </div>
            </div>

            <TableSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={viewSettings} onUpdate={setViewSettings} allColumns={ALL_COLUMNS} />

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

            {/* MODAL ADD - NON MODIFICATO NELLA STRUTTURA VISIVA, SOLO NELLE FUNZIONI DI SUBMIT GIA' AGGIORNATE SOPRA */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-2xl p-6 relative">
                        <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4"><X size={24} /></button>
                        <h2 className="text-xl font-bold mb-4">Add Transaction</h2>
                        <div className="grid gap-4">
                            {/* ... FORM IDENTICO A PRIMA, SOLO LOGICA SUBMIT AGGIORNATA ... */}
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
                            <div className="flex gap-2">
                                <input type="number" placeholder="Price" className="flex-1 p-2 border rounded" name="price" value={formData.price} onChange={handleInputChange} />
                                <select className="p-2 border rounded w-24" name="currency" value={formData.currency} onChange={handleInputChange}>
                                    <option value="EUR">EUR</option>
                                    <option value="USD">USD</option>
                                    <option value="GBP">GBP</option>
                                </select>
                            </div>
                            {/* SE LA VALUTA NON È QUELLA DELL'UTENTE, MOSTRA IL CAMPO CAMBIO */}
                            {formData.currency !== userCurrency && (
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-500">Exchange Rate (1 {userCurrency} = ? {formData.currency})</label>
                                    <input type="number" placeholder="Exchange Rate" className="p-2 border rounded" name="exchange_rate" value={formData.exchange_rate} onChange={handleInputChange} />
                                </div>
                            )}
                            <input type="date" className="p-2 border rounded" name="date" value={formData.date} onChange={handleInputChange} />
                            <button onClick={handleSubmit} className="bg-blue-600 text-white py-2 rounded">Submit</button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}