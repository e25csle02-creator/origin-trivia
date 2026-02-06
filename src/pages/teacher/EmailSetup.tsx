import { useState, useEffect } from 'react';
import { collection, addDoc, deleteDoc, updateDoc, doc, query, onSnapshot, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus, Loader2, Save, Filter } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';

interface Recipient {
    id: string;
    email: string;
    branch: string;
    year: string;
    semester: string;
    is_active: boolean;
    created_at: any;
}

const BRANCHES = [
    "B.E-Computer Science & Engineering",
    "B.E-CSE (Cyber Security)",
    "B.E-Biomedical Engineering",
    "B.E- Electronics & Communication Engineering",
    "B.E-Mechanical Engineering",
    "B.Tech - Artificial Intelligence & Data Science",
    "B.Tech - Information Technology",
    "B.Tech - Agricultural Engineering"
];

const YEARS = ["1", "2", "3", "4"];
const SEMESTERS = ["1", "2", "3", "4", "5", "6", "7", "8"];

const EmailSetup = () => {
    const { user, role, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [recipients, setRecipients] = useState<Recipient[]>([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [email, setEmail] = useState('');
    const [branch, setBranch] = useState('');
    const [yearSem, setYearSem] = useState('');
    const [adding, setAdding] = useState(false);

    // Filter State
    const [filterBranch, setFilterBranch] = useState('All');

    useEffect(() => {
        if (!authLoading && (!user || role !== 'teacher')) {
            navigate('/login');
        }
    }, [user, role, authLoading, navigate]);

    useEffect(() => {
        const q = query(collection(db, 'email_recipients'), orderBy('created_at', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Recipient[];
            setRecipients(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleAddRecipient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !branch || !yearSem) {
            toast({ title: "Validation Error", description: "All fields are required.", variant: "destructive" });
            return;
        }

        // Parse Year/Sem
        const match = yearSem.match(/\((\d+)\/(\d+)\)/);
        if (!match) {
            toast({ title: "Error", description: "Invalid Year/Sem format.", variant: "destructive" });
            return;
        }
        const year = match[1];
        const semester = match[2];

        // Check Duplicate
        const isDuplicate = recipients.some(r =>
            r.email.toLowerCase() === email.toLowerCase() &&
            r.branch === branch &&
            r.year === year &&
            r.semester === semester
        );

        if (isDuplicate) {
            toast({ title: "Duplicate Entry", description: "This email is already added for the selected group.", variant: "destructive" });
            return;
        }

        setAdding(true);
        try {
            await addDoc(collection(db, 'email_recipients'), {
                email: email.trim(),
                branch,
                year,
                semester,
                is_active: true,
                created_at: serverTimestamp()
            });
            toast({ title: "Success", description: "Recipient added successfully." });
            setEmail('');
            // Keep branch/year/sem selections
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to add recipient.", variant: "destructive" });
        } finally {
            setAdding(false);
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            await updateDoc(doc(db, 'email_recipients', id), {
                is_active: !currentStatus
            });
        } catch (error) {
            toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
        }
    };

    const deleteRecipient = async (id: string) => {
        if (!confirm("Are you sure you want to remove this email?")) return;
        try {
            await deleteDoc(doc(db, 'email_recipients', id));
            toast({ title: "Deleted", description: "Recipient removed." });
        } catch (error) {
            toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
        }
    };

    const filteredRecipients = recipients.filter(r =>
        filterBranch === 'All' || r.branch === filterBranch
    );

    if (authLoading || loading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <main className="container py-8 max-w-6xl">
                <div className="flex flex-col gap-6">
                    <div>
                        <h1 className="text-3xl font-bold font-display">Email Setup</h1>
                        <p className="text-muted-foreground">Manage recipient lists for automatic notifications.</p>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-3">
                        {/* Add Form */}
                        <Card className="lg:col-span-1 h-fit">
                            <CardHeader>
                                <CardTitle>Add Recipient</CardTitle>
                                <CardDescription>Add a new email for a specific group.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleAddRecipient} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email Address</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="student@example.com"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Branch</Label>
                                        <Select value={branch} onValueChange={setBranch}>
                                            <SelectTrigger><SelectValue placeholder="Select Branch" /></SelectTrigger>
                                            <SelectContent>
                                                {BRANCHES.map(b => (
                                                    <SelectItem key={b} value={b}>{b}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Year/Sem</Label>
                                        <Select value={yearSem} onValueChange={setYearSem}>
                                            <SelectTrigger><SelectValue placeholder="Year/Sem" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="(1/1)">(1/1)</SelectItem>
                                                <SelectItem value="(1/2)">(1/2)</SelectItem>
                                                <SelectItem value="(2/3)">(2/3)</SelectItem>
                                                <SelectItem value="(2/4)">(2/4)</SelectItem>
                                                <SelectItem value="(3/5)">(3/5)</SelectItem>
                                                <SelectItem value="(3/6)">(3/6)</SelectItem>
                                                <SelectItem value="(4/7)">(4/7)</SelectItem>
                                                <SelectItem value="(4/8)">(4/8)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <Button type="submit" className="w-full" disabled={adding}>
                                        {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        <Plus className="mr-2 h-4 w-4" /> Add Recipient
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        {/* Recipient List */}
                        <Card className="lg:col-span-2">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Recipient List ({filteredRecipients.length})</CardTitle>
                                <div className="w-[200px]">
                                    <Select value={filterBranch} onValueChange={setFilterBranch}>
                                        <SelectTrigger><SelectValue placeholder="Filter Branch" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="All">All Branches</SelectItem>
                                            {BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Email</TableHead>
                                                <TableHead>Details</TableHead>
                                                <TableHead>Active</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredRecipients.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                                        No recipients found.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                filteredRecipients.map((r) => (
                                                    <TableRow key={r.id}>
                                                        <TableCell className="font-medium">{r.email}</TableCell>
                                                        <TableCell>
                                                            <div className="text-xs text-muted-foreground">
                                                                {r.branch}<br />
                                                                Year: {r.year} | Sem: {r.semester}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Switch
                                                                checked={r.is_active}
                                                                onCheckedChange={() => toggleStatus(r.id, r.is_active)}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => deleteRecipient(r.id)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default EmailSetup;
