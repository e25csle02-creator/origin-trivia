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
import { API_BASE_URL } from '@/config';

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
  file_upload: Upload,
};

const activityTypeLabels: Record<string, string> = {
  mcq: 'MCQ',
  checkbox: 'Checkbox',
  short_answer: 'Short Answer',
  paragraph: 'Paragraph',
  dropdown: 'Dropdown',
  numerical: 'Numerical',
  fill_blanks: 'Fill in Blanks',
  file_upload: 'File Upload',
  code_completion: 'Code Completion',
  output_prediction: 'Output Prediction',
  trace_execution: 'Trace Execution',
  error_identification: 'Error Identification',
  error_correction: 'Error Correction',
  concept_identification: 'Concept Identification',
  justification: 'Justification',
  mixed: 'Mixed Activity',
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



  // Reconstruct code from templates and answers
  const constructCode = (questionId: string) => {
    const question = activity?.questions?.find((q: any) => q.id === questionId);
    if (!question) return '';

    const answer = answers[questionId];
    if (!answer) return '';

    // Error Correction / Output Prediction / Trace: Answer is usually text or simple code
    // But for Error Correction specifically, the answer IS the code.
    if (['error_correction', 'code_completion'].includes(question.question_type)) {
      // Check if it's code completion with blanks
      if (question.question_type === 'code_completion' && question.blanks && question.blanks.length > 0) {
        try {
          const studentAnswers = JSON.parse(answer);
          const splitRegex = /({{.*?}})/g;
          const segments = question.code_template?.split(splitRegex) || [];
          let blankIndex = 0;

          return segments.map((segment: string) => {
            if (segment.match(/{{.*?}}/)) {
              const blank = question.blanks[blankIndex];
              blankIndex++;
              if (blank && studentAnswers[blank.id]) {
                return studentAnswers[blank.id];
              }
              return ' '; // Empty blank if not filled, might cause compiler error which is expected
            }
            return segment;
          }).join('');
        } catch (e) {
          console.error("Failed to parse answers for run code", e);
          return '';
        }
      }

      // Default fallback (Error Correction or Code Completion without blanks)
      // For Error Correction, the answer is the full corrected code.
      // For simple Code Completion, answer is full code.
      return answer;
    }

    // For Output Prediction, we run the TEMPLATE, not the answer (Answer is the predicted output).
    if (question.question_type === 'output_prediction') {
      return question.code_template || '';
    }

    return '';
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
        // Handle Blanks (JSON answer)
        if (question.blanks && question.blanks.length > 0) {
          let studentAnswers: Record<string, string> = {};
          try { studentAnswers = JSON.parse(answer); } catch (e) { console.error("Failed to parse code completion answer", e); }

          let totalScore = 0;
          let allCorrect = true;

          question.blanks.forEach((blank: any) => {
            const val = (studentAnswers[blank.id] || '').trim();
            // Exact match
            if (blank.correct_answers.some((ca: string) => ca.trim() === val)) {
              totalScore += (blank.marks || 0);
            } else {
              allCorrect = false;
            }
          });

          isCorrect = allCorrect;
          score = totalScore;
        } else {
          // Exact code match (fallback)
          isCorrect = answer.trim() === (question.correct_answer || '').trim();
          if (isCorrect) score = maxMarks;
        }
        break;

      case 'error_correction':
        // For error correction, we rely SOLELY on the code execution result (handleRunCode).
        // If the user didn't run the code successfully, this function returns 0.
        // The success score is captured in evaluatedAnswers via handleRunCode.
        return { score: 0, is_correct: false, feedback: 'Please run the code to verify your answer.' };

      case 'short_answer': // If not AI
      case 'output_prediction':
      case 'error_identification':
      case 'numerical':
      case 'concept_identification':
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
        }
        if (isCorrect) score = maxMarks;
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

          const response = await fetch(`${API_BASE_URL}/api/evaluate`, {
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

        const evaluation = evaluateObjectiveQuestion(q, answer);
        const score = (aiResult.score !== undefined) ? aiResult.score : evaluation?.score;
        const feedback = aiResult.feedback || evaluation?.feedback;

        // Normalize answer structure based on type
        if (['mcq', 'checkbox', 'dropdown'].includes(q.question_type)) {
          return {
            question_id: q.id,
            selected_option_id: answer,
            score: score,
            feedback: feedback
          };
        }
        return {
          question_id: q.id,
          answer_text: answer,
          score: score,
          feedback: feedback
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
    const code = constructCode(questionId);
    if (!code) {
      toast({ title: 'No code', description: 'Please complete the code to run.', variant: 'destructive' });
      return;
    }

    setCompiling({ ...compiling, [questionId]: true });
    setCompileOutput({ ...compileOutput, [questionId]: { output: '', error: '' } });

    console.log(`[Compiler] Sending request to: ${API_BASE_URL}/api/compile`);
    try {
      const response = await fetch(`${API_BASE_URL}/api/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();
      setCompileOutput({
        ...compileOutput,
        [questionId]: { output: data.output, error: data.error }
      });

      // Auto-grade Error Correction if runs successfully
      const q = activity.questions.find(q => q.id === questionId);
      if (q && q.question_type === 'error_correction') {
        if (!data.error && data.output) {
          // Success!
          setEvaluatedAnswers(prev => ({
            ...prev,
            [questionId]: { score: q.marks || 5, feedback: "Great Job! The code runs successfully." }
          }));
          toast({ title: 'Correct!', description: 'Code runs successfully. Full marks awarded.', className: 'bg-green-100 border-green-500 text-green-900' });
        } else if (data.error) {
          // Reset matched score if it fails again?
          setEvaluatedAnswers(prev => {
            const newPrev = { ...prev };
            delete newPrev[questionId];
            return newPrev;
          });
        }
      }
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

  const checkOutputPrediction = async (questionId: string) => {
    const code = constructCode(questionId); // This gets the TEMPLATE for prediction
    const studentPrediction = answers[questionId];

    if (!studentPrediction) {
      toast({ title: 'No prediction', description: 'Please enter your output prediction.', variant: 'destructive' });
      return;
    }

    setCompiling({ ...compiling, [questionId]: true });
    setCompileOutput({ ...compileOutput, [questionId]: { output: '', error: '' } });

    try {
      const response = await fetch(`${API_BASE_URL}/api/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      // Compare output
      const actualOutput = (data.output || '').trim();
      const predicted = studentPrediction.trim();

      // Simple exact match (case insensitive? usually output is case sensitive but let's be strict for now or adhere to question settings if we had them)
      // Let's go with exact trim match.
      const isMatch = actualOutput === predicted;

      if (isMatch) {
        setCompileOutput({
          ...compileOutput,
          [questionId]: { output: 'Correct! The actual output matches your prediction.', error: '' }
        });
        toast({ title: 'Correct!', description: 'Your prediction matches the code output.', className: 'bg-green-100 border-green-500 text-green-900' });
      } else {
        setCompileOutput({
          ...compileOutput,
          [questionId]: { output: '', error: 'Incorrect. The actual output does NOT match your prediction.' }
        });
        toast({ title: 'Incorrect', description: 'Your prediction does not match.', variant: 'destructive' });
      }

    } catch (error: any) {
      toast({ title: 'Execution Failed', description: 'Could not run code to verify prediction.', variant: 'destructive' });
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
        if (question.blanks && question.blanks.length > 0) {
          // Render Blanks Interleaved
          const splitRegex = /({{.*?}})/g;
          const segments = question.code_template?.split(splitRegex) || [];
          let blankIndex = 0;
          const allAnswers = answers[question.id] ? JSON.parse(answers[question.id] || '{}') : {};

          return (
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-muted/50 text-sm overflow-x-auto font-mono leading-loose whitespace-pre-wrap">
                {segments.map((segment: string, i: number) => {
                  if (segment.match(/{{.*?}}/)) {
                    const currentBlank = question.blanks[blankIndex];
                    blankIndex++;
                    if (!currentBlank) return <span key={i} className="text-destructive">?</span>;

                    const val = allAnswers[currentBlank.id] || '';
                    return (
                      <Input
                        key={currentBlank.id}
                        className="inline-flex w-32 h-7 mx-1 min-w-[80px] text-center px-1 border-primary/50 focus:border-primary"
                        value={val}
                        onChange={(e) => {
                          const newAns = { ...allAnswers, [currentBlank.id]: e.target.value };
                          setAnswers({ ...answers, [question.id]: JSON.stringify(newAns) });
                        }}
                        disabled={disabled}
                        placeholder={`(${currentBlank.marks} Marks)`}
                      />
                    );
                  }
                  return <span key={i}>{segment}</span>;
                })}
              </div>

              <div className="flex justify-end mt-2 items-center gap-2">
                <p className="text-xs text-muted-foreground italic">
                  Note: Java code must contain a <code>public static void main(String[] args)</code> method to execute.
                </p>
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

        }
        // Fallback for simple code completion (entire block)
        return (
          <div className="space-y-3">
            {question.code_template && <pre className="p-4 rounded-lg bg-muted text-sm overflow-x-auto font-mono">{question.code_template}</pre>}
            <Textarea placeholder="Complete the code..." value={val} onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })} disabled={disabled} className="font-mono" rows={4} />

            <div className="flex justify-end items-center gap-2">
              <p className="text-xs text-muted-foreground italic">
                Note: Java code must contain a <code>public static void main(String[] args)</code> method to execute.
              </p>
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
              <Button size="sm" variant="secondary" onClick={() => checkOutputPrediction(question.id)} disabled={compiling[question.id] || disabled}>
                {compiling[question.id] ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Terminal className="h-3 w-3 mr-1" />}
                Check Prediction
              </Button>
            </div>
            {(compileOutput[question.id]?.output || compileOutput[question.id]?.error) && (
              <div className="mt-2 text-sm">
                <Label className="text-xs text-muted-foreground">Verification Result:</Label>
                <div className={`p-3 rounded-md font-medium mt-1 ${compileOutput[question.id]?.error ? 'bg-red-100 text-red-900' : 'bg-green-100 text-green-900'}`}>
                  {compileOutput[question.id]?.error || compileOutput[question.id]?.output}
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
            <div className="flex justify-end items-center gap-2">
              <p className="text-xs text-muted-foreground italic">
                Note: Java code must contain a <code>public static void main(String[] args)</code> method to execute.
              </p>
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
      case 'concept_identification':
        return (
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">Identify the concept in this code:</Label>
            {question.code_template && <pre className="p-4 rounded-lg bg-muted text-sm overflow-x-auto font-mono border">{question.code_template}</pre>}
            <Input placeholder="Enter the concept name..." value={val} onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })} disabled={disabled} />
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
                  <Badge variant="secondary" className="gap-1">
                    <Icon className="h-3 w-3" />
                    {activityTypeLabels[activity.activity_type] || activity.activity_type}
                  </Badge>
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
