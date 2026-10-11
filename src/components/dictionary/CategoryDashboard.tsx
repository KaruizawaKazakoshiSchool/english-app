import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { ArrowLeft, BookOpen, Target, Keyboard, Mic, Search, CheckCircle, MessageCircleQuestion } from 'lucide-react';
import { useDictionaryProgress } from '../../hooks/useDictionaryProgress';
import { useSafeBack } from '../../hooks/useSafeBack';

export const CategoryDashboard: React.FC = () => {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const goBack = useSafeBack('/dictionary'); // 1つ上＝カテゴリ一覧へ（クロスリンク時は履歴で元へ）
  const decodedCategory = decodeURIComponent(category || '');
  const { progress } = useDictionaryProgress();
  const catProgress = progress[decodedCategory] || { practice: false, speedKaruta: null, memoryGame: null, spelling: false };
  // 選択とハードの✅は、合格したクリアの回数（clearCounts）で分けて出す。
  // 以前はハードをクリアしても「選択モード」に✅が付いていた（子どもの声 2026-10-09）
  const counts: Record<string, number> = (() => {
    try { return JSON.parse(localStorage.getItem(`clearCounts_${localStorage.getItem('studentId')}`) || '{}'); } catch { return {}; }
  })();
  const hardDone = (counts[`dict_practice_hard_${decodedCategory}`] || 0) > 0 || !!(catProgress as any).practiceHard;
  const normalCount = counts[`dict_practice_${decodedCategory}`] || 0;
  const normalDone = normalCount > 0 || (catProgress.practice && !hardDone);

  return (
    <div className="flex-col flex-center gap-lg" style={{ minHeight: '100%', width: '100%' }}>
      <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
        <Button variant="outline" onClick={goBack} icon={ArrowLeft}>
          もどる
        </Button>
      </div>

      <h1 className="text-primary" style={{ fontSize: '2.5rem', margin: 0 }}>{decodedCategory}</h1>
      <p style={{ fontSize: '1.2rem', color: '#666' }}>どのモードで練習する？</p>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', width: '100%', maxWidth: '800px', marginBottom: '2rem' }}>
        <div 
          className="glass-card flex-col flex-center animate-pop" 
          style={{ padding: '2rem', cursor: 'pointer', background: 'rgba(72, 219, 251, 0.2)' }}
          onClick={() => navigate(`/dictionary/${category}/learn`)}
        >
          <BookOpen size={48} color="var(--color-primary)" style={{ marginBottom: '1rem' }} />
          <h2 style={{ margin: 0 }}>学習モード</h2>
        </div>

        <div 
          className="glass-card flex-col flex-center animate-pop" 
          style={{ padding: '2rem', cursor: 'pointer', background: 'rgba(29, 209, 161, 0.2)', position: 'relative' }}
          onClick={() => navigate(`/dictionary/${category}/practice`)}
        >
          {normalDone && (
            <div style={{ position: 'absolute', top: '-10px', right: '-10px', color: 'var(--color-success)' }}>
              <CheckCircle size={32} fill="#fff" />
            </div>
          )}
          <Target size={48} color="var(--color-primary)" style={{ marginBottom: '1rem' }} />
          <h2 style={{ margin: 0 }}>選択モード</h2>
        </div>

        <div
          className="glass-card flex-col flex-center animate-pop"
          style={{ padding: '2rem', cursor: 'pointer', background: 'rgba(238, 82, 83, 0.15)', border: '2px dashed #ee5253', position: 'relative' }}
          onClick={() => navigate(`/dictionary/${category}/practice?hard=1`)}
        >
          {hardDone && (
            <div style={{ position: 'absolute', top: '-10px', right: '-10px', color: 'var(--color-success)' }}>
              <CheckCircle size={32} fill="#fff" />
            </div>
          )}
          <Target size={48} color="#ee5253" style={{ marginBottom: '1rem' }} />
          <h2 style={{ margin: 0 }}>🔥 選択（ハード）</h2>
          <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.85rem', color: '#666' }}>6択・ヒントなし・一発勝負</p>
        </div>

        <div 
          className="glass-card flex-col flex-center animate-pop" 
          style={{ padding: '2rem', cursor: 'pointer', background: 'rgba(255, 159, 67, 0.2)', position: 'relative' }}
          onClick={() => navigate(`/dictionary/${category}/game/spelling`)}
        >
          {catProgress.spelling && (
            <div style={{ position: 'absolute', top: '-10px', right: '-10px', color: 'var(--color-success)' }}>
              <CheckCircle size={32} fill="#fff" />
            </div>
          )}
          <Keyboard size={48} color="var(--color-primary)" style={{ marginBottom: '1rem' }} />
          <h2 style={{ margin: 0 }}>タイピングモード</h2>
        </div>

        <div
          className="glass-card flex-col flex-center animate-pop"
          style={{ padding: '2rem', cursor: 'pointer', background: 'rgba(0, 184, 148, 0.2)' }}
          onClick={() => navigate(`/dictionary/${category}/game/typing`)}
        >
          <Keyboard size={48} color="var(--color-primary)" style={{ marginBottom: '1rem' }} />
          <h2 style={{ margin: 0 }}>⌨️ タイピング練習</h2>
        </div>

        <div
          className="glass-card flex-col flex-center animate-pop"
          style={{ padding: '2rem', cursor: 'pointer', background: 'rgba(255, 107, 107, 0.2)' }}
          onClick={() => navigate(`/dictionary/${category}/game/voice`)}
        >
          <Mic size={48} color="var(--color-primary)" style={{ marginBottom: '1rem' }} />
          <h2 style={{ margin: 0 }}>モンスターバトル</h2>
        </div>

        <div 
          className="glass-card flex-col flex-center animate-pop" 
          style={{ padding: '2rem', cursor: 'pointer', background: 'rgba(253, 121, 168, 0.2)' }}
          onClick={() => navigate(`/dictionary/${category}/game/qa`)}
        >
          <MessageCircleQuestion size={48} color="var(--color-primary)" style={{ marginBottom: '1rem' }} />
          <h2 style={{ margin: 0 }}>QAモード</h2>
        </div>

        <div 
          className="glass-card flex-col flex-center animate-pop" 
          style={{ padding: '2rem', cursor: 'pointer', background: 'rgba(162, 155, 254, 0.2)' }}
          onClick={() => navigate(`/dictionary/${category}/game/wordsearch`)}
        >
          <Search size={48} color="var(--color-primary)" style={{ marginBottom: '1rem' }} />
          <h2 style={{ margin: 0 }}>言葉さがし</h2>
        </div>
      </div>
    </div>
  );
};
