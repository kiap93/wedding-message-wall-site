import { WeddingEvent } from '../types';

export type WebsiteSectionType = 
  | 'hero'
  | 'countdown'
  | 'story'
  | 'schedule'
  | 'venue'
  | 'gallery'
  | 'invitation'
  | 'rsvp'
  | 'wall'
  | 'footer';

export interface MilestoneItem {
  id: string;
  year?: string;
  title: string;
  description: string;
  image?: string;
}

export interface ScheduleItem {
  id: string;
  time: string;
  title: string;
  location?: string;
  description?: string;
  icon?: string;
}

export interface GalleryPhoto {
  id: string;
  url: string;
  caption?: string;
}

export interface WebsiteSection {
  id: string;
  type: WebsiteSectionType;
  title?: string;
  subtitle?: string;
  enabled: boolean;
  backgroundStyle?: 'default' | 'surface' | 'accent' | 'dark' | 'glass';
  paddingY?: 'compact' | 'normal' | 'relaxed';
  align?: 'center' | 'left';
  content?: {
    headline?: string;
    subheadline?: string;
    buttonText?: string;
    buttonLink?: string;
    secondaryButtonText?: string;
    secondaryButtonLink?: string;
    backgroundImage?: string;
    overlayOpacity?: number;
    // Story
    milestones?: MilestoneItem[];
    // Schedule
    events?: ScheduleItem[];
    // Venue
    address?: string;
    venueName?: string;
    attire?: string;
    directionsUrl?: string;
    // Gallery
    photos?: GalleryPhoto[];
    // RSVP
    rsvpDeadline?: string;
    rsvpNote?: string;
    // Wall
    wallPreviewCount?: number;
    // Footer
    thankYouMessage?: string;
  };
}

export interface WebsiteDesignPalette {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  subtleText: string;
  border: string;
}

export interface WebsiteDesignConfig {
  themeId: string;
  palette: WebsiteDesignPalette;
  typography: {
    headingFont: string;
    bodyFont: string;
    accentFont: string;
  };
  decorations: {
    showThemeOverlay: boolean;
    cardStyle: 'flat' | 'bordered' | 'elevated' | 'glass';
    borderRadius: 'none' | 'md' | 'xl' | 'full';
  };
}

export interface WebsiteSettings {
  siteTitle?: string;
  showNav: boolean;
  rsvpButtonInNav: boolean;
  announcementBar?: string;
  musicUrl?: string;
}

export interface WebsiteSEOConfig {
  title?: string;
  pageTitle?: string;
  description?: string;
  metaDescription?: string;
  keywords?: string;
  canonicalUrl?: string;
  noIndex?: boolean; // When true, sets robots to noindex, nofollow and excludes from sitemap
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
}

export interface WebsiteConfig {
  design: WebsiteDesignConfig;
  sections: WebsiteSection[];
  settings: WebsiteSettings;
  seo?: WebsiteSEOConfig;
  publicationStatus?: 'draft' | 'published' | 'unpublished';
  publishedAt?: string;
  version?: number;
  updatedAt?: string;
}

export type DeviceMode = 'desktop' | 'tablet' | 'mobile';

export interface WebsiteTemplatePreset {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  themeId: string;
  palette: WebsiteDesignPalette;
  typography: {
    headingFont: string;
    bodyFont: string;
    accentFont: string;
  };
  sampleSections?: WebsiteSectionType[];
}
