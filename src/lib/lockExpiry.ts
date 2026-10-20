// 先生のロックは、かけてから45分たつと自動で外れる（2026-10-20：「ふりかえりロックを外し忘れて怒られた」）。
// かけた時刻は設定行の lockSetAt（ミリ秒）。端末側はこの時刻を見て、45分を過ぎたら「ロックなし」として扱う。
// 念のためDB側でも5分ごとに lockMode を 'none' に戻している（pg_cron の auto_unlock_settings）。
export const LOCK_AUTO_OFF_MIN = 45;
export const LOCK_AUTO_OFF_MS = LOCK_AUTO_OFF_MIN * 60 * 1000;

/** ロックが外れる時刻（ミリ秒）。かけた時刻が分からなければ null（＝自動では外れない） */
export const lockEndsAt = (lockSetAt: unknown): number | null =>
  typeof lockSetAt === 'number' && lockSetAt > 0 ? lockSetAt + LOCK_AUTO_OFF_MS : null;
