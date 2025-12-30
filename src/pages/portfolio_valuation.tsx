import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle, Wallet, Loader2, Search, Filter, Check, ChevronDown, Calendar, XCircle } from 'lucide-react';
import { useRouter } from 'next/router';
import Link from 'next/link';

// --- CONFIGURAZIONE ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const PYTHON_API_BASE_URL = "https://invest-monitor-api.onrender.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- COMPONENTE MULTI-SELECT ---
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

// --- INTERFACCE ---
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
    ticker: string;
    y_ticker: string;
    quantity: number;
    avg_price: number;
    avg_date: string | null;
    total_exposure: number;
    current_price: number | null;
    profit_loss: number | null;
    performance_perc: number | null;
}

export default function PortfolioValuation() {
    const router = useRouter();

    // Stato Dati Grezzi
    const [rawTransactions, setRawTransactions] = useState < Transaction[] > ([]);
    const [loadingData, setLoadingData] = useState(true);

    // Stato Prezzi (da Python)
    const [marketPrices, setMarketPrices] = useState < Record < string, number>> ({});
    const [loadingPrices, setLoadingPrices] = useState(false);
    const [pricesError, setPricesError] = useState("");

    // Stato Filtri
    const [filters, setFilters] = useState({
        person: [] as string[],
        ticker: [] as string[],
        startDate: '',
        endDate: ''
    });

    // 1. CARICAMENTO DATI INIZIALE (Raw Transactions)
    useEffect(() => {
        const initData = async () => {
            setLoadingData(true);
            try {
                console.log("🔄 Fetching transactions from Supabase...");
                // Scarica tutto lo storico
                const { data, error } = await supabase
                    .from('transactions')
                    .select('*')
                    .order('operation_date', { ascending: true });

                if (error) throw error;

                const transactions = data || [];
                console.log(`✅ Loaded ${transactions.length} transactions.`);
                setRawTransactions(transactions);

                // Imposta date di default (Min e Max) se ci sono dati
                if (transactions.length > 0) {
                    const dates = transactions.map(t => new Date(t.operation_date).getTime());
                    const min = new Date(Math.min(...dates)).toISOString().split('T')[0];
                    const max = new Date(Math.max(...dates)).toISOString().split('T')[0];
                    const today = new Date().toISOString().split('T')[0];

                    // Usa la data massima trovata o oggi se successiva
                    const end = today > max ? today : max;

                    setFilters(prev => ({
                        ...prev,
                        startDate: min,
                        endDate: end
                    }));
                }
            } catch (e) {
                console.error("❌ Error loading transactions:", e);
            } finally {
                setLoadingData(false);
            }
        };
        initData();
    }, []);

    // 2. OPZIONI FILTRI UNICI
    const uniqueOptions = useMemo(() => {
        const getUnique = (key: keyof Transaction) => Array.from(new Set(rawTransactions.map(t => t[key]).filter(Boolean))).sort();
        return {
            people: getUnique('person') as string[],
            tickers: getUnique('ticker') as string[]
        };
    }, [rawTransactions]);

    // 3. MOTORE DI CALCOLO LOCALE (Aggiornamento istantaneo tabella)
    // 3. MOTORE DI CALCOLO LOCALE (Aggiornamento istantaneo tabella)
    const portfolioData = useMemo(() => {
        if (rawTransactions.length === 0) return [];

        // A. Filtra Transazioni
        const filtered = rawTransactions.filter(t => {
            // Normalizzazione dei filtri
            if (filters.person.length > 0 && !filters.person.includes(t.person)) return false;
            if (filters.ticker.length > 0 && !filters.ticker.includes(t.ticker)) return false;

            // FIX DATE: Prendi solo la parte YYYY-MM-DD per il confronto
            // Alcuni DB ritornano "2023-01-01T00:00:00", noi vogliamo solo "2023-01-01"
            const tDate = t.operation_date ? String(t.operation_date).split('T')[0] : '';

            if (filters.startDate && tDate < filters.startDate) return false;
            if (filters.endDate && tDate > filters.endDate) return false;

            return true;
        });

        // B. Raggruppa e Calcola
        const groups: Record<string, { qty: number, cost: number, dates: number[], weights: number[] }> = {};

        filtered.forEach(t => {
            const ticker = t.ticker;
            if (!groups[ticker]) groups[ticker] = { qty: 0, cost: 0, dates: [], weights: [] };

            // FIX TIPI: Converti tutto in Number per sicurezza (Supabase a volte manda stringhe)
            const qty = Number(t.shares_count || 0);
            const sign = Number(t.operation_sign || 0);
            const price = Number(t.price_per_share_eur || 0);
            const outlay = t.total_outlay_eur !== null ? Number(t.total_outlay_eur) : (price * qty);

            // FIX LOGICA: buy_or_sell potrebbe arrivare come stringa "1" o numero 1
            const isRealTransaction = Number(t.buy_or_sell) === 1;

            if (isRealTransaction) {
                if (sign === 1) { // Acquisto
                    groups[ticker].qty += qty;
                    groups[ticker].cost += outlay;
                    // Per data media
                    groups[ticker].dates.push(new Date(t.operation_date).getTime());
                    groups[ticker].weights.push(outlay);
                } else { // Vendita
                    // Riduciamo costo e quantità proporzionalmente
                    const currentAvg = groups[ticker].qty > 0 ? groups[ticker].cost / groups[ticker].qty : 0;
                    groups[ticker].qty -= qty;
                    groups[ticker].cost -= (currentAvg * qty);
                }
            }
        });

        // C. Costruisci Array Finale
        const items: PortfolioItem[] = Object.keys(groups).map(ticker => {
            const g = groups[ticker];

            // Ignora posizioni chiuse (quantità quasi zero)
            if (Math.abs(g.qty) < 0.001) return null;

            const quantity = g.qty;
            const total_exposure = g.cost;
            const avg_price = quantity !== 0 ? total_exposure / quantity : 0;

            // Calcolo Data Media Ponderata
            let avg_date = null;
            if (g.dates.length > 0) {
                const totalWeight = g.weights.reduce((a, b) => a + b, 0);
                if (totalWeight > 0) {
                    const weightedSum = g.dates.reduce((acc, date, i) => acc + (date * g.weights[i]), 0);
                    avg_date = new Date(weightedSum / totalWeight).toISOString().split('T')[0];
                }
            }

            // D. Integrazione Prezzi Mercato (se disponibili)
            const current_price = marketPrices[ticker] || null;
            let profit_loss = null;
            let performance_perc = null;

            if (current_price !== null) {
                const mktValue = current_price * quantity;
                profit_loss = mktValue - total_exposure;
                performance_perc = total_exposure !== 0 ? (profit_loss / total_exposure) * 100 : 0;
            }

            return {
                ticker,
                y_ticker: ticker,
                quantity,
                avg_price,
                avg_date,
                total_exposure,
                current_price,
                profit_loss,
                performance_perc
            };
        }).filter(item => item !== null) as PortfolioItem[];

        // Ordina per esposizione decrescente
        return items.sort((a, b) => b.total_exposure - a.total_exposure);

    }, [rawTransactions, filters, marketPrices]);

    // 4. FUNZIONE RICERCA PREZZI (Chiama Python)
    const handleSearch = async () => {
        setLoadingPrices(true);
        setPricesError("");
        try {
            console.log("🔎 Searching prices via Python API...");
            console.log("📅 Target Date:", filters.endDate);

            // Costruisci URL con data target
            const url = new URL(`${PYTHON_API_BASE_URL}/api/portfolio`);
            url.searchParams.append("user_id", "SEARCH_REQ");

            // Se c'è una data di fine, passala come parametro target_date
            if (filters.endDate) {
                url.searchParams.append("target_date", filters.endDate);
            }

            const response = await fetch(url.toString());

            if (!response.ok) throw new Error(`API Error: ${response.status}`);

            const result = await response.json();
            console.log("✅ Prices received:", result);

            // Estraiamo i prezzi freschi
            const pricesMap: Record<string, number> = {};
            if (Array.isArray(result)) {
                result.forEach((p: any) => {
                    if (p.current_price && p.ticker) {
                        pricesMap[p.ticker] = p.current_price;
                    }
                });
            }

            setMarketPrices(pricesMap);

        } catch (e: any) {
            console.error(e);
            setPricesError("Failed to fetch market prices. Python backend might be sleeping.");
        } finally {
            setLoadingPrices(false);
        }
    };

    // Helper Handler
    const handleFilterChange = (key: keyof typeof filters, val: any) => {
        setFilters(prev => ({ ...prev, [key]: val }));
    };

    const clearFilters = () => {
        setFilters(prev => ({ ...prev, person: [], ticker: [] }));
    };

    // Formatter
    const fmt = (num: number | null) => num !== null ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(num) : '-';
    const fmtPerc = (num: number | null) => num !== null ? `${num > 0 ? '+' : ''}${num.toFixed(2)}%` : '-';

    // Totali
    const totalValue = portfolioData.reduce((acc, item) => acc + ((item.current_price || item.avg_price) * item.quantity), 0);
    const totalPL = portfolioData.reduce((acc, item) => acc + (item.profit_loss || 0), 0);

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-6 pb-20">
            <div className="max-w-7xl mx-auto">

                {/* --- HEADER & FILTERS --- */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">

                    {/* LEFT SIDEBAR: FILTERS */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                                <div className="flex items-center gap-2 text-slate-800 font-semibold"><Filter size={18} /> Filters</div>
                                {(filters.person.length > 0 || filters.ticker.length > 0) &&
                                    <button onClick={clearFilters} className="text-xs text-red-500 hover:underline flex items-center gap-1"><XCircle size={12} /> Clear</button>
                                }
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

                                <button
                                    onClick={handleSearch}
                                    disabled={loadingPrices || loadingData}
                                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 mt-4"
                                >
                                    {loadingPrices ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                                    Search Prices
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT SIDE: TABLE & KPI */}
                    <div className="lg:col-span-3 flex flex-col gap-6">

                        {/* KPI HEADER */}
                        <div className="flex flex-wrap items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                            <div>
                                <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Wallet className="text-blue-600" /> Portfolio Valuation</h1>
                                <p className="text-slate-400 text-xs mt-1">
                                    {loadingData ? "Loading data..." : `Analysis based on ${portfolioData.length} open positions.`}
                                </p>
                            </div>
                            <div className="flex gap-4 text-right">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Est. Value</p>
                                    <p className="text-lg font-bold text-slate-800">{fmt(totalValue)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Total P&L</p>
                                    <p className={`text-lg font-bold ${totalPL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{totalPL > 0 ? '+' : ''}{fmt(totalPL)}</p>
                                </div>
                            </div>
                        </div>

                        {pricesError && (
                            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-center gap-2">
                                <AlertCircle size={16} /> {pricesError}
                            </div>
                        )}

                        {/* TABLE */}
                        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden relative min-h-[300px]">
                            {loadingData && (
                                <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center text-slate-500">
                                    <Loader2 size={32} className="animate-spin text-blue-600 mb-2" /> <p>Loading Transactions...</p>
                                </div>
                            )}

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-4">Ticker</th>
                                            <th className="px-6 py-4 text-right">Qty</th>
                                            <th className="px-6 py-4 text-right">Avg Price</th>
                                            <th className="px-6 py-4 text-right bg-blue-50/50">Mkt Price</th>
                                            <th className="px-6 py-4 text-right">Exposure</th>
                                            <th className="px-6 py-4 text-center">Avg Date</th>
                                            <th className="px-6 py-4 text-right">P/L (€)</th>
                                            <th className="px-6 py-4 text-right">Return %</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {portfolioData.length === 0 && !loadingData ? (
                                            <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400">No positions match your filters (or DB is empty).</td></tr>
                                        ) : (
                                            portfolioData.map((item) => {
                                                const isProfitable = (item.profit_loss || 0) >= 0;
                                                const hasPrice = item.current_price !== null;

                                                return (
                                                    <tr key={item.ticker} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-6 py-4 font-bold text-slate-800">{item.ticker}</td>
                                                        <td className="px-6 py-4 text-right text-slate-600">{item.quantity.toFixed(2)}</td>
                                                        <td className="px-6 py-4 text-right text-slate-500">{fmt(item.avg_price)}</td>

                                                        {/* MKT PRICE (Evidenziato) */}
                                                        <td className="px-6 py-4 text-right font-bold text-slate-800 bg-blue-50/30">
                                                            {hasPrice ? fmt(item.current_price!) : <span className="text-slate-300 italic text-xs">Click Search</span>}
                                                        </td>

                                                        <td className="px-6 py-4 text-right text-slate-500">{fmt(item.total_exposure)}</td>
                                                        <td className="px-6 py-4 text-center text-xs text-slate-400">{item.avg_date || '-'}</td>

                                                        {/* P&L */}
                                                        <td className={`px-6 py-4 text-right font-bold ${hasPrice ? (isProfitable ? 'text-emerald-600' : 'text-red-600') : 'text-slate-300'}`}>
                                                            {hasPrice ? fmt(item.profit_loss!) : '-'}
                                                        </td>

                                                        {/* Return */}
                                                        <td className="px-6 py-4 text-right">
                                                            {hasPrice ? (
                                                                <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${isProfitable ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {isProfitable ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                                                    {fmtPerc(item.performance_perc!)}
                                                                </div>
                                                            ) : <span className="text-slate-300">-</span>}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}