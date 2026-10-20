const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'NKB Manufacturing Centralized API Platform',
    version: '1.0.0',
    description: 'Production-grade Standalone API Platform for NKB Applications (DCC, PPE, Formulation, ITMS) and External Applications.',
    contact: {
      name: 'NKB IT Engineering',
      email: 'api-support@nkbmanufacturing.com',
      url: 'https://nkbmanufacturing.com'
    }
  },
  servers: [
    {
      url: 'http://localhost:5000',
      description: 'Local Development Server'
    },
    {
      url: 'https://api.nkbmanufacturing.com',
      description: 'Production Gateway'
    }
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API_KEY',
        description: 'Primary external authentication. Pass raw API key: `nkb_live_xxxxxxxx...` in `Authorization: Bearer nkb_live_...` header.'
      }
    },
    headers: {
      RequestId: {
        description: 'Unique request correlation ID assigned to every request',
        schema: { type: 'string', format: 'uuid' }
      },
      RateLimitLimit: {
        description: 'Configured requests limit per minute',
        schema: { type: 'integer' }
      },
      RateLimitRemaining: {
        description: 'Remaining requests in the current window',
        schema: { type: 'integer' }
      }
    },
    schemas: {
      StandardSuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object' },
          meta: {
            type: 'object',
            properties: {
              requestId: { type: 'string', format: 'uuid', example: '9b1deb4d-3b7d-4bad-9bd2-2ca771300000' }
            }
          }
        }
      },
      StandardErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'INVALID_REQUEST' },
              message: { type: 'string', example: 'The request is invalid.' },
              details: { type: 'array', items: { type: 'object' } }
            }
          },
          meta: {
            type: 'object',
            properties: {
              requestId: { type: 'string', format: 'uuid', example: '9b1deb4d-3b7d-4bad-9bd2-2ca771300000' }
            }
          }
        }
      },
      Document: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          documentNumber: { type: 'string', example: 'DOC-2026-SOP-001' },
          title: { type: 'string', example: 'Standard Operating Procedure' },
          category: { type: 'string', example: 'SOP' },
          version: { type: 'string', example: '1.0' },
          status: { type: 'string', example: 'approved' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      Asset: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          assetTag: { type: 'string', example: 'NKB-AST-0091' },
          name: { type: 'string', example: 'Dell Latitude Laptop' },
          category: { type: 'string', example: 'Hardware' },
          status: { type: 'string', example: 'available' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  },
  security: [
    {
      ApiKeyAuth: []
    }
  ],
  paths: {
    '/api/health': {
      get: {
        summary: 'Public Health Probe',
        description: 'Returns online status and server metrics',
        security: [],
        responses: {
          '200': {
            description: 'System is healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardSuccessResponse' }
              }
            }
          }
        }
      }
    },
    '/api/health/details': {
      get: {
        summary: 'Detailed Health Diagnostic Probe',
        description: 'Returns database latency, memory stats, and service status',
        security: [],
        responses: {
          '200': { description: 'System fully healthy' },
          '503': { description: 'System degraded' }
        }
      }
    },
    '/api/v1/documents': {
      get: {
        summary: 'List Documents',
        description: 'Retrieve versioned document records. Required Scope: `documents:read`',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Successful response' },
          '401': { $ref: '#/components/schemas/StandardErrorResponse' },
          '403': { $ref: '#/components/schemas/StandardErrorResponse' },
          '429': { description: 'Rate limit exceeded' }
        }
      },
      post: {
        summary: 'Create Document',
        description: 'Create a new document. Required Scope: `documents:create`. Supports `Idempotency-Key` header.',
        parameters: [
          { name: 'Idempotency-Key', in: 'header', schema: { type: 'string' }, required: false }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Document' }
            }
          }
        },
        responses: {
          '201': { description: 'Document created successfully' },
          '409': { description: 'Idempotency conflict' },
          '422': { description: 'Validation error' }
        }
      }
    },
    '/api/v1/assets': {
      get: {
        summary: 'List Assets',
        description: 'Retrieve IT and physical assets. Required Scope: `assets:read`',
        responses: {
          '200': { description: 'Successful response' }
        }
      },
      post: {
        summary: 'Create Asset',
        description: 'Create new hardware or tool asset. Required Scope: `assets:create`',
        responses: {
          '201': { description: 'Asset created' }
        }
      }
    }
  }
};

function serveSwaggerUI(req, res) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>NKB Centralized API Platform - OpenAPI Specs</title>
  <link rel="stylesheet" type="text/css" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin:0; background: #fafafa; font-family: sans-serif; }
    .topbar { display: none !important; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui-bundle.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: "/docs/openapi.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
}

module.exports = {
  openapiSpec,
  serveSwaggerUI
};
