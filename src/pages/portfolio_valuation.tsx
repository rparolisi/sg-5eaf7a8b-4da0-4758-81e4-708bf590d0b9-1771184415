import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
    ArrowUpRight, ArrowDownRight, Wallet, Loader2, Search, Filter,
    ChevronDown, Calendar, XCircle, TrendingUp, Settings, Download,
    FileText, FileSpreadsheet, GripVertical, Check, ArrowUp, ArrowDown,
    Plus, Trash2, Layers, X, ChevronRight, GripHorizontal
} from 'lucide-react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import * as XLSX from 'xlsx';

// --- CONFIGURAZIONE ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const PYTHON_API_BASE_URL = "https://invest-monitor-api.onrender.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- COMPONENTE MULTI-SELECT (Sidebar) ---
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

// --- TIPI AVANZATI PER VIEW SETTINGS ---
type FilterOperator = 'contains' | 'equals' | 'greater' | 'less' | 'between';
type FilterType = 'include' | 'exclude';

interface FilterRule {
    id: string;
    columnId: string;
    type: FilterType;
    operator: FilterOperator;
    value: string;
    value2?: string;
}

interface SortRule {
    id: string;
    columnId: string;
    direction: 'asc' | 'desc';
}

interface GroupRule {
    id: string;
    columnId: string;
}

interface ColumnDef {
    id: string;
    label: string;
    visible: boolean;
    width: number;
    type: 'text' | 'number' | 'date';
    align: 'left' | 'right' | 'center';
}

interface ViewSettings {
    columns: ColumnDef[];
    filters: FilterRule[];
    sorts: SortRule[];
    groups: GroupRule[];
}

// --- INTERFACCE DATI ---
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
    id: string;
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
    [key: string]: any;
}

type TableRow =
    | { type: 'data', data: PortfolioItem }
    | { type: 'group_header', key: string, value: any, level: number, field: string }
    | { type: 'group_footer', key: string, level: number, aggregates: any };

// --- COSTANTI ---
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

// --- SETTINGS MODAL (SAP STYLE) ---
const SettingsModal = ({
    isOpen, onClose, settings, onUpdate, allColumns
}: {
    isOpen: boolean, onClose: () => void, settings: ViewSettings, onUpdate: (s: ViewSettings) => void, allColumns: ColumnDef[]
}) => {
    const [activeTab, setActiveTab] = useState < 'columns' | 'sort' | 'filter' | 'group' > ('columns');
    const [localSettings, setLocalSettings] = useState < ViewSettings > (settings);
    const [draggedItemIndex, setDraggedItemIndex] = useState < number | null > (null);

    useEffect(() => { if (isOpen) setLocalSettings(settings); }, [isOpen, settings]);

    const handleSave = () => { onUpdate(localSettings); onClose(); };

    if (!isOpen) return null;

    // --- LOGICA COLONNE (Drag & Drop + Toggle) ---
    const toggleCol = (id: string) => {
        setLocalSettings(prev => ({
            ...prev,
            columns: prev.columns.map(c => c.id === id ? { ...c, visible: !c.visible } : c)
        }));
    };

    const handleDragStart = (index: number) => setDraggedItemIndex(index);

    const handleDragOver = (e: React.DragEvent) => e.preventDefault();

    const handleDrop = (dropIndex: number) => {
        if (draggedItemIndex === null || draggedItemIndex === dropIndex) return;
        const newCols = [...localSettings.columns];
        const [movedItem] = newCols.splice(draggedItemIndex, 1);
        newCols.splice(dropIndex, 0, movedItem);
        setLocalSettings(prev => ({ ...prev, columns: newCols }));
        setDraggedItemIndex(null);
    };

    // --- LOGICA SORT ---
    const addSort = () => setLocalSettings(prev => ({ ...prev, sorts: [...prev.sorts, { id: Math.random().toString(), columnId: allColumns[0].id, direction: 'asc' }] }));
    const removeSort = (id: string) => setLocalSettings(prev => ({ ...prev, sorts: prev.sorts.filter(s => s.id !== id) }));
    const updateSort = (id: string, key: keyof SortRule, val: any) => setLocalSettings(prev => ({ ...prev, sorts: prev.sorts.map(s => s.id === id ? { ...s, [key]: val } : s) }));

    // --- LOGICA FILTER ---
    const addFilter = () => setLocalSettings(prev => ({ ...prev, filters: [...prev.filters, { id: Math.random().toString(), columnId: allColumns[0].id, type: 'include', operator: 'contains', value: '' }] }));
    const removeFilter = (id: string) => setLocalSettings(prev => ({ ...prev, filters: prev.filters.filter(f => f.id !== id) }));
    const updateFilter = (id: string, key: keyof FilterRule, val: any) => setLocalSettings(prev => ({ ...prev, filters: prev.filters.map(f => f.id === id ? { ...f, [key]: val } : f) }));

    // --- LOGICA GROUP ---
    const addGroup = () => setLocalSettings(prev => ({ ...prev, groups: [...prev.groups, { id: Math.random().toString(), columnId: allColumns[0].id }] }));
    const removeGroup = (id: string) => setLocalSettings(prev => ({ ...prev, groups: prev.groups.filter(g => g.id !== id) }));
    const updateGroup = (id: string, val: string) => setLocalSettings(prev => ({ ...prev, groups: prev.groups.map(g => g.id === id ? { ...g, columnId: val } : g) }));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[600px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-slate-800">View Settings</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} className="text-gray-500" /></button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 bg-gray-50">
                    {['columns', 'sort', 'filter', 'group'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-6 py-3 text-sm font-semibold capitalize border-b-2 transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                        >
                            {tab}
                            {tab === 'sort' && localSettings.sorts.length > 0 && <span className="ml-2 bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-xs">{localSettings.sorts.length}</span>}
                            {tab === 'filter' && localSettings.filters.length > 0 && <span className="ml-2 bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-xs">{localSettings.filters.length}</span>}
                            {tab === 'group' && localSettings.groups.length > 0 && <span className="ml-2 bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-xs">{localSettings.groups.length}</span>}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-white">

                    {/* --- TAB COLUMNS (SAP STYLE LIST) --- */}
                    {activeTab === 'columns' && (
                        <div className="space-y-2">
                            <p className="text-xs text-gray-500 italic mb-4">Drag items to reorder. Uncheck to hide.</p>
                            {localSettings.columns.map((col, index) => (
                                <div
                                    key={col.id}
                                    draggable
                                    onDragStart={() => handleDragStart(index)}
                                    onDragOver={handleDragOver}
                                    onDrop={() => handleDrop(index)}
                                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-move select-none ${col.visible ? 'bg-white border-gray-200 hover:border-blue-300' : 'bg-gray-50 border-gray-100 opacity-60'} ${draggedItemIndex === index ? 'opacity-50 bg-blue-50 ring-2 ring-blue-200' : ''}`}
                                >
                                    <div className="text-gray-400 cursor-move"><GripVertical size={16} /></div>

                                    <label className="flex items-center gap-3 flex-1 cursor-pointer">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${col.visible ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}>
                                            {col.visible && <Check size={14} className="text-white" />}
                                        </div>
                                        <input type="checkbox" className="hidden" checked={col.visible} onChange={() => toggleCol(col.id)} />
                                        <span className={`text-sm font-medium ${col.visible ? 'text-slate-800' : 'text-slate-500'}`}>{col.label}</span>
                                    </label>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* --- TAB SORT --- */}
                    {activeTab === 'sort' && (
                        <div className="space-y-4">
                            {localSettings.sorts.map((sort, idx) => (
                                <div key={sort.id} className="flex gap-3 items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <span className="text-xs font-bold text-gray-400 w-6">#{idx + 1}</span>
                                    <select
                                        className="flex-1 p-2 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                        value={sort.columnId}
                                        onChange={(e) => updateSort(sort.id, 'columnId', e.target.value)}
                                    >
                                        {allColumns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                    </select>
                                    <div className="flex bg-white rounded border border-gray-300 overflow-hidden">
                                        <button onClick={() => updateSort(sort.id, 'direction', 'asc')} className={`p-2 ${sort.direction === 'asc' ? 'bg-blue-100 text-blue-700' : 'text-gray-500'}`}><ArrowUp size={16} /></button>
                                        <div className="w-px bg-gray-300"></div>
                                        <button onClick={() => updateSort(sort.id, 'direction', 'desc')} className={`p-2 ${sort.direction === 'desc' ? 'bg-blue-100 text-blue-700' : 'text-gray-500'}`}><ArrowDown size={16} /></button>
                                    </div>
                                    <button onClick={() => removeSort(sort.id)} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 size={18} /></button>
                                </div>
                            ))}
                            <button onClick={addSort} className="text-blue-600 text-sm font-medium flex items-center gap-1 hover:underline"><Plus size={16} /> Add Sort Level</button>
                        </div>
                    )}

                    {/* --- TAB FILTER --- */}
                    {activeTab === 'filter' && (
                        <div className="space-y-4">
                            {localSettings.filters.map((filter) => (
                                <div key={filter.id} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <select className="w-24 p-2 border border-gray-300 rounded text-sm font-medium outline-none focus:ring-1 focus:ring-blue-500" value={filter.type} onChange={(e) => updateFilter(filter.id, 'type', e.target.value)}>
                                        <option value="include">Include</option>
                                        <option value="exclude">Exclude</option>
                                    </select>
                                    <select className="flex-1 p-2 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500" value={filter.columnId} onChange={(e) => updateFilter(filter.id, 'columnId', e.target.value)}>
                                        {allColumns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                    </select>
                                    <select className="w-32 p-2 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500" value={filter.operator} onChange={(e) => updateFilter(filter.id, 'operator', e.target.value)}>
                                        <option value="contains">Contains</option>
                                        <option value="equals">Equals</option>
                                        <option value="greater">Greater (&gt;)</option>
                                        <option value="less">Less (&lt;)</option>
                                        <option value="between">Between</option>
                                    </select>

                                    {filter.operator === 'between' ? (
                                        <div className="flex gap-2 w-full md:w-auto">
                                            <input type="text" className="w-24 p-2 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500" placeholder="From" value={filter.value} onChange={(e) => updateFilter(filter.id, 'value', e.target.value)} />
                                            <input type="text" className="w-24 p-2 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500" placeholder="To" value={filter.value2 || ''} onChange={(e) => updateFilter(filter.id, 'value2', e.target.value)} />
                                        </div>
                                    ) : (
                                        <input type="text" className="flex-1 p-2 border border-gray-300 rounded text-sm min-w-[150px] outline-none focus:ring-1 focus:ring-blue-500" placeholder="Value..." value={filter.value} onChange={(e) => updateFilter(filter.id, 'value', e.target.value)} />
                                    )}

                                    <button onClick={() => removeFilter(filter.id)} className="p-2 text-red-500 hover:bg-red-50 rounded self-end md:self-auto"><Trash2 size={18} /></button>
                                </div>
                            ))}
                            <button onClick={addFilter} className="text-blue-600 text-sm font-medium flex items-center gap-1 hover:underline"><Plus size={16} /> Add Filter</button>
                        </div>
                    )}

                    {/* --- TAB GROUP --- */}
                    {activeTab === 'group' && (
                        <div className="space-y-4">
                            <p className="text-xs text-gray-500 italic">Group rows by column. The order determines the nesting level.</p>
                            {localSettings.groups.map((group, idx) => (
                                <div key={group.id} className="flex gap-3 items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <span className="text-xs font-bold text-gray-400 w-16">Level {idx + 1}</span>
                                    <select className="flex-1 p-2 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500" value={group.columnId} onChange={(e) => updateGroup(group.id, e.target.value)}>
                                        {allColumns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                    </select>
                                    <button onClick={() => removeGroup(group.id)} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 size={18} /></button>
                                </div>
                            ))}
                            <button onClick={addGroup} className="text-blue-600 text-sm font-medium flex items-center gap-1 hover:underline"><Plus size={16} /> Add Grouping</button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
                    <button onClick={handleSave} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors">OK</button>
                </div>
            </div>
        </div>
    );
};

export default function PortfolioValuation() {
    const router = useRouter();

    // Dati Base
    const [rawTransactions, setRawTransactions] = useState < Transaction[] > ([]);
    const [loadingData, setLoadingData] = useState(true);
    const [pythonData, setPythonData] = useState < Record < string, { price: number, dividends: number, is_live: boolean }>> ({});
    const [loadingPrices, setLoadingPrices] = useState(false);
    const [pricesError, setPricesError] = useState("");

    // Filtri Sidebar (Generali)
    const [filters, setFilters] = useState({
        person: [] as string[],
        ticker: [] as string[],
        startDate: '',
        endDate: ''
    });

    // --- VIEW SETTINGS STATE ---
    const [viewSettings, setViewSettings] = useState < ViewSettings > ({
        columns: INITIAL_COLUMNS,
        filters: [],
        sorts: [],
        groups: []
    });

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);

    // Filtri rapidi Header (Column Filters)
    const [columnFilters, setColumnFilters] = useState < Record < string, string[]>> ({});
    const [activeFilterCol, setActiveFilterCol] = useState < string | null > (null);
    const [filterSearchTerm, setFilterSearchTerm] = useState("");

    // Refs
    const settingsRef = useRef < HTMLDivElement > (null);
    const downloadRef = useRef < HTMLDivElement > (null);
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

    // --- AGGREGAZIONE BASE ---
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

        // Chiave composita per supportare raggruppamenti su qualsiasi campo
        const groups: Record<string, any> = {};

        filtered.forEach(t => {
            const key = `${t.ticker}|${t.person}`;

            if (!groups[key]) {
                groups[key] = {
                    ticker: t.ticker,
                    person: t.person,
                    qty: 0, cost: 0, dates: [], weights: []
                };
            }

            const qty = Number(t.shares_count || 0);
            const sign = Number(t.operation_sign || 0);
            const price = Number(t.price_per_share_eur || 0);
            const outlay = t.total_outlay_eur !== null ? Number(t.total_outlay_eur) : (price * qty);
            const isReal = Number(t.buy_or_sell) === 1;

            if (isReal) {
                if (sign === 1) {
                    groups[key].qty += qty;
                    groups[key].cost += outlay;
                    groups[key].dates.push(new Date(t.operation_date).getTime());
                    groups[key].weights.push(outlay);
                } else {
                    const avg = groups[key].qty > 0 ? groups[key].cost / groups[key].qty : 0;
                    groups[key].qty -= qty;
                    groups[key].cost -= (avg * qty);
                }
            }
        });

        const items = Object.values(groups).map(g => {
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

            if (current_price === null || current_price === 0) {
                current_price = avg_price;
                is_live_price = false;
            }

            const market_value = current_price * quantity;
            const gross_value = market_value + (total_dividends || 0);
            const profit_loss = gross_value - total_exposure;
            const performance_perc = total_exposure !== 0 ? (profit_loss / total_exposure) * 100 : 0;

            return {
                id: `${g.ticker}-${g.person}`,
                ticker: g.ticker,
                y_ticker: g.ticker,
                person: g.person,
                quantity, avg_price, avg_date,
                total_exposure, current_price, market_value, gross_value,
                profit_loss, performance_perc, total_dividends, is_live_price
            };
        }).filter(Boolean) as PortfolioItem[];

        return items;
    }, [rawTransactions, filters, pythonData]);

    // --- PIPELINE DI PROCESSO DATI (Filter -> Sort -> Group) ---
    const processedTableData = useMemo(() => {
        let data = [...basePortfolioData];

        // 1A. FILTRI RAPIDI COLONNA (Header)
        Object.keys(columnFilters).forEach(colKey => {
            const selectedVals = columnFilters[colKey];
            if (selectedVals && selectedVals.length > 0) {
                data = data.filter(item => {
                    const val = (item as any)[colKey];
                    const strVal = typeof val === 'number' ? fmt(val) : String(val || '');
                    return selectedVals.includes(String(val)) || selectedVals.includes(strVal);
                });
            }
        });

        // 1B. FILTRI AVANZATI (Settings Modal)
        if (viewSettings.filters.length > 0) {
            data = data.filter(item => {
                return viewSettings.filters.every(rule => {
                    const itemValue = item[rule.columnId];
                    if (itemValue === undefined || itemValue === null) return false;

                    let matches = false;
                    const valStr = String(itemValue).toLowerCase();
                    const filterVal = rule.value.toLowerCase();
                    const numVal = Number(itemValue);
                    const filterNum = Number(rule.value);

                    switch (rule.operator) {
                        case 'contains': matches = valStr.includes(filterVal); break;
                        case 'equals': matches = valStr === filterVal; break;
                        case 'greater': matches = numVal > filterNum; break;
                        case 'less': matches = numVal < filterNum; break;
                        case 'between':
                            const filterNum2 = Number(rule.value2);
                            matches = numVal >= filterNum && numVal <= filterNum2;
                            break;
                    }
                    return rule.type === 'include' ? matches : !matches;
                });
            });
        }

        // 2. RAGGRUPPAMENTO
        const groupCols = viewSettings.groups.map(g => g.columnId);

        // 3. ORDINAMENTO
        const sortRules = [
            ...groupCols.map(col => ({ columnId: col, direction: 'asc' as const })),
            ...viewSettings.sorts
        ];

        if (sortRules.length > 0) {
            data.sort((a, b) => {
                for (const rule of sortRules) {
                    const valA = a[rule.columnId];
                    const valB = b[rule.columnId];
                    if (valA === valB) continue;
                    if (valA === null) return 1;
                    if (valB === null) return -1;
                    let comparison = 0;
                    if (typeof valA === 'number' && typeof valB === 'number') comparison = valA - valB;
                    else comparison = String(valA).localeCompare(String(valB));
                    return rule.direction === 'asc' ? comparison : -comparison;
                }
                return 0;
            });
        } else {
            data.sort((a, b) => b.total_exposure - a.total_exposure);
        }

        // 4. STRUTTURAZIONE
        if (groupCols.length === 0) {
            return data.map(item => ({ type: 'data', data: item } as TableRow));
        } else {
            const resultRows: TableRow[] = [];
            let previousValues: Record<string, any> = {};

            data.forEach((item) => {
                groupCols.forEach((groupCol, level) => {
                    const currentVal = item[groupCol];
                    const prevVal = previousValues[groupCol];

                    if (currentVal !== prevVal) {
                        resultRows.push({
                            type: 'group_header',
                            key: groupCol,
                            value: currentVal,
                            level: level,
                            field: INITIAL_COLUMNS.find(c => c.id === groupCol)?.label || groupCol
                        });
                        previousValues[groupCol] = currentVal;
                        for (let l = level + 1; l < groupCols.length; l++) delete previousValues[groupCols[l]];
                    }
                });
                resultRows.push({ type: 'data', data: item });
            });
            return resultRows;
        }

    }, [basePortfolioData, viewSettings, columnFilters]);

    // --- CALCOLO TOTALI GLOBALI ---
    const totals = useMemo(() => {
        const dataRows = processedTableData.filter(r => r.type === 'data').map(r => (r as any).data as PortfolioItem);
        return dataRows.reduce((acc, item) => ({
            exposure: acc.exposure + item.total_exposure,
            market_value: acc.market_value + item.market_value,
            gross_value: acc.gross_value + item.gross_value,
            dividends: acc.dividends + (item.total_dividends || 0),
            profit_loss: acc.profit_loss + (item.profit_loss || 0)
        }), { exposure: 0, market_value: 0, gross_value: 0, dividends: 0, profit_loss: 0 });
    }, [processedTableData]);

    const totalReturnPerc = totals.exposure !== 0 ? (totals.profit_loss / totals.exposure) * 100 : 0;

    // --- UTILS ---
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

    const handleFilterChange = (key: keyof typeof filters, val: any) => setFilters(prev => ({ ...prev, [key]: val }));
    const clearFilters = () => setFilters(prev => ({ ...prev, person: [], ticker: [] }));
    const fmt = (num: number | null) => num !== null ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(num) : '-';
    const fmtPerc = (num: number | null) => num !== null ? `${num > 0 ? '+' : ''}${num.toFixed(2)}%` : '-';

    // --- GESTIONE HEADER ---
    const handleSort = (key: string) => {
        // Quick sort on header click resets advanced sorts
        setViewSettings(prev => ({
            ...prev,
            sorts: [{ id: 'quick', columnId: key, direction: prev.sorts[0]?.columnId === key && prev.sorts[0]?.direction === 'asc' ? 'desc' : 'asc' }]
        }));
    };

    const handleResize = useCallback((index: number, newWidth: number) => {
        setViewSettings(prev => {
            const newCols = [...prev.columns];
            newCols[index] = { ...newCols[index], width: Math.max(50, newWidth) };
            return { ...prev, columns: newCols };
        });
    }, []);

    const moveColumn = useCallback((fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return;
        setViewSettings(prev => {
            const newCols = [...prev.columns];
            const [movedCol] = newCols.splice(fromIndex, 1);
            newCols.splice(toIndex, 0, movedCol);
            return { ...prev, columns: newCols };
        });
    }, []);

    const getUniqueColValues = (colKey: string) => {
        const rawValues = basePortfolioData.map(item => String((item as any)[colKey]));
        return Array.from(new Set(rawValues)).sort();
    };

    const toggleColumnFilter = (colKey: string, value: string) => {
        setColumnFilters(prev => {
            const current = prev[colKey] || [];
            const updated = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
            return { ...prev, [colKey]: updated };
        });
    };

    // COMPONENTE HEADER
    const HeaderCell = ({ col, index, moveColumn }: { col: ColumnDef, index: number, moveColumn: (from: number, to: number) => void }) => {
        const [w, setW] = useState(col.width);
        useEffect(() => setW(col.width), [col.width]);

        const uniqueVals = useMemo(() => getUniqueColValues(col.id as string), [col.id]);
        const filteredVals = uniqueVals.filter(v => v.toLowerCase().includes(filterSearchTerm.toLowerCase()));

        // Drag handlers
        const handleDragStart = (e: React.DragEvent) => { e.dataTransfer.setData("colIndex", index.toString()); e.dataTransfer.effectAllowed = "move"; };
        const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
        const handleDrop = (e: React.DragEvent) => { e.preventDefault(); const fromIndex = parseInt(e.dataTransfer.getData("colIndex")); moveColumn(fromIndex, index); };

        // Resize handlers
        const onMouseDown = (e: React.MouseEvent) => {
            e.preventDefault(); e.stopPropagation();
            const startX = e.pageX; const startW = w;
            const onMouseMove = (e: MouseEvent) => { setW(Math.max(50, startW + (e.pageX - startX))); };
            const onMouseUp = (e: MouseEvent) => { handleResize(index, Math.max(50, startW + (e.pageX - startX))); document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
            document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
        };

        const activeSort = viewSettings.sorts.find(s => s.columnId === col.id);

        return (
            <th
                style={{ width: w }}
                draggable
                onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDrop}
                className={`px-4 py-3 relative group cursor-grab active:cursor-grabbing select-none hover:bg-slate-100 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
            >
                <div className={`flex items-center gap-2 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                    <span onClick={() => handleSort(col.id as string)} className="cursor-pointer font-bold flex items-center gap-1 hover:text-blue-600 text-xs uppercase tracking-wider text-gray-600">
                        {col.label}
                        {activeSort && (activeSort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </span>

                    <button
                        onClick={(e) => { e.stopPropagation(); setActiveFilterCol(activeFilterCol === col.id ? null : col.id as string); setFilterSearchTerm(""); }}
                        className={`p-1 rounded hover:bg-slate-200 transition-opacity ${activeFilterCol === col.id || columnFilters[col.id as string]?.length ? 'opacity-100 text-blue-600' : 'opacity-0 group-hover:opacity-100 text-slate-400'}`}
                    >
                        <Filter size={12} fill={columnFilters[col.id as string]?.length ? "currentColor" : "none"} />
                    </button>
                </div>

                {activeFilterCol === col.id && (
                    <div ref={headerFilterRef} className="absolute top-full left-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-200 z-50 p-2 cursor-default text-left font-normal" onClick={e => e.stopPropagation()}>
                        <div className="relative mb-2">
                            <Search size={12} className="absolute left-2 top-2.5 text-slate-400" />
                            <input autoFocus type="text" placeholder="Search..." className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none" value={filterSearchTerm} onChange={e => setFilterSearchTerm(e.target.value)} />
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
                            {filteredVals.map(val => {
                                const isSel = columnFilters[col.id as string]?.includes(val);
                                return (
                                    <label key={val} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-xs">
                                        <div className={`w-3 h-3 border rounded flex items-center justify-center ${isSel ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>{isSel && <Check size={10} className="text-white" />}</div>
                                        <span className="truncate">{val || '(Empty)'}</span>
                                        <input type="checkbox" className="hidden" checked={!!isSel} onChange={() => toggleColumnFilter(col.id as string, val)} />
                                    </label>
                                )
                            })}
                            {filteredVals.length === 0 && <p className="text-xs text-slate-400 text-center py-2">No results</p>}
                        </div>
                        <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between">
                            <button onClick={() => setColumnFilters(prev => ({ ...prev, [col.id]: [] }))} className="text-xs text-slate-500 hover:text-slate-800">Clear</button>
                            <button onClick={() => setActiveFilterCol(null)} className="text-xs text-blue-600 font-medium">Done</button>
                        </div>
                    </div>
                )}

                <div onMouseDown={onMouseDown} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 group-hover:bg-slate-300 transition-colors z-10" />
            </th>
        );
    };

    // --- EXPORT ---
    const exportData = (format: 'csv' | 'xlsx') => {
        const visibleCols = viewSettings.columns.filter(c => c.visible);
        const dataRows = processedTableData.filter(r => r.type === 'data').map(r => (r as any).data);
        const data = dataRows.map(row => {
            const r: any = {};
            visibleCols.forEach(col => { r[col.label] = row[col.id]; });
            return r;
        });
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
            const link = document.createElement('a'); link.href = url; link.download = `${filename}.csv`; link.click();
        } else {
            const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Valuation"); XLSX.writeFile(wb, `${filename}.xlsx`);
        }
        setIsDownloadOpen(false);
    };

    const hasEstimatedPrices = basePortfolioData.some(p => p.current_price !== null && !p.is_live_price);
    const visibleColumns = viewSettings.columns.filter(c => c.visible);

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-6 pb-20">
            <div className="max-w-[1920px] mx-auto">

                {/* UNIFIED HEADER & TOOLBAR */}
                <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Wallet className="text-blue-600" /> Portfolio Valuation
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link href="/portfolio_valuation/plot" className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 font-medium transition-colors shadow-sm text-sm">
                            <TrendingUp size={16} className="text-purple-600" />
                            <span>Plot History</span>
                        </Link>

                        <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 shadow-sm" title="View Settings">
                            <Settings size={18} />
                        </button>

                        <div className="relative" ref={downloadRef}>
                            <button onClick={() => setIsDownloadOpen(!isDownloadOpen)} className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 shadow-sm" title="Export">
                                <Download size={18} />
                            </button>
                            {isDownloadOpen && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2">
                                    <button onClick={() => exportData('csv')} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded text-sm text-slate-700"><FileText size={16} className="text-green-500" /> Export CSV</button>
                                    <button onClick={() => exportData('xlsx')} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded text-sm text-slate-700"><FileSpreadsheet size={16} className="text-emerald-600" /> Export XLSX</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
                    {/* FILTRI (Sidebar) */}
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
                        {pricesError && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-center gap-2"><AlertCircle size={16} /> {pricesError}</div>}

                        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden relative min-h-[400px]">
                            {loadingData && <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center text-slate-500"><Loader2 size={32} className="animate-spin text-blue-600 mb-2" /> <p>Loading...</p></div>}
                            <div className="overflow-x-auto min-h-[400px]">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-200">
                                        <tr>
                                            {visibleColumns.map((col, i) => (
                                                <HeaderCell key={col.id} col={col} index={i} moveColumn={moveColumn} />
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {processedTableData.length === 0 && !loadingData ? (
                                            <tr><td colSpan={visibleColumns.length} className="px-6 py-12 text-center text-slate-400">No positions found.</td></tr>
                                        ) : (
                                            processedTableData.map((row, idx) => {
                                                if (row.type === 'group_header') {
                                                    return (
                                                        <tr key={`group-${row.key}-${idx}`} className="bg-gray-100 border-t border-gray-300">
                                                            <td colSpan={visibleColumns.length} className="px-4 py-2 font-bold text-gray-700">
                                                                <div className="flex items-center gap-2" style={{ paddingLeft: `${row.level * 20}px` }}>
                                                                    <ChevronRight size={16} className="text-gray-500" />
                                                                    <span className="text-xs uppercase text-gray-500">{row.field}:</span>
                                                                    {row.value}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                }

                                                if (row.type === 'data') {
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
                                                                else if (col.id === 'current_price') {
                                                                    cellClass += ` bg-blue-50/30 ${isEstimated ? 'text-orange-500' : 'text-slate-800'}`;
                                                                    content = <>{fmt(item.current_price)}{isEstimated && <span className="ml-1 text-[10px] align-top">*</span>}</>;
                                                                } else if (col.id === 'avg_date') content = <span className="text-xs text-slate-400">{item.avg_date}</span>;
                                                                else if (col.id === 'profit_loss') {
                                                                    cellClass += ` font-bold ${isProfitable ? 'text-emerald-600' : 'text-red-600'}`;
                                                                    content = fmt(item.profit_loss);
                                                                } else if (col.id === 'performance_perc') {
                                                                    content = (
                                                                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${isProfitable ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                                            {isProfitable ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{fmtPerc(item.performance_perc)}
                                                                        </div>
                                                                    );
                                                                } else {
                                                                    const val = item[col.id];
                                                                    if (typeof val === 'number') {
                                                                        if (col.id === 'total_dividends') cellClass += " text-blue-700 font-medium bg-yellow-50/30";
                                                                        content = fmt(val);
                                                                    } else if (val) {
                                                                        content = String(val);
                                                                    }
                                                                }
                                                                return <td key={col.id} className={cellClass}>{content}</td>;
                                                            })}
                                                        </tr>
                                                    );
                                                }
                                                return null;
                                            })
                                        )}
                                    </tbody>
                                    {/* FOOTER TOTALI */}
                                    {processedTableData.some(r => r.type === 'data') && (
                                        <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-800 sticky bottom-0">
                                            <tr>
                                                {visibleColumns.map(col => {
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
                                                })}
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>

                        <div className="flex justify-between items-start mt-1">
                            <p className="text-slate-400 text-xs italic">
                                Based on {processedTableData.filter(r => r.type === 'data').length} open positions.
                            </p>
                            {hasEstimatedPrices && (
                                <div className="text-right">
                                    <p className="text-xs text-orange-500 italic">* Estimated price (Historical Cost used).</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* MODAL SETTINGS */}
                <SettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    settings={viewSettings}
                    onUpdate={setViewSettings}
                    allColumns={INITIAL_COLUMNS}
                />

            </div>
        </div>
    );
}