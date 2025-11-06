import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { mockSettings } from '@/lib/mock-data'

const ChatRequestSchema = z.object({
  conversationId: z.string(),
  message: z.string(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = ChatRequestSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      )
    }
    
    const { message, history = [] } = parsed.data
    
    // Get AI settings from mock data
    const aiSettings = mockSettings.ai_auto_reply
    
    // Check if AI is enabled
    if (!aiSettings.enabled) {
      return NextResponse.json(
        { success: false, error: 'AI chat is disabled' },
        { status: 403 }
      )
    }
    
    // Check if FastGPT configuration exists
    if (!aiSettings.fastgpt_url || !aiSettings.fastgpt_appid || !aiSettings.fastgpt_api_key) {
      return NextResponse.json(
        { success: false, error: 'FastGPT is not configured' },
        { status: 500 }
      )
    }
    
    // Prepare messages for FastGPT
    const messages = [
      ...history.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user' as const,
        content: message,
      },
    ]
    
    // Call FastGPT API
    const fastgptUrl = aiSettings.fastgpt_url.endsWith('/')
      ? `${aiSettings.fastgpt_url}api/v1/chat/completions`
      : `${aiSettings.fastgpt_url}/api/v1/chat/completions`
    
    const response = await fetch(fastgptUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiSettings.fastgpt_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chatId: parsed.data.conversationId,
        stream: false,
        detail: false,
        messages,
      }),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('FastGPT API error:', response.status, errorText)
      return NextResponse.json(
        { success: false, error: 'Failed to get AI response' },
        { status: 500 }
      )
    }
    
    const data = await response.json()
    
    // Extract AI response from FastGPT response
    // FastGPT returns OpenAI-compatible format
    const aiMessage = data.choices?.[0]?.message?.content || data.data || 'Sorry, I could not generate a response.'
    
    return NextResponse.json({
      success: true,
      data: {
        message: aiMessage,
        model: aiSettings.model || 'FastGPT',
      },
    })
  } catch (error) {
    console.error('AI chat error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

