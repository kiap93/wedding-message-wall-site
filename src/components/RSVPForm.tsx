import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, X, Users, Utensils, MessageSquare, Mail } from 'lucide-react';
import { WeddingTemplate, RSVP, RSVPField } from '../types';
import { postRSVP } from '../lib/api';

interface RSVPFormProps {
  projectId: string;
  template: WeddingTemplate;
  onSuccess: () => void;
  isPreview?: boolean;
  currentCount?: number;
  rsvpFields?: RSVPField[];
}

export default function RSVPForm({ projectId, template, onSuccess, isPreview, currentCount = 0, rsvpFields }: RSVPFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>({
    name: '',
    email: '',
    attending: true,
    guest_count: 1,
    meal_preference: 'standard',
    dietary_requirements: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // If rsvpFields is not provided, use standard defaults
  const safeRsvpFields = Array.isArray(rsvpFields) ? rsvpFields : [];
  const activeFields = safeRsvpFields.length > 0 ? safeRsvpFields : [
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
      // Split responses into core fields and custom responses
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

  const getButtonBg = () => {
    switch(template.id) {
      case 'digital': return 'bg-[#00FF41] text-black hover:bg-[#00DD31]';
      case 'starry': return 'bg-[#38BDF8] text-white hover:bg-[#0EA5E9]';
      case 'garden': return 'bg-[#829D82] text-white hover:bg-[#6B856B]';
      case 'romantic': return 'bg-[#FF8585] text-white hover:bg-[#FF6B6B]';
      default: return 'bg-[#C5A059] text-white hover:bg-[#B38D45]';
    }
  };

  if (isSuccess) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-12 text-center"
      >
        <div className={`w-20 h-20 rounded-full ${template.colors.accent} bg-opacity-20 flex items-center justify-center mb-6`}>
          <Check className={`w-10 h-10 ${template.colors.text}`} />
        </div>
        <h3 className={`text-2xl font-serif mb-2 ${template.colors.text}`}>Thank You!</h3>
        <p className={`opacity-70 max-w-xs mx-auto ${template.colors.text}`}>
          Your RSVP has been successfully submitted. We can't wait to celebrate with you!
        </p>
      </motion.div>
    );
  }

  const renderField = (field: RSVPField) => {
    const isHidden = field.showIfAttending && !formData.attending;
    if (isHidden) return null;

    const commonClasses = `w-full px-6 py-4 rounded-2xl border ${template.colors.border} bg-white/5 focus:outline-none focus:ring-2 ${template.colors.accent} ring-opacity-30 transition-all font-medium text-sm`;

    return (
      <div key={field.id} className="space-y-2">
        <label className={`text-xs uppercase tracking-[0.2em] font-bold ${template.colors.subtleText} ml-1`}>
          {field.label} {field.required && <span className="text-red-400">*</span>}
        </label>
        
        {field.type === 'text' && (
          <div className="relative">
            <input
              required={field.required}
              type="text"
              placeholder={field.placeholder}
              value={formData[field.id] || ''}
              onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
              className={commonClasses}
            />
          </div>
        )}

        {field.type === 'textarea' && (
          <textarea
            required={field.required}
            placeholder={field.placeholder}
            value={formData[field.id] || ''}
            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
            rows={3}
            className={`${commonClasses} resize-none`}
          />
        )}

        {field.type === 'number' && (
          field.id === 'guest_count' ? (
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setFormData({ ...formData, guest_count: num })}
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full font-bold transition-all border text-sm ${
                    formData.guest_count === num 
                      ? template.colors.accent + ' border-current'
                      : 'border-white/10 opacity-50 hover:opacity-100'
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
              value={formData[field.id] || ''}
              onChange={(e) => setFormData({ ...formData, [field.id]: parseInt(e.target.value) })}
              className={commonClasses}
            />
          )
        )}

        {field.type === 'select' && (
          <select
            required={field.required}
            value={formData[field.id] || ''}
            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
            className={`${commonClasses} appearance-none`}
          >
            <option value="" disabled className="text-black">Select an option...</option>
            {Array.isArray(field.options) && field.options.filter(s => s.trim()).map(opt => (
              <option key={opt} value={opt} className="text-black">{opt}</option>
            ))}
          </select>
        )}

        {field.type === 'radio' && (
          <div className="flex flex-col gap-2">
            {Array.isArray(field.options) && field.options.filter(s => s.trim()).map(opt => (
              <label key={opt} className="flex items-center gap-3 cursor-pointer p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors">
                <input
                  type="radio"
                  name={field.id}
                  required={field.required}
                  value={opt}
                  checked={formData[field.id] === opt}
                  onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                  className="w-4 h-4 text-[#C5A059] border-white/20 bg-transparent focus:ring-0"
                />
                <span className="text-sm font-medium">{opt}</span>
              </label>
            ))}
          </div>
        )}

        {field.type === 'checkbox' && (
           <div className="flex flex-col gap-2">
            {Array.isArray(field.options) && field.options.filter(s => s.trim()).map(opt => {
              const currentValues = Array.isArray(formData[field.id]) ? formData[field.id] : [];
              const isChecked = currentValues.includes(opt);
              return (
                <label key={opt} className="flex items-center gap-3 cursor-pointer p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      const newValues = isChecked 
                        ? currentValues.filter((v: string) => v !== opt)
                        : [...currentValues, opt];
                      setFormData({ ...formData, [field.id]: newValues });
                    }}
                    className="w-4 h-4 rounded border-white/20 bg-transparent focus:ring-0"
                  />
                  <span className="text-sm font-medium">{opt}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 p-1 bg-black/5 rounded-2xl border border-white/10">
        <button
          type="button"
          onClick={() => setFormData({ ...formData, attending: true })}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            formData.attending 
              ? 'bg-white shadow-sm ' + template.colors.text
              : 'opacity-50 hover:opacity-100'
          }`}
        >
          <Check className="w-4 h-4" /> <span className="xs:hidden">Yes</span><span className="hidden xs:inline">Attending</span>
        </button>
        <button
          type="button"
          onClick={() => setFormData({ ...formData, attending: false, guest_count: 0 })}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            !formData.attending 
              ? 'bg-white shadow-sm ' + template.colors.text
              : 'opacity-50 hover:opacity-100'
          }`}
        >
          <X className="w-4 h-4" /> Decline
        </button>
      </div>

      <div className="space-y-6">
        {activeFields.map(field => renderField(field))}
      </div>

      {error && (
        <p className="text-red-500 text-sm text-center font-bold bg-red-500/10 py-3 rounded-xl border border-red-500/20">{error}</p>
      )}

      <button
        disabled={isSubmitting}
        className={`w-full py-5 rounded-2xl font-bold tracking-[0.1em] text-lg uppercase transition-all flex items-center justify-center gap-3 group shadow-xl
          ${isSubmitting ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed shadow-none' : getButtonBg()}`}
      >
        {isSubmitting ? 'Sending...' : 'Submit RSVP'}
      </button>
    </form>
  );
}
