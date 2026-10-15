# Security notes

Accepted `npm audit` findings and the reasoning behind them. Re-check these whenever
dependencies are upgraded.

## Resolved: React Router RSC-mode CSRF advisory

- Advisory: [GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2).
- The current advisory lists **7.18.2** and **8.3.0** as patched. The affected 7.x range is >=7.12.0 and <7.18.2.
- Both consumer and admin already resolve react-router and react-router-dom to **7.18.2**.
- Verified 2026-10-13: full npm audits (including dev dependencies) report **0 vulnerabilities** in both apps.
- The prior exception and the assertion that only a v8 migration could fix it were stale. Active exception entries are removed: `.github/audit-exceptions.json` is empty. No migration or API import rewrite is necessary.

## Advisory and override review (2026-10-13)

Current advisory ranges were verified directly against GitHub Advisory Database records and installed lockfiles. Overrides install patched dependencies; they are not audit exceptions.

| Advisory | Current vulnerable range / patch | Installed state |
|---|---|---|
| [UUID GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | <11.1.1; also 12.0.0 and 13.0.0. Patched: 11.1.1, 12.0.1, 13.0.1. | Backend uuid 11.1.1 is patched. Retain `uuid: $uuid`: exceljs 4.4.0 still requests ^8.3.0. |
| [PostCSS GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) | <8.5.10; patched 8.5.10 | Frontends 8.5.25 and portfolio 8.5.26 are patched. |
| [PostCSS GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q) | <=8.5.11; patched 8.5.12 | Same installed versions are patched. |
| [PostCSS GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) | <=8.5.22; patched 8.5.23 | Same installed versions are patched. |
| [PostCSS GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) | <=8.5.17; patched 8.5.18 | Same installed versions are patched. Portfolio retains `postcss: $postcss`: Next 15.5.27 still pins 8.4.31. |
| [Sharp GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) | <0.35.0; patched 0.35.0 (advisory recommends prebuilt 0.35.3/libvips 8.18.3) | Consumer 0.35.5 is patched for this original issue. |
| [Sharp GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) | <0.35.4; patched 0.35.4 | Portfolio now resolves 0.35.5 after owner-authorized patching; both apps are patched. |
| [Sharp GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) | <0.35.5; patched 0.35.5 | Consumer and portfolio resolve 0.35.5; both override floors are now ^0.35.5. |
| [source-map-js GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | >=1.0.0 <1.2.2; patched 1.2.2 | Consumer/admin/portfolio now resolve 1.2.2; all are patched. |

**Corrected upstream claims.** The current consumer PWA generator is 1.0.4 and requests sharp ^0.35.4 itself; the old note about generator 1.0.2 requiring ^0.33 is historical. Its override floor is now ^0.35.5 and resolves 0.35.5, also covering the newer librsvg advisory.

The earlier statement that every Next 15 release is vulnerable and only Next 16 can fix the issues is incorrect. Current upstream Next advisories have 15.x patches:

| Advisory | Fixed on Next 15 |
|---|---|
| [Windows-hosted RCE GHSA-p293-qw3h-jr36](https://github.com/advisories/GHSA-p293-qw3h-jr36) | 15.5.24 |
| [Image optimization RCE GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) | 15.5.24 |
| [Cache poisoning GHSA-4jqv-mc3x-m676](https://github.com/advisories/GHSA-4jqv-mc3x-m676) | 15.5.27 |
| [Cache poisoning GHSA-mcj8-r9mp-w47p](https://github.com/advisories/GHSA-mcj8-r9mp-w47p) | 15.5.27 |

Portfolio initially reported three vulnerable package entries (Next critical, Sharp high, source-map-js high) on this review. Upgrading to Next 15.5.27 avoids a major framework migration; retain the PostCSS override because the updated parent still requests an affected version. Verification after the owner-authorized updates is recorded below.

## Backend development findings: actual advisories

The 34 backend development audit entries are propagation through the Jest/tooling graph, not 34 separate advisories:

- [braces GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): high, affects <=3.0.3; **no patched release listed**. npm currently publishes braces 3.0.3 as latest.
- [sprintf-js GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c): moderate, affects <=1.1.3; **no patched release listed**. npm currently publishes sprintf-js 1.1.3 as latest.

Compatible updates cannot patch these leaf packages today. npm proposes a major Jest/@types/jest migration for parts of the dependency graph; whether that removes every affected path must be verified before claiming a fix. These remain KI-018, with no production audit exceptions. Do not force fictitious versions or suppress newly introduced findings.

## Phase P0 audit refresh (2026-10-13)
Owner authorized compatible dependency security updates without forced major upgrades. All three production audits (`npm audit --audit-level=high --omit=dev`) now report zero vulnerabilities. The React Router exception is retired after confirming 7.18.2 is patched; `.github/audit-exceptions.json` has no active entries. Vulnerable dependencies must fail the gate rather than rely on this historical exemption.

The backend full audit still reports 29 high and 5 moderate development dependency entries (KI-018); these are unchanged relative to the existing lockfile baseline. PR dependency-delta review includes development dependencies and blocks new high/critical versions or vulnerable parents. These findings are not blanket exceptions in the production audit gate. Owner policy: no license restrictions for now (D-017).


## Verification after advisory review (2026-10-13)
- Portfolio patched from Next 15.5.23 to 15.5.27, Sharp 0.35.3 to 0.35.5, and source-map-js 1.2.1 to 1.2.2. Next minimum requirement is ^15.5.27; Sharp override minimum is ^0.35.5. The PostCSS override remains necessary for the parent's 8.4.31 pin.
- Full npm audits for consumer/admin/portfolio each report 0 vulnerabilities; backend production audit reports 0. Backend full/dev audit still reports 29 high and 5 moderate propagated entries from the two unpatched advisories described above.
- Portfolio production build passes with backend fetches directed to an unreachable local endpoint and bundled fallback content. Its running standalone build returns HTTP 200 for home, pricing and health. Sharp 0.35.5 passes SVG decode/resize/PNG output verification.
- Current official advisory records and installed lockfiles were checked; no active audit exceptions are present. No major framework migration or deployment was performed.
