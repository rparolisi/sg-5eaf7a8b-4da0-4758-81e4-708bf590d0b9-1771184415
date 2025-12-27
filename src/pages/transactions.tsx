import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Filter, ArrowUp, ArrowDown, Search, Check } from 'lucide-react';
import Link from 'next/link';

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

    // --- STATI ---
    const [activeColumn, setActiveColumn] = useState < string | null > (null);

    // filters ora mappa la colonna a un ARRAY di stringhe selezionate
    // Es: { ticker: ['AAPL', 'MSFT'], buy_or_sell: ['Acquisto'] }
    const [filters, setFilters] = useState < Record < string, string[]>> ({});

    // Stato per la barra di ricerca interna al menu (per filtrare la lista di checkbox)
    const [menuSearchTerm, setMenuSearchTerm] = useState('');

    const [sortConfig, setSortConfig] = useState < SortConfig > ({ key: 'operation_date', direction: 'desc' });

    useEffect(() => {
        fetchTransactions();
    }, []);

    async function fetchTransactions() {
        try {
            setLoading(true);
            const { data, error } = await supabase.from('transactions').select('*');
            if (error) throw error;
            setTransactions(data || []);
        } catch (err: any) {
            console.error("Errore fetch:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    // --- HELPER: FORMATTAZIONE VALORI ---
    // Trasforma qualsiasi valore (data ISO, numero) in stringa leggibile per l'utente
    const formatValue = (key: string, value: any): string => {
        if (!value && value !== 0) return '';
        if (key === 'operation_date') return new Date(value).toLocaleDateString('it-IT');
        if (typeof value === 'number') return value.toString(); // Semplifichiamo per il filtro
        return String(value);
    };

    // --- LOGICA 1: ESTRAZIONE VALORI UNICI ---
    // Calcola la lista dei valori unici per la colonna attualmente aperta
    const uniqueColumnValues = useMemo(() => {
        if (!activeColumn) return [];

        // 1. Estrai tutti i valori grezzi
        const rawValues = transactions.map(t => formatValue(activeColumn, t[activeColumn]));

        // 2. Rimuovi duplicati
        const unique = Array.from(new Set(rawValues)).sort();

        // 3. Filtra in base a cosa l'utente sta scrivendo nella casella di ricerca del menu
        if (menuSearchTerm) {
            return unique.filter(v => v.toLowerCase().includes(menuSearchTerm.toLowerCase()));
        }
        return unique;
    }, [transactions, activeColumn, menuSearchTerm]);

    // --- LOGICA 2: FILTRO DATI TABELLA ---
    const processedData = useMemo(() => {
        let data = [...transactions];

        // Applica filtri
        Object.keys(filters).forEach((key) => {
            const selectedValues = filters[key];
            // Se c'è almeno un valore selezionato per questa colonna, filtra
            if (selectedValues && selectedValues.length > 0) {
                data = data.filter((row) => {
                    const rowValFormatted = formatValue(key, row[key]);
                    return selectedValues.includes(rowValFormatted);
                });
            }
        });

        // Applica ordinamento
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

    // --- GESTORI EVENTI ---

    // Gestione click su checkbox singolo
    const toggleFilterValue = (columnKey: string, value: string) => {
        setFilters(prev => {
            const currentSelected = prev[columnKey] || [];
            if (currentSelected.includes(value)) {
                // Rimuovi
                const newSelected = currentSelected.filter(v => v !== value);
                return { ...prev, [columnKey]: newSelected.length > 0 ? newSelected : [] }; // Se vuoto, rimuovi chiave o lascia array vuoto? Meglio array vuoto o undefined. Qui puliamo.
            } else {
                // Aggiungi
                return { ...prev, [columnKey]: [...currentSelected, value] };
            }
        });
    };

    // GESTIONE COPIA-INCOLLA (Il cuore della tua richiesta)
    const handlePasteInSearch = (e: React.ClipboardEvent<HTMLInputElement>, columnKey: string) => {
        e.preventDefault();
        // 1. Prendi il testo incollato
        const pastedText = e.clipboardData.getData('text');

        // 2. Separalo per spazi, tab o virgole
        const values = pastedText.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);

        if (values.length === 0) return;

        // 3. Aggiungi questi valori ai filtri selezionati
        setFilters(prev => {
            const currentSelected = prev[columnKey] || [];
            // Unisci i vecchi con i nuovi, rimuovendo duplicati
            const newSelected = Array.from(new Set([...currentSelected, ...values]));

            // Nota: Funziona bene se il valore incollato corrisponde esattamente al valore formattato (es. "AAPL").
            // Se incolli "15/11/2025" funziona. Se incolli "2025-11-15" no, perché cerchiamo il valore formattato.
            return { ...prev, [columnKey]: newSelected };
        });

        // Opzionale: pulisci la barra di ricerca dopo l'incolla
        setMenuSearchTerm('');
    };

    const handleSelectAll = (columnKey: string) => {
        // Seleziona tutti i valori VISIBILI (filtrati dalla ricerca)
        setFilters(prev => ({
            ...prev,
            [columnKey]: [...(prev[columnKey] || []), ...uniqueColumnValues] // Aggiungi quelli visibili
        }));
    };

    const handleClearColumnFilter = (columnKey: string) => {
        setFilters(prev => {
            const newState = { ...prev };
            delete newState[columnKey];
            return newState;
        });
    };

    const isFilterActive = (key: string) => {
        return filters[key] && filters[key].length > 0;
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

                                            {/* HEADER + Icona Filtro */}
                                            <div
                                                className="flex items-center cursor-pointer hover:text-blue-600 space-x-2"
                                                onClick={() => {
                                                    if (activeColumn === col.key) setActiveColumn(null);
                                                    else {
                                                        setActiveColumn(col.key);
                                                        setMenuSearchTerm(''); // Resetta ricerca quando apri menu
                                                    }
                                                }}
                                            >
                                                <span>{col.label}</span>
                                                <Filter
                                                    size={14}
                                                    className={isFilterActive(col.key) ? "text-blue-600 fill-blue-100" : "text-gray-400 opacity-0 group-hover:opacity-100"}
                                                />
                                            </div>

                                            {/* POPOVER MENU EXCEL-STYLE */}
                                            {activeColumn === col.key && (
                                                <div className="absolute z-50 top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col cursor-default">

                                                    {/* 1. Opzioni Ordinamento */}
                                                    <div className="p-2 border-b border-gray-100 bg-gray-50 rounded-t-lg flex gap-1">
                                                        <button
                                                            onClick={() => setSortConfig({ key: col.key, direction: 'asc' })}
                                                            className={`flex-1 flex items-center justify-center p-1.5 rounded text-[10px] border ${sortConfig.key === col.key && sortConfig.direction === 'asc' ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                                                        >
                                                            <ArrowUp size={12} className="mr-1" /> ASC
                                                        </button>
                                                        <button
                                                            onClick={() => setSortConfig({ key: col.key, direction: 'desc' })}
                                                            className={`flex-1 flex items-center justify-center p-1.5 rounded text-[10px] border ${sortConfig.key === col.key && sortConfig.direction === 'desc' ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                                                        >
                                                            <ArrowDown size={12} className="mr-1" /> DESC
                                                        </button>
                                                    </div>

                                                    {/* 2. Barra di Ricerca (con PASTE HANDLER) */}
                                                    <div className="p-2 border-b border-gray-100">
                                                        <div className="relative">
                                                            <Search size={14} className="absolute left-2 top-2 text-gray-400" />
                                                            <input
                                                                autoFocus
                                                                type="text"
                                                                placeholder="Cerca o incolla valori..."
                                                                className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                value={menuSearchTerm}
                                                                onChange={(e) => setMenuSearchTerm(e.target.value)}
                                                                onPaste={(e) => handlePasteInSearch(e, col.key)}
                                                            />
                                                        </div>
                                                        <div className="flex justify-between mt-2 px-1">
                                                            <button onClick={() => handleSelectAll(col.key)} className="text-[10px] text-blue-600 hover:underline">Seleziona visibili</button>
                                                            <button onClick={() => handleClearColumnFilter(col.key)} className="text-[10px] text-red-500 hover:underline">Pulisci filtro</button>
                                                        </div>
                                                    </div>

                                                    {/* 3. Lista Valori Unici (Scrollabile) */}
                                                    <div className="max-h-60 overflow-y-auto p-1">
                                                        {uniqueColumnValues.length > 0 ? (
                                                            uniqueColumnValues.map((val) => {
                                                                const isChecked = filters[col.key]?.includes(val);
                                                                return (
                                                                    <label key={val} className="flex items-center px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                            checked={!!isChecked}
                                                                            onChange={() => toggleFilterValue(col.key, val)}
                                                                        />
                                                                        <span className="text-sm text-gray-700 truncate">{val}</span>
                                                                    </label>
                                                                )
                                                            })
                                                        ) : (
                                                            <p className="p-4 text-xs text-gray-400 text-center">Nessun valore trovato</p>
                                                        )}
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
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                                {t.total_shares_num}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-mono">
                                                {t.total_outlay_eur?.toFixed(2)} €
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">
                                            Nessun risultato. Controlla i filtri attivi.
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