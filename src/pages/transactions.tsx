import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
// ICONE
import {
    Filter, ArrowUp, ArrowDown, Search, Check, Plus, X, Calendar,
    TrendingUp, TrendingDown, Settings, AlertTriangle, GripVertical,
    List, Download, FileText, FileSpreadsheet, LineChart as LineChartIcon, BarChart3
} from 'lucide-react';

// RECHARTS (Libreria per i grafici)
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// --- CONFIGURAZIONE ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// --- API CONFIGURATION ---
const PYTHON_API_URL = "https://invest-monitor-api.onrender.com";

// --- COLORS PALETTE (Per le linee multiple) ---
const LINE_COLORS = [
    "#2563eb", // Blue
    "#dc2626", // Red
    "#16a34a", // Green
    "#d97706", // Amber
    "#9333ea", // Purple
    "#0891b2", // Cyan
    "#db2777", // Pink
    "#4b5563", // Gray
    "#84cc16", // Lime
    "#7c3aed"  // Violet
];

// --- COSTANTI ---
const PEOPLE_OPTIONS = ["Ale", "Peppe", "Raff"];

// Definizione completa di tutte le colonne
const ALL_COLUMNS = [
    { key: 'transaction_id', label: 'Transaction ID', type: 'text' },
    { key: 'ticker', label: 'Ticker', type: 'text' },
    { key: 'sector', label: 'Sector', type: 'text' },
    { key: 'operation_date', label: 'Date', type: 'date' },
    { key: 'asset_currency', label: 'Currency', type: 'text' },
    { key: 'purchase_price_per_share_curr', label: 'Price (Trans. Curr.)', type: 'number' },
    { key: 'category', label: 'Category', type: 'text' },
    { key: 'exchange_rate_at_purchase', label: 'Exchange Rate', type: 'number' },
    { key: 'purchase_price_per_share_eur', label: 'Price (EUR)', type: 'number' },
    { key: 'total_shares_num', label: 'Total Shares (Trans)', type: 'number' },
    { key: 'operation_sign', label: 'Op. Sign', type: 'number' },
    { key: 'buy_or_sell', label: 'Buy/Sell', type: 'text' },
    { key: 'platform', label: 'Platform', type: 'text' },
    { key: 'account_owner', label: 'Account Owner', type: 'text' },
    { key: 'regulated_market_or_mtf', label: 'Market Type', type: 'text' },
    { key: 'transaction_fees_eur', label: 'Fees (EUR)', type: 'number' },
    { key: 'transaction_taxes_eur', label: 'Taxes (EUR)', type: 'number' },
    { key: 'total_outlay_eur', label: 'Total Amount (EUR)', type: 'number' },
    { key: 'effective_purchase_price_per_share', label: 'Effective Price (EUR)', type: 'number' },
    { key: 'person', label: 'Person', type: 'text' },
    { key: 'shares_count', label: 'Shares', type: 'number' },
    { key: 'ratio', label: 'Ratio', type: 'number' },
    { key: 'cumulative_shares_count', label: 'Cumul. Shares', type: 'number' },
    { key: 'average_price', label: 'Avg Price', type: 'number' },
    { key: 'historical_fifo_avg_date', label: 'Avg Date (FIFO)', type: 'date' },
    { key: 'effective_average_price', label: 'Eff. Avg Price', type: 'number' },
    { key: 'created_at', label: 'Creation Date', type: 'datetime' }
];

const DEFAULT_VISIBLE_COLUMNS = ['operation_date', 'ticker', 'buy_or_sell', 'person', 'total_outlay_eur'];

// --- TIPI ---
type Transaction = {
    transaction_id: string;
    ticker: string;
    operation_date: string;
    buy_or_sell: string;
    total_shares_num: number;
    total_outlay_eur: number;
    person: string;
    [key: string]: any;
};

type SortConfig = {
    key: string | null;
    direction: 'asc' | 'desc';
};

export default function Transactions() {
    // Client Supabase
    const [supabase, setSupabase] = useState < any > (null);

    const [transactions, setTransactions] = useState < Transaction[] > ([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState < string | null > (null);

    // --- STATI TABELLA ---
    const [activeColumn, setActiveColumn] = useState < string | null > (null);
    const [filters, setFilters] = useState < Record < string, string[]>> ({});
    const [menuSearchTerm, setMenuSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState < SortConfig > ({ key: 'operation_date', direction: 'desc' });
    const [rowsLimit, setRowsLimit] = useState < number > (25);

    // --- GESTIONE LARGHEZZA COLONNE (RESIZING) ---
    const [colWidths, setColWidths] = useState < Record < string, number>> ({});
    const resizingRef = useRef < { startX: number, startWidth: number, colKey: string } | null > (null);

    // --- GESTIONE DRAG & DROP COLONNE ---
    const [draggedColKey, setDraggedColKey] = useState < string | null > (null);

    // --- NUOVI STATI COLONNE ---
    const [visibleColumns, setVisibleColumns] = useState < string[] > (DEFAULT_VISIBLE_COLUMNS);
    const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
    const columnMenuRef = useRef < HTMLDivElement > (null);

    // --- STATI MODALE ADD ---
    const [isModalOpen, setIsModalOpen] = useState(false);

    // --- STATI MODALE PLOT (AGGIORNATO) ---
    const [isPlotModalOpen, setIsPlotModalOpen] = useState(false);
    // Aggiunto 'groupBy' alla configurazione del grafico
    const [plotConfig, setPlotConfig] = useState({ x: 'operation_date', y: 'total_outlay_eur', groupBy: '' });

    // --- STATI DOWNLOAD ---
    const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
    const downloadMenuRef = useRef < HTMLDivElement > (null);

    // Stato del Form
    const [formData, setFormData] = useState({
        type: 'Acquisto',
        people: [] as string[],
        security: '',
        date: new Date().toISOString().split('T')[0],
        price: '',
        currency: 'EUR',
        exchange_rate: '1',
        shares_single: '',
        shares_multi: {} as Record<string, string>,
        platform: '',
        account_owner: '',
        regulated: 'Yes',
        expenses: '0',
        taxes: '0',
    });

    // --- INIZIALIZZAZIONE ---
    useEffect(() => {
        const loadScripts = () => {
            // Supabase Init
            if (!SUPABASE_URL || !SUPABASE_KEY) {
                setError("Supabase URL or Key missing. Check configuration.");
                setLoading(false);
            } else if ((window as any).supabase) {
                try {
                    const client = (window as any).supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                    setSupabase(client);
                } catch (e: any) {
                    setError(e.message);
                    setLoading(false);
                }
            } else {
                const script = document.createElement('script');
                script.src = "https://unpkg.com/@supabase/supabase-js@2";
                script.async = true;
                script.onload = () => {
                    if ((window as any).supabase) {
                        const client = (window as any).supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                        setSupabase(client);
                    }
                };
                document.body.appendChild(script);
            }

            // XLSX Init
            if (!(window as any).XLSX) {
                const xlsxScript = document.createElement('script');
                xlsxScript.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
                xlsxScript.async = true;
                document.body.appendChild(xlsxScript);
            }
        };
        loadScripts();
    }, []);

    useEffect(() => {
        if (supabase) {
            fetchTransactions();
        }
    }, [supabase]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
                setIsColumnMenuOpen(false);
            }
            if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
                setIsDownloadMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (formData.currency === 'EUR') {
            setFormData(prev => ({ ...prev, exchange_rate: '1' }));
        }
    }, [formData.currency]);

    // --- EXPORT LOGIC ---
    const exportToCSV = () => { /* Logica invariata, per brevità */ };
    const exportToXLSX = () => { /* Logica invariata, per brevità */ };

    // --- GESTIONE TABELLA (Sort, Resize, Drag, etc.) ---
    // (Ometto funzioni standard per brevità, sono identiche a prima)
    const startResize = (e: React.MouseEvent, colKey: string) => { /* ... */ };
    const handleMouseMove = useCallback((e: MouseEvent) => { /* ... */ }, []);
    const handleMouseUp = useCallback(() => { /* ... */ }, [handleMouseMove]);
    const handleDragStart = (e: React.DragEvent, colKey: string) => { /* ... */ };
    const handleDragOver = (e: React.DragEvent, colKey: string) => { e.preventDefault(); };
    const handleDrop = (e: React.DragEvent, targetColKey: string) => { /* ... */ };

    async function fetchTransactions() {
        if (!supabase) return;
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .order('operation_date', { ascending: false });

            if (error) throw error;
            setTransactions(data || []);
            setError(null);
        } catch (err: any) {
            console.error("Fetch error:", err);
            setError(err.message || "Error connecting to Supabase");
        } finally {
            setLoading(false);
        }
    }

    const toggleColumnVisibility = (columnKey: string) => {
        setVisibleColumns(prev => prev.includes(columnKey) ? prev.filter(key => key !== columnKey) : [...prev, columnKey]);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // --- HELPER DATA ---
    const formatValue = (key: string, value: any): string => {
        if (!value && value !== 0) return '';
        if (['operation_date', 'created_at', 'historical_fifo_avg_date'].includes(key)) {
            return new Date(value).toLocaleDateString('it-IT');
        }
        if (typeof value === 'number') return value.toString();
        return String(value);
    };

    const uniqueColumnValues = useMemo(() => {
        if (!activeColumn) return [];
        const rawValues = transactions.map(t => formatValue(activeColumn, t[activeColumn]));
        const unique = Array.from(new Set(rawValues)).sort();
        if (menuSearchTerm) return unique.filter(v => v.toLowerCase().includes(menuSearchTerm.toLowerCase()));
        return unique;
    }, [transactions, activeColumn, menuSearchTerm]);

    const processedData = useMemo(() => {
        let data = [...transactions];
        Object.keys(filters).forEach((key) => {
            const selectedValues = filters[key];
            if (selectedValues && selectedValues.length > 0) {
                data = data.filter((row) => {
                    const rowValFormatted = formatValue(key, row[key]);
                    return selectedValues.includes(rowValFormatted);
                });
            }
        });
        if (sortConfig.key) {
            data.sort((a, b) => {
                const aVal = a[sortConfig.key!];
                const bVal = b[sortConfig.key!];
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return data;
    }, [transactions, filters, sortConfig]);

    const displayData = useMemo(() => {
        return processedData.slice(0, rowsLimit);
    }, [processedData, rowsLimit]);

    // --- NUOVA LOGICA GRAFICO (MULTIPLA) ---
    const { chartData, groups } = useMemo(() => {
        if (!processedData.length) return { chartData: [], groups: [] };

        // 1. Dati base ordinati per X
        const sortedData = [...processedData].sort((a, b) => {
            const valA = a[plotConfig.x];
            const valB = b[plotConfig.x];
            if (valA < valB) return -1;
            if (valA > valB) return 1;
            return 0;
        });

        // CASO A: NESSUN RAGGRUPPAMENTO (Grafico singolo)
        if (!plotConfig.groupBy) {
            const data = sortedData.map(item => ({
                displayX: formatValue(plotConfig.x, item[plotConfig.x]),
                valX: item[plotConfig.x],
                valY: Number(item[plotConfig.y]) || 0,
                original: item
            }));
            return { chartData: data, groups: ['Value'] };
        }

        // CASO B: RAGGRUPPAMENTO ATTIVO (Ticker, Person, etc.)
        // Dobbiamo trasformare i dati in formato "Wide": 
        // { displayX: '2023-01-01', AAPL: 100, MSFT: 200 }

        // 1. Trova tutti i valori unici del gruppo (es. tutti i Ticker)
        const uniqueGroups = Array.from(new Set(sortedData.map(item => String(item[plotConfig.groupBy] || 'Unknown')))).sort();

        // 2. Raggruppa per asse X
        const groupedByX: Record<string, any> = {};

        sortedData.forEach(item => {
            // Chiave unica per l'asse X (es. la data)
            const xKey = String(item[plotConfig.x]);
            const displayX = formatValue(plotConfig.x, item[plotConfig.x]);
            const groupName = String(item[plotConfig.groupBy] || 'Unknown');
            const yVal = Number(item[plotConfig.y]) || 0;

            if (!groupedByX[xKey]) {
                groupedByX[xKey] = {
                    displayX,
                    valX: item[plotConfig.x] // Utile per sorting
                };
            }
            // Assegna il valore alla colonna del gruppo (es. obj['AAPL'] = 150)
            groupedByX[xKey][groupName] = yVal;
        });

        // 3. Converti mappa in array
        const finalData = Object.values(groupedByX).sort((a: any, b: any) => {
            if (a.valX < b.valX) return -1;
            if (a.valX > b.valX) return 1;
            return 0;
        });

        return { chartData: finalData, groups: uniqueGroups };

    }, [processedData, plotConfig]);

    // --- RENDER ---
    return (
        <main className="min-h-screen p-8 bg-gray-50 font-sans" onClick={() => setActiveColumn(null)}>
            <div className="max-w-6xl mx-auto" onClick={(e) => e.stopPropagation()}>

                {/* HEADER */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center mb-6">
                    <div className="justify-self-start">
                        <h1 className="text-3xl font-bold text-gray-800">Transactions</h1>
                    </div>
                    <div className="justify-self-center w-full md:w-auto flex gap-2">
                        <button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full font-medium shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5">
                            <Plus size={20} /> <span className="hidden sm:inline">Add</span>
                        </button>
                        <button onClick={() => setIsPlotModalOpen(true)} className="flex items-center justify-center gap-2 bg-white hover:bg-purple-50 text-purple-600 border border-purple-200 px-5 py-2.5 rounded-full font-medium shadow-sm hover:shadow-md transition-all">
                            <LineChartIcon size={20} /> <span className="hidden sm:inline">Plot</span>
                        </button>
                    </div>
                    {/* (Ometto sezione destra controlli per brevità - è invariata) */}
                    <div className="justify-self-end text-gray-400 text-xs">Controls...</div>
                </div>

                {/* TABLE RENDER (Ometto per brevità - è invariata) */}
                <div className="bg-white p-4 shadow rounded-lg mb-8 text-center text-gray-500 italic">
                    {/* Qui c'è la tua tabella esistente */}
                    (Table Component Loaded with {processedData.length} rows)
                </div>

                {/* --- MODAL PLOT DATA (MODIFICATO) --- */}
                {isPlotModalOpen && (
                    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                            {/* Header */}
                            <div className="flex justify-between items-center p-6 border-b border-gray-100 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
                                        <BarChart3 size={24} />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-800">Plot Data</h2>
                                </div>
                                <button onClick={() => setIsPlotModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Controls */}
                            <div className="p-4 bg-gray-50 border-b border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">X Axis (Horizontal)</label>
                                    <select
                                        className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                                        value={plotConfig.x}
                                        onChange={(e) => setPlotConfig(prev => ({ ...prev, x: e.target.value }))}
                                    >
                                        {ALL_COLUMNS.map(col => (
                                            <option key={col.key} value={col.key}>{col.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Y Axis (Vertical)</label>
                                    <select
                                        className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                                        value={plotConfig.y}
                                        onChange={(e) => setPlotConfig(prev => ({ ...prev, y: e.target.value }))}
                                    >
                                        {ALL_COLUMNS.filter(c => c.type === 'number').map(col => (
                                            <option key={col.key} value={col.key}>{col.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1 text-purple-600">Group Lines By</label>
                                    <select
                                        className="w-full p-2 border border-purple-200 bg-purple-50 rounded-lg text-sm text-purple-800 font-medium"
                                        value={plotConfig.groupBy}
                                        onChange={(e) => setPlotConfig(prev => ({ ...prev, groupBy: e.target.value }))}
                                    >
                                        <option value="">(None - Single Line)</option>
                                        {ALL_COLUMNS.filter(c => ['text', 'person'].includes(c.type) && c.key !== 'transaction_id').map(col => (
                                            <option key={col.key} value={col.key}>{col.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Chart Area */}
                            <div className="p-6 w-full" style={{ height: '450px', minHeight: '400px' }}>
                                {chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                            <XAxis
                                                dataKey="displayX"
                                                angle={-45}
                                                textAnchor="end"
                                                height={70}
                                                tick={{ fontSize: 12, fill: '#6b7280' }}
                                            />
                                            <YAxis
                                                tick={{ fontSize: 12, fill: '#6b7280' }}
                                                tickFormatter={(value) => value.toLocaleString()}
                                            />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend />

                                            {/* RENDER LOGIC: Singola linea o multiple */}
                                            {groups.length === 1 && groups[0] === 'Value' ? (
                                                <Line
                                                    type="monotone"
                                                    dataKey="valY"
                                                    name={ALL_COLUMNS.find(c => c.key === plotConfig.y)?.label || 'Value'}
                                                    stroke="#8b5cf6"
                                                    strokeWidth={2}
                                                    dot={{ r: 3, fill: '#8b5cf6' }}
                                                    activeDot={{ r: 6 }}
                                                    connectNulls={true}
                                                />
                                            ) : (
                                                // RENDER MULTIPLE LINES (Una per ogni gruppo)
                                                groups.map((groupName, index) => (
                                                    <Line
                                                        key={groupName}
                                                        type="monotone"
                                                        dataKey={groupName}
                                                        name={groupName}
                                                        stroke={LINE_COLORS[index % LINE_COLORS.length]}
                                                        strokeWidth={2}
                                                        dot={{ r: 3 }}
                                                        activeDot={{ r: 6 }}
                                                        connectNulls={true} // Importante per unire i punti se ci sono buchi
                                                    />
                                                ))
                                            )}

                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-gray-400">
                                        No data to display
                                    </div>
                                )}
                            </div>

                            <div className="px-6 py-3 bg-gray-50 text-xs text-gray-500 text-center border-t border-gray-100 flex justify-between">
                                <span>Displaying {chartData.length} time points.</span>
                                {plotConfig.groupBy && <span className="font-semibold text-purple-600">Found {groups.length} distinct groups ({groups.slice(0, 3).join(', ')}{groups.length > 3 ? '...' : ''})</span>}
                            </div>
                        </div>
                    </div>
                )}

                {/* (Ometto modale Add Transaction per brevità - invariato) */}

            </div>
        </main>
    );
}