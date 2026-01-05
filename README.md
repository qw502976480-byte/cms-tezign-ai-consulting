# Tezign AI Backend

Next.js 14 backend with CMS, Admin Dashboard, and Public APIs.

## Setup Instructions

### 1. Create Supabase Project
1. Go to [Supabase](https://supabase.com) and create a new project.
2. Go to **Project Settings > API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key (keep this safe)

### 2. Run SQL Migrations
1. Go to the **SQL Editor** in Supabase.
2. Open `supabase/migrations/20240101000000_init.sql` from this repository.
3. Paste the content into the SQL Editor and click **Run**.
4. This creates tables: `content_items`, `registrations`, `demo_requests`, `homepage_slots`.

### 3. Create Admin User
1. Go to **Authentication > Users** in Supabase Dashboard.
2. Click **Add User** > **Create New User**.
3. Enter an email (e.g., `admin@tezign.ai`) and a password.
4. (Optional) Disable email confirmation in **Authentication > Providers > Email** to log in immediately.

### 4. Configure Environment Variables
If deploying to Vercel, set these in **Project Settings > Environment Variables**.
If running locally, create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RESEND_API_KEY=re_123456789
EMAIL_FROM=onboarding@resend.dev
EMAIL_TO_INTERNAL=your_email@example.com
```

### 5. Deploy to Vercel
1. Push this code to GitHub/GitLab.
2. Import project into Vercel.
3. Ensure Framework Preset is **Next.js**.
4. Add the Environment Variables from step 4.
5. Deploy.

### 6. Verify Deployment
1. **Admin Login:** Go to `/admin/login`. Log in with the user created in Step 3.
2. **Create Content:** Go to `/admin/content/new` and publish a "Case Study".
3. **Public API:** Visit `/api/resources` to see the JSON output of published content.
4. **Homepage:** Visit `/api/homepage`.
