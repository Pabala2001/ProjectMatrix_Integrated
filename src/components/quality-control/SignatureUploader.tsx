import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useRef, useState } from "react";
import { Upload, X, RefreshCw, PenTool } from "lucide-react";
import { useAssetUrl } from "../../hooks/useAssetUrl";

interface SignatureUploaderProps {
  label: string;
  name: string;
  onNameChange: (val: string) => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
  onDeleteExisting: () => void;
  existingBucket?: string | null;
  existingPath?: string | null;
  existingFileName?: string | null;
  readOnly?: boolean;
}

export default function SignatureUploader({
  label,
  name,
  onNameChange,
  file,
  onFileChange,
  onDeleteExisting,
  existingBucket,
  existingPath,
  existingFileName,
  readOnly = false,
}: SignatureUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  // Use our secure private storage hook for existing signature
  const { url: existingUrl, isLoading: isAssetLoading } = useAssetUrl(existingBucket, existingPath);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    // Validate size (max 2MB)
    if (selected.size > 2 * 1024 * 1024) {
      alert("Signature image is too large. Please upload an image smaller than 2MB.");
      return;
    }

    // Validate type
    if (!selected.type.startsWith("image/")) {
      alert("Please upload a valid image file (PNG/JPEG).");
      return;
    }

    onFileChange(selected);
    const previewUrl = URL.createObjectURL(selected);
    setLocalPreview(previewUrl);
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const removeSelectedFile = () => {
    assertOperationalAction("delete", "components/quality-control/SignatureUploader.tsx");
    onFileChange(null);
    if (localPreview) {
      URL.revokeObjectURL(localPreview);
      setLocalPreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeExisting = () => {
    assertOperationalAction("delete", "components/quality-control/SignatureUploader.tsx");
    onDeleteExisting();
  };

  const displayUrl = localPreview || existingUrl;

  return (
    <div className="flex flex-col gap-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
      <div>
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
          {label} Name
        </label>
        {readOnly ? (
          <p className="text-xs font-bold text-[#07182E]">{name || "NOT SPECIFIED"}</p>
        ) : (
          <input
            type="text"
            placeholder={`e.g. Name of ${label}`}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-1 focus:ring-[#FF9F1C] outline-none bg-white text-slate-800"
          />
        )}
      </div>

      <div className="mt-1">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
          {label} Signature
        </label>
        
        <div className="relative w-full h-24 bg-white border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden group shadow-sm">
          {isAssetLoading ? (
            <div className="flex flex-col items-center justify-center text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mb-1 text-slate-300" />
              <span className="text-[9px] font-bold tracking-wider">LOADING...</span>
            </div>
          ) : displayUrl ? (
            <>
              <img
                src={displayUrl}
                alt={`${label} Signature`}
                className="w-full h-full object-contain p-2"
                referrerPolicy="no-referrer"
              />
              {!readOnly && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={triggerUpload}
                    title="Replace Signature"
                    className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-md transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={localPreview ? removeSelectedFile : removeExisting}
                    title="Remove Signature"
                    className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-2">
              <PenTool className="w-5 h-5 text-slate-400 mb-1" />
              <span className="text-[10px] font-bold text-slate-400 tracking-wider">NO SIGNATURE UPLOADED</span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={triggerUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              )}
            </div>
          )}
        </div>

        {!readOnly && (
          <div className="mt-2 flex justify-end">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png, image/jpeg"
              className="hidden"
            />
            {!displayUrl && (
              <button
                type="button"
                onClick={triggerUpload}
                className="px-2.5 py-1.5 border border-slate-200 hover:border-slate-300 hover:bg-white text-slate-600 font-semibold text-[10px] rounded-lg transition-all flex items-center gap-1 shadow-sm cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                Upload Signature Image
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
