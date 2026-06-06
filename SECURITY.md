# Security Policy

**DIRD+ — Diabetic Imaging Retinopathy Detector**

We take the security of DIRD+ seriously. This document describes how to report vulnerabilities and what to expect after submitting a report.

## Supported versions

| Version | Supported |
|---------|-----------|
| 2.0.x   | ✅ Yes — active development |
| 1.x.x   | ⚠️ Security fixes only |
| < 1.0   | ❌ No — please upgrade |

We strongly recommend running the latest released version.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub Issues.** Public issues can be read by anyone, and disclosing a vulnerability before it is patched puts every user at risk.

Use one of the private channels below instead.

### Preferred: GitHub Security Advisories

1. Go to https://github.com/Debaq/Dird/security/advisories
2. Click **"Report a vulnerability"**
3. Fill in the form with the details requested in the **Report contents** section below

This creates a private advisory that only project maintainers can see. It also gives us a structured way to collaborate on a fix with you.

### Alternate: Email

If you cannot use GitHub Security Advisories for any reason, send an email to:

**davil004@gmail.com**

Use the subject line: `[SECURITY] DIRD+ vulnerability report`

We will respond within 5 business days.

## Report contents

A useful vulnerability report includes:

- **Type of vulnerability** (e.g., authentication bypass, data exposure, code injection, cryptographic flaw)
- **Component affected** (e.g., `dird-importer.ts`, ONNX model loader, encryption module, Tauri command, desktop build)
- **DIRD+ version** where you observed the issue
- **Environment** (operating system, DIRD+ version)
- **Step-by-step reproduction**: how to trigger the issue
- **Observed impact**: what an attacker can do
- **Proposed mitigation** (if you have one — not required)
- **Public disclosure timeline preference** (default: 90 days)

A proof-of-concept is welcome but not required.

## Our commitments

When you report a vulnerability:

1. **Acknowledgement within 5 business days.** We will confirm receipt of your report.
2. **Initial assessment within 14 days.** We will assess severity and indicate whether we can reproduce the issue.
3. **Regular updates.** We will send updates on the status of the fix at least every 14 days until the issue is resolved or closed.
4. **Credit.** With your consent, we will credit you in the release notes and in the security advisory.
5. **No legal action.** We will not pursue legal action against researchers who report vulnerabilities in good faith and follow this policy.

## Disclosure timeline

We follow a coordinated disclosure model:

| Phase | Typical duration |
|-------|------------------|
| Acknowledgement | ≤ 5 business days |
| Triage and severity assessment | ≤ 14 days |
| Fix development | Variable, depending on severity and complexity |
| Patch release | As soon as the fix is validated |
| Public disclosure | 90 days after initial report, OR upon patch release if sooner, OR as agreed with the reporter |

For critical vulnerabilities (CVSS ≥ 9.0), we will prioritize a release and coordinate public disclosure with the reporter.

## Scope

### In scope
- Source code in the `Debaq/Dird` repository
- Source code in the `Debaq/dird_models` repository
- Reference AI models published in `dird_models`
- Official desktop builds distributed via GitHub Releases
- The `.dird` file format specification and implementation

### Out of scope
- The project website (https://debaq.github.io/Dird/) marketing pages — unless they leak data or host malicious content
- Forks of the project maintained by third parties
- Third-party dependencies (please report those to the respective project; we will coordinate if needed)
- Issues that require physical access to an unlocked, authenticated session
- Issues that only affect outdated, unsupported versions
- Social engineering attacks against project maintainers or contributors

## What counts as a vulnerability

Examples of issues we consider in-scope vulnerabilities:

- Cryptographic flaws (weak algorithms, predictable keys, key reuse)
- Authentication or authorization bypass within the application
- Data exposure (e.g., unencrypted patient data when encryption is configured to be active)
- Insecure storage of credentials or encryption keys
- Code injection or remote code execution
- Path traversal in file handling (especially in `.dird` import/export)
- Denial of service that requires fewer resources than typical clinical use
- Cross-site scripting (XSS) inside the Tauri webview, especially via untrusted `.dird` content
- Bypass of the Tauri command allowlist or sandbox escapes from the webview to the Rust host

Examples of issues we typically do **not** consider security vulnerabilities:

- Missing best-practice headers on the marketing website
- Self-XSS that requires the user to paste attacker-controlled code into the devtools console
- Theoretical attacks with no demonstrated impact
- Issues already covered in the public ROADMAP.md
- Bugs in third-party dependencies (please report upstream)

## Hall of fame

Researchers who report valid vulnerabilities are listed here, with their consent, after the issue is resolved.

*(No reports to date — be the first!)*

## Cryptographic implementation notes

For researchers reviewing the cryptographic posture of DIRD+ v2.0+:

- **Symmetric encryption**: AES-256-GCM for file containers, AES-256 (CBC mode via SQLCipher) for the database
- **Key derivation**: Argon2id with memory cost 64 MiB, time cost 3, parallelism 4 (subject to recalibration against current OWASP guidance)
- **Random number generation**: OS-provided CSPRNG via `OsRng` (Rust host); the webview never derives crypto material directly.
- **No homemade cryptography**: all cryptographic primitives are sourced from audited libraries

We welcome scrutiny of these choices. If you believe a different primitive or parameter set is preferable, please open a GitHub Security Advisory rather than a public issue, so we can evaluate before changing defaults.

---

**Project**: DIRD+ — Diabetic Imaging Retinopathy Detector
**Maintainer**: Nicolás Baier Quezada, Universidad Austral de Chile (UACh), Puerto Montt
**License**: GNU Affero General Public License v3.0 (AGPL-3.0)
