import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/router';
import { Lock, Mail, User, AlertCircle } from 'lucide-react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default function LoginPage() {
    const router = useRouter();

    // State to toggle between Login and Sign Up
    const [isSignUp, setIsSignUp] = useState(false);

    // Form fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState(''); // Extra field for public.users

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState < string | null > (null);
    const [message, setMessage] = useState < string | null > (null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (isSignUp) {
                // --- SIGN UP FLOW ---

                // 1. Create user in Supabase Auth (auth.users)
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { full_name: fullName } // Saves metadata in auth.users too
                    }
                });

                if (authError) throw authError;

                // 2. Insert user into public.users table manually
                if (authData.user) {
                    const { error: profileError } = await supabase
                        .from('users') // Assumes your public table is named 'users'
                        .insert([
                            {
                                id: authData.user.id, // Links auth.users id with public.users id
                                email: email,
                                full_name: fullName
                                // Add other default columns here if needed
                            }
                        ]);

                    if (profileError) {
                        // Optional: Consider if you want to rollback auth user creation here
                        console.error("Error creating public profile:", profileError);
                        throw new Error("Account created, but profile setup failed.");
                    }
                }

                setMessage("Account created successfully! Please check your email to confirm.");
                // Optionally switch to login mode or wait for verification
                setIsSignUp(false);

            } else {
                // --- LOGIN FLOW ---
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (error) throw error;

                // Redirect on success
                router.push('/users');
            }

        } catch (err: any) {
            console.error("Auth error:", err.message);
            setError(err.message || "An error occurred during authentication.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 font-sans">
            <div className="w-full max-w-md bg-white py-8 px-6 shadow-xl rounded-2xl border border-slate-100">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-900">
                        {isSignUp ? "Create Account" : "Welcome back"}
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        {isSignUp ? "Sign up to get started" : "Please enter your details to sign in"}
                    </p>
                </div>

                <form className="space-y-4" onSubmit={handleAuth}>
                    {/* Error Alert */}
                    {error && (
                        <div className="bg-red-50 p-3 rounded border border-red-100 flex items-center gap-2 text-red-700 text-sm">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    {/* Success Message */}
                    {message && (
                        <div className="bg-green-50 p-3 rounded border border-green-100 text-green-700 text-sm text-center">
                            {message}
                        </div>
                    )}

                    {/* Full Name Field (Only for Sign Up) */}
                    {isSignUp && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-2.5 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    required
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                                    placeholder="John Doe"
                                />
                            </div>
                        </div>
                    )}

                    {/* Email Field */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-2.5 text-slate-400" size={18} />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                                placeholder="user@example.com"
                            />
                        </div>
                    </div>

                    {/* Password Field */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 text-slate-400" size={18} />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                                placeholder="••••••••"
                                minLength={6}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 transition-colors"
                    >
                        {loading
                            ? (isSignUp ? "Creating account..." : "Signing in...")
                            : (isSignUp ? "Sign Up" : "Sign In")
                        }
                    </button>
                </form>

                {/* Toggle Login/Sign Up */}
                <div className="mt-6 text-center text-sm text-slate-600">
                    {isSignUp ? "Already have an account? " : "Don't have an account? "}
                    <button
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError(null);
                            setMessage(null);
                        }}
                        className="text-blue-600 font-semibold hover:underline focus:outline-none"
                    >
                        {isSignUp ? "Sign In" : "Sign Up"}
                    </button>
                </div>
            </div>
        </div>
    );
}