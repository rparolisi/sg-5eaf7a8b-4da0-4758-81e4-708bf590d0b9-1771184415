import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

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
};

export default function Home() {
    const [transactions, setTransactions] = useState < Transaction[] > ([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState < string | null > (null);

    useEffect(() => {
        fetchTransactions();
    }, []);

    async function fetchTransactions() {
        try {
            setLoading(true);
            // Leggiamo la tabella 'Transactions'
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .order('operation_date', { ascending: false });

            if (error) throw error;
            setTransactions(data || []);
        } catch (err: any) {
            console.error("Errore fetch:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen p-8 bg-gray-50">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold mb-6 text-gray-800">Monitor Investimenti</h1>

                {/* Gestione stati di caricamento ed errore */}
                {loading && <p className="text-gray-600">Caricamento dati in corso...</p>}
                {error && <p className="text-red-500 bg-red-50 p-4 rounded">Errore: {error}</p>}

                {/* Tabella Dati */}
                {!loading && !error && (
                    <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Data</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Ticker</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Tipo</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Azioni</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Totale (€)</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {transactions.map((t) => (
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
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                            {t.total_outlay_eur?.toFixed(2)} €
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </main>
    );
}
