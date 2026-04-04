export interface SkillField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: string;
}

export interface SkillDefinition {
  slug: string;
  fields: SkillField[];
}

const skillDefinitions: SkillDefinition[] = [
  {
    slug: 'creative-strategist',
    fields: [
      { name: 'campaign_objective', label: 'Campaign Objective', type: 'select', required: true, options: [
        { value: 'brand-awareness', label: 'Brand Awareness' },
        { value: 'lead-generation', label: 'Lead Generation' },
        { value: 'product-launch', label: 'Product Launch' },
        { value: 'seasonal-push', label: 'Seasonal Push' },
        { value: 'other', label: 'Other' },
      ]},
      { name: 'target_audience', label: 'Target Audience', type: 'textarea', required: true, placeholder: 'Demographics, psychographics, pain points...' },
      { name: 'budget_range', label: 'Budget Range (optional)', type: 'text', required: false, placeholder: 'e.g. \u00a35,000-10,000/month' },
      { name: 'key_messages', label: 'Key Messages / USPs (optional)', type: 'textarea', required: false, placeholder: 'Anything the client wants emphasised...' },
      { name: 'competitors', label: 'Competitors (optional)', type: 'textarea', required: false, placeholder: 'Who are we positioning against?' },
    ],
  },
  {
    slug: 'dental-content-planning',
    fields: [
      { name: 'planning_period', label: 'Planning Period', type: 'text', required: true, placeholder: 'Q2 2026' },
      { name: 'treatments', label: 'Key Treatments to Promote', type: 'textarea', required: true, placeholder: 'Invisalign, implants, whitening' },
      { name: 'content_channels', label: 'Content Channels', type: 'text', required: false, placeholder: 'Social media, blog, email, Google Business Profile' },
      { name: 'compliance_region', label: 'Compliance Region', type: 'select', required: true, options: [
        { value: 'uk-gdc', label: 'UK (GDC)' },
        { value: 'australia-ahpra', label: 'Australia (AHPRA)' },
      ]},
      { name: 'events_offers', label: 'Events / Offers (optional)', type: 'textarea', required: false, placeholder: 'Practice anniversary, new dentist joining, seasonal offers...' },
    ],
  },
  {
    slug: 'website-content-writer',
    fields: [
      { name: 'page_type', label: 'Page Type', type: 'select', required: true, options: [
        { value: 'homepage', label: 'Homepage' },
        { value: 'service-page', label: 'Service Page' },
        { value: 'about-page', label: 'About Page' },
        { value: 'contact-page', label: 'Contact Page' },
        { value: 'landing-page', label: 'Landing Page' },
      ]},
      { name: 'primary_keyword', label: 'Primary Keyword', type: 'text', required: true, placeholder: 'e.g. dental implants London' },
      { name: 'secondary_keywords', label: 'Secondary Keywords (optional)', type: 'text', required: false, placeholder: 'e.g. tooth replacement, missing teeth' },
      { name: 'brand_voice', label: 'Brand Voice', type: 'select', required: true, options: [
        { value: 'professional', label: 'Professional' },
        { value: 'friendly', label: 'Friendly' },
        { value: 'clinical', label: 'Clinical' },
        { value: 'bold', label: 'Bold' },
        { value: 'warm', label: 'Warm' },
      ]},
      { name: 'key_usps', label: 'Key USPs', type: 'textarea', required: true, placeholder: 'What makes this client/service stand out?' },
      { name: 'target_audience', label: 'Target Audience', type: 'textarea', required: true, placeholder: 'Who is this page for?' },
    ],
  },
  {
    slug: 'landing-page-brief',
    fields: [
      { name: 'campaign_name', label: 'Campaign Name', type: 'text', required: true, placeholder: 'e.g. Summer Whitening 2026' },
      { name: 'campaign_objective', label: 'Campaign Objective', type: 'select', required: true, options: [
        { value: 'lead-generation', label: 'Lead Generation' },
        { value: 'event-registration', label: 'Event Registration' },
        { value: 'product-purchase', label: 'Product Purchase' },
        { value: 'download', label: 'Download' },
      ]},
      { name: 'target_audience', label: 'Target Audience', type: 'textarea', required: true, placeholder: 'Who is the landing page targeting?' },
      { name: 'offer', label: 'Offer', type: 'textarea', required: true, placeholder: 'What is the compelling reason to convert?' },
      { name: 'primary_cta', label: 'Primary CTA', type: 'text', required: true, placeholder: 'e.g. Book Your Free Consultation' },
      { name: 'traffic_source', label: 'Traffic Source', type: 'select', required: true, options: [
        { value: 'meta-ads', label: 'Meta Ads' },
        { value: 'google-ads', label: 'Google Ads' },
        { value: 'email', label: 'Email' },
        { value: 'organic', label: 'Organic' },
      ]},
      { name: 'design_references', label: 'Design References (optional)', type: 'textarea', required: false, placeholder: 'URLs or descriptions of pages you like...' },
    ],
  },
  {
    slug: 'meta-ad-copy',
    fields: [
      { name: 'campaign_objective', label: 'Campaign Objective', type: 'select', required: true, options: [
        { value: 'awareness', label: 'Awareness' },
        { value: 'traffic', label: 'Traffic' },
        { value: 'leads', label: 'Leads' },
        { value: 'sales-conversions', label: 'Sales / Conversions' },
      ]},
      { name: 'target_audience', label: 'Target Audience', type: 'textarea', required: true, placeholder: 'Who are we speaking to?' },
      { name: 'offer_hook', label: 'Offer / Hook', type: 'textarea', required: true, placeholder: 'What is the compelling reason to act?' },
      { name: 'landing_page_url', label: 'Landing Page URL (optional)', type: 'text', required: false, placeholder: 'https://...' },
      { name: 'tone', label: 'Tone', type: 'select', required: true, options: [
        { value: 'professional', label: 'Professional' },
        { value: 'conversational', label: 'Conversational' },
        { value: 'urgent', label: 'Urgent' },
        { value: 'playful', label: 'Playful' },
        { value: 'clinical', label: 'Clinical' },
      ]},
      { name: 'num_variants', label: 'Number of Variants', type: 'select', required: true, defaultValue: '5', options: [
        { value: '3', label: '3' },
        { value: '5', label: '5' },
        { value: '7', label: '7' },
      ]},
      { name: 'ad_format', label: 'Ad Format', type: 'select', required: true, options: [
        { value: 'single-image', label: 'Single Image' },
        { value: 'carousel', label: 'Carousel' },
        { value: 'video', label: 'Video' },
        { value: 'all', label: 'All' },
      ]},
    ],
  },
  {
    slug: 'google-ads-rsa',
    fields: [
      { name: 'keyword_theme', label: 'Keyword Theme', type: 'text', required: true, placeholder: 'e.g. dental implants near me' },
      { name: 'landing_page_url', label: 'Landing Page URL', type: 'text', required: true, placeholder: 'https://...' },
      { name: 'key_usps', label: 'Key USPs', type: 'textarea', required: true, placeholder: 'What makes this service stand out?' },
      { name: 'offer', label: 'Offer (optional)', type: 'textarea', required: false, placeholder: 'Any current promotions or offers?' },
      { name: 'location', label: 'Location (optional)', type: 'text', required: false, placeholder: 'e.g. London, Sydney CBD' },
    ],
  },
  {
    slug: 'seo-blog-writer',
    fields: [
      { name: 'target_keyword', label: 'Target Keyword', type: 'text', required: true, placeholder: 'e.g. how much do dental implants cost' },
      { name: 'secondary_keywords', label: 'Secondary Keywords (optional)', type: 'text', required: false, placeholder: 'e.g. implant prices UK, affordable implants' },
      { name: 'topic_angle', label: 'Topic Angle', type: 'textarea', required: true, placeholder: 'What specific angle or perspective should the article take?' },
      { name: 'tone', label: 'Tone', type: 'select', required: true, options: [
        { value: 'professional', label: 'Professional' },
        { value: 'conversational', label: 'Conversational' },
        { value: 'authoritative', label: 'Authoritative' },
        { value: 'friendly', label: 'Friendly' },
      ]},
      { name: 'word_count', label: 'Word Count', type: 'select', required: true, defaultValue: '1200', options: [
        { value: '800', label: '800' },
        { value: '1200', label: '1,200' },
        { value: '1500', label: '1,500' },
        { value: '2000', label: '2,000' },
      ]},
      { name: 'content_type', label: 'Content Type', type: 'select', required: true, options: [
        { value: 'blog-post', label: 'Blog Post' },
        { value: 'guide', label: 'Guide' },
        { value: 'listicle', label: 'Listicle' },
        { value: 'how-to', label: 'How-to' },
        { value: 'faq', label: 'FAQ' },
        { value: 'comparison', label: 'Comparison' },
      ]},
    ],
  },
  {
    slug: 'email-crm-writer',
    fields: [
      { name: 'campaign_goal', label: 'Campaign Goal', type: 'select', required: true, options: [
        { value: 'reactivation', label: 'Reactivation' },
        { value: 'promotion', label: 'Promotion' },
        { value: 'nurture', label: 'Nurture' },
        { value: 'post-treatment', label: 'Post-Treatment' },
        { value: 'referral', label: 'Referral' },
      ]},
      { name: 'patient_segment', label: 'Patient Segment', type: 'textarea', required: true, placeholder: 'Who is receiving these emails? e.g. lapsed patients, new enquiries...' },
      { name: 'offer', label: 'Offer (optional)', type: 'textarea', required: false, placeholder: 'Any special offer to include?' },
      { name: 'num_emails', label: 'Number of Emails', type: 'select', required: true, defaultValue: '3', options: [
        { value: '1', label: '1' },
        { value: '2', label: '2' },
        { value: '3', label: '3' },
        { value: '4', label: '4' },
        { value: '5', label: '5' },
      ]},
      { name: 'send_frequency', label: 'Send Frequency', type: 'select', required: true, options: [
        { value: 'every-3-days', label: 'Every 3 Days' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'custom', label: 'Custom' },
      ]},
      { name: 'compliance_region', label: 'Compliance Region', type: 'select', required: true, options: [
        { value: 'uk-gdc', label: 'UK (GDC)' },
        { value: 'australia-ahpra', label: 'Australia (AHPRA)' },
      ]},
    ],
  },
  {
    slug: 'growth-planning',
    fields: [
      { name: 'planning_period', label: 'Planning Period', type: 'text', required: true, placeholder: 'Q3 2026' },
      { name: 'current_budget', label: 'Current Budget (optional)', type: 'text', required: false, placeholder: '\u00a35,000/month' },
      { name: 'growth_ambition', label: 'Growth Ambition', type: 'select', required: true, options: [
        { value: 'maintain', label: 'Maintain' },
        { value: 'moderate', label: 'Moderate Growth (10-20%)' },
        { value: 'aggressive', label: 'Aggressive Growth (30%+)' },
        { value: 'scale-back', label: 'Scale Back' },
      ]},
      { name: 'specific_goals', label: 'Specific Goals (optional)', type: 'textarea', required: false, placeholder: 'Any particular targets or milestones?' },
    ],
  },
];

const definitionMap = new Map<string, SkillDefinition>();
for (const def of skillDefinitions) {
  definitionMap.set(def.slug, def);
}

export function getSkillFields(slug: string): SkillField[] {
  return definitionMap.get(slug)?.fields ?? [];
}

export function getAllSkillDefinitions(): SkillDefinition[] {
  return skillDefinitions;
}
