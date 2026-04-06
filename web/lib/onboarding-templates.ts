// ---------------------------------------------------------------------------
// Onboarding Template Definitions
// ---------------------------------------------------------------------------
// Data-driven question templates for the onboarding wizard.
// Add new verticals by exporting a new OnboardingTemplate array here.
// The wizard UI renders dynamically from these configs — no view changes needed.
// ---------------------------------------------------------------------------

export interface QuestionOption {
  value: string;
  label: string;
}

export interface SubField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'url' | 'tel' | 'email' | 'number' | 'select' | 'radio';
  placeholder?: string;
  options?: QuestionOption[];
}

export interface Question {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'email' | 'url' | 'tel' | 'number' | 'select' | 'checkbox' | 'radio' | 'repeater' | 'drive-link' | 'location-checkbox-matrix' | 'treatment-pricing' | 'opening-hours' | 'brand-colours' | 'brand-fonts';
  placeholder?: string;
  hint?: string;
  required?: boolean;
  options?: QuestionOption[];
  /** Show this field only when a sibling question has a specific answer */
  showWhen?: { questionId: string; equals: string };
  /** Sub-fields for repeater type */
  subFields?: SubField[];
  /** Question ID whose numeric answer sets initial repeat count */
  repeatCountFrom?: string;
  minRepeats?: number;
  maxRepeats?: number;
  /** For location-checkbox-matrix: question ID containing repeater location data */
  locationSourceId?: string;
  /** For location-checkbox-matrix: the checkbox options per location */
  matrixOptions?: QuestionOption[];
  /** For treatment-pricing: question ID containing selected treatments (checkbox) */
  treatmentSourceId?: string;
  /** For treatment-pricing: the master options list to resolve labels */
  treatmentOptions?: QuestionOption[];
}

export interface Section {
  id: string;
  title: string;
  description?: string;
  /** Only show this section if a previous answer includes a specific value */
  conditional?: { questionId: string; includes: string };
  questions: Question[];
}

export interface OnboardingTemplate {
  id: string;
  vertical: string;
  type: 'single' | 'multi';
  title: string;
  subtitle: string;
  sections: Section[];
}

// ---------------------------------------------------------------------------
// Shared treatment options
// ---------------------------------------------------------------------------

const TREATMENT_OPTIONS: QuestionOption[] = [
  { value: 'dental_implants', label: 'Dental Implants' },
  { value: 'invisalign', label: 'Invisalign / Clear Aligners' },
  { value: 'composite_bonding', label: 'Composite Bonding' },
  { value: 'smile_makeover', label: 'Smile Makeover / Full Smile Design' },
  { value: 'teeth_whitening', label: 'Teeth Whitening' },
  { value: 'veneers', label: 'Veneers' },
  { value: 'general_dentistry', label: 'General Dentistry / Check-ups' },
  { value: 'emergency_dental', label: 'Emergency Dental' },
  { value: 'orthodontics', label: 'Orthodontics (Fixed Braces)' },
  { value: 'facial_aesthetics', label: 'Facial Aesthetics / Botox' },
  { value: 'other', label: 'Other (please specify below)' },
];

// ---------------------------------------------------------------------------
// Dental — Single Practice
// ---------------------------------------------------------------------------

const dentalSingleSections: Section[] = [
  {
    id: '1',
    title: 'Practice Information',
    description: 'Basic details about your practice so we can get started.',
    questions: [
      { id: '1.1', label: 'What is the full legal name of your practice?', type: 'text', required: true },
      { id: '1.2', label: 'What is your primary practice location?', type: 'textarea', placeholder: 'Full address including postcode', required: true },
      { id: '1.3', label: 'What is your practice website URL?', type: 'url', placeholder: 'https://' },
      { id: '1.4', label: 'What is the name and role of the main point of contact we will be working with?', type: 'text', required: true },
      { id: '1.5', label: 'What is the best email address and phone number for day-to-day communication?', type: 'textarea', placeholder: 'Email and phone number' },
      { id: '1.6', label: 'Is your practice NHS, private, or mixed?', type: 'radio', options: [
        { value: 'nhs', label: 'NHS' },
        { value: 'private', label: 'Private' },
        { value: 'mixed', label: 'Mixed' },
      ]},
      { id: '1.7', label: 'How many dentists / clinicians currently work at the practice?', type: 'number', placeholder: 'e.g. 4' },
      { id: '1.8', label: 'What are your opening hours?', type: 'opening-hours', hint: 'Include any late evenings or weekend availability \u2014 this affects ad scheduling.' },
      { id: '1.9', label: 'What geographic area do you serve / want to target?', type: 'textarea', placeholder: 'e.g. within 5 miles, specific towns or postcodes' },
      { id: '1.10', label: 'Do you have a patient CRM or lead management system in place?', type: 'text', hint: 'e.g. GoHighLevel, Dentally, SOE, Exact', placeholder: 'System name or "None"' },
    ],
  },
  {
    id: '2',
    title: 'Services Required',
    description: 'Select all the services you are signing up for.',
    questions: [
      { id: '2.1', label: 'Which services are you signing up for?', type: 'checkbox', required: true, options: [
        { value: 'paid_search', label: 'Paid Search (Google Ads)' },
        { value: 'paid_social', label: 'Paid Social (Meta Ads \u2014 Facebook & Instagram)' },
        { value: 'seo', label: 'SEO (Search Engine Optimisation)' },
      ]},
    ],
  },
  {
    id: '2A',
    title: 'Paid Search Details',
    description: 'Tell us about your Google Ads setup.',
    conditional: { questionId: '2.1', includes: 'paid_search' },
    questions: [
      { id: '2A.1', label: 'Do you have an active Google Ads account?', type: 'radio', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' },
      ]},
      { id: '2A.1a', label: 'Google Ads Customer ID', type: 'text', placeholder: 'e.g. 123-456-7890', hint: 'The 10-digit ID found in the top-right corner of Google Ads.', showWhen: { questionId: '2A.1', equals: 'yes' } },
      { id: '2A.2', label: 'Do you have Google Analytics 4 installed on your website?', type: 'radio', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unsure', label: 'Not sure' },
      ]},
      { id: '2A.2a', label: 'GA4 Measurement ID', type: 'text', placeholder: 'e.g. G-XXXXXXXXXX', showWhen: { questionId: '2A.2', equals: 'yes' } },
      { id: '2A.3', label: 'Do you have Google Tag Manager installed?', type: 'radio', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unsure', label: 'Not sure' },
      ]},
      { id: '2A.3a', label: 'GTM Container ID', type: 'text', placeholder: 'e.g. GTM-XXXXXXX', showWhen: { questionId: '2A.3', equals: 'yes' } },
      { id: '2A.4', label: 'Do you currently track phone call conversions from Google Ads?', type: 'radio', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unsure', label: 'Not sure' },
      ]},
      { id: '2A.4a', label: 'Which call tracking provider?', type: 'text', placeholder: 'e.g. CallRail, Mediahawk', showWhen: { questionId: '2A.4', equals: 'yes' } },
      { id: '2A.5', label: 'What is your current monthly Google Ads spend?', type: 'text', hint: 'Approximate is fine.', placeholder: 'e.g. \u00a31,500/month' },
      { id: '2A.6', label: 'What is your target monthly Google Ads budget going forward?', type: 'text', placeholder: 'e.g. \u00a32,000/month' },
      { id: '2A.7', label: 'What has been your average cost per lead from Google Ads historically?', type: 'text', hint: 'If known.', placeholder: 'e.g. \u00a325' },
    ],
  },
  {
    id: '2B',
    title: 'Paid Social Details',
    description: 'Tell us about your Meta Ads setup.',
    conditional: { questionId: '2.1', includes: 'paid_social' },
    questions: [
      { id: '2B.1', label: 'Do you have a Facebook Business Page?', type: 'text', hint: 'If yes, please provide the Page name or URL.' },
      { id: '2B.2', label: 'Do you have a Meta Business Manager / Business Suite account?', type: 'text', hint: 'If yes, please provide the Business Manager ID.' },
      { id: '2B.3', label: 'Do you have a Meta Pixel or Conversions API installed on your website?', type: 'radio', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unsure', label: 'Not sure' },
      ]},
      { id: '2B.4', label: 'Do you have an Instagram profile linked to your Facebook Page?', type: 'radio', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' },
      ]},
      { id: '2B.5', label: 'What is your current monthly Meta Ads spend?', type: 'text', hint: 'Approximate is fine.', placeholder: 'e.g. \u00a31,000/month' },
      { id: '2B.6', label: 'What is your target monthly Meta Ads budget going forward?', type: 'text', placeholder: 'e.g. \u00a31,500/month' },
      { id: '2B.7', label: 'Have you run Meta Ads before?', type: 'textarea', hint: 'If yes, what worked well and what didn\u2019t?', placeholder: 'Previous experience and results...' },
    ],
  },
  {
    id: '2C',
    title: 'SEO Details',
    description: 'Tell us about your current SEO status.',
    conditional: { questionId: '2.1', includes: 'seo' },
    questions: [
      { id: '2C.1', label: 'Is your Google Business Profile (formerly Google My Business) set up and verified?', type: 'radio', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unsure', label: 'Not sure' },
      ]},
      { id: '2C.2', label: 'What is the current domain authority or SEO health of your site?', type: 'text', hint: 'Don\u2019t worry if unknown \u2014 we will audit.', placeholder: 'e.g. DA 25 or "Not sure"' },
      { id: '2C.3', label: 'Are you currently ranking for any keywords you\u2019re aware of?', type: 'textarea', placeholder: 'e.g. "dentist near me", "Invisalign London"' },
      { id: '2C.4', label: 'Have you had any previous SEO work done on the site?', type: 'textarea', hint: 'If yes, by whom and when?', placeholder: 'Agency name, dates, and scope...' },
      { id: '2C.5', label: 'Do you have a blog or content section on your website?', type: 'radio', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' },
      ]},
    ],
  },
  {
    id: '3',
    title: 'Treatments to Advertise',
    description: 'Select all treatments you want to actively advertise.',
    questions: [
      { id: '3.1', label: 'Which treatments do you want to actively advertise?', type: 'checkbox', required: true, options: TREATMENT_OPTIONS },
      { id: '3.2', label: 'Are there any treatments you are NOT able to offer or want to exclude from advertising?', type: 'textarea' },
      { id: '3.3', label: 'Which treatment is your highest priority to fill capacity for right now?', type: 'text' },
    ],
  },
  {
    id: '3A',
    title: 'Treatment Pricing & Details',
    description: 'For each treatment you selected, tell us about your pricing and offers.',
    questions: [
      { id: '3A.1', label: 'Treatment pricing', type: 'treatment-pricing', treatmentSourceId: '3.1', treatmentOptions: TREATMENT_OPTIONS, hint: 'This helps us write accurate ad copy and calculate ROI.' },
      { id: '3A.2', label: 'Do you have a price list you can share?', type: 'radio', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' },
      ]},
      { id: '3A.2a', label: 'Price list link', type: 'url', placeholder: 'https://yourpractice.com/prices or Google Drive / Dropbox link', hint: 'Paste a link to your online price list or upload to the Brand Assets Drive folder.', showWhen: { questionId: '3A.2', equals: 'yes' } },
      { id: '3A.3', label: 'What is your current average monthly volume of new patients for your priority treatment?', type: 'text', placeholder: 'e.g. 8 per month' },
      { id: '3A.4', label: 'What is your target monthly volume of new patients for your priority treatment?', type: 'text', placeholder: 'e.g. 15 per month' },
    ],
  },
  {
    id: '4',
    title: 'Current Marketing & Ad Spend',
    questions: [
      { id: '4.1', label: 'What is your total current monthly marketing spend across all channels?', type: 'text', hint: 'Approximate.', placeholder: 'e.g. \u00a33,000/month' },
      { id: '4.2', label: 'Which marketing channels are you currently active on?', type: 'textarea', placeholder: 'e.g. Google Ads, Meta Ads, SEO, referrals, local press, other' },
      { id: '4.3', label: 'Are you working with any other marketing agency or freelancer currently?', type: 'textarea', hint: 'If yes, what are they doing?', placeholder: 'Agency name and services, or "No"' },
      { id: '4.4', label: 'What results are you currently getting?', type: 'textarea', hint: 'Leads per month, cost per lead \u2014 approximate is fine.', placeholder: 'e.g. 20 leads/month at \u00a330 CPL' },
      { id: '4.5', label: 'What has not worked in your past marketing efforts?', type: 'textarea' },
    ],
  },
  {
    id: '5',
    title: 'Goals & Revenue Targets',
    questions: [
      { id: '5.1', label: 'What is your monthly revenue target for new patient treatments?', type: 'text', placeholder: 'e.g. \u00a350,000' },
      { id: '5.2', label: 'What is your target number of new patient leads per month (across all treatments)?', type: 'text', placeholder: 'e.g. 40' },
      { id: '5.3', label: 'What is your target cost per lead?', type: 'text', hint: 'If you have one in mind.', placeholder: 'e.g. \u00a325' },
      { id: '5.4', label: 'What does success look like for you at 3 months? At 12 months?', type: 'textarea', placeholder: 'Describe your ideal outcomes...' },
      { id: '5.5', label: 'Are there any specific months or periods where you need to push harder?', type: 'textarea', hint: 'e.g. January, pre-summer.', placeholder: 'Seasonal priorities...' },
      { id: '5.6', label: 'Do you have a target return on ad spend (ROAS) or ROI figure in mind?', type: 'text', placeholder: 'e.g. 5x ROAS' },
    ],
  },
  {
    id: '6',
    title: 'Brand Assets & Guidelines',
    questions: [
      { id: '6.0', label: 'Brand Assets Folder', type: 'drive-link', hint: 'Please upload your logo files, brand guidelines, photography, and any other assets to the Google Drive folder below.' },
      { id: '6.1', label: 'Please share your logo files', type: 'textarea', hint: 'PNG with transparent background preferred, plus any vector files. Upload to the Drive folder above, or paste a link here.' },
      { id: '6.2', label: 'What are your brand colours?', type: 'brand-colours', hint: 'Add each colour individually. Hex codes (e.g. #1A2B3C), RGB, or colour names all work.' },
      { id: '6.3', label: 'What are your brand fonts?', type: 'brand-fonts', hint: 'Add each font. If it\u2019s a Google Font, we\u2019ll preview it for you.' },
      { id: '6.4', label: 'Do you have existing brand guidelines or a style guide?', type: 'textarea', hint: 'If yes, upload to the Drive folder or paste a link.' },
      { id: '6.5', label: 'Do you have existing photography or video assets of the practice, team, or patients (with consent)?', type: 'textarea', hint: 'Upload to the Drive folder or paste a link.' },
      { id: '6.6', label: 'Do you have patient testimonials or reviews we can use in ads?', type: 'textarea', hint: 'Google reviews, video testimonials, written quotes.' },
      { id: '6.7', label: 'What tone of voice best describes your practice brand?', type: 'radio', options: [
        { value: 'warm', label: 'Warm and approachable' },
        { value: 'clinical', label: 'Clinical and professional' },
        { value: 'luxury', label: 'Luxury / premium' },
        { value: 'friendly', label: 'Friendly and accessible' },
        { value: 'other', label: 'Other (describe below)' },
      ]},
      { id: '6.8', label: 'Are there any words, phrases, or visual styles you do NOT want used in your advertising?', type: 'textarea' },
    ],
  },
  {
    id: '7',
    title: 'Competitors',
    questions: [
      { id: '7.1', label: 'Who are your top competitors in your local area?', type: 'repeater', minRepeats: 1, maxRepeats: 10, subFields: [
        { id: 'name', label: 'Competitor name', type: 'text', placeholder: 'Practice name' },
        { id: 'location', label: 'Location / area', type: 'text', placeholder: 'e.g. High Street, Croydon' },
        { id: 'website', label: 'Website (if known)', type: 'url', placeholder: 'https://' },
      ]},
      { id: '7.2', label: 'Are there any competitor practices you particularly admire or feel threatened by?', type: 'textarea' },
      { id: '7.3', label: 'What do you feel your key differentiators are vs competitors?', type: 'textarea', hint: 'e.g. price, technology, location, team experience, finance options.', placeholder: 'What makes you stand out...' },
      { id: '7.4', label: 'Do you offer patient finance?', type: 'textarea', hint: 'If yes, through which provider and at what rates?', placeholder: 'e.g. Tabeo, 0% over 12 months' },
    ],
  },
  {
    id: '8',
    title: 'Website & Patient Journey',
    questions: [
      { id: '8.1', label: 'Who hosts and manages your website?', type: 'text', placeholder: 'e.g. Agency name, self-managed' },
      { id: '8.2', label: 'What platform is your website built on?', type: 'text', placeholder: 'e.g. WordPress, Squarespace, custom' },
      { id: '8.3', label: 'How do patients currently book or enquire?', type: 'textarea', placeholder: 'e.g. phone, online booking form, live chat, WhatsApp' },
      { id: '8.4', label: 'Do you have dedicated landing pages for your key treatments?', type: 'textarea', hint: 'Or do ads currently send traffic to your homepage?' },
      { id: '8.5', label: 'What is your average website enquiry-to-booked-appointment conversion rate?', type: 'text', hint: 'If known.', placeholder: 'e.g. 30%' },
      { id: '8.6', label: 'Do you use any online booking software?', type: 'text', hint: 'e.g. Calendly, Treatwell, practice-specific system.', placeholder: 'System name or "None"' },
    ],
  },
  {
    id: '9',
    title: 'Compliance Notes',
    questions: [
      { id: '9.1', label: 'Are you GDC registered?', type: 'radio', hint: 'We need to confirm for ad compliance.', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' },
      ]},
      { id: '9.2', label: 'Are you aware of ASA and GDC advertising guidelines around before/after imagery and claims?', type: 'radio', hint: 'We manage this, but want to flag early.', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' },
      ]},
      { id: '9.3', label: 'Do you have patient consent processes in place for using imagery in marketing materials?', type: 'radio', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'partial', label: 'Partially' },
      ]},
    ],
  },
];

// ---------------------------------------------------------------------------
// Dental — DSO / Multi-Location
// ---------------------------------------------------------------------------

const dentalMultiSections: Section[] = [
  {
    id: '1',
    title: 'Organisation Information',
    description: 'Details about your dental group.',
    questions: [
      { id: '1.1', label: 'What is the full legal / trading name of your dental group?', type: 'text', required: true },
      { id: '1.2', label: 'What is the name and role of the primary decision-maker we will be working with?', type: 'text', required: true },
      { id: '1.3', label: 'What is the best email address and phone number for strategic communication?', type: 'textarea' },
      { id: '1.4', label: 'Who is the day-to-day operational contact (if different from above)?', type: 'text' },
      { id: '1.5', label: 'How many locations does your group currently operate?', type: 'number', placeholder: 'e.g. 5' },
      { id: '1.6', label: 'Location details', type: 'repeater', repeatCountFrom: '1.5', minRepeats: 1, maxRepeats: 50, subFields: [
        { id: 'name', label: 'Practice name', type: 'text', placeholder: 'e.g. Smile Dental Croydon' },
        { id: 'address', label: 'Full address & postcode', type: 'textarea', placeholder: 'Full address including postcode' },
        { id: 'website', label: 'Website URL', type: 'url', placeholder: 'https://' },
        { id: 'type', label: 'NHS / Private / Mixed', type: 'radio', options: [
          { value: 'nhs', label: 'NHS' }, { value: 'private', label: 'Private' }, { value: 'mixed', label: 'Mixed' },
        ]},
        { id: 'clinicians', label: 'Number of clinicians', type: 'number', placeholder: 'e.g. 4' },
        { id: 'hours', label: 'Opening hours', type: 'text', placeholder: 'e.g. Mon-Fri 8am-6pm, Sat 9am-1pm' },
        { id: 'contact_name', label: 'Primary contact name', type: 'text' },
        { id: 'contact_email', label: 'Primary contact email', type: 'email' },
        { id: 'contact_phone', label: 'Primary contact phone', type: 'tel' },
      ]},
      { id: '1.7', label: 'Do your locations operate under a single brand or individual practice brands?', type: 'radio', options: [
        { value: 'single', label: 'Single brand' },
        { value: 'individual', label: 'Individual brands' },
        { value: 'mix', label: 'Mix of both' },
      ]},
      { id: '1.8', label: 'Are you planning to open additional locations in the next 12 months?', type: 'textarea', hint: 'If yes, how many and where?' },
      { id: '1.9', label: 'What CRM or lead management system do you use across the group?', type: 'text', hint: 'e.g. GoHighLevel, Salesforce, Dentally, SOE, Exact \u2014 per-location or centralised.', placeholder: 'System name and setup' },
    ],
  },
  {
    id: '2',
    title: 'Services Required',
    description: 'Select all that apply \u2014 can be applied group-wide or per location.',
    questions: [
      { id: '2.1', label: 'Which services are you signing up for?', type: 'checkbox', required: true, options: [
        { value: 'paid_search', label: 'Paid Search (Google Ads)' },
        { value: 'paid_social', label: 'Paid Social (Meta Ads \u2014 Facebook & Instagram)' },
        { value: 'seo', label: 'SEO (Search Engine Optimisation)' },
      ]},
      { id: '2.2', label: 'Should these services be managed at a group level, per location, or a mix?', type: 'radio', options: [
        { value: 'group', label: 'Group level' },
        { value: 'per_location', label: 'Per location' },
        { value: 'mix', label: 'Mix' },
      ]},
    ],
  },
  {
    id: '2A',
    title: 'Paid Search Details',
    description: 'Google Ads setup across the group.',
    conditional: { questionId: '2.1', includes: 'paid_search' },
    questions: [
      { id: '2A.1', label: 'Do you have existing Google Ads accounts?', type: 'radio', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' },
      ]},
      { id: '2A.1a', label: 'Google Ads Customer IDs', type: 'textarea', placeholder: 'List all 10-digit IDs, e.g. 123-456-7890', hint: 'Are they managed centrally or per location?', showWhen: { questionId: '2A.1', equals: 'yes' } },
      { id: '2A.2', label: 'Does each location have Google Analytics 4 installed?', type: 'radio', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'partial', label: 'Some locations' },
      ]},
      { id: '2A.2a', label: 'GA4 Property details', type: 'textarea', placeholder: 'Centralised or separate properties? Measurement IDs if known.', showWhen: { questionId: '2A.2', equals: 'yes' } },
      { id: '2A.3', label: 'Is Google Tag Manager in use?', type: 'radio', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unsure', label: 'Not sure' },
      ]},
      { id: '2A.3a', label: 'GTM details', type: 'text', placeholder: 'Centrally managed or per site? Container ID if known.', showWhen: { questionId: '2A.3', equals: 'yes' } },
      { id: '2A.4', label: 'Are phone call conversions currently tracked per location?', type: 'radio', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'partial', label: 'Some locations' },
      ]},
      { id: '2A.5', label: 'What is the current total monthly Google Ads spend across the group?', type: 'text', placeholder: 'e.g. \u00a38,000/month' },
      { id: '2A.6', label: 'What is the target monthly Google Ads budget going forward \u2014 total, and how should it be allocated across locations?', type: 'textarea' },
    ],
  },
  {
    id: '2B',
    title: 'Paid Social Details',
    description: 'Meta Ads setup across the group.',
    conditional: { questionId: '2.1', includes: 'paid_social' },
    questions: [
      { id: '2B.1', label: 'Do you have a central Facebook Business Manager?', type: 'radio', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' },
      ]},
      { id: '2B.1a', label: 'Business Manager ID', type: 'text', placeholder: 'e.g. 123456789012345', showWhen: { questionId: '2B.1', equals: 'yes' } },
      { id: '2B.2', label: 'Does each location have its own Facebook Page, or is there a single group page?', type: 'text' },
      { id: '2B.3', label: 'Is Meta Pixel / Conversions API installed across all location websites?', type: 'radio', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'partial', label: 'Some locations' },
      ]},
      { id: '2B.4', label: 'Do locations have separate Instagram profiles?', type: 'radio', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'mix', label: 'Mix' },
      ]},
      { id: '2B.5', label: 'What is the current total monthly Meta Ads spend across the group?', type: 'text', placeholder: 'e.g. \u00a35,000/month' },
      { id: '2B.6', label: 'What is the target monthly Meta Ads budget \u2014 total and per location allocation?', type: 'textarea' },
    ],
  },
  {
    id: '2C',
    title: 'SEO Details',
    description: 'Current SEO status across the group.',
    conditional: { questionId: '2.1', includes: 'seo' },
    questions: [
      { id: '2C.1', label: 'Does each location have its own Google Business Profile set up and verified?', type: 'radio', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'partial', label: 'Some locations' },
      ]},
      { id: '2C.2', label: 'Are location websites on a single domain (subfolders) or separate domains?', type: 'radio', options: [
        { value: 'single', label: 'Single domain (subfolders)' },
        { value: 'separate', label: 'Separate domains' },
        { value: 'mix', label: 'Mix' },
      ]},
      { id: '2C.3', label: 'Has SEO work been done on any location sites previously?', type: 'textarea', hint: 'If yes, by whom and when?' },
      { id: '2C.4', label: 'Are there any locations you want to prioritise for SEO growth?', type: 'textarea' },
    ],
  },
  {
    id: '3',
    title: 'Treatments to Advertise',
    description: 'Select all treatments you want to actively advertise across the group.',
    questions: [
      { id: '3.1', label: 'Which treatments do you want to actively advertise across the group?', type: 'checkbox', required: true, options: TREATMENT_OPTIONS },
      { id: '3.2', label: 'Which treatments does each location offer?', type: 'location-checkbox-matrix', locationSourceId: '1.6', matrixOptions: TREATMENT_OPTIONS, hint: 'Toggle "Applies to all" if every location offers the same treatments.' },
      { id: '3.3', label: 'Which treatment is the group\u2019s highest priority to fill capacity for right now?', type: 'text' },
      { id: '3.4', label: 'Are there specific locations where certain treatments need prioritising more than others?', type: 'textarea' },
    ],
  },
  {
    id: '3A',
    title: 'Treatment Pricing & Details',
    description: 'For each treatment you selected, tell us about your pricing and offers.',
    questions: [
      { id: '3A.1', label: 'Treatment pricing', type: 'treatment-pricing', treatmentSourceId: '3.1', treatmentOptions: TREATMENT_OPTIONS, hint: 'This helps us write accurate ad copy and calculate ROI.' },
      { id: '3A.2', label: 'Are prices standardised across locations, or does pricing vary?', type: 'textarea', hint: 'If prices differ by location, please note the key differences.' },
      { id: '3A.3', label: 'Do you have a price list you can share?', type: 'radio', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' },
      ]},
      { id: '3A.3a', label: 'Price list link', type: 'url', placeholder: 'https://yourpractice.com/prices or Google Drive / Dropbox link', hint: 'Paste a link to your online price list or upload to the Brand Assets Drive folder.', showWhen: { questionId: '3A.3', equals: 'yes' } },
      { id: '3A.4', label: 'What is the current average monthly new patient volume for your priority treatment \u2014 total across the group and per location?', type: 'textarea' },
      { id: '3A.5', label: 'What is the target monthly new patient volume for your priority treatment \u2014 total and per location?', type: 'textarea' },
    ],
  },
  {
    id: '4',
    title: 'Current Marketing & Ad Spend',
    questions: [
      { id: '4.1', label: 'What is your total current monthly marketing spend across all locations and channels?', type: 'text', placeholder: 'e.g. \u00a315,000/month' },
      { id: '4.2', label: 'Which marketing channels are currently active across the group?', type: 'textarea' },
      { id: '4.3', label: 'Is marketing currently managed centrally, by individual practices, or through an existing agency?', type: 'text' },
      { id: '4.4', label: 'Are you currently working with any other marketing agency or freelancer?', type: 'textarea', hint: 'If yes, what are they handling?' },
      { id: '4.5', label: 'What results are you currently getting group-wide?', type: 'textarea', hint: 'Total leads per month, cost per lead \u2014 approximate.' },
      { id: '4.6', label: 'What has not worked in past marketing efforts at group level?', type: 'textarea' },
    ],
  },
  {
    id: '5',
    title: 'Goals & Revenue Targets',
    questions: [
      { id: '5.1', label: 'What is the group\u2019s total monthly revenue target from new patient treatments?', type: 'text', placeholder: 'e.g. \u00a3200,000' },
      { id: '5.2', label: 'Do individual locations have their own revenue targets?', type: 'textarea', hint: 'If yes, please specify per location.' },
      { id: '5.3', label: 'What is the target number of new patient leads per month \u2014 group total and per location?', type: 'textarea' },
      { id: '5.4', label: 'What is your target cost per lead \u2014 group-wide and/or per location?', type: 'text' },
      { id: '5.5', label: 'What does success look like at 3 months? At 12 months?', type: 'textarea' },
      { id: '5.6', label: 'Are there locations that are underperforming that you specifically want to turn around?', type: 'textarea' },
      { id: '5.7', label: 'Are there peak periods or seasonal pushes relevant to the group?', type: 'textarea' },
      { id: '5.8', label: 'Do you have a target return on ad spend (ROAS) or ROI figure for the group?', type: 'text' },
    ],
  },
  {
    id: '6',
    title: 'Brand Assets & Guidelines',
    questions: [
      { id: '6.0', label: 'Brand Assets Folder', type: 'drive-link', hint: 'Please upload your logo files, brand guidelines, photography, and any other assets to the Google Drive folder below.' },
      { id: '6.1', label: 'Is the group operating under a single brand identity or do locations have individual branding?', type: 'radio', options: [
        { value: 'single', label: 'Single brand' },
        { value: 'individual', label: 'Individual branding per location' },
        { value: 'mix', label: 'Mix' },
      ]},
      { id: '6.2', label: 'Please share the master logo files for the group brand', type: 'textarea', hint: 'Upload to the Drive folder above. If locations have individual logos, please share per location.' },
      { id: '6.3', label: 'What are the group brand colours?', type: 'brand-colours', hint: 'Add each colour individually. Hex codes (e.g. #1A2B3C), RGB, or colour names all work.' },
      { id: '6.4', label: 'What are your brand fonts?', type: 'brand-fonts', hint: 'Add each font. If it\u2019s a Google Font, we\u2019ll preview it for you.' },
      { id: '6.5', label: 'Do you have a group brand guidelines document or style guide?', type: 'textarea', hint: 'Upload to the Drive folder or paste a link.' },
      { id: '6.6', label: 'Do you have photography or video assets \u2014 of practices, teams, or patients (with consent) \u2014 for any or all locations?', type: 'textarea', hint: 'Upload to the Drive folder or paste links.' },
      { id: '6.7', label: 'Do you have patient testimonials or reviews per location we can use in ads?', type: 'textarea' },
      { id: '6.8', label: 'What tone of voice best describes the group brand?', type: 'radio', options: [
        { value: 'warm', label: 'Warm and approachable' },
        { value: 'clinical', label: 'Clinical and professional' },
        { value: 'luxury', label: 'Luxury / premium' },
        { value: 'friendly', label: 'Friendly and accessible' },
        { value: 'other', label: 'Other (describe below)' },
      ]},
      { id: '6.9', label: 'Are there any words, phrases, or visual styles you do NOT want used in advertising for any location?', type: 'textarea' },
    ],
  },
  {
    id: '7',
    title: 'Competitors',
    questions: [
      { id: '7.1', label: 'Who are the main competitors for the group at a national or regional level?', type: 'repeater', minRepeats: 1, maxRepeats: 10, subFields: [
        { id: 'name', label: 'Competitor name', type: 'text', placeholder: 'Group or practice name' },
        { id: 'location', label: 'Location / region', type: 'text', placeholder: 'e.g. South East, National' },
        { id: 'website', label: 'Website (if known)', type: 'url', placeholder: 'https://' },
      ]},
      { id: '7.2', label: 'Who are the local competitors for each individual location?', type: 'textarea', hint: 'Please list per location if possible.' },
      { id: '7.3', label: 'Are there specific competitor groups or independent practices you feel are outperforming you in marketing?', type: 'textarea' },
      { id: '7.4', label: 'What are the group\u2019s key differentiators vs competitors?', type: 'textarea', hint: 'e.g. pricing, technology, group scale, finance options, team credentials.' },
      { id: '7.5', label: 'Do you offer patient finance?', type: 'textarea', hint: 'If yes, through which provider and at what rates? Is this consistent across locations?' },
    ],
  },
  {
    id: '8',
    title: 'Website & Patient Journey',
    questions: [
      { id: '8.1', label: 'Who manages the group\u2019s web presence? Is it centralised or per location?', type: 'text' },
      { id: '8.2', label: 'What platform are location websites built on?', type: 'text', placeholder: 'e.g. WordPress, Squarespace, custom' },
      { id: '8.3', label: 'How do patients currently book or enquire at each location?', type: 'textarea', placeholder: 'e.g. phone, central booking line, online forms, WhatsApp, live chat' },
      { id: '8.4', label: 'Is there a central booking system, or does each location manage its own?', type: 'text' },
      { id: '8.5', label: 'Do you have dedicated landing pages for key treatments per location, or does ad traffic go to central/homepage destinations?', type: 'textarea' },
      { id: '8.6', label: 'What is the average enquiry-to-booked-appointment conversion rate across the group?', type: 'text', hint: 'If known.' },
    ],
  },
  {
    id: '9',
    title: 'Reporting & Governance',
    questions: [
      { id: '9.1', label: 'Who should receive performance reports \u2014 group level only, or location managers too?', type: 'radio', options: [
        { value: 'group', label: 'Group level only' },
        { value: 'both', label: 'Group + location managers' },
      ]},
      { id: '9.2', label: 'Do you need location-by-location breakdowns in reporting or a consolidated group view?', type: 'radio', options: [
        { value: 'location', label: 'Location-by-location breakdowns' },
        { value: 'consolidated', label: 'Consolidated group view' },
        { value: 'both', label: 'Both' },
      ]},
      { id: '9.3', label: 'Who has sign-off authority for ad creative and campaign changes?', type: 'text', hint: 'Central marketing team, individual practice managers, or Vendo autonomy?' },
    ],
  },
  {
    id: '10',
    title: 'Compliance Notes',
    questions: [
      { id: '10.1', label: 'Are all clinicians across the group GDC registered?', type: 'radio', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' },
      ]},
      { id: '10.2', label: 'Do you have a central compliance lead who oversees marketing approvals?', type: 'text' },
      { id: '10.3', label: 'Are you aware of ASA and GDC advertising guidelines around before/after imagery and treatment claims?', type: 'radio', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' },
      ]},
      { id: '10.4', label: 'Do you have patient consent processes in place for using imagery in marketing materials across all locations?', type: 'radio', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'partial', label: 'Some locations' },
      ]},
    ],
  },
];

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

export const ONBOARDING_TEMPLATES: OnboardingTemplate[] = [
  {
    id: 'dental-single',
    vertical: 'dental',
    type: 'single',
    title: 'Single Practice Onboarding',
    subtitle: 'For individual dental practices',
    sections: dentalSingleSections,
  },
  {
    id: 'dental-multi',
    vertical: 'dental',
    type: 'multi',
    title: 'DSO / Multi-Location Onboarding',
    subtitle: 'For dental groups with multiple locations',
    sections: dentalMultiSections,
  },
];

export function getTemplate(id: string): OnboardingTemplate | undefined {
  return ONBOARDING_TEMPLATES.find(t => t.id === id);
}

export function getTemplatesForVertical(vertical: string): OnboardingTemplate[] {
  return ONBOARDING_TEMPLATES.filter(t => t.vertical === vertical);
}

/**
 * Given a template and current answers, return the list of active sections
 * (filtering out conditional sections whose conditions are not met).
 */
export function getActiveSections(template: OnboardingTemplate, answers: Record<string, unknown>): Section[] {
  return template.sections.filter(section => {
    if (!section.conditional) return true;
    const val = answers[section.conditional.questionId];
    if (Array.isArray(val)) return val.includes(section.conditional.includes);
    if (typeof val === 'string') return val === section.conditional.includes;
    return false;
  });
}
