/**
 * GET /api/docs
 * OpenAPI 3.0 specification for the UCP REST API.
 * Can be viewed at https://your-domain/api/docs or imported into Postman/Swagger UI.
 */

import { NextResponse } from 'next/server'

const OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'UCP - Universal Communication Platform API',
    description: 'Production-ready CPaaS platform with multi-tenant architecture. Unified REST API for notifications, realtime, email, push, and more.',
    version: '1.3.0',
    contact: {
      name: 'UCP Platform',
      url: 'https://github.com/elmoorx0/ucp-platform',
    },
    license: {
      name: 'MIT',
      url: 'https://github.com/elmoorx0/ucp-platform/blob/main/LICENSE',
    },
  },
  servers: [
    { url: '/', description: 'Current deployment' },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'API key with required scopes (e.g. ucp_live_xxx)',
      },
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Use as: Bearer ucp_live_xxx',
      },
    },
    schemas: {
      Notification: {
        type: 'object',
        required: ['channel', 'title', 'body'],
        properties: {
          channel: { type: 'string', enum: ['push', 'email', 'inapp', 'webpush', 'sms', 'multi'] },
          to: { type: 'array', items: { type: 'string' }, description: 'External user IDs' },
          title: { type: 'string', maxLength: 100 },
          body: { type: 'string', maxLength: 1000 },
          imageUrl: { type: 'string', format: 'uri' },
          data: { type: 'object', description: 'Custom payload sent with notification' },
          targetingType: { type: 'string', enum: ['user', 'topic', 'segment', 'broadcast'], default: 'user' },
          priority: { type: 'string', enum: ['low', 'normal', 'high'], default: 'normal' },
          scheduledAt: { type: 'string', format: 'date-time' },
          externalId: { type: 'string', description: 'Idempotency key' },
        },
      },
      Device: {
        type: 'object',
        required: ['externalUserId', 'token', 'platform'],
        properties: {
          externalUserId: { type: 'string' },
          token: { type: 'string', description: 'FCM token / Web Push endpoint' },
          platform: { type: 'string', enum: ['android', 'ios', 'web'] },
          userAgent: { type: 'string' },
          appVersion: { type: 'string' },
          pushSubscription: {
            type: 'object',
            properties: {
              endpoint: { type: 'string' },
              keys: {
                type: 'object',
                properties: {
                  p256dh: { type: 'string' },
                  auth: { type: 'string' },
                },
              },
            },
          },
        },
      },
      EndUser: {
        type: 'object',
        required: ['externalId'],
        properties: {
          externalId: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          name: { type: 'string' },
          language: { type: 'string', default: 'en' },
          timezone: { type: 'string', default: 'UTC' },
          tags: { type: 'array', items: { type: 'string' } },
          attributes: { type: 'object' },
        },
      },
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
          meta: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              pageSize: { type: 'integer' },
              total: { type: 'integer' },
              totalPages: { type: 'integer' },
              requestId: { type: 'string' },
            },
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
  },
  security: [{ ApiKeyAuth: [] }],
  paths: {
    '/api/v1/notifications': {
      post: {
        summary: 'Send a notification',
        description: 'Send a notification to one or more users via the specified channel.',
        tags: ['Notifications'],
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Notification' },
              example: {
                channel: 'inapp',
                to: ['user-001', 'user-002'],
                title: 'Hello from UCP',
                body: 'This notification was sent through UCP',
                priority: 'normal',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Notification queued',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
          },
          '400': { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '429': { description: 'Rate limit exceeded' },
        },
      },
      get: {
        summary: 'List notifications',
        tags: ['Notifications'],
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'channel', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'List of notifications' } },
      },
    },
    '/api/v1/notifications/send-template': {
      post: {
        summary: 'Send notification from template',
        description: 'Render a pre-defined template and send it as a notification.',
        tags: ['Notifications', 'Templates'],
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['template', 'to'],
                properties: {
                  template: { type: 'string', example: 'welcome' },
                  variables: { type: 'object', example: { name: 'Alice', appName: 'MyApp' } },
                  locale: { type: 'string', default: 'en' },
                  to: { type: 'array', items: { type: 'string' } },
                  channel: { type: 'string', default: 'inapp' },
                  priority: { type: 'string', default: 'normal' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Notification sent' } },
      },
    },
    '/api/v1/notifications/{id}': {
      get: {
        summary: 'Get notification details',
        tags: ['Notifications'],
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Notification with delivery details' } },
      },
    },
    '/api/v1/notifications/{id}/cancel': {
      post: {
        summary: 'Cancel a pending notification',
        tags: ['Notifications'],
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Notification cancelled' } },
      },
    },
    '/api/v1/devices': {
      post: {
        summary: 'Register a device',
        tags: ['Devices'],
        security: [{ ApiKeyAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Device' } } } },
        responses: { '200': { description: 'Device registered' } },
      },
      get: { summary: 'List devices', tags: ['Devices'], security: [{ ApiKeyAuth: [] }], responses: { '200': { description: 'List of devices' } } },
    },
    '/api/v1/users': {
      post: {
        summary: 'Register an end user',
        tags: ['Users'],
        security: [{ ApiKeyAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/EndUser' } } } },
        responses: { '200': { description: 'User registered' } },
      },
      get: { summary: 'List end users', tags: ['Users'], security: [{ ApiKeyAuth: [] }], responses: { '200': { description: 'List of users' } } },
    },
    '/api/v1/projects': { get: { summary: 'Get current project info', tags: ['Projects'], security: [{ ApiKeyAuth: [] }], responses: { '200': { description: 'Project details' } } } },
    '/api/v1/stats': { get: { summary: 'Get notification stats', tags: ['Stats'], security: [{ ApiKeyAuth: [] }], responses: { '200': { description: 'Stats by status/channel' } } } },
    '/api/v1/events': { get: { summary: 'List events', tags: ['Events'], security: [{ ApiKeyAuth: [] }], responses: { '200': { description: 'Event log' } } } },
    '/api/v1/presence': { get: { summary: 'Get online users', tags: ['Presence'], security: [{ ApiKeyAuth: [] }], responses: { '200': { description: 'Online users + stats' } } } },
    '/api/v1/providers': { get: { summary: 'List configured providers', tags: ['Providers'], security: [{ ApiKeyAuth: [] }], responses: { '200': { description: 'Providers' } } } },
    '/api/v1/realtime': { post: { summary: 'Broadcast to a channel', tags: ['Realtime'], security: [{ ApiKeyAuth: [] }], responses: { '200': { description: 'Broadcast sent' } } } },
    '/api/v1/templates': { get: { summary: 'List notification templates', tags: ['Templates'], security: [{ ApiKeyAuth: [] }], responses: { '200': { description: 'Available templates' } } } },
    '/api/v1/webhooks/test': { post: { summary: 'Test project webhook', tags: ['Webhooks'], security: [{ ApiKeyAuth: [] }], responses: { '200': { description: 'Test result' } } } },
    '/api/health': { get: { summary: 'Health check', tags: ['System'], responses: { '200': { description: 'System health' } } } },
  },
  tags: [
    { name: 'Notifications', description: 'Send and manage notifications' },
    { name: 'Devices', description: 'Register and manage devices' },
    { name: 'Users', description: 'Register and manage end users' },
    { name: 'Projects', description: 'Project information' },
    { name: 'Stats', description: 'Statistics and analytics' },
    { name: 'Events', description: 'Event bus log' },
    { name: 'Presence', description: 'Realtime presence' },
    { name: 'Providers', description: 'Notification providers' },
    { name: 'Realtime', description: 'Realtime broadcasts' },
    { name: 'Templates', description: 'Notification templates' },
    { name: 'Webhooks', description: 'Webhook delivery receipts' },
    { name: 'System', description: 'System endpoints' },
  ],
}

export async function GET() {
  return NextResponse.json(OPENAPI_SPEC, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
