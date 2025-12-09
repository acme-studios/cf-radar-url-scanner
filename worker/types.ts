// TypeScript types for Cloudflare Workers environment

export interface Env {
  // Bindings
  SESSION_MANAGER: DurableObjectNamespace;
  SCAN_WORKFLOW: Workflow;
  radar_scanner_db: D1Database;
  radar_scan_reports: R2Bucket;
  
  // Secrets
  CLOUDFLARE_API_TOKEN: string;
  RESEND_API_KEY: string;
  
  // Environment Variables
  CLOUDFLARE_ACCOUNT_ID: string;
  APP_URL: string;
  RESEND_FROM?: string;
}

export interface SessionState {
  sessionId: string;
  url: string;
  email: string;
  status: 'queued' | 'scanning' | 'generating' | 'uploading' | 'sending' | 'completed' | 'failed' | 'expired';
  jobId?: string;
  radarUuid?: string;
  r2Key?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  ipAddress?: string;
  userAgent?: string;
  country?: string;
  // Workflow tracking
  workflowInstanceId?: string;
  // Progress tracking for live updates
  progressPercent?: number;
  progressMessage?: string;
}

export interface RadarScanResponse {
  uuid: string;
  url: string;
  api: string;
  result: string;
  visibility: string;
}

export interface RadarScanResult {
  data: {
    requests: Array<{
      url: string;
      type?: string;
      status?: number;
      method?: string;
    }>;
    cookies: Array<{
      name: string;
      domain?: string;
      secure?: boolean;
      httpOnly?: boolean;
      sameSite?: string;
    }>;
    console: Array<{
      type: string;
      message: string;
    }>;
    links: Array<{
      href: string;
      text?: string;
    }>;
  };
  lists: {
    domains: string[];
    ips: string[];
    asns: string[];
    countries: string[];
    urls?: string[];
    certificates?: string[];
  };
  meta: {
    processors: {
      wappa?: {
        data: Array<{
          app: string;
          categories: Array<{ name: string }>;
          confidenceTotal: number;
          version?: string;
        }>;
      };
      phishing?: {
        data: string[];
      };
      rank?: {
        bucket?: string;
        name?: string;
      };
    };
  };
  page: {
    url: string;
    domain: string;
    country: string;
    ip: string;
    asn: string;
    status: string;
    title?: string;
    server?: string;
    securityDetails?: {
      protocol?: string;
      issuer?: string;
      validFrom?: string;
      validTo?: string;
    };
  };
  verdicts: {
    overall: {
      malicious: boolean;
      categories: string[];
      tags: string[];
      score?: number;
    };
    urlScanners?: {
      [key: string]: {
        malicious: boolean;
      };
    };
  };
  stats: {
    dataLength: number;
    uniqIPs: number;
    uniqCountries: number;
    secureRequests?: number;
    IPv6Percentage?: number;
    adBlocked?: number;
    malicious?: {
      requests?: number;
      domains?: number;
    };
  };
  task: {
    uuid: string;
    url: string;
    time: string;
    visibility: string;
    method?: string;
    userAgent?: string;
  };
}
