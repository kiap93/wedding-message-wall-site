import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WeddingTemplate } from '../types';
import { Palette, Loader2, ArrowLeft, ExternalLink } from 'lucide-react';
import { fetchTemplates } from '../lib/templates';
import Button from '../design-system/components/Button';
import PageHeader from '../design-system/components/PageHeader';
import Badge from '../design-system/components/Badge';

export default function TemplateSelector() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<WeddingTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5]">
        <Loader2 className="w-6 h-6 text-[#252525] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#252525] p-6 sm:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <PageHeader
          title="Display Theme Catalog"
          description="Curated visual aesthetics and typography suites for live venue projectors and interactive guest pages."
          breadcrumbs={[
            { label: 'Workspace', onClick: () => navigate('/workspace') },
            { label: 'Theme Catalog' }
          ]}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/workspace')}
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            >
              Back to Workspace
            </Button>
          }
        />

        <div className="space-y-10">
          <div>
            <div className="text-xs font-semibold text-[#777777] mb-4">Core Ceremony Layouts</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {templates.filter(t => !t.is_custom).map((template) => (
                <div 
                  key={template.id} 
                  onClick={() => handleSelect(template.id)}
                  className="bg-white border border-[#E8E8E5] hover:border-[#252525] rounded-lg p-5 cursor-pointer transition-colors shadow-subtle flex flex-col justify-between min-h-[190px]"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-[#252525]">{template.name}</span>
                      <Badge variant="taupe" size="sm">Standard</Badge>
                    </div>
                    <p className="text-xs text-[#777777] leading-relaxed line-clamp-3">
                      {template.description || 'Editorial layout tailored for digital wedding displays.'}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-[#EFEFEA] flex items-center justify-between text-xs text-[#777777]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#8B806F]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#252525]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#E8E8E5]" />
                    </div>
                    <span className="font-medium text-[#252525] hover:underline flex items-center gap-1 text-[11px]">
                      Preview <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {templates.filter(t => t.is_custom).length > 0 && (
            <div>
              <div className="text-xs font-semibold text-[#777777] mb-4">Custom & Studio Plugins</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {templates.filter(t => t.is_custom).map((template) => (
                  <div 
                    key={template.id} 
                    onClick={() => handleSelect(template.id)}
                    className="bg-white border border-[#E8E8E5] hover:border-[#252525] rounded-lg p-5 cursor-pointer transition-colors shadow-subtle flex flex-col justify-between min-h-[190px]"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-[#252525]">{template.name}</span>
                        <Badge variant="neutral" size="sm">Custom</Badge>
                      </div>
                      <p className="text-xs text-[#777777] leading-relaxed line-clamp-3">
                        {template.description || 'Dynamic custom ceremony experience plugin.'}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-[#EFEFEA] flex items-center justify-between text-xs text-[#777777]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#252525]" />
                        <div className="w-2.5 h-2.5 rounded-full bg-[#8B806F]" />
                      </div>
                      <span className="font-medium text-[#252525] hover:underline flex items-center gap-1 text-[11px]">
                        Preview <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
