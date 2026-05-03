import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, X, Users, Utensils, MessageSquare, Mail } from 'lucide-react';
import { WeddingTemplate, RSVP } from '../types';
import { postRSVP } from '../lib/api';

interface RSVPFormProps {
  projectId: string;
  template: WeddingTemplate;
  onSuccess: () => void;
  isPreview?: boolean;
  currentCount?: number;
}

export default function RSVPForm({ projectId, template, onSuccess, isPreview, currentCount = 0 }: RSVPFormProps) {
  const [formData, setFormData] = useState({
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
      await postRSVP({
        ...formData,
        project_id: projectId,
        attending: formData.attending
      });
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
          <Check className="w-4 h-4" /> I'm Attending
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

      <div className="space-y-4">
        <div className="space-y-2">
          <label className={`text-xs uppercase tracking-[0.2em] font-bold ${template.colors.subtleText} ml-1`}>Full Name</label>
          <div className="relative">
            <input
              required
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full pl-12 pr-6 py-4 rounded-2xl border ${template.colors.border} bg-white/5 focus:outline-none focus:ring-2 ${template.colors.accent} ring-opacity-30 transition-all font-medium text-sm`}
            />
            <Users className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 opacity-30" />
          </div>
        </div>

        <div className="space-y-2">
          <label className={`text-xs uppercase tracking-[0.2em] font-bold ${template.colors.subtleText} ml-1`}>Email Address</label>
          <div className="relative">
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={`w-full pl-12 pr-6 py-4 rounded-2xl border ${template.colors.border} bg-white/5 focus:outline-none focus:ring-2 ${template.colors.accent} ring-opacity-30 transition-all font-medium text-sm`}
            />
            <Mail className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 opacity-30" />
          </div>
        </div>

        {formData.attending && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <label className={`text-xs uppercase tracking-[0.2em] font-bold ${template.colors.subtleText} ml-1`}>Number of Guests</label>
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
            </div>

            <div className="space-y-2">
              <label className={`text-xs uppercase tracking-[0.2em] font-bold ${template.colors.subtleText} ml-1`}>Meal Preference</label>
              <select
                value={formData.meal_preference}
                onChange={(e) => setFormData({ ...formData, meal_preference: e.target.value })}
                className={`w-full px-6 py-4 rounded-2xl border ${template.colors.border} bg-white/5 focus:outline-none focus:ring-2 ${template.colors.accent} ring-opacity-30 transition-all font-medium appearance-none text-sm`}
              >
                <option value="standard" className="text-black">Standard (Meat/Fish)</option>
                <option value="vegetarian" className="text-black">Vegetarian</option>
                <option value="vegan" className="text-black">Vegan</option>
                <option value="gluten-free" className="text-black">Gluten Free</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className={`text-xs uppercase tracking-[0.2em] font-bold ${template.colors.subtleText} ml-1`}>Dietary Notes</label>
              <div className="relative">
                <textarea
                  placeholder="Any allergies we should know about?"
                  value={formData.dietary_requirements}
                  onChange={(e) => setFormData({ ...formData, dietary_requirements: e.target.value })}
                  rows={2}
                  className={`w-full px-6 py-4 rounded-2xl border ${template.colors.border} bg-white/5 focus:outline-none focus:ring-2 ${template.colors.accent} ring-opacity-30 transition-all font-medium resize-none`}
                />
              </div>
            </div>
          </motion.div>
        )}
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
