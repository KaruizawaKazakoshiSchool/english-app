// 発音の読み上げ（Web Speech API）で、端末・発話ごとに声が変わって
// たまに「かすれた男性声」になるのを防ぐため、クリアな英語ボイスを優先順で1つに固定する。

// 優先したいクリアなボイス（だいたい女性。Chrome/Mac/Edge/iOSで使われる名前）
const PREFERRED = [
  'Google US English',
  'Samantha',            // macOS / iOS の定番クリア女性
  'Microsoft Aria',
  'Microsoft Jenny',
  'Microsoft Zira',
  'Google UK English Female',
  'Karen', 'Moira', 'Tessa', 'Serena', // 各国英語のクリア女性
];

// macOSのノベルティ/低品質ボイス（かすれ・効果音系）は避ける
const DENY = ['Fred', 'Albert', 'Bad News', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos', 'Deranged', 'Hysterical', 'Jester', 'Organ', 'Trinoids', 'Whisper', 'Wobble', 'Zarvox', 'Junior', 'Ralph', 'Eddy', 'Reed', 'Rocko', 'Flo', 'Grandpa', 'Grandma', 'Sandy', 'Shelley', 'Superstar'];

let cached: SpeechSynthesisVoice | null = null;
// ネットの声（Google US English など）が鳴らなかった端末では、以後は端末の中の声だけを使う。
// 子どもの声 2026-10-27・28「家だと音が出ない」「はじめ聞こえない」：Google の声はインターネット越しに作るので、
// 家のネットや端末の設定によっては無音・最初が切れる。
let avoidNetwork = false;
export const markNetworkVoiceBad = () => { if (!avoidNetwork) { avoidNetwork = true; cached = null; } };

export const getPreferredVoice = (): SpeechSynthesisVoice | null => {
  if (cached) return cached;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const isEnUS = (v: SpeechSynthesisVoice) => /en[-_]us/i.test(v.lang);
  const isEn = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().startsWith('en');
  const allowed = (v: SpeechSynthesisVoice) => !DENY.some(d => v.name.includes(d));
  // まず端末の中の声（localService）から選ぶ。ネットの声は、端末の中に英語の声が無いときだけ
  const local = voices.filter(v => v.localService);
  const pools = avoidNetwork ? [local] : [local, voices];
  for (const pool of pools) {
    for (const name of PREFERRED) {
      const v = pool.find(x => x.name.includes(name));
      if (v) { cached = v; return v; }
    }
    const enUS = pool.find(v => isEnUS(v) && allowed(v));
    if (enUS) { cached = enUS; return enUS; }
    const anyEn = pool.find(v => isEn(v) && allowed(v));
    if (anyEn) { cached = anyEn; return anyEn; }
  }
  cached = voices.find(v => isEnUS(v) && (!avoidNetwork || v.localService)) || null;
  return cached;
};

// 起動時にボイスを読み込み（非同期で揃うブラウザがあるので voiceschanged で更新）
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  try {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => { cached = null; getPreferredVoice(); };
  } catch { /* noop */ }
}
