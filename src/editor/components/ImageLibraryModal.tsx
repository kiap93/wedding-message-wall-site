import React, { useState, useEffect } from 'react';
import { 
  X, 
  Image as ImageIcon, 
  Trash2, 
  Loader2, 
  Plus, 
  Search, 
  Grid
} from 'lucide-react';
import { useEditorStore } from '../store';
import { UploadDropzone } from './UploadDropzone';
import { API_BASE } from '../../lib/config';
import Button from '../../design-system/components/Button';

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
        throw new Error('Could not load image library');
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
    e.stopPropagation();

    if (!confirm('Are you sure you want to permanently delete this photo?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/images/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete image');
      }
      
      setImages((prev) => prev.filter((img) => img.id !== id));
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

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

    if (selectedEl && selectedEl.type === 'image') {
      updateElement(selectedEl.id, {
        src: img.medium_url,
        cropX: 0,
        cropY: 0,
        cropWidth: img.width,
        cropHeight: img.height,
        imageNaturalWidth: img.width,
        imageNaturalHeight: img.height,
      });
    } else {
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
    setImages((prev) => [newImage, ...prev]);
    setShowUploadZone(false);
  };

  if (!isOpen) return null;

  const filteredImages = images.filter((img) =>
    (img.original_url || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (img.id || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none">
      <div className="bg-white border border-[#E8E8E5] shadow-modal rounded-lg w-full max-w-2xl flex flex-col h-[540px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E8E8E5] bg-[#FAF9F7]">
          <div>
            <h2 className="text-xs font-semibold text-[#252525]">Photo & Asset Library</h2>
            <p className="text-[11px] text-[#777777]">Insert uploaded event photos or upload new stationery assets</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-[#777777] hover:text-[#252525] rounded hover:bg-[#EFEFEA] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-3 border-b border-[#E8E8E5] flex items-center justify-between gap-3 bg-white shrink-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-[#777777] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search images..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 h-8 text-xs border border-[#E8E8E5] rounded-md focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
            />
          </div>

          <Button
            variant={showUploadZone ? 'outline' : 'primary'}
            size="sm"
            onClick={() => setShowUploadZone(!showUploadZone)}
            leftIcon={<Plus className="w-3 h-3" />}
          >
            {showUploadZone ? 'View Gallery' : 'Upload Image'}
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#FAF9F7]/30">
          {showUploadZone ? (
            <div className="max-w-md mx-auto py-8">
              <UploadDropzone eventId={projectId} onUploadSuccess={handleUploadComplete} />
              <div className="text-center mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUploadZone(false)}
                >
                  Back to Library
                </Button>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-xs text-[#777777] py-16">
              <Loader2 className="w-5 h-5 text-[#252525] animate-spin" />
              <span>Loading images...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12 p-4 text-xs">
              <p className="text-red-600 mb-2">{error}</p>
              <Button variant="outline" size="sm" onClick={loadImages}>Retry</Button>
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="text-center py-16 text-xs text-[#777777] flex flex-col items-center justify-center">
              <ImageIcon className="w-8 h-8 text-[#B0ADA8] mb-2" />
              <p>No images found in your library.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setShowUploadZone(true)}
              >
                Upload Photo
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {filteredImages.map((img) => (
                <div
                  key={img.id}
                  onClick={() => handleSelectImage(img)}
                  className="group relative bg-white border border-[#E8E8E5] rounded-md p-1.5 cursor-pointer shadow-subtle hover:border-[#252525] transition-colors flex flex-col overflow-hidden"
                >
                  <div className="aspect-square rounded overflow-hidden bg-[#FAF9F7] relative flex items-center justify-center">
                    <img
                      src={img.thumbnail_url}
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />

                    <button
                      onClick={(e) => handleDeleteImage(e, img.id)}
                      className="absolute top-1.5 right-1.5 p-1 bg-black/60 opacity-0 group-hover:opacity-100 hover:bg-red-600 text-white rounded transition-opacity"
                      title="Delete Image"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="pt-1.5 px-0.5 flex justify-between items-center text-[10px] text-[#777777]">
                    <span className="truncate max-w-[120px] font-mono">
                      {Math.round(img.file_size / 1024)} KB
                    </span>
                    <span className="font-mono">{img.width}x{img.height}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[#E8E8E5] bg-[#FAF9F7] flex items-center justify-end shrink-0">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
