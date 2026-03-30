---
date: 2026-03-29
topic: GoHighLevel API v2 Reference
sources: 14
---

# GoHighLevel API v2 Reference

Complete technical reference for integrating with the GoHighLevel (HighLevel) API v2.

---

## 1. Base URL

All API v2 requests go to:

```
https://services.leadconnectorhq.com
```

> Note: `https://api.gohighlevel.com` was the v1 base and is end-of-life. The v1 docs remain at `https://public-api.gohighlevel.com/` for legacy reference only.

---

## 2. Authentication

### Private Integration Token (PIT)

PITs are static, scoped access tokens — the correct choice for internal tools accessing a single sub-account. They do not expire on a daily cycle.

**Token format:**
```
pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```
(UUID structure with `pit-` prefix)

**Authorization header:**
```
Authorization: Bearer pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**How to generate:**
1. Agency Settings → Private Integrations → Create new Integration
2. Name it, select required scopes
3. Copy the token immediately — it cannot be retrieved again
4. Rotate every 90 days (7-day overlap window during rotation)

**When to use PIT vs OAuth:**

| Criterion | PIT | OAuth 2.0 |
|-----------|-----|-----------|
| Internal tool / single sub-account | Yes | No |
| Public-facing / multi-account app | No | Yes |
| Needs webhooks + custom modules | No | Yes |
| Static, no refresh needed | Yes | No |

---

## 3. Required Headers

Every API v2 request (except token exchange) requires these headers:

```
Authorization: Bearer <token>
Version: 2021-07-28
Content-Type: application/json
```

The `Version` header is mandatory. Requests without it will fail or return unexpected behaviour. Some older docs reference `2021-04-15` — use `2021-07-28` as the current stable value.

---

## 4. Rate Limits

| Limit type | Threshold |
|------------|-----------|
| Burst | 100 requests per 10 seconds per app per resource |
| Daily | 200,000 requests per day per app per resource |

Limits apply per resource (Location or Company), not globally across your account.

**Rate limit response headers** (inspect these to avoid 429s):

```
X-RateLimit-Limit-Daily          — your daily ceiling
X-RateLimit-Daily-Remaining      — requests remaining today
X-RateLimit-Interval-Milliseconds — burst window length (ms)
X-RateLimit-Max                  — max requests per burst window
X-RateLimit-Remaining            — requests remaining in current window
```

---

## 5. Pagination

GHL v2 uses cursor-based pagination, not page numbers.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | integer | Records per page. Default: 20. Max: 100 |
| `startAfter` | integer | Numeric cursor from previous response |
| `startAfterId` | string | ID-based cursor from previous response |

**Response metadata:**

```json
{
  "meta": {
    "startAfter": 1234567890,
    "startAfterId": "abc123xyz"
  }
}
```

Pass `meta.startAfter` and `meta.startAfterId` as query params in the next request. Pagination is complete when the response returns an empty array.

---

## 6. Endpoints by Resource

All paths are relative to `https://services.leadconnectorhq.com`.

Most endpoints require `locationId` as a query parameter — this is the sub-account ID visible in the GHL dashboard URL.

---

### 6.1 Contacts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/contacts/{contactId}` | Get a single contact by ID |
| POST | `/contacts/` | Create a contact |
| PUT | `/contacts/{contactId}` | Update a contact |
| DELETE | `/contacts/{contactId}` | Delete a contact |
| POST | `/contacts/upsert` | Create or update (deduplicates on email/phone) |
| GET | `/contacts/` | List contacts — **deprecated**, use search instead |
| POST | `/contacts/search` | Search contacts with advanced filters (recommended) |
| GET | `/contacts/business/{businessId}` | Get contacts by business ID |

**Key query params for listing:**
- `locationId` (required)
- `limit` (default 20, max 100)
- `startAfter`, `startAfterId` (pagination cursors)

**Notes:**
- `GET /contacts/` is deprecated. Use `POST /contacts/search` for all search and listing needs.
- Upsert respects location-level duplicate prevention settings (email/phone priority).

---

### 6.2 Opportunities / Pipeline

| Method | Path | Description |
|--------|------|-------------|
| GET | `/opportunities/pipelines` | List all pipelines (includes stages) |
| GET | `/opportunities/search` | Search/list opportunities |
| GET | `/opportunities/{id}` | Get a single opportunity |
| POST | `/opportunities/` | Create an opportunity |
| PUT | `/opportunities/{id}` | Update an opportunity |
| DELETE | `/opportunities/{id}` | Delete an opportunity |

**Key query params:**
- `locationId` (required on pipeline and search endpoints)
- `pipelineId` — filter opportunities by pipeline
- `stageId` — filter by stage
- `status` — filter by opportunity status

**Note:** Pipeline stages are returned within the `/opportunities/pipelines` response — there is no separate stages endpoint. Creating or editing pipelines/stages via API is not yet supported (read-only).

---

### 6.3 Conversations / Messages

**Conversations:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/conversations/search` | Search/list conversations |
| GET | `/conversations/{conversationId}` | Get conversation details |
| POST | `/conversations/` | Create a new conversation |
| PUT | `/conversations/{conversationId}` | Update a conversation |
| DELETE | `/conversations/{conversationId}` | Delete a conversation |

**Messages:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/conversations/{conversationId}/messages` | Get messages by conversation ID |
| GET | `/conversations/messages/{messageId}` | Get a single message by ID |
| POST | `/conversations/messages` | Send a new message |
| POST | `/conversations/messages/inbound` | Add an inbound message |
| POST | `/conversations/messages/outbound` | Add an external outbound call |
| DELETE | `/conversations/messages/{messageId}/schedule` | Cancel a scheduled message |
| POST | `/conversations/messages/upload` | Upload file attachments (max 5 files, 5MB each) |
| PUT | `/conversations/messages/{messageId}/status` | Update message status |
| PUT | `/conversations/messages/{messageId}/attachments` | Set message attachments (replaces existing, max 5 URLs) |
| GET | `/conversations/messages/{messageId}/recording` | Get call recording |
| GET | `/conversations/messages/{messageId}/transcription` | Get call transcription |
| GET | `/conversations/messages/locations/{locationId}/export` | Export messages by location (cursor-paginated) |

---

### 6.4 Calendars / Appointments

| Method | Path | Description |
|--------|------|-------------|
| GET | `/calendars/` | List calendars |
| GET | `/calendars/{calendarId}` | Get calendar details |
| GET | `/calendars/events` | Get calendar events |
| GET | `/calendars/events/appointments/{eventId}` | Get a single appointment |
| POST | `/calendars/events/appointments` | Create an appointment |
| PUT | `/calendars/events/appointments/{eventId}` | Update an appointment |
| DELETE | `/calendars/events/appointments/{eventId}` | Delete an appointment |

**Key query params for events:**
- `locationId` (required)
- `calendarId` — filter by calendar
- `startTime`, `endTime` — date range (Unix timestamp or ISO 8601)
- `userId` — filter by team member

---

### 6.5 Users / Team Members

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users/` | Get users by location |
| GET | `/users/{userId}` | Get a single user |
| POST | `/users/` | Create a user |
| PUT | `/users/{userId}` | Update a user |
| DELETE | `/users/{userId}` | Delete a user |

**Key query params:**
- `locationId` (required for listing users in a sub-account)
- `companyId` (for agency-level user queries — requires Agency API key)

---

### 6.6 Invoices / Payments

**Invoices:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/invoices/` | List invoices |
| GET | `/invoices/{invoiceId}` | Get a single invoice |
| POST | `/invoices/` | Create an invoice |
| PUT | `/invoices/{invoiceId}` | Update an invoice |
| DELETE | `/invoices/{invoiceId}` | Delete an invoice |
| POST | `/invoices/{invoiceId}/send` | Send invoice to contact |
| POST | `/invoices/{invoiceId}/record-payment` | Record a manual payment |
| POST | `/invoices/text2pay` | Create a Text2Pay invoice |
| POST | `/invoices/from-estimate/{estimateId}` | Create invoice from estimate |

**Related payment resources** (under the Invoices/Payments module):

| Resource | Notes |
|----------|-------|
| `/invoices/schedule` | Recurring invoice schedules |
| `/invoices/template` | Invoice templates |
| `/payments/orders` | Orders (public API) |
| `/payments/subscriptions` | Subscriptions (public API) |
| `/payments/transactions` | Transactions (public API) |

**Authentication note for invoices:** Requires either a Sub-Account-level OAuth access token or a Sub-Account Private Integration Token. Agency-level tokens will not work.

---

## 7. Complete Example Request

```bash
curl --request GET \
  --url "https://services.leadconnectorhq.com/contacts/search" \
  --header "Authorization: Bearer pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" \
  --header "Version: 2021-07-28" \
  --header "Content-Type: application/json" \
  --data '{"locationId": "YOUR_LOCATION_ID", "limit": 100}'
```

---

## 8. Official Documentation

- Developer portal: https://marketplace.gohighlevel.com/docs/
- Private Integrations guide: https://help.gohighlevel.com/support/solutions/articles/155000003054-private-integrations-everything-you-need-to-know
- API v2 GitHub source docs: https://github.com/GoHighLevel/highlevel-api-docs
- Rate limits FAQ: https://marketplace.gohighlevel.com/docs/oauth/Faqs/index.html

> Note: The Stoplight docs at `highlevel.stoplight.io` are being deprecated. Use the marketplace portal above as the canonical reference.
