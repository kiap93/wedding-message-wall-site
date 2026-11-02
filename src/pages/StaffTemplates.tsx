import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Save, Trash2, Palette, ArrowLeft, Loader2, Sparkles, Code, Layout, Settings, Zap, Wand2, RefreshCw, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchTemplates, saveTemplate, deleteTemplate } from '../lib/templates';
import { WeddingTemplate } from '../types';
import { useUser } from '../lib/UserContext';
import { Button } from '../design-system/components/Button';
import { Badge } from '../design-system/components/Badge';
import { Input } from '../design-system/components/Input';
import { Select } from '../design-system/components/Select';

export default function StaffTemplates() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<WeddingTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<WeddingTemplate> | null>(null);
  const [activeTab, setActiveTab] = useState<'settings' | 'html' | 'card'>('settings');
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Security check: Only allow staff
  const isStaff = user?.email === 'buildsiteasia@gmail.com' || user?.email?.includes('@eventframe.io');

  useEffect(() => {
    if (!isStaff && user) {
      navigate('/workspace');
      return;
    }
    loadTemplates();
  }, [user]);

  async function loadTemplates() {
    setIsLoading(true);
    try {
      const data = await fetchTemplates();
      setTemplates(data);
    } finally {
      setIsLoading(false);
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate || !editingTemplate.name) return;

    setIsSaving(true);
    try {
      await saveTemplate(editingTemplate as any);
      await loadTemplates();
      setEditingTemplate(null);
    } catch (err: any) {
      console.error('Failed to save template:', err);
      const msg = err.message || 'Unknown error';
      if (msg.includes('row-level security')) {
        alert('Security Policy Blocked: Ensure your email has admin permission in the database.');
      } else if (msg.includes('column "font_sans"')) {
        alert('Database Outdated: The font_sans column is missing in the database table.');
      } else {
        alert(`Failed to save template: ${msg}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this aesthetic plugin?')) return;
    try {
      await deleteTemplate(id);
      await loadTemplates();
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  };

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai/generate-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('wedding_session')}`
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          existingContext: editingTemplate ? {
            html: editingTemplate.html,
            css: editingTemplate.css,
            card_html: editingTemplate.card_html
          } : null
        })
      });

      if (!response.ok) {
        const errorData = await response.json() as any;
        throw new Error(errorData.error || 'AI Generation failed');
      }

      const data = await response.json() as any;

      if (editingTemplate) {
        setEditingTemplate({
          ...editingTemplate,
          name: data.name,
          html: data.html,
          css: data.css,
          card_html: data.card_html,
          variant: 'custom'
        });
      }
      setShowAIModal(false);
      setAiPrompt('');
      setActiveTab('html');
    } catch (error: any) {
      console.error('AI Generation failed:', error);
      alert(`AI Generation failed: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5]">
        <Loader2 className="w-6 h-6 text-[#8B806F] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#252525]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#E8E8E5] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/workspace')}
              className="p-2 rounded-lg border border-[#E8E8E5] bg-white text-[#777777] hover:text-[#252525] hover:bg-[#F7F7F5] transition-colors"
              title="Return to Workspace"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-[#252525]">Aesthetic Plugins</h1>
                <Badge variant="taupe">Staff Engine</Badge>
              </div>
              <p className="text-xs text-[#777777]">Create, customize and maintain live ballroom presentation themes</p>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setEditingTemplate({
              name: '',
              description: '',
              variant: 'custom',
              fontSerif: 'font-serif',
              fontSans: 'font-sans',
              colors: {
                background: 'bg-[#F7F7F5]',
                card: 'bg-white',
                text: 'text-[#252525]',
                accent: 'text-[#8B806F]',
                border: 'border-[#E8E8E5]',
                headerText: 'text-[#252525]',
                subtleText: 'text-[#777777]'
              },
              iconType: 'heart',
              html: '<div class="custom-display-wrapper">\n  <div id="messages-container"></div>\n</div>',
              card_html: '<div class="p-6 bg-white rounded-xl shadow-sm border border-[#E8E8E5] min-w-[320px] transition-transform duration-300 hover:-translate-y-1">\n  <div class="flex items-center gap-3 mb-3">\n    <div class="w-9 h-9 bg-[#F7F7F5] rounded-lg flex items-center justify-center border border-[#E8E8E5]">\n      <span class="text-sm">✨</span>\n    </div>\n    <h3 class="font-serif text-base font-medium text-[#252525]">{{name}}</h3>\n  </div>\n  <p class="text-[#777777] text-sm leading-relaxed">"{{message}}"</p>\n</div>',
              css: '.custom-display-wrapper {\n  position: relative;\n  width: 100%;\n  height: 100%;\n  overflow: hidden;\n  background: #F7F7F5;\n}\n\n#messages-container {\n  position: relative;\n  width: 100%;\n  height: 100%;\n  overflow: hidden;\n}\n\n.custom-card-wrapper {\n  position: absolute;\n  top: calc(var(--index) * 28% + 6%);\n  left: 0%;\n  animation: danmuMove 22s linear infinite;\n  animation-delay: calc(var(--index) * -6s);\n  padding: 0 32px;\n  white-space: nowrap;\n  z-index: 10;\n  will-change: transform;\n}\n\n@keyframes danmuMove {\n  from { transform: translateX(100vw); }\n  to { transform: translateX(-150%); }\n}'
            })}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Aesthetic Plugin
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Catalog grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#777777]">
                Available Plugins ({templates.length})
              </h2>
            </div>

            <div className={`grid gap-4 transition-all duration-300 ${editingTemplate ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
              {templates.map(t => {
                const isSelected = editingTemplate?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setEditingTemplate(t)}
                    className={`group p-4 rounded-xl border transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'bg-[#252525] text-white border-[#252525] shadow-sm'
                        : 'bg-white border-[#E8E8E5] hover:border-[#8B806F]/50 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${
                        isSelected ? 'bg-white/10 text-white' : 'bg-[#F7F7F5] text-[#8B806F] border border-[#E8E8E5]'
                      }`}>
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <Badge variant={isSelected ? 'neutral' : 'neutral'}>
                        {t.variant}
                      </Badge>
                    </div>

                    <h3 className={`font-medium text-sm truncate ${isSelected ? 'text-white' : 'text-[#252525]'}`}>
                      {t.name}
                    </h3>
                    <p className={`text-xs mt-1 line-clamp-1 ${isSelected ? 'text-white/70' : 'text-[#777777]'}`}>
                      {t.description || 'Custom wedding visual theme'}
                    </p>

                    {t.is_custom && (
                      <div className="mt-3 pt-3 border-t border-black/5 flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(t.id);
                          }}
                          className={`p-1.5 rounded-md text-xs transition-colors ${
                            isSelected ? 'hover:bg-white/20 text-white/70' : 'hover:bg-red-50 text-red-500'
                          }`}
                          title="Delete plugin"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Editor Panel */}
          <AnimatePresence mode="wait">
            {editingTemplate && (
              <motion.div
                key={editingTemplate.id || 'new'}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                className="bg-white rounded-xl border border-[#E8E8E5] shadow-sm overflow-hidden"
              >
                {/* Editor Header Bar */}
                <div className="border-b border-[#E8E8E5] px-6 py-4 flex flex-wrap items-center justify-between gap-4 bg-[#FAFAF8]">
                  <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-[#E8E8E5] p-0.5 bg-white">
                      <button
                        type="button"
                        onClick={() => setActiveTab('settings')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          activeTab === 'settings'
                            ? 'bg-[#252525] text-white shadow-xs'
                            : 'text-[#777777] hover:text-[#252525]'
                        }`}
                      >
                        <Settings className="w-3.5 h-3.5" />
                        Settings
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('html')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          activeTab === 'html'
                            ? 'bg-[#252525] text-white shadow-xs'
                            : 'text-[#777777] hover:text-[#252525]'
                        }`}
                      >
                        <Code className="w-3.5 h-3.5" />
                        Structure & CSS
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('card')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          activeTab === 'card'
                            ? 'bg-[#252525] text-white shadow-xs'
                            : 'text-[#777777] hover:text-[#252525]'
                        }`}
                      >
                        <Layout className="w-3.5 h-3.5" />
                        Card Markup
                      </button>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAIModal(true)}
                    >
                      <Wand2 className="w-3.5 h-3.5 mr-1 text-[#8B806F]" />
                      AI Prompt
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPreviewRevision(prev => prev + 1);
                        setShowLivePreview(true);
                      }}
                    >
                      <Zap className="w-3.5 h-3.5 mr-1" />
                      Live Simulation
                    </Button>
                  </div>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSave} className="p-6">
                  {activeTab === 'settings' && (
                    <div className="space-y-5 max-w-3xl">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                          label="Preset Name"
                          required
                          value={editingTemplate.name || ''}
                          onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                          placeholder="e.g. Modern Minimalist Ballroom"
                        />
                        <Select
                          label="Layout Engine"
                          value={editingTemplate.variant}
                          onChange={e => setEditingTemplate({ ...editingTemplate, variant: e.target.value as any })}
                          options={[
                            { label: 'Masonry Grid', value: 'masonry' },
                            { label: 'Hanging Polaroid', value: 'hanging' },
                            { label: 'Floating Bubbles', value: 'floating' },
                            { label: 'Standard Grid', value: 'grid' },
                            { label: 'Custom HTML/CSS Engine', value: 'custom' }
                          ]}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Select
                          label="Icon Set"
                          value={editingTemplate.iconType}
                          onChange={e => setEditingTemplate({ ...editingTemplate, iconType: e.target.value as any })}
                          options={[
                            { label: 'Hearts', value: 'heart' },
                            { label: 'Botanical Leaf', value: 'leaf' },
                            { label: 'Celestial Star', value: 'star' },
                            { label: 'Photographic Camera', value: 'camera' },
                            { label: 'Postal Mail', value: 'mail' },
                            { label: 'Artistic Palette', value: 'palette' }
                          ]}
                        />
                        <div>
                          <label className="block text-xs font-medium text-[#252525] mb-1.5">Description</label>
                          <input
                            type="text"
                            value={editingTemplate.description || ''}
                            onChange={e => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                            className="w-full px-3 py-2 text-sm bg-white border border-[#E8E8E5] rounded-lg text-[#252525] placeholder:text-[#777777]/50 focus:outline-none focus:border-[#8B806F] focus:ring-1 focus:ring-[#8B806F]"
                            placeholder="Brief description for display selector"
                          />
                        </div>
                      </div>

                      <div className="pt-4 border-t border-[#E8E8E5]">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#777777] mb-3">
                          Color Tokens (Tailwind utility classes)
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Input
                            label="Background Class"
                            value={editingTemplate.colors?.background || ''}
                            onChange={e => setEditingTemplate({
                              ...editingTemplate,
                              colors: { ...editingTemplate.colors!, background: e.target.value }
                            })}
                            placeholder="bg-[#F7F7F5]"
                          />
                          <Input
                            label="Accent Text Class"
                            value={editingTemplate.colors?.accent || ''}
                            onChange={e => setEditingTemplate({
                              ...editingTemplate,
                              colors: { ...editingTemplate.colors!, accent: e.target.value }
                            })}
                            placeholder="text-[#8B806F]"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'html' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[#252525] mb-1.5">
                          Global CSS Animations & Styles
                        </label>
                        <textarea
                          rows={14}
                          className="w-full p-3 font-mono text-xs bg-[#FAFAF8] border border-[#E8E8E5] rounded-lg focus:outline-none focus:border-[#8B806F] text-[#252525] leading-relaxed resize-none"
                          value={editingTemplate.css || ''}
                          onChange={e => setEditingTemplate({ ...editingTemplate, css: e.target.value })}
                          placeholder="/* Custom CSS rules and keyframes */"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#252525] mb-1.5">
                          HTML Container Markup
                        </label>
                        <textarea
                          rows={14}
                          className="w-full p-3 font-mono text-xs bg-[#FAFAF8] border border-[#E8E8E5] rounded-lg focus:outline-none focus:border-[#8B806F] text-[#252525] leading-relaxed resize-none"
                          value={editingTemplate.html || ''}
                          onChange={e => setEditingTemplate({ ...editingTemplate, html: e.target.value })}
                          placeholder="<div id='messages-container'></div>"
                        />
                      </div>
                    </div>
                  )}

                  {activeTab === 'card' && (
                    <div className="max-w-4xl">
                      <label className="block text-xs font-medium text-[#252525] mb-1.5">
                        Card HTML Template (Tokens: {'{{name}}'}, {'{{message}}'}, {'{{timestamp}}'})
                      </label>
                      <textarea
                        rows={14}
                        className="w-full p-3 font-mono text-xs bg-[#FAFAF8] border border-[#E8E8E5] rounded-lg focus:outline-none focus:border-[#8B806F] text-[#252525] leading-relaxed resize-none"
                        value={editingTemplate.card_html || ''}
                        onChange={e => setEditingTemplate({ ...editingTemplate, card_html: e.target.value })}
                        placeholder="<div class='p-4 bg-white rounded-lg shadow-sm'>...</div>"
                      />
                    </div>
                  )}

                  {/* Footer actions */}
                  <div className="mt-6 pt-4 border-t border-[#E8E8E5] flex items-center justify-between">
                    <div>
                      {editingTemplate.id && (
                        <button
                          type="button"
                          onClick={() => {
                            handleDelete(editingTemplate.id!);
                            setEditingTemplate(null);
                          }}
                          className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1.5 px-2 py-1 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete Preset
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingTemplate(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        isLoading={isSaving}
                      >
                        <Save className="w-3.5 h-3.5 mr-1.5" />
                        Save Preset
                      </Button>
                    </div>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Live Preview Modal */}
      <AnimatePresence>
        {showLivePreview && editingTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLivePreview(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="relative w-full h-[90vh] max-w-6xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col border border-[#E8E8E5]"
            >
              <div className="px-5 py-3 border-b border-[#E8E8E5] flex items-center justify-between bg-white">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#252525]">Simulation Canvas</span>
                  <Badge variant="taupe">{editingTemplate.name || 'Untitled'}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewRevision(prev => prev + 1)}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    Refresh
                  </Button>
                  <button
                    onClick={() => setShowLivePreview(false)}
                    className="p-1.5 text-[#777777] hover:text-[#252525] rounded-md hover:bg-[#F7F7F5]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden relative bg-[#F7F7F5]">
                <InternalTemplateView
                  key={`preview-${editingTemplate.id || 'new'}-${previewRevision}`}
                  template={editingTemplate as WeddingTemplate}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Assistant Modal */}
      <AnimatePresence>
        {showAIModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isGenerating && setShowAIModal(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="relative w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden p-6 border border-[#E8E8E5]"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-[#8B806F]" />
                  <h3 className="text-base font-semibold text-[#252525]">AI Design Assistant</h3>
                </div>
                <button
                  onClick={() => setShowAIModal(false)}
                  className="text-[#777777] hover:text-[#252525]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-[#777777] mb-4">
                Describe the wedding mood, motion, and card appearance. Gemini will synthesize the HTML, CSS keyframes, and layout bindings.
              </p>

              <textarea
                autoFocus
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="e.g. Dreamy celestial night theme with deep charcoal background, subtle drifting polaroids, and warm typography..."
                className="w-full px-3 py-2 text-sm bg-[#FAFAF8] border border-[#E8E8E5] rounded-lg focus:outline-none focus:border-[#8B806F] focus:ring-1 focus:ring-[#8B806F] text-[#252525] min-h-[140px] resize-none mb-4"
                disabled={isGenerating}
              />

              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAIModal(false)}
                  disabled={isGenerating}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={generateWithAI}
                  isLoading={isGenerating}
                  disabled={!aiPrompt.trim()}
                >
                  Generate Experience
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const MOCK_MESSAGES = [
  { id: '1', name: 'John & Sarah', message: 'Wishing you a lifetime of love and happiness!', timestamp: new Date().toISOString() },
  { id: '2', name: 'Michael Brown', message: 'Congratulations! The ceremony was stunning.', timestamp: new Date().toISOString() },
  { id: '3', name: 'Emma Wilson', message: 'So happy for you both! Cheers to many years.', timestamp: new Date().toISOString() },
];

function renderCard(cardHtml: string, msg: any, index: number) {
  const template = cardHtml || '<div class="p-4 bg-white rounded-lg shadow-sm border border-[#E8E8E5]"><h3>{{name}}</h3><p>{{message}}</p></div>';
  return template
    .replace(/\{\{name\}\}/g, msg.name)
    .replace(/\{\{message\}\}/g, msg.message)
    .replace(/\{\{index\}\}/g, index.toString())
    .replace(/\{\{timestamp\}\}/g, new Date(msg.timestamp).toLocaleTimeString());
}

function InternalTemplateView({ template }: { template: WeddingTemplate, key?: React.Key }) {
  const [liveMessages] = useState([...MOCK_MESSAGES]);
  const isCustom = template.variant === 'custom';

  const finalHtml = useMemo(() => {
    if (!isCustom) return '';

    const cardsHtml = liveMessages.map((msg, index) => {
      const cardInner = renderCard(template.card_html || '', msg, index);
      const row = index % 5;
      const col = Math.floor(index / 5);
      return `<div class="custom-card-wrapper" style="--index: ${index}; --row: ${row}; --col: ${col}">${cardInner}</div>`;
    }).join('');

    let baseHtml = template.html || '';
    baseHtml = baseHtml
      .replace(/\{\{bride\}\}/g, 'Sarah')
      .replace(/\{\{groom\}\}/g, 'Michael')
      .replace(/\{\{date\}\}/g, 'Oct 24, 2026');

    if (baseHtml.includes('id="messages-container"')) {
      return baseHtml.replace(/(id="messages-container"[^>]*>)/, `$1${cardsHtml}`);
    } else {
      return `${baseHtml}<div id="messages-container">${cardsHtml}</div>`;
    }
  }, [template.html, template.card_html, liveMessages, isCustom]);

  return (
    <div className={`w-full h-full overflow-hidden flex flex-col ${template.colors?.background || 'bg-white'}`}>
      <style dangerouslySetInnerHTML={{ __html: `
        ${template.css || ''}
        .custom-card-wrapper {
          display: block !important;
          min-height: 10px;
        }
      ` }} />

      <div className="flex-1 relative overflow-hidden">
        {isCustom ? (
          <div className="w-full h-full relative">
            <div
              id="template-root"
              className="w-full h-full"
              dangerouslySetInnerHTML={{ __html: finalHtml }}
            />
          </div>
        ) : (
          <div className="p-8 h-full overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {liveMessages.map((msg, index) => (
                template.card_html ? (
                  <div
                    key={msg.id}
                    className="contents"
                    dangerouslySetInnerHTML={{ __html: renderCard(template.card_html, msg, index) }}
                  />
                ) : (
                  <div key={msg.id} className={`${template.colors?.card} p-6 rounded-xl border ${template.colors?.border} shadow-xs`}>
                    <h3 className={`text-base font-semibold ${template.colors?.headerText} ${template.fontSerif} mb-1.5`}>{msg.name}</h3>
                    <p className={`text-sm ${template.colors?.text} ${template.fontSans}`}>{msg.message}</p>
                    <p className={`mt-3 text-[11px] ${template.colors?.subtleText}`}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                )
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
