# ReunitePets.org Deployment Guide

This document covers deploying ReunitePets.org to production environments.

## Prerequisites

- Node.js 20.x
- PostgreSQL 16+
- Redis 7+ (optional, for production rate limiting)
- Docker & Docker Compose (for containerized deployment)

## Quick Start (Docker)

The fastest way to deploy is using Docker Compose:

```bash
# Clone the repository
git clone https://github.com/your-org/reunitepets.git
cd reunitepets/frontend

# Copy and configure environment
cp .env.example .env.local
# Edit .env.local with your values

# Build and start
docker-compose up -d

# Run database migrations
docker-compose exec app npx prisma migrate deploy

# Seed initial data (optional)
docker-compose exec app npm run seed:metros
```

## Environment Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `NEXTAUTH_URL` | Public URL of your site | `https://reunitepets.org` |
| `NEXTAUTH_SECRET` | Random 32+ character string | Generate with `openssl rand -base64 32` |

### Email Configuration

For sending password resets, verification emails, and notifications:

```env
EMAIL_SERVICE="sendgrid"  # or gmail, mailgun
EMAIL_USER="your-email@example.com"
EMAIL_PASSWORD="your-api-key"
EMAIL_FROM="ReunitePets <noreply@reunitepets.org>"
```

### File Storage (Bunny CDN)

For pet photo uploads:

```env
BUNNY_STORAGE_ZONE="reunitepets"
BUNNY_API_KEY="your-api-key"
BUNNY_CDN_URL="https://cdn.reunitepets.org"
```

### Rate Limiting (Production)

For distributed rate limiting with Redis:

```env
REDIS_URL="redis://your-redis:6379"
```

### Error Tracking (Sentry)

For production error monitoring:

```env
NEXT_PUBLIC_SENTRY_DSN="https://xxx@sentry.io/xxx"
```

## Deployment Options

### Option 1: Docker Compose (Recommended for VPS)

```bash
# Build production image
docker-compose build

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f app
```

### Option 2: Vercel/Railway/Render

1. Connect your repository
2. Set environment variables in the dashboard
3. Configure build command: `npm run build`
4. Configure start command: `npm run start`
5. Set up a managed PostgreSQL database

### Option 3: Manual Deployment

```bash
# Install dependencies
npm ci --only=production

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Build application
npm run build

# Start production server
npm run start
```

## Database Setup

### Initial Setup

```bash
# Create database
createdb reunitepets

# Run migrations
npx prisma migrate deploy

# Seed metro areas (optional)
npm run seed:metros
```

### Backup Strategy

```bash
# Backup database
pg_dump reunitepets > backup_$(date +%Y%m%d).sql

# Restore database
psql reunitepets < backup_20240101.sql
```

## SSL/TLS Configuration

For production, always use HTTPS. Options:

1. **Cloudflare**: Free SSL with their proxy
2. **Let's Encrypt**: Free certificates with certbot
3. **AWS/GCP**: Use their certificate managers

## Health Checks

The application exposes a health endpoint:

```bash
curl https://reunitepets.org/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Monitoring

### Application Metrics

Monitor these endpoints:
- `/api/admin/health/summary` - System health
- `/api/admin/health/metrics` - Performance metrics

### Recommended Tools

- **Sentry**: Error tracking
- **Uptime Robot**: Availability monitoring
- **Grafana/Prometheus**: Metrics dashboards

## Scaling

### Horizontal Scaling

The application is stateless and can be scaled horizontally:

1. Run multiple instances behind a load balancer
2. Use Redis for session storage (configure in NextAuth)
3. Use CDN for static assets

### Database Scaling

- Use read replicas for heavy read workloads
- Consider connection pooling (PgBouncer)
- Monitor slow queries

## Security Checklist

Before going live:

- [ ] All secrets in environment variables (not in code)
- [ ] HTTPS enabled with valid certificate
- [ ] Database access restricted by IP/VPC
- [ ] Rate limiting configured
- [ ] CORS configured for your domains
- [ ] Admin routes protected
- [ ] Sentry or error tracking enabled
- [ ] Database backups configured
- [ ] File upload limits configured

## Troubleshooting

### Common Issues

**Database connection failed**
- Check DATABASE_URL format
- Verify network connectivity
- Check PostgreSQL is running

**Build fails on Prisma**
- Run `npx prisma generate` before build
- Ensure schema.prisma is in the correct location

**Email not sending**
- Verify EMAIL_* environment variables
- Check spam folder
- Review email service logs

**Image uploads failing**
- Verify Bunny CDN credentials
- Check storage zone configuration
- Review CORS settings

### Getting Help

1. Check the [Issues](https://github.com/your-org/reunitepets/issues)
2. Review [Discussions](https://github.com/your-org/reunitepets/discussions)
3. Contact: support@reunitepets.org

## CI/CD Pipeline

The project includes a GitHub Actions pipeline (`.github/workflows/ci.yml`) that:

1. Runs linting and type checks
2. Runs unit tests
3. Builds the application
4. Runs E2E tests (on main branch)
5. Builds Docker image (on main branch)
6. Runs security scans

Configure secrets in GitHub:
- `DATABASE_URL` (for test database)
- `NEXTAUTH_SECRET`
- Other production secrets

## Production Checklist

Before launch:

1. [ ] Environment variables configured
2. [ ] Database migrated and seeded
3. [ ] SSL certificate installed
4. [ ] Health checks passing
5. [ ] Error tracking enabled
6. [ ] Backups configured
7. [ ] Monitoring set up
8. [ ] DNS configured
9. [ ] Email delivery verified
10. [ ] File uploads working
11. [ ] Rate limiting tested
12. [ ] Security headers configured
