import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { RadarScanResult } from '../types';

export async function generatePDFReport(
  scanResult: RadarScanResult,
  url: string
): Promise<Uint8Array> {
  // Create PDF document
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4 size in points
  
  // Embed fonts
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  const { width, height } = page.getSize();
  let yPosition = height - 50;
  
  // Helper function to draw text
  const drawText = (text: string, size: number, font: typeof regularFont | typeof boldFont, color = rgb(0, 0, 0)) => {
    page.drawText(text, {
      x: 50,
      y: yPosition,
      size,
      font,
      color
    });
    yPosition -= size + 10;
  };
  
  // Header with RadarScan branding
  drawText('RadarScan Security Report', 24, boldFont, rgb(0.96, 0.51, 0.12));
  yPosition -= 10;
  
  // Scan metadata
  drawText(`URL: ${url}`, 12, regularFont);
  drawText(`Scanned: ${new Date().toLocaleString()}`, 10, regularFont, rgb(0.4, 0.4, 0.4));
  drawText(`Scan ID: ${scanResult.task.uuid}`, 10, regularFont, rgb(0.4, 0.4, 0.4));
  drawText(`Visibility: ${scanResult.task.visibility}`, 10, regularFont, rgb(0.4, 0.4, 0.4));
  yPosition -= 20;
  
  // Security Verdict Section
  drawText('Security Verdict', 16, boldFont);
  yPosition -= 5;
  
  const isMalicious = scanResult.verdicts?.overall?.malicious || false;
  const verdictText = isMalicious ? 'MALICIOUS' : 'SAFE';
  const verdictColor = isMalicious ? rgb(0.8, 0, 0) : rgb(0, 0.6, 0);
  drawText(verdictText, 14, boldFont, verdictColor);
  
  if (scanResult.verdicts?.overall?.categories?.length > 0) {
    drawText(`Categories: ${scanResult.verdicts.overall.categories.join(', ')}`, 10, regularFont);
  }
  
  if (scanResult.verdicts?.overall?.tags?.length > 0) {
    drawText(`Tags: ${scanResult.verdicts.overall.tags.join(', ')}`, 10, regularFont);
  }
  yPosition -= 20;
  
  // Page Information
  drawText('Page Information', 16, boldFont);
  yPosition -= 5;
  drawText(`Domain: ${scanResult.page.domain}`, 11, regularFont);
  drawText(`IP Address: ${scanResult.page.ip}`, 11, regularFont);
  drawText(`Country: ${scanResult.page.country}`, 11, regularFont);
  drawText(`ASN: ${scanResult.page.asn}`, 11, regularFont);
  drawText(`HTTP Status: ${scanResult.page.status}`, 11, regularFont);
  
  if (scanResult.page.title) {
    drawText(`Page Title: ${scanResult.page.title}`, 11, regularFont);
  }
  yPosition -= 20;
  
  // Technologies Detected
  if (scanResult.meta?.processors?.wappa?.data && scanResult.meta.processors.wappa.data.length > 0) {
    drawText('Technologies Detected', 16, boldFont);
    yPosition -= 5;
    
    const technologies = scanResult.meta.processors.wappa.data.slice(0, 10); // Top 10
    for (const tech of technologies) {
      const techText = `- ${tech.app} (${tech.categories.map(c => c.name).join(', ')})`;
      drawText(techText, 10, regularFont);
    }
    yPosition -= 20;
  }
  
  // Network Statistics
  drawText('Network Statistics', 16, boldFont);
  yPosition -= 5;
  drawText(`Total Requests: ${scanResult.data.requests?.length || 0}`, 11, regularFont);
  drawText(`Unique IPs: ${scanResult.stats?.uniqIPs || 0}`, 11, regularFont);
  drawText(`Unique Countries: ${scanResult.stats?.uniqCountries || 0}`, 11, regularFont);
  drawText(`Data Transferred: ${((scanResult.stats?.dataLength || 0) / 1024).toFixed(2)} KB`, 11, regularFont);
  
  // Additional data insights
  if (scanResult.data.cookies && Array.isArray(scanResult.data.cookies)) {
    drawText(`Cookies Found: ${scanResult.data.cookies.length}`, 11, regularFont);
  }
  if (scanResult.data.links && Array.isArray(scanResult.data.links)) {
    drawText(`Links Found: ${scanResult.data.links.length}`, 11, regularFont);
  }
  if (scanResult.data.console && Array.isArray(scanResult.data.console)) {
    drawText(`Console Messages: ${scanResult.data.console.length}`, 11, regularFont);
  }
  yPosition -= 20;
  
  // Domains Contacted
  if (scanResult.lists?.domains && scanResult.lists.domains.length > 0) {
    drawText('Domains Contacted', 16, boldFont);
    yPosition -= 5;
    
    const domains = scanResult.lists.domains.slice(0, 15); // Top 15
    for (const domain of domains) {
      if (yPosition < 100) {
        // Add new page if running out of space
        const newPage = pdfDoc.addPage([595, 842]);
        yPosition = height - 50;
        page.drawText = newPage.drawText.bind(newPage);
      }
      drawText(`- ${domain}`, 10, regularFont);
    }
    yPosition -= 20;
  }
  
  // Request Analysis
  if (scanResult.data.requests && scanResult.data.requests.length > 0) {
    if (yPosition < 200) {
      const newPage = pdfDoc.addPage([595, 842]);
      yPosition = height - 50;
      page.drawText = newPage.drawText.bind(newPage);
    }
    
    drawText('Request Analysis', 16, boldFont);
    yPosition -= 5;
    
    // Count request types
    const requestTypes: Record<string, number> = {};
    const failedRequests = scanResult.data.requests.filter(r => r.status && r.status >= 400);
    
    scanResult.data.requests.forEach(req => {
      const type = req.type || 'other';
      requestTypes[type] = (requestTypes[type] || 0) + 1;
    });
    
    drawText(`Total Requests: ${scanResult.data.requests.length}`, 11, regularFont);
    if (failedRequests.length > 0) {
      drawText(`Failed Requests: ${failedRequests.length}`, 11, regularFont, rgb(0.8, 0.4, 0));
    }
    
    // Show request type breakdown
    Object.entries(requestTypes).slice(0, 5).forEach(([type, count]) => {
      drawText(`  ${type}: ${count}`, 10, regularFont);
    });
    yPosition -= 20;
  }
  
  // Cookie Security Analysis
  if (scanResult.data.cookies && scanResult.data.cookies.length > 0) {
    if (yPosition < 150) {
      const newPage = pdfDoc.addPage([595, 842]);
      yPosition = height - 50;
      page.drawText = newPage.drawText.bind(newPage);
    }
    
    drawText('Cookie Security', 16, boldFont);
    yPosition -= 5;
    
    const secureCookies = scanResult.data.cookies.filter(c => c.secure);
    const httpOnlyCookies = scanResult.data.cookies.filter(c => c.httpOnly);
    const thirdPartyCookies = scanResult.data.cookies.filter(c => c.domain && !c.domain.includes(scanResult.page.domain));
    
    drawText(`Total Cookies: ${scanResult.data.cookies.length}`, 11, regularFont);
    drawText(`Secure Cookies: ${secureCookies.length}`, 11, regularFont);
    drawText(`HttpOnly Cookies: ${httpOnlyCookies.length}`, 11, regularFont);
    if (thirdPartyCookies.length > 0) {
      drawText(`Third-Party Cookies: ${thirdPartyCookies.length}`, 11, regularFont, rgb(0.8, 0.4, 0));
    }
    yPosition -= 20;
  }
  
  // Console Errors & Warnings
  if (scanResult.data.console && scanResult.data.console.length > 0) {
    if (yPosition < 150) {
      const newPage = pdfDoc.addPage([595, 842]);
      yPosition = height - 50;
      page.drawText = newPage.drawText.bind(newPage);
    }
    
    drawText('Console Messages', 16, boldFont);
    yPosition -= 5;
    
    const errors = scanResult.data.console.filter(c => c.type === 'error');
    const warnings = scanResult.data.console.filter(c => c.type === 'warning');
    
    drawText(`Total Messages: ${scanResult.data.console.length}`, 11, regularFont);
    if (errors.length > 0) {
      drawText(`Errors: ${errors.length}`, 11, regularFont, rgb(0.8, 0, 0));
    }
    if (warnings.length > 0) {
      drawText(`Warnings: ${warnings.length}`, 11, regularFont, rgb(0.8, 0.4, 0));
    }
    yPosition -= 20;
  }
  
  // SSL/TLS Certificate Info
  if (scanResult.page.securityDetails) {
    if (yPosition < 150) {
      const newPage = pdfDoc.addPage([595, 842]);
      yPosition = height - 50;
      page.drawText = newPage.drawText.bind(newPage);
    }
    
    drawText('SSL/TLS Certificate', 16, boldFont);
    yPosition -= 5;
    
    if (scanResult.page.securityDetails.protocol) {
      drawText(`Protocol: ${scanResult.page.securityDetails.protocol}`, 11, regularFont);
    }
    if (scanResult.page.securityDetails.issuer) {
      drawText(`Issuer: ${scanResult.page.securityDetails.issuer}`, 11, regularFont);
    }
    if (scanResult.page.securityDetails.validFrom && scanResult.page.securityDetails.validTo) {
      drawText(`Valid: ${scanResult.page.securityDetails.validFrom} to ${scanResult.page.securityDetails.validTo}`, 10, regularFont);
    }
    yPosition -= 20;
  }
  
  // Phishing Detection
  if (scanResult.meta?.processors?.phishing?.data && scanResult.meta.processors.phishing.data.length > 0) {
    if (yPosition < 150) {
      const newPage = pdfDoc.addPage([595, 842]);
      yPosition = height - 50;
      page.drawText = newPage.drawText.bind(newPage);
    }
    
    drawText('Phishing Indicators', 16, boldFont, rgb(0.8, 0, 0));
    yPosition -= 5;
    
    for (const indicator of scanResult.meta.processors.phishing.data) {
      drawText(`WARNING: ${indicator}`, 10, regularFont, rgb(0.8, 0, 0));
    }
    yPosition -= 20;
  }
  
  // Malicious Content Detection
  if (scanResult.stats.malicious && (scanResult.stats.malicious.requests || scanResult.stats.malicious.domains)) {
    if (yPosition < 150) {
      const newPage = pdfDoc.addPage([595, 842]);
      yPosition = height - 50;
      page.drawText = newPage.drawText.bind(newPage);
    }
    
    drawText('Malicious Content Detected', 16, boldFont, rgb(0.8, 0, 0));
    yPosition -= 5;
    
    if (scanResult.stats.malicious.requests) {
      drawText(`Malicious Requests: ${scanResult.stats.malicious.requests}`, 11, regularFont, rgb(0.8, 0, 0));
    }
    if (scanResult.stats.malicious.domains) {
      drawText(`Malicious Domains: ${scanResult.stats.malicious.domains}`, 11, regularFont, rgb(0.8, 0, 0));
    }
    yPosition -= 20;
  }
  
  // Security Summary Box (if space available)
  if (yPosition > 150) {
    yPosition -= 10;
    drawText('Security Summary', 16, boldFont);
    yPosition -= 5;
    
    const threatLevel = isMalicious ? 'HIGH RISK' : 'LOW RISK';
    const threatColor = isMalicious ? rgb(0.8, 0, 0) : rgb(0, 0.6, 0);
    drawText(`Threat Level: ${threatLevel}`, 12, boldFont, threatColor);
    
    if (scanResult.lists?.ips && scanResult.lists.ips.length > 0) {
      drawText(`Total IPs Contacted: ${scanResult.lists.ips.length}`, 10, regularFont);
    }
    if (scanResult.lists?.asns && scanResult.lists.asns.length > 0) {
      drawText(`ASNs Involved: ${scanResult.lists.asns.length}`, 10, regularFont);
    }
    if (scanResult.lists?.countries && scanResult.lists.countries.length > 0) {
      drawText(`Countries: ${scanResult.lists.countries.join(', ')}`, 10, regularFont);
    }
  }
  
  // Footer
  yPosition = 50;
  page.drawText('Generated by RadarScan - Powered by Cloudflare Radar', {
    x: 50,
    y: yPosition,
    size: 8,
    font: regularFont,
    color: rgb(0.5, 0.5, 0.5)
  });
  
  page.drawText(`Report Date: ${new Date().toISOString()}`, {
    x: width - 250,
    y: yPosition,
    size: 8,
    font: regularFont,
    color: rgb(0.5, 0.5, 0.5)
  });
  
  // Save and return PDF as Uint8Array
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
