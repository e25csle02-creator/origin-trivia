
export interface Activity {
    id: string;
    title: string;
    description: string;
    instructions?: string;
    subject_id: string; // references subjects table
    activity_type: ActivityType | 'mixed';
    sections: SectionForm[];
    questions: QuestionForm[];
    total_marks: number;
    deadline?: string;
    is_published: boolean;
    created_by: string; // teacher uid
    created_at: string;

    // New Fields
    target_branch?: string; // 'All', 'CSE', 'ECE', etc.
    notification_email?: string; // Email to notify upon publishing
    subjects?: { name: string, code: string }; // joined data
}
