import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { destinationPath, firstCutForm, isTeamMember, looksLikeExport, macOptions, nameFromTitle, parseActionPayload, pipelineName, validateFirstCut } from './actions.js';

describe('parseActionPayload', () => {
  it('reads the real Frame.io shape (resources list, flat account_id)', () => {
    const p = parseActionPayload({
      account_id: 'a1', action_id: 'x', interaction_id: 'i1', project: { id: 'p1' },
      resources: [{ id: 'f1', type: 'file' }], type: 'vendo.ai.first_cut', user: { id: 'u1' }, workspace: { id: 'w1' },
      data: { section: 'Social Ads' },
    });
    assert.equal(p.resourceId, 'f1');
    assert.equal(p.resourceType, 'file');
    assert.equal(p.accountId, 'a1');
    assert.deepEqual(p.data, { section: 'Social Ads' });
  });

  it('reads the nested shape', () => {
    const p = parseActionPayload({
      type: 'vendo.ai.first_cut', interaction_id: 'i1', resource: { id: 'f1', type: 'file' },
      user: { id: 'u1' }, account: { id: 'a1' }, project: { id: 'p1' }, data: { concept: '  X  ' },
    });
    assert.equal(p.event, 'vendo.ai.first_cut');
    assert.equal(p.resourceId, 'f1');
    assert.equal(p.userId, 'u1');
    assert.equal(p.projectId, 'p1');
    assert.deepEqual(p.data, { concept: 'X' });
  });

  it('reads the flat shape; no data means the form has not been shown yet', () => {
    const p = parseActionPayload({ event: 'vendo.ai.revision', resource_id: 'f2', user_id: 'u2', account_id: 'a2' });
    assert.equal(p.event, 'vendo.ai.revision');
    assert.equal(p.resourceId, 'f2');
    assert.equal(p.accountId, 'a2');
    assert.equal(p.data, null);
  });
  it('treats an empty answer set as a submitted form (all defaults)', () => {
    assert.deepEqual(parseActionPayload({ type: 'vendo.ai.first_cut', data: {} }).data, {});
  });
});

describe('validateFirstCut', () => {
  it('only needs a type and brand; the AI names the video later', () => {
    const r = validateFirstCut({ section: 'Social Ads', brand: 'vendo', notes: 'keep it short' });
    assert.ok(r.ok);
    if (r.ok) assert.deepEqual(r.params, { section: 'Social Ads', treatment: null, concept: null, brand: 'vendo', notes: 'keep it short' });
  });
  it('uses the default type and brand when Frame.io leaves untouched selects out', () => {
    const r = validateFirstCut({ notes: '' });
    assert.ok(r.ok);
    if (r.ok) { assert.equal(r.params.section, 'Social Ads'); assert.equal(r.params.brand, 'vendo'); }
  });
  it('rejects an unknown type or brand', () => {
    assert.equal(validateFirstCut({ section: 'Video', brand: 'vendo' }).ok, false);
    assert.equal(validateFirstCut({ section: 'Organic', brand: 'nope' }).ok, false);
  });
});

describe('nameFromTitle', () => {
  it('accepts a correct Social Ad name and builds its folder path', () => {
    const n = nameFromTitle('Social Ads', { treatment: 'Invisalign', concept: 'Busy Professionals | Fast Results | Free Consultation' });
    assert.deepEqual(n.problems, []);
    assert.equal(pipelineName('Social Ads', n.concept), n.concept);
    assert.deepEqual(destinationPath('Social Ads', n.treatment, n.concept), ['Social Ads', 'Treatments', 'Invisalign', n.concept]);
  });
  it('tidies pipes and flags a name that breaks the SOP instead of failing the edit', () => {
    const n = nameFromTitle('Social Ads', { treatment: '', concept: 'Busy Professionals|Fast Results' });
    assert.equal(n.treatment, 'General');
    assert.equal(n.concept, 'Busy Professionals | Fast Results');
    assert.ok(n.problems.some((p) => /treatment/.test(p)));
    assert.ok(n.problems.some((p) => /three parts/.test(p)));
  });
  it('uses the title for Organic and files it under Organic', () => {
    const n = nameFromTitle('Organic', { title: 'Vox Pops Episode' });
    assert.equal(pipelineName('Organic', n.concept), 'Organic | Vox Pops Episode');
    assert.deepEqual(destinationPath('Organic', n.treatment, n.concept), ['Organic', 'Vox Pops Episode']);
  });
  it('never returns an empty name', () => {
    assert.equal(nameFromTitle('Organic', {}).concept, 'Untitled');
  });
});

describe('firstCutForm', () => {
  it('asks only for type, brand and notes, and shows the problem when re-shown', () => {
    const f = firstCutForm({ section: 'Organic' }, 'choose a brand from the list.');
    assert.match(f.description, /choose a brand/);
    assert.deepEqual(f.fields.map((x) => x.name), ['section', 'brand', 'notes']);
    assert.equal(f.fields[0].value, 'Organic');
  });
});

describe('isTeamMember', () => {
  it('needs an account role and a Vendo email', () => {
    assert.equal(isTeamMember('owner', 'creative@vendodigital.co.uk'), true);
    assert.equal(isTeamMember('member', 'faith@vendodigital.co.uk'), true);
    assert.equal(isTeamMember(null, 'someone@vendodigital.co.uk'), false);
    assert.equal(isTeamMember('member', 'client@gmail.com'), false);
  });
});

describe('macOptions', () => {
  it("lists installed Macs with the clicker's own first", () => {
    const m = macOptions(['toby@vendodigital.co.uk', 'faith@vendodigital.co.uk'], 'faith@vendodigital.co.uk');
    assert.deepEqual(m, [{ name: "Faith's Mac", value: 'faith@vendodigital.co.uk' }, { name: "Toby's Mac", value: 'toby@vendodigital.co.uk' }]);
  });
  it('shows the Run on choice only when there is more than one Mac', () => {
    assert.ok(!firstCutForm({}, undefined, [{ name: "Toby's Mac", value: 't' }]).fields.some((f) => f.name === 'worker'));
    assert.ok(firstCutForm({}, undefined, [{ name: 'A', value: 'a' }, { name: 'B', value: 'b' }]).fields.some((f) => f.name === 'worker'));
  });
});

describe('looksLikeExport', () => {
  it('spots finished exports but not raw clips', () => {
    assert.equal(looksLikeExport('Professional | Smile Caught Up | From £995 | 9x16 | 60s | v02 | Internal.mp4'), true);
    assert.equal(looksLikeExport('Helen and Joe Podcast Snippet 22.mov'), false);
    assert.equal(looksLikeExport('C0042.MP4'), false);
  });
});
