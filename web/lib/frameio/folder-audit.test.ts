import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  auditProject,
  checkConceptName,
  checkExportName,
  hasInformalMarker,
  isTitleCase,
  parseShootDate,
  type AuditNode,
} from './folder-audit.js';

const CONCEPT = 'Anxious Avoider | Talked Through Every Step | £49 New Patient Exam';

describe('checkConceptName', () => {
  it('accepts the SOP examples', () => {
    for (const name of [
      CONCEPT,
      'Pre-Retirement Restorative | Failing Crowns and Bridges | Implant Assessment',
      'Local Family | Kids Seen Without Stress | Family New Patient Offer',
    ]) assert.equal(checkConceptName(name).ok, true, name);
  });
  it('flags ages in the persona', () => {
    const r = checkConceptName('Anxious Avoider 45-65 | Talked Through Every Step | Free Sedation Consult');
    assert.equal(r.ok, false);
    assert.match(r.problems.join(), /age/);
  });
  it('flags bad pipe spacing and suggests the fix', () => {
    const r = checkConceptName('Anxious Avoider|Talked Through Every Step |£49 New Patient Exam');
    assert.equal(r.ok, false);
    assert.equal(r.suggestion, CONCEPT);
  });
  it('flags camelCase and missing parts', () => {
    assert.equal(checkConceptName('AnxiousAvoider | Talked Through Every Step | Free Sedation Consult').ok, false);
    assert.equal(checkConceptName('Anxious Avoider | Free Sedation Consult').ok, false);
  });
});

describe('checkExportName', () => {
  it('accepts a correct export with and without a variant', () => {
    assert.deepEqual(checkExportName(`${CONCEPT} | 9x16 | 30s | Hook A | v03 | Final.mp4`, CONCEPT).problems, []);
    assert.deepEqual(checkExportName(`${CONCEPT} | 4x5 | Static | v01 | Final.png`, CONCEPT).problems, []);
  });
  it('flags a colon ratio, one-digit version and bad status, with a suggestion', () => {
    const r = checkExportName(`${CONCEPT} | 9:16 | 30s | v3 | Approved.mp4`, CONCEPT);
    assert.equal(r.problems.length, 3);
    assert.equal(r.suggestion, `${CONCEPT} | 9x16 | 30s | v03 | Approved.mp4`);
  });
  it('flags a concept mismatch with its folder', () => {
    const r = checkExportName(`${CONCEPT} | 9x16 | 30s | v01 | Internal.mp4`, 'Anxious Avoider | Needle Phobia Handled | Free Sedation Consult');
    assert.match(r.problems.join(), /does not match its folder/);
  });
  it('recognises raw camera clips', () => {
    assert.match(checkExportName('P1136482.MP4', CONCEPT).problems[0], /raw camera clip/);
  });
});

describe('helpers', () => {
  it('only treats capital NEW as an informal marker', () => {
    assert.equal(hasInformalMarker(`${CONCEPT} | 9x16 | 30s | v01 | Final`), false);
    assert.equal(hasInformalMarker('Implants ad NEW'), true);
    assert.equal(hasInformalMarker('cut final_FINAL'), true);
    assert.equal(hasInformalMarker('cut copy 2'), true);
  });
  it('title case allows small words and numbers', () => {
    assert.equal(isTitleCase('Years of Avoiding the Dentist'), true);
    assert.equal(isTitleCase('years of avoiding'), false);
  });
});

describe('parseShootDate', () => {
  it('reads the shoot folder formats seen in Frame.io', () => {
    assert.equal(parseShootDate('February 25th 2026 | Paid Ads & Organic Content'), '2026-02-25');
    assert.equal(parseShootDate('January 2026'), '2026-01-01');
    assert.equal(parseShootDate('December 2025 Shoot'), '2025-12-01');
    assert.equal(parseShootDate('25th October 2026'), '2026-10-25');
    assert.equal(parseShootDate('Shoot 14.10.26'), '2026-10-14');
    assert.equal(parseShootDate('RAWS'), null);
  });
});

describe('auditProject', () => {
  const n = (id: string, parent: string | null, type: string, name: string): AuditNode => ({ id, parent_id: parent, type, name });
  const SHOOT = 'October 14th 2026 | Paid Ads & Organic Content';
  const tidy: AuditNode[] = [
    n('p', null, 'project', 'Thornbury Dental'),
    n('root', null, 'folder', 'root'),
    n('admin', 'root', 'folder', '_Admin'),
    n('shoot', 'root', 'folder', SHOOT),
    n('raw', 'shoot', 'folder', 'Raw Footage'),
    n('social', 'shoot', 'folder', 'Social Ads'),
    n('treat', 'social', 'folder', 'Treatments'),
    n('sed', 'treat', 'folder', 'Sedation'),
    n('con', 'sed', 'folder', CONCEPT),
    n('f1', 'con', 'version_stack', `${CONCEPT} | 9x16 | 30s | v03 | Final.mp4`),
    n('rawclip', 'raw', 'file', 'P1136482.MP4'),
    // legacy shoot: off-SOP names are not held to the full rules
    n('old', 'root', 'folder', 'January 2026'),
    n('oldsocial', 'old', 'folder', 'Social'),
    n('oldfile', 'oldsocial', 'file', 'Sedation Explainer Hook 3.mov'),
  ];

  it('passes a tidy project and ignores legacy naming', () => {
    assert.deepEqual(auditProject(tidy), []);
  });

  it('only warns about duplicates in legacy shoots', () => {
    const issues = auditProject(tidy.concat([n('dup', 'oldsocial', 'file', 'Sedation Explainer Hook 3 (1).mov')]));
    assert.deepEqual(issues.map((i) => [i.rule, i.severity]), [['informal-name', 'warning']]);
  });

  it('catches misplaced and misnamed assets in a new shoot', () => {
    const messy = tidy.concat([
      n('loose', 'sed', 'file', `${CONCEPT} | 9x16 | 30s | v01 | Internal.mp4`),
      n('rawin', 'con', 'file', 'C0012.MP4'),
      n('finalraw', 'raw', 'file', `${CONCEPT} | 9x16 | 30s | v02 | Final.mp4`),
      n('dupe', 'con', 'file', `${CONCEPT} | 9x16 | 30s | v03 | Internal.mp4`),
      n('test', 'shoot', 'folder', 'Testimonials'),
      n('t1', 'test', 'file', 'sarah testimonial final_FINAL.mp4'),
      n('socials', 'shoot', 'folder', 'Socials'),
    ]);
    const rules = auditProject(messy).map((i) => i.rule).sort();
    assert.deepEqual(rules, [
      'export-name',        // raw clip inside the concept folder
      'final-in-raw',
      'informal-name',
      'loose-social-asset',
      'section-name',
      'unexpected-section', // "Socials" → "Social Ads"
      'version-reused',
    ]);
  });

  it('flags a new shoot missing Raw Footage and _Admin', () => {
    const bare = [n('p', null, 'project', 'New Client'), n('root', null, 'folder', 'root'), n('s', 'root', 'folder', SHOOT)];
    assert.deepEqual(auditProject(bare).map((i) => i.rule).sort(), ['missing-admin', 'missing-raw-footage']);
  });
});
