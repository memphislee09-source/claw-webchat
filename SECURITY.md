# Security Policy

## Supported Versions

Security fixes are currently expected on the latest `0.1.x` mainline.

| Version | Supported |
| --- | --- |
| `0.1.x` | Yes |
| `< 0.1.0` | No |

## Deployment Assumptions

Claw WebChat is currently intended for:
- local machine usage
- trusted private network usage
- Tailscale or equivalent controlled access

It is not designed as a hardened public-internet, multi-tenant service.

Before exposing it more broadly, read [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md).

## Reporting A Vulnerability

Please avoid posting full undisclosed vulnerability details in a public issue.

Preferred process:
1. Open a private GitHub security advisory if that option is available for this repository.
2. If private advisory flow is not available, open a minimal public issue without exploit details and ask the maintainer for a private handoff channel.
3. Include affected version, deployment shape, reproduction boundaries, and impact summary.

Please do not include:
- private keys
- tokens
- local filesystem paths that reveal sensitive personal data
- uploaded user media
- full agent transcripts containing private content

## Security Priorities

The highest-priority security areas for this project are:
- local media proxy boundaries
- signed media token handling
- accidental exposure through overly broad deployment
- unsafe assumptions around uploaded files and shell tooling
- keeping WebChat-side behavior aligned with the operator's OpenClaw trust boundary instead of inventing a second document-access model

## Hardening Guidance

If you operate this service yourself:
- keep it behind a trusted access layer
- keep the default loopback bind unless you intentionally need LAN access
- if you enable LAN access, strongly consider also enabling the built-in light authentication
- remember that document access scope follows your current OpenClaw configuration
- do not expose it directly to the public internet without additional controls
- keep the host machine and OpenClaw CLI updated
- rotate any custom secrets if you suspect exposure
