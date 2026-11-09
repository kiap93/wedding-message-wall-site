import { WeddingEvent } from '../types';
import { WebsiteConfig, WebsiteTemplatePreset, WebsiteSection } from './types';

export const WEBSITE_TEMPLATES: WebsiteTemplatePreset[] = [
  {
    id: 'minimal_luxury',
    name: 'Minimal Luxury',
    description: 'Understated elegance, architectural typography, and champagne gold accents.',
    themeId: 'minimal_luxury',
    thumbnail: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=400',
    palette: {
      primary: '#1A1A1A',
      accent: '#C5A059',
      background: '#F8F8F7',
      surface: '#FFFFFF',
      text: '#222222',
      subtleText: '#777777',
      border: '#E8E8E5'
    },
    typography: {
      headingFont: 'Playfair Display',
      bodyFont: 'Inter',
      accentFont: 'Italiana'
    }
  },
  {
    id: 'garden',
    name: 'Natural Garden',
    description: 'Lush botanicals, eucalyptus accents, and soft earthy warmth.',
    themeId: 'garden',
    thumbnail: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&q=80&w=400',
    palette: {
      primary: '#2C3E2D',
      accent: '#6B856B',
      background: '#F2F4F1',
      surface: '#FFFFFF',
      text: '#2C3E2D',
      subtleText: '#5A6E5B',
      border: '#DCE2DB'
    },
    typography: {
      headingFont: 'Cormorant Garamond',
      bodyFont: 'Inter',
      accentFont: 'Parisienne'
    }
  },
  {
    id: 'romantic',
    name: 'Romantic Blush',
    description: 'Warm dusty rose, candlelit romance, and delicate cursive accents.',
    themeId: 'romantic',
    thumbnail: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&q=80&w=400',
    palette: {
      primary: '#3D2424',
      accent: '#D48181',
      background: '#FAF5F5',
      surface: '#FFFFFF',
      text: '#3D2424',
      subtleText: '#7A5C5C',
      border: '#EEDCDC'
    },
    typography: {
      headingFont: 'Playfair Display',
      bodyFont: 'Montserrat',
      accentFont: 'Great Vibes'
    }
  },
  {
    id: 'vintage_editorial',
    name: 'Vintage Editorial',
    description: 'High-fashion editorial layout, stark contrasts, and timeless black & ivory.',
    themeId: 'vintage_editorial',
    thumbnail: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&q=80&w=400',
    palette: {
      primary: '#111111',
      accent: '#8B806F',
      background: '#F5F4F0',
      surface: '#FFFFFF',
      text: '#111111',
      subtleText: '#666666',
      border: '#E0DFDA'
    },
    typography: {
      headingFont: 'Italiana',
      bodyFont: 'Inter',
      accentFont: 'Parisienne'
    }
  },
  {
    id: 'starry',
    name: 'Starry Evening',
    description: 'Midnight navy celestial ambiance, shimmering gold, and nighttime banquet mood.',
    themeId: 'starry',
    thumbnail: 'https://images.unsplash.com/photo-1519741347686-c1e0aadf4611?auto=format&fit=crop&q=80&w=400',
    palette: {
      primary: '#0F172A',
      accent: '#F59E0B',
      background: '#0B1120',
      surface: '#1E293B',
      text: '#F8FAFC',
      subtleText: '#94A3B8',
      border: '#334155'
    },
    typography: {
      headingFont: 'Playfair Display',
      bodyFont: 'Inter',
      accentFont: 'Italiana'
    }
  }
];

export function createDefaultWebsiteConfig(project: Partial<WeddingEvent>): WebsiteConfig {
  const groom = project.groom_name || 'Lucas';
  const bride = project.bride_name || 'Sofia';
  const weddingDate = project.wedding_date || '2025-09-20';
  const location = project.location || 'San Francisco, CA';
  const heroImage = project.image_url || 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=1600';
  const preset = WEBSITE_TEMPLATES.find(t => t.themeId === project.theme_id) || WEBSITE_TEMPLATES[0];

  const initialSections: WebsiteSection[] = [
    {
      id: 'sec-hero',
      type: 'hero',
      title: 'Hero Welcome',
      enabled: true,
      backgroundStyle: 'default',
      paddingY: 'relaxed',
      align: 'center',
      content: {
        headline: `${groom} & ${bride}`,
        subheadline: 'Together with their families, invite you to celebrate their wedding day',
        buttonText: 'RSVP Today',
        buttonLink: '#rsvp',
        secondaryButtonText: 'Our Story',
        secondaryButtonLink: '#story',
        backgroundImage: heroImage,
        overlayOpacity: 45
      }
    },
    {
      id: 'sec-countdown',
      type: 'countdown',
      title: 'Countdown to the Big Day',
      enabled: true,
      backgroundStyle: 'surface',
      paddingY: 'normal',
      align: 'center',
      content: {
        headline: 'Counting Down to Forever',
        subheadline: 'We can’t wait to celebrate this unforgettable milestone with you.'
      }
    },
    {
      id: 'sec-story',
      type: 'story',
      title: 'Our Story',
      enabled: true,
      backgroundStyle: 'default',
      paddingY: 'relaxed',
      align: 'center',
      content: {
        headline: 'How Our Story Began',
        subheadline: 'From coffee shop encounters to a lifetime of love and adventure.',
        milestones: [
          {
            id: 'm1',
            year: '2021',
            title: 'Where It All Began',
            description: 'A serendipitous rainy afternoon at a bookstore cafe in North Beach.',
            image: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&q=80&w=600'
          },
          {
            id: 'm2',
            year: '2023',
            title: 'The Unforgettable Proposal',
            description: 'Under the golden sunset of the Pacific coast cliffs overlooking the ocean.',
            image: 'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?auto=format&fit=crop&q=80&w=600'
          },
          {
            id: 'm3',
            year: '2025',
            title: 'The Next Chapter',
            description: 'Standing before our closest friends and family to say "I do" forever.',
            image: heroImage
          }
        ]
      }
    },
    {
      id: 'sec-schedule',
      type: 'schedule',
      title: 'Wedding Day Schedule',
      enabled: true,
      backgroundStyle: 'surface',
      paddingY: 'relaxed',
      align: 'center',
      content: {
        headline: 'Wedding Day Itinerary',
        subheadline: 'A timeline of the day’s celebrations and memorable moments.',
        events: [
          {
            id: 'e1',
            time: '3:30 PM',
            title: 'Guest Arrival & Welcome Refreshments',
            location: 'Courtyard Garden',
            description: 'Arrive early to mingle, enjoy acoustic strings, and find your seat.'
          },
          {
            id: 'e2',
            time: '4:00 PM',
            title: 'The Wedding Ceremony',
            location: 'Main Pavilion',
            description: 'Exchange of vows, rings, and romantic blessings.'
          },
          {
            id: 'e3',
            time: '5:00 PM',
            title: 'Cocktail Hour & Hors d’Oeuvres',
            location: 'The Veranda Terrace',
            description: 'Signature cocktails, artisanal appetizers, and lawn mingling.'
          },
          {
            id: 'e4',
            time: '6:30 PM',
            title: 'Dinner Reception & Toasts',
            location: 'Grand Ballroom',
            description: 'Three-course banquet dinner followed by speeches and celebratory toasts.'
          },
          {
            id: 'e5',
            time: '8:30 PM',
            title: 'First Dance & Celebration',
            location: 'Ballroom Dancefloor',
            description: 'Live DJ, dancing under the lanterns, and midnight sweet treats.'
          }
        ]
      }
    },
    {
      id: 'sec-venue',
      type: 'venue',
      title: 'Venue & Details',
      enabled: true,
      backgroundStyle: 'default',
      paddingY: 'relaxed',
      align: 'center',
      content: {
        venueName: location || 'Villa Montalvo Estate',
        address: `${location || 'San Francisco, CA'} • 15400 Montalvo Road`,
        attire: 'Black Tie Optional / Formal Garden Attire',
        directionsUrl: 'https://maps.google.com'
      }
    },
    {
      id: 'sec-gallery',
      type: 'gallery',
      title: 'Photo Gallery',
      enabled: true,
      backgroundStyle: 'surface',
      paddingY: 'relaxed',
      align: 'center',
      content: {
        headline: 'Moments Captured',
        subheadline: 'A glimpse into our journey and cherished memories leading up to this day.',
        photos: [
          { id: 'p1', url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800', caption: 'Sunset in Positano' },
          { id: 'p2', url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&q=80&w=800', caption: 'Weekend getaways' },
          { id: 'p3', url: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&q=80&w=800', caption: 'The engagement celebration' },
          { id: 'p4', url: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&q=80&w=800', caption: 'Autumn strolls' }
        ]
      }
    },
    {
      id: 'sec-invitation',
      type: 'invitation',
      title: 'Digital Stationery Suite',
      enabled: true,
      backgroundStyle: 'default',
      paddingY: 'normal',
      align: 'center',
      content: {
        headline: 'Official Digital Invitation Suite',
        subheadline: 'Crafted with bespoke calligraphy and timeless stationery aesthetics.'
      }
    },
    {
      id: 'sec-rsvp',
      type: 'rsvp',
      title: 'RSVP Response',
      enabled: true,
      backgroundStyle: 'surface',
      paddingY: 'relaxed',
      align: 'center',
      content: {
        headline: 'RSVP to Celebrate With Us',
        subheadline: 'Kindly confirm your attendance by August 15th so we may reserve your seat.',
        rsvpDeadline: 'August 15, 2025',
        buttonText: 'Submit Your RSVP'
      }
    },
    {
      id: 'sec-wall',
      type: 'wall',
      title: 'Live Guestbook & Display Wall',
      enabled: true,
      backgroundStyle: 'default',
      paddingY: 'relaxed',
      align: 'center',
      content: {
        headline: 'Share Your Warm Wishes',
        subheadline: 'Your notes and photos appear live on the ballroom projector during the reception.',
        buttonText: 'Leave a Note for the Couple'
      }
    },
    {
      id: 'sec-footer',
      type: 'footer',
      title: 'Footer',
      enabled: true,
      backgroundStyle: 'dark',
      paddingY: 'normal',
      align: 'center',
      content: {
        thankYouMessage: 'With immense gratitude and boundless love, thank you for being part of our story.'
      }
    }
  ];

  return {
    design: {
      themeId: preset.themeId,
      palette: { ...preset.palette },
      typography: { ...preset.typography },
      decorations: {
        showThemeOverlay: true,
        cardStyle: 'bordered',
        borderRadius: 'xl'
      }
    },
    sections: initialSections,
    settings: {
      siteTitle: `${groom} & ${bride} • Wedding Celebration`,
      showNav: true,
      rsvpButtonInNav: true,
      announcementBar: `Kindly RSVP by August 15th • We look forward to celebrating together!`
    },
    seo: {
      title: `${groom} & ${bride} Wedding | ${weddingDate ? new Date(weddingDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Wedding Celebration'}`,
      pageTitle: `${groom} & ${bride} Wedding | ${weddingDate ? new Date(weddingDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Wedding Celebration'}`,
      description: `Join ${groom} and ${bride} as they celebrate their wedding${location ? ` in ${location}` : ''}. View wedding schedule, venue directions, and confirm your RSVP.`,
      metaDescription: `Join ${groom} and ${bride} as they celebrate their wedding${location ? ` in ${location}` : ''}. View wedding schedule, venue directions, and confirm your RSVP.`,
      keywords: `wedding, ${groom}, ${bride}, wedding website, RSVP, celebration`,
      noIndex: false,
      ogTitle: `${groom} & ${bride} Wedding | ${weddingDate ? new Date(weddingDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Wedding Celebration'}`,
      ogDescription: `Join ${groom} and ${bride} as they celebrate their wedding. View schedule, venue details, and RSVP online.`,
      ogImage: heroImage
    },
    publicationStatus: (project.website_status as any) || 'draft',
    version: 1,
    updatedAt: new Date().toISOString()
  };
}
