# Security Audit Report - MENS CATALY

**Date:** 2026-03-05
**Auditor:** Claude Opus 4.6 (automated static analysis)
**Scope:** Full codebase — admin pages, API routes, authentication, middleware, client-side code, OWASP Top 10
**Severity Levels:** CRITICAL / HIGH / MEDIUM / LOW / INFO

---

## Executive Summary

The codebase implements a reasonable security posture for an affiliate media platform, with timing-safe API key comparison, HMAC webhook verification, and route-level authentication guards. However, several significant vulnerabilities were identified — most notably a **CRITICAL** issue where the admin API key is exposed to the client via a `NEXT_PUBLIC_` environment variable, and **HIGH** severity issues around admin page access without server-side authentication and missing CSRF protections.

### Finding Summary

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 1 | Admin API key leaked via NEXT_PUBLIC_ env var |
| HIGH     | 5 | No server-side admin page auth, preview API auth bypass, health endpoint info disclosure, missing CSRF, XSS via dangerouslySetInnerHTML |
| MEDIUM   | 5 | sessionStorage auth, non-timing-safe comparisons, test endpoint in production risk, webhook secret bypass, rate limiter not applied |
| LOW      | 4 | Middleware coverage gaps, httpOnly:false cookie, error detail leakage, ilike SQL injection surface |
| INFO     | 2 | robots.txt not enforcement, as-any type assertions |

**Total findings: 18**

---

## Detailed Findings

### CRITICAL

---

#### C-1: Admin API Key Exposed via NEXT_PUBLIC_ADMIN_API_KEY

**File:** `/Users/kanomatayuta/menscataly/src/app/admin/asp/page.tsx` (lines 39-43)
**Severity:** CRITICAL

**Description:**
The ASP admin page reads `process.env.NEXT_PUBLIC_ADMIN_API_KEY` as a fallback for authentication. Any environment variable prefixed with `NEXT_PUBLIC_` is bundled into the client-side JavaScript and visible to anyone who inspects the page source or network traffic.

```typescript
// src/app/admin/asp/page.tsx lines 39-43
function getApiKey(): string {
  if (typeof window !== "undefined") {
    const sessionKey = sessionStorage.getItem("adminApiKey");
    if (sessionKey) return sessionKey;
  }
  // 2. NEXT_PUBLIC env var (Vercel public env)
  if (process.env.NEXT_PUBLIC_ADMIN_API_KEY) {
    return process.env.NEXT_PUBLIC_ADMIN_API_KEY;  // LEAKED TO CLIENT
  }
  return "";
}
```

**Impact:** If `NEXT_PUBLIC_ADMIN_API_KEY` is set in production, the admin API key is visible in the client-side bundle. Any visitor can extract it and use it to call all admin API endpoints (article management, ASP program CRUD, pipeline execution, etc.).

**Recommendation:**
- NEVER set `NEXT_PUBLIC_ADMIN_API_KEY` in any environment. Remove this fallback code entirely.
- Admin API keys must only be accessed server-side (via `process.env.ADMIN_API_KEY` in route handlers).
- Use a proper session/token-based auth flow instead of passing raw API keys through the client.

---

### HIGH

---

#### H-1: Admin Pages Have No Server-Side Authentication

**Files:**
- `/Users/kanomatayuta/menscataly/src/app/admin/layout.tsx`
- `/Users/kanomatayuta/menscataly/src/app/admin/page.tsx`
- `/Users/kanomatayuta/menscataly/src/app/admin/pipeline/page.tsx`
- `/Users/kanomatayuta/menscataly/src/app/admin/articles/[id]/page.tsx`
- `/Users/kanomatayuta/menscataly/src/app/admin/batch/page.tsx`
- `/Users/kanomatayuta/menscataly/src/app/admin/revenue/page.tsx`
- `/Users/kanomatayuta/menscataly/src/app/admin/asp/page.tsx`

**Severity:** HIGH

**Description:**
All admin pages (`/admin/*`) are accessible to anyone without authentication. The admin layout (`layout.tsx`) only sets `robots: { index: false, follow: false }` metadata but performs no authentication check. The login page (`/admin/login`) stores an API key in `sessionStorage` on the client side, but **no server-side validation occurs before rendering admin pages**. The middleware (`src/middleware.ts`) only covers `/articles/:path*` for ITP tracking — it does not protect `/admin/*` routes at all.

The dashboard page (`/admin/page.tsx`) is a Server Component that directly calls `fetchDashboardData()` to retrieve revenue, cost, and article data — this data is rendered and returned to any unauthenticated visitor.

**Impact:** Anyone who navigates to `/admin` can see:
- Dashboard with revenue figures, AI costs, article statistics
- Pipeline run history and status
- Mock article review data with compliance scores
- Article previews with full content

While many admin API calls still require the API key, the pages themselves expose sensitive business data.

**Recommendation:**
- Add authentication checks in `src/middleware.ts` to protect `/admin/*` routes (except `/admin/login`).
- Alternatively, add server-side auth verification in the admin layout (`layout.tsx`).
- Consider using NextAuth.js, Clerk, or a similar auth solution for proper session management.
- The admin dashboard fetches data via `fetchDashboardData()` server-side without auth — this should be gated.

---

#### H-2: Preview API Secret Bypass When MICROCMS_PREVIEW_SECRET Is Not Set

**File:** `/Users/kanomatayuta/menscataly/src/app/api/preview/route.ts` (line 24)
**Severity:** HIGH

**Description:**
The preview API conditionally checks the secret: `if (previewSecret && secret !== previewSecret)`. If `MICROCMS_PREVIEW_SECRET` is not configured, the check is completely skipped, allowing anyone to enable draft mode and view unpublished content.

```typescript
const previewSecret = process.env.MICROCMS_PREVIEW_SECRET
if (previewSecret && secret !== previewSecret) {
  return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
}
```

**Impact:** Without `MICROCMS_PREVIEW_SECRET` configured, any user can trigger draft mode by visiting `/api/preview?contentId=xxx&draftKey=yyy`, potentially viewing unpublished or draft articles.

**Recommendation:**
- Always require a preview secret. If not configured, reject the request with 403 rather than allowing bypass.
- Add this variable to the required list in `env.ts`.

---

#### H-3: Health Endpoint Discloses Environment Configuration

**File:** `/Users/kanomatayuta/menscataly/src/app/api/health/route.ts` (lines 158-167)
**Severity:** HIGH

**Description:**
The `/api/health` endpoint is completely unauthenticated and reveals which API keys and secrets are configured (as boolean flags). While it does not expose the actual values, it tells an attacker which services are connected, which are missing, and the system version. This also reveals service latency and error messages.

```typescript
const environment = {
  ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
  MICROCMS_API_KEY: !!process.env.MICROCMS_API_KEY,
  // ... 7 environment variable presence checks
  SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
}
```

**Impact:** An attacker can fingerprint the infrastructure, identify misconfigured services, and understand the deployment state. Error messages from microCMS/Supabase connection checks may leak internal URLs or configuration details.

**Recommendation:**
- Add authentication to the health endpoint, or create two endpoints: a public `/api/health` that returns only `{ status: "ok" }`, and an authenticated `/api/admin/health` with full details.
- Remove environment variable presence flags from the public response.
- Sanitize error messages to avoid leaking internal URLs.

---

#### H-4: No CSRF Protection on State-Changing Operations

**Files:** All POST/PATCH/PUT/DELETE API routes under `/api/admin/` and `/api/pipeline/`
**Severity:** HIGH

**Description:**
No CSRF tokens are used anywhere in the application. State-changing operations (article publishing, pipeline triggering, ASP program CRUD, review actions) rely solely on API key authentication via headers. However, the admin pages use `sessionStorage` to store and send the API key. A CSRF attack on a browser where an admin is logged in could potentially manipulate API calls if combined with other vulnerabilities.

While the API key in the `Authorization` header provides some implicit CSRF protection (browsers do not add custom headers in cross-origin requests by default), this protection breaks if:
- CORS is misconfigured (no CORS policy was found in the codebase)
- A CORS-permissive configuration is added later

**Impact:** Without explicit CSRF protection, if CORS configuration is ever relaxed, state-changing operations could be triggered by malicious sites.

**Recommendation:**
- Verify and enforce strict CORS settings (no wildcard origins for admin routes).
- Consider adding CSRF tokens for form-based actions on admin pages.
- Consider the `SameSite` cookie attribute for any future session cookies.

---

#### H-5: XSS Risk via dangerouslySetInnerHTML with User/CMS Content

**Files:**
- `/Users/kanomatayuta/menscataly/src/components/article/ArticleBody.tsx` (line 589)
- `/Users/kanomatayuta/menscataly/src/app/admin/articles/[id]/preview/page.tsx` (line 342)
- `/Users/kanomatayuta/menscataly/src/app/about/page.tsx` (line 37)
- `/Users/kanomatayuta/menscataly/src/app/disclaimer/page.tsx` (line 37)
- `/Users/kanomatayuta/menscataly/src/app/privacy/page.tsx` (line 37)
- `/Users/kanomatayuta/menscataly/src/app/contact/page.tsx` (line 37)
- `/Users/kanomatayuta/menscataly/src/app/advertising-policy/page.tsx` (line 37)
- `/Users/kanomatayuta/menscataly/src/app/supervisors/page.tsx` (line 54)
- `/Users/kanomatayuta/menscataly/src/app/supervisors/[id]/page.tsx` (line 70)

**Severity:** HIGH

**Description:**
The `ArticleBody` component renders CMS content using `dangerouslySetInnerHTML`. While the content passes through a `normalizeContent()` function that converts markdown/JSON to HTML, there is no explicit HTML sanitization (e.g., DOMPurify) to strip malicious script tags or event handlers.

The `normalizeContent()` function handles format conversion (markdown-to-HTML, JSON-to-HTML) but does not appear to sanitize against XSS payloads. If a CMS editor inserts `<script>`, `<img onerror="...">`, or other XSS vectors, they would be rendered in the browser.

The admin preview page also renders mock article HTML content with `dangerouslySetInnerHTML={{ __html: article.htmlContent }}` (line 342).

Additionally, the structured data in `/articles/[slug]/page.tsx` (line 117) uses `dangerouslySetInnerHTML` for JSON-LD but does escape `<` to `\u003c`, which is the correct approach.

**Impact:** If CMS content is compromised, modified by a malicious editor, or if the AI generates content containing XSS payloads, arbitrary JavaScript could execute in visitors' browsers. This could lead to session hijacking, cookie theft, or drive-by downloads.

**Recommendation:**
- Integrate a sanitization library (e.g., `DOMPurify`, `sanitize-html`, or `isomorphic-dompurify`) in the `ArticleBody` component before rendering.
- Create an allowlist of safe HTML tags and attributes.
- Apply the same sanitization to any content rendered via `dangerouslySetInnerHTML`.

---

### MEDIUM

---

#### M-1: Client-Side API Key Storage in sessionStorage

**Files:**
- `/Users/kanomatayuta/menscataly/src/app/admin/login/page.tsx` (line 26)
- `/Users/kanomatayuta/menscataly/src/app/admin/batch/page.tsx` (lines 280, 336)
- `/Users/kanomatayuta/menscataly/src/app/admin/asp/page.tsx` (line 36)
- `/Users/kanomatayuta/menscataly/src/components/admin/ReviewActions.tsx` (line 34)
- `/Users/kanomatayuta/menscataly/src/components/admin/PipelineTriggerButton.tsx` (line 20)

**Severity:** MEDIUM

**Description:**
The admin login flow stores the raw API key in `sessionStorage.setItem("adminApiKey", apiKey.trim())`. Client-side components then read this key and attach it to API requests as `Authorization: Bearer <key>`. The login page does not validate the key against the server — it simply stores whatever the user enters and redirects to `/admin`.

Problems:
1. The API key is stored in plaintext in the browser's sessionStorage, accessible to any JavaScript running on the page (XSS -> key theft).
2. The login page performs no server-side validation — any value is accepted.
3. `sessionStorage` is accessible to same-origin scripts, so an XSS vulnerability would immediately compromise the API key.

**Impact:** Combined with an XSS vulnerability (see H-5), an attacker could steal the admin API key from sessionStorage and use it externally to call all admin endpoints.

**Recommendation:**
- Implement a proper server-side authentication flow that issues short-lived session tokens (JWT or httpOnly cookies).
- The login page should POST the API key to a server endpoint that validates it and returns a session cookie.
- Use `httpOnly` cookies for session management instead of sessionStorage.

---

#### M-2: Non-Timing-Safe Comparison in Preview Secret and Webhook Signature

**Files:**
- `/Users/kanomatayuta/menscataly/src/app/api/preview/route.ts` (line 24)
- `/Users/kanomatayuta/menscataly/src/app/api/webhook/microcms/route.ts` (lines 43-51)

**Severity:** MEDIUM

**Description:**

**Preview API:** The preview secret comparison uses strict equality (`secret !== previewSecret`), which is not timing-safe and could theoretically be vulnerable to timing attacks.

**Webhook signature verification:** The custom timing comparison on lines 43-51 uses a XOR-based approach which is better than `===` but has a length leak: if `expectedSignature.length !== signature.length`, it returns `false` immediately, revealing information about the expected signature length.

```typescript
// Webhook: leaks length information
if (expectedSignature.length !== signature.length) {
  return false  // Timing leak: reveals expected length
}
```

In contrast, the admin auth module (`auth.ts`) correctly uses `crypto.timingSafeEqual` with a dummy comparison for length mismatches.

**Impact:** Low practical risk for the preview secret (short-lived, limited scope). The webhook signature length leak is mitigable since HMAC-SHA256 base64 output is always the same length, but the implementation is inconsistent with the auth module's best practices.

**Recommendation:**
- Use the `timingSafeCompare` function from `auth.ts` for the preview secret comparison.
- Use `crypto.timingSafeEqual` in the webhook signature verification, with the same dummy-compare pattern for length mismatches as in `auth.ts`.

---

#### M-3: Test Generation Endpoint Risk in Production

**File:** `/Users/kanomatayuta/menscataly/src/app/api/test/generate/route.ts` (lines 14-21)
**Severity:** MEDIUM

**Description:**
The test endpoint at `/api/test/generate` is protected only by a `process.env.NODE_ENV === 'production'` check. While this should block production access, this pattern has known risks:
1. `NODE_ENV` might not be set correctly in all deployment configurations.
2. The endpoint has no authentication at all — in non-production environments, anyone can trigger Claude API calls (generating costs).
3. The endpoint creates articles and publishes to microCMS as drafts.

**Impact:** In staging/preview environments on Vercel, this endpoint is publicly accessible and could be used to generate costs by calling Claude API. Even if blocked in production, its existence represents attack surface.

**Recommendation:**
- Add authentication (API key) even for non-production environments.
- Consider removing this endpoint entirely and using a CLI script instead.
- At minimum, add rate limiting.

---

#### M-4: Webhook Secret Bypass When Not Configured

**File:** `/Users/kanomatayuta/menscataly/src/app/api/webhook/microcms/route.ts` (line 69)
**Severity:** MEDIUM

**Description:**
The webhook handler skips signature verification entirely when `MICROCMS_WEBHOOK_SECRET` is not configured:

```typescript
const webhookSecret = process.env.MICROCMS_WEBHOOK_SECRET
if (webhookSecret) {
  // ... verification only happens if secret is set
}
```

If the webhook secret is not set, anyone can send a POST to `/api/webhook/microcms` with arbitrary payloads, potentially:
- Triggering cache revalidation for any path
- Upserting arbitrary data into the Supabase articles table
- Deleting articles from Supabase

**Impact:** Without webhook authentication, an attacker could manipulate article data in Supabase and trigger cache invalidation, potentially serving stale or incorrect content.

**Recommendation:**
- Make `MICROCMS_WEBHOOK_SECRET` required. If not set, reject all webhook requests.
- Add this to the required env vars in `env.ts`.

---

#### M-5: Rate Limiter Exists But Is Not Applied to API Routes

**File:** `/Users/kanomatayuta/menscataly/src/lib/admin/rate-limit.ts`
**Severity:** MEDIUM

**Description:**
A comprehensive rate limiting module exists (`RateLimiter` class, `checkAdminRateLimit` helper), but a search of all API route handlers shows none of them actually call `checkAdminRateLimit()`. The rate limiter is defined but never applied.

**Impact:** All API endpoints (admin, pipeline, batch generation) are vulnerable to brute-force attacks, DoS, and abuse. An attacker could:
- Brute-force the admin API key by making unlimited requests
- Trigger excessive pipeline runs or batch generations (generating costs)
- Overload Supabase/microCMS with unlimited queries

**Recommendation:**
- Apply `checkAdminRateLimit()` at the top of every admin and pipeline API route handler.
- Consider adding the rate limit check in middleware for `/api/admin/*` and `/api/pipeline/*`.
- Implement IP-based rate limiting for the unauthenticated endpoints (`/api/articles`, `/api/health`).

---

### LOW

---

#### L-1: Middleware Does Not Cover Admin or API Routes

**File:** `/Users/kanomatayuta/menscataly/src/middleware.ts` (lines 221-226)
**Severity:** LOW

**Description:**
The middleware matcher is configured to only match `/articles/:path*`:

```typescript
export const config = {
  matcher: ['/articles/:path*'],
}
```

This means the middleware runs only for article pages (ITP tracking). Admin routes (`/admin/*`) and API routes (`/api/*`) are not covered. Authentication and rate limiting for these routes must be handled within each individual route handler, leading to inconsistency risk.

**Recommendation:**
- Expand the middleware matcher to include `/admin/*` routes for authentication checks.
- Consider a centralized middleware-based approach for auth and rate limiting.

---

#### L-2: Tracking Cookie Set with httpOnly: false

**File:** `/Users/kanomatayuta/menscataly/src/middleware.ts` (line 97)
**Severity:** LOW

**Description:**
The affiliate tracking cookie is set with `httpOnly: false`:

```typescript
response.cookies.set(TRACKING_COOKIE_NAME, JSON.stringify(trackingData), {
  httpOnly: false,    // クライアントサイドJSからも読み取り可能に
})
```

This is intentional (as commented) for client-side JS to read tracking data. However, it means the cookie is accessible to any JavaScript on the page, including XSS payloads.

**Impact:** Low severity since the cookie contains affiliate tracking parameters (ASP names, referrer, landing path), not authentication credentials. However, cookie manipulation could potentially affect conversion attribution.

**Recommendation:**
- If client-side access is not needed at all times, consider using `httpOnly: true` and a separate API endpoint for reading tracking data.
- At minimum, this is acceptable given the documented reason.

---

#### L-3: Error Detail Leakage in Pipeline Status and History APIs

**Files:**
- `/Users/kanomatayuta/menscataly/src/app/api/pipeline/status/route.ts` (line 97)
- `/Users/kanomatayuta/menscataly/src/app/api/pipeline/history/route.ts` (line 79)

**Severity:** LOW

**Description:**
Error responses include a `details` field containing the full error message:

```typescript
return NextResponse.json(
  { error: 'Failed to fetch pipeline status', details: errorMessage },
  { status: 500 }
)
```

These error messages could potentially contain database connection strings, SQL errors, or other internal details.

**Recommendation:**
- Log the full error server-side but return only a generic error message in the response.
- Remove the `details` field from production error responses.

---

#### L-4: Potential SQL-Like Injection via ilike in Keywords API

**File:** `/Users/kanomatayuta/menscataly/src/app/api/admin/keywords/route.ts` (line 93)
**Severity:** LOW

**Description:**
The keywords API uses Supabase's `.ilike()` with user-supplied input:

```typescript
if (filter.query) {
  query = query.ilike('keyword', `%${filter.query}%`)
}
```

While Supabase's PostgREST layer parameterizes queries, the `%` and `_` characters in the `filter.query` are not escaped. An attacker could use LIKE wildcards (`%` and `_`) to craft pattern-matching queries, potentially causing performance issues or extracting data via timing.

**Impact:** Low practical risk since Supabase uses parameterized queries, but the unescaped LIKE wildcards could enable information extraction through pattern matching.

**Recommendation:**
- Escape `%` and `_` characters in user input before passing to `.ilike()`.

---

### INFO

---

#### I-1: robots.txt Disallow Is Not Enforcement

**File:** `/Users/kanomatayuta/menscataly/src/app/robots.ts`
**Severity:** INFO

**Description:**
The robots.txt disallows `/admin/*` and `/api/*`, and the admin layout sets `robots: { index: false }`. However, robots.txt is only advisory — it does not prevent direct access. Search engines may still index these pages if they discover them through other means.

**Recommendation:**
- This is correctly implemented as a defense-in-depth measure. The actual protection should come from server-side auth (see H-1).

---

#### I-2: Extensive Use of `as any` Type Assertions in Supabase Queries

**Files:** Multiple API routes (35+ occurrences as noted in project memory)
**Severity:** INFO

**Description:**
All Supabase queries use `(supabase as any)` type assertions to bypass TypeScript's type checking. While this is a type safety issue rather than a security issue, it means the compiler cannot catch mistyped column names, incorrect table references, or invalid query constructions that could lead to runtime errors or data leaks.

**Recommendation:**
- Generate proper Supabase types from the database schema using `supabase gen types`.
- Replace `as any` assertions with properly typed Supabase client instances.

---

## OWASP Top 10 Assessment

| Category | Status | Notes |
|----------|--------|-------|
| **A01: Broken Access Control** | Vulnerable | Admin pages have no server-side auth (H-1). Rate limiter not applied (M-5). |
| **A02: Cryptographic Failures** | Mostly OK | API key comparison is timing-safe. Some non-timing-safe comparisons exist (M-2). |
| **A03: Injection** | Low Risk | Supabase parameterizes queries. Minor LIKE injection surface (L-4). No shell commands. No eval(). |
| **A04: Insecure Design** | Vulnerable | API key as sole auth mechanism, stored client-side. No session management. |
| **A05: Security Misconfiguration** | Vulnerable | Health endpoint unauthenticated (H-3). Test endpoint accessible in non-prod (M-3). Webhook bypass (M-4). |
| **A06: Vulnerable Components** | Not Assessed | Dependency audit not in scope. |
| **A07: Auth Failures** | Vulnerable | No server-side admin page auth. Client-side API key storage. NEXT_PUBLIC key leak (C-1). |
| **A08: Data Integrity Failures** | Medium Risk | No CSRF protection (H-4). Webhook can be spoofed when secret not set (M-4). |
| **A09: Logging & Monitoring** | Adequate | Console.error/warn used throughout. AlertManager exists. |
| **A10: SSRF** | Low Risk | Server-side fetch to microCMS/Supabase uses controlled URLs from env vars. |

---

## Positive Security Observations

1. **Timing-safe API key comparison** (`crypto.timingSafeEqual` with dummy comparison for length mismatches) in `auth.ts` -- well implemented.
2. **HMAC-SHA256 webhook verification** for microCMS webhooks.
3. **Development bypass with production enforcement** -- auth functions allow development bypass but enforce authentication in production.
4. **JSON-LD XSS prevention** in article pages (`replace(/</g, '\\u003c')`).
5. **Environment variable validation** via `env.ts` with required/optional classification.
6. **Rate limiter infrastructure** exists (even though not applied yet).
7. **Input validation** on API routes (valid statuses, categories, reward types, etc.).
8. **robots.txt** correctly excludes admin and API routes from crawlers.
9. **Admin layout** sets `noindex, nofollow` meta tags.
10. **Secure cookie attributes** (secure in production, SameSite: lax) for tracking cookies.

---

## Priority Remediation Plan

### Immediate (Week 1)
1. **Remove `NEXT_PUBLIC_ADMIN_API_KEY`** reference from `asp/page.tsx` (C-1)
2. **Add server-side auth to admin pages** via middleware or layout (H-1)
3. **Apply rate limiting** to all admin/pipeline API routes (M-5)
4. **Add HTML sanitization** to ArticleBody component (H-5)

### Short-term (Week 2-3)
5. **Require MICROCMS_PREVIEW_SECRET** and use timing-safe comparison (H-2, M-2)
6. **Require MICROCMS_WEBHOOK_SECRET** -- reject when not configured (M-4)
7. **Protect health endpoint** or reduce information disclosure (H-3)
8. **Implement proper session management** to replace sessionStorage API key pattern (M-1)

### Medium-term (Month 2)
9. **Add CSRF protection** for state-changing operations (H-4)
10. **Add authentication to test/generate endpoint** even in non-production (M-3)
11. **Remove error details from production API responses** (L-3)
12. **Generate proper Supabase types** to replace `as any` (I-2)

---

*This report was generated through static code analysis only. Runtime testing, penetration testing, and dependency auditing were not performed. Some findings may have lower practical risk than assessed if mitigating controls exist outside the analyzed codebase.*
