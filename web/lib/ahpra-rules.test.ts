/**
 * Tests for AHPRA dental advertising compliance checker.
 *
 * Covers: checkAHPRACompliance, AHPRA_RULES, AHPRAViolation
 *
 * Run:
 *   node --test --import tsx/esm web/lib/ahpra-rules.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkAHPRACompliance, AHPRA_RULES } from './ahpra-rules.js';
import type { AHPRAViolation } from './ahpra-rules.js';

// ---------------------------------------------------------------------------
// Testimonials (AHPRA-T1, AHPRA-T2)
// ---------------------------------------------------------------------------

describe('Testimonials', () => {
  it('flags clinical outcome testimonial — patient pain outcome (AHPRA-T1)', () => {
    const violations = checkAHPRACompliance('my pain was gone after treatment');
    const t1 = violations.find((v) => v.rule === 'AHPRA-T1');
    assert.ok(t1, 'Expected AHPRA-T1 violation');
    assert.equal(t1.severity, 'HIGH');
    assert.ok(typeof t1.violation === 'string' && t1.violation.length > 0, 'violation must be non-empty string');
  });

  it('flags "fixed my condition" testimonial pattern (AHPRA-T1)', () => {
    const violations = checkAHPRACompliance('She fixed my teeth perfectly');
    const t1 = violations.find((v) => v.rule === 'AHPRA-T1');
    assert.ok(t1, 'Expected AHPRA-T1 violation');
  });

  it('flags "results speak for themselves" (AHPRA-T1)', () => {
    const violations = checkAHPRACompliance('The results speak for themselves');
    const t1 = violations.find((v) => v.rule === 'AHPRA-T1');
    assert.ok(t1, 'Expected AHPRA-T1 violation');
  });
});

// ---------------------------------------------------------------------------
// Outcome Claims and Guarantees (AHPRA-O1, AHPRA-O2, AHPRA-O3)
// ---------------------------------------------------------------------------

describe('Outcome Claims — AHPRA-O1 (guaranteed results)', () => {
  it('flags "guaranteed results in just 2 weeks"', () => {
    const violations = checkAHPRACompliance('guaranteed results in just 2 weeks');
    const o1 = violations.find((v) => v.rule === 'AHPRA-O1');
    assert.ok(o1, 'Expected AHPRA-O1 violation');
    assert.equal(o1.severity, 'HIGH');
  });

  it('flags "guaranteed" as standalone term', () => {
    const violations = checkAHPRACompliance('Results are guaranteed');
    const o1 = violations.find((v) => v.rule === 'AHPRA-O1');
    assert.ok(o1, 'Expected AHPRA-O1 violation');
  });

  it('flags "100% success rate"', () => {
    const violations = checkAHPRACompliance('We have a 100% success rate for our implants');
    const o1 = violations.find((v) => v.rule === 'AHPRA-O1');
    assert.ok(o1, 'Expected AHPRA-O1 violation');
  });
});

describe('Outcome Claims — AHPRA-O2 (unrealistic expectations)', () => {
  it('flags "pain-free treatment guaranteed" — both O1 and O2', () => {
    const violations = checkAHPRACompliance('pain-free treatment guaranteed');
    const o1 = violations.find((v) => v.rule === 'AHPRA-O1');
    const o2 = violations.find((v) => v.rule === 'AHPRA-O2');
    assert.ok(o1, 'Expected AHPRA-O1 violation');
    assert.ok(o2, 'Expected AHPRA-O2 violation');
  });

  it('flags "instant results"', () => {
    const violations = checkAHPRACompliance('Get instant results with our whitening treatment');
    const o2 = violations.find((v) => v.rule === 'AHPRA-O2');
    assert.ok(o2, 'Expected AHPRA-O2 violation');
    assert.equal(o2.severity, 'MEDIUM');
  });

  it('flags "risk-free"', () => {
    const violations = checkAHPRACompliance('A completely risk-free procedure');
    const o2 = violations.find((v) => v.rule === 'AHPRA-O2');
    assert.ok(o2, 'Expected AHPRA-O2 violation');
  });

  it('flags "miracle" claims', () => {
    const violations = checkAHPRACompliance('Our miracle treatment will change your smile');
    const o2 = violations.find((v) => v.rule === 'AHPRA-O2');
    assert.ok(o2, 'Expected AHPRA-O2 violation');
  });

  it('flags "transform your life"', () => {
    const violations = checkAHPRACompliance('This procedure will transform your life forever');
    const o2 = violations.find((v) => v.rule === 'AHPRA-O2');
    assert.ok(o2, 'Expected AHPRA-O2 violation');
  });
});

describe('Outcome Claims — AHPRA-O3 (fear/urgency)', () => {
  it('flags "before it\'s too late"', () => {
    const violations = checkAHPRACompliance('Book your appointment before it\'s too late');
    const o3 = violations.find((v) => v.rule === 'AHPRA-O3');
    assert.ok(o3, 'Expected AHPRA-O3 violation');
    assert.equal(o3.severity, 'MEDIUM');
  });

  it('flags "don\'t risk" pattern', () => {
    const violations = checkAHPRACompliance("Don't risk your smile health — book today");
    const o3 = violations.find((v) => v.rule === 'AHPRA-O3');
    assert.ok(o3, 'Expected AHPRA-O3 violation');
  });
});

// ---------------------------------------------------------------------------
// Comparative and Superlative Claims (AHPRA-C1, AHPRA-C2)
// ---------------------------------------------------------------------------

describe('Comparative Claims — AHPRA-C1 (superlatives)', () => {
  it('flags "best dentist in Sydney"', () => {
    const violations = checkAHPRACompliance('best dentist in Sydney');
    const c1 = violations.find((v) => v.rule === 'AHPRA-C1');
    assert.ok(c1, 'Expected AHPRA-C1 violation');
    assert.equal(c1.severity, 'MEDIUM');
  });

  it('flags "world-class dental care"', () => {
    const violations = checkAHPRACompliance('We provide world-class dental care');
    const c1 = violations.find((v) => v.rule === 'AHPRA-C1');
    assert.ok(c1, 'Expected AHPRA-C1 violation');
  });

  it('flags "most trusted"', () => {
    const violations = checkAHPRACompliance('The most trusted dental practice in the area');
    const c1 = violations.find((v) => v.rule === 'AHPRA-C1');
    assert.ok(c1, 'Expected AHPRA-C1 violation');
  });

  it('flags "number one"', () => {
    const violations = checkAHPRACompliance("We're number one for dental implants");
    const c1 = violations.find((v) => v.rule === 'AHPRA-C1');
    assert.ok(c1, 'Expected AHPRA-C1 violation');
  });
});

describe('Comparative Claims — AHPRA-C2 (comparative without proof)', () => {
  it('flags "better than other practices"', () => {
    const violations = checkAHPRACompliance('We are better than other practices in the area');
    const c2 = violations.find((v) => v.rule === 'AHPRA-C2');
    assert.ok(c2, 'Expected AHPRA-C2 violation');
    assert.equal(c2.severity, 'MEDIUM');
  });

  it('flags "unlike other dentists"', () => {
    const violations = checkAHPRACompliance('Unlike other dentists, we use the latest technology');
    const c2 = violations.find((v) => v.rule === 'AHPRA-C2');
    assert.ok(c2, 'Expected AHPRA-C2 violation');
  });

  it('flags "the only practice that"', () => {
    const violations = checkAHPRACompliance('We are the only practice that offers this treatment');
    const c2 = violations.find((v) => v.rule === 'AHPRA-C2');
    assert.ok(c2, 'Expected AHPRA-C2 violation');
  });
});

// ---------------------------------------------------------------------------
// Title and Qualification Misuse (AHPRA-Q1, AHPRA-Q2)
// ---------------------------------------------------------------------------

describe('Qualifications — AHPRA-Q1 (specialist title)', () => {
  it('flags "specialises in cosmetic dentistry"', () => {
    const violations = checkAHPRACompliance('specialises in cosmetic dentistry');
    const q1 = violations.find((v) => v.rule === 'AHPRA-Q1');
    assert.ok(q1, 'Expected AHPRA-Q1 violation');
    assert.equal(q1.severity, 'HIGH');
  });

  it('flags "specialist" as standalone claim', () => {
    const violations = checkAHPRACompliance('Our dental specialist will see you today');
    const q1 = violations.find((v) => v.rule === 'AHPRA-Q1');
    assert.ok(q1, 'Expected AHPRA-Q1 violation');
  });

  it('does NOT flag "special interest in cosmetic dentistry" (explicitly allowed)', () => {
    const violations = checkAHPRACompliance('special interest in cosmetic dentistry');
    const q1 = violations.find((v) => v.rule === 'AHPRA-Q1');
    assert.equal(q1, undefined, '"special interest in" must NOT be flagged as AHPRA-Q1');
  });

  it('does NOT flag "special interest in" (explicitly allowed phrase)', () => {
    const violations = checkAHPRACompliance('Dr Smith has a special interest in implants');
    const q1 = violations.find((v) => v.rule === 'AHPRA-Q1');
    assert.equal(q1, undefined, '"special interest in" must NOT be flagged as AHPRA-Q1');
  });
});

// ---------------------------------------------------------------------------
// Visual Content (AHPRA-V1, AHPRA-V2)
// ---------------------------------------------------------------------------

describe('Visual Content — AHPRA-V1 (before-and-after)', () => {
  it('flags "before and after" image description', () => {
    const violations = checkAHPRACompliance('Check out our before and after gallery');
    const v1 = violations.find((v) => v.rule === 'AHPRA-V1');
    assert.ok(v1, 'Expected AHPRA-V1 violation');
    assert.equal(v1.severity, 'MEDIUM');
  });
});

// ---------------------------------------------------------------------------
// Inducements (AHPRA-I1, AHPRA-I2)
// ---------------------------------------------------------------------------

describe('Inducements — AHPRA-I1 (undisclosed offers)', () => {
  it('flags "free consultation" without terms', () => {
    const violations = checkAHPRACompliance('Get a free consultation today');
    const i1 = violations.find((v) => v.rule === 'AHPRA-I1');
    assert.ok(i1, 'Expected AHPRA-I1 violation');
    assert.equal(i1.severity, 'MEDIUM');
  });

  it('flags "limited offer" without terms', () => {
    const violations = checkAHPRACompliance('This is a limited offer — book now');
    const i1 = violations.find((v) => v.rule === 'AHPRA-I1');
    assert.ok(i1, 'Expected AHPRA-I1 violation');
  });
});

// ---------------------------------------------------------------------------
// Evidence and Accuracy (AHPRA-E1, AHPRA-F1)
// ---------------------------------------------------------------------------

describe('Evidence — AHPRA-E1 (unsubstantiated claims)', () => {
  it('flags "clinically proven" without evidence reference', () => {
    const violations = checkAHPRACompliance('Our clinically proven treatment delivers results');
    const e1 = violations.find((v) => v.rule === 'AHPRA-E1');
    assert.ok(e1, 'Expected AHPRA-E1 violation');
    assert.equal(e1.severity, 'MEDIUM');
  });

  it('flags "proven to" claims without source', () => {
    const violations = checkAHPRACompliance('Proven to whiten teeth by 5 shades');
    const e1 = violations.find((v) => v.rule === 'AHPRA-E1');
    assert.ok(e1, 'Expected AHPRA-E1 violation');
  });
});

// ---------------------------------------------------------------------------
// Multiple violations
// ---------------------------------------------------------------------------

describe('Multiple violations', () => {
  it('"pain-free treatment guaranteed" triggers both AHPRA-O1 and AHPRA-O2', () => {
    const violations = checkAHPRACompliance('pain-free treatment guaranteed');
    const ruleIds = violations.map((v) => v.rule);
    assert.ok(ruleIds.includes('AHPRA-O1'), 'Expected AHPRA-O1');
    assert.ok(ruleIds.includes('AHPRA-O2'), 'Expected AHPRA-O2');
  });
});

// ---------------------------------------------------------------------------
// Clean content
// ---------------------------------------------------------------------------

describe('Clean content', () => {
  it('returns empty array for clean professional copy', () => {
    const violations = checkAHPRACompliance(
      'We offer professional dental care in a friendly environment'
    );
    assert.deepEqual(violations, []);
  });

  it('returns empty array for "special interest in cosmetic dentistry"', () => {
    const violations = checkAHPRACompliance('special interest in cosmetic dentistry');
    assert.deepEqual(violations, []);
  });
});

// ---------------------------------------------------------------------------
// Violation structure
// ---------------------------------------------------------------------------

describe('Violation structure', () => {
  it('each violation includes rule (string), violation (string), severity (HIGH|MEDIUM|LOW)', () => {
    const violations = checkAHPRACompliance('guaranteed results in just 2 weeks');
    assert.ok(violations.length > 0, 'Expected at least one violation');
    for (const v of violations) {
      assert.equal(typeof v.rule, 'string');
      assert.equal(typeof v.violation, 'string');
      assert.ok(
        ['HIGH', 'MEDIUM', 'LOW'].includes(v.severity),
        `Invalid severity: ${v.severity}`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// AHPRA_RULES array — all 7 categories represented
// ---------------------------------------------------------------------------

describe('AHPRA_RULES array', () => {
  const REQUIRED_CATEGORIES = [
    'testimonials',
    'outcome-claims',
    'comparative',
    'qualifications',
    'visual',
    'inducements',
    'evidence',
  ];

  it('contains entries for all 7 required categories', () => {
    const categories = new Set(AHPRA_RULES.map((r) => r.category));
    for (const cat of REQUIRED_CATEGORIES) {
      assert.ok(categories.has(cat), `Missing category: ${cat}`);
    }
  });

  it('contains exactly 15 rules', () => {
    assert.equal(AHPRA_RULES.length, 15);
  });

  it('all rules have non-empty patterns arrays', () => {
    for (const rule of AHPRA_RULES) {
      assert.ok(rule.patterns.length > 0, `Rule ${rule.id} has no patterns`);
    }
  });
});
