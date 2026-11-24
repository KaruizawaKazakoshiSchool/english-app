// 音を「いつも1つだけ」鳴らすための共通の仕組み（2026-11-24 さんだー「連打すると あああああ と連続して音が出て変」）。
// 音ファイル（フォニックス）も読み上げの声も、新しく鳴らす前に前の音を止める。
let current: HTMLAudioElement | null = null;
let generation = 0;

/** 鳴っている音ファイルを止める */
export const stopClip = () => {
  if (current) {
    try { current.pause(); current.currentTime = 0; } catch { /* noop */ }
    current.onended = null;
    current = null;
  }
};

/** 前の音（音ファイル・読み上げ）を全部止めて、新しい番号を返す。遅れて鳴らす処理は、番号が変わっていたら鳴らさない */
export const stopAllSound = (): number => {
  stopClip();
  try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
  return ++generation;
};
export const isCurrent = (g: number) => g === generation;

/** 音ファイルを1つだけ鳴らす */
export const playClip = (url: string, onEnd?: () => void): Promise<void> => {
  stopAllSound();
  const a = new Audio(url);
  current = a;
  a.onended = () => { if (current === a) current = null; onEnd?.(); };
  return a.play();
};
