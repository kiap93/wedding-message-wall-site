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
  rsvp_fields?: RSVPField[];
  created_at: string;
  updated_at: string;
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
  created_at: string;
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
  variant: 'masonry' | 'hanging' | 'floating' | 'grid';
  cardStyle?: string;
  animationType?: 'float' | 'slide' | 'pop' | 'fade';
  iconType?: 'heart' | 'leaf' | 'star' | 'mail' | 'camera' | 'flower' | 'palette';
  is_custom?: boolean;
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
