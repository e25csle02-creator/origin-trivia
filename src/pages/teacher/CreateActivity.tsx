import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { useSubjects } from '@/hooks/useSubjects';
import { useActivities, useActivity } from '@/hooks/useActivities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Trash2,
  Loader2,
  ArrowLeft,
  CheckCircle,
  Code,
  PenTool,
  FileText,
  Upload,
  GripVertical,
  Layers,
  List,
  Type,
  Terminal,
  CheckSquare,
  XCircle,
  Wrench,
  MessageSquareQuote,
  Hash,
  Bot,
  Users,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config';

import { ActivityType, QuestionForm, SectionForm, EvaluationMode } from '@/types/activity';

const activityTypes: { value: ActivityType; label: string; icon: React.ElementType }[] = [
  // Basic
  { value: 'mcq', label: 'MCQ', icon: CheckCircle },
  { value: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { value: 'short_answer', label: 'Short Answer (Theory)', icon: FileText },
  { value: 'paragraph', label: 'Paragraph (Long)', icon: Type },
  { value: 'dropdown', label: 'Dropdown', icon: List },
  { value: 'numerical', label: 'Numerical', icon: Hash },
  { value: 'fill_blanks', label: 'Fill in Blanks', icon: PenTool },
  { value: 'file_upload', label: 'File Upload', icon: Upload },

  // Advanced Code
  { value: 'code_completion', label: 'Code Completion', icon: Code },
  { value: 'output_prediction', label: 'Output Prediction', icon: Terminal },
  { value: 'trace_execution', label: 'Trace Execution', icon: Layers },
  { value: 'error_identification', label: 'Error Identification', icon: XCircle },
  { value: 'error_correction', label: 'Error Correction', icon: Wrench },

  // Advanced Theory
  { value: 'concept_identification', label: 'Concept Identification', icon: CheckSquare },
  { value: 'justification', label: 'Justification', icon: MessageSquareQuote },
];

const CreateActivity = () => {
  const { user, role, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { subjects, createSubject } = useSubjects();
  const { createActivity } = useActivities();

  // Activity basic info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [deadline, setDeadline] = useState('');
  const [activityType, setActivityType] = useState<string>('mixed');
  const [customActivityType, setCustomActivityType] = useState('');
  const [targetBranch, setTargetBranch] = useState(profile?.branch || 'All');
  const [targetYearSemester, setTargetYearSemester] = useState('All');

  // Notification State
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [notifyBranch, setNotifyBranch] = useState(profile?.branch || 'All');
  const [notifyYearSem, setNotifyYearSem] = useState('All');
  const [customSubject, setCustomSubject] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [recipientList, setRecipientList] = useState<{ email: string; name: string; id: string }[]>([]);
  const [showRecipientPreview, setShowRecipientPreview] = useState(false);
  const [manualEmail, setManualEmail] = useState('');

  // Sync initial notification target with activity target when they change, only if user hasn't manually changed notification target?
  // tailored for simplicity: Let's default them, but allow change. 
  useEffect(() => {
    if (targetBranch) setNotifyBranch(targetBranch);
  }, [targetBranch]);

  useEffect(() => {
    if (targetYearSemester) setNotifyYearSem(targetYearSemester);
  }, [targetYearSemester]);

  const [isPublished, setIsPublished] = useState(false);
  const [saving, setSaving] = useState(false);

  // Deadline 12h format state
  const [datePart, setDatePart] = useState('');
  const [hourPart, setHourPart] = useState('12');
  const [minutePart, setMinutePart] = useState('00');
  const [ampmPart, setAmpmPart] = useState('AM');

  // Structure: Sections -> Questions
  const [sections, setSections] = useState<SectionForm[]>([
    { id: crypto.randomUUID(), title: 'Part A', description: '', order: 0 }
  ]);
  const [questions, setQuestions] = useState<QuestionForm[]>([]);

  useEffect(() => {
    if (!authLoading && (!user || role !== 'teacher')) {
      navigate('/login');
    }
  }, [user, role, authLoading, navigate]);

  // --- Section Management ---
  const addSection = () => {
    setSections([
      ...sections,
      { id: crypto.randomUUID(), title: `Part ${String.fromCharCode(65 + sections.length)}`, description: '', order: sections.length }
    ]);
  };

  useEffect(() => {
    if (profile?.branch) {
      setTargetBranch(profile.branch);
    }
  }, [profile]);

  const removeSection = (sectionId: string) => {
    if (sections.length <= 1) {
      toast({ title: 'Cannot remove', description: 'At least one section is required.', variant: 'destructive' });
      return;
    }
    setSections(sections.filter(s => s.id !== sectionId));
    setQuestions(questions.filter(q => q.section_id !== sectionId));
  };

  const updateSection = (id: string, updates: Partial<SectionForm>) => {
    setSections(sections.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // --- Question Management ---
  const addQuestion = (sectionId: string) => {
    const newQuestion: QuestionForm = {
      id: crypto.randomUUID(),
      section_id: sectionId,
      question_text: '',
      question_type: 'mcq', // Default
      marks: 5,
      correct_answer: '',
      code_template: '',

      evaluation_mode: 'auto', // Default to Exact Answer (Auto)
      options: [
        { id: crypto.randomUUID(), option_text: '', is_correct: true },
        { id: crypto.randomUUID(), option_text: '', is_correct: false },
      ],
    };
    setQuestions([...questions, newQuestion]);
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const updateQuestion = (id: string, updates: Partial<QuestionForm>) => {
    setQuestions(questions.map((q) => {
      if (q.id === id) {
        // If type changes, reset specific fields if needed
        if (updates.question_type && updates.question_type !== q.question_type) {
          const newType = updates.question_type;
          // Reset options for non-option types
          const needsOptions = ['mcq', 'checkbox', 'dropdown'].includes(newType);
          return {
            ...q,
            ...updates,
            options: needsOptions ? (q.options.length ? q.options : [
              { id: crypto.randomUUID(), option_text: '', is_correct: true },
              { id: crypto.randomUUID(), option_text: '', is_correct: false }
            ]) : [],
            // Reset fields depending on type if needed, or keep them to allow switching back and forth
            code_template: ['code_completion', 'output_prediction', 'trace_execution', 'error_identification', 'error_correction'].includes(newType) ? q.code_template : '',
            faulty_code: ['error_identification', 'error_correction'].includes(newType) ? q.faulty_code : '',
            model_answer: ['short_answer', 'justification'].includes(newType) ? q.model_answer : '',
          };
        }
        return { ...q, ...updates };
      }
      return q;
    }));
  };

  const updateOption = (questionId: string, optionId: string, updates: Partial<{ option_text: string; is_correct: boolean }>) => {
    setQuestions(questions.map((q) => {
      if (q.id === questionId) {
        // For MCQ: only one correct. For Checkbox: multiple correct.
        const isMultiSelect = q.question_type === 'checkbox';

        return {
          ...q,
          options: q.options.map((opt) => {
            if (opt.id === optionId) {
              if (!isMultiSelect && updates.is_correct === true) {
                return { ...opt, ...updates };
              }
              return { ...opt, ...updates };
            }
            if (!isMultiSelect && updates.is_correct === true) {
              return { ...opt, is_correct: false };
            }
            return opt;
          }),
        };
      }
      return q;
    }));
  };

  const addOption = (questionId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          options: [...q.options, { id: crypto.randomUUID(), option_text: '', is_correct: false }]
        };
      }
      return q;
    }));
  };

  // --- Blanks Extraction ---
  const extractBlanks = (questionId: string, code: string) => {
    // Regex to find {{...}}
    const regex = /{{(.*?)}}/g;
    let match;
    const newBlanks: { id: string; place_holder: string; correct_answers: string[]; marks: number }[] = [];

    // Maintain existing blanks if possible to preserve marks? 
    // For simplicity, we regenerate. User can adjust marks.
    // If we want to be smarter, we could map by answer text, but duplicate answers make it tricky.

    // We will use the question's default marks_per_blank if set, else 2.
    const q = questions.find(q => q.id === questionId);
    const defaultMarks = q?.marks_per_blank || 2;

    while ((match = regex.exec(code)) !== null) {
      const answer = match[1].trim();
      if (answer) {
        newBlanks.push({
          id: crypto.randomUUID(),
          place_holder: `Blank ${newBlanks.length + 1}`,
          correct_answers: [answer],
          marks: defaultMarks
        });
      }
    }

    if (newBlanks.length === 0) {
      toast({ title: 'No blanks found', description: 'Use {{answer}} syntax in the code to define blanks.', variant: 'default' });
    } else {
      toast({ title: 'Blanks Extracted', description: `Found ${newBlanks.length} blanks.` });
    }

    const totalBlankMarks = newBlanks.reduce((sum, b) => sum + b.marks, 0);

    updateQuestion(questionId, {
      blanks: newBlanks,
      marks: totalBlankMarks > 0 ? totalBlankMarks : (q?.marks || 0)
    });
  };

  const updateBlank = (questionId: string, blankId: string, updates: Partial<{ marks: number; correct_answers: string[] }>) => {
    const q = questions.find(q => q.id === questionId);
    if (!q || !q.blanks) return;

    const newBlanks = q.blanks.map(b => b.id === blankId ? { ...b, ...updates } : b);
    const totalMarks = newBlanks.reduce((sum, b) => sum + b.marks, 0);

    updateQuestion(questionId, { blanks: newBlanks, marks: totalMarks });
  };


  // --- Submission ---
  // Replaced explicit email Fetch state variable usage with direct access in Notification Setup area or on-change
  const [isFetchingEmails, setIsFetchingEmails] = useState(false);

  // Sync Notification Filters with Activity Target
  // We can just use targetBranch and targetYearSemester for fetching emails to ensure consistency
  // But the requirement says "Select Branch (dropdown)...". It makes sense to auto-sync with the Activity settings

  const getRecipientsFromDB = async (branch: string, yearSem: string) => {
    // NOTE: We connect to 'users' collection because 'email_recipients' is empty/unused.
    console.log(`[getRecipientsFromDB] Querying users. Target Branch: '${branch}', Target Sem: '${yearSem}'`);

    const q = query(collection(db, 'users'), where('role', '==', 'student'));
    const snapshot = await getDocs(q);

    const list: { email: string; name: string; id: string }[] = [];
    const normalize = (str: string | undefined | null) => str ? str.toLowerCase().replace(/\s+/g, '').trim() : '';

    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.email) return;

      // Robust Filtering Logic (Matching StudentDashboard/useActivities)

      // Branch Check
      const userBranch = normalize(data.branch);
      const targetBranchNorm = normalize(branch);
      const branchMatch = !branch || branch === 'All' || targetBranchNorm === 'all' || userBranch === targetBranchNorm;

      // Semester Check
      // Normalize both sides by removing () and spaces
      const userSem = normalize(data.semester?.replace(/[()]/g, ''));
      const targetSem = normalize(yearSem?.replace(/[()]/g, ''));
      const semMatch = !yearSem || yearSem === 'All' || targetSem === 'all' || userSem === targetSem;

      if (branchMatch && semMatch) {
        list.push({
          email: data.email,
          name: data.full_name || 'Student',
          id: doc.id
        });
      } else {
        // Optional Debug: Log why a student was skipped (uncomment if debugging specific student)
        // console.log(`Skipping ${data.full_name}: BranchMatch=${branchMatch} (${userBranch} vs ${targetBranchNorm}), SemMatch=${semMatch} (${userSem} vs ${targetSem})`);
      }
    });

    console.log(`[getRecipientsFromDB] Matched ${list.length} students out of ${snapshot.size} total students.`);
    return list;
  };

  const fetchRecipients = async () => {
    setIsFetchingEmails(true);
    console.log(`[CreateActivity] Fetching recipients. Branch: ${notifyBranch}, YearSem: ${notifyYearSem}`);
    try {
      const list = await getRecipientsFromDB(notifyBranch, notifyYearSem);
      setRecipientList(list);

      if (list.length === 0) {
        toast({ title: 'No recipients found', description: `No active recipients found for ${notifyBranch} (Year/Sem: ${notifyYearSem})`, variant: 'warning' });
      } else {
        toast({ title: 'Recipients updated', description: `Found ${list.length} recipients.` });
      }
    } catch (error: any) {
      console.error('Error fetching students:', error);
      toast({
        title: 'Error fetching recipients',
        description: error.message || 'Unknown error. Check console for details.',
        variant: 'destructive'
      });
    } finally {
      setIsFetchingEmails(false);
    }
  };

  const addManualEmail = () => {
    if (!manualEmail) return;
    setRecipientList([...recipientList, { email: manualEmail, name: 'External', id: crypto.randomUUID() }]);
    setManualEmail('');
  };

  const removeRecipient = (id: string) => {
    setRecipientList(recipientList.filter(r => r.id !== id));
  };

  useEffect(() => {
    // Auto-fetch logic removed to prevent overwriting manual changes unless explicitly requested
  }, [notifyBranch, notifyYearSem]);

  const handleCreateSubject = async () => {
    const trimmedSubject = newSubject.trim();
    if (!trimmedSubject) return;

    if (subjects.some(s => s.name.toLowerCase() === trimmedSubject.toLowerCase())) {
      toast({ title: 'Duplicate Subject', description: 'This subject already exists.', variant: 'destructive' });
      return;
    }

    try {
      const data = await createSubject.mutateAsync({ name: trimmedSubject });
      toast({ title: 'Subject created', description: `"${trimmedSubject}" has been added.` });
      // Wait for query invalidation to propagate? 
      // Ideally we shouldn't rely on timing, but react-query usually handles this fast.
      setSubjectId(data.id);
      setNewSubject('');
    } catch (error: any) {
      console.error('Failed to create subject:', error);
      toast({ title: 'Error creating subject', description: error.message || 'Unknown error', variant: 'destructive' });
    }
  };

  // --- Edit Mode Logic ---
  const { activityId } = useParams<{ activityId?: string }>(); // Check if route param exists
  const isEditMode = !!activityId;
  const { data: existingActivity, isLoading: isLoadingActivity } = useActivity(activityId || '');
  const { updateActivityWithQuestions } = useActivities();

  useEffect(() => {
    if (isEditMode && existingActivity) {
      setTitle(existingActivity.title);
      setDescription(existingActivity.description || '');
      setInstructions(existingActivity.instructions || '');
      setSubjectId(existingActivity.subject_id);
      setDeadline(existingActivity.deadline || '');

      const type = existingActivity.activity_type || 'mixed';
      if (['mixed', 'mcq', 'code_completion'].includes(type)) { // Basic known types we might want to support specifically or just 'mixed'
        setActivityType(type);
      } else {
        setActivityType('custom');
        setCustomActivityType(type);
      }

      // Parse deadline for 12h picker
      if (existingActivity.deadline) {
        const dateObj = new Date(existingActivity.deadline);
        if (!isNaN(dateObj.getTime())) {
          setDatePart(existingActivity.deadline.split('T')[0]); // YYYY-MM-DD
          let h = dateObj.getHours();
          const m = dateObj.getMinutes();
          const ampm = h >= 12 ? 'PM' : 'AM';
          h = h % 12;
          h = h ? h : 12; // the hour '0' should be '12'
          setHourPart(h.toString());
          setMinutePart(m.toString().padStart(2, '0'));
          setAmpmPart(ampm);
        }
      }

      setTargetBranch(existingActivity.target_branch || 'All');
      setTargetYearSemester(`${existingActivity.target_year || 'All'}/${existingActivity.target_semester || 'All'}`); // Imperfect reconstruction but works if format matches
      // Adjust reconstructed Year/Sem to match dropdown value format "(Y/S)" or "All"
      if (existingActivity.target_year && existingActivity.target_year !== 'All') {
        setTargetYearSemester(`(${existingActivity.target_year}/${existingActivity.target_semester})`);
      } else {
        setTargetYearSemester('All');
      }

      setIsPublished(existingActivity.is_published);

      // Reconstitute Sections and Questions
      // Assuming sections are stored in activity doc. If not, we might need to infer from questions or defaults.
      // Current hooks save sections in activity doc.
      if (existingActivity.sections && existingActivity.sections.length > 0) {
        setSections(existingActivity.sections);
      } else {
        // Fallback if no sections stored (legacy?)
        setSections([{ id: crypto.randomUUID(), title: 'Part A', description: '', order: 0 }]);
      }

      if (existingActivity.questions) {
        // Map Check: Ensure structure matches QuestionForm
        const mappedQuestions: QuestionForm[] = existingActivity.questions.map(q => ({
          ...q,
          options: q.question_options?.map(o => ({ id: o.id, option_text: o.option_text, is_correct: o.is_correct }))
            || q.options // Fallback if still stored on doc
            || [],
        }));
        setQuestions(mappedQuestions);
      }
    }
  }, [isEditMode, existingActivity]);


  // Sync 12h parts to deadline string
  useEffect(() => {
    if (!datePart) {
      setDeadline('');
      return;
    }
    let h = parseInt(hourPart);
    if (ampmPart === 'PM' && h !== 12) h += 12;
    if (ampmPart === 'AM' && h === 12) h = 0;

    const hStr = h.toString().padStart(2, '0');
    const iso = `${datePart}T${hStr}:${minutePart}`;
    setDeadline(iso);
  }, [datePart, hourPart, minutePart, ampmPart]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({ title: 'Title required', description: 'Please enter an activity title.', variant: 'destructive' });
      return;
    }
    if (!subjectId) {
      toast({ title: 'Subject required', description: 'Please select a subject.', variant: 'destructive' });
      return;
    }
    if (questions.length === 0) {
      toast({ title: 'Questions required', description: 'Please add at least one question.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);

    let targetYearVal = 'All';
    let targetSemesterVal = 'All';

    if (targetYearSemester !== 'All') {
      const parts = targetYearSemester.replace(/[()]/g, '').split('/');
      if (parts.length === 2) {
        targetYearVal = parts[0];
        targetSemesterVal = parts[1];
      }
    }

    const commonData = {
      title,
      description,
      instructions,
      subject_id: subjectId,
      activity_type: activityType === 'custom' ? (customActivityType || 'Custom') : activityType,
      deadline: deadline || null,
      total_marks: totalMarks,
      is_published: isPublished,
      target_branch: targetBranch,
      target_year: targetYearVal,
      target_semester: targetSemesterVal,
      sections: sections.map((s, idx) => ({ ...s, order: idx })),
    };

    try {
      if (isEditMode && activityId) {
        // --- UPDATE ---
        if (isPublished) {
          const confirmed = window.confirm("This activity is PUBLISHED. Editing it might affect existing submissions or analytics. Are you sure?");
          if (!confirmed) {
            setSaving(false);
            return;
          }
        }

        await updateActivityWithQuestions.mutateAsync({
          activityId: activityId,
          activityData: commonData,
          questions: questions.map((q) => {
            if (q.question_type === 'mcq' && !q.correct_answer) {
              const correctOpt = q.options?.find(o => o.is_correct);
              if (correctOpt) {
                return { ...q, correct_answer: correctOpt.option_text };
              }
            }
            return q;
          })
        });

        // Check if status changed from Draft -> Published
        if (existingActivity && !existingActivity.is_published && isPublished) {
          await triggerNotification(activityId);
        }

        toast({ title: 'Activity Updated', description: 'Changes have been saved successfully.' });
      } else {
        // --- CREATE ---
        const newActivity = await createActivity.mutateAsync({
          ...commonData,
          questions: questions.map((q) => {
            // For MCQs, ensure correct_answer is populated with the text of the correct option
            if (q.question_type === 'mcq' && !q.correct_answer) {
              const correctOpt = q.options?.find(o => o.is_correct);
              if (correctOpt) {
                return { ...q, correct_answer: correctOpt.option_text };
              }
            }
            return q;
          }),
          notification_email: undefined
        });

        if (isPublished) {
          await triggerNotification(newActivity.id);
        }

        toast({ title: 'Activity created!', description: isPublished ? 'Your activity is now live.' : 'Saved as draft.' });
      }

      navigate('/teacher');
    } catch (error: any) {
      console.error(error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  // Helper to deduplicate notification logic
  const triggerNotification = async (actId: string) => {
    if (!notificationEnabled) return;

    // Auto-fetch if list is empty but filters are set
    let finalRecipients = recipientList;
    if (finalRecipients.length === 0) {
      console.log("Recipient list empty, attempting auto-fetch before sending...");
      try {
        finalRecipients = await getRecipientsFromDB(notifyBranch, notifyYearSem);
        setRecipientList(finalRecipients);
      } catch (e) {
        console.error("Auto-fetch failed", e);
      }
    }

    console.log(`[CreateActivity] Triggering notification for ${finalRecipients.length} recipients.`);

    if (finalRecipients.length === 0) {
      console.warn("[CreateActivity] No recipients to notify. Skipping.");
      toast({ title: 'Notification Skipped', description: 'No recipients selected.', variant: 'warning' });
      return;
    }

    try {
      const subjectObj = subjects.find(s => s.id === subjectId);
      const subjectName = subjectObj ? subjectObj.name : 'General';

      // Format date for user friendly display
      const publishDate = new Date().toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric'
      });

      const formattedDeadline = deadline
        ? new Date(deadline).toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
        : "No Deadline";

      console.log("[CreateActivity] Sending request to /api/notify...");

      const response = await fetch(`${API_BASE_URL}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: finalRecipients,
          quizDetails: {
            title: title,
            subject: subjectName,
            branch: targetBranch,
            year: targetYearSemester !== 'All' ? targetYearSemester.split('/')[0].replace('(', '') : 'All',
            semester: targetYearSemester !== 'All' ? targetYearSemester.split('/')[1].replace(')', '') : 'All',
            link: `${window.location.origin}/student/activity/${actId}`,
            publishDate: publishDate,
            deadline: formattedDeadline,
            facultyName: profile?.full_name || 'Faculty'
          },
          customSubject: customSubject,
          customMessage: customMessage
        })
      });

      const result = await response.json();

      if (result.success) {
        const sentCount = result.results?.success || 0;
        const failedCount = result.results?.failed || 0;

        if (sentCount > 0) {
          toast({
            title: 'Notification Sent',
            description: `Successfully emailed ${sentCount} students.${failedCount > 0 ? ` (${failedCount} failed)` : ''}`
          });
        } else {
          toast({
            title: 'Notification Issue',
            description: 'Server processed request but 0 emails were sent. Check server logs for details.',
            variant: 'destructive'
          });
        }
      } else {
        console.error(result);
        toast({ title: 'Notification Failed', description: result.message || 'Server returned error.', variant: 'destructive' });
      }
    } catch (e: any) {
      console.error("Failed to send notification", e);
      toast({ title: 'Connection Error', description: 'Could not reach notification server. Is it running?', variant: 'destructive' });
    }
  };

  if (authLoading || (isEditMode && isLoadingActivity)) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (authLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate('/teacher')} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-sm font-medium">Total Marks</div>
              <div className="text-2xl font-bold text-primary">{questions.reduce((sum, q) => sum + (q.marks || 0), 0)}</div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Column: Sections & Questions */}
            <div className="lg:col-span-2 space-y-8">

              {/* Activity Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Activity Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input id="title" placeholder="e.g., Final Exam" value={title} onChange={(e) => setTitle(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Textarea id="description" placeholder="Brief description..." value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Activity Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Activity Type</Label>
                    <Select value={activityType} onValueChange={setActivityType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mixed">Mixed Activity (Default)</SelectItem>
                        <SelectItem value="custom">Custom Type...</SelectItem>
                        {/* We can add other strict types if needed, but Mixed covers most generic usecases */}
                      </SelectContent>
                    </Select>
                  </div>
                  {activityType === 'custom' && (
                    <div className="space-y-2">
                      <Label>Custom Type Name</Label>
                      <Input
                        placeholder="e.g. Lab Exam, Quiz, Hackathon..."
                        value={customActivityType}
                        onChange={(e) => setCustomActivityType(e.target.value)}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Notification Setup Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Notification Setup</span>
                    <Switch
                      checked={notificationEnabled}
                      onCheckedChange={setNotificationEnabled}
                    />
                  </CardTitle>
                </CardHeader>
                {notificationEnabled && (
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Notification Filters */}
                      <div className="space-y-2">
                        <Label>Recipient Branch</Label>
                        <Select value={notifyBranch} onValueChange={setNotifyBranch}>
                          <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>
                          <SelectContent>
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
                      <div className="space-y-2">
                        <Label>Recipient Year/Sem</Label>
                        <Select value={notifyYearSem} onValueChange={setNotifyYearSem}>
                          <SelectTrigger><SelectValue placeholder="Year/Sem" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="All">All Year/Sem</SelectItem>
                            {/* Assuming standard format stored in DB or required by user */}
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

                    <div className="flex items-center gap-4">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={fetchRecipients}
                        disabled={isFetchingEmails}
                      >
                        {isFetchingEmails ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Users className="h-4 w-4 mr-2" />}
                        Preview Recipient List ({recipientList.length})
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowRecipientPreview(!showRecipientPreview)}
                        disabled={recipientList.length === 0}
                      >
                        {showRecipientPreview ? 'Hide List' : 'View List'}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="ml-auto"
                        onClick={async () => {
                          try {
                            const res = await fetch(`${API_BASE_URL}/api/health`);
                            if (res.ok) {
                              const data = await res.json();
                              toast({ title: "Connection OK", description: `Server online at ${data.time}` });
                            } else {
                              toast({ title: "Connection Failed", description: `Status: ${res.status}`, variant: "destructive" });
                            }
                          } catch (e: any) {
                            toast({ title: "Connection Error", description: `Could not reach ${API_BASE_URL || 'server'}. Is server running?`, variant: "destructive" });
                          }
                        }}
                      >
                        Test Server Connection
                      </Button>
                    </div>

                    {showRecipientPreview && (
                      <div className="space-y-2 border rounded-md p-2">
                        <div className="flex items-center gap-2 mb-2">
                          <Input
                            placeholder="Add extra email..."
                            value={manualEmail}
                            onChange={(e) => setManualEmail(e.target.value)}
                            className="h-8"
                          />
                          <Button type="button" size="sm" variant="ghost" onClick={addManualEmail}><Plus className="h-4 w-4" /></Button>
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {recipientList.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No recipients yet.</p>}
                          {recipientList.map(student => (
                            <div key={student.id} className="text-sm flex justify-between items-center px-2 py-1 hover:bg-muted/50 rounded group">
                              <div className="flex flex-col">
                                <span>{student.name}</span>
                                <span className="text-muted-foreground text-xs">{student.email}</span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                                onClick={() => removeRecipient(student.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 pt-4 border-t">
                      <Label>Email Subject</Label>
                      <Input
                        placeholder="New Assessment Published"
                        value={customSubject}
                        onChange={(e) => setCustomSubject(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Email Message</Label>
                      <Textarea
                        placeholder={`Hello {{student_name}},

A new activity has been published for your class.

Activity Name : {{Activity_Name}}
Subject       : {{Subject}}
Branch        : {{Branch}}
Year          : {{Year}}
Semester      : {{Semester}}
Published On  : {{Publish_Date}}
Deadline      : {{Deadline}}

Please log in to the Origin Trivia platform and complete the activity within the given time.
https://origin-trivia.netlify.app/

Login Details:
Email    : Your college mail ID
Password : Your SIN number (in capital)

If you have any questions, contact your faculty.

Best regards,
{{Faculty_Name}}
Origin Trivia Team`}
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        rows={10}
                      />
                      <p className="text-xs text-muted-foreground">Supported tags: &#123;&#123;student_name&#125;&#125;, &#123;&#123;Activity_Name&#125;&#125;, &#123;&#123;Subject&#125;&#125;, &#123;&#123;Branch&#125;&#125;, &#123;&#123;Year&#125;&#125;, &#123;&#123;Semester&#125;&#125;, &#123;&#123;Publish_Date&#125;&#125;, &#123;&#123;Deadline&#125;&#125;, &#123;&#123;Faculty_Name&#125;&#125;</p>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Sections List */}
              <div className="space-y-6">
                {sections.map((section, sIdx) => (
                  <Card key={section.id} className="border-l-4 border-l-primary/50">
                    <CardHeader className="bg-muted/30 pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 gap-2 flex items-center">
                          <Badge variant="outline" className="h-6 w-6 flex items-center justify-center rounded-full p-0">
                            {String.fromCharCode(65 + sIdx)}
                          </Badge>
                          <Input
                            value={section.title}
                            onChange={(e) => updateSection(section.id, { title: e.target.value })}
                            className="font-bold h-8 border-transparent hover:border-border focus:border-input bg-transparent w-[200px]"
                          />
                          <Input
                            placeholder="Section Description (optional)"
                            value={section.description}
                            onChange={(e) => updateSection(section.id, { description: e.target.value })}
                            className="text-sm text-muted-foreground h-8 border-transparent hover:border-border focus:border-input bg-transparent flex-1"
                          />
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeSection(section.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">

                      {/* Questions in Section */}
                      {questions.filter(q => q.section_id === section.id).map((question, qIdx) => (
                        <div key={question.id} className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="grid gap-4 flex-1">
                              <div className="flex gap-4">
                                {/* Type Selector */}
                                <div className="w-[180px]">
                                  <Label className="text-xs text-muted-foreground mb-1 block">Type</Label>
                                  <Select
                                    value={question.question_type}
                                    onValueChange={(val) => updateQuestion(question.id, { question_type: val as ActivityType })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {activityTypes.map(t => (
                                        <SelectItem key={t.value} value={t.value}>
                                          <div className="flex items-center gap-2">
                                            <t.icon className="h-4 w-4" />
                                            {t.label}
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Marks */}
                                <div className="w-[100px]">
                                  <Label className="text-xs text-muted-foreground mb-1 block">Marks</Label>
                                  <Input
                                    type="number" min={1}
                                    value={question.marks}
                                    onChange={(e) => updateQuestion(question.id, { marks: parseInt(e.target.value) || 0 })}
                                  />
                                </div>


                                {/* AI Evaluation Toggle */}
                                <div className="flex flex-col items-center justify-center space-y-2 mt-1">
                                  <Label className="text-xs text-muted-foreground">AI Evaluation</Label>
                                  <div className="flex items-center space-x-2">
                                    <Switch
                                      checked={question.evaluation_mode === 'ai'}
                                      onCheckedChange={(checked) => updateQuestion(question.id, { evaluation_mode: checked ? 'ai' : 'auto' })}
                                    />
                                    {question.evaluation_mode === 'ai' ? (
                                      <Badge variant="default" className="bg-indigo-500 hover:bg-indigo-600 gap-1">
                                        <Bot className="h-3 w-3" /> AI
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary">Exact</Badge>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Question Text */}
                              <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">Question Text</Label>
                                <Textarea
                                  placeholder="Enter question..."
                                  value={question.question_text || ''}
                                  onChange={(e) => updateQuestion(question.id, { question_text: e.target.value })}
                                />
                              </div>

                              {/* Type Specific Fields */}
                              {['mcq', 'checkbox', 'dropdown'].includes(question.question_type) && (
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Options</Label>
                                    {question.options.map((opt, optIdx) => (
                                      <div key={opt.id} className="flex items-center gap-2">
                                        <input
                                          type={question.question_type === 'checkbox' ? 'checkbox' : 'radio'}
                                          name={`q-${question.id}`}
                                          checked={opt.is_correct}
                                          onChange={() => updateOption(question.id, opt.id, { is_correct: !opt.is_correct })}
                                          className="h-4 w-4"
                                        />
                                        <Input
                                          value={opt.option_text}
                                          onChange={(e) => updateOption(question.id, opt.id, { option_text: e.target.value })}
                                          placeholder={`Option ${optIdx + 1}`}
                                          className="flex-1 h-9"
                                        />
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(question.id, opt.id)} className="h-8 w-8">
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ))}
                                    <Button type="button" variant="outline" size="sm" onClick={() => addOption(question.id)} className="w-full mt-2 border-dashed">
                                      <Plus className="h-3 w-3 mr-2" /> Add Option
                                    </Button>
                                  </div>

                                  {question.question_type === 'mcq' && (
                                    <div className="space-y-2 pt-2 border-t">
                                      <Label className="text-xs text-muted-foreground">Exact Answer Text (Optional override)</Label>
                                      <Input
                                        value={question.correct_answer || ''}
                                        onChange={(e) => updateQuestion(question.id, { correct_answer: e.target.value })}
                                        placeholder="Auto-filled from correct option if left empty..."
                                      />
                                    </div>
                                  )}
                                </div>
                              )}

                              {['code_completion', 'output_prediction'].includes(question.question_type) && (
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">
                                      {question.question_type === 'code_completion' ? 'Code (use ___ for blanks)' : 'Code Snippet'}
                                    </Label>
                                    <Textarea
                                      className="font-mono bg-muted/50"
                                      rows={5}
                                      value={question.code_template || ''}
                                      onChange={(e) => updateQuestion(question.id, { code_template: e.target.value })}
                                    />
                                    {['output_prediction', 'code_completion'].includes(question.question_type) && (
                                      <div className="mt-2">
                                        <Label className="text-xs text-muted-foreground">
                                          {question.question_type === 'code_completion' ? 'Exact Expected Code' : 'Expected Output'}
                                        </Label>
                                        <Input
                                          value={question.correct_answer || ''}
                                          onChange={(e) => updateQuestion(question.id, { correct_answer: e.target.value })}
                                          placeholder={question.question_type === 'code_completion' ? "Full expected code..." : "Exact output string..."}
                                        />
                                      </div>
                                    )}
                                    {question.question_type === 'code_completion' && (
                                      <div className="space-y-4 border rounded-md p-3 bg-muted/20">
                                        <div className="flex justify-between items-center">
                                          <Label className="text-sm font-medium">Blanks Configuration</Label>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => extractBlanks(question.id, question.code_template)}
                                            className="h-8 gap-2"
                                          >
                                            <RefreshCw className="h-3 w-3" /> Update Blanks from Code
                                          </Button>
                                        </div>

                                        <p className="text-xs text-muted-foreground">
                                          Write code with <code>&#123;&#123;answer&#125;&#125;</code> to define blanks.
                                          Click "Update Blanks" to generate the list below.
                                        </p>

                                        {question.blanks && question.blanks.length > 0 && (
                                          <div className="space-y-2">
                                            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground mb-1 px-2">
                                              <div className="col-span-1">#</div>
                                              <div className="col-span-8">Correct Answer</div>
                                              <div className="col-span-3">Marks</div>
                                            </div>
                                            {question.blanks.map((blank, idx) => (
                                              <div key={blank.id} className="grid grid-cols-12 gap-2 items-center px-2 py-1 bg-card rounded border">
                                                <div className="col-span-1 text-xs text-muted-foreground">{idx + 1}</div>
                                                <div className="col-span-8">
                                                  <Input
                                                    value={blank.correct_answers[0] || ''}
                                                    onChange={(e) => updateBlank(question.id, blank.id, { correct_answers: [e.target.value] })}
                                                    className="h-7 text-sm font-mono"
                                                  />
                                                </div>
                                                <div className="col-span-3">
                                                  <Input
                                                    type="number"
                                                    value={blank.marks}
                                                    onChange={(e) => updateBlank(question.id, blank.id, { marks: parseInt(e.target.value) || 0 })}
                                                    className="h-7 text-sm"
                                                  />
                                                </div>
                                              </div>
                                            ))}
                                            <div className="text-right text-xs text-muted-foreground mt-2">
                                              Total Marks: {question.blanks.reduce((s, b) => s + b.marks, 0)}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {['short_answer', 'fill_blanks', 'numerical'].includes(question.question_type) && (
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">{question.question_type === 'numerical' ? 'Correct Value (Exact)' : 'Correct Answer'}</Label>
                                    <Input
                                      value={question.correct_answer}
                                      onChange={(e) => updateQuestion(question.id, { correct_answer: e.target.value })}
                                      placeholder={question.question_type === 'numerical' ? "e.g. 42" : "Exact expected answer..."}
                                    />
                                  </div>

                                  {question.question_type === 'numerical' && (
                                    <div className="grid grid-cols-3 gap-4">
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Tolerance (+/-)</Label>
                                        <Input
                                          type="number"
                                          placeholder="e.g. 0.5"
                                          value={question.allowed_error || ''}
                                          onChange={(e) => updateQuestion(question.id, { allowed_error: parseFloat(e.target.value) || 0 })}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Min Value (Range)</Label>
                                        <Input
                                          type="number"
                                          placeholder="Optional"
                                          value={question.range_min || ''}
                                          onChange={(e) => updateQuestion(question.id, { range_min: parseFloat(e.target.value) || undefined })}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Max Value (Range)</Label>
                                        <Input
                                          type="number"
                                          placeholder="Optional"
                                          value={question.range_max || ''}
                                          onChange={(e) => updateQuestion(question.id, { range_max: parseFloat(e.target.value) || undefined })}
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {question.question_type === 'fill_blanks' && (
                                    <p className="text-xs text-muted-foreground">For multiple valid answers, separate them with commas (e.g. "print, system.out.println").</p>
                                  )}
                                </div>
                              )}

                              {['short_answer', 'justification', 'trace_execution', 'paragraph'].includes(question.question_type) && (
                                <div className="space-y-4 pt-2 border-t">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground">Evaluation Details</Label>
                                  </div>

                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">
                                      {question.question_type === 'justification' ? 'Sample Justification (Model Answer)' : 'Model Answer (for AI Comparison)'}
                                    </Label>
                                    <Textarea
                                      value={question.model_answer || ''}
                                      onChange={(e) => updateQuestion(question.id, { model_answer: e.target.value })}
                                      placeholder="Enter the ideal answer..."
                                      rows={2}
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Expected Keywords (AI: Full marks if any match)</Label>
                                    <Input
                                      value={question.expected_keywords?.join(', ') || ''}
                                      onChange={(e) => updateQuestion(question.id, { expected_keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                      placeholder="e.g. polymorphism, inheritance, dynamic binding (comma separated)"
                                    />
                                  </div>
                                </div>
                              )}

                              {question.question_type === 'trace_execution' && (
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Code / Scenario</Label>
                                    <Textarea
                                      className="font-mono bg-muted/50"
                                      rows={5}
                                      value={question.code_template || ''}
                                      onChange={(e) => updateQuestion(question.id, { code_template: e.target.value })}
                                      placeholder="Enter code or scenario to trace..."
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Expected Execution Flow</Label>
                                    <Textarea
                                      value={question.model_answer || ''} // Reusing model_answer for flow steps
                                      onChange={(e) => updateQuestion(question.id, { model_answer: e.target.value })}
                                      placeholder="Step 1: ... &#10;Step 2: ..."
                                      rows={3}
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Error Handling Types */}
                              {['error_identification', 'error_correction'].includes(question.question_type) && (
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Faulty Code</Label>
                                    <Textarea
                                      className="font-mono bg-muted/50"
                                      rows={4}
                                      value={question.faulty_code || ''}
                                      onChange={(e) => updateQuestion(question.id, { faulty_code: e.target.value })}
                                      placeholder="Enter code with errors..."
                                    />
                                  </div>
                                  {question.question_type === 'error_identification' && (
                                    <>
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Expected Error Description</Label>
                                        <Input
                                          value={question.error_description || ''}
                                          onChange={(e) => updateQuestion(question.id, { error_description: e.target.value })}
                                          placeholder="e.g. 'Syntax error on line 3'"
                                        />
                                      </div>
                                      <div className="space-y-2 w-[150px]">
                                        <Label className="text-xs text-muted-foreground">Error Line Number</Label>
                                        <Input
                                          type="number"
                                          value={question.error_line_number || ''}
                                          onChange={(e) => updateQuestion(question.id, { error_line_number: parseInt(e.target.value) || undefined })}
                                          placeholder="e.g. 3"
                                        />
                                      </div>
                                    </>
                                  )}
                                  {question.question_type === 'error_correction' && (
                                    <div className="space-y-2">
                                      <Label className="text-xs text-muted-foreground">Corrected Code</Label>
                                      <Textarea
                                        className="font-mono bg-muted/50"
                                        rows={4}
                                        value={question.correction_code || ''}
                                        onChange={(e) => updateQuestion(question.id, { correction_code: e.target.value })}
                                        placeholder="Enter the correct code..."
                                      />
                                    </div>
                                  )}
                                </div>
                              )}

                              {question.question_type === 'concept_identification' && (
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Code Snippet (containing the concept)</Label>
                                    <Textarea
                                      className="font-mono bg-muted/50"
                                      rows={4}
                                      value={question.code_template || ''}
                                      onChange={(e) => updateQuestion(question.id, { code_template: e.target.value })}
                                      placeholder="Enter code..."
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Exact Answer (Concept Name)</Label>
                                    <Input
                                      value={question.correct_answer || ''}
                                      onChange={(e) => updateQuestion(question.id, { correct_answer: e.target.value })}
                                      placeholder="e.g. Polymorphism"
                                    />
                                  </div>
                                </div>
                              )}

                              {question.question_type === 'file_upload' && (
                                <div className="space-y-2">
                                  <Label className="text-xs text-muted-foreground">Allowed File Types</Label>
                                  <Input
                                    value={question.allowed_file_types?.join(', ') || ''}
                                    onChange={(e) => updateQuestion(question.id, { allowed_file_types: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                    placeholder="e.g. .pdf, .docx, .png (comma separated)"
                                  />
                                  <p className="text-xs text-muted-foreground">Leave empty to allow all.</p>
                                </div>
                              )}

                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeQuestion(question.id)} className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      <Button type="button" variant="outline" onClick={() => addQuestion(section.id)} className="w-full border-dashed">
                        <Plus className="h-4 w-4 mr-2" /> Add Question to {section.title}
                      </Button>
                    </CardContent>
                  </Card>
                ))}

                <Button type="button" onClick={addSection} className="w-full py-6 text-lg border-2 border-dashed bg-transparent text-primary hover:bg-primary/5 border-primary/20">
                  <Layers className="h-5 w-5 mr-2" /> Add New Section
                </Button>
              </div>
            </div>

            {/* Sidebar */}
            < div className="space-y-6" >
              <Card>
                <CardHeader>
                  <CardTitle>Subject</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={subjectId} onValueChange={setSubjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Input placeholder="New Subject..." value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
                    <Button
                      type="button"
                      onClick={handleCreateSubject}
                      disabled={!newSubject.trim() || createSubject.isPending}
                      size="icon"
                    >
                      {createSubject.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Deadline</Label>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2 items-center">
                        <Input
                          type="date"
                          value={datePart}
                          onChange={(e) => setDatePart(e.target.value)}
                          className="flex-1"
                        />
                        <div className="flex gap-1">
                          <Select value={hourPart} onValueChange={setHourPart}>
                            <SelectTrigger className="w-[70px]">
                              <SelectValue placeholder="HH" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                                <SelectItem key={h} value={h.toString()}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={minutePart} onValueChange={setMinutePart}>
                            <SelectTrigger className="w-[70px]">
                              <SelectValue placeholder="MM" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')).map(m => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={ampmPart} onValueChange={setAmpmPart}>
                            <SelectTrigger className="w-[70px]">
                              <SelectValue placeholder="AM/PM" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AM">AM</SelectItem>
                              <SelectItem value="PM">PM</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {deadline && !isNaN(new Date(deadline).getTime()) && (
                        <p className="text-xs text-muted-foreground">
                          Preview: {new Date(deadline).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Target Branch</Label>
                    <Select value={targetBranch} onValueChange={setTargetBranch}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Branch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All Branches</SelectItem>
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

                  <div className="space-y-2">
                    <Label>Target Year/Semester</Label>
                    <Select value={targetYearSemester} onValueChange={setTargetYearSemester}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Year/Semester" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All Years/Semesters</SelectItem>
                        {['(1/1)', '(1/2)', '(2/3)', '(2/4)', '(3/5)', '(3/6)', '(4/7)', '(4/8)'].map(val => (
                          <SelectItem key={val} value={val}>{val}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Publish Now</Label>
                    <Switch checked={isPublished} onCheckedChange={setIsPublished} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 space-y-3">
                  <Button type="submit" className="w-full" disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isPublished ? (isEditMode ? 'Publish Changes' : 'Create & Publish') : 'Save as Draft')}
                  </Button>
                  <Button type="button" variant="outline" className="w-full" onClick={() => navigate('/teacher')}>Cancel</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </form >
      </main >
    </div >
  );
};

export default CreateActivity;
