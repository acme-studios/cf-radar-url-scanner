# RadarScan

A URL security scanner powered by Cloudflare Radar. Scan any URL for security threats, analyze network behavior, and generate comprehensive PDF reports.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         RadarScan                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      React SPA Frontend                          │
│  • Vite + React + TypeScript                                     │
│  • Tailwind CSS v4                                               │
│  • Real-time WebSocket updates                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Cloudflare Workers Backend                     │
│  • API Routes (/api/*)                                           │
│  • WebSocket Handler (/ws/*)                                     │
│  • PDF Download Route                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Durable  │  │ Workflows│  │    D1    │
        │ Objects  │  │          │  │ Database │
        │          │  │          │  │          │
        │ Session  │  │  Scan    │  │ Session  │
        │ Manager  │  │ Workflow │  │  State   │
        └──────────┘  └──────────┘  └──────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │Cloudflare│  │    R2    │  │  Resend  │
        │  Radar   │  │  Bucket  │  │   API    │
        │   API    │  │          │  │          │
        │          │  │   PDF    │  │  Email   │
        │URL Scan  │  │ Storage  │  │ Delivery │
        └──────────┘  └──────────┘  └──────────┘
```

## Features

**Core Functionality:**
- Real-time URL security scanning via Cloudflare Radar API
- Comprehensive PDF reports with security analysis, network stats, and threat detection
- Email delivery of scan reports via Resend
- PDF preview before download

**Real-time Updates:**
- WebSocket-based live progress updates with auto-reconnection
- HTTP polling fallback for reliability
- Connection status indicator
- Live scan duration timer

**User Experience:**
- Success confetti animation on completion
- Toast notifications for feedback
- Keyboard shortcuts (Enter to submit, Escape to reset)
- One-click retry for failed scans

## Prerequisites

- Node.js 18+
- Cloudflare account with Workers enabled
- Cloudflare API token with Radar API access
- Resend API key for email functionality

## Quick Setup (Automated)

### 1. Clone and Configure

```bash
git clone <your-repo-url>
cd radar-url-scanner
```

### 2. Create `.dev.vars` File

Create a `.dev.vars` file in the root directory:

```env
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
RESEND_API_KEY=your_resend_key
```

### 3. Run Setup Script

The setup script will automatically:
- Install npm dependencies
- Create D1 database
- Apply database schema (`schema.sql`)
- Create R2 bucket
- Upload secrets to Wrangler
- Deploy Durable Objects

```bash
./setup.sh
```

**Note**: The `migrations/` folder is only for upgrading existing databases. Fresh installs use `schema.sql`.

### 4. Update Configuration

After setup, update `wrangler.jsonc`:
- `vars.APP_URL` - Your custom domain (e.g., `https://radar-scan.yourdomain.com`)

### 5. Start Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Manual Setup

If you prefer manual setup, follow these steps:

### 1. Install Dependencies
```bash
npm install
```

### 2. Create Cloudflare Resources
```bash
# D1 Database
npx wrangler d1 create radar-scanner-db
# Note the database_id and update wrangler.jsonc

# R2 Bucket
npx wrangler r2 bucket create radar-scan-reports

# Apply migrations
npx wrangler d1 execute radar-scanner-db --file=./schema.sql
```

### 3. Upload Secrets
```bash
echo "your_api_token" | npx wrangler secret put CLOUDFLARE_API_TOKEN
echo "your_resend_key" | npx wrangler secret put RESEND_API_KEY
```

### 4. Deploy
```bash
npx wrangler deploy
```

## Deployment

### Production Deployment

```bash
npm run build
npx wrangler deploy
```

### Environment Variables

**Public variables** (in `wrangler.jsonc`):
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `APP_URL` - Your deployed app URL

**Secret variables** (uploaded via Wrangler):
- `CLOUDFLARE_API_TOKEN` - API token with Radar access
- `RESEND_API_KEY` - Resend API key for emails

### Pre-deployment Checklist

- [ ] Update `APP_URL` in `wrangler.jsonc` to your custom domain
- [ ] Verify all secrets are uploaded
- [ ] Test locally with `npm run dev`
- [ ] Run `npm run build` to check for build errors
- [ ] Ensure no secrets in code (check `.gitignore`)

## Project Structure

```
radar-url-scanner/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── lib/               # Utilities
│   └── index.css          # Tailwind styles
├── worker/                # Cloudflare Workers backend
│   ├── durable-objects/   # Session management
│   ├── workflows/         # Scan workflow logic
│   ├── services/          # PDF generation, email
│   └── index.ts          # Main worker entry
├── public/               # Static assets
├── schema.sql           # D1 database schema
└── wrangler.jsonc       # Cloudflare configuration
```

## API Endpoints

- `POST /api/scan` - Create new scan session
- `GET /api/session/:id` - Get session status
- `GET /ws/:sessionId` - WebSocket connection for real-time updates
- `GET /api/download/:sessionId` - Download PDF report
- `GET /api/preview/:sessionId` - Preview PDF inline
- `POST /api/email/:sessionId` - Send report via email

## Tech Stack

**Frontend:**
- React 18
- TypeScript
- Vite 7
- Tailwind CSS v4
- Jost font family

**Backend:**
- Cloudflare Workers
- Durable Objects
- Workflows
- D1 Database
- R2 Storage

**External Services:**
- Cloudflare Radar API
- Resend API



## Contributing

Contributions welcome! Please open an issue or PR.

## License

MIT
