import { useEffect, useState, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Filter, ArrowUp, ArrowDown, X } from 'lucide-react';

// --- CONFIGURAZIONE ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- TIPI ---
type Transaction = {
    id: string;
    ticker: string;
    operation_date: string;
    buy_or_sell: string;
    total_shares_num: number;
    total_outlay_eur: number;
    [key: string]: any;
};

type SortConfig = {
    key: string | null;
    direction: 'asc' | 'desc';
};

// Configurazione colonne
const COLUMNS = [
    { key: 'operation_date', label: 'Data', type: 'date' },
    { key: 'ticker', label: 'Ticker', type: 'text' },
    { key: 'buy_or_sell', label: 'Tipo', type: 'text' },
    { key: 'total_shares_num', label: 'Azioni', type: 'number' },
    { key: 'total_outlay_eur', label: 'Totale (€)', type: 'number' },
];

export default function Home() {
    const [transactions, setTransactions] = useState < Transaction[] > ([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState < string | null > (null);

    // Stati interfaccia
    const [activeColumn, setActiveColumn] = useState < string | null > (null);
    const [filters, setFilters] = useState < Record < string, string>> ({});
    const [sortConfig, setSortConfig] = useState < SortConfig > ({ key: 'operation_date', direction: 'desc' });

    useEffect(() => {
        fetchTransactions();
    }, []);

    async function fetchTransactions() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('transactions')
                .select('*');

            if (error) throw error;
            setTransactions(data || []);
        } catch (err: any) {
            console.error("Errore fetch:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    // --- LOGICA FILTRO E ORDINAMENTO AGGIORNATA ---
    const processedData = useMemo(() => {
        let data = [...transactions];

        // 1. Applica Filtri
        Object.keys(filters).forEach((key) => {
            const searchValue = filters[key].toLowerCase();

            if (searchValue) {
                data = data.filter((item) => {
                    let itemValue = '';

                    // MODIFICA CRUCIALE QUI:
                    // Se stiamo filtrando la colonna 'operation_date', la trasformiamo in formato IT prima del controllo
                    if (key === 'operation_date' && item[key]) {
                        itemValue = new Date(item[key]).toLocaleDateString('it-IT'); // Diventa "15/11/2025"
                    } else {
                        // Per tutte le altre colonne, prendiamo il valore grezzo
                        itemValue = String(item[key] || '');
                    }

                    return itemValue.toLowerCase().includes(searchValue);
                });
            }
        });

        // 2. Applica Ordinamento
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

    // Gestori
    const toggleColumnMenu = (key: string) => {
        if (activeColumn === key) setActiveColumn(null);
        else setActiveColumn(key);
    };

    const handleSort = (key: string, direction: 'asc' | 'desc') => {
        setSortConfig({ key, direction });
    };

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const clearFilter = (key: string) => {
        const newFilters = { ...filters };
        delete newFilters[key];
        setFilters(newFilters);
    };

    return (
        <main className="min-h-screen p-8 bg-gray-50 font-sans" onClick={() => setActiveColumn(null)}>
            <div className="max-w-6xl mx-auto" onClick={(e) => e.stopPropagation()}>
                <h1 className="text-3xl font-bold mb-6 text-gray-800">Monitor Investimenti</h1>

                {loading && <p className="text-gray-600">Caricamento dati...</p>}
                {error && <p className="text-red-500 bg-red-50 p-4 rounded">Errore: {error}</p>}

                {!loading && !error && (
                    <div className="bg-white shadow-lg rounded-xl overflow-visible border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    {COLUMNS.map((col) => (
                                        <th key={col.key} className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider relative group">

                                            {/* HEADER */}
                                            <div
                                                className="flex items-center cursor-pointer hover:text-blue-600 space-x-2"
                                                onClick={() => toggleColumnMenu(col.key)}
                                            >
                                                <span>{col.label}</span>
                                                {filters[col.key] || sortConfig.key === col.key ? (
                                                    <Filter size={14} className="text-blue-500" />
                                                ) : (
                                                    <Filter size={14} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                                                )}
                                            </div>

                                            {/* POPOVER MENU */}
                                            {activeColumn === col.key && (
                                                <div className="absolute z-50 top-full left-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-100 p-3">

                                                    {/* Ordinamento */}
                                                    <div className="flex flex-col gap-1 mb-3">
                                                        <button
                                                            onClick={() => handleSort(col.key, 'asc')}
                                                            className={`flex items-center px-2 py-1.5 text-xs rounded hover:bg-gray-100 ${sortConfig.key === col.key && sortConfig.direction === 'asc' ? 'text-blue-600 bg-blue-50 font-bold' : 'text-gray-700'}`}
                                                        >
                                                            <ArrowUp size={14} className="mr-2" /> Ordina Crescente
                                                        </button>
                                                        <button
                                                            onClick={() => handleSort(col.key, 'desc')}
                                                            className={`flex items-center px-2 py-1.5 text-xs rounded hover:bg-gray-100 ${sortConfig.key === col.key && sortConfig.direction === 'desc' ? 'text-blue-600 bg-blue-50 font-bold' : 'text-gray-700'}`}
                                                        >
                                                            <ArrowDown size={14} className="mr-2" /> Ordina Decrescente
                                                        </button>
                                                    </div>

                                                    <hr className="border-gray-100 mb-3" />

                                                    {/* Ricerca */}
                                                    <div className="mb-1">
                                                        <label className="text-[10px] uppercase text-gray-400 font-bold mb-1 block">Filtra {col.label}</label>
                                                        <div className="relative">
                                                            <input
                                                                autoFocus
                                                                type="text"
                                                                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                                                                placeholder={col.key === 'operation_date' ? "es. 15/11/2025" : "Cerca..."}
                                                                value={filters[col.key] || ''}
                                                                onChange={(e) => handleFilterChange(col.key, e.target.value)}
                                                            />
                                                            {filters[col.key] && (
                                                                <button
                                                                    onClick={() => clearFilter(col.key)}
                                                                    className="absolute right-2 top-1.5 text-gray-400 hover:text-red-500"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            <tbody className="bg-white divide-y divide-gray-200">
                                {processedData.length > 0 ? (
                                    processedData.map((t) => (
                                        <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {new Date(t.operation_date).toLocaleDateString('it-IT')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                                {t.ticker}
                                            </td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${t.buy_or_sell === 'Acquisto' ? 'text-green-600' : 'text-red-600'}`}>
                                                {t.buy_or_sell}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {t.total_shares_num}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                                                {t.total_outlay_eur?.toFixed(2)} €
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">
                                            Nessun risultato trovato.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </main>
    );
}