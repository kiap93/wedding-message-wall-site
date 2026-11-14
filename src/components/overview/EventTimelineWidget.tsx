import React, { useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Heart,
  Mail,
  Globe,
  Plus,
  Sparkles,
  Check,
  Trash2,
} from 'lucide-react';
import { WeddingEvent } from '../../types';
import {
  CustomEventMilestone,
  TimelineMilestone,
  extractEventMilestones,
} from '../../lib/eventOverview';

interface EventTimelineWidgetProps {
  event: Partial<WeddingEvent>;
  onSaveCustomMilestones?: (milestones: CustomEventMilestone[]) => Promise<void>;
  onNavigateWebsite?: () => void;
}

export const EventTimelineWidget: React.FC<EventTimelineWidgetProps> = ({
  event,
  onSaveCustomMilestones,
  onNavigateWebsite,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(event.wedding_date || new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('');
  const [category, setCategory] = useState<CustomEventMilestone['category']>('planning');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const milestones = extractEventMilestones(event);

  const getExistingCustomMilestones = (): CustomEventMilestone[] => {
    let wc = event.website_config;
    if (typeof wc === 'string') {
      try {
        wc = JSON.parse(wc);
      } catch {
        wc = null;
      }
    }
    return Array.isArray(wc?.overviewMilestones) ? wc.overviewMilestones : [];
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date || !onSaveCustomMilestones) return;

    setIsSaving(true);
    setErrorMsg(null);
    try {
      const existing = getExistingCustomMilestones();
      const next: CustomEventMilestone[] = [
        ...existing,
        {
          id: `custom-${Date.now()}`,
          title: title.trim(),
          date,
          time: time.trim() || undefined,
          category,
          completed: false,
        },
      ];
      await onSaveCustomMilestones(next);
      setTitle('');
      setTime('');
      setIsAdding(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to save milestone');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleComplete = async (milestoneId: string) => {
    if (!onSaveCustomMilestones) return;
    const existing = getExistingCustomMilestones();
    const next = existing.map((m) =>
      m.id === milestoneId ? { ...m, completed: !m.completed } : m
    );
    try {
      await onSaveCustomMilestones(next);
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to update milestone');
    }
  };

  const handleDeleteCustom = async (milestoneId: string) => {
    if (!onSaveCustomMilestones) return;
    const existing = getExistingCustomMilestones();
    const next = existing.filter((m) => m.id !== milestoneId);
    try {
      await onSaveCustomMilestones(next);
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to delete milestone');
    }
  };

  const getCategoryIcon = (cat: TimelineMilestone['category']) => {
    switch (cat) {
      case 'wedding_day':
        return <Heart className="w-3.5 h-3.5" />;
      case 'ceremony':
        return <Sparkles className="w-3.5 h-3.5" />;
      case 'reception':
        return <Clock className="w-3.5 h-3.5" />;
      case 'invitation':
        return <Mail className="w-3.5 h-3.5" />;
      case 'website':
        return <Globe className="w-3.5 h-3.5" />;
      case 'rsvp':
        return <CheckCircle2 className="w-3.5 h-3.5" />;
      default:
        return <CalendarDays className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="rounded-2xl border border-[#E6E0D6] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(37,37,37,0.03)] flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#EFEAE0]">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#9A7B38]" />
              <h2 className="font-serif text-lg font-normal text-[#23201C]">
                Event Calendar & Timeline
              </h2>
            </div>
            <p className="text-xs text-[#7A7368] mt-0.5">
              Ceremony, reception schedule, RSVP deadline & planning milestones
            </p>
          </div>

          {onSaveCustomMilestones && (
            <button
              type="button"
              onClick={() => setIsAdding((v) => !v)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#FAF7F0] text-[#23201C] border border-[#E6E0D6] hover:border-[#C9A24D] transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-[#9A7B38]" />
              <span>{isAdding ? 'Close' : 'Add Milestone'}</span>
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
            {errorMsg}
          </div>
        )}

        {/* Inline Add Milestone Form */}
        {isAdding && (
          <form
            onSubmit={handleAddMilestone}
            className="mt-4 p-4 rounded-xl bg-[#FAF7F0] border border-[#E6E0D6] space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[#5C554C] mb-1">
                  Milestone Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Send Final Menu to Caterer"
                  className="w-full h-8 px-2.5 text-xs bg-white border border-[#DFD8CC] rounded-lg text-[#23201C] focus:outline-none focus:border-[#9A7B38]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-[#5C554C] mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full h-8 px-2 text-xs bg-white border border-[#DFD8CC] rounded-lg text-[#23201C] focus:outline-none focus:border-[#9A7B38]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#5C554C] mb-1">
                    Time (Optional)
                  </label>
                  <input
                    type="text"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    placeholder="4:00 PM"
                    className="w-full h-8 px-2.5 text-xs bg-white border border-[#DFD8CC] rounded-lg text-[#23201C] focus:outline-none focus:border-[#9A7B38]"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="h-8 px-2.5 text-xs bg-white border border-[#DFD8CC] rounded-lg text-[#23201C]"
              >
                <option value="planning">Planning Milestone</option>
                <option value="ceremony">Ceremony</option>
                <option value="reception">Reception</option>
                <option value="rsvp">RSVP Deadline</option>
                <option value="invitation">Invitations</option>
              </select>

              <button
                type="submit"
                disabled={isSaving}
                className="h-8 px-3.5 rounded-lg bg-[#23201C] text-white text-xs font-medium hover:bg-[#38332D] transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Milestone'}
              </button>
            </div>
          </form>
        )}

        {/* Timeline List */}
        {milestones.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-xs text-[#7A7368]">
              No ceremony schedule or planning milestones configured yet.
            </p>
            {onNavigateWebsite && (
              <button
                type="button"
                onClick={onNavigateWebsite}
                className="text-xs font-medium text-[#8B7344] underline hover:text-[#23201C]"
              >
                Add schedule & RSVP deadline in Website Studio
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 relative space-y-3">
            {milestones.map((item, idx) => {
              const isCompleted = item.status === 'completed';
              const isToday = item.status === 'today';

              return (
                <div
                  key={item.id}
                  className="relative flex items-start gap-3.5 group"
                >
                  {/* Vertical connector line */}
                  {idx < milestones.length - 1 && (
                    <span className="absolute left-[13px] top-7 bottom-[-12px] w-px bg-[#EAE3D5]" />
                  )}

                  {/* Node Marker */}
                  <div
                    className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      isToday
                        ? 'bg-[#C9A24D] border-[#B28B37] text-white'
                        : isCompleted
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-[#FAF7F0] border-[#DFD8CC] text-[#9A7B38]'
                    }`}
                  >
                    {getCategoryIcon(item.category)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-xs font-semibold ${
                              item.completed ? 'line-through text-[#8A8276]' : 'text-[#23201C]'
                            }`}
                          >
                            {item.title}
                          </span>
                          {isToday && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#FAF5EA] text-[#8B7344] border border-[#E6D6B0]">
                              Today
                            </span>
                          )}
                        </div>
                        {item.subtitle && (
                          <p className="text-[11px] text-[#7A7368] mt-0.5 line-clamp-1">
                            {item.subtitle}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] font-mono text-[#7A7368] tabular-nums">
                          {item.dateLabel}
                        </span>

                        {item.isCustom && onSaveCustomMilestones && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleComplete(item.id)}
                              title={item.completed ? 'Mark upcoming' : 'Mark complete'}
                              className={`p-1 rounded border transition-colors ${
                                item.completed
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : 'bg-white border-[#E6E0D6] text-[#8A8276] hover:text-[#23201C]'
                              }`}
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustom(item.id)}
                              title="Remove milestone"
                              className="p-1 rounded border border-[#E6E0D6] bg-white text-[#8A8276] hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer guidance */}
      {onNavigateWebsite && milestones.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#EFEAE0] flex items-center justify-between text-[11px] text-[#7A7368]">
          <span>Synced with Website Schedule & RSVP settings</span>
          <button
            type="button"
            onClick={onNavigateWebsite}
            className="font-medium text-[#8B7344] hover:text-[#23201C] transition-colors"
          >
            Configure Schedule →
          </button>
        </div>
      )}
    </div>
  );
};

export default EventTimelineWidget;
