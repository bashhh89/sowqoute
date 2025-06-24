import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id: clientId } = await params

  // Fetch client
  const { data: client, error: clientError } = await supabase.from('clients').select('*').eq('id', clientId).single()
  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 404 })
  }

  // Fetch contacts
  const { data: contacts, error: contactsError } = await supabase.from('contacts').select('*').eq('client_id', clientId)
  if (contactsError) {
    return NextResponse.json({ error: contactsError.message }, { status: 500 })
  }

  // Fetch SOWs
  const { data: sows, error: sowsError } = await supabase.from('sows').select('*').eq('client_id', clientId)
  if (sowsError) {
    return NextResponse.json({ error: sowsError.message }, { status: 500 })
  }

  return NextResponse.json({ client, contacts, sows })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id: clientId } = await params
  const clientData = await req.json()

  const { data, error } = await supabase
    .from('clients')
    .update(clientData)
    .eq('id', clientId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ client: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id: clientId } = await params

  // Delete contacts first
  const { error: contactsError } = await supabase
    .from('contacts')
    .delete()
    .eq('client_id', clientId)

  if (contactsError) {
    return NextResponse.json({ error: contactsError.message }, { status: 500 })
  }

  // Delete SOWs
  const { error: sowsError } = await supabase
    .from('sows')
    .delete()
    .eq('client_id', clientId)

  if (sowsError) {
    return NextResponse.json({ error: sowsError.message }, { status: 500 })
  }

  // Delete client
  const { error: clientError } = await supabase
    .from('clients')
    .delete()
    .eq('id', clientId)

  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
} 