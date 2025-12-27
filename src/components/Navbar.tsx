import Link from 'next/link';
import { useRouter } from 'next/router';
import { TrendingUp, List, PieChart, Info, Home, User } from 'lucide-react'; // Aggiunto User

export default function Navbar() {
    const router = useRouter();
    const isActive = (path: string) => router.pathname === path;

    const navItems = [
        { name: 'Home', path: '/', icon: Home },
        { name: 'Transactions', path: '/transactions', icon: List },
        { name: 'Portfolio', path: '/portfolio_valuation', icon: PieChart },
        { name: 'Securities', path: '/securities_info', icon: Info },
    ];

    return (
        <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">

                    {/* --- LEFT SIDE: LOGO + DESKTOP LINKS --- */}
                    <div className="flex items-center gap-8">
                        {/* LOGO */}
                        <div className="flex-shrink-0 flex items-center cursor-pointer" onClick={() => router.push('/')}>
                            <div className="bg-blue-600 p-1.5 rounded-lg mr-2">
                                <TrendingUp size={20} className="text-white" />
                            </div>
                            <span className="font-bold text-xl text-gray-800 tracking-tight">
                                Invest<span className="text-blue-600">Monitor</span>
                            </span>
                        </div>

                        {/* DESKTOP LINKS (Spostati qui per stare vicini al logo) */}
                        <div className="hidden md:flex space-x-8">
                            {navItems.map((item) => {
                                const active = isActive(item.path);
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.path}
                                        href={item.path}
                                        className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors border-b-2 ${active
                                                ? 'border-blue-600 text-blue-600'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                            }`}
                                    >
                                        <Icon size={16} className="mr-2" />
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    {/* --- RIGHT SIDE: USER PROFILE (DESKTOP) --- */}
                    <div className="hidden md:flex items-center">
                        <Link href="/users">
                            <div className={`
                                w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition-all border
                                ${isActive('/users') 
                                    ? 'bg-blue-600 text-white border-blue-600' 
                                    : 'bg-white text-blue-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                }
                            `}>
                                {/* Qui potresti mettere le iniziali dinamiche se avessi l'utente nello stato */}
                                IM
                            </div>
                        </Link>
                    </div>

                    {/* --- MOBILE MENU (BOTTOM BAR) --- */}
                    <div className="flex md:hidden justify-around w-full fixed bottom-0 left-0 bg-white border-t border-gray-200 p-3 pb-5 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                        {navItems.map((item) => {
                            const active = isActive(item.path);
                            const Icon = item.icon;
                            return (
                                <Link key={item.path} href={item.path} className={`flex flex-col items-center ${active ? 'text-blue-600' : 'text-gray-400'}`}>
                                    <Icon size={24} strokeWidth={active ? 2.5 : 2} />
                                    <span className="text-[10px] mt-1 font-medium">{item.name}</span>
                                </Link>
                            );
                        })}
                        
                        {/* Aggiunta Link Profilo su Mobile */}
                        <Link href="/users" className={`flex flex-col items-center ${isActive('/users') ? 'text-blue-600' : 'text-gray-400'}`}>
                            <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold ${isActive('/users') ? 'border-blue-600 bg-blue-100' : 'border-gray-400'}`}>
                                IM
                            </div>
                            <span className="text-[10px] mt-1 font-medium">Profile</span>
                        </Link>
                    </div>

                </div>
            </div>
        </nav>
    );
}