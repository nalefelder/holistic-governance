# GCP hosting scaffold — DORMANT (work in progress)

**Status: not active. Do not expect this to deploy anything.**
The live site (`hg-au.com`) is served by **GitHub Pages** from the repo root on
`main`. This directory is a *parked* sketch of an alternative hosting path on
Google Cloud. It is committed only so the design and the keyless-CI work aren't
lost — nothing here runs today.

## What this was meant to be
A static-site deployment to **Google Cloud Storage + Cloud CDN** in
`australia-southeast1` (Sydney), driven from GitHub Actions using **keyless
Workload Identity Federation** (no service-account JSON key stored in GitHub).
Motivation: in-region Australian hosting (latency / data-residency story for
health-sector clients) and controllable cache invalidation.

## Contents
- `terraform/versions.tf` — Terraform + Google-provider version pins only. A
  commented-out GCS state backend is included but not enabled.
- `deploy-gcp.yml` — the **complete** deploy pipeline (build → WIF auth → `gsutil
  rsync` to the bucket → Cloud CDN invalidation), with an exclude list that keeps
  source/tooling/admin files (`server.js`, `admin.html`, `login.html`, build
  scripts, `.env*`, etc.) out of the public bucket.
  **It lives here, not in `.github/workflows/`, on purpose** — so GitHub does not
  run it. To activate, move it to `.github/workflows/deploy-gcp.yml`.

## Why it's parked (not finished)
For a ~2.2 MB brochure site that GitHub Pages already serves for free over
HTTPS/CDN, the GCP path adds meaningful cost and ops for marginal gain:
- Serving a custom domain over **HTTPS from GCS requires a Global External
  Application Load Balancer + managed SSL cert**; the load-balancer forwarding
  rule bills a **baseline ~US$18–25/month regardless of traffic** (GCS storage/
  egress for this site is ~$0).
- It introduces Terraform state, GCP IAM, cert-renewal monitoring, and a live DNS
  cutover to maintain.

Revisit only if a concrete driver appears: a client/contractual **AU
data-residency requirement**, **consolidation** onto GCP alongside the admin app
(unified IAM/billing), or **header/redirect/caching control** Pages can't provide.

## What's missing to make it work
1. GCP project + billing; choose project id / region.
2. Terraform `main.tf` + `variables.tf` creating: GCS bucket (website config),
   backend bucket, **global external HTTPS load balancer**, **managed SSL cert**
   for hg-au.com, URL map, Cloud CDN toggle.
3. WIF wiring: workload identity pool + provider + deployer service account, plus
   the repo-level Actions **Variables** the workflow reads
   (`GCP_PROJECT_ID`, `GCS_BUCKET`, `GCP_URL_MAP`, `WIF_PROVIDER`,
   `GCP_DEPLOYER_SA`).
4. Enable the Terraform GCS state backend in `versions.tf` (create the state
   bucket first).
5. Move `deploy-gcp.yml` into `.github/workflows/` (note: committing a workflow
   file needs the `workflow` OAuth scope).

## Safe activation order (if resumed)
Write Terraform → `terraform apply` in a throwaway/staging project → set Actions
Variables → move the workflow into `.github/workflows/` → run it against a
**staging** bucket/URL and verify → only then do the DNS cutover for hg-au.com and
**disable GitHub Pages** so the two deploy paths don't diverge.
