/** Only custom packs with included Haggs-authored source and license use this badge. */
export function HaggsBadge({ provenance }: { provenance: string }) {
  return <a href={provenance} title="Haggs custom nodes; upstream models and templates retain their own attribution" style={{display:'inline-flex',alignItems:'center',gap:8,width:'fit-content',border:'1px solid currentColor',borderRadius:6,padding:'3px 8px'}}>
    <span style={{fontWeight:900,letterSpacing:'-0.06em'}}>haggs<span style={{color:'var(--accent)'}}>.</span></span>
    <small>Custom nodes</small>
  </a>;
}
