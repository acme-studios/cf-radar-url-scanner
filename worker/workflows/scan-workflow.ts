import { WorkflowEntrypoint, WorkflowStep } from 'cloudflare:workers';
import type { WorkflowEvent } from 'cloudflare:workers';
import type { Env, RadarScanResponse, RadarScanResult, SessionState } from '../types';
import { generatePDFReport } from '../services/pdf-generator';
import { retryWithBackoff, isRetryableError } from '../utils/retry';
import { getUserFriendlyError, formatErrorForLogging } from '../utils/error-messages';

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
      
      // Update progress: Starting scan
      await step.do('update progress: starting', async () => {
        await sessionDO.fetch('https://do/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            progressPercent: 5,
            progressMessage: 'Submitting URL to Cloudflare Radar...'
          })
        });
      });
      
      // Step 2: Submit to Radar API with retry logic
      const radarScan = await step.do<RadarScanResponse>('submit to radar api', async () => {
        return await retryWithBackoff(
          async () => {
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
              const error = new Error(`Radar API error (${response.status}): ${errorText}`) as Error & { status: number };
              error.status = response.status;
              throw error;
            }
            
            const result = await response.json<RadarScanResponse>();
            console.log('[Workflow] Radar API response:', JSON.stringify(result));
            return result;
          },
          {
            maxAttempts: 3,
            initialDelayMs: 2000,
            maxDelayMs: 10000,
            retryableErrors: isRetryableError
          }
        );
      });
      
      console.log(`[Workflow] Radar scan submitted: ${radarScan.uuid}`);
      
      // Update session with Radar UUID and progress
      await step.do('update session with radar uuid', async () => {
        await sessionDO.fetch('https://do/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'scanning',
            radarUuid: radarScan.uuid,
            progressPercent: 15,
            progressMessage: 'Scan submitted. Waiting for results...'
          })
        });
      });
      
      // Step 3: Poll for scan results with adaptive intervals
      const scanResult = (await step.do('poll for scan results', async () => {
        const maxAttempts = 40;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          // Update progress during polling
          const progressPercent = Math.min(15 + Math.floor((attempt / maxAttempts) * 50), 65);
          await sessionDO.fetch('https://do/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              progressPercent,
              progressMessage: `Analyzing URL... (${attempt + 1}/${maxAttempts})`
            })
          });
          
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
              // Use the appropriate sleep duration based on attempt
              if (attempt < 5) {
                await step.sleep('wait for scan', '5 seconds');
              } else if (attempt < 15) {
                await step.sleep('wait for scan', '10 seconds');
              } else {
                await step.sleep('wait for scan', '15 seconds');
              }
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
          body: JSON.stringify({ 
            status: 'generating',
            progressPercent: 70,
            progressMessage: 'Scan complete! Generating PDF report...'
          })
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
          body: JSON.stringify({ 
            status: 'uploading',
            progressPercent: 85,
            progressMessage: 'Uploading report to cloud storage...'
          })
        });
      });
      
      // Step 7: Upload to R2 with retry logic
      const r2Key = await step.do<string>('upload to r2', async () => {
        const key = `sessions/${sessionId}/report.pdf`;
        
        await retryWithBackoff(
          async () => {
            await this.env.radar_scan_reports.put(key, pdfBuffer, {
              httpMetadata: {
                contentType: 'application/pdf'
              },
              customMetadata: {
                sessionId: sessionId,
                url: sessionState.url,
                createdAt: new Date().toISOString()
              }
            });
          },
          {
            maxAttempts: 3,
            initialDelayMs: 1000,
            maxDelayMs: 5000,
            retryableErrors: isRetryableError
          }
        );
        
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
            r2Key: r2Key,
            progressPercent: 100,
            progressMessage: 'Scan complete! Your report is ready.'
          })
        });
      });
      
      console.log(`[Workflow] Scan workflow completed successfully for session: ${sessionId}`);
      
    } catch (error) {
      // Log technical error details
      console.error(formatErrorForLogging(error, 'Workflow'));
      
      // Get user-friendly error message
      const friendlyError = getUserFriendlyError(error);
      const displayMessage = `${friendlyError.title}: ${friendlyError.message}${friendlyError.action ? ' ' + friendlyError.action : ''}`;
      
      // Handle failure - mark as failed
      await step.do('mark failed', async () => {
        await sessionDO.fetch('https://do/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'failed',
            error: displayMessage
          })
        });
      });
      
      // Re-throw to mark workflow as failed
      throw error;
    }
  }
}
