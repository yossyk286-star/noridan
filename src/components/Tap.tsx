import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, type PressableProps, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native';
import { Haptics } from '../lib/vibe';

const APressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle> | ((s: PressableStateCallbackType) => StyleProp<ViewStyle>);
  /** 押した時にどこまで縮むか */
  scaleTo?: number;
  /** 押した瞬間に軽くブルッとさせる */
  haptic?: boolean;
};

/**
 * 押した感触つきのボタン。押すとスッと沈んで、離すとぷにっと戻る（Pressableと同じ使い方）
 */
export function Tap({ style, onPressIn, onPressOut, scaleTo = 0.95, haptic = true, disabled, ...rest }: Props) {
  const v = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);
  const resolved = typeof style === 'function' ? style({ pressed, hovered: false } as PressableStateCallbackType) : style;
  const flat = (StyleSheet.flatten(resolved) ?? {}) as ViewStyle;
  const transform = [...((flat.transform as any[]) ?? []), { scale: v }];
  return (
    <APressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        setPressed(true);
        Animated.timing(v, { toValue: scaleTo, duration: 60, useNativeDriver: true }).start();
        if (haptic && !disabled) Haptics.selectionAsync().catch(() => {});
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        Animated.spring(v, { toValue: 1, friction: 4, tension: 260, useNativeDriver: true }).start();
        onPressOut?.(e);
      }}
      style={[flat, { transform }]}
    />
  );
}
