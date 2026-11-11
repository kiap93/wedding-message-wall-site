import { create } from 'zustand';
import { WeddingEvent } from '../../types';
import { 
  WebsiteConfig, 
  WebsiteSection, 
  WebsiteSectionType, 
  DeviceMode,
  WebsiteDesignConfig,
  WebsiteSettings,
  WebsiteSEOConfig,
  MilestoneItem,
  ScheduleItem,
  GalleryPhoto
} from '../types';
import { createDefaultWebsiteConfig, WEBSITE_TEMPLATES } from '../presets';

interface WebsiteBuilderState {
  project: WeddingEvent | null;
  config: WebsiteConfig;
  selectedSectionId: string | null;
  activeTab: 'templates' | 'sections' | 'design' | 'media' | 'settings' | 'languages';
  deviceMode: DeviceMode;
  zoom: number;
  saveStatus: 'idle' | 'unsaved' | 'saving' | 'saved';
  previewModalOpen: boolean;
  isPublishModalOpen: boolean;
  publicationStatus: 'draft' | 'published' | 'unpublished';
  publishedAt: string | null;

  // History for undo/redo
  history: WebsiteConfig[];
  historyIndex: number;

  // Actions
  init: (project: WeddingEvent) => void;
  setSelectedSectionId: (id: string | null) => void;
  setActiveTab: (tab: 'templates' | 'sections' | 'design' | 'media' | 'settings' | 'languages') => void;
  setDeviceMode: (mode: DeviceMode) => void;
  setZoom: (zoom: number) => void;
  setSaveStatus: (status: 'idle' | 'unsaved' | 'saving' | 'saved') => void;
  setPreviewModalOpen: (open: boolean) => void;

  // Content & Config Mutations (Recorded in history)
  updateSection: (sectionId: string, updates: Partial<WebsiteSection>) => void;
  addSection: (type: WebsiteSectionType) => void;
  removeSection: (sectionId: string) => void;
  toggleSectionVisibility: (sectionId: string) => void;
  moveSection: (sectionId: string, direction: 'up' | 'down') => void;
  reorderSections: (fromIndex: number, toIndex: number) => void;
  updateDesign: (updates: Partial<WebsiteDesignConfig>) => void;
  updateSettings: (updates: Partial<WebsiteSettings>) => void;
  updateSEO: (updates: Partial<WebsiteSEOConfig>) => void;
  applyTemplatePreset: (presetId: string) => void;

  // Publishing & Lifecycle
  setIsPublishModalOpen: (open: boolean) => void;
  publishWebsite: () => Promise<{ success: boolean; url?: string; error?: string }>;
  unpublishWebsite: () => Promise<{ success: boolean; error?: string }>;
  getPreviewUrl: () => Promise<string>;

  // Story Milestones
  addStoryMilestone: (sectionId: string) => void;
  updateStoryMilestone: (sectionId: string, milestoneId: string, updates: Partial<MilestoneItem>) => void;
  removeStoryMilestone: (sectionId: string, milestoneId: string) => void;

  // Schedule Events
  addScheduleEvent: (sectionId: string) => void;
  updateScheduleEvent: (sectionId: string, eventId: string, updates: Partial<ScheduleItem>) => void;
  removeScheduleEvent: (sectionId: string, eventId: string) => void;

  // Gallery Photos
  addGalleryPhoto: (sectionId: string, url?: string, caption?: string) => void;
  updateGalleryPhoto: (sectionId: string, photoId: string, updates: Partial<GalleryPhoto>) => void;
  removeGalleryPhoto: (sectionId: string, photoId: string) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const emptyInitialConfig: WebsiteConfig = {
  design: {
    themeId: 'minimal_luxury',
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
    },
    decorations: {
      showThemeOverlay: true,
      cardStyle: 'bordered',
      borderRadius: 'xl'
    }
  },
  sections: [],
  settings: {
    siteTitle: 'Wedding Website',
    showNav: true,
    rsvpButtonInNav: true
  }
};

export const useWebsiteStore = create<WebsiteBuilderState>((set, get) => ({
  project: null,
  config: emptyInitialConfig,
  selectedSectionId: 'sec-hero',
  activeTab: 'sections',
  deviceMode: 'desktop',
  zoom: 100,
  saveStatus: 'idle',
  previewModalOpen: false,
  isPublishModalOpen: false,
  publicationStatus: 'draft',
  publishedAt: null,

  history: [],
  historyIndex: -1,

  init: (project: WeddingEvent) => {
    let initialConfig: WebsiteConfig;
    if (project.website_config) {
      initialConfig = typeof project.website_config === 'string'
        ? JSON.parse(project.website_config)
        : project.website_config;
      
      // Ensure all required fields exist
      if (!initialConfig.sections || initialConfig.sections.length === 0) {
        initialConfig = createDefaultWebsiteConfig(project);
      }
    } else {
      initialConfig = createDefaultWebsiteConfig(project);
    }

    if (!initialConfig.seo) {
      initialConfig.seo = createDefaultWebsiteConfig(project).seo;
    }

    const pubStatus = project.website_status || initialConfig.publicationStatus || 'draft';
    const pubAt = project.website_published_at || initialConfig.publishedAt || null;

    set({
      project,
      config: initialConfig,
      selectedSectionId: initialConfig.sections[0]?.id || null,
      publicationStatus: pubStatus,
      publishedAt: pubAt,
      isPublishModalOpen: false,
      history: [initialConfig],
      historyIndex: 0,
      saveStatus: 'idle'
    });
  },

  setSelectedSectionId: (id) => set({ selectedSectionId: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setDeviceMode: (mode) => set({ deviceMode: mode }),
  setZoom: (zoom) => set({ zoom: Math.max(50, Math.min(150, zoom)) }),
  setSaveStatus: (status) => set({ saveStatus: status }),
  setPreviewModalOpen: (open) => set({ previewModalOpen: open }),
  setIsPublishModalOpen: (open) => set({ isPublishModalOpen: open }),

  // Push new state to undo/redo history
  updateSection: (sectionId, updates) => {
    const { config, history, historyIndex } = get();
    const updatedSections = config.sections.map((sec) => {
      if (sec.id === sectionId) {
        return {
          ...sec,
          ...updates,
          content: {
            ...sec.content,
            ...(updates.content || {})
          }
        };
      }
      return sec;
    });

    const newConfig: WebsiteConfig = {
      ...config,
      sections: updatedSections,
      updatedAt: new Date().toISOString()
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newConfig);
    if (newHistory.length > 25) newHistory.shift();

    set({
      config: newConfig,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      saveStatus: 'unsaved'
    });
  },

  addSection: (type: WebsiteSectionType) => {
    const { config, project, history, historyIndex } = get();
    const newId = `sec-${type}-${Date.now().toString(36)}`;
    const groom = project?.groom_name || 'Lucas';
    const bride = project?.bride_name || 'Sofia';

    const defaultTitleMap: Record<WebsiteSectionType, string> = {
      hero: `${groom} & ${bride}`,
      countdown: 'Countdown to the Big Day',
      story: 'Our Love Story',
      schedule: 'Wedding Day Schedule',
      venue: 'Venue & Accommodations',
      gallery: 'Photo Gallery',
      invitation: 'Digital Stationery Suite',
      rsvp: 'RSVP Confirmation',
      wall: 'Reception Guestbook Wall',
      footer: 'Love & Gratitude'
    };

    const newSection: WebsiteSection = {
      id: newId,
      type,
      title: defaultTitleMap[type] || 'Section',
      enabled: true,
      backgroundStyle: 'default',
      paddingY: 'normal',
      align: 'center',
      content: {
        headline: defaultTitleMap[type],
        subheadline: 'Customize this section to share meaningful details with your wedding guests.'
      }
    };

    const newConfig: WebsiteConfig = {
      ...config,
      sections: [...config.sections, newSection],
      updatedAt: new Date().toISOString()
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newConfig);

    set({
      config: newConfig,
      selectedSectionId: newId,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      saveStatus: 'unsaved'
    });
  },

  removeSection: (sectionId: string) => {
    const { config, history, historyIndex, selectedSectionId } = get();
    const newSections = config.sections.filter((s) => s.id !== sectionId);

    const newConfig: WebsiteConfig = {
      ...config,
      sections: newSections,
      updatedAt: new Date().toISOString()
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newConfig);

    set({
      config: newConfig,
      selectedSectionId: selectedSectionId === sectionId ? (newSections[0]?.id || null) : selectedSectionId,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      saveStatus: 'unsaved'
    });
  },

  toggleSectionVisibility: (sectionId: string) => {
    const { config, history, historyIndex } = get();
    const newSections = config.sections.map((s) => {
      if (s.id === sectionId) {
        return { ...s, enabled: !s.enabled };
      }
      return s;
    });

    const newConfig: WebsiteConfig = {
      ...config,
      sections: newSections,
      updatedAt: new Date().toISOString()
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newConfig);

    set({
      config: newConfig,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      saveStatus: 'unsaved'
    });
  },

  moveSection: (sectionId: string, direction: 'up' | 'down') => {
    const { config, history, historyIndex } = get();
    const list = [...config.sections];
    const idx = list.findIndex((s) => s.id === sectionId);
    if (idx === -1) return;

    if (direction === 'up' && idx > 0) {
      [list[idx], list[idx - 1]] = [list[idx - 1], list[idx]];
    } else if (direction === 'down' && idx < list.length - 1) {
      [list[idx], list[idx + 1]] = [list[idx + 1], list[idx]];
    } else {
      return;
    }

    const newConfig: WebsiteConfig = {
      ...config,
      sections: list,
      updatedAt: new Date().toISOString()
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newConfig);

    set({
      config: newConfig,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      saveStatus: 'unsaved'
    });
  },

  reorderSections: (fromIndex: number, toIndex: number) => {
    const { config, history, historyIndex } = get();
    if (fromIndex < 0 || fromIndex >= config.sections.length) return;
    if (toIndex < 0 || toIndex >= config.sections.length) return;
    if (fromIndex === toIndex) return;

    const list = [...config.sections];
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);

    const newConfig: WebsiteConfig = {
      ...config,
      sections: list,
      updatedAt: new Date().toISOString()
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newConfig);

    set({
      config: newConfig,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      saveStatus: 'unsaved'
    });
  },

  // Story Milestones
  addStoryMilestone: (sectionId: string) => {
    const { config, updateSection } = get();
    const section = config.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const currentMilestones = section.content?.milestones || [];
    const newMilestone: MilestoneItem = {
      id: `m-${Date.now().toString(36)}`,
      year: new Date().getFullYear().toString(),
      title: 'A Special Milestone',
      description: 'Share a sweet moment from your journey together.',
      image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=600'
    };

    updateSection(sectionId, {
      content: {
        milestones: [...currentMilestones, newMilestone]
      }
    });
  },

  updateStoryMilestone: (sectionId: string, milestoneId: string, updates: Partial<MilestoneItem>) => {
    const { config, updateSection } = get();
    const section = config.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const currentMilestones = section.content?.milestones || [];
    const updated = currentMilestones.map((m) => m.id === milestoneId ? { ...m, ...updates } : m);

    updateSection(sectionId, {
      content: { milestones: updated }
    });
  },

  removeStoryMilestone: (sectionId: string, milestoneId: string) => {
    const { config, updateSection } = get();
    const section = config.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const currentMilestones = section.content?.milestones || [];
    updateSection(sectionId, {
      content: { milestones: currentMilestones.filter((m) => m.id !== milestoneId) }
    });
  },

  // Schedule Events
  addScheduleEvent: (sectionId: string) => {
    const { config, updateSection } = get();
    const section = config.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const currentEvents = section.content?.events || [];
    const newEvent: ScheduleItem = {
      id: `ev-${Date.now().toString(36)}`,
      time: '5:00 PM',
      title: 'Champagne Toast & Reception',
      location: 'Grand Ballroom',
      description: 'Dinner, toasts, and dancing into the evening.'
    };

    updateSection(sectionId, {
      content: {
        events: [...currentEvents, newEvent]
      }
    });
  },

  updateScheduleEvent: (sectionId: string, eventId: string, updates: Partial<ScheduleItem>) => {
    const { config, updateSection } = get();
    const section = config.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const currentEvents = section.content?.events || [];
    const updated = currentEvents.map((ev) => ev.id === eventId ? { ...ev, ...updates } : ev);

    updateSection(sectionId, {
      content: { events: updated }
    });
  },

  removeScheduleEvent: (sectionId: string, eventId: string) => {
    const { config, updateSection } = get();
    const section = config.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const currentEvents = section.content?.events || [];
    updateSection(sectionId, {
      content: { events: currentEvents.filter((ev) => ev.id !== eventId) }
    });
  },

  // Gallery Photos
  addGalleryPhoto: (sectionId: string, url?: string, caption?: string) => {
    const { config, updateSection } = get();
    const section = config.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const currentPhotos = section.content?.photos || [];
    const newPhoto: GalleryPhoto = {
      id: `p-${Date.now().toString(36)}`,
      url: url || 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800',
      caption: caption || 'Special memories together'
    };

    updateSection(sectionId, {
      content: {
        photos: [...currentPhotos, newPhoto]
      }
    });
  },

  updateGalleryPhoto: (sectionId: string, photoId: string, updates: Partial<GalleryPhoto>) => {
    const { config, updateSection } = get();
    const section = config.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const currentPhotos = section.content?.photos || [];
    const updated = currentPhotos.map((p) => p.id === photoId ? { ...p, ...updates } : p);

    updateSection(sectionId, {
      content: { photos: updated }
    });
  },

  removeGalleryPhoto: (sectionId: string, photoId: string) => {
    const { config, updateSection } = get();
    const section = config.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const currentPhotos = section.content?.photos || [];
    updateSection(sectionId, {
      content: { photos: currentPhotos.filter((p) => p.id !== photoId) }
    });
  },

  updateDesign: (updates: Partial<WebsiteDesignConfig>) => {
    const { config, history, historyIndex } = get();
    const newConfig: WebsiteConfig = {
      ...config,
      design: {
        ...config.design,
        ...updates,
        palette: {
          ...config.design.palette,
          ...(updates.palette || {})
        },
        typography: {
          ...config.design.typography,
          ...(updates.typography || {})
        },
        decorations: {
          ...config.design.decorations,
          ...(updates.decorations || {})
        }
      },
      updatedAt: new Date().toISOString()
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newConfig);

    set({
      config: newConfig,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      saveStatus: 'unsaved'
    });
  },

  updateSettings: (updates: Partial<WebsiteSettings>) => {
    const { config, history, historyIndex } = get();
    const newConfig: WebsiteConfig = {
      ...config,
      settings: {
        ...config.settings,
        ...updates
      },
      updatedAt: new Date().toISOString()
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newConfig);

    set({
      config: newConfig,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      saveStatus: 'unsaved'
    });
  },

  updateSEO: (updates: Partial<WebsiteSEOConfig>) => {
    const { config, history, historyIndex } = get();
    const newConfig: WebsiteConfig = {
      ...config,
      seo: {
        ...(config.seo || {}),
        ...updates
      },
      updatedAt: new Date().toISOString()
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newConfig);

    set({
      config: newConfig,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      saveStatus: 'unsaved'
    });
  },

  publishWebsite: async () => {
    const { project, config } = get();
    if (!project) return { success: false, error: 'No active wedding project' };

    try {
      set({ saveStatus: 'saving' });

      // Demo fallback in preview
      if (project.id === 'demo') {
        const publishedAt = new Date().toISOString();
        set({
          publicationStatus: 'published',
          publishedAt,
          saveStatus: 'saved',
          config: {
            ...config,
            publicationStatus: 'published',
            publishedAt
          }
        });
        return { success: true, url: '/demo/website' };
      }

      const res = await fetch(`/api/projects/${project.id}/website/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
        },
        body: JSON.stringify({ website_config: config })
      });

      const data = await res.json();
      if (!res.ok) {
        set({ saveStatus: 'unsaved' });
        return { success: false, error: data.error || 'Failed to publish website' };
      }

      set({
        publicationStatus: 'published',
        publishedAt: data.publishedAt,
        saveStatus: 'saved',
        project: data.project || {
          ...project,
          website_status: 'published',
          website_published_at: data.publishedAt
        }
      });

      return { success: true, url: data.publicUrl || `/${project.slug}/website` };
    } catch (err: any) {
      set({ saveStatus: 'unsaved' });
      return { success: false, error: err.message || 'Network error publishing website' };
    }
  },

  unpublishWebsite: async () => {
    const { project } = get();
    if (!project) return { success: false, error: 'No active project' };

    try {
      if (project.id === 'demo') {
        set({ publicationStatus: 'unpublished' });
        return { success: true };
      }

      const res = await fetch(`/api/projects/${project.id}/website/unpublish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
        }
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to unpublish website' };
      }

      set({
        publicationStatus: 'unpublished',
        project: data.project || { ...project, website_status: 'unpublished' }
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error unpublishing website' };
    }
  },

  getPreviewUrl: async () => {
    const { project } = get();
    if (!project) return '';
    if (project.id === 'demo') return '/demo/website?preview=true';

    try {
      const res = await fetch(`/api/projects/${project.id}/website/preview-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.previewUrl) return data.previewUrl;
      }
    } catch (e) {}
    return `/${project.slug}/website?preview=true`;
  },

  applyTemplatePreset: (presetId: string) => {
    const { config, history, historyIndex } = get();
    const preset = WEBSITE_TEMPLATES.find((t) => t.id === presetId);
    if (!preset) return;

    const newConfig: WebsiteConfig = {
      ...config,
      design: {
        ...config.design,
        themeId: preset.themeId,
        palette: { ...preset.palette },
        typography: { ...preset.typography }
      },
      updatedAt: new Date().toISOString()
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newConfig);

    set({
      config: newConfig,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      saveStatus: 'unsaved'
    });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const prevConfig = history[historyIndex - 1];
      set({
        config: prevConfig,
        historyIndex: historyIndex - 1,
        saveStatus: 'unsaved'
      });
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const nextConfig = history[historyIndex + 1];
      set({
        config: nextConfig,
        historyIndex: historyIndex + 1,
        saveStatus: 'unsaved'
      });
    }
  },

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1
}));
