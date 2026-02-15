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
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// --- INTERFACCIA BASATA SUL TUO SCHEMA DB (NON TOCCATA) ---
interface Transaction {
    id: string;
    operation_date: string;
    ticker: string;
    buy_or_sell: string;
    shares_count: number;
    price_per_share_asset_curr: number;
    asset_currency: string;
    total_outlay_user_curr: number;
}

export default function Transactions() {
    const [transactions, setTransactions] = useState < Transaction[] > ([]);
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();

    // --- STATO PER IL FORM DI AGGIUNTA (Completo per Python) ---
    const [newTransaction, setNewTransaction] = useState({
        date: new Date().toISOString().split('T')[0],
        ticker: "",
        type: "buy",
        quantity: "",
        price: "",
        fees: "0",
        currency: "EUR",
        exchange_rate: "1",
        p1_split: "1.0", // Default 100% all'utente principale
        p2_split: "0.0",
        p3_split: "0.0",
    });

    const [isLoading, setIsLoading] = useState(true);

    // --- FETCH TRANSAZIONI (LOGICA ORIGINALE MANTENUTA) ---
    const fetchTransactions = async () => {
        try {
            setIsLoading(true);

            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .order('operation_date', { ascending: false });

            if (error) {
                console.error("Supabase Error:", error);
                throw error;
            }

            setTransactions(data || []);
        } catch (error: any) {
            console.error('Error fetching transactions:', error);
            toast({
                title: "Error",
                description: "Failed to load transactions.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, []);

    // --- AGGIUNTA TRANSAZIONE (Logica Backend Python) ---
    const handleAddTransaction = async () => {
        try {
            const user = await authService.getCurrentUser();
            if (!user) {
                toast({ title: "Error", description: "Login required", variant: "destructive" });
                return;
            }

            // Validazione Input
            if (!newTransaction.ticker || !newTransaction.quantity || !newTransaction.price) {
                toast({ title: "Warning", description: "Please fill in Ticker, Quantity, and Price", variant: "destructive" });
                return;
            }

            // Costruzione Payload ESATTO per Python API (main.py)
            const payload = {
                date: newTransaction.date,
                ticker: newTransaction.ticker.toUpperCase(),
                transaction_type: newTransaction.type, // "buy" o "sell"
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

            console.log("Sending payload to Python:", payload);

            // Chiamata API
            const response = await fetch("https://invest-monitor-api.onrender.com/process_transaction", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Backend server error");
            }

            toast({ title: "Success", description: "Transaction processed and saved!" });
            setIsOpen(false);

            // Attendi un istante per il propagarsi dei dati nel DB e ricarica
            setTimeout(() => fetchTransactions(), 1000);

            // Reset del Form ai valori di default
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
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    // --- ELIMINAZIONE TRANSAZIONE (LOGICA ORIGINALE MANTENUTA) ---
    const handleDeleteTransaction = async (id: string) => {
        if (!confirm("Are you sure you want to delete this transaction?")) return;

        try {
            const { error } = await supabase
                .from('transactions')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast({ title: "Deleted", description: "Transaction removed successfully." });
            fetchTransactions();
        } catch (error) {
            toast({ title: "Error", description: "Could not delete transaction.", variant: "destructive" });
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <div className="container mx-auto p-4 space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h1 className="text-3xl font-bold">Transactions</h1>

                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Add Transaction
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>New Transaction</DialogTitle>
                            </DialogHeader>

                            <div className="grid gap-4 py-4">
                                {/* --- RIGA 1: Data e Tipo --- */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Date</Label>
                                        <Input type="date" value={newTransaction.date} onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Type</Label>
                                        <Select value={newTransaction.type} onValueChange={(value) => setNewTransaction({ ...newTransaction, type: value })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="buy">Buy</SelectItem>
                                                <SelectItem value="sell">Sell</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* --- RIGA 2: Ticker e Quantità --- */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Ticker</Label>
                                        <Input value={newTransaction.ticker} onChange={(e) => setNewTransaction({ ...newTransaction, ticker: e.target.value })} placeholder="e.g. AAPL" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Quantity</Label>
                                        <Input type="number" value={newTransaction.quantity} onChange={(e) => setNewTransaction({ ...newTransaction, quantity: e.target.value })} placeholder="0" />
                                    </div>
                                </div>

                                {/* --- RIGA 3: Prezzo e Commissioni --- */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Price (Asset Currency)</Label>
                                        <Input type="number" step="0.01" value={newTransaction.price} onChange={(e) => setNewTransaction({ ...newTransaction, price: e.target.value })} placeholder="0.00" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Fees (€)</Label>
                                        <Input type="number" step="0.01" value={newTransaction.fees} onChange={(e) => setNewTransaction({ ...newTransaction, fees: e.target.value })} placeholder="0.00" />
                                    </div>
                                </div>

                                {/* --- RIGA 4: Valuta e Cambio --- */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Asset Currency</Label>
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
                                        <Label>Exchange Rate (EUR/Currency)</Label>
                                        <Input type="number" step="0.0001" value={newTransaction.exchange_rate} onChange={(e) => setNewTransaction({ ...newTransaction, exchange_rate: e.target.value })} placeholder="1.00" />
                                    </div>
                                </div>

                                {/* --- RIGA 5: Divisione Quote --- */}
                                <div className="border rounded-md p-3 space-y-2 bg-muted/20">
                                    <Label className="font-semibold text-sm">Portfolio Split (Total must be 1.0)</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div><Label className="text-xs text-muted-foreground">User 1</Label><Input type="number" step="0.1" value={newTransaction.p1_split} onChange={(e) => setNewTransaction({ ...newTransaction, p1_split: e.target.value })} /></div>
                                        <div><Label className="text-xs text-muted-foreground">User 2</Label><Input type="number" step="0.1" value={newTransaction.p2_split} onChange={(e) => setNewTransaction({ ...newTransaction, p2_split: e.target.value })} /></div>
                                        <div><Label className="text-xs text-muted-foreground">User 3</Label><Input type="number" step="0.1" value={newTransaction.p3_split} onChange={(e) => setNewTransaction({ ...newTransaction, p3_split: e.target.value })} /></div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                                <Button onClick={handleAddTransaction}>Save Transaction</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* --- TABELLA VISUALIZZAZIONE (ORIGINALE MANTENUTA) --- */}
                <Card>
                    <CardHeader>
                        <CardTitle>Transaction History</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="text-center py-4">Loading...</div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Ticker</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead className="text-right">Quantity</TableHead>
                                        <TableHead className="text-right">Price (Asset)</TableHead>
                                        <TableHead className="text-right">Total (User)</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center text-muted-foreground">
                                                No transactions found.
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