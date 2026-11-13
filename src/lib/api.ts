import { auth } from './firebase';

export async function getAuthToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      (data as { error?: string }).error || `Request failed (${res.status})`
    ) as Error & { code?: string; status?: number };
    err.code = (data as { code?: string }).code;
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export const CATEGORIES = [
  'Home Decor',
  'Electronics',
  'Clothing & Textiles',
  'Personal Care',
  'Books & Stationery',
  'Kitchenware',
  'Furniture',
  'Packaged Pantry',
];

export const CONDITION_LABELS: Record<'new' | 'almost' | 'used', string> = {
  new: 'New',
  almost: 'Almost New',
  used: 'Partially Used',
};

export const MODE_LABELS: Record<'sell' | 'free' | 'ngo', string> = {
  sell: 'Sell',
  free: 'Free Share',
  ngo: 'Donate to NGO',
};

export const SAMPLE_PINCODES = [
  { pincode: '500081', locality: 'Madhapur', city: 'Hyderabad', lat: 17.4401, lng: 78.3489 },
  { pincode: '500033', locality: 'Jubilee Hills', city: 'Hyderabad', lat: 17.4326, lng: 78.4071 },
  { pincode: '500084', locality: 'Kondapur', city: 'Hyderabad', lat: 17.4622, lng: 78.3568 },
  { pincode: '500034', locality: 'Banjara Hills', city: 'Hyderabad', lat: 17.4156, lng: 78.4347 },
  { pincode: '560038', locality: 'Indiranagar', city: 'Bengaluru', lat: 12.9784, lng: 77.6408 },
  { pincode: '400050', locality: 'Bandra West', city: 'Mumbai', lat: 19.0596, lng: 72.8295 },
];
