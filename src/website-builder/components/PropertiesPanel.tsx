import React from 'react';
import { 
  Sliders, 
  Trash2, 
  Eye, 
  EyeOff, 
  AlignLeft, 
  AlignCenter, 
  Image as ImageIcon,
  MousePointer2,
  Sparkles,
  Plus,
  Clock,
  Calendar,
  Heart,
  MapPin,
  ExternalLink
} from 'lucide-react';
import { useWebsiteStore } from '../store/websiteStore';
import Input from '../../design-system/components/Input';
import Button from '../../design-system/components/Button';

export const PropertiesPanel: React.FC = () => {
  const { 
    config, 
    selectedSectionId, 
    updateSection, 
    removeSection, 
    toggleSectionVisibility,
    addStoryMilestone,
    updateStoryMilestone,
    removeStoryMilestone,
    addScheduleEvent,
    updateScheduleEvent,
    removeScheduleEvent,
    addGalleryPhoto,
    updateGalleryPhoto,
    removeGalleryPhoto,
    project
  } = useWebsiteStore();

  const selectedSection = config.sections.find((s) => s.id === selectedSectionId);

  // If no section is selected, show general site inspector
  if (!selectedSection) {
    return (
      <aside className="w-80 sm:w-88 bg-white border-l border-[#E8E8E5] flex flex-col items-center justify-center p-8 text-center shrink-0 z-20">
        <div className="w-12 h-12 bg-[#FAF9F7] border border-[#E8E8E5] rounded-full flex items-center justify-center mb-3 text-[#777777]">
          <MousePointer2 className="w-5 h-5" />
        </div>
        <h4 className="text-xs font-semibold text-[#252525]">No Section Selected</h4>
        <p className="text-[11px] text-[#777777] mt-1.5 leading-relaxed">
          Click on any section in the center canvas to inspect and edit its layout, content, and background styling.
        </p>
      </aside>
    );
  }

  const content = selectedSection.content || {};

  return (
    <aside className="w-80 sm:w-88 bg-white border-l border-[#E8E8E5] flex flex-col shrink-0 z-20 overflow-y-auto select-none">
      <div className="p-4 space-y-6">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E8E8E5]">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-semibold text-[#252525] uppercase tracking-wide truncate">
              {selectedSection.title || selectedSection.type}
            </span>
            <span className="text-[10px] text-[#8B806F] font-mono shrink-0">
              #{selectedSection.type}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => toggleSectionVisibility(selectedSection.id)}
              className={`p-1.5 rounded transition-colors ${
                selectedSection.enabled 
                  ? 'text-[#777777] hover:text-[#252525] hover:bg-[#FAF9F7]' 
                  : 'text-stone-300 hover:text-stone-600'
              }`}
              title={selectedSection.enabled ? 'Hide Section' : 'Show Section'}
            >
              {selectedSection.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>

            <button
              onClick={() => removeSection(selectedSection.id)}
              className="p-1.5 text-[#777777] hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Delete Section"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Section Content Fields */}
        <div className="space-y-4">
          <label className="text-xs font-semibold text-[#252525] uppercase tracking-wider block">
            Content Details
          </label>

          {/* Section Headline */}
          <Input
            label="Section Headline"
            value={content.headline ?? selectedSection.title ?? ''}
            onChange={(e) => updateSection(selectedSection.id, { 
              title: e.target.value,
              content: { headline: e.target.value } 
            })}
          />

          {/* Subheadline / Narrative description */}
          {selectedSection.type !== 'countdown' && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#777777]">Subheadline / Description</label>
              <textarea
                value={content.subheadline || ''}
                onChange={(e) => updateSection(selectedSection.id, { 
                  content: { subheadline: e.target.value } 
                })}
                placeholder="Share a thoughtful message for your guests..."
                className="w-full p-2 text-xs bg-white text-[#252525] border border-[#E8E8E5] rounded-md h-20 resize-none focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
              />
            </div>
          )}

          {/* HERO SPECIFIC FIELDS */}
          {selectedSection.type === 'hero' && (
            <div className="space-y-3 pt-2 border-t border-[#E8E8E5]">
              <span className="text-[11px] font-semibold text-[#252525] uppercase tracking-wider block">
                Hero Call to Actions
              </span>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Primary Button"
                  value={content.buttonText || ''}
                  onChange={(e) => updateSection(selectedSection.id, { content: { buttonText: e.target.value } })}
                  placeholder="RSVP Today"
                />
                <Input
                  label="Link Target"
                  value={content.buttonLink || ''}
                  onChange={(e) => updateSection(selectedSection.id, { content: { buttonLink: e.target.value } })}
                  placeholder="#rsvp"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Secondary Button"
                  value={content.secondaryButtonText || ''}
                  onChange={(e) => updateSection(selectedSection.id, { content: { secondaryButtonText: e.target.value } })}
                  placeholder="Our Story"
                />
                <Input
                  label="Link Target"
                  value={content.secondaryButtonLink || ''}
                  onChange={(e) => updateSection(selectedSection.id, { content: { secondaryButtonLink: e.target.value } })}
                  placeholder="#story"
                />
              </div>
            </div>
          )}

          {/* STORY SPECIFIC: MILESTONES MANAGER */}
          {selectedSection.type === 'story' && (
            <div className="space-y-3 pt-2 border-t border-[#E8E8E5]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#252525] uppercase tracking-wider">
                  Story Milestones ({content.milestones?.length || 0})
                </span>
                <button
                  onClick={() => addStoryMilestone(selectedSection.id)}
                  className="inline-flex items-center gap-1 text-[11px] text-amber-800 hover:text-amber-900 font-semibold bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded border border-amber-200 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add Milestone
                </button>
              </div>

              <div className="space-y-3">
                {(content.milestones || []).map((m, mIdx) => (
                  <div key={m.id} className="p-3 bg-[#FAF9F7] rounded-xl border border-[#E8E8E5] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-semibold text-stone-500 uppercase">
                        Milestone #{mIdx + 1}
                      </span>
                      <button
                        onClick={() => removeStoryMilestone(selectedSection.id, m.id)}
                        className="text-stone-400 hover:text-red-600 transition-colors"
                        title="Delete Milestone"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1">
                        <Input
                          label="Year"
                          value={m.year || ''}
                          onChange={(e) => updateStoryMilestone(selectedSection.id, m.id, { year: e.target.value })}
                          placeholder="2020"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          label="Title"
                          value={m.title}
                          onChange={(e) => updateStoryMilestone(selectedSection.id, m.id, { title: e.target.value })}
                          placeholder="First Met"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-[#777777]">Description</label>
                      <textarea
                        value={m.description}
                        onChange={(e) => updateStoryMilestone(selectedSection.id, m.id, { description: e.target.value })}
                        className="w-full p-1.5 text-xs bg-white text-[#252525] border border-[#E8E8E5] rounded h-14 resize-none focus:outline-none"
                      />
                    </div>

                    <Input
                      label="Photo URL"
                      value={m.image || ''}
                      onChange={(e) => updateStoryMilestone(selectedSection.id, m.id, { image: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SCHEDULE SPECIFIC: ITINERARY MANAGER */}
          {selectedSection.type === 'schedule' && (
            <div className="space-y-3 pt-2 border-t border-[#E8E8E5]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#252525] uppercase tracking-wider">
                  Itinerary Events ({content.events?.length || 0})
                </span>
                <button
                  onClick={() => addScheduleEvent(selectedSection.id)}
                  className="inline-flex items-center gap-1 text-[11px] text-amber-800 hover:text-amber-900 font-semibold bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded border border-amber-200 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add Event
                </button>
              </div>

              <div className="space-y-3">
                {(content.events || []).map((ev, evIdx) => (
                  <div key={ev.id} className="p-3 bg-[#FAF9F7] rounded-xl border border-[#E8E8E5] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-semibold text-stone-500 uppercase">
                        Event #{evIdx + 1}
                      </span>
                      <button
                        onClick={() => removeScheduleEvent(selectedSection.id, ev.id)}
                        className="text-stone-400 hover:text-red-600 transition-colors"
                        title="Delete Event"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1">
                        <Input
                          label="Time"
                          value={ev.time}
                          onChange={(e) => updateScheduleEvent(selectedSection.id, ev.id, { time: e.target.value })}
                          placeholder="4:00 PM"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          label="Event Name"
                          value={ev.title}
                          onChange={(e) => updateScheduleEvent(selectedSection.id, ev.id, { title: e.target.value })}
                          placeholder="Ceremony"
                        />
                      </div>
                    </div>

                    <Input
                      label="Location"
                      value={ev.location || ''}
                      onChange={(e) => updateScheduleEvent(selectedSection.id, ev.id, { location: e.target.value })}
                      placeholder="e.g. Garden Pavilion"
                    />

                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-[#777777]">Details</label>
                      <textarea
                        value={ev.description || ''}
                        onChange={(e) => updateScheduleEvent(selectedSection.id, ev.id, { description: e.target.value })}
                        className="w-full p-1.5 text-xs bg-white text-[#252525] border border-[#E8E8E5] rounded h-14 resize-none focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VENUE SPECIFIC FIELDS */}
          {selectedSection.type === 'venue' && (
            <div className="space-y-2.5 pt-2 border-t border-[#E8E8E5]">
              <span className="text-[11px] font-semibold text-[#252525] uppercase tracking-wider block">
                Venue Location & Details
              </span>
              <Input
                label="Venue Name"
                value={content.venueName || ''}
                onChange={(e) => updateSection(selectedSection.id, { content: { venueName: e.target.value } })}
                placeholder="e.g. Villa Montalvo Estate"
              />
              <Input
                label="Full Address"
                value={content.address || ''}
                onChange={(e) => updateSection(selectedSection.id, { content: { address: e.target.value } })}
                placeholder="15400 Montalvo Road, Saratoga, CA"
              />
              <Input
                label="Dress Code / Attire Guideline"
                value={content.attire || ''}
                onChange={(e) => updateSection(selectedSection.id, { content: { attire: e.target.value } })}
                placeholder="Black Tie Optional / Formal Garden"
              />
              <Input
                label="Directions / Google Maps URL"
                value={content.directionsUrl || ''}
                onChange={(e) => updateSection(selectedSection.id, { content: { directionsUrl: e.target.value } })}
                placeholder="https://maps.google.com/..."
              />
            </div>
          )}

          {/* GALLERY SPECIFIC: PHOTOS MANAGER */}
          {selectedSection.type === 'gallery' && (
            <div className="space-y-3 pt-2 border-t border-[#E8E8E5]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#252525] uppercase tracking-wider">
                  Gallery Photos ({content.photos?.length || 0})
                </span>
                <button
                  onClick={() => addGalleryPhoto(selectedSection.id)}
                  className="inline-flex items-center gap-1 text-[11px] text-amber-800 hover:text-amber-900 font-semibold bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded border border-amber-200 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add Photo
                </button>
              </div>

              <div className="space-y-2.5">
                {(content.photos || []).map((photo, pIdx) => (
                  <div key={photo.id} className="p-2.5 bg-[#FAF9F7] rounded-xl border border-[#E8E8E5] flex items-center gap-2.5">
                    <img 
                      src={photo.url} 
                      alt="Thumbnail" 
                      className="w-12 h-12 object-cover rounded-lg shrink-0 border border-stone-200" 
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <input
                        type="text"
                        value={photo.caption || ''}
                        onChange={(e) => updateGalleryPhoto(selectedSection.id, photo.id, { caption: e.target.value })}
                        placeholder="Photo Caption"
                        className="w-full text-xs bg-white border border-[#E8E8E5] rounded px-2 py-1"
                      />
                      <input
                        type="text"
                        value={photo.url}
                        onChange={(e) => updateGalleryPhoto(selectedSection.id, photo.id, { url: e.target.value })}
                        placeholder="Image URL"
                        className="w-full text-[10px] font-mono text-stone-500 bg-white border border-[#E8E8E5] rounded px-2 py-0.5"
                      />
                    </div>
                    <button
                      onClick={() => removeGalleryPhoto(selectedSection.id, photo.id)}
                      className="text-stone-400 hover:text-red-600 transition-colors p-1"
                      title="Delete Photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RSVP SPECIFIC FIELDS */}
          {selectedSection.type === 'rsvp' && (
            <div className="space-y-2.5 pt-2 border-t border-[#E8E8E5]">
              <span className="text-[11px] font-semibold text-[#252525] uppercase tracking-wider block">
                RSVP Response Details
              </span>
              <Input
                label="Confirmation Deadline"
                value={content.rsvpDeadline || ''}
                onChange={(e) => updateSection(selectedSection.id, { content: { rsvpDeadline: e.target.value } })}
                placeholder="August 15, 2025"
              />
              <Input
                label="Button Text"
                value={content.buttonText || ''}
                onChange={(e) => updateSection(selectedSection.id, { content: { buttonText: e.target.value } })}
                placeholder="Complete Full RSVP Questionnaire"
              />
            </div>
          )}

          {/* WALL SPECIFIC FIELDS */}
          {selectedSection.type === 'wall' && (
            <div className="space-y-2.5 pt-2 border-t border-[#E8E8E5]">
              <span className="text-[11px] font-semibold text-[#252525] uppercase tracking-wider block">
                Live Reception Wall Settings
              </span>
              <Input
                label="Button Text"
                value={content.buttonText || ''}
                onChange={(e) => updateSection(selectedSection.id, { content: { buttonText: e.target.value } })}
                placeholder="Leave a Message for the Couple"
              />
            </div>
          )}

          {/* FOOTER SPECIFIC FIELDS */}
          {selectedSection.type === 'footer' && (
            <div className="space-y-2.5 pt-2 border-t border-[#E8E8E5]">
              <span className="text-[11px] font-semibold text-[#252525] uppercase tracking-wider block">
                Closing Blessings & Monogram
              </span>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#777777]">Thank You Message</label>
                <textarea
                  value={content.thankYouMessage || ''}
                  onChange={(e) => updateSection(selectedSection.id, { content: { thankYouMessage: e.target.value } })}
                  placeholder="With immense gratitude and love..."
                  className="w-full p-2 text-xs bg-white text-[#252525] border border-[#E8E8E5] rounded-md h-20 resize-none focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Background & Photo Settings */}
        <div className="space-y-3 pt-3 border-t border-[#E8E8E5]">
          <label className="text-xs font-semibold text-[#252525] uppercase tracking-wider block">
            Background & Styling
          </label>

          {/* Background Style Preset */}
          <div>
            <span className="text-[11px] text-[#777777] block mb-1.5">Surface Style</span>
            <div className="grid grid-cols-3 gap-1.5">
              {(['default', 'surface', 'dark'] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => updateSection(selectedSection.id, { backgroundStyle: style })}
                  className={`py-1.5 text-xs rounded border capitalize transition-colors ${
                    (selectedSection.backgroundStyle || 'default') === style
                      ? 'border-[#252525] bg-[#FAF9F7] font-semibold text-[#252525]'
                      : 'border-[#E8E8E5] text-[#777777] hover:text-[#252525]'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* Hero Background Image & Scrim */}
          {selectedSection.type === 'hero' && (
            <div className="space-y-2 pt-2">
              <Input
                label="Background Image URL"
                value={content.backgroundImage || ''}
                onChange={(e) => updateSection(selectedSection.id, { content: { backgroundImage: e.target.value } })}
                placeholder="https://..."
              />
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-[#777777]">
                  <span>Dark Scrim Overlay</span>
                  <span className="font-mono text-[#252525]">{content.overlayOpacity ?? 45}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="90"
                  value={content.overlayOpacity ?? 45}
                  onChange={(e) => updateSection(selectedSection.id, { content: { overlayOpacity: parseInt(e.target.value) } })}
                  className="w-full h-1 bg-[#E8E8E5] rounded appearance-none cursor-pointer accent-[#252525]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Spacing & Alignment */}
        <div className="space-y-3 pt-3 border-t border-[#E8E8E5]">
          <label className="text-xs font-semibold text-[#252525] uppercase tracking-wider block">
            Layout & Spacing
          </label>

          {/* Vertical Padding */}
          <div>
            <span className="text-[11px] text-[#777777] block mb-1.5">Vertical Padding</span>
            <div className="grid grid-cols-3 gap-1.5">
              {(['compact', 'normal', 'relaxed'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => updateSection(selectedSection.id, { paddingY: p })}
                  className={`py-1.5 text-xs rounded border capitalize transition-colors ${
                    (selectedSection.paddingY || 'normal') === p
                      ? 'border-[#252525] bg-[#FAF9F7] font-semibold text-[#252525]'
                      : 'border-[#E8E8E5] text-[#777777] hover:text-[#252525]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

