import { NextRequest, NextResponse } from 'next/server'

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries}: Making request to ${url.substring(0, 100)}...`)
      const response = await fetch(url, options)
      
      if (response.status === 429) {
        // Rate limited - wait and retry with longer delays
        const waitTime = attempt * 2000 // 2s, 4s, 6s
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const prompt = searchParams.get('prompt')
  const model = searchParams.get('model') || 'openai'
  const seed = searchParams.get('seed') || '42'
  const json = searchParams.get('json') || 'false'

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
  }

  try {
    // Use Pollinations.AI GET endpoint for text generation
    const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=${model}&seed=${seed}${json === 'true' ? '&json=true' : ''}`
    
    console.log(`Making GET request to Pollinations.AI: ${url.substring(0, 200)}...`)

    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/plain,application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; SOW-Generator/1.0)'
      }
    })

    if (response.ok) {
      const text = await response.text()
      console.log(`Received response: ${text.substring(0, 200)}...`)
      return new NextResponse(text, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      })
    } else {
      console.error(`Pollinations.AI GET failed: ${response.status} ${response.statusText}`)
      const errorText = await response.text()
      console.error(`Error response: ${errorText}`)
      return NextResponse.json({ 
        error: 'AI service temporarily unavailable. Please try again later.',
        details: `Pollinations.AI returned ${response.status}: ${errorText}`
      }, { status: 503 })
    }
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, model = 'grok', systemPrompt = '' } = body

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    // Compose OpenAI-compatible payload
    const messages = []
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })

    const payload = {
      model,
      messages,
      max_tokens: 1024,
      temperature: 0.7,
      referrer: 'SOW-Generator'
    }

    const url = 'https://text.pollinations.ai/openai'
    console.log(`Making POST request to Pollinations.AI /openai: ${url}`)
    console.log(`Payload: ${JSON.stringify(payload, null, 2)}`)

    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      body: JSON.stringify(payload)
    })

    if (response.ok) {
      const result = await response.json()
      console.log(`Raw API response:`, result)
      const content = result.choices?.[0]?.message?.content || result.content || result.text || JSON.stringify(result)
      console.log(`Extracted content: ${content.substring(0, 200)}...`)
      return new NextResponse(content, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      })
    } else {
      console.error(`Pollinations.AI /openai POST failed: ${response.status} ${response.statusText}`)
      const errorText = await response.text()
      console.error(`Error response: ${errorText}`)
      return NextResponse.json({ 
        error: 'AI service temporarily unavailable. Please try again later.',
        details: `Pollinations.AI returned ${response.status}: ${errorText}`
      }, { status: 503 })
    }
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
} 