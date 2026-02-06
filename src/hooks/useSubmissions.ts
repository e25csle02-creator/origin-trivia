import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, doc, addDoc, getDoc, getDocs, updateDoc, setDoc, query, where, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

interface Submission {
  id: string;
  activity_id: string;
  student_id: string;
  status: 'in_progress' | 'submitted' | 'evaluated';
  total_score: number | null;
  feedback: string | null;
  submitted_at: string | null;
  evaluated_at: string | null;
  evaluated_by: string | null;
  created_at: string;
}

interface SubmissionAnswer {
  id: string;
  submission_id: string;
  question_id: string;
  answer_text: string | null;
  selected_option_id: string | null;
  file_url: string | null;
  score: number | null;
  feedback: string | null;
  is_correct: boolean | null;
  created_at: string;
}

export const useSubmissions = (activityId?: string) => {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();

  // Fetch submissions
  const { data: submissions = [], isLoading, error } = useQuery({
    queryKey: ['submissions', activityId, role],
    queryFn: async () => {
      let q = query(collection(db, 'submissions'), orderBy('created_at', 'desc'));

      if (activityId) {
        q = query(q, where('activity_id', '==', activityId));
      }

      if (role === 'student') {
        q = query(q, where('student_id', '==', user?.uid));
      }

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Submission[];
    },
    enabled: !!user,
  });

  // Create or get existing submission
  const startSubmission = useMutation({
    mutationFn: async (activityId: string) => {
      // Check existing
      const q = query(
        collection(db, 'submissions'),
        where('activity_id', '==', activityId),
        where('student_id', '==', user?.uid)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      }

      // Create new
      const docRef = await addDoc(collection(db, 'submissions'), {
        activity_id: activityId,
        student_id: user?.uid,
        status: 'in_progress',
        created_at: new Date().toISOString(),
      });

      return { id: docRef.id, activity_id: activityId, student_id: user?.uid, status: 'in_progress' };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
    },
  });

  // Submit answers
  const submitAnswers = useMutation({
    mutationFn: async ({
      submissionId,
      answers,
    }: {
      submissionId: string;
      answers: {
        question_id: string;
        answer_text?: string;
        selected_option_id?: string;
        file_url?: string;
        score?: number;
        feedback?: string;
      }[];
    }) => {
      const batch = writeBatch(db);

      answers.forEach(answer => {
        // Use composite ID to prevent duplicates: submissionId_questionId
        const answerId = `${submissionId}_${answer.question_id}`;
        const answerRef = doc(db, 'submissions', submissionId, 'answers', answerId);

        batch.set(answerRef, {
          submission_id: submissionId,
          question_id: answer.question_id,
          answer_text: answer.answer_text || null,
          selected_option_id: answer.selected_option_id || null,
          file_url: answer.file_url || null,
          score: answer.score !== undefined ? answer.score : null,
          feedback: answer.feedback || null,
          created_at: new Date().toISOString()
        }, { merge: true });
      });

      // Update submission status
      const submissionRef = doc(db, 'submissions', submissionId);
      batch.update(submissionRef, {
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      });

      await batch.commit();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
    },
  });

  // Evaluate submission (teacher only)
  const evaluateSubmission = useMutation({
    mutationFn: async ({
      submissionId,
      totalScore,
      feedback,
      answerScores,
    }: {
      submissionId: string;
      totalScore: number;
      feedback?: string;
      answerScores: { answerId: string; score: number; feedback?: string; is_correct?: boolean }[];
    }) => {
      const batch = writeBatch(db);

      // Update answers
      answerScores.forEach(scoreData => {
        // Note: answerId here must match the ID used in submitAnswers or be fetched first.
        // If the UI passes the correct ID from fetch, this works. 
        // In submitAnswers we used generic IDs? No, we used composite. 
        // Ideally fetch returns the ID.
        const answerRef = doc(db, 'submissions', submissionId, 'answers', scoreData.answerId);
        batch.update(answerRef, {
          score: scoreData.score,
          feedback: scoreData.feedback,
          is_correct: scoreData.is_correct
        });
      });

      // Update submission
      const submissionRef = doc(db, 'submissions', submissionId);
      batch.update(submissionRef, {
        status: 'evaluated',
        total_score: totalScore,
        feedback,
        evaluated_at: new Date().toISOString(),
        evaluated_by: user?.uid,
      });

      await batch.commit();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
    },
  });

  return {
    submissions,
    isLoading,
    error,
    startSubmission,
    submitAnswers,
    evaluateSubmission,
  };
};

export const useSubmission = (submissionId: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['submission', submissionId],
    queryFn: async () => {
      const submissionDoc = await getDoc(doc(db, 'submissions', submissionId));
      if (!submissionDoc.exists()) throw new Error('Submission not found');

      const submission = { id: submissionDoc.id, ...submissionDoc.data() } as Submission;

      const answersSnapshot = await getDocs(collection(db, 'submissions', submissionId, 'answers'));
      const answers = answersSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as SubmissionAnswer[];

      return {
        ...submission,
        answers,
      } as Submission & { answers: SubmissionAnswer[] };
    },
    enabled: !!user && !!submissionId,
  });
};
