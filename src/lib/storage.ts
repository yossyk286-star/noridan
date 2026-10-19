import AsyncStorage from '@react-native-async-storage/async-storage';

/** 保存は失敗してもゲームは続ける */
export async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** 保存データが壊れてても起動できるように：配列で、名前は文字列10文字まで、12人まで、同じ名前は1人だけ */
export function cleanMembers(v: unknown): { name: string; ng?: boolean }[] | null {
  if (!Array.isArray(v)) return null;
  const seen = new Set<string>();
  const out: { name: string; ng?: boolean }[] = [];
  for (const m of v) {
    const name = String((m as { name?: unknown })?.name ?? '').trim().slice(0, 10);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push((m as { ng?: unknown }).ng ? { name, ng: true } : { name });
    if (out.length >= 12) break;
  }
  return out.length ? out : null;
}

export async function save(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
