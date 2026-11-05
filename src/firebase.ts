import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDocFromServer,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { MedicalLogEntry, getServiceUnitForHospital } from './types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
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
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

const COLLECTION_NAME = 'medical_logs';

function sanitizeId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  return cleaned || `log-${Date.now()}`;
}

function clampCount(val: unknown): number {
  const num = Math.round(Number(val) || 0);
  return Math.max(0, Math.min(10000, num));
}

export async function upsertFirestoreMedicalLog(entry: MedicalLogEntry, isNew: boolean): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) {
    return;
  }

  const safeId = sanitizeId(entry.id);
  const unitInfo = getServiceUnitForHospital(entry.hospital);
  const rawCode = entry.serviceUnitCode && /^[0-9]{5}$/.test(entry.serviceUnitCode)
    ? entry.serviceUnitCode
    : unitInfo.code;
  const rawUnitName = (entry.serviceUnitName || unitInfo.name || 'รพ.สต.บ้านดอยยาว').slice(0, 120);
  const safeDate = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(entry.date)
    ? entry.date
    : new Date().toISOString().slice(0, 10);

  const payload: Record<string, unknown> = {
    id: safeId,
    authorUid: auth.currentUser.uid,
    serviceUnitCode: rawCode,
    serviceUnitName: rawUnitName,
    date: safeDate,
    doctorName: (entry.doctorName || 'นายแพทย์เกรียงยุทธ วรศีตกาลกุล').slice(0, 120),
    hospital: (entry.hospital || 'รพ.สต.บ้านดอยยาว').slice(0, 120),
    workTime: (entry.workTime || '08.30 – 16.30 น.').slice(0, 60),
    generalPractice: clampCount(entry.report?.generalPractice),
    chronicCare: clampCount(entry.report?.chronicCare),
    homeVisit: clampCount(entry.report?.homeVisit),
    medicalCert: clampCount(entry.report?.medicalCert),
    specialProcedure: clampCount(entry.report?.specialProcedure),
    reporterPrefix: (entry.reporter?.prefix || 'นาย').slice(0, 40),
    reporterFirstName: (entry.reporter?.firstName || '-').slice(0, 80),
    reporterLastName: (entry.reporter?.lastName || '-').slice(0, 80),
    reporterPosition: (entry.reporter?.position || '').slice(0, 100),
    reporterLevel: (entry.reporter?.level || 'ไม่มี').slice(0, 60),
    notes: (entry.notes || '').slice(0, 1000),
    visibility: 'node_doi_yao',
    updatedAt: serverTimestamp(),
  };

  if (isNew) {
    payload.createdAt = serverTimestamp();
  }

  const docPath = `${COLLECTION_NAME}/${safeId}`;
  try {
    await setDoc(doc(db, COLLECTION_NAME, safeId), payload, { merge: !isNew });
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, docPath);
  }
}

export async function removeFirestoreMedicalLog(id: string): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) {
    return;
  }
  const safeId = sanitizeId(id);
  const docPath = `${COLLECTION_NAME}/${safeId}`;
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export function subscribeFirestoreMedicalLogs(
  onReceive: (entries: MedicalLogEntry[]) => void
): () => void {
  let unsubscribeSnapshot: (() => void) | null = null;

  const unsubscribeAuth = onAuthStateChanged(auth, (user: User | null) => {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }

    if (!user) {
      return;
    }

    const q = query(
      collection(db, COLLECTION_NAME),
      where('visibility', '==', 'node_doi_yao')
    );

    unsubscribeSnapshot = onSnapshot(
      q,
      (snapshot) => {
        const list: MedicalLogEntry[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const createdIso =
            data.createdAt instanceof Timestamp
              ? data.createdAt.toDate().toISOString()
              : typeof data.createdAt === 'string'
              ? data.createdAt
              : new Date().toISOString();
          const updatedIso =
            data.updatedAt instanceof Timestamp
              ? data.updatedAt.toDate().toISOString()
              : typeof data.updatedAt === 'string'
              ? data.updatedAt
              : createdIso;

          list.push({
            id: String(data.id || docSnap.id),
            date: String(data.date || ''),
            doctorName: String(data.doctorName || 'นายแพทย์เกรียงยุทธ วรศีตกาลกุล'),
            hospital: String(data.hospital || 'รพ.สต.บ้านดอยยาว'),
            workTime: String(data.workTime || '08.30 – 16.30 น.'),
            serviceUnitCode: String(data.serviceUnitCode || '05958'),
            serviceUnitName: String(data.serviceUnitName || data.hospital || 'รพ.สต.บ้านดอยยาว'),
            report: {
              generalPractice: Number(data.generalPractice) || 0,
              chronicCare: Number(data.chronicCare) || 0,
              homeVisit: Number(data.homeVisit) || 0,
              medicalCert: Number(data.medicalCert) || 0,
              specialProcedure: Number(data.specialProcedure) || 0,
            },
            reporter: {
              prefix: String(data.reporterPrefix || ''),
              firstName: String(data.reporterFirstName || ''),
              lastName: String(data.reporterLastName || ''),
              position: String(data.reporterPosition || ''),
              level: String(data.reporterLevel || 'ไม่มี'),
            },
            notes: String(data.notes || ''),
            createdAt: createdIso,
            updatedAt: updatedIso,
          });
        });

        onReceive(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
      }
    );
  });

  return () => {
    unsubscribeAuth();
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
    }
  };
}

export async function signInWithGooglePopup(): Promise<User | null> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}
