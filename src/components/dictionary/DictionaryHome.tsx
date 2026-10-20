import { fullPointCatsLeft } from '../../lib/dictDepth';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVocabulary, addCustomWord } from '../../hooks/useVocabulary';
import { useAppSettings } from '../../hooks/useAppSettings';
import { Button } from '../ui/Button';
import { ArrowLeft, BookOpen, Plus } from 'lucide-react';
import { searchUnit, UnitSearchBox } from './UnitSearch';

const inputStyle: React.CSSProperties = { display: 'block', width: '100%', marginTop: '0.3rem', padding: '0.5rem', fontSize: '1rem', borderRadius: '8px', border: '2px solid #e2e8f0', boxSizing: 'border-box' };

export const DictionaryHome: React.FC = () => {
  const leftToday = fullPointCatsLeft(localStorage.getItem('studentId'));
  const navigate = useNavigate();
  const vocabulary = useVocabulary();
  const { customVocabEnabled } = useAppSettings(); // OFFの間は子どもに見せない

  // マイ単語ついようフォーム
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ english: '', japanese: '', category: '', emoji: '', imageUrl: '' });
  const [saving, setSaving] = useState(false);
  const [addMsg, setAddMsg] = useState('');

  // Get unique categories
  const categories = Array.from(new Set(vocabulary.map(v => v.category)));
  const [unitQuery, setUnitQuery] = useState('');   // 単元さがし（2026-10-20：単元が増えて探しにくい）

  const handleAddWord = async () => {
    if (!form.english.trim() || !form.japanese.trim() || !form.category.trim()) {
      setAddMsg('英語・日本語・カテゴリは必須だよ');
      return;
    }
    setSaving(true);
    const { error } = await addCustomWord(form);
    setSaving(false);
    if (error) { setAddMsg('保存できなかった…通信を確認してね'); return; }
    setAddMsg(`「${form.japanese}」をついかしたよ！`);
    setForm({ english: '', japanese: '', category: form.category, emoji: '', imageUrl: '' });
    setTimeout(() => setAddMsg(''), 4000);
  };

  return (
    <div className="flex-col flex-center gap-xl" style={{ minHeight: '100%' }}>
      <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
        <Button variant="outline" onClick={() => navigate('/home')} icon={ArrowLeft}>
          ホームにもどる
        </Button>
      </div>
      <div style={{ width: '100%', maxWidth: '800px' }}>
        <UnitSearchBox value={unitQuery} onChange={setUnitQuery} total={categories.length}
          count={categories.filter(c => searchUnit(c, unitQuery, vocabulary).match).length} />
      </div>
      
      <div className="flex-col flex-center gap-sm">
        <BookOpen size={64} color="var(--color-primary)" />
        <h1 className="text-primary" style={{ fontSize: '3rem', margin: 0 }}>Picture Dictionary</h1>
        <p style={{ fontSize: '1.2rem', color: '#666' }}>単元を選んで単語を練習しよう！</p>
        <p style={{ fontSize: '0.95rem', color: '#b45309', fontWeight: 'bold', margin: 0 }}>
          🔎 同じ単元を いろいろなモードで やると 深めボーナス（×1.25 → ×1.5）
        </p>
        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
          {leftToday > 0
            ? `今日は あと ${leftToday}単元 まんてんポイントで 始められるよ`
            : '今日 新しく始める単元より、ここまでにやった単元を 深めるほうが 大きいよ'}
        </p>
      </div>

      {/* 実力テスト（P2-1）：既習カテゴリからランダム出題・一発勝負 */}
      <div
        className="glass-card hover-scale"
        style={{ width: '100%', maxWidth: '800px', padding: '1.1rem 1.4rem', cursor: 'pointer', border: '2px solid #f59e0b', background: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', gap: '0.9rem' }}
        onClick={() => navigate('/skilltest')}
      >
        <span style={{ fontSize: '1.8rem' }}>🧪</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#b45309' }}>単語実力テスト</div>
          <div style={{ fontSize: '0.85rem', color: '#92700a' }}>習った単語からランダム10問・一発勝負！結果はグラフに記録されるよ</div>
        </div>
        <span style={{ fontSize: '1.3rem', color: '#b45309' }}>›</span>
      </div>

      {/* マイ単語をついか（先生がダッシュボードでONにしたときだけ表示） */}
      {customVocabEnabled && (
      <div style={{ width: '100%', maxWidth: '800px' }}>
        <Button variant={showAdd ? 'primary' : 'outline'} icon={Plus} onClick={() => setShowAdd(s => !s)}>
          マイ単語をついか
        </Button>
        {showAdd && (
          <div className="glass-card flex-col gap-md" style={{ padding: '1.5rem', marginTop: '1rem', textAlign: 'left' }}>
            <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
              地域の言葉（れい：懐古園 Kaikoen）などをついかできるよ。絵文字か、写真のURLをつけてね。
            </p>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>英語<input value={form.english} onChange={e => setForm({ ...form, english: e.target.value })} placeholder="Kaikoen" style={inputStyle} /></label>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>日本語<input value={form.japanese} onChange={e => setForm({ ...form, japanese: e.target.value })} placeholder="懐古園" style={inputStyle} /></label>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>カテゴリ
                <input list="cat-list" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="小諸のばしょ" style={inputStyle} />
                <datalist id="cat-list">{categories.map(c => <option key={c} value={c} />)}</datalist>
              </label>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>絵文字（任意）<input value={form.emoji} onChange={e => setForm({ ...form, emoji: e.target.value })} placeholder="🏯" style={inputStyle} /></label>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', gridColumn: '1 / -1' }}>写真URL（任意）<input value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://… の画像URL" style={inputStyle} /></label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Button onClick={handleAddWord} icon={Plus} disabled={saving}>{saving ? '保存中…' : 'ついかする'}</Button>
              {addMsg && <span style={{ fontWeight: 'bold', color: addMsg.includes('ついか') ? 'var(--color-success)' : 'var(--color-error)' }}>{addMsg}</span>}
            </div>
          </div>
        )}
      </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', width: '100%', maxWidth: '800px' }}>
        {categories.map(category => ({ category, hit: searchUnit(category, unitQuery, vocabulary) })).filter(x => x.hit.match).map(({ category, hit }, idx) => (
          <div 
            key={idx} 
            className="glass-card flex-col flex-center animate-pop"
            style={{ padding: '2rem', cursor: 'pointer', transition: 'transform 0.2s' }}
            onClick={() => navigate(`/dictionary/${encodeURIComponent(category)}`)}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--color-primary)' }}>{category}</h2>
            <p style={{ margin: '0.5rem 0 0 0', color: '#666' }}>
              {vocabulary.filter(v => v.category === category).length} words
            </p>
            {hit.words.length > 0 && (
              <p style={{ margin: '0.3rem 0 0 0', color: '#b45309', fontSize: '0.9rem', fontWeight: 'bold' }}>{hit.words.slice(0, 3).join('・')}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
