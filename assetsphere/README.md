# AssetSphere — Enterprise Software Asset Management

Replace SAMPro with a self-hosted, open platform for full software asset lifecycle management.

## Features
- Full asset lifecycle management (request → retire)
- SSO via Azure Active Directory (MSAL/OIDC)
- API integrations: NextThink, ServiceNow, Microsoft Intune
- License compliance tracking and alerts
- Auto-discovery of unregistered software
- PostgreSQL backend with full audit log
- Docker Compose (2-server) or Kubernetes deployment

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Azure AD App Registration (for SSO)

### Setup
1. Clone the repo
2. Copy `.env.example` to `.env` and fill in your values
3. Create Azure AD App Registration:
   - Platform: Single-page application
   - Redirect URI: http://localhost:3000 (dev) or https://your-domain (prod)
   - Add API permission: User.Read
   - Create security groups: SAM-Admins, SAM-Managers, SAM-Viewers, SAM-Requestors
4. Run: `docker compose up -d`
5. Access: http://localhost:3000

### Production Deployment
See `kubernetes/` for Kubernetes manifests (2+ nodes recommended).

## Architecture

```
[Browser] → [Nginx (Frontend)] → [FastAPI Backend] → [PostgreSQL]
                                       ↕                    ↕
                               [NextThink API]         [Redis Cache]
                               [ServiceNow API]
                               [MS Graph/Intune]
                               [Azure AD (Auth)]
```

## Integration Setup

### NextThink
- Create a service account in NextThink with read access
- Enable the REST API in your NextThink instance
- Add client credentials to .env

### ServiceNow
- Create a dedicated integration user
- Assign roles: itil, asset, cmdb_read
- Use basic auth or OAuth (set in .env)

### Microsoft Intune / Graph
- App Registration in Azure AD with permissions:
  - DeviceManagementApps.Read.All
  - DeviceManagementManagedDevices.Read.All

## License
MIT
