// ふりかえりが「読める文」かどうかを、端末の中だけで判定する（AIには送らない）。
//
// きっかけ（2026-09-28）：キーボードを適当にたたいた文字列（例 "jurjfhfij…"）でも
// 50字を超えるとサイコロが振れて、ポイントが入っていた。
//
// 方針：意味まで判定するのは無理なので、「明らかに文になっていないもの」だけを落とす。
// 書いている途中から画面に理由が出るので、まちがって落ちても本人が直せる（罰ではなく案内）。
//   1. 同じ文字の連打（ああああ…、wwwww）は1文字に数える
//   2. 日本語で書いているなら、助詞などの「つなぎのひらがな」がちゃんとある
//   3. 英語（ローマ字）で書いているなら、単語が空白で区切られていて、母音のない塊や長すぎる塊がない
export interface ReflectionCheck {
  ok: boolean;
  /** 数える文字数（空白・同じ文字の連打をのぞく） */
  length: number;
  /** ok でないときに子どもに見せる一言 */
  hint: string | null;
}

const JA = /[぀-ヿ㐀-鿿]/;          // ひらがな・カタカナ・漢字
const LATIN = /[A-Za-z]/;
// 日本語の文にはふつう、こうした「つなぎ」のひらがなが何度も出てくる
const JOINERS = /[はがをにでとのもへやかたてしよねるいうだす]/g;

export const checkReflection = (raw: string): ReflectionCheck => {
  const noSpace = raw.replace(/\s/g, '');
  // 同じ文字の3連続以上は1文字に（水増し対策）
  const squeezed = noSpace.replace(/(.)\1{2,}/gu, '$1');
  const length = [...squeezed].length;
  if (length === 0) return { ok: false, length, hint: null };

  const chars = [...squeezed];
  const ja = chars.filter(c => JA.test(c)).length;
  const latin = chars.filter(c => LATIN.test(c)).length;

  // 種類の少なさ（同じ数文字のくり返し）
  const kinds = new Set(chars).size;
  if (length >= 20 && kinds / length < 0.15) {
    return { ok: false, length, hint: '同じ文字のくり返しに なっているみたい。今日のことを 文で書いてみよう' };
  }

  if (ja >= latin) {
    // 日本語の文：つなぎのひらがなが、ある程度ふくまれているか
    const joiners = (squeezed.match(JOINERS) || []).length;
    // カタカナ語（ピクチャーディクショナリー など）は、長くても1語＝1文字ぶんとして数える。
    // 文字数のまま数えると「つなぎ」の割合が下がり、ちゃんとした文が落ちていた（子どもの声 2026-10-15）
    const kataRuns = squeezed.match(/[ァ-ヺー]{2,}/g) || [];
    const jaUnits = ja - kataRuns.reduce((n, r) => n + [...r].length - 1, 0);
    if (jaUnits >= 10 && joiners / jaUnits < 0.12) {
      return { ok: false, length, hint: '文になっていないみたい。「〜が できた」「〜が むずかしかった」のように 書いてみよう' };
    }
    // ローマ字のでたらめが大きくまざっている
    const latinRuns = raw.match(/[A-Za-z]{16,}/g) || [];
    if (latinRuns.some(w => !/\s/.test(w))) {
      return { ok: false, length, hint: 'でたらめな文字が まざっているみたい。読める文で 書いてみよう' };
    }
    return { ok: true, length, hint: null };
  }

  // 英語（ローマ字）の文：単語に区切られているか・母音のない塊や長すぎる塊がないか
  const words = raw.split(/[^A-Za-z']+/).filter(Boolean);
  const bad = words.filter(w => w.length > 14 || !/[aeiouy]/i.test(w) || /[bcdfghjklmnpqrstvwxz]{5,}/i.test(w));
  if (words.length < 5 || bad.length / words.length > 0.3) {
    return { ok: false, length, hint: 'でたらめな文字に なっているみたい。英語なら 単語を空白で区切って、読める文で 書いてみよう' };
  }
  return { ok: true, length, hint: null };
};
