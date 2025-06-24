-- Fix VARCHAR(255) overflow issue in extract functions
-- Run this in your Supabase SQL Editor

-- Update extract_client_data_from_research function to handle VARCHAR(255) limits
CREATE OR REPLACE FUNCTION extract_client_data_from_research(research_text TEXT)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    extracted_company_name TEXT;
    extracted_industry TEXT;
    extracted_website TEXT;
    extracted_linkedin_url TEXT;
    extracted_business_model TEXT;
    extracted_founded_date DATE;
    extracted_company_size VARCHAR(50);
    extracted_revenue_range VARCHAR(100);
    extracted_location TEXT;
    extracted_description TEXT;
    extracted_marketing_stack JSONB DEFAULT '[]';
BEGIN
    -- Extract company name
    SELECT COALESCE(
        (SELECT LEFT((regexp_matches(research_text, 'Company Overview:\s*- Name:\s*([^\n]+)', 'i'))[1], 255)),
        (SELECT LEFT((regexp_matches(research_text, 'company name from this project description: "([^"]+)"', 'i'))[1], 255)),
        (SELECT LEFT((regexp_matches(research_text, 'Name:\s*([^\n]+)', 'i'))[1], 255)),
        'Unknown Company'
    ) INTO extracted_company_name;

    -- Extract industry
    SELECT COALESCE(
        (SELECT LEFT((regexp_matches(research_text, 'Industry:\s*([^\n]+)', 'i'))[1], 255)),
        (SELECT CASE
            WHEN research_text ILIKE '%virtual assistant%' THEN 'Technology Services'
            WHEN research_text ILIKE '%job portal%' THEN 'Technology'
            WHEN research_text ILIKE '%e-commerce%' THEN 'Retail'
            WHEN research_text ILIKE '%saas%' THEN 'Software'
            ELSE NULL
        END)
    ) INTO extracted_industry;

    -- Extract business model
    SELECT COALESCE(
        (SELECT LEFT((regexp_matches(research_text, 'Business Model:\s*([^\n]+)', 'i'))[1], 255)),
        NULL
    ) INTO extracted_business_model;

    -- Extract founded date
    SELECT COALESCE(
        (SELECT (regexp_matches(research_text, 'Founded:\s*(\d{4})', 'i'))[1]::DATE),
        NULL
    ) INTO extracted_founded_date;

    -- Extract website
    SELECT COALESCE(
        (SELECT LEFT((regexp_matches(research_text, 'Website:\s*(https?://[^\s]+)', 'i'))[1], 255)),
        (SELECT LEFT((regexp_matches(research_text, 'https?://[^\s]+', 'i'))[1], 255)),
        NULL
    ) INTO extracted_website;

    -- Extract LinkedIn URL
    SELECT COALESCE(
        (SELECT LEFT((regexp_matches(research_text, 'LinkedIn URL:\s*(https?://linkedin\.com/[^\s]+)', 'i'))[1], 255)),
        (SELECT LEFT((regexp_matches(research_text, 'https?://linkedin\.com/[^\s]+', 'i'))[1], 255)),
        NULL
    ) INTO extracted_linkedin_url;

    -- Extract company size
    SELECT COALESCE(
        (SELECT LEFT((regexp_matches(research_text, 'Company Size:\s*- Employees:\s*([^\n]+)', 'i'))[1], 50)),
        NULL
    ) INTO extracted_company_size;

    -- Extract description (can be more complex, this is a basic attempt)
    SELECT COALESCE(
        (SELECT LEFT((regexp_matches(research_text, 'Company overview, industry, and business model \([^)]+\)\s*([^\n]+)', 'i'))[1], 1000)),
        NULL
    ) INTO extracted_description;

    -- Build the JSONB result
    result := jsonb_build_object(
        'company_name', extracted_company_name,
        'industry', extracted_industry,
        'business_model', extracted_business_model,
        'founded_date', extracted_founded_date,
        'website', extracted_website,
        'linkedin_url', extracted_linkedin_url,
        'company_size', extracted_company_size,
        'description', extracted_description,
        'research_data', research_text
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Update extract_contacts_from_research function to handle VARCHAR(255) limits
CREATE OR REPLACE FUNCTION extract_contacts_from_research(research_text TEXT)
RETURNS JSONB AS $$
DECLARE
    contacts_array JSONB[] := ARRAY[]::JSONB[];
    match TEXT[];
    contact_name TEXT;
    contact_title TEXT;
BEGIN
    -- Extract key decision makers and leadership with improved patterns
    -- Pattern 1: "Key Decision Makers: - Name: Title"
    FOR match IN SELECT regexp_matches(research_text, 'Key Decision Makers:\s*- ([^:]+):\s*([^\n]+)', 'g')
    LOOP
        contact_name := LEFT(match[1], 255);
        contact_title := LEFT(match[2], 255);
        
        contacts_array := array_append(contacts_array, jsonb_build_object(
            'name', contact_name,
            'title', contact_title,
            'is_decision_maker', true
        ));
    END LOOP;

    -- Pattern 2: "Founder: Name" or "CEO: Name" format
    IF array_length(contacts_array, 1) IS NULL THEN
        FOR match IN SELECT regexp_matches(research_text, '(Founder|CEO|CTO|CFO|COO|Director|Manager):\s*([A-Z][a-z]+(?: [A-Z][a-z]+){1,2})', 'g')
        LOOP
            contact_name := LEFT(match[2], 255);
            contact_title := LEFT(match[1], 255);
            
            contacts_array := array_append(contacts_array, jsonb_build_object(
                'name', contact_name,
                'title', contact_title,
                'is_decision_maker', true
            ));
        END LOOP;
    END IF;

    -- Pattern 3: "Name, Title" format
    IF array_length(contacts_array, 1) IS NULL THEN
        FOR match IN SELECT regexp_matches(research_text, '([A-Z][a-z]+(?: [A-Z][a-z]+){1,2})\s*,\s*([^,\n]+(?: CEO|Founder|Director|Manager))', 'g')
        LOOP
            contact_name := LEFT(match[1], 255);
            contact_title := LEFT(match[2], 255);
            
            contacts_array := array_append(contacts_array, jsonb_build_object(
                'name', contact_name,
                'title', contact_title,
                'is_decision_maker', true
            ));
        END LOOP;
    END IF;

    -- Pattern 4: "Name - Title" format
    IF array_length(contacts_array, 1) IS NULL THEN
        FOR match IN SELECT regexp_matches(research_text, '([A-Z][a-z]+(?: [A-Z][a-z]+){1,2})\s*-\s*([^-\n]+(?: CEO|Founder|Director|Manager))', 'g')
        LOOP
            contact_name := LEFT(match[1], 255);
            contact_title := LEFT(match[2], 255);
            
            contacts_array := array_append(contacts_array, jsonb_build_object(
                'name', contact_name,
                'title', contact_title,
                'is_decision_maker', true
            ));
        END LOOP;
    END IF;

    -- ZERO TOLERANCE: No fallbacks, no fake data, no graceful degradation
    -- If no real contacts found, return empty array - let the system fail visibly

    RETURN jsonb_build_object('contacts', contacts_array);
END;
$$ LANGUAGE plpgsql; 