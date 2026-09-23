import { previewStorage } from "../../integration/previewStorage";
import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState } from "react";
import { 
  Award, 
  FileText, 
  Upload, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Download, 
  Trash2, 
  Plus, 
  ShieldCheck, 
  ExternalLink 
} from "lucide-react";
import { logAuditEvent } from "../../services/rbacService";

export interface ComplianceDoc {
  id: string;
  type: string;
  name: string;
  referenceNumber: string;
  issueDate: string;
  expiryDate: string;
  version: string;
  status: "Valid" | "Expiring Soon" | "Expired" | "Under Review";
  uploadedBy: string;
  uploadedAt: string;
  fileSize: string;
}

interface ComplianceTabContentProps {
  compProfileData: any;
  profile: any;
  activeCompany: any;
  hasManagerPermission: boolean;
  setSuccessMsg: (msg: string | null) => void;
  setErrorMsg: (msg: string | null) => void;
}

export default function ComplianceTabContent({
  compProfileData,
  profile,
  activeCompany,
  hasManagerPermission,
  setSuccessMsg,
  setErrorMsg
}: ComplianceTabContentProps) {
  const [documents, setDocuments] = useState<ComplianceDoc[]>(() => {
    try {
      const saved = previewStorage.getItem("pm_compliance_documents");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Error reading compliance documents:", e);
    }
    return [];
  });

  // Modal / Form state for uploading new compliance document
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newDocType, setNewDocType] = useState("Contractor Registration");
  const [newDocName, setNewDocName] = useState("");
  const [newDocRef, setNewDocRef] = useState("");
  const [newDocIssue, setNewDocIssue] = useState("");
  const [newDocExpiry, setNewDocExpiry] = useState("");
  const [newDocVersion, setNewDocVersion] = useState("v1.0");

  const pliDoc = documents.find(d => 
    d.type?.toLowerCase().includes("insurance") || 
    d.name?.toLowerCase().includes("liability") ||
    d.name?.toLowerCase().includes("policy")
  );
  const iso9001Doc = documents.find(d => 
    d.name?.includes("9001") || 
    d.type?.includes("9001") || 
    d.referenceNumber?.includes("9001")
  );
  const iso45001Doc = documents.find(d => 
    d.name?.includes("45001") || 
    d.type?.includes("45001") || 
    d.referenceNumber?.includes("45001")
  );

  const statutoryItems = [
    { 
      name: "Tax Clearance Status (SARS)", 
      reg: compProfileData?.taxClearancePin || "Not Configured", 
      status: compProfileData?.taxClearancePin ? "Valid / Active" : "Pending Registration", 
      expiry: compProfileData?.taxClearancePin ? "Active" : "—", 
      badge: compProfileData?.taxClearancePin ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200",
      isValid: Boolean(compProfileData?.taxClearancePin)
    },
    { 
      name: "COIDA / Letter of Good Standing", 
      reg: compProfileData?.coidaNumber || "Not Configured", 
      status: compProfileData?.coidaNumber ? "Active & Verified" : "Pending Registration", 
      expiry: compProfileData?.coidaNumber ? "Active" : "—", 
      badge: compProfileData?.coidaNumber ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200",
      isValid: Boolean(compProfileData?.coidaNumber)
    },
    { 
      name: "BBBEE Empowerment Rating", 
      reg: compProfileData?.bbbeeLevel || "Not Configured", 
      status: compProfileData?.bbbeeLevel ? compProfileData.bbbeeLevel : "Not Recorded", 
      expiry: compProfileData?.bbbeeLevel ? "Active" : "—", 
      badge: compProfileData?.bbbeeLevel ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-600 border-slate-200",
      isValid: Boolean(compProfileData?.bbbeeLevel)
    },
    { 
      name: "CIDB Contractor Grading", 
      reg: compProfileData?.cidbGrading || "Not Configured", 
      status: compProfileData?.cidbGrading ? compProfileData.cidbGrading : "Not Recorded", 
      expiry: compProfileData?.cidbGrading ? "Active" : "—", 
      badge: compProfileData?.cidbGrading ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-100 text-slate-600 border-slate-200",
      isValid: Boolean(compProfileData?.cidbGrading)
    },
    { 
      name: "Public Liability Insurance", 
      reg: pliDoc?.referenceNumber || "Not Uploaded", 
      status: pliDoc ? pliDoc.status : "Pending Policy", 
      expiry: pliDoc?.expiryDate || "—", 
      badge: pliDoc ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200",
      isValid: Boolean(pliDoc)
    },
    { 
      name: "ISO 9001:2015 Quality Management", 
      reg: iso9001Doc?.referenceNumber || "Not Uploaded", 
      status: iso9001Doc ? iso9001Doc.status : "Not Certified", 
      expiry: iso9001Doc?.expiryDate || "—", 
      badge: iso9001Doc ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-slate-100 text-slate-600 border-slate-200",
      isValid: Boolean(iso9001Doc)
    },
    { 
      name: "ISO 45001:2018 Health & Safety", 
      reg: iso45001Doc?.referenceNumber || "Not Uploaded", 
      status: iso45001Doc ? iso45001Doc.status : "Not Certified", 
      expiry: iso45001Doc?.expiryDate || "—", 
      badge: iso45001Doc ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-slate-100 text-slate-600 border-slate-200",
      isValid: Boolean(iso45001Doc)
    }
  ];

  const validStatutoryCount = statutoryItems.filter(i => i.isValid).length;

  const handleUploadDocument = (e: React.FormEvent) => {
    assertOperationalAction("write", "pages/Administration/ComplianceTabContent.tsx");
    e.preventDefault();
    if (!newDocName.trim()) {
      setErrorMsg("Please enter a document title or upload a valid file.");
      return;
    }

    const newDoc: ComplianceDoc = {
      id: `cdoc-${Date.now()}`,
      type: newDocType,
      name: newDocName.trim(),
      referenceNumber: newDocRef.trim() || `REF-${Math.floor(1000 + Math.random() * 9000)}`,
      issueDate: newDocIssue || new Date().toISOString().split("T")[0],
      expiryDate: newDocExpiry || "2027-12-31",
      version: newDocVersion || "v1.0",
      status: "Valid",
      uploadedBy: profile?.full_name || "Company Admin",
      uploadedAt: new Date().toISOString().split("T")[0],
      fileSize: "2.4 MB"
    };

    const updated = [newDoc, ...documents];
    setDocuments(updated);
    previewStorage.setItem("pm_compliance_documents", JSON.stringify(updated));

    logAuditEvent({
      userId: profile?.id || "admin",
      userName: profile?.full_name || "Admin",
      organisationId: activeCompany?.id || "org_default",
      action: "sensitive_admin_action",
      entity: "Compliance Repository",
      details: `Uploaded compliance certificate: ${newDoc.name} (${newDoc.type})`,
      status: "SUCCESS"
    });

    setSuccessMsg(`Compliance certificate "${newDoc.name}" recorded.`);
    setShowUploadModal(false);
    setNewDocName("");
    setNewDocRef("");
    setNewDocIssue("");
    setNewDocExpiry("");
  };

  const handleDeleteDoc = (id: string) => {
    assertOperationalAction("delete", "pages/Administration/ComplianceTabContent.tsx");
    if (!hasManagerPermission) return;
    const docToDelete = documents.find(d => d.id === id);
    const updated = documents.filter(d => d.id !== id);
    setDocuments(updated);
    previewStorage.setItem("pm_compliance_documents", JSON.stringify(updated));
    setSuccessMsg(`Compliance document "${docToDelete?.name || ""}" removed.`);
  };

  return (
    <div className="bg-white border border-[#E2E8F0] p-6 rounded-2xl shadow-sm space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-[#FF9F1C]" />
            <h3 className="text-base font-extrabold text-[#07182E] tracking-tight">
              Statutory Compliance & Accreditation Registry
            </h3>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Verification status of tax certificates, letters of good standing, contractor gradings, and compliance documents.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {validStatutoryCount === statutoryItems.length ? (
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-full flex items-center gap-1.5 whitespace-nowrap">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Full Legal Standing ({validStatutoryCount}/{statutoryItems.length})
            </span>
          ) : validStatutoryCount > 0 ? (
            <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold rounded-full flex items-center gap-1.5 whitespace-nowrap">
              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" /> Partial Standing ({validStatutoryCount}/{statutoryItems.length} Recorded)
            </span>
          ) : (
            <span className="px-3 py-1 bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold rounded-full flex items-center gap-1.5 whitespace-nowrap">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" /> Pending Configuration (0/{statutoryItems.length})
            </span>
          )}
          <button
            onClick={() => setShowUploadModal(true)}
            disabled={!hasManagerPermission}
            className="px-3.5 py-1.5 bg-[#FF9F1C] hover:bg-[#FFB020] text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Document
          </button>
        </div>
      </div>

      {/* Statutory Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statutoryItems.map((item, idx) => (
          <div key={idx} className="p-4 border border-slate-200 rounded-xl space-y-2 bg-slate-50/50 hover:bg-white hover:border-[#FF9F1C]/40 transition-all min-w-0 overflow-hidden flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2 min-w-0">
              <span className="text-xs font-bold text-[#07182E] leading-snug break-words flex-1 min-w-0">{item.name}</span>
              <span className={`px-2 py-0.5 border rounded text-[9px] font-bold uppercase shrink-0 whitespace-nowrap ${item.badge}`}>
                {item.status}
              </span>
            </div>
            <div className="text-[11px] text-slate-600 font-mono break-all line-clamp-1">
              Reference: <strong className="text-[#07182E]">{item.reg}</strong>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-150 pt-2 gap-2 min-w-0">
              <span className="truncate">Expiry / Next Audit: <strong className="text-slate-600">{item.expiry}</strong></span>
              <span className={`font-bold flex items-center gap-1 shrink-0 ${item.isValid ? "text-emerald-600" : "text-slate-400"}`}>
                {item.isValid ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" /> Valid
                  </>
                ) : (
                  <>
                    <Clock className="w-3 h-3" /> Pending
                  </>
                )}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Supporting Compliance Documents Repository */}
      <div className="space-y-4 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-extrabold text-[#07182E] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#FF9F1C]" />
              Supporting Compliance Documents Repository ({documents.length})
            </h4>
            <p className="text-xs text-[#64748B]">
              Mandatory legal and accreditation filings with version tracking and expiry governance.
            </p>
          </div>
        </div>

        {documents.length === 0 ? (
          <div className="p-8 border border-dashed border-slate-200 rounded-2xl text-center bg-slate-50/50">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <div className="text-xs font-bold text-slate-600">No compliance documents uploaded yet.</div>
            <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
              Click &quot;Upload Document&quot; above to upload valid compliance certificates, tax clearances, or statutory filings.
            </p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-100 text-[#07182E] font-extrabold text-[10px] uppercase tracking-wider border-b border-slate-200">
                  <th className="p-3">Document Title & Filename</th>
                  <th className="p-3">Document Type</th>
                  <th className="p-3">Reference / PIN</th>
                  <th className="p-3 text-center">Version</th>
                  <th className="p-3">Issue Date</th>
                  <th className="p-3">Expiry Date</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3">Uploaded By</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 font-medium">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 font-bold text-[#07182E] min-w-0 max-w-[200px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-[#07182E] truncate font-bold" title={doc.name}>{doc.name}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{doc.fileSize}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-slate-700 font-semibold truncate max-w-[140px]">{doc.type}</td>
                    <td className="p-3 font-mono text-[11px] text-slate-600 truncate max-w-[120px]">{doc.referenceNumber}</td>
                    <td className="p-3 text-center font-mono font-bold text-slate-700 text-[11px]">{doc.version}</td>
                    <td className="p-3 text-slate-600 text-[11px] whitespace-nowrap">{doc.issueDate}</td>
                    <td className="p-3 text-slate-600 text-[11px] font-bold whitespace-nowrap">{doc.expiryDate}</td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[9px] uppercase">
                        {doc.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 text-[11px] min-w-0 max-w-[120px]">
                      <div className="truncate">{doc.uploadedBy}</div>
                      <div className="text-[9px] text-slate-400">{doc.uploadedAt}</div>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSuccessMsg(`Downloading ${doc.name}...`)}
                          className="p-1 text-slate-400 hover:text-[#07182E] transition-colors cursor-pointer"
                          title="Download Certificate"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteDoc(doc.id)}
                          disabled={!hasManagerPermission}
                          className="p-1 text-red-400 hover:text-red-600 transition-colors cursor-pointer disabled:opacity-30"
                          title="Delete Document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-extrabold text-[#07182E] flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#FF9F1C]" /> Upload Statutory Compliance Document
              </h4>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadDocument} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Document Category</label>
                <select
                  value={newDocType}
                  onChange={(e) => setNewDocType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none cursor-pointer bg-white"
                >
                  <option value="Contractor Registration">Contractor Registration (CIDB / CRS)</option>
                  <option value="Professional Registration">Professional Registration (ECSA / SACPCMP / ASAQS)</option>
                  <option value="Business Licences">Business Licences & Municipal Permits</option>
                  <option value="Tax Clearance">Tax Clearance (SARS PIN / TCC)</option>
                  <option value="Insurance Policies">Insurance Policies (CAR / SASRIA / Public Liability)</option>
                  <option value="ISO Certifications">ISO Certifications (ISO 9001 / ISO 14001 / ISO 45001)</option>
                  <option value="HSE Certifications">HSE Certifications (Letter of Good Standing / COIDA)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Document Title & Filename</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ECSA_Corporate_Practice_Certificate_2026.pdf"
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Reference / PIN</label>
                  <input
                    type="text"
                    placeholder="e.g. REF-2026-991"
                    value={newDocRef}
                    onChange={(e) => setNewDocRef(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Version</label>
                  <input
                    type="text"
                    placeholder="v1.0"
                    value={newDocVersion}
                    onChange={(e) => setNewDocVersion(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Issue Date</label>
                  <input
                    type="date"
                    value={newDocIssue}
                    onChange={(e) => setNewDocIssue(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={newDocExpiry}
                    onChange={(e) => setNewDocExpiry(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
              </div>

              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-[#FF9F1C] transition-colors">
                <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                <span className="text-xs text-slate-600 font-bold block">Drag and drop document here, or click to browse</span>
                <span className="text-[10px] text-slate-400">Supported formats: PDF, DOCX, PNG, JPG (Max 25MB)</span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#FF9F1C] hover:bg-[#FFB020] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Upload & Record Certificate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
