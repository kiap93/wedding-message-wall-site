import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Upload, Image as ImageIcon, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { API_BASE } from '../../lib/config';

interface UploadDropzoneProps {
  eventId?: string;
  onUploadSuccess: (imageRecord: any) => void;
  className?: string;
}

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  eventId = 'default-event',
  onUploadSuccess,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validate size (5MB limit)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setErrorMessage('File is too large. Maximum allowed size is 5MB.');
      return false;
    }

    // Validate type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage('Unsupported image format. Please upload JPG, PNG, or WEBP.');
      return false;
    }

    return true;
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setProgress(0);
    setErrorMessage(null);

    // Generate immediate mock local preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('event_id', eventId);

      // Perform upload request with XMLHttpRequest to track progress
      const xhr = new XMLHttpRequest();
      
      const uploadPromise = new Promise<{ success: boolean; data: any }>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            setProgress(percentComplete);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              resolve(res);
            } catch (e) {
              reject(new Error('Failed to parse upload server response'));
            }
          } else {
            try {
              const res = JSON.parse(xhr.responseText);
              reject(new Error(res.error || `Upload failed with status ${xhr.status}`));
            } catch (e) {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network request failed. Please verify connection.'));
        });

        // Open and configure cross-origin settings if needed
        xhr.open('POST', `${API_BASE}/api/upload`);
        xhr.withCredentials = true; // send auth cookies
        xhr.send(formData);
      });

      const response = await uploadPromise;

      if (response.success && response.data) {
        setSuccessMessage('Photo uploaded and optimized completely!');
        // Trigger parent callback
        onUploadSuccess(response.data);
      } else {
        throw new Error('Could not retrieve uploaded metadata.');
      }

    } catch (err: any) {
      console.error('[CLIENT-UPLOAD] Error uploading image:', err);
      setErrorMessage(err.message || 'An error occurred during image compilation.');
      setPreviewUrl(null); // Clear preview on failure
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        await uploadFile(file);
      }
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        await uploadFile(file);
      }
    }
  };

  const triggerSelect = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  return (
    <div className={`flex flex-col gap-3 w-full ${className}`}>
      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerSelect}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer flex flex-col items-center justify-center min-h-[160px] transition-all relative overflow-hidden select-none ${
          isDragging
            ? 'border-[#C5A059] bg-[#C5A059]/5'
            : 'border-gray-200 hover:border-[#C5A059]/40 hover:bg-gray-50/40 bg-white'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
        />

        {/* Upload States */}
        {isUploading ? (
          <div className="flex flex-col items-center gap-3 w-full max-w-[200px]">
            {previewUrl ? (
              <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-100 shadow-sm mb-1 animate-pulse">
                <img src={previewUrl} alt="Uploading preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                </div>
              </div>
            ) : (
              <Loader2 className="w-8 h-8 text-[#C5A059] animate-spin mb-1" />
            )}
            <p className="text-[10px] uppercase tracking-widest font-black text-gray-400">Optimizing Photo...</p>
            
            {/* Progress Bar Container */}
            <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-1 relative">
              <div
                className="h-full bg-gradient-to-r from-[#C5A059] to-[#b38e4a] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[9px] font-bold text-[#C5A059] font-mono leading-none">{progress}%</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center text-gray-400 group-hover:text-[#C5A059] transition-colors mb-1">
              <Upload className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-xs font-bold text-gray-700">Drag & drop your invitation photo</p>
            <p className="text-[9px] uppercase tracking-wider text-gray-400 mt-0.5">
              or <span className="text-[#C5A059] font-bold underline">click to browse</span> files
            </p>
            <p className="text-[8px] text-gray-300 mt-2 italic">Supports JPG, PNG, WEBP — Max 5MB</p>
          </div>
        )}
      </div>

      {/* Message Notifications */}
      {errorMessage && (
        <div className="flex items-start gap-2 p-3 bg-red-50 text-red-600 rounded-xl border border-red-100 animate-fadeIn">
          <AlertCircle className="w-3.5 h-3.5 transform translate-y-0.5 shrink-0" />
          <span className="text-[10px] leading-relaxed font-bold">{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-2 p-3 bg-green-50 text-green-700 rounded-xl border border-green-100 animate-fadeIn">
          <CheckCircle className="w-3.5 h-3.5 transform translate-y-0.5 shrink-0" />
          <span className="text-[10px] leading-relaxed font-bold">{successMessage}</span>
        </div>
      )}
    </div>
  );
};
