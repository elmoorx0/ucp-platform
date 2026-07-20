/**
 * Tests for templates service
 */

import { describe, it, expect } from 'vitest'
import {
  renderTemplate,
  renderTemplateSafe,
  listBuiltinTemplates,
} from '../services/templates'

describe('Notification templates', () => {
  it('should render welcome template with variables', async () => {
    const result = await renderTemplate('welcome', { name: 'Alice', appName: 'MyApp' }, 'en')
    expect(result).not.toBeNull()
    expect(result?.title).toBe('Welcome to MyApp!')
    expect(result?.body).toContain('Alice')
  })

  it('should render in Arabic', async () => {
    const result = await renderTemplate('welcome', { name: 'علي', appName: 'تطبيقي' }, 'ar')
    expect(result).not.toBeNull()
    expect(result?.title).toContain('تطبيقي')
    expect(result?.body).toContain('علي')
  })

  it('should fallback to English for missing locale', async () => {
    const result = await renderTemplate('welcome', { name: 'Alice', appName: 'MyApp' }, 'de')
    expect(result).not.toBeNull()
    expect(result?.title).toBe('Welcome to MyApp!')
  })

  it('should return null for unknown template', async () => {
    const result = await renderTemplate('unknown_template', {}, 'en')
    expect(result).toBeNull()
  })

  it('should leave unknown variables as-is', async () => {
    const result = await renderTemplate('welcome', { name: 'Alice' }, 'en')
    expect(result?.title).toBe('Welcome to {{appName}}!')
  })

  it('should render OTP template', async () => {
    const result = await renderTemplate('otp', { code: '123456' }, 'en')
    expect(result?.body).toContain('123456')
  })

  it('should render all built-in templates without errors', async () => {
    const templates = listBuiltinTemplates()
    expect(templates.length).toBeGreaterThan(5)

    for (const t of templates) {
      const result = await renderTemplate(t.key, {}, 'en')
      expect(result).not.toBeNull()
      expect(result?.title.length).toBeGreaterThan(0)
      expect(result?.body.length).toBeGreaterThan(0)
    }
  })

  it('renderTemplateSafe should return fallback for unknown template', async () => {
    const result = await renderTemplateSafe('unknown', { foo: 'bar' }, 'en', undefined, {
      title: 'Fallback',
      body: 'Default body',
    })
    expect(result.title).toBe('Fallback')
    expect(result.body).toBe('Default body')
  })

  it('renderTemplateSafe should return JSON of variables if no fallback', async () => {
    const result = await renderTemplateSafe('unknown', { foo: 'bar' }, 'en')
    expect(result.title).toBe('Notification')
    expect(result.body).toContain('foo')
  })

  it('listBuiltinTemplates should return array with keys, locales, descriptions', () => {
    const templates = listBuiltinTemplates()
    expect(Array.isArray(templates)).toBe(true)
    expect(templates[0]).toHaveProperty('key')
    expect(templates[0]).toHaveProperty('locales')
    expect(templates[0]).toHaveProperty('description')
  })
})
