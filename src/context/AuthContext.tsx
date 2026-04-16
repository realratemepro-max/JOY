import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: FirebaseUser | null;
  appUser: User | null;
  userRole: UserRole | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  clearError: () => void;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  isClient: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUserData = async (firebaseUser: FirebaseUser) => {
    try {
      // Check admin status first
      const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
      if (adminDoc.exists()) {
        setUserRole('admin');
        setAppUser({
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || 'Admin',
          role: 'admin',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return;
      }

      // Load user document
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const loadedUser: User = {
          id: userDoc.id,
          email: data.email || firebaseUser.email || '',
          name: data.name || firebaseUser.displayName || '',
          role: data.role || 'client',
          phone: data.phone,
          photoUrl: data.photoUrl,
          dateOfBirth: data.dateOfBirth,
          emergencyContact: data.emergencyContact,
          goals: data.goals,
          injuries: data.injuries,
          experience: data.experience,
          notes: data.notes,
          activePlanId: data.activePlanId,
          activePlanName: data.activePlanName,
          status: data.status || 'active',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
        setAppUser(loadedUser);
        setUserRole(loadedUser.role);
      } else {
        // No user doc - shouldn't happen for registered clients
        setUserRole('client');
        setAppUser(null);
      }
    } catch (err) {
      console.error('Error loading user data:', err);
      setUserRole('client');
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await loadUserData(firebaseUser);
      } else {
        setUserRole(null);
        setAppUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(getErrorMessage(err.code));
      throw err;
    }
  };

  const register = async (email: string, password: string, name: string, phone?: string) => {
    try {
      setError(null);
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(newUser, { displayName: name });

      // Create user document
      const userData: Omit<User, 'id'> = {
        email,
        name,
        role: 'client',
        phone: phone || undefined,
        status: 'lead',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await setDoc(doc(db, 'users', newUser.uid), userData);
    } catch (err: any) {
      setError(getErrorMessage(err.code));
      throw err;
    }
  };

  const logout = async () => {
    try {
      setError(null);
      await signOut(auth);
    } catch (err: any) {
      setError(getErrorMessage(err.code));
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      setError(null);
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      setError(getErrorMessage(err.code));
      throw err;
    }
  };

  const clearError = () => setError(null);

  const refreshUser = async () => {
    if (user) await loadUserData(user);
  };

  const value: AuthContextType = {
    user,
    appUser,
    userRole,
    loading,
    error,
    login,
    register,
    logout,
    resetPassword,
    clearError,
    refreshUser,
    isAdmin: userRole === 'admin',
    isClient: userRole === 'client',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function getErrorMessage(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Este email já está registado.';
    case 'auth/invalid-email':
      return 'Email inválido.';
    case 'auth/weak-password':
      return 'A password deve ter pelo menos 6 caracteres.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada.';
    case 'auth/user-not-found':
      return 'Utilizador não encontrado.';
    case 'auth/wrong-password':
      return 'Password incorreta.';
    case 'auth/too-many-requests':
      return 'Demasiadas tentativas. Tenta novamente mais tarde.';
    case 'auth/invalid-credential':
      return 'Credenciais inválidas.';
    default:
      return 'Ocorreu um erro. Tenta novamente.';
  }
}
