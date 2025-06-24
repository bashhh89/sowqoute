'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Image from 'next/image'

interface Client {
  id: string
  company_name: string
  industry?: string
  website?: string
  company_size?: string
  created_at: string
  contacts?: Contact[]
  sows?: SOW[]
}

interface Contact {
  id: string
  name: string
  title: string
  is_decision_maker: boolean
  client_id: string
}

interface SOW {
  id: string
  title: string
  status: 'draft' | 'final' | 'archived'
  created_at: string
  client_id: string
}

export default function CRMPage() {
  const [user, setUser] = useState<User | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const checkUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
    } else {
      setUser(user)
      try {
        const response = await fetch('/api/clients')
        if (response.ok) {
          const { clients } = await response.json()
          setClients(clients)
        }
      } catch (error) {
        console.error('Error fetching clients:', error)
      } finally {
        setLoading(false)
      }
    }
  }, [router, supabase])

  useEffect(() => {
    checkUser()
  }, [checkUser])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const filteredClients = clients.filter(client =>
    client.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.industry?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const viewClientDetails = async (clientId: string) => {
    try {
      const response = await fetch(`/api/clients/${clientId}`)
      if (response.ok) {
        const { client, contacts, sows } = await response.json()
        setSelectedClient({ ...client, contacts, sows })
      }
    } catch (error) {
      console.error('Error fetching client details:', error)
    }
  }

  const createSOWForClient = (client: Client) => {
    // Navigate to SOW creation with pre-filled client info
    router.push(`/sow/create?client=${encodeURIComponent(JSON.stringify(client))}`)
  }

  if (!user) return null

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#004D40', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Header */}
      <header className="border-b" style={{ backgroundColor: '#004D40', borderColor: '#B2DFDB' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <Image
                src="/footer-logo.svg"
                alt="Social Garden"
                width={269}
                height={33}
                className="h-8 w-auto"
              />
            </div>
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => router.push('/sow/create')}
                className="bg-white text-[#004D40] hover:bg-gray-100"
              >
                + New SOW
              </Button>
              <span className="text-white text-sm font-medium" style={{ color: 'white' }}>Welcome, {user.email}</span>
              <Button 
                onClick={handleSignOut}
                variant="outline"
                className="border-white text-white hover:bg-white hover:text-black"
                style={{ color: 'white', borderColor: 'white' }}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Client Management</h1>
          <p className="text-gray-300">Manage your clients, contacts, and SOWs</p>
        </div>

        {/* Search and Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-sg-teal p-6 rounded-lg shadow-md text-white">
            <h3 className="text-lg font-semibold text-white mb-2">Total Clients</h3>
            <p className="text-3xl font-bold text-white">{clients.length}</p>
          </div>
          <div className="bg-sg-teal p-6 rounded-lg shadow-md text-white">
            <h3 className="text-lg font-semibold text-white mb-2">Total SOWs</h3>
            <p className="text-3xl font-bold text-white">
              {clients.reduce((sum, client) => sum + (client.sows?.length || 0), 0)}
            </p>
          </div>
          <div className="bg-sg-teal p-6 rounded-lg shadow-md text-white">
            <h3 className="text-lg font-semibold text-white mb-2">Active Projects</h3>
            <p className="text-3xl font-bold text-white">
              {clients.reduce((sum, client) => 
                sum + (client.sows?.filter(sow => sow.status === 'final').length || 0), 0
              )}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <Input
            type="text"
            placeholder="Search clients by name or industry..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
            style={{ backgroundColor: '#B2DFDB' }}
          />
        </div>

        {/* Clients Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#004D40' }}></div>
            <span className="ml-4 text-white">Loading clients...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.map((client) => (
              <div key={client.id} className="bg-sg-teal rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-white">{client.company_name}</h3>
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => viewClientDetails(client.id)}
                      variant="outline"
                      size="sm"
                      className="text-white border-white hover:bg-white hover:text-black"
                    >
                      View
                    </Button>
                    <Button
                      onClick={() => createSOWForClient(client)}
                      size="sm"
                      style={{ backgroundColor: '#004D40', color: 'white' }}
                    >
                      SOW
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm text-white">
                  {client.industry && (
                    <div className="flex items-center">
                      <span className="w-2 h-2 bg-[#004D40] rounded-full mr-2"></span>
                      {client.industry}
                    </div>
                  )}
                  {client.website && (
                    <div className="flex items-center">
                      <span className="w-2 h-2 bg-[#A5D6A7] rounded-full mr-2"></span>
                      <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {client.website}
                      </a>
                    </div>
                  )}
                  {client.company_size && (
                    <div className="flex items-center">
                      <span className="w-2 h-2 bg-[#FF6B35] rounded-full mr-2"></span>
                      {client.company_size}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      {client.contacts?.length || 0} contacts
                    </span>
                    <span className="text-gray-500">
                      {client.sows?.length || 0} SOWs
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Client Details Modal */}
        {selectedClient && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <h2 className="text-2xl font-bold text-white">{selectedClient.company_name}</h2>
                  <Button
                    onClick={() => setSelectedClient(null)}
                    variant="outline"
                    size="sm"
                  >
                    ✕
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Client Info */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Company Information</h3>
                    <div className="space-y-3">
                      {selectedClient.industry && (
                        <div>
                          <span className="font-medium text-gray-700">Industry:</span>
                          <span className="ml-2 text-gray-600">{selectedClient.industry}</span>
                        </div>
                      )}
                      {selectedClient.website && (
                        <div>
                          <span className="font-medium text-gray-700">Website:</span>
                          <a href={selectedClient.website} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 hover:underline">
                            {selectedClient.website}
                          </a>
                        </div>
                      )}
                      {selectedClient.company_size && (
                        <div>
                          <span className="font-medium text-gray-700">Company Size:</span>
                          <span className="ml-2 text-gray-600">{selectedClient.company_size}</span>
                        </div>
                      )}
                      <div>
                        <span className="font-medium text-gray-700">Created:</span>
                        <span className="ml-2 text-gray-600">
                          {new Date(selectedClient.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contacts */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Contacts</h3>
                    {selectedClient.contacts && selectedClient.contacts.length > 0 ? (
                      <div className="space-y-3">
                        {selectedClient.contacts.map((contact) => (
                          <div key={contact.id} className="border border-gray-200 rounded-lg p-3">
                            <div className="font-medium text-gray-900">{contact.name}</div>
                            <div className="text-sm text-gray-600">{contact.title}</div>
                            {contact.is_decision_maker && (
                              <span className="inline-block bg-[#004D40] text-white text-xs px-2 py-1 rounded mt-1">
                                Decision Maker
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500">No contacts found</p>
                    )}
                  </div>
                </div>

                {/* SOWs */}
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-white mb-4">SOWs</h3>
                  {selectedClient.sows && selectedClient.sows.length > 0 ? (
                    <div className="space-y-3">
                      {selectedClient.sows.map((sow) => (
                        <div key={sow.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium text-gray-900">{sow.title}</div>
                              <div className="text-sm text-gray-600">
                                Created: {new Date(sow.created_at).toLocaleDateString()}
                              </div>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              sow.status === 'final' ? 'bg-green-100 text-green-800' :
                              sow.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {sow.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No SOWs found</p>
                  )}
                </div>

                <div className="mt-8 flex justify-end space-x-4">
                  <Button
                    onClick={() => createSOWForClient(selectedClient)}
                    style={{ backgroundColor: '#004D40', color: 'white' }}
                  >
                    Create New SOW
                  </Button>
                  <Button
                    onClick={() => setSelectedClient(null)}
                    variant="outline"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
} 