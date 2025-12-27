import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Filter, ArrowUp, ArrowDown, Search, Check, Plus, X, Calendar, TrendingUp, TrendingDown } from 'lucide-react';

// --- CONFIGURAZIONE ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- API CONFIGURATION ---
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

const COLUMNS = [
    { key: 'operation_date', label: 'Date', type: 'date' },
    { key: 'ticker', label: 'Ticker', type: 'text' },
    { key: 'buy_or_sell', label: 'Type', type: 'text' }, // Mostrerà "Acquisto", "Vendita", "Profitto"
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

    // --- STATI MODALE ---
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Stato del Form
    const [formData, setFormData] = useState({
        type: 'Acquisto', // NUOVO CAMPO: Default Acquisto
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

    useEffect(() => {
        fetchTransactions();
    }, []);

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

    // --- LOGICA MODALE ---
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

            console.log("✅ Success:", result);
            alert(`Transaction processed! ${result.inserted_rows} rows added (Sale + P&L if applicable).`);

            setIsModalOpen(false);
            // Reset form
            setFormData({
                type: 'Acquisto', // Reset al default
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

    const handlePasteInSearch = (e: React.ClipboardEvent<HTMLInputElement>, columnKey: string) => { /* ... logica identica a prima ... */ };
    const toggleFilterValue = (columnKey: string, value: string) => { /* ... logica identica a prima ... */ };

    return (
        <main className="min-h-screen p-8 bg-gray-50 font-sans" onClick={() => setActiveColumn(null)}>
            <div className="max-w-6xl mx-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">Transactions</h1>
                    <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors">
                        <Plus size={20} /> Add Transaction
                    </button>
                </div>

                {loading && !isModalOpen && <p className="text-gray-600">Loading data...</p>}
                {error && <p className="text-red-500 bg-red-50 p-4 rounded">Error: {error}</p>}

                {!loading && !error && (
                    <div className="bg-white shadow-lg rounded-xl overflow-visible border border-gray-200">
                        {/* TABELLA RIMANE IDENTICA A PRIMA - OMETTO PER BREVITÀ, COPIA DAL VECCHIO FILE SE NECESSARIO, MA L'ARRAY COLUMNS È SOPRA */}
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    {COLUMNS.map((col) => (
                                        <th key={col.key} className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider relative group">
                                            {col.label} {/* Semplificato per leggibilità qui, mantieni il tuo codice filtri */}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {processedData.map((t) => (
                                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(t.operation_date).toLocaleDateString('it-IT')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{t.ticker}</td>

                                        {/* COLORAZIONE TIPO TRANSAZIONE */}
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium`}>
                                            <span className={`px-2 py-1 rounded-full text-xs 
                                                ${t.buy_or_sell === 'Acquisto' ? 'bg-green-100 text-green-800' :
                                                    t.buy_or_sell === 'Vendita' ? 'bg-red-100 text-red-800' :
                                                        'bg-gray-100 text-gray-800'}`}>
                                                {t.category || t.buy_or_sell} {/* Mostra "Profitto"/"Perdita" se presente in category */}
                                            </span>
                                        </td>

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
                            <div className="flex justify-between items-center p-6 border-b border-gray-100">
                                <h2 className="text-2xl font-bold text-gray-800">Add New Transaction</h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                            </div>

                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">

                                {/* 0. TYPE SELECTOR (NUOVO) */}
                                <div className="md:col-span-2 flex justify-center mb-4">
                                    <div className="bg-gray-100 p-1 rounded-lg flex">
                                        <button
                                            className={`px-6 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${formData.type === 'Acquisto' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                            onClick={() => setFormData(prev => ({ ...prev, type: 'Acquisto' }))}
                                        >
                                            <TrendingUp size={16} /> Purchase
                                        </button>
                                        <button
                                            className={`px-6 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${formData.type === 'Vendita' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                            onClick={() => setFormData(prev => ({ ...prev, type: 'Vendita' }))}
                                        >
                                            <TrendingDown size={16} /> Sale
                                        </button>
                                    </div>
                                </div>

                                {/* GLI ALTRI CAMPI RIMANGONO IDENTICI - People, Security, Date, Price... */}
                                {/* ... COPIA QUI IL RESTO DEI CAMPI INPUT DAL CODICE PRECEDENTE ... */}
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