# Exspend Backend Handover (Next.js App Router + Prisma/Postgres)

Repo: `Iwinn86/exspend1`  
This document describes the **backend** structure and what each key backend folder/file represents, so another developer can quickly pick up the project.

> Note: This is written from the code currently visible in the repository. If additional API routes exist that aren’t referenced here, they should be added as you discover them.

---

## 1) Backend Architecture Overview

- **Framework**: Next.js (App Router). Backend endpoints are implemented as **Route Handlers** under `app/api/**/route.ts`.
- **Database**: PostgreSQL via **Prisma** ORM.
- **Auth**: JWT-based (token extracted from request, verified server-side). Many routes use small helpers like `requireAuth()` and `requireAdmin()`.
- **Notifications**: Stored in DB (Prisma). Admin/user notifications are created by backend when key actions happen (ticket creation, order status events, etc.).
- **Email**: The repo includes email utilities and templates used for order emails (confirmation/status updates).

---

## 2) Top-Level Folders (Backend-Relevant)

### `app/api/`
The main backend surface area. Each folder generally maps to a URL path:
- `app/api/orders/route.ts` → `/api/orders`
- `app/api/orders/[id]/confirm-sent/route.ts` → `/api/orders/:id/confirm-sent`
- `app/api/admin/orders/route.ts` → `/api/admin/orders`
- etc.

### `app/api/lib/`
Backend helper utilities used across API routes:
- JWT helpers (token parsing and verification)
- Prisma client
- Email sender and templates
- Referral utilities (e.g., generating referral codes)

### `prisma/`
Database schema and migrations:
- `prisma/schema.prisma` is the authoritative schema.
- `prisma/migrations/**` contains SQL migrations.
- `prisma/seed.ts` (referenced by `package.json`) seeds the DB if you run `npm run db:seed`.

### `package.json`
Contains backend-relevant scripts:
- `build`: runs `prisma generate` before building Next.
- `postinstall`: runs `prisma generate`.
- `db:seed`: runs `tsx prisma/seed.ts`.

```json name=package.json url=https://github.com/Iwinn86/exspend1/blob/83f46997a733df8ad38884cd7ae20264ed013d75/package.json
{
  "scripts": {
    "build": "prisma generate && next build",
    "postinstall": "prisma generate",
    "db:seed": "tsx prisma/seed.ts"
  }
}
```

---

## 3) Database Schema (Prisma)

**File:** `prisma/schema.prisma`  
Defines core models used by the backend.

Key models visible (partial list, see full file in repo):
- `User`: authentication + roles + referral + kyc flags
- `Order`: buy/sell/spend orders and payment method fields (bank/momo)
- `Receipt`: receipt JSON attached to an order
- `KycEntry`: KYC submissions + status
- `ExchangeRate`: rate history (GHS/USD)
- plus additional models further down the file (WalletSettings, HelpTicket, HelpReply, Notification, OrderMessage, ReferralReward, UserDailyQuota, PasswordReset, Bundles, etc. depending on the rest of schema)

```prisma name=prisma/schema.prisma url=https://github.com/Iwinn86/exspend1/blob/83f46997a733df8ad38884cd7ae20264ed013d75/prisma/schema.prisma#L1-L127
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

model User {
  id               String   @id @default(uuid())
  email            String   @unique
  isAdmin          Boolean  @default(false)
  kycVerified      Boolean  @default(false)
  referralCode     String?  @unique
  referralPoints   Int      @default(0)
  referredBy       String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

model Order {
  id            String      @id @default(uuid())
  userId        String
  orderType     OrderType
  serviceType   ServiceType
  amountGhs     Float
  cryptoAsset   String
  cryptoAmount  String
  status        OrderStatus @default(pending)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}

model KycEntry {
  id              String    @id @default(uuid())
  userId          String
  documentType    String
  documentNumber  String
  frontImage      String
  backImage       String?
  selfieImage     String
  status          KycStatus @default(pending)
  submittedAt     DateTime  @default(now())
  reviewedAt      DateTime?
}

enum KycStatus {
  pending
  approved
  rejected
}
```

---

## 4) Authentication & Authorization

### Pattern used
Many endpoints follow this pattern:

- Extract token from request headers
- Verify JWT payload
- For admin endpoints: require `payload.isAdmin === true`

Example helper pattern inside routes:
- `requireAuth(request)` → returns payload or null
- `requireAdmin(request)` → returns payload only if admin

### `/api/auth/me`
**File:** `app/api/auth/me/route.ts`  
Returns current user (based on token). **Important**: this file currently reads from `readJSON('users.json')`, which suggests legacy or transitional auth storage. Most of the rest of the backend uses Prisma’s `User` table.

```ts name=app/api/auth/me/route.ts url=https://github.com/Iwinn86/exspend1/blob/83f46997a733df8ad38884cd7ae20264ed013d75/app/api/auth/me/route.ts#L1-L35
import { getTokenFromRequest, verifyToken } from '@/app/api/lib/jwt';
import { readJSON } from '@/app/api/lib/db';
...
```

**Recommendation for maintainers**: align `/api/auth/me` with the Prisma `User` model (DB source of truth) if the app is fully migrated to Postgres.

---

## 5) Orders Domain

### `/api/orders`
**File:** `app/api/orders/route.ts`

- `GET`: returns authenticated user’s orders (includes `receipt`)
- `POST`: creates new order.
  - Validates required fields (`service`, `serviceType`, `cryptoAsset`, `cryptoAmount`)
  - Applies **daily quota** checks for spend/sell orders
  - Uses email utilities (`sendEmail`, templates)
  - Uses `DEFAULT_WALLET_ADDRESSES` (fallback settings)

```ts name=app/api/orders/route.ts url=https://github.com/Iwinn86/exspend1/blob/83f46997a733df8ad38884cd7ae20264ed013d75/app/api/orders/route.ts#L1-L80
import { prisma } from '@/app/api/lib/prisma';
import { sendEmail } from '@/app/api/lib/email';
import { orderConfirmationEmail, adminNewOrderEmail } from '@/app/api/lib/email-templates';
...
```

### `/api/orders/:id/messages` (Order Chat)
**File:** `app/api/orders/[id]/messages/route.ts`

- `GET`: returns message history for an order + current order status
  - Allows admin to view any order
  - Non-admin must be the order owner
- `POST`: sends a message if order chat is open
  - Rejects posting if the order is in a completed/final state (chat closed)
  - Creates notification(s) to the other party

```ts name=app/api/orders/[id]/messages/route.ts url=https://github.com/Iwinn86/exspend1/blob/83f46997a733df8ad38884cd7ae20264ed013d75/app/api/orders/[id]/messages/route.ts#L14-L44
// GET /api/orders/[id]/messages — fetch chat history for an order
...
return NextResponse.json({ messages, orderStatus: order.status });
```

### `/api/orders/:id/confirm-sent`
**File:** `app/api/orders/[id]/confirm-sent/route.ts`

- Used when a user confirms they have sent crypto (buy/sell flow)
- Transitions order status from `waiting` → `pending`
- Creates admin notifications

```ts name=app/api/orders/[id]/confirm-sent/route.ts url=https://github.com/Iwinn86/exspend1/blob/83f46997a733df8ad38884cd7ae20264ed013d75/app/api/orders/[id]/confirm-sent/route.ts#L1-L57
// Changes order status from 'waiting' to 'pending'
...
```

### `/api/orders/:id/cancel`
**File:** `app/api/orders/[id]/cancel/route.ts`

- Allows user to cancel order only if `waiting` or `pending`
- Sets status to `cancelled`

```ts name=app/api/orders/[id]/cancel/route.ts url=https://github.com/Iwinn86/exspend1/blob/83f46997a733df8ad38884cd7ae20264ed013d75/app/api/orders/[id]/cancel/route.ts#L1-L47
// POST /api/orders/[id]/cancel — cancel an order that is still waiting or pending
...
```

---

## 6) Admin Orders

### `/api/admin/orders`
**File:** `app/api/admin/orders/route.ts`

- `GET`: returns all orders with user info + receipt
- Requires admin token (`user.isAdmin`)

```ts name=app/api/admin/orders/route.ts url=https://github.com/Iwinn86/exspend1/blob/83f46997a733df8ad38884cd7ae20264ed013d75/app/api/admin/orders/route.ts#L1-L30
function requireAdmin(request: NextRequest) {
  ...
  return user?.isAdmin ? user : null;
}
```

### `/api/admin/orders/:id`
**File:** `app/api/admin/orders/[id]/route.ts`

- `GET`: get a single order’s details (includes user + receipt)
- `PATCH`: update order status and optionally admin note
- Sends email updates for certain statuses (see `EMAIL_STATUSES`)

```ts name=app/api/admin/orders/[id]/route.ts url=https://github.com/Iwinn86/exspend1/blob/83f46997a733df8ad38884cd7ae20264ed013d75/app/api/admin/orders/[id]/route.ts#L1-L18
const VALID_STATUSES: OrderStatus[] = ['waiting', 'pending', 'processing', 'successful', 'failed', 'cancelled'];
const EMAIL_STATUSES: OrderStatus[] = ['processing', 'successful', 'failed'];
```

---

## 7) Help / Support Tickets

### `/api/help/tickets`
**File:** `app/api/help/tickets/route.ts`

- `GET`: returns the authenticated user’s tickets (includes replies)
- `POST`: creates a ticket
  - Requires `orderId`
  - Validates order belongs to user
  - Only allows ticket creation for completed orders: `successful | failed | cancelled`
  - Creates an admin notification for new tickets

```ts name=app/api/help/tickets/route.ts url=https://github.com/Iwinn86/exspend1/blob/83f46997a733df8ad38884cd7ae20264ed013d75/app/api/help/tickets/route.ts#L28-L90
if (!['successful', 'failed', 'cancelled'].includes(order.status)) {
  return NextResponse.json({ error: 'Tickets can only be opened for completed orders...' }, { status: 400 });
}
```

### `/api/help/tickets/:ticketId/reply`
**File:** `app/api/help/tickets/[ticketId]/reply/route.ts`

- Allows a user to reply to their own ticket
- Rejects reply if ticket is `resolved` or `closed` (server message says “Please reopen to reply”, but reopen is currently disabled—see below)

```ts name=app/api/help/tickets/[ticketId]/reply/route.ts url=https://github.com/Iwinn86/exspend1/blob/83f46997a733df8ad38884cd7ae20264ed013d75/app/api/help/tickets/[ticketId]/reply/route.ts#L28-L33
if (ticket.status === 'resolved' || ticket.status === 'closed') {
  return NextResponse.json({ error: 'Ticket is closed. Please reopen to reply.' }, { status: 400 });
}
```

### `/api/help/tickets/:ticketId/reopen`
**File:** `app/api/help/tickets/[ticketId]/reopen/route.ts`

- Currently **disabled**: always returns 403 telling the user to open a new ticket.

```ts name=app/api/help/tickets/[ticketId]/reopen/route.ts url=https://github.com/Iwinn86/exspend1/blob/83f46997a733df8ad38884cd7ae20264ed013d75/app/api/help/tickets/[ticketId]/reopen/route.ts#L1-L9
// disabled: tickets cannot be reopened by users
```

---

## 8) Admin Help Desk

### `/api/admin/help`
**File:** `app/api/admin/help/route.ts`

- `GET`: list all tickets with:
  - `user` (id, name, email)
  - `replies` ordered by createdAt
- Admin-only

```ts name=app/api/admin/help/route.ts url=https://github.com/Iwinn86/exspend1/blob/83f46997a733df8ad38884cd7ae20264ed013d75/app/api/admin/help/route.ts#L11-L27
const tickets = await prisma.helpTicket.findMany({
  include: {
    user: { select: { id: true, name: true, email: true } },
    replies: { orderBy: { createdAt: 'asc' } },
  },
  orderBy: { createdAt: 'desc' },
});
```

### `/api/admin/help/:ticketId/reply`
**File:** `app/api/admin/help/[ticketId]/reply/route.ts`

- Admin replies to a ticket (creates `helpReply` with `fromAdmin: true`)
- If admin sets `resolve: true`, ticket status becomes `resolved` and a **user notification** is created.
- When admin replies normally, ticket status is set to `in_progress`.

```ts name=app/api/admin/help/[ticketId]/reply/route.ts url=https://github.com/Iwinn86/exspend1/blob/83f46997a733df8ad38884cd7ae20264ed013d75/app/api/admin/help/[ticketId]/reply/route.ts#L31-L67
if (resolve) {
  await prisma.helpTicket.update({ where: { id: ticketId }, data: { status: 'resolved' } });
  await prisma.notification.create({ ... });
  return NextResponse.json({ success: true, status: 'resolved' });
}
...
await prisma.helpTicket.update({ where: { id: ticketId }, data: { status: 'in_progress' } });
```

---

## 9) KYC Domain

### `/api/kyc`
**File:** `app/api/kyc/route.ts`

- `GET`: returns most recent KYC entry for the authenticated user
- `POST`: creates a new KYC submission record (document images are provided as strings; likely base64)

```ts name=app/api/kyc/route.ts url=https://github.com/Iwinn86/exspend1/blob/83f46997a733df8ad38884cd7ae20264ed013d75/app/api/kyc/route.ts#L1-L44
// GET /api/kyc — get current user's KYC status
// POST /api/kyc — submit KYC documents
```

### `/api/admin/kyc`
**File:** `app/api/admin/kyc/route.ts`

- `GET`: list all KYC submissions (admin-only)
- Returns an “enriched” list (userName/userEmail included)

```ts name=app/api/admin/kyc/route.ts url=https://github.com/Iwinn86/exspend1/blob/83f46997a733df8ad38884cd7ae20264ed013d75/app/api/admin/kyc/route.ts#L1-L41
// list all KYC submissions (admin only)
```

### `/api/admin/kyc/:id` (approve/reject)
**File:** `app/api/admin/kyc/[id]/route.ts`

- `PATCH`: approve or reject a KYC submission
- If approved:
  - sets `User.kycVerified = true`
  - if user was referred (`referredBy` exists), creates a `ReferralReward` record (if not already existing)

```ts name=app/api/admin/kyc/[id]/route.ts url=https://github.com/Iwinn86/exspend1/blob/83f46997a733df8ad38884cd7ae20264ed013d75/app/api/admin/kyc/%5Bid%5D/route.ts#L31-L56
if (action === 'approve') {
  const approvedUser = await prisma.user.update({
    where: { id: updated.userId },
    data: { kycVerified: true },
    select: { referredBy: true },
  });

  if (approvedUser.referredBy) {
    const existingReward = await prisma.referralReward.findFirst({
      where: { referredUserId: updated.userId },
    });

    if (!existingReward) {
      await prisma.referralReward.create({ ... });
    }
  }
}
```

---

## 10) Settings & Rates

### `/api/settings`
**File:** `app/api/settings/route.ts`

- `GET`: returns wallet settings + latest exchange rate + buy/sell overrides
  - Uses `WalletSettings` singleton (`id: 'singleton'`)
  - Also reads `ExchangeRate` latest record
  - Uses `DEFAULT_WALLET_ADDRESSES` fallback if no DB settings exist
- `POST`: admin-protected endpoint (file continues beyond the snippet) used to update wallet addresses and buy/sell rates.

```ts name=app/api/settings/route.ts url=https://github.com/Iwinn86/exspend1/blob/83f46997a733df8ad38884cd7ae20264ed013d75/app/api/settings/route.ts#L1-L47
export async function GET() {
  const [settings, latestRate] = await Promise.all([
    prisma.walletSettings.findUnique({ where: { id: 'singleton' } }),
    prisma.exchangeRate.findFirst({ orderBy: { createdAt: 'desc' } }),
  ]);
  ...
}
```

> A developer should read the rest of this file to see exactly what POST updates and how it validates inputs.

---

## 11) Rates History

### `/api/rates`
**File:** `app/api/rates/route.ts` (seen previously in repo context)

- `POST`: admin-only, create a new `ExchangeRate` record
- `GET`: returns last 10 rate records, newest first

(If you want, we can add the exact snippet once this file is reviewed alongside the rest of your repo.)

---

## 12) Referrals

### Referral helper
**File:** `app/api/lib/referral.ts`

- Contains constants and functions for referral system.
- `generateUniqueReferralCode()` uses crypto random bytes and checks DB uniqueness.

```ts name=app/api/lib/referral.ts url=https://github.com/Iwinn86/exspend1/blob/83f46997a733df8ad38884cd7ae20264ed013d75/app/api/lib/referral.ts#L1-L15
export async function generateUniqueReferralCode(): Promise<string> {
  const code = `EXP-${randomBytes(6).toString('hex').toUpperCase()}`;
  const taken = await prisma.user.findUnique({ where: { referralCode: code } });
  ...
}
```

### Referral reward creation trigger
When admin approves KYC (`/api/admin/kyc/:id`), a pending `ReferralReward` may be created if the approved user was referred.

### Admin referral approval
**File:** `app/api/admin/referral/approve/route.ts` (seen previously in repo context)

- Admin approves a reward only if both referrer and referred user are KYC verified
- Sets reward status to `approved`
- Increments referrer referral points

---

## 13) Daily Quota

There is a daily quota concept used to limit user activity based on KYC:

- Unverified daily limit is smaller (example seen: 5,000)
- Verified daily limit is larger (example seen: 30,000)

This logic is enforced in:
- `app/api/orders/route.ts` (when creating spend/sell orders)
- `app/api/user/daily-quota/route.ts` (returns totals/remaining for today) — file exists in repo context

---

## 14) Known “Gotchas” / Notes for New Developers

1. **Mixed user sources**  
   `/api/auth/me` reads from JSON storage (`readJSON('users.json')`) while most of the app uses Prisma. This should be unified.

2. **Ticket reopen is disabled but reply error mentions reopen**  
   Users cannot reopen tickets (`/api/help/tickets/:ticketId/reopen` returns 403), but `/api/help/tickets/:ticketId/reply` says “Please reopen to reply.”  
   Either re-enable reopen, or adjust the reply error message/UI so it matches product behavior.

3. **Admin auth best practice**  
   Ensure admin-only endpoints are enforced server-side (many already do `user.isAdmin`). Avoid relying on client-only checks like `ADMIN_EMAIL` to secure admin routes.

---

## 15) Quick API Index (from the files reviewed)

### Auth
- `GET /api/auth/me` → current user (token-based)

### Orders
- `GET /api/orders` → list user orders
- `POST /api/orders` → create order
- `GET /api/orders/:id/messages` → order chat messages + status
- `POST /api/orders/:id/messages` → send chat message
- `POST /api/orders/:id/confirm-sent` → waiting → pending
- `POST /api/orders/:id/cancel` → cancel waiting/pending

### Admin Orders
- `GET /api/admin/orders` → list all orders
- `GET /api/admin/orders/:id` → order detail
- `PATCH /api/admin/orders/:id` → update status/admin note

### Help / Support
- `GET /api/help/tickets` → user tickets
- `POST /api/help/tickets` → create ticket (completed orders only)
- `POST /api/help/tickets/:ticketId/reply` → user replies
- `POST /api/help/tickets/:ticketId/reopen` → disabled

### Admin Help
- `GET /api/admin/help` → list all help tickets
- `POST /api/admin/help/:ticketId/reply` → admin reply or resolve

### KYC
- `GET /api/kyc` → user KYC status/latest submission
- `POST /api/kyc` → submit KYC
- `GET /api/admin/kyc` → list KYC (admin)
- `PATCH /api/admin/kyc/:id` → approve/reject

### Settings
- `GET /api/settings` → wallet + rates settings
- `POST /api/settings` → update settings (admin-protected)

---

## 16) Where to Look Next

If a developer needs to extend the backend, the usual path is:
- Add/modify Prisma models in `prisma/schema.prisma`
- Run migrations
- Implement route handlers in `app/api/**/route.ts`
- Reuse helper logic from `app/api/lib/*`

---

**End of Document**