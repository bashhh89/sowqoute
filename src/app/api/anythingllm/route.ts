import { NextRequest, NextResponse } from 'next/server'

const ANYTHINGLLM_API_URL = process.env.ANYTHINGLLM_API_URL
const API_KEY = process.env.ANYTHINGLLM_API_KEY
const WORKSPACE_SLUG = process.env.ANYTHINGLLM_WORKSPACE_SLUG || 'sow'

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries}: Making request to ${url.substring(0, 100)}...`)
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000) // 60-second timeout
      
      const response = await fetch(url, { ...options, signal: controller.signal })
      
      clearTimeout(timeoutId)

      if (response.status === 429) {
        const waitTime = attempt * 2000
        console.log(`Rate limited, waiting ${waitTime}ms before retry ${attempt}/${maxRetries}`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        continue
      }
      
      console.log(`Request successful on attempt ${attempt}`)
      return response
    } catch (error) {
      console.error(`Request failed on attempt ${attempt}:`, error)
      if (attempt === maxRetries) {
        throw error
      }
      console.log(`Retrying in 2 seconds...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  throw new Error('Max retries exceeded')
}

export async function POST(request: NextRequest) {
  if (!ANYTHINGLLM_API_URL || !API_KEY) {
    console.error("Missing AnythingLLM environment variables: ANYTHINGLLM_API_URL and/or ANYTHINGLLM_API_KEY must be set.");
    return NextResponse.json({ error: 'Server configuration error: Missing API credentials.' }, { status: 500 });
  }

  try {
    const body = await request.json()
    const { description } = body

    if (!description) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    }

    console.log(`Sending streaming request to AnythingLLM workspace: ${WORKSPACE_SLUG}`)
    console.log(`Description: ${description.substring(0, 200)}...`)

    const response = await fetchWithRetry(`${ANYTHINGLLM_API_URL}/v1/workspace/${WORKSPACE_SLUG}/stream-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        message: description,
        mode: 'chat',
        sessionId: `sow-${Date.now()}`,
        reset: true
      })
    })

    if (!response.ok) {
      console.error(`AnythingLLM streaming API failed: ${response.status} ${response.statusText}`)
      const errorText = await response.text()
      console.error(`Error response: ${errorText}`)
      
      return NextResponse.json({ 
        error: 'AI service temporarily unavailable. Please try again later.',
        details: `AnythingLLM returned ${response.status}: ${errorText}`
      }, { status: 503 })
    }

    // Process the streaming response
    const reader = response.body?.getReader()
    if (!reader) {
      // Fallback to non-streaming if getReader is not available
      console.log('⚠️ Streaming not supported, using text fallback')
      const responseText = await response.text()
      return new NextResponse(responseText, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      })
    }

    // Create a readable stream for the response
    const stream = new ReadableStream({
      async start(controller) {
        let isStreamClosed = false
        const closeStream = () => {
          if (!isStreamClosed) {
            reader.releaseLock()
            controller.close()
            isStreamClosed = true
          }
        }

        try {
          let buffer = ''
          let isThinkingPhase = true
          let hasStartedThinking = false

          // Send immediate thinking start
          controller.enqueue(new TextEncoder().encode('THINKING_START\n'))
          controller.enqueue(new TextEncoder().encode('Analyzing project requirements and generating SOW...\n'))

          while (!isStreamClosed) {
            const { done, value } = await reader.read()
            
            if (done) {
              // Send completion markers
              if (isThinkingPhase) {
                controller.enqueue(new TextEncoder().encode('THINKING_END\n'))
                controller.enqueue(new TextEncoder().encode('SOW_START\n'))
              }
              controller.enqueue(new TextEncoder().encode('SOW_END\n'))
              break
            }

            buffer += new TextDecoder().decode(value)
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.trim() === '') continue

              try {
                const event: {
                  type: string
                  thought?: string
                  textResponse?: string
                  thoughts?: string[]
                } = JSON.parse(line)
                
                if (event.type === 'agentThought') {
                  // Real AI thinking captured
                  if (!hasStartedThinking) {
                    controller.enqueue(new TextEncoder().encode('THINKING_START\n'))
                    hasStartedThinking = true
                  }
                  controller.enqueue(new TextEncoder().encode(`${event.thought as string}\n`))
                } else if (event.type === 'textResponse' || event.type === 'textResponseChunk') {
                  // SOW content
                  if (isThinkingPhase) {
                    controller.enqueue(new TextEncoder().encode('THINKING_END\n'))
                    controller.enqueue(new TextEncoder().encode('SOW_START\n'))
                    isThinkingPhase = false
                  }
                  
                  if (event.textResponse) {
                    controller.enqueue(new TextEncoder().encode(event.textResponse as string))
                  }
                } else if (event.type === 'finalizeResponseStream') {
                  // Final thoughts if available
                  if (event.thoughts && event.thoughts.length > 0) {
                    controller.enqueue(new TextEncoder().encode('\n\nFinal Analysis:\n'))
                    event.thoughts.forEach((thought: string) => {
                      controller.enqueue(new TextEncoder().encode(`• ${thought}\n`))
                    })
                  }
                }
              } catch {
                // Skip malformed JSON lines
                continue
              }
            }
          }
        } catch (error) {
          console.error('Stream processing error:', error)
          if (!isStreamClosed) {
            controller.error(error)
            isStreamClosed = true
          }
        } finally {
          closeStream()
        }
      }
    })

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
} 