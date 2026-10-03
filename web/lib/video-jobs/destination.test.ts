import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickShootFolder } from './destination.js';

describe('pickShootFolder', () => {
  it('uses the folder above Raw Footage', () => {
    assert.equal(pickShootFolder([
      { id: 'a', name: 'A-Roll' }, { id: 'r', name: 'Raw Footage' }, { id: 's', name: '_AI Edit Sandbox' }, { id: 'p', name: 'Vendo' },
    ]), 's');
  });
  it('falls back to the nearest dated shoot folder', () => {
    assert.equal(pickShootFolder([
      { id: 'x', name: 'Clips' }, { id: 's', name: 'October 3rd 2026 | Paid Ads & Organic Content' }, { id: 'p', name: 'Client' },
    ]), 's');
  });
  it('returns null when the clip is not in a shoot', () => {
    assert.equal(pickShootFolder([{ id: 'x', name: 'Misc' }, { id: 'p', name: 'Client' }]), null);
  });
});
