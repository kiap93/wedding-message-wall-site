import React, { useState } from 'react';
import { 
  LayoutTemplate, 
  Layers, 
  Palette, 
  Image as ImageIcon, 
  Settings as SettingsIcon, 
  Plus, 
  Eye, 
  EyeOff, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  Check, 
  Upload, 
  Sparkles,
  Type,
  Music,
  GripVertical,
  Globe,
  Share2,
  Copy,
  ExternalLink,
  Lock,
  Search
} from 'lucide-react';
import { useWebsiteStore } from '../store/websiteStore';
import { WEBSITE_TEMPLATES } from '../presets';
import { WebsiteSectionType } from '../types';
import Button from '../../design-system/components/Button';
import Input from '../../design-system/components/Input';
import { LanguageManager } from './LanguageManager';

const FONT_OPTIONS = [
  'Playfair Display',
  'Cormorant Garamond',
  'Italiana',
  'Parisienne',
  'Montserrat',
  'Inter',
  'Great Vibes'
];

const AVAILABLE_SECTION_CATALOG: { type: WebsiteSectionType; label: string; desc: string }[] = [
  { type: 'hero', label: 'Hero Welcome', desc: 'Full-bleed romantic banner with names and wedding date' },
  { type: 'countdown', label: 'Countdown Timer', desc: 'Live ticking countdown to the ceremony' },
  { type: 'story', label: 'Our Story', desc: 'Chronological timeline of milestones & photos' },
  { type: 'schedule', label: 'Wedding Itinerary', desc: 'Timeline of events from arrival to final dance' },
  { type: 'venue', label: 'Venue & Location', desc: 'Address, attire guidelines and driving directions' },
  { type: 'gallery', label: 'Photo Gallery', desc: 'Curated photo grid of couple memories' },
  { type: 'invitation', label: 'Stationery Suite', desc: 'Showcase of formal digital stationery' },
  { type: 'rsvp', label: 'RSVP Confirmation', desc: 'Attendance confirmation and deadline card' },
  { type: 'wall', label: 'Live Guest Wall', desc: 'Guestbook message wall connected to ballroom projector' },
  { type: 'footer', label: 'Footer & Monogram', desc: 'Closing blessings and monogram seal' }
];

export const BuilderSidebar: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    config, 
    selectedSectionId, 
    setSelectedSectionId, 
    updateSection,
    addSection, 
    removeSection, 
    toggleSectionVisibility, 
    moveSection,
    reorderSections,
    applyTemplatePreset,
    updateDesign,
    updateSettings,
    updateSEO,
    publicationStatus,
    publishedAt,
    setIsPublishModalOpen,
    project
  } = useWebsiteStore();

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [mediaUploadSuccess, setMediaUploadSuccess] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Tab definitions
  const tabs = [
    { id: 'templates', label: 'Templates', icon: LayoutTemplate },
    { id: 'sections', label: 'Sections', icon: Layers },
    { id: 'design', label: 'Design', icon: Palette },
    { id: 'media', label: 'Media', icon: ImageIcon },
    { id: 'languages', label: 'Languages', icon: Globe },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ] as const;

  return (
    <aside className="w-80 sm:w-96 bg-white border-r border-[#E8E8E5] flex flex-col shrink-0 select-none z-20 overflow-hidden">
      {/* Tab Navigation Strip */}
      <div className="flex items-center border-b border-[#E8E8E5] bg-[#FAF9F7]/80 px-2 pt-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center py-2 px-1 text-xs transition-colors border-b-2 ${
                isActive 
                  ? 'border-[#252525] text-[#252525] font-semibold' 
                  : 'border-transparent text-[#777777] hover:text-[#252525]'
              }`}
            >
              <Icon className="w-4 h-4 mb-1" />
              <span className="text-[10px] tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Panel */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* 1. TEMPLATES TAB */}
        {activeTab === 'templates' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-[#252525] uppercase tracking-wider">
                Wedding Website Themes
              </h3>
              <p className="text-[11px] text-[#777777] mt-0.5">
                Switch design aesthetics instantly. Content and event details are preserved.
              </p>
            </div>

            <div className="space-y-3">
              {WEBSITE_TEMPLATES.map((tpl) => {
                const isSelected = config.design.themeId === tpl.themeId;
                return (
                  <div
                    key={tpl.id}
                    onClick={() => applyTemplatePreset(tpl.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex gap-3.5 items-center ${
                      isSelected
                        ? 'border-[#252525] bg-[#FAF9F7] ring-1 ring-[#252525] shadow-xs'
                        : 'border-[#E8E8E5] hover:border-[#CCCCCC] bg-white'
                    }`}
                  >
                    <img 
                      src={tpl.thumbnail} 
                      alt={tpl.name} 
                      className="w-16 h-16 rounded-lg object-cover shrink-0 border border-black/5" 
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-[#252525] truncate">
                          {tpl.name}
                        </span>
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                            <Check className="w-2.5 h-2.5" /> Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#777777] line-clamp-2 leading-relaxed">
                        {tpl.description}
                      </p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: tpl.palette.background }} />
                        <div className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: tpl.palette.accent }} />
                        <div className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: tpl.palette.primary }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. SECTIONS TAB */}
        {activeTab === 'sections' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-[#252525] uppercase tracking-wider">
                  Page Sections
                </h3>
                <p className="text-[11px] text-[#777777]">
                  Reorder, show/hide, or add new website sections.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddMenu(!showAddMenu)}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                className="!h-7 !text-[11px]"
              >
                Add Section
              </Button>
            </div>

            {/* Add Section Dropdown Panel */}
            {showAddMenu && (
              <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#E8E8E5] space-y-2 animate-fade-in shadow-xs">
                <div className="text-[11px] font-semibold text-[#252525] uppercase tracking-wider mb-1">
                  Choose a Section to Add
                </div>
                <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">
                  {AVAILABLE_SECTION_CATALOG.map((item) => (
                    <button
                      key={item.type}
                      onClick={() => {
                        addSection(item.type);
                        setShowAddMenu(false);
                      }}
                      className="text-left p-2 rounded-lg bg-white border border-[#E8E8E5] hover:border-[#252525] transition-colors group"
                    >
                      <div className="text-xs font-medium text-[#252525] group-hover:text-amber-800">
                        {item.label}
                      </div>
                      <div className="text-[10px] text-[#777777] line-clamp-1">
                        {item.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sections Stack List with Drag-and-Drop */}
            <div className="space-y-2">
              {config.sections.map((sec, idx) => {
                const isSelected = selectedSectionId === sec.id;
                const isDragged = draggedIndex === idx;
                const isDragOver = dragOverIndex === idx && draggedIndex !== idx;

                return (
                  <div
                    key={sec.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(idx));
                      setDraggedIndex(idx);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverIndex !== idx) {
                        setDragOverIndex(idx);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverIndex === idx) {
                        setDragOverIndex(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedIndex !== null && draggedIndex !== idx) {
                        reorderSections(draggedIndex, idx);
                      }
                      setDraggedIndex(null);
                      setDragOverIndex(null);
                    }}
                    onDragEnd={() => {
                      setDraggedIndex(null);
                      setDragOverIndex(null);
                    }}
                    onClick={() => setSelectedSectionId(sec.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-2 relative ${
                      isDragged ? 'opacity-40 border-dashed border-[#252525] scale-[0.98]' : ''
                    } ${
                      isDragOver ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-400' : ''
                    } ${
                      isSelected && !isDragOver
                        ? 'border-[#252525] bg-[#FAF9F7] ring-1 ring-[#252525] shadow-xs'
                        : !isDragOver ? 'border-[#E8E8E5] bg-white hover:border-[#CCCCCC]' : ''
                    }`}
                  >
                    {/* Visual Insertion Line Indicator */}
                    {isDragOver && (
                      <div className="absolute -top-1 left-3 right-3 h-0.5 bg-amber-500 rounded-full animate-pulse pointer-events-none" />
                    )}

                    <div className="flex items-center gap-2 min-w-0">
                      {/* Drag Handle Icon */}
                      <div 
                        className="p-1 -ml-1 text-stone-400 hover:text-stone-700 cursor-grab active:cursor-grabbing rounded hover:bg-stone-100 shrink-0"
                        title="Drag to reorder"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>

                      <span className="text-[10px] font-mono text-[#999999] w-4 shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>

                      <div className="truncate min-w-0">
                        <span className="text-xs font-medium text-[#252525] block truncate">
                          {sec.title || sec.type}
                        </span>
                        <span className="text-[10px] font-mono text-[#8B806F] uppercase">
                          {sec.type}
                        </span>
                      </div>
                    </div>

                    {/* Section Action Buttons */}
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {/* Move Up */}
                      <button
                        onClick={() => moveSection(sec.id, 'up')}
                        disabled={idx === 0}
                        className="p-1 text-[#777777] hover:text-[#252525] disabled:opacity-20 rounded"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>

                      {/* Move Down */}
                      <button
                        onClick={() => moveSection(sec.id, 'down')}
                        disabled={idx === config.sections.length - 1}
                        className="p-1 text-[#777777] hover:text-[#252525] disabled:opacity-20 rounded"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Visibility Toggle */}
                      <button
                        onClick={() => toggleSectionVisibility(sec.id)}
                        className={`p-1 rounded ${sec.enabled ? 'text-[#777777] hover:text-[#252525]' : 'text-stone-300'}`}
                        title={sec.enabled ? 'Hide Section' : 'Show Section'}
                      >
                        {sec.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>

                      {/* Delete Section */}
                      <button
                        onClick={() => removeSection(sec.id)}
                        className="p-1 text-[#777777] hover:text-red-600 rounded transition-colors"
                        title="Delete Section"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. DESIGN TAB */}
        {activeTab === 'design' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-semibold text-[#252525] uppercase tracking-wider">
                Global Palette & Design Tokens
              </h3>
              <p className="text-[11px] text-[#777777]">
                Colors and typography synchronize across the entire wedding website.
              </p>
            </div>

            {/* Colors */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-[#252525] block">
                Brand Palette
              </label>

              {[
                { key: 'primary', label: 'Primary (Headers & Buttons)', val: config.design.palette.primary },
                { key: 'accent', label: 'Accent (Gold / Rose / Sage)', val: config.design.palette.accent },
                { key: 'background', label: 'Page Background', val: config.design.palette.background },
                { key: 'surface', label: 'Card Surface', val: config.design.palette.surface },
                { key: 'text', label: 'Body Text', val: config.design.palette.text },
              ].map((c) => (
                <div key={c.key} className="flex items-center justify-between p-2 rounded-lg border border-[#E8E8E5] bg-white">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={c.val}
                      onChange={(e) => updateDesign({ palette: { [c.key]: e.target.value } as any })}
                      className="w-7 h-7 rounded border-0 cursor-pointer p-0 bg-transparent"
                    />
                    <span className="text-xs text-[#252525]">{c.label}</span>
                  </div>
                  <span className="font-mono text-[10px] text-[#777777] uppercase">{c.val}</span>
                </div>
              ))}
            </div>

            {/* Typography */}
            <div className="space-y-3 pt-3 border-t border-[#E8E8E5]">
              <label className="text-xs font-medium text-[#252525] block">
                Typography Hierarchy
              </label>

              <div className="space-y-2">
                <div>
                  <span className="text-[11px] text-[#777777] block mb-1">Heading Font</span>
                  <select
                    value={config.design.typography.headingFont}
                    onChange={(e) => updateDesign({ typography: { ...config.design.typography, headingFont: e.target.value } })}
                    className="w-full h-8 text-xs bg-white border border-[#E8E8E5] rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-[11px] text-[#777777] block mb-1">Body Font</span>
                  <select
                    value={config.design.typography.bodyFont}
                    onChange={(e) => updateDesign({ typography: { ...config.design.typography, bodyFont: e.target.value } })}
                    className="w-full h-8 text-xs bg-white border border-[#E8E8E5] rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-[11px] text-[#777777] block mb-1">Calligraphy Accent Font</span>
                  <select
                    value={config.design.typography.accentFont}
                    onChange={(e) => updateDesign({ typography: { ...config.design.typography, accentFont: e.target.value } })}
                    className="w-full h-8 text-xs bg-white border border-[#E8E8E5] rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. MEDIA TAB */}
        {activeTab === 'media' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-[#252525] uppercase tracking-wider">
                Photo & Media Library
              </h3>
              <p className="text-[11px] text-[#777777]">
                Optimized high-resolution images stored in Cloudflare R2 storage.
              </p>
            </div>

            {/* Quick Upload Action */}
            <div className="p-4 border-2 border-dashed border-[#D5D4CF] hover:border-[#252525] rounded-2xl text-center bg-[#FAF9F7] cursor-pointer transition-colors relative">
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const formData = new FormData();
                  formData.append('file', file);
                  try {
                    const res = await fetch('/api/upload', {
                      method: 'POST',
                      body: formData
                    });
                    if (res.ok) {
                      const json = await res.json();
                      const uploadedUrl = json.data?.medium_url || json.data?.original_url;
                      if (uploadedUrl && selectedSectionId) {
                        updateSection(selectedSectionId, {
                          content: { backgroundImage: uploadedUrl }
                        });
                        setMediaUploadSuccess('Photo uploaded and set to selected section!');
                        setTimeout(() => setMediaUploadSuccess(null), 3000);
                      }
                    }
                  } catch (err) {
                    console.error('Upload error:', err);
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Upload className="w-6 h-6 text-[#777777] mx-auto mb-1.5" />
              <div className="text-xs font-medium text-[#252525]">Click to upload photo</div>
              <div className="text-[10px] text-[#999999] mt-0.5">JPG, PNG, or WEBP up to 25MB</div>
            </div>

            {mediaUploadSuccess && (
              <div className="text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                {mediaUploadSuccess}
              </div>
            )}

            {/* Stock / Event Photos */}
            <div className="space-y-2 pt-2">
              <span className="text-[11px] font-semibold text-[#252525] uppercase tracking-wider block">
                Available Wedding Assets
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=400',
                  'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&q=80&w=400',
                  'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&q=80&w=400',
                  'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&q=80&w=400',
                  'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&q=80&w=400',
                  'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?auto=format&fit=crop&q=80&w=400'
                ].map((url, i) => (
                  <div 
                    key={i}
                    onClick={() => {
                      if (selectedSectionId) {
                        updateSection(selectedSectionId, {
                          content: { backgroundImage: url }
                        });
                      }
                    }}
                    className="aspect-[4/3] rounded-lg overflow-hidden border border-[#E8E8E5] hover:border-[#252525] cursor-pointer group relative shadow-xs"
                  >
                    <img src={url} alt="Wedding asset" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-medium">
                      Apply to Section
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 5. SETTINGS & SEO TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* 5.1 Website Publication & Public URL */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#252525] uppercase tracking-wider">
                  Publication Status
                </h3>
                <span className={`font-mono text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${
                  publicationStatus === 'published'
                    ? 'bg-emerald-100 text-emerald-800'
                    : publicationStatus === 'unpublished'
                      ? 'bg-stone-200 text-stone-800'
                      : 'bg-amber-100 text-amber-800'
                }`}>
                  {publicationStatus.toUpperCase()}
                </span>
              </div>

              {project?.slug && (
                <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#E8E8E5] text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#252525] text-[11px]">Public Website URL</span>
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/${project.slug}/website`;
                        navigator.clipboard.writeText(url);
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 2000);
                      }}
                      className="text-[11px] text-amber-800 hover:text-amber-900 font-medium flex items-center gap-1"
                    >
                      {copiedUrl ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedUrl ? 'Copied' : 'Copy Link'}</span>
                    </button>
                  </div>
                  <div className="font-mono text-[#8B806F] text-[11px] break-all select-all">
                    {window.location.origin}/{project.slug}/website
                  </div>
                  <div className="pt-1 flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setIsPublishModalOpen(true)}
                      leftIcon={<Sparkles className="w-3 h-3" />}
                      className="flex-1 !h-7 !text-[11px] !bg-[#252525]"
                    >
                      {publicationStatus === 'published' ? 'Update Website' : 'Publish Website'}
                    </Button>
                    {publicationStatus === 'published' && (
                      <a
                        href={`/${project.slug}/website`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 h-7 rounded-lg border border-[#E8E8E5] text-xs flex items-center justify-center hover:bg-stone-100 transition-colors"
                        title="Open Website"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-stone-600" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 5.2 SEO Configuration */}
            <div className="space-y-3.5 pt-4 border-t border-[#E8E8E5]">
              <div>
                <h3 className="text-xs font-semibold text-[#252525] uppercase tracking-wider">
                  Search Engine Optimization (SEO)
                </h3>
                <p className="text-[11px] text-[#777777] mt-0.5">
                  Customize how your celebration appears on Google and search engines.
                </p>
              </div>

              <Input
                label="SEO Page Title"
                value={config.seo?.title || ''}
                onChange={(e) => updateSEO({ title: e.target.value })}
                placeholder={`${project?.groom_name || 'Lucas'} & ${project?.bride_name || 'Sofia'} Wedding`}
              />

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-medium text-[#777777]">Meta Description</label>
                  <span className="font-mono text-[10px] text-stone-400">
                    {(config.seo?.description || '').length} / 160
                  </span>
                </div>
                <textarea
                  value={config.seo?.description || ''}
                  onChange={(e) => updateSEO({ description: e.target.value })}
                  placeholder="A romantic summary of your wedding celebration, venue, and RSVP details..."
                  className="w-full p-2 text-xs bg-white text-[#252525] border border-[#E8E8E5] rounded-md h-18 resize-none focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
                />
              </div>

              <Input
                label="SEO Keywords"
                value={config.seo?.keywords || ''}
                onChange={(e) => updateSEO({ keywords: e.target.value })}
                placeholder="wedding, RSVP, schedule, celebration"
              />

              <div className="pt-1">
                <label className="flex items-center gap-2 text-xs text-[#252525] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!config.seo?.noIndex}
                    onChange={(e) => updateSEO({ noIndex: !e.target.checked })}
                    className="rounded border-[#E8E8E5] text-[#252525] focus:ring-[#8B806F]"
                  />
                  <span>Allow search engines to index this wedding website</span>
                </label>
                <p className="text-[10px] text-[#999999] ml-5 mt-0.5">
                  When unchecked, adds noindex directives and excludes from sitemap for private events.
                </p>
              </div>
            </div>

            {/* 5.3 Social Sharing & Open Graph Preview */}
            <div className="space-y-3.5 pt-4 border-t border-[#E8E8E5]">
              <div>
                <h3 className="text-xs font-semibold text-[#252525] uppercase tracking-wider">
                  Social Sharing Card
                </h3>
                <p className="text-[11px] text-[#777777] mt-0.5">
                  Card appearance when shared on iMessage, WhatsApp, Slack, and Facebook.
                </p>
              </div>

              <Input
                label="Social Share Title"
                value={config.seo?.ogTitle || ''}
                onChange={(e) => updateSEO({ ogTitle: e.target.value })}
                placeholder={config.seo?.title || `${project?.groom_name || 'Lucas'} & ${project?.bride_name || 'Sofia'} • Wedding Celebration`}
              />

              <Input
                label="Social Share Image URL"
                value={config.seo?.ogImage || ''}
                onChange={(e) => updateSEO({ ogImage: e.target.value })}
                placeholder="https://images.unsplash.com/..."
              />

              {/* Live Social Sharing Card Mockup */}
              <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#E8E8E5] space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500 font-semibold block">
                  Social Card Preview
                </span>
                <div className="rounded-xl overflow-hidden border border-stone-200 bg-white shadow-xs">
                  <img
                    src={config.seo?.ogImage || project?.image_url || 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800'}
                    alt="Social Card Banner"
                    className="w-full aspect-[1.91/1] object-cover bg-stone-100"
                  />
                  <div className="p-3 space-y-1">
                    <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider block">
                      eventframe.io
                    </span>
                    <div className="text-xs font-semibold text-stone-900 truncate">
                      {config.seo?.ogTitle || config.seo?.title || `${project?.groom_name || 'Lucas'} & ${project?.bride_name || 'Sofia'} • Wedding Celebration`}
                    </div>
                    <p className="text-[11px] text-stone-500 line-clamp-2 leading-relaxed">
                      {config.seo?.ogDescription || config.seo?.description || `Join ${project?.groom_name || 'Lucas'} & ${project?.bride_name || 'Sofia'} as they celebrate their union. View schedule, venue details, and RSVP online.`}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 5.4 Website Preferences */}
            <div className="space-y-3.5 pt-4 border-t border-[#E8E8E5]">
              <h3 className="text-xs font-semibold text-[#252525] uppercase tracking-wider">
                Website Preferences
              </h3>

              <Input
                label="Navigation Site Title"
                value={config.settings.siteTitle || ''}
                onChange={(e) => updateSettings({ siteTitle: e.target.value })}
                placeholder="e.g. Lucas & Sofia"
              />

              <Input
                label="Announcement Ribbon Text"
                value={config.settings.announcementBar || ''}
                onChange={(e) => updateSettings({ announcementBar: e.target.value })}
                placeholder="e.g. Kindly RSVP by August 15th"
              />

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-xs text-[#252525] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.settings.showNav}
                    onChange={(e) => updateSettings({ showNav: e.target.checked })}
                    className="rounded border-[#E8E8E5] text-[#252525] focus:ring-[#8B806F]"
                  />
                  <span>Show top floating navigation bar</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-[#252525] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.settings.rsvpButtonInNav}
                    onChange={(e) => updateSettings({ rsvpButtonInNav: e.target.checked })}
                    className="rounded border-[#E8E8E5] text-[#252525] focus:ring-[#8B806F]"
                  />
                  <span>Include prominent RSVP action button in navigation</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* TAB: LANGUAGES & LOCALIZATION */}
        {activeTab === 'languages' && (
          <LanguageManager />
        )}
      </div>
    </aside>
  );
};
