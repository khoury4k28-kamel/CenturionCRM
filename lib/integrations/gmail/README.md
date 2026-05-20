# Gmail integration (Phase B)

**Status:** stub. Implement after the skeleton lands.

## Plan

- Dedicated Gmail account that Greg forwards leads to (e.g. `leads.centurion@gmail.com`).
- OAuth a Google Cloud project, store the refresh token in env.
- Vercel Cron route at `app/api/cron/poll-gmail/route.ts`, every 5 min.
- For each new message under the `Leads` label, call `parseLead.ts` (Claude API) to extract:
  - property address, BR/BA/sqft
  - asking price
  - seller name / phone / email
  - lead source
- Create a Deal in `NEW_LEAD` stage; persist the original message under `EmailMessage` with `direction = INBOUND` and `dealId` linked.
- Tag the Gmail message `Processed` so we don't re-import it.

## Env vars

```
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
GMAIL_USER=leads.centurion@gmail.com
GMAIL_LABEL=Leads
```

## UI

- `/inbox` lists `EmailMessage` rows linked to deals in `NEW_LEAD` so Greg can review parsed fields before promoting them.
- One-click "Confirm → Deal" that opens the deal detail in edit mode.

## Files to add

- `lib/integrations/gmail/client.ts` — googleapis OAuth client + helper to list/move messages.
- `lib/integrations/llm/parseLead.ts` — Claude API call returning a typed `ParsedLead`.
- `app/api/cron/poll-gmail/route.ts` — cron entry point.
- `app/inbox/page.tsx` — review queue.
