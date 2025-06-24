-- Apply updated extract_contacts_from_research function to remove fake data generation
-- Run this in your Supabase SQL Editor

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