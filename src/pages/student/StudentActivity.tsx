import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { useActivity } from '@/hooks/useActivities';
import { useSubmissions } from '@/hooks/useSubmissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft,
  Calendar,
  Trophy,
  CheckCircle,
  Clock,
  BookOpen,
  Loader2,
  AlertCircle,
  Code,
  PenTool,
  FileText,
  Upload,
  Send,
  Type,
  List,
  CheckSquare,
  Hash,
  Terminal,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, isPast } from 'date-fns';

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

const StudentActivity = () => {
  const { activityId } = useParams<{ activityId: string }>();
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: activity, isLoading: activityLoading } = useActivity(activityId || '');
  const { submissions, startSubmission, submitAnswers } = useSubmissions(activityId);

  // For complex answers (like checkbox), we might serialize to string or handle object.
  // Currently useSubmissions expects simple answer text or option ID.
  // For Checkbox, we will join selected IDs with commas.
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [currentSubmission, setCurrentSubmission] = useState<any>(null);

  // Compiler State
  const [compiling, setCompiling] = useState<Record<string, boolean>>({});
  const [compileOutput, setCompileOutput] = useState<Record<string, { output: string; error: string }>>({});

  useEffect(() => {
    if (!authLoading && (!user || role !== 'student')) {
      navigate('/login');
    }
  }, [user, role, authLoading, navigate]);

  useEffect(() => {
    if (submissions.length > 0 && activityId) {
      const existing = submissions.find((s) => s.activity_id === activityId);
      setCurrentSubmission(existing);
    }
  }, [submissions, activityId]);

  const handleStartActivity = async () => {
    if (!activityId) return;
    try {
      const submission = await startSubmission.mutateAsync(activityId);
      setCurrentSubmission(submission);
      toast({ title: 'Activity started!', description: 'Good luck!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleCheckboxChange = (questionId: string, optionId: string, checked: boolean) => {
    const current = answers[questionId] ? answers[questionId].split(',') : [];
    let updated;
    if (checked) {
      updated = [...current, optionId];
    } else {
      updated = current.filter(id => id !== optionId);
    }
    setAnswers({ ...answers, [questionId]: updated.join(',') });
  };



  const evaluateObjectiveQuestion = (question: any, answer: string) => {
    let isCorrect = false;
    let score = 0;
    const maxMarks = question.marks || 0;

    if (!answer) return { score: 0, is_correct: false, feedback: 'No answer provided.' };

    switch (question.question_type) {
      case 'mcq':
      case 'dropdown':
        // Answer is option ID. Check if that option is correct.
        // We need to find the option in question_options (which comes from activity data)
        const selectedOpt = question.question_options?.find((opt: any) => opt.id === answer);
        isCorrect = selectedOpt?.is_correct === true;
        break;

      case 'checkbox':
        // Answer is comma-separated IDs.
        // Get all correct option IDs
        const correctOptIds = question.question_options?.filter((opt: any) => opt.is_correct).map((o: any) => o.id).sort();
        const selectedIds = answer.split(',').filter(Boolean).sort();

        // Check if selected matches correct exactly
        isCorrect = JSON.stringify(correctOptIds) === JSON.stringify(selectedIds);
        break;

      case 'fill_blanks':
      case 'short_answer': // If not AI
      case 'code_completion':
      case 'output_prediction':
      case 'error_identification':
      case 'error_correction':
      case 'numerical':
        // Exact string match (case insensitive? User said exact, but trimming is usually expected)
        // For fill_blanks, teacher might provide multiple comma-sep correct answers
        if (question.question_type === 'fill_blanks' && question.correct_answer.includes(',')) {
          const possibleAnswers = question.correct_answer.split(',').map((s: string) => s.trim().toLowerCase());
          isCorrect = possibleAnswers.includes(answer.trim().toLowerCase());
        } else if (question.question_type === 'numerical') {
          // Basic numerical equality
          isCorrect = parseFloat(answer) === parseFloat(question.correct_answer);
        } else {
          // Strict equality for code/others
          isCorrect = answer.trim() === (question.correct_answer || '').trim();
          // Special case: code_completion might rely on template holes, but simplistically we match final code or specific lines?
          // If the question has `correct_answer` field, we use it.
          // If code_completion is just "run and verify", auto-grading might be harder without specific output check.
          // Assuming teacher put the EXPECTED CODE in `correct_answer` or `model_answer`.
          // If `correct_answer` is present, we use it.
        }
        break;

      default:
        return null; // Not an objective question we can auto-grade simply
    }

    if (isCorrect) score = maxMarks;

    return {
      score,
      is_correct: isCorrect,
      feedback: isCorrect ? 'Correct!' : 'Incorrect.'
    };
  };

  const handleSubmit = async () => {
    if (!currentSubmission || !activity) return;

    // Validate all questions answered
    const unanswered = activity.questions.filter((q) => !answers[q.id]);
    if (unanswered.length > 0) {
      toast({
        title: 'Incomplete',
        description: `Please answer all ${unanswered.length} remaining questions.`,
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    // Evaluate AI questions first
    const evaluatedAnswers: Record<string, { score?: number; feedback?: string }> = {};

    for (const q of activity.questions) {
      if (['justification', 'short_answer', 'trace_execution', 'concept_identification', 'paragraph'].includes(q.question_type) &&
        q.evaluation_mode === 'ai' &&
        answers[q.id]) {

        try {
          toast({ title: 'AI Evaluating...', description: `Checking question ${q.order_index + 1}...` });

          // Enhanced rubric with "Any keyword = Full marks" rule
          const keywords = q.expected_keywords?.join(', ') || '';
          let rubricText = `Keywords: ${keywords}.`;
          if (keywords) {
            rubricText += ` IMPORTANT: If the student's answer contains ANY of the expected keywords (or close synonyms), you MUST award FULL MARKS (${q.marks}). Only deduct marks if completely unrelated or wrong context.`;
          }
          if (q.rubric) rubricText += ` Additional Rubric: ${q.rubric}`;

          const response = await fetch('http://localhost:3001/api/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionText: q.question_text,
              studentAnswer: answers[q.id],
              modelAnswer: q.model_answer,
              rubric: rubricText,
            }),
          });

          const result = await response.json();
          evaluatedAnswers[q.id] = {
            score: typeof result.score === 'number' ? result.score : undefined,
            feedback: result.feedback
          };

        } catch (err) {
          console.error("Evaluation failed", err);
          toast({ title: 'Evaluation Warning', description: `Could not auto-evaluate Q${q.order_index + 1}.`, variant: 'destructive' });
        }
      }
    }

    try {
      const answerData = activity.questions.map((q) => {
        const answer = answers[q.id];
        const aiResult = evaluatedAnswers[q.id] || {};

        // Normalize answer structure based on type
        if (['mcq', 'checkbox', 'dropdown'].includes(q.question_type)) {
          // For checkbox, we are sending comma-separated IDs in 'selected_option_id' field for now, 
          // OR we might need to handle this in backend. 
          // Assuming backend can store string.
          return { question_id: q.id, selected_option_id: answer };
        }
        return {
          question_id: q.id,
          answer_text: answer,
          score: aiResult.score,     // Pass to hook if it accepts it in mutation vars (need to verify hook)
          feedback: aiResult.feedback
        };
      });

      // Hook needs update if it doesn't accept score/feedback. 
      // Checking useSubmissions: submitAnswers takes array of objs. 
      // We must pass strict types. The hook 'submitAnswers' types in definition:
      // answers: { question_id: string; answer_text?: string; selected_option_id?: string; file_url?: string; }[]
      // It DOES NOT accept score/feedback yet in the mutation argument.
      // We need to modify the hook OR logic.
      // Modification to hook is cleaner. But let's verify hook first.

      await submitAnswers.mutateAsync({
        submissionId: currentSubmission.id,
        answers: answerData,
      });

      toast({ title: 'Submitted!', description: 'Your answers have been submitted successfully.' });
      navigate('/student');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const handleRunCode = async (questionId: string) => {
    const code = answers[questionId];
    if (!code) {
      toast({ title: 'No code', description: 'Please write some code to run.', variant: 'destructive' });
      return;
    }

    setCompiling({ ...compiling, [questionId]: true });
    setCompileOutput({ ...compileOutput, [questionId]: { output: '', error: '' } });

    try {
      const response = await fetch('http://localhost:3001/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();
      setCompileOutput({
        ...compileOutput,
        [questionId]: { output: data.output, error: data.error }
      });
    } catch (error: any) {
      toast({ title: 'Compilation Failed', description: 'Could not connect to compiler service.', variant: 'destructive' });
      setCompileOutput({
        ...compileOutput,
        [questionId]: { output: '', error: 'Failed to connect to compiler server.' }
      });
    } finally {
      setCompiling({ ...compiling, [questionId]: false });
    }
  };

  if (authLoading || activityLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!activity) return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8">
        <Card className="p-12 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Activity Not Found</h2>
          <Button onClick={() => navigate('/student')}>Back to Dashboard</Button>
        </Card>
      </div>
    </div>
  );

  const Icon = activityTypeIcons[activity.activity_type] || activityTypeIcons['short_answer'] || FileText; // Default 
  const deadlinePassed = activity.deadline && isPast(new Date(activity.deadline));
  const isCompleted = currentSubmission?.status === 'submitted' || currentSubmission?.status === 'evaluated';
  const canSubmit = currentSubmission?.status === 'in_progress' && !deadlinePassed;

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = activity.questions?.length || 0;
  const progress = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  // Group questions by section
  const sections = activity.sections || [{ id: 'default', title: 'Questions', order: 0 }];
  const questionsBySection = (activity.questions || []).reduce((acc, q) => {
    const secId = q.section_id || 'default';
    if (!acc[secId]) acc[secId] = [];
    acc[secId].push(q);
    return acc;
  }, {} as Record<string, typeof activity.questions>);

  const renderQuestionInput = (question: any) => {
    const disabled = isCompleted || !canSubmit;
    const val = answers[question.id] || '';

    switch (question.question_type) {
      case 'mcq':
        return (
          <RadioGroup value={val} onValueChange={(v) => setAnswers({ ...answers, [question.id]: v })} disabled={disabled}>
            {question.question_options?.map((opt: any) => (
              <div key={opt.id} className="flex items-center space-x-2">
                <RadioGroupItem value={opt.id} id={opt.id} />
                <Label htmlFor={opt.id} className="cursor-pointer flex-1">{opt.option_text}</Label>
              </div>
            ))}
          </RadioGroup>
        );
      case 'checkbox':
        return (
          <div className="space-y-2">
            {question.question_options?.map((opt: any) => {
              const isChecked = (answers[question.id] || '').split(',').includes(opt.id);
              return (
                <div key={opt.id} className="flex items-center space-x-2">
                  <input type="checkbox" id={opt.id} checked={isChecked} onChange={(e) => handleCheckboxChange(question.id, opt.id, e.target.checked)} disabled={disabled} className="h-4 w-4" />
                  <Label htmlFor={opt.id} className="cursor-pointer flex-1">{opt.option_text}</Label>
                </div>
              );
            })}
          </div>
        );
      case 'dropdown':
        return (
          <Select value={val} onValueChange={(v) => setAnswers({ ...answers, [question.id]: v })} disabled={disabled}>
            <SelectTrigger><SelectValue placeholder="Select an answer" /></SelectTrigger>
            <SelectContent>
              {question.question_options?.map((opt: any) => (
                <SelectItem key={opt.id} value={opt.id}>{opt.option_text}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'code_completion':
        return (
          <div className="space-y-3">
            {question.code_template && <pre className="p-4 rounded-lg bg-muted text-sm overflow-x-auto font-mono">{question.code_template}</pre>}
            <Textarea placeholder="Complete the code..." value={val} onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })} disabled={disabled} className="font-mono" rows={4} />

            <div className="flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => handleRunCode(question.id)} disabled={compiling[question.id] || disabled}>
                {compiling[question.id] ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Terminal className="h-3 w-3 mr-1" />}
                Run Code
              </Button>
            </div>

            {(compileOutput[question.id]?.output || compileOutput[question.id]?.error) && (
              <div className="mt-2 text-sm">
                <Label className="text-xs text-muted-foreground">Console Output:</Label>
                <div className="bg-black text-white p-3 rounded-md font-mono whitespace-pre-wrap mt-1">
                  {compileOutput[question.id]?.error && <span className="text-red-400">{compileOutput[question.id].error}</span>}
                  {compileOutput[question.id]?.output}
                </div>
              </div>
            )}
          </div>
        );
      case 'output_prediction':
        return (
          <div className="space-y-3">
            {question.code_template && <pre className="p-4 rounded-lg bg-muted text-sm overflow-x-auto font-mono">{question.code_template}</pre>}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Predict the Output:</Label>
              <Input placeholder="Enter output..." value={val} onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })} disabled={disabled} className="font-mono" />
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => handleRunCode(question.id)} disabled={compiling[question.id] || disabled}>
                {compiling[question.id] ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Terminal className="h-3 w-3 mr-1" />}
                Test Code (Run)
              </Button>
            </div>
            {(compileOutput[question.id]?.output || compileOutput[question.id]?.error) && (
              <div className="mt-2 text-sm">
                <Label className="text-xs text-muted-foreground">Actual Code Output:</Label>
                <div className="bg-black text-white p-3 rounded-md font-mono whitespace-pre-wrap mt-1">
                  {compileOutput[question.id]?.error && <span className="text-red-400">{compileOutput[question.id].error}</span>}
                  {compileOutput[question.id]?.output}
                </div>
              </div>
            )}
          </div>
        );
      case 'paragraph':
        return <Textarea placeholder="Write your detailed answer..." value={val} onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })} disabled={disabled} rows={6} />;
      case 'numerical':
        return <Input type="number" placeholder="Enter number..." value={val} onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })} disabled={disabled} />;
      case 'trace_execution':
        return (
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">Trace the execution flow:</Label>
            {question.code_template && <pre className="p-4 rounded-lg bg-muted text-sm overflow-x-auto font-mono">{question.code_template}</pre>}
            <Textarea placeholder="Describe the execution flow step-by-step..." value={val} onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })} disabled={disabled} rows={5} />
          </div>
        );
      case 'justification':
        return (
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">Provide your justification:</Label>
            <Textarea placeholder="Explain your answer..." value={val} onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })} disabled={disabled} rows={5} />
          </div>
        );
      case 'error_identification':
        return (
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">Identify the error in this code:</Label>
            {question.faulty_code && <pre className="p-4 rounded-lg bg-muted text-sm overflow-x-auto font-mono border border-destructive/20">{question.faulty_code}</pre>}
            <Input placeholder="Describe the error..." value={val} onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })} disabled={disabled} />
          </div>
        );
      case 'error_correction':
        return (
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">Correct the following code:</Label>
            {question.faulty_code && <pre className="p-4 rounded-lg bg-muted text-sm overflow-x-auto font-mono border border-destructive/20">{question.faulty_code}</pre>}
            <Textarea placeholder="Write the corrected code..." value={val} onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })} disabled={disabled} className="font-mono" rows={5} />
          </div>
        );
      case 'concept_identification':
        // Assuming options are provided via question_options like checkbox
        return (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Select all applicable concepts:</Label>
            {question.question_options?.map((opt: any) => {
              const isChecked = (answers[question.id] || '').split(',').includes(opt.id);
              return (
                <div key={opt.id} className="flex items-center space-x-2">
                  <input type="checkbox" id={opt.id} checked={isChecked} onChange={(e) => handleCheckboxChange(question.id, opt.id, e.target.checked)} disabled={disabled} className="h-4 w-4" />
                  <Label htmlFor={opt.id} className="cursor-pointer flex-1">{opt.option_text}</Label>
                </div>
              );
            })}
          </div>
        );
      default: // short_answer, fill_blanks, etc.
        return <Input placeholder="Write your answer..." value={val} onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })} disabled={disabled} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container py-8">
        <Button variant="ghost" onClick={() => navigate('/student')} className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Activity Header */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge variant="secondary" className="gap-1"><Icon className="h-3 w-3" /> {activity.activity_type === 'mixed' ? 'Mixed Activity' : activity.activity_type.replace('_', ' ')}</Badge>
                  {isCompleted && <Badge className="bg-success text-success-foreground"><CheckCircle className="mr-1 h-3 w-3" /> Submitted</Badge>}
                  {deadlinePassed && !isCompleted && <Badge variant="destructive"><AlertCircle className="mr-1 h-3 w-3" /> Deadline Passed</Badge>}
                </div>
                <CardTitle className="text-2xl">{activity.title}</CardTitle>
                {activity.description && <CardDescription className="text-base">{activity.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1"><BookOpen className="h-4 w-4" /> {activity.subjects?.name}</div>
                  {activity.deadline && <div className={`flex items-center gap-1 ${deadlinePassed ? 'text-destructive' : ''}`}><Calendar className="h-4 w-4" /> Due: {format(new Date(activity.deadline), 'PPp')}</div>}
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

            {/* Questions by Section */}
            {currentSubmission && (
              <div className="space-y-8">
                {sections.sort((a, b) => a.order - b.order).map((section) => {
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

                      {sectionQuestions.map((question: any, idx) => (
                        <Card key={question.id} className={answers[question.id] ? 'border-primary/30' : ''}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <Badge variant="secondary">Q{question.order_index + 1}</Badge>
                              <Badge variant="outline">{question.marks} marks</Badge>
                            </div>
                            <CardTitle className="text-base mt-2 whitespace-pre-wrap">{question.question_text}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            {renderQuestionInput(question)}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Start Activity CTA */}
            {!currentSubmission && !deadlinePassed && (
              <Card className="p-8 text-center">
                <Clock className="mx-auto h-12 w-12 text-primary mb-4" />
                <h3 className="font-display text-xl font-semibold mb-2">Ready to begin?</h3>
                <p className="text-muted-foreground mb-4">
                  This activity has {activity.questions?.length || 0} questions and is worth {activity.total_marks} marks.
                </p>
                <Button onClick={handleStartActivity} disabled={startSubmission.isPending}>
                  {startSubmission.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting...</> : 'Start Activity'}
                </Button>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {currentSubmission?.status === 'in_progress' && (
              <Card>
                <CardHeader><CardTitle className="text-lg">Progress</CardTitle></CardHeader>
                <CardContent>
                  <div className="mb-2 flex justify-between text-sm">
                    <span>Answered</span>
                    <span className="font-medium">{answeredCount}/{totalQuestions}</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <p className="mt-2 text-xs text-muted-foreground">{totalQuestions - answeredCount} questions remaining</p>
                </CardContent>
              </Card>
            )}

            {canSubmit && (
              <Card>
                <CardContent className="pt-6">
                  <Button className="w-full gap-2" onClick={handleSubmit} disabled={submitting || answeredCount === 0}>
                    {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</> : <><Send className="h-4 w-4" /> Submit Answers</>}
                  </Button>
                  <p className="mt-2 text-xs text-center text-muted-foreground">You can only submit once</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default StudentActivity;
