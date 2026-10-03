import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { destinationPath, firstCutForm, nameFromTitle, parseActionPayload, pipelineName, validateFirstCut } from './actions.js';

describe('parseActionPayload', () => {
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

  it('reads the flat shape and treats empty data as no answers yet', () => {
    const p = parseActionPayload({ event: 'vendo.ai.revision', resource_id: 'f2', user_id: 'u2', account_id: 'a2', data: {} });
    assert.equal(p.event, 'vendo.ai.revision');
    assert.equal(p.resourceId, 'f2');
    assert.equal(p.accountId, 'a2');
    assert.equal(p.data, null);
  });
});

describe('validateFirstCut', () => {
  it('only needs a type and brand; the AI names the video later', () => {
    const r = validateFirstCut({ section: 'Social Ads', brand: 'vendo', notes: 'keep it short' });
    assert.ok(r.ok);
    if (r.ok) assert.deepEqual(r.params, { section: 'Social Ads', treatment: null, concept: null, brand: 'vendo', notes: 'keep it short' });
  });
  it('rejects a missing type or unknown brand', () => {
    assert.equal(validateFirstCut({ brand: 'vendo' }).ok, false);
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
