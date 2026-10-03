import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gateReaction, LOCKED, STATUS } from './gates.js';

describe('gateReaction', () => {
  it('says nothing for In Progress (the AI sets it on every new version)', () => {
    assert.equal(gateReaction(STATUS.inProgress, [], 'X'), null);
  });
  it('hands Needs Review to the Creative Strategist', () => {
    const r = gateReaction(STATUS.needsReview, [STATUS.inProgress], 'X')!;
    assert.match(r.comment, /Gate 1/);
    assert.match(r.comment, /claim, price and offer/);
  });
  it('hands Approved to Faith for Gate 2, and notes a skipped Needs Review', () => {
    assert.match(gateReaction(STATUS.approved, [STATUS.inProgress, STATUS.needsReview], 'X')!.comment, /Gate 2: Faith/);
    assert.match(gateReaction(STATUS.approved, [STATUS.inProgress], 'X')!.comment, /without Needs Review/);
  });
  it('clears for the client only when Gate 1 was passed', () => {
    assert.match(gateReaction(STATUS.internallyApproved, [STATUS.needsReview, STATUS.approved], 'X')!.comment, /Cleared for the client/);
    const skipped = gateReaction(STATUS.internallyApproved, [STATUS.inProgress], 'X')!;
    assert.match(skipped.comment, /never passed/);
    assert.match(skipped.slack!, /Gate skipped/);
  });
  it('asks Faith to rename to Final on Client Approved', () => {
    assert.match(gateReaction(STATUS.clientApproved, [], 'X')!.comment, /Faith: rename to Final/);
  });
  it('locks the video for the AI after Gate 2', () => {
    assert.ok(LOCKED.has(STATUS.internallyApproved) && LOCKED.has(STATUS.clientApproved));
    assert.ok(!LOCKED.has(STATUS.approved));
  });
});
