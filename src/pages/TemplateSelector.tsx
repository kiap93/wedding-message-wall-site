import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { WeddingTemplate } from '../types';
import { Heart, Camera, Mail, Star, Leaf, Flower, Palette, User, Loader2 } from 'lucide-react';
import { fetchTemplates } from '../lib/templates';

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
      <div className="min-h-screen flex items-center justify-center bg-[#FDFCF0]">
        <Loader2 className="w-8 h-8 text-[#C5A059] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFCF0] text-[#2D2424] p-8 md:p-16">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-end mb-8">
           <button 
            onClick={() => navigate('/workspace')}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-[#C5A059]/30 rounded-2xl text-[#C5A059] font-bold uppercase tracking-widest text-xs hover:bg-[#C5A059] hover:text-white transition-all shadow-sm"
          >
            <User className="w-4 h-4" />
            Manage Event Space
          </button>
        </div>
        <header className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block p-4 rounded-full bg-[#C5A059]/10 mb-6"
          >
            <Palette className="w-10 h-10 text-[#C5A059]" />
          </motion.div>
          <h1 className="text-5xl md:text-6xl font-serif mb-4 tracking-tight">Organization Templates</h1>
          <p className="text-lg opacity-60 font-sans tracking-[0.2em] uppercase">Premium white-label styles for event organizers</p>
        </header>

        <div className="space-y-20">
          {/* Classic Section */}
          <div>
            <h2 className="text-xs font-black uppercase tracking-[0.4em] text-[#C5A059] mb-12 flex items-center gap-4">
              <div className="h-px bg-[#C5A059]/20 flex-1" />
              Standard Experiences
              <div className="h-px bg-[#C5A059]/20 flex-1" />
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {templates.filter(t => !t.is_custom).map((template, index) => (
                <TemplateCard 
                  key={template.id} 
                  template={template} 
                  index={index} 
                  onClick={() => handleSelect(template.id)} 
                />
              ))}
            </div>
          </div>

          {/* Premium Section */}
          {templates.filter(t => t.is_custom).length > 0 && (
            <div>
               <h2 className="text-xs font-black uppercase tracking-[0.4em] text-indigo-500 mb-12 flex items-center gap-4">
                <div className="h-px bg-indigo-500/20 flex-1" />
                Premium AI Crafted Experiences
                <div className="h-px bg-indigo-500/20 flex-1" />
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {templates.filter(t => t.is_custom).map((template, index) => (
                  <TemplateCard 
                    key={template.id} 
                    template={template} 
                    index={index} 
                    onClick={() => handleSelect(template.id)} 
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TemplateCard({ template, index, onClick }: { template: WeddingTemplate, index: number, onClick: () => void, key?: React.Key }) {
  const Icon = template.iconType === 'heart' ? Heart :
               template.iconType === 'leaf' ? Leaf :
               template.iconType === 'star' ? Star :
               template.iconType === 'mail' ? Mail :
               template.iconType === 'camera' ? Camera :
               template.iconType === 'flower' ? Flower : 
               template.is_custom ? Palette : Palette;

  const isCustom = template.is_custom;

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-[2rem] border transition-all hover:scale-[1.02] hover:shadow-2xl text-left aspect-[4/5] flex flex-col items-stretch
        ${isCustom ? 'bg-gradient-to-br from-white to-indigo-50/50 border-indigo-100' : `${template.colors.background} ${template.colors.border}`}
      `}
    >
      {isCustom && (
        <div className="absolute top-6 right-6">
          <Sparkles className="w-5 h-5 text-indigo-400" />
        </div>
      )}
      <div className="flex-1 p-8 flex flex-col justify-between">
        <div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 shadow-sm
            ${isCustom ? 'bg-indigo-500 text-white' : `${template.colors.accent} bg-opacity-10`}
          `}>
            <Icon className="w-6 h-6" />
          </div>
          <h3 className={`text-2xl font-bold mb-3 ${isCustom ? 'text-indigo-950' : template.colors.headerText}`}>
            {template.name}
          </h3>
          <p className={`text-sm leading-relaxed opacity-70 ${isCustom ? 'text-indigo-600' : template.colors.text}`}>
            {template.description || (isCustom ? 'Custom dynamic experience' : '')}
          </p>
        </div>

        <div className="mt-auto">
          <div className="flex gap-2 mb-4">
            {isCustom ? (
              <>
                <div className="w-4 h-4 rounded-full bg-indigo-500" />
                <div className="w-4 h-4 rounded-full bg-indigo-200" />
              </>
            ) : (
              <>
                <div className={`w-4 h-4 rounded-full ${template.colors.accent.replace('text-', 'bg-') || 'bg-current'}`} />
                <div className={`w-4 h-4 rounded-full ${template.colors.border.replace('border-', 'bg-') || 'bg-current opacity-50'}`} />
                <div className={`w-4 h-4 rounded-full ${template.colors.subtleText.replace('text-', 'bg-') || 'bg-current opacity-30'}`} />
              </>
            )}
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-widest ${isCustom ? 'text-indigo-500' : 'opacity-40'} group-hover:opacity-100 transition-opacity`}>
            {isCustom ? 'Launch Experience →' : 'Preview →'}
          </span>
        </div>
      </div>

      {/* Decorative background for the card */}
      <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 transition-transform group-hover:scale-125
        ${isCustom ? 'bg-indigo-500' : (template.colors.accent.replace('text-', 'bg-') || 'bg-current')} blur-[40px] rounded-full translate-x-1/2 -translate-y-1/2
      `} />
    </motion.button>
  );
}
