import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/authService";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// --- INTERFACCIA BASATA SUL TUO SCHEMA DB ---
interface Transaction {
    id: string;
    operation_date: string;        // Era: date
    ticker: string;
    buy_or_sell: string;           // Era: type
    shares_count: number;          // Era: quantity
    price_per_share_asset_curr: number; // Era: price
    asset_currency: string;        // Era: currency
    total_outlay_user_curr: number; // Totale calcolato in € dal backend
}

export default function Transactions() {
    const [transactions, setTransactions] = useState < Transaction[] > ([]);
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();

    // Stato per il form di AGGIUNTA (questo deve rimanere compatibile con il Backend Python)
    const [newTransaction, setNewTransaction] = useState({
        date: new Date().toISOString().split('T')[0],
        ticker: "",
        type: "buy",
        quantity: "",
        price: "",
        fees: "0",
        currency: "EUR",
        exchange_rate: "1",
        p1_split: "1.0",
        p2_split: "0.0",
        p3_split: "0.0",
    });

    const [isLoading, setIsLoading] = useState(true);

    // --- FETCH TRANSAZIONI ---
    const fetchTransactions = async () => {
        try {
            setIsLoading(true);

            // Selezioniamo le colonne esatte dal tuo schema DB
            const { data, error } = await authService.supabase
                .from('transactions')
                .select('*')
                .order('operation_date', { ascending: false }); // Ordina per operation_date

            if (error) {
                console.error("Supabase Error:", error);
                throw error;
            }

            console.log("Transazioni caricate:", data);
            setTransactions(data || []);
        } catch (error: any) {
            console.error('Error fetching transactions:', error);
            toast({
                title: "Errore",
                description: "Impossibile caricare le transazioni. Verifica la connessione.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, []);

    // --- AGGIUNTA TRANSAZIONE (Verso Backend Python) ---
    const handleAddTransaction = async () => {
        try {
            const user = await authService.getCurrentUser();
            if (!user) {
                toast({ title: "Errore", description: "Login richiesto", variant: "destructive" });
                return;
            }

            // Validazione Input
            if (!newTransaction.ticker || !newTransaction.quantity || !newTransaction.price) {
                toast({ title: "Attenzione", description: "Compila Ticker, Quantità e Prezzo", variant: "destructive" });
                return;
            }

            // Costruzione Payload per Python API
            const payload = {
                date: newTransaction.date,
                ticker: newTransaction.ticker.toUpperCase(),
                transaction_type: newTransaction.type,
                price: parseFloat(newTransaction.price),
                quantity: parseFloat(newTransaction.quantity),
                fees: parseFloat(newTransaction.fees || "0"),
                currency: newTransaction.currency,
                exchange_rate: parseFloat(newTransaction.exchange_rate || "1"),
                p1_split: parseFloat(newTransaction.p1_split || "1"),
                p2_split: parseFloat(newTransaction.p2_split || "0"),
                p3_split: parseFloat(newTransaction.p3_split || "0"),
                user_id: user.id
            };

            console.log("Invio a Python:", payload);

            // Chiamata API
            const response = await fetch("https://invest-monitor-api.onrender.com/process_transaction", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Errore dal server");
            }

            toast({ title: "Successo", description: "Transazione registrata!" });
            setIsOpen(false);

            // Piccola attesa per dare tempo al DB di aggiornarsi prima di ricaricare
            setTimeout(() => fetchTransactions(), 1000);

            // Reset Form
            setNewTransaction({
                date: new Date().toISOString().split('T')[0],
                ticker: "",
                type: "buy",
                quantity: "",
                price: "",
                fees: "0",
                currency: "EUR",
                exchange_rate: "1",
                p1_split: "1.0",
                p2_split: "0.0",
                p3_split: "0.0",
            });

        } catch (error: any) {
            console.error(error);
            toast({
                title: "Errore",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    // --- ELIMINAZIONE TRANSAZIONE ---
    const handleDeleteTransaction = async (id: string) => {
        if (!confirm("Sei sicuro di voler eliminare questa transazione?")) return;

        try {
            const { error } = await authService.supabase
                .from('transactions')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast({ title: "Eliminata", description: "Transazione rimossa correttamente." });
            fetchTransactions();
        } catch (error) {
            toast({ title: "Errore", description: "Impossibile eliminare.", variant: "destructive" });
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <div className="container mx-auto p-4 space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h1 className="text-3xl font-bold">Transazioni</h1>

                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Aggiungi Transazione
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Nuova Transazione</DialogTitle>
                            </DialogHeader>

                            <div className="grid gap-4 py-4">
                                {/* --- FORM INPUTS --- */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Data</Label>
                                        <Input type="date" value={newTransaction.date} onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Tipo</Label>
                                        <Select value={newTransaction.type} onValueChange={(value) => setNewTransaction({ ...newTransaction, type: value })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="buy">Acquisto</SelectItem>
                                                <SelectItem value="sell">Vendita</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Ticker</Label>
                                        <Input value={newTransaction.ticker} onChange={(e) => setNewTransaction({ ...newTransaction, ticker: e.target.value })} placeholder="Es. AAPL" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Quantità</Label>
                                        <Input type="number" value={newTransaction.quantity} onChange={(e) => setNewTransaction({ ...newTransaction, quantity: e.target.value })} placeholder="0" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Prezzo (Valuta Originale)</Label>
                                        <Input type="number" step="0.01" value={newTransaction.price} onChange={(e) => setNewTransaction({ ...newTransaction, price: e.target.value })} placeholder="0.00" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Commissioni (€)</Label>
                                        <Input type="number" step="0.01" value={newTransaction.fees} onChange={(e) => setNewTransaction({ ...newTransaction, fees: e.target.value })} placeholder="0.00" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Valuta Asset</Label>
                                        <Select value={newTransaction.currency} onValueChange={(value) => setNewTransaction({ ...newTransaction, currency: value })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="EUR">EUR</SelectItem>
                                                <SelectItem value="USD">USD</SelectItem>
                                                <SelectItem value="GBP">GBP</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Cambio (EUR/Valuta)</Label>
                                        <Input type="number" step="0.0001" value={newTransaction.exchange_rate} onChange={(e) => setNewTransaction({ ...newTransaction, exchange_rate: e.target.value })} placeholder="1.00" />
                                    </div>
                                </div>

                                <div className="border rounded-md p-3 space-y-2 bg-muted/20">
                                    <Label className="font-semibold text-sm">Divisione Quote (Totale deve fare 1.0)</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div><Label className="text-xs text-muted-foreground">User 1</Label><Input type="number" step="0.1" value={newTransaction.p1_split} onChange={(e) => setNewTransaction({ ...newTransaction, p1_split: e.target.value })} /></div>
                                        <div><Label className="text-xs text-muted-foreground">User 2</Label><Input type="number" step="0.1" value={newTransaction.p2_split} onChange={(e) => setNewTransaction({ ...newTransaction, p2_split: e.target.value })} /></div>
                                        <div><Label className="text-xs text-muted-foreground">User 3</Label><Input type="number" step="0.1" value={newTransaction.p3_split} onChange={(e) => setNewTransaction({ ...newTransaction, p3_split: e.target.value })} /></div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setIsOpen(false)}>Annulla</Button>
                                <Button onClick={handleAddTransaction}>Salva Transazione</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* --- TABELLA VISUALIZZAZIONE --- */}
                <Card>
                    <CardHeader>
                        <CardTitle>Storico Transazioni</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="text-center py-4">Caricamento in corso...</div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Ticker</TableHead>
                                        <TableHead>Operazione</TableHead>
                                        <TableHead className="text-right">Quantità</TableHead>
                                        <TableHead className="text-right">Prezzo (Asset)</TableHead>
                                        <TableHead className="text-right">Totale (User)</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center text-muted-foreground">
                                                Nessuna transazione trovata.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        transactions.map((t) => (
                                            <TableRow key={t.id}>
                                                {/* Data: operation_date */}
                                                <TableCell>{t.operation_date ? new Date(t.operation_date).toLocaleDateString() : '-'}</TableCell>

                                                {/* Ticker */}
                                                <TableCell className="font-medium">{t.ticker}</TableCell>

                                                {/* Tipo: buy_or_sell */}
                                                <TableCell className={t.buy_or_sell?.toLowerCase() === 'buy' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                                    {t.buy_or_sell?.toUpperCase() || '-'}
                                                </TableCell>

                                                {/* Quantità: shares_count */}
                                                <TableCell className="text-right">{t.shares_count}</TableCell>

                                                {/* Prezzo: price_per_share_asset_curr + asset_currency */}
                                                <TableCell className="text-right">
                                                    {t.price_per_share_asset_curr?.toFixed(2)} {t.asset_currency}
                                                </TableCell>

                                                {/* Totale: total_outlay_user_curr (che è in € o user curr) */}
                                                <TableCell className="text-right font-bold">
                                                    € {t.total_outlay_user_curr?.toFixed(2)}
                                                </TableCell>

                                                <TableCell>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteTransaction(t.id)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}