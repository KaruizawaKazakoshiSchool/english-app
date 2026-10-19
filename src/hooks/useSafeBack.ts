import { useNavigate, useLocation } from 'react-router-dom';
import { isHubEntry, clearHubReturn, HUB_ANCHOR } from '../lib/hubReturn';

/**
 * 「もどる」ボタン用。
 *
 * 基本は「1つ上の階層（parent）」へ移動する。
 *   例）各モード → カテゴリのモード一覧、カテゴリ → カテゴリ一覧、ステージ → フォニックス一覧。
 *   これで「行ったり来たり（ピンポン）」せず、いつも1段ずつ上に戻れる。
 *
 * ただし、単元やカテゴリをまたいで飛んできた「クロスリンク」の場合
 * （例：ダイアログ練習 → 関連する単語練習へジャンプ）だけは、
 * 履歴を1つ戻して元の画面に返す。
 * ジャンプ元で navigate(path, { state: { fromCrossLink: true } }) を付けると有効になる。
 *
 * トップの「今の単元」から入った画面では、トップの今の単元の位置に戻す（lib/hubReturn）。
 */
export const useSafeBack = (parent: string = '/home') => {
  const navigate = useNavigate();
  const location = useLocation();
  return () => {
    if ((location.state as any)?.fromCrossLink) navigate(-1);
    else if (isHubEntry(location.pathname, location.search)) { clearHubReturn(); navigate('/home', { state: { scrollTo: HUB_ANCHOR } }); }
    else navigate(parent);
  };
};
