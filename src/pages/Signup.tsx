import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GraduationCap, Loader2, Eye, EyeOff, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Signup = () => {
  const [searchParams] = useSearchParams();
  const defaultRole = searchParams.get('role') as 'teacher' | 'student' | null;

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'teacher' | 'student'>(defaultRole || 'student');

  // Student Details
  const [registerNumber, setRegisterNumber] = useState('');
  const [sinNo, setSinNo] = useState('');
  const [branch, setBranch] = useState('');
  const [semester, setSemester] = useState('');

  // Faculty Details
  const [handlingSubject, setHandlingSubject] = useState('');
  const [facultyDepartment, setFacultyDepartment] = useState(''); // Reusing "branch" field in DB
  const [facultyPasskey, setFacultyPasskey] = useState('');

  const branches = [
    'B.E-Computer Science & Engineering',
    'B.E-CSE (Cyber Security)',
    'B.E-Biomedical Engineering',
    'B.E- Electronics & Communication Engineering',
    'B.E-Mechanical Engineering',
    'B.Tech - Artificial Intelligence & Data Science',
    'B.Tech - Information Technology',
    'B.Tech - Agricultural Engineering',
  ];

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure your passwords match.',
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 6 characters.',
        variant: 'destructive',
      });
      return;
    }

    if (role === 'teacher' && facultyPasskey !== 'SSCET@2045') {
      toast({
        title: 'Invalid Faculty Passkey',
        description: 'Please enter the correct faculty passkey to sign up as a teacher.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    const { error } = await signUp(email, password, fullName, role, {
      registerNumber,
      sinNo,
      branch: role === 'student' ? branch : facultyDepartment,
      semester,
      handlingSubject,
    });

    if (error) {
      toast({
        title: 'Sign up failed',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Account created!',
        description: `Welcome to Origin Trivia as a ${role}.`,
      });
      navigate(role === 'teacher' ? '/teacher' : '/student');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-hero opacity-5" />

      <Card className="relative w-full max-w-md border-border/50 shadow-xl">
        <CardHeader className="text-center">
          <Link to="/" className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-primary">
            <GraduationCap className="h-7 w-7 text-primary-foreground" />
          </Link>
          <CardTitle className="font-display text-2xl">Create Account</CardTitle>
          <CardDescription>Join Origin Trivia today</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <Label>I am a</Label>
              <RadioGroup
                value={role}
                onValueChange={(value) => setRole(value as 'teacher' | 'student')}
                className="grid grid-cols-2 gap-4"
                disabled={loading}
              >
                <div>
                  <RadioGroupItem value="teacher" id="teacher" className="peer sr-only" />
                  <Label
                    htmlFor="teacher"
                    className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                  >
                    <GraduationCap className="mb-2 h-6 w-6" />
                    <span className="font-medium">Faculty</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="student" id="student" className="peer sr-only" />
                  <Label
                    htmlFor="student"
                    className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                  >
                    <Users className="mb-2 h-6 w-6" />
                    <span className="font-medium">Student</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">{role === 'teacher' ? 'Faculty Name' : 'Student Name'}</Label>
              <Input
                id="fullName"
                type="text"
                placeholder={role === 'teacher' ? 'e.g. Harsha S' : 'e.g. Harsha S'}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {/* Conditional Fields based on Role - Moved UP */}
            {role === 'student' && (
              <div className="space-y-4 border-t border-border pt-4">
                <p className="font-medium text-sm text-muted-foreground">Student Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="registerNumber">Register Number</Label>
                    <Input
                      id="registerNumber"
                      placeholder="e.g. 7327241040XX"
                      value={registerNumber}
                      onChange={(e) => setRegisterNumber(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sinNo">SIN No</Label>
                    <Input
                      id="sinNo"
                      placeholder="e.g. E24CS0XX"
                      value={sinNo}
                      onChange={(e) => setSinNo(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="branch">Programme/Branch</Label>
                    <Select value={branch} onValueChange={setBranch} disabled={loading}>
                      <SelectTrigger id="branch">
                        <SelectValue placeholder="Select Branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((b) => (
                          <SelectItem key={b} value={b}>
                            {b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="semester">Year/Semester</Label>
                    <Select value={semester} onValueChange={setSemester} disabled={loading}>
                      <SelectTrigger id="semester">
                        <SelectValue placeholder="Select Year/Semester" />
                      </SelectTrigger>
                      <SelectContent>
                        {['(1/1)', '(1/2)', '(2/3)', '(2/4)', '(3/5)', '(3/6)', '(4/7)', '(4/8)'].map((sem) => (
                          <SelectItem key={sem} value={sem}>
                            {sem}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {role === 'teacher' && (
              <div className="space-y-4 border-t border-border pt-4">
                <p className="font-medium text-sm text-muted-foreground">Faculty Details</p>
                <div className="space-y-2">
                  <Label htmlFor="handlingSubject">Handling Subject</Label>
                  <Input
                    id="handlingSubject"
                    placeholder="e.g. Object Oriented Programming"
                    value={handlingSubject}
                    onChange={(e) => setHandlingSubject(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facultyDepartment">Department</Label>
                  <Select value={facultyDepartment} onValueChange={setFacultyDepartment} disabled={loading}>
                    <SelectTrigger id="facultyDepartment">
                      <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CSE">Computer Science & Engineering</SelectItem>
                      <SelectItem value="ECE">Electronics & Communication</SelectItem>
                      <SelectItem value="MECH">Mechanical Engineering</SelectItem>
                      <SelectItem value="CIVIL">Civil Engineering</SelectItem>
                      <SelectItem value="IT">Information Technology</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facultyPasskey">Faculty Passkey</Label>
                  <Input
                    id="facultyPasskey"
                    type="password"
                    placeholder="Enter passkey"
                    value={facultyPasskey}
                    onChange={(e) => setFacultyPasskey(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            )}



            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="sin@shanmugha.edu.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;
