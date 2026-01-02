import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { List, PieChart, Info, Home, PlusCircle, LineChart, ChevronDown, ScrollText, RefreshCw } from 'lucide-react';

// --- CONFIGURAZIONE SUPABASE ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default function Navbar() {
    const router = useRouter();
    const isActive = (path: string) => router.pathname === path;
    const [userInitials, setUserInitials] = useState < string > ('U');

    // --- FETCH USER INITIALS ---
    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    const { data } = await supabase
                        .from('users')
                        .select('full_name')
                        .eq('user_id', session.user.id)
                        .single();

                    if (data && data.full_name) {
                        const initials = data.full_name
                            .split(' ')
                            .map((n: string) => n[0])
                            .join('')
                            .toUpperCase()
                            .substring(0, 2);
                        setUserInitials(initials);
                    }
                }
            } catch (error) {
                console.error("Error fetching navbar user:", error);
            }
        };
        fetchUserProfile();
    }, []);

    // Definizione degli item
    const navItems = [
        { name: 'Home', path: '/', icon: Home },
        {
            name: 'Transactions',
            path: '/transactions',
            icon: List,
            dropdown: [
                { name: 'Transactions', path: '/transactions', icon: ScrollText },
                { name: 'Add', path: '/transactions?add=true', icon: PlusCircle },
                { name: 'Plot', path: '/transactions/plot', icon: LineChart },
            ]
        },
        {
            name: 'Portfolio',
            path: '/portfolio_valuation',
            icon: PieChart,
            dropdown: [
                { name: 'Portfolio', path: '/portfolio_valuation', icon: ScrollText },
                { name: 'Update', path: '/portfolio_valuation?update=true', icon: RefreshCw },
                { name: 'Plot', path: '/portfolio_valuation/plot', icon: LineChart },
            ]
        },
        { name: 'Securities', path: '/securities_info', icon: Info },
    ];

    return (
        <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
            <div className="max-w-[1920px] mx-auto px-6 lg:px-12"> {/* Aumentata larghezza massima e padding */}

                <div className="flex justify-between items-center h-24">

                    {/* --- LEFT SIDE: LOGO + DESKTOP LINKS (RAGGRUPPATI A SINISTRA) --- */}
                    <div className="flex items-center gap-12"> {/* Gap fisso tra logo e menu */}

                        {/* LOGO SECTION */}
                        <div className="flex-shrink-0 flex items-center cursor-pointer gap-4" onClick={() => router.push('/')}>
                            <div className="relative w-20 h-20 flex items-center justify-center"> {/* Leggermente ridotto per proporzione */}
                                <Image
                                    src="/owl-logo-no_background-new.png"
                                    alt="Owl Logo"
                                    width={80}
                                    height={80}
                                    className="object-contain scale-110"
                                    priority
                                />
                            </div>
                            <div className="flex flex-col justify-center items-center">
                                <span className="font-bold text-2xl text-slate-900 leading-none tracking-tight">
                                    O-W-L
                                </span>
                                <span className="text-xs text-blue-600 font-semibold uppercase tracking-wider leading-none mt-1">
                                    Own Wealth Log
                                </span>
                            </div>
                        </div>

                        {/* DESKTOP NAV - Ora parte subito dopo il logo */}
                        <div className="hidden md:flex space-x-8 h-24">
                            {navItems.map((item) => {
                                const active = isActive(item.path);
                                const Icon = item.icon;

                                return (
                                    <div key={item.name} className="relative group flex items-center">
                                        <Link
                                            href={item.path}
                                            className={`inline-flex items-center px-1 pt-1 h-full text-base font-semibold transition-colors border-b-4 ${active
                                                ? 'border-blue-600 text-blue-600'
                                                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                                                }`}
                                        >
                                            <Icon size={18} className="mr-2.5" />
                                            {item.name}
                                            {item.dropdown && <ChevronDown size={14} className="ml-1 opacity-50 group-hover:rotate-180 transition-transform" />}
                                        </Link>

                                        {/* Dropdown Menu */}
                                        {item.dropdown && (
                                            <div className="absolute left-0 top-full pt-0 w-56 hidden group-hover:block animate-in fade-in slide-in-from-top-1 duration-200">
                                                <div className="bg-white border border-gray-200 rounded-lg shadow-xl py-2 mt-0 overflow-hidden">
                                                    {item.dropdown.map((subItem) => (
                                                        <Link
                                                            key={subItem.name}
                                                            href={subItem.path}
                                                            className="flex items-center px-5 py-3 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                                        >
                                                            <subItem.icon size={16} className="mr-3 text-gray-400 group-hover:text-blue-500" />
                                                            {subItem.name}
                                                        </Link>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* --- RIGHT SIDE: USER PROFILE (ESTREMA DESTRA) --- */}
                    <div className="hidden md:flex items-center">
                        <Link href="/users">
                            <div className={`
                                w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-md transition-all border-2
                                ${isActive('/users')
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-blue-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                }
                            `}>
                                {userInitials}
                            </div>
                        </Link>
                    </div>

                    {/* --- MOBILE MENU --- */}
                    <div className="flex md:hidden justify-around w-full fixed bottom-0 left-0 bg-white border-t border-gray-200 p-3 pb-6 z-50">
                        {navItems.map((item) => {
                            const active = isActive(item.path);
                            const Icon = item.icon;
                            return (
                                <Link key={item.path} href={item.path} className={`flex flex-col items-center ${active ? 'text-blue-600' : 'text-gray-400'}`}>
                                    <Icon size={24} strokeWidth={active ? 2.5 : 2} />
                                    <span className="text-[10px] mt-1.5 font-medium">{item.name}</span>
                                </Link>
                            );
                        })}
                        <Link href="/users" className={`flex flex-col items-center ${isActive('/users') ? 'text-blue-600' : 'text-gray-400'}`}>
                            <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold ${isActive('/users') ? 'border-blue-600 bg-blue-100' : 'border-gray-400'}`}>
                                {userInitials}
                            </div>
                            <span className="text-[10px] mt-1.5 font-medium">Profile</span>
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    );
}