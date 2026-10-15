import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useUpdateWorkspaceMutation } from '../../store/api/workspaceApi';
import {
  useLazyGetGoogleAuthUrlQuery,
  useGetDiscoveredLocationsQuery,
  useImportLocationMutation,
} from '../../store/api/gbpApi';
import { useCreateLocationMutation } from '../../store/api/locationApi';
import { useLazyGetLocationAuditsQuery, useRunAuditMutation } from '../../store/api/auditApi';
import {
  Search,
  Building2,
  MapPin,
  CheckCircle2,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Globe,
  Sparkles,
  Lock,
  Star,
  Users,
  Check,
  AlertCircle,
  Plus,
  Phone,
  Compass,
} from 'lucide-react';

const POPULAR_CATEGORIES = [
  'Dentist',
  'Restaurant',
  'Plumber',
  'Law Firm',
  'Hair Salon',
  'Gym & Fitness',
  'Real Estate',
  'Auto Repair',
  'Health Clinic',
  'Retail Store',
];

export const OnboardingWizard: React.FC = () => {
  const navigate = useNavigate();
  const { user, activeWorkspace } = useSelector((state: RootState) => state.auth);
  const workspaceId = activeWorkspace?.id || '';

  const [updateWorkspace] = useUpdateWorkspaceMutation();
  const [triggerGetAuthUrl, { isFetching: isGettingAuthUrl }] = useLazyGetGoogleAuthUrlQuery();
  const [createLocation, { isLoading: isCreatingLocation }] = useCreateLocationMutation();
  const [importLocation, { isLoading: isImportingLocation }] = useImportLocationMutation();

  const isGbpConnected = (activeWorkspace as any)?.gbpConnectionStatus === 'connected';

  // Step state: 1 = Connect Google, 2 = Activate First Profile, 3 = Initial Audit & Setup
  const [step, setStep] = useState<number>(isGbpConnected ? 2 : 1);
  const [searchQuery, setSearchQuery] = useState('');

  // Manual fallback fields
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualCity, setManualCity] = useState('');
  const [manualState, setManualState] = useState('');
  const [manualCountry, setManualCountry] = useState('United States');
  const [manualPostal, setManualPostal] = useState('');
  const [manualCategory, setManualCategory] = useState('Dentist');
  const [manualPhone, setManualPhone] = useState('');
  const [manualWebsite, setManualWebsite] = useState('');

  // Form validation errors state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  // Audit state
  const [createdLocationId, setCreatedLocationId] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<any | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditRetry, setAuditRetry] = useState(0);
  const [getLocationAudits] = useLazyGetLocationAuditsQuery();
  const [runAudit] = useRunAuditMutation();

  // If GBP connected, fetch discovered locations
  const { data: discoveredLocations = [], isLoading: isDiscovering } = useGetDiscoveredLocationsQuery(
    workspaceId,
    { skip: !workspaceId || !isGbpConnected || step !== 2 }
  );

  // Validate individual field helper
  const validateField = (field: string, value: string): string => {
    const trimmed = value.trim();
    switch (field) {
      case 'manualName':
        if (!trimmed) return 'Business name is required.';
        if (trimmed.length < 2) return 'Business name must be at least 2 characters.';
        if (trimmed.length > 100) return 'Business name cannot exceed 100 characters.';
        if (/\d/.test(trimmed)) return 'Business name cannot contain numbers.';
        if (!/\p{L}/u.test(trimmed)) return 'Business name must include at least one letter.';
        return '';

      case 'manualAddress':
        if (!trimmed) return 'Street address is required.';
        if (trimmed.length < 3) return 'Please enter a valid street address.';
        return '';

      case 'manualCity':
        if (!trimmed) return 'City is required.';
        if (trimmed.length < 2) return 'Please enter a valid city.';
        if (/\d/.test(trimmed)) return 'City name cannot contain numbers.';
        return '';

      case 'manualPostal':
        if (trimmed && (trimmed.length < 3 || trimmed.length > 12)) {
          return 'Postal/ZIP code must be between 3 and 12 characters.';
        }
        return '';

      case 'manualPhone':
        if (trimmed && !/^[0-9+\-()\s.]{7,20}$/.test(trimmed)) {
          return 'Please enter a valid phone number.';
        }
        return '';

      case 'manualWebsite':
        if (trimmed && !/^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/.test(trimmed)) {
          return 'Please enter a valid website URL (e.g. www.example.com).';
        }
        return '';

      default:
        return '';
    }
  };

  const handleFieldChange = (field: string, value: string, setter: (v: string) => void) => {
    setter(value);
    if (touched[field]) {
      const errorMsg = validateField(field, value);
      setFieldErrors((prev) => ({ ...prev, [field]: errorMsg }));
    }
  };

  const handleBlur = (field: string, value: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errorMsg = validateField(field, value);
    setFieldErrors((prev) => ({ ...prev, [field]: errorMsg }));
  };

  // Handle Step 1: Connect with Google
  const handleConnectGoogle = async () => {
    setActionError(null);
    try {
      const res = await triggerGetAuthUrl(workspaceId).unwrap();
      const authUrl = (res as any)?.authUrl || (res as any)?.data?.authUrl;
      if (authUrl) {
        window.location.href = authUrl;
      } else {
        setActionError('Failed to initialize Google authentication URL.');
      }
    } catch (err: any) {
      setActionError(err?.data?.error?.message || 'Could not initiate Google connection.');
    }
  };

  // Handle Step 1: Skip Google Connection
  const handleSkipGoogle = async () => {
    try {
      await updateWorkspace({
        workspaceId,
        gbpConnectionStatus: 'skipped',
      }).unwrap();
    } catch (e) {}
    setStep(2);
  };

  // Handle Step 2: Select Discovered Location
  const handleSelectDiscovered = async (loc: any) => {
    setActionError(null);
    try {
      const imported = await importLocation({
        workspaceId,
        body: loc,
      }).unwrap();
      const locId = (imported as any)?._id || (imported as any)?.id;
      setCreatedLocationId(locId);
      setStep(3);
    } catch (err: any) {
      setActionError(err?.data?.error?.message || 'Failed to import Google listing.');
    }
  };

  // Handle Step 2: Manual Business Profile Creation
  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields touched
    setTouched({
      manualName: true,
      manualAddress: true,
      manualCity: true,
      manualPostal: true,
      manualPhone: true,
      manualWebsite: true,
    });

    const nameErr = validateField('manualName', manualName);
    const addrErr = validateField('manualAddress', manualAddress);
    const cityErr = validateField('manualCity', manualCity);
    const postalErr = validateField('manualPostal', manualPostal);
    const phoneErr = validateField('manualPhone', manualPhone);
    const webErr = validateField('manualWebsite', manualWebsite);

    const errors: Record<string, string> = {
      manualName: nameErr,
      manualAddress: addrErr,
      manualCity: cityErr,
      manualPostal: postalErr,
      manualPhone: phoneErr,
      manualWebsite: webErr,
    };

    setFieldErrors(errors);

    if (nameErr || addrErr || cityErr || postalErr || phoneErr || webErr) {
      setActionError('Please correct the errors in the form before proceeding.');
      return;
    }

    setActionError(null);

    try {
      let formattedWebsite = manualWebsite.trim();
      if (formattedWebsite && !/^https?:\/\//i.test(formattedWebsite)) {
        formattedWebsite = `https://${formattedWebsite}`;
      }

      const created = await createLocation({
        workspaceId,
        body: {
          name: manualName.trim(),
          address: manualAddress.trim(),
          city: manualCity.trim(),
          state: manualState.trim() || 'NY',
          country: manualCountry,
          postalCode: manualPostal.trim() || '10001',
          categories: [manualCategory],
          phone: manualPhone.trim() || undefined,
          website: formattedWebsite || undefined,
          status: 'active',
        },
      }).unwrap();

      const locId = (created as any)?._id || (created as any)?.id;
      setCreatedLocationId(locId);
      setStep(3);
    } catch (err: any) {
      setActionError(err?.data?.error?.message || 'Failed to save business profile.');
    }
  };

  // Step 3: Load the auto-audit created during profile setup, or run one if it failed
  useEffect(() => {
    if (step !== 3 || !createdLocationId || !workspaceId) return;
    let active = true;

    const loadOrRunAudit = async () => {
      setAuditResult(null);
      setAuditError(null);
      try {
        const history = await getLocationAudits({ workspaceId, locationId: createdLocationId, limit: 1 }).unwrap();
        let audit = history.data?.[0];
        if (!audit) {
          const result = await runAudit({ workspaceId, locationId: createdLocationId }).unwrap();
          audit = result.data;
        }
        if (active) setAuditResult(audit);
      } catch (error: any) {
        if (active) setAuditError(error?.data?.error?.message || 'The initial audit could not be completed. Retry it or open the Audits page.');
      }
    };

    void loadOrRunAudit();
    return () => { active = false; };
  }, [step, createdLocationId, workspaceId, auditRetry, getLocationAudits, runAudit]);

  const userInitial = (user?.name || user?.email || 'U')[0].toUpperCase();

  return (
    <div className="min-h-screen bg-white flex flex-col items-center font-sans antialiased text-slate-900">
      {/* ── Top Header Navigation & Aligned Stepper ── */}
      <header className="w-full max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-4 flex items-center justify-between">
        {/* Stepper Indicator */}
        <div className="flex items-center space-x-3 sm:space-x-4 text-xs font-semibold">
          {/* Step 1 */}
          <div className="flex items-center space-x-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${
                step === 1
                  ? 'bg-brand-600 text-white shadow-xs'
                  : step > 1
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}
            >
              {step > 1 ? <Check size={13} /> : '1'}
            </div>
            <span className={step === 1 ? 'text-slate-900 font-bold' : 'text-slate-500 hidden sm:inline'}>
              Connect Google
            </span>
          </div>

          <div className="w-6 sm:w-10 h-px bg-slate-200" />

          {/* Step 2 */}
          <div className="flex items-center space-x-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${
                step === 2
                  ? 'bg-brand-600 text-white shadow-xs'
                  : step > 2
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}
            >
              {step > 2 ? <Check size={13} /> : '2'}
            </div>
            <span className={step === 2 ? 'text-slate-900 font-bold' : 'text-slate-500 hidden sm:inline'}>
              Activate profile
            </span>
          </div>

          <div className="w-6 sm:w-10 h-px bg-slate-200" />

          {/* Step 3 */}
          <div className="flex items-center space-x-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${
                step === 3
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}
            >
              3
            </div>
            <span className={step === 3 ? 'text-slate-900 font-bold' : 'text-slate-500 hidden sm:inline'}>
              Initial audit & setup
            </span>
          </div>
        </div>

        {/* Right action & User avatar */}
        <div className="flex items-center space-x-3">
          {step < 3 && (
            <button
              onClick={step === 1 ? handleSkipGoogle : () => navigate('/dashboard')}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center space-x-1 cursor-pointer transition px-2 py-1 rounded-md hover:bg-slate-50"
            >
              <span>Skip</span>
              <ArrowRight size={13} />
            </button>
          )}

          <div className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            {userInitial}
          </div>
        </div>
      </header>

      {/* ── Main Wizard Container ── */}
      <main className="w-full max-w-3xl px-4 py-4 sm:py-6 flex-1 flex flex-col justify-center">
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* STEP 1: Connect Google Account                                           */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-10 shadow-sm text-center space-y-7">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Connect your Google account to get started
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-lg mx-auto leading-relaxed">
                Connect Rankora to the Google account where you manage your Business Profiles. Rankora will discover your locations, run automated audits, and track local rankings.
              </p>
            </div>

            {/* Illustrated Integration Graphic */}
            <div className="flex items-center justify-center py-1">
              <div className="flex items-center space-x-4">
                {/* Brand Logo Icon Card */}
                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center">
                    <span className="text-lg font-black text-brand-600">R</span>
                  </div>
                </div>

                {/* Connection Line */}
                <div className="flex items-center space-x-1.5 text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span className="w-2.5 h-2.5 font-bold text-slate-400">+</span>
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                </div>

                {/* Google Logo Card */}
                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center">
                  <svg width="32" height="32" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Social Proof Stats Banner */}
            <div className="py-3 px-4 rounded-2xl bg-slate-50 border border-slate-100 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="font-extrabold text-slate-900 text-sm sm:text-base">4.9/5</div>
                <div className="flex justify-center items-center text-amber-400 text-xs mt-0.5">
                  {'★★★★★'}
                </div>
              </div>
              <div className="border-x border-slate-200">
                <div className="font-extrabold text-slate-900 text-sm sm:text-base">2,500+</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Active specialists</div>
              </div>
              <div>
                <div className="font-extrabold text-slate-900 text-sm sm:text-base">20,500+</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Profiles managed</div>
              </div>
            </div>

            {/* Action Section */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 space-y-4 shadow-2xs">
              {actionError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-center space-x-2">
                  <AlertCircle size={15} className="flex-shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              <button
                id="onboarding-connect-google-btn"
                onClick={handleConnectGoogle}
                disabled={isGettingAuthUrl}
                className="w-full max-w-md mx-auto py-3.5 px-6 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm transition shadow-xs flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
              >
                {isGettingAuthUrl ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Connecting to Google...</span>
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path
                        fill="#ffffff"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#ffffff"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#ffffff"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#ffffff"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Connect with Google Business Profile</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center space-x-1.5 text-[11px] text-slate-500">
                <Lock size={12} />
                <span>You remain in full control. We won't modify or publish anything without your approval.</span>
              </div>
            </div>

            {/* Skip Link */}
            <div>
              <button
                onClick={handleSkipGoogle}
                className="text-xs text-slate-500 hover:text-slate-800 font-medium underline underline-offset-4 cursor-pointer transition"
              >
                Skip this step and enter location manually →
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* STEP 2: Find & Activate Your Business Profile                            */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-10 shadow-sm space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Find and activate your business
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
                Search for your existing Google Business Profile or enter your business details to configure your workspace.
              </p>
            </div>

            {!isGbpConnected && (
              <div className="p-3.5 rounded-2xl bg-brand-50/70 border border-brand-100 text-xs text-slate-700 flex items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <Compass size={16} className="text-brand-600 flex-shrink-0" />
                  <span>Connect your Google account for 1-click location import and instant rank tracking.</span>
                </div>
                <button
                  onClick={handleConnectGoogle}
                  className="text-brand-600 font-bold hover:underline cursor-pointer flex-shrink-0"
                >
                  Connect Google
                </button>
              </div>
            )}

            {/* Discovered Profiles from connected Google account */}
            {isGbpConnected && discoveredLocations.length > 0 ? (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Select a Google Business Profile to activate:
                </label>
                <div className="space-y-2">
                  {discoveredLocations.map((loc) => (
                    <div
                      key={loc.gbpLocationId}
                      className="p-4 rounded-xl border border-slate-200 hover:border-brand-400 bg-white transition flex items-center justify-between gap-4 cursor-pointer shadow-xs"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="font-bold text-slate-900 text-sm">{loc.name}</div>
                        <div className="text-xs text-slate-500 flex items-center space-x-1.5">
                          <MapPin size={12} className="text-slate-400 flex-shrink-0" />
                          <span className="truncate">
                            {loc.address}, {loc.city}, {loc.state}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleSelectDiscovered(loc)}
                        disabled={isImportingLocation}
                        className="py-2 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition flex items-center space-x-1.5 cursor-pointer shadow-xs flex-shrink-0 disabled:opacity-60"
                      >
                        {isImportingLocation ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <span>Activate Profile</span>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Search Bar / Manual Activation */
              <div className="space-y-6">
                {!showManualForm ? (
                  <div className="space-y-4">
                    <div className="relative">
                      <Search size={18} className="text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search your business name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-brand-600 focus:border-transparent outline-none transition shadow-2xs"
                      />
                    </div>

                    {searchQuery.trim().length > 1 && (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                        <div className="text-xs text-slate-600">
                          Ready to configure <strong className="text-slate-900">{searchQuery}</strong>?
                        </div>
                        <button
                          onClick={() => {
                            setManualName(searchQuery);
                            setShowManualForm(true);
                          }}
                          className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
                        >
                          <Plus size={14} />
                          <span>Configure & Activate "{searchQuery}"</span>
                        </button>
                      </div>
                    )}

                    <div className="text-center pt-2">
                      <button
                        onClick={() => setShowManualForm(true)}
                        className="text-xs text-brand-600 hover:underline font-semibold cursor-pointer"
                      >
                        Or enter business location details manually →
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Manual Form with Full Validations */
                  <form onSubmit={handleCreateManual} className="space-y-4 pt-1">
                    {actionError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                        <AlertCircle size={15} className="flex-shrink-0" />
                        <span>{actionError}</span>
                      </div>
                    )}

                    {/* Business Name Field */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700">
                          Business Name <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[11px] text-slate-400">Letters and spaces only</span>
                      </div>
                      <input
                        type="text"
                        value={manualName}
                        onChange={(e) => handleFieldChange('manualName', e.target.value, setManualName)}
                        onBlur={() => handleBlur('manualName', manualName)}
                        placeholder="e.g. Apex Dental Studio"
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-900 outline-none transition ${
                          fieldErrors.manualName && touched.manualName
                            ? 'border-rose-300 focus:ring-2 focus:ring-rose-500 bg-rose-50/20'
                            : 'border-slate-300 focus:ring-2 focus:ring-brand-600'
                        }`}
                      />
                      {fieldErrors.manualName && touched.manualName && (
                        <p className="text-rose-600 text-xs mt-1 flex items-center space-x-1">
                          <AlertCircle size={12} />
                          <span>{fieldErrors.manualName}</span>
                        </p>
                      )}
                    </div>

                    {/* Street Address */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Street Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={manualAddress}
                        onChange={(e) => handleFieldChange('manualAddress', e.target.value, setManualAddress)}
                        onBlur={() => handleBlur('manualAddress', manualAddress)}
                        placeholder="e.g. 100 Main Street, Suite 400"
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-900 outline-none transition ${
                          fieldErrors.manualAddress && touched.manualAddress
                            ? 'border-rose-300 focus:ring-2 focus:ring-rose-500 bg-rose-50/20'
                            : 'border-slate-300 focus:ring-2 focus:ring-brand-600'
                        }`}
                      />
                      {fieldErrors.manualAddress && touched.manualAddress && (
                        <p className="text-rose-600 text-xs mt-1 flex items-center space-x-1">
                          <AlertCircle size={12} />
                          <span>{fieldErrors.manualAddress}</span>
                        </p>
                      )}
                    </div>

                    {/* City & State */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          City <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={manualCity}
                          onChange={(e) => handleFieldChange('manualCity', e.target.value, setManualCity)}
                          onBlur={() => handleBlur('manualCity', manualCity)}
                          placeholder="e.g. Austin"
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-900 outline-none transition ${
                            fieldErrors.manualCity && touched.manualCity
                              ? 'border-rose-300 focus:ring-2 focus:ring-rose-500 bg-rose-50/20'
                              : 'border-slate-300 focus:ring-2 focus:ring-brand-600'
                          }`}
                        />
                        {fieldErrors.manualCity && touched.manualCity && (
                          <p className="text-rose-600 text-xs mt-1 flex items-center space-x-1">
                            <AlertCircle size={12} />
                            <span>{fieldErrors.manualCity}</span>
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          State / Region
                        </label>
                        <input
                          type="text"
                          value={manualState}
                          onChange={(e) => setManualState(e.target.value)}
                          placeholder="e.g. TX"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-600"
                        />
                      </div>
                    </div>

                    {/* Postal Code & Country */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Postal / ZIP Code
                        </label>
                        <input
                          type="text"
                          value={manualPostal}
                          onChange={(e) => handleFieldChange('manualPostal', e.target.value, setManualPostal)}
                          onBlur={() => handleBlur('manualPostal', manualPostal)}
                          placeholder="e.g. 78701"
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-900 outline-none transition ${
                            fieldErrors.manualPostal && touched.manualPostal
                              ? 'border-rose-300 focus:ring-2 focus:ring-rose-500 bg-rose-50/20'
                              : 'border-slate-300 focus:ring-2 focus:ring-brand-600'
                          }`}
                        />
                        {fieldErrors.manualPostal && touched.manualPostal && (
                          <p className="text-rose-600 text-xs mt-1 flex items-center space-x-1">
                            <AlertCircle size={12} />
                            <span>{fieldErrors.manualPostal}</span>
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Country
                        </label>
                        <select
                          value={manualCountry}
                          onChange={(e) => setManualCountry(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-600 bg-white"
                        >
                          <option value="United States">United States</option>
                          <option value="United Kingdom">United Kingdom</option>
                          <option value="Canada">Canada</option>
                          <option value="Australia">Australia</option>
                          <option value="India">India</option>
                          <option value="Germany">Germany</option>
                          <option value="France">France</option>
                          <option value="Poland">Poland</option>
                        </select>
                      </div>
                    </div>

                    {/* Primary Category with Quick Chips */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Primary Business Category
                      </label>
                      <input
                        type="text"
                        value={manualCategory}
                        onChange={(e) => setManualCategory(e.target.value)}
                        placeholder="e.g. Dentist, Restaurant, Plumber"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-600"
                      />
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {POPULAR_CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setManualCategory(cat)}
                            className={`text-[11px] px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                              manualCategory === cat
                                ? 'bg-brand-50 border-brand-300 text-brand-700 font-semibold'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Optional Website & Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                          <Phone size={12} className="text-slate-400" />
                          <span>Phone (Optional)</span>
                        </label>
                        <input
                          type="text"
                          value={manualPhone}
                          onChange={(e) => handleFieldChange('manualPhone', e.target.value, setManualPhone)}
                          onBlur={() => handleBlur('manualPhone', manualPhone)}
                          placeholder="e.g. (512) 555-0198"
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-900 outline-none transition ${
                            fieldErrors.manualPhone && touched.manualPhone
                              ? 'border-rose-300 focus:ring-2 focus:ring-rose-500 bg-rose-50/20'
                              : 'border-slate-300 focus:ring-2 focus:ring-brand-600'
                          }`}
                        />
                        {fieldErrors.manualPhone && touched.manualPhone && (
                          <p className="text-rose-600 text-xs mt-1 flex items-center space-x-1">
                            <AlertCircle size={12} />
                            <span>{fieldErrors.manualPhone}</span>
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                          <Globe size={12} className="text-slate-400" />
                          <span>Website (Optional)</span>
                        </label>
                        <input
                          type="text"
                          value={manualWebsite}
                          onChange={(e) => handleFieldChange('manualWebsite', e.target.value, setManualWebsite)}
                          onBlur={() => handleBlur('manualWebsite', manualWebsite)}
                          placeholder="e.g. www.apexdental.com"
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-900 outline-none transition ${
                            fieldErrors.manualWebsite && touched.manualWebsite
                              ? 'border-rose-300 focus:ring-2 focus:ring-rose-500 bg-rose-50/20'
                              : 'border-slate-300 focus:ring-2 focus:ring-brand-600'
                          }`}
                        />
                        {fieldErrors.manualWebsite && touched.manualWebsite && (
                          <p className="text-rose-600 text-xs mt-1 flex items-center space-x-1">
                            <AlertCircle size={12} />
                            <span>{fieldErrors.manualWebsite}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 pt-3">
                      <button
                        type="button"
                        onClick={() => setShowManualForm(false)}
                        className="py-2.5 px-4 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isCreatingLocation}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer shadow-xs disabled:opacity-60"
                      >
                        {isCreatingLocation ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Saving profile...</span>
                          </>
                        ) : (
                          <span>Activate Profile & Launch Auto-Audit</span>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* STEP 3: Initial Audit & Setup Completion                                 */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <div className="bg-white border border-slate-200/90 rounded-3xl p-8 sm:p-12 shadow-sm text-center space-y-6">
            <div className="w-16 h-16 rounded-3xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center mx-auto shadow-xs">
              <ShieldCheck size={36} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {auditResult ? 'Initial audit complete' : auditError ? 'Profile activated; audit needs attention' : 'Running initial audit…'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                {auditResult
                  ? `Your business profile scored ${auditResult.score}/100. Automated health baseline and recommendation engine are ready.`
                  : auditError || 'Evaluating business profile signals, NAP consistency, and search visibility indicators.'}
              </p>
            </div>

            {/* Audit Progress Bar */}
            <div className="w-full max-w-sm mx-auto space-y-2">
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`bg-brand-600 h-full rounded-full transition-all duration-300 ${
                    auditResult ? '' : 'animate-pulse'
                  }`}
                  style={{ width: auditResult ? '100%' : '70%' }}
                />
              </div>
              <div className="text-[11px] font-bold text-slate-400">
                {auditResult ? '17-Point Audit saved to workspace' : auditError ? 'Audit service check required' : 'Analyzing listing attributes…'}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              {auditError && (
                <button
                  onClick={() => setAuditRetry((value) => value + 1)}
                  className="w-full sm:w-auto rounded-xl bg-brand-600 hover:bg-brand-700 px-5 py-2.5 text-xs font-bold text-white transition cursor-pointer shadow-xs"
                >
                  Retry audit
                </button>
              )}

              <button
                onClick={() => navigate('/dashboard')}
                className="w-full sm:w-auto rounded-xl bg-brand-600 hover:bg-brand-700 px-6 py-2.5 text-xs font-bold text-white transition flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
              >
                <span>Go to Dashboard</span>
                <ArrowRight size={14} />
              </button>

              {createdLocationId && (
                <button
                  onClick={() => navigate(`/audits?locationId=${encodeURIComponent(createdLocationId)}`)}
                  className="w-full sm:w-auto rounded-xl border border-slate-300 hover:bg-slate-50 px-5 py-2.5 text-xs font-bold text-slate-700 transition cursor-pointer"
                >
                  View Full Audit Report
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default OnboardingWizard;
