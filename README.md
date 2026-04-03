# SensorySafe Backend Setup

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

Server runs on http://localhost:3000

## API Endpoints

- `GET /api/reports` - Get all reports
- `POST /api/reports/noise` - Report noise zone
- `POST /api/reports/crowd` - Report crowded area
- `POST /api/reports/construction` - Report construction zone

## Testing

Open index.html in browser and click:
- "Report Noise" - Adds red marker
- "Report Crowd" - Adds orange marker
- "Report Construction" - Adds purple marker

All users see the same markers!
