# Invitation sections

Section-wise React components for invitation / wedding-website pages. The demo at
`/wedding-websites/demo` (`app/wedding-websites/demo/DemoInvitation.jsx`) uses all of them,
with its content in `lib/demo-invitation.js`.

| Component | What it shows |
| --- | --- |
| `InviteShell` | Page wrapper with the EveryMoment colour/font tokens (`--inv-*`). Override with `theme={{ "--inv-accent": "#b8860b" }}` |
| `IntroCover` | "Tap to open" doors. `onOpen` runs inside the tap, so it can start music |
| `CurtainIntro` | Velvet stage curtains that part on tap (same props as `IntroCover`). Colour: `--inv-curtain`, `--inv-curtain-dark` |
| `InviteCard` | Card look for a full-width page: `hero` on top, then all sections on one continuous linen-paper card with floral vines and corner bouquets (art in `public/invite-art/`). Use `tone="light"` on Countdown / DressCode / Closing inside it |
| `HeroSection` | Couple names over a full-screen photo |
| `WelcomeSection` | Welcome note + both families |
| `SaveTheDateSection` | Scratch card that reveals the date + Google Calendar / .ics |
| `CountdownSection` | Live days / hours / minutes / seconds |
| `EventsSection` | Cards for Haldi, Mehndi, Sangeet, Wedding… |
| `ProgramTimelineSection` | Order of the day |
| `VenueSection` | Venue details + embedded Google Map (no API key) |
| `GallerySection` | Auto-playing photo slideshow with swipe |
| `MenuSection` | Veg menu |
| `DressCodeSection` | Women / men dress code + colour palette |
| `GuestInfoSection` | Transport, stay, gifts (any info cards) |
| `RsvpSection` | RSVP form → `onSubmit`, or WhatsApp (`whatsappNumber`), or thank-you only |
| `ClosingSection` + `BrandFooter` | Thank-you ending, contacts, "Made with EveryMoment" footer |
| `MusicToggle` + `useInviteMusic` | Floating music button; audio `src` or generated `createBuffer` |
| `DemoBar` | Brand pill for demo pages only |

## Using one section on another site

Copy these files into the other project:

1. the section's `.jsx` and `.module.css` (e.g. `RsvpSection.jsx` + `RsvpSection.module.css`)
2. `shared.jsx` and `shared.module.css`

Every style has a fallback colour, so the section works without `InviteShell`. To match
another brand, set the `--inv-*` variables (see `InviteShell.module.css`) on any parent element.
Fonts used: Great Vibes, Cormorant Garamond, Cinzel, Poppins (fall back to system fonts if missing).
