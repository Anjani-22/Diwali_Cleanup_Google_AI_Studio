import type { Request, Response, NextFunction } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';

export interface AuthUserRecord {
  id: number;
  uid: string;
  email: string | null;
  phone: string | null;
  phoneVerified: boolean;
  name: string;
  photoUrl: string | null;
  homeLat: number;
  homeLng: number;
  homePincode: string;
  homeCity: string;
  role: string;
  aiQuotaDate: string | null;
  aiQuotaUsed: number;
  freeRequestsDate: string | null;
  freeRequestsUsed: number;
}

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: AuthUserRecord;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Please sign in to continue.' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    const dbUser = await getOrCreateUser({
      uid: decodedToken.uid,
      email: decodedToken.email ?? null,
      name: decodedToken.name ?? null,
      photoUrl: decodedToken.picture ?? null,
      phone: decodedToken.phone_number ?? null,
    });
    req.dbUser = dbUser;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    const dbUser = await getOrCreateUser({
      uid: decodedToken.uid,
      email: decodedToken.email ?? null,
      name: decodedToken.name ?? null,
      photoUrl: decodedToken.picture ?? null,
      phone: decodedToken.phone_number ?? null,
    });
    req.dbUser = dbUser;
  } catch {
    // Guest fallback when optional token is invalid or expired
  }
  next();
};
