import React, { useState } from "react";
import { 
  Building2, 
  User, 
  Mail, 
  Phone, 
  Lock, 
  Globe, 
  MapPin, 
  DollarSign, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Shield, 
  FileText, 
  Layers, 
  Check, 
  Sparkles, 
  Clock, 
  AlertCircle,
  Users,
  Compass,
  Briefcase,
  Loader2
} from "lucide-react";
import { REGION_CONFIGS } from "../../config/countries";
import { DEFAULT_DEPARTMENTS, CONTRACT_FRAMEWORK_OPTIONS, DepartmentConfig } from "../../services/tenantService";



interface CompanyOnboardingWizardProps {
  onSubmitCompany: (details: any) => Promise<void>;
  initialUser?: {
    id: string;
    email: string;
    fullName?: string;
  } | null;
  onCompleted?: (createdTenant: any, goToInvite?: boolean) => void;
  onComplete?: (createdTenant: any, adminUser?: any) => void;
  onCancel?: () => void;
  onSwitchToLogin?: () => void;
  onSwitchToJoin?: () => void;
}

const ORGANISATION_TYPES = [
  "Private Company",
  "Public Company",
  "Government Agency",
  "State-Owned Enterprise",
  "Partnership",
  "Joint Venture",
  "Engineering Consultancy",
  "Construction Contractor",
  "Developer",
  "Client Organisation",
  "NGO",
  "Other"
];

const INDUSTRY_OPTIONS = [
  "Construction",
  "Civil Engineering",
  "Infrastructure",
  "Mining",
  "Energy",
  "Water",
  "Roads",
  "Rail",
  "Buildings",
  "Oil & Gas",
  "Consulting Engineering",
  "Project Management",
  "Government Infrastructure",
  "Other"
];

const CURRENCIES = [
  { code: "TZS", name: "Tanzanian Shilling (TZS)", symbol: "TSh" },
  { code: "ZAR", name: "South African Rand (ZAR)", symbol: "R" },
  { code: "USD", name: "US Dollar (USD)", symbol: "$" },
  { code: "EUR", name: "Euro (EUR)", symbol: "€" },
  { code: "GBP", name: "British Pound (GBP)", symbol: "£" },
  { code: "AED", name: "UAE Dirham (AED)", symbol: "د.إ" },
  { code: "SAR", name: "Saudi Riyal (SAR)", symbol: "﷼" },
  { code: "KES", name: "Kenyan Shilling (KES)", symbol: "KSh" },
  { code: "UGX", name: "Ugandan Shilling (UGX)", symbol: "USh" },
  { code: "NGN", name: "Nigerian Naira (NGN)", symbol: "₦" },
  { code: "GHS", name: "Ghanaian Cedi (GHS)", symbol: "GH₵" },
  { code: "BWP", name: "Botswana Pula (BWP)", symbol: "P" },
  { code: "NAD", name: "Namibian Dollar (NAD)", symbol: "N$" },
  { code: "ZMW", name: "Zambian Kwacha (ZMW)", symbol: "ZK" }
];

export default function CompanyOnboardingWizard({
  initialUser,
  onSubmitCompany,
  onCompleted,
  onComplete,
  onCancel,
  onSwitchToLogin,
  onSwitchToJoin
}: CompanyOnboardingWizardProps) {
  const [step, setStep] = useState<number>(initialUser ? 2 : 1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 1: Admin Account
  const [firstName, setFirstName] = useState<string>(initialUser?.fullName?.split(" ")[0] || "");
  const [lastName, setLastName] = useState<string>(initialUser?.fullName?.split(" ").slice(1).join(" ") || "");
  const [workEmail, setWorkEmail] = useState<string>(initialUser?.email || "");
  const [adminPhone, setAdminPhone] = useState<string>("");
  const [jobTitle, setJobTitle] = useState<string>("Managing Director");
  const [adminDepartment, setAdminDepartment] = useState<string>("Executive");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [mfaEnabled, setMfaEnabled] = useState<boolean>(false);

  // Step 2: Company Identity
  const [legalName, setLegalName] = useState<string>("");
  const [tradingName, setTradingName] = useState<string>("");
  const [country, setCountry] = useState<string>("South Africa");
  const [registrationNumber, setRegistrationNumber] = useState<string>("");
  const [organisationType, setOrganisationType] = useState<string>("Private Company");
  const [industry, setIndustry] = useState<string>("Civil Engineering");

  // Step 3: Tax & Regulatory
  const [taxNumber, setTaxNumber] = useState<string>("");
  const [vatNumber, setVatNumber] = useState<string>("");
  const [isVatRegistered, setIsVatRegistered] = useState<boolean>(true);
  const [businessLicence, setBusinessLicence] = useState<string>("");
  const [contractorReg, setContractorReg] = useState<string>("");
  const [engineeringReg, setEngineeringReg] = useState<string>("");

  // Step 4: Company Contact & Address
  const [companyEmail, setCompanyEmail] = useState<string>("");
  const [companyPhone, setCompanyPhone] = useState<string>("");
  const [website, setWebsite] = useState<string>("");
  // Registered address
  const [regAddr1, setRegAddr1] = useState<string>("");
  const [regAddr2, setRegAddr2] = useState<string>("");
  const [regCity, setRegCity] = useState<string>("");
  const [regState, setRegState] = useState<string>("");
  const [regPostal, setRegPostal] = useState<string>("");
  const [regCountry, setRegCountry] = useState<string>("South Africa");
  // Corporate address
  const [sameAsRegistered, setSameAsRegistered] = useState<boolean>(true);
  const [corpAddr1, setCorpAddr1] = useState<string>("");
  const [corpAddr2, setCorpAddr2] = useState<string>("");
  const [corpCity, setCorpCity] = useState<string>("");
  const [corpState, setCorpState] = useState<string>("");
  const [corpPostal, setCorpPostal] = useState<string>("");
  const [corpCountry, setCorpCountry] = useState<string>("South Africa");

  // Step 5: Operating Settings
  const [defaultCurrency, setDefaultCurrency] = useState<string>("ZAR");
  const [financialYearStart, setFinancialYearStart] = useState<string>("March");
  const [timezone, setTimezone] = useState<string>("Africa/Johannesburg");
  const [dateFormat, setDateFormat] = useState<string>("DD/MM/YYYY");
  const [measurementSystem, setMeasurementSystem] = useState<"metric" | "imperial">("metric");
  const [primaryLanguage, setPrimaryLanguage] = useState<string>("English");

  // Step 6: Departments & Contracts
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([
    "FIDIC Red Book",
    "NEC4 Option A (Priced Contract with Activity Schedule)",
    "GCC 2015 (General Conditions of Contract for Construction Works)"
  ]);
  const [departments, setDepartments] = useState<DepartmentConfig[]>(DEFAULT_DEPARTMENTS);

  // Sync country defaults when country changes
  const handleCountryChange = (selectedCountryName: string) => {
    setCountry(selectedCountryName);
    setRegCountry(selectedCountryName);
    setCorpCountry(selectedCountryName);

    // Find region config
    const regionEntry = Object.values(REGION_CONFIGS).find(r => r.countryName === selectedCountryName);
    if (regionEntry) {
      setDefaultCurrency(regionEntry.currency);
      setTimezone(regionEntry.timezone);
      setMeasurementSystem(regionEntry.measurementSystem);
    }
  };

  const toggleFramework = (framework: string) => {
    setSelectedFrameworks(prev => 
      prev.includes(framework) 
        ? prev.filter(f => f !== framework)
        : [...prev, framework]
    );
  };

  const toggleDepartment = (deptId: string) => {
    setDepartments(prev => 
      prev.map(d => d.id === deptId ? { ...d, enabled: !d.enabled } : d)
    );
  };

  const renameDepartment = (deptId: string, newName: string) => {
    setDepartments(prev => 
      prev.map(d => d.id === deptId ? { ...d, name: newName } : d)
    );
  };

  // Step Validation
  const validateStep = (currentStep: number): boolean => {
    setErrorMsg(null);
    if (currentStep === 1) {
      if (!firstName.trim() || !lastName.trim()) {
        setErrorMsg("Please enter both First Name and Last Name.");
        return false;
      }
      if (!workEmail.trim() || !workEmail.includes("@")) {
        setErrorMsg("Please enter a valid business work email.");
        return false;
      }
      if (!initialUser && password.length < 6) {
        setErrorMsg("Password must be at least 6 characters.");
        return false;
      }
      if (!initialUser && password !== confirmPassword) {
        setErrorMsg("Passwords do not match.");
        return false;
      }
    } else if (currentStep === 2) {
      if (!legalName.trim()) {
        setErrorMsg("Company Legal Name is required.");
        return false;
      }
      if (!registrationNumber.trim()) {
        setErrorMsg("Company Registration Number is required.");
        return false;
      }
    } else if (currentStep === 3) {
      if (!taxNumber.trim()) {
        setErrorMsg("Tax Identification Number is required.");
        return false;
      }
      if (isVatRegistered && !vatNumber.trim()) {
        setErrorMsg("Please provide your VAT Registration Number or set VAT Registered to No.");
        return false;
      }
    } else if (currentStep === 4) {
      if (!companyEmail.trim() || !companyEmail.includes("@")) {
        setErrorMsg("Company Email Address is required.");
        return false;
      }
      if (!regAddr1.trim() || !regCity.trim()) {
        setErrorMsg("Registered Address Line 1 and City are required.");
        return false;
      }
    } else if (currentStep === 5) {
      if (!defaultCurrency) {
        setErrorMsg("Please select a Default Currency.");
        return false;
      }
    } else if (currentStep === 6) {
      if (selectedFrameworks.length === 0) {
        setErrorMsg("Please select at least one contract framework.");
        return false;
      }
      const enabledDepts = departments.filter(d => d.enabled);
      if (enabledDepts.length === 0) {
        setErrorMsg("Please enable at least one company department.");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setErrorMsg(null);
    setStep(prev => Math.max(initialUser ? 2 : 1, prev - 1));
  };

  // Create Company Final Execution
  const handleCreateCompanySubmit = async () => {
    if (isLoading || ![2,3,4,5,6].every(validateStep)) return;
    if (!initialUser?.id) { setErrorMsg("Sign in before establishing a company."); return; }
    setIsLoading(true); setErrorMsg(null);
    try {
      await onSubmitCompany({
          legal_name: legalName.trim(),
          trading_name: tradingName.trim() || legalName.trim(),
          registration_number: registrationNumber.trim(),
          country,
          organisation_type: organisationType,
          industry,
          tax_number: taxNumber.trim(),
          vat_number: vatNumber.trim() || undefined,
          is_vat_registered: isVatRegistered,
          business_licence_number: businessLicence.trim() || undefined,
          contractor_registration_number: contractorReg.trim() || undefined,
          engineering_registration_number: engineeringReg.trim() || undefined,
          email: companyEmail.trim(),
          phone: companyPhone.trim(),
          website: website.trim() || undefined,
          registered_address: {
            address_line_1: regAddr1.trim(),
            address_line_2: regAddr2.trim() || undefined,
            city: regCity.trim(),
            state_province_region: regState.trim() || "Province",
            postal_code: regPostal.trim() || "0000",
            country: regCountry
          },
          corporate_address: {
            same_as_registered: sameAsRegistered,
            address_line_1: sameAsRegistered ? regAddr1.trim() : corpAddr1.trim(),
            address_line_2: sameAsRegistered ? regAddr2.trim() : corpAddr2.trim(),
            city: sameAsRegistered ? regCity.trim() : corpCity.trim(),
            state_province_region: sameAsRegistered ? regState.trim() : corpState.trim(),
            postal_code: sameAsRegistered ? regPostal.trim() : corpPostal.trim(),
            country: sameAsRegistered ? regCountry : corpCountry
          },
          default_currency: defaultCurrency,
          financial_year_start: financialYearStart,
          timezone,
          date_format: dateFormat,
          measurement_system: measurementSystem,
          primary_language: primaryLanguage,
          contract_frameworks: selectedFrameworks,
          departments
        });
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Company setup could not be completed. Please retry.");
    } finally { setIsLoading(false); }
  };

  const stepsList = [
    { num: 1, label: "Your Account" },
    { num: 2, label: "Company Details" },
    { num: 3, label: "Tax & Registration" },
    { num: 4, label: "Company Address" },
    { num: 5, label: "Operating Settings" },
    { num: 6, label: "Departments & Contracts" },
    { num: 7, label: "Review & Create" }
  ];

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      {/* Progress Indicator (1 - 2 - 3 - 4 - 5 - 6 - 7) */}
      {step <= 7 && (
        <div className="mb-8">
          <div className="flex items-center justify-between relative max-w-2xl mx-auto mb-2">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-800 -translate-y-1/2 -z-0" />
            
            {stepsList.map(st => {
              const isCompleted = step > st.num;
              const isActive = step === st.num;

              return (
                <div key={st.num} className="flex flex-col items-center relative z-10">
                  <div
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs transition-all ${
                      isCompleted
                        ? "bg-amber-500 border-amber-500 text-slate-950 font-black"
                        : isActive
                        ? "bg-slate-900 border-amber-500 text-amber-400 ring-4 ring-amber-500/20 scale-110 font-black"
                        : "bg-slate-950 border-slate-800 text-slate-500"
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : st.num}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider mt-2 hidden sm:block text-center max-w-[80px] leading-tight ${
                    isActive ? "text-amber-400" : isCompleted ? "text-slate-300" : "text-slate-600"
                  }`}>
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="text-center sm:hidden mt-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
            Step {step} of 7: {stepsList[step - 1]?.label}
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs flex items-start gap-3 animate-fadeIn">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1 font-semibold">{errorMsg}</div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 1: YOUR ACCOUNT (SYSTEM ADMINISTRATOR SETUP)         */}
      {/* ========================================================= */}
      {step === 1 && (
        <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 sm:p-8 shadow-2xl animate-fadeIn space-y-6">
          <div>
            <div className="flex items-center gap-2 text-amber-500 text-xs font-black uppercase tracking-widest">
              <Shield className="w-4 h-4" />
              Step 1 — System Administrator Setup
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mt-1">Your Personal Account</h2>
            <p className="text-xs text-slate-400 mt-1">
              Establish the initial executive credentials for your organisation's Project Matrix workspace.
            </p>
          </div>

          {/* Read-Only Role Explanation Banner */}
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200">Assigned Role:</span>
                <span className="px-2.5 py-0.5 bg-amber-500 text-slate-950 font-black rounded-md text-[10px] uppercase tracking-wider">
                  System Administrator
                </span>
                <span className="text-[10px] text-slate-400 font-mono">(Automatic & Read-Only)</span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                As the first registered user for this organisation, you will automatically manage company configuration, users, roles, permissions, and invitations.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                First Name <span className="text-amber-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Sipho"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Last Name <span className="text-amber-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Nkosi"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Work Email Address <span className="text-amber-500">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="sipho.nkosi@matrix-civil.co.za"
                value={workEmail}
                onChange={(e) => setWorkEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Telephone (Optional)
              </label>
              <input
                type="tel"
                placeholder="+27 11 888 0199"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Job Title / Designation
              </label>
              <input
                type="text"
                placeholder="e.g. Managing Director / CEO"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Department
              </label>
              <select
                value={adminDepartment}
                onChange={(e) => setAdminDepartment(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-sm font-semibold"
              >
                <option value="Executive">Executive</option>
                <option value="Governance">Governance</option>
                <option value="Administration">Administration</option>
                <option value="Engineering">Engineering</option>
                <option value="Projects">Projects</option>
                <option value="Contracts">Contracts</option>
                <option value="Commercial">Commercial</option>
                <option value="Finance">Finance</option>
              </select>
            </div>
          </div>

          {!initialUser && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Password <span className="text-amber-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm font-semibold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Confirm Password <span className="text-amber-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm font-semibold"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            ) : <div />}

            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/10 flex items-center gap-1.5"
            >
              Continue to Company Details <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 2: COMPANY IDENTITY                                  */}
      {/* ========================================================= */}
      {step === 2 && (
        <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 sm:p-8 shadow-2xl animate-fadeIn space-y-6">
          <div>
            <div className="flex items-center gap-2 text-amber-500 text-xs font-black uppercase tracking-widest">
              <Building2 className="w-4 h-4" />
              Step 2 — Company Identity
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mt-1">Organisation Identity</h2>
            <p className="text-xs text-slate-400 mt-1">
              Define the legal entity and core registration details for the new tenant.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Company Legal Name <span className="text-amber-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Narmo Construction Limited"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Trading Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Narmo Civil Infrastructure"
                value={tradingName}
                onChange={(e) => setTradingName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Country of Registration <span className="text-amber-500">*</span>
              </label>
              <select
                value={country}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-sm font-semibold"
              >
                {Object.values(REGION_CONFIGS).map(rc => (
                  <option key={rc.countryCode} value={rc.countryName}>
                    {rc.flagEmoji} {rc.countryName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Company Registration Number <span className="text-amber-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 2026/012984/07 or 148902-T"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm font-semibold font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Organisation Type
              </label>
              <select
                value={organisationType}
                onChange={(e) => setOrganisationType(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-sm font-semibold"
              >
                {ORGANISATION_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Primary Industry
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-sm font-semibold"
              >
                {INDUSTRY_OPTIONS.map(ind => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/10 flex items-center gap-1.5"
            >
              Tax & Regulatory <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 3: TAX & REGULATORY INFORMATION                      */}
      {/* ========================================================= */}
      {step === 3 && (
        <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 sm:p-8 shadow-2xl animate-fadeIn space-y-6">
          <div>
            <div className="flex items-center gap-2 text-amber-500 text-xs font-black uppercase tracking-widest">
              <FileText className="w-4 h-4" />
              Step 3 — Tax & Regulatory
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mt-1">Tax & Statutory Data</h2>
            <p className="text-xs text-slate-400 mt-1">
              Configurable regulatory fields tailored for your jurisdiction in <strong className="text-white">{country}</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Tax Identification Number (TIN / Tax ID) <span className="text-amber-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 984019284 or ZA4051268493"
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm font-semibold font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                VAT Registered?
              </label>
              <div className="flex items-center gap-4 py-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-200">
                  <input
                    type="radio"
                    name="vatRegistered"
                    checked={isVatRegistered}
                    onChange={() => setIsVatRegistered(true)}
                    className="accent-amber-500"
                  />
                  Yes, VAT Registered
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-400">
                  <input
                    type="radio"
                    name="vatRegistered"
                    checked={!isVatRegistered}
                    onChange={() => setIsVatRegistered(false)}
                    className="accent-amber-500"
                  />
                  No
                </label>
              </div>
            </div>
          </div>

          {isVatRegistered && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                VAT Registration Number <span className="text-amber-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 4920192834 or VRN-2026-991"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm font-semibold font-mono"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Business Licence #
              </label>
              <input
                type="text"
                placeholder="e.g. BL-2026-081"
                value={businessLicence}
                onChange={(e) => setBusinessLicence(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Contractor Reg #
              </label>
              <input
                type="text"
                placeholder="e.g. CIDB / CRB-9CE"
                value={contractorReg}
                onChange={(e) => setContractorReg(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Engineering Board Reg
              </label>
              <input
                type="text"
                placeholder="e.g. ECSA / ERB-094"
                value={engineeringReg}
                onChange={(e) => setEngineeringReg(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm font-semibold"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/10 flex items-center gap-1.5"
            >
              Company Address <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 4: COMPANY CONTACT & ADDRESS                         */}
      {/* ========================================================= */}
      {step === 4 && (
        <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 sm:p-8 shadow-2xl animate-fadeIn space-y-6">
          <div>
            <div className="flex items-center gap-2 text-amber-500 text-xs font-black uppercase tracking-widest">
              <MapPin className="w-4 h-4" />
              Step 4 — Contact & Physical Address
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mt-1">Company Contact & Addresses</h2>
            <p className="text-xs text-slate-400 mt-1">
              Registered legal address and corporate operating headquarters.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Company Email <span className="text-amber-500">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="info@matrix-civil.co.za"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Telephone
              </label>
              <input
                type="tel"
                placeholder="+27 11 888 0199"
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Website
              </label>
              <input
                type="url"
                placeholder="https://matrix-civil.co.za"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm font-semibold"
              />
            </div>
          </div>

          {/* Registered Address */}
          <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Registered Legal Address
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Address Line 1 *"
                value={regAddr1}
                onChange={(e) => setRegAddr1(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
              <input
                type="text"
                placeholder="Address Line 2 (Building, Suite, Unit)"
                value={regAddr2}
                onChange={(e) => setRegAddr2(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="City *"
                value={regCity}
                onChange={(e) => setRegCity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
              <input
                type="text"
                placeholder="Province / Region"
                value={regState}
                onChange={(e) => setRegState(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
              <input
                type="text"
                placeholder="Postal Code"
                value={regPostal}
                onChange={(e) => setRegPostal(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
              <input
                type="text"
                value={regCountry}
                disabled
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-800 rounded-lg text-xs text-slate-400"
              />
            </div>
          </div>

          {/* Corporate Address */}
          <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Corporate / Head Office Address
              </h4>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-400">
                <input
                  type="checkbox"
                  checked={sameAsRegistered}
                  onChange={(e) => setSameAsRegistered(e.target.checked)}
                  className="accent-amber-500 rounded"
                />
                Same as Registered Address
              </label>
            </div>

            {!sameAsRegistered && (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Head Office Address Line 1"
                    value={corpAddr1}
                    onChange={(e) => setCorpAddr1(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="text"
                    placeholder="Address Line 2"
                    value={corpAddr2}
                    onChange={(e) => setCorpAddr2(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    placeholder="City"
                    value={corpCity}
                    onChange={(e) => setCorpCity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="text"
                    placeholder="Province / Region"
                    value={corpState}
                    onChange={(e) => setCorpState(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="text"
                    placeholder="Postal Code"
                    value={corpPostal}
                    onChange={(e) => setCorpPostal(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="text"
                    placeholder="Country"
                    value={corpCountry}
                    onChange={(e) => setCorpCountry(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/10 flex items-center gap-1.5"
            >
              Operating Settings <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 5: COMPANY OPERATING SETTINGS                        */}
      {/* ========================================================= */}
      {step === 5 && (
        <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 sm:p-8 shadow-2xl animate-fadeIn space-y-6">
          <div>
            <div className="flex items-center gap-2 text-amber-500 text-xs font-black uppercase tracking-widest">
              <DollarSign className="w-4 h-4" />
              Step 5 — Operating Settings
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mt-1">Tenant System Defaults</h2>
            <p className="text-xs text-slate-400 mt-1">
              Configure baseline currency, financial year cycle, timezone and measurement parameters.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Default Currency <span className="text-amber-500">*</span>
              </label>
              <select
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-sm font-semibold"
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                Central currency default. Individual projects may specify their own project award currencies.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Financial Year Start
              </label>
              <select
                value={financialYearStart}
                onChange={(e) => setFinancialYearStart(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-sm font-semibold"
              >
                {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-sm font-semibold font-mono"
              >
                <option value="Africa/Johannesburg">Africa/Johannesburg (UTC+2)</option>
                <option value="Africa/Dar_es_Salaam">Africa/Dar_es_Salaam (UTC+3)</option>
                <option value="Africa/Nairobi">Africa/Nairobi (UTC+3)</option>
                <option value="Africa/Lagos">Africa/Lagos (UTC+1)</option>
                <option value="Africa/Accra">Africa/Accra (UTC+0)</option>
                <option value="Africa/Cairo">Africa/Cairo (UTC+2)</option>
                <option value="Asia/Dubai">Asia/Dubai (UTC+4)</option>
                <option value="Asia/Riyadh">Asia/Riyadh (UTC+3)</option>
                <option value="Europe/London">Europe/London (UTC+0 / UTC+1)</option>
                <option value="America/New_York">America/New_York (UTC-5)</option>
                <option value="UTC">Universal Coordinated Time (UTC)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Date Format
              </label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-sm font-semibold font-mono"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 20/08/2026)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 08/20/2026)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Measurement System
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMeasurementSystem("metric")}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    measurementSystem === "metric"
                      ? "bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/10"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Metric (m, km, m³, t)
                </button>
                <button
                  type="button"
                  onClick={() => setMeasurementSystem("imperial")}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    measurementSystem === "imperial"
                      ? "bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/10"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Imperial (ft, mi, yd³, tn)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Primary Language
              </label>
              <select
                value={primaryLanguage}
                onChange={(e) => setPrimaryLanguage(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-sm font-semibold"
              >
                <option value="English">English</option>
                <option value="Swahili">Kiswahili</option>
                <option value="French">Français</option>
                <option value="Portuguese">Português</option>
                <option value="Arabic">العربية (Arabic)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/10 flex items-center gap-1.5"
            >
              Departments & Contracts <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 6: CONTRACT ENVIRONMENT & DEPARTMENTS                */}
      {/* ========================================================= */}
      {step === 6 && (
        <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 sm:p-8 shadow-2xl animate-fadeIn space-y-6">
          <div>
            <div className="flex items-center gap-2 text-amber-500 text-xs font-black uppercase tracking-widest">
              <Layers className="w-4 h-4" />
              Step 6 — Contracts & Structure
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mt-1">Contract Frameworks & Departments</h2>
            <p className="text-xs text-slate-400 mt-1">
              Select which standard forms of contract and initial departments to provision for your organization.
            </p>
          </div>

          {/* Contract Frameworks */}
          <div className="space-y-3">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Which contract frameworks does your organisation use? (Multi-select)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-850 rounded-xl bg-slate-950/60">
              {CONTRACT_FRAMEWORK_OPTIONS.map(f => {
                const isSelected = selectedFrameworks.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFramework(f)}
                    className={`p-2.5 rounded-lg border text-left text-xs font-semibold transition-all flex items-center justify-between ${
                      isSelected
                        ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                        : "bg-slate-900/50 border-slate-800/80 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span className="truncate pr-2">{f}</span>
                    {isSelected ? (
                      <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-500">
              These populate the company's initial Contract Master Data. Administrators can always add more frameworks later.
            </p>
          </div>

          {/* Initial Organisational Structure */}
          <div className="space-y-3 pt-2 border-t border-slate-850">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Initial Organisational Departments ({departments.filter(d => d.enabled).length} Enabled)
              </label>
              <span className="text-[10px] text-slate-500">Toggle or rename as needed</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1 border border-slate-850 rounded-xl bg-slate-950/60">
              {departments.map(d => (
                <div
                  key={d.id}
                  className={`p-2.5 rounded-lg border text-xs transition-all flex items-center justify-between ${
                    d.enabled
                      ? "bg-slate-900 border-slate-700 text-slate-200"
                      : "bg-slate-950/30 border-slate-850/40 text-slate-600 opacity-60"
                  }`}
                >
                  <input
                    type="text"
                    value={d.name}
                    disabled={!d.enabled}
                    onChange={(e) => renameDepartment(d.id, e.target.value)}
                    className="bg-transparent text-xs font-semibold focus:outline-none focus:text-amber-400 w-full"
                  />
                  <input
                    type="checkbox"
                    checked={d.enabled}
                    onChange={() => toggleDepartment(d.id)}
                    className="accent-amber-500 ml-2 rounded"
                    title={d.enabled ? "Disable Department" : "Enable Department"}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/10 flex items-center gap-1.5"
            >
              Review & Create Company <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 7: REVIEW & CREATE COMPANY                           */}
      {/* ========================================================= */}
      {step === 7 && (
        <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 sm:p-8 shadow-2xl animate-fadeIn space-y-6">
          <div>
            <div className="flex items-center gap-2 text-amber-500 text-xs font-black uppercase tracking-widest">
              <Sparkles className="w-4 h-4" />
              Step 7 — Final Review & Verification
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mt-1">Review & Establish Workspace</h2>
            <p className="text-xs text-slate-400 mt-1">
              Verify your company registration and administrator details before provisioning the new tenant.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* System Admin Summary */}
            <div className="p-4 bg-slate-950/70 border border-slate-850 rounded-xl space-y-2">
              <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" /> System Administrator
              </div>
              <div className="text-sm font-bold text-white">{firstName} {lastName}</div>
              <div className="text-xs text-slate-400">{workEmail}</div>
              <div className="text-xs text-slate-400">{jobTitle} • {adminDepartment}</div>
              <span className="inline-block px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono rounded">
                Initial Tenant Owner
              </span>
            </div>

            {/* Company Summary */}
            <div className="p-4 bg-slate-950/70 border border-slate-850 rounded-xl space-y-2">
              <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" /> Company Entity
              </div>
              <div className="text-sm font-bold text-white">{legalName}</div>
              <div className="text-xs text-slate-400">Reg: <strong className="text-slate-200">{registrationNumber}</strong></div>
              <div className="text-xs text-slate-400">{country} • {industry}</div>
              <div className="text-xs text-slate-400">TIN: <strong className="text-slate-200">{taxNumber}</strong></div>
            </div>
          </div>

          {/* Operating & Contract Summary */}
          <div className="p-4 bg-slate-950/70 border border-slate-850 rounded-xl space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-amber-500" /> Operating Setup & Master Data
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-300">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Default Currency</span>
                <strong>{defaultCurrency}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Financial Year</span>
                <strong>{financialYearStart}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Timezone</span>
                <strong className="truncate block">{timezone}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Departments</span>
                <strong>{departments.filter(d => d.enabled).length} Enabled</strong>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-850/60 text-xs text-slate-400">
              <span className="text-[10px] text-slate-500 block uppercase">Contract Frameworks:</span>
              <span className="text-amber-400 font-semibold">{selectedFrameworks.join(", ")}</span>
            </div>
          </div>

          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <div>
              <strong>Tenant Security Enforcement:</strong> An isolated, cryptographically bounded <code className="text-emerald-300">tenant_id</code> will be allocated to partition all personnel, projects, financial records, and invitations.
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={handleBack}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            
            <button
              type="button"
              onClick={handleCreateCompanySubmit}
              disabled={isLoading}
              className="px-8 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm uppercase tracking-wider rounded-xl transition-all shadow-xl shadow-amber-500/15 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Provisioning Tenant...</span>
                </>
              ) : (
                <>
                  <span>Create Company & Start Trial</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
