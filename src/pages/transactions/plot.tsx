import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/router';
import {
    ArrowLeft, BarChart3, Settings, Filter, X
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// --- CONFIGURAZIONE ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- COLORI PER LE LINEE (Palette vivace) ---
const COLORS = [
    "#2563eb", "#dc2626", "#16a34a", "#d97706", "#9333ea",
    "#0891b2", "#db2777", "#4b5563", "#84cc16", "#7c3aed"
];

// --- COLONNE UTILIZZABILI ---
const COLUMNS = [
    { key: 'operation_date', label: 'Date', type: 'date' },
    { key: 'ticker', label: 'Ticker', type: 'text' },
    { key: 'person', label: 'Person', type: 'text' },
    { key: 'sector', label: 'Sector', type: 'text' },
    { key: 'total_outlay_eur', label: 'Total Amount (€)', type: 'number' },
    { key: 'purchase_price_per_share_eur', label: 'Price per Share (€)', type: 'number' },
    { key: 'shares_count', label: 'Shares Count', type: 'number' },
    { key: 'cumulative_shares_count', label: 'Cumul. Shares', type: 'number' },
    { key: 'average_price', label: 'Avg Price', type: 'number' }
];

export default function PlotPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState < any[] > ([]);

    // Configurazione Grafico
    const [config, setConfig] = useState({
        x: 'operation_date',
        y: 'total_outlay_eur',
        groupBy: 'ticker' // Default: raggruppa per Ticker
    });

    // 1. FETCH DATA
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .order('operation_date', { ascending: true }); // Importante: ordinato per data

            if (error) console.error(error);
            setTransactions(data || []);
            setLoading(false);
        };
        fetchData();
    }, []);

    // 2. PREPARE CHART DATA (Logica "Wide Format")
    const { chartData, lines } = useMemo(() => {
        if (!transactions.length) return { chartData: [], lines: [] };

        // A. Se non c'è raggruppamento (Singola linea)
        if (!config.groupBy) {
            const data = transactions.map(t => ({
                xAxis: t[config.x], // Valore asse X (es. data)
                displayX: new Date(t[config.x]).toLocaleDateString(), // Label leggibile
                value: t[config.y] // Valore asse Y
            }));
            return { chartData: data, lines: ['value'] };
        }

        // B. Raggruppamento (Multiple Linee)
        // Dobbiamo trasformare:
        // [ {date: '2023', ticker: 'AAPL', val: 100}, {date: '2023', ticker: 'TSLA', val: 50} ]
        // Diventa:
        // [ {xAxis: '2023', AAPL: 100, TSLA: 50} ]

        const groupedMap: Record<string, any> = {};
        const allGroups = new Set < string > ();

        transactions.forEach(t => {
            const xVal = t[config.x]; // Es. "2023-01-01"
            const groupName = t[config.groupBy] || 'Unknown'; // Es. "AAPL"
            const yVal = Number(t[config.y]) || 0;

            allGroups.add(groupName);

            if (!groupedMap[xVal]) {
                groupedMap[xVal] = {
                    xAxis: xVal,
                    displayX: new Date(xVal).toLocaleDateString(), // Formatta se è data
                    // Manteniamo il valore raw per il sorting
                    rawX: t[config.x]
                };
            }
            groupedMap[xVal][groupName] = yVal;
        });

        // Convertiamo l'oggetto mappa in un array ordinato
        const finalData = Object.values(groupedMap).sort((a: any, b: any) => {
            if (a.rawX < b.rawX) return -1;
            if (a.rawX > b.rawX) return 1;
            return 0;
        });

        return { chartData: finalData, lines: Array.from(allGroups) };

    }, [transactions, config]);

    return (
        <div className="min-h-screen bg-gray-50 p-6 font-sans text-slate-900">

            {/* Header Navigation */}
            <div className="max-w-6xl mx-auto mb-6 flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 bg-white border border-gray-300 rounded-full hover:bg-gray-100 transition shadow-sm"
                >
                    <ArrowLeft size={20} className="text-gray-600" />
                </button>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <BarChart3 className="text-purple-600" />
                    Data Analytics
                </h1>
            </div>

            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">

                {/* --- LEFT SIDEBAR: CONTROLS --- */}
                <div className="lg:col-span-1 bg-white p-5 rounded-xl shadow-sm border border-gray-200 h-fit sticky top-6">
                    <div className="flex items-center gap-2 mb-4 text-gray-800 font-semibold border-b pb-2">
                        <Settings size={18} /> Configuration
                    </div>

                    <div className="space-y-4">
                        {/* X AXIS */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">X Axis (Time)</label>
                            <select
                                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                value={config.x}
                                onChange={(e) => setConfig({ ...config, x: e.target.value })}
                            >
                                {COLUMNS.filter(c => c.type === 'date' || c.type === 'datetime').map(c => (
                                    <option key={c.key} value={c.key}>{c.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Y AXIS */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Y Axis (Value)</label>
                            <select
                                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                value={config.y}
                                onChange={(e) => setConfig({ ...config, y: e.target.value })}
                            >
                                {COLUMNS.filter(c => c.type === 'number').map(c => (
                                    <option key={c.key} value={c.key}>{c.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* GROUP BY */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 text-purple-600">Group Lines By</label>
                            <div className="relative">
                                <Filter size={14} className="absolute left-2.5 top-3 text-purple-400" />
                                <select
                                    className="w-full pl-8 p-2 border border-purple-200 bg-purple-50 rounded-lg text-sm text-purple-800 font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                                    value={config.groupBy}
                                    onChange={(e) => setConfig({ ...config, groupBy: e.target.value })}
                                >
                                    <option value="">(No Grouping - Total)</option>
                                    <option value="ticker">Ticker (Security)</option>
                                    <option value="person">Person</option>
                                    <option value="sector">Sector</option>
                                    <option value="category">Category</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 p-4 bg-blue-50 rounded-lg text-xs text-blue-700 border border-blue-100">
                        <strong>Info:</strong><br />
                        Grouping splits the data into multiple lines. Points are connected automatically even if dates differ.
                    </div>
                </div>

                {/* --- RIGHT SIDE: CHART --- */}
                <div className="lg:col-span-3 bg-white p-6 rounded-xl shadow-lg border border-gray-200 min-h-[500px] flex flex-col">

                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mb-3"></div>
                            Loading data...
                        </div>
                    ) : chartData.length > 0 ? (
                        <>
                            <h3 className="text-lg font-semibold text-gray-700 mb-6 text-center">
                                {COLUMNS.find(c => c.key === config.y)?.label} by {COLUMNS.find(c => c.key === config.x)?.label}
                            </h3>

                            <div className="flex-1 w-full h-96">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />

                                        <XAxis
                                            dataKey="displayX"
                                            tick={{ fontSize: 12, fill: '#9ca3af' }}
                                            axisLine={false}
                                            tickLine={false}
                                            dy={10}
                                        />

                                        <YAxis
                                            tick={{ fontSize: 12, fill: '#9ca3af' }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                                        />

                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                                borderRadius: '8px',
                                                border: 'none',
                                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                            }}
                                        />

                                        <Legend wrapperStyle={{ paddingTop: '20px' }} />

                                        {/* Dynamic Lines Generation */}
                                        {lines.map((lineKey, index) => (
                                            <Line
                                                key={lineKey}
                                                type="monotone"
                                                dataKey={lineKey}
                                                name={lineKey === 'value' ? 'Total' : lineKey}
                                                stroke={lines.length === 1 ? '#8b5cf6' : COLORS[index % COLORS.length]}
                                                strokeWidth={2}
                                                dot={{ r: 3, fill: lines.length === 1 ? '#8b5cf6' : COLORS[index % COLORS.length] }}
                                                activeDot={{ r: 6 }}
                                                connectNulls={true} // Collega i punti anche se mancano date intermedie
                                            />
                                        ))}

                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            <p className="text-center text-xs text-gray-400 mt-4">
                                Displaying {chartData.length} time points across {lines.length} groups.
                            </p>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-400">
                            No data available for this configuration.
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}