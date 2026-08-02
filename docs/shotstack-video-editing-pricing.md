# EveryMoment Pricing & Video Editing Strategy

Version: 1.0
Platform: EveryMoment
Framework: Next.js 15
Backend: Supabase
Video Editing: Shotstack Studio SDK
Rendering: Shotstack Edit API

> Planning doc, pasted in by the user on 2026-08-03 for implementation
> the next day. Not yet implemented — see the task list for the
> tracked follow-up ("Implement Shotstack video editor + updated
> pricing plan"). Filed alongside `docs/risk-analysis.md` and
> `docs/business-growth-guide.md` per this repo's convention of
> keeping planning docs in `docs/`, separate from the as-built
> `celebration-memories/CLAUDE.md`.

---

# Vision

EveryMoment is an AI-powered Event Experience Platform.

Users should be able to:

- Create Events
- Send Invitations
- Collect Memories
- RSVP
- Create Instagram-style Invitation Reels
- Create AI Memory Videos
- Edit videos inside the browser
- Share directly to Instagram, WhatsApp, Facebook and YouTube

The objective is to provide a Canva + Instagram Reels style editing experience without users leaving EveryMoment.

---

# Why Shotstack

Instead of building an editor from scratch, EveryMoment will embed the Shotstack Studio SDK.

Benefits

- Timeline editor
- Trim
- Split
- Merge
- Multiple tracks
- Text
- Music
- Filters
- Transitions
- Browser preview
- White-labelled editor
- React compatible
- Next.js compatible
- Edit JSON compatible
- Cloud Rendering API

The SDK is designed for embedding in web applications and includes official Next.js examples and a React package. The Studio SDK is source-available under the PolyForm Shield License and integrates with the Shotstack Edit API for rendering.

---

# Architecture

Users

↓

Upload Photos / Videos

↓

Shotstack Studio SDK

↓

Edit Timeline

↓

Save Edit JSON

↓

Supabase Database

↓

Shotstack Edit API

↓

Render MP4

↓

Supabase Storage

↓

Share

---

# Technology Stack

Frontend

- Next.js 15
- React
- TypeScript
- Tailwind CSS

Backend

- Next.js API Routes
- Supabase

Storage

- Supabase Storage

Video Editing

- Shotstack Studio SDK

Rendering

- Shotstack Edit API

AI

- OpenAI
- Whisper
- ElevenLabs (future)

---

# Features Included

## Beginner

- Drag & Drop
- Upload Photos
- Upload Videos
- Background Music
- Text
- Invitation Templates

---

## Intermediate

- Timeline
- Trim
- Split
- Crop
- Rotate
- Volume
- Multiple Scenes

---

## Advanced

- Multiple Video Tracks
- Multiple Audio Tracks
- Animated Text
- Transitions
- Filters
- Speed Controls
- Brand Templates

---

# AI Features

Future

- AI Invitation Reel
- AI Wedding Reel
- AI Birthday Reel
- AI Memory Reel
- AI Captions
- AI Music Suggestions
- AI Auto Timeline
- AI Highlight Detection

---

# Pricing Strategy

## FREE

Price

₹0

Features

- Browse platform
- Create 1 event
- Basic invitation templates
- Limited RSVPs
- Watermarked previews
- No video rendering
- Community support

Target

Lead generation

---

## EVENT LITE

Price

₹500 / Event

Features

- Unlimited invitations
- RSVP
- Guest management
- Photo Gallery
- Memory Collection
- Event Timeline
- QR Check-in
- Digital Invitation
- Basic Templates

Does NOT include

- Video Editor
- AI Reel
- HD Video Export

Target

Birthday

Anniversary

Baby Shower

Housewarming

Small Events

---

## EVENT PRO ⭐ Recommended

Price

₹999 / Event

Everything in Lite

PLUS

- Instagram-style Video Editor
- Shotstack Studio SDK
- Timeline Editing
- Trim
- Split
- Merge
- Music Library
- Stickers
- Animated Text
- Premium Templates
- HD Video Export
- AI Invitation Reel
- AI Memory Reel
- AI Caption Suggestions
- Priority Rendering

Target

Wedding

Corporate Event

Engagement

Workshop

Conference

Premium Birthday

---

## CREATOR

Price

₹999 / Month

Includes

- Unlimited Events
- Unlimited Video Editing
- Unlimited HD Rendering*
- AI Invitation Videos
- AI Memory Videos
- Premium Templates
- Remove Watermark
- Social Sharing
- Priority Support

Fair Usage

Rendering usage subject to fair use policy.

---

## BUSINESS

Price

₹2,999 / Month

Everything in Creator

PLUS

- Team Members
- Brand Kit
- Photographer Workspace
- Planner Workspace
- Client Workspaces
- Shared Asset Library
- Team Permissions
- Analytics
- White-labelled Invitations

Target

Photographers

Event Planners

Agencies

Studios

Hotels

---

## ENTERPRISE

Custom Pricing

Includes

- Dedicated Infrastructure
- SLA
- API Access
- Custom Integrations
- SSO
- Dedicated Support
- White Label Platform
- Custom AI Features

---

# Why Video Editor is NOT included in Lite

Rendering has a real infrastructure cost.

Every exported video consumes rendering credits.

Therefore

Lite

↓

Invitation Platform

Pro

↓

Invitation Platform

+

Professional Video Creation

This creates a natural upgrade path while keeping Lite affordable.

---

# Shotstack Pricing

Recommended Plan

Subscription

USD 39/month

Includes

- 200 rendering credits
- White-label Studio SDK
- Team Management
- Director AI
- Lower render pricing
- Credit rollover (up to published limits while subscribed)

Additional Rendering

USD 0.20/minute

One credit equals one minute of rendered video, billed to the second (e.g. a 30-second render consumes 0.5 credits).

---

# Estimated Cost

30 second invitation

≈ 0.5 credit

≈ USD 0.10

≈ ₹8–10

Revenue

₹999

Infrastructure Cost

Very Low

Healthy Profit Margin

---

# Future Monetization

Possible Add-ons

- AI Voiceover
- Premium Music Packs
- Wedding Templates
- Festival Packs
- Corporate Templates
- Celebrity Wishes
- Additional Render Credits
- Stock Video Packs
- Stock Image Packs
- Premium Fonts

---

# Future Creator Marketplace

Creators can sell

- Invitation Templates
- Wedding Themes
- Reels
- Motion Graphics
- Lower Thirds
- Intro Videos
- Outro Videos
- Animated Stickers

Revenue Split

Creator

70%

EveryMoment

30%

---

# Development Phases

Phase 1

- Integrate Shotstack Studio SDK
- Save Edit JSON
- Export MP4
- Basic Templates

Phase 2

- AI Reel Generation
- Guest Memory Videos
- Auto Captions
- AI Music

Phase 3

- Collaboration
- Live Editing
- Brand Kits
- Marketplace
- AI Event Host

---

# Technical Notes

- Store Shotstack Edit JSON in Supabase rather than rendered videos for drafts.
- Render only when the user explicitly exports or shares to reduce rendering costs.
- Cache completed renders and reuse identical outputs.
- Delete temporary assets after rendering.
- Use signed URLs for uploads.
- Queue rendering jobs.
- Track rendering credits per user.
- Enforce plan limits at the API level.
- Add watermarking for Free users.
- Rate-limit rendering to prevent abuse.
- Monitor monthly rendering costs.
- Use webhooks to receive render completion notifications.
- Use the official Next.js integration as the starting point for implementation.

---

# Notes for implementation (added by Claude, not part of the original doc)

- This repo **already has a Shotstack integration** for the existing
  "Slideshow Video" admin feature (see `celebration-memories/CLAUDE.md`'s
  "Core conventions" section: submit-then-poll pair of Supabase Edge
  Functions, since Shotstack renders are async and exceed Netlify's
  sync function time limit). The new Studio SDK embed (an in-browser
  timeline editor, distinct from the existing server-side
  slideshow-from-photos renderer) would be additive, not a replacement
  — check `features/admin/slideshow/` and the Shotstack Edge Functions
  before starting so credentials/patterns aren't duplicated.
- This doc's pricing model (per-event ₹500/₹999 one-time + monthly
  Creator/Business tiers) is a significant restructuring of whatever
  pricing exists today in `features/pricing/` and `lib/stripe.ts`/
  `lib/razorpay.ts` — needs reconciling with the current self-serve
  wizard's payment step before implementation, not just added
  alongside it.
- Note this doc predates and doesn't mention the "pay what you like /
  open amount" idea the user raised earlier — worth asking whether
  that's still wanted alongside or instead of these fixed tiers.
