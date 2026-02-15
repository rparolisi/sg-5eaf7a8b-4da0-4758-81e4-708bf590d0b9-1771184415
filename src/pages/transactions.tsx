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
import { Plus, Trash2, Search, Filter } from "lucide-react";
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

// Definizione del tipo per le transazioni visualizzate in tabella
interface Transaction {
    id: string;
    date: string;
    ticker: string;
    type: string;
    quantity: number;
    price: number;
    total_value: number;
    fees?: number;
    currency?: string;
}

export default function Transactions() {
    const [transactions, setTransactions] = useState < Transaction[] > ([]);
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();

    // STATO AGGIORNATO: Include tutti i campi richiesti dal backend Python
    const [newTransaction, setNewTransaction] = useState({
        date: new Date().toISOString().split('T')[0],
        ticker: "",
        type: "buy",
        quantity: "",
        price: "",
        fees: "0",          // Commissioni
        currency: "EUR",    // Valuta
        exchange_rate: "1", // Tasso di cambio
        p1_split: "1.0",    // % Utente 1 (Default 100%)
        p2_split: "0.0",    // % Utente 2
        p3_split: "0.0",    // % Utente 3
    });

    const [isLoading, setIsLoading] = useState(true);

    // Caricamento transazioni (Logica esistente mantenuta)
    const fetchTransactions = async () => {
        try {
            const { data, error } = await authService.supabase
                .from('transactions')
                .select('*')
                .order('date', { ascending: false });

            if (error) throw error;
            setTransactions(data || []);
        } catch (error: any) {
            console.error('Error fetching transactions:', error);
            toast({
                title: "Errore",
                description: "Impossibile caricare le transazioni",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, []);

    // FUNZIONE DI INVIO AGGIORNATA
    const handleAddTransaction = async () => {
        try {
            // 1. Verifica utente
            const user = await authService.getCurrentUser();
            if (!user) {
                toast({ title: "Errore", description: "Utente non loggato", variant: "destructive" });
                return;
            }

            // 2. Validazione base
            if (!newTransaction.ticker || !newTransaction.quantity || !newTransaction.price) {
                toast({ title: "Errore", description: "Compila i campi obbligatori", variant: "destructive" });
                return;
            }

            // 3. Preparazione Payload per Python (TransactionRequest)
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

            console.log("Sending payload:", payload);

            // 4. Chiamata al Backend su Render
            const response = await fetch("https://invest-monitor-api.onrender.com/process_transaction", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Errore durante l'aggiunta della transazione");
            }

            // 5. Successo
            toast({ title: "Successo", description: "Transazione aggiunta correttamente!" });
            setIsOpen(false);
            fetchTransactions(); // Aggiorna la tabella

            // Resetta il form
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

    const handleDeleteTransaction = async (id: string) => {
        try {
            const { error } = await authService.supabase
                .from('transactions')
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast({ title: "Eliminata", description: "Transazione eliminata con successo" });
            fetchTransactions();
        } catch (error) {
            toast({
                title: "Errore",
                description: "Impossibile eliminare la transazione",
                variant: "destructive",
            });
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

                                {/* RIGA 1: Data e Tipo */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="date">Data</Label>
                                        <Input
                                            id="date"
                                            type="date"
                                            value={newTransaction.date}
                                            onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="type">Tipo</Label>
                                        <Select
                                            value={newTransaction.type}
                                            onValueChange={(value) => setNewTransaction({ ...newTransaction, type: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Tipo" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="buy">Acquisto</SelectItem>
                                                <SelectItem value="sell">Vendita</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* RIGA 2: Ticker e Quantità */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="ticker">Ticker</Label>
                                        <Input
                                            id="ticker"
                                            value={newTransaction.ticker}
                                            onChange={(e) => setNewTransaction({ ...newTransaction, ticker: e.target.value })}
                                            placeholder="es. AAPL"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="quantity">Quantità</Label>
                                        <Input
                                            id="quantity"
                                            type="number"
                                            value={newTransaction.quantity}
                                            onChange={(e) => setNewTransaction({ ...newTransaction, quantity: e.target.value })}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>

                                {/* RIGA 3: Prezzo e Commissioni */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="price">Prezzo Unitario</Label>
                                        <Input
                                            id="price"
                                            type="number"
                                            step="0.01"
                                            value={newTransaction.price}
                                            onChange={(e) => setNewTransaction({ ...newTransaction, price: e.target.value })}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="fees">Commissioni</Label>
                                        <Input
                                            id="fees"
                                            type="number"
                                            step="0.01"
                                            value={newTransaction.fees}
                                            onChange={(e) => setNewTransaction({ ...newTransaction, fees: e.target.value })}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                {/* RIGA 4: Valuta e Cambio */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="currency">Valuta</Label>
                                        <Select
                                            value={newTransaction.currency}
                                            onValueChange={(value) => setNewTransaction({ ...newTransaction, currency: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Valuta" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="EUR">EUR</SelectItem>
                                                <SelectItem value="USD">USD</SelectItem>
                                                <SelectItem value="GBP">GBP</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="exchange_rate">Cambio (EUR/Valuta)</Label>
                                        <Input
                                            id="exchange_rate"
                                            type="number"
                                            step="0.0001"
                                            value={newTransaction.exchange_rate}
                                            onChange={(e) => setNewTransaction({ ...newTransaction, exchange_rate: e.target.value })}
                                            placeholder="1.00"
                                        />
                                    </div>
                                </div>

                                {/* RIGA 5: Divisione Quote (Splits) */}
                                <div className="border rounded-md p-3 space-y-2 bg-muted/20">
                                    <Label className="font-semibold text-sm">Divisione Portafoglio (Totale: 1.0)</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <Label className="text-xs text-muted-foreground">User 1</Label>
                                            <Input
                                                type="number"
                                                step="0.1"
                                                value={newTransaction.p1_split}
                                                onChange={(e) => setNewTransaction({ ...newTransaction, p1_split: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs text-muted-foreground">User 2</Label>
                                            <Input
                                                type="number"
                                                step="0.1"
                                                value={newTransaction.p2_split}
                                                onChange={(e) => setNewTransaction({ ...newTransaction, p2_split: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs text-muted-foreground">User 3</Label>
                                            <Input
                                                type="number"
                                                step="0.1"
                                                value={newTransaction.p3_split}
                                                onChange={(e) => setNewTransaction({ ...newTransaction, p3_split: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setIsOpen(false)}>
                                    Annulla
                                </Button>
                                <Button onClick={handleAddTransaction}>Salva Transazione</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Tabella Transazioni */}
                <Card>
                    <CardHeader>
                        <CardTitle>Storico Transazioni</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="text-center py-4">Caricamento...</div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Ticker</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead className="text-right">Quantità</TableHead>
                                        <TableHead className="text-right">Prezzo</TableHead>
                                        <TableHead className="text-right">Totale</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center">
                                                Nessuna transazione trovata
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        transactions.map((t) => (
                                            <TableRow key={t.id}>
                                                <TableCell>{new Date(t.date).toLocaleDateString()}</TableCell>
                                                <TableCell className="font-medium">{t.ticker}</TableCell>
                                                <TableCell className={t.type === 'buy' ? 'text-green-600' : 'text-red-600'}>
                                                    {t.type === 'buy' ? 'Acquisto' : 'Vendita'}
                                                </TableCell>
                                                <TableCell className="text-right">{t.quantity}</TableCell>
                                                <TableCell className="text-right">
                                                    {t.currency === 'USD' ? '$' : '€'} {t.price.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right">€ {t.total_value?.toFixed(2)}</TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDeleteTransaction(t.id)}
                                                    >
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