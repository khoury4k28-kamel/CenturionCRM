# DocuSign integration (Phase C)

**Status:** stub. Implement after Gmail intake.

## Plan

- Greg's DocuSign account, OAuth'd once (admin setup).
- "Send via DocuSign" button on a Document — uses `docusign-esign` to create an envelope, attach the populated DOCX/PDF, define a signer (the deal's seller email), send.
- `DocuSign Connect` webhook receiver at `app/api/webhooks/docusign/route.ts` updates `Document.status` (SENT / VIEWED / SIGNED / COMPLETED / VOIDED).

## Env vars

```
DOCUSIGN_INTEGRATION_KEY=...
DOCUSIGN_USER_ID=...
DOCUSIGN_ACCOUNT_ID=...
DOCUSIGN_PRIVATE_KEY=... (PEM, base64-encoded for env)
DOCUSIGN_AUTH_BASE=account-d.docusign.com   # sandbox; switch to account.docusign.com in prod
DOCUSIGN_API_BASE=https://demo.docusign.net/restapi
DOCUSIGN_CONNECT_KEY=...                    # for webhook signature verification
```

## Files to add

- `lib/integrations/docusign/client.ts` — JWT-grant auth helper.
- `lib/integrations/docusign/sendEnvelope.ts` — given a Document, create + send.
- `app/api/webhooks/docusign/route.ts` — receive Connect notifications, verify HMAC, update statuses.
- Action `sendDocumentToDocusignAction(documentId)` invoked from the deal detail page.

## UI

- Document row shows the current envelope status (badge); when SENT, surface a link to the DocuSign UI for re-signing or voiding.
