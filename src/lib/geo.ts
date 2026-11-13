export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export interface DeliveryEligibility {
  distanceKm: number;
  tier: 'pickup' | 'mid_range' | 'ship';
  pickupAllowed: boolean;
  codAllowed: boolean;
  shiprocketAllowed: boolean;
  shippingFee: number;
  note: string;
}

export function getDeliveryEligibility(distanceKm: number): DeliveryEligibility {
  if (distanceKm <= 5) {
    return {
      distanceKm,
      tier: 'pickup',
      pickupAllowed: true,
      codAllowed: true,
      shiprocketAllowed: false,
      shippingFee: 0,
      note: 'Within 5 km — Self-pickup or hand-delivery. Cash on Delivery & UPI supported.',
    };
  }
  if (distanceKm <= 25) {
    return {
      distanceKm,
      tier: 'mid_range',
      pickupAllowed: true,
      codAllowed: false,
      shiprocketAllowed: true,
      shippingFee: 65,
      note: '5–25 km away — Self-pickup or Shiprocket parcel (₹65). Hyperlocal bike courier coming in v2.',
    };
  }
  const shippingFee = distanceKm > 500 ? 125 : 85;
  return {
    distanceKm,
    tier: 'ship',
    pickupAllowed: false,
    codAllowed: false,
    shiprocketAllowed: true,
    shippingFee,
    note: `${distanceKm} km away — Pan-India delivery via Shiprocket courier (₹${shippingFee}).`,
  };
}

export const INDIAN_PINCODE_PRESETS: Array<{
  pincode: string;
  locality: string;
  city: string;
  lat: number;
  lng: number;
}> = [
  { pincode: '500081', locality: 'Madhapur', city: 'Hyderabad', lat: 17.4401, lng: 78.3489 },
  { pincode: '500033', locality: 'Jubilee Hills', city: 'Hyderabad', lat: 17.4326, lng: 78.4071 },
  { pincode: '500084', locality: 'Kondapur', city: 'Hyderabad', lat: 17.4622, lng: 78.3568 },
  { pincode: '500034', locality: 'Banjara Hills', city: 'Hyderabad', lat: 17.4156, lng: 78.4347 },
  { pincode: '560038', locality: 'Indiranagar', city: 'Bengaluru', lat: 12.9784, lng: 77.6408 },
  { pincode: '560001', locality: 'MG Road', city: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
  { pincode: '400050', locality: 'Bandra West', city: 'Mumbai', lat: 19.0596, lng: 72.8295 },
  { pincode: '110016', locality: 'Hauz Khas', city: 'New Delhi', lat: 28.5494, lng: 77.2001 },
];
