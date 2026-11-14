import React from 'react';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Armchair,
  UserMinus,
  MessageSquareHeart,
} from 'lucide-react';
import { OverviewStats } from '../../lib/eventOverview';

interface OverviewStatCardsProps {
  stats: OverviewStats;
  isLoading: boolean;
  guestError?: string | null;
  messageError?: string | null;
  onCardClick?: (target: 'guests' | 'confirmed' | 'pending' | 'seating' | 'unassigned' | 'messages') => void;
}

interface StatCardConfig {
  id: 'guests' | 'confirmed' | 'declined' | 'pending' | 'seating' | 'unassigned' | 'messages';
  label: string;
  value: number;
  subtext: string;
  icon: React.ReactNode;
  accentText: string;
  accentBg: string;
  hasError?: boolean;
  navTarget?: 'guests' | 'confirmed' | 'pending' | 'seating' | 'unassigned' | 'messages';
}

export const OverviewStatCards: React.FC<OverviewStatCardsProps> = ({
  stats,
  isLoading,
  guestError,
  messageError,
  onCardClick,
}) => {
  const cards: StatCardConfig[] = [
    {
      id: 'guests',
      label: 'Total Guests',
      value: stats.totalGuests,
      subtext:
        stats.totalPax > stats.totalGuests
          ? `${stats.totalPax} total seats`
          : 'Registered roster',
      icon: <Users className="w-4 h-4" />,
      accentText: 'text-[#8B7344]',
      accentBg: 'bg-[#FAF5EA]',
      hasError: Boolean(guestError),
      navTarget: 'guests',
    },
    {
      id: 'confirmed',
      label: 'Confirmed RSVP',
      value: stats.confirmedRsvp,
      subtext:
        stats.confirmedPax > stats.confirmedRsvp
          ? `${stats.confirmedPax} attending pax`
          : `${stats.rsvpCompletionPct}% response rate`,
      icon: <CheckCircle2 className="w-4 h-4" />,
      accentText: 'text-emerald-700',
      accentBg: 'bg-emerald-50/90',
      hasError: Boolean(guestError),
      navTarget: 'confirmed',
    },
    {
      id: 'declined',
      label: 'Declined RSVP',
      value: stats.declinedRsvp,
      subtext: 'Unable to attend',
      icon: <XCircle className="w-4 h-4" />,
      accentText: 'text-rose-700',
      accentBg: 'bg-rose-50/80',
      hasError: Boolean(guestError),
      navTarget: 'guests',
    },
    {
      id: 'pending',
      label: 'Pending RSVP',
      value: stats.pendingRsvp,
      subtext: 'Awaiting reply',
      icon: <Clock className="w-4 h-4" />,
      accentText: 'text-amber-700',
      accentBg: 'bg-amber-50/90',
      hasError: Boolean(guestError),
      navTarget: 'pending',
    },
    {
      id: 'seating',
      label: 'Assigned Seating',
      value: stats.assignedSeating,
      subtext:
        stats.totalCapacity > 0
          ? `${stats.seatingOccupancyPct}% of ${stats.totalCapacity} seats`
          : 'Seated at tables',
      icon: <Armchair className="w-4 h-4" />,
      accentText: 'text-[#8B7344]',
      accentBg: 'bg-[#FAF5EA]',
      hasError: Boolean(guestError),
      navTarget: 'seating',
    },
    {
      id: 'unassigned',
      label: 'Unassigned Guests',
      value: stats.unassignedGuests,
      subtext:
        stats.unassignedAllActive > stats.unassignedGuests
          ? `${stats.unassignedAllActive} incl. pending`
          : 'Confirmed needing seats',
      icon: <UserMinus className="w-4 h-4" />,
      accentText: stats.unassignedGuests > 0 ? 'text-amber-800' : 'text-[#6E6456]',
      accentBg: stats.unassignedGuests > 0 ? 'bg-amber-50/90' : 'bg-[#F5F2EB]',
      hasError: Boolean(guestError),
      navTarget: 'unassigned',
    },
    {
      id: 'messages',
      label: 'Wish Wall Messages',
      value: stats.totalWishMessages,
      subtext:
        stats.pendingMessages > 0
          ? `${stats.pendingMessages} awaiting review`
          : `${stats.approvedMessages} approved live`,
      icon: <MessageSquareHeart className="w-4 h-4" />,
      accentText: 'text-[#8B7344]',
      accentBg: 'bg-[#FAF5EA]',
      hasError: Boolean(messageError),
      navTarget: 'messages',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {cards.map((c) => (
          <div
            key={c.id}
            className="rounded-xl border border-[#E6E0D6] bg-white p-4 space-y-3 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 rounded bg-[#EFEAE0]" />
              <div className="h-7 w-7 rounded-lg bg-[#FAF7F0]" />
            </div>
            <div className="h-7 w-12 rounded bg-[#EFEAE0]" />
            <div className="h-2.5 w-24 rounded bg-[#F5F2EB]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
      {cards.map((card) => {
        const clickable = Boolean(onCardClick && card.navTarget);
        return (
          <button
            key={card.id}
            type="button"
            disabled={!clickable}
            onClick={() => clickable && card.navTarget && onCardClick?.(card.navTarget)}
            className={`group text-left rounded-xl border border-[#E6E0D6] bg-white p-4 transition-all shadow-[0_1px_2px_rgba(37,37,37,0.025)] flex flex-col justify-between ${
              clickable
                ? 'hover:border-[#C9A24D]/70 hover:bg-[#FFFDF9] cursor-pointer'
                : 'cursor-default'
            }`}
          >
            <div className="flex items-start justify-between gap-2 w-full">
              <span className="text-[11px] font-medium text-[#70695F] leading-tight">
                {card.label}
              </span>
              <span
                className={`w-7 h-7 rounded-lg ${card.accentBg} ${card.accentText} flex items-center justify-center shrink-0`}
              >
                {card.icon}
              </span>
            </div>

            <div className="mt-3">
              {card.hasError ? (
                <div className="text-sm font-medium text-rose-700">Unavailable</div>
              ) : (
                <div className="font-serif text-2xl sm:text-[26px] font-normal text-[#23201C] leading-none tabular-nums">
                  {card.value}
                </div>
              )}
              <div className="mt-1.5 text-[11px] text-[#8A8276] truncate">
                {card.hasError ? 'Retry load above' : card.subtext}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default OverviewStatCards;
