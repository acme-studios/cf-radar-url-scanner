import type { Env } from '../types';

function sanitize(s: string) {
  return s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
}

export async function sendEmailViaResend(
  env: Env,
  email: string,
  url: string,
  sessionId: string,
  downloadUrl: string
): Promise<void> {
  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('[Email] Invalid email format:', email);
    throw new Error('Invalid email format');
  }

  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[Email] Missing RESEND_API_KEY');
    throw new Error('Missing RESEND_API_KEY');
  }

  const html = renderEmailTemplate(sanitize(url), sessionId, downloadUrl);
  const text = renderPlainTextEmail(sanitize(url), sessionId, downloadUrl);
  
  console.log('[Email] Sending to:', email);
  console.log('[Email] API Key present:', !!apiKey);
  console.log('[Email] API Key prefix:', apiKey.substring(0, 7));
  
  const FROM = env.RESEND_FROM || 'Radar Scanner <onboarding@resend.dev>';
  
  const payload = {
    from: FROM,
    to: [email],
    subject: `Your URL Scan Report is Ready - ${url}`,
    html: html,
    text: text
  };
  
  console.log('[Email] Sending from:', FROM);
  console.log('[Email] Subject:', payload.subject);
  
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 
      'content-type': 'application/json', 
      authorization: `Bearer ${apiKey}` 
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('[Email] Resend failed:', response.status, detail.slice(0, 500));
    throw new Error(`Resend failed (${response.status}): ${detail.slice(0, 500)}`);
  }
  
  const result = await response.json() as { id: string };
  console.log('[Email] Email sent successfully. ID:', result.id);
}

function renderEmailTemplate(url: string, sessionId: string, downloadUrl: string): string {
  const scanDate = new Date().toLocaleString();
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      padding: 30px;
    }
    .info-box {
      background: #f9fafb;
      border-left: 4px solid #667eea;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .info-box h3 {
      margin-top: 0;
      color: #667eea;
    }
    .info-box ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .info-box li {
      padding: 5px 0;
    }
    .button {
      display: inline-block;
      background: #667eea;
      color: white !important;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: 600;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #6b7280;
      font-size: 14px;
      background: #f9fafb;
    }
    .note {
      color: #6b7280;
      font-size: 14px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Your Scan is Complete!</h1>
    </div>
    <div class="content">
      <p>We've finished scanning <strong>${url}</strong> and your report is ready for download.</p>
      
      <div class="info-box">
        <h3>📊 Scan Details</h3>
        <ul>
          <li><strong>URL:</strong> ${url}</li>
          <li><strong>Scanned:</strong> ${scanDate}</li>
          <li><strong>Session ID:</strong> ${sessionId}</li>
          <li><strong>Status:</strong> ✅ Completed</li>
        </ul>
      </div>
      
      <center>
        <a href="${downloadUrl}" class="button">📥 Download Report (PDF)</a>
      </center>
      
      <p class="note">
        <strong>Note:</strong> This link is valid for 24 hours. After that, you'll need to run a new scan.
      </p>
    </div>
    <div class="footer">
      <p><strong>Powered by Cloudflare Radar URL Scanner</strong></p>
      <p>Questions? Reply to this email or visit our support page.</p>
    </div>
  </div>
</body>
</html>
  `;
}

function renderPlainTextEmail(url: string, sessionId: string, downloadUrl: string): string {
  const scanDate = new Date().toLocaleString();
  
  return `
Your URL Scan Report is Ready!

We've finished scanning ${url} and your report is ready for download.

Scan Details:
- URL: ${url}
- Scanned: ${scanDate}
- Session ID: ${sessionId}
- Status: Completed

Download your report: ${downloadUrl}

Note: This link is valid for 24 hours. After that, you'll need to run a new scan.

---
Powered by Cloudflare Radar URL Scanner
  `;
}
