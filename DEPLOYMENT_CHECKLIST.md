# Production Deployment Checklist

## Pre-Deployment Requirements

Before deploying to production, ensure all items are complete.

---

## 1. Environment Configuration ⚙️

### Required Environment Variables

**Database**
- [ ] `DATABASE_URL` - Production PostgreSQL connection string
- [ ] Database has all migrations applied
- [ ] Database backed up before deployment

**Authentication**
- [ ] `NEXTAUTH_SECRET` - Strong random secret (generate: `openssl rand -base64 32`)
- [ ] `NEXTAUTH_URL` - Production URL (e.g., `https://reunitepets.org`)
- [ ] `GOOGLE_CLIENT_ID` - OAuth (if using Google login)
- [ ] `GOOGLE_CLIENT_SECRET` - OAuth
- [ ] `FACEBOOK_CLIENT_ID` - OAuth (if using Facebook login)
- [ ] `FACEBOOK_CLIENT_SECRET` - OAuth

**Push Notifications**
- [ ] `NEXT_PUBLIC_VAPID_PUBLIC_KEY` - From Week 1 setup
- [ ] `VAPID_PRIVATE_KEY` - From Week 1 setup (KEEP SECURE!)
- [ ] `VAPID_SUBJECT` - mailto:your-email@domain.com

**Sentry Error Tracking**
- [ ] `NEXT_PUBLIC_SENTRY_DSN` - From Sentry.io dashboard
- [ ] `SENTRY_AUTH_TOKEN` - For source map uploads
- [ ] `SENTRY_ORG` - Your Sentry organization name
- [ ] `SENTRY_PROJECT` - Your Sentry project name

**Email Service (Resend)**
- [ ] `RESEND_API_KEY` - From resend.com
- [ ] `ADMIN_NOTIFICATION_EMAIL` - Where admin alerts go

**SMS Service (Twilio) - Optional for Week 1**
- [ ] `TWILIO_ACCOUNT_SID`
- [ ] `TWILIO_AUTH_TOKEN`
- [ ] `TWILIO_PHONE_NUMBER`

**File Upload (Cloudinary or AWS S3)**
- [ ] `CLOUDINARY_CLOUD_NAME` OR `AWS_S3_BUCKET`
- [ ] `CLOUDINARY_API_KEY` OR `AWS_ACCESS_KEY_ID`
- [ ] `CLOUDINARY_API_SECRET` OR `AWS_SECRET_ACCESS_KEY`

**Application**
- [ ] `NEXT_PUBLIC_BASE_URL` - Your production domain

---

## 2. Infrastructure Setup 🏗️

### Hosting Platform (Choose One)

**Option A: Vercel (Recommended)**
- [ ] Create Vercel account
- [ ] Connect GitHub repository
- [ ] Configure environment variables in Vercel dashboard
- [ ] Set build command: `cd frontend && npm run build`
- [ ] Set output directory: `frontend/.next`
- [ ] Enable automatic deployments from `main` branch

**Option B: AWS/DigitalOcean/Other**
- [ ] Provision server (minimum: 2GB RAM, 2 CPU cores)
- [ ] Install Node.js (v18+)
- [ ] Install PostgreSQL
- [ ] Configure reverse proxy (nginx/caddy)
- [ ] Set up SSL certificate (Let's Encrypt)
- [ ] Configure systemd service for auto-restart

### Database
- [ ] PostgreSQL 14+ running
- [ ] Database created
- [ ] Database user with appropriate permissions
- [ ] Connection pooling configured (use PgBouncer for production)
- [ ] Automatic backups enabled (daily minimum)
- [ ] Point-in-time recovery configured

### CDN & Static Assets
- [ ] Configure CDN for static files (Cloudflare/Vercel/BunnyCDN)
- [ ] Image optimization enabled
- [ ] Gzip/Brotli compression enabled
- [ ] Cache headers configured

---

## 3. Security Hardening 🔒

### SSL/TLS
- [ ] Valid SSL certificate installed
- [ ] HTTPS enforced (HTTP redirects to HTTPS)
- [ ] HSTS header enabled
- [ ] SSL Labs rating A or higher

### Application Security
- [ ] CSP headers configured (already in next.config.js)
- [ ] Rate limiting enabled for all API endpoints
- [ ] CORS configured properly
- [ ] SQL injection prevention (using Prisma ORM - ✅)
- [ ] XSS prevention enabled
- [ ] CSRF tokens configured

### Secrets Management
- [ ] All secrets in environment variables (NOT in code)
- [ ] `.env.local` added to `.gitignore` (✅ already done)
- [ ] Secrets rotated if ever exposed
- [ ] Use secret management service (AWS Secrets Manager, Vercel, etc.)

### Authentication
- [ ] Strong password requirements enforced
- [ ] Account lockout after failed attempts
- [ ] Session timeout configured (30 days default)
- [ ] Email verification required for new accounts

---

## 4. Monitoring & Logging 📊

### Sentry Setup
- [ ] Sentry project created at sentry.io
- [ ] DSN added to environment variables
- [ ] Source maps uploading correctly
- [ ] Test error sent and received in Sentry dashboard
- [ ] Alerts configured for critical errors
- [ ] Performance monitoring enabled

### Application Monitoring
- [ ] Uptime monitoring (UptimeRobot, Pingdom, etc.)
- [ ] Alert if site goes down
- [ ] Database monitoring (connection pool, slow queries)
- [ ] API response time monitoring

### Logging
- [ ] Structured logs enabled (using logEvent() - ✅)
- [ ] Log aggregation service (Datadog, LogDNA, or built-in)
- [ ] Log retention policy (30-90 days)
- [ ] Log rotation configured

---

## 5. Performance Optimization ⚡

### Build Optimization
- [ ] Production build completes without errors
- [ ] Bundle size analyzed (`npm run build`)
- [ ] Lighthouse score > 90 for performance
- [ ] Images optimized (WebP/AVIF format)
- [ ] Unused code eliminated

### Database Optimization
- [ ] Indexes created on frequently queried columns
- [ ] Connection pooling enabled
- [ ] Query performance analyzed
- [ ] N+1 queries eliminated

### Caching
- [ ] Redis configured for session storage (optional but recommended)
- [ ] API response caching where appropriate
- [ ] Static asset caching (1 year for immutable assets)

---

## 6. Testing Before Deploy 🧪

### Automated Tests
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing (or manually verified)

### Manual Testing (From TESTING_CHECKLIST_WEEK1.md)
- [ ] All critical user flows tested
- [ ] Push notifications working
- [ ] Error tracking verified
- [ ] Mobile responsiveness checked
- [ ] Cross-browser testing (Chrome, Safari, Firefox)

### Load Testing
- [ ] Performance tested with expected user load
- [ ] Database can handle concurrent connections
- [ ] API endpoints respond within acceptable time (< 500ms)

---

## 7. Data & Privacy Compliance 🔐

### GDPR/Privacy (if applicable)
- [ ] Privacy Policy published
- [ ] Cookie consent banner (if using analytics cookies)
- [ ] Data export functionality
- [ ] Account deletion functionality
- [ ] Data retention policy documented

### Legal Documents
- [ ] Terms of Service reviewed by legal (recommended)
- [ ] Liability Waiver appropriate for jurisdiction
- [ ] Privacy Policy accurate and complete
- [ ] Contact information for legal notices

---

## 8. Content & Communication 📝

### Pre-Launch
- [ ] About page complete
- [ ] How It Works page complete
- [ ] FAQ page complete
- [ ] Contact information published
- [ ] Social media accounts created (optional)

### Email Templates
- [ ] Welcome email tested
- [ ] Password reset email tested
- [ ] Notification emails tested
- [ ] Admin alert emails tested

### Error Messages
- [ ] User-friendly error messages
- [ ] 404 page designed
- [ ] 500 error page designed
- [ ] Maintenance mode page ready

---

## 9. Backup & Recovery 💾

### Database Backups
- [ ] Automated daily backups configured
- [ ] Backup retention: 30 days minimum
- [ ] Backups stored off-site (different region)
- [ ] Backup restoration tested successfully
- [ ] Point-in-time recovery available

### Code Backups
- [ ] GitHub repository up to date
- [ ] Main branch protected (require PR for changes)
- [ ] Tagged release created (v1.0.0)

### Disaster Recovery Plan
- [ ] Recovery Time Objective (RTO) defined
- [ ] Recovery Point Objective (RPO) defined
- [ ] Runbook for common failures documented
- [ ] On-call rotation established (if team)

---

## 10. Launch Preparation 🚀

### DNS Configuration
- [ ] Domain registered
- [ ] DNS A/AAAA records pointing to server
- [ ] WWW redirect configured
- [ ] MX records for email (if needed)
- [ ] SPF/DKIM records for email sending

### SSL Certificate
- [ ] SSL certificate provisioned
- [ ] Certificate auto-renewal enabled
- [ ] Certificate expiry monitoring

### Deployment Process
- [ ] CI/CD pipeline configured
- [ ] Deployment script tested
- [ ] Rollback procedure documented
- [ ] Zero-downtime deployment verified

### Post-Deploy Verification
- [ ] Health check endpoint works (`/api/health`)
- [ ] Database migrations applied
- [ ] All environment variables set correctly
- [ ] Push notifications working
- [ ] Error tracking receiving events
- [ ] Email sending working

---

## 11. Launch Day Checklist ✈️

### Final Checks (1 hour before launch)
- [ ] All team members notified
- [ ] Support email/channels monitored
- [ ] Database backup completed
- [ ] Sentry monitoring active
- [ ] Uptime monitoring active

### Deploy
- [ ] Deploy to production
- [ ] Verify deployment successful
- [ ] Check all critical pages load
- [ ] Test one complete user flow

### Monitor (First 24 hours)
- [ ] Watch Sentry for errors
- [ ] Monitor server resources (CPU, memory, disk)
- [ ] Check database connection pool
- [ ] Review error logs
- [ ] Test push notifications
- [ ] Monitor email deliverability

### Communication
- [ ] Announce launch (social media, email list, etc.)
- [ ] Update status page (if applicable)
- [ ] Be available for support

---

## 12. Post-Launch (Week 1) 📈

### Monitoring
- [ ] Daily Sentry review for new errors
- [ ] Daily uptime check
- [ ] Weekly performance review
- [ ] User feedback collection

### Metrics to Track
- [ ] Total registered users
- [ ] Active rescue forces
- [ ] Lost pet reports submitted
- [ ] Reunion success rate
- [ ] Push notification delivery rate
- [ ] Average response time
- [ ] Error rate

### Support
- [ ] Respond to user feedback within 24 hours
- [ ] Fix critical bugs immediately
- [ ] Document common support questions
- [ ] Build knowledge base

---

## Rollback Plan 🔄

If something goes wrong during deployment:

1. **Identify the issue**
   - Check Sentry for errors
   - Check server logs
   - Check database connectivity

2. **Quick rollback**
   ```bash
   # Vercel
   vercel rollback

   # Manual
   git revert <commit-hash>
   git push origin main
   ```

3. **Restore database** (if needed)
   ```bash
   # From backup
   psql -d production_db < backup-YYYY-MM-DD.sql
   ```

4. **Notify users** (if site was down > 5 minutes)

---

## Sign-Off

- [ ] **Developer**: All code reviewed and tested - ___________
- [ ] **Security**: Security checklist complete - ___________
- [ ] **Operations**: Infrastructure ready - ___________
- [ ] **Product**: Feature complete and tested - ___________

**Ready to Deploy**: YES / NO

**Deployment Date**: ___________

**Deployed By**: ___________

---

## Quick Deploy Commands

### Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy to production
cd frontend
vercel --prod
```

### Manual Server
```bash
# SSH into server
ssh user@your-server.com

# Pull latest code
cd /var/www/petrecovery
git pull origin main

# Install dependencies
cd frontend
npm install

# Build
npm run build

# Migrate database
npx prisma migrate deploy

# Restart service
sudo systemctl restart petrecovery
```

---

## Emergency Contacts

**Technical Issues**: ___________
**Database Issues**: ___________
**Hosting Support**: ___________
**On-Call**: ___________

---

## Notes

Use this space for deployment-specific notes:

```
Date: ___________
Deployed from commit: ___________
Special considerations: ___________
Issues encountered: ___________
```
