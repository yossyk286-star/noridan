import Svg, { Circle, Path } from 'react-native-svg';

/** 線のアイコン（お試し版と同じ形）。色は color、太さは中で統一 */
export type IconName = 'gear' | 'flip' | 'back' | 'more' | 'close' | 'flag' | 'exit' | 'plus' | 'share' | 'users' | 'next' | 'moon';

const PATHS: Record<Exclude<IconName, 'more' | 'gear' | 'users'>, string> = {
  flip: 'M7 4v16M7 4 3 8M7 4l4 4M17 20V4M17 20l-4-4M17 20l4-4',
  back: 'M15 5l-7 7 7 7',
  close: 'M18 6 6 18M6 6l12 12',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  exit: 'M15 4h4v16h-4M10 16l4-4-4-4M14 12H4',
  plus: 'M12 5v14M5 12h14',
  share: 'M4 13v7h16v-7M12 3v12M7 8l5-5 5 5',
  next: 'M9 5l7 7-7 7',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
};

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color: string }) {
  const common = { fill: 'none', stroke: color, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'more' ? (
        <>
          <Circle cx={5} cy={12} r={2.2} fill={color} />
          <Circle cx={12} cy={12} r={2.2} fill={color} />
          <Circle cx={19} cy={12} r={2.2} fill={color} />
        </>
      ) : name === 'gear' ? (
        <>
          <Circle cx={12} cy={12} r={3} {...common} />
          <Path
            {...common}
            d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
          />
        </>
      ) : name === 'users' ? (
        <>
          <Circle cx={9} cy={8} r={3.5} {...common} />
          <Path {...common} d="M2.5 20c.8-3.6 3.5-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.6c1.9.7 3.1 2.5 3.5 5.4" />
        </>
      ) : (
        <Path {...common} d={PATHS[name]} />
      )}
    </Svg>
  );
}
