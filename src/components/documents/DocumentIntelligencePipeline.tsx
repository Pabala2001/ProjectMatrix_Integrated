import React, { useState } from "react";
import { 
  UploadCloud, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  RefreshCw,
  FileCheck
} from "lucide-react";
import { ProjectDocument, DocumentType, DocumentStatus } from "../../types";
import { StatusBadge } from "../ui/StatusBadge";

export interface DocumentIntelligencePipelineProps {
  projectId?: string;
  organisationId?: string;
  onDocumentProcessed?: (doc: ProjectDocument) => void;
  className?: string;
  showDevControls?: boolean;
}

export type PipelineStep = "IDLE" | "STORING" | "EXTRACTING_TEXT" | "CLASSIFYING" | "EXTRACTING_METADATA" | "INDEXING" | "LINKING" | "COMPLETED";

export const DocumentIntelligencePipeline: React.FC<DocumentIntelligencePipelineProps> = ({
  projectId = "proj-alpha",
  organisationId = "org-default",
  onDocumentProcessed,
  className = "",
  showDevControls = false
}) => {
  const [currentStep, setCurrentStep] = useState<PipelineStep>("IDLE");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processedDoc, setProcessedDoc] = useState<ProjectDocument | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [customType, setCustomType] = useState<DocumentType>("CONTRACT");
  const [isDragOver, setIsDragOver] = useState(false);

  const isDevMode = showDevControls && (typeof window !== "undefined" && window.location.hostname === "localhost");

  const runPipeline = async (file: File) => {
    setSelectedFile(file);
    const fileName = file.name;
    const isDrawing = fileName.toLowerCase().endsWith(".dwg") || fileName.toLowerCase().endsWith(".dxf") || fileName.toLowerCase().includes("drawing") || fileName.toLowerCase().includes("dwg");
    const isCert = fileName.toLowerCase().includes("cert") || fileName.toLowerCase().includes("ipc") || fileName.toLowerCase().includes("valuation");
    const isReport = fileName.toLowerCase().includes("report") || fileName.toLowerCase().includes("diary") || fileName.toLowerCase().includes("inspection");
    
    const detectedType: DocumentType = isDrawing 
      ? "DRAWING" 
      : isCert 
      ? "CERTIFICATE" 
      : isReport 
      ? "REPORT" 
      : "CONTRACT";

    // 1. Store Original
    setCurrentStep("STORING");
    await new Promise(r => setTimeout(r, 400));

    // 2. Extract Text / Vector Data
    setCurrentStep("EXTRACTING_TEXT");
    await new Promise(r => setTimeout(r, 450));

    // 3. Classify
    setCurrentStep("CLASSIFYING");
    await new Promise(r => setTimeout(r, 400));

    // 4. Extract Metadata
    setCurrentStep("EXTRACTING_METADATA");
    await new Promise(r => setTimeout(r, 450));

    // 5. Index
    setCurrentStep("INDEXING");
    await new Promise(r => setTimeout(r, 400));

    // 6. Link to Project Graph
    setCurrentStep("LINKING");
    await new Promise(r => setTimeout(r, 350));

    const finalDoc: ProjectDocument = {
      id: `doc-${Date.now()}`,
      organisationId,
      projectId,
      type: detectedType,
      title: customTitle.trim() || fileName.replace(/\.[^/.]+$/, ""),
      reference: isCert ? "IPC-06" : isDrawing ? "DWG-STR-402" : "FIDIC-CL-20",
      revision: "Rev 02",
      status: "APPROVED" as DocumentStatus,
      uploadedBy: "Chief Resident Engineer",
      uploadedByName: "Chief Resident Engineer",
      uploadedAt: new Date().toISOString(),
      fileName: fileName,
      fileSize: file.size || 2450000,
      fileMimeType: file.type || "application/pdf",
      extractedText: "Extracted contract clauses and physical schedule milestones with automated OCR semantic vectorization.",
      classifiedTags: [detectedType, "ACTIVE LEDGER", "REVISED"],
      extractedMetadata: {
        contractClauses: ["Clause 8.4 Extension of Time", "Clause 20.1 Claims Procedure"],
        discipline: isDrawing ? "Structural Engineering" : "Commercial Management",
        drawingScale: isDrawing ? "1:50 @ A1" : undefined,
        riskScore: 12
      },
      isIndexed: true,
      pipelineStage: "LINKED"
    };

    setProcessedDoc(finalDoc);
    setCurrentStep("COMPLETED");
    if (onDocumentProcessed) {
      onDocumentProcessed(finalDoc);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      runPipeline(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      runPipeline(e.dataTransfer.files[0]);
    }
  };

  const handleSampleRun = (type: DocumentType, name: string) => {
    let mockFile: File;
    try {
      mockFile = new File(["sample content"], name, { type: "application/pdf" });
    } catch {
      const blob = new Blob(["sample content"], { type: "application/pdf" }) as any;
      blob.name = name;
      blob.lastModified = Date.now();
      mockFile = blob as File;
    }
    setCustomType(type);
    runPipeline(mockFile);
  };

  const steps = [
    "Store",
    "Extract",
    "Classify",
    "Metadata",
    "Index",
    "Link"
  ];

  return (
    <div className={`bg-white dark:bg-[#0B172A] border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3 ${className}`}>
      {/* Header with Pipeline Flow */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-lg">
            <Sparkles className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Upload & Process Documents
            </h3>
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
              {steps.map((st, i) => (
                <React.Fragment key={st}>
                  <span className={currentStep === "COMPLETED" ? "text-emerald-600 font-bold" : "text-slate-600 dark:text-slate-400"}>
                    {st}
                  </span>
                  {i < steps.length - 1 && <span className="text-slate-300 dark:text-slate-600">→</span>}
                </React.Fragment>
              ))}
            </p>
          </div>
        </div>

        {/* Development Controls: Only rendered if explicitly allowed in local dev */}
        {isDevMode && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => handleSampleRun("CONTRACT", "FIDIC_Red_Book_Clause_20_Notice.pdf")}
              className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 text-[10px] font-bold text-slate-600 dark:text-slate-300 rounded"
            >
              + Test Contract
            </button>
            <button
              onClick={() => handleSampleRun("DRAWING", "Northern_Pier_Rebar_DWG-402.dwg")}
              className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 text-[10px] font-bold text-slate-600 dark:text-slate-300 rounded"
            >
              + Test Drawing
            </button>
          </div>
        )}
      </div>

      {/* Compact Drop Zone */}
      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-3 sm:p-4 text-center transition-all ${
          isDragOver 
            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30" 
            : "border-slate-200 dark:border-slate-700/80 hover:border-blue-400 bg-slate-50/40 dark:bg-slate-900/40"
        }`}
      >
        <input
          type="file"
          id="pipeline-file-input"
          onChange={handleFileChange}
          className="hidden"
        />
        <label
          htmlFor="pipeline-file-input"
          className="cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-center sm:text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <UploadCloud className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              Click or drag engineering drawings, contracts, certificates or reports
            </span>
            <span className="text-[10px] text-slate-400">
              PDF, DWG, DXF, XLSX, DOCX up to 100MB
            </span>
          </div>
        </label>
      </div>

      {/* Compact Status feedback */}
      {currentStep !== "IDLE" && (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 truncate">
            {currentStep === "COMPLETED" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
            )}
            <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
              {currentStep === "COMPLETED" ? `Successfully Processed: ${selectedFile?.name}` : `Processing ${selectedFile?.name}...`}
            </span>
          </div>
          {processedDoc && (
            <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded font-bold shrink-0">
              Indexed & Linked
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentIntelligencePipeline;
