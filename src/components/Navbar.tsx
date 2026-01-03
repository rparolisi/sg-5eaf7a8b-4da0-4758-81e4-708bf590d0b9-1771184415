import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import {
    List, PieChart, Info, Home, PlusCircle, LineChart,
    ChevronDown, ScrollText, RefreshCw, Layers
} from 'lucide-react';

// --- CONFIGURAZIONE SUPABASE ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default function Navbar() {
    const router = useRouter();
    const [userInitials, setUserInitials] = useState < string > ('U');

    // Funzione helper per verificare se un percorso o i suoi figli sono attivi
    const isActive = (path: string, exact = false) => {
        if (exact) return router.pathname === path;
        return router.pathname.startsWith(path);
    };

    // Helper specifico per Investments (attivo se siamo in una delle sottocartelle)
    const isInvestmentsActive = () => {
        return ['/transactions', '/portfolio_valuation', '/securities_info'].some(p => router.pathname.startsWith(p));
    };

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

    // Definizione degli item della navbar
    const navItems = [
        {
            name: 'Home',
            path: '/',
            icon: Home,
            exact: true
        },
        {
            name: 'Investments',
            path: '#', // Placeholder, non navigabile direttamente
            icon: Layers, // Icona generica per investimenti
            isParent: true,
            // Definizione gerarchica del sottomenu
            submenu: [
                {
                    title: 'Transactions',
                    path: '/transactions',
                    icon: List,
                    actions: [
                        { name: 'View List', path: '/transactions', icon: ScrollText },
                        { name: 'Add New', path: '/transactions?add=true', icon: PlusCircle },
                        { name: 'Plot Data', path: '/transactions/plot', icon: LineChart },
                    ]
                },
                {
                    title: 'Portfolio',
                    path: '/portfolio_valuation',
                    icon: PieChart,
                    actions: [
                        { name: 'Valuation', path: '/portfolio_valuation', icon: PieChart },
                        { name: 'Update Prices', path: '/portfolio_valuation?update=true', icon: RefreshCw },
                        { name: 'Plot History', path: '/portfolio_valuation/plot', icon: LineChart },
                    ]
                },
                {
                    title: 'Securities',
                    path: '/securities_info',
                    icon: Info,
                    actions: [
                        { name: 'Info List', path: '/securities_info', icon: Info },
                    ]
                }
            ]
        }
    ];

    return (
        <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
            <div className="max-w-[1920px] mx-auto px-6 lg:px-12">

                <div className="flex justify-between items-center h-24">

                    {/* --- LEFT SIDE: LOGO + DESKTOP LINKS --- */}
                    <div className="flex items-center gap-12">

                        {/* LOGO SECTION */}
                        <div className="flex-shrink-0 flex items-center cursor-pointer gap-4" onClick={() => router.push('/')}>
                            <div className="relative w-20 h-20 flex items-center justify-center">
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

                        {/* DESKTOP NAV */}
                        <div className="hidden md:flex space-x-8 h-24">
                            {navItems.map((item) => {
                                const active = item.isParent ? isInvestmentsActive() : isActive(item.path, item.exact);
                                const Icon = item.icon;

                                return (
                                    <div key={item.name} className="relative group flex items-center h-full">
                                        <Link
                                            href={item.path}
                                            onClick={(e) => item.isParent && e.preventDefault()} // Disabilita click su link padre
                                            className={`inline-flex items-center px-1 pt-1 h-full text-base font-semibold transition-colors border-b-4 ${active
                                                ? 'border-blue-600 text-blue-600'
                                                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                                                } ${item.isParent ? 'cursor-default' : ''}`}
                                        >
                                            <Icon size={18} className="mr-2.5" />
                                            {item.name}
                                            {item.isParent && <ChevronDown size={14} className="ml-1 opacity-50 group-hover:rotate-180 transition-transform" />}
                                        </Link>

                                        {/* MEGA MENU per Investments */}
                                        {item.isParent && item.submenu && (
                                            <div className="absolute left-0 top-full pt-0 w-[400px] hidden group-hover:block animate-in fade-in slide-in-from-top-1 duration-200">
                                                <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-4 mt-0 grid gap-4">
                                                    {item.submenu.map((section) => (
                                                        <div key={section.title} className="group/section">
                                                            {/* Titolo Sezione (es. Transactions) - Cliccabile */}
                                                            <Link href={section.path} className="flex items-center gap-2 mb-2 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                                                                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md group-hover/section:bg-blue-100 transition-colors">
                                                                    <section.icon size={18} />
                                                                </div>
                                                                <span className="font-bold text-slate-800 text-sm">{section.title}</span>
                                                            </Link>

                                                            {/* Lista Azioni (es. Add, Plot) */}
                                                            <div className="grid grid-cols-1 gap-1 pl-11">
                                                                {section.actions.map((action) => (
                                                                    <Link
                                                                        key={action.name}
                                                                        href={action.path}
                                                                        className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 py-1 transition-colors"
                                                                    >
                                                                        <action.icon size={14} className="opacity-70" />
                                                                        <span>{action.name}</span>
                                                                    </Link>
                                                                ))}
                                                            </div>
                                                            {/* Separatore leggero tra sezioni (non sull'ultimo) */}
                                                            {section !== item.submenu[item.submenu.length - 1] && (
                                                                <div className="h-px bg-slate-100 my-3 ml-2 mr-2" />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* --- RIGHT SIDE: USER PROFILE --- */}
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

                    {/* --- MOBILE MENU (Semplificato per ora, espande tutto) --- */}
                    <div className="flex md:hidden justify-around w-full fixed bottom-0 left-0 bg-white border-t border-gray-200 p-3 pb-6 z-50">
                        <Link href="/" className={`flex flex-col items-center ${isActive('/', true) ? 'text-blue-600' : 'text-gray-400'}`}>
                            <Home size={24} strokeWidth={isActive('/', true) ? 2.5 : 2} />
                            <span className="text-[10px] mt-1.5 font-medium">Home</span>
                        </Link>

                        {/* Mobile Investments Link (porta a Transactions come default o apre un menu - qui semplificato) */}
                        <Link href="/transactions" className={`flex flex-col items-center ${isInvestmentsActive() ? 'text-blue-600' : 'text-gray-400'}`}>
                            <Layers size={24} strokeWidth={isInvestmentsActive() ? 2.5 : 2} />
                            <span className="text-[10px] mt-1.5 font-medium">Invest</span>
                        </Link>

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