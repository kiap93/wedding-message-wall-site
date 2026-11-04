import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Check, X } from 'lucide-react';
import { WeddingTemplate, RSVPField } from '../types';
import { ResolvedEventTheme, resolveEventTheme } from '../lib/eventTheme';
import { postRSVP } from '../lib/api';
import { useUser } from '../lib/UserContext';

interface RSVPFormProps {
  projectId: string;
  template?: WeddingTemplate;
  resolvedTheme?: ResolvedEventTheme;
  onSuccess: () => void;
  isPreview?: boolean;
  currentCount?: number;
  rsvpFields?: RSVPField[];
}

export default function RSVPForm({ 
  projectId, 
  template, 
  resolvedTheme: providedTheme, 
  onSuccess, 
  isPreview, 
  currentCount = 0, 
  rsvpFields 
}: RSVPFormProps) {
  const { user } = useUser();
  const theme = providedTheme || resolveEventTheme(template?.id, template ? [template] : []);

  const [formData, setFormData] = useState<Record<string, any>>({
    name: '',
    email: '',
    attending: true,
    guest_count: 1,
    meal_preference: 'Standard',
    dietary_requirements: ''
  });

  useEffect(() => {
    if (user && !formData.name) {
      setFormData(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || ''
      }));
    }
  }, [user]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // If rsvpFields is not provided, use standard defaults
  let safeRsvpFields: RSVPField[] = [];
  if (Array.isArray(rsvpFields)) {
    safeRsvpFields = rsvpFields;
  } else if (typeof rsvpFields === 'string') {
    try {
      safeRsvpFields = JSON.parse(rsvpFields);
    } catch (e) {
      console.error('Failed to parse rsvpFields string:', e);
      safeRsvpFields = [];
    }
  }

  const activeFields: RSVPField[] = (safeRsvpFields && safeRsvpFields.length > 0) ? safeRsvpFields : [
    { id: 'name', label: 'Full Name', type: 'text', required: true },
    { id: 'email', label: 'Email Address', type: 'text', required: false },
    { id: 'guest_count', label: 'Number of Guests', type: 'number', required: true, showIfAttending: true },
    { id: 'meal_preference', label: 'Meal Preference', type: 'select', required: true, options: ['Standard', 'Vegetarian', 'Vegan', 'Gluten Free'], showIfAttending: true },
    { id: 'dietary_requirements', label: 'Dietary Notes', type: 'textarea', required: false, showIfAttending: true }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!projectId || projectId === 'undefined') {
      setError("Could not identify the event. Please check the URL.");
      setIsSubmitting(false);
      return;
    }

    if (isPreview && currentCount >= 5) {
      setError("This event is in preview mode and has reached the limit of 5 RSVPs. Please contact the host.");
      setIsSubmitting(false);
      return;
    }

    try {
      const coreFields = ['name', 'email', 'attending', 'guest_count', 'meal_preference', 'dietary_requirements'];
      const payload: any = {
        project_id: projectId,
        attending: formData.attending,
        responses: {}
      };

      Object.keys(formData).forEach(key => {
        if (coreFields.includes(key)) {
          payload[key] = formData[key];
        } else if (key !== 'attending') {
          payload.responses[key] = formData[key];
        }
      });

      await postRSVP(payload);
      setIsSuccess(true);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to submit RSVP');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    const Icon = theme.IconComponent;
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-10 text-center"
      >
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${theme.colors.accent} bg-current/10`}>
          <Icon className="w-8 h-8 fill-current" />
        </div>
        <h3 className={`text-2xl ${theme.fontHeading} ${theme.colors.headerText} mb-2`}>
          Response Received
        </h3>
        <p className={`text-xs ${theme.colors.subtleText} max-w-xs mx-auto leading-relaxed`}>
          Your RSVP has been recorded. We look forward to celebrating together.
        </p>
      </motion.div>
    );
  }

  const renderField = (field: RSVPField) => {
    const isHidden = field.showIfAttending && !formData.attending;
    if (isHidden) return null;

    const inputClasses = `w-full px-3.5 py-2.5 text-xs sm:text-sm border transition-colors outline-none ${theme.input.base} ${theme.input.radius}`;

    return (
      <div key={field.id} className="space-y-1.5 text-left">
        <label className={`block text-xs font-medium ${theme.colors.subtleText}`}>
          {field.label} {field.required && <span className="text-red-500">*</span>}
        </label>
        
        {field.type === 'text' && (
          <input
            required={field.required}
            type="text"
            placeholder={field.placeholder || `Enter your ${field.label.toLowerCase()}`}
            value={formData[field.id] || ''}
            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
            className={inputClasses}
          />
        )}

        {field.type === 'textarea' && (
          <textarea
            required={field.required}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
            value={formData[field.id] || ''}
            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
            rows={3}
            className={`${inputClasses} resize-none`}
          />
        )}

        {field.type === 'number' && (
          field.id === 'guest_count' ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setFormData({ ...formData, guest_count: num })}
                  className={`w-9 h-9 sm:w-10 sm:h-10 text-xs sm:text-sm transition-all border ${theme.input.radius} flex items-center justify-center ${
                    formData.guest_count === num 
                      ? theme.button.pillActive
                      : theme.button.pillInactive
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          ) : (
            <input
              required={field.required}
              type="number"
              min={1}
              value={formData[field.id] || ''}
              onChange={(e) => setFormData({ ...formData, [field.id]: parseInt(e.target.value) || 1 })}
              className={inputClasses}
            />
          )
        )}

        {field.type === 'select' && (
          <div className="relative">
            <select
              required={field.required}
              value={formData[field.id] || ''}
              onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
              className={`${inputClasses} appearance-none cursor-pointer pr-8`}
            >
              <option value="" disabled className="text-gray-900 bg-white">Select an option...</option>
              {Array.isArray(field.options) && field.options.filter(s => s.trim()).map(opt => (
                <option key={opt} value={opt} className="text-gray-900 bg-white">{opt}</option>
              ))}
            </select>
            <div className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs ${theme.colors.subtleText}`}>
              ▼
            </div>
          </div>
        )}

        {field.type === 'radio' && (
          <div className="space-y-2 pt-1">
            {Array.isArray(field.options) && field.options.filter(s => s.trim()).map(opt => (
              <label 
                key={opt} 
                className={`flex items-center gap-3 p-3 border transition-colors cursor-pointer ${theme.card.surface} ${theme.card.border} ${theme.input.radius}`}
              >
                <input
                  type="radio"
                  name={field.id}
                  required={field.required}
                  value={opt}
                  checked={formData[field.id] === opt}
                  onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                  className="w-4 h-4 text-current cursor-pointer"
                />
                <span className={`text-xs font-medium ${theme.colors.text}`}>{opt}</span>
              </label>
            ))}
          </div>
        )}

        {field.type === 'checkbox' && (
          <div className="space-y-2 pt-1">
            {Array.isArray(field.options) && field.options.filter(s => s.trim()).map(opt => {
              const currentValues = Array.isArray(formData[field.id]) ? formData[field.id] : [];
              const isChecked = currentValues.includes(opt);
              return (
                <label 
                  key={opt} 
                  className={`flex items-center gap-3 p-3 border transition-colors cursor-pointer ${theme.card.surface} ${theme.card.border} ${theme.input.radius}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      const newValues = isChecked 
                        ? currentValues.filter((v: string) => v !== opt)
                        : [...currentValues, opt];
                      setFormData({ ...formData, [field.id]: newValues });
                    }}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                  <span className={`text-xs font-medium ${theme.colors.text}`}>{opt}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Attendance Toggle */}
      <div>
        <div className={`p-1 flex rounded-xl border ${theme.card.border} ${theme.isDark ? 'bg-white/5' : 'bg-black/5'}`}>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, attending: true, guest_count: Math.max(1, formData.guest_count || 1) })}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs sm:text-sm transition-all ${
              formData.attending 
                ? theme.button.toggleActive 
                : theme.button.toggleInactive
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>Joyfully Accept</span>
          </button>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, attending: false, guest_count: 0 })}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs sm:text-sm transition-all ${
              !formData.attending 
                ? theme.button.toggleActive 
                : theme.button.toggleInactive
            }`}
          >
            <X className="w-3.5 h-3.5" />
            <span>Regretfully Decline</span>
          </button>
        </div>
      </div>

      {/* Dynamic Form Fields */}
      <div className="space-y-4">
        {activeFields.map(field => renderField(field))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-lg text-xs font-medium bg-red-500/10 text-red-600 border border-red-500/20 text-center">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className={`w-full py-3 px-4 text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
          isSubmitting ? 'opacity-50 cursor-not-allowed' : theme.button.primary
        }`}
      >
        {isSubmitting ? 'Submitting RSVP...' : formData.attending ? 'Confirm Attendance' : 'Send Decline Note'}
      </button>
    </form>
  );
}
