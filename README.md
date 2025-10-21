# v2u Cloudflare R2 Tools

Management tools and utilities for Cloudflare R2 storage integration with v2u platform.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Test R2 connection
npm run test

# Browse R2 content
npm run browse
```

## 📁 Project Structure

```
cloudflare-r2/
├── bulk-upload/          # Bulk upload utilities
│   ├── scanner.js       # Directory scanning
│   └── uploader.js      # Batch upload handler
├── management/          # R2 management tools
│   ├── cleanup.js       # Storage cleanup
│   └── monitor.js       # Usage monitoring
└── scripts/            # Utility scripts
    ├── browse-r2.js    # Content browser
    └── test-connection.js # Connection tester
```

## 🛠️ Available Commands

```bash
# Browse R2 content
npm run browse

# Manage R2 storage
npm run manage

# Run bulk upload
npm run bulk-upload

# Monitor storage usage
npm run monitor
```

## 🔐 Environment Setup

Copy the example environment file:
```bash
cp .env.example .env
```

Required variables:
```bash
R2_ENDPOINT=
R2_ACCESS_KEY=
R2_SECRET_KEY=
R2_BUCKET=
```

## 📊 Storage Organization

### Public Content
```
public/
├── daily/
│   ├── portrait/YYYY/MM/
│   └── landscape/YYYY/MM/
└── assets/
    └── generated/
```

### Private Content
```
private/
├── educate/
│   ├── beginner/
│   ├── intermediate/
│   └── advanced/
└── projects/
    └── [project-name]/
```

## 🔄 Automation

- Automatic cleanup of temporary files
- Usage monitoring and alerts
- Periodic storage optimization
- Backup management