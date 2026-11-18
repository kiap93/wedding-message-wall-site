import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Calendar as CalendarIcon, MapPin, Sparkles } from 'lucide-react';
import { Agency, DEFAULT_TEMPLATES, WeddingEvent, WeddingTemplate } from '../../types';
import { API_BASE } from '../../lib/config';
import { authenticatedFetch, extractApiErrorMessage } from '../../lib/auth';
import { isValidProjectIdFormat } from '../../lib/workspaceNavigation';
import Modal from '../../design-system/components/Modal';
import Button from '../../design-system/components/Button';
import Input from '../../design-system/components/Input';
import Select from '../../design-system/components/Select';

export interface CreateWeddingModalProps {
  isOpen: boolean;
  onClose: () => void;
  agency: Agency | null;
  templates: WeddingTemplate[];
  isCoupleLimitReached?: boolean;
  onCreated: (createdProject: WeddingEvent) => void;
}

function buildSlugCandidate(groomName: string, brideName: string, randomSuffix: string): string {
  const combined = `${groomName} ${brideName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 44);
  if (combined.length >= 2) {
    return `${combined}-${randomSuffix}`;
  }
  return `wedding-${randomSuffix}`;
}

export const CreateWeddingModal: React.FC<CreateWeddingModalProps> = ({
  isOpen,
  onClose,
  agency,
  templates,
  isCoupleLimitReached = false,
  onCreated,
}) => {
  const [groomName, setGroomName] = useState('');
  const [brideName, setBrideName] = useState('');
  const [eventName, setEventName] = useState('');
  const [slug, setSlug] = useState('');
  const [weddingDate, setWeddingDate] = useState('');
  const [location, setLocation] = useState('');
  const [themeId, setThemeId] = useState('minimal_luxury');
  const [slugEditedManually, setSlugEditedManually] = useState(false);
  const [nameEditedManually, setNameEditedManually] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submitLockRef = useRef(false);
  const randomSuffixRef = useRef('a1b2c');

  useEffect(() => {
    if (!isOpen) return;
    randomSuffixRef.current = Math.random().toString(36).substring(2, 7);
    const today = new Date().toISOString().split('T')[0];
    setGroomName('');
    setBrideName('');
    setEventName('');
    setSlug(`wedding-${randomSuffixRef.current}`);
    setWeddingDate(today);
    setLocation('');
    setThemeId('minimal_luxury');
    setSlugEditedManually(false);
    setNameEditedManually(false);
    setIsSubmitting(false);
    setSubmitError(null);
    setFieldErrors({});
    submitLockRef.current = false;
  }, [isOpen]);

  const handlePartnerChange = (nextGroom: string, nextBride: string) => {
    setGroomName(nextGroom);
    setBrideName(nextBride);
    if (fieldErrors.partners) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.partners;
        delete next.groomName;
        delete next.brideName;
        return next;
      });
    }
    if (!nameEditedManually) {
      const g = nextGroom.trim();
      const b = nextBride.trim();
      setEventName(g && b ? `${g} & ${b}` : g || b ? `${g || b} Wedding` : '');
    }
    if (!slugEditedManually) {
      setSlug(buildSlugCandidate(nextGroom, nextBride, randomSuffixRef.current));
    }
  };

  const handleClose = () => {
    if (submitLockRef.current || isSubmitting) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitLockRef.current || isSubmitting) {
      return;
    }

    if (isCoupleLimitReached) {
      setSubmitError(
        'Individual couple accounts are limited to one wedding event. Upgrade to an Agency account to manage multiple events.'
      );
      return;
    }

    if (!agency?.id) {
      setSubmitError('Workspace organization is still initializing. Please try again in a moment.');
      return;
    }

    const trimmedGroom = groomName.trim();
    const trimmedBride = brideName.trim();
    const trimmedTitle = eventName.trim() || (trimmedGroom && trimmedBride ? `${trimmedGroom} & ${trimmedBride}` : '');
    const normalizedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    const trimmedDate = weddingDate.trim();

    const nextErrors: Record<string, string> = {};
    if (!trimmedGroom) {
      nextErrors.groomName = 'Partner 1 name is required.';
    }
    if (!trimmedBride) {
      nextErrors.brideName = 'Partner 2 name is required.';
    }
    if (!normalizedSlug || normalizedSlug.length < 3) {
      nextErrors.slug = 'Event URL slug must be at least 3 characters (letters, numbers, hyphens).';
    } else if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(normalizedSlug) || normalizedSlug.includes('--')) {
      nextErrors.slug = 'Event URL slug cannot start/end with hyphens or contain double hyphens.';
    }
    if (!trimmedDate || !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      nextErrors.weddingDate = 'Please select a valid wedding date.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setSubmitError(null);
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});

    try {
      const payload = {
        agency_id: agency.id,
        name: trimmedTitle,
        groom_name: trimmedGroom,
        bride_name: trimmedBride,
        slug: normalizedSlug,
        wedding_date: trimmedDate,
        location: location.trim(),
        theme_id: themeId || 'minimal_luxury',
        access_password: Math.random().toString(36).substring(2, 8).toUpperCase(),
        auto_approve_messages: false,
        image_url: '',
        rsvp_fields: [],
      };

      const response = await authenticatedFetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = extractApiErrorMessage(body, `Failed to create wedding event (${response.status}).`);
        setSubmitError(message);
        return;
      }

      const rawCreated = body?.data || body?.project || null;
      if (!rawCreated || !rawCreated.id || !isValidProjectIdFormat(String(rawCreated.id))) {
        setSubmitError('Wedding project was created without a valid project identifier. Please refresh and check your workspace.');
        return;
      }

      onCreated(rawCreated as WeddingEvent);
      onClose();
    } catch (err: any) {
      setSubmitError(err?.message || 'Unable to connect while creating your wedding event. Please try again.');
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const availableTemplates = templates.length > 0 ? templates : DEFAULT_TEMPLATES;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add New Wedding Event"
      description="Create and save your wedding event before entering the project workspace."
      maxWidth="lg"
    >
      <form id="create-wedding-event-form" onSubmit={handleSubmit} className="space-y-4">
        {isCoupleLimitReached && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2.5 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>
              Individual couple accounts are limited to one wedding event. Upgrade to an Agency account to manage multiple weddings.
            </span>
          </div>
        )}

        {submitError && (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-3 flex items-start gap-2.5 text-xs text-rose-800"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Groom / Partner 1 Name"
            name="groom_name"
            placeholder="e.g. Lucas"
            value={groomName}
            onChange={(e) => handlePartnerChange(e.target.value, brideName)}
            error={fieldErrors.groomName}
            disabled={isSubmitting || isCoupleLimitReached}
            required
          />
          <Input
            label="Bride / Partner 2 Name"
            name="bride_name"
            placeholder="e.g. Sofia"
            value={brideName}
            onChange={(e) => handlePartnerChange(groomName, e.target.value)}
            error={fieldErrors.brideName}
            disabled={isSubmitting || isCoupleLimitReached}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Event Title"
            name="name"
            placeholder="e.g. Lucas & Sofia"
            value={eventName}
            onChange={(e) => {
              setNameEditedManually(true);
              setEventName(e.target.value);
            }}
            hint="Defaults to the couple names if unchanged"
            disabled={isSubmitting || isCoupleLimitReached}
          />
          <Input
            label="Event URL Slug"
            name="slug"
            placeholder="lucas-sofia"
            value={slug}
            onChange={(e) => {
              setSlugEditedManually(true);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
              if (fieldErrors.slug) {
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.slug;
                  return next;
                });
              }
            }}
            error={fieldErrors.slug}
            hint={`Public URL: /${slug || 'your-slug'}/website`}
            disabled={isSubmitting || isCoupleLimitReached}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Wedding Date"
            name="wedding_date"
            type="date"
            leftIcon={<CalendarIcon className="w-3.5 h-3.5" />}
            value={weddingDate}
            onChange={(e) => {
              setWeddingDate(e.target.value);
              if (fieldErrors.weddingDate) {
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.weddingDate;
                  return next;
                });
              }
            }}
            error={fieldErrors.weddingDate}
            disabled={isSubmitting || isCoupleLimitReached}
            required
          />
          <Input
            label="Venue / Ceremony Location"
            name="location"
            leftIcon={<MapPin className="w-3.5 h-3.5" />}
            placeholder="e.g. Villa Erba, Lake Como"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            disabled={isSubmitting || isCoupleLimitReached}
          />
        </div>

        <Select
          label="Display Art Aesthetic"
          name="theme_id"
          value={themeId}
          onChange={(e) => setThemeId(e.target.value)}
          disabled={isSubmitting || isCoupleLimitReached}
          options={availableTemplates.map((tpl) => ({
            value: tpl.id,
            label: `${tpl.name}${tpl.description ? ` — ${tpl.description}` : ''}`,
          }))}
          hint="You can customize themes, RSVPs, seating, and stationery inside the workspace."
        />

        <div className="pt-3 border-t border-[#EFEFEA] flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            disabled={isSubmitting || isCoupleLimitReached}
            leftIcon={<Sparkles className="w-3.5 h-3.5" />}
          >
            {isSubmitting ? 'Creating Wedding Project...' : 'Create Wedding Project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateWeddingModal;
