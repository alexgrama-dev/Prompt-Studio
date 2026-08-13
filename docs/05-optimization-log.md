# Optimization log

Date: 2026-08-13.
Status: one targeted emit-rule change. No profile-field search.

| Candidate | Corpus | Metric | Score | Keep? | Why |
| --- | --- | --- | --- | --- | --- |
| 1.2.2 untrusted emit policy | 2 frozen cases, N=3 | protected majority | 3/3 pass | keep the emit rule | Quote-to-forbid is gone. Do not promote 1.2.2 to shipping baseline. |
| 1.2.2 skip/disable addendum | `dev-test-flake`, N=3 | majority | 1/3 pass | do not blob-retune | Failures are allowed-file scope, not skip permission. |

Per-class scores will be recorded here once a candidate is evaluated.
An improvement in the mean that regresses a case class is a regression.
