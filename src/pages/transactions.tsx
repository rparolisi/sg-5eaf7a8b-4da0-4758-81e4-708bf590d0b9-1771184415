import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Filter, ArrowUp, ArrowDown, Search, Check, Plus, X, Calendar } from 'lucide-react';

// --- CONFIGURAZIONE ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- API CONFIGURATION ---
// Sostituisci questo URL con quello esatto che ti ha dato Render se diverso
const PYTHON_API_URL = "https://invest-monitor-api.onrender.com";

// --- COSTANTI ---
const PEOPLE_OPTIONS = ["Ale", "Peppe", "Raff"];

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

// Configurazione colonne tabella
const COLUMNS = [
    { key: 'operation_date', label: 'Date', type: 'date' },
    { key: 'ticker', label: 'Ticker', type: 'text' },
    { key: 'buy_or_sell', label: 'Type', type: 'text' },
    { key: 'total_shares_num', label: 'Shares', type: 'number' },
    { key: 'total_outlay_eur', label: 'Total (€)', type: 'number' },
    { key: 'person', label: 'Person', type: 'text' },
];

export default function Transactions() {
    const [transactions, setTransactions] = useState < Transaction[] > ([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState < string | null > (null);

    // --- STATI TABELLA ---
    const [activeColumn, setActiveColumn] = useState < string | null > (null);
    const [filters, setFilters] = useState < Record < string, string[]>> ({});
    const [menuSearchTerm, setMenuSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState < SortConfig > ({ key: 'operation_date', direction: 'desc' });

    // --- STATI MODALE (ADD TRANSACTION) ---
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Stato del Form
    const [formData, setFormData] = useState({
        people: [] as string[],
        security: '',
        date: new Date().toISOString().split('T')[0], // Default Oggi
        price: '',
        currency: 'EUR',
        exchange_rate: '1',
        shares_single: '', // Usato se 1 persona
        shares_multi: {} as Record<string, string>, // Usato se >1 persona
        platform: '',
        account_owner: '',
        regulated: 'Yes',
        expenses: '0',
        taxes: '0',
        type: 'Acquisto' // Default
    });

    useEffect(() => {
        fetchTransactions();
    }, []);

    // Gestione cambio valuta -> resetta cambio a 1 se EUR
    useEffect(() => {
        if (formData.currency === 'EUR') {
            setFormData(prev => ({ ...prev, exchange_rate: '1' }));
        }
    }, [formData.currency]);

    async function fetchTransactions() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                // Ordiniamo per data di default per vedere le ultime inserite
                .order('operation_date', { ascending: false });

            if (error) throw error;
            setTransactions(data || []);
        } catch (err: any) {
            console.error("Fetch error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    // --- LOGICA MODALE (UI HANDLING) ---
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const togglePerson = (person: string) => {
        setFormData(prev => {
            const current = prev.people;
            if (current.includes(person)) {
                // Rimuovi persona e le sue quote
                const newPeople = current.filter(p => p !== person);
                const newSharesMulti = { ...prev.shares_multi };
                delete newSharesMulti[person];
                return { ...prev, people: newPeople, shares_multi: newSharesMulti };
            } else {
                // Aggiungi persona
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

    // --- INVIO DATI A PYTHON (RENDER) ---
    const handleSubmit = async () => {
        // 1. Validazione base dell'interfaccia
        if (formData.people.length === 0 || !formData.security || !formData.price) {
            alert("Please fill in all required fields (People, Security, Price).");
            return;
        }

        setLoading(true);

        try {
            // 2. Chiamata reale al server Python su Render
            console.log("⏳ Sending data to Python API...");

            const response = await fetch(`${PYTHON_API_URL}/process_transaction`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.detail || "Error connecting to Python server");
            }

            // 3. Successo
            console.log("✅ Success:", result);
            alert(`Transaction successfully processed! ${result.inserted_rows} rows added to DB.`);

            // Chiudiamo la modale e resettiamo il form
            setIsModalOpen(false);
            setFormData({
                people: [], security: '', date: new Date().toISOString().split('T')[0],
                price: '', currency: 'EUR', exchange_rate: '1', shares_single: '',
                shares_multi: {}, platform: '', account_owner: '', regulated: 'Yes',
                expenses: '0', taxes: '0', type: 'Acquisto'
            });

            // Ricarichiamo la tabella per mostrare i nuovi dati
            fetchTransactions();

        } catch (err: any) {
            console.error("API Error:", err);
            alert(`❌ Error processing transaction: ${err.message}\n\nCheck if the Render server is running.`);
        } finally {
            setLoading(false);
        }
    };


    // --- HELPER LOGICHE TABELLA ---
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
        if (menuSearchTerm) {
            return unique.filter(v => v.toLowerCase().includes(menuSearchTerm.toLowerCase()));
        }
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

    // Handler Tabella
    const handlePasteInSearch = (e: React.ClipboardEvent<HTMLInputElement>, columnKey: string) => {
        e.preventDefault();
        const pastedText = e.clipboardData.getData('text');
        const values = pastedText.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
        if (values.length === 0) return;
        setFilters(prev => {
            const currentSelected = prev[columnKey] || [];
            const newSelected = Array.from(new Set([...currentSelected, ...values]));
            return { ...prev, [columnKey]: newSelected };
        });
        setMenuSearchTerm('');
    };

    const toggleFilterValue = (columnKey: string, value: string) => {
        setFilters(prev => {
            const currentSelected = prev[columnKey] || [];
            if (currentSelected.includes(value)) {
                const newSelected = currentSelected.filter(v => v !== value);
                return { ...prev, [columnKey]: newSelected.length > 0 ? newSelected : [] };
            } else {
                return { ...prev, [columnKey]: [...currentSelected, value] };
            }
        });
    };

    return (
        <main className="min-h-screen p-8 bg-gray-50 font-sans" onClick={() => setActiveColumn(null)}>
            <div className="max-w-6xl mx-auto" onClick={(e) => e.stopPropagation()}>

                {/* HEADER CON BOTTONE ADD */}
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">Transactions</h1>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors"
                    >
                        <Plus size={20} />
                        Add Transaction
                    </button>
                </div>

                {loading && !isModalOpen && <p className="text-gray-600">Loading data...</p>}
                {error && <p className="text-red-500 bg-red-50 p-4 rounded">Error: {error}</p>}

                {!loading && !error && (
                    <div className="bg-white shadow-lg rounded-xl overflow-visible border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    {COLUMNS.map((col) => (
                                        <th key={col.key} className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider relative group">
                                            <div
                                                className="flex items-center cursor-pointer hover:text-blue-600 space-x-2"
                                                onClick={() => {
                                                    if (activeColumn === col.key) setActiveColumn(null);
                                                    else { setActiveColumn(col.key); setMenuSearchTerm(''); }
                                                }}
                                            >
                                                <span>{col.label}</span>
                                                <Filter size={14} className={(filters[col.key] && filters[col.key].length > 0) ? "text-blue-600 fill-blue-100" : "text-gray-400 opacity-0 group-hover:opacity-100"} />
                                            </div>
                                            {activeColumn === col.key && (
                                                <div className="absolute z-50 top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col cursor-default">
                                                    <div className="p-2 border-b border-gray-100 bg-gray-50 rounded-t-lg flex gap-1">
                                                        <button onClick={() => setSortConfig({ key: col.key, direction: 'asc' })} className="flex-1 flex items-center justify-center p-1.5 rounded text-[10px] border bg-white hover:bg-gray-100"><ArrowUp size={12} /> ASC</button>
                                                        <button onClick={() => setSortConfig({ key: col.key, direction: 'desc' })} className="flex-1 flex items-center justify-center p-1.5 rounded text-[10px] border bg-white hover:bg-gray-100"><ArrowDown size={12} /> DESC</button>
                                                    </div>
                                                    <div className="p-2 border-b border-gray-100">
                                                        <div className="relative">
                                                            <Search size={14} className="absolute left-2 top-2 text-gray-400" />
                                                            <input autoFocus type="text" placeholder="Search or paste..." className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded" value={menuSearchTerm} onChange={(e) => setMenuSearchTerm(e.target.value)} onPaste={(e) => handlePasteInSearch(e, col.key)} />
                                                        </div>
                                                        <div className="flex justify-between mt-2 px-1">
                                                            <button onClick={() => setFilters(prev => ({ ...prev, [col.key]: uniqueColumnValues }))} className="text-[10px] text-blue-600">Select All</button>
                                                            <button onClick={() => setFilters(prev => { const n = { ...prev }; delete n[col.key]; return n; })} className="text-[10px] text-red-500">Clear</button>
                                                        </div>
                                                    </div>
                                                    <div className="max-h-60 overflow-y-auto p-1">
                                                        {uniqueColumnValues.map(val => (
                                                            <label key={val} className="flex items-center px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                                                                <input type="checkbox" className="mr-2" checked={!!filters[col.key]?.includes(val)} onChange={() => toggleFilterValue(col.key, val)} />
                                                                <span className="text-sm text-gray-700 truncate">{val}</span>
                                                            </label>
                                                        ))}
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
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(t.operation_date).toLocaleDateString('it-IT')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{t.ticker}</td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${t.buy_or_sell === 'Acquisto' ? 'text-green-600' : 'text-red-600'}`}>{t.buy_or_sell}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{t.total_shares_num}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-mono">{t.total_outlay_eur?.toFixed(2)} €</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.person}</td>
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

                            {/* Modal Header */}
                            <div className="flex justify-between items-center p-6 border-b border-gray-100">
                                <h2 className="text-2xl font-bold text-gray-800">Add New Transaction</h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">

                                {/* 1. PEOPLE (Full Width) */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">1. People Involved</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {PEOPLE_OPTIONS.map(person => {
                                            const isSelected = formData.people.includes(person);
                                            return (
                                                <button
                                                    key={person}
                                                    onClick={() => togglePerson(person)}
                                                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${isSelected
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                                                        }`}
                                                >
                                                    {isSelected && <Check size={14} className="inline mr-1" />}
                                                    {person}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* 2. SECURITY */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">2. Security (Ticker)</label>
                                    <input
                                        name="security"
                                        value={formData.security}
                                        onChange={handleInputChange}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                                        placeholder="e.g. AAPL"
                                    />
                                </div>

                                {/* 3. DATE */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">3. Date</label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            name="date"
                                            value={formData.date}
                                            onChange={handleInputChange}
                                            className="w-full border border-gray-300 rounded-lg p-2.