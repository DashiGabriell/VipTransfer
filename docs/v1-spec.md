# JMD Transfer Platform — Spec v1

Spec sintetizada da sessão grill-me (confirmada).

## Problem Statement

A JMD Transfer precisa de uma plataforma profissional de transfer executivo: site público para reserva com estimativa, hold de horário e WhatsApp; operação interna (agenda, frete, frota, leads) com multi-tenant preparado, papéis e auditoria — hoje só existe landing HTML estática.

## Solution

App web (Vite + React + TypeScript + Tailwind) + Supabase (Auth, Postgres, RLS, Edge Functions, Cron), multi-tenant por subdomínio, cotação/reserva com OpenRouteService, hold de 60 minutos, confirmação admin, notificações WhatsApp + n8n/Gmail. UI pública baseada em `index2.html`.

## User Stories

1. As a visitor, I want to request a transfer reservation with origin/destination, so that I get an estimated price quickly.
2. As a visitor, I want to choose service type and vehicle category, so that the estimate matches what I need.
3. As a visitor, I want to pick an available 30-minute slot, so that I know the time is tentatively mine.
4. As a visitor, I want my slot held for 60 minutes without admin confirmation, so that nobody else takes it while I wait.
5. As a visitor, I want to leave name, phone and email, so that JMD can contact me.
6. As a visitor, I want to open WhatsApp with a prefilled summary, so that I can talk to the team immediately.
7. As a visitor, I want the estimate shown as non-final, so that I understand confirmation happens with the team.
8. As a visitor, I want the site in PT-BR or English, so that I can use my preferred language.
9. As an operador, I want to see new reservations/leads, so that I can follow up.
10. As an operador, I want to confirm a reservation, so that the slot stays permanently taken.
11. As an operador, I want expired holds to free capacity automatically, so that the calendar stays accurate.
12. As an admin, I want to edit freight rules (R$/km, minimum, hourly, airport fees), so that estimates match commercial policy.
13. As an admin, I want to override km or price on a lead, so that I can adjust edge cases.
14. As an admin, I want to manage fleet categories and capacity windows, so that public availability is correct.
15. As an admin, I want to register vehicles/categories from an empty start, so that we grow the fleet over time.
16. As an owner (org), I want to manage staff roles in my organization, so that access matches responsibilities.
17. As a platform owner or dev, I want to create organizations, so that we can onboard future tenants.
18. As a dev, I want to impersonate staff with a visible banner and audit trail, so that I can support without sharing passwords.
19. As a platform stakeholder, I want append-only audit logs, so that sensitive actions are accountable.
20. As an admin, I want email notification via n8n+Gmail on new reservations, so that I am alerted without living in the panel.
21. As a tenant, I want branding and WhatsApp/email settings per organization, so that the product is white-label ready.
22. As the system, I want RLS scoped by organization_id, so that tenants cannot see each other's data.

## Implementation Decisions

- Monorepo layout: app in `web/`; Supabase at repo root; `index2.html` remains visual reference until fully ported.
- Multi-tenant: `organizations` + `organization_id` on all business tables; resolve tenant by subdomain (`jmd.<domain>`; local `jmd.localhost`).
- Roles: `dev`, `platform_owner` (global); `owner`, `admin`, `operador`, `leitura` (org-scoped). Create orgs: only `dev` + `platform_owner`.
- Auth: Supabase email/password for staff; no end-customer accounts in v1. Role claims in `app_metadata` (never `user_metadata` for authz).
- Reservation hold: status `hold` → after 60 min without confirm → `hold_expirado` + release capacity; confirm → permanent occupancy. Job via Cron + Edge Function / `pg_cron`.
- Slots: 30-minute buckets; capacity N per bucket (configurable).
- Freight: `max(minimum, km * price_per_km) + fees`; hourly for “horas à disposição”; airport flat fee per GRU/CGH/VCP (admin-configured). Extras (toll, wait, night) out of v1.
- Distance: OpenRouteService behind an adapter; Google Maps later.
- Public UI: port from `index2.html` with reservation language (not only “cotação”).
- i18n: PT-BR default + EN; content fields bilingual where admin-editable.
- Notifications: persist lead, WhatsApp deep link, webhook event for n8n → Gmail.
- Audit: append-only table with actor, org, action, entity, before/after, ip, impersonation persona.
- Seed org: slug `jmd`, name “JMD Transfer”; fleet empty (admin registers).
- Deploy: Vercel (web) + Supabase cloud.

## Testing Decisions

- Prefer tests at domain seams: freight calculator, hold/capacity claiming, tenant resolution, RLS policies (SQL or integration).
- Good tests assert external behavior (price formula, slot free/held/confirmed, cross-tenant isolation), not React internals.
- Add unit tests for pure freight and hold expiry logic first; API/RLS tests when Supabase local is available.

## Out of Scope (v1)

- Online payment
- Driver app / per-vehicle live calendar
- Toll, waiting time, night surcharge (as automatic rules)
- Google Maps (ORS first)
- Soft multi-org creation by tenant `owner`

## Further Notes

- PRODUCT.md (Impeccable) still describes static landing; update stack/capabilities to match this platform spec when the port lands.
- n8n is external; app only emits a reliable event/webhook.
