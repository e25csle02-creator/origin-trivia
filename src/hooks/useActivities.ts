import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { ActivityType, QuestionForm, EvaluationMode, QuestionOption } from '@/types/activity';

interface Section {
  id: string;
  title: string;
  description?: string;
  order: number;
}

interface Activity {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  subject_id: string;
  activity_type: ActivityType | 'mixed';
  created_by: string;
  deadline: string | null;
  total_marks: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  sections?: Section[];
  subjects?: {
    id: string;
    name: string;
  };
  profiles?: {
    full_name: string;
  };
  target_branch?: string;
  target_year?: string;
  target_semester?: string;
  notification_email?: string;
}

// Reuse QuestionForm as base or map it
// QuestionForm from types/activity seems to be designed for the Form (frontend).
// Let's check if we should define a separate `Question` type for Firestore or reuse.
// The existing `Question` interface had `activity_id` etc.
// Let's extend QuestionForm or redefine compatible Question.

interface Question extends Omit<QuestionForm, 'options'> {
  activity_id: string;
  order_index: number;
  created_at: string;
  question_options?: (QuestionOption & { order_index: number })[];
}

interface CreateActivityData {
  title: string;
  description?: string;
  instructions?: string;
  subject_id: string;
  activity_type?: ActivityType | 'mixed';
  deadline?: string;
  total_marks?: number;
  is_published?: boolean;
  sections?: Section[];

  questions: QuestionForm[];
  target_branch?: string;
  target_year?: string;
  target_semester?: string;
  notification_email?: string;
}

export const useActivities = (subjectId?: string) => {
  const { user, role, profile } = useAuth();
  const queryClient = useQueryClient();

  // Fetch activities
  const { data: activities = [], isLoading, error } = useQuery({
    queryKey: ['activities', subjectId, role],
    queryFn: async () => {
      const activitiesRef = collection(db, 'activities');
      let q = query(activitiesRef);

      if (subjectId) {
        q = query(q, where('subject_id', '==', subjectId));
      }

      if (role === 'student' && user) {
        // If student, strict filter: 
        // 1. Published 
        // 2. target_branch is 'All' OR matches user's branch
        // NOTE: Firestore doesn't support logical OR directly in where clauses easily for different fields in one query without multiple queries.
        // Strategy: Fetch ALL published, then client-side filter for branch. 
        // Since activities count is expected to be moderate, this is acceptable.
        q = query(q, where('is_published', '==', true));
      } else if (role === 'teacher') {
        q = query(q, where('created_by', '==', user?.uid));
      } else {
        // Fallback/Guest
        q = query(q, where('is_published', '==', true));
      }

      const querySnapshot = await getDocs(q);
      let activitiesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Activity[];

      // Client-side filtering for students based on branch AND year/semester
      if (role === 'student' && profile) {
        activitiesData = activitiesData.filter(act => {
          // Branch Filter
          const branchMatch = !act.target_branch || act.target_branch === 'All' || act.target_branch === profile.branch;

          // Year/Semester Filter
          // Reconstruct the "(Y/S)" format from activity fields to compare with profile.semester which is stored as "(Y/S)"
          const activitySemString = `(${act.target_year}/${act.target_semester})`;
          const yearSemMatch = (!act.target_year || act.target_year === 'All') ||
            (profile.semester === activitySemString);

          return branchMatch && yearSemMatch;
        });
      }

      return activitiesData;
    },
    enabled: !!user,
  });

  // Create activity
  const createActivity = useMutation({
    mutationFn: async (activityData: CreateActivityData) => {
      // Create activity doc
      const activityRef = await addDoc(collection(db, 'activities'), {
        title: activityData.title,
        description: activityData.description || null,
        instructions: activityData.instructions || null,
        subject_id: activityData.subject_id,
        activity_type: activityData.activity_type || 'mixed',
        created_by: user?.uid,
        deadline: activityData.deadline || null,
        total_marks: activityData.total_marks || 100,
        is_published: activityData.is_published || false,
        sections: activityData.sections || [],
        target_branch: activityData.target_branch || 'All',
        target_year: activityData.target_year || 'All',
        target_semester: activityData.target_semester || 'All',
        notification_email: activityData.notification_email || null,
        publish_date: activityData.is_published ? new Date().toISOString() : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Create questions (and options embedded)
      const batch = writeBatch(db);

      for (let i = 0; i < activityData.questions.length; i++) {
        const q = activityData.questions[i];
        const questionRef = doc(collection(db, 'activities', activityRef.id, 'questions'));

        // Prepare question data with all new fields
        const questionData: any = {
          activity_id: activityRef.id,
          section_id: q.section_id || null,
          question_text: q.question_text,
          question_type: q.question_type,
          marks: q.marks,
          correct_answer: q.correct_answer || null,
          code_template: q.code_template || null,

          // New Fields
          evaluation_mode: q.evaluation_mode || 'manual',
          model_answer: q.model_answer || null,
          explanation_rubric: q.explanation_rubric || null,
          faulty_code: q.faulty_code || null,
          correction_code: q.correction_code || null,
          error_description: q.error_description || null,
          blanks: q.blanks || null,
          case_sensitive: q.case_sensitive || false,
          marks_per_blank: q.marks_per_blank || null,

          range_min: q.range_min || null,
          range_max: q.range_max || null,
          allowed_error: q.allowed_error || null,
          expected_keywords: q.expected_keywords || null,
          error_line_number: q.error_line_number || null,
          allowed_file_types: q.allowed_file_types || null,

          order_index: i,
          created_at: new Date().toISOString(),
          // Store options embedded in the question document for simplicity
          question_options: q.options?.map((opt, idx) => ({
            id: `opt_${idx}`, // Temporary ID if not provided, but QuestionForm usually has UUIDs
            question_id: questionRef.id,
            option_text: opt.option_text,
            is_correct: opt.is_correct,
            order_index: idx
          })) || []
        };

        // Remove undefined fields to avoid Firestore errors if any
        Object.keys(questionData).forEach(key => questionData[key] === undefined && delete questionData[key]);

        batch.set(questionRef, questionData);
      }

      await batch.commit();
      return { id: activityRef.id, ...activityData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });

  // Update activity
  const updateActivity = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Activity> & { id: string }) => {
      await updateDoc(doc(db, 'activities', id), {
        ...updates,
        updated_at: new Date().toISOString()
      });
      return { id, ...updates };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });

  // Delete activity
  const deleteActivity = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'activities', id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });

  // Update activity with questions (Full Edit)
  const updateActivityWithQuestions = useMutation({
    mutationFn: async ({ activityId, activityData, questions }: { activityId: string, activityData: Partial<Activity>, questions: QuestionForm[] }) => {
      // 1. Update Activity Doc
      const activityRef = doc(db, 'activities', activityId);
      await updateDoc(activityRef, {
        ...activityData,
        updated_at: new Date().toISOString()
      });

      // 2. Handle Questions
      const existingQuestionsSnapshot = await getDocs(collection(db, 'activities', activityId, 'questions'));
      const batch = writeBatch(db);

      // Map existing IDs
      const existingIds = new Set(existingQuestionsSnapshot.docs.map(d => d.id));
      const newIds = new Set(questions.map(q => q.id));

      // Delete removed questions
      existingQuestionsSnapshot.docs.forEach(d => {
        if (!newIds.has(d.id)) {
          batch.delete(doc(db, 'activities', activityId, 'questions', d.id));
        }
      });

      // Upsert new/updated questions
      questions.forEach((q, i) => {
        const questionRef = doc(db, 'activities', activityId, 'questions', q.id); // q.id should be preserved

        const questionData: any = {
          activity_id: activityId,
          section_id: q.section_id || null,
          question_text: q.question_text,
          question_type: q.question_type,
          marks: q.marks,
          correct_answer: q.correct_answer || null,
          code_template: q.code_template || null,
          evaluation_mode: q.evaluation_mode || 'manual',
          model_answer: q.model_answer || null,
          explanation_rubric: q.explanation_rubric || null,
          faulty_code: q.faulty_code || null,
          correction_code: q.correction_code || null,
          error_description: q.error_description || null,
          blanks: q.blanks || null,
          case_sensitive: q.case_sensitive || false,
          marks_per_blank: q.marks_per_blank || null,
          range_min: q.range_min || null,
          range_max: q.range_max || null,
          allowed_error: q.allowed_error || null,
          expected_keywords: q.expected_keywords || null,
          error_line_number: q.error_line_number || null,
          allowed_file_types: q.allowed_file_types || null,
          order_index: i,

          // Regenerate options
          question_options: q.options?.map((opt, idx) => ({
            id: opt.id,
            question_id: q.id,
            option_text: opt.option_text,
            is_correct: opt.is_correct,
            order_index: idx
          })) || []
        };
        // Remove undefined fields
        Object.keys(questionData).forEach(key => questionData[key] === undefined && delete questionData[key]);

        batch.set(questionRef, questionData, { merge: true });
      });

      await batch.commit();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['activity', 'details'] });
    }
  });

  return {
    activities,
    isLoading,
    error,
    createActivity,
    updateActivity,
    updateActivityWithQuestions,
    deleteActivity,
  };
};

export const useActivity = (activityId: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['activity', activityId],
    queryFn: async () => {
      // Get activity
      const activityDoc = await getDoc(doc(db, 'activities', activityId));
      if (!activityDoc.exists()) throw new Error('Activity not found');

      const activityData = { id: activityDoc.id, ...activityDoc.data() } as Activity;

      // Get questions subcollection
      const questionsSnapshot = await getDocs(
        query(collection(db, 'activities', activityId, 'questions'), orderBy('order_index'))
      );

      const questions = questionsSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Question[];

      return {
        ...activityData,
        questions,
      } as Activity & { questions: Question[] };
    },
    enabled: !!user && !!activityId,
  });
};
