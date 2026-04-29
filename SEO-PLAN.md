# SEO Plan — hg-au.com

Reference doc for the SEO work on the Holistic Governance website. Written 2026-04-28 with edits made by Naomi + Claude Code. Update this file whenever the situation materially changes.

## Source-of-truth values (NAP)

| Field | Value | Where it lives |
|---|---|---|
| Name | Holistic Governance | Site brand, GBP, schema |
| Suburb | Heidelberg | Footer + JSON-LD `addressLocality` |
| Region | Victoria, Australia | Footer + JSON-LD `addressRegion` / `addressCountry: AU` |
| Phone | 0405 515 300 | Site footer + GBP |
| Website | https://hg-au.com | GBP, all directories |
| Email | enquiries@hg-au.com | Site, GBP |
| Personal LinkedIn | https://www.linkedin.com/in/naomi-alefelder | Person.sameAs in `about.html` |
| Company LinkedIn | https://www.linkedin.com/company/hg-au/ | Organization.sameAs site-wide |
| Founder | Naomi Alefelder | Person schema + visible bylines |

---

## Status snapshot (as of 2026-04-28)

| Area | State |
|---|---|
| Domain mismatch | ✅ Resolved — site published at `hg-au.com`, all canonicals/OG/sitemap consistent |
| Person/Organization schema with `@id` and verified `sameAs` | ✅ |
| Article schema → Person author linked to About entity | ✅ |
| Visible article bylines align with schema | ✅ |
| Dashboard auto-generates article HTML | ✅ |
| Footer NAP address (suburb-level) site-wide | ✅ |
| BreadcrumbList schema on About / Solutions / Resources / Privacy | ✅ |
| Google Business Profile claimed + 1 review | ✅ |
| Search Console verified | ✅ |
| 10 URLs Request Indexing | ⏳ Manual — see todo |
| GBP → service-area mode + complete profile | ⏳ Manual — see guide below |
| 3+ Google reviews | ⏳ Manual — see guide |
| Backlinks (current ≈ 0) | ⏳ Ongoing — Tier 1 first |
| Content cadence (1 article every 2 weeks) | ⏳ Calendar drafted |

---

## Outstanding todos

### Critical — this week

- [ ] Open Google Search Console → URL Inspection → "Request Indexing" for each of these 10 URLs:
  - `/about.html`, `/healthcare.html`, `/resources.html`, `/proposal-enquiry.html`
  - All 6 article pages currently in "Discovered – currently not indexed"
- [ ] Flip GBP to service-area mode (hide street, add service areas)
- [ ] Complete GBP profile: categories, description, services, photos, hours, Q&A
- [ ] Ask 2–3 past clients for Google reviews

### High priority — next 4 weeks

- [ ] Tier 1 backlinks (AICD, alumni, association memberships, Crunchbase / Apollo / ZoomInfo)
- [ ] Optimise LinkedIn personal profile (headline, About, contact info)
- [ ] Optimise LinkedIn company page (location, tagline with keywords)
- [ ] Publish first article from the calendar (12 May 2026)

### Ongoing

- [ ] One article every 2 weeks per the content calendar
- [ ] Tier 2 backlinks (guest posts, podcast appearances)
- [ ] Quarterly: review backlink count + branded search visibility

---

## Google Business Profile — service-area + completion guide

### A. Hide the street, add service areas
1. business.google.com → Holistic Governance → Edit profile → Location
2. Toggle "Show business address to customers" → OFF
3. Service areas → Add: Heidelberg, Melbourne, Victoria, Sydney NSW, Brisbane QLD, Adelaide SA, Perth WA, Hobart TAS, Canberra ACT, Darwin NT (NZ if Google permits)
4. Save

### B. Categories
- Primary: Health consultant *(or Business management consultant)*
- Secondary (up to 9): Business management consultant, Risk management firm, Healthcare consultant, Software consultant *(if relevant)*

### C. Description (646 chars — paste as-is)

> Holistic Governance is a specialist clinical governance, risk and data consultancy for healthcare, aged care and disability providers across Australia and New Zealand. Founded by Naomi Alefelder in Heidelberg, Victoria, we help boards and executives strengthen assurance frameworks, simplify NSQHS and Aged Care Quality Standards compliance, and turn fragmented operational data into board-ready insight. Services include clinical governance reviews, NSQHS readiness, aged care audits, AI governance frameworks, FHIR interoperability advisory, and Power BI dashboards. Servicing clients remotely across Australia and New Zealand, with on-site delivery available in Victoria and surrounding states.

### D. Services

Add via Edit profile → Services → + Add service. Each gets a name + 250-char description. Don't set prices (leave blank).

#### Top 8 — definitely add

| # | Service name | Description |
|---|---|---|
| 1 | Clinical Governance Review | Independent review of your organisation's clinical governance framework — board oversight, accountability, risk and quality assurance — with practical recommendations to strengthen safeguards and meet regulatory expectations. |
| 2 | NSQHS Standards Readiness Assessment | Pre-survey gap analysis against the National Safety and Quality Health Service Standards (Second Edition), including mock surveys, interview coaching, and remediation plans for hospitals and day procedure services. |
| 3 | Aged Care Quality Standards Compliance Audit | Detailed audit against the Strengthened Aged Care Quality Standards. Includes evidence review, on-site or remote assessment, and a prioritised action plan for residential, home care, and respite providers. |
| 4 | Aged Care Act 2024 Compliance Support | End-to-end support for the new Aged Care Act 2024 — gap analysis, governance updates, board briefings, policy revisions, and ongoing assurance to keep your organisation compliant under the new regime. |
| 5 | AI Governance Advisory | AI governance frameworks tailored to healthcare, aged care and disability providers. Includes AI risk assessments, responsible AI policy design, model oversight, and integration with existing risk and quality systems. |
| 6 | Data Governance Framework Development | Build a fit-for-purpose data governance framework covering data ownership, quality, privacy, lifecycle and reporting — designed to meet healthcare regulatory expectations and AI readiness. |
| 7 | Power BI Board Reporting Dashboards | Custom Power BI dashboards that turn fragmented operational data into board-ready insight — quality indicators, risk registers, incident trends, complaints, workforce metrics, and compliance status. |
| 8 | Risk Management Framework Design | ISO 31000-aligned enterprise risk management frameworks for healthcare and regulated organisations. Includes risk register design, control mapping, and embedding risk into board reporting. |

#### Optional 4 — add when time permits

| # | Service name | Description |
|---|---|---|
| 9 | Quality Indicator Program (QI) Reporting Support | Practical support for the Aged Care Quality Indicator Program 4.0 — data collection, reporting, validation, and using QI data to drive quality improvement rather than tick-box compliance. |
| 10 | FHIR Interoperability Advisory | Strategic and technical advisory on FHIR (Fast Healthcare Interoperability Resources) for digital health and aged care providers planning system integration, data sharing, or My Health Record alignment. |
| 11 | Board & Executive Governance Coaching | One-on-one and group coaching for boards, CEOs, and senior executives on clinical and corporate governance, accountability, regulatory engagement, and translating data into confident decisions. |
| 12 | Policy and Procedure Development | Development and review of clinical, quality, and governance policies aligned to NSQHS, Aged Care, NDIS, and ISO standards — with version control, review schedules, and embedding plans. |

**Tips:**
- Service names use search-optimised phrasing (e.g., "NSQHS Standards Readiness Assessment" matches what providers actually search for)
- Descriptions naturally include keywords (NSQHS, Aged Care Act, FHIR, etc.) without keyword-stuffing
- A profile with 10+ services often outranks competitors with 0–3, even at similar review counts
- You can edit/reorder later; start with the 8 then add the optional 4 next session

### E. Photos (min 3)
Logo, headshot, professional desk/office, plus optionally a redacted dashboard screenshot

### F. Hours
Mon–Fri 9 am – 5 pm; add public holiday special hours as they come up

### G. Q&A — seed it
Open profile in regular Google search → "Ask a question" → post + answer 3:
- "Do you work with aged care providers under the new Aged Care Act 2024?"
- "Can you help us prepare for NSQHS accreditation?"
- "Do you support digital health and FHIR-based integration projects?"

### H. Reviews — template ask
> Hi [Name], hope you're well. We've just set up our Google Business Profile and a short review from someone we've worked with would mean a lot. Takes 30 seconds: [paste review URL]. Only if you have a moment — no pressure at all. Thanks, Naomi.

---

## Content calendar — 12 articles over 6 months

| # | Publish | Title | Primary keyword | Length |
|---|---|---|---|---|
| 1 | 12 May 2026 | Aged Care Act 2024: 90-Day Compliance Checklist for Providers | "Aged Care Act 2024 compliance" | 2,000 |
| 2 | 26 May 2026 | NSQHS 2nd Edition Gap Analysis: A Free Template for Hospitals | "NSQHS gap analysis template" | 2,500 + downloadable |
| 3 | 9 Jun 2026 | Clinical Governance vs Corporate Governance: What Boards Confuse and Why It Matters | "clinical governance vs corporate governance" | 1,500 |
| 4 | 23 Jun 2026 | AI Governance for Aged Care: A Provider's Practical Framework | "AI governance aged care" | 2,000 |
| 5 | 7 Jul 2026 | NDIS Practice Standards vs NSQHS: A Comparison for Cross-Sector Providers | "NDIS vs NSQHS comparison" | 1,800 |
| 6 | 21 Jul 2026 | Quality Indicator Program 4.0: What Changed and How to Report It | "Quality Indicator Program 4.0" | 1,500 |
| 7 | 4 Aug 2026 | Why Aged Care Boards Get Clinical Governance Wrong | "aged care board clinical governance" | 2,000 |
| 8 | 18 Aug 2026 | The 7 Power BI Reports Every Aged Care Board Should See Monthly | "aged care board reporting Power BI" | 1,800 |
| 9 | 1 Sep 2026 | FHIR for Aged Care Providers: Why You Should Care About Interoperability Now | "FHIR aged care" | 1,800 |
| 10 | 15 Sep 2026 | Strengthened Aged Care Quality Standards: 12 Months In | "Strengthened Aged Care Quality Standards review" | 2,000 |
| 11 | 29 Sep 2026 | Building a Risk Register That Actually Drives Decisions | "risk register aged care" | 1,500 |
| 12 | 13 Oct 2026 | The State of Clinical Governance in Australian Aged Care 2026 (Original Research) | "clinical governance Australia 2026" | 4,000 + survey data |

### Article writing rules
- 1,500–2,000 words minimum (except #2, #12)
- Always link internally to `/healthcare.html` and `/about.html` with descriptive anchor text
- One strong CTA at the end ("Need help with X? Request a proposal.")
- Promote on LinkedIn personal + company within 24 hours of publishing
- Each gets full schema treatment automatically via `build-articles.js`

---

## Backlinks — tiered targets

### Tier 1 — Easy wins (this week)
1. AICD member directory — ensure `hg-au.com` is on profile
2. University alumni profile — submit success story
3. Professional association pages (RACMA, ACHSM, AHIA, ACAA, GAICD)
4. LinkedIn personal — `hg-au.com` in About / Featured / activity posts
5. Crunchbase, Apollo, ZoomInfo — claim free listings

### Tier 2 — Medium effort (this month)
6. **Australian Ageing Agenda** (australianageingagenda.com.au) — pitch guest article
7. **Hello Care** (hellocaremail.com.au) — pitch comment piece
8. **Inside Ageing** (insideageing.com.au) — submit op-ed
9. **Australian Hospital + Healthcare Bulletin** (hospitalhealth.com.au) — pitch article
10. **SourceBottle.com.au** — sign up, respond to journo requests
11. Podcast appearances (3 targets: Aged Care Insider, Healthcare Reform Australia, Boardroom Confidential)

### Tier 3 — Big bets (this quarter)
12. Original research / industry report — see article #12
13. Mainstream media exclusive timed with report launch (AFR, HelloCare, AAA)
14. Conference speaking (LASA / Ageing Australia / ACSA)
15. University guest lecture (Deakin, Monash, La Trobe — public health / health management)

### Guest post pitch template
> **Subject:** Guest article: [topic] for [publication]
>
> Hi [editor name],
>
> I'm Naomi Alefelder, founding director of Holistic Governance — a clinical governance and aged-care risk consultancy in Victoria.
>
> I'd like to pitch a [800/1,500] word guest article on **[topic]**, aimed at [your readers].
>
> Outline:
> 1. [Punchy opening point]
> 2–4. [Practical takeaways]
> 5. [What providers should do this quarter]
>
> Background: [one sentence credentials].
>
> Happy to discuss angle or send a draft on spec.
>
> Best,
> Naomi Alefelder
> hg-au.com | enquiries@hg-au.com | 0405 515 300

### Tracking
- Ahrefs Webmaster Tools (free for verified site owners) — weekly
- Google Search Console → Links — coarse but free
- 6-month goal: 30 backlinks from 15+ unique domains

---

## Scheduled check-in

A one-time agent is scheduled to fire on **2026-05-05 09:00 AEST** to check indexing progress and confirm next steps. Manage at https://claude.ai/code/routines/trig_01KeRhAzLfJ1MoB6zJfSLUEw

---

## Commits log (this session)

| Commit | What |
|---|---|
| `7036f79` | Person schema @id + sameAs, Organization sameAs to /company/hg-au/, Article author = Person, dashboard generates HTML on save |
| `007c181` | Heidelberg footer address site-wide + addressLocality in JSON-LD |
| *(this commit)* | BreadcrumbList schema on About / Solutions / Resources / Privacy + this plan doc |
