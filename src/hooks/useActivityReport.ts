import { useQuery } from '@tanstack/react-query';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export interface ReportRow {
    userId: string;
    student: {
        name: string;
        registerNumber: string;
        branch: string;
        semester: string;
        email: string;
    };
    submissionStatus: 'submitted' | 'not_submitted';
    submissionId?: string;
    submittedAt?: string;
    totalMarks?: number;
    questionMarks?: Record<string, number>; // questionId -> marks
}

export const useActivityReport = (activityId?: string) => {
    const { user } = useAuth();

    return useQuery({
        queryKey: ['activity-report', activityId],
        queryFn: async () => {
            if (!activityId) return { rows: [], questions: [] };

            // 1. Fetch Activity Details (to get target audience and questions)
            const activityDoc = await getDoc(doc(db, 'activities', activityId));
            if (!activityDoc.exists()) throw new Error('Activity not found');
            const activityData = activityDoc.data();

            // Fetch Questions (to map marks)
            const questionsSnapshot = await getDocs(collection(db, 'activities', activityId, 'questions'));
            const questions = questionsSnapshot.docs
                .map(d => ({ id: d.id, ...d.data() } as any))
                .sort((a, b) => a.order_index - b.order_index);

            // 2. Fetch Eligible Students (Target Audience)
            let studentsQuery = query(collection(db, 'users'), where('role', '==', 'student'));

            if (activityData.target_branch && activityData.target_branch !== 'All') {
                studentsQuery = query(studentsQuery, where('branch', '==', activityData.target_branch));
            }

            const studentsSnapshot = await getDocs(studentsQuery);
            let allStudents = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

            // Filter by semester/year if applicable (Robust Filtering)
            if (activityData.target_year && activityData.target_year !== 'All') {
                const target = activityData.target_year;
                allStudents = allStudents.filter(s => {
                    const sem = s.semester || '';
                    // Match "(3/" or just "3" 
                    return sem.includes(`(${target}/`) || sem.includes(target);
                });
            }
            if (activityData.target_semester && activityData.target_semester !== 'All') {
                const target = activityData.target_semester;
                allStudents = allStudents.filter(s => {
                    const sem = s.semester || '';
                    // Match "/5)" or just "5"
                    return sem.includes(`/${target})`) || sem.includes(target);
                });
            }


            // 3. Fetch All Submissions for this Activity
            const submissionsQuery = query(
                collection(db, 'submissions'),
                where('activity_id', '==', activityId)
            );
            const submissionsSnapshot = await getDocs(submissionsQuery);
            const submissions = submissionsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

            // 4. Fetch Answers for Marks Distribution (This might be heavy, optimized by doing parallel fetch)
            // We need answers to know marks per question.
            const submissionAnswersMap: Record<string, Record<string, number>> = {}; // submissionId -> { questionId: mark }

            await Promise.all(submissions.map(async (sub) => {
                const answersQ = await getDocs(collection(db, 'submissions', sub.id, 'answers'));
                const marks: Record<string, number> = {};
                answersQ.forEach(ansDoc => {
                    const ans = ansDoc.data();
                    if (ans.question_id && typeof ans.score === 'number') {
                        marks[ans.question_id] = ans.score;
                    }
                });
                submissionAnswersMap[sub.id] = marks;
            }));


            // 5. Build Report Rows
            const rows: ReportRow[] = [];
            const submittedStudentIds = new Set(submissions.map(s => s.student_id));

            // Add Submitted
            submissions.forEach(sub => {
                // Try finding by user_id OR id (fallback)
                const student = allStudents.find(s => s.user_id === sub.student_id || s.id === sub.student_id);

                rows.push({
                    userId: sub.student_id,
                    student: {
                        name: student?.full_name || 'Unknown User',
                        registerNumber: student?.register_number || 'N/A',
                        branch: student?.branch || 'N/A',
                        semester: student?.semester || 'N/A',
                        email: student?.email || 'N/A'
                    },
                    submissionStatus: 'submitted',
                    submissionId: sub.id,
                    submittedAt: sub.submitted_at,
                    totalMarks: sub.obtained_marks ?? sub.total_score ?? 0,
                    questionMarks: submissionAnswersMap[sub.id] || {}
                });
            });

            // Add Not Submitted (Only from eligible list)
            allStudents.forEach(student => {
                const uid = student.user_id || student.id; // Fallback to doc ID
                if (!submittedStudentIds.has(uid)) {
                    rows.push({
                        userId: uid,
                        student: {
                            name: student.full_name,
                            registerNumber: student.register_number || '-',
                            branch: student.branch || '-',
                            semester: student.semester || '-',
                            email: student.email || '-'
                        },
                        submissionStatus: 'not_submitted',
                    });
                }
            });

            return { rows, questions };
        },
        enabled: !!user && !!activityId,
    });
};
