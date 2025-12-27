import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/router';
import {
    Mail, Globe, CreditCard, Clock, Calendar,
    Shield, CheckCircle, XCircle, Settings, Save, X,
    LogOut, User as UserIcon, MapPin, Hash, Activity,
    Fingerprint, Lock, Key
} from 'lucide-react';

// --- CONFIGURATION ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- INTERFACE ---
interface UserData {
    id: number;
    user_id: string;
    alias: string;
    full_name: string;
    email: string;
    creation_date: string;
    sharing_availability: boolean;
    country: string;
    language: string;
    currency: string;
    timeout_time: number;
}

export default function UserPage() {
    const router = useRouter();

    // State
    const [userData, setUserData] = useState < UserData | null > (null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState < string | null > (null);

    // Editing State (Profile)
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState < UserData | null > (null);
    const [saveLoading, setSaveLoading] = useState(false);

    // Editing State (Password)
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
    const [passwordLoading, setPasswordLoading] = useState(false);

    // --- FETCH DATA ---
    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                setLoading(true);

                // 1. Get current session
                const { data: { session }, error: authError } = await supabase.auth.getSession();

                if (authError || !session) {
                    router.push('/login');
                    return;
                }

                // 2. Fetch user details from DB
                const { data, error: dbError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .single();

                if (dbError) throw dbError;

                if (data) {
                    setUserData(data as UserData);
                    setFormData(data as UserData);
                } else {
                    setError("User profile not found in database.");
                }

            } catch (err: any) {
                console.error("Fetch error:", err);
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

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (!formData) return;
        const { name, value, type } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'number' ? Number(value) : value
        });
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPasswordForm({
            ...passwordForm,
            [e.target.name]: e.target.value
        });
    };

    const toggleSharing = () => {
        if (!formData || !isEditing) return;
        setFormData({ ...formData, sharing_availability: !formData.sharing_availability });
    };

    // Save Profile Data (Auth + Public Table)
    const handleSaveProfile = async () => {
        if (!formData || !userData) return;
        try {
            setSaveLoading(true);

            // 1. Check if Email Changed -> Update Auth
            if (formData.email !== userData.email) {
                const { error: authError } = await supabase.auth.updateUser({ email: formData.email });
                if (authError) throw authError;
                alert(`Email update initiated! Please check ${formData.email} to confirm the change.`);
            }

            // 2. Update Public Profile Table
            const { error } = await supabase
                .from('users')
                .update({
                    full_name: formData.full_name,
                    email: formData.email, // <--- Now updating email in DB too
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
            alert("Profile updated successfully!");
        } catch (err: any) {
            alert("Error saving profile: " + err.message);
        } finally {
            setSaveLoading(false);
        }
    };

    // Update Password (Supabase Auth)
    const handleUpdatePassword = async () => {
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            alert("New passwords do not match.");
            return;
        }
        if (passwordForm.newPassword.length < 6) {
            alert("Password must be at least 6 characters long.");
            return;
        }

        try {
            setPasswordLoading(true);
            const { error } = await supabase.auth.updateUser({
                password: passwordForm.newPassword
            });

            if (error) throw error;

            alert("Password updated successfully!");
            setIsChangingPassword(false);
            setPasswordForm({ newPassword: '', confirmPassword: '' });
        } catch (err: any) {
            alert("Error updating password: " + err.message);
        } finally {
            setPasswordLoading(false);
        }
    };

    // --- UI HELPERS ---
    const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : 'U';

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="text-slate-500 font-medium">Loading profile...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="bg-white p-8 rounded-xl shadow-lg border border-red-100 text-center max-w-md">
                    <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-800">Access Error</h3>
                    <p className="text-slate-500 mt-2">{error}</p>
                    <button onClick={() => router.push('/login')} className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 w-full">
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }

    if (!userData) return null;

    const displayUser = isEditing ? formData! : userData;

    return (
        <div className="min-h-screen bg-slate-50/50 pb-12 font-sans text-slate-900">

            {/* Navbar Simplified */}
            <nav className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20 shadow-sm flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="bg-blue-600 rounded-lg p-1.5">
                        <UserIcon size={20} className="text-white" />
                    </div>
                    <span className="font-bold text-xl text-slate-800 tracking-tight">Invest<span className="text-blue-600">Monitor</span></span>
                </div>
                <button
                    onClick={handleLogout}
                    className="text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                    <LogOut size={16} />
                    Logout
                </button>
            </nav>

            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Header & Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">My Profile</h1>
                        <p className="text-slate-500 mt-1">Manage your personal information and preferences.</p>
                    </div>
                    <div>
                        {!isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="inline-flex items-center justify-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-all focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                <Settings size={18} className="mr-2" />
                                Edit Profile
                            </button>
                        ) : (
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setIsEditing(false); setFormData(userData); }}
                                    className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg shadow-sm text-slate-700 bg-white hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveProfile}
                                    disabled={saveLoading}
                                    className="inline-flex items-center justify-center px-5 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 transition-all disabled:opacity-70"
                                >
                                    {saveLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div> : <Save size={18} className="mr-2" />}
                                    Save Changes
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* --- LEFT COLUMN: IDENTITY --- */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Profile Card */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative group">
                            <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
                            <div className="px-6 pb-6 text-center relative">
                                <div className="relative -mt-16 mb-4 inline-block">
                                    <div className="w-32 h-32 rounded-full border-4 border-white bg-slate-100 flex items-center justify-center text-4xl font-bold text-slate-700 shadow-md">
                                        {getInitials(displayUser.full_name)}
                                    </div>
                                    <div className="absolute bottom-1 right-1 bg-green-500 w-6 h-6 rounded-full border-4 border-white" title="Active"></div>
                                </div>

                                <div className="space-y-1">
                                    {isEditing ? (
                                        <input
                                            name="full_name"
                                            value={displayUser.full_name}
                                            onChange={handleInputChange}
                                            className="text-xl font-bold text-center w-full border-b-2 border-blue-200 focus:border-blue-600 focus:outline-none bg-transparent px-2 py-1"
                                            placeholder="Your Name"
                                        />
                                    ) : (
                                        <h2 className="text-2xl font-bold text-slate-900">{displayUser.full_name}</h2>
                                    )}
                                    <p className="text-blue-600 font-medium">@{displayUser.alias}</p>
                                </div>

                                <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-slate-500 text-sm">
                                    <Calendar size={14} />
                                    <span>Joined {formatDate(displayUser.creation_date)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Status Card */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">Account Status</h3>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${displayUser.sharing_availability ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                                        {displayUser.sharing_availability ? <Activity size={20} /> : <Lock size={20} />}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-900">Profile Sharing</p>
                                        <p className="text-xs text-slate-500">{displayUser.sharing_availability ? 'Visible to others' : 'Private'}</p>
                                    </div>
                                </div>

                                {/* Toggle Switch */}
                                <button
                                    onClick={toggleSharing}
                                    disabled={!isEditing}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${displayUser.sharing_availability ? 'bg-blue-600' : 'bg-slate-200'} ${!isEditing ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${displayUser.sharing_availability ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* --- RIGHT COLUMN: DETAILS --- */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* General Info */}
                        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                                <Globe className="text-blue-500" size={18} />
                                <h3 className="font-semibold text-slate-800">General Information</h3>
                            </div>
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* EMAIL: Now editable with warning */}
                                <InfoField
                                    label="Email Address"
                                    name="email"
                                    value={displayUser.email}
                                    isEditing={isEditing}
                                    onChange={handleInputChange}
                                    icon={<Mail size={14} />}
                                    helperText="Changing email requires confirmation"
                                />
                                <InfoField
                                    label="Country"
                                    name="country"
                                    value={displayUser.country}
                                    isEditing={isEditing}
                                    onChange={handleInputChange}
                                    icon={<MapPin size={14} />}
                                />
                                <InfoField
                                    label="Language"
                                    name="language"
                                    value={displayUser.language}
                                    isEditing={isEditing}
                                    onChange={handleInputChange}
                                    icon={<Globe size={14} />}
                                />
                                <InfoField
                                    label="Currency"
                                    name="currency"
                                    value={displayUser.currency}
                                    isEditing={isEditing}
                                    onChange={handleInputChange}
                                    icon={<CreditCard size={14} />}
                                />
                            </div>
                        </section>

                        {/* Security & System */}
                        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                                <Shield className="text-blue-500" size={18} />
                                <h3 className="font-semibold text-slate-800">Security & System</h3>
                            </div>
                            <div className="p-6 space-y-6">

                                {/* Password Change Section */}
                                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                            <Key size={16} /> Password Management
                                        </label>
                                        {!isChangingPassword && (
                                            <button
                                                onClick={() => setIsChangingPassword(true)}
                                                className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                                            >
                                                Change Password
                                            </button>
                                        )}
                                    </div>

                                    {!isChangingPassword ? (
                                        <div className="flex items-center gap-2 text-slate-500 text-sm">
                                            <span>••••••••••••••••</span>
                                            <span className="text-xs bg-white px-2 py-0.5 rounded border border-slate-200">Secure</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <input
                                                type="password"
                                                name="newPassword"
                                                placeholder="New Password"
                                                value={passwordForm.newPassword}
                                                onChange={handlePasswordChange}
                                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                            <input
                                                type="password"
                                                name="confirmPassword"
                                                placeholder="Confirm New Password"
                                                value={passwordForm.confirmPassword}
                                                onChange={handlePasswordChange}
                                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={() => { setIsChangingPassword(false); setPasswordForm({ newPassword: '', confirmPassword: '' }) }}
                                                    className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleUpdatePassword}
                                                    disabled={passwordLoading}
                                                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-70"
                                                >
                                                    {passwordLoading ? 'Updating...' : 'Update Password'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Session Timeout */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <InfoField
                                        label="Session Timeout (min)"
                                        name="timeout_time"
                                        type="number"
                                        value={displayUser.timeout_time}
                                        isEditing={isEditing}
                                        onChange={handleInputChange}
                                        icon={<Clock size={14} />}
                                    />
                                </div>

                                <div className="border-t border-slate-100"></div>

                                {/* Read Only System Data */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                                            <Hash size={12} /> Internal DB ID
                                        </label>
                                        <div className="font-mono text-xs bg-slate-100 text-slate-600 p-2 rounded select-all truncate">
                                            {displayUser.id}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                                            <Fingerprint size={12} /> Auth UUID
                                        </label>
                                        <div className="font-mono text-xs bg-slate-100 text-slate-600 p-2 rounded select-all truncate">
                                            {displayUser.user_id}
                                        </div>
                                    </div>
                                </div>

                                {/* Explicit Logout Button in Body */}
                                <div className="pt-4 border-t border-slate-100">
                                    <button
                                        onClick={handleLogout}
                                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-100 font-medium"
                                    >
                                        <LogOut size={16} />
                                        Sign out of current session
                                    </button>
                                </div>

                            </div>
                        </section>

                    </div>
                </div>
            </main>
        </div>
    );
}

// --- REUSABLE COMPONENT ---
interface InfoFieldProps {
    label: string;
    value: string | number;
    name?: string;
    type?: string;
    isEditing?: boolean;
    readOnly?: boolean;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    icon?: React.ReactNode;
    helperText?: string;
}

const InfoField = ({ label, value, name, type = "text", isEditing, onChange, readOnly, icon, helperText }: InfoFieldProps) => (
    <div className="flex flex-col">
        <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1.5">
            {icon} {label}
        </label>

        {isEditing && !readOnly ? (
            <input
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
            />
        ) : (
            <div className={`text-sm font-medium py-2 ${readOnly ? 'text-slate-500' : 'text-slate-800'}`}>
                {value || <span className="text-slate-300 italic">Not set</span>}
            </div>
        )}

        {helperText && isEditing && (
            <p className="text-[10px] text-slate-400 mt-1">{helperText}</p>
        )}
    </div>
);