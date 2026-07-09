# Session 03 — Cloudflare Tunnel Setup (Cancelled)

**Date:** 2026-07-09

## Context

User wanted to expose RCC-HIROS to authorized peers via Cloudflare Tunnel.

## What happened

- Downloaded & installed cloudflared ✅
- Authenticated with Cloudflare ✅
- Created tunnel `hiros` with ID 2f71b6ab-8b3a-4cf6-90c3-9acf22f847c5 ✅
- Routed DNS `app.rcc-hiros.com` to tunnel ✅
- Created config.yml in `~/.cloudflared/` ✅
- Started tunnel — connections registered successfully ✅

## Decision

User decided not to continue with Cloudflare Tunnel setup and will look for a more efficient solution.

## Cleanup

- Stopped cloudflared process
- Deleted tunnel `hiros` from Cloudflare
- Removed config.yml and credentials from `~/.cloudflared/`
- Removed cloudflared from `C:\Program Files (x86)`
- Left `cert.pem` in `~/.cloudflared/` (login auth, harmless)
- Left the DNS CNAME record for `app.rcc-hiros.com` (Cloudflare dashboard cleanup needed if desired)
