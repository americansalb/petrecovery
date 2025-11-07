# Required Dependencies

Before the real API routes will work, you need to install these packages:

```bash
cd frontend
npm install bcryptjs nodemailer @prisma/client
```

Then set up Prisma:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

See SETUP.md in the root directory for complete instructions.

## Current Status

✅ **Real API routes created** (not just docs):
- `/api/reports/create` - Creates report + auto-account with unique email/phone validation
- `/api/dashboard` - Fetches real data from database (shows 0 if empty, NO fake data)

✅ **Dashboard updated**: Fetches from real API, shows 0 if no data

✅ **Report page updated**: Submits to real API

✅ **Radius fixed**: Minimum 0.25 miles (for dense cities)

⏳ **Photo uploads**: Placeholder added, needs implementation

⏳ **Email sending**: Code ready, needs SMTP configuration
