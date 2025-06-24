import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

export interface Contact {
  name: string
  title: string
  is_decision_maker: boolean
}

export interface ClientData {
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

interface ClientReviewProps {
  client: ClientData
  contacts: Contact[]
  onConfirm: (client: ClientData, contacts: Contact[]) => void
  onUpdateClient: (client: ClientData, contacts: Contact[]) => void
  loading?: boolean
}

export default function ClientReview({ client, contacts, onConfirm, onUpdateClient, loading }: ClientReviewProps) {
  const [clientData, setClientData] = useState<ClientData>(client)
  const [contactList, setContactList] = useState<Contact[]>(contacts)

  const handleClientChange = (field: keyof ClientData, value: string) => {
    const updatedClient = { ...clientData, [field]: value }
    setClientData(updatedClient)
    onUpdateClient(updatedClient, contactList)
  }

  const handleContactChange = (idx: number, field: keyof Contact, value: string | boolean) => {
    const updatedContacts = contactList.map((c, i) => i === idx ? { ...c, [field]: value } : c)
    setContactList(updatedContacts)
    onUpdateClient(clientData, updatedContacts)
  }

  return (
    <div className="card" style={{ border: '1px solid #e3e7ea', background: '#fff', boxShadow: '0 2px 8px rgba(44,62,80,0.04)', borderRadius: '12px', padding: '2rem' }}>
      <h2 className="text-xl font-bold mb-6" style={{ color: '#00796b' }}>Review Client Information</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <Label htmlFor="company_name" className="mb-1" style={{ color: '#5a5f63' }}>Company Name</Label>
          <Input id="company_name" value={clientData.company_name} onChange={e => handleClientChange('company_name', e.target.value)} className="mb-3" style={{ color: '#23272a' }} />
        </div>
        <div>
          <Label htmlFor="industry" className="mb-1" style={{ color: '#5a5f63' }}>Industry</Label>
          <Input id="industry" value={clientData.industry || ''} onChange={e => handleClientChange('industry', e.target.value)} className="mb-3" style={{ color: '#23272a' }} />
        </div>
        <div>
          <Label htmlFor="website" className="mb-1" style={{ color: '#5a5f63' }}>Website</Label>
          <Input id="website" value={clientData.website || ''} onChange={e => handleClientChange('website', e.target.value)} className="mb-3" style={{ color: '#23272a' }} />
        </div>
        <div>
          <Label htmlFor="linkedin_url" className="mb-1" style={{ color: '#5a5f63' }}>LinkedIn</Label>
          <Input id="linkedin_url" value={clientData.linkedin_url || ''} onChange={e => handleClientChange('linkedin_url', e.target.value)} className="mb-3" style={{ color: '#23272a' }} />
        </div>
        <div>
          <Label htmlFor="company_size" className="mb-1" style={{ color: '#5a5f63' }}>Company Size</Label>
          <Input id="company_size" value={clientData.company_size || ''} onChange={e => handleClientChange('company_size', e.target.value)} className="mb-3" style={{ color: '#23272a' }} />
        </div>
        <div>
          <Label htmlFor="revenue_range" className="mb-1" style={{ color: '#5a5f63' }}>Revenue Range</Label>
          <Input id="revenue_range" value={clientData.revenue_range || ''} onChange={e => handleClientChange('revenue_range', e.target.value)} className="mb-3" style={{ color: '#23272a' }} />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="description" className="mb-1" style={{ color: '#5a5f63' }}>Description</Label>
          <Input id="description" value={clientData.description || ''} onChange={e => handleClientChange('description', e.target.value)} className="mb-3" style={{ color: '#23272a' }} />
        </div>
      </div>
      <h3 className="text-lg font-semibold mb-3" style={{ color: '#00796b' }}>Contacts</h3>
      <div className="space-y-3 mb-8">
        {contactList.map((contact, idx) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center bg-[#f7f9fa] p-3 rounded border border-[#e3e7ea]">
            <div>
              <Label className="mb-1" style={{ color: '#5a5f63' }}>Name</Label>
              <Input value={contact.name} onChange={e => handleContactChange(idx, 'name', e.target.value)} style={{ color: '#23272a' }} />
            </div>
            <div>
              <Label className="mb-1" style={{ color: '#5a5f63' }}>Title</Label>
              <Input value={contact.title} onChange={e => handleContactChange(idx, 'title', e.target.value)} style={{ color: '#23272a' }} />
            </div>
            <div className="flex items-center mt-4 md:mt-0">
              <input type="checkbox" checked={contact.is_decision_maker} onChange={e => handleContactChange(idx, 'is_decision_maker', e.target.checked)} className="mr-2" />
              <span className="text-xs" style={{ color: '#5a5f63' }}>Decision Maker</span>
            </div>
          </div>
        ))}
      </div>
      <Button
        type="button"
        className="button-primary w-full py-3 text-lg font-semibold mt-2"
        style={{ background: '#00796b', color: '#fff', borderRadius: '8px' }}
        onClick={() => onConfirm(clientData, contactList)}
        disabled={loading}
      >
        {loading ? 'Saving...' : 'Confirm & Continue'}
      </Button>
    </div>
  )
} 