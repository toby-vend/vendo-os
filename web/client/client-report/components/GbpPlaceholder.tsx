/**
 * GbpPlaceholder — "Coming soon" card for the Google Business Profile
 * interactions widget.
 *
 * Phase 4 will wire the Google My Business API and render the YoY
 * comparison panel (phone calls, direction requests, website clicks,
 * messages, booking clicks, photo views).
 */

export function GbpPlaceholder() {
  return (
    <div className="vr-placeholder" style={{ minHeight: 220 }}>
      <div className="vr-placeholder-label">Google Business Profile — coming soon</div>
      <div className="vr-placeholder-sub">
        Phone calls, direction requests, website clicks, messages,
        booking clicks and photo views with a year-on-year comparison.
        Phase 4 wires the Google My Business API.
      </div>
    </div>
  );
}
