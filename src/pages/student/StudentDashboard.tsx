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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  BookOpen,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Code,
  PenTool,
  Upload,
  Loader2,
  Search,
  Play,
  Trophy,
  AlertCircle,
} from 'lucide-react';
import { format, isPast, isFuture } from 'date-fns';
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

const StudentDashboard = () => {
  const { user, profile, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { activities, isLoading: activitiesLoading } = useActivities(
    selectedSubject === 'all' ? undefined : selectedSubject
  );
  const { subjects, isLoading: subjectsLoading } = useSubjects();
  const { submissions } = useSubmissions();

  useEffect(() => {
    if (!authLoading && (!user || role !== 'student')) {
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

  const completedSubmissions = submissions.filter((s) => s.status === 'submitted' || s.status === 'evaluated');
  const evaluatedSubmissions = submissions.filter((s) => s.status === 'evaluated');
  const totalScore = evaluatedSubmissions.reduce((acc, s) => acc + (s.total_score || 0), 0);
  const avgScore = evaluatedSubmissions.length > 0 ? Math.round(totalScore / evaluatedSubmissions.length) : 0;

  const getSubmissionForActivity = (activityId: string) => {
    return submissions.find((s) => s.activity_id === activityId);
  };

  const getActivityStatus = (activity: typeof activities[0]) => {
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
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold">Welcome, {profile?.full_name?.split(' ')[0]}!</h1>
          <p className="text-muted-foreground">Browse and complete activities to track your progress</p>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Available Activities</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activities.length}</div>
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Evaluated</CardTitle>
              <Trophy className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{evaluatedSubmissions.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Average Score</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgScore}%</div>
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
                        {activityTypeLabels[activity.activity_type]}
                      </Badge>
                      <Badge className={status.color}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {status.label}
                      </Badge>
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
