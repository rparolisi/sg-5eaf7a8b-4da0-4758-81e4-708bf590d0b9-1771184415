import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import Navbar from "@/components/Navbar";

// --- CONFIGURAZIONE SUPABASE ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default function App({ Component, pageProps }: AppProps) {
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        // Funzione che controlla l'accesso
        const authCheck = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            // Pagine che NON richiedono login
            const publicPaths = ['/login'];
            const path = router.pathname;

            if (!session && !publicPaths.includes(path)) {
                // Non loggato e pagina privata -> Vai al login
                setIsAuthorized(false);
                router.push('/login');
            } else if (session && publicPaths.includes(path)) {
                // Loggato e prova ad andare al login -> Vai alla home
                setIsAuthorized(true);
                router.push('/');
            } else {
                // Accesso consentito
                setIsAuthorized(true);
            }
        };

        authCheck();

        // Ascolta logout/login in tempo reale
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') {
                setIsAuthorized(false);
                router.push('/login');
            } else if (event === 'SIGNED_IN') {
                setIsAuthorized(true);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [router]);

    // Schermata di caricamento mentre controlliamo i permessi
    // (Mantiene il tuo bg-gray-50)
    if (!isAuthorized && router.pathname !== '/login') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* La Navbar appare su tutte le pagine TRANNE il Login */}
            {router.pathname !== '/login' && <Navbar />}

            {/* Contenuto della pagina */}
            <Component {...pageProps} />
        </div>
    );
}