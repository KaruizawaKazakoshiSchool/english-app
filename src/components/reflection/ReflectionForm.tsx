import { checkReflection } from '../../lib/reflectionCheck';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSafeBack } from '../../hooks/useSafeBack';
import { Button } from '../ui/Button';
import { ArrowLeft, Star, Send } from 'lucide-react';
import { useReflections } from '../../hooks/useReflections';
import { usePoints } from '../../hooks/usePoints';
import { currentIsTrial } from '../../lib/trial';
import { recentActivities, RECENT_HOURS } from '../../lib/activityLog';

export const ReflectionForm: React.FC = () => {
  const navigate = useNavigate();
  const goBack = useSafeBack();
  const { reflections, saveReflection } = useReflections();
  const { addFixedPoints } = usePoints();
  
  const [stars, setStars] = useState(0);
  // ⭐を選ばずに「送る」を押したときの案内（子どもの声 2026-09-18
  // 「50字以上書いたのに、送るボタンが半透明で送れない」＝⭐を選んでいなかった）
  const [needStars, setNeedStars] = useState(false);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState<number | null>(null);
  // 直近に取り組んだ活動（この端末の記録）。「今日なにしたっけ？」で止まらないように。
  const [recent] = useState(() => recentActivities(RECENT_HOURS));
  const [dice, setDice] = useState<number | null>(null);   // 出た目（サイコロを振ったときだけ）
  const [rolling, setRolling] = useState(false);

  // サイコロが振れる長さ。「3行以上」だと90字相当で重すぎたので、文字数で数える。
  // 改行や空白は数えない（改行だけ入れて水増しできないように）。
  const DICE_CHARS = 50;
  // 数える文字数は「空白・同じ文字の連打」をのぞいたもの。でたらめな文字列は数えない（lib/reflectionCheck）
  const check = checkReflection(comment);
  const countChars = (_text: string) => check.length;
  const BASE_POINTS = 2;        // 短くても、読める文で書いたことは認める
  const diceToPoints = (d: number) => d + 2; // 🎲1〜6 → 3〜8P（1Pにはならない）
  const qualifies = check.ok && check.length >= DICE_CHARS;
  // でたらめな文字列（キーボードを適当にたたいた等）にはポイントを出さない（2026-09-28）
  const nonsense = comment.trim() !== '' && !check.ok;

  const HALF_DAY_MS = 12 * 60 * 60 * 1000;
  const lastReflectionDate = reflections.length > 0 ? new Date(reflections[0].date) : null;
  const canEarnPoints = !lastReflectionDate || (new Date().getTime() - lastReflectionDate.getTime() >= HALF_DAY_MS);

  const handleSubmit = async () => {
    if (stars === 0) {   // ⭐は必須。だまって押せなくするのではなく、理由を見せる
      setNeedStars(true);
      document.getElementById('reflection-stars')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    saveReflection(stars, comment, nonsense);   // でたらめな文字列には自動👍を付けない
    
    if (canEarnPoints) {
      if (qualifies) {
        // 3行以上 → サイコロ。ちょっとしたゲーム性で「書く」をうながす。
        setSubmitted(true); setRolling(true);
        const d = 1 + Math.floor(Math.random() * 6);
        await new Promise(r => setTimeout(r, 1200)); // ころがる演出
        setDice(d); setRolling(false);
        const pts = await addFixedPoints('daily_reflection', diceToPoints(d));
        setEarnedPoints(pts);
        return;
      }
      if (nonsense) {          // 記録は残すが、ポイントは出さない
        setEarnedPoints(0);
        setSubmitted(true);
        return;
      }
      const pts = await addFixedPoints('daily_reflection', BASE_POINTS);
      setEarnedPoints(pts);
    } else {
      setEarnedPoints(0);
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex-col flex-center gap-lg" style={{ height: '100%', textAlign: 'center' }}>
        <h1 className="text-primary" style={{ fontSize: '3rem' }}>ふりかえり完了！</h1>
        <div className="animate-float" style={{ fontSize: '6rem' }}>{rolling ? '🎲' : '📝'}</div>
        {rolling && (
          <div style={{ fontSize: '1.4rem', color: '#666', fontWeight: 'bold' }}>たくさん書けたから サイコロ！ ころころ…</div>
        )}
        {!rolling && dice !== null && (
          <div className="animate-pop" style={{ fontSize: '1.4rem', color: '#7a5a00', fontWeight: 'bold', background: 'rgba(253,203,110,0.3)', border: '2px solid var(--color-accent)', borderRadius: '14px', padding: '0.5rem 1.2rem' }}>
            🎲 {['⚀','⚁','⚂','⚃','⚄','⚅'][dice - 1]} {dice} が出た！ → {dice} ＋ 2 ＝ {dice + 2}ポイント
          </div>
        )}
        {!rolling && earnedPoints !== null && earnedPoints > 0 && (
          <div className="animate-pop" style={{ fontSize: '2rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>
            +{earnedPoints} ポイントゲット！✨
          </div>
        )}
        {!rolling && earnedPoints === 0 && (
          <p style={{ fontSize: '1rem', color: '#94a3b8', margin: 0 }}>
            {currentIsTrial() ? '（お試しでは ポイントは たまりません）'
              : nonsense ? '（読める文に なっていなかったので、今回は ポイントなし。記録は のこったよ）'
              : '（ポイントは12時間に1回だよ。記録は のこったよ）'}
          </p>
        )}
        <p style={{ fontSize: '1.5rem' }}>えらい！今日もがんばったね！</p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button onClick={() => navigate('/reflection/history')} variant="outline">これまでのふりかえり</Button>
          <Button onClick={() => navigate('/home')}>ホームにもどる</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-col flex-center gap-lg" style={{ minHeight: '100%', width: '100%' }}>
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button variant="outline" onClick={goBack} icon={ArrowLeft}>
          もどる
        </Button>
        <h1 className="text-primary" style={{ fontSize: '2rem', margin: 0 }}>今日のふりかえり</h1>
        <Button variant="outline" onClick={() => navigate('/reflection/history')}>
          これまでの記録
        </Button>
      </div>

      <div 
        className="glass-card flex-col flex-center animate-pop"
        style={{ 
          width: '100%', 
          maxWidth: '600px', 
          padding: '3rem',
          background: 'rgba(255,255,255,0.9)'
        }}
      >
        <h2 style={{ fontSize: '1.8rem', color: 'var(--color-primary)', marginBottom: '1rem' }}>
          今日の手ごたえはどうだった？
        </h2>
        
        <div id="reflection-stars" style={{
          display: 'flex', gap: '1rem', marginBottom: needStars ? '0.5rem' : '2rem',
          padding: needStars ? '0.4rem 0.8rem' : 0, borderRadius: '14px',
          outline: needStars ? '3px solid var(--color-error)' : 'none',
        }}>
          {[1, 2, 3, 4, 5].map((num) => (
            <Star 
              key={num}
              size={48}
              fill={num <= stars ? "var(--color-accent)" : "transparent"}
              color={num <= stars ? "var(--color-accent)" : "#ccc"}
              style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
              onClick={() => { setStars(num); setNeedStars(false); }}
              className="hover-scale"
            />
          ))}
        </div>

        {needStars && (
          <p style={{ color: 'var(--color-error)', fontWeight: 'bold', margin: '0 0 1.5rem' }}>
            ⭐ 上の星を えらんでから 送ってね
          </p>
        )}

        {recent.length > 0 && (
          <div style={{
            width: '100%', background: 'rgba(72, 219, 251, 0.12)', border: '2px solid var(--color-primary)',
            borderRadius: '14px', padding: '0.9rem 1.1rem', marginBottom: '1.2rem',
          }}>
            <div style={{ fontWeight: 'bold', color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
              🕒 さっき やったこと
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {recent.map(a => (
                <span key={a.ts} style={{
                  background: 'white', border: '1px solid #cbd5e1', borderRadius: '999px',
                  padding: '0.25rem 0.7rem', fontSize: '0.9rem',
                }}>
                  {a.label}
                </span>
              ))}
            </div>
          </div>
        )}

        <h2 style={{ fontSize: '1.8rem', color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
          感想を書こう！
        </h2>
        <p style={{ fontSize: '1.15rem', color: '#334155', marginBottom: '0.5rem', textAlign: 'center', fontWeight: 'bold' }}>
          今日よかったこと、難しかったこと、身についたと感じることを書き記そう！
        </p>
        <p style={{ fontSize: '1rem', color: qualifies ? '#b45309' : '#94a3b8', marginBottom: '1rem', textAlign: 'center', fontWeight: 'bold' }}>
          {qualifies
            ? `🎲 ${DICE_CHARS}字以上！（いま ${countChars(comment)}字） 送るとサイコロで 3〜8ポイント（出た目＋2）`
            : `${DICE_CHARS}字以上書くと、サイコロで ポイントが決まるよ（いま ${countChars(comment)}字）`}
        </p>
        {check.hint && (
          <p style={{ fontSize: '0.95rem', color: 'var(--color-error)', fontWeight: 'bold', margin: '-0.5rem 0 1rem', textAlign: 'center' }}>
            ⚠️ {check.hint}
          </p>
        )}

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="ここに入力してね"
          style={{
            width: '100%',
            height: '150px',
            padding: '1rem',
            fontSize: '1.2rem',
            borderRadius: 'var(--radius-md)',
            border: '2px solid var(--color-primary)',
            resize: 'none',
            fontFamily: 'inherit'
          }}
        />

        <Button 
          onClick={handleSubmit} 
          icon={Send}
          style={{ 
            marginTop: '2rem', 
            padding: '1rem 3rem', 
            fontSize: '1.5rem',
          }}
        >
          {!canEarnPoints ? '送って記録する' : qualifies ? '送ってサイコロを振る！🎲' : '送ってポイントをもらう！'}
        </Button>
        {stars === 0 && (
          <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '0.6rem' }}>送る前に ⭐を えらんでね</p>
        )}
      </div>
    </div>
  );
};
