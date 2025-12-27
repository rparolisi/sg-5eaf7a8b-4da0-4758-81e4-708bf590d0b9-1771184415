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
    ChevronDown,
    Save,
    X,
    Edit3,
    Eye,     
    EyeOff    
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

    // Stati per la modifica
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState < UserData | null > (null);
    const [saveLoading, setSaveLoading] = useState(false);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                setLoading(true);

                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .order('alias', { ascending: true });

                if (error) throw error;

                if (data && data.length > 0) {
                    setUsersList(data as UserData[]);
                    if (!selectedUser) {
                        const initialUser = data[0] as UserData;
                        setSelectedUser(initialUser);
                        setFormData(initialUser);
                    }
                } else {
                    setError("No user found in the database.");
                }

            } catch (err: any) {
                console.error("Supabase fetch error:", err);
                setError(err.message || "Error loading data.");
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, []);

    // Sincronizza il form quando cambia l'utente selezionato
    useEffect(() => {
        if (selectedUser) {
            setFormData(selectedUser);
            setIsEditing(false); // Resetta edit mode se cambio utente
        }
    }, [selectedUser]);

    // Gestore cambio dropdown (cambio utente)
    const handleUserChange = (alias: string) => {
        // Se stiamo modificando, chiediamo conferma o salviamo? Per ora resettiamo.
        if (isEditing) {
            if (!window.confirm("You have unsaved changes. Discard them?")) return;
            setIsEditing(false);
        }
        const user = usersList.find(u => u.alias === alias);
        if (user) setSelectedUser(user);
    };

    // Gestore modifiche input
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!formData) return;
        const { name, value, type } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'number' ? Number(value) : value
        });
    };

    // Gestore toggle sharing
    const toggleSharing = () => {
        if (!formData || !isEditing) return;
        setFormData({
            ...formData,
            sharing_availability: !formData.sharing_availability
        });
    };

    // Funzione di Salvataggio su Supabase
    const handleSave = async () => {
        if (!formData || !selectedUser) return;

        try {
            setSaveLoading(true);

            // Aggiorna su Supabase
            // Nota: Non aggiorniamo 'alias', 'id', 'user_id' o 'creation_date' perché non modificabili o chiave
            const { error } = await supabase
                .from('users')
                .update({
                    full_name: formData.full_name,
                    email: formData.email,
                    password: formData.password,
                    country: formData.country,
                    language: formData.language,
                    currency: formData.currency,
                    timeout_time: formData.timeout_time,
                    sharing_availability: formData.sharing_availability
                })
                .eq('id', selectedUser.id);

            if (error) throw error;

            // Aggiorna lo stato locale
            setSelectedUser(formData);

            // Aggiorna la lista utenti locale per riflettere le modifiche nel dropdown o altrove
            setUsersList(prevList =>
                prevList.map(u => u.id === formData.id ? formData : u)
            );

            setIsEditing(false);
            alert("Profile updated successfully!");

        } catch (err: any) {
            console.error("Error saving data:", err);
            alert("Error saving data: " + err.message);
        } finally {
            setSaveLoading(false);
        }
    };

    // Annulla modifiche
    const handleCancel = () => {
        setFormData(selectedUser);
        setIsEditing(false);
    };

    const getInitials = (name: string) => {
        return name
            ? name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2)
            : 'U';
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="text-gray-500 font-medium">Loading data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-6 rounded-lg shadow-md border border-red-200 max-w-md w-full text-center">
                    <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Loading Error</h3>
                    <p className="text-gray-600">{error}</p>
                    <button onClick={() => window.location.reload()} className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    const displayUser = isEditing ? formData : selectedUser;
    if (!displayUser) return null;

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-12">

            {/* Navbar */}
            <nav className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">IM</div>
                    <span className="text-xl font-bold tracking-tight text-slate-800">InvestMonitor</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <div className={`flex items-center gap-3 bg-slate-100 hover:bg-slate-200 transition-colors rounded-full pl-4 pr-2 py-1.5 cursor-pointer border border-slate-200 ${isEditing ? 'opacity-50 pointer-events-none' : ''}`}>
                            <div className="flex flex-col items-end mr-2">
                                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Select User</span>
                                <select
                                    value={selectedUser?.alias || ''} // Usa sempre selectedUser per il dropdown
                                    onChange={(e) => handleUserChange(e.target.value)}
                                    className="bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0 cursor-pointer text-right appearance-none pr-4 focus:outline-none"
                                    style={{ backgroundImage: 'none' }}
                                    disabled={isEditing}
                                >
                                    {usersList.map((u) => (
                                        <option key={u.id} value={u.alias}>{u.alias}</option>
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
                {/* Header */}
                <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">User Profile</h1>
                        <p className="mt-1 text-slate-500">
                            Viewing data for: <span className="font-semibold text-blue-600">{selectedUser?.alias}</span>
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {isEditing ? (
                            <>
                                <button
                                    onClick={handleCancel}
                                    className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md shadow-sm text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors"
                                    disabled={saveLoading}
                                >
                                    <X className="w-4 h-4 mr-2" />
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                                    disabled={saveLoading}
                                >
                                    {saveLoading ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    ) : (
                                        <Save className="w-4 h-4 mr-2" />
                                    )}
                                    Save Changes
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                            >
                                <Settings className="w-4 h-4 mr-2" />
                                Edit Profile
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300 ${isEditing ? 'ring-2 ring-blue-100' : 'hover:shadow-md'}`}>
                            <div className="h-24 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                            <div className="px-6 pb-6 relative">
                                <div className="relative -mt-12 mb-4">
                                    <div className="w-24 h-24 rounded-full border-4 border-white bg-white shadow-md flex items-center justify-center overflow-hidden">
                                        <div className="w-full h-full bg-slate-100 flex items-center justify-center text-3xl font-bold text-slate-700 uppercase">
                                            {getInitials(displayUser.full_name)}
                                        </div>
                                    </div>
                                    {isEditing && <div className="absolute bottom-0 right-0 bg-white p-1 rounded-full shadow border border-slate-200 text-slate-400"><Edit3 size={14} /></div>}
                                </div>

                                {/* Full Name Edit */}
                                {isEditing ? (
                                    <div className="mb-2">
                                        <label className="text-xs text-slate-400 uppercase font-bold">Full Name</label>
                                        <input
                                            type="text"
                                            name="full_name"
                                            value={displayUser.full_name}
                                            onChange={handleInputChange}
                                            className="w-full text-xl font-bold text-slate-900 border-b-2 border-blue-200 focus:border-blue-500 focus:outline-none bg-transparent px-1 py-0.5"
                                        />
                                    </div>
                                ) : (
                                    <h2 className="text-xl font-bold text-slate-900">{displayUser.full_name}</h2>
                                )}

                                <p className="text-sm font-medium text-blue-600 mb-4 flex items-center gap-1">
                                    @{displayUser.alias}
                                    {isEditing && <span className="text-xs text-slate-400 bg-slate-100 px-1 rounded border border-slate-200 ml-2 font-normal">Read Only</span>}
                                </p>

                                {/* Email Edit */}
                                <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                                    <Mail className="w-4 h-4 flex-shrink-0" />
                                    {isEditing ? (
                                        <input
                                            type="email"
                                            name="email"
                                            value={displayUser.email}
                                            onChange={handleInputChange}
                                            className="w-full border-b border-slate-200 focus:border-blue-500 focus:outline-none bg-transparent"
                                        />
                                    ) : (
                                        <span className="truncate">{displayUser.email}</span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                    <Calendar className="w-4 h-4 flex-shrink-0" />
                                    <span>Member since {formatDate(displayUser.creation_date)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Sharing Status - Editable */}
                        <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-center justify-between transition-all duration-300 ${isEditing ? 'ring-2 ring-blue-100' : 'hover:shadow-md'}`}>
                            <div className="flex items-center gap-3">
                                <div
                                    onClick={toggleSharing}
                                    className={`p-2 rounded-lg transition-colors cursor-pointer ${displayUser.sharing_availability ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'} ${!isEditing && 'cursor-default'}`}
                                >
                                    {displayUser.sharing_availability ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-900">Sharing Status</p>
                                    <p className="text-xs text-slate-500">
                                        {displayUser.sharing_availability ? 'Profile visible' : 'Profile hidden'}
                                    </p>
                                </div>
                            </div>

                            {/* Visual Toggle for Editing */}
                            {isEditing ? (
                                <div
                                    onClick={toggleSharing}
                                    className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${displayUser.sharing_availability ? 'bg-green-500' : 'bg-gray-300'}`}
                                >
                                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${displayUser.sharing_availability ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                </div>
                            ) : (
                                <div className={`h-8 w-1 rounded-full ${displayUser.sharing_availability ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                            )}
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Regional Settings - Editable */}
                        <section className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all ${isEditing ? 'ring-2 ring-blue-100' : ''}`}>
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                                <Globe className="w-5 h-5 text-blue-500" />
                                <h3 className="font-semibold text-slate-800">Regional Settings</h3>
                            </div>
                            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                                <InfoItem
                                    label="Country"
                                    value={displayUser.country}
                                    name="country"
                                    isEditing={isEditing}
                                    onChange={handleInputChange}
                                />
                                <InfoItem
                                    label="Language"
                                    value={displayUser.language}
                                    name="language"
                                    isEditing={isEditing}
                                    onChange={handleInputChange}
                                />
                                <InfoItem
                                    label="Currency"
                                    value={displayUser.currency}
                                    name="currency"
                                    icon={<CreditCard className="w-3.5 h-3.5 text-slate-400" />}
                                    isEditing={isEditing}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </section>

                        {/* Security & Session - Editable */}
                        <section className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all ${isEditing ? 'ring-2 ring-blue-100' : ''}`}>
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                                <Shield className="w-5 h-5 text-blue-500" />
                                <h3 className="font-semibold text-slate-800">Security & Session</h3>
                            </div>
                            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                                <div className="col-span-1 sm:col-span-2">
                                    <InfoItem
                                        label="Password"
                                        value={displayUser.password}
                                        name="password"
                                        isPassword={true}
                                        icon={<Lock className="w-3.5 h-3.5 text-slate-400" />}
                                        isEditing={isEditing}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <InfoItem
                                    label="Timeout Time (min)"
                                    value={displayUser.timeout_time}
                                    name="timeout_time"
                                    type="number"
                                    icon={<Clock className="w-3.5 h-3.5 text-slate-400" />}
                                    isEditing={isEditing}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </section>

                        {/* System Data - Read Only (Always) */}
                        <section className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden mt-8 opacity-80">
                            <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between cursor-help group">
                                <div className="flex items-center gap-2">
                                    <Fingerprint className="w-4 h-4 text-slate-400" />
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">System Data (Read Only)</span>
                                </div>
                                {isEditing && <Lock size={12} className="text-slate-400" />}
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

// Componente Helper Aggiornato
const InfoItem = ({
    label,
    value,
    name,
    icon,
    isPassword = false,
    isEditing = false,
    onChange,
    type = 'text'
}: {
    label: string;
    value: string | number;
    name?: string;
    icon?: React.ReactNode;
    isPassword?: boolean;
    isEditing?: boolean;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
}) => {
    // Stato locale per gestire la visibilità della password
    const [showPassword, setShowPassword] = useState(false);

    // Determina il tipo di input:
    // Se è una password e NON stiamo mostrando il testo -> 'password'
    // Altrimenti usa il tipo passato (o 'text')
    const inputType = isPassword && !showPassword ? 'password' : type;

    return (
        <div className="flex flex-col group">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                {icon}
                {label}
            </label>
            <div className={`
                relative flex items-center w-full px-3 py-2.5 rounded-lg border bg-slate-50 text-slate-700 transition-all duration-200
                ${isEditing ? 'bg-white border-blue-200 shadow-sm focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400' : 'border-slate-200 hover:border-blue-300 hover:bg-white'}
            `}>
                {isEditing && name ? (
                    <>
                        <input
                            type={inputType}
                            name={name}
                            value={value}
                            onChange={onChange}
                            className={`w-full text-sm font-medium bg-transparent border-none focus:ring-0 p-0 text-slate-900 ${isPassword && !showPassword ? 'tracking-widest' : ''}`}
                        />
                        {/* Tasto Occhio per mostrare/nascondere la password in Edit Mode */}
                        {isPassword && (
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 text-slate-400 hover:text-blue-600 focus:outline-none transition-colors"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        )}
                    </>
                ) : (
                    // View Mode: Nessun tasto "Change", solo pallini o testo
                    <span className={`text-sm w-full truncate ${isPassword ? 'font-mono tracking-widest text-slate-500' : 'font-medium'}`}>
                        {isPassword ? '••••••••••••' : value}
                    </span>
                )}
            </div>
        </div>
    );
};