import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

interface Subject {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export const useSubjects = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: subjects = [], isLoading, error } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const q = query(collection(db, 'subjects'), orderBy('name'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Subject[];
    },
    enabled: !!user,
  });

  const createSubject = useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      const docRef = await addDoc(collection(db, 'subjects'), {
        name,
        description: description || null,
        created_by: user?.uid,
        created_at: new Date().toISOString(), // Use ISO string to match interface
      });
      return { id: docRef.id, name, description, created_by: user?.uid };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
  });

  return {
    subjects,
    isLoading,
    error,
    createSubject,
  };
};
