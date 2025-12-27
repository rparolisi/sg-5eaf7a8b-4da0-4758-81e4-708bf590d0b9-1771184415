import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/router';
import {
    Mail, Lock, Globe, CreditCard, Clock, Calendar, Fingerprint,
    Shield, CheckCircle, XCircle, Settings, Save, X, Edit3, Eye, EyeOff, LogOut, User as UserIcon
} from 'lucide-react';

// --- CONFIGURAZIONE ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- INTERFACCIA ---
interface UserData {
    id: number;
    user_id: string; // Questo deve corrispondere all'UUID di Auth
    alias: string;
    full_name: string;
    email: string;
    // password: string; // RIMOSSO: Non gestiamo la password qui per sicurezza!
    creation_date: string;
    sharing_availability: boolean;
    country: string;
    language: string;
    currency: string;
    timeout_time: number;
}

export default function UserPage() {
    const router = useRouter();

    // Stati
    const [userData, setUserData] = useState < UserData | null > (null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState < string | null > (null);

    // Editing
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState < UserData | null > (null);
    const [saveLoading, setSaveLoading] = useState(false);

    // --- FETCH LOGICA CHIAVE ---
    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                setLoading(true);

                // 1. Ottieni la sessione corrente da Supabase Auth
                const { data: { session }, error: authError } = await supabase.auth.getSession();

                if (authError || !session) {
                    // Nessuna sessione -> Rimanda al login
                    router.push('/login');
                    return;
                }

                // 2. Usa l'ID dell'utente autenticato per cercare i dati nel DB
                const { data, error: dbError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('user_id', session.user.id) // La colonna user_id deve combaciare con auth.uid()
                    .single();

                if (dbError) throw dbError;

                if (data) {
                    setUserData(data as UserData);
                    setFormData(data as UserData);
                } else {
                    setError("Profilo utente non trovato nel database. Assicurati che user_id coincida.");
                }

            } catch (err: any) {
                console.error("Errore fetch:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchUserProfile();
    }, [router]);

    // --- HANDLERS ---

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!formData) return;
        const { name, value, type } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'number' ? Number(value) : value
        });
    };

    const toggleSharing = () => {
        if (!formData || !isEditing) return;
        setFormData({ ...formData, sharing_availability: !formData.sharing_availability });
    };

    const handleSave = async () => {
        if (!formData || !userData) return;
        try {
            setSaveLoading(true);
            // Aggiorniamo solo i dati del profilo, NON la password (quella si fa via Auth API)
            const { error } = await supabase
                .from('users')
                .update({
                    full_name: formData.full_name,
                    country: formData.country,
                    language: formData.language,
                    currency: formData.currency,
                    timeout_time: formData.timeout_time,
                    sharing_availability: formData.sharing_availability
                })
                .eq('id', userData.id);

            if (error) throw error;

            setUserData(formData);
            setIsEditing(false);
            alert("Profilo aggiornato!");
        } catch (err: any) {
            alert("Errore salvataggio: " + err.message);
        } finally {
            setSaveLoading(false);
        }
    };

    // --- UI HELPERS ---
    const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : 'U';

    if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    if (error) return <div className="min-h-screen flex items-center justify-center text-red-500">{error}</div>;
    if (!userData) return null;

    const displayUser = isEditing ? formData! : userData;

    return (
        <div className="min-h-screen bg-slate-50 pb-12 font-sans text-slate-900">
            {/* Navbar Semplificata per contesto */}
            <nav className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10">
                <div className="font-bold text-xl text-blue-600">InvestMonitor</div>
                <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold">{displayUser.alias}</span>
                    <button onClick={handleLogout} className="text-sm text-red-600 hover:underline">Esci</button>
                </div>
            </nav>

            <main className="max-w-5xl mx-auto px-4 py-10">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold">Il mio Profilo</h1>
                    {!isEditing ? (
                        <button onClick={() => setIsEditing(true)} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2">
                            <Settings size={16} /> Modifica
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button onClick={() => { setIsEditing(false); setFormData(userData) }} className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded">Annulla</button>
                            <button onClick={handleSave} disabled={saveLoading} className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2">
                                <Save size={16} /> Salva
                            </button>
                        </div>
                    )}
                </div>

                {/* Esempio Layout Dati */}
                <div className="bg-white rounded-2xl shadow p-6 mb-6">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center text-2xl font-bold text-slate-600">
                            {getInitials(displayUser.full_name)}
                        </div>
                        <div>
                            {isEditing ? (
                                <input name="full_name" value={displayUser.full_name} onChange={handleInputChange} className="text-xl font-bold border-b border-blue-300 focus:outline-none" />
                            ) : (
                                <h2 className="text-xl font-bold">{displayUser.full_name}</h2>
                            )}
                            <p className="text-slate-500">@{displayUser.alias}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InfoField label="Email (Auth)" value={displayUser.email} readOnly={true} icon={<Mail size={16} />} />
                        <InfoField label="Paese" name="country" value={displayUser.country} isEditing={isEditing} onChange={handleInputChange} icon={<Globe size={16} />} />
                        <InfoField label="Lingua" name="language" value={displayUser.language} isEditing={isEditing} onChange={handleInputChange} />
                        <InfoField label="Valuta" name="currency" value={displayUser.currency} isEditing={isEditing} onChange={handleInputChange} icon={<CreditCard size={16} />} />
                    </div>
                </div>
            </main>
        </div>
    );
}

// Helper componente per i campi
const InfoField = ({ label, value, name, isEditing, onChange, readOnly, icon }: any) => (
    <div>
        <label className="text-xs font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">{icon} {label}</label>
        {isEditing && !readOnly ? (
            <input type="text" name={name} value={value} onChange={onChange} className="w-full border rounded p-2 text-sm" />
        ) : (
            <div className="text-slate-800 font-medium text-sm">{value}</div>
        )}
    </div>
);