/**
 * ChannelPip — small monogram dot for channel cards (M / G / S).
 * Colour palette mirrors the mockup's tone names.
 */
interface ChannelPipProps {
  tone?: 'indigo' | 'amber' | 'teal' | 'rose' | 'violet';
  letter: string;
}

const PALETTE: Record<NonNullable<ChannelPipProps['tone']>, string> = {
  indigo: 'oklch(0.55 0.13 270)',
  amber:  'oklch(0.7 0.13 70)',
  teal:   'oklch(0.55 0.1 195)',
  rose:   'oklch(0.62 0.13 15)',
  violet: 'oklch(0.58 0.13 305)',
};

export function ChannelPip({ tone = 'teal', letter }: ChannelPipProps) {
  const c = PALETTE[tone] || PALETTE.teal;
  return (
    <span
      className="vr-pip"
      style={{
        background: `${c}20`,
        color: c,
        borderColor: `${c}33`,
      }}
    >
      {letter}
    </span>
  );
}
