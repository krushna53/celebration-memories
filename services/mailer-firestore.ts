import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * The Firestore connection the Event Mailer uses when
 * MAILER_EMAIL_CONFIG_STORE=firestore (Email Configuration and Mailer
 * data). Server-only: the Admin SDK signs in with the service account in
 * FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY, and
 * the project's security rules deny every browser read and write.
 *
 * Each company's data sits under mailerTenants/{tenantId}.
 */

const APP_NAME = "mailer-email-config";
let cached: Firestore | null = null;

export class MailerFirestoreSetupError extends Error {
  constructor() {
    super("Firebase isn't set up on the server (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).");
    this.name = "MailerFirestoreSetupError";
  }
}

export function mailerFirestore(): Firestore {
  if (cached) return cached;
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  // .env files store the key on one line with literal "\n" sequences.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw new MailerFirestoreSetupError();
  const existing = getApps().find((a) => a.name === APP_NAME);
  const app = existing ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, APP_NAME);
  const db = getFirestore(app);
  if (!existing) db.settings({ ignoreUndefinedProperties: true });
  cached = db;
  return db;
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** Ids become Firestore path segments, so only plain ids are allowed (no "/" or ".."). */
export function isSafeFirestoreId(id: string): boolean {
  return SAFE_ID.test(id);
}

export function mailerTenantDoc(tenantId: string) {
  if (!isSafeFirestoreId(tenantId)) throw new Error("Invalid tenant id.");
  return mailerFirestore().collection("mailerTenants").doc(tenantId);
}
