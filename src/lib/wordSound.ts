// 1語だけ読み上げるとき、文の中と同じ読み方になるように、読ませる綴りを変える（2026-11-24 さんだー）。
// ・live / lives：1語だけだと「ライブ」と読まれる。動詞（住む）は「リヴ」
// ・the：次の語が母音の音で始まるなら「ジ」、それ以外は「ザ」
// 画面に出す文字は変えない。読み上げに渡す文字だけ変える。

const clean = (w: string) => (w || '').toLowerCase().replace(/[^a-z']/g, '');

// 「ライブ（生の）」として使うときの前の語（a live show / on live TV など）
const ADJ_BEFORE = new Set(['a', 'an', 'the', 'on', 'go', 'goes', 'went', 'very', 'so']);

// 母音の字で始まるが、音は子音（ユ・ワ）で始まる語
const CONSONANT_SOUND = /^(uni|use|usu|ura|euro|eu|one|once|ufo|uk|us$|u$)/;
// 子音の字で始まるが、音は母音で始まる語（h を読まない語）
const VOWEL_SOUND_H = /^(hour|honest|honor|honour|heir)/;

const startsWithVowelSound = (w: string) => {
  const x = clean(w);
  if (!x) return false;
  if (VOWEL_SOUND_H.test(x)) return true;
  if (CONSONANT_SOUND.test(x)) return false;
  return /^[aeiou]/.test(x);
};

/**
 * words[i] を1語だけ読むときに、読み上げに渡す文字を返す。
 * words が無い（文の中の位置が分からない）ときは、その語だけで決める。
 */
export const wordForSpeech = (word: string, words?: string[], i?: number): string => {
  const w = clean(word);
  const prev = words && i !== undefined && i > 0 ? clean(words[i - 1]) : '';
  const next = words && i !== undefined && i + 1 < words.length ? words[i + 1] : '';
  if (w === 'live') return ADJ_BEFORE.has(prev) ? word : 'liv';
  if (w === 'lives') return 'livz';
  if (w === 'the') {
    // 「ジ」は thee（実在の語で、必ず濁った「ジー」になる）。「ザ」はそのまま the（つづりを変えると濁らない音になることがある）
    return next && startsWithVowelSound(next) ? 'thee' : word;
  }
  return word;
};
