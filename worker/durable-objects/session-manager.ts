import { DurableObject } from "cloudflare:workers";
import type { Env, SessionState } from '../types';

export class SessionManager extends DurableObject<Env> {
  private sessions: Map<WebSocket, { clientId: string }>;
  private sessionData: SessionState | null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sessions = new Map();
    this.sessionData = null;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket();
    }
    
    // Internal API for Workflow updates
    if (url.pathname === '/update') {
      return this.handleUpdate(request);
    }
    
    // Get current session state
    if (url.pathname === '/state') {
      return this.handleGetState();
    }
    
    // Initialize new session
    if (url.pathname === '/init') {
      return this.handleInit(request);
    }
    
    return new Response('Not found', { status: 404 });
  }

  private async handleWebSocket(): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    
    const clientId = crypto.randomUUID();
    this.sessions.set(server, { clientId });
    
    // Accept the WebSocket connection
    server.accept();
    
    // Load session data if not already loaded
    if (!this.sessionData) {
      this.sessionData = await this.ctx.storage.get<SessionState>('sessionData') || null;
    }
    
    // Send current state immediately
    if (this.sessionData) {
      server.send(JSON.stringify({
        type: 'state',
        data: this.sessionData,
        timestamp: Date.now()
      }));
    }
    
    // Handle WebSocket close
    server.addEventListener('close', () => {
      this.sessions.delete(server);
      console.log(`WebSocket closed for client ${clientId}`);
    });
    
    // Handle WebSocket errors
    server.addEventListener('error', (err) => {
      console.error('WebSocket error:', err);
      this.sessions.delete(server);
    });
    
    console.log(`WebSocket connected for client ${clientId}, total connections: ${this.sessions.size}`);
    
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  private async handleInit(request: Request): Promise<Response> {
    const data = await request.json<Partial<SessionState>>();
    
    this.sessionData = {
      sessionId: data.sessionId!,
      url: data.url!,
      email: data.email!,
      status: 'queued',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      country: data.country
    };
    
    // Persist to DO storage
    await this.ctx.storage.put('sessionData', this.sessionData);
    
    // Persist to D1
    await this.persistToD1();
    
    // Set alarm for 24-hour expiry
    await this.ctx.storage.setAlarm(this.sessionData.expiresAt);
    
    console.log(`Session initialized: ${this.sessionData.sessionId}`);
    
    return Response.json({ success: true });
  }

  private async handleUpdate(request: Request): Promise<Response> {
    const update = await request.json<Partial<SessionState>>();
    
    if (!this.sessionData) {
      // Load from storage if not in memory
      this.sessionData = await this.ctx.storage.get<SessionState>('sessionData') || null;
      if (!this.sessionData) {
        return new Response('Session not found', { status: 404 });
      }
    }
    
    // Update session data
    this.sessionData = {
      ...this.sessionData,
      ...update,
      updatedAt: Date.now()
    };
    
    // Persist to DO storage
    await this.ctx.storage.put('sessionData', this.sessionData);
    
    // Persist to D1
    await this.persistToD1();
    
    // Broadcast to all connected clients
    this.broadcast({
      type: 'update',
      data: update,
      timestamp: Date.now()
    });
    
    console.log(`Session updated: ${this.sessionData.sessionId}, status: ${this.sessionData.status}`);
    
    return new Response('OK');
  }

  private async handleGetState(): Promise<Response> {
    if (!this.sessionData) {
      // Load from storage
      this.sessionData = await this.ctx.storage.get<SessionState>('sessionData') || null;
    }
    
    if (!this.sessionData) {
      return new Response('Session not found', { status: 404 });
    }
    
    return Response.json(this.sessionData);
  }

  private broadcast(message: unknown) {
    const payload = JSON.stringify(message);
    const deadSockets: WebSocket[] = [];
    
    for (const ws of this.sessions.keys()) {
      try {
        ws.send(payload);
      } catch (err) {
        // Client disconnected, mark for removal
        console.error('Failed to send to WebSocket:', err);
        deadSockets.push(ws);
      }
    }
    
    // Clean up dead connections
    deadSockets.forEach(ws => this.sessions.delete(ws));
    
    console.log(`Broadcasted to ${this.sessions.size} clients`);
  }

  private async persistToD1() {
    if (!this.sessionData) return;
    
    try {
      await this.env.radar_scanner_db.prepare(`
        INSERT OR REPLACE INTO sessions 
        (id, url, email, status, job_id, radar_uuid, r2_key, error, 
         created_at, updated_at, expires_at, ip_address, user_agent, country)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        this.sessionData.sessionId,
        this.sessionData.url,
        this.sessionData.email,
        this.sessionData.status,
        this.sessionData.jobId || null,
        this.sessionData.radarUuid || null,
        this.sessionData.r2Key || null,
        this.sessionData.error || null,
        this.sessionData.createdAt,
        this.sessionData.updatedAt,
        this.sessionData.expiresAt,
        this.sessionData.ipAddress || null,
        this.sessionData.userAgent || null,
        this.sessionData.country || null
      ).run();
      
      console.log(`Persisted to D1: ${this.sessionData.sessionId}`);
    } catch (error) {
      console.error('Failed to persist to D1:', error);
    }
  }

  // Alarm handler for 24-hour session expiry
  async alarm() {
    console.log('Alarm triggered for session expiry');
    
    if (!this.sessionData) {
      this.sessionData = await this.ctx.storage.get<SessionState>('sessionData') || null;
    }
    
    if (!this.sessionData) {
      console.log('No session data found in alarm');
      return;
    }
    
    const now = Date.now();
    
    if (now >= this.sessionData.expiresAt) {
      console.log(`Session expired: ${this.sessionData.sessionId}`);
      
      // Close all WebSocket connections
      for (const ws of this.sessions.keys()) {
        try {
          ws.close(1000, 'Session expired');
        } catch (err) {
          console.error('Error closing WebSocket:', err);
        }
      }
      this.sessions.clear();
      
      // Mark session as expired in D1
      try {
        await this.env.radar_scanner_db.prepare(`
          UPDATE sessions SET status = 'expired' WHERE id = ?
        `).bind(this.sessionData.sessionId).run();
      } catch (error) {
        console.error('Failed to mark session as expired in D1:', error);
      }
      
      // Clear DO storage
      await this.ctx.storage.deleteAll();
      this.sessionData = null;
      
      console.log('Session cleanup complete');
    }
  }
}
