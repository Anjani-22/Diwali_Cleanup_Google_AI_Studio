import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { and, desc, eq, lt, ne, or } from 'drizzle-orm';
import { db } from './src/db/index.ts';
import {
  listings,
  ngoRequests,
  ngos,
  transactions,
  users,
} from './src/db/schema.ts';
import { optionalAuth, requireAuth } from './src/middleware/auth.ts';
import type { AuthRequest, AuthUserRecord } from './src/middleware/auth.ts';
import { analyzeListingImage } from './src/lib/gemini.ts';
import type { AnalyzedListingResult } from './src/lib/gemini.ts';
import { calculateDistanceKm, getDeliveryEligibility } from './src/lib/geo.ts';

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_EMAIL = 'anjaniofficial22@gmail.com';
const AI_DAILY_QUOTA = 10;
const FREE_REQUEST_DAILY_LIMIT = 5;

// In-memory cache for vision AI results (keyed by SHA-256 of image payload)
const aiCache = new Map<string, AnalyzedListingResult>();

// Short-lived OTP challenge store keyed by `${uid}:${phone}`
const otpStore = new Map<string, { code: string; expiresAt: number }>();

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isAdminUser(user?: AuthUserRecord): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.email?.toLowerCase() === ADMIN_EMAIL;
}

async function expireOutdatedListings(): Promise<void> {
  const today = getTodayIsoDate();
  try {
    await db
      .update(listings)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(
        and(
          eq(listings.status, 'active'),
          lt(listings.expiryDate, today),
          ne(listings.expiryDate, '')
        )
      );
  } catch (error) {
    console.error('Failed to auto-expire listings:', error);
  }
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '15mb' }));
  app.use('/src/assets', express.static(path.resolve(process.cwd(), 'src/assets')));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Current user profile & quotas
  app.get('/api/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = req.dbUser!;
      const today = getTodayIsoDate();
      const aiUsedToday = user.aiQuotaDate === today ? user.aiQuotaUsed : 0;
      const freeUsedToday =
        user.freeRequestsDate === today ? user.freeRequestsUsed : 0;

      res.json({
        user: {
          ...user,
          isAdmin: isAdminUser(user),
          aiQuotaRemaining: Math.max(0, AI_DAILY_QUOTA - aiUsedToday),
          aiQuotaLimit: AI_DAILY_QUOTA,
          freeRequestsRemaining: Math.max(
            0,
            FREE_REQUEST_DAILY_LIMIT - freeUsedToday
          ),
        },
      });
    } catch (error) {
      console.error('GET /api/me failed:', error);
      res.status(500).json({ error: 'Unable to load your profile right now.' });
    }
  });

  // Update profile details & home location
  app.put('/api/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = req.dbUser!;
      const {
        name,
        homeLat,
        homeLng,
        homePincode,
        homeCity,
        photoUrl,
      } = req.body as {
        name?: string;
        homeLat?: number;
        homeLng?: number;
        homePincode?: string;
        homeCity?: string;
        photoUrl?: string;
      };

      const cleanName = typeof name === 'string' && name.trim().length >= 2
        ? name.trim().slice(0, 80)
        : user.name;

      const cleanPincode =
        typeof homePincode === 'string' && /^\d{6}$/.test(homePincode.trim())
          ? homePincode.trim()
          : user.homePincode;

      const cleanCity =
        typeof homeCity === 'string' && homeCity.trim().length > 0
          ? homeCity.trim().slice(0, 60)
          : user.homeCity;

      const updated = await db
        .update(users)
        .set({
          name: cleanName,
          homeLat:
            typeof homeLat === 'number' && Number.isFinite(homeLat)
              ? homeLat
              : user.homeLat,
          homeLng:
            typeof homeLng === 'number' && Number.isFinite(homeLng)
              ? homeLng
              : user.homeLng,
          homePincode: cleanPincode,
          homeCity: cleanCity,
          photoUrl:
            typeof photoUrl === 'string' && photoUrl.trim().length > 0
              ? photoUrl.trim()
              : user.photoUrl,
        })
        .where(eq(users.id, user.id))
        .returning();

      res.json({
        user: {
          ...updated[0],
          isAdmin: isAdminUser(updated[0]),
        },
      });
    } catch (error) {
      console.error('PUT /api/me failed:', error);
      res.status(500).json({ error: 'Failed to update profile.' });
    }
  });

  // Indian Mobile Number OTP Verification (MVP verification step)
  app.post('/api/auth/send-otp', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = req.dbUser!;
      const { phone } = req.body as { phone?: string };
      const digits = (phone || '').replace(/\D/g, '');
      const normalized = digits.length === 10
        ? `+91${digits}`
        : digits.length === 12 && digits.startsWith('91')
          ? `+${digits}`
          : '';

      if (!/^\+91[6-9]\d{9}$/.test(normalized)) {
        return res.status(400).json({
          error: 'Enter a valid 10-digit Indian mobile number starting with 6–9.',
        });
      }

      const code = String(crypto.randomInt(100000, 999999));
      const key = `${user.uid}:${normalized}`;
      otpStore.set(key, {
        code,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });

      res.json({
        sent: true,
        phone: normalized,
        // Returned for instant verification in preview when SMS gateway is unconfigured
        verificationHint: process.env.MSG91_AUTH_KEY ? undefined : code,
      });
    } catch (error) {
      console.error('POST /api/auth/send-otp failed:', error);
      res.status(500).json({ error: 'Unable to send OTP right now.' });
    }
  });

  app.post('/api/auth/verify-otp', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = req.dbUser!;
      const { phone, code } = req.body as { phone?: string; code?: string };
      const digits = (phone || '').replace(/\D/g, '');
      const normalized = digits.length === 10
        ? `+91${digits}`
        : digits.length === 12 && digits.startsWith('91')
          ? `+${digits}`
          : '';

      const key = `${user.uid}:${normalized}`;
      const record = otpStore.get(key);

      if (!record || record.expiresAt < Date.now()) {
        return res.status(400).json({ error: 'OTP expired. Please request a new code.' });
      }
      if (record.code !== (code || '').trim()) {
        return res.status(400).json({ error: 'Incorrect verification code.' });
      }

      otpStore.delete(key);

      const updated = await db
        .update(users)
        .set({
          phone: normalized,
          phoneVerified: true,
        })
        .where(eq(users.id, user.id))
        .returning();

      res.json({
        verified: true,
        user: {
          ...updated[0],
          isAdmin: isAdminUser(updated[0]),
        },
      });
    } catch (error) {
      console.error('POST /api/auth/verify-otp failed:', error);
      res.status(500).json({ error: 'OTP verification failed.' });
    }
  });

  // AI-assisted listing analysis (Gemini Vision) with caching & daily quota
  app.post('/api/ai/analyze-item', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = req.dbUser!;
      const { imageBase64, mimeType } = req.body as {
        imageBase64?: string;
        mimeType?: string;
      };

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({ error: 'Please upload an item photo first.' });
      }

      const imageHash = crypto
        .createHash('sha256')
        .update(imageBase64)
        .digest('hex');

      const cached = aiCache.get(imageHash);
      const today = getTodayIsoDate();
      const usedToday = user.aiQuotaDate === today ? user.aiQuotaUsed : 0;

      if (cached) {
        return res.json({
          cached: true,
          analysis: cached,
          quotaRemaining: Math.max(0, AI_DAILY_QUOTA - usedToday),
        });
      }

      if (usedToday >= AI_DAILY_QUOTA) {
        return res.status(429).json({
          fallback: true,
          error: `Daily AI limit of ${AI_DAILY_QUOTA} listings reached. You can still enter item details manually.`,
          quotaRemaining: 0,
        });
      }

      const analysis = await analyzeListingImage(
        imageBase64,
        mimeType || 'image/jpeg'
      );
      aiCache.set(imageHash, analysis);

      const nextCount = usedToday + 1;
      await db
        .update(users)
        .set({
          aiQuotaDate: today,
          aiQuotaUsed: nextCount,
        })
        .where(eq(users.id, user.id));

      res.json({
        cached: false,
        analysis,
        quotaRemaining: Math.max(0, AI_DAILY_QUOTA - nextCount),
      });
    } catch (error) {
      console.error('AI analysis failed:', error);
      res.status(200).json({
        fallback: true,
        error: 'AI vision could not read this photo clearly. Please fill in the details below.',
      });
    }
  });

  // Discovery feed sorted by distance
  app.get('/api/listings', optionalAuth, async (req: AuthRequest, res) => {
    try {
      await expireOutdatedListings();

      const latParam = Number(req.query.lat);
      const lngParam = Number(req.query.lng);
      const userLat = Number.isFinite(latParam)
        ? latParam
        : req.dbUser?.homeLat ?? 17.4401;
      const userLng = Number.isFinite(lngParam)
        ? lngParam
        : req.dbUser?.homeLng ?? 78.3489;

      const radiusKmParam = Number(req.query.radiusKm);
      const maxRadiusKm = Number.isFinite(radiusKmParam) ? radiusKmParam : 50;
      const includePanIndia = req.query.panIndia === 'true';

      const category =
        typeof req.query.category === 'string' ? req.query.category : '';
      const condition =
        typeof req.query.condition === 'string' ? req.query.condition : '';
      const mode = typeof req.query.mode === 'string' ? req.query.mode : '';
      const maxPrice = Number(req.query.maxPrice);
      const queryText =
        typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

      const rows = await db
        .select({
          listing: listings,
          sellerName: users.name,
          sellerPhoto: users.photoUrl,
          sellerPhoneVerified: users.phoneVerified,
        })
        .from(listings)
        .innerJoin(users, eq(listings.sellerId, users.id))
        .where(eq(listings.status, 'active'))
        .orderBy(desc(listings.createdAt));

      const enriched = rows
        .map((row) => {
          const distanceKm = calculateDistanceKm(
            userLat,
            userLng,
            row.listing.lat,
            row.listing.lng
          );
          const delivery = getDeliveryEligibility(distanceKm);
          return {
            id: row.listing.id,
            sellerId: row.listing.sellerId,
            title: row.listing.title,
            description: row.listing.description,
            brand: row.listing.brand,
            images: row.listing.images,
            mode: row.listing.mode,
            condition: row.listing.condition,
            category: row.listing.category,
            price: row.listing.price,
            currency: row.listing.currency,
            expiryDate: row.listing.expiryDate,
            lat: row.listing.lat,
            lng: row.listing.lng,
            pincode: row.listing.pincode,
            locality: row.listing.locality,
            status: row.listing.status,
            createdAt: row.listing.createdAt,
            distanceKm,
            delivery,
            seller: {
              name: row.sellerName,
              photoUrl: row.sellerPhoto,
              phoneVerified: row.sellerPhoneVerified,
            },
          };
        })
        .filter((item) => {
          if (!includePanIndia && item.distanceKm > maxRadiusKm) return false;
          if (category && category !== 'all' && item.category !== category) {
            return false;
          }
          if (condition && condition !== 'all' && item.condition !== condition) {
            return false;
          }
          if (mode && mode !== 'all' && item.mode !== mode) return false;
          if (Number.isFinite(maxPrice) && maxPrice > 0 && item.price > maxPrice) {
            return false;
          }
          if (queryText) {
            const haystack = [
              item.title,
              item.category,
              item.brand || '',
              item.description,
              item.locality,
            ]
              .join(' ')
              .toLowerCase();
            if (!haystack.includes(queryText)) return false;
          }
          return true;
        })
        .sort((a, b) => a.distanceKm - b.distanceKm);

      res.json({ listings: enriched });
    } catch (error) {
      console.error('GET /api/listings failed:', error);
      res.status(500).json({ error: 'Unable to load neighborhood listings.' });
    }
  });

  // Listing detail page (respects seller phone privacy until deal confirmed)
  app.get('/api/listings/:id', optionalAuth, async (req: AuthRequest, res) => {
    try {
      await expireOutdatedListings();

      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid listing ID.' });
      }

      const latParam = Number(req.query.lat);
      const lngParam = Number(req.query.lng);
      const userLat = Number.isFinite(latParam)
        ? latParam
        : req.dbUser?.homeLat ?? 17.4401;
      const userLng = Number.isFinite(lngParam)
        ? lngParam
        : req.dbUser?.homeLng ?? 78.3489;

      const rows = await db
        .select({
          listing: listings,
          sellerName: users.name,
          sellerPhoto: users.photoUrl,
          sellerPhone: users.phone,
          sellerPhoneVerified: users.phoneVerified,
        })
        .from(listings)
        .innerJoin(users, eq(listings.sellerId, users.id))
        .where(eq(listings.id, id))
        .limit(1);

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Listing not found.' });
      }

      const row = rows[0];
      const distanceKm = calculateDistanceKm(
        userLat,
        userLng,
        row.listing.lat,
        row.listing.lng
      );
      const delivery = getDeliveryEligibility(distanceKm);

      let confirmedTx = null;
      if (req.dbUser) {
        const txRows = await db
          .select()
          .from(transactions)
          .where(
            and(
              eq(transactions.listingId, id),
              or(
                eq(transactions.buyerId, req.dbUser.id),
                eq(transactions.sellerId, req.dbUser.id)
              )
            )
          )
          .orderBy(desc(transactions.createdAt))
          .limit(1);
        confirmedTx = txRows[0] ?? null;
      }

      const canSeeContact =
        req.dbUser?.id === row.listing.sellerId || Boolean(confirmedTx);

      res.json({
        listing: {
          ...row.listing,
          distanceKm,
          delivery,
          isOwner: req.dbUser?.id === row.listing.sellerId,
          seller: {
            name: row.sellerName,
            photoUrl: row.sellerPhoto,
            phoneVerified: row.sellerPhoneVerified,
            phone: canSeeContact ? row.sellerPhone : null,
          },
          transaction: confirmedTx,
        },
      });
    } catch (error) {
      console.error('GET /api/listings/:id failed:', error);
      res.status(500).json({ error: 'Failed to load listing details.' });
    }
  });

  // Create listing (requires verified mobile number)
  app.post('/api/listings', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = req.dbUser!;
      if (!user.phoneVerified || !user.phone) {
        return res.status(403).json({
          code: 'PHONE_VERIFICATION_REQUIRED',
          error: 'Please verify your mobile number before publishing a listing.',
        });
      }

      const {
        title,
        description,
        brand,
        images,
        mode,
        condition,
        category,
        price,
        expiryDate,
        lat,
        lng,
        pincode,
        locality,
        aiMetadata,
      } = req.body as {
        title?: string;
        description?: string;
        brand?: string;
        images?: string[];
        mode?: string;
        condition?: string;
        category?: string;
        price?: number;
        expiryDate?: string;
        lat?: number;
        lng?: number;
        pincode?: string;
        locality?: string;
        aiMetadata?: Record<string, unknown>;
      };

      if (!title?.trim()) {
        return res.status(400).json({ error: 'Item title is required.' });
      }
      if (!Array.isArray(images) || images.length === 0 || images.length > 5) {
        return res
          .status(400)
          .json({ error: 'Please include between 1 and 5 photos.' });
      }
      if (mode !== 'sell' && mode !== 'free' && mode !== 'ngo') {
        return res
          .status(400)
          .json({ error: 'Choose a listing mode: Sell, Free Share, or Donate to NGO.' });
      }
      if (condition !== 'new' && condition !== 'almost' && condition !== 'used') {
        return res.status(400).json({ error: 'Select a valid condition.' });
      }

      const finalPrice = mode === 'sell' ? Math.max(1, Math.round(Number(price) || 0)) : 0;

      const created = await db
        .insert(listings)
        .values({
          sellerId: user.id,
          title: title.trim().slice(0, 120),
          description:
            description?.trim() || 'Clean household item shared by a neighbor.',
          brand: brand?.trim() || null,
          images,
          mode,
          condition,
          category: category?.trim() || 'Home Decor',
          price: finalPrice,
          currency: 'INR',
          expiryDate:
            expiryDate && /^\d{4}-\d{2}-\d{2}$/.test(expiryDate)
              ? expiryDate
              : null,
          lat: Number.isFinite(lat) ? Number(lat) : user.homeLat,
          lng: Number.isFinite(lng) ? Number(lng) : user.homeLng,
          pincode:
            pincode && /^\d{6}$/.test(pincode.trim())
              ? pincode.trim()
              : user.homePincode,
          locality: locality?.trim() || `${user.homeCity} ${user.homePincode}`,
          aiMetadata: aiMetadata ?? null,
          status: 'active',
        })
        .returning();

      res.status(201).json({ listing: created[0] });
    } catch (error) {
      console.error('POST /api/listings failed:', error);
      res.status(500).json({ error: 'Could not publish listing. Please try again.' });
    }
  });

  // Update listing status or re-route expired item to NGO
  app.patch('/api/listings/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = req.dbUser!;
      const id = Number(req.params.id);
      const existing = await db
        .select()
        .from(listings)
        .where(eq(listings.id, id))
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ error: 'Listing not found.' });
      }
      if (existing[0].sellerId !== user.id && !isAdminUser(user)) {
        return res.status(403).json({ error: 'You cannot modify this listing.' });
      }

      const { status, mode, price } = req.body as {
        status?: string;
        mode?: string;
        price?: number;
      };

      const updated = await db
        .update(listings)
        .set({
          status: status || existing[0].status,
          mode: mode || existing[0].mode,
          price:
            typeof price === 'number' && Number.isFinite(price)
              ? Math.max(0, Math.round(price))
              : existing[0].price,
          updatedAt: new Date(),
        })
        .where(eq(listings.id, id))
        .returning();

      res.json({ listing: updated[0] });
    } catch (error) {
      console.error('PATCH /api/listings/:id failed:', error);
      res.status(500).json({ error: 'Failed to update listing.' });
    }
  });

  // Safety: report / flag listing
  app.post('/api/listings/:id/flag', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const { reason } = req.body as { reason?: string };

      const updated = await db
        .update(listings)
        .set({
          status: 'flagged',
          flagReason: reason?.trim().slice(0, 240) || 'Flagged by neighbor for review',
          updatedAt: new Date(),
        })
        .where(eq(listings.id, id))
        .returning();

      if (updated.length === 0) {
        return res.status(404).json({ error: 'Listing not found.' });
      }

      res.json({ flagged: true });
    } catch (error) {
      console.error('POST /api/listings/:id/flag failed:', error);
      res.status(500).json({ error: 'Could not flag listing.' });
    }
  });

  // Checkout & Free Share Claim
  app.post('/api/transactions/checkout', requireAuth, async (req: AuthRequest, res) => {
    try {
      const buyer = req.dbUser!;
      if (!buyer.phoneVerified || !buyer.phone) {
        return res.status(403).json({
          code: 'PHONE_VERIFICATION_REQUIRED',
          error: 'Verify your mobile number before ordering or requesting items.',
        });
      }

      const {
        listingId,
        paymentMethod,
        deliveryMode,
        shippingAddress,
      } = req.body as {
        listingId?: number;
        paymentMethod?: string;
        deliveryMode?: 'pickup' | 'ship';
        shippingAddress?: string;
      };

      const rows = await db
        .select({
          listing: listings,
          sellerPhone: users.phone,
          sellerName: users.name,
        })
        .from(listings)
        .innerJoin(users, eq(listings.sellerId, users.id))
        .where(eq(listings.id, Number(listingId)))
        .limit(1);

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Listing not found.' });
      }

      const { listing, sellerPhone, sellerName } = rows[0];
      if (listing.status !== 'active') {
        return res.status(400).json({ error: 'This item is no longer available.' });
      }
      if (listing.sellerId === buyer.id) {
        return res.status(400).json({ error: 'You cannot buy or request your own listing.' });
      }
      if (listing.expiryDate && listing.expiryDate < getTodayIsoDate()) {
        return res.status(400).json({ error: 'This item has expired.' });
      }

      const distanceKm = calculateDistanceKm(
        buyer.homeLat,
        buyer.homeLng,
        listing.lat,
        listing.lng
      );
      const eligibility = getDeliveryEligibility(distanceKm);

      const chosenDelivery: 'pickup' | 'ship' =
        deliveryMode === 'ship' || !eligibility.pickupAllowed ? 'ship' : 'pickup';

      if (chosenDelivery === 'ship' && !shippingAddress?.trim()) {
        return res
          .status(400)
          .json({ error: 'Enter your delivery address for Shiprocket shipping.' });
      }

      // Free share rate-limiting (anti-hoarding)
      if (listing.mode === 'free') {
        const today = getTodayIsoDate();
        const usedToday =
          buyer.freeRequestsDate === today ? buyer.freeRequestsUsed : 0;
        if (usedToday >= FREE_REQUEST_DAILY_LIMIT) {
          return res.status(429).json({
            error: `Daily limit of ${FREE_REQUEST_DAILY_LIMIT} Free Share requests reached. Try again tomorrow.`,
          });
        }
        await db
          .update(users)
          .set({
            freeRequestsDate: today,
            freeRequestsUsed: usedToday + 1,
          })
          .where(eq(users.id, buyer.id));
      }

      const chosenPayment =
        listing.mode === 'free'
          ? 'free_request'
          : paymentMethod || 'upi';

      if (chosenPayment === 'cod' && !eligibility.codAllowed) {
        return res.status(400).json({
          error: 'Cash on Delivery is available only for self-pickup within 5 km.',
        });
      }

      const shippingFee = chosenDelivery === 'ship' ? eligibility.shippingFee : 0;
      const razorpayOrderId =
        chosenPayment === 'upi' ||
        chosenPayment === 'card' ||
        chosenPayment === 'netbanking'
          ? `order_dc_${crypto.randomBytes(6).toString('hex')}`
          : null;
      const razorpayPaymentId = razorpayOrderId
        ? `pay_dc_${crypto.randomBytes(6).toString('hex')}`
        : null;

      const shiprocketAwb =
        chosenDelivery === 'ship'
          ? `SR${crypto.randomInt(100000000, 999999999)}`
          : null;
      const trackingUrl = shiprocketAwb
        ? `https://shiprocket.co/tracking/${shiprocketAwb}`
        : null;

      const insertedTx = await db
        .insert(transactions)
        .values({
          listingId: listing.id,
          buyerId: buyer.id,
          sellerId: listing.sellerId,
          amount: listing.mode === 'sell' ? listing.price : 0,
          shippingFee,
          paymentMethod: chosenPayment,
          razorpayOrderId,
          razorpayPaymentId,
          deliveryMode: chosenDelivery,
          shippingAddress:
            chosenDelivery === 'ship' ? shippingAddress?.trim() || null : null,
          shiprocketAwb,
          trackingUrl,
          status: chosenDelivery === 'ship' ? 'shipped' : 'paid',
        })
        .returning();

      await db
        .update(listings)
        .set({ status: 'sold', updatedAt: new Date() })
        .where(eq(listings.id, listing.id));

      res.status(201).json({
        transaction: insertedTx[0],
        sellerContact: {
          name: sellerName,
          phone: sellerPhone,
          locality: listing.locality,
          pincode: listing.pincode,
        },
      });
    } catch (error) {
      console.error('POST /api/transactions/checkout failed:', error);
      res.status(500).json({ error: 'Checkout failed. Please try again.' });
    }
  });

  // User's own listings & transactions
  app.get('/api/my/listings', requireAuth, async (req: AuthRequest, res) => {
    try {
      await expireOutdatedListings();
      const user = req.dbUser!;
      const rows = await db
        .select()
        .from(listings)
        .where(eq(listings.sellerId, user.id))
        .orderBy(desc(listings.createdAt));

      res.json({ listings: rows });
    } catch (error) {
      console.error('GET /api/my/listings failed:', error);
      res.status(500).json({ error: 'Unable to load your listings.' });
    }
  });

  app.get('/api/my/transactions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = req.dbUser!;
      const rows = await db
        .select({
          transaction: transactions,
          listingTitle: listings.title,
          listingImages: listings.images,
          listingLocality: listings.locality,
          sellerName: users.name,
          sellerPhone: users.phone,
        })
        .from(transactions)
        .innerJoin(listings, eq(transactions.listingId, listings.id))
        .innerJoin(users, eq(transactions.sellerId, users.id))
        .where(
          or(
            eq(transactions.buyerId, user.id),
            eq(transactions.sellerId, user.id)
          )
        )
        .orderBy(desc(transactions.createdAt));

      res.json({
        transactions: rows.map((r) => ({
          ...r.transaction,
          role: r.transaction.buyerId === user.id ? 'buyer' : 'seller',
          listingTitle: r.listingTitle,
          listingImage: r.listingImages[0] ?? '',
          listingLocality: r.listingLocality,
          sellerName: r.sellerName,
          sellerPhone: r.sellerPhone,
        })),
      });
    } catch (error) {
      console.error('GET /api/my/transactions failed:', error);
      res.status(500).json({ error: 'Unable to load your orders.' });
    }
  });

  // NGO Directory
  app.get('/api/ngos', async (req, res) => {
    try {
      const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
      const rows = await db
        .select()
        .from(ngos)
        .where(eq(ngos.active, true))
        .orderBy(ngos.city, ngos.name);

      const filtered = city && city !== 'all'
        ? rows.filter((n) => n.city.toLowerCase() === city.toLowerCase())
        : rows;

      res.json({ ngos: filtered });
    } catch (error) {
      console.error('GET /api/ngos failed:', error);
      res.status(500).json({ error: 'Unable to load NGO directory.' });
    }
  });

  // Submit NGO pickup request & build click-to-WhatsApp + email payload
  app.post('/api/ngo-requests', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = req.dbUser!;
      if (!user.phoneVerified || !user.phone) {
        return res.status(403).json({
          code: 'PHONE_VERIFICATION_REQUIRED',
          error: 'Please verify your mobile number so the NGO can contact you.',
        });
      }

      const { ngoId, items, photos, pickupAddress } = req.body as {
        ngoId?: number;
        items?: Array<{
          listingId?: number;
          title: string;
          category: string;
          condition: string;
        }>;
        photos?: string[];
        pickupAddress?: string;
      };

      const ngoRows = await db
        .select()
        .from(ngos)
        .where(eq(ngos.id, Number(ngoId)))
        .limit(1);

      if (ngoRows.length === 0) {
        return res.status(404).json({ error: 'Selected NGO was not found.' });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Add at least one item to donate.' });
      }
      if (!pickupAddress?.trim()) {
        return res.status(400).json({ error: 'Enter your pickup address.' });
      }

      const ngo = ngoRows[0];
      const safePhotos = Array.isArray(photos) ? photos.slice(0, 5) : [];

      const created = await db
        .insert(ngoRequests)
        .values({
          userId: user.id,
          ngoId: ngo.id,
          items,
          photos: safePhotos,
          pickupAddress: pickupAddress.trim(),
          contactPhone: user.phone,
          status: 'sent',
        })
        .returning();

      // Mark any linked user listings as donated
      for (const item of items) {
        if (item.listingId) {
          await db
            .update(listings)
            .set({ status: 'donated', mode: 'ngo', updatedAt: new Date() })
            .where(
              and(
                eq(listings.id, item.listingId),
                eq(listings.sellerId, user.id)
              )
            );
        }
      }

      const itemLines = items
        .map((it, i) => `${i + 1}. ${it.title} (${it.category}, ${it.condition})`)
        .join('\n');

      const message =
        `Namaste ${ngo.name},\n` +
        `I would like to request a Diwali CleanUp donation pickup:\n\n` +
        `${itemLines}\n\n` +
        `Donor: ${user.name}\n` +
        `Phone: ${user.phone}\n` +
        `Pickup Address: ${pickupAddress.trim()}\n` +
        `Request ID: #DC-NGO-${created[0].id}`;

      const whatsappUrl = `https://wa.me/${ngo.phoneWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
      const mailtoUrl = `mailto:${ngo.email}?subject=${encodeURIComponent(`Diwali CleanUp Donation Pickup #DC-NGO-${created[0].id}`)}&body=${encodeURIComponent(message)}`;

      res.status(201).json({
        request: created[0],
        ngo,
        whatsappUrl,
        mailtoUrl,
      });
    } catch (error) {
      console.error('POST /api/ngo-requests failed:', error);
      res.status(500).json({ error: 'Could not send NGO pickup request.' });
    }
  });

  app.get('/api/my/ngo-requests', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = req.dbUser!;
      const rows = await db
        .select({
          request: ngoRequests,
          ngoName: ngos.name,
          ngoCity: ngos.city,
          ngoWhatsapp: ngos.phoneWhatsapp,
        })
        .from(ngoRequests)
        .innerJoin(ngos, eq(ngoRequests.ngoId, ngos.id))
        .where(eq(ngoRequests.userId, user.id))
        .orderBy(desc(ngoRequests.createdAt));

      res.json({
        requests: rows.map((r) => ({
          ...r.request,
          ngoName: r.ngoName,
          ngoCity: r.ngoCity,
          ngoWhatsapp: r.ngoWhatsapp,
        })),
      });
    } catch (error) {
      console.error('GET /api/my/ngo-requests failed:', error);
      res.status(500).json({ error: 'Unable to load your donation requests.' });
    }
  });

  // Internal Admin Moderation & NGO Directory Management
  app.get('/api/admin/overview', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!isAdminUser(req.dbUser)) {
        return res.status(403).json({ error: 'Admin access required.' });
      }

      const [allListings, allTx, allNgos, allNgoReqs, allUsers] = await Promise.all([
        db.select().from(listings).orderBy(desc(listings.createdAt)),
        db.select().from(transactions),
        db.select().from(ngos).orderBy(ngos.city, ngos.name),
        db.select().from(ngoRequests),
        db.select({ id: users.id }).from(users),
      ]);

      res.json({
        metrics: {
          totalUsers: allUsers.length,
          activeListings: allListings.filter((l) => l.status === 'active').length,
          flaggedListings: allListings.filter((l) => l.status === 'flagged').length,
          completedTransactions: allTx.length,
          ngoRequests: allNgoReqs.length,
        },
        flaggedListings: allListings.filter((l) => l.status === 'flagged'),
        recentListings: allListings.slice(0, 20),
        ngos: allNgos,
      });
    } catch (error) {
      console.error('GET /api/admin/overview failed:', error);
      res.status(500).json({ error: 'Failed to load admin console.' });
    }
  });

  app.patch('/api/admin/listings/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!isAdminUser(req.dbUser)) {
        return res.status(403).json({ error: 'Admin access required.' });
      }
      const id = Number(req.params.id);
      const { status } = req.body as { status?: string };
      if (status !== 'active' && status !== 'removed') {
        return res.status(400).json({ error: 'Status must be active or removed.' });
      }

      const updated = await db
        .update(listings)
        .set({
          status,
          flagReason: status === 'active' ? null : undefined,
          updatedAt: new Date(),
        })
        .where(eq(listings.id, id))
        .returning();

      res.json({ listing: updated[0] });
    } catch (error) {
      console.error('PATCH /api/admin/listings/:id failed:', error);
      res.status(500).json({ error: 'Failed to moderate listing.' });
    }
  });

  app.post('/api/admin/ngos', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!isAdminUser(req.dbUser)) {
        return res.status(403).json({ error: 'Admin access required.' });
      }
      const { name, city, email, phoneWhatsapp, address, categoriesAccepted } =
        req.body as {
          name?: string;
          city?: string;
          email?: string;
          phoneWhatsapp?: string;
          address?: string;
          categoriesAccepted?: string[];
        };

      if (!name?.trim() || !city?.trim() || !email?.trim() || !phoneWhatsapp?.trim()) {
        return res.status(400).json({ error: 'Fill all required NGO fields.' });
      }

      const created = await db
        .insert(ngos)
        .values({
          name: name.trim(),
          city: city.trim(),
          email: email.trim(),
          phoneWhatsapp: phoneWhatsapp.replace(/\D/g, ''),
          address: address?.trim() || city.trim(),
          categoriesAccepted:
            Array.isArray(categoriesAccepted) && categoriesAccepted.length > 0
              ? categoriesAccepted
              : ['Clothing & Textiles', 'Home Decor', 'Books & Stationery'],
          active: true,
        })
        .returning();

      res.status(201).json({ ngo: created[0] });
    } catch (error) {
      console.error('POST /api/admin/ngos failed:', error);
      res.status(500).json({ error: 'Could not add NGO.' });
    }
  });

  // Vite dev middleware or production static build
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Diwali CleanUp server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
