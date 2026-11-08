import React from 'react';
import { useWebsiteStore } from '../store/websiteStore';
import { WeddingWebsiteRenderer } from '../WeddingWebsiteRenderer';

export const WebsiteCanvas: React.FC = () => {
  const { 
    config, 
    project, 
    selectedSectionId, 
    setSelectedSectionId, 
    moveSection, 
    removeSection, 
    toggleSectionVisibility,
    deviceMode, 
    zoom 
  } = useWebsiteStore();

  // Width constraints based on selected device preview
  const viewportWidthClass = 
    deviceMode === 'mobile' 
      ? 'w-[390px] min-h-[844px] shadow-2xl rounded-[40px] border-[8px] border-[#252525] my-8 overflow-hidden' 
      : deviceMode === 'tablet' 
        ? 'w-[768px] min-h-[1024px] shadow-xl rounded-[28px] border-[6px] border-[#333333] my-8 overflow-hidden' 
        : 'w-full max-w-5xl min-h-screen shadow-md rounded-xl border border-[#E8E8E5] my-6';

  const zoomScale = zoom / 100;

  return (
    <div className="flex-1 bg-[#F4F3F0] overflow-y-auto flex justify-center p-4 sm:p-6 relative">
      {/* Background Grid Accent */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: 'radial-gradient(#D5D4CF 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      {/* Responsive Viewport Frame */}
      <div 
        className={`bg-white transition-all duration-300 relative shrink-0 ${viewportWidthClass}`}
        style={{
          transform: `scale(${zoomScale})`,
          transformOrigin: 'top center'
        }}
      >
        <WeddingWebsiteRenderer
          config={config}
          project={project}
          isEditor={true}
          selectedSectionId={selectedSectionId}
          onSelectSection={setSelectedSectionId}
          onMoveSection={moveSection}
          onRemoveSection={removeSection}
          onToggleVisibility={toggleSectionVisibility}
        />
      </div>
    </div>
  );
};

