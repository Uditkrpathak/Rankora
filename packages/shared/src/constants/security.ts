export const ARGON2_CONFIG = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,       // 2 iterations
  parallelism: 1,
  version: 1
};

export const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  'password123!',
  'password1!',
  'password@123',
  'p@ssword',
  'p@ssword1',
  'p@ssw0rd123',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'qwerty123!',
  'welcome123',
  'welcome123!',
  'welcome1!',
  'welcome@123',
  'admin123',
  'admin123!',
  'admin@123',
  'administrator123!',
  'iloveyou',
  'iloveyou123!',
  'sunshine',
  'sunshine123!',
  'princess',
  'princess123!',
  'football',
  'football123!',
  'monkey123',
  'monkey123!',
  'shadow123',
  'shadow123!',
  'master123',
  'master123!',
  'dragon123',
  'dragon123!',
  'trustno1',
  'trustno1!',
  'superman',
  'superman123!',
  'michael1',
  'charlie1',
  'letmein123!',
  'changeme123!',
  'abc12345!'
]);

export const SECURITY_POLICIES = {
  ACCESS_TOKEN_TTL_SECONDS: 15 * 60, // 15 minutes
  REFRESH_TOKEN_TTL_DAYS: 30,         // 30 days
  EMAIL_VERIFICATION_TTL_HOURS: 24,   // 24 hours
  PASSWORD_RESET_TTL_HOURS: 1,        // 1 hour
  MFA_CHALLENGE_TTL_SECONDS: 5 * 60,  // 5 minutes
  INVITE_TTL_DAYS: 7,                 // 7 days
  CAPTCHA_REQUIRED_LOGIN_FAILURES: 3, // require captcha after 3 failed attempts
  LOCKOUT_THRESHOLDS: [
    { attempts: 5, lockoutSeconds: 60 },      // 1 minute backoff
    { attempts: 8, lockoutSeconds: 5 * 60 },  // 5 minutes backoff
    { attempts: 12, lockoutSeconds: 30 * 60 } // 30 minutes backoff
  ]
};
