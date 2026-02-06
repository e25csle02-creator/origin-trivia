import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

type UserRole = 'teacher' | 'student' | null;

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  register_number?: string | null;
  sin_no?: string | null;
  branch?: string | null;
  semester?: string | null;
  handling_subject?: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  role: UserRole;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: 'teacher' | 'student',
    additionalDetails?: {
      registerNumber?: string;
      sinNo?: string;
      branch?: string;
      semester?: string;
      handlingSubject?: string;
    }
  ) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data() as any;
        setProfile({
          id: userId,
          user_id: userId,
          full_name: userData.full_name,
          email: userData.email,
          avatar_url: userData.avatar_url || null,
          register_number: userData.register_number,
          sin_no: userData.sin_no,
          branch: userData.branch,
          semester: userData.semester,
          handling_subject: userData.handling_subject,
        });
        setRole(userData.role as UserRole);
      } else {
        setProfile(null);
        setRole(null);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchUserData(currentUser.uid);
      } else {
        setProfile(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    userRole: 'teacher' | 'student',
    additionalDetails?: {
      registerNumber?: string;
      sinNo?: string;
      branch?: string;
      semester?: string;
      handlingSubject?: string;
    }
  ) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create user profile in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        user_id: user.uid,
        full_name: fullName,
        email: email,
        role: userRole,
        register_number: additionalDetails?.registerNumber || null,
        sin_no: additionalDetails?.sinNo || null,
        branch: additionalDetails?.branch || null,
        semester: additionalDetails?.semester || null,
        handling_subject: additionalDetails?.handlingSubject || null,
        created_at: new Date().toISOString(),
      });

      // Update local state immediately
      await fetchUserData(user.uid);

      return { error: null };
    } catch (error: any) {
      console.error('Signup Error:', error);
      let message = error.message;
      if (error.code === 'auth/email-already-in-use') {
        message = 'This email is already registered. Please sign in instead.';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password should be at least 6 characters.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      }
      return { error: new Error(message) };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { error: null };
    } catch (error: any) {
      return { error: error };
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        loading,
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
