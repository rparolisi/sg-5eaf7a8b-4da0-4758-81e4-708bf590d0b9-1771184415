import Link from 'next/link';

export default function SecuritiesInfo() {
    return (
        <div className="min-h-screen p-8 bg-gray-50 flex flex-col items-center justify-center text-center">
            <h1 className="text-4xl font-bold text-slate-800 mb-4">Securities Info</h1>
            <p className="text-gray-500 mb-8 text-lg">Work in progress. Security details and fundamentals will appear here.</p>
            <Link href="/" className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
                Back to Home
            </Link>
        </div>
    );
}