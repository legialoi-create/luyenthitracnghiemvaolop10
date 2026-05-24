import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, query, where, deleteDoc, doc, Timestamp, orderBy, limit } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Validate config
const isPlaceholder = (val?: string) => !val || val.includes('remixed-') || val.includes('MY_');

if (isPlaceholder(firebaseConfig.projectId)) {
  console.warn("Firebase configuration appears to be using placeholders. Please set up Firebase via the AI Studio UI.");
}

const app = initializeApp(firebaseConfig);

// Use default database if firestoreDatabaseId is a placeholder or not provided
const dbId = isPlaceholder(firebaseConfig.firestoreDatabaseId) ? undefined : firebaseConfig.firestoreDatabaseId;

export const db = getFirestore(app, dbId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot
if (typeof window !== 'undefined' && !isPlaceholder(firebaseConfig.projectId)) {
  import('firebase/firestore').then(({ doc, getDocFromCache, getDocFromServer }) => {
    // Try server first to check connectivity
    getDocFromServer(doc(db, 'metadata', 'questions')).catch(err => {
      if (err.message.includes('offline')) {
          console.error("Firestore is offline. Check your network or Firebase project configuration.");
      }
    });
  });
}

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const loginAnonymously = () => signInAnonymously(auth);
export const logout = () => signOut(auth);

export interface Question {
  id?: string;
  content: string;
  options: string[];
  correctAnswer: number;
  category: string;
  createdAt: Timestamp | Date;
}

export interface QuizResult {
  id?: string;
  name: string;
  class: string;
  school?: string;
  score: number;
  startTime: Timestamp | Date;
  submittedAt: Timestamp | Date;
}
