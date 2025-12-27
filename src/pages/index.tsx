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
    [key: string]: any; // Permette accesso dinamico con stringhe
};

type SortConfig = {
    key: string | null;
    direction: 'asc' | 'desc';
};

// Configurazione delle colonne per evitare ripetizioni nel codice
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

    // --- STATI PER I FILTRI E ORDINAMENTO ---
    // Quale colonna ha il menu aperto? (es. 'ticker' o null)
    const [activeColumn, setActiveColumn] = useState < string | null > (null);

    // Filtri attivi per ogni colonna: { ticker: "APPL", buy_or_sell: "Acq" }
    const [filters, setFilters] = useState < Record < string, string>> ({});

    // Ordinamento attuale
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

    // --- LOGICA DI FILTRO E ORDINAMENTO COMBINATA ---
    const processedData = useMemo(() => {
        let data = [...transactions];

        // 1. Applica TUTTI i filtri attivi
        Object.keys(filters).forEach((key) => {
            const value = filters[key].toLowerCase();
            if (value) {
                data = data.filter((item) => {
                    const itemValue = String(item[key] || '').toLowerCase();
                    // Gestione speciale per le date (per cercare "2023" dentro una data ISO)
                    return itemValue.includes(value);
                });
            }
        });

        // 2. Applica l'ordinamento
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

    // Gestori eventi
    const toggleColumnMenu = (key: string) => {
        if (activeColumn === key) {
            setActiveColumn(null); // Chiudi se è già aperto
        } else {
            setActiveColumn(key); // Apri il nuovo
        }
    };

    const handleSort = (key: string, direction: 'asc' | 'desc') => {
        setSortConfig({ key, direction });
        // Non chiudiamo il menu subito per dare feedback, o possiamo chiuderlo:
        // setActiveColumn(null); 
    };

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({
            ...prev,
            [key]: value
        }));
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

                                            {/* HEADER CLICCABILE */}
                                            <div
                                                className="flex items-center cursor-pointer hover:text-blue-600 space-x-2"
                                                onClick={() => toggleColumnMenu(col.key)}
                                            >
                                                <span>{col.label}</span>
                                                {/* Mostra icona se c'è un filtro attivo o ordinamento su questa colonna */}
                                                {filters[col.key] || sortConfig.key === col.key ? (
                                                    <Filter size={14} className="text-blue-500" />
                                                ) : (
                                                    <Filter size={14} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                                                )}
                                            </div>

                                            {/* POPOVER (La "Finestrina") */}
                                            {activeColumn === col.key && (
                                                <div className="absolute z-50 top-full left-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-100 p-3">

                                                    {/* 1. Opzioni Ordinamento */}
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

                                                    {/* 2. Input Ricerca */}
                                                    <div className="mb-1">
                                                        <label className="text-[10px] uppercase text-gray-400 font-bold mb-1 block">Filtra {col.label}</label>
                                                        <div className="relative">
                                                            <input
                                                                autoFocus
                                                                type="text"
                                                                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                                                                placeholder={`Cerca in ${col.label}...`}
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
                                            Nessun risultato con questi filtri.
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