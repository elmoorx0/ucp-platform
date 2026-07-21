# Contributing to UCP

First off, thank you for considering contributing to UCP! 🎉

This document outlines how to contribute to the Universal Communication Platform project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Adding New Providers](#adding-new-providers)
- [Adding New Templates](#adding-new-templates)
- [Testing](#testing)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)

---

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please be respectful and inclusive.

---

## Getting Started

### Prerequisites

- **Node.js 18+** or **Bun** (recommended)
- **Git**
- A GitHub account

### Setup

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/YOUR_USERNAME/ucp-platform.git
cd ucp-platform

# Install dependencies
bun install

# Install Gateway dependencies
cd mini-services/realtime-gateway && bun install && cd ../..

# Set up local SQLite database
cp .env.example .env
bun run db:push

# Start the Gateway (terminal 1)
bun run gateway

# Start Next.js (terminal 2)
bun run dev

# Open http://localhost:3000 and click "Seed Demo Data"
```

---

## Development Workflow

### 1. Create a Branch

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-number-description
```

Branch naming conventions:
- `feature/` — new features (e.g., `feature/twilio-provider`)
- `fix/` — bug fixes (e.g., `fix/webhook-signature-verification`)
- `docs/` — documentation changes (e.g., `docs/update-readme`)
- `refactor/` — code refactoring (e.g., `refactor/notification-service`)
- `test/` — adding tests (e.g., `test/notification-service`)

### 2. Make Changes

- Follow the [coding standards](#coding-standards)
- Add tests for new functionality
- Update documentation as needed
- Keep commits focused and atomic

### 3. Commit Changes

We use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: add Twilio SMS provider"
git commit -m "fix: webhook signature verification timing attack"
git commit -m "docs: add deployment guide for Fly.io"
git commit -m "test: add notification service integration tests"
git commit -m "refactor: simplify retry backoff logic"
```

Types:
- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation
- `test:` — tests
- `refactor:` — code refactoring
- `chore:` — maintenance tasks
- `perf:` — performance improvements

### 4. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- Clear title following conventional commits
- Description of changes
- Link to any related issues
- Screenshots (if UI changes)

---

## Pull Request Process

1. **Ensure CI passes** — all checks must be green:
   - ESLint
   - TypeScript type-check
   - Test suite
   - Build

2. **Update documentation** — if you added a feature, update:
   - `README.md` — feature list, API endpoints
   - `DEPLOYMENT.md` — if deployment changes
   - `src/app/api/docs/route.ts` — OpenAPI spec

3. **Add tests** — new features require tests:
   - Unit tests in `src/lib/__tests__/`
   - Integration tests where appropriate

4. **Keep PRs focused** — one feature/fix per PR
   - Easier to review
   - Faster to merge
   - Clearer history

5. **Address review feedback** — respond to comments and make changes

6. **Squash commits** before merging (maintainers will handle this)

---

## Coding Standards

### TypeScript

- Use **strict typing** — avoid `any` when possible
- Use **interfaces** for object shapes, **types** for unions
- Use **enums** or **union types** for fixed values
- Prefer **named exports** over default exports

```typescript
// ✅ Good
export interface NotificationOptions {
  channel: 'push' | 'email' | 'inapp'
  title: string
  body: string
}

export function sendNotification(options: NotificationOptions): Promise<SendResult> {
  // ...
}

// ❌ Bad
export function sendNotification(options: any): any {
  // ...
}
```

### Code Style

- **2 spaces** for indentation
- **Single quotes** for strings
- **Semicolons** required
- **Trailing commas** in multi-line objects/arrays
- **Max line length**: 100 characters

### File Naming

- **kebab-case** for files: `notification-service.ts`
- **PascalCase** for classes: `NotificationService`
- **camelCase** for functions/variables: `sendNotification`
- **UPPER_SNAKE_CASE** for constants: `MAX_ATTEMPTS`

### Error Handling

- Use **custom error classes** for domain errors
- Provide **meaningful error messages**
- Include **error codes** for programmatic handling
- **Never swallow errors** silently

```typescript
// ✅ Good
export class UCPError extends Error {
  code: string
  status: number
  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = 'UCPError'
    this.code = code
    this.status = status
  }
}

// ❌ Bad
try {
  // ...
} catch (e) {
  console.log('error')  // swallowed
}
```

---

## Adding New Providers

To add a new notification provider (e.g., Twilio SMS):

1. **Create the provider file** in `src/lib/providers/`:

```typescript
// src/lib/providers/twilio.ts
import { BaseProvider } from './base'
import type { ProviderName, ProviderCapabilities, SendRequest, SendResult } from '@/lib/types'

export class TwilioProvider extends BaseProvider {
  readonly name: ProviderName = 'twilio' as ProviderName
  readonly displayName = 'Twilio SMS'
  readonly capabilities: ProviderCapabilities = {
    channels: ['sms'],
    supportsBatch: false,
    supportsTemplate: false,
    supportsScheduled: false,
    maxRatePerSecond: 10,
  }

  protected async onValidateCredentials(): Promise<boolean> {
    // Verify Twilio credentials
    return !!(this.credentials.accountSid && this.credentials.authToken)
  }

  async send(request: SendRequest): Promise<SendResult> {
    // Implement Twilio SMS sending
    // Return SendResult
  }
}
```

2. **Register the provider** in `src/lib/providers/registry.ts`:

```typescript
import { TwilioProvider } from './twilio'

const PROVIDER_FACTORIES: Record<ProviderName, () => Provider> = {
  // ... existing
  twilio: () => new TwilioProvider(),
}
```

3. **Add the provider name** to the `ProviderName` type in `src/lib/types/index.ts`

4. **Add tests** in `src/lib/__tests__/providers/twilio.test.ts`

5. **Update documentation**:
   - `README.md` — add to Providers table
   - `src/app/api/docs/route.ts` — update OpenAPI spec

---

## Adding New Templates

To add a new notification template (e.g., `account_verified`):

1. **Add to `BUILTIN_TEMPLATES`** in `src/lib/services/templates.ts`:

```typescript
const BUILTIN_TEMPLATES: TemplateStore = {
  // ... existing
  account_verified: {
    en: {
      title: 'Account verified',
      body: 'Your account has been verified. Welcome aboard, {{name}}!',
    },
    ar: {
      title: 'تم التحقق من حسابك',
      body: 'تم التحقق من حسابك. أهلاً بك، {{name}}!',
    },
  },
}
```

2. **Add description** in `getTemplateDescription()`

3. **Add tests** in `src/lib/__tests__/templates.test.ts`

---

## Testing

### Running Tests

```bash
# Run all tests once
bun run test

# Watch mode (re-runs on file change)
bun run test:watch

# With UI
bun run test:ui

# With coverage report
bun run test:coverage
```

### Writing Tests

- Place tests in `src/lib/__tests__/` mirroring the source structure
- Use `describe` blocks to group related tests
- Use `it` with descriptive names (should...)
- Test both success and error cases
- Aim for >80% coverage on new code

```typescript
import { describe, it, expect } from 'vitest'
import { myFunction } from '../my-module'

describe('myFunction', () => {
  it('should do X when given Y', () => {
    const result = myFunction('input')
    expect(result).toBe('expected')
  })

  it('should throw when given invalid input', () => {
    expect(() => myFunction('')).toThrow()
  })
})
```

---

## Reporting Bugs

Before creating a bug report:

1. **Search existing issues** — your bug may already be reported
2. **Check the documentation** — README, DEPLOYMENT.md
3. **Try the latest `main` branch** — it may be fixed already

When creating a bug report, include:

- **Clear title** describing the issue
- **Steps to reproduce** (numbered list)
- **Expected behavior**
- **Actual behavior**
- **Screenshots** (if applicable)
- **Environment**:
  - OS (macOS, Linux, Windows)
  - Node.js/Bun version
  - UCP version (from package.json)
  - Database (SQLite local, Turso production)
- **Logs** — error messages, stack traces
- **Possible solution** (if you have one)

---

## Feature Requests

We welcome feature requests! Please:

1. **Search existing issues** first
2. **Open a discussion** before starting work on large features
3. **Describe the use case** — why is this feature needed?
4. **Propose a solution** — how would you implement it?
5. **Consider alternatives** — what other approaches exist?

---

## Questions?

- 💬 Open a [Discussion](https://github.com/elmoorx0/ucp-platform/discussions)
- 🐛 File an [Issue](https://github.com/elmoorx0/ucp-platform/issues)
- 📧 Read the [docs](https://github.com/elmoorx0/ucp-platform#readme)

---

Thank you for contributing! 🚀
