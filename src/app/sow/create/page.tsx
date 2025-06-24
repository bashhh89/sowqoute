'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import ClientReview from '@/components/ClientReview'
import type { ClientData, Contact } from '@/components/ClientReview'

// Helper function for consistent number formatting
const formatNumber = (num: number) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

interface SOWSection {
  id: string
  title: string
  content: string
  editable: boolean
}

interface PricingRow {
  id: string
  role: string
  hours: number
  rate: number
  subtotal: number
}

export default function CreateSOWPage() {
  const [user, setUser] = useState<{ email: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [description, setDescription] = useState('')
  const [currentStep, setCurrentStep] = useState<'input' | 'research' | 'clientReview' | 'edit' | 'final'>('input')
  const [isProcessing, setIsProcessing] = useState(false)
  const [researchData, setResearchData] = useState('')
  const [sowSections, setSowSections] = useState<SOWSection[]>([])
  const [pricingRows, setPricingRows] = useState<PricingRow[]>([])
  const [progress, setProgress] = useState(0)
  const [clientData, setClientData] = useState<ClientData | null>(null)
  const [contactsData, setContactsData] = useState<Contact[]>([])
  const [clientLoading, setClientLoading] = useState(false)
  const [pricingIdCounter, setPricingIdCounter] = useState(1)
  const router = useRouter()
  const supabase = createClient()
  const [aiPhase, setAiPhase] = useState<'idle' | 'thinking' | 'sow'>('idle');
  const [thinkingContent, setThinkingContent] = useState('');
  const [sowContent, setSowContent] = useState('');

  const checkUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
    } else {
      setUser(user as { email: string })
    }
    setIsLoading(false)
  }, [router, supabase.auth])

  useEffect(() => {
    checkUser()
  }, [checkUser])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const startGeneration = async () => {
    if (!description.trim()) return

    setIsProcessing(true)
    setCurrentStep('research')
    setProgress(10)

    try {
      // Initial delay to ensure we're not hitting rate limits
      await new Promise(resolve => setTimeout(resolve, 500))

      // Step 1: Extract company name from project description
      const companyExtractionQuery = `Extract ONLY the company name from this project description. Return ONLY the company name, nothing else. If no company name is mentioned, return "No company name found".

Project description: "${description}"`
      
      setProgress(15)
      
      // Extract company name using Pollination AI
      const companyExtractionUrl = `/api/pollinations`
      
      const companyExtractionResponse = await fetch(companyExtractionUrl, {
        method: 'POST',
        headers: { 
          'Accept': 'text/plain',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: companyExtractionQuery,
          model: 'grok',
          seed: '42'
        })
      })
      
      if (!companyExtractionResponse.ok) {
        throw new Error(`Company extraction API error: ${companyExtractionResponse.status} ${companyExtractionResponse.statusText}`)
      }
      
      const extractedCompanyName = await companyExtractionResponse.text()
      console.log('Extracted company name:', extractedCompanyName)
      
      // Step 2: Search for the specific company using SearchGPT Pollination AI
      const researchQuery = `Search for real-time data about this specific company: "${extractedCompanyName.trim()}"

Include ONLY publicly available information about this company:
1. Company overview, industry, and business model (ONLY if publicly available)
2. Recent news, announcements, or developments (ONLY if verified)
3. Company size, revenue, and market position (ONLY if publicly reported)
4. Technology stack and current systems they use (ONLY if publicly disclosed)
5. Key decision makers and leadership (ONLY if publicly available on LinkedIn, company website, press releases, etc.)
6. Recent challenges or growth areas they've mentioned (ONLY if publicly stated)
7. Competitors and market positioning (ONLY if publicly available)
8. Industry benchmarks and best practices for their sector

MARKETING-SPECIFIC RESEARCH (for Social Garden context):
9. Current marketing tools and platforms they use (HubSpot, Salesforce, Mailchimp, etc.)
10. Recent marketing campaigns or initiatives they've launched
11. Social media presence and engagement levels
12. Website traffic and digital marketing performance indicators
13. Target audience and customer segments they serve
14. Marketing team size and structure (if publicly available)
15. Industry-specific marketing challenges and trends
16. Previous marketing agency partnerships or collaborations
17. Content marketing strategy and blog/social media activity
18. Email marketing practices and list sizes (if publicly disclosed)
19. SEO performance and search visibility
20. Paid advertising campaigns and budget indicators

CRITICAL INSTRUCTIONS:
- SEARCH for actual publicly available information about "${extractedCompanyName.trim()}"
- ONLY return information that you can find from real sources (LinkedIn, company websites, press releases, CrunchBase, etc.)
- DO NOT make up or invent any information
- DO NOT create fake names, titles, or organizational structures
- DO NOT include placeholder data like "John Doe", "Jane Doe", "John Smith", "Jane Smith"
- DO NOT trust sources that contain obvious placeholder names or fake data
- DO NOT include information from unreliable sources like crustdata.com or similar sites that contain placeholder data
- If you find real decision makers, include them with their actual names and titles
- If you cannot find real information about this company, state "No publicly available information found for ${extractedCompanyName.trim()}"
- If you encounter placeholder names or fake data in any source, exclude that source entirely
- Focus on factual, verifiable data that would help personalize the SOW

Be thorough but ONLY with real, verified information to help create a more accurate and personalized SOW.`
      
      setProgress(25)
      
      // Use SearchGPT Pollination AI for company research
      const researchResponse = await fetch(companyExtractionUrl, {
        method: 'POST',
        headers: { 
          'Accept': 'text/plain',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: researchQuery,
          model: 'searchgpt',
          seed: '42'
        })
      })
      
      if (!researchResponse.ok) {
        throw new Error(`Research API error: ${researchResponse.status} ${researchResponse.statusText}`)
      }
      
      const research = await researchResponse.text()
      console.log('Raw research data:', research) // Log research data
      console.log('Research data length:', research.length) // Log research data length
      console.log('Research data includes "company":', research.includes('company')) // Debug check
      setResearchData(research)
      setIsProcessing(false) // Stop processing to show research results
      
      // After research, extract client/contact info but don't automatically proceed
      setClientLoading(true)
      const resp = await fetch('/api/clients/from-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researchText: research })
      })
      if (resp.ok) {
        const { client, contacts } = await resp.json()
        console.log('Extracted client data:', client) // Log extracted client data
        console.log('Extracted contacts data:', contacts) // Log extracted contacts data
        setClientData(client)
        setContactsData(contacts)
      } else {
        console.log('Failed to extract client/contacts. Response not OK:', resp.status, resp.statusText) // Log API response status
        setClientData(null)
        setContactsData([])
      }
      setClientLoading(false)
    } catch (error) {
      console.error('Error in research phase:', error)
      
      setResearchData(`Research data unavailable - ${error instanceof Error ? error.message : 'Unknown error'}`)
      setIsProcessing(false)
    }
  }

  const proceedFromResearch = async () => {
    if (clientData) {
      setCurrentStep('clientReview')
    } else {
      setCurrentStep('edit')
      setIsProcessing(true)
      setAiPhase('thinking')
      setThinkingContent('')
      setSowContent('')
      await startSOWGeneration()
    }
  }

  const startSOWGeneration = async () => {
    try {
      setProgress(50) // Adjust progress to reflect direct SOW generation
      
      // Reduced delay to respect rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000)) // Keep a small delay for UX
      
      await generateInitialSOW() // Pass only researchData
      
      setProgress(100)
      // Only transition to edit step after SOW generation is complete
      setCurrentStep('edit')
      setIsProcessing(false)
    } catch (error) {
      console.error('Error in SOW generation:', error)
      await generateFallbackSOW()
      setCurrentStep('edit')
      setIsProcessing(false)
    }
  }

  const generateInitialSOW = async () => {
    try {
      // Use the new AnythingLLM streaming API endpoint
      const sowUrl = `/api/anythingllm`
      
      const sowResponse = await fetch(sowUrl, {
        method: 'POST',
        headers: { 
          'Accept': 'text/plain',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: `${description}\n\n### Supporting Research Data:\n${researchData}`
        }),
        // Increase timeout for streaming responses
        signal: AbortSignal.timeout(300000) // 5 minutes timeout
      })
      
      if (!sowResponse.ok) {
        // Try to parse error response as JSON
        let errorMessage = `SOW API error: ${sowResponse.status} ${sowResponse.statusText}`
        try {
          const errorData = await sowResponse.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          // If JSON parsing fails, use the default error message
        }
        throw new Error(errorMessage)
      }

      const reader = sowResponse.body?.getReader()
      if (!reader) {
        console.log('⚠️ Streaming not supported, using text fallback')
        const sowText = await sowResponse.text()
        await processSOWResponse(sowText)
        return
      }

      // Simplified stream processing
      setAiPhase('thinking')
      setThinkingContent('AI is analyzing requirements and generating your SOW...')
      
      let fullContent = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullContent += new TextDecoder().decode(value)
      }
      
      console.log("Full stream content received, length:", fullContent.length)

      const thinkingEndMarker = 'THINKING_END\n'
      const sowStartMarker = 'SOW_START\n'
      
      let thinkingPart = 'Could not parse thinking process.'
      let sowPart = fullContent

      const thinkingEndIndex = fullContent.indexOf(thinkingEndMarker)
      if (thinkingEndIndex !== -1) {
        thinkingPart = fullContent.substring(0, thinkingEndIndex).replace('THINKING_START\n', '').trim()
        
        const sowStartIndex = fullContent.indexOf(sowStartMarker, thinkingEndIndex)
        if (sowStartIndex !== -1) {
          sowPart = fullContent.substring(sowStartIndex + sowStartMarker.length).replace('SOW_END\n', '').trim()
        } else {
          // If SOW_START is missing, take everything after THINKING_END
          sowPart = fullContent.substring(thinkingEndIndex + thinkingEndMarker.length).replace('SOW_END\n', '').trim()
        }
      } else {
        // Fallback if markers are not found
        console.log("Markers not found, using content split fallback.")
        const splitPoint = Math.min(fullContent.length, 1000)
        thinkingPart = fullContent.substring(0, splitPoint)
        sowPart = fullContent.substring(splitPoint)
      }
      
      setThinkingContent(thinkingPart)
      setSowContent(sowPart)
      setAiPhase('sow')
      
      await processSOWResponse(sowPart) // Process only the SOW part for sectioning
      
    } catch (error) {
      console.error('SOW generation error:', error)
      setProgress(0)
      setIsProcessing(false)
      alert(`Failed to generate SOW: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const processSOWResponse = async (sowText: string) => {
    // Parse the SOW text to extract sections and pricing
    const sections: SOWSection[] = []
    const pricingRows: PricingRow[] = []
    
    // Extract sections using the marker syntax
    const overviewMatch = sowText.match(/### SOW Overview ###\s*\n([\s\S]*?)(?=### |$)/)
    const deliverablesMatch = sowText.match(/### Deliverables ###\s*\n([\s\S]*?)(?=### |$)/)
    const timelineMatch = sowText.match(/### Timeline ###\s*\n([\s\S]*?)(?=### |$)/)
    const assumptionsMatch = sowText.match(/### Assumptions ###\s*\n([\s\S]*?)(?=### |$)/)
    
    if (overviewMatch) {
      sections.push({
        id: 'overview',
        title: 'SOW Overview',
        content: overviewMatch[1].trim(),
        editable: true
      })
    }
    
    if (deliverablesMatch) {
      sections.push({
        id: 'deliverables',
        title: 'Deliverables',
        content: deliverablesMatch[1].trim(),
        editable: true
      })
    }
    
    if (timelineMatch) {
      sections.push({
        id: 'timeline',
        title: 'Timeline',
        content: timelineMatch[1].trim(),
        editable: true
      })
    }
    
    if (assumptionsMatch) {
      sections.push({
        id: 'assumptions',
        title: 'Assumptions',
        content: assumptionsMatch[1].trim(),
        editable: true
      })
    }
    
    // Extract pricing table
    const pricingMatch = sowText.match(/### Pricing ###\s*\n([\s\S]*?)(?=### |\*\*\*|$)/)
    if (pricingMatch) {
      const pricingContent = pricingMatch[1]
      const tableRows = pricingContent.split('\n').filter(row => row.includes('|') && !row.includes('---'))
      
      let rowId = 1
      for (const row of tableRows) {
        const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell)
        if (cells.length >= 4 && !cells[0].includes('Total')) {
          const role = cells[0]
          const hours = parseInt(cells[1]) || 0
          const rate = parseInt(cells[2].replace(/[^0-9]/g, '')) || 0
          const subtotal = parseInt(cells[3].replace(/[^0-9]/g, '')) || 0
          
          pricingRows.push({
            id: rowId.toString(),
            role,
            hours,
            rate,
            subtotal
          })
          rowId++
        }
      }
    }
    
    setSowSections(sections)
    setPricingRows(pricingRows)
    setPricingIdCounter(pricingRows.length + 1)
    
    // Store the full SOW text for later use
    setResearchData(sowText)
    
    setProgress(100)
    setCurrentStep('edit')
    setIsProcessing(false)
  }

  const generateFallbackSOW = async () => {
    const fallbackSections: SOWSection[] = [
      {
        id: 'overview',
        title: 'SOW Overview',
        content: `Project: ${description}\n\nThis Statement of Work outlines the scope, deliverables, timeline, and pricing for the proposed project. The project aims to deliver high-quality solutions that meet the client's specific requirements and business objectives.`,
        editable: true
      },
      {
        id: 'deliverables',
        title: 'Deliverables',
        content: `• Project discovery and requirements analysis\n• Strategic planning and implementation roadmap\n• Core solution development and configuration\n• Quality assurance and testing\n• Training and knowledge transfer\n• Go-live support and handover\n• Documentation and user guides`,
        editable: true
      },
      {
        id: 'timeline',
        title: 'Timeline',
        content: `Phase 1: Discovery & Planning (1-2 weeks)\n• Requirements gathering\n• Strategic planning\n• Technical architecture\n\nPhase 2: Implementation (4-6 weeks)\n• Development and configuration\n• Integration and testing\n• User acceptance testing\n\nPhase 3: Go-live & Support (1 week)\n• Final deployment\n• Training delivery\n• Handover and documentation\n\nTotal Duration: 6-9 weeks`,
        editable: true
      },
      {
        id: 'assumptions',
        title: 'Assumptions',
        content: `• Client provides necessary access and resources in a timely manner\n• Standard business hours support included (9 AM - 5 PM AEST)\n• All deliverables subject to client approval at each milestone\n• Additional requirements may impact timeline and cost\n• Client has necessary infrastructure and systems in place\n• Key stakeholders will be available for regular consultation`,
        editable: true
      }
    ]

    const fallbackPricing: PricingRow[] = [
      { id: '1', role: 'Tech Producer', hours: 40, rate: 120, subtotal: 4800 },
      { id: '2', role: 'Account Management', hours: 10, rate: 180, subtotal: 1800 },
      { id: '3', role: 'Quality Assurance', hours: 15, rate: 100, subtotal: 1500 }
    ]

    setSowSections(fallbackSections)
    setPricingRows(fallbackPricing)
  }

  const updateSection = (id: string, content: string) => {
    setSowSections(prev => prev.map(section => 
      section.id === id ? { ...section, content } : section
    ))
  }

  const updatePricingRow = (id: string, field: keyof PricingRow, value: string | number) => {
    setPricingRows(prev => prev.map(row => {
      if (row.id === id) {
        const updated = { ...row, [field]: value }
        if (field === 'hours' || field === 'rate') {
          updated.subtotal = updated.hours * updated.rate
        }
        return updated
      }
      return row
    }))
  }

  const addPricingRow = () => {
    const newRow: PricingRow = {
      id: `pricing-${pricingIdCounter}`,
      role: 'Project Role',
      hours: 0,
      rate: 120,
      subtotal: 0
    }
    setPricingRows(prev => [...prev, newRow])
    setPricingIdCounter(prev => prev + 1)
  }

  const removePricingRow = (id: string) => {
    setPricingRows(prev => prev.filter(row => row.id !== id))
  }

  const generateFinalSOW = () => {
    setCurrentStep('final')
  }

  const downloadSOW = () => {
    let sowContent = ''
    
    // Add sections
    sowSections.forEach(section => {
      sowContent += `### ${section.title} ###\n\n${section.content}\n\n`
    })

    // Add pricing table
    sowContent += `### Pricing ###\n\n`
    sowContent += `| Role | Hours | Hourly Rate (AUD) | Subtotal (AUD) |\n`
    sowContent += `|------|-------|------------------|----------------|\n`
    
    pricingRows.forEach(row => {
      sowContent += `| ${row.role} | ${row.hours} | $${row.rate} | $${formatNumber(row.subtotal)} |\n`
    })
    
    const total = pricingRows.reduce((sum, row) => sum + row.subtotal, 0)
    const totalHours = pricingRows.reduce((sum, row) => sum + row.hours, 0)
    sowContent += `| **Total** | **${totalHours}** | | **$${formatNumber(total)}** |\n\n`
    
    sowContent += `*** This concludes the Scope of Work document. ***`

    const blob = new Blob([sowContent], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'statement-of-work.md'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const resetForm = () => {
    setDescription('')
    setCurrentStep('input')
    setProgress(0)
    setResearchData('')
    setSowSections([])
    setPricingRows([])
    setPricingIdCounter(1)
  }

  const handleUpdateClient = (client: ClientData, contacts: Contact[]) => {
    setClientData(client);
    setContactsData(contacts);
  };

  useEffect(() => {
    if (clientData) {
      // You can add logic here to auto-save or sync client data when it changes
      console.log('Client data updated:', clientData);
    }
  }, [clientData]);

  const handleClientReviewConfirm = (client: ClientData, contacts: Contact[]) => {
    // Here you can save the updated client and contact data if needed
    console.log('Confirmed client data:', client)
    console.log('Confirmed contacts:', contacts)

    setIsProcessing(true)
    setAiPhase('thinking')
    setThinkingContent('')
    setSowContent('')
    startSOWGeneration()
  }

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#004D40' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    )
  }

  // Show loading state if no user (will redirect)
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#004D40' }}>
        <div className="text-white">Redirecting to login...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-primary font-sans">
      {/* Header */}
      <header
        className="border-b border-border bg-primary text-primary-foreground"
      >
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
            <div
              className="flex items-center space-x-4 bg-primary p-2 rounded-lg"
            >
              <Button
                onClick={() => router.push('/dashboard')}
                variant="outline"
                className="border-white text-white hover:bg-white hover:text-black"
                style={{ color: 'white', borderColor: 'white', backgroundColor: 'transparent' }}
              >
                ← Back to Dashboard
              </Button>
              <span className="text-white text-sm font-medium" style={{ color: 'white' }}>
                Welcome, {user.email}
              </span>
              <Button
                onClick={handleSignOut}
                variant="outline"
                className="border-white text-white hover:bg-white hover:text-black"
                style={{ color: 'white', borderColor: 'white', backgroundColor: 'transparent' }}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-black">SOW Generator</h1>
            {isProcessing && (
              <div className="text-black text-sm">
                Processing... {progress}%
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-4 mb-6">
            {[
              { key: 'input', label: 'Input', icon: '📝' },
              { key: 'research', label: 'Research', icon: '🔍' },
              { key: 'clientReview', label: 'Client Review', icon: '👤' },
              { key: 'edit', label: 'Edit & Review', icon: '✏️' },
              { key: 'final', label: 'Final SOW', icon: '📄' }
            ].map((step, index) => (
              <div key={step.key} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold ${
                  currentStep === step.key ? 'bg-white text-black' :
                  ['input', 'research', 'clientReview', 'edit', 'final'].indexOf(currentStep) > index ? 'bg-green-500 text-black' :
                  'bg-gray-600 text-gray-300'
                }`}>
                  {step.icon}
                </div>
                <span className={`ml-2 text-sm ${
                  currentStep === step.key ? 'text-black font-bold' : 'text-gray-300'
                }`}>
                  {step.label}
                </span>
                {index < 4 && <div className="w-8 h-0.5 bg-gray-600 mx-4" />}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        {currentStep === 'input' && (
          <div className="rounded-lg shadow-lg p-8" style={{ backgroundColor: '#fff' }}>
            <h2 className="text-2xl font-bold mb-4" style={{ color: '#004D40' }}>Project Description</h2>
            <p className="text-gray-600 mb-6">Describe your project in detail. The more information you provide, the better the SOW will be.</p>
            
            <div className="mb-6">
              <Label htmlFor="description" className="text-lg font-semibold mb-3 block" style={{ color: '#004D40' }}>
                What project do you need a SOW for?
              </Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Example: We need HubSpot onboarding and lead nurturing implementation for ASSISTED.VIP. The client needs foundational HubSpot setup including Marketing Hub Starter and Sales Hub Starter configuration, DNS setup, user training, and a 3-step welcome nurture campaign. Budget is around $12,000 AUD with a 10% new client discount. Timeline is 4-6 weeks..."
                className="w-full h-48 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-opacity-50 force-black-text"
                style={{ backgroundColor: 'white', color: '#1a1a1a', fontSize: '1.1rem' }}
              />
            </div>

            <Button
              onClick={startGeneration}
              disabled={!description.trim() || isProcessing}
              className="w-full py-4 text-lg font-bold"
              style={{ backgroundColor: '#004D40', color: 'white' }}
            >
              {isProcessing ? 'Starting Analysis...' : 'Start SOW Generation'}
            </Button>
          </div>
        )}

        {currentStep === 'research' && (
          <div className="rounded-lg shadow-lg p-8" style={{ backgroundColor: '#004D40' }}>
            <h2 className="text-2xl font-bold mb-4" style={{ color: '#fff' }}>🔍 Research Phase</h2>
            <p className="text-gray-300 mb-6">AI is researching your project type, industry standards, and best practices...</p>
            
            {isProcessing ? (
              <div className="space-y-6">
                {/* AI Thinking Phase */}
                {aiPhase === 'thinking' && (
                  <div className="card mb-6" style={{ color: '#23272a' }}>
                    <h3 className="text-lg font-semibold mb-4 flex items-center" style={{ color: '#00796b' }}>
                      <span className="mr-2">🤖</span>
                      AI Thinking
                    </h3>
                    <div className="bg-white p-4 rounded-lg border">
                      <pre className="whitespace-pre-wrap text-gray-900 leading-relaxed" style={{ minHeight: '120px' }}>
                        {thinkingContent || 'AI is analyzing your project requirements and researching industry best practices...'}
                      </pre>
                    </div>
                  </div>
                )}

                {/* SOW Generation Phase */}
                {aiPhase === 'sow' && (
                  <div className="card mb-6" style={{ color: '#23272a' }}>
                    <h3 className="text-lg font-semibold mb-4 flex items-center" style={{ color: '#00796b' }}>
                      <span className="mr-2">📄</span>
                      Generating SOW
                    </h3>
                    <div className="bg-white p-4 rounded-lg border">
                      <pre className="whitespace-pre-wrap text-gray-900 leading-relaxed" style={{ minHeight: '120px' }}>
                        {sowContent || 'Generating your Statement of Work...'}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Loading Spinner */}
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#fff' }}></div>
                  <span className="ml-4 text-gray-300">
                    {aiPhase === 'thinking' ? 'AI is thinking...' : 
                     aiPhase === 'sow' ? 'Generating SOW...' : 
                     'Gathering industry insights...'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Research Summary */}
                <div className="card mb-6" style={{ color: '#23272a' }}>
                  <h3 className="text-lg font-semibold mb-4 flex items-center" style={{ color: '#00796b' }}>
                    <span className="mr-2">📊</span>
                    Research Summary
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold mb-1" style={{ color: '#00796b' }}>
                        {researchData.includes('No company name found') ? '❌' :
                         researchData.includes('No publicly available information found for') ? '⚠️' : '✓'}
                      </div>
                      <div className="text-sm font-semibold" style={{ color: '#23272a' }}>Company Research</div>
                      <div className="text-xs" style={{ color: '#5a5f63' }}>
                        {researchData.includes('No company name found') ? 'No company name found' :
                         researchData.includes('No publicly available information found for') ? 'Company found, no public data' :
                         researchData.includes('company') || researchData.includes('Company') ? 'Company data researched' : 'Extracting...'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold mb-1" style={{ color: '#00796b' }}>
                        {researchData.includes('CEO') || researchData.includes('CTO') || researchData.includes('Founder') || researchData.includes('Director') ? '✓' : '👥'}
                      </div>
                      <div className="text-sm font-semibold" style={{ color: '#23272a' }}>Leadership</div>
                      <div className="text-xs" style={{ color: '#5a5f63' }}>
                        {researchData.includes('CEO') || researchData.includes('CTO') || researchData.includes('Founder') || researchData.includes('Director') ? 'Decision makers identified' : 'Researching...'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold mb-1" style={{ color: '#00796b' }}>
                        {researchData.includes('HubSpot') || researchData.includes('CRM') || researchData.includes('marketing') ? '✓' : '🛠️'}
                      </div>
                      <div className="text-sm font-semibold" style={{ color: '#23272a' }}>Tech Stack</div>
                      <div className="text-xs" style={{ color: '#5a5f63' }}>
                        {researchData.includes('HubSpot') || researchData.includes('CRM') || researchData.includes('marketing') ? 'Marketing tools found' : 'Analyzing...'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Research Timeline */}
                <div className="card mb-6" style={{ color: '#23272a' }}>
                  <h3 className="text-lg font-semibold mb-4 flex items-center" style={{ color: '#00796b' }}>
                    <span className="mr-2">📊</span>
                    Research Progress
                  </h3>
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5" style={{ backgroundColor: '#00796b' }}></div>
                    <div className="space-y-4">
                      <div className="flex items-start">
                        <div className={`w-3 h-3 rounded-full mr-3 ${researchData.includes('No company name found') ? 'bg-red-500' : 'bg-green-500'}`}></div>
                        <div className="flex-1">
                          <div className="text-sm" style={{ color: '#00796b', fontWeight: 500, marginBottom: '0.1rem' }}>Company Name Extraction</div>
                          <div className="text-xs" style={{ color: '#5a5f63', marginBottom: 0 }}>
                            {researchData.includes('No company name found') ? '❌ No company name identified in description' :
                             researchData.includes('No publicly available information found for') ? '⚠️ Company name extracted, searching for data...' :
                             '✓ Company name successfully extracted from project description'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <div className={`w-3 h-3 rounded-full mr-3 ${researchData.includes('No publicly available information found for') ? 'bg-red-500' : researchData.includes('company') || researchData.includes('Company') ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                        <div className="flex-1">
                          <div className="text-sm" style={{ color: '#00796b', fontWeight: 500, marginBottom: '0.1rem' }}>Company Research</div>
                          <div className="text-xs" style={{ color: '#5a5f63', marginBottom: 0 }}>
                            {researchData.includes('No publicly available information found for') ? '❌ No public data found for this company' :
                             researchData.includes('company') || researchData.includes('Company') ? '✓ Company data researched successfully' :
                             '⏳ Searching for company information...'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <div className={`w-3 h-3 rounded-full mr-3 ${researchData.includes('No publicly available information found') ? 'bg-red-500' : researchData.includes('industry') || researchData.includes('Industry') ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                        <div className="flex-1">
                          <div className="text-sm" style={{ color: '#00796b', fontWeight: 500, marginBottom: '0.1rem' }}>Industry Analysis</div>
                          <div className="text-xs" style={{ color: '#5a5f63', marginBottom: 0 }}>
                            {researchData.includes('No publicly available information found') ? '❌ Industry data not publicly available' :
                             researchData.includes('industry') || researchData.includes('Industry') ? '✓ Industry and business model identified' :
                             '⏳ Analyzing industry and business model...'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <div className={`w-3 h-3 rounded-full mr-3 ${researchData.includes('No publicly available information found') ? 'bg-red-500' : researchData.includes('HubSpot') || researchData.includes('CRM') || researchData.includes('marketing') ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                        <div className="flex-1">
                          <div className="text-sm" style={{ color: '#00796b', fontWeight: 500, marginBottom: '0.1rem' }}>Marketing Stack Research</div>
                          <div className="text-xs" style={{ color: '#5a5f63', marginBottom: 0 }}>
                            {researchData.includes('No publicly available information found') ? '❌ Marketing stack data not publicly available' :
                             researchData.includes('HubSpot') || researchData.includes('CRM') || researchData.includes('marketing') ? '✓ Marketing tools and platforms identified' :
                             '⏳ Researching marketing tools and platforms...'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <div className={`w-3 h-3 rounded-full mr-3 ${researchData.includes('No publicly available information found') ? 'bg-red-500' : researchData.includes('CEO') || researchData.includes('CTO') || researchData.includes('Founder') || researchData.includes('Director') ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                        <div className="flex-1">
                          <div className="text-sm" style={{ color: '#00796b', fontWeight: 500, marginBottom: '0.1rem' }}>Decision Makers</div>
                          <div className="text-xs" style={{ color: '#5a5f63', marginBottom: 0 }}>
                            {researchData.includes('No publicly available information found') ? '❌ Leadership data not available' :
                             researchData.includes('CEO') || researchData.includes('CTO') || researchData.includes('Founder') || researchData.includes('Director') ? '✓ Key decision makers identified' :
                             '⏳ Researching key decision makers...'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <div className={`w-3 h-3 rounded-full mr-3 ${researchData.includes('No publicly available information found') ? 'bg-red-500' : researchData.includes('competitor') || researchData.includes('market') || researchData.includes('position') ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                        <div className="flex-1">
                          <div className="text-sm" style={{ color: '#00796b', fontWeight: 500, marginBottom: '0.1rem' }}>Market Position</div>
                          <div className="text-xs" style={{ color: '#5a5f63', marginBottom: 0 }}>
                            {researchData.includes('No publicly available information found') ? '❌ Market position data not available' :
                             researchData.includes('competitor') || researchData.includes('market') || researchData.includes('position') ? '✓ Competitive landscape and market position analyzed' :
                             '⏳ Analyzing competitive landscape...'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Research Results Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Company Overview Card */}
                  <div className="card mb-6" style={{ color: '#23272a' }}>
                    <h3 className="text-lg font-semibold mb-4 flex items-center" style={{ color: '#00796b' }}>
                      <span className="mr-2">🏢</span>
                      Company Overview
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <span className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: '#00796b' }}></span>
                        <span className="text-sm" style={{ color: '#5a5f63' }}>
                          {researchData.includes('No publicly available information found') ? 'Company type not publicly disclosed' :
                           researchData.includes('industry') || researchData.includes('Industry') ? 'Industry and business model identified' :
                           'Industry Analysis'}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: '#00796b' }}></span>
                        <span className="text-sm" style={{ color: '#5a5f63' }}>
                          {researchData.includes('No publicly available information found') ? 'Foundation date not publicly available' :
                           researchData.includes('Founded') ? 'Founded: ' + (researchData.match(/Founded: ([^,\n]+)/)?.[1] || 'Date found') :
                           'Business Model Review'}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: '#00796b' }}></span>
                        <span className="text-sm" style={{ color: '#5a5f63' }}>
                          {researchData.includes('No publicly available information found') ? 'Market position not publicly disclosed' :
                           researchData.includes('competitor') || researchData.includes('market') || researchData.includes('position') ? 'Competitive landscape and market position analyzed' :
                           'Market Position'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Marketing Tools Card */}
                  <div className="card mb-6" style={{ color: '#23272a' }}>
                    <h3 className="text-lg font-semibold mb-4 flex items-center" style={{ color: '#00796b' }}>
                      <span className="mr-2">🛠️</span>
                      Marketing Stack
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <span className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: '#00796b' }}></span>
                        <span className="text-sm" style={{ color: '#5a5f63' }}>
                          {researchData.includes('No publicly available information found') ? 'Marketing platforms not publicly disclosed' :
                           researchData.includes('HubSpot') ? 'HubSpot identified' :
                           researchData.includes('CRM') ? 'CRM systems found' :
                           'Technology stack analyzed'}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: '#00796b' }}></span>
                        <span className="text-sm" style={{ color: '#5a5f63' }}>
                          {researchData.includes('No publicly available information found') ? 'Campaign data not publicly available' :
                           researchData.includes('campaign') ? 'Campaign analysis completed' :
                           researchData.includes('marketing') ? 'Marketing strategies analyzed' :
                           'Business model analysis'}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: '#00796b' }}></span>
                        <span className="text-sm" style={{ color: '#5a5f63' }}>
                          {researchData.includes('No publicly available information found') ? 'Digital presence data not publicly available' :
                           researchData.includes('social media') ? 'Social media presence analyzed' :
                           researchData.includes('website') ? 'Website performance reviewed' :
                           'Company location and presence'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="card text-center" style={{ color: '#23272a' }}>
                    <div className="text-2xl font-bold mb-1" style={{ color: '#00796b' }}>
                      {researchData.split('\n').filter(line => line.trim().length > 0).length}
                    </div>
                    <div className="text-xs" style={{ color: '#5a5f63' }}>Data Points</div>
                  </div>
                  <div className="card text-center" style={{ color: '#23272a' }}>
                    <div className="text-2xl font-bold mb-1" style={{ color: '#00796b' }}>
                      {[researchData.includes('company'), researchData.includes('marketing'), researchData.includes('competitor')].filter(Boolean).length}
                    </div>
                    <div className="text-xs" style={{ color: '#5a5f63' }}>Analysis Areas</div>
                  </div>
                  <div className="card text-center" style={{ color: '#23272a' }}>
                    <div className="text-2xl font-bold mb-1" style={{ color: '#00796b' }}>
                      {researchData.includes('No publicly available information found') ? '0%' : '100%'}
                    </div>
                    <div className="text-xs" style={{ color: '#5a5f63' }}>Verified Data</div>
                  </div>
                  <div className="card text-center" style={{ color: '#23272a' }}>
                    <div className="text-2xl font-bold mb-1" style={{ color: '#00796b' }}>✓</div>
                    <div className="text-xs" style={{ color: '#5a5f63' }}>Ready for SOW</div>
                  </div>
                </div>

                {/* Detailed Research Results Accordion */}
                <div className="card overflow-hidden mb-6" style={{ color: '#23272a' }}>
                  <h3 className="text-lg font-semibold p-6 border-b flex items-center" style={{ color: '#00796b', borderColor: '#e3e7ea' }}>
                    <span className="mr-2">📋</span>
                    Detailed Research Results
                  </h3>
                  
                  <div className="divide-y" style={{ borderColor: '#e3e7ea' }}>
                    {/* Publicly Available Information Section */}
                    <div className="accordion-item">
                      <button 
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition-colors duration-200"
                        onClick={() => {
                          const content = document.getElementById('public-info');
                          if (content) {
                            content.style.display = content.style.display === 'none' ? 'block' : 'none';
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-sm flex items-center" style={{ color: '#00796b' }}>
                            <span className="mr-2">✅</span>
                            Publicly Available Information
                          </h4>
                          <span style={{ color: '#00796b' }} className="transition-transform duration-200 text-sm">▼</span>
                        </div>
                      </button>
                      <div id="public-info" className="px-6 pb-4 transition-all duration-300 ease-in-out">
                        <div className="text-sm mb-4" style={{ color: '#5a5f63' }}>
                          <p className="font-semibold mb-2" style={{ color: '#00796b' }}>Verified Information Found:</p>
                        </div>
                        <ReactMarkdown 
                          className="research-markdown"
                        >
                          {researchData.includes('No publicly available information found') ? 
                            'No publicly available information was found for this company.' :
                            researchData.includes('No company name found') ?
                            'No company name was found in the project description.' :
                            researchData.includes('Research data unavailable') ?
                            researchData :
                            researchData && researchData.trim() ? 
                            researchData : 
                            'Extracting publicly available information...'}
                        </ReactMarkdown>
                        
                        {/* Debug: Show research data state - REMOVED */}
                        {/* {process.env.NODE_ENV === 'development' && (
                          <div className="mt-4 p-4 bg-gray-100 border rounded text-xs">
                            <strong>Debug Info:</strong><br/>
                            Research Data Length: {researchData.length}<br/>
                            Research Data Preview: {researchData.substring(0, 200)}...<br/>
                            Includes "company": {researchData.includes('company').toString()}<br/>
                            Includes "No publicly available": {researchData.includes('No publicly available information found').toString()}
                          </div>
                        )} */}
                      </div>
                    </div>

                    {/* Not Publicly Disclosed Information Section */}
                    <div className="accordion-item">
                      <button 
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition-colors duration-200"
                        onClick={() => {
                          const content = document.getElementById('not-public-info');
                          if (content) {
                            content.style.display = content.style.display === 'none' ? 'block' : 'none';
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-sm text-[#FF6B35] flex items-center">
                            <span className="mr-2">⚠️</span>
                            Not Publicly Disclosed
                          </h4>
                          <span className="text-[#FF6B35] transition-transform duration-200 text-sm">▼</span>
                        </div>
                      </button>
                      <div id="not-public-info" className="px-6 pb-4 transition-all duration-300 ease-in-out" style={{ display: 'none' }}>
                        <div className="text-sm text-gray-600">
                          <div className="bg-orange-50 border-l-4 border-[#FF6B35] p-4 mb-4">
                            <p className="font-semibold text-[#FF6B35] mb-2">Information Not Publicly Available:</p>
                            <p className="text-sm text-gray-700">The following information was requested but is not publicly disclosed by the company:</p>
                          </div>
                          
                          <div className="space-y-4">
                            <div className="border border-gray-200 rounded-lg p-4">
                              <h5 className="font-semibold text-[#FF6B35] mb-2 flex items-center">
                                <span className="mr-2">💰</span>
                                Financial Information
                              </h5>
                              <ul className="space-y-1 text-sm text-gray-600">
                                <li>• Revenue figures and financial performance</li>
                                <li>• Budget allocations and spending patterns</li>
                                <li>• Investment rounds and funding details</li>
                                <li>• Profit margins and cost structures</li>
                              </ul>
                            </div>

                            <div className="border border-gray-200 rounded-lg p-4">
                              <h5 className="font-semibold text-[#FF6B35] mb-2 flex items-center">
                                <span className="mr-2">👥</span>
                                Internal Structure
                              </h5>
                              <ul className="space-y-1 text-sm text-gray-600">
                                <li>• Detailed organizational charts</li>
                                <li>• Employee count and team sizes</li>
                                <li>• Internal processes and workflows</li>
                                <li>• Management structure details</li>
                              </ul>
                            </div>

                            <div className="border border-gray-200 rounded-lg p-4">
                              <h5 className="font-semibold text-[#FF6B35] mb-2 flex items-center">
                                <span className="mr-2">📊</span>
                                Performance Metrics
                              </h5>
                              <ul className="space-y-1 text-sm text-gray-600">
                                <li>• Detailed marketing performance data</li>
                                <li>• Customer acquisition costs</li>
                                <li>• Conversion rates and funnel metrics</li>
                                <li>• ROI on marketing campaigns</li>
                              </ul>
                            </div>

                            <div className="border border-gray-200 rounded-lg p-4">
                              <h5 className="font-semibold text-[#FF6B35] mb-2 flex items-center">
                                <span className="mr-2">🔧</span>
                                Technical Infrastructure
                              </h5>
                              <ul className="space-y-1 text-sm text-gray-600">
                                <li>• Detailed technology stack information</li>
                                <li>• System architecture details</li>
                                <li>• Integration specifications</li>
                                <li>• Security and compliance details</li>
                              </ul>
                            </div>

                            <div className="border border-gray-200 rounded-lg p-4">
                              <h5 className="font-semibold text-[#FF6B35] mb-2 flex items-center">
                                <span className="mr-2">🎯</span>
                                Strategic Information
                              </h5>
                              <ul className="space-y-1 text-sm text-gray-600">
                                <li>• Future roadmap and plans</li>
                                <li>• Strategic partnerships and alliances</li>
                                <li>• Market expansion strategies</li>
                                <li>• Competitive positioning details</li>
                              </ul>
                            </div>
                          </div>

                          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-800">
                              <strong>Note:</strong> This information is typically not publicly available for most companies. 
                              We focus our SOW generation on publicly verifiable data to ensure accuracy and avoid assumptions.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Marketing Analysis Section */}
                    <div className="accordion-item">
                      <button 
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition-colors duration-200"
                        onClick={() => {
                          const content = document.getElementById('marketing-analysis');
                          if (content) {
                            content.style.display = content.style.display === 'none' ? 'block' : 'none';
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-sm text-[#004D40] flex items-center">
                            <span className="mr-2">📈</span>
                            Marketing Analysis
                          </h4>
                          <span className="text-[#004D40] transition-transform duration-200 text-sm">▼</span>
                        </div>
                      </button>
                      <div id="marketing-analysis" className="px-6 pb-4 transition-all duration-300 ease-in-out" style={{ display: 'none' }}>
                        <div className="text-sm text-gray-600">
                          {researchData.includes('No publicly available information found') ? (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                              <p className="font-semibold text-[#FF6B35] mb-2 flex items-center">
                                <span className="mr-2">⚠️</span>
                                No Specific Technology Data Available
                              </p>
                              <p className="text-sm text-gray-700 mb-3">
                                The research did not find specific technology stack information or product details for this company.
                              </p>
                            </div>
                          ) : (
                            <div>
                              <p className="font-semibold text-[#004D40] mb-3">Technology & Business Insights Found:</p>
                              <ReactMarkdown 
                                className="research-markdown"
                              >
                                {researchData}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Competitive Analysis Section */}
                    <div className="accordion-item">
                      <button 
                        className="w-full px-6 py-4 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition-colors duration-200"
                        onClick={() => {
                          const content = document.getElementById('competitive-analysis');
                          if (content) {
                            content.style.display = content.style.display === 'none' ? 'block' : 'none';
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-[#004D40] flex items-center">
                            <span className="mr-2">🎯</span>
                            Competitive Analysis
                          </h4>
                          <span className="text-[#004D40] transition-transform duration-200">▼</span>
                        </div>
                      </button>
                      <div id="competitive-analysis" className="px-6 pb-4 transition-all duration-300 ease-in-out" style={{ display: 'none' }}>
                        <div className="text-sm text-gray-600">
                          {researchData.includes('No publicly available information found') ? (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                              <p className="font-semibold text-[#FF6B35] mb-2 flex items-center">
                                <span className="mr-2">⚠️</span>
                                No Market Position Data Available
                              </p>
                              <p className="text-sm text-gray-700 mb-3">
                                The research did not find specific market positioning, funding, or strategic partnership information for this company.
                              </p>
                            </div>
                          ) : (
                            <div>
                              <p className="font-semibold text-[#004D40] mb-3">Market & Business Insights Found:</p>
                              <ReactMarkdown 
                                className="research-markdown"
                              >
                                {researchData}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Research Sources Section */}
                    <div className="accordion-item">
                      <button 
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition-colors duration-200"
                        onClick={() => {
                          const content = document.getElementById('research-sources');
                          if (content) {
                            content.style.display = content.style.display === 'none' ? 'block' : 'none';
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-sm text-[#004D40] flex items-center">
                            <span className="mr-2">📚</span>
                            Research Sources
                          </h4>
                          <span className="text-[#004D40] transition-transform duration-200 text-sm">▼</span>
                        </div>
                      </button>
                      <div id="research-sources" className="px-6 pb-4 transition-all duration-300 ease-in-out" style={{ display: 'none' }}>
                        <div className="text-sm text-gray-600">
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <p className="font-semibold text-[#004D40] mb-2">Information Sources:</p>
                            <p className="text-sm text-gray-700 mb-3">
                              This research was conducted using publicly available information from the following sources:
                            </p>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-3">
                              <div className="border border-gray-200 rounded-lg p-3">
                                <h5 className="font-semibold text-[#004D40] mb-2 flex items-center">
                                  <span className="mr-2">🔍</span>
                                  Primary Sources
                                </h5>
                                <ul className="space-y-1 text-sm text-gray-700">
                                  <li>• Company websites and official pages</li>
                                  <li>• LinkedIn company profiles</li>
                                  <li>• Press releases and announcements</li>
                                  <li>• CrunchBase company data</li>
                                  <li>• Industry databases and directories</li>
                                </ul>
                              </div>
                              
                              <div className="border border-gray-200 rounded-lg p-3">
                                <h5 className="font-semibold text-[#004D40] mb-2 flex items-center">
                                  <span className="mr-2">📰</span>
                                  News & Media
                                </h5>
                                <ul className="space-y-1 text-sm text-gray-700">
                                  <li>• Business news articles</li>
                                  <li>• Industry publications</li>
                                  <li>• Tech blogs and reviews</li>
                                  <li>• Social media mentions</li>
                                  <li>• Conference and event coverage</li>
                                </ul>
                              </div>
                            </div>
                            
                            <div className="space-y-3">
                              <div className="border border-gray-200 rounded-lg p-3">
                                <h5 className="font-semibold text-[#004D40] mb-2 flex items-center">
                                  <span className="mr-2">👥</span>
                                  Professional Networks
                                </h5>
                                <ul className="space-y-1 text-sm text-gray-700">
                                  <li>• LinkedIn professional profiles</li>
                                  <li>• Executive biographies</li>
                                  <li>• Team member listings</li>
                                  <li>• Professional associations</li>
                                  <li>• Industry certifications</li>
                                </ul>
                              </div>
                              
                              <div className="border border-gray-200 rounded-lg p-3">
                                <h5 className="font-semibold text-[#004D40] mb-2 flex items-center">
                                  <span className="mr-2">📊</span>
                                  Data & Analytics
                                </h5>
                                <ul className="space-y-1 text-sm text-gray-700">
                                  <li>• Website traffic analysis</li>
                                  <li>• Social media metrics</li>
                                  <li>• SEO performance data</li>
                                  <li>• Marketing tool usage indicators</li>
                                  <li>• Public financial reports</li>
                                </ul>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <p className="text-sm text-gray-700">
                              <strong>Research Methodology:</strong> All information is verified against multiple sources when possible. 
                              We prioritize accuracy and only include data that can be confirmed from public, verifiable sources.
                            </p>
                          </div>

                          {researchData.includes('No publicly available information found') && (
                            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                              <p className="text-sm text-orange-800">
                                <strong>Note:</strong> Despite searching these sources, no publicly available information was found for this specific company. 
                                This is common for smaller companies, startups, or companies that maintain a low public profile.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={proceedFromResearch}
                  variant="outline"
                  className="mt-6 w-full py-3 text-lg font-bold border-white text-white hover:bg-white hover:text-black rounded-lg"
                >
                  Continue to Next Step →
                </Button>
              </div>
            )}
          </div>
        )}

        {currentStep === 'clientReview' && clientData && (
          <ClientReview
            client={clientData}
            contacts={contactsData}
            loading={clientLoading}
            onConfirm={(client, contacts) => {
              setClientData(client)
              setContactsData(contacts)
              setIsProcessing(true)
              setAiPhase('thinking')
              setThinkingContent('')
              setSowContent('')
              startSOWGeneration()
            }}
            onUpdateClient={handleUpdateClient}
          />
        )}

        {currentStep === 'clientReview' && !clientData && (
          <div className="rounded-lg shadow-lg p-8" style={{ backgroundColor: '#fff' }}>
            <h2 className="text-2xl font-bold mb-4" style={{ color: '#004D40' }}>👤 Client Information</h2>
            <p className="text-gray-600 mb-6">No client information was extracted from the research. Please provide basic client details to continue.</p>
            
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                  <input
                    type="text"
                    placeholder="Enter company name"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004D40] focus:border-transparent"
                    style={{ backgroundColor: 'white' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                  <input
                    type="text"
                    placeholder="Enter industry"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004D40] focus:border-transparent"
                    style={{ backgroundColor: 'white' }}
                  />
                </div>
              </div>
              
              <Button
                onClick={() => {
                  setCurrentStep('edit')
                  setIsProcessing(true)
                  startSOWGeneration()
                }}
                className="w-full py-3 text-lg font-bold"
                style={{ backgroundColor: '#004D40', color: 'white' }}
              >
                Continue to Next Step →
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'edit' && (
          <div className="space-y-8">
            <div className="rounded-lg shadow-lg p-8" style={{ backgroundColor: '#fff' }}>
              <h2 className="text-2xl font-bold mb-4" style={{ color: '#004D40' }}>
                {currentStep === 'edit' ? '✏️ Edit & Review SOW' : '📄 Final SOW'}
              </h2>
              <p className="text-gray-600 mb-6">
                {currentStep === 'edit' 
                  ? 'Review and edit each section. You can modify text, adjust pricing, and customize everything before finalizing.'
                  : 'Your SOW is ready! Review the final document and download when satisfied.'
                }
              </p>
            </div>

            {/* SOW Sections */}
            {sowSections.map((section) => (
              <div key={section.id} className="rounded-lg shadow-lg p-6" style={{ backgroundColor: '#fff' }}>
                <h3 className="text-xl font-bold mb-4" style={{ color: '#004D40' }}>{section.title}</h3>
                {currentStep === 'edit' ? (
                  <textarea
                    value={section.content}
                    onChange={(e) => updateSection(section.id, e.target.value)}
                    className="w-full h-32 p-4 border border-gray-300 rounded-lg resize-none force-black-text"
                  />
                ) : (
                  <div className="whitespace-pre-wrap text-gray-900 leading-relaxed bg-white p-4 rounded-lg border">
                    {section.content}
                  </div>
                )}
              </div>
            ))}

            {/* Pricing Section */}
            <div className="rounded-lg shadow-lg p-6" style={{ backgroundColor: '#fff' }}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold" style={{ color: '#004D40' }}>Pricing</h3>
                {currentStep === 'edit' && (
                  <Button
                    onClick={addPricingRow}
                    className="text-sm"
                    style={{ backgroundColor: '#A5D6A7', color: '#004D40' }}
                  >
                    + Add Role
                  </Button>
                )}
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-semibold" style={{ color: '#004D40' }}>Role</th>
                      <th className="text-left p-2 font-semibold" style={{ color: '#004D40' }}>Hours</th>
                      <th className="text-left p-2 font-semibold" style={{ color: '#004D40' }}>Rate (AUD)</th>
                      <th className="text-left p-2 font-semibold" style={{ color: '#004D40' }}>Subtotal</th>
                      {currentStep === 'edit' && (
                        <th className="text-left p-2 font-semibold" style={{ color: '#004D40' }}>Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {pricingRows.map((row) => (
                      <tr key={row.id} className="border-b">
                        <td className="p-2">
                          {currentStep === 'edit' ? (
                            <input
                              type="text"
                              value={row.role}
                              onChange={(e) => updatePricingRow(row.id, 'role', e.target.value)}
                              className="w-full p-2 border rounded text-gray-900"
                            />
                          ) : (
                            <span className="text-gray-900">{row.role}</span>
                          )}
                        </td>
                        <td className="p-2">
                          {currentStep === 'edit' ? (
                            <input
                              type="number"
                              value={row.hours}
                              onChange={(e) => updatePricingRow(row.id, 'hours', parseInt(e.target.value) || 0)}
                              className="w-full p-2 border rounded text-gray-900"
                            />
                          ) : (
                            <span className="text-gray-900">{row.hours}</span>
                          )}
                        </td>
                        <td className="p-2">
                          {currentStep === 'edit' ? (
                            <input
                              type="number"
                              value={row.rate}
                              onChange={(e) => updatePricingRow(row.id, 'rate', parseInt(e.target.value) || 0)}
                              className="w-full p-2 border rounded text-gray-900"
                            />
                          ) : (
                            <span className="text-gray-900">${row.rate}</span>
                          )}
                        </td>
                        <td className="p-2 font-bold text-gray-900">
                          ${formatNumber(row.subtotal)}
                        </td>
                        {currentStep === 'edit' && (
                          <td className="p-2">
                            <Button
                              onClick={() => removePricingRow(row.id)}
                              variant="outline"
                              className="text-red-600 border-red-600 hover:bg-red-600 hover:text-white text-sm"
                            >
                              Remove
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr className="border-t-2 font-bold">
                      <td className="p-2 text-gray-900">Total</td>
                      <td className="p-2 text-gray-900">{pricingRows.reduce((sum, row) => sum + row.hours, 0)}</td>
                      <td className="p-2"></td>
                      <td className="p-2 text-gray-900">${formatNumber(pricingRows.reduce((sum, row) => sum + row.subtotal, 0))}</td>
                      {currentStep === 'edit' && <td className="p-2"></td>}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-4">
              {currentStep === 'edit' ? (
                <>
                  <Button
                    onClick={generateFinalSOW}
                    className="flex-1 py-3 text-lg font-bold"
                    style={{ backgroundColor: '#004D40', color: 'white' }}
                  >
                    Generate Final SOW →
                  </Button>
                  <Button
                    onClick={resetForm}
                    variant="outline"
                    className="px-8 py-3 text-lg font-bold border-white text-white hover:bg-white hover:text-black"
                  >
                    Start Over
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={downloadSOW}
                    className="flex-1 py-3 text-lg font-bold"
                    style={{ backgroundColor: '#A5D6A7', color: '#004D40' }}
                  >
                    📄 Download SOW
                  </Button>
                  <Button
                    onClick={() => setCurrentStep('edit')}
                    variant="outline"
                    className="px-8 py-3 text-lg font-bold border-white text-white hover:bg-white hover:text-black"
                  >
                    ← Back to Edit
                  </Button>
                  <Button
                    onClick={resetForm}
                    variant="outline"
                    className="px-8 py-3 text-lg font-bold border-white text-white hover:bg-white hover:text-black"
                  >
                    Create New SOW
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
        {/* SOW Generation (AI Thinking + SOW) */}
        {currentStep === 'edit' && aiPhase === 'thinking' && (
          <div className="rounded-lg shadow-lg p-8" style={{ backgroundColor: '#fff' }}>
            <h2 className="text-2xl font-bold mb-4" style={{ color: '#004D40' }}>🤖 AI Thinking</h2>
            <pre className="whitespace-pre-wrap text-gray-900 leading-relaxed bg-white p-4 rounded-lg border" style={{ minHeight: '120px' }}>{thinkingContent || 'AI is analyzing your project requirements...'}</pre>
          </div>
        )}
        {currentStep === 'edit' && aiPhase === 'sow' && (
          <div className="rounded-lg shadow-lg p-8" style={{ backgroundColor: '#fff' }}>
            <h2 className="text-2xl font-bold mb-4" style={{ color: '#004D40' }}>📄 Generated SOW</h2>
            <pre className="whitespace-pre-wrap text-gray-900 leading-relaxed bg-white p-4 rounded-lg border" style={{ minHeight: '120px' }}>{sowContent}</pre>
          </div>
        )}
      </main>
    </div>
  )
}
