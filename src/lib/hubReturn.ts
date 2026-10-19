// トップの「今の単元」から入った画面を覚えておく（子どもの声 2026-10-20「もどるで今の単元一覧に戻ってほしい」）。
// その画面（辞書なら単元のモード一覧）の「もどる」で、トップの今の単元の位置に戻す。
// 中のモード（辞書の各ゲームなど）からの「もどる」は今までどおり1段上へ → もう1回で今の単元へ。
import { isOnMission } from './missionBonus';

const KEY = 'hubReturn';

export const markFromHub = (route: string) => { try { sessionStorage.setItem(KEY, route); } catch { /* 覚えられなくても動く */ } };

/** いまの画面が「今の単元から入った画面そのもの」なら true（深い画面では false） */
export const isHubEntry = (pathname: string, search: string): boolean => {
  let route: string;
  try { route = sessionStorage.getItem(KEY) || ''; } catch { return false; }
  if (!route) return false;
  const here = pathname + search;
  if (!isOnMission(here, route)) return false;
  const routePath = decodeURIComponent(route.split('?')[0]).replace(/\/+$/, '');
  return decodeURIComponent(pathname).replace(/\/+$/, '') === routePath;
};

export const clearHubReturn = () => { try { sessionStorage.removeItem(KEY); } catch { /* noop */ } };

export const HUB_ANCHOR = 'unit-hub';
