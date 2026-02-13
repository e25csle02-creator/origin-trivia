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
  Send,
  Copy,
  FileDown,
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

  const { activities, isLoading: activitiesLoading, deleteActivity, updateActivity, duplicateActivity } = useActivities(
    selectedSubject === 'all' ? undefined : selectedSubject
  );
  const { subjects, isLoading: subjectsLoading } = useSubjects();
  const { submissions } = useSubmissions();

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

  const handlePublish = async (id: string, title: string) => {
    if (confirm(`Are you sure you want to publish "${title}"? It will be visible to students immediately.`)) {
      try {
        updateActivity.mutate({ id, is_published: true });
      } catch (e) {
        console.error(e);
        alert("Failed to publish.");
      }
    }
  };

  const handleDuplicate = async (id: string, title: string) => {
    if (confirm(`Duplicate "${title}"? This will create a new draft copy.`)) {
      try {
        await duplicateActivity.mutateAsync(id);
        alert("Activity duplicated successfully!");
      } catch (e) {
        console.error(e);
        alert("Failed to duplicate activity.");
      }
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

                        <DropdownMenuItem onClick={() => handleDuplicate(activity.id, activity.title)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>

                        <DropdownMenuItem onClick={() => window.open(`/teacher/activity/${activity.id}/print`, '_blank')}>
                          <FileDown className="mr-2 h-4 w-4" />
                          Download Question Paper
                        </DropdownMenuItem>

                        {!activity.is_published && (
                          <DropdownMenuItem onClick={() => handlePublish(activity.id, activity.title)}>
                            <Send className="mr-2 h-4 w-4" />
                            Publish Now
                          </DropdownMenuItem>
                        )}

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
                        {activityTypeLabels[activity.activity_type] || activity.activity_type}
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
