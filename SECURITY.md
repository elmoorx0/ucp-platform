# Security Policy

## Supported Versions

We actively support the following versions of UCP with security updates:

| Version | Supported          |
|---------|--------------------|
| 1.4.x   | ✅ Current         |
| 1.3.x   | ✅ Supported       |
| < 1.3   | ❌ Not supported   |

---

## Reporting a Vulnerability

We take security bugs seriously. Thank you for improving the security of UCP.
We appreciate your efforts and responsible disclosure and will make every
effort to acknowledge your contributions.

### How to Report

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please report vulnerabilities via one of these methods:

1. **Preferred**: Email security concerns to the maintainers privately
2. **GitHub Security Advisory**: Use GitHub's private vulnerability reporting:
   - Go to https://github.com/elmoorx0/ucp-platform/security/advisories/new
   - Click "Report a vulnerability"

### What to Include

Please include the following in your report:

- **Description** of the vulnerability
- **Steps to reproduce** (proof of concept)
- **Affected versions** (if known)
- **Potential impact** (what an attacker could do)
- **Suggested fix** (if you have one)
- **Your name/handle** for credit (optional)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Fix or mitigation**: Within 30 days (severity-dependent)
- **Public disclosure**: After fix is released, typically 90 days

### Disclosure Policy

- We follow **responsible disclosure**
- We will credit you in the security advisory (unless you prefer to remain anonymous)
- We request that you do not publicly disclose the vulnerability until we have
  released a fix

---

## Security Measures

UCP implements the following security measures:

### Authentication & Authorization

- **JWT-based authentication** for dashboard users
  - Signed with HMAC-SHA256
  - 7-day expiration
  - Stored in HTTP-only cookies
- **API Key authentication** for programmatic clients
  - Scrypt-hashed (memory-hard, resistant to brute force)
  - Scoped permissions (e.g., `notifications:send`, `devices:register`)
  - Configurable rate limits per key
  - Rotation without downtime

### Data Protection

- **Passwords**: hashed with scrypt (salt + key stretching)
- **API keys**: hashed with scrypt before storage
- **API key secrets**: never stored in plaintext — only shown once at creation
- **Webhook signatures**: HMAC-SHA256 with constant-time comparison
- **Internal API tokens**: used for service-to-service authentication

### Request Security

- **Rate limiting**: per-API-key sliding window (default 1000 req/min)
- **CORS**: configurable per route
- **Input validation**: all API requests validated via TypeScript + Zod
- **SQL injection**: prevented via Prisma ORM (parameterized queries)
- **XSS**: React's built-in escaping + Content-Security-Policy headers

### Infrastructure

- **Database**: Turso (libSQL) with TLS encryption in transit
- **Vercel**: HTTPS by default, DDoS protection, WAF
- **Gateway**: isolated service, internal API token required
- **Environment variables**: secrets never committed to git

---

## Security Best Practices for Deployments

When deploying UCP, follow these best practices:

### 1. Generate Strong Secrets

```bash
# Generate secure secrets for production
openssl rand -base64 48  # JWT_SECRET (min 32 chars)
openssl rand -base64 32  # API_KEY_HASH_SECRET
openssl rand -base64 32  # INTERNAL_API_TOKEN
```

### 2. Use HTTPS Everywhere

- Vercel provides HTTPS by default
- For self-hosted: use Let's Encrypt or Cloudflare
- Never allow HTTP for production

### 3. Rotate API Keys Regularly

- Use the rotation endpoint every 90 days
- `POST /api/v1/api-keys/rotate`
- Old keys are immediately invalidated

### 4. Monitor for Suspicious Activity

- Monitor the Audit Log (`/api/dashboard/audit`)
- Set up alerts for:
  - Multiple failed authentication attempts
  - Unusual API key usage patterns
  - Rate limit violations

### 5. Restrict Network Access

- Gateway: only allow Next.js API to call `/internal/*` endpoints
- Database: use Turso's IP allowlist feature
- Dashboard: consider IP allowlisting for admin access

### 6. Keep Dependencies Updated

```bash
# Check for vulnerable dependencies
bun audit

# Update to latest safe versions
bun update
```

### 7. Use Scoped API Keys

- Never use `scopes: ['*']` in production
- Grant only the permissions needed:
  - `notifications:send` — for sending
  - `devices:register` — for device registration
  - `notifications:read` — for reading status

---

## Known Security Considerations

### SQLite in Production

- **Local SQLite files** are not encrypted at rest
- For production: use **Turso** (encrypted at rest, TLS in transit)
- Or use a self-hosted SQLite with LUKS/full-disk encryption

### Webhook Verification

- Clients MUST verify the `X-UCP-Signature` header
- Failure to verify allows attackers to forge webhook deliveries
- Use constant-time comparison (provided in the SDK)

### Internal API Token

- The `INTERNAL_API_TOKEN` is shared between Next.js and the Gateway
- If compromised, an attacker can push arbitrary messages
- Rotate immediately if suspected compromised
- Use different tokens per environment (dev/staging/prod)

---

## Security Checklist for Production

- [ ] All secrets generated with `openssl rand`
- [ ] `DATABASE_URL` uses `libsql://` (Turso) with `?authToken=`
- [ ] HTTPS enforced (Vercel does this automatically)
- [ ] API keys use scoped permissions (not `*`)
- [ ] Webhook URL is HTTPS
- [ ] `INTERNAL_API_TOKEN` is unique per environment
- [ ] Rate limiting enabled (default 1000/min)
- [ ] Audit log monitoring set up
- [ ] Dependencies audited with `bun audit`
- [ ] API key rotation scheduled (every 90 days)

---

## Contact

For security-related questions (non-vulnerability):
- Open a discussion: https://github.com/elmoorx0/ucp-platform/discussions

For vulnerability reports:
- Use GitHub Security Advisories (preferred)
- Or contact maintainers privately

---

## Acknowledgments

We thank all security researchers who responsibly disclose vulnerabilities.
Contributors will be acknowledged in:
- Security advisories
- Release notes
- The README (if they wish)

---

*This security policy is reviewed and updated regularly.*
