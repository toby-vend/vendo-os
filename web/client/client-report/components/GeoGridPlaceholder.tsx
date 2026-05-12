/**
 * GeoGridPlaceholder — "Coming soon" card for the Local GeoGrid widget.
 *
 * Phase 4 will wire a real GeoGrid scan (Local Falcon or SerpAPI) that
 * renders a 7×7 grid of rankings centred on the practice. For v1 we
 * surface a clear placeholder so the SEO tab layout reads completely.
 */

export function GeoGridPlaceholder() {
  return (
    <div className="vr-placeholder" style={{ minHeight: 220 }}>
      <div className="vr-placeholder-label">Local GeoGrid — coming soon</div>
      <div className="vr-placeholder-sub">
        Scans your rankings across a 7×7 grid centred on the practice
        (≈1.6 km radius) for each tracked keyword. Phase 4 wires Local
        Falcon or SerpAPI; weekly scans land here automatically.
      </div>
    </div>
  );
}
