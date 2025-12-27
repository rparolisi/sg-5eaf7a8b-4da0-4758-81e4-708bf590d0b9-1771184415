import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useState, useEffect, useCallback, useRef } from 'react';
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
    const [inactivityLimit, setInactivityLimit] = useState < number | null > (null);

    // Usiamo un ref per il timer per poterlo cancellare facilmente tra i render
    const logoutTimerRef = useRef < NodeJS.Timeout | null > (null);

    // --- 1. LOGICA DI LOGOUT AUTOMATICO ---
    const handleAutoLogout = useCallback(async () => {
        console.warn("Session expired due to inactivity.");
        await supabase.auth.signOut();
        router.push('/login');
    }, [router]);

    // Funzione per resettare il timer
    const resetTimer = useCallback(() => {
        if (!inactivityLimit) return;

        if (logoutTimerRef.current) {
            clearTimeout(logoutTimerRef.current);
        }

        // Converte i minuti in millisecondi (minuti * 60 * 1000)
        const timeoutMs = inactivityLimit * 60 * 1000;

        logoutTimerRef.current = setTimeout(handleAutoLogout, timeoutMs);
    }, [inactivityLimit, handleAutoLogout]);

    // Setup dei listener per l'attività utente
    useEffect(() => {
        if (!inactivityLimit) return;

        // Eventi che consideriamo "attività"
        // (Ho aggiunto anche tastiera e click per evitare logout mentre si scrive ma non si muove il mouse)
        const events = ['mousemove', 'keydown', 'click', 'scroll'];

        // Avvia il timer la prima volta
        resetTimer();

        // Aggiungi ascoltatori
        events.forEach(event => window.addEventListener(event, resetTimer));

        // Pulizia quando il componente viene smontato o il limite cambia
        return () => {
            if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
            events.forEach(event => window.removeEventListener(event, resetTimer));
        };
    }, [inactivityLimit, resetTimer]);


    // --- 2. LOGICA DI AUTENTICAZIONE E CARICAMENTO PROFILO ---
    useEffect(() => {
        const authCheck = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const publicPaths = ['/login'];
            const path = router.pathname;

            // GESTIONE REINDIRIZZAMENTI
            if (!session && !publicPaths.includes(path)) {
                setIsAuthorized(false);
                router.push('/login');
            } else if (session && publicPaths.includes(path)) {
                setIsAuthorized(true);
                router.push('/');
            } else {
                setIsAuthorized(true);
            }

            // SE LOGGATO: Recupera il timeout personalizzato dal DB
            if (session) {
                try {
                    const { data, error } = await supabase
                        .from('users')
                        .select('timeout_time')
                        .eq('user_id', session.user.id)
                        .single();

                    if (data && data.timeout_time > 0) {
                        setInactivityLimit(data.timeout_time);
                    }
                } catch (err) {
                    console.error("Error fetching timeout settings:", err);
                }
            } else {
                // Se non c'è sessione, disattiva il timer
                setInactivityLimit(null);
                if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
            }
        };

        authCheck();

        // Ascolta i cambiamenti di stato (Login/Logout manuale)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                setIsAuthorized(false);
                setInactivityLimit(null); // Ferma il timer
                router.push('/login');
            } else if (event === 'SIGNED_IN') {
                setIsAuthorized(true);
                // Il useEffect sopra scatterà di nuovo per caricare il timeout
                authCheck();
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [router.pathname]);

    // Loading Screen
    if (!isAuthorized && router.pathname !== '/login') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {router.pathname !== '/login' && <Navbar />}
            <Component {...pageProps} />
        </div>
    );
}