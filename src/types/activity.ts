export type ActivityType =
    | 'mcq'
    | 'code_completion'
    | 'fill_blanks'
    | 'short_answer'
    | 'file_upload'
    | 'paragraph'
    | 'checkbox'
    | 'dropdown'
    | 'numerical'
    | 'output_prediction'
    // New Types
    | 'trace_execution'
    | 'concept_identification'
    | 'justification'
    | 'error_identification'
    | 'error_correction';

export type EvaluationMode = 'auto' | 'ai' | 'manual';

export interface QuestionOption {
    id: string;
    option_text: string;
    is_correct: boolean;
}

export interface QuestionForm {
    id: string;
    section_id: string;
    question_text: string;
    question_type: ActivityType;
    marks: number;

    // Evaluation
    evaluation_mode: EvaluationMode;

    // MCQ / Checkbox / Dropdown
    options: QuestionOption[];

    // Simple Answers (Short, Fill Blanks, Numerical)
    correct_answer: string;

    // Code related (Completion, Output Prediction, Trace, Error)
    code_template: string; // The code snippet or "runnable" code

    // New Specialized Fields
    model_answer?: string; // For Justification / Short Answer AI grading
    explanation_rubric?: string; // For Justification / Trace

    // Code Completion specifics
    case_sensitive?: boolean;
    marks_per_blank?: number;

    // Error Identification/Correction
    faulty_code?: string;
    correction_code?: string; // The corrected version
    error_description?: string; // Description of the error (expected answer for ID)

    // Code Completion (structured blanks)
    // We can store blanks as a list if we want structured "Part 1 = X", "Part 2 = Y"
    // Or simple regex matching if embedded in text. 
    // For "Code Completion" usually it's "Fill the blank lines". 
    // Let's use a flexible map or array if needed, but for now `correct_answer` or `model_answer` might accept JSON or multiple lines.
    // Requirement says: "Mark missing lines using blanks... Define correct answer for EACH blank"

    // Missing Fields for Auto-Grading & New Types
    expected_keywords?: string[]; // For Auto-Grading (Subjective)
    range_min?: number; // For Numerical
    range_max?: number; // For Numerical
    allowed_error?: number; // For Numerical
    error_line_number?: number; // For Error ID
    allowed_file_types?: string[]; // For File Upload

    blanks?: {
        id: string;
        place_holder: string; // e.g. "BLANK_1"
        correct_answers: string[]; // Allow synonyms?
        marks: number;
    }[];
}

export interface SectionForm {
    id: string;
    title: string;
    description: string;
    order: number;
}
