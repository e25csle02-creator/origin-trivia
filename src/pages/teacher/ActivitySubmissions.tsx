import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { useActivity } from '@/hooks/useActivities';
import { useActivityReport, ReportRow } from '@/hooks/useActivityReport';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ArrowLeft, Eye, Download, FileSpreadsheet, Search } from 'lucide-react';
import { format } from 'date-fns';

const ActivitySubmissions = () => {
    const { activityId } = useParams<{ activityId: string }>();
    const navigate = useNavigate();
    const { loading: authLoading } = useAuth();
    const { data: activity } = useActivity(activityId || '');
    const { data: reportData, isLoading: reportLoading } = useActivityReport(activityId);

    const [activeTab, setActiveTab] = useState('submitted');
    const [searchQuery, setSearchQuery] = useState('');

    if (authLoading || reportLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    const submittedRows = reportData?.rows.filter(r => r.submissionStatus === 'submitted') || [];
    const notSubmittedRows = reportData?.rows.filter(r => r.submissionStatus === 'not_submitted') || [];
    const questions = reportData?.questions || [];

    const filterRows = (rows: ReportRow[]) => {
        if (!searchQuery) return rows;
        const lowerQuery = searchQuery.toLowerCase();
        return rows.filter(row =>
            row.student.name.toLowerCase().includes(lowerQuery) ||
            row.student.email.toLowerCase().includes(lowerQuery) ||
            (row.student.registerNumber && row.student.registerNumber.toLowerCase().includes(lowerQuery))
        );
    };

    const filteredSubmitted = filterRows(submittedRows);
    const filteredNotSubmitted = filterRows(notSubmittedRows);

    const downloadCSV = (rows: ReportRow[], filename: string) => {
        // Headers
        let csvContent = "Student Name,Register Number,Branch,Semester,Email";

        if (activeTab === 'submitted') {
            csvContent += ",Submitted At,Total Marks";
            questions.forEach((q, idx) => {
                csvContent += `,Q${idx + 1} (${q.marks})`;
            });
        }
        csvContent += "\n";

        // Rows
        rows.forEach(row => {
            let line = `"${row.student.name}","${row.student.registerNumber}","${row.student.branch}","${row.student.semester}","${row.student.email}"`;

            if (activeTab === 'submitted') {
                const date = row.submittedAt ? format(new Date(row.submittedAt), 'yyyy-MM-dd HH:mm:ss') : '-';
                line += `,"${date}","${row.totalMarks || 0}"`;

                questions.forEach(q => {
                    const mark = row.questionMarks?.[q.id] ?? '-';
                    line += `,${mark}`;
                });
            }
            csvContent += line + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <main className="container py-8 max-w-7xl">
                <div className="flex items-center gap-4 mb-6">
                    <Button variant="ghost" onClick={() => navigate('/teacher')}>
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold font-display">{activity?.title || 'Activity'}</h1>
                        <p className="text-muted-foreground">Submission Report</p>
                    </div>
                </div>

                <Tabs defaultValue="submitted" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
                        <TabsList>
                            <TabsTrigger value="submitted">Submitted ({submittedRows.length})</TabsTrigger>
                            <TabsTrigger value="not_submitted">Not Submitted ({notSubmittedRows.length})</TabsTrigger>
                        </TabsList>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name or email..."
                                    className="pl-8"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => {
                                    const list = activeTab === 'submitted' ? filteredSubmitted : filteredNotSubmitted;
                                    const name = activeTab === 'submitted' ? 'submissions' : 'not_submitted';
                                    downloadCSV(list, `${activity?.title}_${name}.csv`);
                                }}
                            >
                                <FileSpreadsheet className="h-4 w-4" />
                                Export CSV
                            </Button>
                        </div>
                    </div>

                    <TabsContent value="submitted">
                        <Card>
                            <CardHeader>
                                <CardTitle>Student Submissions</CardTitle>
                                <CardDescription>Detailed marks and answers.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {filteredSubmitted.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        {searchQuery ? 'No matching submissions found.' : 'No submissions found.'}
                                    </div>
                                ) : (
                                    <div className="rounded-md border overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="min-w-[150px]">Student</TableHead>
                                                    <TableHead>Register No</TableHead>
                                                    <TableHead>Branch / Sem</TableHead>
                                                    <TableHead>Submitted On</TableHead>
                                                    <TableHead className="text-right font-bold">Total</TableHead>
                                                    {questions.map((q, i) => (
                                                        <TableHead key={q.id} className="text-center min-w-[50px] text-xs">
                                                            Q{i + 1}<br />
                                                            <span className="text-muted-foreground">({q.marks})</span>
                                                        </TableHead>
                                                    ))}
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredSubmitted.map((row) => (
                                                    <TableRow key={row.submissionId}>
                                                        <TableCell className="font-medium">
                                                            {row.student.name}
                                                        </TableCell>
                                                        <TableCell>{row.student.registerNumber}</TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col text-xs">
                                                                <span>{row.student.branch}</span>
                                                                <span className="text-muted-foreground">{row.student.semester}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-xs whitespace-nowrap">
                                                            {row.submittedAt ? format(new Date(row.submittedAt), 'MMM d, h:mm a') : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold">
                                                            {row.totalMarks} / {activity?.total_marks}
                                                        </TableCell>
                                                        {questions.map(q => (
                                                            <TableCell key={q.id} className="text-center text-xs">
                                                                {row.questionMarks?.[q.id] ?? '-'}
                                                            </TableCell>
                                                        ))}
                                                        <TableCell className="text-right">
                                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="not_submitted">
                        <Card>
                            <CardHeader>
                                <CardTitle>Pending Submissions</CardTitle>
                                <CardDescription>Students who have not submitted yet.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {filteredNotSubmitted.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        {searchQuery ? 'No matching students found.' : 'All eligible students have submitted!'}
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Student Name</TableHead>
                                                <TableHead>Register No</TableHead>
                                                <TableHead>Branch</TableHead>
                                                <TableHead>Semester</TableHead>
                                                <TableHead>Email</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredNotSubmitted.map((row) => (
                                                <TableRow key={row.userId}>
                                                    <TableCell className="font-medium">{row.student.name}</TableCell>
                                                    <TableCell>{row.student.registerNumber}</TableCell>
                                                    <TableCell>{row.student.branch}</TableCell>
                                                    <TableCell>{row.student.semester}</TableCell>
                                                    <TableCell>{row.student.email}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button size="sm" variant="outline" onClick={() => {/* Maybe trigger reminder */ }}>
                                                            Remind
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
};

export default ActivitySubmissions;
