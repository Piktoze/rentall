# RentInOrbit — staging two-party and Stripe TEST launch proof (2026-11-11)

Status: **NOT EXECUTED / NO-GO** until each row is supported by screenshots, timestamps, booking IDs and verified provider events. This document is a handoff checklist, not evidence of passing tests.

Scope: `Piktoze/rentall` `staging/v203`, Railway `nurturing-strength / staging`, `https://rentall-staging.up.railway.app`, Stripe **TEST ONLY**. Never touch `main`, production, Stripe LIVE or persistent production `/data`. No paid credits. Do not reuse real identity/payment data.

## Preflight, in strict order
1. Record branch HEAD SHA, staging deployment SHA, environment identity and UTC date/time. Verify deployed SHA matches tested source; otherwise STOP.
2. Confirm staging mode and test Stripe keys without exposing values. Check `GET /api/runtime-config`, `GET /api/launch-readiness`, expected TEST webhook signing, and connected account capabilities. A 200 endpoint alone does not prove real payment readiness.
3. Use two separate browser sessions and two distinct synthetic accounts: renter (no supplier tools) and supplier. Record account identifiers privately. Reuse existing **V203 Launch Audit 100 EUR Item** only if still visible, active and clearly test-only.
4. Check supplier listing images (2–5), availability, correct total including optional €40 city delivery where selected, terms and privacy text, and Lithuanian UI without English strings. No fake accommodation requirement in Lithuania-first flow.

## Two-party flow: required evidence
| # | Action | Expected assertion |
|---|---|---|
| 1 | Renter starts €100 booking | Exactly one booking ID; pending/unpaid; zero captured charges |
| 2 | Before supplier approval, try payment endpoints or UI | Payment blocked; no successful PaymentIntent; no pickup code |
| 3 | Supplier approves once; repeat request | One authoritative confirmation; idempotent retry; renter order visible in **Mano užsakymai** |
| 4 | Both users independently sign agreement | Each signature bound to the correct party; neither party receives their pickup code before signing; neither can view the other party's code |
| 5 | Renter pays via Stripe TEST (synthetic card) | Exactly one €100 PaymentIntent, expected booking binding and fee; no redirect back to listing without order state |
| 6 | Deliver signed webhook; replay same webhook | Paid/active exactly once; no duplicate booking, fee, email or charge; signed/wrong-booking webhook rejected |
| 7 | Supplier verifies renter handover code | Code remains valid until legitimately used; one-time handover; supplier has no redundant code-issue button |
| 8 | Renter sends message; supplier replies | Both sides can send and receive only within authorized booking |
| 9 | Supplier marks return complete | No mandatory renter return code; final state consistent for both roles |
| 10 | Create separate paid test booking and cancel/refund | Provider refund belongs to correct PaymentIntent; correct amount/currency; `pending` not shown as settled; webhook eventual transition correct |
| 11 | Create separate unpaid booking then cancel | €0 refund/no Stripe refund; clear cancellation state |
| 12 | Create separate dispute on eligible booking | Authorized only, no duplicate dispute; notifications are best-effort; actual dispute persists even if sending fails |

## Negative / regression cases
- Stripe event with wrong booking metadata, wrong PaymentIntent, invalid signature, replayed event or out-of-order status cannot credit a booking.
- Late `payment_intent.succeeded` after booking cancellation cannot mark order paid/active. Refund must match the provider object, full expected amount and correct payment intent; pending refund must not be called successful.
- Account A cannot access account B's booking, agreement, photos, messages, codes or private details.
- Supplier and renter role menus stay distinct; mobile and desktop checkout, dialogs, language switch and listing photo uploads are usable.
- Provider error, webhook outage and message/notification failure yield truthful UI, retry-safe state and traceable redacted logs.

## Evidence template
For EACH step capture: UTC timestamp, commit SHA, deploy ID, test booking ID, renter/supplier roles (never secrets), HTTP/status or user-visible result, relevant TEST Stripe event/PaymentIntent/refund IDs, sanitized screenshot/log pointer, PASS/FAIL, and linked defect. Do not put personal data, credentials, full session cookies or card data in the repository.

## Release decision
**NO-GO** unless all monetary, signature, code, access-control and refund cases pass on the *deployed* staging build; successful static/unit tests alone do not satisfy this gate. Also require real owner/legal contacts, applicable privacy/DSA review, correct refund and payment disclosures, production provider setup, backup/restore drill, and physical-device browser QA before approving public launch. Never enable LIVE processing on the strength of this checklist.
