import { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { useActivities } from '@/hooks/useActivities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Loader2, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface EmailLog {
    log_id: string;
    quiz_id: string;
    recipient_email: string;
    sent_status: 'sent' | 'failed';
    sent_time: string;
}

const EmailLogs = () => {
    const { user, role, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [logs, setLogs] = useState<EmailLog[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [quizFilter, setQuizFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('');

    const { activities } = useActivities();

    useEffect(() => {
        if (!authLoading && (!user || role !== 'teacher')) {
            navigate('/login');
        }
    }, [user, role, authLoading, navigate]);

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
            try {
                const q = query(collection(db, 'email_logs'), orderBy('sent_time', 'desc'));
                const querySnapshot = await getDocs(q);
                const fetchedLogs: EmailLog[] = [];
                querySnapshot.forEach((doc) => {
                    fetchedLogs.push(doc.data() as EmailLog);
                });
                setLogs(fetchedLogs);
            } catch (error) {
                console.error("Error fetching logs:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, []);

    const getQuizTitle = (quizId: string) => {
        const activity = activities.find(a => a.id === quizId);
        return activity ? activity.title : 'Unknown Quiz';
    };

    const filteredLogs = logs.filter(log => {
        const matchesQuiz = quizFilter === 'all' || log.quiz_id === quizFilter;
        const matchesStatus = statusFilter === 'all' || log.sent_status === statusFilter;
        const matchesDate = !dateFilter || log.sent_time.startsWith(dateFilter);
        return matchesQuiz && matchesStatus && matchesDate;
    });

    const exportCSV = () => {
        const headers = ['Log ID', 'Quiz Title', 'Recipient', 'Status', 'Sent Time'];
        const rows = filteredLogs.map(log => [
            log.log_id,
            `"${getQuizTitle(log.quiz_id).replace(/"/g, '""')}"`,
            log.recipient_email,
            log.sent_status,
            log.sent_time
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "email_logs.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (authLoading || loading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <main className="container py-8 max-w-6xl">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/teacher')}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <h1 className="text-3xl font-bold">Email Delivery Reports</h1>
                    </div>
                    <Button variant="outline" onClick={exportCSV}>
                        <Download className="mr-2 h-4 w-4" /> Export CSV
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Delivery Logs</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {/* Filters */}
                        <div className="flex flex-wrap gap-4 mb-6">
                            <Select value={quizFilter} onValueChange={setQuizFilter}>
                                <SelectTrigger className="w-[250px]">
                                    <SelectValue placeholder="Filter by Quiz" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Quizzes</SelectItem>
                                    {activities.map(a => (
                                        <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[150px]">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="sent">Sent</SelectItem>
                                    <SelectItem value="failed">Failed</SelectItem>
                                </SelectContent>
                            </Select>

                            <Input
                                type="date"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="w-[200px]"
                            />
                            {/* Clear Filters Button could be added */}
                        </div>

                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date/Time</TableHead>
                                        <TableHead>Quiz</TableHead>
                                        <TableHead>Recipient</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredLogs.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center h-24">No logs found.</TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredLogs.map((log) => (
                                            <TableRow key={log.log_id || Math.random()}>
                                                <TableCell>{format(new Date(log.sent_time), 'PPpp')}</TableCell>
                                                <TableCell>{getQuizTitle(log.quiz_id)}</TableCell>
                                                <TableCell>{log.recipient_email}</TableCell>
                                                <TableCell>
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${log.sent_status === 'sent' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                        {log.sent_status.toUpperCase()}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="mt-4 text-sm text-muted-foreground">
                            Showing {filteredLogs.length} records
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
};

export default EmailLogs;
