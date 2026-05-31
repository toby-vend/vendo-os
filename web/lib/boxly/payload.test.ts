import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseBoxlyLead, classifyChannel } from './payload.js';

const RECEIVED = '2026-05-31T10:00:00.000Z';

describe('classifyChannel', () => {
  it('gclid wins → google', () => {
    assert.equal(classifyChannel({ gclid: 'abc', fbclid: null, utmSource: 'facebook', utmMedium: 'cpc', sourceLabel: null }), 'google');
  });
  it('fbclid → meta', () => {
    assert.equal(classifyChannel({ gclid: null, fbclid: 'xyz', utmSource: null, utmMedium: null, sourceLabel: null }), 'meta');
  });
  it('paid + google source → google', () => {
    assert.equal(classifyChannel({ gclid: null, fbclid: null, utmSource: 'google', utmMedium: 'cpc', sourceLabel: null }), 'google');
  });
  it('instagram source → meta', () => {
    assert.equal(classifyChannel({ gclid: null, fbclid: null, utmSource: 'instagram', utmMedium: 'paid_social', sourceLabel: null }), 'meta');
  });
  it('organic medium → organic', () => {
    assert.equal(classifyChannel({ gclid: null, fbclid: null, utmSource: 'google', utmMedium: 'organic', sourceLabel: null }), 'google');
  });
  it('pure organic label, no source → organic', () => {
    assert.equal(classifyChannel({ gclid: null, fbclid: null, utmSource: null, utmMedium: 'organic', sourceLabel: null }), 'organic');
  });
  it('nothing → direct', () => {
    assert.equal(classifyChannel({ gclid: null, fbclid: null, utmSource: null, utmMedium: null, sourceLabel: null }), 'direct');
  });
  it('unknown source → other', () => {
    assert.equal(classifyChannel({ gclid: null, fbclid: null, utmSource: 'newsletter', utmMedium: 'email', sourceLabel: null }), 'other');
  });
});

describe('normaliseBoxlyLead', () => {
  it('maps standard fields and dedups on lead id', () => {
    const lead = normaliseBoxlyLead({
      lead_id: 'L-123',
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
      phone: '+447700900123',
      message: 'Interested in Invisalign',
      entry_point_url: 'https://clinic.com/invisalign?utm_source=google&utm_medium=cpc&gclid=GC123',
      box: 'New Enquiries',
      stage: 'New',
    }, RECEIVED);

    assert.equal(lead.boxlyLeadId, 'L-123');
    assert.equal(lead.contactName, 'Jane');
    assert.equal(lead.contactEmail, 'jane@example.com');
    assert.equal(lead.contactPhone, '+447700900123');
    assert.equal(lead.gclid, 'GC123');
    assert.equal(lead.utmSource, 'google');
    assert.equal(lead.channel, 'google');
    assert.equal(lead.dedupKey, 'id:L-123');
  });

  it('parses gclid/utm from entry URL when no explicit fields', () => {
    const lead = normaliseBoxlyLead({
      Email: 'a@b.com',
      'Entry Point': 'https://x.com/?fbclid=FB99&utm_medium=paid_social&utm_source=instagram',
    }, RECEIVED);
    assert.equal(lead.fbclid, 'FB99');
    assert.equal(lead.channel, 'meta');
    assert.equal(lead.contactEmail, 'a@b.com');
  });

  it('builds email-based dedup key when no lead id', () => {
    const lead = normaliseBoxlyLead({ email: 'X@Y.com' }, RECEIVED);
    assert.equal(lead.dedupKey, `x@y.com|${RECEIVED}`);
    assert.equal(lead.channel, 'direct');
  });

  it('falls back to first+last name when no full name', () => {
    const lead = normaliseBoxlyLead({ first_name: 'Sam', last_name: 'Lee', phone: '123' }, RECEIVED);
    assert.equal(lead.contactName, 'Sam');  // pick() returns first_name candidate first
    assert.equal(lead.dedupKey, `123|${RECEIVED}`);
  });

  it('uses supplied created_at over received time', () => {
    const lead = normaliseBoxlyLead({ email: 'c@d.com', created_at: '2026-05-30T08:00:00Z' }, RECEIVED);
    assert.equal(lead.createdAt, '2026-05-30T08:00:00.000Z');
  });
});
