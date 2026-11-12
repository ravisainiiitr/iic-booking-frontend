# Public policy pages

| URL | File |
|---|---|
| `https://equip.iitr.ac.in/privacy-policy/` | `public/privacy-policy/index.html` |
| `https://equip.iitr.ac.in/data-deletion/` | `public/data-deletion/index.html` |

## How they work

They are plain HTML files, not React pages. Vite copies `public/` into the build, and nginx's
`try_files $uri $uri/ /index.html` serves a folder's `index.html` ahead of the app. No sign-in, JavaScript, API call or
backend route is involved, so Meta's reviewers and crawlers read the full text from the first response.

- Link to them with a plain `<a href>`, never React Router's `<Link>`.
- Styles are inline because nginx caches `.css` files for a year as immutable. Keep the `<style>` block the same in
  both files (a test checks this).
- They load nothing from other sites, and have no scripts.
- Do not publish the CMS draft with the slug `privacy-policy` (`seed_policy_pages` in the backend). It is older, names
  an individual centre, and would contradict these pages. The footer ignores that slug.

## Changing the text

1. Change the wording only if it matches what the code does. The facts below are the source for the current text.
2. Update **Last updated** on the page you changed.
3. Run `npx vitest run src/test/publicPolicyPages.test.ts src/lib/policyPages.test.tsx`.
4. A push to `master` deploys the frontend.

Revisit the pages when any of these change: a new service provider, WhatsApp events or retention, file deletion
behaviour, a self-service deletion feature, backup schedule.

## Data practices audited (6 Nov 2026, backend `c90cb43f`)

Paths are in the backend repository, under `iic_booking/`.

| Topic | What the code does | Where |
|---|---|---|
| Account deletion | No self-service or administrator erase feature. Only unverified registrations are deleted. | `users/tasks.py`, `users/api/auth_views.py` |
| Users with history | 28 foreign keys to the user are `PROTECT` (bookings, payments, calls, My Research), so deleting them fails. 181 are `SET_NULL`, which leaves records in place without the link. | models |
| End of programme | Accounts may be suspended, not deleted. Enforcement depends on `ACCOUNT_END_DATE_ENFORCEMENT`. | `users/account_lifecycle.py` |
| S3 on row deletion | No `post_delete` handler or `django-cleanup`: deleting a row leaves its object. | repo-wide search |
| My Research delete | Soft delete. The S3 object stays and no job purges it. | `my_research/views.py`, `services.py`, `tasks.py` |
| Fabrication files | STL and DXF objects are deleted when a booking completes. | `equipment/print_3d_notifications.py` |
| Remote workspaces | Archived workspaces are purged after `retention_until` (default 90 days). | `remote_analysis/tasks.py` |
| Samples | Marked Disposed after `sample_retention_days` (default 60). This is a status change; no record is deleted. | `equipment/tasks.py` |
| WhatsApp | Opt-in, consent history, sent messages, incoming messages and handled events are stored. Incoming messages and handled events are purged after `WHATSAPP_RETENTION_DAYS` (default 90). Consent history and sent messages have no purge, and keep the phone number after a user is deleted. Only booking confirmed, cancelled or refunded, and completed are sent. | `whatsapp/` |
| Payments | Razorpay references plus full gateway responses (`raw_payload`, `raw_create_response`). No card fields. Refund bank details are stored in plain columns, masked in responses. | `payments/models.py`, `external_services/models.py`, `users/models/wallet.py` |
| Providers | AWS, Razorpay, SBIePay (legacy), Meta, Firebase, APNs, public STUN, Google Fonts, OpenAI, Sentry (if `SENTRY_DSN` is set), I-STEM, ORCID, OpenAlex, Crossref. | settings, `calls/`, `impact/`, `support/chat_ai.py`, `research_copilot/` |
| Calls | Metadata and device tokens only. Audio is peer to peer and not recorded. | `calls/`, `docs/calls.md` |
| Logs and audit | Many audit tables and `CommunicationLog`, with no purge job. Host log rotation is not in the repository. | models |
| Backups | Nightly `pg_dump`, 14 days in the script. Files in S3 are not part of it. | `scripts/ops/iic-nightly-backup.sh` |
| Browser | No analytics code. Auth token in `localStorage`; session and CSRF cookies from Django. | `src/lib/api.ts`, `config/settings/` |
