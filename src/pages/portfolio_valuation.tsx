import Link from 'next/link';

export default function PortfolioValuation() {
    return (
        <div className="min-h-screen p-8 bg-gray-50 flex flex-col items-center justify-center text-center">
            <h1 className="text-4xl font-bold text-slate-800 mb-4">Valutazione Portafoglio</h1>
            <p className="text-gray-500 mb-8 text-lg">Questa pagina è in costruzione. Qui vedrai i grafici del tuo patrimonio.</p>
            <Link href="/" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                Torna alla Homepage
            </Link>
        </div>
    );
}