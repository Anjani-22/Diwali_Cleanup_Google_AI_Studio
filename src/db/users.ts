import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { users } from './schema.ts';

export interface UpsertUserInput {
  uid: string;
  email?: string | null;
  name?: string | null;
  photoUrl?: string | null;
  phone?: string | null;
}

export async function getOrCreateUser(input: UpsertUserInput) {
  try {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.uid, input.uid))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    const fallbackName =
      input.name?.trim() ||
      (input.email ? input.email.split('@')[0] : 'Neighbor');

    const inserted = await db
      .insert(users)
      .values({
        uid: input.uid,
        email: input.email ?? null,
        name: fallbackName,
        photoUrl: input.photoUrl ?? null,
        phone: input.phone ?? null,
        phoneVerified: Boolean(input.phone),
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: input.email ?? undefined,
          photoUrl: input.photoUrl ?? undefined,
        },
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Database error in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user profile.', { cause: error });
  }
}

export async function getUserByUid(uid: string) {
  try {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database error in getUserByUid:', error);
    throw new Error('Failed to fetch user profile.', { cause: error });
  }
}
