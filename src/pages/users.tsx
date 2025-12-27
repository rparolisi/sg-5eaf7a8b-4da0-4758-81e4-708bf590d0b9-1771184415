import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
    User,
    Mail,
    Lock,
    Globe,
    CreditCard,
    Clock,
    Calendar,
    Fingerprint,
    Shield,
    CheckCircle,
    XCircle,
    Settings,
    ChevronDown
} from 'lucide-react';

// --- CONFIGURAZIONE SUPABASE ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Inizializzazione Client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Tipi di dati ---
interface UserData {
    id: number;
    user_id: string;
    alias: string;
    full_name: string;
    email: string;
    password: string;
    creation_date: string;
    sharing_availability: boolean;
    country: string;
    language: string;
    currency: string;
    timeout_time: number;
}

export default function UserPage() {
    const [usersList, setUsersList] = useState < UserData[] > ([]);
    const [selectedUser, setSelectedUser] = useState < UserData | null > (null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState < string | null > (null);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                setLoading(true);

                // Query su Supabase: seleziona tutti i campi dalla tabella 'users'
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .order('alias', { ascending: true }); // Ordina per nickname

                if (error) throw error;

                if (data && data.length > 0) {
                    setUsersList(data as UserData[]);
                    // Seleziona il primo utente di default se nessuno è selezionato
                    if (!selectedUser) {
                        setSelectedUser(data[0] as UserData);
                    }
                } else {
                    setError("Nessun utente trovato nel database.");
                }

            } catch (err: any) {
                console.error("Errore fetch Supabase:", err);
                setError(err.message || "Errore durante il caricamento dei dati.");
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, []);

    // Gestore cambio dropdown
    const handleUserChange = (alias: string) => {
        const user = usersList.find(u => u.alias === alias);
        if (user) setSelectedUser(user);
    };

    // Helper per le iniziali
    const getInitials = (name: string) => {
        return name
            ? name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2)
            : 'U';
    };

    // Helper per formattare la data
    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('it-IT', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // --- Render Loading State ---
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="text-gray-500 font-medium">Caricamento dati...</p>
                </div>
            </div>
        );
    }

    // --- Render Error State ---
    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-6 rounded-lg shadow-md border border-red-200 max-w-md w-full text-center">
                    <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Errore Caricamento</h3>
                    <p className="text-gray-600">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                        Riprova
                    </button>
                </div>
            </div>
        );
    }

    // Fallback sicuro se qualcosa va storto con la selezione
    const displayUser = selectedUser || usersList[0];

    if (!displayUser) return null;

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-12">

            {/* Navbar simulata */}
            <nav className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">IM</div>
                    <span className="text-xl font-bold tracking-tight text-slate-800">InvestMonitor</span>
                </div>

                {/* User Selector Dropdown in Navbar */}
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <div className="flex items-center gap-3 bg-slate-100 hover:bg-slate-200 transition-colors rounded-full pl-4 pr-2 py-1.5 cursor-pointer border border-slate-200">
                            <div className="flex flex-col items-end mr-2">
                                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Seleziona Utente</span>
                                {/* Dropdown nativo stilizzato */}
                                <select
                                    value={displayUser.alias}
                                    onChange={(e) => handleUserChange(e.target.value)}
                                    className="bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0 cursor-pointer text-right appearance-none pr-4 focus:outline-none"
                                    style={{ backgroundImage: 'none' }}
                                >
                                    {usersList.map((u) => (
                                        <option key={u.id} value={u.alias}>
                                            {u.alias}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="w-3 h-3 text-slate-500 absolute right-12 bottom-2.5 pointer-events-none" />
                            </div>

                            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shadow-sm">
                                {getInitials(displayUser.full_name)}
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

                {/* Header Pagina */}
                <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Profilo Utente</h1>
                        <p className="mt-1 text-slate-500">
                            Visualizzazione dati per: <span className="font-semibold text-blue-600">{displayUser.alias}</span>
                        </p>
                    </div>
                    <button className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                        <Settings className="w-4 h-4 mr-2" />
                        Modifica Profilo
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Colonna Sinistra: Card Identità */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300 hover:shadow-md">
                            <div className="h-24 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                            <div className="px-6 pb-6 relative">
                                <div className="relative -mt-12 mb-4">
                                    <div className="w-24 h-24 rounded-full border-4 border-white bg-white shadow-md flex items-center justify-center overflow-hidden">
                                        {/* Avatar basato sulle iniziali */}
                                        <div className="w-full h-full bg-slate-100 flex items-center justify-center text-3xl font-bold text-slate-700 uppercase">
                                            {getInitials(displayUser.full_name)}
                                        </div>
                                    </div>
                                </div>

                                <h2 className="text-xl font-bold text-slate-900">{displayUser.full_name}</h2>
                                <p className="text-sm font-medium text-blue-600 mb-4">@{displayUser.alias}</p>

                                <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                                    <Mail className="w-4 h-4" />
                                    <span className="truncate">{displayUser.email}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                    <Calendar className="w-4 h-4" />
                                    <span>Membro dal {formatDate(displayUser.creation_date)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Stato Condivisione */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-center justify-between transition-all duration-300 hover:shadow-md">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${displayUser.sharing_availability ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {displayUser.sharing_availability ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-900">Sharing Status</p>
                                    <p className="text-xs text-slate-500">
                                        {displayUser.sharing_availability ? 'Profilo visibile' : 'Profilo nascosto'}
                                    </p>
                                </div>
                            </div>
                            <div className={`h-8 w-1 rounded-full ${displayUser.sharing_availability ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        </div>
                    </div>

                    {/* Colonna Destra: Dettagli */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Sezione: Preferenze Regionali */}
                        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                                <Globe className="w-5 h-5 text-blue-500" />
                                <h3 className="font-semibold text-slate-800">Impostazioni Regionali</h3>
                            </div>
                            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                                <InfoItem label="Country" value={displayUser.country} />
                                <InfoItem label="Language" value={displayUser.language} />
                                <InfoItem
                                    label="Currency"
                                    value={displayUser.currency}
                                    icon={<CreditCard className="w-3.5 h-3.5 text-slate-400" />}
                                />
                            </div>
                        </section>

                        {/* Sezione: Sicurezza & Account */}
                        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                                <Shield className="w-5 h-5 text-blue-500" />
                                <h3 className="font-semibold text-slate-800">Sicurezza & Sessione</h3>
                            </div>
                            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                                <div className="col-span-1 sm:col-span-2">
                                    <InfoItem
                                        label="Password"
                                        value={displayUser.password}
                                        isPassword={true}
                                        icon={<Lock className="w-3.5 h-3.5 text-slate-400" />}
                                    />
                                </div>
                                <InfoItem
                                    label="Timeout Time"
                                    value={`${displayUser.timeout_time} minutes`}
                                    icon={<Clock className="w-3.5 h-3.5 text-slate-400" />}
                                />
                            </div>
                        </section>

                        {/* Sezione: Dati Tecnici */}
                        <section className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden mt-8">
                            <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between cursor-help group">
                                <div className="flex items-center gap-2">
                                    <Fingerprint className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-slate-700 transition-colors">Dati di Sistema (Read Only)</span>
                                </div>
                            </div>
                            <div className="px-6 py-4 grid grid-cols-1 gap-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-sm gap-1">
                                    <span className="text-slate-500">Internal ID</span>
                                    <code className="bg-slate-200 px-2 py-1 rounded text-slate-700 font-mono text-xs select-all">{displayUser.id}</code>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-sm gap-1 border-t border-slate-200 pt-3">
                                    <span className="text-slate-500">User UUID</span>
                                    <code className="bg-slate-200 px-2 py-1 rounded text-slate-700 font-mono text-xs select-all">{displayUser.user_id}</code>
                                </div>
                            </div>
                        </section>

                    </div>
                </div>
            </main>
        </div>
    );
}

// Componente Helper per visualizzare i singoli campi (riutilizzabile)
const InfoItem = ({
    label,
    value,
    icon,
    isPassword = false
}: {
    label: string;
    value: string | number;
    icon?: React.ReactNode;
    isPassword?: boolean;
}) => (
    <div className="flex flex-col group">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            {icon}
            {label}
        </label>
        <div className={`
      relative flex items-center w-full px-3 py-2.5 rounded-lg border bg-slate-50 text-slate-700 transition-all duration-200
      border-slate-200 group-hover:border-blue-300 group-hover:bg-white
    `}>
            <span className={`text-sm w-full truncate ${isPassword ? 'font-mono tracking-widest text-slate-500' : 'font-medium'}`}>
                {isPassword ? '••••••••••••' : value}
            </span>

            {isPassword && (
                <span className="absolute right-3 text-xs text-blue-600 font-medium cursor-pointer hover:underline">
                    Change
                </span>
            )}
        </div>
    </div>
);