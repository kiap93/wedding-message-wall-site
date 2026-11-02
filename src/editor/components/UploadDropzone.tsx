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
    <div className={`flex flex-col gap-2.5 w-full ${className}`}>
      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerSelect}
        className={`border border-dashed rounded-lg p-5 text-center cursor-pointer flex flex-col items-center justify-center min-h-[140px] transition-colors relative overflow-hidden select-none ${
          isDragging
            ? 'border-[#252525] bg-[#FAF9F7]'
            : 'border-[#E8E8E5] hover:border-[#8B806F] bg-[#FAF9F7]/50 hover:bg-[#FAF9F7]'
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
          <div className="flex flex-col items-center gap-2.5 w-full max-w-[200px]">
            {previewUrl ? (
              <div className="relative w-12 h-12 rounded overflow-hidden border border-[#E8E8E5] mb-1">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                </div>
              </div>
            ) : (
              <Loader2 className="w-6 h-6 text-[#252525] animate-spin mb-1" />
            )}
            <p className="text-xs text-[#777777]">Uploading image...</p>
            
            <div className="w-full h-1 bg-[#E8E8E5] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#252525] transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] font-mono tabular-nums text-[#777777]">{progress}%</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-8 h-8 bg-white border border-[#E8E8E5] rounded-md flex items-center justify-center text-[#777777] mb-1">
              <Upload className="w-4 h-4 text-[#777777]" />
            </div>
            <p className="text-xs font-medium text-[#252525]">Click or drag image to upload</p>
            <p className="text-[11px] text-[#777777]">
              JPG, PNG, or WEBP · Max 5MB
            </p>
          </div>
        )}
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="flex items-start gap-2 p-2.5 bg-red-50 text-red-700 rounded-md border border-red-200 text-xs">
          <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-2 p-2.5 bg-green-50 text-green-700 rounded-md border border-green-200 text-xs">
          <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}
    </div>
  );
};
