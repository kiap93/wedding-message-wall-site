import React, { useState, useRef } from 'react';
import {
  Mail,
  MessageSquare,
  Wrench,
  Handshake,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  Clock,
  Sparkles,
} from 'lucide-react';
import MarketingLayout from '../layouts/MarketingLayout';
import { useMarketingTranslation } from '../lib/i18n/MarketingTranslationContext';
import { API_BASE } from '../lib/config';

type ContactCategoryId = 'general' | 'technical_support' | 'partnerships' | 'billing';

interface FormErrors {
  name?: string;
  email?: string;
  enquiryType?: string;
  subject?: string;
  message?: string;
}

const CATEGORY_OPTIONS: Array<{
  id: ContactCategoryId;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'general', icon: MessageSquare },
  { id: 'technical_support', icon: Wrench },
  { id: 'partnerships', icon: Handshake },
  { id: 'billing', icon: CreditCard },
];

const EMAIL_REGEX = /^[^\s@<>()[\]\\,;:"']+@[^\s@<>()[\]\\,;:"']+\.[a-zA-Z]{2,}$/;

export default function ContactPage() {
  const { t } = useMarketingTranslation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [enquiryType, setEnquiryType] = useState<ContactCategoryId>('general');
  const [subject, setSubject] = useState('');
  const [eventName, setEventName] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // Hidden honeypot field

  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSubmittingRef = useRef(false);
  const formSectionRef = useRef<HTMLDivElement | null>(null);

  const validateForm = (): FormErrors => {
    const errors: FormErrors = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName) {
      errors.name = t('contactPage.form.validation.nameRequired');
    } else if (trimmedName.length < 2) {
      errors.name = t('contactPage.form.validation.nameMin');
    }

    if (!trimmedEmail) {
      errors.email = t('contactPage.form.validation.emailRequired');
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = t('contactPage.form.validation.emailInvalid');
    }

    if (!enquiryType) {
      errors.enquiryType = t('contactPage.form.validation.categoryRequired');
    }

    if (!trimmedSubject) {
      errors.subject = t('contactPage.form.validation.subjectRequired');
    } else if (trimmedSubject.length < 2) {
      errors.subject = t('contactPage.form.validation.subjectMin');
    }

    if (!trimmedMessage) {
      errors.message = t('contactPage.form.validation.messageRequired');
    } else if (trimmedMessage.length < 10) {
      errors.message = t('contactPage.form.validation.messageMin');
    }

    return errors;
  };

  const handleCategorySelect = (categoryId: ContactCategoryId) => {
    setEnquiryType(categoryId);
    setFieldErrors((prev) => ({ ...prev, enquiryType: undefined }));
    if (successMessage) {
      setSuccessMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    setSubmitError(null);
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    isSubmittingRef.current = true;

    try {
      const response = await fetch(`${API_BASE}/api/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'EventFrame',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          enquiryType,
          subject: subject.trim(),
          eventName: eventName.trim() || undefined,
          message: message.trim(),
          website,
        }),
      });

      const payload = await response.json().catch(() => ({} as any));

      if (!response.ok || payload?.success === false) {
        if (Array.isArray(payload?.issues) && payload.issues.length > 0) {
          const nextFieldErrors: FormErrors = {};
          for (const issue of payload.issues) {
            if (issue?.field && issue?.message && !(issue.field in nextFieldErrors)) {
              (nextFieldErrors as any)[issue.field] = issue.message;
            }
          }
          setFieldErrors(nextFieldErrors);
        }
        setSubmitError(payload?.error || t('contactPage.form.genericError'));
        return;
      }

      // Clear form on confirmed success
      setName('');
      setEmail('');
      setEnquiryType('general');
      setSubject('');
      setEventName('');
      setMessage('');
      setWebsite('');
      setFieldErrors({});
      setSubmitError(null);
      setSuccessMessage(t('contactPage.form.successMessage'));
    } catch {
      setSubmitError(t('contactPage.form.genericError'));
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <MarketingLayout>
      {/* Editorial Hero Section */}
      <section className="pt-14 pb-12 md:pt-20 md:pb-16 border-b border-[#E8E8E5] bg-[#F7F7F5]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="max-w-2xl space-y-5">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B806F]">
              {t('contactPage.hero.eyebrow')}
            </div>

            <h1 className="font-serif text-4xl sm:text-5xl lg:text-[52px] font-normal tracking-tight text-[#252525] leading-[1.08]">
              {t('contactPage.hero.title')}
            </h1>

            <p className="text-sm sm:text-base text-[#666666] leading-relaxed">
              {t('contactPage.hero.description')}
            </p>
          </div>
        </div>
      </section>

      {/* Enquiry Category Selector */}
      <section className="py-10 md:py-12 border-b border-[#E8E8E5] bg-white">
        <div className="max-w-5xl mx-auto px-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8B806F]">
                {t('contactPage.categories.eyebrow')}
              </div>
              <h2 className="font-serif text-2xl font-normal text-[#252525] mt-1">
                {t('contactPage.categories.title')}
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {CATEGORY_OPTIONS.map((cat) => {
              const Icon = cat.icon;
              const isSelected = enquiryType === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleCategorySelect(cat.id)}
                  className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'bg-[#FAF9F7] border-[#252525] shadow-sm'
                      : 'bg-white border-[#E8E8E5] hover:border-[#8B806F] hover:bg-[#FAF9F7]/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Icon
                      className={`w-4 h-4 ${isSelected ? 'text-[#252525]' : 'text-[#8B806F]'}`}
                    />
                    <span
                      className={`w-2 h-2 rounded-full transition-colors ${
                        isSelected ? 'bg-[#252525]' : 'bg-transparent border border-[#D4D2CC]'
                      }`}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#252525]">
                      {t(`contactPage.categories.${cat.id}.title`)}
                    </div>
                    <p className="text-xs text-[#777777] mt-1 leading-relaxed">
                      {t(`contactPage.categories.${cat.id}.desc`)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Contact Form & Support Details */}
      <section ref={formSectionRef} className="py-12 md:py-16 bg-[#F7F7F5]">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Form Column */}
          <div className="lg:col-span-8 bg-white border border-[#E8E8E5] rounded-2xl p-6 sm:p-10 shadow-sm">
            {successMessage ? (
              <div
                role="status"
                data-testid="contact-success-banner"
                className="py-8 space-y-6 text-center max-w-md mx-auto"
              >
                <div className="w-12 h-12 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D] flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h2 className="font-serif text-2xl font-normal text-[#252525]">
                    {t('contactPage.form.successTitle')}
                  </h2>
                  <p className="text-sm text-[#555555] leading-relaxed">
                    {successMessage}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSuccessMessage(null)}
                  className="inline-flex items-center justify-center h-10 px-5 rounded-md border border-[#E8E8E5] bg-[#FAF9F7] text-xs font-medium text-[#252525] hover:border-[#252525] transition-colors"
                >
                  {t('contactPage.form.sendAnotherButton')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-6">
                <div className="border-b border-[#EFEFEA] pb-5">
                  <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8B806F]">
                    {t('contactPage.form.sectionEyebrow')}
                  </div>
                  <h2 className="font-serif text-2xl font-normal text-[#252525] mt-1">
                    {t('contactPage.form.sectionTitle')}
                  </h2>
                  <p className="text-xs text-[#777777] mt-1">
                    {t('contactPage.form.sectionSubtitle')}
                  </p>
                </div>

                {/* Hidden Honeypot Anti-Spam Field */}
                <div className="sr-only" aria-hidden="true">
                  <label htmlFor="contact-website">Website</label>
                  <input
                    id="contact-website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>

                {submitError && (
                  <div
                    role="alert"
                    data-testid="contact-error-banner"
                    className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C] flex items-start gap-2.5"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Full Name */}
                  <div>
                    <label
                      htmlFor="contact-name"
                      className="block text-xs font-medium text-[#252525] mb-1.5"
                    >
                      {t('contactPage.form.nameLabel')} <span className="text-[#B91C1C]">*</span>
                    </label>
                    <input
                      id="contact-name"
                      name="name"
                      type="text"
                      required
                      maxLength={120}
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (fieldErrors.name) {
                          setFieldErrors((prev) => ({ ...prev, name: undefined }));
                        }
                      }}
                      placeholder={t('contactPage.form.namePlaceholder')}
                      aria-invalid={Boolean(fieldErrors.name)}
                      className={`w-full h-10 px-3.5 rounded-lg border text-sm text-[#252525] bg-[#FAF9F7] focus:bg-white focus:outline-none transition-colors ${
                        fieldErrors.name
                          ? 'border-[#DC2626] focus:border-[#DC2626]'
                          : 'border-[#E8E8E5] focus:border-[#252525]'
                      }`}
                    />
                    {fieldErrors.name && (
                      <p className="mt-1.5 text-xs text-[#B91C1C]">{fieldErrors.name}</p>
                    )}
                  </div>

                  {/* Email Address */}
                  <div>
                    <label
                      htmlFor="contact-email"
                      className="block text-xs font-medium text-[#252525] mb-1.5"
                    >
                      {t('contactPage.form.emailLabel')} <span className="text-[#B91C1C]">*</span>
                    </label>
                    <input
                      id="contact-email"
                      name="email"
                      type="email"
                      required
                      maxLength={254}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (fieldErrors.email) {
                          setFieldErrors((prev) => ({ ...prev, email: undefined }));
                        }
                      }}
                      placeholder={t('contactPage.form.emailPlaceholder')}
                      aria-invalid={Boolean(fieldErrors.email)}
                      className={`w-full h-10 px-3.5 rounded-lg border text-sm text-[#252525] bg-[#FAF9F7] focus:bg-white focus:outline-none transition-colors ${
                        fieldErrors.email
                          ? 'border-[#DC2626] focus:border-[#DC2626]'
                          : 'border-[#E8E8E5] focus:border-[#252525]'
                      }`}
                    />
                    {fieldErrors.email && (
                      <p className="mt-1.5 text-xs text-[#B91C1C]">{fieldErrors.email}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Enquiry Type */}
                  <div>
                    <label
                      htmlFor="contact-enquiry-type"
                      className="block text-xs font-medium text-[#252525] mb-1.5"
                    >
                      {t('contactPage.form.categoryLabel')} <span className="text-[#B91C1C]">*</span>
                    </label>
                    <select
                      id="contact-enquiry-type"
                      name="enquiryType"
                      required
                      value={enquiryType}
                      onChange={(e) => handleCategorySelect(e.target.value as ContactCategoryId)}
                      aria-invalid={Boolean(fieldErrors.enquiryType)}
                      className="w-full h-10 px-3.5 rounded-lg border border-[#E8E8E5] bg-[#FAF9F7] text-sm text-[#252525] focus:bg-white focus:border-[#252525] focus:outline-none transition-colors"
                    >
                      {CATEGORY_OPTIONS.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {t(`contactPage.categories.${cat.id}.title`)}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.enquiryType && (
                      <p className="mt-1.5 text-xs text-[#B91C1C]">{fieldErrors.enquiryType}</p>
                    )}
                  </div>

                  {/* Event Name (Optional) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="contact-event-name"
                        className="text-xs font-medium text-[#252525]"
                      >
                        {t('contactPage.form.eventNameLabel')}
                      </label>
                      <span className="text-[11px] text-[#777777]">
                        {t('contactPage.form.optionalTag')}
                      </span>
                    </div>
                    <input
                      id="contact-event-name"
                      name="eventName"
                      type="text"
                      maxLength={160}
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                      placeholder={t('contactPage.form.eventNamePlaceholder')}
                      className="w-full h-10 px-3.5 rounded-lg border border-[#E8E8E5] bg-[#FAF9F7] text-sm text-[#252525] focus:bg-white focus:border-[#252525] focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label
                    htmlFor="contact-subject"
                    className="block text-xs font-medium text-[#252525] mb-1.5"
                  >
                    {t('contactPage.form.subjectLabel')} <span className="text-[#B91C1C]">*</span>
                  </label>
                  <input
                    id="contact-subject"
                    name="subject"
                    type="text"
                    required
                    maxLength={180}
                    value={subject}
                    onChange={(e) => {
                      setSubject(e.target.value);
                      if (fieldErrors.subject) {
                        setFieldErrors((prev) => ({ ...prev, subject: undefined }));
                      }
                    }}
                    placeholder={t('contactPage.form.subjectPlaceholder')}
                    aria-invalid={Boolean(fieldErrors.subject)}
                    className={`w-full h-10 px-3.5 rounded-lg border text-sm text-[#252525] bg-[#FAF9F7] focus:bg-white focus:outline-none transition-colors ${
                      fieldErrors.subject
                        ? 'border-[#DC2626] focus:border-[#DC2626]'
                        : 'border-[#E8E8E5] focus:border-[#252525]'
                    }`}
                  />
                  {fieldErrors.subject && (
                    <p className="mt-1.5 text-xs text-[#B91C1C]">{fieldErrors.subject}</p>
                  )}
                </div>

                {/* Message */}
                <div>
                  <label
                    htmlFor="contact-message"
                    className="block text-xs font-medium text-[#252525] mb-1.5"
                  >
                    {t('contactPage.form.messageLabel')} <span className="text-[#B91C1C]">*</span>
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    required
                    rows={6}
                    maxLength={5000}
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      if (fieldErrors.message) {
                        setFieldErrors((prev) => ({ ...prev, message: undefined }));
                      }
                    }}
                    placeholder={t('contactPage.form.messagePlaceholder')}
                    aria-invalid={Boolean(fieldErrors.message)}
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-[#252525] bg-[#FAF9F7] focus:bg-white focus:outline-none transition-colors resize-y ${
                      fieldErrors.message
                        ? 'border-[#DC2626] focus:border-[#DC2626]'
                        : 'border-[#E8E8E5] focus:border-[#252525]'
                    }`}
                  />
                  {fieldErrors.message && (
                    <p className="mt-1.5 text-xs text-[#B91C1C]">{fieldErrors.message}</p>
                  )}
                </div>

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    data-testid="contact-submit-button"
                    className="h-11 px-7 rounded-lg bg-[#252525] text-white text-sm font-medium hover:bg-[#383838] disabled:opacity-60 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2 shadow-sm"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{t('contactPage.form.submittingButton')}</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>{t('contactPage.form.submitButton')}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Editorial Aside Column */}
          <aside className="lg:col-span-4 space-y-5">
            <div className="bg-white border border-[#E8E8E5] rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-[#8B806F]" />
                <h3 className="text-sm font-semibold text-[#252525]">
                  {t('contactPage.aside.directTitle')}
                </h3>
              </div>
              <p className="text-xs text-[#666666] leading-relaxed">
                {t('contactPage.aside.directDesc')}{' '}
                <a
                  href="mailto:eventframeio@gmail.com"
                  className="text-[#252525] font-medium underline underline-offset-4 hover:text-[#8B806F] transition-colors"
                >
                  eventframeio@gmail.com
                </a>
                .
              </p>
            </div>

            <div className="bg-white border border-[#E8E8E5] rounded-2xl p-6 space-y-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-[#8B806F]" />
                  <h3 className="text-sm font-semibold text-[#252525]">
                    {t('contactPage.aside.responseTitle')}
                  </h3>
                </div>
                <p className="text-xs text-[#666666] leading-relaxed">
                  {t('contactPage.aside.responseDesc')}
                </p>
              </div>

              <div className="pt-4 border-t border-[#EFEFEA] space-y-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <Clock className="w-3.5 h-3.5 text-[#8B806F] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-[#252525]">
                      {t('contactPage.aside.supportHoursLabel')}
                    </div>
                    <div className="text-[#777777] mt-0.5">
                      {t('contactPage.aside.supportHoursValue')}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#F4F4F0]">
                  <div className="font-medium text-[#252525]">
                    {t('contactPage.aside.billingNoteLabel')}
                  </div>
                  <div className="text-[#777777] mt-0.5 leading-relaxed">
                    {t('contactPage.aside.billingNoteValue')}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </MarketingLayout>
  );
}
