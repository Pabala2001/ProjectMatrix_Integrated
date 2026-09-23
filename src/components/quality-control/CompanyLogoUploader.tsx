import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useRef, useState } from "react";
import { Upload, X, RefreshCw } from "lucide-react";
import { useAssetUrl } from "../../hooks/useAssetUrl";

interface CompanyLogoUploaderProps {
  logoFile: File | null;
  onLogoFileChange: (file: File | null) => void;
  onLogoDeleteExisting?: () => void;
  existingBucket?: string | null;
  existingPath?: string | null;
  logoBase64?: string; // Legacy fallback
  onLogoChange?: (base64?: string) => void; // Legacy fallback
  companyName: string;
  onCompanyNameChange: (name: string) => void;
  readOnly?: boolean;
}

export default function CompanyLogoUploader({
  logoFile,
  onLogoFileChange,
  onLogoDeleteExisting,
  existingBucket,
  existingPath,
  logoBase64,
  onLogoChange,
  companyName,
  onCompanyNameChange,
  readOnly = false,
}: CompanyLogoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  // Use private storage loader
  const { url: existingUrl, isLoading: isAssetLoading } = useAssetUrl(existingBucket, existingPath);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert("Image is too large. Please upload an image smaller than 2MB.");
      return;
    }

    if (onLogoFileChange) {
      onLogoFileChange(file);
      const previewUrl = URL.createObjectURL(file);
      setLocalPreview(previewUrl);
    } else if (onLogoChange) {
      // Legacy base64 fallback
      const reader = new FileReader();
      reader.onloadend = () => {
        onLogoChange(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const removeLogo = () => {
    assertOperationalAction("delete", "components/quality-control/CompanyLogoUploader.tsx");
    if (onLogoFileChange) {
      onLogoFileChange(null);
      if (localPreview) {
        URL.revokeObjectURL(localPreview);
        setLocalPreview(null);
      }
    }
    if (onLogoDeleteExisting) {
      onLogoDeleteExisting();
    }
    if (onLogoChange) {
      onLogoChange(undefined);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const displayUrl = localPreview || existingUrl || logoBase64;

  return (
    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
      <div className="flex items-center gap-4 w-full md:w-auto">
        {/* Logo Frame */}
        <div className="relative w-24 h-16 bg-white border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden shrink-0 group shadow-sm">
          {isAssetLoading ? (
            <div className="flex flex-col items-center justify-center text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin mb-0.5 text-slate-300" />
              <span className="text-[8px] font-bold tracking-wider">LOADING...</span>
            </div>
          ) : displayUrl ? (
            <>
              <img
                src={displayUrl}
                alt="Company Logo"
                className="w-full h-full object-contain p-1"
                referrerPolicy="no-referrer"
              />
              {!readOnly && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={triggerUpload}
                    title="Replace Logo"
                    className="p-1 bg-white hover:bg-slate-100 text-slate-700 rounded-md transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={removeLogo}
                    title="Remove Logo"
                    className="p-1 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-1">
              <Upload className="w-4 h-4 text-slate-400 mb-0.5" />
              <span className="text-[9px] font-bold text-slate-400">NO LOGO</span>
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

        {/* Company Identity Details */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
            Contractor Company Name
          </label>
          {readOnly ? (
            <p className="text-sm font-bold text-[#07182E]">{companyName || "NOT SPECIFIED"}</p>
          ) : (
            <input
              type="text"
              placeholder="e.g. Apex Civil Engineering Pty Ltd"
              value={companyName}
              onChange={(e) => onCompanyNameChange(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-1 focus:ring-[#FF9F1C] outline-none bg-white text-slate-800"
            />
          )}
        </div>
      </div>

      {!readOnly && (
        <div className="hidden md:block">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          {!displayUrl && (
            <button
              type="button"
              onClick={triggerUpload}
              className="px-3 py-1.5 border border-slate-200 hover:border-slate-300 hover:bg-white text-slate-600 font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Custom Logo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
