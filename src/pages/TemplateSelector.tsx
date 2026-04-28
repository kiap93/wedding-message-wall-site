import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { TEMPLATES, WeddingTemplate } from '../types';
import { Heart, Camera, Mail, Star, Leaf, Flower, Palette, User } from 'lucide-react';

export default function TemplateSelector() {
  const navigate = useNavigate();

  const handleSelect = (id: string) => {
    navigate(`/display?template=${id}`);
  };

  return (
    <div className="min-h-screen bg-[#FDFCF0] text-[#2D2424] p-8 md:p-16">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-end mb-8">
           <button 
            onClick={() => navigate('/admin')}
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {TEMPLATES.map((template, index) => (
            <TemplateCard 
              key={template.id} 
              template={template} 
              index={index} 
              onClick={() => handleSelect(template.id)} 
            />
          ))}
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
               template.iconType === 'flower' ? Flower : Palette;

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-[2rem] border transition-all hover:scale-[1.02] hover:shadow-2xl text-left aspect-[4/5] flex flex-col items-stretch
        ${template.colors.background} ${template.colors.border}
      `}
    >
      <div className="flex-1 p-8 flex flex-col justify-between">
        <div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 shadow-sm
            ${template.colors.accent} bg-opacity-10
          `}>
            <Icon className="w-6 h-6" />
          </div>
          <h3 className={`text-2xl font-bold mb-3 ${template.colors.headerText}`}>
            {template.name}
          </h3>
          <p className={`text-sm leading-relaxed opacity-70 ${template.colors.text}`}>
            {template.description}
          </p>
        </div>

        <div className="mt-auto">
          <div className="flex gap-2 mb-4">
            <div className={`w-4 h-4 rounded-full ${template.colors.accent.replace('text-', 'bg-') || 'bg-current'}`} />
            <div className={`w-4 h-4 rounded-full ${template.colors.border.replace('border-', 'bg-') || 'bg-current opacity-50'}`} />
            <div className={`w-4 h-4 rounded-full ${template.colors.subtleText.replace('text-', 'bg-') || 'bg-current opacity-30'}`} />
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity`}>
            Preview →
          </span>
        </div>
      </div>

      {/* Decorative background for the card */}
      <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 transition-transform group-hover:scale-125
        ${template.colors.accent.replace('text-', 'bg-') || 'bg-current'} blur-[40px] rounded-full translate-x-1/2 -translate-y-1/2
      `} />
    </motion.button>
  );
}
