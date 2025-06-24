import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function POST(req: NextRequest) {
  const { researchText } = await req.json()

  if (!researchText || typeof researchText !== 'string') {
    return NextResponse.json({ error: 'Missing researchText' }, { status: 400 })
  }

  // 1. Extract client data from research
  const { data: clientDataExtracted, error: clientExtractError } = await supabase.rpc('extract_client_data_from_research', { research_text: researchText })
  if (clientExtractError) {
    console.error('Error extracting client data:', clientExtractError)
    return NextResponse.json({ error: `Failed to extract client data: ${clientExtractError.message}` }, { status: 500 })
  }

  // 2. Extract contacts from research
  const { data: contactsExtracted, error: contactsExtractError } = await supabase.rpc('extract_contacts_from_research', { research_text: researchText })
  if (contactsExtractError) {
    console.error('Error extracting contacts data:', contactsExtractError)
    return NextResponse.json({ error: `Failed to extract contacts data: ${contactsExtractError.message}` }, { status: 500 })
  }

  // Combine results - allow empty contacts array, no fake data
  const client = clientDataExtracted || null
  const contacts = contactsExtracted ? contactsExtracted.contacts : []

  return NextResponse.json({ client, contacts })
}
