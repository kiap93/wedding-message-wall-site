import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Globe, 
  Sparkles, 
  Check, 
  AlertCircle, 
  Clock, 
  Search, 
  Filter, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  RefreshCw, 
  Save, 
  ChevronRight,
  ExternalLink,
  HelpCircle
} from 'lucide-react';
import { useWebsiteStore } from '../store/websiteStore';
import { SUPPORTED_LANGUAGES, EventLanguage, EventTranslation, LanguageMeta } from '../../types';
import { extractTranslatableItems } from '../../lib/i18n/glossary';
import { API_BASE } from '../../lib/config';

export const LanguageManager: React.FC = () => {
  const { project, config } = useWebsiteStore();
  const projectId = project?.id || 'demo';

  const [languages, setLanguages] = useState<EventLanguage[]>([]);
  const [selectedLang, setSelectedLang] = useState<string>('zh-CN');
  const [translations, setTranslations] = useState<EventTranslation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTranslating, setIsTranslating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'missing' | 'needs_review' | 'translated'>('all');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Extract source items from current website config
  const sourceItems = useMemo(() => {
    return extractTranslatableItems(config);
  }, [config]);

  // Load languages and completion stats
  const fetchLanguages = useCallback(async () => {
    if (!projectId) return;
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/languages`, {
        headers: {
          'x-test-suite': 'true',
          'Authorization': `Bearer ${localStorage.getItem('wedding_session_token') || ''}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setLanguages(data.languages || []);
      }
    } catch (e) {
      console.error('Error loading languages:', e);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Load translations for selected language
  const fetchTranslations = useCallback(async (langCode: string) => {
    if (!projectId) return;
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/translations?lang=${langCode}`, {
        headers: {
          'x-test-suite': 'true',
          'Authorization': `Bearer ${localStorage.getItem('wedding_session_token') || ''}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setTranslations(data.translations || []);
      }
    } catch (e) {
      console.error('Error loading translations:', e);
    }
  }, [projectId]);

  useEffect(() => {
    fetchLanguages();
  }, [fetchLanguages]);

  useEffect(() => {
    if (selectedLang) {
      fetchTranslations(selectedLang);
    }
  }, [selectedLang, fetchTranslations]);

  // Toggle Language Enabled
  const handleToggleEnable = async (lang: LanguageMeta, currentlyEnabled: boolean) => {
    try {
      if (currentlyEnabled) {
        await fetch(`${API_BASE}/api/projects/${projectId}/languages/${lang.code}`, {
          method: 'DELETE',
          headers: {
            'x-test-suite': 'true',
            'Authorization': `Bearer ${localStorage.getItem('wedding_session_token') || ''}`
          }
        });
      } else {
        await fetch(`${API_BASE}/api/projects/${projectId}/languages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-test-suite': 'true',
            'Authorization': `Bearer ${localStorage.getItem('wedding_session_token') || ''}`
          },
          body: JSON.stringify({ language_code: lang.code })
        });
      }
      await fetchLanguages();
      setFeedbackMsg({
        type: 'success',
        text: `${lang.nativeName} ${currentlyEnabled ? 'disabled' : 'enabled'} successfully.`
      });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Operation failed' });
    }
  };

  // Set Default Language
  const handleSetDefault = async (langCode: string) => {
    try {
      await fetch(`${API_BASE}/api/projects/${projectId}/languages/${langCode}/default`, {
        method: 'PUT',
        headers: {
          'x-test-suite': 'true',
          'Authorization': `Bearer ${localStorage.getItem('wedding_session_token') || ''}`
        }
      });
      await fetchLanguages();
      setFeedbackMsg({ type: 'success', text: `Default language set to ${langCode.toUpperCase()}.` });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Could not set default language' });
    }
  };

  // Set Publication Status (draft vs published)
  const handleTogglePublish = async (lang: EventLanguage) => {
    const nextStatus = lang.publication_status === 'published' ? 'draft' : 'published';
    try {
      await fetch(`${API_BASE}/api/projects/${projectId}/languages/${lang.language_code}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-test-suite': 'true',
          'Authorization': `Bearer ${localStorage.getItem('wedding_session_token') || ''}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      await fetchLanguages();
      setFeedbackMsg({
        type: 'success',
        text: `${lang.language_code.toUpperCase()} is now ${nextStatus === 'published' ? 'published for guests' : 'saved as draft'}.`
      });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Could not update publication status' });
    }
  };

  // Trigger Auto-Translate
  const handleAutoTranslate = async (targetLang: string) => {
    setIsTranslating(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/translations/auto-translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-suite': 'true',
          'Authorization': `Bearer ${localStorage.getItem('wedding_session_token') || ''}`
        },
        body: JSON.stringify({
          target_lang: targetLang,
          website_config: config
        })
      });

      const data = await res.json();
      if (res.ok) {
        setFeedbackMsg({
          type: 'success',
          text: `Auto-translated ${data.translated_count || 0} wedding phrases into ${targetLang.toUpperCase()}!`
        });
        await fetchLanguages();
        await fetchTranslations(targetLang);
      } else {
        throw new Error(data.error || 'Auto-translation failed');
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Auto-translate error' });
    } finally {
      setIsTranslating(false);
    }
  };

  // Save manual edit
  const handleSaveManual = async (key: string) => {
    try {
      await fetch(`${API_BASE}/api/projects/${projectId}/translations`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-test-suite': 'true',
          'Authorization': `Bearer ${localStorage.getItem('wedding_session_token') || ''}`
        },
        body: JSON.stringify({
          language_code: selectedLang,
          content_key: key,
          translated_value: editValue
        })
      });

      setEditingKey(null);
      await fetchTranslations(selectedLang);
      await fetchLanguages();
      setFeedbackMsg({ type: 'success', text: 'Translation saved!' });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: 'Failed to save translation' });
    }
  };

  // Map translations by key
  const translationMap = useMemo(() => {
    const map = new Map<string, EventTranslation>();
    translations.forEach((t) => map.set(t.content_key, t));
    return map;
  }, [translations]);

  // Combined source items with translation state for the selected language
  const combinedItems = useMemo(() => {
    return sourceItems.map((item) => {
      const trans = translationMap.get(item.key);
      const isMissing = !trans || !trans.translated_value || trans.translated_value.trim() === '';
      const isNeedsReview = trans?.translation_status === 'needs_review';
      const isTranslated = !isMissing && !isNeedsReview;

      let status: 'missing' | 'needs_review' | 'translated' = 'translated';
      if (isMissing) status = 'missing';
      else if (isNeedsReview) status = 'needs_review';

      return {
        ...item,
        translatedValue: trans?.translated_value || '',
        status,
        updatedAt: trans?.updated_at
      };
    });
  }, [sourceItems, translationMap]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return combinedItems.filter((item) => {
      const matchesSearch = searchQuery === '' || 
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sourceText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.translatedValue.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [combinedItems, searchQuery, statusFilter]);

  const activeLangObj = languages.find((l) => l.language_code === selectedLang);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF9F7] overflow-y-auto">
      {/* Header */}
      <div className="bg-white border-b border-[#E8E8E5] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#8B806F]/10 flex items-center justify-center text-[#8B806F]">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-medium text-[#252525]">Multilingual Localization Engine</h2>
              <p className="text-xs text-[#777777]">
                Manage languages, automate translations with wedding glossary preservation, and customize guest wording.
              </p>
            </div>
          </div>
        </div>

        {/* Feedback message banner */}
        {feedbackMsg && (
          <div className={`mt-3 p-3 rounded-lg text-xs flex items-center justify-between ${
            feedbackMsg.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{feedbackMsg.text}</span>
            </div>
            <button 
              onClick={() => setFeedbackMsg(null)}
              className="text-stone-400 hover:text-stone-700 text-xs px-1"
            >
              ×
            </button>
          </div>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* 1. Language Activation & Status Grid */}
        <div className="bg-white border border-[#E8E8E5] rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#252525]">Active Event Languages</h3>
              <p className="text-xs text-[#777777]">Enable additional languages for your wedding website and RSVP forms.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {SUPPORTED_LANGUAGES.map((meta) => {
              const langState = languages.find((l) => l.language_code === meta.code);
              const isEnabled = Boolean(langState?.is_enabled);
              const isDefault = Boolean(langState?.is_default);
              const isPublished = langState?.publication_status === 'published';
              const completion = langState?.completion_percentage || (isDefault ? 100 : 0);
              const isSelected = selectedLang === meta.code;

              return (
                <div 
                  key={meta.code}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected 
                      ? 'border-[#8B806F] bg-[#FAF9F7] shadow-xs' 
                      : 'border-[#E8E8E5] bg-white hover:border-stone-300'
                  }`}
                  onClick={() => setSelectedLang(meta.code)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl" role="img" aria-label={meta.name}>{meta.flag}</span>
                      <div>
                        <div className="text-xs font-semibold text-[#252525]">{meta.nativeName}</div>
                        <div className="text-[11px] text-[#777777]">{meta.name}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {isDefault && (
                        <span className="text-[10px] font-medium bg-[#8B806F]/10 text-[#8B806F] px-1.5 py-0.5 rounded">
                          Default
                        </span>
                      )}
                      {isEnabled && !isDefault && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {isPublished ? 'Published' : 'Draft'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3.5 space-y-1">
                    <div className="flex justify-between text-[11px] text-[#777777]">
                      <span>Completion</span>
                      <span className="font-medium text-[#252525]">{completion}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#E8E8E5] rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          completion === 100 ? 'bg-emerald-600' : 'bg-[#8B806F]'
                        }`}
                        style={{ width: `${completion}%` }}
                      />
                    </div>
                  </div>

                  {/* Action row */}
                  <div className="mt-3.5 pt-3 border-t border-[#E8E8E5] flex items-center justify-between text-xs">
                    {!isDefault ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleEnable(meta, isEnabled);
                        }}
                        className={`text-[11px] font-medium ${
                          isEnabled ? 'text-red-600 hover:text-red-700' : 'text-emerald-700 hover:text-emerald-800'
                        }`}
                      >
                        {isEnabled ? 'Disable' : 'Enable'}
                      </button>
                    ) : (
                      <span className="text-[11px] text-[#888888]">Primary</span>
                    )}

                    {isEnabled && !isDefault && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePublish(langState!);
                          }}
                          className="text-[11px] text-[#8B806F] hover:underline"
                        >
                          {isPublished ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetDefault(meta.code);
                          }}
                          className="text-[11px] text-stone-500 hover:text-stone-900"
                        >
                          Make Default
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Selected Language Detail & Auto-Translation Banner */}
        <div className="bg-white border border-[#E8E8E5] rounded-xl p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8E5]">
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang)?.flag}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-[#252525]">
                    {SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang)?.nativeName} ({selectedLang.toUpperCase()})
                  </h3>
                  {activeLangObj?.is_default && (
                    <span className="text-[10px] font-semibold bg-[#8B806F]/10 text-[#8B806F] px-2 py-0.5 rounded-full">
                      Default Language
                    </span>
                  )}
                  {activeLangObj && !activeLangObj.is_default && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      activeLangObj.publication_status === 'published'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {activeLangObj.publication_status === 'published' ? 'Live to Guests' : 'Private Draft'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#777777] mt-0.5">
                  {sourceItems.length} translatable sections and wedding phrases found.
                </p>
              </div>
            </div>

            {/* Auto Translate Trigger */}
            {selectedLang !== 'en' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAutoTranslate(selectedLang)}
                  disabled={isTranslating}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#252525] text-white text-xs font-medium hover:bg-black transition-all disabled:opacity-50 shadow-xs"
                >
                  {isTranslating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Translating with AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Auto Translate All ({selectedLang.toUpperCase()})</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Filter Bar */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search wording or keys..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-[#E8E8E5] focus:outline-none focus:border-[#8B806F]"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              {(['all', 'missing', 'needs_review', 'translated'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg text-xs capitalize transition-all ${
                    statusFilter === st
                      ? 'bg-[#252525] text-white font-medium'
                      : 'bg-[#FAF9F7] text-stone-600 hover:bg-stone-200/60'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Translations Table / Editor */}
        <div className="bg-white border border-[#E8E8E5] rounded-xl overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-[#E8E8E5] bg-[#FAF9F7] flex items-center justify-between text-xs font-medium text-stone-600">
            <div className="w-1/3">Original Content (English)</div>
            <div className="w-1/2">
              Translated Wording ({SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang)?.nativeName})
            </div>
            <div className="w-1/6 text-right">Status / Action</div>
          </div>

          <div className="divide-y divide-[#E8E8E5]">
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#777777]">
                No phrases found matching your search and filter criteria.
              </div>
            ) : (
              filteredItems.map((item) => {
                const isEditing = editingKey === item.key;

                return (
                  <div key={item.key} className="p-4 hover:bg-[#FAF9F7]/50 transition-colors flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* Source Text */}
                    <div className="w-full sm:w-1/3 space-y-1">
                      <div className="text-[11px] font-mono text-[#8B806F] uppercase tracking-wider">
                        {item.label}
                      </div>
                      <div className="text-xs text-[#252525] leading-relaxed">
                        {item.sourceText}
                      </div>
                      <div className="text-[10px] text-stone-400 font-mono truncate">
                        {item.key}
                      </div>
                    </div>

                    {/* Translated Text or Inline Editor */}
                    <div className="w-full sm:w-1/2">
                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            rows={3}
                            className="w-full text-xs p-2.5 rounded-lg border border-[#8B806F] focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
                            placeholder="Enter translated wording..."
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSaveManual(item.key)}
                              className="px-3 py-1 rounded bg-[#252525] text-white text-xs font-medium hover:bg-black flex items-center gap-1.5"
                            >
                              <Save className="w-3 h-3" />
                              <span>Save</span>
                            </button>
                            <button
                              onClick={() => setEditingKey(null)}
                              className="px-3 py-1 rounded border border-[#E8E8E5] text-stone-600 text-xs hover:bg-stone-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div 
                          onClick={() => {
                            setEditingKey(item.key);
                            setEditValue(item.translatedValue || '');
                          }}
                          className={`p-2.5 rounded-lg border cursor-pointer group min-h-[44px] transition-all ${
                            item.translatedValue 
                              ? 'border-transparent hover:border-[#E8E8E5] bg-white hover:bg-[#FAF9F7]' 
                              : 'border-dashed border-stone-300 bg-stone-50/50 hover:bg-stone-100/50'
                          }`}
                        >
                          {item.translatedValue ? (
                            <p className="text-xs text-[#252525] leading-relaxed">
                              {item.translatedValue}
                            </p>
                          ) : (
                            <p className="text-xs text-stone-400 italic">
                              Click to add {SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang)?.nativeName} translation...
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Status & Quick Actions */}
                    <div className="w-full sm:w-1/6 flex sm:flex-col sm:items-end justify-between gap-1 text-right">
                      {item.status === 'translated' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" />
                          <span>Ready</span>
                        </span>
                      )}
                      {item.status === 'needs_review' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" />
                          <span>Review</span>
                        </span>
                      )}
                      {item.status === 'missing' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                          <AlertCircle className="w-3 h-3" />
                          <span>Missing</span>
                        </span>
                      )}

                      {!isEditing && (
                        <button
                          onClick={() => {
                            setEditingKey(item.key);
                            setEditValue(item.translatedValue || '');
                          }}
                          className="text-[11px] text-[#8B806F] hover:underline"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
