import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WeddingTemplate } from '../types';
import { Palette, Loader2, ArrowRight, ExternalLink, Sparkles, Layers, Monitor } from 'lucide-react';
import { fetchTemplates } from '../lib/templates';
import Button from '../design-system/components/Button';
import Badge from '../design-system/components/Badge';
import MarketingLayout from '../layouts/MarketingLayout';

export default function TemplateSelector() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<WeddingTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<string>('all');

  useEffect(() => {
    async function load() {
      const data = await fetchTemplates();
      setTemplates(data);
      setIsLoading(false);
    }
    load();
  }, []);

  const handleSelect = (id: string) => {
    navigate(`/display?template=${id}`);
  };

  const variants = ['all', 'masonry', 'hanging', 'floating', 'grid'];

  const filteredTemplates = selectedVariant === 'all' 
    ? templates 
    : templates.filter(t => (t.variant || 'masonry') === selectedVariant);

  if (isLoading) {
    return (
      <MarketingLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#252525] animate-spin" />
        </div>
      </MarketingLayout>
    );
  }

  return (
    <MarketingLayout>
      <div className="py-12 sm:py-16 px-6">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Hero / Header */}
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-[#736959] bg-[#EFECE6] px-2.5 py-1 rounded">
              <Sparkles className="w-3.5 h-3.5 text-[#8B806F]" />
              <span>Display Art Aesthetics & Digital Stationery</span>
            </div>
            
            <h1 className="font-serif text-3xl sm:text-5xl font-normal tracking-tight text-[#252525] leading-tight">
              Curated Wedding Display Themes & Invitation Suite Catalog
            </h1>

            <p className="text-xs sm:text-sm text-[#777777] leading-relaxed">
              Explore our architectural visual aesthetics and typography suites. Each theme powers the entire wedding journey — from mobile digital invitations and RSVP forms to live banquet projector screens.
            </p>

            <div className="pt-2 flex flex-wrap gap-4 text-xs">
              <a 
                href="/digital-wedding-invitations" 
                className="text-[#8B806F] hover:text-[#252525] font-medium flex items-center gap-1 transition-colors"
              >
                Customize in Digital Stationery Studio →
              </a>
              <a 
                href="/wedding-reception-display" 
                className="text-[#8B806F] hover:text-[#252525] font-medium flex items-center gap-1 transition-colors"
              >
                Learn About Live Ballroom Displays →
              </a>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-3 border-y border-[#E8E8E5]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#777777] mr-1">Filter by Layout:</span>
              {variants.map((v) => (
                <button
                  key={v}
                  onClick={() => setSelectedVariant(v)}
                  className={`px-3 py-1 text-xs rounded capitalize transition-colors ${
                    selectedVariant === v
                      ? 'bg-[#252525] text-white font-medium'
                      : 'bg-white border border-[#E8E8E5] text-[#777777] hover:text-[#252525]'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="text-xs text-[#777777]">
              Showing <span className="font-mono text-[#252525] font-medium">{filteredTemplates.length}</span> themes
            </div>
          </div>

          {/* Template Grid */}
          <div className="space-y-12">
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {filteredTemplates.map((template) => (
                  <article 
                    key={template.id} 
                    className="bg-white border border-[#E8E8E5] hover:border-[#252525] rounded-lg p-5 transition-colors shadow-subtle flex flex-col justify-between min-h-[220px] group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="text-sm font-semibold text-[#252525] group-hover:text-[#8B806F] transition-colors">
                          {template.name}
                        </h2>
                        <Badge variant={template.is_custom ? 'neutral' : 'taupe'} size="sm">
                          {template.is_custom ? 'Custom' : 'Standard'}
                        </Badge>
                      </div>
                      <p className="text-xs text-[#777777] leading-relaxed line-clamp-3">
                        {template.description || 'Editorial layout tailored for digital wedding displays and responsive guest invitations.'}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-[#EFEFEA] space-y-3">
                      <div className="flex items-center justify-between text-[11px] text-[#777777]">
                        <span className="font-mono capitalize">{template.variant || 'masonry'} layout</span>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#8B806F]" title="Accent Color" />
                          <div className="w-2.5 h-2.5 rounded-full bg-[#252525]" title="Header Color" />
                          <div className="w-2.5 h-2.5 rounded-full bg-[#E8E8E5]" title="Border Color" />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <a
                          href={`/display?template=${template.id}`}
                          onClick={(e) => { e.preventDefault(); handleSelect(template.id); }}
                          className="font-medium text-[#252525] hover:underline flex items-center gap-1 text-[11px]"
                        >
                          Preview Theme <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                          href="/login"
                          className="text-[11px] text-[#8B806F] hover:text-[#252525] font-medium"
                        >
                          Apply to Wedding
                        </a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            {/* Information Banner */}
            <div className="bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg p-8 grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-3">
                <span className="text-xs font-semibold text-[#8B806F] uppercase tracking-wider">Complete Aesthetic Consistency</span>
                <h3 className="font-serif text-2xl text-[#252525]">One visual aesthetic across all screens.</h3>
                <p className="text-xs sm:text-sm text-[#777777] leading-relaxed">
                  When you select a theme in EventFrame, your decision propagates across the guest RSVP page, the mobile photo upload portal, the digital invitation suite, and the ballroom projector screen.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 md:justify-end">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => navigate('/login')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Create Studio Account
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => navigate('/pricing')}
                >
                  View Plans & Pricing
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
