import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

interface Contact {
  id?: string
  name: string
  title: string
  is_decision_maker: boolean
  client_id?: string
}

interface ClientData {
  id: string
  company_name: string
  industry?: string
  business_model?: string
  founded_date?: string
  website?: string
  linkedin_url?: string
  company_size?: string
  revenue_range?: string
  location?: string
  description?: string
  marketing_stack?: unknown
}

interface ClientEditModalProps {
  client: ClientData | null
  isOpen: boolean
  onClose: () => void
  onSave: (client: ClientData, contacts: Contact[]) => void
  loading?: boolean
}

export default function ClientEditModal({ client, isOpen, onClose, onSave, loading }: ClientEditModalProps) {
  const [clientData, setClientData] = useState<ClientData | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [showContactForm, setShowContactForm] = useState(false)

  useEffect(() => {
    if (client) {
      setClientData(client)
      // Fetch contacts for this client
      fetchContacts(client.id)
    }
  }, [client])

  const fetchContacts = async (clientId: string) => {
    try {
      const response = await fetch(`/api/contacts?client_id=${clientId}`)
      if (response.ok) {
        const { contacts } = await response.json()
        setContacts(contacts)
      }
    } catch (error) {
      console.error('Error fetching contacts:', error)
    }
  }

  const handleClientChange = (field: keyof ClientData, value: string) => {
    if (clientData) {
      setClientData({ ...clientData, [field]: value })
    }
  }

  const addContact = () => {
    setEditingContact({
      name: '',
      title: '',
      is_decision_maker: false
    })
    setShowContactForm(true)
  }

  const editContact = (contact: Contact) => {
    setEditingContact(contact)
    setShowContactForm(true)
  }

  const saveContact = async () => {
    if (!editingContact || !clientData) return

    try {
      const contactData = {
        ...editingContact,
        client_id: clientData.id
      }

      if (editingContact.id) {
        // Update existing contact
        const response = await fetch(`/api/contacts/${editingContact.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(contactData)
        })
        if (response.ok) {
          const { contact } = await response.json()
          setContacts(prev => prev.map(c => c.id === contact.id ? contact : c))
        }
      } else {
        // Create new contact
        const response = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(contactData)
        })
        if (response.ok) {
          const { contact } = await response.json()
          setContacts(prev => [...prev, contact])
        }
      }

      setShowContactForm(false)
      setEditingContact(null)
    } catch (error) {
      console.error('Error saving contact:', error)
    }
  }

  const deleteContact = async (contactId: string) => {
    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        setContacts(prev => prev.filter(c => c.id !== contactId))
      }
    } catch (error) {
      console.error('Error deleting contact:', error)
    }
  }

  const handleSave = () => {
    if (clientData) {
      onSave(clientData, contacts)
    }
  }

  if (!isOpen || !clientData) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-2xl font-bold text-[#004D40]">Edit Client: {clientData.company_name}</h2>
            <Button onClick={onClose} variant="outline" size="sm">✕</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Client Information */}
            <div>
              <h3 className="text-lg font-semibold text-[#004D40] mb-4">Company Information</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    value={clientData.company_name}
                    onChange={(e) => handleClientChange('company_name', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="industry">Industry</Label>
                  <Input
                    id="industry"
                    value={clientData.industry || ''}
                    onChange={(e) => handleClientChange('industry', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={clientData.website || ''}
                    onChange={(e) => handleClientChange('website', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="linkedin_url">LinkedIn</Label>
                  <Input
                    id="linkedin_url"
                    value={clientData.linkedin_url || ''}
                    onChange={(e) => handleClientChange('linkedin_url', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="company_size">Company Size</Label>
                  <Input
                    id="company_size"
                    value={clientData.company_size || ''}
                    onChange={(e) => handleClientChange('company_size', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="revenue_range">Revenue Range</Label>
                  <Input
                    id="revenue_range"
                    value={clientData.revenue_range || ''}
                    onChange={(e) => handleClientChange('revenue_range', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    value={clientData.description || ''}
                    onChange={(e) => handleClientChange('description', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg resize-none"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Contacts */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-[#004D40]">Contacts</h3>
                <Button onClick={addContact} size="sm" style={{ backgroundColor: '#004D40', color: 'white' }}>
                  + Add Contact
                </Button>
              </div>
              
              <div className="space-y-3">
                {contacts.map((contact) => (
                  <div key={contact.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{contact.name}</div>
                        <div className="text-sm text-gray-600">{contact.title}</div>
                        {contact.is_decision_maker && (
                          <span className="inline-block bg-[#004D40] text-white text-xs px-2 py-1 rounded mt-1">
                            Decision Maker
                          </span>
                        )}
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <Button
                          onClick={() => editContact(contact)}
                          variant="outline"
                          size="sm"
                          className="text-[#004D40] border-[#004D40] hover:bg-[#004D40] hover:text-white"
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => contact.id && deleteContact(contact.id)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-600 hover:bg-red-600 hover:text-white"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {contacts.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No contacts found</p>
                )}
              </div>
            </div>
          </div>

          {/* Contact Form Modal */}
          {showContactForm && editingContact && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-60">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold text-[#004D40] mb-4">
                  {editingContact.id ? 'Edit Contact' : 'Add Contact'}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="contact_name">Name</Label>
                    <Input
                      id="contact_name"
                      value={editingContact.name}
                      onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact_title">Title</Label>
                    <Input
                      id="contact_title"
                      value={editingContact.title}
                      onChange={(e) => setEditingContact({ ...editingContact, title: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="decision_maker"
                      checked={editingContact.is_decision_maker}
                      onChange={(e) => setEditingContact({ ...editingContact, is_decision_maker: e.target.checked })}
                      className="mr-2"
                    />
                    <Label htmlFor="decision_maker">Decision Maker</Label>
                  </div>
                </div>

                <div className="flex justify-end space-x-4 mt-6">
                  <Button
                    onClick={() => {
                      setShowContactForm(false)
                      setEditingContact(null)
                    }}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={saveContact}
                    style={{ backgroundColor: '#004D40', color: 'white' }}
                  >
                    Save Contact
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-end space-x-4">
            <Button onClick={onClose} variant="outline">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
              style={{ backgroundColor: '#004D40', color: 'white' }}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
} 