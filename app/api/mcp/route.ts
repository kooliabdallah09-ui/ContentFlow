import { NextRequest, NextResponse } from 'next/server'
import { resolveApiKey } from '@/lib/mcp/auth'
import { MCP_TOOLS, findTool } from '@/lib/mcp/tools'

// ContentFlow MCP server — JSON-RPC 2.0 over HTTP.
// Endpoint: POST https://contentflow-web.com/api/mcp
// Auth:     Authorization: Bearer <cf_live_...>  (mint keys at /settings/api-keys)
//
// Supported methods:
//   - initialize            → server info + capabilities
//   - notifications/initialized (notification, no response)
//   - tools/list            → array of tool definitions
//   - tools/call            → execute a tool by name
//
// Compatible with Claude Desktop, Cursor, Claude Code, and any client that speaks
// MCP over Streamable HTTP.

export const maxDuration = 300

const PROTOCOL_VERSION = '2025-03-26'

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: string | number | null
  method: string
  params?: Record<string, unknown>
}

function rpcResult(id: string | number | null | undefined, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, result })
}

function rpcError(id: string | number | null | undefined, code: number, message: string, data?: unknown) {
  return NextResponse.json({
    jsonrpc: '2.0',
    id: id ?? null,
    error: { code, message, data },
  })
}

async function readBody(request: NextRequest): Promise<JsonRpcRequest | JsonRpcRequest[]> {
  return await request.json()
}

async function handleSingle(userId: string, req: JsonRpcRequest) {
  const { id, method, params } = req

  switch (method) {
    case 'initialize':
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: {
          name: 'contentflow',
          version: '1.0.0',
          title: 'ContentFlow',
        },
      })

    case 'notifications/initialized':
      // Notification — clients send this after handshake, no response needed.
      return new NextResponse(null, { status: 202 })

    case 'ping':
      return rpcResult(id, {})

    case 'tools/list':
      return rpcResult(id, {
        tools: MCP_TOOLS.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      })

    case 'tools/call': {
      const toolName = String((params as { name?: unknown })?.name ?? '')
      const toolArgs = ((params as { arguments?: Record<string, unknown> })?.arguments ?? {}) as Record<string, unknown>
      const tool = findTool(toolName)
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${toolName}`)
      try {
        const result = await tool.handler(userId, toolArgs)
        return rpcResult(id, result)
      } catch (err) {
        return rpcResult(id, {
          content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        })
      }
    }

    default:
      return rpcError(id, -32601, `Method not found: ${method}`)
  }
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32001, message: 'Missing Bearer token' },
    }, { status: 401 })
  }
  const userId = await resolveApiKey(auth.slice(7).trim())
  if (!userId) {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32001, message: 'Invalid API key' },
    }, { status: 401 })
  }

  const body = await readBody(request)

  // Batch requests: process each, return array. (JSON-RPC 2.0 batch.)
  if (Array.isArray(body)) {
    const results = await Promise.all(body.map(r => handleSingle(userId, r).then(res => res.json())))
    return NextResponse.json(results)
  }

  return handleSingle(userId, body)
}

// Some clients probe with GET first to check the endpoint is alive.
export async function GET() {
  return NextResponse.json({
    server: 'contentflow',
    protocol: PROTOCOL_VERSION,
    docs: 'https://contentflow-web.com/settings/api-keys',
  })
}
