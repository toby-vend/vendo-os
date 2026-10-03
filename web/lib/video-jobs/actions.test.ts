import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { destinationPath, firstCutForm, parseActionPayload, pipelineName, validateFirstCut } from './actions.js';

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
  const good = { section: 'Social Ads', treatment: 'Invisalign', concept: 'Busy Professionals | Fast Results | Free Consultation', brand: 'vendo', notes: '' };

  it('accepts a correct Social Ad', () => {
    const r = validateFirstCut(good);
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(pipelineName(r.params), good.concept);
      assert.deepEqual(destinationPath(r.params), ['Social Ads', 'Treatments', 'Invisalign', good.concept]);
    }
  });

  it('needs a treatment for Social Ads', () => {
    const r = validateFirstCut({ ...good, treatment: '' });
    assert.equal(r.ok, false);
  });

  it('rejects a concept that is not Persona | Angle | Offer', () => {
    const r = validateFirstCut({ ...good, concept: 'Busy Professionals | Fast Results' });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.problem, /three parts/);
  });

  it('rejects names that already carry ratio, version or status', () => {
    const r = validateFirstCut({ ...good, concept: `${good.concept} | 9x16` });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.problem, /added for you/);
  });

  it('rejects an unknown brand', () => {
    assert.equal(validateFirstCut({ ...good, brand: 'nope' }).ok, false);
  });

  it('accepts an Organic title and routes it to Organic', () => {
    const r = validateFirstCut({ section: 'Organic', treatment: '', concept: 'Vox Pops Episode', brand: 'vendo', notes: 'hi' });
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(pipelineName(r.params), 'Organic | Vox Pops Episode');
      assert.deepEqual(destinationPath(r.params), ['Organic', 'Vox Pops Episode']);
    }
  });

  it('rejects an Organic title with pipes', () => {
    assert.equal(validateFirstCut({ section: 'Organic', concept: 'A | B', brand: 'vendo' }).ok, false);
  });
});

describe('firstCutForm', () => {
  it('keeps the answers and shows the problem when re-shown', () => {
    const f = firstCutForm({ concept: 'Abc' }, 'add the treatment.');
    assert.match(f.description, /add the treatment/);
    assert.equal(f.fields.find((x) => x.name === 'concept')?.value, 'Abc');
  });
});
