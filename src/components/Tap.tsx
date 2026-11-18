import { useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Animated, Pressable, StyleSheet, type PressableProps, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native';
import { Haptics } from '../lib/vibe';

const APressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle> | ((s: PressableStateCallbackType) => StyleProp<ViewStyle>);
  /** 押した時にどこまで縮むか */
  scaleTo?: number;
  /** 押した瞬間に軽くブルッとさせる */
  haptic?: boolean;
  /** 出てすぐ（0.3秒以内）の押しは無視する連打よけ。反射を試す所だけ false */
  guard?: boolean;
};

/** 押せる範囲は最低44pt（見た目はそのまま、hitSlopで広げる） */
const MIN_HIT = 44;

/**
 * 押した感触つきのボタン。押すとスッと沈んで、離すとぷにっと戻る（Pressableと同じ使い方）
 */
export function Tap({ style, onPressIn, onPressOut, scaleTo = 0.95, haptic = true, disabled, guard = true, onPress, onLayout, hitSlop, ...rest }: Props) {
  const v = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const born = useRef(Date.now());
  const slop = hitSlop ?? (box ? { left: Math.max(0, (MIN_HIT - box.w) / 2), right: Math.max(0, (MIN_HIT - box.w) / 2), top: Math.max(0, (MIN_HIT - box.h) / 2), bottom: Math.max(0, (MIN_HIT - box.h) / 2) } : undefined);
  const resolved = typeof style === 'function' ? style({ pressed, hovered: false } as PressableStateCallbackType) : style;
  const flat = (StyleSheet.flatten(resolved) ?? {}) as ViewStyle;
  const transform = [...((flat.transform as any[]) ?? []), { scale: v }];
  return (
    <APressable
      accessibilityRole="button"
      {...rest}
      disabled={disabled}
      hitSlop={slop}
      onLayout={(e: LayoutChangeEvent) => { const { width, height } = e.nativeEvent.layout; if (!box || box.w !== width || box.h !== height) setBox({ w: width, h: height }); onLayout?.(e); }}
      onPress={onPress ? (e) => { if (guard && Date.now() - born.current < 300) return; onPress(e); } : undefined}
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
