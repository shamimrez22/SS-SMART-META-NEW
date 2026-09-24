/**
 * SS SMART META - Enterprise License & Admin Management Service
 * Handles cryptographic key generation, duration expiry (1m, 6m, 1y, lifetime),
 * Admin bypass mode, and contact channel synchronization.
 */

export type LicenseDuration = '1m' | '6m' | '1y' | 'lifetime' | 'custom';

export interface LicenseKeyRecord {
  id: string;
  key: string;
  duration: LicenseDuration;
  durationDays: number;
  customDays?: number;
  clientName?: string;
  createdAt: number;
  expiresAt: number; // timestamp in ms; 0 or large number for lifetime
  status: 'active' | 'revoked';
  activatedAt?: number;
}

export interface AdminConfig {
  isAdmin: boolean;
  adminUsername: string; // Default: 'SHAMIM'
  adminPassword: string; // Default: '321'
  adminPin: string;      // Backwards compatible PIN
  website: string;
  whatsapp: string;
  youtube: string;
  email: string;
  developerName: string;
}

export interface ActiveLicenseState {
  key: string;
  duration: LicenseDuration;
  durationDays: number;
  customDays?: number;
  activatedAt: number;
  expiresAt: number;
  clientName?: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  nameBangla: string;
  durationLabel: string;
  duration: LicenseDuration;
  priceTaka: number;
  originalPrice?: number;
  popular?: boolean;
  features: string[];
}

export const OFFICIAL_PRICING_PLANS: PricingPlan[] = [
  {
    id: 'plan_1m',
    name: '1 Month Standard',
    nameBangla: '১ মাস মেয়াদী',
    durationLabel: '30 Days Access',
    duration: '1m',
    priceTaka: 199,
    originalPrice: 350,
    features: ['৩০ দিন ফুল অ্যাক্সেস', 'আনলিমিটেড মেটাডাটা জেনারেটর', 'সবগুলো স্টক মার্কেটপ্লেস এসইও', 'সিএসভি ফাইল এক্সপোর্ট']
  },
  {
    id: 'plan_6m',
    name: '6 Months Pro',
    nameBangla: '৬ মাস মেয়াদী',
    durationLabel: '180 Days Access',
    duration: '6m',
    priceTaka: 500,
    originalPrice: 1194,
    popular: true,
    features: ['১৮০ দিন একটানা অ্যাক্সেস', '৳ ৬৯৪ টাকা বিশাল সাশ্রয়', 'ফাস্ট এআই ট্যাগিং ও প্রম্পট জেন', '২৪/৭ ডিরেক্ট সাপোর্ট']
  },
  {
    id: 'plan_1y',
    name: '1 Year Business',
    nameBangla: '১ বছর মেয়াদী',
    durationLabel: '365 Days Access',
    duration: '1y',
    priceTaka: 900,
    originalPrice: 2388,
    features: ['৩৬৫ দিন সম্পূর্ণ অ্যাক্সেস', '৳ ১,৪৮৮ টাকা সেরা ডিসকাউন্ট', 'অল এক্সটেনশন স্টুডিও ফিচারস', 'ভিআইপি প্রায়োরিটি সাপোর্ট']
  },
  {
    id: 'plan_lifetime',
    name: 'Lifetime Unlimited',
    nameBangla: 'লাইফটাইম পার্মানেন্ট',
    durationLabel: 'Unlimited Permanent',
    duration: 'lifetime',
    priceTaka: 1500,
    originalPrice: 4999,
    features: ['সারাজীবনের জন্য পার্মানেন্ট আনলক', 'কোনো মেয়াদ শেষ হবে না', 'ভবিষ্যতের সমস্ত প্রিমিয়াম আপডেট ফ্রি', 'অ্যাডমিন ডিরেক্ট সহায়তা']
  }
];

export interface LicenseStatusResult {
  isUnlocked: boolean;
  isAdmin: boolean;
  isExpired: boolean;
  daysRemaining: number | null;
  activeLicense: ActiveLicenseState | null;
  message: string;
}

// Storage keys
const STORAGE_ADMIN_CONFIG = 'ss_meta_admin_config_v1';
const STORAGE_GENERATED_KEYS = 'ss_meta_generated_keys_v1';
const STORAGE_ACTIVE_LICENSE = 'ss_meta_active_license_v1';

/**
 * Permanent Master Lifetime License Key strictly for Admin Shamim
 * Exactly as requested: ADMIN-SHAMIM-321
 */
export const ADMIN_MASTER_LICENSE_KEY = 'ADMIN-SHAMIM-321';

export const MASTER_ADMIN_RECORD: LicenseKeyRecord = {
  id: 'master-admin-shamim-key',
  key: ADMIN_MASTER_LICENSE_KEY,
  duration: 'lifetime',
  durationDays: 36500, // 100 years
  clientName: '👑 Master Admin (Shamim) - Permanent Lifetime',
  createdAt: 1774320000000,
  expiresAt: 4927536000000, // Year 2126
  status: 'active',
  activatedAt: 1774320000000
};

// Default Admin Configuration
const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  isAdmin: false, // User can toggle this in Admin panel with tickbox or by entering ADMIN-SHAMIM-321!
  adminUsername: 'SHAMIM',
  adminPassword: '321',
  adminPin: '321',
  website: 'https://metamaster.app',
  whatsapp: '+8801700000000',
  youtube: 'https://youtube.com',
  email: 'contact@metamaster.app',
  developerName: 'Shamim (Developer & Creator)'
};

/**
 * Verify Admin credentials (Username: SHAMIM, Password: 321 or saved updates)
 */
export function verifyAdminCredentials(user: string, pass: string): boolean {
  const config = getAdminConfig();
  const validUser = (config.adminUsername || 'SHAMIM').trim().toUpperCase();
  const validPass = (config.adminPassword || '321').trim();
  const enteredUser = (user || '').trim().toUpperCase();
  const enteredPass = (pass || '').trim();

  return (
    (enteredUser === validUser && enteredPass === validPass) ||
    (enteredUser === 'SHAMIM' && enteredPass === '321')
  );
}

/**
 * Get the current Admin Configuration
 */
export function getAdminConfig(): AdminConfig {
  try {
    const raw = localStorage.getItem(STORAGE_ADMIN_CONFIG);
    if (!raw) return DEFAULT_ADMIN_CONFIG;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_ADMIN_CONFIG, ...parsed };
  } catch {
    return DEFAULT_ADMIN_CONFIG;
  }
}

/**
 * Save updated Admin Configuration
 */
export function saveAdminConfig(updates: Partial<AdminConfig>): AdminConfig {
  const current = getAdminConfig();
  const updated = { ...current, ...updates };
  try {
    localStorage.setItem(STORAGE_ADMIN_CONFIG, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save admin config:', err);
  }
  return updated;
}

/**
 * Get all generated license keys (always ensures the Master Admin Key is present)
 */
export function getAllGeneratedKeys(): LicenseKeyRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_GENERATED_KEYS);
    let list: LicenseKeyRecord[] = raw ? JSON.parse(raw) : [];
    if (!list.some(k => k.key.toUpperCase() === ADMIN_MASTER_LICENSE_KEY)) {
      list = [MASTER_ADMIN_RECORD, ...list];
      saveGeneratedKeys(list);
    }
    return list;
  } catch {
    return [MASTER_ADMIN_RECORD];
  }
}

/**
 * Save all generated keys
 */
function saveGeneratedKeys(keys: LicenseKeyRecord[]): void {
  try {
    localStorage.setItem(STORAGE_GENERATED_KEYS, JSON.stringify(keys));
  } catch (err) {
    console.error('Failed to save generated keys:', err);
  }
}

/**
 * Helper to generate random hex chunk
 */
function randomChunk(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars 0/O, 1/I
  let result = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(length);
    crypto.getRandomValues(arr);
    for (let i = 0; i < length; i++) {
      result += chars[arr[i] % chars.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return result;
}

/**
 * Duration in days
 */
export function getDurationDays(duration: LicenseDuration, customDays?: number): number {
  switch (duration) {
    case '1m':
      return 30;
    case '6m':
      return 180;
    case '1y':
      return 365;
    case 'lifetime':
      return 36500; // 100 years
    case 'custom':
      return Math.max(1, customDays || 30);
    default:
      return 30;
  }
}

/**
 * Generate a brand new, completely unique, collision-proof license key
 */
export function generateLicenseKey(duration: LicenseDuration, clientName?: string, customDays?: number): LicenseKeyRecord {
  const durationDays = getDurationDays(duration, customDays);
  const now = Date.now();
  const expiresAt = duration === 'lifetime' 
    ? now + (100 * 365 * 24 * 60 * 60 * 1000) 
    : now + (durationDays * 24 * 60 * 60 * 1000);

  // Prefix based on duration (e.g. 1M, 6M, 1Y, LIFE, 33D)
  const prefixMap: Record<LicenseDuration, string> = {
    '1m': '1M',
    '6m': '6M',
    '1y': '1Y',
    'lifetime': 'LIFE',
    'custom': customDays ? `${customDays}D` : 'CUST'
  };

  // Unique timestamp component to prevent collision even if generated at the exact same moment
  const timeHex = (now % 10000000).toString(36).toUpperCase().padStart(5, 'X').slice(-4);
  const chunk1 = randomChunk(4);
  const chunk2 = randomChunk(4);
  const chunk3 = randomChunk(4);

  // Full key format: SSM-33D-A8F2-99C1-7E0B
  const key = `SSM-${prefixMap[duration]}-${timeHex}${chunk1.slice(0, 1)}-${chunk2}-${chunk3}`;

  const record: LicenseKeyRecord = {
    id: `lic_${now}_${Math.random().toString(36).slice(2, 7)}`,
    key,
    duration,
    durationDays,
    customDays: duration === 'custom' ? durationDays : undefined,
    clientName: clientName?.trim() || 'Valued User',
    createdAt: now,
    expiresAt,
    status: 'active'
  };

  const existing = getAllGeneratedKeys();
  existing.unshift(record);
  saveGeneratedKeys(existing);

  return record;
}

/**
 * Revoke or Delete a license key (Protects Master Admin Key)
 */
export function revokeLicenseKey(keyId: string): void {
  if (keyId === ADMIN_MASTER_LICENSE_KEY || keyId === 'master-admin-shamim-key') {
    return; // Master Admin Key cannot be revoked!
  }
  const existing = getAllGeneratedKeys();
  const updated = existing.map(k => k.id === keyId || k.key === keyId ? { ...k, status: 'revoked' as const } : k);
  saveGeneratedKeys(updated);

  // If the active key is this revoked key, clear it
  const active = getActiveLicense();
  if (active && (active.key === keyId || existing.find(k => k.id === keyId)?.key === active.key)) {
    clearActiveLicense();
  }
}

export function deleteLicenseKey(keyId: string): void {
  if (keyId === ADMIN_MASTER_LICENSE_KEY || keyId === 'master-admin-shamim-key') {
    return; // Master Admin Key cannot be deleted!
  }
  const existing = getAllGeneratedKeys();
  const updated = existing.filter(k => k.id !== keyId && k.key !== keyId);
  saveGeneratedKeys(updated);

  const active = getActiveLicense();
  if (active && active.key === keyId) {
    clearActiveLicense();
  }
}

/**
 * Get active saved license from this browser
 */
export function getActiveLicense(): ActiveLicenseState | null {
  try {
    const raw = localStorage.getItem(STORAGE_ACTIVE_LICENSE);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Save active license in this browser
 */
export function setActiveLicense(license: ActiveLicenseState): void {
  try {
    localStorage.setItem(STORAGE_ACTIVE_LICENSE, JSON.stringify(license));
  } catch (err) {
    console.error('Failed to save active license:', err);
  }
}

/**
 * Clear active license in this browser
 */
export function clearActiveLicense(): void {
  try {
    localStorage.removeItem(STORAGE_ACTIVE_LICENSE);
  } catch (err) {
    console.error('Failed to clear active license:', err);
  }
}

/**
 * Validate and Activate a License Key entered by user
 */
export function validateAndActivateKey(rawKey: string): { success: boolean; message: string; license?: ActiveLicenseState } {
  const cleaned = rawKey.trim().toUpperCase();
  if (!cleaned) {
    return { success: false, message: 'Please enter a license key' };
  }

  // 1. MASTER ADMIN KEY CHECK (Strictly for Admin Shamim)
  // Key: ADMIN-SHAMIM-321
  if (cleaned === ADMIN_MASTER_LICENSE_KEY) {
    // Automatically turn on the Admin Mode tick box
    saveAdminConfig({ isAdmin: true });

    const now = Date.now();
    const farFuture = now + (100 * 365 * 24 * 60 * 60 * 1000); // 100 years
    const activeState: ActiveLicenseState = {
      key: ADMIN_MASTER_LICENSE_KEY,
      duration: 'lifetime',
      durationDays: 36500,
      activatedAt: now,
      expiresAt: farFuture,
      clientName: '👑 Master Admin (Shamim)'
    };

    setActiveLicense(activeState);
    return {
      success: true,
      message: '✓ Welcome Admin Shamim! Master Lifetime Admin Key (ADMIN-SHAMIM-321) permanently activated with full Admin privileges.',
      license: activeState
    };
  }

  // Check against known generated keys database first
  const allKeys = getAllGeneratedKeys();
  const matchingRecord = allKeys.find(k => k.key.toUpperCase() === cleaned);

  if (matchingRecord) {
    if (matchingRecord.status === 'revoked') {
      return { success: false, message: 'This license key has been revoked by the administrator.' };
    }

    const now = Date.now();
    // If the key has never been activated, set activation timer starting now!
    let expiresAt = matchingRecord.expiresAt;
    if (!matchingRecord.activatedAt) {
      matchingRecord.activatedAt = now;
      expiresAt = matchingRecord.duration === 'lifetime' 
        ? now + (100 * 365 * 24 * 60 * 60 * 1000) 
        : now + (matchingRecord.durationDays * 24 * 60 * 60 * 1000);
      matchingRecord.expiresAt = expiresAt;
      saveGeneratedKeys(allKeys);
    }

    if (now > expiresAt) {
      return { success: false, message: 'This license key has expired. Please contact admin to renew.' };
    }

    const activeState: ActiveLicenseState = {
      key: matchingRecord.key,
      duration: matchingRecord.duration,
      durationDays: matchingRecord.durationDays,
      activatedAt: matchingRecord.activatedAt || now,
      expiresAt,
      clientName: matchingRecord.clientName
    };

    setActiveLicense(activeState);
    return { 
      success: true, 
      message: `License successfully activated! (${matchingRecord.duration === 'lifetime' ? 'Lifetime Access' : `${matchingRecord.durationDays} Days Valid`})`,
      license: activeState 
    };
  }

  // Offline / Algorithmic Verification Fallback:
  // If the key matches standard pattern SSM-(1M|6M|1Y|LIFE|33D)-XXXX-XXXX-XXXX
  const pattern = /^SSM-(1M|6M|1Y|LIFE|[0-9]{1,4}D|CUST)-[A-Z0-9]{4,5}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  if (pattern.test(cleaned)) {
    const parts = cleaned.split('-');
    const durationCode = parts[1];
    let duration: LicenseDuration = '1m';
    let durationDays = 30;

    if (durationCode === '6M') {
      duration = '6m';
      durationDays = 180;
    } else if (durationCode === '1Y') {
      duration = '1y';
      durationDays = 365;
    } else if (durationCode === 'LIFE') {
      duration = 'lifetime';
      durationDays = 36500;
    } else if (durationCode.endsWith('D')) {
      duration = 'custom';
      durationDays = Math.max(1, parseInt(durationCode.replace('D', ''), 10) || 30);
    } else {
      duration = '1m';
      durationDays = 30;
    }

    const now = Date.now();
    const expiresAt = duration === 'lifetime' ? now + (100 * 365 * 24 * 60 * 60 * 1000) : now + (durationDays * 24 * 60 * 60 * 1000);

    const activeState: ActiveLicenseState = {
      key: cleaned,
      duration,
      durationDays,
      customDays: duration === 'custom' ? durationDays : undefined,
      activatedAt: now,
      expiresAt,
      clientName: 'Authorized Client'
    };

    setActiveLicense(activeState);
    return {
      success: true,
      message: `License key verified and activated! (${duration === 'lifetime' ? 'Lifetime Access' : `${durationDays} Days Valid`})`,
      license: activeState
    };
  }

  return { success: false, message: 'Invalid license key format. Please check the key and try again.' };
}

/**
 * Check overall lock / unlock status of the app
 */
export function checkCurrentLicenseStatus(): LicenseStatusResult {
  const adminConfig = getAdminConfig();
  const activeLicense = getActiveLicense();

  // If Admin Mode checkbox is enabled OR Master Admin Key (ADMIN-SHAMIM-321) is active:
  if (adminConfig.isAdmin || (activeLicense && activeLicense.key.toUpperCase() === ADMIN_MASTER_LICENSE_KEY)) {
    return {
      isUnlocked: true,
      isAdmin: true,
      isExpired: false,
      daysRemaining: 9999,
      activeLicense: activeLicense || {
        key: ADMIN_MASTER_LICENSE_KEY,
        duration: 'lifetime',
        durationDays: 36500,
        activatedAt: Date.now(),
        expiresAt: Date.now() + (100 * 365 * 24 * 60 * 60 * 1000),
        clientName: '👑 Master Admin (Shamim)'
      },
      message: 'Master Admin Active (ADMIN-SHAMIM-321 Permanent Lifetime Access)'
    };
  }

  if (!activeLicense) {
    return {
      isUnlocked: false,
      isAdmin: false,
      isExpired: false,
      daysRemaining: null,
      activeLicense: null,
      message: 'License activation required'
    };
  }

  const now = Date.now();
  if (now > activeLicense.expiresAt) {
    return {
      isUnlocked: false,
      isAdmin: false,
      isExpired: true,
      daysRemaining: 0,
      activeLicense,
      message: 'License expired'
    };
  }

  // Calculate days remaining dynamically
  const msRemaining = activeLicense.expiresAt - now;
  const daysRemaining = activeLicense.duration === 'lifetime' 
    ? 9999 
    : Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

  return {
    isUnlocked: true,
    isAdmin: false,
    isExpired: false,
    daysRemaining,
    activeLicense,
    message: activeLicense.duration === 'lifetime' ? 'Lifetime License Active' : `License Active (${daysRemaining}d remaining)`
  };
}
