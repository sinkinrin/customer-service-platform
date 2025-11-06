/**
 * FastGPT Connectivity Test API
 * 
 * POST /api/admin/settings/ai/test - Test FastGPT connection
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireRole } from '@/lib/utils/auth'
import { mockSettings } from '@/lib/mock-data'

export async function POST(_request: NextRequest) {
  try {
    // Verify authentication and authorization
    await requireAuth()
    await requireRole(['admin'])

    const aiSettings = mockSettings.ai_auto_reply

    // Check if AI is enabled
    if (!aiSettings.enabled) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'AI 功能未启用',
          details: '请先在设置中启用 AI 智能回复功能'
        },
        { status: 400 }
      )
    }

    // Check if FastGPT is configured
    if (!aiSettings.fastgpt_url || !aiSettings.fastgpt_appid || !aiSettings.fastgpt_api_key) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'FastGPT 配置不完整',
          details: '请确保已配置 FastGPT URL、App ID 和 API Key'
        },
        { status: 400 }
      )
    }

    // Prepare test request
    const fastgptUrl = aiSettings.fastgpt_url.endsWith('/')
      ? `${aiSettings.fastgpt_url}api/v1/chat/completions`
      : `${aiSettings.fastgpt_url}/api/v1/chat/completions`

    const testMessage = {
      chatId: 'test-connection',
      stream: false,
      detail: false,
      messages: [
        {
          role: 'user',
          content: '你好，这是一个连接测试'
        }
      ]
    }

    // Record start time
    const startTime = Date.now()

    // Send test request to FastGPT
    const response = await fetch(fastgptUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiSettings.fastgpt_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testMessage),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    // Calculate response time
    const responseTime = Date.now() - startTime

    // Check response status
    if (!response.ok) {
      const errorText = await response.text()
      let errorDetails = errorText

      try {
        const errorJson = JSON.parse(errorText)
        errorDetails = errorJson.error || errorJson.message || errorText
      } catch {
        // Keep original error text
      }

      return NextResponse.json(
        {
          success: false,
          error: `FastGPT API 返回错误 (${response.status})`,
          details: errorDetails,
          responseTime,
          statusCode: response.status
        },
        { status: 200 } // Return 200 to client, but indicate test failure
      )
    }

    // Parse response
    const data = await response.json()

    // Validate response format
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'FastGPT 响应格式错误',
          details: '响应中缺少 choices 字段或格式不正确',
          responseTime,
          rawResponse: data
        },
        { status: 200 }
      )
    }

    const aiResponse = data.choices[0]?.message?.content

    if (!aiResponse) {
      return NextResponse.json(
        {
          success: false,
          error: 'FastGPT 响应内容为空',
          details: '未能从响应中提取 AI 回复内容',
          responseTime,
          rawResponse: data
        },
        { status: 200 }
      )
    }

    // Test successful
    return NextResponse.json({
      success: true,
      message: '连接测试成功',
      responseTime,
      testResponse: aiResponse,
      config: {
        url: fastgptUrl,
        appId: aiSettings.fastgpt_appid,
        model: aiSettings.model,
        temperature: aiSettings.temperature
      }
    })

  } catch (error: any) {
    console.error('[FastGPT Test] Error:', error)

    // Handle timeout
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return NextResponse.json(
        {
          success: false,
          error: '连接超时',
          details: 'FastGPT 服务器响应超时（超过 10 秒），请检查 URL 是否正确或网络连接'
        },
        { status: 200 }
      )
    }

    // Handle network errors
    if (error.cause?.code === 'ECONNREFUSED') {
      return NextResponse.json(
        {
          success: false,
          error: '连接被拒绝',
          details: '无法连接到 FastGPT 服务器，请检查 URL 是否正确'
        },
        { status: 200 }
      )
    }

    if (error.cause?.code === 'ENOTFOUND') {
      return NextResponse.json(
        {
          success: false,
          error: '域名解析失败',
          details: '无法解析 FastGPT 服务器地址，请检查 URL 是否正确'
        },
        { status: 200 }
      )
    }

    // Generic error
    return NextResponse.json(
      {
        success: false,
        error: '测试失败',
        details: error.message || '未知错误'
      },
      { status: 200 }
    )
  }
}

