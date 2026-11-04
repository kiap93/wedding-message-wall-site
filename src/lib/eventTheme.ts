import React from 'react';
import { 
  Heart, 
  Leaf, 
  Star, 
  Mail, 
  Camera, 
  Flower, 
  Sparkles,
  LucideIcon 
} from 'lucide-react';
import { WeddingTemplate, DEFAULT_TEMPLATES, TemplateId } from '../types';

export interface ThemeColors {
  background: string;
  card: string;
  border: string;
  headerText: string;
  text: string;
  subtleText: string;
  accent: string;
  surfaceInput: string;
  borderInput: string;
  textInput: string;
  placeholderInput: string;
  focusRing: string;
}

export interface ThemeButtonStyles {
  primary: string;
  secondary: string;
  toggleActive: string;
  toggleInactive: string;
  pillActive: string;
  pillInactive: string;
}

export interface ThemeCardStyles {
  surface: string;
  border: string;
  radius: string;
  shadow: string;
}

export interface ThemeDisplayStyles {
  layoutVariant: 'masonry' | 'hanging' | 'floating' | 'grid' | 'custom';
  messageCardBase: string;
  headerSubtitle: string;
  emptyStateText: string;
}

export interface ResolvedEventTheme {
  id: TemplateId;
  name: string;
  description: string;
  isDark: boolean;
  isCustom: boolean;
  fontSerif: string;
  fontSans: string;
  fontHeading: string;
  fontBody: string;
  colors: ThemeColors;
  card: ThemeCardStyles;
  button: ThemeButtonStyles;
  input: {
    base: string;
    radius: string;
  };
  qrButton: {
    buttonClass: string;
    modalCardClass: string;
  };
  confettiColors: string[];
  iconType: 'heart' | 'leaf' | 'star' | 'mail' | 'camera' | 'flower' | 'palette';
  IconComponent: LucideIcon;
  display: ThemeDisplayStyles;
  agencyBadgeClass: string;
  rawTemplate: WeddingTemplate;
}

// Map icon types to Lucide components
export function getIconComponent(iconType?: string): LucideIcon {
  switch (iconType) {
    case 'leaf': return Leaf;
    case 'star': return Star;
    case 'mail': return Mail;
    case 'camera': return Camera;
    case 'flower': return Flower;
    case 'palette': return Sparkles;
    default: return Heart;
  }
}

// Preset visual profiles for each default aesthetic
const AESTHETIC_PROFILES: Record<string, Partial<ResolvedEventTheme>> = {
  garden: {
    isDark: false,
    fontSerif: 'font-serif',
    fontSans: 'font-sans',
    fontHeading: 'font-serif',
    fontBody: 'font-sans',
    colors: {
      background: 'bg-[#F1F3F0]',
      card: 'bg-white/85',
      border: 'border-[#829D82]/25',
      headerText: 'text-[#2C3E2D]',
      text: 'text-[#2C3E2D]',
      subtleText: 'text-[#2C3E2D]/65',
      accent: 'text-[#6B856B]',
      surfaceInput: 'bg-white/80',
      borderInput: 'border-[#829D82]/30',
      textInput: 'text-[#2C3E2D]',
      placeholderInput: 'placeholder-[#2C3E2D]/40',
      focusRing: 'focus:ring-2 focus:ring-[#829D82]/30 focus:border-[#6B856B]',
    },
    card: {
      surface: 'bg-white/85 backdrop-blur-md',
      border: 'border border-[#829D82]/25',
      radius: 'rounded-2xl',
      shadow: 'shadow-sm',
    },
    button: {
      primary: 'bg-[#6B856B] text-white hover:bg-[#5A725A] shadow-sm rounded-xl font-medium transition-all active:scale-[0.99]',
      secondary: 'bg-white/70 text-[#2C3E2D] hover:bg-white border border-[#829D82]/25 rounded-xl transition-all',
      toggleActive: 'bg-white text-[#2C3E2D] shadow-sm border border-[#829D82]/20 font-medium',
      toggleInactive: 'text-[#2C3E2D]/55 hover:text-[#2C3E2D] font-normal',
      pillActive: 'bg-[#6B856B] text-white border-[#6B856B] font-semibold',
      pillInactive: 'bg-white/60 text-[#2C3E2D]/60 border-[#829D82]/25 hover:border-[#829D82]/50',
    },
    input: {
      base: 'bg-white/80 border-[#829D82]/30 text-[#2C3E2D] placeholder-[#2C3E2D]/40 focus:ring-2 focus:ring-[#829D82]/30 focus:border-[#6B856B]',
      radius: 'rounded-xl',
    },
    qrButton: {
      buttonClass: 'bg-[#6B856B] text-white hover:bg-[#5A725A] shadow-md',
      modalCardClass: 'bg-white/95 border border-[#829D82]/25 shadow-xl backdrop-blur-md rounded-2xl',
    },
    confettiColors: ['#829D82', '#4E614E', '#B7C9B7', '#F1F3F0', '#FFFFFF'],
    iconType: 'leaf',
    agencyBadgeClass: 'bg-white/70 text-[#2C3E2D] border border-[#829D82]/20 shadow-xs',
    display: {
      layoutVariant: 'hanging',
      messageCardBase: 'bg-[#FAF8F5]/90 border border-[#829D82]/25 rounded-2xl shadow-md text-[#2C3E2D]',
      headerSubtitle: 'Botanical Garden Wall',
      emptyStateText: 'Awaiting the first wedding blessing among the leaves...',
    }
  },

  minimal_luxury: {
    isDark: false,
    fontSerif: 'font-serif',
    fontSans: 'font-sans',
    fontHeading: 'font-serif',
    fontBody: 'font-sans',
    colors: {
      background: 'bg-[#F8F8F8]',
      card: 'bg-white/95',
      border: 'border-[#D4AF37]/30',
      headerText: 'text-[#1A1A1A]',
      text: 'text-[#1A1A1A]',
      subtleText: 'text-[#1A1A1A]/55',
      accent: 'text-[#BFA15F]',
      surfaceInput: 'bg-white',
      borderInput: 'border-[#D4AF37]/35',
      textInput: 'text-[#1A1A1A]',
      placeholderInput: 'placeholder-[#1A1A1A]/40',
      focusRing: 'focus:ring-1 focus:ring-[#BFA15F] focus:border-[#BFA15F]',
    },
    card: {
      surface: 'bg-white/95 backdrop-blur-md',
      border: 'border border-[#D4AF37]/30',
      radius: 'rounded-xl',
      shadow: 'shadow-card',
    },
    button: {
      primary: 'bg-[#1A1A1A] text-[#FAF8F5] hover:bg-[#2C2C2C] border border-[#D4AF37]/40 shadow-sm rounded-lg font-medium transition-all active:scale-[0.99]',
      secondary: 'bg-white text-[#1A1A1A] hover:bg-[#FAF8F5] border border-[#E8E8E5] rounded-lg transition-all',
      toggleActive: 'bg-white text-[#1A1A1A] shadow-subtle border border-[#D4AF37]/30 font-medium',
      toggleInactive: 'text-[#1A1A1A]/50 hover:text-[#1A1A1A] font-normal',
      pillActive: 'bg-[#1A1A1A] text-white border-[#1A1A1A] font-medium',
      pillInactive: 'bg-white text-[#1A1A1A]/60 border-[#E8E8E5] hover:border-[#D4AF37]/40',
    },
    input: {
      base: 'bg-white border-[#D4AF37]/35 text-[#1A1A1A] placeholder-[#1A1A1A]/40 focus:ring-1 focus:ring-[#BFA15F] focus:border-[#BFA15F]',
      radius: 'rounded-lg',
    },
    qrButton: {
      buttonClass: 'bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/40 hover:bg-[#2A2A2A] shadow-md',
      modalCardClass: 'bg-white/95 border border-[#D4AF37]/30 shadow-xl backdrop-blur-md rounded-xl',
    },
    confettiColors: ['#D4AF37', '#1A1A1A', '#FAF8F5', '#8B806F', '#FFFFFF'],
    iconType: 'heart',
    agencyBadgeClass: 'bg-white/80 text-[#1A1A1A] border border-[#D4AF37]/25 shadow-xs',
    display: {
      layoutVariant: 'masonry',
      messageCardBase: 'bg-white/95 border border-[#D4AF37]/30 rounded-xl shadow-md text-[#1A1A1A]',
      headerSubtitle: 'Editorial Reception Wall',
      emptyStateText: 'Awaiting the first note of celebration...',
    }
  },

  romantic: {
    isDark: false,
    fontSerif: 'font-serif',
    fontSans: 'font-sans',
    fontHeading: 'font-serif',
    fontBody: 'font-sans',
    colors: {
      background: 'bg-[#FFF5F5]',
      card: 'bg-white/90',
      border: 'border-[#FF8585]/25',
      headerText: 'text-[#4A1D1D]',
      text: 'text-[#4A1D1D]',
      subtleText: 'text-[#4A1D1D]/65',
      accent: 'text-[#E07A7A]',
      surfaceInput: 'bg-white/80',
      borderInput: 'border-[#FF8585]/30',
      textInput: 'text-[#4A1D1D]',
      placeholderInput: 'placeholder-[#4A1D1D]/40',
      focusRing: 'focus:ring-2 focus:ring-[#FF8585]/25 focus:border-[#E07A7A]',
    },
    card: {
      surface: 'bg-white/90 backdrop-blur-md',
      border: 'border border-[#FF8585]/25',
      radius: 'rounded-2xl',
      shadow: 'shadow-card',
    },
    button: {
      primary: 'bg-[#E07A7A] text-white hover:bg-[#CF6A6A] shadow-sm rounded-xl font-medium transition-all active:scale-[0.99]',
      secondary: 'bg-white/80 text-[#4A1D1D] hover:bg-white border border-[#FF8585]/25 rounded-xl transition-all',
      toggleActive: 'bg-white text-[#4A1D1D] shadow-sm border border-[#FF8585]/25 font-medium',
      toggleInactive: 'text-[#4A1D1D]/50 hover:text-[#4A1D1D] font-normal',
      pillActive: 'bg-[#E07A7A] text-white border-[#E07A7A] font-semibold',
      pillInactive: 'bg-white/60 text-[#4A1D1D]/60 border-[#FF8585]/20 hover:border-[#FF8585]/50',
    },
    input: {
      base: 'bg-white/80 border-[#FF8585]/30 text-[#4A1D1D] placeholder-[#4A1D1D]/40 focus:ring-2 focus:ring-[#FF8585]/25 focus:border-[#E07A7A]',
      radius: 'rounded-xl',
    },
    qrButton: {
      buttonClass: 'bg-[#E07A7A] text-white hover:bg-[#CF6A6A] shadow-md',
      modalCardClass: 'bg-white/95 border border-[#FF8585]/25 shadow-xl backdrop-blur-md rounded-2xl',
    },
    confettiColors: ['#FF8585', '#E07A7A', '#FFF0F0', '#FFFFFF', '#F472B6'],
    iconType: 'heart',
    agencyBadgeClass: 'bg-white/70 text-[#4A1D1D] border border-[#FF8585]/20 shadow-xs',
    display: {
      layoutVariant: 'masonry',
      messageCardBase: 'bg-white/90 border border-[#FF8585]/25 rounded-2xl shadow-md text-[#4A1D1D]',
      headerSubtitle: 'Romantic Love Stream',
      emptyStateText: 'Awaiting the first heartfelt wish for the happy couple...',
    }
  },

  postal: {
    isDark: false,
    fontSerif: 'font-serif',
    fontSans: 'font-mono',
    fontHeading: 'font-serif',
    fontBody: 'font-mono',
    colors: {
      background: 'bg-[#F5E6D3]',
      card: 'bg-[#FAFAFA]',
      border: 'border-[#8D6E63]/30',
      headerText: 'text-[#3E2723]',
      text: 'text-[#3E2723]',
      subtleText: 'text-[#3E2723]/65',
      accent: 'text-[#8D6E63]',
      surfaceInput: 'bg-white',
      borderInput: 'border-[#8D6E63]/30',
      textInput: 'text-[#3E2723]',
      placeholderInput: 'placeholder-[#3E2723]/40',
      focusRing: 'focus:ring-1 focus:ring-[#8D6E63] focus:border-[#8D6E63]',
    },
    card: {
      surface: 'bg-[#FAFAFA]',
      border: 'border-2 border-dashed border-[#8D6E63]/30',
      radius: 'rounded-md',
      shadow: 'shadow-sm',
    },
    button: {
      primary: 'bg-[#6D4C41] text-[#FAF6F0] hover:bg-[#5D3F35] rounded-md font-mono text-xs uppercase tracking-wider transition-all active:scale-[0.99]',
      secondary: 'bg-[#F5E6D3]/60 text-[#3E2723] hover:bg-[#F5E6D3] border border-[#8D6E63]/30 rounded-md font-mono text-xs transition-all',
      toggleActive: 'bg-[#FAFAFA] text-[#3E2723] border border-[#8D6E63]/40 font-mono shadow-xs',
      toggleInactive: 'text-[#3E2723]/50 hover:text-[#3E2723] font-mono',
      pillActive: 'bg-[#6D4C41] text-white border-[#6D4C41] font-mono',
      pillInactive: 'bg-white text-[#3E2723]/60 border-[#8D6E63]/30 font-mono hover:border-[#8D6E63]',
    },
    input: {
      base: 'bg-white border-[#8D6E63]/30 text-[#3E2723] placeholder-[#3E2723]/40 focus:ring-1 focus:ring-[#8D6E63] focus:border-[#8D6E63] font-mono text-xs',
      radius: 'rounded-md',
    },
    qrButton: {
      buttonClass: 'bg-[#6D4C41] text-[#FAF6F0] hover:bg-[#5D3F35] shadow-md rounded-md',
      modalCardClass: 'bg-[#FAFAFA] border-2 border-dashed border-[#8D6E63]/30 shadow-xl rounded-md',
    },
    confettiColors: ['#8D6E63', '#3E2723', '#F5E6D3', '#C7A793', '#FFFFFF'],
    iconType: 'mail',
    agencyBadgeClass: 'bg-white/80 text-[#3E2723] border border-[#8D6E63]/25 shadow-xs font-mono',
    display: {
      layoutVariant: 'grid',
      messageCardBase: 'bg-[#FAFAFA] border-2 border-dashed border-[#8D6E63]/30 rounded-md shadow-sm text-[#3E2723]',
      headerSubtitle: 'Postal Dispatch Archive',
      emptyStateText: 'Awaiting the first postmarked letter from your guests...',
    }
  },

  polaroid: {
    isDark: true,
    fontSerif: 'font-sans',
    fontSans: 'font-sans',
    fontHeading: 'font-sans',
    fontBody: 'font-sans',
    colors: {
      background: 'bg-[#1E1E1E]',
      card: 'bg-white',
      border: 'border-gray-200',
      headerText: 'text-white',
      text: 'text-gray-900',
      subtleText: 'text-gray-500',
      accent: 'text-blue-600',
      surfaceInput: 'bg-gray-50',
      borderInput: 'border-gray-300',
      textInput: 'text-gray-900',
      placeholderInput: 'placeholder-gray-400',
      focusRing: 'focus:ring-1 focus:ring-black focus:border-black',
    },
    card: {
      surface: 'bg-white text-gray-900',
      border: 'border border-gray-200',
      radius: 'rounded-sm',
      shadow: 'shadow-xl',
    },
    button: {
      primary: 'bg-black text-white hover:bg-neutral-800 rounded-sm font-medium transition-all active:scale-[0.99]',
      secondary: 'bg-gray-100 text-gray-800 hover:bg-gray-200 rounded-sm transition-all',
      toggleActive: 'bg-white text-black shadow-sm border border-gray-300 font-medium',
      toggleInactive: 'text-gray-500 hover:text-black font-normal',
      pillActive: 'bg-black text-white border-black font-semibold',
      pillInactive: 'bg-gray-100 text-gray-600 border-gray-200 hover:border-gray-400',
    },
    input: {
      base: 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-1 focus:ring-black focus:border-black',
      radius: 'rounded-sm',
    },
    qrButton: {
      buttonClass: 'bg-white text-black hover:bg-gray-100 shadow-lg border border-gray-200 rounded-sm',
      modalCardClass: 'bg-white border border-gray-200 shadow-2xl rounded-sm text-gray-900',
    },
    confettiColors: ['#3B82F6', '#111827', '#E5E7EB', '#FFFFFF', '#60A5FA'],
    iconType: 'camera',
    agencyBadgeClass: 'bg-white/10 text-white/90 border border-white/20 shadow-xs backdrop-blur-md',
    display: {
      layoutVariant: 'masonry',
      messageCardBase: 'bg-white text-gray-900 border border-gray-200 rounded-sm shadow-xl',
      headerSubtitle: 'Instant Film Memories',
      emptyStateText: 'Awaiting the first candid memory to pin on the wall...',
    }
  },

  starry: {
    isDark: true,
    fontSerif: 'font-serif',
    fontSans: 'font-sans',
    fontHeading: 'font-serif',
    fontBody: 'font-sans',
    colors: {
      background: 'bg-[#0B1026]',
      card: 'bg-white/10',
      border: 'border-white/20',
      headerText: 'text-white',
      text: 'text-white',
      subtleText: 'text-white/60',
      accent: 'text-[#38BDF8]',
      surfaceInput: 'bg-white/10',
      borderInput: 'border-white/20',
      textInput: 'text-white',
      placeholderInput: 'placeholder-white/40',
      focusRing: 'focus:ring-2 focus:ring-[#38BDF8]/40 focus:border-[#38BDF8]',
    },
    card: {
      surface: 'bg-white/10 backdrop-blur-xl',
      border: 'border border-white/20',
      radius: 'rounded-2xl',
      shadow: 'shadow-2xl',
    },
    button: {
      primary: 'bg-[#38BDF8] text-[#0B1026] hover:bg-[#0EA5E9] shadow-lg rounded-xl font-semibold transition-all active:scale-[0.99]',
      secondary: 'bg-white/10 text-white hover:bg-white/20 border border-white/20 rounded-xl transition-all',
      toggleActive: 'bg-white/20 text-white shadow-sm border border-white/30 font-medium',
      toggleInactive: 'text-white/50 hover:text-white font-normal',
      pillActive: 'bg-[#38BDF8] text-[#0B1026] border-[#38BDF8] font-bold',
      pillInactive: 'bg-white/10 text-white/70 border-white/20 hover:border-white/40',
    },
    input: {
      base: 'bg-white/10 border-white/20 text-white placeholder-white/40 focus:ring-2 focus:ring-[#38BDF8]/40 focus:border-[#38BDF8]',
      radius: 'rounded-xl',
    },
    qrButton: {
      buttonClass: 'bg-[#38BDF8] text-[#0B1026] hover:bg-[#0EA5E9] shadow-lg shadow-[#38BDF8]/20',
      modalCardClass: 'bg-[#0E1535]/95 border border-white/20 shadow-2xl backdrop-blur-2xl rounded-2xl text-white',
    },
    confettiColors: ['#38BDF8', '#818CF8', '#E0E7FF', '#FFFFFF', '#67E8F9'],
    iconType: 'star',
    agencyBadgeClass: 'bg-white/10 text-white/90 border border-white/20 shadow-xs backdrop-blur-md',
    display: {
      layoutVariant: 'floating',
      messageCardBase: 'bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl text-white',
      headerSubtitle: 'Celestial Love Constellation',
      emptyStateText: 'Awaiting the first star in tonight’s sky...',
    }
  },

  vintage: {
    isDark: false,
    fontSerif: 'font-serif',
    fontSans: 'font-serif',
    fontHeading: 'font-serif',
    fontBody: 'font-serif',
    colors: {
      background: 'bg-[#E7E0D2]',
      card: 'bg-[#FDFBF7]',
      border: 'border-[#6B5E4C]/25',
      headerText: 'text-[#2D2926]',
      text: 'text-[#2D2926]',
      subtleText: 'text-[#2D2926]/65',
      accent: 'text-[#6B5E4C]',
      surfaceInput: 'bg-[#FAF7EE]',
      borderInput: 'border-[#6B5E4C]/30',
      textInput: 'text-[#2D2926]',
      placeholderInput: 'placeholder-[#2D2926]/40',
      focusRing: 'focus:ring-1 focus:ring-[#6B5E4C] focus:border-[#6B5E4C]',
    },
    card: {
      surface: 'bg-[#FDFBF7]',
      border: 'border border-[#6B5E4C]/25',
      radius: 'rounded-xl',
      shadow: 'shadow-md',
    },
    button: {
      primary: 'bg-[#3D332A] text-[#FDFBF7] hover:bg-[#2C241E] rounded-lg font-serif transition-all active:scale-[0.99]',
      secondary: 'bg-[#E7E0D2]/60 text-[#2D2926] hover:bg-[#E7E0D2] border border-[#6B5E4C]/25 rounded-lg font-serif transition-all',
      toggleActive: 'bg-[#FDFBF7] text-[#2D2926] shadow-xs border border-[#6B5E4C]/30 font-serif',
      toggleInactive: 'text-[#2D2926]/50 hover:text-[#2D2926] font-serif',
      pillActive: 'bg-[#3D332A] text-[#FDFBF7] border-[#3D332A] font-serif',
      pillInactive: 'bg-[#FAF7EE] text-[#2D2926]/60 border-[#6B5E4C]/25 font-serif hover:border-[#6B5E4C]',
    },
    input: {
      base: 'bg-[#FAF7EE] border-[#6B5E4C]/30 text-[#2D2926] placeholder-[#2D2926]/40 focus:ring-1 focus:ring-[#6B5E4C] focus:border-[#6B5E4C] font-serif',
      radius: 'rounded-lg',
    },
    qrButton: {
      buttonClass: 'bg-[#3D332A] text-[#FDFBF7] hover:bg-[#2C241E] shadow-md rounded-lg',
      modalCardClass: 'bg-[#FDFBF7] border border-[#6B5E4C]/25 shadow-xl rounded-xl text-[#2D2926]',
    },
    confettiColors: ['#6B5E4C', '#3D332A', '#E7E0D2', '#D1C7B7', '#FFFFFF'],
    iconType: 'camera',
    agencyBadgeClass: 'bg-[#FDFBF7]/80 text-[#2D2926] border border-[#6B5E4C]/20 shadow-xs font-serif',
    display: {
      layoutVariant: 'masonry',
      messageCardBase: 'bg-[#FDFBF7] border border-[#6B5E4C]/25 rounded-xl shadow-md text-[#2D2926]',
      headerSubtitle: 'Chronicle of Well Wishes',
      emptyStateText: 'Awaiting the first note to be inscribed in the register...',
    }
  },

  digital: {
    isDark: true,
    fontSerif: 'font-sans',
    fontSans: 'font-mono',
    fontHeading: 'font-mono',
    fontBody: 'font-mono',
    colors: {
      background: 'bg-[#000000]',
      card: 'bg-[#0D0D0D]',
      border: 'border-[#00FF41]/30',
      headerText: 'text-[#00FF41]',
      text: 'text-white',
      subtleText: 'text-white/50',
      accent: 'text-[#00FF41]',
      surfaceInput: 'bg-black',
      borderInput: 'border-[#00FF41]/30',
      textInput: 'text-[#00FF41]',
      placeholderInput: 'placeholder-[#00FF41]/30',
      focusRing: 'focus:ring-1 focus:ring-[#00FF41] focus:border-[#00FF41]',
    },
    card: {
      surface: 'bg-[#0D0D0D]',
      border: 'border border-[#00FF41]/30',
      radius: 'rounded-none',
      shadow: 'shadow-none',
    },
    button: {
      primary: 'bg-[#00FF41] text-black hover:bg-[#00DD31] rounded-none font-mono font-bold tracking-wider uppercase text-xs transition-all active:scale-[0.99]',
      secondary: 'bg-black text-[#00FF41] hover:bg-[#121212] border border-[#00FF41]/30 rounded-none font-mono text-xs transition-all',
      toggleActive: 'bg-[#00FF41] text-black font-mono font-bold',
      toggleInactive: 'text-white/50 hover:text-white font-mono',
      pillActive: 'bg-[#00FF41] text-black border-[#00FF41] font-mono font-bold',
      pillInactive: 'bg-black text-white/60 border-white/20 font-mono hover:border-[#00FF41]/50',
    },
    input: {
      base: 'bg-black border-[#00FF41]/30 text-[#00FF41] placeholder-[#00FF41]/30 focus:ring-1 focus:ring-[#00FF41] focus:border-[#00FF41] font-mono text-xs',
      radius: 'rounded-none',
    },
    qrButton: {
      buttonClass: 'bg-[#00FF41] text-black hover:bg-[#00DD31] rounded-none shadow-none',
      modalCardClass: 'bg-black border border-[#00FF41]/40 rounded-none text-white shadow-2xl',
    },
    confettiColors: ['#00FF41', '#00DD31', '#121212', '#FFFFFF'],
    iconType: 'palette',
    agencyBadgeClass: 'bg-black text-[#00FF41] border border-[#00FF41]/40 font-mono shadow-none',
    display: {
      layoutVariant: 'grid',
      messageCardBase: 'bg-[#0D0D0D] border border-[#00FF41]/30 rounded-none text-white',
      headerSubtitle: 'Live Stream Terminal',
      emptyStateText: '[System Ready] Waiting for inbound guest stream...',
    }
  },

  cute: {
    isDark: false,
    fontSerif: 'font-sans',
    fontSans: 'font-sans',
    fontHeading: 'font-sans',
    fontBody: 'font-sans',
    colors: {
      background: 'bg-[#FEF9E7]',
      card: 'bg-white/95',
      border: 'border-[#FBC02D]/35',
      headerText: 'text-[#5D4037]',
      text: 'text-[#5D4037]',
      subtleText: 'text-[#5D4037]/65',
      accent: 'text-[#F57F17]',
      surfaceInput: 'bg-[#FFFDE7]/80',
      borderInput: 'border-[#FBC02D]/40',
      textInput: 'text-[#5D4037]',
      placeholderInput: 'placeholder-[#5D4037]/40',
      focusRing: 'focus:ring-2 focus:ring-[#FBC02D]/30 focus:border-[#FBC02D]',
    },
    card: {
      surface: 'bg-white/95 backdrop-blur-md',
      border: 'border border-[#FBC02D]/35',
      radius: 'rounded-2xl',
      shadow: 'shadow-card',
    },
    button: {
      primary: 'bg-[#FBC02D] text-[#5D4037] hover:bg-[#F9A825] font-semibold rounded-xl transition-all active:scale-[0.99]',
      secondary: 'bg-white text-[#5D4037] hover:bg-[#FFFDE7] border border-[#FBC02D]/30 rounded-xl transition-all',
      toggleActive: 'bg-white text-[#5D4037] shadow-sm border border-[#FBC02D]/30 font-semibold',
      toggleInactive: 'text-[#5D4037]/50 hover:text-[#5D4037]',
      pillActive: 'bg-[#FBC02D] text-[#5D4037] border-[#FBC02D] font-bold',
      pillInactive: 'bg-white text-[#5D4037]/60 border-[#FBC02D]/25 hover:border-[#FBC02D]',
    },
    input: {
      base: 'bg-[#FFFDE7]/80 border-[#FBC02D]/40 text-[#5D4037] placeholder-[#5D4037]/40 focus:ring-2 focus:ring-[#FBC02D]/30 focus:border-[#FBC02D]',
      radius: 'rounded-xl',
    },
    qrButton: {
      buttonClass: 'bg-[#FBC02D] text-[#5D4037] hover:bg-[#F9A825] shadow-md',
      modalCardClass: 'bg-white/95 border border-[#FBC02D]/35 shadow-xl backdrop-blur-md rounded-2xl',
    },
    confettiColors: ['#FBC02D', '#5D4037', '#FFF9C4', '#FFFFFF', '#FF8A65'],
    iconType: 'flower',
    agencyBadgeClass: 'bg-white/80 text-[#5D4037] border border-[#FBC02D]/30 shadow-xs',
    display: {
      layoutVariant: 'masonry',
      messageCardBase: 'bg-white/95 border border-[#FBC02D]/35 rounded-2xl shadow-card text-[#5D4037]',
      headerSubtitle: 'Joyful Celebration Stream',
      emptyStateText: 'Waiting for the first sweet note to arrive!',
    }
  },

  minimalist: {
    isDark: false,
    fontSerif: 'font-sans',
    fontSans: 'font-sans',
    fontHeading: 'font-sans',
    fontBody: 'font-sans',
    colors: {
      background: 'bg-[#FFFFFF]',
      card: 'bg-[#FAFAFA]',
      border: 'border-[#E5E7EB]',
      headerText: 'text-black',
      text: 'text-black',
      subtleText: 'text-gray-500',
      accent: 'text-black',
      surfaceInput: 'bg-white',
      borderInput: 'border-[#E5E7EB]',
      textInput: 'text-black',
      placeholderInput: 'placeholder-gray-400',
      focusRing: 'focus:ring-1 focus:ring-black focus:border-black',
    },
    card: {
      surface: 'bg-[#FAFAFA]',
      border: 'border border-[#E5E7EB]',
      radius: 'rounded-lg',
      shadow: 'shadow-subtle',
    },
    button: {
      primary: 'bg-black text-white hover:bg-neutral-800 rounded-md font-medium transition-all active:scale-[0.99]',
      secondary: 'bg-white text-black hover:bg-gray-50 border border-gray-200 rounded-md transition-all',
      toggleActive: 'bg-white text-black shadow-subtle border border-[#E5E7EB] font-medium',
      toggleInactive: 'text-gray-400 hover:text-black',
      pillActive: 'bg-black text-white border-black font-medium',
      pillInactive: 'bg-white text-gray-500 border-gray-200 hover:border-black',
    },
    input: {
      base: 'bg-white border-[#E5E7EB] text-black placeholder-gray-400 focus:ring-1 focus:ring-black focus:border-black',
      radius: 'rounded-md',
    },
    qrButton: {
      buttonClass: 'bg-black text-white hover:bg-neutral-800 shadow-md rounded-md',
      modalCardClass: 'bg-white border border-[#E5E7EB] shadow-xl rounded-lg text-black',
    },
    confettiColors: ['#000000', '#6B7280', '#E5E7EB', '#FFFFFF'],
    iconType: 'heart',
    agencyBadgeClass: 'bg-white text-black border border-gray-200 shadow-xs',
    display: {
      layoutVariant: 'masonry',
      messageCardBase: 'bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg shadow-subtle text-black',
      headerSubtitle: 'Pure Modern Registry',
      emptyStateText: 'Awaiting the first guest submission...',
    }
  },

  gallery: {
    isDark: false,
    fontSerif: 'font-serif',
    fontSans: 'font-sans',
    fontHeading: 'font-serif',
    fontBody: 'font-sans',
    colors: {
      background: 'bg-[#F2EDEB]',
      card: 'bg-white',
      border: 'border-[#3E2723]/15',
      headerText: 'text-[#3E2723]',
      text: 'text-[#3E2723]',
      subtleText: 'text-[#3E2723]/60',
      accent: 'text-[#8D6E63]',
      surfaceInput: 'bg-[#FAF7F5]',
      borderInput: 'border-[#3E2723]/20',
      textInput: 'text-[#3E2723]',
      placeholderInput: 'placeholder-[#3E2723]/40',
      focusRing: 'focus:ring-1 focus:ring-[#8D6E63] focus:border-[#8D6E63]',
    },
    card: {
      surface: 'bg-white',
      border: 'border border-[#3E2723]/15',
      radius: 'rounded-md',
      shadow: 'shadow-card',
    },
    button: {
      primary: 'bg-[#3E2723] text-[#FAF7F5] hover:bg-[#2B1B18] rounded-md font-medium transition-all active:scale-[0.99]',
      secondary: 'bg-[#F2EDEB] text-[#3E2723] hover:bg-[#EAE4E1] border border-[#3E2723]/15 rounded-md transition-all',
      toggleActive: 'bg-white text-[#3E2723] shadow-xs border border-[#3E2723]/20 font-medium',
      toggleInactive: 'text-[#3E2723]/50 hover:text-[#3E2723]',
      pillActive: 'bg-[#3E2723] text-white border-[#3E2723] font-medium',
      pillInactive: 'bg-[#FAF7F5] text-[#3E2723]/60 border-[#3E2723]/15 hover:border-[#3E2723]/40',
    },
    input: {
      base: 'bg-[#FAF7F5] border-[#3E2723]/20 text-[#3E2723] placeholder-[#3E2723]/40 focus:ring-1 focus:ring-[#8D6E63] focus:border-[#8D6E63]',
      radius: 'rounded-md',
    },
    qrButton: {
      buttonClass: 'bg-[#3E2723] text-[#FAF7F5] hover:bg-[#2B1B18] shadow-md rounded-md',
      modalCardClass: 'bg-white border border-[#3E2723]/15 shadow-xl rounded-md text-[#3E2723]',
    },
    confettiColors: ['#BCAAA4', '#3E2723', '#D7CCC8', '#FFFFFF'],
    iconType: 'heart',
    agencyBadgeClass: 'bg-white/90 text-[#3E2723] border border-[#3E2723]/15 shadow-xs',
    display: {
      layoutVariant: 'masonry',
      messageCardBase: 'bg-white border border-[#3E2723]/15 rounded-md shadow-card text-[#3E2723]',
      headerSubtitle: 'Curated Exhibition of Wishes',
      emptyStateText: 'Awaiting the first piece of celebration in the gallery...',
    }
  },

  creative: {
    isDark: false,
    fontSerif: 'font-sans',
    fontSans: 'font-serif',
    fontHeading: 'font-sans',
    fontBody: 'font-serif',
    colors: {
      background: 'bg-[#FDF6E3]',
      card: 'bg-[#EEE8D5]/90',
      border: 'border-[#93A1A1]/30',
      headerText: 'text-[#657B83]',
      text: 'text-[#586E75]',
      subtleText: 'text-[#839496]',
      accent: 'text-[#268BD2]',
      surfaceInput: 'bg-[#FDF6E3]',
      borderInput: 'border-[#93A1A1]/35',
      textInput: 'text-[#586E75]',
      placeholderInput: 'placeholder-[#839496]',
      focusRing: 'focus:ring-1 focus:ring-[#268BD2] focus:border-[#268BD2]',
    },
    card: {
      surface: 'bg-[#EEE8D5]/90',
      border: 'border border-[#93A1A1]/30',
      radius: 'rounded-xl',
      shadow: 'shadow-sm',
    },
    button: {
      primary: 'bg-[#268BD2] text-white hover:bg-[#1E74B0] rounded-lg font-medium transition-all active:scale-[0.99]',
      secondary: 'bg-[#FDF6E3] text-[#586E75] hover:bg-[#F5EDD6] border border-[#93A1A1]/30 rounded-lg transition-all',
      toggleActive: 'bg-[#FDF6E3] text-[#586E75] shadow-xs border border-[#93A1A1]/35 font-medium',
      toggleInactive: 'text-[#839496] hover:text-[#586E75]',
      pillActive: 'bg-[#268BD2] text-white border-[#268BD2] font-medium',
      pillInactive: 'bg-[#FDF6E3] text-[#586E75]/70 border-[#93A1A1]/30 hover:border-[#268BD2]',
    },
    input: {
      base: 'bg-[#FDF6E3] border-[#93A1A1]/35 text-[#586E75] placeholder-[#839496] focus:ring-1 focus:ring-[#268BD2] focus:border-[#268BD2]',
      radius: 'rounded-lg',
    },
    qrButton: {
      buttonClass: 'bg-[#268BD2] text-white hover:bg-[#1E74B0] shadow-md rounded-lg',
      modalCardClass: 'bg-[#EEE8D5] border border-[#93A1A1]/30 shadow-xl rounded-xl text-[#586E75]',
    },
    confettiColors: ['#268BD2', '#586E75', '#EEE8D5', '#2AA198', '#FFFFFF'],
    iconType: 'palette',
    agencyBadgeClass: 'bg-[#EEE8D5]/80 text-[#586E75] border border-[#93A1A1]/30 shadow-xs',
    display: {
      layoutVariant: 'masonry',
      messageCardBase: 'bg-[#EEE8D5]/90 border border-[#93A1A1]/30 rounded-xl shadow-sm text-[#586E75]',
      headerSubtitle: 'Artistic Sketchbook Canvas',
      emptyStateText: 'Waiting for the first stroke of inspiration...',
    }
  }
};

/**
 * Resolves any templateId (predefined or custom) into a complete, unified visual configuration.
 * Always returns a non-null, fully styled ResolvedEventTheme.
 */
export function resolveEventTheme(
  themeId?: string | null,
  customTemplates: WeddingTemplate[] = []
): ResolvedEventTheme {
  const allTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];
  
  // Find matching template or fallback
  let template = allTemplates.find(t => t.id === themeId);
  if (!template) {
    template = DEFAULT_TEMPLATES.find(t => t.id === 'minimal_luxury') || DEFAULT_TEMPLATES[0];
  }

  const profile = AESTHETIC_PROFILES[template.id];

  // If we have a predefined rich profile for this template
  if (profile) {
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      isDark: profile.isDark || false,
      isCustom: false,
      fontSerif: template.fontSerif || profile.fontSerif || 'font-serif',
      fontSans: template.fontSans || profile.fontSans || 'font-sans',
      fontHeading: profile.fontHeading || template.fontSerif || 'font-serif',
      fontBody: profile.fontBody || template.fontSans || 'font-sans',
      colors: {
        background: template.colors?.background || profile.colors?.background || 'bg-[#F8F8F8]',
        card: template.colors?.card || profile.colors?.card || 'bg-white/95',
        border: template.colors?.border || profile.colors?.border || 'border-[#D4AF37]/30',
        headerText: template.colors?.headerText || profile.colors?.headerText || 'text-[#1A1A1A]',
        text: template.colors?.text || profile.colors?.text || 'text-[#1A1A1A]',
        subtleText: template.colors?.subtleText || profile.colors?.subtleText || 'text-[#1A1A1A]/55',
        accent: template.colors?.accent || profile.colors?.accent || 'text-[#BFA15F]',
        surfaceInput: profile.colors?.surfaceInput || 'bg-white',
        borderInput: profile.colors?.borderInput || 'border-[#D4AF37]/35',
        textInput: profile.colors?.textInput || 'text-[#1A1A1A]',
        placeholderInput: profile.colors?.placeholderInput || 'placeholder-[#1A1A1A]/40',
        focusRing: profile.colors?.focusRing || 'focus:ring-1 focus:ring-[#BFA15F]',
      },
      card: profile.card || {
        surface: 'bg-white/95 backdrop-blur-md',
        border: 'border border-[#D4AF37]/30',
        radius: 'rounded-xl',
        shadow: 'shadow-card',
      },
      button: profile.button || {
        primary: 'bg-[#1A1A1A] text-white hover:bg-[#2C2C2C] rounded-lg font-medium transition-all',
        secondary: 'bg-white text-[#1A1A1A] border border-[#E8E8E5] rounded-lg',
        toggleActive: 'bg-white text-[#1A1A1A] shadow-sm border border-[#D4AF37]/30 font-medium',
        toggleInactive: 'text-[#1A1A1A]/50 hover:text-[#1A1A1A]',
        pillActive: 'bg-[#1A1A1A] text-white border-[#1A1A1A]',
        pillInactive: 'bg-white text-[#1A1A1A]/60 border-[#E8E8E5]',
      },
      input: profile.input || {
        base: 'bg-white border-[#D4AF37]/35 text-[#1A1A1A] placeholder-[#1A1A1A]/40',
        radius: 'rounded-lg',
      },
      qrButton: profile.qrButton || {
        buttonClass: 'bg-[#1A1A1A] text-[#D4AF37] hover:bg-[#2A2A2A] shadow-md',
        modalCardClass: 'bg-white border border-[#D4AF37]/30 shadow-xl rounded-xl',
      },
      confettiColors: profile.confettiColors || ['#D4AF37', '#1A1A1A', '#FAF8F5'],
      iconType: template.iconType || profile.iconType || 'heart',
      IconComponent: getIconComponent(template.iconType || profile.iconType),
      display: {
        layoutVariant: template.variant || profile.display?.layoutVariant || 'masonry',
        messageCardBase: profile.display?.messageCardBase || `${template.colors?.card || 'bg-white'} border ${template.colors?.border || 'border-gray-200'} rounded-xl shadow-md`,
        headerSubtitle: profile.display?.headerSubtitle || 'The Wedding Wall',
        emptyStateText: profile.display?.emptyStateText || 'Awaiting the first note of celebration...',
      },
      agencyBadgeClass: profile.agencyBadgeClass || 'bg-white/80 text-[#1A1A1A] border border-black/10 shadow-xs',
      rawTemplate: template,
    };
  }

  // Handle custom templates dynamically
  const isDarkBg = template.colors?.background?.includes('#0') || 
                   template.colors?.background?.includes('#1') || 
                   template.colors?.background?.includes('#2') || 
                   template.colors?.background?.includes('black') || 
                   template.colors?.background?.includes('gray-900');

  const cardSurface = template.colors?.card || (isDarkBg ? 'bg-white/10 backdrop-blur-md' : 'bg-white/95 backdrop-blur-md');
  const borderCol = template.colors?.border || (isDarkBg ? 'border-white/20' : 'border-gray-200');
  const textCol = template.colors?.text || (isDarkBg ? 'text-white' : 'text-gray-900');
  const subtleCol = template.colors?.subtleText || (isDarkBg ? 'text-white/60' : 'text-gray-500');
  const headerCol = template.colors?.headerText || textCol;

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    isDark: isDarkBg,
    isCustom: true,
    fontSerif: template.fontSerif || 'font-serif',
    fontSans: template.fontSans || 'font-sans',
    fontHeading: template.fontSerif || 'font-serif',
    fontBody: template.fontSans || 'font-sans',
    colors: {
      background: template.colors?.background || (isDarkBg ? 'bg-[#121212]' : 'bg-[#F7F7F5]'),
      card: cardSurface,
      border: borderCol,
      headerText: headerCol,
      text: textCol,
      subtleText: subtleCol,
      accent: template.colors?.accent || (isDarkBg ? 'text-[#38BDF8]' : 'text-[#8B806F]'),
      surfaceInput: isDarkBg ? 'bg-white/10' : 'bg-white',
      borderInput: borderCol,
      textInput: textCol,
      placeholderInput: isDarkBg ? 'placeholder-white/40' : 'placeholder-gray-400',
      focusRing: 'focus:ring-2 focus:ring-current/20 focus:border-current',
    },
    card: {
      surface: cardSurface,
      border: `border ${borderCol}`,
      radius: 'rounded-xl',
      shadow: 'shadow-md',
    },
    button: {
      primary: isDarkBg 
        ? 'bg-white text-black hover:bg-gray-200 rounded-lg font-medium transition-all active:scale-[0.99]' 
        : 'bg-[#252525] text-white hover:bg-[#111111] rounded-lg font-medium transition-all active:scale-[0.99]',
      secondary: isDarkBg 
        ? 'bg-white/10 text-white hover:bg-white/20 border border-white/20 rounded-lg transition-all'
        : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-200 rounded-lg transition-all',
      toggleActive: isDarkBg 
        ? 'bg-white/20 text-white shadow-sm border border-white/30 font-medium'
        : 'bg-white text-gray-900 shadow-sm border border-gray-200 font-medium',
      toggleInactive: isDarkBg ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-black',
      pillActive: isDarkBg ? 'bg-white text-black border-white' : 'bg-[#252525] text-white border-[#252525]',
      pillInactive: isDarkBg ? 'bg-white/10 text-white/70 border-white/20' : 'bg-white text-gray-600 border-gray-200',
    },
    input: {
      base: `${isDarkBg ? 'bg-white/10 text-white' : 'bg-white text-gray-900'} border ${borderCol} ${isDarkBg ? 'placeholder-white/40' : 'placeholder-gray-400'} focus:ring-1 focus:ring-current`,
      radius: 'rounded-lg',
    },
    qrButton: {
      buttonClass: isDarkBg ? 'bg-white text-black hover:bg-gray-200 shadow-lg' : 'bg-[#252525] text-white hover:bg-black shadow-md',
      modalCardClass: `${cardSurface} border ${borderCol} shadow-2xl rounded-xl`,
    },
    confettiColors: isDarkBg ? ['#FFFFFF', '#38BDF8', '#818CF8'] : ['#252525', '#8B806F', '#E8E8E5'],
    iconType: template.iconType || 'heart',
    IconComponent: getIconComponent(template.iconType),
    display: {
      layoutVariant: template.variant || 'masonry',
      messageCardBase: `${cardSurface} border ${borderCol} rounded-xl shadow-md ${textCol}`,
      headerSubtitle: 'Live Celebration Stream',
      emptyStateText: 'Awaiting the first guest memory...',
    },
    agencyBadgeClass: isDarkBg 
      ? 'bg-white/10 text-white/90 border border-white/20 shadow-xs backdrop-blur-md' 
      : 'bg-white/80 text-[#252525] border border-black/10 shadow-xs',
    rawTemplate: template,
  };
}
