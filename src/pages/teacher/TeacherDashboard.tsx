import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { useActivities } from '@/hooks/useActivities';
import { useSubjects } from '@/hooks/useSubjects';
import { useSubmissions } from '@/hooks/useSubmissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus,
  BookOpen,
  Calendar,
  Users,
  CheckCircle,
  Clock,
  FileText,
  Code,
  PenTool,
  Upload,
  MoreVertical,
  Trash2,
  Eye,
  Edit,
  Loader2,
  Search,
  Mail,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import {
  Layers,
  List,
  Type,
  Hash,
  Terminal,
  CheckSquare,
} from 'lucide-react';

const activityTypeIcons: Record<string, React.ElementType> = {
  mcq: CheckCircle,
  code_completion: Code,
  fill_blanks: PenTool,
  short_answer: FileText,
  file_upload: Upload,
  mixed: Layers,
  paragraph: Type,
  checkbox: CheckSquare,
  dropdown: List,
  numerical: Hash,
  output_prediction: Terminal,
};

const activityTypeLabels: Record<string, string> = {
  mcq: 'MCQ',
  code_completion: 'Code Completion',
  fill_blanks: 'Fill in Blanks',
  short_answer: 'Short Answer',
  file_upload: 'File Upload',
  mixed: 'Mixed Activity',
  paragraph: 'Paragraph',
  checkbox: 'Checkbox',
  dropdown: 'Dropdown',
  numerical: 'Numerical',
  output_prediction: 'Output Prediction',
};

const TeacherDashboard = () => {
  const { user, profile, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { activities, isLoading: activitiesLoading, deleteActivity } = useActivities(
    selectedSubject === 'all' ? undefined : selectedSubject
  );
  const { subjects, isLoading: subjectsLoading } = useSubjects();
  const { submissions } = useSubmissions();

  // --- Notification Logic ---
  const [isNotifyOpen, setIsNotifyOpen] = useState(false);
  const [notifyBranch, setNotifyBranch] = useState('All');
  const [notifyYearSem, setNotifyYearSem] = useState('All');
  const [notifyEmails, setNotifyEmails] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [isFetchingEmails, setIsFetchingEmails] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || role !== 'teacher')) {
      navigate('/login');
    }
  }, [user, role, authLoading, navigate]);

  if (authLoading || activitiesLoading || subjectsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const filteredActivities = activities.filter((activity) =>
    activity.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const publishedCount = activities.filter((a) => a.is_published).length;
  const draftCount = activities.filter((a) => !a.is_published).length;

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this activity?')) {
      deleteActivity.mutate(id);
    }
  };



  const handleFetchEmails = async () => {
    if (notifyBranch === 'All' && notifyYearSem === 'All') {
      alert('Please select a specific Branch or Year/Semester to fetch emails.');
      return;
    }

    setIsFetchingEmails(true);
    try {
      // Parse Year/Sem
      let targetYear = '';
      let targetSem = '';
      if (notifyYearSem !== 'All') {
        const match = notifyYearSem.match(/\((\d+)\/(\d+)\)/);
        if (match) {
          targetYear = match[1];
          targetSem = match[2];
        }
      }

      let q = query(collection(db, 'email_recipients'), where('is_active', '==', true));
      if (notifyBranch !== 'All') q = query(q, where('branch', '==', notifyBranch));
      // Only filter by year/sem if parsed successfully
      if (targetYear && targetSem) {
        q = query(q, where('year', '==', targetYear), where('semester', '==', targetSem));
      }

      const querySnapshot = await getDocs(q);
      const emails: string[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.email) emails.push(data.email);
      });

      if (emails.length === 0) {
        alert('No recipients matched the selected criteria in the Email Setup list.');
      } else {
        const current = notifyEmails ? notifyEmails.split(',').map(e => e.trim()).filter(Boolean) : [];
        const newSet = new Set([...current, ...emails]);
        setNotifyEmails(Array.from(newSet).join(', '));
      }
    } catch (e) {
      console.error(e);
      alert('Failed to fetch emails.');
    } finally {
      setIsFetchingEmails(false);
    }
  };

  const handleSendNotification = async () => {
    if (!notifyEmails.trim()) {
      alert('Please add at least one recipient email.');
      return;
    }

    setIsSending(true);
    try {
      const emailList = notifyEmails.split(',').map(e => e.trim()).filter(Boolean);
      const recipients = emailList.map(email => ({ email, name: 'Student' }));

      // Call API
      const response = await fetch('http://localhost:3001/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients,
          quizDetails: {
            title: 'Teacher Notification',
            subject: 'General',
            branch: notifyBranch,
            year: notifyYearSem,
            semester: '',
            link: '#'
          },
          // Assuming we have a notifyMessage state, or fallback
          customMessage: typeof notifyMessage !== 'undefined' ? notifyMessage : undefined,
          customSubject: 'Important Announcement from Teacher'
        })
      });

      const result = await response.json();

      if (result.success) {
        alert(`Notification sent to ${result.results?.success || 0} students.`);
        setIsNotifyOpen(false);
        setNotifyEmails('');
        if (typeof setNotifyMessage === 'function') setNotifyMessage('');
      } else {
        throw new Error(result.message || 'Server error');
      }

    } catch (e) {
      console.error(e);
      alert('Failed to process notification.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">Welcome, {profile?.full_name?.split(' ')[0]}!</h1>
            <p className="text-muted-foreground">Manage your activities and track student progress</p>
          </div>
          <div className="flex gap-2">
            <Link to="/teacher/email-setup">
              <Button variant="outline" className="gap-2">
                <Mail className="h-4 w-4" />
                Email Setup
              </Button>
            </Link>
            <Link to="/teacher/email-logs">
              <Button variant="outline" className="gap-2">
                <FileText className="h-4 w-4" />
                Delivery Logs
              </Button>
            </Link>
            <Dialog open={isNotifyOpen} onOpenChange={setIsNotifyOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Users className="h-4 w-4" />
                  Notify Students
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Setup Notification</DialogTitle>
                  <DialogDescription>
                    Configure email notification for a group of students.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="flex gap-2">
                    <div className="grid flex-1 gap-2">
                      <Select value={notifyBranch} onValueChange={(val) => setNotifyBranch(val)}>
                        <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="All">Any Branch</SelectItem>
                          <SelectItem value="B.E-Computer Science & Engineering">B.E-Computer Science & Engineering</SelectItem>
                          <SelectItem value="B.E-CSE (Cyber Security)">B.E-CSE (Cyber Security)</SelectItem>
                          <SelectItem value="B.E-Biomedical Engineering">B.E-Biomedical Engineering</SelectItem>
                          <SelectItem value="B.E- Electronics & Communication Engineering">B.E- Electronics & Communication Engineering</SelectItem>
                          <SelectItem value="B.E-Mechanical Engineering">B.E-Mechanical Engineering</SelectItem>
                          <SelectItem value="B.Tech - Artificial Intelligence & Data Science">B.Tech - Artificial Intelligence & Data Science</SelectItem>
                          <SelectItem value="B.Tech - Information Technology">B.Tech - Information Technology</SelectItem>
                          <SelectItem value="B.Tech - Agricultural Engineering">B.Tech - Agricultural Engineering</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid flex-1 gap-2">
                      <Select value={notifyYearSem} onValueChange={setNotifyYearSem}>
                        <SelectTrigger><SelectValue placeholder="Year/Sem" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="All">Any Year/Sem</SelectItem>
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
                  </div>
                  <Button type="button" variant="secondary" onClick={handleFetchEmails} disabled={isFetchingEmails}>
                    {isFetchingEmails && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Fetch Student Emails
                  </Button>
                  <div className="grid gap-2">
                    <Textarea
                      placeholder="Recipient emails..."
                      value={notifyEmails}
                      onChange={(e) => setNotifyEmails(e.target.value)}
                      className="min-h-[100px]"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" onClick={handleSendNotification} disabled={isSending}>
                    {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Setup Notification
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Link to="/teacher/create">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Activity
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Activities</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activities.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Published</CardTitle>
              <CheckCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{publishedCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Drafts</CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{draftCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Submissions</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{submissions.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search activities..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter by subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>
                  {subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Activities Grid */}
        {filteredActivities.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 font-display text-lg font-semibold">No activities yet</h3>
            <p className="mb-4 text-muted-foreground">
              Create your first activity to get started
            </p>
            <Link to="/teacher/create">
              <Button>Create Activity</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredActivities.map((activity) => {
              const Icon = activityTypeIcons[activity.activity_type] || FileText;
              const subjectName = subjects.find(s => s.id === activity.subject_id)?.name || 'Unknown';
              const submissionCount = submissions.filter(
                (s) => s.activity_id === activity.id
              ).length;

              return (
                <Card
                  key={activity.id}
                  className="group relative overflow-hidden transition-all hover:shadow-lg"
                >
                  <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/teacher/activity/${activity.id}`)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/teacher/activity/${activity.id}/submissions`)}>
                          <Users className="mr-2 h-4 w-4" />
                          View Submissions
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/teacher/edit/${activity.id}`)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Activity
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(activity.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <CardHeader>
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="secondary" className="gap-1">
                        <Icon className="h-3 w-3" />
                        {activityTypeLabels[activity.activity_type]}
                      </Badge>
                      <Badge variant={activity.is_published ? 'default' : 'outline'}>
                        {activity.is_published ? 'Published' : 'Draft'}
                      </Badge>
                      {activity.target_branch && activity.target_branch !== 'All' && (
                        <Badge variant="outline" className="border-primary text-primary">
                          {activity.target_branch}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="line-clamp-1">{activity.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {activity.description || 'No description'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <BookOpen className="h-4 w-4" />
                        {subjectName}
                      </div>
                      {activity.deadline && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(activity.deadline), 'MMM d, yyyy')}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {submissionCount} submissions
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default TeacherDashboard;
