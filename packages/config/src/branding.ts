/**
 * Single source of truth for Ecoswift Bank brand identity. Static facts
 * (name, tagline, contact addresses) live here in code; environment-specific
 * values (which actually differ between dev/staging/prod, e.g. deployed
 * portal URLs) stay in env vars — see `env.schema.ts`.
 */
export const BRANDING = {
  projectName: 'ecoswift-platform',
  brandName: 'Ecoswift Bank',
  shortName: 'ESB',
  organization: 'Ecoswift Bank',
  tagline: 'Smart Digital Banking Platform',
  domain: 'ecoswiftbank.com',

  emails: {
    support: 'support@ecoswiftbank.com',
    helpDesk: 'help@ecoswiftbank.com',
    security: 'security@ecoswiftbank.com',
    noReply: 'noreply@ecoswiftbank.com',
    notifications: 'notifications@ecoswiftbank.com',
  },

  // One Next.js app (customer-portal) serves the marketing site, auth, and
  // the logged-in dashboard together — so `website` and `customerPortal`
  // are deliberately the same canonical URL, not separate subdomains. The
  // bare apex (ecoswiftbank.com) redirects to `www` at the DNS/host level
  // (Vercel domain settings), not in application code.
  urls: {
    website: 'https://www.ecoswiftbank.com',
    api: 'https://api.ecoswiftbank.com',
    admin: 'https://admin.ecoswiftbank.com',
    customerPortal: 'https://www.ecoswiftbank.com',
    developerPortal: 'https://developers.ecoswiftbank.com',
    status: 'https://status.ecoswiftbank.com',
    docs: 'https://docs.ecoswiftbank.com',
  },
} as const;

export type Branding = typeof BRANDING;
