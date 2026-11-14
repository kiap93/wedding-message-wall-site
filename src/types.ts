export interface Agency {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  logo_url?: string;
  domain?: string;
  theme?: string; // Aesthetic preset or custom JSON
  theme_config?: {
    primaryColor?: string;
    fontFamily?: string;
    accentColor?: string;
  };
  stripe_customer_id?: string;
  subscription_status?: 'active' | 'canceled' | 'past_due' | 'trialing' | 'unpaid';
  subscription_id?: string;
  plan_id?: string;
  is_demo?: boolean;
  user_role?: 'agency' | 'couple';
  created_at: string;
}

export interface RSVPField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'radio' | 'checkbox';
  required: boolean;
  options?: string[]; // For select/radio/checkbox
  placeholder?: string;
  showIfAttending?: boolean; // Whether to only show this if they say they are attending
}

export interface WeddingEvent {
  id: string;
  agency_id: string;
  name: string;
  slug: string;
  groom_name: string;
  bride_name: string;
  wedding_date: string;
  location: string;
  theme_id: TemplateId;
  access_password?: string;
  auto_approve_messages?: boolean;
  image_url?: string;
  music_url?: string;
  rsvp_fields?: RSVPField[];
  invitation_config?: any; // JSON configuration for the Canva-like editor
  status?: 'draft' | 'active' | 'expired' | 'archived' | 'pending_payment';
  payment_status?: 'unpaid' | 'paid' | 'refunded' | 'pending_payment' | 'failed' | 'cancelled';
  package_id?: string;
  activated_at?: string;
  expires_at?: string;
  message_display_config?: MessageDisplayConfig;
  website_config?: any;
  website_status?: 'draft' | 'published' | 'unpublished';
  website_published_at?: string;
  website_published_config?: any;
  website_preview_token?: string;
  created_at: string;
  updated_at: string;
}

export type MessageClassification = 'NORMAL' | 'AI_SUGGESTED' | 'SPECIAL_GUEST' | 'COUPLE_SELECTED';

export type WishCategory = 'normal' | 'funny' | 'heartfelt' | 'family';
export type DanmakuDirection = 'rtl' | 'ltr' | 'ttb' | 'btt';
export type DanmakuDirectionSlug =
  | 'right-to-left'
  | 'left-to-right'
  | 'top-to-bottom'
  | 'bottom-to-top';
export type DanmakuDirectionInput = DanmakuDirection | DanmakuDirectionSlug;
export type DanmakuDirectionMode = 'single' | 'mixed';
export type DanmakuDensity = 'relaxed' | 'balanced' | 'celebration';
export type DanmakuFontSize = 'sm' | 'md' | 'lg';
export type DanmakuSpecialStyle = 'champagne-gold' | 'theme-accent' | 'minimal-editorial';
export type AnimationIntensity = 'subtle' | 'moderate' | 'lively';

export const ALL_DANMAKU_DIRECTIONS: DanmakuDirection[] = ['rtl', 'ltr', 'ttb', 'btt'];

export const DANMAKU_DIRECTION_META: Record<
  DanmakuDirection,
  {
    code: DanmakuDirection;
    slug: DanmakuDirectionSlug;
    label: string;
    shortLabel: string;
    axis: 'horizontal' | 'vertical';
  }
> = {
  rtl: {
    code: 'rtl',
    slug: 'right-to-left',
    label: 'Right → Left',
    shortLabel: 'RTL',
    axis: 'horizontal',
  },
  ltr: {
    code: 'ltr',
    slug: 'left-to-right',
    label: 'Left → Right',
    shortLabel: 'LTR',
    axis: 'horizontal',
  },
  ttb: {
    code: 'ttb',
    slug: 'top-to-bottom',
    label: 'Top → Bottom',
    shortLabel: 'TTB',
    axis: 'vertical',
  },
  btt: {
    code: 'btt',
    slug: 'bottom-to-top',
    label: 'Bottom → Top',
    shortLabel: 'BTT',
    axis: 'vertical',
  },
};

export function normalizeDanmakuDirection(raw?: unknown): DanmakuDirection {
  if (typeof raw !== 'string') return 'rtl';
  switch (raw.trim().toLowerCase()) {
    case 'ltr':
    case 'left-to-right':
      return 'ltr';
    case 'ttb':
    case 'top-to-bottom':
      return 'ttb';
    case 'btt':
    case 'bottom-to-top':
      return 'btt';
    case 'rtl':
    case 'right-to-left':
    default:
      return 'rtl';
  }
}

export function directionToSlug(raw: DanmakuDirectionInput): DanmakuDirectionSlug {
  return DANMAKU_DIRECTION_META[normalizeDanmakuDirection(raw)].slug;
}

export function slugToDirection(raw: DanmakuDirectionInput): DanmakuDirection {
  return normalizeDanmakuDirection(raw);
}

export interface DanmakuNestedConfig {
  directionMode: DanmakuDirectionMode;
  directions: DanmakuDirectionSlug[];
  preset: DanmakuDensity;
}

export interface DanmakuDensityPreset {
  id: DanmakuDensity;
  label: string;
  description: string;
  spawnIntervalMs: number;
  minGapPx: number;
  minVerticalGapPx: number;
  crossGapPx: number;
  maxConcurrentPerTrack: number;
  maxConcurrentPerVerticalTrack: number;
  maxTotalActive: number;
  speedMultiplier: number;
}

export const DANMAKU_DENSITY_PRESETS: Record<DanmakuDensity, DanmakuDensityPreset> = {
  relaxed: {
    id: 'relaxed',
    label: 'Relaxed',
    description: 'Generous breathing room & unhurried ballroom pace',
    spawnIntervalMs: 1850,
    minGapPx: 140,
    minVerticalGapPx: 110,
    crossGapPx: 48,
    maxConcurrentPerTrack: 2,
    maxConcurrentPerVerticalTrack: 2,
    maxTotalActive: 8,
    speedMultiplier: 0.82,
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    description: 'Refined editorial cadence for effortless reading',
    spawnIntervalMs: 1100,
    minGapPx: 88,
    minVerticalGapPx: 72,
    crossGapPx: 30,
    maxConcurrentPerTrack: 3,
    maxConcurrentPerVerticalTrack: 3,
    maxTotalActive: 14,
    speedMultiplier: 1.0,
  },
  celebration: {
    id: 'celebration',
    label: 'Celebration',
    description: 'Lively multi-track stream for peak reception moments',
    spawnIntervalMs: 650,
    minGapPx: 54,
    minVerticalGapPx: 46,
    crossGapPx: 20,
    maxConcurrentPerTrack: 5,
    maxConcurrentPerVerticalTrack: 4,
    maxTotalActive: 22,
    speedMultiplier: 1.16,
  },
};

export interface MessageDisplayConfig {
  normalDuration: number; // Duration in seconds
  specialGuestDuration: number; // Duration in seconds
  coupleSelectedDuration: number; // Duration in seconds
  featuredFrequency: number; // Every N messages / cycles
  spotlightAnimation: 'fade-scale' | 'cinematic-glide' | 'elegant-spotlight';
  maxConsecutiveFeatured: number; // Max consecutive featured
  // Luxury Wedding Danmaku Engine Settings
  danmakuEnabled?: boolean;
  danmakuDirectionMode?: DanmakuDirectionMode;
  danmakuDirection?: DanmakuDirection;
  danmakuDirections?: DanmakuDirection[];
  danmaku?: Partial<DanmakuNestedConfig>;
  danmakuSpeed?: number; // Base speed in px/s (e.g. 75 - 180)
  danmakuTracks?: 'auto' | number;
  danmakuFontSize?: DanmakuFontSize;
  danmakuDensity?: DanmakuDensity;
  danmakuOpacity?: number; // 0.55 - 1.0
  danmakuSpecialStyle?: DanmakuSpecialStyle;
  spotlightDuration?: number; // 5 - 12 seconds
  showSenderNames?: boolean;
  showActivityStats?: boolean;
  animationIntensity?: AnimationIntensity;
}

export const DEFAULT_MESSAGE_DISPLAY_CONFIG: MessageDisplayConfig = {
  normalDuration: 8,
  specialGuestDuration: 12,
  coupleSelectedDuration: 16,
  featuredFrequency: 3,
  spotlightAnimation: 'elegant-spotlight',
  maxConsecutiveFeatured: 1,
  danmakuEnabled: true,
  danmakuDirectionMode: 'single',
  danmakuDirection: 'rtl',
  danmakuDirections: ['rtl', 'ltr', 'ttb', 'btt'],
  danmaku: {
    directionMode: 'single',
    directions: ['right-to-left'],
    preset: 'balanced',
  },
  danmakuSpeed: 112,
  danmakuTracks: 'auto',
  danmakuFontSize: 'md',
  danmakuDensity: 'balanced',
  danmakuOpacity: 0.92,
  danmakuSpecialStyle: 'champagne-gold',
  spotlightDuration: 7,
  showSenderNames: true,
  showActivityStats: true,
  animationIntensity: 'moderate',
};

export type ResolvedMessageDisplayConfig = Required<
  Omit<MessageDisplayConfig, 'danmaku'>
> & {
  danmaku: DanmakuNestedConfig;
};

function normalizeDirectionList(rawList?: unknown): DanmakuDirection[] {
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return [];
  }
  const seen = new Set<DanmakuDirection>();
  for (const item of rawList) {
    seen.add(normalizeDanmakuDirection(item));
  }
  return Array.from(seen);
}

export function resolveDisplayConfig(
  config?: Partial<MessageDisplayConfig> | null
): ResolvedMessageDisplayConfig {
  const rawNested = config?.danmaku;

  const rawDensity =
    config?.danmakuDensity !== undefined
      ? config.danmakuDensity
      : rawNested?.preset;
  const danmakuDensity: DanmakuDensity =
    rawDensity === 'relaxed' || rawDensity === 'celebration' ? rawDensity : 'balanced';

  const rawMode =
    config?.danmakuDirectionMode !== undefined
      ? config.danmakuDirectionMode
      : rawNested?.directionMode;
  const danmakuDirectionMode: DanmakuDirectionMode =
    rawMode === 'mixed' ? 'mixed' : 'single';

  const nestedDirs = normalizeDirectionList(rawNested?.directions);
  const flatDirs = normalizeDirectionList(config?.danmakuDirections);

  const primaryDirection =
    config?.danmakuDirection !== undefined
      ? normalizeDanmakuDirection(config.danmakuDirection)
      : nestedDirs.length > 0
        ? nestedDirs[0]
        : 'rtl';

  let danmakuDirections: DanmakuDirection[];
  if (danmakuDirectionMode === 'mixed') {
    if (flatDirs.length > 0) {
      danmakuDirections = flatDirs;
    } else if (nestedDirs.length > 0) {
      danmakuDirections = nestedDirs;
    } else {
      danmakuDirections = [...ALL_DANMAKU_DIRECTIONS];
    }
  } else {
    danmakuDirections = [primaryDirection];
  }

  return {
    ...DEFAULT_MESSAGE_DISPLAY_CONFIG,
    ...(config || {}),
    danmakuEnabled: config?.danmakuEnabled ?? true,
    danmakuDirectionMode,
    danmakuDirection: primaryDirection,
    danmakuDirections,
    danmaku: {
      directionMode: danmakuDirectionMode,
      directions: danmakuDirections.map(directionToSlug),
      preset: danmakuDensity,
    },
    danmakuSpeed: typeof config?.danmakuSpeed === 'number'
      ? Math.max(50, Math.min(240, config.danmakuSpeed))
      : DEFAULT_MESSAGE_DISPLAY_CONFIG.danmakuSpeed!,
    danmakuTracks: config?.danmakuTracks === 'auto' || config?.danmakuTracks === undefined
      ? 'auto'
      : Math.max(2, Math.min(14, Number(config.danmakuTracks) || 6)),
    danmakuFontSize: config?.danmakuFontSize === 'sm' || config?.danmakuFontSize === 'lg' ? config.danmakuFontSize : 'md',
    danmakuDensity,
    danmakuOpacity: typeof config?.danmakuOpacity === 'number'
      ? Math.max(0.45, Math.min(1, config.danmakuOpacity))
      : DEFAULT_MESSAGE_DISPLAY_CONFIG.danmakuOpacity!,
    danmakuSpecialStyle: config?.danmakuSpecialStyle === 'theme-accent' || config?.danmakuSpecialStyle === 'minimal-editorial'
      ? config.danmakuSpecialStyle
      : 'champagne-gold',
    spotlightDuration: typeof config?.spotlightDuration === 'number'
      ? Math.max(4, Math.min(15, config.spotlightDuration))
      : DEFAULT_MESSAGE_DISPLAY_CONFIG.spotlightDuration!,
    showSenderNames: config?.showSenderNames ?? true,
    showActivityStats: config?.showActivityStats ?? true,
    animationIntensity: config?.animationIntensity === 'subtle' || config?.animationIntensity === 'lively'
      ? config.animationIntensity
      : 'moderate',
  };
}

export interface Message {
  id: string;
  name: string;
  message: string;
  timestamp: number;
  project_id?: string;
  room_id?: string;
  status?: 'pending' | 'approved' | 'rejected';
  classification?: MessageClassification;
  wish_category?: WishCategory;
  is_featured?: boolean;
  is_pinned?: boolean;
  isDemoSample?: boolean;
  ai_highlight_reason?: string;
  guest_category?: string;
}


export interface EventOrder {
  id: string;
  event_id: string;
  agency_id: string;
  customer_id: string;
  package_id: string;
  package_snapshot: {
    id: string;
    name: string;
    price: number;
    currency: string;
    guestLimit: number;
    durationMonths: number;
    features: string[];
  };
  amount: number; // in cents
  currency: string;
  order_status: 'pending' | 'completed' | 'failed' | 'cancelled';
  order_type: 'purchase' | 'renewal' | 'upgrade';
  stripe_session_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface EventPayment {
  id: string;
  order_id: string;
  event_id: string;
  provider: 'stripe' | 'manual' | 'legacy_migration';
  provider_transaction_id?: string;
  amount: number;
  currency: string;
  payment_status: 'pending' | 'succeeded' | 'failed';
  paid_at?: string;
  created_at: string;
}

export interface EventEntitlement {
  id: string;
  event_id: string;
  order_id?: string;
  guest_limit: number;
  features: string[];
  activated_at: string;
  expires_at: string;
  created_at: string;
}

export interface RSVP {
  id: string;
  project_id: string;
  name: string;
  email?: string;
  attending: boolean;
  guest_count: number;
  meal_preference?: string;
  dietary_requirements?: string;
  responses?: Record<string, any>;
  is_vip?: boolean;
  guest_category?: string;
  created_at: string;
}

// --- Guest List, Table Assignment & Hall Planner Types ---

export type GuestRSVPStatus = 'pending' | 'attending' | 'declined';

export interface GuestGroup {
  id: string;
  project_id: string;
  group_name: string;
  invitation_reference?: string;
  color?: string;
  notes?: string;
  member_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Guest {
  id: string;
  project_id: string;
  guest_group_id?: string | null;
  guest_group?: GuestGroup | null;
  full_name: string;
  email?: string;
  phone?: string;
  rsvp_status: GuestRSVPStatus;
  pax: number;
  meal_preference?: string;
  dietary_notes?: string;
  notes?: string;
  is_vip?: boolean;
  is_plus_one?: boolean;
  primary_guest_id?: string | null;
  primary_guest_name?: string | null;
  rsvp_id?: string | null;
  assigned_table_id?: string | null;
  assigned_table_name?: string | null;
  assigned_table_number?: string | null;
  seat_number?: number | null;
  created_at: string;
  updated_at: string;
}

export type TableType = 'round' | 'rectangular' | 'square' | 'custom';

export interface SeatingTable {
  id: string;
  project_id: string;
  table_name: string;
  table_number: string;
  table_type: TableType;
  capacity: number;
  category?: string;
  notes?: string;
  position_x?: number;
  position_y?: number;
  rotation?: number;
  assigned_guests?: Guest[];
  assigned_count?: number;
  remaining_seats?: number;
  created_at: string;
  updated_at: string;
}

export interface SeatingAssignment {
  id: string;
  project_id: string;
  guest_id: string;
  seating_table_id: string;
  seat_number?: number;
  created_at: string;
  updated_at: string;
}

export type VenueObjectType = 
  | 'table' 
  | 'stage' 
  | 'couple_table' 
  | 'entrance' 
  | 'dance_floor' 
  | 'buffet' 
  | 'bar' 
  | 'photo_booth' 
  | 'registration' 
  | 'pillar' 
  | 'wall' 
  | 'decor' 
  | 'label';

export interface VenueLayoutObject {
  id: string;
  venue_layout_id: string;
  project_id: string;
  object_type: VenueObjectType;
  object_reference_id?: string | null; // e.g. seating_table_id
  label?: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  rotation: number;
  properties?: Record<string, any>;
  z_index?: number;
  created_at: string;
  updated_at: string;
}

export interface VenueLayout {
  id: string;
  project_id: string;
  layout_name: string;
  venue_width?: number;
  venue_height?: number;
  venue_unit?: 'm' | 'ft';
  venue_orientation?: 'landscape' | 'portrait';
  venue_name?: string;
  venue_description?: string;
  grid_unit_step?: number;
  show_grid?: boolean;
  show_rulers?: boolean;
  coordinate_system?: string;
  is_migrated?: boolean;
  canvas_width: number;
  canvas_height: number;
  grid_size: number;
  snap_to_grid: boolean;
  objects: VenueLayoutObject[];
  created_at: string;
  updated_at: string;
}

export type TemplateId = string;

export interface TemplateColors {
  background: string;
  card: string;
  text: string;
  accent: string;
  border: string;
  headerText: string;
  subtleText: string;
  iconColor?: string;
  overlay?: string;
}

export interface WeddingTemplate {
  id: TemplateId;
  name: string;
  description: string;
  colors: TemplateColors;
  fontSerif: string;
  fontSans: string;
  variant: 'masonry' | 'hanging' | 'floating' | 'grid' | 'custom';
  cardStyle?: string;
  animationType?: 'float' | 'slide' | 'pop' | 'fade';
  iconType?: 'heart' | 'leaf' | 'star' | 'mail' | 'camera' | 'flower' | 'palette';
  is_custom?: boolean;
  html?: string;
  css?: string;
  card_html?: string;
}

export const DEFAULT_TEMPLATES: WeddingTemplate[] = [
  {
    id: 'garden',
    name: 'Natural Garden',
    description: 'Natural greens, eucalyptus, and wooden textures.',
    variant: 'hanging',
    colors: {
      background: 'bg-[#F1F3F0]',
      card: 'bg-white/80',
      text: 'text-[#2C3E2D]',
      accent: 'text-[#829D82]',
      border: 'border-[#829D82]/20',
      headerText: 'text-[#2C3E2D]',
      subtleText: 'text-[#2C3E2D]/60',
      iconColor: 'text-[#829D82]',
    },
    fontSerif: 'font-serif',
    fontSans: 'font-sans',
    iconType: 'leaf',
  },
  {
    id: 'minimal_luxury',
    name: 'Minimal Luxury',
    description: 'Marble patterns, metallic frames, and high-end elegance.',
    variant: 'masonry',
    colors: {
      background: 'bg-[#F8F8F8]',
      card: 'bg-white/95',
      text: 'text-[#1A1A1A]',
      accent: 'text-[#D4AF37]',
      border: 'border-[#D4AF37]/30',
      headerText: 'text-[#1A1A1A]',
      subtleText: 'text-[#1A1A1A]/50',
    },
    fontSerif: 'font-serif',
    fontSans: 'font-sans',
    iconType: 'heart',
  },
  {
    id: 'romantic',
    name: 'Romantic Love',
    description: 'Warm pinks, roses, and dreamy lanterns.',
    variant: 'masonry',
    colors: {
      background: 'bg-[#FFF5F5]',
      card: 'bg-white/90',
      text: 'text-[#4A1D1D]',
      accent: 'text-[#FF8585]',
      border: 'border-[#FF8585]/20',
      headerText: 'text-[#4A1D1D]',
      subtleText: 'text-[#4A1D1D]/60',
    },
    fontSerif: 'font-serif',
    fontSans: 'font-sans',
    iconType: 'heart',
  },
  {
    id: 'postal',
    name: 'Postal Archive',
    description: 'Envelopes, stamps, and letter-writing rituals.',
    variant: 'grid',
    colors: {
      background: 'bg-[#F5E6D3]',
      card: 'bg-[#FAFAFA]',
      text: 'text-[#3E2723]',
      accent: 'text-[#8D6E63]',
      border: 'border-[#8D6E63]/30',
      headerText: 'text-[#3E2723]',
      subtleText: 'text-[#3E2723]/60',
    },
    fontSerif: 'font-serif',
    fontSans: 'font-mono',
    iconType: 'mail',
  },
  {
    id: 'polaroid',
    name: 'Polaroid Wall',
    description: 'Instant film frames and casual interactive memories.',
    variant: 'masonry',
    colors: {
      background: 'bg-[#222222]',
      card: 'bg-white',
      text: 'text-gray-900',
      accent: 'text-blue-500',
      border: 'border-gray-200',
      headerText: 'text-white',
      subtleText: 'text-white/60',
    },
    fontSerif: 'font-sans',
    fontSans: 'font-sans',
    iconType: 'camera',
  },
  {
    id: 'starry',
    name: 'Starry Dream',
    description: 'Midnight blues, sparkling lights, and celestial magic.',
    variant: 'floating',
    colors: {
      background: 'bg-[#0B1026]',
      card: 'bg-white/5',
      text: 'text-white',
      accent: 'text-[#E0E7FF]',
      border: 'border-white/20',
      headerText: 'text-white',
      subtleText: 'text-white/40',
    },
    fontSerif: 'font-serif',
    fontSans: 'font-sans',
    iconType: 'star',
  },
  {
    id: 'vintage',
    name: 'Vintage Noir',
    description: 'Retro cameras, kraft paper, and cinematic nostalgia.',
    variant: 'masonry',
    colors: {
      background: 'bg-[#E7E0D2]',
      card: 'bg-[#FDFBF7]',
      text: 'text-[#2D2926]',
      accent: 'text-[#6B5E4C]',
      border: 'border-[#6B5E4C]/20',
      headerText: 'text-[#2D2926]',
      subtleText: 'text-[#2D2926]/60',
    },
    fontSerif: 'font-serif',
    fontSans: 'font-serif',
    iconType: 'camera',
  },
  {
    id: 'digital',
    name: 'Digital Edge',
    description: 'High-tech displays and real-time social streams.',
    variant: 'grid',
    colors: {
      background: 'bg-[#000000]',
      card: 'bg-[#121212]',
      text: 'text-white',
      accent: 'text-[#00FF41]',
      border: 'border-[#00FF41]/20',
      headerText: 'text-[#00FF41]',
      subtleText: 'text-white/50',
    },
    fontSerif: 'font-sans',
    fontSans: 'font-mono',
  },
  {
    id: 'cute',
    name: 'Playful Fun',
    description: 'Cute illustrations, stickers, and vibrant joy.',
    variant: 'masonry',
    colors: {
      background: 'bg-[#FEF9E7]',
      card: 'bg-white',
      text: 'text-[#5D4037]',
      accent: 'text-[#FBC02D]',
      border: 'border-[#FBC02D]/30',
      headerText: 'text-[#5D4037]',
      subtleText: 'text-[#5D4037]/60',
    },
    fontSerif: 'font-sans',
    fontSans: 'font-sans',
  },
  {
    id: 'minimalist',
    name: 'Pure Minimal',
    description: 'Clean lines, neutral palette, and pure focus.',
    variant: 'masonry',
    colors: {
      background: 'bg-white',
      card: 'bg-gray-50',
      text: 'text-black',
      accent: 'text-gray-400',
      border: 'border-gray-200',
      headerText: 'text-black',
      subtleText: 'text-gray-500',
    },
    fontSerif: 'font-sans',
    fontSans: 'font-sans',
  },
  {
    id: 'gallery',
    name: 'Art Gallery',
    description: 'Curated frames and storytelling narrative.',
    variant: 'masonry',
    colors: {
      background: 'bg-[#F2EDEB]',
      card: 'bg-white',
      text: 'text-[#3E2723]',
      accent: 'text-[#BCAAA4]',
      border: 'border-[#3E2723]/10',
      headerText: 'text-[#3E2723]',
      subtleText: 'text-[#3E2723]/60',
    },
    fontSerif: 'font-serif',
    fontSans: 'font-sans',
  },
  {
    id: 'creative',
    name: 'Creative Canvas',
    description: 'Artistic doodles, mixed textures, and unique shapes.',
    variant: 'masonry',
    colors: {
      background: 'bg-[#FDF6E3]',
      card: 'bg-[#EEE8D5]',
      text: 'text-[#586E75]',
      accent: 'text-[#268BD2]',
      border: 'border-[#93A1A1]/20',
      headerText: 'text-[#657B83]',
      subtleText: 'text-[#839496]',
    },
    fontSerif: 'font-sans',
    fontSans: 'font-serif',
  }
];

export const TEMPLATES = DEFAULT_TEMPLATES;

// ============================================================================
// MULTILINGUAL TRANSLATION ENGINE TYPES
// ============================================================================

export type SupportedLanguageCode = 'en' | 'zh-CN' | 'zh-TW' | 'ms';

export type TranslationPublicationStatus = 'draft' | 'published';

export type TranslationStatus = 'draft' | 'translated' | 'needs_review' | 'auto_translated';

export interface LanguageMeta {
  code: string;
  name: string;
  nativeName: string;
  flag?: string;
  direction?: 'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'zh-CN', name: 'Simplified Chinese', nativeName: '简体中文', flag: '🇨🇳' },
  { code: 'zh-TW', name: 'Traditional Chinese', nativeName: '繁體中文', flag: '🇹🇼' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾' }
];

export interface EventLanguage {
  id: string;
  event_id: string;
  language_code: string;
  is_enabled: boolean;
  is_default: boolean;
  publication_status: TranslationPublicationStatus;
  created_at?: string;
  updated_at?: string;
  // Computed stats
  completion_percentage?: number;
  total_keys?: number;
  translated_keys?: number;
  needs_review_count?: number;
}

export interface EventTranslation {
  id: string;
  event_id: string;
  language_code: string;
  content_key: string;
  translated_value: string;
  source_hash: string;
  translation_status: TranslationStatus;
  updated_at?: string;
}

export interface TranslationDictionary {
  [content_key: string]: string;
}

export interface EventTranslationPackage {
  event_id: string;
  default_language: string;
  current_language: string;
  languages: EventLanguage[];
  translations: TranslationDictionary;
}
