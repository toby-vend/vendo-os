/**
 * AHPRA dental advertising compliance checker.
 *
 * Deterministic rule-based checker — no LLM calls, no network, no async.
 * Receives serialised draft text, matches against pre-compiled regex patterns,
 * returns an array of violation records with rule ID, matched text, and severity.
 *
 * All patterns are compiled once at module load time (as RegExp literals in the
 * rule definitions). No new RegExp objects are created inside checkAHPRACompliance.
 *
 * Sources: AHPRA official advertising guidelines (Health Practitioner Regulation
 * National Law s.133), 2025 cosmetic procedures guidelines (effective 2 Sep 2025).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AHPRARule {
  id: string;
  category: string;
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  patterns: RegExp[];
}

export interface AHPRAViolation {
  rule: string;
  violation: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export const AHPRA_RULES: AHPRARule[] = [
  // -------------------------------------------------------------------------
  // Category 1: Testimonials and Patient Stories
  // -------------------------------------------------------------------------
  {
    id: 'AHPRA-T1',
    category: 'testimonials',
    description: 'Clinical outcome testimonials prohibited',
    severity: 'HIGH',
    patterns: [
      /my\s+(pain|symptoms?|condition|teeth|jaw|gums?)\s+(is|are|was|were)\s+(gone|fixed|cured|healed|better)/i,
      /fixed\s+my\s+\w+/i,
      /results?\s+speak\s+for\s+themselves/i,
      /my\s+\w+\s+disappeared\s+after/i,
      /after\s+treatment[,\s]+my\s+(pain|symptoms?|condition)/i,
    ],
  },
  {
    id: 'AHPRA-T2',
    category: 'testimonials',
    description: 'Influencer endorsements prohibited (from 2 September 2025)',
    severity: 'HIGH',
    patterns: [
      /\binfluencer\s+promot/i,
      /\bbrand\s+ambassador/i,
      /as\s+seen\s+on\s+(instagram|tiktok|youtube|social)/i,
      /free\s+treatment\s+in\s+exchange\s+for/i,
      /\bsponsored\s+by\s+.{0,30}dentist/i,
    ],
  },

  // -------------------------------------------------------------------------
  // Category 2: Outcome Claims and Guarantees
  // -------------------------------------------------------------------------
  {
    id: 'AHPRA-O1',
    category: 'outcome-claims',
    description: 'Guaranteed results prohibited',
    severity: 'HIGH',
    patterns: [
      /\bguarantee[ds]?\b/i,
      /100%\s+success/i,
      /guaranteed\s+results?/i,
      /permanent\s+(solution|result|fix)/i,
      /\bwill\s+fix\b/i,
      /you\s+will\s+achieve/i,
      /\bcertain\s+to\b/i,
      /\bdefinitely\s+(will|achieve|get|see)/i,
    ],
  },
  {
    id: 'AHPRA-O2',
    category: 'outcome-claims',
    description: 'Unrealistic expectation language prohibited',
    severity: 'MEDIUM',
    patterns: [
      /\bpain[- ]free\b/i,
      /\binstant\s+results?\b/i,
      /\brisk[- ]free\b/i,
      /\bmiracle\b/i,
      /\bcure\b/i,
      /\binstant\s+cure\b/i,
      /\bhappier\s+you\b/i,
      /restore\s+self[- ]esteem/i,
      /confidence\s+boost/i,
      /transform\s+your\s+life/i,
    ],
  },
  {
    id: 'AHPRA-O3',
    category: 'outcome-claims',
    description: 'Fear-based and urgency advertising prohibited',
    severity: 'MEDIUM',
    patterns: [
      /book\s+now\s+or\s+\w/i,
      /before\s+it['']?s\s+too\s+late/i,
      /don['']?t\s+risk\b/i,
      /limited\s+time\s+(offer|deal|only)/i,
      /\bact\s+now\b/i,
    ],
  },

  // -------------------------------------------------------------------------
  // Category 3: Comparative and Superlative Claims
  // -------------------------------------------------------------------------
  {
    id: 'AHPRA-C1',
    category: 'comparative',
    description: 'Superlative claims prohibited without objective basis',
    severity: 'MEDIUM',
    patterns: [
      /\bbest\b/i,
      /\bleading\b/i,
      /\bmost\s+trusted\b/i,
      /\bworld[- ]class\b/i,
      /\bworld\s+renowned\b/i,
      /\bnumber\s+one\b/i,
      /\bno\.\s*1\b/i,
      /\btop\s+(dentist|practice|clinic|dental)/i,
      /\bpremier\s+(dentist|practice|clinic|dental|provider)/i,
      /\bmost\s+experienced\b/i,
      /\baustralia['']?s\s+best\b/i,
    ],
  },
  {
    id: 'AHPRA-C2',
    category: 'comparative',
    description: 'Comparative advertising without objective proof prohibited',
    severity: 'MEDIUM',
    patterns: [
      /better\s+than\s+(other|competing|rival)/i,
      /unlike\s+other\s+(dentist|practice|clinic|practitioner)/i,
      /the\s+only\s+practice\s+that/i,
    ],
  },

  // -------------------------------------------------------------------------
  // Category 4: Title and Qualification Misuse
  // -------------------------------------------------------------------------
  {
    id: 'AHPRA-Q1',
    category: 'qualifications',
    description: 'Specialist title restricted to formally registered specialists',
    severity: 'HIGH',
    patterns: [
      // Negative lookbehind ensures "special interest in" is NOT matched.
      // The phrase "specialises in" must not match when preceded by "special interest" context.
      // We match "specialist" standalone, "specialises in" (but NOT "special interest in"),
      // "specialty practice", "specialised ... dentist", "expert in", standalone "expert"
      /\bspecialist\b(?!\s+interest)/i,
      /(?<!special\s+interest\s+in\s+\S+\s+|special\s+interest\s+)specialises?\s+in\b/i,
      /\bspecialty\s+practice\b/i,
      /\bspecialised\s+\w+\s+dentist\b/i,
      /\bexpert\s+in\b/i,
      /\bexpert\b(?!\s+witness)/i,
    ],
  },
  {
    id: 'AHPRA-Q2',
    category: 'qualifications',
    description: 'Protected title misuse prohibited',
    severity: 'HIGH',
    patterns: [
      /implying\s+qualifications\s+not\s+held/i,
      /registered\s+specialist\s+in(?!\s+(prosthodontics|orthodontics|periodontics|oral\s+surgery|endodontics|paediatric|oral\s+medicine|oral\s+pathology|special\s+needs\s+dentistry))/i,
    ],
  },

  // -------------------------------------------------------------------------
  // Category 5: Visual Content
  // -------------------------------------------------------------------------
  {
    id: 'AHPRA-V1',
    category: 'visual',
    description: 'Before-and-after image rules',
    severity: 'MEDIUM',
    patterns: [
      /before\s+(and|&)\s+after/i,
      /before\/after/i,
      /see\s+the\s+(transformation|difference|results?)\s+in\s+(our\s+)?photos/i,
      /ai[- ]generated\s+(comparison|before|image)/i,
    ],
  },
  {
    id: 'AHPRA-V2',
    category: 'visual',
    description: 'No minors in cosmetic content',
    severity: 'HIGH',
    patterns: [
      /\bunder\s+18\b.{0,50}cosmetic/i,
      /teen.{0,50}cosmetic\s+dental/i,
      /\bminors?\b.{0,50}cosmetic/i,
    ],
  },

  // -------------------------------------------------------------------------
  // Category 6: Inducements and Offers
  // -------------------------------------------------------------------------
  {
    id: 'AHPRA-I1',
    category: 'inducements',
    description: 'Undisclosed inducements prohibited',
    severity: 'MEDIUM',
    patterns: [
      /\bfree\b/i,
      /\blimited\s+offer\b/i,
      /\blimited[-\s]time\s+offer\b/i,
      /referral\s+bonus/i,
    ],
  },
  {
    id: 'AHPRA-I2',
    category: 'inducements',
    description: 'Offers encouraging unnecessary treatment prohibited',
    severity: 'MEDIUM',
    patterns: [
      /buy\s+(two|2|one|1)\s+get\s+(one|1|two|2)\s+free/i,
      /bundle\s+pricing/i,
      /package\s+deal.{0,30}procedure/i,
    ],
  },

  // -------------------------------------------------------------------------
  // Category 7: Evidence and Accuracy
  // -------------------------------------------------------------------------
  {
    id: 'AHPRA-E1',
    category: 'evidence',
    description: 'Unsubstantiated claims prohibited',
    severity: 'MEDIUM',
    patterns: [
      /\bproven\s+to\b/i,
      /\bclinically\s+proven\b/i,
      /\b\d+%\s+of\s+(patients|clients|people)\b/i,
      /\bscientifically\s+proven\b/i,
    ],
  },
  {
    id: 'AHPRA-F1',
    category: 'evidence',
    description: 'False or misleading claims prohibited (s.133 core prohibition)',
    severity: 'HIGH',
    patterns: [
      /\bfalsely\s+(claims?|states?|advertis)/i,
      /misleading\s+(price|cost|fee)/i,
      /hidden\s+(cost|fee|charge)/i,
    ],
  },
];

// ---------------------------------------------------------------------------
// Checker function
// ---------------------------------------------------------------------------

/**
 * Checks the given draft text for AHPRA dental advertising compliance violations.
 *
 * @param draftText - Full serialised draft text (typically the JSON output stringified).
 *   Pattern matching runs across all text fields without field-by-field parsing.
 * @returns Array of AHPRAViolation records. Empty array means no violations found.
 */
export function checkAHPRACompliance(draftText: string): AHPRAViolation[] {
  const violations: AHPRAViolation[] = [];

  for (const rule of AHPRA_RULES) {
    for (const pattern of rule.patterns) {
      const match = pattern.exec(draftText);
      if (match) {
        violations.push({
          rule: rule.id,
          violation: match[0],
          severity: rule.severity,
        });
        // One violation per rule — no need to check remaining patterns for this rule
        break;
      }
    }
  }

  return violations;
}
