# Phygital — The Complete Guide

> A friendly, top‑to‑bottom explainer of what this website is, what it does,
> and what real people get out of every campaign it offers.

---

## 1. What is this website, in one paragraph?

**Phygital** is a SaaS platform that turns "physical" things — business
cards, posters, packaging, table tents, brochures, signage — into **digital,
trackable experiences** through one simple thing: a **QR code**.

You log in, pick the kind of experience you want (a link, a link hub, a
video page, a downloadable doc page, a digital business card, or a full
holographic AR business card), fill in a short wizard, design your QR, and
the platform hands you back a **QR + a hosted destination page + live
analytics**. The QR you print never changes — but everything behind it can.

In short:

- **Phygital** = **Phy**sical + Di**gital**. Real-world prints that lead to
  rich, updatable online experiences.
- **8ThWall** = a nod to Niantic 8th Wall, the WebAR engine that powers the
  augmented-reality campaigns (no app download needed — it runs in the
  phone's browser).

---

## 2. Big-picture context (why this exists)

Printed materials have one painful problem: **once printed, they are frozen
in time.** Reprint a flyer because a link changed? Expensive. Track who
actually scanned your business card? Impossible. Show a 30-second pitch
video on a paper card? Not possible — unless something bridges paper and
the web.

This platform is that bridge. Every campaign produces:

1. **A QR code you print on anything.**
2. **A hosted destination** (a redirect, a link hub, a video hub, a
   business-card hub, or a WebAR experience).
3. **Real-time analytics** — scans, unique scans, devices, browsers,
   locations, link clicks, video plays, document opens, watch time.
4. **The ability to edit the destination later without reprinting the QR.**

That last point is the magic — and it's the heart of **Dynamic QR**, which
the next section explains.

---

## 3. Static QR vs. Dynamic QR — what is the actual difference?

This is the single most important concept to understand before using the
platform, so let's spell it out clearly.

### 3.1 Static (a.k.a. "normal") QR

A static QR code has the **destination URL literally encoded into the
black-and-white pattern itself.**

```
Static QR pattern  →  contains  →  "https://yourwebsite.com/sale"
```

When somebody scans it, their phone reads the URL straight out of the
image and opens it. That's it. There is no server in the middle.

Consequences:

| Trait | Static QR |
|---|---|
| Destination is editable later | ❌ No — printed once, fixed forever |
| Tracks scans | ❌ No — there's nothing to "phone home" to |
| Tracks who, when, where, on what device | ❌ No |
| Tracks unique vs. repeat visitors | ❌ No |
| If destination dies, QR dies | ✅ Yes — broken forever |
| Can be repurposed for a new campaign | ❌ No — reprint required |
| Costs money to fix a typo | ✅ Yes — reprint everything |

Static QRs are fine for "the URL will literally never change", e.g. a
QR that says "open my homepage". For anything marketing-related, they
are a liability.

### 3.2 Dynamic QR (what this platform creates)

A dynamic QR encodes a **short, opaque redirect link** that points to
**our server**, not to the final destination. The server then looks up
"what should this slug redirect to right now?" in a database and sends
the visitor onward.

```
Dynamic QR pattern  →  contains  →  "https://phygital8thwall.com/r/k3p9w2qa"
                                          │
                                          ▼
                         our server looks up slug 'k3p9w2qa'
                                          │
                                          ▼
            redirects to wherever you set it today — and only today
```

Consequences:

| Trait | Dynamic QR (this platform) |
|---|---|
| Destination is editable later | ✅ Yes — change anytime, QR stays the same |
| Tracks scans | ✅ Yes — every scan logged |
| Tracks device, browser, country, city | ✅ Yes |
| Tracks unique vs. repeat visitors | ✅ Yes |
| If destination dies, you re‑point it | ✅ Yes — zero reprint cost |
| Can be repurposed | ✅ Yes — change the destination, the same printed QR now powers a new campaign |
| Optional precise geolocation (with user consent) | ✅ Yes |
| Survives typos, broken links, expired pages | ✅ Yes |

### 3.3 The intuition

> **A static QR is the destination.
> A dynamic QR is a permanent address that points to a moving destination.**

Or in plainer English: a static QR is a printed letter (it is what it is). A
dynamic QR is a P.O. Box (you can change where mail is forwarded any time,
but the box address never changes).

---

## 4. Why create your QR from *this* website specifically?

Plenty of free tools online will spit out a QR code. Here's what you only
get from Phygital:

### 4.1 Every QR is dynamic by default
Edit the destination forever. No reprints. Ever.

### 4.2 Rich destinations, not just plain links
Most QR generators give you a redirect and nothing else. We give you a
**hosted destination page** — link hubs, video hubs, doc hubs, digital
business cards, AR experiences — already designed, already mobile-first,
already branded.

### 4.3 Real analytics, not a vanity counter
- Total scans + unique scans
- Devices (mobile/desktop), browsers, OS
- Country/city
- Per-link click counts, per-video play counts, per-doc open counts,
  per-card action counts (call, email, save contact, share)
- Time-series charts on 7-, 30-, 90-day windows
- Optional **precise geolocation** (browser-consent based) for high-fidelity
  in-person attribution

### 4.4 QR design that's actually beautiful
Full styling: colors, gradients, dot styles, corner styles, embedded logo,
brand palette. Your QR doesn't look like every other QR.

### 4.5 The destination is hosted — you don't run anything
No website? No problem. The platform hosts the link hub, the video hub,
the AR experience, the digital business card. You just share the QR.

### 4.6 WebAR with zero app downloads
The AR business card campaign runs **inside the phone's browser** using
the 8th Wall WebAR SDK. Scan the QR, point the phone at the printed card,
the hologram pops out. No "please install our app" friction.

### 4.7 Soft delete, drafts, multi-device sessions, secure auth
This is built like a real product — JWT access tokens in memory, refresh
tokens in httpOnly cookies, per-device sessions you can revoke, drafts
that auto-save to your browser so you never lose work.

### 4.8 Pay once, edit forever
Once a campaign is live, you can keep tweaking the page, swapping the
video, adding/removing links, updating contact info, retiring a doc — all
without changing the QR.

---

## 5. The six campaign types — what they are and what real users do with them

The dashboard groups campaigns into three families. Below is every campaign
type, what it does, and the concrete use cases a normal person actually
gets out of it.

### Family A — Phygital QR

> One scan from a printed thing to a curated digital experience.

#### A.1 Links + Video QR
**What it is:** One QR opens a branded hub page that shows a **hero video**
at the top and a curated list of important links underneath. The video can
be a Cloudinary upload or an embedded YouTube/Vimeo/social URL.

**What a normal user does with it:**

- **Real-estate agents** — print one QR on a "For Sale" sign. Scan it →
  walk-through video of the property plays at the top, with links to the
  full listing, virtual tour, mortgage calculator, and "Book viewing"
  underneath.
- **Restaurants / cafés** — table-tent QR. Scan it → 20-second "what we're
  about" video plays, with links to the menu, reservations, Instagram,
  Google review form.
- **Wedding photographers** — sample reel video + links to portfolio,
  pricing PDF, Instagram, contact form.
- **Coaches / consultants** — pitch video + booking link, free guide,
  testimonials page, calendar.
- **Product packaging** — unboxing/how-to-use video + warranty registration,
  support form, "buy refills" link.
- **Trade-show booth poster** — 30-second loop introducing the company +
  links to product specs, demo signup, the rep's calendar.

#### A.2 Links + Doc + Video QR
**What it is:** Same as above, but the hub also carries **downloadable
documents** (PDFs, Office files, brochures, price sheets, contracts) and
can host **multiple videos**, each tracked separately. Up to 5 videos and
5 docs per campaign.

**What a normal user does with it:**

- **B2B sales reps** — one QR on a business card → product overview video,
  customer testimonial video, the pricing PDF, the spec sheet, the
  contract template, and links to the CRM booking page. Reps know exactly
  which doc the prospect opened.
- **Real-estate agents (high-end)** — one QR on a yard sign →
  walkthrough video, drone video, neighborhood video, floor-plan PDF,
  HOA docs, mortgage flyer.
- **Universities / training programs** — one QR in a brochure → "what
  it's like" video, dean's intro video, curriculum PDF, application
  PDF, scholarship info PDF.
- **Healthcare clinics** — one QR in the waiting room → procedure
  explainer videos, intake form PDF, insurance acceptance list PDF,
  post-procedure care instructions.
- **Law firms / accountants** — QR on stationery → onboarding video,
  fee structure PDF, intake form PDF, FAQ doc.
- **Event organizers** — one QR on event signage → highlight reel,
  sponsor reel, schedule PDF, map PDF, code of conduct PDF.

### Family B — Dynamic QR

> Editable destinations. The QR you print is permanent. What it points at
> isn't.

#### B.1 Single Link QR
**What it is:** A dynamic QR that 302-redirects to **one URL** you set.
You can rewrite that URL any time. Print once, re-point forever.

**What a normal user does with it:**

- **Print marketing that needs to outlive a campaign** — print "Scan for
  our latest offer" on a flyer in January (points to the Jan sale page),
  re-point the same QR in February to the Valentine's promo, in March to
  the spring catalog. Same flyers, new offer every month.
- **Restaurant menu QR** — point at the seasonal menu, swap when the
  menu changes.
- **Product safety / recall QR on packaging** — point to the active
  product page; if something needs a recall notice tomorrow, re-point.
- **Outdoor advertising / billboards** — billboards last weeks but
  marketing pivots in days. Dynamic QR keeps the billboard relevant.
- **Conference badges / lanyards** — point at the conference home page
  this week, the post-event highlights/recordings next week, the early
  bird page for next year's edition six months later.
- **Bus / cab / taxi wraps** — same wraps run for months; you re-point
  the QR per campaign cycle.
- **CV / résumé QR** — point at the latest version of your CV / portfolio.
  Update the doc, the QR keeps working.
- **Wi-Fi password sign at a café** — point at the password page; if you
  rotate the password, just update the destination.

#### B.2 Multiple Links QR
**What it is:** A dynamic QR opens a branded **link-hub page** (similar
to "linktree-style") with a curated list of destinations. Each link is
tracked separately so you see which one visitors actually tap.

**What a normal user does with it:**

- **Creators / influencers** — one QR on a story slide / poster →
  Instagram, TikTok, YouTube, Spotify, merch shop, Patreon.
- **Musicians / DJs** — venue poster QR → Spotify, Apple Music,
  SoundCloud, YouTube, tickets, merch.
- **Small businesses** — sticker on storefront window → Google Maps,
  Instagram, menu, WhatsApp, Google reviews, loyalty program signup.
- **Authors / public speakers** — book-back QR → buy on Amazon, signup
  for newsletter, book a talk, follow on socials.
- **Personal branding** — bio link on a business card → portfolio,
  LinkedIn, GitHub, Twitter/X, scheduling link.
- **Non-profits** — donation QR on a leaflet → donate, volunteer,
  events, contact, annual report.
- **Real estate offices** — one QR on agency window → agent directory,
  listings, valuation, contact.
- **Schools / clubs** — newsletter QR → upcoming events, parent portal,
  donation, calendar, contact.

### Family C — Digital Business Cards

> Replace paper cards (or augment them) with a modern, shareable, editable,
> trackable identity hub.

#### C.1 Personalized Identity (Digital Business Card)
**What it is:** A beautifully designed, fully customizable digital business
card hosted at a friendly URL like `phygital8thwall.com/card/your-slug`. It
holds your photo, name, role, company, contacts, social links, a short bio,
and call-to-action buttons (call, email, save contact (vCard), WhatsApp,
share). You design it in a wizard with live preview, you can publish it
public or private, and you can also **print a real card** — front and back,
300 DPI — with your QR on it.

**What a normal user does with it:**

- **Freelancers** — share your card by QR, by link, by AirDrop, or by NFC
  tag. Update your role, company, or LinkedIn anytime — the printed card
  never goes stale.
- **Sales / business development** — one card, one QR, one URL — works on
  email signatures, Zoom backgrounds, LinkedIn banners, print, and badges.
- **Doctors / specialists** — patients save your contact instantly; you
  can update office addresses / hours without reprinting cards.
- **Real-estate agents** — every yard sign and brochure carries your
  digital card QR → instant contact save + Google Maps to your office +
  WhatsApp.
- **Conference attendees** — replace paper-card stacks with a single QR
  badge. Everyone you meet saves your vCard with one tap.
- **Job seekers** — résumé header carries the QR → live portfolio, GitHub,
  LinkedIn, downloadable CV, "book intro call" button.
- **Tradespeople (plumbers, electricians, carpenters)** — sticker QR on
  the van + invoices + receipts → instant save-as-contact + WhatsApp +
  Google reviews + "book a job".
- **Realtors, lawyers, accountants** — printed card has a QR that opens
  a polished mini-website with services, contacts, calendar, testimonials.

#### C.2 AR Digital Business Card (the flagship "8thWall" experience)
**What it is:** A traditional printed business card + a **WebAR
experience**. The recipient scans the QR, points their phone camera at the
printed card, and your **vertical intro video plays as a 3D holographic
plane that pops out of the card** — using 8th Wall's image-tracking. No
app to install. It runs in the browser.

**Technically:** the QR points to `/ar/:campaignId`. The AR engine fetches
your campaign, loads your card image as a tracking target and your video
from Cloudinary, and Three.js + GSAP animate the video plane onto the
detected card.

**What a normal user does with it:**

- **Founders / executives** — instead of saying what you do, your card
  *plays a 20-second pitch* that floats off the card in 3D. Memorable
  in a way paper cards literally can't be.
- **Real-estate agents** — the card becomes a walking property reel.
  Hand it over, they scan, your highlight reel plays right above the
  card.
- **Performers (musicians, actors, dancers, DJs)** — the card plays
  your showreel. Casting directors, venue managers, agents see your
  work the moment they hold your card.
- **Wedding / event photographers** — your card plays a 30-second
  highlight reel of your best work.
- **Coaches / influencers / authors** — short personal-brand video.
  Cards become an icebreaker conversation in any networking event.
- **Trade-show / conference networking** — your card outshines every
  paper card in the room.
- **High-end retail / luxury brands** — packaging insert becomes a
  holographic brand film, no app required.
- **Restaurants** — chef's intro video pops out of the loyalty card.
- **Universities / admissions** — dean / student-life video pops out of
  the recruitment card.

---

## 6. Cross-cutting features that apply to every campaign

These are bonuses you get no matter which campaign type you pick.

1. **Beautiful QR design.** Colors, gradients, dot styles, frame styles,
   embedded logo — your QR can match your brand.
2. **Drafts & auto-save.** The digital business card wizard saves to
   localStorage so a refresh / dropped connection never loses your work.
3. **Live preview.** Side-by-side preview updates as you type.
4. **Print mode for digital cards.** Front and back render at 300 DPI as
   downloadable PNGs ready for a print shop.
5. **Status control.** Every campaign can be `draft`, `active`, or
   `paused`. Pause a QR mid-flight and it serves a clean "paused" notice
   instead of redirecting.
6. **Soft delete.** Deleting a campaign is reversible; assets are purged
   only after a grace period.
7. **Per-device sessions.** Log in on phone + laptop simultaneously. Log
   out everything at once when needed.
8. **Secure tokens.** Access tokens in memory, refresh tokens in httpOnly
   cookies. We do not put JWTs in localStorage.
9. **Privacy-respecting precise location.** If you enable precise geo
   analytics, the visitor is asked first via the browser's geolocation
   prompt. No silent tracking.
10. **Mobile-first destinations.** Every hub page is mobile-perfect —
    that's where 95%+ of QR scans actually happen.

---

## 7. A typical end-to-end story (so it all clicks)

> *Aarav is a freelance interior designer. He prints 200 business cards in
> September.*

1. He logs into Phygital, picks **AR Digital Business Card**.
2. He uploads a photo of his printed card design (the image we'll
   "track") and a 20-second vertical reel of his best projects.
3. The platform generates a QR. He sends it to the printer along with
   the card design.
4. October — he hands one to a prospective client. The client scans the
   QR, points the phone at the card. The reel pops out as a hologram.
   The client saves Aarav's contact via the AR card's "Save Contact"
   button.
5. In November, Aarav also creates a **Multiple Links QR** for his
   Instagram bio link → portfolio, Behance, WhatsApp, bookings.
6. December — he wants to push his "new-year offer". He doesn't reprint
   anything. He just creates a **Single Link QR** and points it at the
   offer page. He pastes that QR into all his digital invoices, posters
   in his office, and his email signature.
7. January — the offer is over. He re-points the same single-link QR to
   his contact page. The printed materials carrying that QR keep working.
8. All along, his analytics dashboard shows him exactly which campaigns,
   on which days, from which cities, on which phones, are actually
   converting.

**That is what this platform unlocks.** Print once. Update forever. See
everything. No apps. No friction.

---

## 8. Tech foundation (for the curious)

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + Tailwind v3 + Framer Motion |
| Charts | Recharts |
| State | Zustand (persist for theme; auth tokens kept in memory) |
| HTTP | Axios with JWT interceptors |
| Backend | Node.js + Express 4 + MongoDB Atlas + Mongoose 8 |
| Auth | JWT access (15m) + Refresh token (7d, httpOnly cookie) + per-device sessions |
| Media | Cloudinary (images, videos, thumbnails, raw docs) |
| AR | 8th Wall WebAR + Three.js + GSAP |
| Deploy | Vercel (client), Render/Railway (server), MongoDB Atlas |

Repo layout (monorepo):

```
PhygitalEightThWall/
├── client/      React SPA — dashboard + marketing site + hub pages
├── server/      Express REST API + redirect engine + analytics
├── ar-engine/   8th Wall + Three.js WebAR experience
└── docs/        Architecture documentation
```

---

## 9. TL;DR

- **Phygital = print → scan → rich digital experience + analytics.**
- All QRs are **dynamic**: you can edit the destination forever, the
  printed QR never changes, and every scan is tracked.
- **6 campaign types** cover almost every real-world use case:
  Links+Video, Links+Doc+Video, Single Link, Multiple Links, Digital
  Business Card, and the flagship **AR Digital Business Card** (hologram
  pops out of the card via WebAR, no app needed).
- Anyone with something to print — freelancers, agencies, restaurants,
  realtors, doctors, photographers, musicians, salons, schools, brands —
  gets a measurable, updatable, beautiful bridge from paper to the web.
