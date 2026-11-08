/**
 * EventFrame.io Centralized Pricing Configuration
 *
 * Single source of truth for all platform billing, checkout sessions,
 * and frontend pricing displays.
 *
 * Current Model: One-time USD $5.00 Pay-Per-Event with 12 months validity.
 */

export interface EventPricingConfig {
  currency: string;
  currencySymbol: string;
  pricePerEvent: number; // e.g. 5.00
  priceInCents: number; // e.g. 500
  validityMonths: number; // 12
  billingModel: 'PAY_PER_EVENT';
  subscriptionEnabled: boolean;
  name: string;
  description: string;
  renewalPricePerEvent: number; // 5.00
  renewalPriceInCents: number; // 500
  features: string[];
}

export const EVENT_PRICING: EventPricingConfig = {
  currency: 'USD',
  currencySymbol: '$',
  pricePerEvent: 5.00,
  priceInCents: 500, // 500 cents = $5.00 USD
  validityMonths: 12,
  billingModel: 'PAY_PER_EVENT',
  subscriptionEnabled: false,
  name: 'Event License',
  description: 'One-time payment for 12 months full event access. Free agency registration. No monthly subscription.',
  renewalPricePerEvent: 5.00,
  renewalPriceInCents: 500,
  features: [
    '12 Months Full Event Access',
    'Live Guest Message & Photo Moderation Wall',
    'Bespoke Digital Invitation & Canvas Designer',
    'Custom RSVP Questionnaires & Dietary Tracking',
    'Curated Ballroom Display Art Aesthetics',
    'Couple Access PIN Login Portal',
    'CSV Attendee Records Export & Permanent Archival'
  ]
};

/**
 * Helper to calculate cost for multiple events.
 * 1 event = $5, 2 events = $10, 5 events = $25.
 */
export function calculateEventCost(eventCount: number): number {
  return Math.max(0, eventCount) * EVENT_PRICING.pricePerEvent;
}

/**
 * Helper to format price string (e.g. "$5.00 USD").
 */
export function formatPrice(
  amount: number = EVENT_PRICING.pricePerEvent,
  includeCurrencyCode: boolean = true
): string {
  const formatted = `${EVENT_PRICING.currencySymbol}${amount.toFixed(2)}`;
  return includeCurrencyCode ? `${formatted} ${EVENT_PRICING.currency}` : formatted;
}
