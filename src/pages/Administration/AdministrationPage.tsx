import { saveCompanyDisplay } from "../../integration/companyDisplay";
import { previewStorage } from "../../integration/previewStorage";
import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { ROLE_OPTIONS, LEGACY_ROLE_LABELS, isActiveRole, getRoleLabel } from "../../config/roles";
import { 
  Building2, 
  Plus, 
  Trash2, 
  UserPlus, 
  Briefcase, 
  Mail, 
  Phone, 
  Shield, 
  MapPin, 
  DollarSign, 
  ArrowRight, 
  CheckCircle, 
  Settings2,
  Users,
  Edit,
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Search,
  Filter,
  Lock,
  Key,
  Clock,
  Award,
  Globe,
  ShieldCheck,
  Download,
  RefreshCw,
  Eye,
  UserCheck,
  UserX,
  Layers,
  Sparkles,
  Check,
  Database,
  Sliders,
  Activity,
  ShieldAlert,
  Save,
  FileSpreadsheet,
  Copy,
  Send
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";
import { CONTRACT_FRAMEWORKS } from "../../config/contracts";
import { SUPPORTED_CURRENCIES, SupportedCurrency, getCurrencyInfo } from "../../config/currencies";
import { getAllRegionConfigs, getRegionConfig, DEFAULT_COUNTRY_CODE } from "../../config/countries";
import { getRegionalPack } from "../../config/regionalPacks";
import RolesAndPermissionsTab from "./RolesAndPermissionsTab";
import ComplianceTabContent from "./ComplianceTabContent";
import { getAuditLogs, logAuditEvent, evaluateAccess } from "../../services/rbacService";
import { ProjectService } from "../../services/projectService";
import { BulkInviteCsvModal } from "../../components/administration/BulkInviteCsvModal";
import ProjectsOperationalTable from "../../components/dashboard/ProjectsOperationalTable";
import { 
  updateStoredTenant, 
  addStoredCompanyMember, 
  updateStoredCompanyMember, 
  deleteStoredCompanyMember,
  getStoredCompanyMembers,
  isBlockedOrMockUser
} from "../../services/tenantService";
import {
  createEmployeeInvitation,
  resendInvitation,
  getInvitationsByTenant
} from "../../services/invitationService";

// Standard ERP Modules for configurable permissions
const SYSTEM_MODULES = [
  { key: "dashboard", label: "Executive Dashboard" },
  { key: "programme", label: "Programme & Schedule" },
  { key: "boq", label: "Bill of Quantities (BoQ)" },
  { key: "site_diaries", label: "Site Operations & Diaries" },
  { key: "contracts", label: "Contracts & Governance" },
  { key: "finance", label: "Project Finance & Accounts" },
  { key: "procurement", label: "Procurement & Supply" },
  { key: "quality", label: "Quality & HSEQ Hub" },
  { key: "documents", label: "Document Controller" },
  { key: "administration", label: "System Administration" }
];

export default function AdministrationPage() {
  const outletCtx = useOutletContext<any>();
  const { 
    profile = {}, 
    activeCompany = null, 
    activeProject = null,
    allProjects = [], 
    allCompanies = [],
    onCompanyChange = () => {},
    companyPersonnel = [], 
    projectAssignments = [],
    onRefetchTenant = async () => {},
    loadCompanyMembers = async () => [],
    isActionLoading = false,
    setIsActionLoading = () => {},
    setErrorMsg = () => {},
    setSuccessMsg = () => {},
    onProjectChange = () => {}
  } = outletCtx || {};

  const { 
    complianceFramework,
    countryCode: regionalCountryCode,
    currencyCode: regionalCurrencyCode,
    setCountryCode: setRegionalCountryCode,
    setCurrencyCode: setRegionalCurrencyCode
  } = useRegionalSettings();

  // Active logged-in member & RBAC permissions evaluation
  const activeMember = (companyPersonnel || []).find((p: any) => p.profile_id === profile?.id);
  const userRoleLower = (profile?.role || "").toLowerCase();
  const isCompanyAdmin = 
    activeMember?.is_company_admin === true || 
    activeMember?.is_admin === true ||
    userRoleLower.includes("admin") ||
    userRoleLower.includes("director") ||
    userRoleLower.includes("manager") ||
    userRoleLower.includes("owner") ||
    userRoleLower.includes("officer") ||
    !activeMember; // In preview/demo workspace, allow configuration
  const hasManagerPermission = isCompanyAdmin;

  // Project Management RBAC permissions
  const canCreateProject = useMemo(() => {
    return isCompanyAdmin || evaluateAccess({
      user: { id: profile?.id || "anonymous", role: profile?.role || "viewer", isCompanyAdmin },
      organisationId: activeCompany?.id || profile?.company_id || "default",
      requestedAction: { module: "administration", permission: "create" }
    }).granted;
  }, [isCompanyAdmin, profile?.id, profile?.role, activeCompany?.id, profile?.company_id]);

  const canEditProject = useMemo(() => {
    return isCompanyAdmin || evaluateAccess({
      user: { id: profile?.id || "anonymous", role: profile?.role || "viewer", isCompanyAdmin },
      organisationId: activeCompany?.id || profile?.company_id || "default",
      requestedAction: { module: "administration", permission: "edit" }
    }).granted;
  }, [isCompanyAdmin, profile?.id, profile?.role, activeCompany?.id, profile?.company_id]);

  const canDeleteProject = useMemo(() => {
    return isCompanyAdmin || evaluateAccess({
      user: { id: profile?.id || "anonymous", role: profile?.role || "viewer", isCompanyAdmin },
      organisationId: activeCompany?.id || profile?.company_id || "default",
      requestedAction: { module: "administration", permission: "admin" }
    }).granted;
  }, [isCompanyAdmin, profile?.id, profile?.role, activeCompany?.id, profile?.company_id]);

  // Active Tab: 10 Core Administration Tabs
  const [activeTab, setActiveTab] = useState<
    "overview" | 
    "company" | 
    "personnel" | 
    "roles" | 
    "departments" | 
    "projects" | 
    "assignments" | 
    "compliance" | 
    "security" | 
    "audit"
  >("overview");

  // ==========================================
  // TAB 1: COMPANY PROFILE STATE & HANDLERS
  // ==========================================
  const [compProfileData, setCompProfileData] = useState(() => {
    const initialCountry = regionalCountryCode || DEFAULT_COUNTRY_CODE;
    const rc = getRegionConfig(initialCountry);
    return {
      name: "",
      tradingName: "",
      registrationNumber: "",
      taxId: "",
      vatNumber: "",
      countryCode: initialCountry,
      country: rc?.countryName || "South Africa",
      currency: (regionalCurrencyCode || rc?.currency || "ZAR") as SupportedCurrency,
      taxJurisdiction: `${rc?.countryName || "South Africa"} (${rc?.publicAuthorities?.[0] || "SARS"})`,
      email: "",
      phone: "",
      website: "",
      supportEmail: "",
      physicalAddress: "",
      postalAddress: "",
      samePostalAddress: true,
      logoUrl: "",
      establishedDate: "",
      coidaNumber: "",
      taxClearancePin: "",
      bbbeeLevel: "",
      cidbGrading: ""
    };
  });

  // Sync activeCompany and regional settings into compProfileData
  useEffect(() => {
    if (activeCompany) {
      const addr = typeof activeCompany.registered_address === "object" 
        ? `${activeCompany.registered_address.address_line_1 || ""}${activeCompany.registered_address.city ? ", " + activeCompany.registered_address.city : ""}${activeCompany.registered_address.country ? ", " + activeCompany.registered_address.country : ""}` 
        : activeCompany.address || "";

      const cCode = activeCompany.countryCode || activeCompany.registered_address?.country_code || regionalCountryCode || DEFAULT_COUNTRY_CODE;
      const rc = getRegionConfig(cCode);
      const cCurr = activeCompany.currency || activeCompany.currency_code || regionalCurrencyCode || rc?.currency || "ZAR";

      setCompProfileData(prev => ({
        ...prev,
        name: activeCompany.legal_name || activeCompany.name || prev.name || "",
        tradingName: activeCompany.trading_name || prev.tradingName || activeCompany.name || "",
        registrationNumber: activeCompany.registration_number || prev.registrationNumber || activeCompany.id || "",
        taxId: activeCompany.tax_id || activeCompany.tax_number || activeCompany.vat_number || prev.taxId || "",
        vatNumber: activeCompany.vat_number || activeCompany.tax_number || prev.vatNumber || "",
        countryCode: cCode,
        country: rc?.countryName || activeCompany.registered_address?.country || prev.country,
        currency: cCurr as SupportedCurrency,
        email: activeCompany.email || prev.email || "",
        phone: activeCompany.phone || prev.phone || "",
        website: activeCompany.website || prev.website || "",
        physicalAddress: addr,
        postalAddress: activeCompany.postal_address || prev.postalAddress || addr || "",
        logoUrl: activeCompany.logo_url || prev.logoUrl || "",
      }));
    }
  }, [activeCompany, regionalCountryCode, regionalCurrencyCode]);

  const handleSaveCompanyProfile = async (e: React.FormEvent) => {
    assertOperationalAction("write", "pages/Administration/AdministrationPage.tsx");
    e.preventDefault();
    if (!hasManagerPermission) {
      setErrorMsg("Access Denied: Only Company Administrators can modify the corporate profile.");
      return;
    }
    if (!activeCompany?.id) {
      setErrorMsg("No active company found to update.");
      return;
    }

    setIsActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = {
        name: compProfileData.name,
        trading_name: compProfileData.tradingName,
        registration_number: compProfileData.registrationNumber,
        vat_number: compProfileData.vatNumber,
        address: compProfileData.physicalAddress,
        postal_address: compProfileData.samePostalAddress ? compProfileData.physicalAddress : compProfileData.postalAddress,
        email: compProfileData.email,
        phone: compProfileData.phone,
        website: compProfileData.website,
        logo_url: compProfileData.logoUrl,
        countryCode: compProfileData.countryCode,
        currency: compProfileData.currency,
        updated_at: new Date().toISOString()
      };

      const updatedComp = {
        ...activeCompany,
        ...payload,
        name: payload.name,
        legal_name: payload.name,
        trading_name: payload.trading_name,
        tax_number: payload.vat_number,
        countryCode: compProfileData.countryCode,
        currency: compProfileData.currency
      };

      // 1. Sync global regional settings
      if (compProfileData.countryCode) {
        await setRegionalCountryCode(compProfileData.countryCode, false);
      }
      if (compProfileData.currency) {
        await setRegionalCurrencyCode(compProfileData.currency as SupportedCurrency);
      }

      // 1. Update stored tenant in tenantService
      updateStoredTenant(activeCompany.id, {
        legal_name: payload.name,
        trading_name: payload.trading_name,
        registration_number: payload.registration_number,
        tax_number: payload.vat_number,
        vat_number: payload.vat_number,
        email: payload.email,
        phone: payload.phone,
        website: payload.website,
        logo_url: payload.logo_url,
        registered_address: {
          address_line_1: payload.address,
          city: activeCompany.registered_address?.city || "Johannesburg",
          state_province_region: activeCompany.registered_address?.state_province_region || "Gauteng",
          postal_code: activeCompany.registered_address?.postal_code || "2000",
          country: activeCompany.registered_address?.country || "South Africa"
        }
      });

      // 2. Persist to localStorage for immediate UI synchronization
      previewStorage.setItem(`pm_company_profile_${activeCompany.id}`, JSON.stringify(updatedComp));
      if (activeCompany.tenant_id) {
        previewStorage.setItem(`pm_company_profile_${activeCompany.tenant_id}`, JSON.stringify(updatedComp));
      }

      // Persist only columns present in the primary company schema.
      const { error: companyUpdateError } = await supabase.from("companies").update({
        name: payload.name, registration_number: payload.registration_number,
        vat_number: payload.vat_number, address: payload.address,
        email: payload.email, phone: payload.phone, updated_at: payload.updated_at
      }).eq("id", activeCompany.id);
      if (companyUpdateError) throw companyUpdateError;
      saveCompanyDisplay(profile.id,activeCompany.id,payload);

      // 4. Update parent company state if onCompanyChange is available
      if (onCompanyChange) {
        onCompanyChange(updatedComp);
      }

      // 5. Log audit event
      logAuditEvent({
        userId: profile?.id || "system",
        userName: profile?.full_name || "Administrator",
        organisationId: activeCompany.id,
        action: "sensitive_admin_action",
        entity: "Company",
        details: `Updated corporate profile details for "${payload.name}".`,
        status: "SUCCESS"
      });

      setSuccessMsg("Core company details saved. Additional display settings are saved in this browser until backend integration.");
      await onRefetchTenant();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to update company profile.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // ==========================================
  // TAB 2: USERS & PERSONNEL STATE & HANDLERS
  // ==========================================
  const [persName, setPersName] = useState("");
  const [persEmail, setPersEmail] = useState("");
  const [persPhone, setPersPhone] = useState("");
  const [persDesignation, setPersDesignation] = useState("Senior Engineer");
  const [persIsCompanyAdmin, setPersIsCompanyAdmin] = useState(false);
  const [persDepartment, setPersDepartment] = useState("Engineering");
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState("all");
  const [isBulkInviteOpen, setIsBulkInviteOpen] = useState(false);
  const [lastInvitedLink, setLastInvitedLink] = useState<{ name: string; email: string; url: string } | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  // Editing personnel state
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingPhone, setEditingPhone] = useState("");
  const [editingDesignation, setEditingDesignation] = useState("Senior Engineer");
  const [editingIsCompanyAdmin, setEditingIsCompanyAdmin] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState("Engineering");
  const [editingStatus, setEditingStatus] = useState("Active");
  const [editingProjectIds, setEditingProjectIds] = useState<string[]>([]);

  const handleAddPersonnel = async (e: React.FormEvent) => {
    assertOperationalAction("create", "pages/Administration/AdministrationPage.tsx");
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsActionLoading(true);

    if (!hasManagerPermission) {
      setErrorMsg("Access Denied: Your assigned role does not have permission to add company personnel.");
      setIsActionLoading(false);
      return;
    }

    if (!persName.trim() || !persEmail.trim()) {
      setErrorMsg("Full name and email are required.");
      setIsActionLoading(false);
      return;
    }

    const companyId = activeCompany?.id || profile?.company_id || "comp_demo_matrix_01";
    const tenantId = activeCompany?.tenant_id || companyId;
    const companyName = activeCompany?.name || activeCompany?.legal_name || "Company";

    if (LEGACY_ROLE_LABELS.includes(persDesignation as any)) {
      setErrorMsg(`The selected role "${persDesignation}" has been retired/legacy and cannot be selected for new personnel.`);
      setIsActionLoading(false);
      return;
    }
    if (!isActiveRole(persDesignation)) {
      setErrorMsg(`The selected role "${persDesignation}" is not a valid active role.`);
      setIsActionLoading(false);
      return;
    }

    try {
      const nameParts = persName.trim().split(" ");
      const firstName = nameParts[0] || persName.trim();
      const lastName = nameParts.slice(1).join(" ") || "";

      // 1. Create employee invitation with 72h secure token
      const invitation = await createEmployeeInvitation({
        tenant_id: tenantId,
        company_id: companyId,
        company_name: companyName,
        first_name: firstName,
        last_name: lastName,
        email: persEmail.trim().toLowerCase(),
        designation: persDesignation,
        department: persDepartment,
        phone: persPhone.trim() || undefined,
        system_role_id: persDesignation.toLowerCase().replace(/[^a-z0-9]/g, "_"),
        system_role_name: persDesignation,
        project_access_type: "selected",
        project_assignments: [],
        created_by_id: profile?.id || "usr_system_admin",
        created_by_name: profile?.full_name || "System Administrator"
      });

      // 2. Add to company directory with status "pending" (Invitation Pending)
      const newMemberId = `cm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newMember = {
        id: newMemberId,
        company_id: companyId,
        organisation_id: companyId,
        profile_id: newMemberId,
        full_name: persName.trim(),
        email: persEmail.trim().toLowerCase(),
        phone: persPhone.trim() || null,
        designation: persDesignation,
        role: persDesignation,
        department: persDepartment,
        is_company_admin: persIsCompanyAdmin,
        is_active: true,
        status: "pending",
        invitation_id: invitation.id,
        secure_token: invitation.secure_token,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      addStoredCompanyMember(companyId, newMember);

      // 3. Attempt cloud persistence
      try {
        await supabase.from("company_members").insert({
          id: newMemberId,
          company_id: companyId,
          profile_id: newMemberId,
          full_name: persName.trim(),
          email: persEmail.trim().toLowerCase(),
          phone: persPhone.trim() || null,
          designation: persDesignation,
          department: persDepartment,
          is_company_admin: persIsCompanyAdmin,
          is_active: true,
          status: "pending"
        });
      } catch (insertErr) {
        console.warn("Supabase direct insert fallback:", insertErr);
      }

      // 4. Record audit event
      logAuditEvent({
        userId: profile?.id || "system",
        userName: profile?.full_name || "Administrator",
        organisationId: companyId,
        action: "user_status_changed",
        entity: "CompanyMember",
        details: `Dispatched invitation link to "${persName}" (${persEmail}, ${persDesignation}, ${persDepartment}). User status: Invitation Pending.`,
        status: "SUCCESS"
      });

      const inviteUrl = `${window.location.origin}${window.location.pathname}#/join?token=${invitation.secure_token}`;
      setLastInvitedLink({
        name: persName.trim(),
        email: persEmail.trim(),
        url: inviteUrl
      });

      setSuccessMsg(`Secure invitation sent to "${persEmail}". User remains "Invitation Pending" until registered.`);
      setPersName("");
      setPersEmail("");
      setPersPhone("");
      setPersDepartment("Engineering");
      
      if (loadCompanyMembers && companyId) {
        await loadCompanyMembers(companyId);
      }
      await onRefetchTenant();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to register personnel invitation.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResendInvite = async (user: any) => {
    try {
      const adminId = profile?.id || "usr_system_admin";
      const adminName = profile?.full_name || "System Administrator";

      let token = user.secure_token;
      if (user.invitation_id) {
        const resent = await resendInvitation(user.invitation_id, adminId, adminName);
        token = resent.secure_token;
      }
      
      const inviteUrl = token 
        ? `${window.location.origin}${window.location.pathname}#/join?token=${token}`
        : `${window.location.origin}${window.location.pathname}#/register?email=${encodeURIComponent(user.email)}`;

      await navigator.clipboard.writeText(inviteUrl);
      setCopiedInviteId(user.id);
      setSuccessMsg(`Secure invitation link refreshed for ${user.email} and copied to clipboard!`);
      setTimeout(() => setCopiedInviteId(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to resend invitation.");
    }
  };

  const handleSendEmailInvite = (email: string, name: string, url: string) => {
    const companyName = activeCompany?.name || activeCompany?.legal_name || "our company";
    const subject = encodeURIComponent(`Invitation to join ${companyName} ERP Workspace`);
    const body = encodeURIComponent(
      `Hello ${name || "there"},\n\nYou have been invited by ${profile?.full_name || "the System Administrator"} to join ${companyName} on the Construction ERP platform.\n\nPlease click the secure link below (valid for 72 hours) to complete your account registration and access your project workspace:\n\n${url}\n\nKind regards,\n${companyName} Administration`
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank");
    setSuccessMsg(`Email client opened to send invitation to ${email}.`);
  };

  const handleCopyUserInviteLink = (user: any) => {
    const token = user.secure_token;
    const inviteUrl = token 
      ? `${window.location.origin}${window.location.pathname}#/join?token=${token}`
      : `${window.location.origin}${window.location.pathname}#/register?email=${encodeURIComponent(user.email)}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedInviteId(user.id);
    setSuccessMsg(`Invitation link for ${user.full_name || user.email} copied to clipboard.`);
    setTimeout(() => setCopiedInviteId(null), 3000);
  };

  const handleEditPersonnel = (p: any) => {
    setEditingMember(p);
    setEditingName(p.full_name || "");
    setEditingPhone(p.phone || "");
    setEditingDesignation(p.designation || "Senior Engineer");
    setEditingIsCompanyAdmin(!!p.is_company_admin);
    setEditingDepartment(p.department || "Engineering");
    setEditingStatus(p.status ? (p.status === "pending" ? "Invited" : p.status.charAt(0).toUpperCase() + p.status.slice(1)) : (p.is_active ? "Active" : "Suspended"));

    const memberAssignments = (projectAssignments || []).filter((a: any) => (a.company_member_id === p.id || a.profile_id === p.id));
    const assignedIds = memberAssignments.map((a: any) => a.project_id).filter(Boolean);
    setEditingProjectIds(assignedIds);
  };

  const handleSaveMemberEdits = async (e: React.FormEvent) => {
    assertOperationalAction("write", "pages/Administration/AdministrationPage.tsx");
    e.preventDefault();
    if (!editingMember) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsActionLoading(true);

    if (!hasManagerPermission) {
      setErrorMsg("Access Denied: Your assigned role does not have permission to edit company personnel.");
      setIsActionLoading(false);
      return;
    }

    try {
      const companyId = activeCompany?.id || profile?.company_id || "comp_demo_matrix_01";
      const updates = {
        full_name: editingName.trim(),
        phone: editingPhone.trim() || null,
        designation: editingDesignation,
        role: editingDesignation,
        department: editingDepartment,
        is_company_admin: editingIsCompanyAdmin,
        status: editingStatus.toLowerCase(),
        is_active: editingStatus !== "Suspended" && editingStatus !== "Deactivated"
      };

      // 1. Update in local storage
      updateStoredCompanyMember(companyId, editingMember.id, updates);

      // 2. Update project assignments in local storage
      if (allProjects && allProjects.length > 0) {
        allProjects.forEach((p: any) => {
          const cachedKey = `project_members_${p.id}`;
          let currentAss: any[] = [];
          try {
            const raw = previewStorage.getItem(cachedKey);
            if (raw) currentAss = JSON.parse(raw);
          } catch (e) {}
          currentAss = currentAss.filter((a: any) => a.company_member_id !== editingMember.id && a.profile_id !== editingMember.id);
          if (editingProjectIds.includes(p.id)) {
            currentAss.push({
              id: `pm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              project_id: p.id,
              company_member_id: editingMember.id,
              profile_id: editingMember.id,
              project_role: editingDesignation,
              role: editingDesignation,
              permissions: "all",
              access_status: "Active",
              created_at: new Date().toISOString()
            });
          }
          previewStorage.setItem(cachedKey, JSON.stringify(currentAss));
        });
      }

      // 3. Attempt Supabase update
      try {
        await supabase
          .from("company_members")
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq("id", editingMember.id);

        if (editingProjectIds.length > 0) {
          await supabase
            .from("project_members")
            .delete()
            .eq("company_member_id", editingMember.id);

          const newAssignments = editingProjectIds.map(projId => ({
            id: crypto.randomUUID(),
            project_id: projId,
            company_member_id: editingMember.id,
            project_role: editingDesignation,
            permissions: "all",
            assigned_at: new Date().toISOString()
          }));

          await supabase.from("project_members").insert(newAssignments);
        }
      } catch (cloudErr) {
        console.warn("Supabase member update fallback:", cloudErr);
      }

      // 4. Record audit event
      logAuditEvent({
        userId: profile?.id || "system",
        userName: profile?.full_name || "Administrator",
        organisationId: companyId,
        action: "user_status_changed",
        entity: "CompanyMember",
        details: `Updated personnel details for "${editingName}" (${editingDesignation}).`,
        status: "SUCCESS"
      });

      setSuccessMsg(`Personnel profile for "${editingName}" updated successfully.`);
      setEditingMember(null);
      if (loadCompanyMembers && companyId) {
        await loadCompanyMembers(companyId);
      }
      await onRefetchTenant();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to update member profile.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeletePersonnel = async (p: any) => {
    assertOperationalAction("delete", "pages/Administration/AdministrationPage.tsx");
    const memberId = typeof p === "string" ? p : p.id;
    const memberEmail = typeof p === "object" ? (p.email || "").toLowerCase() : "";
    const memberName = typeof p === "object" ? p.full_name : "this user";

    // Self-deletion check for System Administrator
    const isSelfOrSystemAdmin = 
      memberId === profile?.id || 
      memberId === activeCompany?.system_admin_user_id || 
      (memberEmail && memberEmail === profile?.email?.toLowerCase()) || 
      (memberEmail && memberEmail === activeCompany?.system_admin_email?.toLowerCase()) ||
      (typeof p === "object" && (p.role === "System Administrator" || p.designation === "System Administrator" || p.role === "Systems Administrator" || p.designation === "Systems Administrator"));

    if (isSelfOrSystemAdmin) {
      setErrorMsg("Self-Deletion Prohibited: System Administrator accounts cannot be deleted or deactivated. Transfer System Administrator authority before removing.");
      return;
    }

    if (!confirm(`Are you sure you want to deactivate and remove "${memberName}"? Their historical documents, transactions, and audit records will be fully preserved.`)) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsActionLoading(true);

    try {
      const companyId = activeCompany?.id || profile?.company_id || "comp_demo_matrix_01";
      
      // 1. Delete/Deactivate in local storage
      deleteStoredCompanyMember(companyId, memberId);

      // 2. Remove from active project assignments in local storage
      if (allProjects && allProjects.length > 0) {
        allProjects.forEach((p: any) => {
          const cachedKey = `project_members_${p.id}`;
          let currentAss: any[] = [];
          try {
            const raw = previewStorage.getItem(cachedKey);
            if (raw) currentAss = JSON.parse(raw);
          } catch (e) {}
          currentAss = currentAss.filter((a: any) => a.company_member_id !== memberId && a.profile_id !== memberId);
          previewStorage.setItem(cachedKey, JSON.stringify(currentAss));
        });
      }

      // 3. Attempt Supabase delete / update
      try {
        await supabase.from("project_members").delete().eq("company_member_id", memberId);
        await supabase.from("company_members").delete().eq("id", memberId);
      } catch (err) {
        console.warn("Supabase member delete fallback:", err);
      }

      // 4. Log audit event
      logAuditEvent({
        userId: profile?.id || "system",
        userName: profile?.full_name || "Administrator",
        organisationId: companyId,
        action: "user_status_changed",
        entity: "CompanyMember",
        details: `Deactivated and removed member ID "${memberId}" ("${memberName}"). Historical records preserved.`,
        status: "SUCCESS"
      });

      setSuccessMsg(`User "${memberName}" successfully deactivated and removed from active roster. Historical records preserved.`);
      if (loadCompanyMembers && companyId) {
        await loadCompanyMembers(companyId);
      }
      await onRefetchTenant();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to delete personnel member.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // ==========================================
  // TAB 3: PROJECTS STATE & HANDLERS
  // ==========================================
  const [projName, setProjName] = useState("");
  const [projCode, setProjCode] = useState("");
  const [projNum, setProjNum] = useState("");
  const [projClient, setProjClient] = useState("");
  const [projLocation, setProjLocation] = useState("");
  const [projValue, setProjValue] = useState("");
  const [projCurrency, setProjCurrency] = useState<string>("ZAR");
  const [projType, setProjType] = useState(CONTRACT_FRAMEWORKS[0]);

  // Edit Project Modal State
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [editProjName, setEditProjName] = useState("");
  const [editProjCode, setEditProjCode] = useState("");
  const [editProjNum, setEditProjNum] = useState("");
  const [editProjClient, setEditProjClient] = useState("");
  const [editProjLocation, setEditProjLocation] = useState("");
  const [editProjValue, setEditProjValue] = useState("");
  const [editProjCurrency, setEditProjCurrency] = useState<string>("ZAR");
  const [editProjType, setEditProjType] = useState(CONTRACT_FRAMEWORKS[0]);
  const [editProjManager, setEditProjManager] = useState("");
  const [editProjStatus, setEditProjStatus] = useState("Active");
  const [editProjProgress, setEditProjProgress] = useState(0);
  const [editProjStartDate, setEditProjStartDate] = useState("");
  const [editProjEndDate, setEditProjEndDate] = useState("");

  // Delete Project Confirmation Modal State
  const [deletingProject, setDeletingProject] = useState<any | null>(null);

  const handleOpenEditProject = (proj: any) => {
    if (!canEditProject) {
      setErrorMsg("Access Denied: Your assigned role does not have permission to edit projects.");
      return;
    }
    setEditingProject(proj);
    setEditProjName(proj.name || "");
    setEditProjCode(proj.contract_code || proj.code || "");
    setEditProjNum(proj.contract_number || proj.contract_num || "");
    setEditProjClient(proj.client_organization || proj.client || "");
    setEditProjLocation(proj.execution_location || proj.location || "");
    setEditProjValue(proj.award_value_zar !== undefined ? `${proj.award_value_zar}` : (proj.value_rate !== undefined ? `${proj.value_rate}` : ""));
    setEditProjCurrency(proj.currency_code || proj.currency || "ZAR");
    setEditProjType(proj.contract_agreement_option || proj.contract_type || CONTRACT_FRAMEWORKS[0]);
    setEditProjManager(proj.contract_manager || proj.project_manager || "");
    setEditProjStatus(proj.status || "Active");
    setEditProjProgress(typeof proj.physical_progress === "number" ? proj.physical_progress : (parseFloat(proj.physical_progress || proj.progress_percentage) || 0));
    setEditProjStartDate(proj.start_date ? proj.start_date.substring(0, 10) : "");
    setEditProjEndDate(proj.end_date ? proj.end_date.substring(0, 10) : "");
  };

  const handleSaveEditProject = async (e: React.FormEvent) => {
    assertOperationalAction("write", "pages/Administration/AdministrationPage.tsx");
    e.preventDefault();
    if (!editingProject) return;

    if (!canEditProject) {
      setErrorMsg("Access Denied: You do not have permission to modify this project.");
      return;
    }

    if (!editProjName.trim() || !editProjCode.trim()) {
      setErrorMsg("Project Name and Contract Code are mandatory.");
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsActionLoading(true);

    try {
      const companyId = editingProject.company_id || activeCompany?.id || profile?.company_id || "comp_demo_matrix_01";
      
      const payload = {
        name: editProjName.trim(),
        contract_code: editProjCode.trim(),
        code: editProjCode.trim(),
        contract_number: editProjNum.trim(),
        client_organization: editProjClient.trim(),
        client: editProjClient.trim(),
        execution_location: editProjLocation.trim(),
        location: editProjLocation.trim(),
        award_value_zar: parseFloat(editProjValue) || 0,
        value_rate: parseFloat(editProjValue) || 0,
        currency_code: editProjCurrency,
        currency: editProjCurrency,
        contract_agreement_option: editProjType,
        contract_type: editProjType,
        contract_manager: editProjManager.trim() || profile?.full_name || "Project Manager",
        project_manager: editProjManager.trim() || profile?.full_name || "Project Manager",
        status: editProjStatus,
        physical_progress: editProjProgress,
        progress_percentage: editProjProgress,
        start_date: editProjStartDate || null,
        end_date: editProjEndDate || null,
      };

      const updated = await ProjectService.updateProject(editingProject.id, companyId, payload);

      // Audit Log
      logAuditEvent({
        userId: profile?.id || "admin",
        userName: profile?.full_name || "Administrator",
        organisationId: companyId,
        projectId: editingProject.id,
        action: "sensitive_admin_action",
        entity: "Project",
        details: `Updated project metadata and configuration for [${editProjCode}] "${editProjName}"`,
        status: "SUCCESS"
      });

      // Refresh active project context if this project is currently selected
      if (activeProject?.id === editingProject.id && onProjectChange && updated) {
        onProjectChange(updated);
      }

      setSuccessMsg(`Project "${editProjName}" updated successfully.`);
      setEditingProject(null);
      await onRefetchTenant();
    } catch (err: any) {
      console.error("Failed to update project:", err);
      setErrorMsg(err.message || "Failed to update project.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    assertOperationalAction("create", "pages/Administration/AdministrationPage.tsx");
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsActionLoading(true);

    if (!canCreateProject) {
      setErrorMsg("Access Denied: Your assigned role does not have permission to establish new projects.");
      setIsActionLoading(false);
      return;
    }

    if (!projName.trim() || !projCode.trim() || !projNum.trim()) {
      setErrorMsg("Project name, Contract Code, and Contract Number are required.");
      setIsActionLoading(false);
      return;
    }

    try {
      const createdProject = await ProjectService.createProject({
        company_id: activeCompany?.id || profile?.company_id || "comp_demo_matrix_01",
        name: projName.trim(),
        contract_code: projCode.trim(),
        contract_number: projNum.trim(),
        client_organization: projClient.trim(),
        execution_location: projLocation.trim(),
        award_value_zar: parseFloat(projValue) || 0,
        currency_code: projCurrency,
        contract_agreement_option: projType,
        physical_progress: 0,
        contract_manager: profile?.full_name || "Project Manager",
        created_by: profile?.id || null
      });

      logAuditEvent({
        userId: profile?.id || "admin",
        userName: profile?.full_name || "Administrator",
        organisationId: activeCompany?.id || "default",
        projectId: createdProject.id,
        action: "sensitive_admin_action",
        entity: "Project",
        details: `Established new capital project [${createdProject.contract_code}] "${createdProject.name}"`,
        status: "SUCCESS"
      });

      setSuccessMsg(`Project "${createdProject.name}" successfully established.`);
      setProjName("");
      setProjCode("");
      setProjNum("");
      setProjClient("");
      setProjLocation("");
      setProjValue("");
      if (onProjectChange) {
        onProjectChange(createdProject);
      }
      await onRefetchTenant();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to establish project.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmDeleteProject = async () => {
    if (!deletingProject) return;

    if (!canDeleteProject) {
      setErrorMsg("Access Denied: Your assigned role does not have permission to delete projects.");
      setDeletingProject(null);
      return;
    }

    const targetId = deletingProject.id;
    const projName = deletingProject.name || "this project";

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsActionLoading(true);

    try {
      const compId = deletingProject.company_id || activeCompany?.id || profile?.company_id || "comp_demo_matrix_01";
      await ProjectService.deleteProject(targetId, compId);

      logAuditEvent({
        userId: profile?.id || "admin",
        userName: profile?.full_name || "Administrator",
        organisationId: compId,
        projectId: targetId,
        action: "sensitive_admin_action",
        entity: "Project",
        details: `Permanently deleted project [${deletingProject.contract_code || deletingProject.code || "ID: " + targetId}] "${projName}"`,
        status: "SUCCESS"
      });

      // If the deleted project was the active project, shift to another project or clear
      const remaining = (allProjects || []).filter((p: any) => p.id !== targetId);
      if (activeProject?.id === targetId && onProjectChange) {
        onProjectChange(remaining.length > 0 ? remaining[0] : null);
      }

      setSuccessMsg(`Project "${projName}" successfully deleted.`);
      setDeletingProject(null);
      await onRefetchTenant();
    } catch (err: any) {
      console.error("Project deletion failed:", err);
      setErrorMsg(err.message || "Failed to delete project.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleArchiveProjectInstead = async () => {
    if (!deletingProject) return;

    if (!canEditProject) {
      setErrorMsg("Access Denied: Your assigned role does not have permission to archive projects.");
      setDeletingProject(null);
      return;
    }

    const targetId = deletingProject.id;
    const projName = deletingProject.name || "this project";

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsActionLoading(true);

    try {
      const compId = deletingProject.company_id || activeCompany?.id || profile?.company_id || "comp_demo_matrix_01";
      const updated = await ProjectService.archiveProject(targetId, compId);

      logAuditEvent({
        userId: profile?.id || "admin",
        userName: profile?.full_name || "Administrator",
        organisationId: compId,
        projectId: targetId,
        action: "sensitive_admin_action",
        entity: "Project",
        details: `Archived project [${deletingProject.contract_code || deletingProject.code}] "${projName}" to preserve historical records`,
        status: "SUCCESS"
      });

      if (activeProject?.id === targetId && onProjectChange && updated) {
        onProjectChange(updated);
      }

      setSuccessMsg(`Project "${projName}" successfully archived.`);
      setDeletingProject(null);
      await onRefetchTenant();
    } catch (err: any) {
      console.error("Project archiving failed:", err);
      setErrorMsg(err.message || "Failed to archive project.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // ==========================================
  // TAB 4: PROJECT ACCESS & TEAM MATRIX
  // ==========================================
  const companyProjects = useMemo(() => {
    if (!allProjects || allProjects.length === 0) return [];
    if (!activeCompany?.id) return allProjects;
    const filtered = allProjects.filter((proj: any) => 
      !proj.company_id || 
      proj.company_id === activeCompany.id || 
      proj.company_id === activeCompany.tenant_id ||
      proj.tenant_id === activeCompany.tenant_id
    );
    return filtered.length > 0 ? filtered : allProjects;
  }, [allProjects, activeCompany]);

  const [selectedProjId, setSelectedProjId] = useState(companyProjects?.[0]?.id || allProjects?.[0]?.id || "");
  const [assignedPersIDs, setAssignedPersIDs] = useState<string[]>([]);
  const [assignedPersRoles, setAssignedPersRoles] = useState<Record<string, string>>({});
  const [assignedPersStatuses, setAssignedPersStatuses] = useState<Record<string, "Active" | "Read-Only" | "Suspended">>({});

  // Filter company personnel to be strictly tenant-specific with System Administrator & invited personnel
  const tenantPersonnel = useMemo(() => {
    const currentCompanyId = activeCompany?.id || profile?.company_id || "comp_demo_matrix_01";
    const currentTenantId = activeCompany?.tenant_id || currentCompanyId;

    const list: any[] = [];
    const seenEmails = new Set<string>();
    const seenIds = new Set<string>();

    // 1. Members from companyPersonnel (context)
    (companyPersonnel || []).forEach((p: any) => {
      if (isBlockedOrMockUser(p)) return;
      if (currentCompanyId && p.company_id && p.company_id !== currentCompanyId && p.tenant_id !== currentTenantId) return;
      const email = (p.email || "").toLowerCase().trim();
      if (email) seenEmails.add(email);
      if (p.id) seenIds.add(p.id);
      list.push(p);
    });

    // 2. Members from stored local storage
    const stored = getStoredCompanyMembers(currentCompanyId);
    (stored || []).forEach((m: any) => {
      if (isBlockedOrMockUser(m)) return;
      const email = (m.email || "").toLowerCase().trim();
      if (email && seenEmails.has(email)) return;
      if (m.id && seenIds.has(m.id)) return;
      if (email) seenEmails.add(email);
      if (m.id) seenIds.add(m.id);
      list.push(m);
    });

    // 3. Pending invitations
    const invitations = getInvitationsByTenant(currentTenantId);
    (invitations || []).forEach((inv: any) => {
      const email = (inv.email || "").toLowerCase().trim();
      if (isBlockedOrMockUser({ full_name: `${inv.first_name} ${inv.last_name}`, email })) return;
      if (email && seenEmails.has(email)) return;
      if (inv.id && seenIds.has(inv.id)) return;
      if (email) seenEmails.add(email);
      if (inv.id) seenIds.add(inv.id);
      list.push({
        id: inv.id,
        profile_id: inv.id,
        company_id: currentCompanyId,
        full_name: `${inv.first_name} ${inv.last_name}`.trim(),
        email: inv.email,
        phone: inv.phone || null,
        designation: inv.designation || "Senior Engineer",
        role: inv.designation || "Senior Engineer",
        department: inv.department || "Engineering",
        is_company_admin: false,
        is_active: inv.status === "Pending",
        status: inv.status === "Pending" ? "pending" : inv.status.toLowerCase(),
        invitation_id: inv.id,
        secure_token: inv.secure_token,
        created_at: inv.created_at
      });
    });

    // 4. Ensure System Administrator is always present
    const adminName = activeCompany?.system_admin_name || profile?.full_name || "Thuto Meng";
    const adminEmail = activeCompany?.system_admin_email || profile?.email || "thuto.meng@gmail.com";
    const adminUserId = profile?.id || activeCompany?.system_admin_user_id || "usr_thuto_meng";

    const hasAdmin = list.some((p: any) => 
      p.is_company_admin === true || 
      p.role === "System Administrator" || 
      p.designation === "System Administrator" || 
      p.role === "Systems Administrator" || 
      p.designation === "Systems Administrator" || 
      (p.email && p.email.toLowerCase() === adminEmail.toLowerCase()) || 
      p.id === adminUserId || 
      p.profile_id === adminUserId
    );

    if (!hasAdmin) {
      list.unshift({
        id: adminUserId,
        profile_id: adminUserId,
        company_id: currentCompanyId,
        full_name: adminName,
        email: adminEmail,
        designation: "System Administrator",
        role: "System Administrator",
        department: "Executive",
        is_company_admin: true,
        is_active: true,
        status: "active",
        created_at: new Date().toISOString()
      });
    }

    return list.filter((u: any) => !isBlockedOrMockUser(u));
  }, [companyPersonnel, activeCompany, profile]);

  const handleSelectProjectForMatrix = async (projId: string) => {
    setSelectedProjId(projId);
    let currentAssignments: any[] = [];
    try {
      const { data, error } = await supabase
        .from("project_members")
        .select("*")
        .eq("project_id", projId);

      if (!error && Array.isArray(data)) {
        currentAssignments = data.filter((m: any) => !isBlockedOrMockUser(m));
      } else {
        const cached = previewStorage.getItem(`project_members_${projId}`);
        if (cached) {
          try {
            currentAssignments = JSON.parse(cached).filter((m: any) => !isBlockedOrMockUser(m));
          } catch (e) {}
        }
      }
    } catch (e) {
      const cached = previewStorage.getItem(`project_members_${projId}`);
      if (cached) {
        try {
          currentAssignments = JSON.parse(cached).filter((m: any) => !isBlockedOrMockUser(m));
        } catch (err) {}
      }
    }

    // Filter assignments strictly to valid members from tenantPersonnel
    const validMemberIds = new Set(tenantPersonnel.flatMap((p: any) => [p.id, p.profile_id].filter(Boolean)));
    const validAssignments = currentAssignments.filter((m: any) => {
      const pid = m.company_member_id || m.profile_id;
      return pid && validMemberIds.has(pid) && !isBlockedOrMockUser(m);
    });

    const ids = validAssignments.map((m: any) => {
      const match = tenantPersonnel.find((p: any) => p.id === (m.company_member_id || m.profile_id) || p.profile_id === (m.company_member_id || m.profile_id));
      return match ? match.id : (m.company_member_id || m.profile_id);
    }).filter(Boolean);

    const roles: Record<string, string> = {};
    const statuses: Record<string, "Active" | "Read-Only" | "Suspended"> = {};
    
    validAssignments.forEach((m: any) => {
      const match = tenantPersonnel.find((p: any) => p.id === (m.company_member_id || m.profile_id) || p.profile_id === (m.company_member_id || m.profile_id));
      const pid = match ? match.id : (m.company_member_id || m.profile_id);
      if (pid) {
        roles[pid] = m.project_role || m.role || match?.designation || match?.role || "Senior Engineer";
        statuses[pid] = m.access_status || "Active";
      }
    });

    setAssignedPersIDs(ids);
    setAssignedPersRoles(roles);
    setAssignedPersStatuses(statuses);
    // Persist cleaned assignments
    previewStorage.setItem(`project_members_${projId}`, JSON.stringify(validAssignments));
  };

  useEffect(() => {
    if (companyProjects && companyProjects.length > 0) {
      const currentExists = companyProjects.some((p: any) => p.id === selectedProjId);
      if (!selectedProjId || !currentExists) {
        handleSelectProjectForMatrix(companyProjects[0].id);
      } else {
        handleSelectProjectForMatrix(selectedProjId);
      }
    }
  }, [companyProjects]);

  const handleTogglePersID = (pid: string) => {
    if (!hasManagerPermission) return;
    if (assignedPersIDs.includes(pid)) {
      setAssignedPersIDs(assignedPersIDs.filter(id => id !== pid));
    } else {
      setAssignedPersIDs([...assignedPersIDs, pid]);
      if (!assignedPersRoles[pid]) {
        const member = tenantPersonnel.find((p: any) => p.id === pid || p.profile_id === pid);
        setAssignedPersRoles(prev => ({ ...prev, [pid]: member?.designation || member?.role || "Senior Engineer" }));
        setAssignedPersStatuses(prev => ({ ...prev, [pid]: "Active" }));
      }
    }
  };

  const handleSaveAssignments = async () => {
    assertOperationalAction("write", "pages/Administration/AdministrationPage.tsx");
    if (!hasManagerPermission) {
      setErrorMsg("Access Denied: Your assigned role does not have permission to manage project assignments.");
      return;
    }

    if (!selectedProjId) {
      setErrorMsg("Please select a target project focus.");
      return;
    }

    setIsActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await supabase.from("project_members").delete().eq("project_id", selectedProjId);

      const assignments = assignedPersIDs.map(pid => {
        const p = tenantPersonnel.find((x: any) => x.id === pid || x.profile_id === pid);
        return {
          id: crypto.randomUUID(),
          project_id: selectedProjId,
          company_id: activeCompany?.id || "default",
          organisation_id: activeCompany?.id || "default",
          company_member_id: pid,
          profile_id: p?.profile_id || pid,
          project_role: assignedPersRoles[pid] || p?.designation || p?.role || "Senior Engineer",
          access_status: assignedPersStatuses[pid] || "Active",
          permissions: "all",
          assigned_by: profile?.id || null,
          assigned_at: new Date().toISOString()
        };
      });

      if (assignments.length > 0) {
        await supabase.from("project_members").insert(assignments);
      }

      previewStorage.setItem(`project_members_${selectedProjId}`, JSON.stringify(assignments));
      setSuccessMsg("Project Access Matrix committed successfully.");
      await onRefetchTenant();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to save project team assignments.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // ==========================================
  // TAB 5: ROLES & CONFIGURABLE PERMISSIONS
  // ==========================================
  const [selectedRoleForMatrix, setSelectedRoleForMatrix] = useState<string>("project_manager");
  const [customRolePermissions, setCustomRolePermissions] = useState<Record<string, Record<string, boolean>>>(() => {
    const defaults: Record<string, Record<string, boolean>> = {};
    ROLE_OPTIONS.forEach(role => {
      defaults[role.value] = {
        view: true,
        create: ["company_administrator", "executive", "ceo", "coo", "cfo", "director", "head_of_engineering", "project_manager", "contracts_manager", "commercial_manager", "senior_engineer"].includes(role.value),
        edit: ["company_administrator", "executive", "ceo", "coo", "cfo", "director", "head_of_engineering", "project_manager", "contracts_manager", "commercial_manager", "senior_engineer"].includes(role.value),
        delete: ["company_administrator", "executive", "ceo", "coo", "cfo", "director", "head_of_engineering", "project_manager"].includes(role.value),
        approve: ["company_administrator", "executive", "ceo", "coo", "cfo", "director", "head_of_engineering", "project_manager", "contracts_manager"].includes(role.value),
        export: true
      };
    });
    return defaults;
  });

  const handleTogglePermission = (roleVal: string, permKey: string) => {
    setCustomRolePermissions(prev => ({
      ...prev,
      [roleVal]: {
        ...prev[roleVal],
        [permKey]: !prev[roleVal]?.[permKey]
      }
    }));
  };

  const handleSaveRolePermissions = () => {
    assertOperationalAction("write", "pages/Administration/AdministrationPage.tsx");
    previewStorage.setItem("pm_role_permissions_matrix", JSON.stringify(customRolePermissions));
    setSuccessMsg(`Permissions for role "${ROLE_OPTIONS.find(r => r.value === selectedRoleForMatrix)?.label}" saved.`);
  };

  // ==========================================
  // TAB 6: DEPARTMENTS STATE
  // ==========================================
  const [departmentsList, setDepartmentsList] = useState<Array<{ id: string; code: string; name: string; head: string; budget: string }>>(() => {
    try {
      const saved = previewStorage.getItem("pm_departments_list");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Error reading departments list:", e);
    }
    return [];
  });
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptCode, setNewDeptCode] = useState("");
  const [newDeptHead, setNewDeptHead] = useState("Senior Engineer");

  const handleAddDepartment = (e: React.FormEvent) => {
    assertOperationalAction("create", "pages/Administration/AdministrationPage.tsx");
    e.preventDefault();
    if (!newDeptName.trim()) return;
    const newDept = {
      id: `dept-${Date.now()}`,
      code: newDeptCode.trim().toUpperCase() || newDeptName.substring(0, 3).toUpperCase(),
      name: newDeptName.trim(),
      head: newDeptHead,
      budget: "R 0"
    };
    const updated = [...departmentsList, newDept];
    setDepartmentsList(updated);
    previewStorage.setItem("pm_departments_list", JSON.stringify(updated));
    setNewDeptName("");
    setNewDeptCode("");
    setSuccessMsg(`Department "${newDept.name}" created successfully.`);
  };

  const handleDeleteDepartment = (id: string) => {
    assertOperationalAction("delete", "pages/Administration/AdministrationPage.tsx");
    const updated = departmentsList.filter(d => d.id !== id);
    setDepartmentsList(updated);
    previewStorage.setItem("pm_departments_list", JSON.stringify(updated));
    setSuccessMsg("Department removed.");
  };

  // ==========================================
  // TAB 8: COMPLIANCE REGISTRY
  // ==========================================
  const complianceItems = [
    { 
      name: "Tax Clearance Status (SARS)", 
      reg: compProfileData?.taxClearancePin || "Not Configured", 
      status: compProfileData?.taxClearancePin ? "Valid / Recorded" : "Pending", 
      expiry: compProfileData?.taxClearancePin ? "Active" : "—", 
      badge: compProfileData?.taxClearancePin ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200" 
    },
    { 
      name: "COIDA / Letter of Good Standing", 
      reg: compProfileData?.coidaNumber || "Not Configured", 
      status: compProfileData?.coidaNumber ? "Active & Verified" : "Pending", 
      expiry: compProfileData?.coidaNumber ? "Active" : "—", 
      badge: compProfileData?.coidaNumber ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200" 
    },
    { 
      name: "BBBEE Empowerment Rating", 
      reg: compProfileData?.bbbeeLevel || "Not Configured", 
      status: compProfileData?.bbbeeLevel ? compProfileData.bbbeeLevel : "Pending", 
      expiry: compProfileData?.bbbeeLevel ? "Active" : "—", 
      badge: compProfileData?.bbbeeLevel ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-600 border-slate-200" 
    },
    { 
      name: "CIDB Contractor Grading", 
      reg: compProfileData?.cidbGrading || "Not Configured", 
      status: compProfileData?.cidbGrading ? compProfileData.cidbGrading : "Pending", 
      expiry: compProfileData?.cidbGrading ? "Active" : "—", 
      badge: compProfileData?.cidbGrading ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-100 text-slate-600 border-slate-200" 
    }
  ];

  // ==========================================
  // TAB 9: SECURITY CONTROLS
  // ==========================================
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorEnforced: true,
    passwordLength: 8,
    requireSpecialChars: true,
    sessionTimeoutMins: 60,
    ipGeofencing: true,
    ssoEnabled: false
  });

  // ==========================================
  // TAB 10: AUDIT LOGS
  // ==========================================
  const [auditFilter, setAuditFilter] = useState<string>("all");
  const [auditSearch, setAuditSearch] = useState<string>("");

  const auditLogs = useMemo(() => {
    const dynamicLogs = getAuditLogs().map(entry => ({
      id: entry.id,
      time: entry.timestamp.replace("T", " ").substring(0, 19),
      actor: entry.userName || "System",
      action: entry.details || entry.action,
      resource: entry.entity,
      status: entry.status === "SUCCESS" ? "Success" : entry.status === "DENIED" ? "Denied" : "Failed",
      ip: entry.ipAddress || "—"
    }));

    return dynamicLogs.filter(l => {
      const matchesSearch = !auditSearch.trim() ||
        l.actor.toLowerCase().includes(auditSearch.toLowerCase()) ||
        l.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
        (l.resource && l.resource.toLowerCase().includes(auditSearch.toLowerCase()));
      const matchesFilter = auditFilter === "all" ||
        (auditFilter === "success" && l.status === "Success") ||
        (auditFilter === "denied" && l.status === "Denied") ||
        (auditFilter === "failed" && l.status === "Failed");
      return matchesSearch && matchesFilter;
    });
  }, [auditFilter, auditSearch]);

  // Filtered personnel derived strictly from tenantPersonnel
  const filteredPersonnel = useMemo(() => {
    return (tenantPersonnel || []).filter((p: any) => {
      if (isBlockedOrMockUser(p)) return false;
      const matchesSearch = !userSearchTerm.trim() || 
        p.full_name?.toLowerCase().includes(userSearchTerm.toLowerCase()) || 
        p.email?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        p.designation?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        p.department?.toLowerCase().includes(userSearchTerm.toLowerCase());
      
      const matchesStatus = userStatusFilter === "all" || 
        (userStatusFilter === "active" && (p.status === "active" || (p.is_active !== false && p.status !== "pending" && p.status !== "suspended" && p.status !== "deactivated"))) ||
        (userStatusFilter === "pending" && (p.status === "pending" || p.status === "invited")) ||
        (userStatusFilter === "suspended" && (p.status === "suspended" || p.status === "deactivated" || p.is_active === false)) ||
        (userStatusFilter === "admin" && (p.is_company_admin || p.designation === "System Administrator" || p.role === "System Administrator"));

      return matchesSearch && matchesStatus;
    });
  }, [tenantPersonnel, userSearchTerm, userStatusFilter]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 border border-[#E2E8F0] rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-[#FF9F1C]" />
            <h1 className="text-xl font-extrabold text-[#07182E] tracking-tight">
              Enterprise Administration Ledger
            </h1>
            <span className="px-2.5 py-0.5 bg-[#FF9F1C]/10 border border-[#FF9F1C]/20 text-[#FF9F1C] rounded-full text-[10px] font-bold uppercase tracking-wider">
              Tenant Active
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-1">
            Centralized corporate governance, multi-tenant directory, project access control, and compliance ledger.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-[#07182E]">{activeCompany?.name || "Company"}</p>
            <p className="text-[10px] text-slate-400 font-mono">Org ID: {activeCompany?.id?.slice(0, 13)}...</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#102846] text-white flex items-center justify-center font-bold text-sm shadow-md">
            {activeCompany?.name?.slice(0, 2).toUpperCase() || "PM"}
          </div>
        </div>
      </div>

      {/* 10 Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-1 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {[
          { id: "overview", label: "Overview", icon: Activity },
          { id: "company", label: "Company", icon: Building2 },
          { id: "personnel", label: "Users & Personnel", icon: Users },
          { id: "roles", label: "Roles & Permissions", icon: ShieldCheck },
          { id: "departments", label: "Departments", icon: Layers },
          { id: "projects", label: "Projects", icon: Briefcase },
          { id: "assignments", label: "Project Access", icon: Sliders },
          { id: "compliance", label: "Compliance", icon: Award },
          { id: "security", label: "Security", icon: Lock },
          { id: "audit", label: "Audit Log", icon: Clock },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                setActiveTab(t.id as any);
                if (t.id === "assignments" && allProjects?.length > 0 && !selectedProjId) {
                  handleSelectProjectForMatrix(allProjects[0].id);
                }
              }}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all cursor-pointer shrink-0 ${
                isActive
                  ? "border-[#FF9F1C] text-[#FF9F1C] font-extrabold bg-[#FF9F1C]/5 rounded-t-lg"
                  : "border-transparent text-[#64748B] hover:text-[#07182E] hover:border-slate-300"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ========================================== */}
      {/* TAB 1: OVERVIEW                            */}
      {/* ========================================== */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Key KPI Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 border border-[#E2E8F0] rounded-xl shadow-sm min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">Total Users</div>
              <div className="text-2xl font-black text-[#07182E] mt-1 truncate">{companyPersonnel?.length || 0}</div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-1 truncate">
                <CheckCircle2 className="w-3 h-3 shrink-0" /> Directory
              </div>
            </div>

            <div className="bg-white p-4 border border-[#E2E8F0] rounded-xl shadow-sm min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">Active Projects</div>
              <div className="text-2xl font-black text-[#07182E] mt-1 truncate">{allProjects?.length || 0}</div>
              <div className="text-[10px] text-blue-600 font-semibold mt-1 truncate">Multi-site Sync</div>
            </div>

            <div className="bg-white p-4 border border-[#E2E8F0] rounded-xl shadow-sm min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">Default Roles</div>
              <div className="text-2xl font-black text-[#07182E] mt-1 truncate">{ROLE_OPTIONS.length}</div>
              <div className="text-[10px] text-amber-600 font-semibold mt-1 truncate">Granular RBAC</div>
            </div>

            <div className="bg-white p-4 border border-[#E2E8F0] rounded-xl shadow-sm min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">Departments</div>
              <div className="text-2xl font-black text-[#07182E] mt-1 truncate">{departmentsList.length}</div>
              <div className="text-[10px] text-purple-600 font-semibold mt-1 truncate">Org Hierarchy</div>
            </div>

            <div className="bg-white p-4 border border-[#E2E8F0] rounded-xl shadow-sm min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">Compliance Score</div>
              <div className="text-2xl font-black text-emerald-600 mt-1 truncate">
                {complianceItems.length > 0
                  ? `${Math.round((complianceItems.filter(i => i.status !== "Pending").length / complianceItems.length) * 100)}%`
                  : "0%"}
              </div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-1 truncate">
                {complianceItems.filter(i => i.status !== "Pending").length} / {complianceItems.length} Valid
              </div>
            </div>

            <div className="bg-white p-4 border border-[#E2E8F0] rounded-xl shadow-sm min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">Security Health</div>
              <div className="text-2xl font-black text-emerald-600 mt-1 truncate">
                {securitySettings.twoFactorEnforced ? "100%" : "75%"}
              </div>
              <div className="text-[10px] text-slate-400 font-semibold mt-1 truncate">
                {securitySettings.twoFactorEnforced ? "2FA Enforced" : "Standard"}
              </div>
            </div>
          </div>

          {/* Quick Actions & Workspace Configuration */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 border border-[#E2E8F0] rounded-2xl shadow-sm space-y-4 min-w-0">
              <h3 className="text-xs font-black text-[#07182E] uppercase tracking-wider">
                Administration Quick Actions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setActiveTab("company")}
                  className="p-4 border border-slate-200 rounded-xl hover:border-[#FF9F1C] hover:bg-slate-50 transition-all text-left group cursor-pointer min-w-0"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#FF9F1C] shrink-0" />
                    <span className="text-xs font-bold text-[#07182E] group-hover:text-[#FF9F1C] truncate">Edit Company Profile</span>
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-1 break-words">Update legal name, trading name, tax info, addresses, and logo.</p>
                </button>

                <button
                  onClick={() => setActiveTab("personnel")}
                  className="p-4 border border-slate-200 rounded-xl hover:border-[#FF9F1C] hover:bg-slate-50 transition-all text-left group cursor-pointer min-w-0"
                >
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-[#FF9F1C] shrink-0" />
                    <span className="text-xs font-bold text-[#07182E] group-hover:text-[#FF9F1C] truncate">Add / Invite Personnel</span>
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-1 break-words">Create user accounts, assign roles, and align with projects.</p>
                </button>

                <button
                  onClick={() => setActiveTab("assignments")}
                  className="p-4 border border-slate-200 rounded-xl hover:border-[#FF9F1C] hover:bg-slate-50 transition-all text-left group cursor-pointer min-w-0"
                >
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#FF9F1C] shrink-0" />
                    <span className="text-xs font-bold text-[#07182E] group-hover:text-[#FF9F1C] truncate">Project Access Matrix</span>
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-1 break-words">Manage user multi-project assignments and access roles.</p>
                </button>

                <button
                  onClick={() => setActiveTab("compliance")}
                  className="p-4 border border-slate-200 rounded-xl hover:border-[#FF9F1C] hover:bg-slate-50 transition-all text-left group cursor-pointer min-w-0"
                >
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-[#FF9F1C] shrink-0" />
                    <span className="text-xs font-bold text-[#07182E] group-hover:text-[#FF9F1C] truncate">Compliance & Certifications</span>
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-1 break-words">Track Tax Clearance, COIDA, BBBEE, CIDB, and ISO audits.</p>
                </button>
              </div>
            </div>

            {/* Recent Administration Activity */}
            <div className="bg-white p-6 border border-[#E2E8F0] rounded-2xl shadow-sm space-y-4 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-[#07182E] uppercase tracking-wider">Recent System Activity</h3>
                <button onClick={() => setActiveTab("audit")} className="text-[11px] font-bold text-[#FF9F1C] hover:underline cursor-pointer">
                  View All
                </button>
              </div>
              <div className="space-y-3">
                {auditLogs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    No recent administrative activity recorded.
                  </div>
                ) : (
                  auditLogs.slice(0, 4).map(log => (
                    <div key={log.id} className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl text-xs space-y-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="font-bold text-[#07182E] truncate flex-1 min-w-0">{log.action}</span>
                        <span className="text-[9px] text-slate-400 font-mono shrink-0">{log.time.split(" ")[1] || log.time}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center justify-between gap-2 min-w-0">
                        <span className="truncate">By: {log.actor}</span>
                        <span className="text-emerald-600 font-bold shrink-0">{log.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 2: COMPANY PROFILE (EDITABLE)          */}
      {/* ========================================== */}
      {activeTab === "company" && (
        <div className="bg-white border border-[#E2E8F0] p-6 rounded-2xl shadow-sm space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-bold text-[#07182E] uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#FF9F1C]" />
                Corporate Company Profile
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">Manage registered legal details, tax identification, addresses, and compliance.</p>
            </div>

            <button
              onClick={handleSaveCompanyProfile}
              disabled={isActionLoading || !hasManagerPermission}
              className="px-4 py-2 bg-[#FF9F1C] hover:bg-[#FFB020] text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              Save Company Profile
            </button>
          </div>

          <form onSubmit={handleSaveCompanyProfile} className="space-y-8">
            {/* Section 1: Company Information */}
            <div className="space-y-4">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">
                1. Company Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Legal Company Name
                  </label>
                  <input
                    type="text"
                    required
                    value={compProfileData.name}
                    onChange={(e) => setCompProfileData({ ...compProfileData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Trading Name
                  </label>
                  <input
                    type="text"
                    value={compProfileData.tradingName}
                    onChange={(e) => setCompProfileData({ ...compProfileData, tradingName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Company Registration Number
                  </label>
                  <input
                    type="text"
                    required
                    value={compProfileData.registrationNumber}
                    onChange={(e) => setCompProfileData({ ...compProfileData, registrationNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Established Date
                  </label>
                  <input
                    type="date"
                    value={compProfileData.establishedDate}
                    onChange={(e) => setCompProfileData({ ...compProfileData, establishedDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Website URL
                  </label>
                  <input
                    type="url"
                    value={compProfileData.website}
                    onChange={(e) => setCompProfileData({ ...compProfileData, website: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Company Logo URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={compProfileData.logoUrl}
                    onChange={(e) => setCompProfileData({ ...compProfileData, logoUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Regional Jurisdiction & Tax Governance */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-amber-500" />
                  2. Regional Jurisdiction & Currency Governance
                </h4>
                <span className="text-[11px] font-mono text-slate-400">
                  Controls global portfolio currencies & compliance
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Operating Country / Region *
                  </label>
                  <select
                    value={compProfileData.countryCode}
                    onChange={(e) => {
                      const selectedCode = e.target.value;
                      const rc = getRegionConfig(selectedCode);
                      const pack = getRegionalPack(selectedCode);
                      const newCurr = (pack.currencyCode || rc?.currency || "USD") as SupportedCurrency;
                      setCompProfileData({
                        ...compProfileData,
                        countryCode: selectedCode,
                        country: rc?.countryName || selectedCode,
                        currency: newCurr,
                        taxJurisdiction: `${rc?.countryName || selectedCode} (${rc?.publicAuthorities?.[0] || "Revenue Authority"})`
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none bg-white cursor-pointer"
                  >
                    {getAllRegionConfigs().map((rc) => (
                      <option key={rc.countryCode} value={rc.countryCode}>
                        {rc.flagEmoji || "🌐"} {rc.countryName} ({rc.currency})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Default Operating Currency *
                  </label>
                  <select
                    value={compProfileData.currency}
                    onChange={(e) => setCompProfileData({ ...compProfileData, currency: e.target.value as SupportedCurrency })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none bg-white cursor-pointer"
                  >
                    {SUPPORTED_CURRENCIES.map((curr) => (
                      <option key={curr.code} value={curr.code}>
                        {curr.flag || "🪙"} {curr.code} ({curr.symbol}) — {curr.country || curr.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Tax Identification Number (TIN)
                  </label>
                  <input
                    type="text"
                    required
                    value={compProfileData.taxId}
                    onChange={(e) => setCompProfileData({ ...compProfileData, taxId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    VAT / Tax Registration Number
                  </label>
                  <input
                    type="text"
                    required
                    value={compProfileData.vatNumber}
                    onChange={(e) => setCompProfileData({ ...compProfileData, vatNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Tax Jurisdiction & Statutory Authority
                </label>
                <input
                  type="text"
                  value={compProfileData.taxJurisdiction}
                  onChange={(e) => setCompProfileData({ ...compProfileData, taxJurisdiction: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  placeholder="e.g. Tanzania (TRA - Tanzania Revenue Authority)"
                />
              </div>
            </div>

            {/* Section 3: Contact Details */}
            <div className="space-y-4">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">
                3. Contact Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Company Email
                  </label>
                  <input
                    type="email"
                    required
                    value={compProfileData.email}
                    onChange={(e) => setCompProfileData({ ...compProfileData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Telephone Number
                  </label>
                  <input
                    type="text"
                    required
                    value={compProfileData.phone}
                    onChange={(e) => setCompProfileData({ ...compProfileData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Support / Inquiries Email
                  </label>
                  <input
                    type="email"
                    value={compProfileData.supportEmail || compProfileData.email}
                    onChange={(e) => setCompProfileData({ ...compProfileData, supportEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Addresses */}
            <div className="space-y-4">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">
                4. Addresses
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Physical Headquarters Address
                  </label>
                  <input
                    type="text"
                    required
                    value={compProfileData.physicalAddress}
                    onChange={(e) => setCompProfileData({ ...compProfileData, physicalAddress: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Postal Address
                    </label>
                    <label className="flex items-center gap-1 text-[10px] font-bold text-[#FF9F1C] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={compProfileData.samePostalAddress}
                        onChange={(e) => setCompProfileData({
                          ...compProfileData,
                          samePostalAddress: e.target.checked,
                          postalAddress: e.target.checked ? compProfileData.physicalAddress : compProfileData.postalAddress
                        })}
                        className="rounded border-slate-300 text-[#FF9F1C] accent-[#FF9F1C]"
                      />
                      Same as physical address
                    </label>
                  </div>
                  <input
                    type="text"
                    disabled={compProfileData.samePostalAddress}
                    value={compProfileData.samePostalAddress ? compProfileData.physicalAddress : compProfileData.postalAddress}
                    onChange={(e) => setCompProfileData({ ...compProfileData, postalAddress: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Section 5: Compliance Framework */}
            <div className="space-y-4">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">
                5. Statutory Compliance
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    COIDA Number / Letter of Good Standing
                  </label>
                  <input
                    type="text"
                    value={compProfileData.coidaNumber}
                    onChange={(e) => setCompProfileData({ ...compProfileData, coidaNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    BBBEE Contributor Level
                  </label>
                  <input
                    type="text"
                    value={compProfileData.bbbeeLevel}
                    onChange={(e) => setCompProfileData({ ...compProfileData, bbbeeLevel: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    CIDB Grading
                  </label>
                  <input
                    type="text"
                    value={compProfileData.cidbGrading}
                    onChange={(e) => setCompProfileData({ ...compProfileData, cidbGrading: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={isActionLoading || !hasManagerPermission}
                className="px-6 py-2.5 bg-[#FF9F1C] hover:bg-[#FFB020] text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Commit Profile Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 3: USERS & PERSONNEL                   */}
      {/* ========================================== */}
      {activeTab === "personnel" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {editingMember ? (
            /* Edit Personnel Form */
            <div className="bg-white p-6 border border-amber-200 rounded-2xl shadow-sm space-y-4 h-fit">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-[#07182E] uppercase tracking-widest flex items-center gap-1.5">
                  <Edit className="w-4 h-4 text-[#FF9F1C]" /> Edit Personnel
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveMemberEdits} className="space-y-4">
                <fieldset disabled={isActionLoading || !hasManagerPermission} className="space-y-4 w-full">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={editingPhone}
                      onChange={(e) => setEditingPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Designation</label>
                      <select
                        value={editingDesignation}
                        onChange={(e) => setEditingDesignation(e.target.value)}
                        className="w-full px-2 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none cursor-pointer"
                      >
                        {Array.from(new Set(ROLE_OPTIONS.map(o => o.group))).map(group => (
                          <optgroup key={group} label={group} className="text-[10px] uppercase font-bold text-slate-500">
                            {ROLE_OPTIONS.filter(o => o.group === group).map(opt => (
                              <option key={opt.value} value={opt.label} className="text-xs font-medium text-slate-800">
                                {opt.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Department</label>
                      <select
                        value={editingDepartment}
                        onChange={(e) => setEditingDepartment(e.target.value)}
                        className="w-full px-2 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none cursor-pointer"
                      >
                        {departmentsList.map(d => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Account Status</label>
                      <select
                        value={editingStatus}
                        onChange={(e) => setEditingStatus(e.target.value)}
                        className="w-full px-2 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none cursor-pointer"
                      >
                        <option value="Active">Active</option>
                        <option value="Invited">Invited</option>
                        <option value="Suspended">Suspended</option>
                        <option value="Deactivated">Deactivated</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2 pt-5">
                      <input
                        id="editIsCompanyAdminCheck"
                        type="checkbox"
                        checked={editingIsCompanyAdmin}
                        onChange={(e) => setEditingIsCompanyAdmin(e.target.checked)}
                        className="w-4 h-4 text-[#FF9F1C] border-slate-300 rounded focus:ring-[#FF9F1C] cursor-pointer"
                      />
                      <label htmlFor="editIsCompanyAdminCheck" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                        Company Administrator
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Project Assignments ({editingProjectIds.length} Selected)
                    </label>
                    <div className="border border-slate-150 rounded-xl p-3 space-y-2 max-h-[140px] overflow-y-auto bg-slate-50">
                      {(allProjects || []).filter((p: any) => p.company_id === activeCompany?.id).map((proj: any) => {
                        const isAssigned = editingProjectIds.includes(proj.id);
                        return (
                          <div key={proj.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`edit-proj-${proj.id}`}
                              checked={isAssigned}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditingProjectIds(prev => [...prev, proj.id]);
                                } else {
                                  setEditingProjectIds(prev => prev.filter(id => id !== proj.id));
                                }
                              }}
                              className="w-3.5 h-3.5 text-[#FF9F1C] border-slate-300 rounded focus:ring-[#FF9F1C] cursor-pointer"
                            />
                            <label htmlFor={`edit-proj-${proj.id}`} className="text-xs font-medium text-slate-700 cursor-pointer line-clamp-1">
                              {proj.name} <span className="text-[10px] text-slate-400 font-mono">({proj.contract_code})</span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </fieldset>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingMember(null)}
                    className="flex-1 py-2 font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isActionLoading || !hasManagerPermission}
                    className="flex-1 py-2 font-bold text-xs bg-[#FF9F1C] hover:bg-[#FFB020] text-white rounded-xl shadow-md transition-all cursor-pointer text-center"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Add User / Send Invitation Form */
            <div className="bg-white p-6 border border-[#E2E8F0] rounded-2xl shadow-sm space-y-4 h-fit">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-widest flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-[#FF9F1C]" /> Add User & Send Invitation
                </h3>
                {hasManagerPermission && (
                  <button
                    type="button"
                    onClick={() => setIsBulkInviteOpen(true)}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                    title="Upload CSV to invite multiple employees"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-[#FF9F1C]" />
                    <span>Bulk CSV</span>
                  </button>
                )}
              </div>

              {lastInvitedLink && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Invitation Dispatched
                    </span>
                    <button
                      type="button"
                      onClick={() => setLastInvitedLink(null)}
                      className="text-amber-700 hover:text-amber-900 text-[10px] font-bold"
                    >
                      Dismiss
                    </button>
                  </div>
                  <p className="text-[10px] text-amber-800">
                    A secure invitation has been prepared for <strong>{lastInvitedLink.name}</strong> ({lastInvitedLink.email}).
                  </p>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={lastInvitedLink.url}
                      className="w-full px-2 py-1 bg-white border border-amber-300 rounded text-[10px] font-mono text-slate-700 truncate select-all"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(lastInvitedLink.url);
                          setSuccessMsg("Invitation link copied to clipboard!");
                        }}
                        className="px-2.5 py-1 bg-[#FF9F1C] hover:bg-[#FFB020] text-white text-[10px] font-bold rounded flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendEmailInvite(lastInvitedLink.email, lastInvitedLink.name, lastInvitedLink.url)}
                        className="px-2.5 py-1 bg-[#102846] hover:bg-[#1a3a60] text-white text-[10px] font-bold rounded flex items-center gap-1 cursor-pointer"
                        title="Open email composer with pre-filled invitation"
                      >
                        <Mail className="w-3 h-3" />
                        <span>Send Email</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleAddPersonnel} className="space-y-4">
                <fieldset disabled={!hasManagerPermission} className="space-y-4 w-full">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sipho Sithole"
                      value={persName}
                      onChange={(e) => setPersName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="sipho@contractor.co.za"
                      value={persEmail}
                      onChange={(e) => setPersEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company Role *</label>
                      <select
                        value={persDesignation}
                        onChange={(e) => setPersDesignation(e.target.value)}
                        className="w-full px-2 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none cursor-pointer"
                      >
                        {Array.from(new Set(ROLE_OPTIONS.map(o => o.group))).map(group => (
                          <optgroup key={group} label={group} className="text-[10px] uppercase font-bold text-slate-500">
                            {ROLE_OPTIONS.filter(o => o.group === group).map(opt => (
                              <option key={opt.value} value={opt.label} className="text-xs font-medium text-slate-800">
                                {opt.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Department *</label>
                      <select
                        value={persDepartment}
                        onChange={(e) => setPersDepartment(e.target.value)}
                        className="w-full px-2 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none cursor-pointer"
                      >
                        {departmentsList.map(d => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone Number (Optional)</label>
                    <input
                      type="tel"
                      placeholder="+27 82 123 4567"
                      value={persPhone}
                      onChange={(e) => setPersPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 px-1 py-1">
                    <input
                      id="isCompanyAdminCheck"
                      type="checkbox"
                      checked={persIsCompanyAdmin}
                      onChange={(e) => setPersIsCompanyAdmin(e.target.checked)}
                      className="w-4 h-4 text-[#FF9F1C] border-slate-300 rounded focus:ring-[#FF9F1C] cursor-pointer"
                    />
                    <label htmlFor="isCompanyAdminCheck" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                      Company Administrator Role
                    </label>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 leading-relaxed">
                    <p className="font-semibold text-[#07182E] mb-1">Invitation & Project Access Protocol:</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-slate-500">
                      <li>A secure invitation link with a 72-hour validity token will be prepared.</li>
                      <li>The user will remain in <strong>"Invitation Pending"</strong> status until they register.</li>
                      <li>Project assignments and specific project roles are configured under the <strong>Project Access</strong> tab.</li>
                    </ul>
                  </div>
                </fieldset>

                <button
                  type="submit"
                  disabled={isActionLoading || !hasManagerPermission}
                  className="w-full py-2.5 bg-[#FF9F1C] hover:bg-[#FFB020] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  Add User & Send Invitation Link
                </button>
              </form>
            </div>
          )}

          {/* Personnel Table & Search */}
          <div className="lg:col-span-2 bg-white p-6 border border-[#E2E8F0] rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-widest">
                  Personnel Directory ({filteredPersonnel.length})
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Active company accounts and pending user invitations
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name, role, email..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none w-44 sm:w-56"
                  />
                </div>

                <select
                  value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="pending">Invitation Pending</option>
                  <option value="suspended">Suspended / Inactive</option>
                  <option value="admin">System / Company Admins</option>
                </select>

                {hasManagerPermission && (
                  <button
                    type="button"
                    onClick={() => setIsBulkInviteOpen(true)}
                    className="px-3 py-1.5 bg-[#FF9F1C] hover:bg-[#FFB020] text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Bulk Invite</span>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2.5 max-h-[520px] overflow-y-auto">
              {filteredPersonnel.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl">
                  <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">No personnel records found</p>
                  <p className="text-[10px] text-slate-400 mt-1">Use the "Add User" form to invite real team members.</p>
                </div>
              ) : (
                filteredPersonnel.map((p: any) => {
                  const assignedProjsCount = (projectAssignments || []).filter((a: any) => (a.company_member_id === p.id || a.profile_id === p.id)).length;
                  const isPending = p.status === "pending" || p.status === "invited";
                  const isDeactivated = p.status === "deactivated" || p.status === "suspended" || p.is_active === false;
                  const isSystemAdmin = p.is_company_admin || p.role === "System Administrator" || p.designation === "System Administrator" || p.role === "Systems Administrator" || p.designation === "Systems Administrator";

                  return (
                    <div key={p.id} className="p-3.5 bg-slate-50/50 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm ${
                          isSystemAdmin ? "bg-[#FF9F1C]" : "bg-[#102846]"
                        }`}>
                          {p.full_name ? p.full_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("") : "U"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-[#07182E] text-xs">{p.full_name}</p>
                            {isSystemAdmin && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-800 flex items-center gap-0.5">
                                <Shield className="w-2.5 h-2.5" /> System Admin
                              </span>
                            )}
                            {isPending ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5 text-amber-600" /> Invitation Pending
                              </span>
                            ) : isDeactivated ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-slate-200 text-slate-700">
                                Deactivated
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#64748B] font-semibold mt-0.5">
                            {getRoleLabel(p.designation || p.role)} &bull; {p.department || "Engineering"} &bull; <span className="font-mono">{p.email}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-bold">
                          {assignedProjsCount} Project(s)
                        </span>

                        {isPending && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleResendInvite(p)}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                              title="Resend & copy secure invitation link"
                            >
                              {copiedInviteId === p.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Send className="w-3 h-3 text-[#FF9F1C]" />
                                  <span className="hidden sm:inline">Resend Link</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const token = p.secure_token;
                                const url = token 
                                  ? `${window.location.origin}${window.location.pathname}#/join?token=${token}`
                                  : `${window.location.origin}${window.location.pathname}#/register?email=${encodeURIComponent(p.email)}`;
                                handleSendEmailInvite(p.email, p.full_name, url);
                              }}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                              title="Send invitation via Email"
                            >
                              <Mail className="w-3.5 h-3.5 text-[#102846]" />
                            </button>
                          </div>
                        )}

                        <button
                          onClick={() => handleEditPersonnel(p)}
                          disabled={!hasManagerPermission}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#FF9F1C] hover:bg-amber-50 cursor-pointer transition-all"
                          title="Edit User Profile"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        {!isSystemAdmin && p.id !== profile?.id ? (
                          <button
                            onClick={() => handleDeletePersonnel(p)}
                            disabled={!hasManagerPermission}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 cursor-pointer transition-all"
                            title="Deactivate & remove user (historical records preserved)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="p-1.5 text-slate-300 cursor-not-allowed" title="System Administrator account protected">
                            <Lock className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 4: ROLES & PERMISSIONS                 */}
      {/* ========================================== */}
      {activeTab === "roles" && (
        <RolesAndPermissionsTab
          companyPersonnel={companyPersonnel}
          activeCompany={activeCompany}
          profile={profile}
          hasManagerPermission={hasManagerPermission}
          setSuccessMsg={setSuccessMsg}
          setErrorMsg={setErrorMsg}
        />
      )}

      {/* ========================================== */}
      {/* TAB 5: DEPARTMENTS                         */}
      {/* ========================================== */}
      {activeTab === "departments" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Add Department */}
          <div className="bg-white p-6 border border-[#E2E8F0] rounded-2xl shadow-sm space-y-4 h-fit">
            <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-widest flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-[#FF9F1C]" /> Add Corporate Department
            </h3>
            <form onSubmit={handleAddDepartment} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Department Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Geotechnical & Surveying"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Department Code</label>
                <input
                  type="text"
                  placeholder="e.g. GEO"
                  value={newDeptCode}
                  onChange={(e) => setNewDeptCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Head of Department</label>
                <select
                  value={newDeptHead}
                  onChange={(e) => setNewDeptHead(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none cursor-pointer"
                >
                  {ROLE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.label}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#FF9F1C] hover:bg-[#FFB020] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                Create Department
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* Department Directory Cards */}
          <div className="lg:col-span-2 bg-white p-6 border border-[#E2E8F0] rounded-2xl shadow-sm space-y-4 min-w-0">
            <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-widest">
              Organizational Departments ({departmentsList.length})
            </h3>
            {departmentsList.length === 0 ? (
              <div className="p-8 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 bg-slate-50/50">
                <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <div className="font-bold text-slate-600">No departments configured yet.</div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Use the &quot;Add Corporate Department&quot; form on the left to establish organisational divisions.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {departmentsList.map(dept => {
                  const memberCount = (companyPersonnel || []).filter((p: any) => p.department === dept.name).length;
                  return (
                    <div key={dept.id} className="p-4 border border-slate-200 rounded-xl hover:border-[#FF9F1C]/40 transition-all bg-white flex flex-col justify-between space-y-3 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded shrink-0">
                            {dept.code}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600 shrink-0">{memberCount} Members</span>
                        </div>
                        <h4 className="font-bold text-[#07182E] text-sm mt-2 break-words">{dept.name}</h4>
                        <p className="text-[11px] text-[#64748B] mt-0.5 truncate">Head: <strong>{dept.head}</strong></p>
                      </div>

                      <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-[10px] text-slate-500 font-semibold gap-2 min-w-0">
                        <span className="shrink-0">Annual Budget:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[#07182E] font-bold truncate">{dept.budget}</span>
                          <button
                            onClick={() => handleDeleteDepartment(dept.id)}
                            className="text-red-400 hover:text-red-600 p-1 cursor-pointer"
                            title="Remove Department"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 6: PROJECTS REGISTRY                   */}
      {/* ========================================== */}
      {activeTab === "projects" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          {/* Create Project */}
          <div className="lg:col-span-5 xl:col-span-4 bg-white p-5 sm:p-6 border border-[#E2E8F0] rounded-2xl shadow-sm space-y-4 h-fit">
            <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-widest flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-[#FF9F1C]" /> Create Project
            </h3>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Durban Harbour Expansion"
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="min-w-0">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">Contract Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DH-01"
                    value={projCode}
                    onChange={(e) => setProjCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">Contract #</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CON-2026-99"
                    value={projNum}
                    onChange={(e) => setProjNum(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="min-w-0">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">Client Organization</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Transnet Corp"
                    value={projClient}
                    onChange={(e) => setProjClient(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">Location</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Durban Harbour"
                    value={projLocation}
                    onChange={(e) => setProjLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="min-w-0">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">Award Value</label>
                  <input
                    type="number"
                    required
                    placeholder="12000000"
                    value={projValue}
                    onChange={(e) => setProjValue(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">Currency</label>
                  <select
                    value={projCurrency}
                    onChange={(e) => setProjCurrency(e.target.value)}
                    className="w-full px-2 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none cursor-pointer truncate"
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.symbol})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">Contract Type</label>
                  <select
                    value={projType}
                    onChange={(e) => setProjType(e.target.value)}
                    className="w-full px-2 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none cursor-pointer truncate"
                  >
                    {CONTRACT_FRAMEWORKS.map((framework, idx) => (
                      <option key={`${framework}-${idx}`} value={framework}>{framework}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isActionLoading}
                className="w-full py-2.5 bg-[#FF9F1C] hover:bg-[#FFB020] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Establish Project
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* Active Projects Operational Table */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            <ProjectsOperationalTable
              projects={allProjects}
              activeProjectId={activeProject?.id}
              onSelectProject={onProjectChange ? (p) => onProjectChange(p) : undefined}
              onEditProject={canEditProject ? (p) => handleOpenEditProject(p) : undefined}
              onDeleteProject={canDeleteProject ? (p) => setDeletingProject(p) : undefined}
              selectedCurrency={regionalCurrencyCode || "ZAR"}
            />
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 7: PROJECT ACCESS (TEAM MATRIX)        */}
      {/* ========================================== */}
      {activeTab === "assignments" && (
        <div className="bg-white border border-[#E2E8F0] p-6 rounded-2xl shadow-sm space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-bold text-[#07182E] uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#FF9F1C]" />
                Project Access & Multi-Project Role Alignment
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Assign users to multiple projects with project-specific roles: User → Company Role → Project → Project Role.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#07182E] font-bold shrink-0">Focus Project:</span>
              <select
                value={selectedProjId}
                onChange={(e) => handleSelectProjectForMatrix(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-bold text-slate-700 focus:border-[#FF9F1C] outline-none cursor-pointer"
              >
                {companyProjects?.map((proj: any) => (
                  <option key={proj.id} value={proj.id}>
                    [{proj.code || proj.contract_code}] {proj.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedProjId ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Checklist of Personnel with project role & access status */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-widest">
                  Assign Personnel to Focus Project
                </h4>
                <div className="space-y-2 max-h-[420px] overflow-y-auto">
                  {tenantPersonnel && tenantPersonnel.length > 0 ? (
                    tenantPersonnel.map((p: any) => {
                      const isChecked = assignedPersIDs.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleTogglePersID(p.id)}
                          className={`p-3 border rounded-xl flex items-center justify-between transition-all ${
                            isChecked
                              ? "border-[#FF9F1C] bg-[#FF9F1C]/5 shadow-sm cursor-pointer"
                              : "border-[#E2E8F0] hover:bg-slate-50 cursor-pointer"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              readOnly
                              className="h-4 w-4 rounded border-slate-300 text-[#FF9F1C] accent-[#FF9F1C]"
                            />
                            <div>
                              <p className="text-xs font-bold text-[#07182E]">{p.full_name}</p>
                              <p className="text-[10px] text-[#64748B] font-semibold">Company: {getRoleLabel(p.designation || p.role)}</p>
                            </div>
                          </div>

                          {isChecked && (
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <select
                                value={assignedPersRoles[p.id] || "Senior Engineer"}
                                onChange={(e) => {
                                  setAssignedPersRoles({
                                    ...assignedPersRoles,
                                    [p.id]: e.target.value
                                  });
                                }}
                                className="px-2 py-1 border border-slate-200 bg-white rounded-md text-[10px] font-bold text-slate-700 outline-none cursor-pointer focus:border-[#FF9F1C]"
                              >
                                {ROLE_OPTIONS.map(opt => (
                                  <option key={opt.value} value={opt.label}>{opt.label}</option>
                                ))}
                              </select>

                              <select
                                value={assignedPersStatuses[p.id] || "Active"}
                                onChange={(e) => {
                                  setAssignedPersStatuses({
                                    ...assignedPersStatuses,
                                    [p.id]: e.target.value as any
                                  });
                                }}
                                className="px-1.5 py-1 border border-slate-200 bg-white rounded-md text-[9px] font-bold text-emerald-700 outline-none cursor-pointer"
                              >
                                <option value="Active">Active</option>
                                <option value="Read-Only">Read-Only</option>
                                <option value="Suspended">Suspended</option>
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-[#64748B] text-center py-8">
                      No personnel registered for this company. Only the System Administrator or invited personnel will appear here.
                    </p>
                  )}
                </div>
              </div>

              {/* Summary of Matrix for Target Project */}
              <div className="space-y-4 p-5 bg-slate-50/50 border border-[#E2E8F0] rounded-2xl flex flex-col justify-between h-fit min-h-[340px]">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-widest">
                    Assigned Project Matrix Summary ({assignedPersIDs.length})
                  </h4>
                  <div className="space-y-2 max-h-[260px] overflow-y-auto">
                    {assignedPersIDs.length > 0 ? (
                      assignedPersIDs.map(pid => {
                        const p = tenantPersonnel.find((x: any) => x.id === pid || x.profile_id === pid);
                        return (
                          <div key={pid} className="flex items-center justify-between text-xs p-2.5 bg-white border border-[#E2E8F0] rounded-xl shadow-xs">
                            <div>
                              <span className="font-bold text-[#07182E] block">{p?.full_name || "Unknown"}</span>
                              <span className="text-[9px] text-slate-400">Co: {getRoleLabel(p?.designation || p?.role)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF9F1C] bg-amber-50 px-2 py-0.5 rounded border border-amber-200 block">
                                {assignedPersRoles[pid] || "Senior Engineer"}
                              </span>
                              <span className="text-[9px] text-emerald-600 font-bold mt-0.5 block">
                                {assignedPersStatuses[pid] || "Active"} Access
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-[#64748B] text-center py-8">No personnel currently assigned to this project. Select personnel on the left to align this project's team matrix.</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleSaveAssignments}
                  disabled={isActionLoading || !hasManagerPermission}
                  className="w-full py-2.5 font-bold text-xs bg-[#FF9F1C] hover:bg-[#FFB020] text-white rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Project Access Matrix
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-8">Please create at least one project first.</p>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 8: COMPLIANCE                          */}
      {/* ========================================== */}
      {activeTab === "compliance" && (
        <ComplianceTabContent
          compProfileData={compProfileData}
          profile={profile}
          activeCompany={activeCompany}
          hasManagerPermission={hasManagerPermission}
          setSuccessMsg={setSuccessMsg}
          setErrorMsg={setErrorMsg}
        />
      )}

      {/* ========================================== */}
      {/* TAB 9: SECURITY CONTROLS                   */}
      {/* ========================================== */}
      {activeTab === "security" && (
        <div className="bg-white border border-[#E2E8F0] p-6 rounded-2xl shadow-sm space-y-6 animate-fadeIn">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-sm font-bold text-[#07182E] uppercase tracking-wider flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#FF9F1C]" />
              Enterprise Security & Tenant Isolation
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">Two-factor authentication enforcement, session duration, and data protection.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 border border-slate-200 rounded-xl space-y-4">
              <h4 className="text-xs font-black text-[#07182E] uppercase tracking-wider">Authentication Policies</h4>
              
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#07182E] block">Enforce Two-Factor Authentication (2FA)</span>
                  <span className="text-[10px] text-slate-500">Require TOTP or SMS OTP for all company administrators and PMs</span>
                </div>
                <input
                  type="checkbox"
                  checked={securitySettings.twoFactorEnforced}
                  onChange={(e) => setSecuritySettings({ ...securitySettings, twoFactorEnforced: e.target.checked })}
                  className="w-4 h-4 text-[#FF9F1C] accent-[#FF9F1C] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#07182E] block">IP Whitelisting & Geofencing</span>
                  <span className="text-[10px] text-slate-500">Restrict access to verified company offices and project site IPs</span>
                </div>
                <input
                  type="checkbox"
                  checked={securitySettings.ipGeofencing}
                  onChange={(e) => setSecuritySettings({ ...securitySettings, ipGeofencing: e.target.checked })}
                  className="w-4 h-4 text-[#FF9F1C] accent-[#FF9F1C] cursor-pointer"
                />
              </div>
            </div>

            <div className="p-5 border border-slate-200 rounded-xl space-y-4">
              <h4 className="text-xs font-black text-[#07182E] uppercase tracking-wider">Session & Identity Governance</h4>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Session Inactivity Timeout</label>
                <select
                  value={securitySettings.sessionTimeoutMins}
                  onChange={(e) => setSecuritySettings({ ...securitySettings, sessionTimeoutMins: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={60}>60 Minutes (Standard)</option>
                  <option value={480}>8 Hours (Shift Duration)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Data Residency & Tenant Key</label>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-600 truncate">
                  RSA-4096-AES256-GCM / {activeCompany?.id || "org_default"}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setSuccessMsg("Security governance policies successfully updated.")}
              className="px-4 py-2 bg-[#FF9F1C] hover:bg-[#FFB020] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              Update Security Policies
            </button>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 10: AUDIT LOG                          */}
      {/* ========================================== */}
      {activeTab === "audit" && (
        <div className="bg-white border border-[#E2E8F0] p-6 rounded-2xl shadow-sm space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-bold text-[#07182E] uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#FF9F1C]" />
                Immutable System Audit Trail
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">Comprehensive chronological ledger of all administrative events and profile actions.</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter logs by actor, action..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium focus:border-[#FF9F1C] outline-none w-56"
                />
              </div>

              <select
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 bg-white rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">All Results ({auditLogs.length})</option>
                <option value="success">Success Only</option>
                <option value="denied">Access Denied</option>
                <option value="failed">Failed Actions</option>
              </select>

              <button
                onClick={() => {
                  const csvContent = "data:text/csv;charset=utf-8," + 
                    "Time,Actor,Action,Resource,Status,IP\n" + 
                    auditLogs.map(e => `"${e.time}","${e.actor}","${e.action}","${e.resource}","${e.status}","${e.ip}"`).join("\n");
                  const encodedUri = encodeURI(csvContent);
                  const link = document.createElement("a");
                  link.setAttribute("href", encodedUri);
                  link.setAttribute("download", `audit_log_${new Date().toISOString().slice(0, 10)}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export Audit CSV
              </button>
            </div>
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-8 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 bg-slate-50/50">
              <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <div className="font-bold text-slate-600">No audit logs found matching criteria.</div>
              <p className="text-[11px] text-slate-400 mt-1">
                Security and operational actions across the platform will be logged here in real-time.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto shadow-xs">
              <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                <thead>
                  <tr className="bg-slate-50 text-[#07182E] font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Actor</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Target Resource</th>
                    <th className="p-3">IP Address</th>
                    <th className="p-3 text-right">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 font-medium">
                  {auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">{log.time}</td>
                      <td className="p-3 font-bold text-[#07182E] truncate max-w-[140px]">{log.actor}</td>
                      <td className="p-3 text-slate-800 font-medium break-words max-w-[220px]">{log.action}</td>
                      <td className="p-3 text-slate-600 font-mono text-[11px] truncate max-w-[120px]">{log.resource}</td>
                      <td className="p-3 text-slate-400 font-mono text-[10px] whitespace-nowrap">{log.ip}</td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                          log.status === "Success" ? "bg-emerald-100 text-emerald-800" :
                          log.status === "Denied" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit Project Modal / Drawer */}
      {editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/10 text-[#FF9F1C] rounded-lg">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#07182E]">Edit Project Details</h3>
                  <p className="text-xs text-slate-500">
                    ID: <span className="font-mono">{editingProject.id}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingProject(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditProject} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  required
                  value={editProjName}
                  onChange={(e) => setEditProjName(e.target.value)}
                  placeholder="e.g. Durban Harbour Expansion"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Contract Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={editProjCode}
                    onChange={(e) => setEditProjCode(e.target.value)}
                    placeholder="e.g. DH-01"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Contract Number
                  </label>
                  <input
                    type="text"
                    value={editProjNum}
                    onChange={(e) => setEditProjNum(e.target.value)}
                    placeholder="e.g. CON-2026-99"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Client Organization
                  </label>
                  <input
                    type="text"
                    value={editProjClient}
                    onChange={(e) => setEditProjClient(e.target.value)}
                    placeholder="e.g. Transnet Co"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Execution Location
                  </label>
                  <input
                    type="text"
                    value={editProjLocation}
                    onChange={(e) => setEditProjLocation(e.target.value)}
                    placeholder="e.g. Durban Harbour, KZN"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Award Value
                  </label>
                  <input
                    type="number"
                    value={editProjValue}
                    onChange={(e) => setEditProjValue(e.target.value)}
                    placeholder="12000000"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Currency
                  </label>
                  <select
                    value={editProjCurrency}
                    onChange={(e) => setEditProjCurrency(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none cursor-pointer"
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code} ({c.symbol})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Contract Framework
                  </label>
                  <select
                    value={editProjType}
                    onChange={(e) => setEditProjType(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none cursor-pointer"
                  >
                    {CONTRACT_FRAMEWORKS.map((framework, idx) => (
                      <option key={`${framework}-${idx}`} value={framework}>{framework}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Contract Manager
                  </label>
                  <input
                    type="text"
                    value={editProjManager}
                    onChange={(e) => setEditProjManager(e.target.value)}
                    placeholder="e.g. Johan van der Merwe"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Project Status
                  </label>
                  <select
                    value={editProjStatus}
                    onChange={(e) => setEditProjStatus(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="Tender">Tender / Bidding</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Completed">Completed</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Physical Progress (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editProjProgress}
                    onChange={(e) => setEditProjProgress(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={editProjStartDate}
                    onChange={(e) => setEditProjStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    End / Completion Date
                  </label>
                  <input
                    type="date"
                    value={editProjEndDate}
                    onChange={(e) => setEditProjEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionLoading}
                  className="px-5 py-2 bg-[#FF9F1C] hover:bg-[#FFB020] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {deletingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Project?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  This will permanently delete <strong className="text-slate-800 font-semibold">"{deletingProject.name}"</strong> (ID: <span className="font-mono">{deletingProject.id}</span>) and its associated project data. This action cannot be undone.
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Code:</span>
                  <span className="font-mono font-bold text-slate-700">{deletingProject.contract_code || deletingProject.code || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Client:</span>
                  <span className="font-medium text-slate-700">{deletingProject.client_organization || deletingProject.client || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="font-medium text-slate-700">{deletingProject.status || "Active"}</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleConfirmDeleteProject}
                  disabled={isActionLoading}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  Delete Project Permanently
                </button>
                <button
                  type="button"
                  onClick={handleArchiveProjectInstead}
                  disabled={isActionLoading}
                  className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Archive Project Instead (Recommended)
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingProject(null)}
                  className="w-full py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk CSV Employee Invitation Modal */}
      <BulkInviteCsvModal
        isOpen={isBulkInviteOpen}
        onClose={() => setIsBulkInviteOpen(false)}
        activeCompany={activeCompany}
        allProjects={allProjects}
        departmentsList={departmentsList}
        onSuccess={async () => {
          if (activeCompany?.id) {
            await loadCompanyMembers(activeCompany.id);
            await onRefetchTenant();
          }
        }}
        setIsActionLoading={setIsActionLoading}
        setSuccessMsg={setSuccessMsg}
        setErrorMsg={setErrorMsg}
      />
    </div>
  );
}
