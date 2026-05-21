import React, { useState, useEffect } from 'react';
import { 
  X, 
  Image as ImageIcon, 
  Trash2, 
  Loader2, 
  Plus, 
  Search, 
  Sparkles,
  Grid
} from 'lucide-react';
import { useEditorStore } from '../store';
import { UploadDropzone } from './UploadDropzone';
import { API_BASE } from '../../lib/config';

interface ImageLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
}

export const ImageLibraryModal: React.FC<ImageLibraryModalProps> = ({
  isOpen,
  onClose,
  projectId = 'default-event',
}) => {
  const { addElement, selectedId, elements, updateElement, viewportWidth, viewportHeight, pan, scale, canvasWidth, canvasHeight } = useEditorStore();
  const [images, setImages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user image catalog on open
  useEffect(() => {
    if (isOpen) {
      loadImages();
    }
  }, [isOpen, projectId]);

  const loadImages = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/images?projectId=${projectId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Could not load your image library');
      }
      const json = await response.json();
      if (json.success && Array.isArray(json.data)) {
        setImages(json.data);
      } else {
        throw new Error('Received invalid list format');
      }
    } catch (err: any) {
      console.error('[IMAGE-LIBRARY] Error loading images:', err);
      setError(err.message || 'Image library loading failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteImage = async (e: React.MouseEvent, id: string) => {
    // Prevent triggering select image behavior
    e.stopPropagation();

    if (!confirm('Are you sure you want to permanently delete this photo? This will remove files from R2 storage.')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/images/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete image');
      }
      
      // Update local state list
      setImages((prev) => prev.filter((img) => img.id !== id));
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  // Helper code to get dynamic launch coordinates in focus center
  const getSpawnCoords = (width: number, height: number) => {
    const screenCenterX = viewportWidth / 2;
    const screenCenterY = viewportHeight / 2;

    const canvasCenterX = (screenCenterX - pan.x) / scale;
    const canvasCenterY = (screenCenterY - pan.y) / scale;

    let targetX = canvasCenterX - width / 2;
    let targetY = canvasCenterY - height / 2;

    targetX = Math.max(10, Math.min(canvasWidth - width - 10, targetX));
    targetY = Math.max(10, Math.min(canvasHeight - height - 10, targetY));

    if (isNaN(targetX) || isNaN(targetY)) {
      return { x: canvasWidth / 2 - width / 2, y: canvasHeight / 2 - height / 2 };
    }

    return { x: targetX, y: targetY };
  };

  const handleSelectImage = (img: any) => {
    const selectedEl = elements.find((el) => el.id === selectedId);

    // If an image element is currently selected, swap the source directly to prevent duplicities
    if (selectedEl && selectedEl.type === 'image') {
      updateElement(selectedEl.id, {
        src: img.medium_url,
        // Reset crop settings to full image size bounds on replace
        cropX: 0,
        cropY: 0,
        cropWidth: img.width,
        cropHeight: img.height,
        imageNaturalWidth: img.width,
        imageNaturalHeight: img.height,
      });
    } else {
      // Create a brand new image element centered on viewport canvas
      const idealWidth = 320;
      const idealHeight = Math.round((img.height / img.width) * idealWidth);
      const coords = getSpawnCoords(idealWidth, idealHeight);

      addElement({
        id: 'img_' + Math.random().toString(36).substring(2, 11),
        type: 'image',
        x: coords.x,
        y: coords.y,
        width: idealWidth,
        height: idealHeight,
        rotation: 0,
        zIndex: elements.length,
        src: img.medium_url,
        cropX: 0,
        cropY: 0,
        cropWidth: img.width,
        cropHeight: img.height,
        imageNaturalWidth: img.width,
        imageNaturalHeight: img.height,
      });
    }
    onClose();
  };

  const handleUploadComplete = (newImage: any) => {
    // Add to top of local lists
    setImages((prev) => [newImage, ...prev]);
    setShowUploadZone(false);
  };

  if (!isOpen) return null;

  const filteredImages = images.filter((img) =>
    (img.original_url || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (img.id || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[3px] flex items-center justify-center z-[9999] p-4 select-none animate-fadeIn">
      <div className="bg-white border border-[#C5A059]/25 shadow-2xl rounded-3xl w-full max-w-2xl flex flex-col h-[580px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#C5A059]/10 border border-[#C5A059]/20 rounded-xl flex items-center justify-center text-[#C5A059]">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.15em] text-[#2D2424]">Studio Image Library</h2>
              <p className="text-[9px] text-[#C5A059] uppercase tracking-wider mt-0.5">Select and optimize your event photos</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search uploaded photos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-gray-100 rounded-xl bg-gray-50/50 focus:outline-none focus:border-[#C5A059]/50 focus:ring-1 focus:ring-[#C5A059]/30 transition-all font-medium text-gray-700"
            />
          </div>

          <button
            onClick={() => setShowUploadZone(!showUploadZone)}
            className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm border ${
              showUploadZone
                ? 'bg-white border-[#C5A059]/40 text-[#2D2424] hover:bg-gray-50'
                : 'bg-[#C5A059] border-[#C5A059] text-white hover:bg-[#b08e4d]'
            }`}
          >
            <Plus className={`w-3.5 h-3.5 ${showUploadZone ? 'text-[#C5A059]' : 'text-white'}`} />
            {showUploadZone ? 'My Library' : 'Upload Photo'}
          </button>
        </div>

        {/* Content Panel */}
        <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-white to-gray-50/20">
          {showUploadZone ? (
            <div className="max-w-md mx-auto py-10">
              <h3 className="text-xs font-black uppercase tracking-[0.1em] text-gray-400 text-center mb-6">Upload event photo</h3>
              <UploadDropzone eventId={projectId} onUploadSuccess={handleUploadComplete} />
              <button
                onClick={() => setShowUploadZone(false)}
                className="w-full mt-4 text-[9px] uppercase tracking-widest font-bold text-gray-400 text-center py-2 border border-dashed border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                ← Back to catalog files
              </button>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16 text-gray-400">
              <Loader2 className="w-8 h-8 text-[#C5A059] animate-spin" />
              <p className="font-serif italic text-xs">Querying your media archive...</p>
            </div>
          ) : error ? (
            <div className="text-center py-16 border rounded-2xl border-dashed border-red-100 bg-red-50/30 p-6">
              <p className="text-xs font-bold text-red-500">{error}</p>
              <button 
                onClick={loadImages}
                className="mt-4 px-4 py-2 bg-white border border-red-200 text-xs text-red-600 rounded-xl hover:bg-red-50 font-bold transition-all"
              >
                Retry Request
              </button>
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-gray-100 rounded-2xl flex flex-col items-center justify-center p-8 bg-white min-h-[250px]">
              <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center mb-3">
                <Grid className="w-5 h-5 text-gray-300" />
              </div>
              <p className="font-serif italic text-xs text-gray-400">No photos in this segment library yet.</p>
              <button
                onClick={() => setShowUploadZone(true)}
                className="mt-4 px-4 py-2 bg-gray-50 border border-[#C5A059]/20 hover:border-[#C5A059]/40 text-[#C5A059] font-black uppercase tracking-widest text-[9px] rounded-xl transition-all"
              >
                Upload your first photo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-5">
              {filteredImages.map((img) => (
                <div
                  key={img.id}
                  onClick={() => handleSelectImage(img)}
                  className="group relative bg-white border border-gray-100 rounded-2xl p-2 cursor-pointer shadow-sm hover:shadow-lg hover:border-[#C5A059]/30 hover:-translate-y-0.5 transition-all flex flex-col overflow-hidden"
                >
                  {/* Photo Container */}
                  <div className="aspect-square rounded-xl overflow-hidden bg-gray-50 relative flex items-center justify-center border border-gray-50">
                    <img
                      src={img.thumbnail_url}
                      alt="Thumbnail"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />

                    {/* Delete Shortcut */}
                    <button
                      onClick={(e) => handleDeleteImage(e, img.id)}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 backdrop-blur-md opacity-0 group-hover:opacity-100 hover:bg-red-600 text-white rounded-lg transition-all shadow-sm"
                      title="Delete Image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Image Resolution Badge */}
                    <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/40 text-white text-[8px] font-mono rounded select-none opacity-80 group-hover:opacity-100">
                      {img.width}x{img.height}
                    </div>
                  </div>

                  {/* Caption Info */}
                  <div className="pt-2 px-1 pb-1 flex justify-between items-center bg-white">
                    <div className="truncate pr-2">
                      <p className="text-[9px] font-bold text-gray-600 truncate">
                        {img.original_url ? img.original_url.split('/').pop()?.substring(0, 16) : 'Photo'}
                      </p>
                      <p className="text-[8px] text-gray-400 font-mono mt-0.5">
                        {Math.round(img.file_size / 1024)} KB
                      </p>
                    </div>
                    
                    <span className="shrink-0 w-4 h-4 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-[#C5A059]/10 group-hover:text-[#C5A059] transition-colors">
                      <Plus className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between shrink-0">
          <p className="text-[8.5px] text-gray-400 leading-none">
            🎨 Low-cost cloud optimization using <strong>Sharp compression</strong> and **Cloudflare R2 CDN storage**.
          </p>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[9px] rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
