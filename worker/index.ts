import type { Env } from './types';
import { isValidUrl, isValidEmail, sanitizeString } from './utils/validation';

// Export Durable Object and Workflow classes
export { SessionManager } from './durable-objects/session-manager';
export { ScanWorkflow } from './workflows/scan-workflow';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // TODO: Restrict to your domain in production
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

export default {
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
          return await handleCreateScan(request, env, ctx);
        }
        
        if (url.pathname.startsWith('/api/session/')) {
          const sessionId = url.pathname.split('/')[3];
          return await handleGetSession(sessionId, env);
        }
        
        if (url.pathname.startsWith('/api/download/')) {
          const sessionId = url.pathname.split('/')[3];
          return await handleDownload(sessionId, env);
        }
        
        if (url.pathname.startsWith('/api/email/') && request.method === 'POST') {
          const sessionId = url.pathname.split('/')[3];
          return await handleSendEmail(sessionId, env, request);
        }
        
        // WebSocket upgrade
        if (url.pathname.startsWith('/ws/')) {
          const sessionId = url.pathname.split('/')[2];
          return await handleWebSocket(sessionId, request, env);
        }
        
        // Health check
        if (url.pathname === '/api/health') {
          return Response.json({ status: 'ok', timestamp: Date.now() }, { headers: corsHeaders });
        }
        
        return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
        
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
  env: Env,
  ctx: ExecutionContext
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
    
    // Trigger workflow (non-blocking)
    ctx.waitUntil(
      (async () => {
        try {
          await env.SCAN_WORKFLOW.create({ id: sessionId, params: { sessionId } });
          console.log(`[Worker] Workflow started for session: ${sessionId}`);
        } catch (error) {
          console.error(`[Worker] Failed to start workflow:`, error);
        }
      })()
    );
    
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
 */
async function handleDownload(sessionId: string, env: Env): Promise<Response> {
  try {
    if (!sessionId) {
      return new Response('Session ID required', { status: 400 });
    }
    
    const r2Key = `sessions/${sessionId}/report.pdf`;
    const object = await env.radar_scan_reports.get(r2Key);
    
    if (!object) {
      return new Response('Report not found', { status: 404 });
    }
    
    console.log(`[Worker] Serving PDF download for session: ${sessionId}`);
    
    return new Response(object.body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="radar-scan-${sessionId}.pdf"`,
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
