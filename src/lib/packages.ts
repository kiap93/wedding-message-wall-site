import { EVENT_PRICING, formatPrice, calculateEventCost } from '../config/pricing';

export { EVENT_PRICING, formatPrice, calculateEventCost };

export interface EventPackage {
  id: string;
  name: string;
  price: number; // in USD
  currency: string;
  guestLimit: number;
  durationMonths: number;
  description: string;
  badge?: string;
  popular?: boolean;
  features: string[];
}

/**
 * Standard pay-per-event package dynamically bound to centralized EVENT_PRICING ($5.00 USD).
 */
export const EVENT_PACKAGES: EventPackage[] = [
  {
    id: 'standard',
    name: 'Event License',
    price: EVENT_PRICING.pricePerEvent, // USD $5.00
    currency: EVENT_PRICING.currency,
    guestLimit: 1000,
    durationMonths: EVENT_PRICING.validityMonths, // 12 months
    description: 'One-time payment for 12 months full event access. Free agency registration. No monthly subscription.',
    popular: true,
    badge: '12 MONTHS ACCESS',
    features: EVENT_PRICING.features
  }
];

export function getPackageById(packageId?: string | null): EventPackage {
  return EVENT_PACKAGES[0];
}

/**
 * Calculates 12 calendar months expiration date.
 * Uses exact calendar-month arithmetic rather than adding 365 days.
 * E.g. Jan 31 -> Jan 31 next year (or clamped to Feb 28 in non-leap year).
 */
export function add12CalendarMonths(fromDate: Date): Date {
  const result = new Date(fromDate);
  const currentMonth = result.getMonth();
  const currentDay = result.getDate();
  
  result.setFullYear(result.getFullYear() + 1);
  
  // In case of Feb 29 -> Feb 28 next year:
  if (result.getMonth() !== currentMonth) {
    result.setDate(0); // Clamps to last day of target month
  } else {
    result.setDate(currentDay);
  }
  
  return result;
}

/**
 * Checks if an event is currently active based on payment status and expiration date.
 * Also supports backward compatibility for legacy agencies with active subscriptions.
 */
export function isEventActive(event?: {
  payment_status?: string;
  status?: string;
  expires_at?: string;
  created_at?: string;
} | null, agency?: {
  subscription_status?: string;
  is_demo?: boolean;
} | null): boolean {
  if (!event) return false;

  // 1. Explicit admin/demo override
  if (agency?.is_demo) return true;

  // 2. Event-level payment status check
  if (event.payment_status === 'paid') {
    if (!event.expires_at) {
      // Paid but no expiry yet (e.g. migration): active
      return true;
    }
    const expiryDate = new Date(event.expires_at);
    return expiryDate.getTime() > Date.now();
  }

  // 3. Legacy Backward Compatibility:
  // If the event was created under an agency with legacy active subscription,
  // grandfather it as active so existing customers never lose access.
  if (agency?.subscription_status === 'active') {
    return true;
  }

  return false;
}

/**
 * Returns remaining days until event expiry.
 */
export function getDaysRemaining(expiresAt?: string | null): number {
  if (!expiresAt) return 0;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
