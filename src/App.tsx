import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, useParams } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { ClassGate } from './components/auth/ClassGate';
import { loadRoster } from './data/students';
import { Layout } from './components/layout/Layout';
import { Home } from './components/home/Home';
import { Stage } from './components/stage/Stage';

// ステージを id ごとに作り直す（「次のステージへ」で /stage/8 → /stage/9 に移ったとき、前のクリア画面が残らないように）
const StageRoute = () => { const { id } = useParams<{ id: string }>(); return <Stage key={id} />; };
import { Certificate } from './components/certificate/Certificate';
import { Login } from './components/auth/Login';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { TeacherDashboard } from './components/teacher/TeacherDashboard';
import { DictionaryHome } from './components/dictionary/DictionaryHome';
import { CategoryDashboard } from './components/dictionary/CategoryDashboard';
import { LearnMode } from './components/dictionary/LearnMode';
import { PracticeMode } from './components/dictionary/PracticeMode';
import { SpellingGame } from './components/dictionary/games/SpellingGame';
import { TypingPractice } from './components/dictionary/games/TypingPractice';
import { VoiceBattle } from './components/dictionary/games/VoiceBattle';
import { WordSearch } from './components/dictionary/games/WordSearch';
import { QAMode } from './components/dictionary/games/QAMode';
import { AIAssistant } from './components/dictionary/games/AIAssistant';
import { StoryMode } from './components/dictionary/games/StoryMode';
import { ReflectionForm } from './components/reflection/ReflectionForm';
import { ReflectionHistory } from './components/reflection/ReflectionHistory';
import { TextbookMode } from './components/textbook/TextbookMode';
import { MyProgress } from './components/progress/MyProgress';
import { DialogueTrainer } from './components/dialogue/DialogueTrainer';
import { MicTest } from './components/mic/MicTest';
import { Shop } from './components/shop/Shop';
import { ClassTree } from './components/tree/ClassTree';
import { SkillTest } from './components/dictionary/SkillTest';
import { ToastHost } from './components/ui/Toast';


const App: React.FC = () => {
  // クラス共通の「合言葉」でログイン済みか。
  //  null=確認中 / false=未ログイン（ClassGateを出す） / true=ログイン済み（今まで通り）
  const [authed, setAuthed] = useState<boolean | null>(null);
  // 名簿（Supabaseから取得）の読み込み状態。null=まだ / true=完了 / string=エラー
  const [roster, setRoster] = useState<null | true | string>(null);

  useEffect(() => {
    // 端末に保存されたログイン状態を確認（初回だけ合言葉、以後はスキップ）
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    // ログイン／ログアウトの変化に追従（別タブでの変化やトークン失効にも対応）
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // 合言葉を通ったら、名簿をSupabaseから読み込む（コードには名簿を持たない）
  useEffect(() => {
    if (authed !== true) return;
    let alive = true;
    loadRoster()
      .then(() => { if (alive) setRoster(true); })
      .catch(() => { if (alive) setRoster('めいぼが 読み込めませんでした。通信を 確認して、ページを 開き直してね'); });
    return () => { alive = false; };
  }, [authed]);

  // セッション確認中は一瞬なので、ちらつき防止に何も出さない
  if (authed === null) return null;

  // 未ログインなら、合言葉画面だけを出す（子ども向けの入口）
  if (!authed) return <ClassGate onAuthed={() => setAuthed(true)} />;

  // 名簿の読み込み中／失敗
  if (roster !== true) {
    return (
      <div className="flex-col flex-center gap-lg" style={{ minHeight: '100vh', padding: '2rem', textAlign: 'center' }}>
        <p style={{ fontSize: '1.25rem' }}>
          {typeof roster === 'string' ? roster : '読み込み中…'}
        </p>
      </div>
    );
  }

  return (
    <Router>
      {/* 画面固定の通知（ポイント獲得・クリア・もう一度）。スクロール位置に関係なく見える */}
      <ToastHost />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/teacher" element={<TeacherDashboard />} />
        
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/home" element={<Home />} />
            <Route path="/stage/:id" element={<StageRoute />} />
            <Route path="/certificate" element={<Certificate />} />
            <Route path="/dictionary" element={<DictionaryHome />} />
            <Route path="/dictionary/:category" element={<CategoryDashboard />} />
            <Route path="/dictionary/:category/learn" element={<LearnMode />} />
            <Route path="/dictionary/:category/practice" element={<PracticeMode />} />
            <Route path="/dictionary/:category/game/spelling" element={<SpellingGame />} />
            <Route path="/dictionary/:category/game/typing" element={<TypingPractice />} />
            <Route path="/dictionary/:category/game/voice" element={<VoiceBattle />} />
            <Route path="/dictionary/:category/game/wordsearch" element={<WordSearch />} />
            <Route path="/dictionary/:category/game/qa" element={<QAMode />} />
            <Route path="/ai" element={<AIAssistant />} />
            <Route path="/story" element={<StoryMode />} />
            <Route path="/textbook" element={<TextbookMode />} />
            <Route path="/progress" element={<MyProgress />} />
            <Route path="/mictest" element={<MicTest />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/tree" element={<ClassTree />} />
            <Route path="/skilltest" element={<SkillTest />} />
            <Route path="/dialogue" element={<DialogueTrainer />} />

            <Route path="/reflection" element={<ReflectionForm />} />
            <Route path="/reflection/history" element={<ReflectionHistory />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
