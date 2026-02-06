import { useParams, useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { useActivity } from '@/hooks/useActivities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    ArrowLeft,
    Calendar,
    Trophy,
    CheckCircle,
    BookOpen,
    Loader2,
    AlertCircle,
    Code,
    PenTool,
    FileText,
    Upload,
    Type,
    List,
    CheckSquare,
    Hash,
    Terminal,
} from 'lucide-react';
import { format } from 'date-fns';

const activityTypeIcons: Record<string, React.ElementType> = {
    mcq: CheckCircle,
    code_completion: Code,
    fill_blanks: PenTool,
    short_answer: FileText,
    paragraph: Type,
    checkbox: CheckSquare,
    dropdown: List,
    numerical: Hash,
    output_prediction: Terminal,
    file_upload: Upload,
};

const ActivityDetails = () => {
    const { activityId } = useParams<{ activityId: string }>();
    const { user, role, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const { data: activity, isLoading: activityLoading } = useActivity(activityId || '');

    if (authLoading || activityLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    if (!activity) return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <div className="container py-8">
                <Card className="p-12 text-center">
                    <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Activity Not Found</h2>
                    <Button onClick={() => navigate('/teacher')}>Back to Dashboard</Button>
                </Card>
            </div>
        </div>
    );

    const Icon = activityTypeIcons[activity.activity_type] || FileText;

    // Group questions by section
    const sections = activity.sections || [{ id: 'default', title: 'Questions', order: 0 }];
    const questionsBySection = (activity.questions || []).reduce((acc: any, q: any) => {
        const secId = q.section_id || 'default';
        if (!acc[secId]) acc[secId] = [];
        acc[secId].push(q);
        return acc;
    }, {});

    return (
        <div className="min-h-screen bg-background">
            <Navbar />

            <main className="container py-8 max-w-4xl">
                <Button variant="ghost" onClick={() => navigate('/teacher')} className="mb-4 gap-2">
                    <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                </Button>

                <div className="space-y-6">
                    {/* Header */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <Badge variant="secondary" className="gap-1"><Icon className="h-3 w-3" /> {activity.activity_type.replace('_', ' ')}</Badge>
                                <Badge variant={activity.is_published ? 'default' : 'outline'}>{activity.is_published ? 'Published' : 'Draft'}</Badge>
                            </div>
                            <CardTitle className="text-2xl">{activity.title}</CardTitle>
                            {activity.description && <CardDescription className="text-base">{activity.description}</CardDescription>}
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1"><BookOpen className="h-4 w-4" /> {activity.subjects?.name || 'General'}</div>
                                {activity.deadline && <div className="flex items-center gap-1"><Calendar className="h-4 w-4" /> Due: {format(new Date(activity.deadline), 'PPp')}</div>}
                                <div className="flex items-center gap-1"><Trophy className="h-4 w-4" /> {activity.total_marks} marks</div>
                            </div>
                            {activity.instructions && (
                                <div className="mt-4 p-4 rounded-lg bg-muted">
                                    <h4 className="font-medium mb-2">Instructions</h4>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{activity.instructions}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Content */}
                    <div className="space-y-8">
                        {sections.sort((a: any, b: any) => a.order - b.order).map((section: any) => {
                            const sectionQuestions = questionsBySection[section.id] || [];
                            if (sectionQuestions.length === 0) return null;

                            return (
                                <div key={section.id} className="space-y-4">
                                    {section.id !== 'default' && (
                                        <div className="flex items-baseline gap-2 border-b pb-2">
                                            <h3 className="text-lg font-semibold">{section.title}</h3>
                                            <span className="text-sm text-muted-foreground">{section.description}</span>
                                        </div>
                                    )}

                                    {sectionQuestions.map((question: any) => (
                                        <Card key={question.id}>
                                            <CardHeader className="pb-2">
                                                <div className="flex items-center justify-between">
                                                    <Badge variant="secondary">Q{question.order_index + 1}</Badge>
                                                    <Badge variant="outline">{question.marks} marks</Badge>
                                                </div>
                                                <CardTitle className="text-base mt-2 whitespace-pre-wrap">{question.question_text}</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                {/* Display options or code template if applicable */}
                                                {question.question_type === 'mcq' && (
                                                    <div className="space-y-2 mt-2">
                                                        {question.options?.map((opt: any) => (
                                                            <div key={opt.id} className={`flex items-center gap-2 p-2 rounded border ${opt.is_correct ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-transparent'}`}>
                                                                <div className={`h-4 w-4 rounded-full border ${opt.is_correct ? 'bg-green-500 border-green-500' : 'border-gray-400'}`} />
                                                                <span>{opt.option_text}</span>
                                                                {opt.is_correct && <Badge variant="outline" className="ml-auto text-green-600 border-green-200">Correct</Badge>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {question.question_type === 'code_completion' && (
                                                    <pre className="p-4 mt-2 rounded-lg bg-muted text-sm overflow-x-auto font-mono">{question.code_template}</pre>
                                                )}
                                                {/* Add other type previews as needed */}
                                                {renderExtraInfo(question)}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </main>
        </div>
    );
};

// Helper for other question types
const renderExtraInfo = (question: any) => {
    switch (question.question_type) {
        case 'fill_blanks':
        case 'short_answer':
        case 'numerical':
            return <div className="mt-2 text-sm text-muted-foreground">Correct Answer: <span className="font-mono text-foreground">{question.correct_answer}</span></div>;
        default:
            return null;
    }
}

export default ActivityDetails;
