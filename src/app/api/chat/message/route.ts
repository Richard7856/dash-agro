import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { TOOL_DEFINITIONS, executeTool } from '@/lib/agent/tools'
import { buildSystemPrompt } from '@/lib/agent/system-prompt'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  // Verify Supabase session
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { messages } = await req.json() as { messages: Anthropic.MessageParam[] }
  if (!messages?.length) return NextResponse.json({ error: 'Mensajes requeridos' }, { status: 400 })

  const systemPrompt = buildSystemPrompt()
  const toolsUsed: string[] = []
  let currentMessages = [...messages]

  // Agentic loop — hasta 5 rondas de tool use
  for (let round = 0; round < 5; round++) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      tools: TOOL_DEFINITIONS,
      messages: currentMessages,
    })

    // If no tool calls → return the text response
    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find((b) => b.type === 'text')
      const reply = textBlock?.type === 'text' ? textBlock.text : '...'
      return NextResponse.json({ reply, toolsUsed })
    }

    // Process tool_use blocks
    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use')
    if (!toolUseBlocks.length) {
      const textBlock = response.content.find((b) => b.type === 'text')
      const reply = textBlock?.type === 'text' ? textBlock.text : '...'
      return NextResponse.json({ reply, toolsUsed })
    }

    // Add assistant message with tool_use
    currentMessages = [...currentMessages, { role: 'assistant', content: response.content }]

    // Execute tools and build tool_result blocks
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const block of toolUseBlocks) {
      if (block.type !== 'tool_use') continue
      toolsUsed.push(block.name)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await executeTool(block.name, block.input as Record<string, any>)
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
    }

    // Add tool results as user message
    currentMessages = [...currentMessages, { role: 'user', content: toolResults }]
  }

  return NextResponse.json({ reply: 'No pude completar la operación en el tiempo límite. Por favor intenta de nuevo.', toolsUsed })
}
