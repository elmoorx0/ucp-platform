/**
 * Notification Templates Service
 * Store reusable message templates with variables and locale support.
 *
 * Usage:
 *   const rendered = await renderTemplate('welcome', { name: 'Alice' }, 'ar')
 *   // → { title: 'مرحباً Alice!', body: '...' }
 *
 * Templates support:
 *   - Variable interpolation: {{name}}, {{orderId}}, etc.
 *   - Per-locale variants (en, ar, fr, etc.)
 *   - Default fallback to 'en' if locale not found
 */

import { db } from '@/lib/db'
import { randomUUID } from 'crypto'

export interface RenderedTemplate {
  title: string
  body: string
  imageUrl?: string
  data?: Record<string, unknown>
}

export interface TemplateDefinition {
  title: string
  body: string
  imageUrl?: string
  data?: Record<string, unknown>
}

/**
 * Render a template by key + variables + locale.
 * Returns null if template not found.
 */
export async function renderTemplate(
  key: string,
  variables: Record<string, string | number | boolean> = {},
  locale = 'en',
  projectId?: string
): Promise<RenderedTemplate | null> {
  // Look up template in DB
  // Note: we use AuditLog table for now as a simple KV store.
  // For production, create a dedicated Template model in Prisma schema.
  // Here we use a simple JSON file approach for templates (stored in /templates dir).

  const template = await loadTemplate(key, projectId)
  if (!template) return null

  // Pick locale variant, fallback to 'en'
  const variant = template[locale] || template.en
  if (!variant) return null

  return {
    title: interpolate(variant.title, variables),
    body: interpolate(variant.body, variables),
    imageUrl: variant.imageUrl,
    data: variant.data,
  }
}

/**
 * Simple mustache-style interpolation: {{var}} → value
 */
function interpolate(text: string, vars: Record<string, string | number | boolean>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = vars[key]
    return value !== undefined ? String(value) : match
  })
}

// ============ In-memory template registry (for built-in templates) ============

interface TemplateStore {
  [key: string]: {
    [locale: string]: TemplateDefinition
  }
}

const BUILTIN_TEMPLATES: TemplateStore = {
  // Welcome new user
  welcome: {
    en: {
      title: 'Welcome to {{appName}}!',
      body: 'Hi {{name}}, your account is ready. Start exploring now!',
    },
    ar: {
      title: 'مرحباً بك في {{appName}}!',
      body: 'مرحباً {{name}}، حسابك جاهز. ابدأ الاستكشاف الآن!',
    },
    fr: {
      title: 'Bienvenue sur {{appName}}!',
      body: 'Bonjour {{name}}, votre compte est prêt. Commencez à explorer!',
    },
  },

  // Order shipped
  order_shipped: {
    en: {
      title: 'Order #{{orderId}} shipped',
      body: 'Your order is on the way. Expected delivery: {{deliveryDate}}.',
    },
    ar: {
      title: 'تم شحن الطلب #{{orderId}}',
      body: 'طلبك في الطريق. التسليم المتوقع: {{deliveryDate}}.',
    },
  },

  // OTP / verification code
  otp: {
    en: {
      title: 'Your verification code',
      body: 'Your code is {{code}}. Valid for 10 minutes. Do not share it.',
    },
    ar: {
      title: 'رمز التحقق الخاص بك',
      body: 'رمزك هو {{code}}. صالح لمدة 10 دقائق. لا تشاركه مع أحد.',
    },
  },

  // Password reset
  password_reset: {
    en: {
      title: 'Reset your password',
      body: 'Click here to reset your password: {{resetLink}} (expires in 1 hour)',
    },
    ar: {
      title: 'إعادة تعيين كلمة المرور',
      body: 'اضغط هنا لإعادة تعيين كلمة المرور: {{resetLink}} (تنتهي خلال ساعة)',
    },
  },

  // New message received
  new_message: {
    en: {
      title: 'New message from {{senderName}}',
      body: '{{messagePreview}}',
    },
    ar: {
      title: 'رسالة جديدة من {{senderName}}',
      body: '{{messagePreview}}',
    },
  },

  // Payment succeeded
  payment_succeeded: {
    en: {
      title: 'Payment received',
      body: 'We received your payment of {{amount}} {{currency}}. Thanks!',
    },
    ar: {
      title: 'تم استلام الدفع',
      body: 'لقد استلمنا دفعتك بقيمة {{amount}} {{currency}}. شكراً لك!',
    },
  },

  // Payment failed
  payment_failed: {
    en: {
      title: 'Payment failed',
      body: 'Your payment of {{amount}} {{currency}} failed. Please update your payment method.',
    },
    ar: {
      title: 'فشل الدفع',
      body: 'فشل دفعتك بقيمة {{amount}} {{currency}}. يرجى تحديث طريقة الدفع.',
    },
  },
}

/**
 * Load template from built-in registry or DB (project-specific overrides).
 */
async function loadTemplate(key: string, projectId?: string): Promise<{ [locale: string]: TemplateDefinition } | null> {
  // Check built-in templates first
  const builtin = BUILTIN_TEMPLATES[key]
  if (builtin) return builtin

  // TODO: load project-specific templates from DB
  // For now, return null for unknown templates
  return null
}

/**
 * List all available templates (built-in + project-specific).
 */
export function listBuiltinTemplates(): Array<{ key: string; locales: string[]; description: string }> {
  return Object.entries(BUILTIN_TEMPLATES).map(([key, locales]) => ({
    key,
    locales: Object.keys(locales),
    description: getTemplateDescription(key),
  }))
}

function getTemplateDescription(key: string): string {
  const descriptions: Record<string, string> = {
    welcome: 'Welcome new user on signup',
    order_shipped: 'Order has been shipped',
    otp: 'One-time password / verification code',
    password_reset: 'Password reset link',
    new_message: 'New chat/message received',
    payment_succeeded: 'Payment completed successfully',
    payment_failed: 'Payment failed — retry needed',
  }
  return descriptions[key] || 'Custom template'
}

/**
 * Render template with safe fallback (no error if template missing).
 * Returns the raw variables as title/body if template not found.
 */
export async function renderTemplateSafe(
  key: string,
  variables: Record<string, string | number | boolean> = {},
  locale = 'en',
  fallback?: { title: string; body: string }
): Promise<RenderedTemplate> {
  const rendered = await renderTemplate(key, variables, locale)
  if (rendered) return rendered

  return {
    title: fallback?.title || `Notification`,
    body: fallback?.body || JSON.stringify(variables),
  }
}
