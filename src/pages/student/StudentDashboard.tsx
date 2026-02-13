import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { useActivities } from '@/hooks/useActivities';
import { useSubjects } from '@/hooks/useSubjects';
import { useSubmissions } from '@/hooks/useSubmissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"; // Added Dialog imports
import {
  BookOpen,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  ArrowRight,
  Code,
  PenTool,
  Upload,
  Layers,
  Type,
  CheckSquare,
  List,
  Hash,
  Terminal,
  Loader2,
  Search,
  Play,
  Trophy,
  AlertCircle,
} from 'lucide-react';
import { format, isPast, isFuture } from 'date-fns';

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

const StudentDashboard = () => {
  const { user, profile, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedHistorySubject, setSelectedHistorySubject] = useState<string | null>(null);

  const { activities, isLoading: activitiesLoading } = useActivities(
    selectedSubject === 'all' ? undefined : selectedSubject
  );
  const { subjects, isLoading: subjectsLoading } = useSubjects();
  const { submissions, isLoading: submissionsLoading, refetch: refetchSubmissions } = useSubmissions();

  const getHistoryForSubject = (subjectId: string) => {
    return submissions
      .filter(s => s.submitted_at) // Must be submitted
      .map(s => {
        const activity = activities.find(a => a.id === s.activity_id);
        return { ...s, activity };
      })
      .filter(item => item.activity?.subject_id === subjectId)
      .sort((a, b) => new Date(b.submitted_at!).getTime() - new Date(a.submitted_at!).getTime());
  };

  useEffect(() => {
    refetchSubmissions();
  }, [refetchSubmissions]);

  useEffect(() => {
    if (!authLoading && (!user || role !== 'student')) {
      navigate('/login');
    }
  }, [user, role, authLoading, navigate]);

  if (authLoading || activitiesLoading || subjectsLoading || submissionsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const getSubmissionForActivity = (activityId: string) => {
    return submissions.find((s) => s.activity_id === activityId);
  };

  const filteredActivities = activities.filter((activity) => {
    const submission = getSubmissionForActivity(activity.id);
    console.log(`Checking Activity: ${activity.title} (${activity.id})`);
    console.log(`Found Submission:`, submission);

    const isCompleted = submission?.status === 'submitted' || submission?.status === 'evaluated';
    if (isCompleted) {
      console.log(`Filtering out completed activity: ${activity.title}`);
      return false;
    }

    return activity.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const completedSubmissions = submissions.filter((s) => s.status === 'submitted' || s.status === 'evaluated');
  const evaluatedSubmissions = submissions.filter((s) => s.status === 'evaluated');
  const pendingSubmissions = submissions.filter((s) => s.status === 'in_progress');

  // Calculate Performance
  const scoredSubmissions = submissions.filter((s) =>
    (s.status === 'evaluated' || s.status === 'submitted') && s.total_score !== null && s.total_score !== undefined
  );

  let totalEarnedPoints = 0;
  let totalPossiblePoints = 0;

  scoredSubmissions.forEach(s => {
    const activity = activities.find(a => a.id === s.activity_id);
    if (activity && activity.total_marks) {
      totalEarnedPoints += (s.total_score || 0);
      totalPossiblePoints += activity.total_marks;
    }
  });

  const performancePercentage = totalPossiblePoints > 0
    ? Math.round((totalEarnedPoints / totalPossiblePoints) * 100)
    : 0;

  let performanceLabel = 'No Data';
  let performanceColor = 'text-muted-foreground';

  if (totalPossiblePoints > 0) {
    if (performancePercentage >= 90) {
      performanceLabel = 'Excellent';
      performanceColor = 'text-success';
    } else if (performancePercentage >= 75) {
      performanceLabel = 'Good';
      performanceColor = 'text-primary';
    } else if (performancePercentage >= 50) {
      performanceLabel = 'Average';
      performanceColor = 'text-warning';
    } else {
      performanceLabel = 'Needs Work';
      performanceColor = 'text-destructive';
    }
  }

  // Get Recent Activities (Top 5 most recent submissions)
  const recentActivities = submissions
    .filter((s) => (s.status === 'submitted' || s.status === 'evaluated') && s.submitted_at)
    .sort((a, b) => new Date(b.submitted_at!).getTime() - new Date(a.submitted_at!).getTime())
    .slice(0, 5)
    .map(s => {
      const activity = activities.find(a => a.id === s.activity_id);
      const subject = subjects.find(sub => sub.id === activity?.subject_id);
      return {
        id: s.id,
        activityId: activity?.id,
        activityTitle: activity?.title || 'Unknown Activity',
        subjectName: subject?.name || 'Unknown Subject',
        submittedAt: s.submitted_at,
        score: s.total_score,
        totalMarks: activity?.total_marks
      };
    });

  const getActivityStatus = (activity: typeof activities[0]) => {
    // ... (rest of getActivityStatus remains same)
    const submission = getSubmissionForActivity(activity.id);
    const deadlinePassed = activity.deadline && isPast(new Date(activity.deadline));

    if (submission?.status === 'evaluated') {
      return { label: 'Evaluated', color: 'bg-success text-success-foreground', icon: Trophy };
    }
    if (submission?.status === 'submitted') {
      return { label: 'Submitted', color: 'bg-primary text-primary-foreground', icon: CheckCircle };
    }
    if (submission?.status === 'in_progress') {
      return { label: 'In Progress', color: 'bg-warning text-warning-foreground', icon: Clock };
    }
    if (deadlinePassed) {
      return { label: 'Expired', color: 'bg-destructive text-destructive-foreground', icon: AlertCircle };
    }
    return { label: 'New', color: 'bg-accent text-accent-foreground', icon: Play };
  };




  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">Welcome, {profile?.full_name?.split(' ')[0]}!</h1>
            <p className="text-muted-foreground">Browse and complete activities to track your progress</p>
          </div>

          <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Clock className="h-4 w-4" />
                Recent Activity
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Recent Activity History</DialogTitle>
                <DialogDescription>
                  {selectedHistorySubject ? 'View your activity details for this subject.' : 'Select a subject to view your recent activities.'}
                </DialogDescription>
              </DialogHeader>

              {!selectedHistorySubject ? (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  {subjects.map(subject => {
                    const count = submissions.filter(s => {
                      const act = activities.find(a => a.id === s.activity_id);
                      return act?.subject_id === subject.id && s.submitted_at;
                    }).length;

                    return (
                      <Button
                        key={subject.id}
                        variant="outline"
                        className="h-auto p-4 flex flex-col items-start gap-2 hover:bg-muted"
                        onClick={() => setSelectedHistorySubject(subject.id)}
                      >
                        <div className="font-bold">{subject.name}</div>
                        <div className="text-xs text-muted-foreground">{count} Activities Completed</div>
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedHistorySubject(null)} className="mb-4 -ml-2 text-muted-foreground">
                    <ArrowRight className="h-4 w-4 mr-1 rotate-180" /> Back to Subjects
                  </Button>

                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Activity</TableHead>
                          <TableHead>Published</TableHead>
                          <TableHead>Attended</TableHead>
                          <TableHead className="text-right">Total Mark</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getHistoryForSubject(selectedHistorySubject).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No activities found for this subject.</TableCell>
                          </TableRow>
                        ) : (
                          getHistoryForSubject(selectedHistorySubject).map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.activity?.title}</TableCell>
                              <TableCell>
                                {item.activity?.created_at ? format(new Date(item.activity.created_at), 'MMM d, yyyy') : 'N/A'}
                              </TableCell>
                              <TableCell>
                                {item.submitted_at ? format(new Date(item.submitted_at), 'MMM d, yyyy h:mm a') : 'N/A'}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {item.total_score !== undefined && item.total_score !== null ? (
                                  <span className={item.total_score >= (item.activity?.total_marks || 0) / 2 ? 'text-success' : 'text-destructive'}>
                                    {item.total_score} / {item.activity?.total_marks}
                                  </span>
                                ) : 'Pending'}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Available Activities</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredActivities.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{completedSubmissions.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Progress</CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{pendingSubmissions.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Performance</CardTitle>
              <Trophy className={`h-4 w-4 ${performanceColor}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${performanceColor}`}>
                {performanceLabel} <span className="text-sm font-normal text-muted-foreground">({performancePercentage}%)</span>
              </div>
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
            <h3 className="mb-2 font-display text-lg font-semibold">No activities available</h3>
            <p className="text-muted-foreground">
              Check back later for new activities from your teachers
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredActivities.map((activity) => {
              const Icon = activityTypeIcons[activity.activity_type] || FileText;
              const subjectName = subjects.find(s => s.id === activity.subject_id)?.name || 'Unknown';
              const status = getActivityStatus(activity);
              const StatusIcon = status.icon;
              const submission = getSubmissionForActivity(activity.id);
              const deadlinePassed = activity.deadline && isPast(new Date(activity.deadline));
              const canAttempt = !deadlinePassed || submission?.status === 'in_progress';

              return (
                <Card
                  key={activity.id}
                  className="group relative overflow-hidden transition-all hover:shadow-lg"
                >
                  <CardHeader>
                    <div className="mb-2 flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="gap-1">
                        <Icon className="h-3 w-3" />
                        {activityTypeLabels[activity.activity_type] || activity.activity_type}
                      </Badge>
                      <Badge className={status.color}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {status.label}
                      </Badge>
                      {activity.deadline && (
                        <Badge variant="outline" className={`gap-1 ${deadlinePassed ? 'text-destructive border-destructive' : 'text-muted-foreground'}`}>
                          <Calendar className="h-3 w-3" />
                          {format(new Date(activity.deadline), 'MMM d, h:mm a')}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="line-clamp-1">{activity.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {activity.description || 'No description'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <BookOpen className="h-4 w-4" />
                        {subjectName}
                      </div>
                      {activity.deadline && (
                        <div className={`flex items-center gap-1 ${deadlinePassed ? 'text-destructive' : ''}`}>
                          <Calendar className="h-4 w-4" />
                          {format(new Date(activity.deadline), 'MMM d, yyyy')}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Trophy className="h-4 w-4" />
                        {activity.total_marks} marks
                      </div>
                    </div>

                    {submission?.status === 'evaluated' && (
                      <div className="mb-4">
                        <div className="mb-1 flex justify-between text-sm">
                          <span>Score</span>
                          <span className="font-medium">
                            {submission.total_score}/{activity.total_marks}
                          </span>
                        </div>
                        <Progress
                          value={(submission.total_score || 0) / activity.total_marks * 100}
                          className="h-2"
                        />
                      </div>
                    )}

                    <Link to={`/student/activity/${activity.id}`}>
                      <Button
                        className="w-full"
                        variant={submission ? 'outline' : 'default'}
                        disabled={!canAttempt && !submission}
                      >
                        {submission?.status === 'evaluated'
                          ? 'View Results'
                          : submission?.status === 'submitted'
                            ? 'View Submission'
                            : submission?.status === 'in_progress'
                              ? 'Continue'
                              : deadlinePassed
                                ? 'Deadline Passed'
                                : 'Start Activity'}
                      </Button>
                    </Link>
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

export default StudentDashboard;
