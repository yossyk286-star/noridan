import { GACHA_MS } from '../components/Fx';
import { useEffect, useState } from 'react';
import { Vibration } from 'react-native';
import { play } from './sound';
import { doubleSegments } from './game';
import type { TurnFlow } from './useTurnFlow';
import { usePrefs } from './prefs';
import { plain, speak } from './speech';

/** カードや段階が変わった時の効果音。爆発の時はフラッシュ用のキーを返す */
export function useStageCues(flow: TurnFlow, muted = false) {
  const { st } = flow;
  const [flash, setFlash] = useState(0);
  const { voice } = usePrefs();
  useEffect(() => {
    if (!st.card.kind || muted) return; // すごろくのサイコロ待ちの間は鳴らさない
    if (st.phase === 'batsu') play(st.gacha.every((g) => g.lucky) ? 'gachaLucky' : 'gacha');
    else if (st.card.kind.includes('ドカン')) {
      play('boom');
      setFlash((x) => x + 1);
      Vibration.vibrate([0, 80, 40, 160]);
    } else if (st.phase === 'bombSet') play('alarm');
    else if (st.phase === 'offer') play('coin');
    else if (st.card.alert) play('warn');
    else play('flip');
    // 読み上げ（仕掛け人だけが見る爆弾の中身は絶対読まない）
    if (voice && st.phase !== 'bombPeek') {
      const members = flow.members;
      // 罰ガチャはマシンが回り終わってから読む
      const say = (t: string) => (st.phase === 'batsu' ? setTimeout(() => speak(t), GACHA_MS) : speak(t));
      say(
        st.phase === 'batsu'
          ? st.gacha.map((g) => `${members[g.i].name}${g.lucky ? 'はセーフ。' : g.n > 1 ? 'の罰、2倍。' : 'の罰。'}${plain(g.lucky ? g.segments : doubleSegments(g.segments, g.n, true))}`).join('。')
          : plain(st.card.segments),
      );
    }
  }, [st.card, st.phase]);
  return flash;
}
