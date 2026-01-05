# Project Build & Deployment Rules (DO NOT VIOLATE)

This project is deployed on Vercel using Next.js App Router.

Strict rules:
1. This is NOT a Vite project. Never add vite.config.ts or Vite-related dependencies.
2. NEVER use `next export` or `output: "export"` in next.config.
3. `npm run build` must only run `next build`.
4. `/admin` and any authenticated or data-dependent pages MUST be dynamically rendered.
5. No code that reads environment variables (Resend / Supabase) may run at build time.
6. All environment variables are provided via Vercel Environment Variables.
7. Breaking any of the above rules will cause Vercel build failure.

Any generated or modified code MUST comply with these rules.
