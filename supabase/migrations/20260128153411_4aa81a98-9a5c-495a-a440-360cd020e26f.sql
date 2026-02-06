-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('teacher', 'student');

-- Create activity_type enum for different question types
CREATE TYPE public.activity_type AS ENUM ('mcq', 'code_completion', 'fill_blanks', 'short_answer', 'file_upload');

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

-- Create subjects table (dynamic, not hard-coded)
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create activities table
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  activity_type activity_type NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  deadline TIMESTAMP WITH TIME ZONE,
  total_marks INTEGER DEFAULT 100,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create questions table
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  question_type activity_type NOT NULL,
  marks INTEGER DEFAULT 10,
  correct_answer TEXT,
  order_index INTEGER DEFAULT 0,
  code_template TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create question_options table (for MCQ)
CREATE TABLE public.question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0
);

-- Create activity_submissions table
CREATE TABLE public.activity_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'evaluated')),
  total_score INTEGER,
  feedback TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  evaluated_at TIMESTAMP WITH TIME ZONE,
  evaluated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(activity_id, student_id)
);

-- Create submission_answers table
CREATE TABLE public.submission_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES public.activity_submissions(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  answer_text TEXT,
  selected_option_id UUID REFERENCES public.question_options(id) ON DELETE SET NULL,
  file_url TEXT,
  score INTEGER,
  feedback TEXT,
  is_correct BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(submission_id, question_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_answers ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function to get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own role on signup" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- RLS Policies for subjects
CREATE POLICY "Anyone can view subjects" ON public.subjects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Teachers can create subjects" ON public.subjects
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers can update their subjects" ON public.subjects
  FOR UPDATE TO authenticated USING (created_by = auth.uid() AND public.has_role(auth.uid(), 'teacher'));

-- RLS Policies for activities
CREATE POLICY "Anyone can view published activities" ON public.activities
  FOR SELECT TO authenticated USING (is_published = true OR created_by = auth.uid());

CREATE POLICY "Teachers can create activities" ON public.activities
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers can update own activities" ON public.activities
  FOR UPDATE TO authenticated USING (created_by = auth.uid() AND public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers can delete own activities" ON public.activities
  FOR DELETE TO authenticated USING (created_by = auth.uid() AND public.has_role(auth.uid(), 'teacher'));

-- RLS Policies for questions
CREATE POLICY "Anyone can view questions of accessible activities" ON public.questions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.activities 
      WHERE activities.id = questions.activity_id 
      AND (activities.is_published = true OR activities.created_by = auth.uid())
    )
  );

CREATE POLICY "Teachers can manage questions" ON public.questions
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.activities 
      WHERE activities.id = questions.activity_id 
      AND activities.created_by = auth.uid()
    )
  );

-- RLS Policies for question_options
CREATE POLICY "Anyone can view options of accessible questions" ON public.question_options
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.questions q
      JOIN public.activities a ON a.id = q.activity_id
      WHERE q.id = question_options.question_id
      AND (a.is_published = true OR a.created_by = auth.uid())
    )
  );

CREATE POLICY "Teachers can manage options" ON public.question_options
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.questions q
      JOIN public.activities a ON a.id = q.activity_id
      WHERE q.id = question_options.question_id
      AND a.created_by = auth.uid()
    )
  );

-- RLS Policies for activity_submissions
CREATE POLICY "Students can view own submissions" ON public.activity_submissions
  FOR SELECT TO authenticated USING (
    student_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.activities 
      WHERE activities.id = activity_submissions.activity_id 
      AND activities.created_by = auth.uid()
    )
  );

CREATE POLICY "Students can create submissions" ON public.activity_submissions
  FOR INSERT TO authenticated WITH CHECK (
    student_id = auth.uid() AND public.has_role(auth.uid(), 'student')
  );

CREATE POLICY "Students can update own in-progress submissions" ON public.activity_submissions
  FOR UPDATE TO authenticated USING (
    (student_id = auth.uid() AND status = 'in_progress') OR
    (public.has_role(auth.uid(), 'teacher') AND EXISTS (
      SELECT 1 FROM public.activities 
      WHERE activities.id = activity_submissions.activity_id 
      AND activities.created_by = auth.uid()
    ))
  );

-- RLS Policies for submission_answers
CREATE POLICY "Users can view own submission answers" ON public.submission_answers
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.activity_submissions s
      WHERE s.id = submission_answers.submission_id
      AND (s.student_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.activities a
        WHERE a.id = s.activity_id AND a.created_by = auth.uid()
      ))
    )
  );

CREATE POLICY "Students can insert own answers" ON public.submission_answers
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.activity_submissions s
      WHERE s.id = submission_answers.submission_id
      AND s.student_id = auth.uid()
      AND s.status = 'in_progress'
    )
  );

CREATE POLICY "Users can update submission answers" ON public.submission_answers
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.activity_submissions s
      WHERE s.id = submission_answers.submission_id
      AND (
        (s.student_id = auth.uid() AND s.status = 'in_progress') OR
        EXISTS (
          SELECT 1 FROM public.activities a
          WHERE a.id = s.activity_id AND a.created_by = auth.uid()
        )
      )
    )
  );

-- Create trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default subjects
INSERT INTO public.subjects (name, description) VALUES
  ('Java', 'Java Programming Language'),
  ('Python', 'Python Programming Language'),
  ('Mathematics', 'General Mathematics'),
  ('Physics', 'Physics and Applied Sciences'),
  ('DBMS', 'Database Management Systems'),
  ('English', 'English Language and Literature'),
  ('Data Structures', 'Data Structures and Algorithms'),
  ('Web Development', 'HTML, CSS, JavaScript and Frameworks');