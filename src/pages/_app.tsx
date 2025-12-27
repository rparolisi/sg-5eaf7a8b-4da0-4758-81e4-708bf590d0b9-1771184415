import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Navbar from "@/components/Navbar"; // <-- Importiamo la Navbar

export default function App({ Component, pageProps }: AppProps) {
    return (
        <div className="min-h-screen bg-gray-50">
            {/* La Navbar è qui, quindi appare su TUTTE le pagine */}
            <Navbar />

            {/* Qui viene caricato il contenuto della pagina specifica (Home, Transazioni, ecc.) */}
            <Component {...pageProps} />
        </div>
    );
}