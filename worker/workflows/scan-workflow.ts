import { WorkflowEntrypoint, WorkflowStep } from 'cloudflare:workers';
import type { WorkflowEvent } from 'cloudflare:workers';
import type { Env, RadarScanResponse, RadarScanResult, SessionState } from '../types';
import { generatePDFReport } from '../services/pdf-generator';

interface ScanParams {
  sessionId: string;
}

export class ScanWorkflow extends WorkflowEntrypoint<Env, ScanParams> {
  async run(event: WorkflowEvent<ScanParams>, step: WorkflowStep) {
    const { sessionId } = event.payload;
    
    console.log(`[Workflow] Starting scan for session: ${sessionId}`);
    
    // Get Durable Object stub
    const sessionDO = this.env.SESSION_MANAGER.get(
      this.env.SESSION_MANAGER.idFromName(sessionId)
    );
    
    try {
      // Step 1: Get session data
      const sessionState = await step.do<SessionState>('fetch session data', async () => {
        const response = await sessionDO.fetch('https://do/state');
        if (!response.ok) {
          throw new Error('Failed to fetch session state');
        }
        return await response.json<SessionState>();
      });
      
      console.log(`[Workflow] Session data fetched for URL: ${sessionState.url}`);
      
      // Step 2: Submit to Radar API
      const radarScan = await step.do<RadarScanResponse>('submit to radar api', async () => {
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/urlscanner/v2/scan`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.env.CLOUDFLARE_API_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              url: sessionState.url,
              visibility: 'Unlisted'
            })
          }
        );
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Radar API error (${response.status}): ${errorText}`);
        }
        
        const result = await response.json<RadarScanResponse>();
        console.log('[Workflow] Radar API response:', JSON.stringify(result));
        return result;
      });
      
      console.log(`[Workflow] Radar scan submitted: ${radarScan.uuid}`);
      
      // Update session with Radar UUID
      await step.do('update session with radar uuid', async () => {
        await sessionDO.fetch('https://do/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'scanning',
            radarUuid: radarScan.uuid
          })
        });
      });
      
      // Step 3: Poll for scan results
      // @ts-expect-error - Workflow serialization constraint, result is actually serializable
      const scanResult = (await step.do('poll for scan results', async () => {
        const maxAttempts = 40; // 10 minutes max (15s intervals)
        const pollInterval = '15 seconds';
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          console.log(`[Workflow] Polling attempt ${attempt + 1}/${maxAttempts}`);
          
          const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/urlscanner/v2/result/${radarScan.uuid}`,
            {
              headers: {
                'Authorization': `Bearer ${this.env.CLOUDFLARE_API_TOKEN}`
              }
            }
          );
          
          if (response.status === 200) {
            const result = await response.json<RadarScanResult>();
            console.log(`[Workflow] Scan completed successfully`);
            return result;
          } else if (response.status === 404) {
            // Still processing, wait and retry
            if (attempt < maxAttempts - 1) {
              await step.sleep('wait for scan', pollInterval);
            }
            continue;
          } else {
            const errorText = await response.text();
            throw new Error(`Radar API error (${response.status}): ${errorText}`);
          }
        }
        
        throw new Error('Scan timeout after 10 minutes');
      })) as RadarScanResult;
      
      // Step 4: Update status to generating
      await step.do('update status to generating', async () => {
        await sessionDO.fetch('https://do/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'generating' })
        });
      });
      
      console.log(`[Workflow] Generating PDF report`);
      
      // Step 5: Generate PDF
      const pdfBuffer = (await step.do('generate pdf', async () => {
        return await generatePDFReport(scanResult, sessionState.url);
      })) as Uint8Array;
      
      console.log(`[Workflow] PDF generated, size: ${pdfBuffer.length} bytes`);
      
      // Step 6: Update status to uploading
      await step.do('update status to uploading', async () => {
        await sessionDO.fetch('https://do/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'uploading' })
        });
      });
      
      // Step 7: Upload to R2
      const r2Key = await step.do<string>('upload to r2', async () => {
        const key = `sessions/${sessionId}/report.pdf`;
        
        await this.env.radar_scan_reports.put(key, pdfBuffer, {
          httpMetadata: {
            contentType: 'application/pdf'
          },
          customMetadata: {
            sessionId: sessionId,
            email: sessionState.email,
            url: sessionState.url,
            scanDate: new Date().toISOString(),
            radarUuid: radarScan.uuid
          }
        });
        
        console.log(`[Workflow] PDF uploaded to R2: ${key}`);
        return key;
      });
      
      // Step 8: Mark as completed (ready for download)
      await step.do('mark completed', async () => {
        await sessionDO.fetch('https://do/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'completed',
            r2Key: r2Key
          })
        });
      });
      
      console.log(`[Workflow] Scan workflow completed successfully for session: ${sessionId}`);
      
    } catch (error) {
      console.error(`[Workflow] Error in scan workflow:`, error);
      
      // Handle failure - mark as failed
      await step.do('mark failed', async () => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        await sessionDO.fetch('https://do/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'failed',
            error: errorMessage
          })
        });
      });
      
      // Re-throw to mark workflow as failed
      throw error;
    }
  }
}
