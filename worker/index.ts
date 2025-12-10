import type { Env } from './types';
import { isValidUrl, isValidEmail, sanitizeString } from './utils/validation';

// Export Durable Object and Workflow classes
export { SessionManager } from './durable-objects/session-manager';
export { ScanWorkflow } from './workflows/scan-workflow';

// Security and CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

// Security headers for all responses
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN', // Allow same-origin framing for PDF preview
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  // HSTS: Enforce HTTPS for 1 year (only in production)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
};

// Helper to add security headers to responses
function addSecurityHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  Object.entries(securityHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

export default {
  // @ts-expect-error - ctx is required by Workers API but not used
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Handle API routes BEFORE assets (important for /api/download)
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) {
      try {
        // API Routes
        if (url.pathname === '/api/scan' && request.method === 'POST') {
          return addSecurityHeaders(await handleCreateScan(request, env));
        }
        
        if (url.pathname.startsWith('/api/session/')) {
          const sessionId = url.pathname.split('/')[3];
          return addSecurityHeaders(await handleGetSession(sessionId, env));
        }
        
        if (url.pathname.startsWith('/api/download/')) {
          const sessionId = url.pathname.split('/')[3];
          return addSecurityHeaders(await handleDownload(sessionId, env, false));
        }
        
        if (url.pathname.startsWith('/api/preview/')) {
          const sessionId = url.pathname.split('/')[3];
          return addSecurityHeaders(await handleDownload(sessionId, env, true));
        }
        
        if (url.pathname.startsWith('/api/email/') && request.method === 'POST') {
          const sessionId = url.pathname.split('/')[3];
          return addSecurityHeaders(await handleSendEmail(sessionId, env, request));
        }
        
        // WebSocket upgrade
        if (url.pathname.startsWith('/ws/')) {
          const sessionId = url.pathname.split('/')[2];
          return await handleWebSocket(sessionId, request, env);
        }
        
        // Health check
        if (url.pathname === '/api/health') {
          return addSecurityHeaders(Response.json({ status: 'ok', timestamp: Date.now() }, { headers: corsHeaders }));
        }
        
        return addSecurityHeaders(Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders }));
        
      } catch (error) {
        console.error('Worker error:', error);
        return Response.json(
          { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
          { status: 500, headers: corsHeaders }
        );
      }
    }
    
    // All other routes fall through to assets (SPA)
    return new Response('Not found', { status: 404 });
  }
};

/**
 * Handle POST /api/scan - Create a new scan session
 */
async function handleCreateScan(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = await request.json<{ url: string; email: string }>();
    
    // Validate inputs
    const url = sanitizeString(body.url || '');
    const email = sanitizeString(body.email || '');
    
    if (!url || !email) {
      return Response.json(
        { error: 'Missing required fields: url and email' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    if (!isValidUrl(url)) {
      return Response.json(
        { error: 'Invalid URL. Must be HTTP/HTTPS and not a private IP address.' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    if (!isValidEmail(email)) {
      return Response.json(
        { error: 'Invalid email address' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Generate session ID
    const sessionId = crypto.randomUUID();
    
    console.log(`[Worker] Creating scan session: ${sessionId} for URL: ${url}`);
    
    // Get Durable Object instance
    const id = env.SESSION_MANAGER.idFromName(sessionId);
    const sessionDO = env.SESSION_MANAGER.get(id);
    
    // Initialize session
    const now = Date.now();
    const expiresAt = now + (24 * 60 * 60 * 1000); // 24 hours
    
    const initResponse = await sessionDO.fetch('https://do/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        url,
        email,
        createdAt: now,
        updatedAt: now,
        expiresAt,
        ipAddress: request.headers.get('CF-Connecting-IP'),
        userAgent: request.headers.get('User-Agent'),
        country: request.cf?.country
      })
    });
    
    if (!initResponse.ok) {
      throw new Error('Failed to initialize session');
    }
    
    // Trigger workflow and store instance ID (fixes race condition)
    let workflowInstanceId: string | undefined;
    try {
      const workflowInstance = await env.SCAN_WORKFLOW.create({ 
        id: sessionId, 
        params: { sessionId } 
      });
      workflowInstanceId = workflowInstance.id;
      
      // Update session with workflow instance ID
      await sessionDO.fetch('https://do/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowInstanceId: workflowInstanceId,
          progressPercent: 0,
          progressMessage: 'Initializing scan...'
        })
      });
      
      console.log(`[Worker] Workflow started for session: ${sessionId}, instance: ${workflowInstanceId}`);
    } catch (error) {
      console.error(`[Worker] Failed to start workflow:`, error);
      // Mark session as failed
      await sessionDO.fetch('https://do/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'failed',
          error: 'Failed to start scan workflow'
        })
      });
      throw error;
    }
    
    console.log(`[Worker] Session created successfully: ${sessionId}`);
    
    return Response.json(
      {
        sessionId,
        wsUrl: `/ws/${sessionId}`,
        status: 'queued',
        message: 'Scan initiated successfully'
      },
      { headers: corsHeaders }
    );
    
  } catch (error) {
    console.error('[Worker] Error in handleCreateScan:', error);
    return Response.json(
      { error: 'Failed to create scan', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * Handle GET /api/session/:sessionId - Get session state
 */
async function handleGetSession(sessionId: string, env: Env): Promise<Response> {
  try {
    if (!sessionId) {
      return Response.json(
        { error: 'Session ID required' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    const id = env.SESSION_MANAGER.idFromName(sessionId);
    const sessionDO = env.SESSION_MANAGER.get(id);
    
    const response = await sessionDO.fetch('https://do/state');
    
    if (!response.ok) {
      return Response.json(
        { error: 'Session not found' },
        { status: 404, headers: corsHeaders }
      );
    }
    
    const sessionData = await response.json();
    
    return Response.json(sessionData, { headers: corsHeaders });
    
  } catch (error) {
    console.error('[Worker] Error in handleGetSession:', error);
    return Response.json(
      { error: 'Failed to fetch session', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * Handle GET /api/download/:sessionId - Download PDF report
 * Handle GET /api/preview/:sessionId - Preview PDF inline
 */
async function handleDownload(sessionId: string, env: Env, isPreview: boolean = false): Promise<Response> {
  try {
    if (!sessionId) {
      return new Response('Session ID required', { status: 400 });
    }
    
    const r2Key = `sessions/${sessionId}/report.pdf`;
    const object = await env.radar_scan_reports.get(r2Key);
    
    if (!object) {
      return new Response('Report not found', { status: 404 });
    }
    
    console.log(`[Worker] Serving PDF ${isPreview ? 'preview' : 'download'} for session: ${sessionId}`);
    
    // Use 'inline' for preview (shows in browser), 'attachment' for download
    const disposition = isPreview 
      ? 'inline'
      : `attachment; filename="radar-scan-${sessionId}.pdf"`;
    
    return new Response(object.body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition,
        'Cache-Control': 'private, max-age=3600',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    console.error('[Worker] Error in handleDownload:', error);
    return new Response('Failed to download report', { status: 500 });
  }
}

/**
 * Handle WebSocket upgrade - Proxy to Durable Object
 */
async function handleWebSocket(
  sessionId: string,
  request: Request,
  env: Env
): Promise<Response> {
  try {
    if (!sessionId) {
      return new Response('Session ID required', { status: 400 });
    }
    
    // Verify it's a WebSocket upgrade request
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }
    
    console.log(`[Worker] WebSocket upgrade request for session: ${sessionId}`);
    
    const id = env.SESSION_MANAGER.idFromName(sessionId);
    const sessionDO = env.SESSION_MANAGER.get(id);
    
    // Forward the request to the Durable Object
    return await sessionDO.fetch(request);
    
  } catch (error) {
    console.error('[Worker] Error in handleWebSocket:', error);
    return new Response('Failed to establish WebSocket connection', { status: 500 });
  }
}

/**
 * Handle POST /api/email/:sessionId - Send email with report link
 */
async function handleSendEmail(sessionId: string, env: Env, request: Request): Promise<Response> {
  try {
    if (!sessionId) {
      return Response.json(
        { error: 'Session ID required' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Get email from request body
    const body = await request.json<{ email: string }>();
    const email = body.email;
    
    if (!email || !email.includes('@')) {
      return Response.json(
        { error: 'Valid email required' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    console.log(`[Worker] Sending email to: ${email} for session: ${sessionId}`);
    
    // Get session data
    const id = env.SESSION_MANAGER.idFromName(sessionId);
    const sessionDO = env.SESSION_MANAGER.get(id);
    
    const response = await sessionDO.fetch('https://do/state');
    
    if (!response.ok) {
      return Response.json(
        { error: 'Session not found' },
        { status: 404, headers: corsHeaders }
      );
    }
    
    const sessionData = await response.json<{ url: string; status: string; r2Key?: string }>();
    
    console.log(`[Worker] Session status: ${sessionData.status}, r2Key: ${sessionData.r2Key}`);
    
    // Verify scan is completed
    if (sessionData.status !== 'completed') {
      return Response.json(
        { error: 'Scan not completed yet', status: sessionData.status },
        { status: 400, headers: corsHeaders }
      );
    }
    
    if (!sessionData.r2Key) {
      return Response.json(
        { error: 'Report not available' },
        { status: 404, headers: corsHeaders }
      );
    }
    
    // Send email
    const downloadUrl = `${env.APP_URL}/api/download/${sessionId}`;
    
    console.log(`[Worker] Calling Resend API with email: ${email}, downloadUrl: ${downloadUrl}`);
    
    const { sendEmailViaResend } = await import('./services/email');
    await sendEmailViaResend(
      env,
      email,
      sessionData.url,
      sessionId,
      downloadUrl
    );
    
    console.log(`[Worker] Email sent successfully to: ${email}`);
    
    return Response.json(
      { success: true, message: 'Email sent successfully' },
      { headers: corsHeaders }
    );
    
  } catch (error) {
    console.error('[Worker] Error in handleSendEmail:', error);
    return Response.json(
      { error: 'Failed to send email', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
