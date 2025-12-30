import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle, Wallet, Loader2, Search, Filter, Check, ChevronDown, Calendar, XCircle } from 'lucide-react';
import { useRouter } from 'next/router';
import Link from 'next/link';

// --- CONFIGURAZIONE ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const PYTHON_API_BASE_URL = "https://invest-monitor-api.onrender.com"; // Assicurati sia l'URL corretto

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
    total_dividends: number | null;
    is_live_price: boolean; // Flag per indicare se è un prezzo vero o stimato
}

export default function PortfolioValuation() {
    const router = useRouter();

    // Stato Dati Grezzi
    const [rawTransactions, setRawTransactions] = useState < Transaction[] > ([]);
    const [loadingData, setLoadingData] = useState(true);

    // Stato Dati da Python (Prezzi + Dividendi)
    const [pythonData, setPythonData] = useState < Record < string, { price: number, dividends: number, is_live: boolean }>> ({});
    const [loadingPrices, setLoadingPrices] = useState(false);
    const [pricesError, setPricesError] = useState("");

    // Stato Filtri
    const [filters, setFilters] = useState({
        person: [] as string[],
        ticker: [] as string[],
        startDate: '',
        endDate: ''
    });

    useEffect(() => {
        const initData = async () => {
            setLoadingData(true);
            try {
                const { data, error } = await supabase
                    .from('transactions')
                    .select('*')
                    .order('operation_date', { ascending: true });

                if (error) throw error;

                const transactions = data || [];
                setRawTransactions(transactions);

                if (transactions.length > 0) {
                    const dates = transactions.map(t => new Date(t.operation_date).getTime());
                    const min = new Date(Math.min(...dates)).toISOString().split('T')[0];
                    const max = new Date(Math.max(...dates)).toISOString().split('T')[0];
                    const today = new Date().toISOString().split('T')[0];
                    const end = today > max ? today : max;

                    setFilters(prev => ({
                        ...prev,
                        startDate: min,
                        endDate: end
                    }));
                }
            } catch (e) {
                console.error("Error loading transactions:", e);
            } finally {
                setLoadingData(false);
            }
        };
        initData();
    }, []);

    const uniqueOptions = useMemo(() => {
        const getUnique = (key: keyof Transaction) => Array.from(new Set(rawTransactions.map(t => t[key]).filter(Boolean))).sort();
        return {
            people: getUnique('person') as string[],
            tickers: getUnique('ticker') as string[]
        };
    }, [rawTransactions]);

    // MOTORE DI CALCOLO LOCALE
    const portfolioData = useMemo(() => {
        if (rawTransactions.length === 0) return [];

        const filtered = rawTransactions.filter(t => {
            if (filters.person.length > 0 && !filters.person.includes(t.person)) return false;
            if (filters.ticker.length > 0 && !filters.ticker.includes(t.ticker)) return false;

            const tDate = t.operation_date ? String(t.operation_date).split('T')[0] : '';
            if (filters.startDate && tDate < filters.startDate) return false;
            if (filters.endDate && tDate > filters.endDate) return false;

            return true;
        });

        const groups: Record<string, { qty: number, cost: number, dates: number[], weights: number[] }> = {};

        filtered.forEach(t => {
            const ticker = t.ticker;
            if (!groups[ticker]) groups[ticker] = { qty: 0, cost: 0, dates: [], weights: [] };

            const qty = Number(t.shares_count || 0);
            const sign = Number(t.operation_sign || 0);
            const price = Number(t.price_per_share_eur || 0);
            const outlay = t.total_outlay_eur !== null ? Number(t.total_outlay_eur) : (price * qty);

            const isRealTransaction = Number(t.buy_or_sell) === 1;

            if (isRealTransaction) {
                if (sign === 1) {
                    groups[ticker].qty += qty;
                    groups[ticker].cost += outlay;
                    groups[ticker].dates.push(new Date(t.operation_date).getTime());
                    groups[ticker].weights.push(outlay);
                } else {
                    const currentAvg = groups[ticker].qty > 0 ? groups[ticker].cost / groups[ticker].qty : 0;
                    groups[ticker].qty -= qty;
                    groups[ticker].cost -= (currentAvg * qty);
                }
            }
        });

        const items: PortfolioItem[] = Object.keys(groups).map(ticker => {
            const g = groups[ticker];
            if (Math.abs(g.qty) < 0.001) return null;

            const quantity = g.qty;
            const total_exposure = g.cost;
            const avg_price = quantity !== 0 ? total_exposure / quantity : 0;

            let avg_date = null;
            if (g.dates.length > 0) {
                const totalWeight = g.weights.reduce((a, b) => a + b, 0);
                if (totalWeight > 0) {
                    const weightedSum = g.dates.reduce((acc, date, i) => acc + (date * g.weights[i]), 0);
                    avg_date = new Date(weightedSum / totalWeight).toISOString().split('T')[0];
                }
            }

            // Dati da Python (Prezzi + Dividendi)
            const pyData = pythonData[ticker] || null;
            const current_price = pyData ? pyData.price : null;
            const total_dividends = pyData ? pyData.dividends : null;
            const is_live_price = pyData ? pyData.is_live : false; // Default false se non abbiamo dati

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
                performance_perc,
                total_dividends,
                is_live_price
            };
        }).filter(item => item !== null) as PortfolioItem[];

        return items.sort((a, b) => b.total_exposure - a.total_exposure);

    }, [rawTransactions, filters, pythonData]);

    const handleSearch = async () => {
        setLoadingPrices(true);
        setPricesError("");
        try {
            console.log("🔎 Fetching Prices & Dividends...");
            const url = new URL(`${PYTHON_API_BASE_URL}/api/portfolio`);
            url.searchParams.append("user_id", "SEARCH_REQ");
            if (filters.endDate) {
                url.searchParams.append("target_date", filters.endDate);
            }
            if (filters.person.length > 0) {
                filters.person.forEach(p => url.searchParams.append("people", p));
            }

            const response = await fetch(url.toString());
            if (!response.ok) throw new Error(`API Error: ${response.status}`);

            const result = await response.json();
            console.log("✅ Data received:", result);

            const dataMap: Record<string, { price: number, dividends: number, is_live: boolean }> = {};
            if (Array.isArray(result)) {
                result.forEach((p: any) => {
                    if (p.ticker) {
                        dataMap[p.ticker] = {
                            price: p.current_price || 0,
                            dividends: p.total_dividends || 0,
                            is_live: p.is_live_price !== undefined ? p.is_live_price : false // Leggi il flag
                        };
                    }
                });
            }
            setPythonData(dataMap);

        } catch (e: any) {
            console.error(e);
            setPricesError("Failed to fetch data via Python.");
        } finally {
            setLoadingPrices(false);
        }
    };

    const handleFilterChange = (key: keyof typeof filters, val: any) => setFilters(prev => ({ ...prev, [key]: val }));
    const clearFilters = () => setFilters(prev => ({ ...prev, person: [], ticker: [] }));
    const fmt = (num: number | null) => num !== null ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(num) : '-';
    const fmtPerc = (num: number | null) => num !== null ? `${num > 0 ? '+' : ''}${num.toFixed(2)}%` : '-';

    const totalValue = portfolioData.reduce((acc, item) => acc + ((item.current_price || item.avg_price) * item.quantity), 0);
    const totalPL = portfolioData.reduce((acc, item) => acc + (item.profit_loss || 0), 0);
    const totalDividends = portfolioData.reduce((acc, item) => acc + (item.total_dividends || 0), 0);

    // Controlla se ci sono prezzi stimati per mostrare il footer
    const hasEstimatedPrices = portfolioData.some(p => p.current_price !== null && !p.is_live_price);

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-6 pb-20">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                    {/* FILTERS */}
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

                    {/* TABLE */}
                    <div className="lg:col-span-3 flex flex-col gap-6">
                        <div className="flex flex-wrap items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                            <div>
                                <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Wallet className="text-blue-600" /> Portfolio Valuation</h1>
                                <p className="text-slate-400 text-xs mt-1">{loadingData ? "Loading..." : `Based on ${portfolioData.length} open positions.`}</p>
                            </div>
                            <div className="flex gap-4 text-right">
                                <div><p className="text-[10px] text-slate-400 uppercase font-bold">Est. Value</p><p className="text-lg font-bold text-slate-800">{fmt(totalValue)}</p></div>
                                <div><p className="text-[10px] text-slate-400 uppercase font-bold">Dividends</p><p className="text-lg font-bold text-blue-600">{fmt(totalDividends)}</p></div>
                                <div><p className="text-[10px] text-slate-400 uppercase font-bold">Total P&L</p><p className={`text-lg font-bold ${totalPL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{totalPL > 0 ? '+' : ''}{fmt(totalPL)}</p></div>
                            </div>
                        </div>

                        {pricesError && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-center gap-2"><AlertCircle size={16} /> {pricesError}</div>}

                        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden relative min-h-[300px]">
                            {loadingData && <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center text-slate-500"><Loader2 size={32} className="animate-spin text-blue-600 mb-2" /> <p>Loading...</p></div>}
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
                                            <th className="px-6 py-4 text-right bg-yellow-50/50">Dividends</th>
                                            <th className="px-6 py-4 text-right">P/L (€)</th>
                                            <th className="px-6 py-4 text-right">Return %</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {portfolioData.length === 0 && !loadingData ? (
                                            <tr><td colSpan={9} className="px-6 py-12 text-center text-slate-400">No positions found.</td></tr>
                                        ) : (
                                            portfolioData.map((item) => {
                                                const isProfitable = (item.profit_loss || 0) >= 0;
                                                const hasPrice = item.current_price !== null;
                                                // Se il prezzo è "stimato" (non live), mostra un asterisco e un colore diverso
                                                const isEstimated = !item.is_live_price && hasPrice;

                                                return (
                                                    <tr key={item.ticker} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-6 py-4 font-bold text-slate-800">{item.ticker}</td>
                                                        <td className="px-6 py-4 text-right text-slate-600">{item.quantity.toFixed(2)}</td>
                                                        <td className="px-6 py-4 text-right text-slate-500">{fmt(item.avg_price)}</td>

                                                        {/* MKT PRICE */}
                                                        <td className={`px-6 py-4 text-right font-bold bg-blue-50/30 ${isEstimated ? 'text-orange-500' : 'text-slate-800'}`}>
                                                            {hasPrice ? (
                                                                <>
                                                                    {fmt(item.current_price!)}
                                                                    {isEstimated && <span className="ml-1 text-xs">*</span>}
                                                                </>
                                                            ) : <span className="text-slate-300 italic text-xs">...</span>}
                                                        </td>

                                                        <td className="px-6 py-4 text-right text-slate-500">{fmt(item.total_exposure)}</td>
                                                        <td className="px-6 py-4 text-center text-xs text-slate-400">{item.avg_date || '-'}</td>
                                                        <td className="px-6 py-4 text-right text-blue-700 font-medium bg-yellow-50/30">{hasPrice ? fmt(item.total_dividends!) : '-'}</td>
                                                        <td className={`px-6 py-4 text-right font-bold ${hasPrice ? (isProfitable ? 'text-emerald-600' : 'text-red-600') : 'text-slate-300'}`}>{hasPrice ? fmt(item.profit_loss!) : '-'}</td>
                                                        <td className="px-6 py-4 text-right">
                                                            {hasPrice ? (
                                                                <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${isProfitable ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {isProfitable ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{fmtPerc(item.performance_perc!)}
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

                        {/* FOOTER NOTE - Solo se ci sono prezzi stimati */}
                        {hasEstimatedPrices && (
                            <div className="bg-orange-50 border border-orange-100 p-3 rounded-lg text-xs text-orange-700 mt-2">
                                <strong>* Note:</strong> Price not available on Yahoo Finance. Estimated using Average Purchase Price. P/L is 0.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}