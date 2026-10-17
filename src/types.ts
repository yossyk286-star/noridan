export type Level = 'yurume' | 'futsu' | 'jigoku';
/** 夜モード: オフ / 夜（恋愛・ちょいエロ） / 深夜（性癖・経験まで） */
export type Night = false | 'yoru' | 'shinya';
export type Mode = 'odai' | 'sugoroku' | 'memory' | 'ito' | 'gesture' | 'homeru' | 'ngword' | 'vote';

export type Member = { name: string; neta: string; /** 夜モードで下ネタを振らない */ ng?: boolean };

/** お題の表示用。hl=true の部分は名前として強調する */
export type Segment = { text: string; hl?: boolean; /** 名前の場合、その人の番号（色分け用） */ who?: number };

export type Card = {
  kind: string;
  segments: Segment[];
  alert?: boolean;
  /** 元のお題。リベンジで人を入れ替えるときに使う */
  tpl?: string;
  needNeta?: boolean;
  /** その人がやるお題か（リベンジ・ダブルアップの対象） */
  solo?: boolean;
  /** 数ターン続くルールを出した緊急指令 */
  ruleCard?: boolean;
  /** 時限爆弾の爆発札：NG行動（「〜した」） */
  bombCond?: string;
  /** 時限爆弾まわりのカード（「仕掛け人」表示にする） */
  bomb?: boolean;
  /** 夜モードのお題（パスできる・NGの人に振らない） */
  yoru?: boolean;
  noNg?: boolean;
  /** 「当てはまらん」で回ってきたカード（もう回せない） */
  passed?: boolean;
};

export type Phase = 'play' | 'offer' | 'revenge' | 'push' | 'batsu' | 'bombSet' | 'bombPeek';
export type Bomb = { cond: string; owner: number; left: number };
export type GachaItem = { i: number; n: number; segments: Segment[]; /** ラッキー（天使）なら罰は帳消し */ lucky?: boolean; /** 夜・深夜の罰 */ night?: 'yoru' | 'shinya' };

export type Rule = { segments: Segment[]; left: number; /** 「次の自分の番まで〜」の時、その人 */ who?: number; /** このルールを出した札（その札を見てる間は上に出さない） */ card?: Card };

export type Cell =
  | { type: 'start' | 'goal'; label: string }
  | { type: 'odai' }
  | { type: 'event'; label: string }
  | { type: 'text' | 'skip' | 'swap'; label: string; text: string; /** マスに出す短い表記 */ short?: string }
  | { type: 'move'; label: string; text: string; value: number };

export type GameEvent = { text: string; turns: number };
