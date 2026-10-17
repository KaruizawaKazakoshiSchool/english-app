import React from 'react';
import { useSafeBack } from '../../hooks/useSafeBack';
import { Button } from '../ui/Button';
import { Award, ArrowLeft } from 'lucide-react';
import { stages } from '../../data/stages';

export const Certificate: React.FC = () => {
  const goBack = useSafeBack();
  const studentName = localStorage.getItem('studentName') || 'Student';
  const coreCount = stages.filter(st => !st.extra).length;

  return (
    <div className="flex-col gap-lg" style={{ flex: 1 }}>
      <div style={{ display: 'flex' }}>
        <Button variant="outline" onClick={goBack} icon={ArrowLeft}>
          もどる
        </Button>
      </div>

      {/* 「これなあに？」「修了証って何？」の声（2026-10-13・10-17）。何の証明書で、どうすればいいかを先に書く */}
      <div style={{ background: 'rgba(255,255,255,0.9)', border: '2px solid var(--color-accent)', borderRadius: '14px', padding: '0.8rem 1.1rem', maxWidth: '700px', margin: '0 auto', width: '100%', lineHeight: 1.6 }}>
        <b>🎓 修了証（しゅうりょうしょう）って？</b><br />
        フォニックスの {coreCount}ステージを 全部クリアした人に わたす「やりきったよ」の証明書だよ。
        スタッフに見せて、下の線に サインをもらおう！
      </div>

      <div className="flex-center" style={{ flex: 1 }}>
        <div 
          className="glass-card flex-col flex-center"
          style={{ 
            width: '100%', 
            maxWidth: '700px', 
            padding: '4rem',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.7))',
            border: '4px solid var(--color-accent)',
            boxShadow: '0 0 40px rgba(253, 203, 110, 0.4)',
            textAlign: 'center'
          }}
        >
          <div className="animate-float" style={{ marginBottom: '2rem' }}>
            <Award size={120} color="var(--color-accent)" />
          </div>
          
          <h1 style={{ fontSize: '4rem', color: 'var(--color-primary)', marginBottom: '1rem' }}>
            Eigo no Mori
          </h1>
          
          <p style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>
            この修了証を以下に授与します
          </p>
          
          <h2 style={{ fontSize: '3rem', borderBottom: '2px solid var(--color-text-main)', paddingBottom: '0.5rem', marginBottom: '2rem', display: 'inline-block' }}>
            {studentName} 殿
          </h2>
          
          <p style={{ fontSize: '1.2rem', color: 'var(--color-text-muted)' }}>
            フォニックスの全{coreCount}ステージを立派にクリアしました！
          </p>
          
          <div style={{ marginTop: '3rem', display: 'flex', gap: '2rem', justifyContent: 'center' }}>
            <div style={{ borderTop: '1px solid black', paddingTop: '0.5rem', width: '200px' }}>
              スタッフのサイン
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
