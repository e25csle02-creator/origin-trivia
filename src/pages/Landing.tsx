import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Navbar } from '@/components/layout/Navbar';
import {
  GraduationCap,
  BookOpen,
  Users,
  CheckCircle,
  FileText,
  Code,
  PenTool,
  Upload,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import heroImage from '@/assets/hero-education.jpg';

const Landing = () => {
  const features = [
    {
      icon: BookOpen,
      title: 'Any Subject',
      description: 'Create activities for any subject - Java, Math, Physics, or anything else.',
    },
    {
      icon: Code,
      title: 'Multiple Question Types',
      description: 'MCQ, Code Completion, Fill in the Blanks, Short Answer, and File Upload.',
    },
    {
      icon: CheckCircle,
      title: 'Auto Evaluation',
      description: 'MCQs are auto-evaluated instantly. Manual grading for descriptive answers.',
    },
    {
      icon: Users,
      title: 'Built for Everyone',
      description: 'Works for schools, colleges, and any educational institution.',
    },
  ];

  const activityTypes = [
    { icon: CheckCircle, name: 'MCQ', color: 'bg-emerald-500' },
    { icon: Code, name: 'Code Completion', color: 'bg-blue-500' },
    { icon: PenTool, name: 'Fill in Blanks', color: 'bg-purple-500' },
    { icon: FileText, name: 'Short Answer', color: 'bg-amber-500' },
    { icon: Upload, name: 'File Upload', color: 'bg-rose-500' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-5" />
        <div className="container relative py-20 md:py-32">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              Activity-Based Learning Platform
            </div>
            <h1 className="mb-6 font-display text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl">
              Learn Smarter with{' '}
              <span className="text-gradient">Origin Trivia</span>
            </h1>
            <p className="mb-8 text-lg text-muted-foreground md:text-xl">
              Create engaging activities, evaluate student work, and track progress - all in one
              simple platform. Perfect for teachers and students.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link to="/signup">
                <Button size="lg" className="gap-2 text-base">
                  Get Started Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" size="lg" className="text-base">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>

          {/* Activity Types Pills */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-3">
            {activityTypes.map((type) => (
              <div
                key={type.name}
                className="flex items-center gap-2 rounded-full bg-card px-4 py-2 shadow-md transition-transform hover:scale-105"
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${type.color}`}>
                  <type.icon className="h-4 w-4 text-white" />
                </div>
                <span className="font-medium">{type.name}</span>
              </div>
            ))}
          </div>

          {/* Hero Image */}
          <div className="mt-12 mx-auto max-w-5xl">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <img
                src={heroImage}
                alt="Students and teachers engaged in digital learning"
                className="w-full h-auto"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t border-border bg-secondary/30 py-20">
        <div className="container">
          <div className="mb-12 text-center">
            <h2 className="mb-4 font-display text-3xl font-bold md:text-4xl">
              Everything You Need
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              A complete platform for activity-based learning and assessment.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="group border-border/50 bg-card/50 backdrop-blur transition-all hover:border-primary/30 hover:shadow-lg"
              >
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Role Section */}
      <section className="py-20">
        <div className="container">
          <div className="grid gap-8 md:grid-cols-2">
            {/* Teacher Card */}
            <Card className="relative overflow-hidden border-2 border-primary/20 bg-gradient-card">
              <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-primary/10" />
              <CardHeader className="relative">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <GraduationCap className="h-7 w-7" />
                </div>
                <CardTitle className="text-2xl">For Teachers</CardTitle>
                <CardDescription className="text-base">
                  Create and manage activities with ease
                </CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <ul className="mb-6 space-y-3">
                  {[
                    'Create activities for any subject',
                    'Multiple question types supported',
                    'Auto-evaluation for MCQs',
                    'View detailed reports and analytics',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/signup?role=teacher">
                  <Button className="w-full">Start Teaching</Button>
                </Link>
              </CardContent>
            </Card>

            {/* Student Card */}
            <Card className="relative overflow-hidden border-2 border-accent/20 bg-gradient-card">
              <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-accent/10" />
              <CardHeader className="relative">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Users className="h-7 w-7" />
                </div>
                <CardTitle className="text-2xl">For Students</CardTitle>
                <CardDescription className="text-base">
                  Learn and practice at your own pace
                </CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <ul className="mb-6 space-y-3">
                  {[
                    'Browse activities by subject',
                    'Submit answers before deadline',
                    'Get instant feedback on MCQs',
                    'Track your progress and scores',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-accent" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/signup?role=student">
                  <Button variant="outline" className="w-full border-accent text-accent hover:bg-accent hover:text-accent-foreground">
                    Start Learning
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-secondary/30 py-8">
        <div className="container">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary">
                <GraduationCap className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-display font-bold">Origin Trivia</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Origin Trivia. Built for education.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
