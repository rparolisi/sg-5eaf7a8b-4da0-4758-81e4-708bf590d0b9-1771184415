import { useEffect, useState, useMemo, useRef } from 'react';
// ICONE
import { Filter, ArrowUp, ArrowDown, Search, Check, Plus, X, Calendar, TrendingUp, TrendingDown, Settings, AlertTriangle } from 'lucide-react';

/* NOTA PER L'USO LOCALE (Next.js / React):
   1. Installa la libreria: npm install @supabase/supabase-js
   2. Decommenta la riga qui sotto:
   import { createClient } from '@supabase/supabase-js';
   3. Rimuovi o commenta la logica "useEffect" che carica lo script da CDN e la variabile di stato "supabase".
   4. Inizializza il client normalmente fuori dal componente:
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
*/

// --- CONFIGURAZIONE ---
// Se vuoi testare la connessione QUI nell'anteprima, inserisci le tue chiavi tra le virgolette.
// Altrimenti, lascia process.env per il tuo ambiente locale.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// --- API CONFIGURATION ---
const PYTHON_API_URL = "https://invest-monitor-api.onrender.com";

// --- COSTANTI ---
const PEOPLE_OPTIONS = ["Ale", "Peppe", "Raff"];

// Definizione completa di tutte le colonne possibili
// Aggiornata con tutti i campi presenti nel form e nel DB
const ALL_COLUMNS = [
    { key: 'operation_date', label: 'Date', type: 'date' },
    { key: 'ticker', label: 'Ticker', type: 'text' },
    { key: 'buy_or_sell', label: 'Type', type: 'text' },
    { key: 'total_shares_num', label: 'Shares', type: 'number' },
    { key: 'price', label: 'Price', type: 'number' },
    { key: 'currency', label: 'Currency', type: 'text' },
    { key: 'exchange_rate', label: 'Ex. Rate', type: 'number' },
    { key: 'total_outlay_eur', label: 'Total (€)', type: 'number' },
    { key: 'person', label: 'Person', type: 'text' },
    { key: 'platform', label: 'Platform', type: 'text' },
    { key: 'account_owner', label: 'Account Owner', type: 'text' },
    { key: 'regulated', label: 'Regulated', type: 'text' },
    { key: 'expenses', label: 'Expenses (€)', type: 'number' },
    { key: 'taxes', label: 'Taxes (€)', type: 'number' },
];

const DEFAULT_VISIBLE_COLUMNS = ['operation_date', 'ticker', 'buy_or_sell', 'person'];

// --- TIPI ---
type Transaction = {
    id: string;
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
    // Client Supabase (Stato necessario solo per l'anteprima CDN, in locale usa const globale)
    const [supabase, setSupabase] = useState < any > (null);

    const [transactions, setTransactions] = useState < Transaction[] > ([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState < string | null > (null);

    // --- STATI TABELLA ---
    const [activeColumn, setActiveColumn] = useState < string | null > (null);
    const [filters, setFilters] = useState < Record < string, string[]>> ({});
    const [menuSearchTerm, setMenuSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState < SortConfig > ({ key: 'operation_date', direction: 'desc' });

    // --- NUOVI STATI COLONNE ---
    const [visibleColumns, setVisibleColumns] = useState < string[] > (DEFAULT_VISIBLE_COLUMNS);
    const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
    const columnMenuRef = useRef < HTMLDivElement > (null);

    // --- STATI MODALE ---
    const [isModalOpen, setIsModalOpen] = useState(false);

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

    // --- INIZIALIZZAZIONE SUPABASE (CDN per Anteprima) ---
    useEffect(() => {
        const initSupabase = () => {
            // Se le chiavi mancano, mostriamo l'errore ma non blocchiamo la UI
            if (!SUPABASE_URL || !SUPABASE_KEY) {
                setError("Supabase URL or Key missing. Check configuration.");
                setLoading(false);
                return;
            }

            if ((window as any).supabase) {
                try {
                    const client = (window as any).supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                    setSupabase(client);
                } catch (e: any) {
                    setError(e.message);
                    setLoading(false);
                }
            } else {
                // Carica lo script da CDN se non presente (solo per anteprima)
                const script = document.createElement('script');
                script.src = "https://unpkg.com/@supabase/supabase-js@2";
                script.async = true;
                script.onload = () => {
                    if ((window as any).supabase) {
                        const client = (window as any).supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                        setSupabase(client);
                    }
                };
                script.onerror = () => {
                    setError("Failed to load Supabase library.");
                    setLoading(false);
                };
                document.body.appendChild(script);
            }
        };
        initSupabase();
    }, []);

    // Fetch data appena il client è pronto
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
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (formData.currency === 'EUR') {
            setFormData(prev => ({ ...prev, exchange_rate: '1' }));
        }
    }, [formData.currency]);

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

    // --- LOGICA GESTIONE COLONNE ---
    const toggleColumnVisibility = (columnKey: string) => {
        setVisibleColumns(prev => {
            if (prev.includes(columnKey)) {
                return prev.filter(key => key !== columnKey);
            } else {
                const newSet = new Set([...prev, columnKey]);
                return ALL_COLUMNS.filter(col => newSet.has(col.key)).map(col => col.key);
            }
        });
    };

    // --- LOGICA MODALE E FORM ---
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const togglePerson = (person: string) => {
        setFormData(prev => {
            const current = prev.people;
            if (current.includes(person)) {
                const newPeople = current.filter(p => p !== person);
                const newSharesMulti = { ...prev.shares_multi };
                delete newSharesMulti[person];
                return { ...prev, people: newPeople, shares_multi: newSharesMulti };
            } else {
                return { ...prev, people: [...current, person] };
            }
        });
    };

    const handleMultiShareChange = (person: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            shares_multi: { ...prev.shares_multi, [person]: value }
        }));
    };

    const handleSubmit = async () => {
        if (formData.people.length === 0 || !formData.security || !formData.price) {
            alert("Please fill in all required fields.");
            return;
        }

        setLoading(true);

        try {
            console.log("⏳ Sending data to Python API...", formData);

            const response = await fetch(`${PYTHON_API_URL}/process_transaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.detail || "Error connecting to Python server");
            }

            alert(`Transaction processed! ${result.inserted_rows} rows added.`);

            setIsModalOpen(false);
            setFormData({
                type: 'Acquisto',
                people: [], security: '', date: new Date().toISOString().split('T')[0],
                price: '', currency: 'EUR', exchange_rate: '1', shares_single: '',
                shares_multi: {}, platform: '', account_owner: '', regulated: 'Yes',
                expenses: '0', taxes: '0'
            });

            fetchTransactions();

        } catch (err: any) {
            console.error("API Error:", err);
            alert(`❌ Error processing transaction: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // --- HELPER TABELLA ---
    const formatValue = (key: string, value: any): string => {
        if (!value && value !== 0) return '';
        if (key === 'operation_date') return new Date(value).toLocaleDateString('it-IT');
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

    const handlePasteInSearch = (e: React.ClipboardEvent<HTMLInputElement>, columnKey: string) => { /* ... */ };
    const toggleFilterValue = (columnKey: string, value: string) => {
        setFilters(prev => {
            const current = prev[columnKey] || [];
            const updated = current.includes(value)
                ? current.filter(v => v !== value)
                : [...current, value];
            return { ...prev, [columnKey]: updated };
        });
    };

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // --- RENDERING CELLE TABELLA ---
    const renderCellContent = (t: Transaction, colKey: string) => {
        switch (colKey) {
            case 'operation_date':
                return new Date(t.operation_date).toLocaleDateString('it-IT');
            case 'ticker':
                return <span className="font-bold">{t.ticker}</span>;
            case 'buy_or_sell':
                return (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium
                        ${t.buy_or_sell === 'Acquisto' ? 'bg-green-100 text-green-800' :
                            t.buy_or_sell === 'Vendita' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'}`}>
                        {t.category || t.buy_or_sell}
                    </span>
                );
            case 'total_shares_num':
                return <div className="text-right">{t.total_shares_num}</div>;
            case 'price':
                return <div className="text-right">{t.price ? Number(t.price).toFixed(2) : '-'}</div>;
            case 'exchange_rate':
                return <div className="text-right text-gray-500">{t.exchange_rate ? Number(t.exchange_rate).toFixed(4) : '-'}</div>;
            case 'total_outlay_eur':
                return <div className="text-right font-mono">{t.total_outlay_eur?.toFixed(2)} €</div>;
            case 'expenses':
            case 'taxes':
                return <div className="text-right text-red-500">{t[colKey] ? Number(t[colKey]).toFixed(2) : '0.00'} €</div>;
            case 'person':
                return t.person;
            default:
                return t[colKey];
        }
    };

    return (
        <main className="min-h-screen p-8 bg-gray-50 font-sans" onClick={() => setActiveColumn(null)}>
            <div className="max-w-6xl mx-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">Transactions</h1>

                    <div className="flex items-center gap-3">
                        {/* --- GEAR ICON & COLUMN MENU --- */}
                        <div className="relative" ref={columnMenuRef}>
                            <button
                                onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
                                className="p-2 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg text-gray-600 transition-colors shadow-sm"
                                title="Manage Columns"
                            >
                                <Settings size={20} />
                            </button>

                            {isColumnMenuOpen && (
                                <div className="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-3 animate-in fade-in slide-in-from-top-2">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-2 px-1">Show Columns</h3>
                                    <div className="max-h-60 overflow-y-auto space-y-1">
                                        {ALL_COLUMNS.map(col => (
                                            <label key={col.key} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg cursor-pointer text-sm text-gray-700 select-none">
                                                <div className={`w-4 h-4 border rounded flex items-center justify-center transition-colors ${visibleColumns.includes(col.key) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                                                    {visibleColumns.includes(col.key) && <Check size={12} className="text-white" />}
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={visibleColumns.includes(col.key)}
                                                    onChange={() => toggleColumnVisibility(col.key)}
                                                />
                                                {col.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ADD BUTTON */}
                        <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors">
                            <Plus size={20} /> Add Transaction
                        </button>
                    </div>
                </div>

                {loading && !isModalOpen && (
                    <div className="flex flex-col items-center justify-center p-8 text-gray-500">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                        <p>Connecting to Supabase...</p>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg mb-4 flex items-start gap-3">
                        <div className="mt-0.5"><AlertTriangle size={18} /></div>
                        <div>
                            <p className="font-semibold">Connection Error</p>
                            <p className="text-sm">{error}</p>
                            {error.includes("URL") && <p className="text-xs mt-1 text-red-500">Note: In this preview environment, you must hardcode keys in the <code>SUPABASE_URL</code> constants above.</p>}
                        </div>
                    </div>
                )}

                {!loading && !error && (
                    <div className="bg-white shadow-lg rounded-xl overflow-visible border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    {ALL_COLUMNS.filter(col => visibleColumns.includes(col.key)).map((col) => (
                                        <th key={col.key} className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider relative group">
                                            <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleSort(col.key)}>
                                                {col.label}
                                                {sortConfig.key === col.key && (
                                                    sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                                )}
                                            </div>

                                            <button
                                                onClick={(e) => { e.stopPropagation(); setActiveColumn(activeColumn === col.key ? null : col.key); setMenuSearchTerm(''); }}
                                                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-gray-200 transition-opacity ${activeColumn === col.key || filters[col.key]?.length ? 'opacity-100 bg-blue-50 text-blue-600' : 'opacity-0 group-hover:opacity-100 text-gray-400'}`}
                                            >
                                                <Filter size={14} />
                                            </button>

                                            {activeColumn === col.key && (
                                                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 p-2" onClick={(e) => e.stopPropagation()}>
                                                    <div className="relative mb-2">
                                                        <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            placeholder={`Search ${col.label}...`}
                                                            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                                            value={menuSearchTerm}
                                                            onChange={(e) => setMenuSearchTerm(e.target.value)}
                                                            onPaste={(e) => handlePasteInSearch(e, col.key)}
                                                        />
                                                    </div>
                                                    <div className="max-h-48 overflow-y-auto space-y-1">
                                                        {uniqueColumnValues.map((val) => {
                                                            const isSelected = filters[col.key]?.includes(val);
                                                            return (
                                                                <label key={val} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer text-sm">
                                                                    <div className={`w-4 h-4 border rounded flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                                                                        {isSelected && <Check size={12} className="text-white" />}
                                                                    </div>
                                                                    <span className="truncate text-gray-700">{val || '(Empty)'}</span>
                                                                    <input type="checkbox" className="hidden" checked={!!isSelected} onChange={() => toggleFilterValue(col.key, val)} />
                                                                </label>
                                                            );
                                                        })}
                                                        {uniqueColumnValues.length === 0 && <p className="text-xs text-gray-400 text-center py-2">No results found</p>}
                                                    </div>
                                                    <div className="pt-2 mt-2 border-t border-gray-100 flex justify-between">
                                                        <button onClick={() => setFilters(prev => ({ ...prev, [col.key]: [] }))} className="text-xs text-gray-500 hover:text-gray-800">Clear</button>
                                                        <button onClick={() => setActiveColumn(null)} className="text-xs text-blue-600 font-medium hover:text-blue-800">Done</button>
                                                    </div>
                                                </div>
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {processedData.map((t) => (
                                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                        {ALL_COLUMNS.filter(col => visibleColumns.includes(col.key)).map(col => (
                                            <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {renderCellContent(t, col.key)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* --- MODAL ADD TRANSACTION --- */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-between items-center p-6 border-b border-gray-100">
                                <h2 className="text-2xl font-bold text-gray-800">Add New Transaction</h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                            </div>

                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">

                                {/* 0. TYPE SELECTOR */}
                                <div className="md:col-span-2 flex justify-center mb-4">
                                    <div className="bg-gray-100 p-1 rounded-lg flex">
                                        <button
                                            className={`px-6 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${formData.type === 'Acquisto' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                            onClick={() => setFormData(prev => ({ ...prev, type: 'Acquisto' }))}
                                        >
                                            <TrendingUp size={16} /> Buy
                                        </button>
                                        <button
                                            className={`px-6 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${formData.type === 'Vendita' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                            onClick={() => setFormData(prev => ({ ...prev, type: 'Vendita' }))}
                                        >
                                            <TrendingDown size={16} /> Sale
                                        </button>
                                    </div>
                                </div>

                                <div className="md:col-span-2"><label className="block text-sm font-semibold text-gray-700 mb-2">1. People Involved</label><div className="flex gap-2 flex-wrap">{PEOPLE_OPTIONS.map(person => { const isSelected = formData.people.includes(person); return (<button key={person} onClick={() => togglePerson(person)} className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>{isSelected && <Check size={14} className="inline mr-1" />}{person}</button>) })}</div></div>

                                <div><label className="block text-sm font-semibold text-gray-700 mb-1">2. Security (Ticker)</label><input name="security" value={formData.security} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none uppercase" placeholder="e.g. AAPL" /></div>
                                <div><label className="block text-sm font-semibold text-gray-700 mb-1">3. Date</label><input type="date" name="date" value={formData.date} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none" /></div>
                                <div><label className="block text-sm font-semibold text-gray-700 mb-1">4. Price (Inv. Currency)</label><input type="number" step="0.01" name="price" value={formData.price} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none" /></div>
                                <div><label className="block text-sm font-semibold text-gray-700 mb-1">5. Currency</label><select name="currency" value={formData.currency} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none bg-white"><option value="EUR">EUR</option><option value="USD">USD</option><option value="GBP">GBP</option></select></div>
                                <div><label className="block text-sm font-semibold text-gray-700 mb-1">6. Exchange Rate (to EUR)</label><input type="number" step="0.0001" name="exchange_rate" value={formData.exchange_rate} onChange={handleInputChange} disabled={formData.currency === 'EUR'} className={`w-full border border-gray-300 rounded-lg p-2.5 outline-none ${formData.currency === 'EUR' ? 'bg-gray-100' : ''}`} /></div>

                                <div className="md:col-span-2 bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">7. Number of Shares</label>
                                    {formData.people.length <= 1 ? (
                                        <input type="number" name="shares_single" value={formData.shares_single} onChange={handleInputChange} placeholder="Total shares" className="w-full border border-gray-300 rounded-lg p-2.5 outline-none" />
                                    ) : (
                                        <div className="grid grid-cols-2 gap-4">{formData.people.map(person => (<div key={person}><label className="text-xs font-bold text-gray-500 uppercase">{person}'s Shares</label><input type="number" value={formData.shares_multi[person] || ''} onChange={(e) => handleMultiShareChange(person, e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 outline-none mt-1" /></div>))}</div>
                                    )}
                                </div>

                                <div><label className="block text-sm font-semibold text-gray-700 mb-1">8. Platform</label><input name="platform" value={formData.platform} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none" /></div>
                                <div><label className="block text-sm font-semibold text-gray-700 mb-1">9. Account Owner</label><select name="account_owner" value={formData.account_owner} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none bg-white"><option value="">Select...</option>{PEOPLE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                                <div className="flex flex-col justify-center"><label className="block text-sm font-semibold text-gray-700 mb-2">10. Regulated?</label><div className="flex gap-4"><label className="flex items-center gap-2"><input type="radio" name="regulated" value="Yes" checked={formData.regulated === 'Yes'} onChange={handleInputChange} /> Yes</label><label className="flex items-center gap-2"><input type="radio" name="regulated" value="No" checked={formData.regulated === 'No'} onChange={handleInputChange} /> No</label></div></div>
                                <div><label className="block text-sm font-semibold text-gray-700 mb-1">11. Expenses (€)</label><input type="number" name="expenses" value={formData.expenses} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none" /></div>
                                <div><label className="block text-sm font-semibold text-gray-700 mb-1">12. Taxes (€)</label><input type="number" name="taxes" value={formData.taxes} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none" /></div>
                            </div>

                            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
                                <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition">Cancel</button>
                                <button onClick={handleSubmit} className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition shadow-lg flex items-center gap-2">Confirm Transaction</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}