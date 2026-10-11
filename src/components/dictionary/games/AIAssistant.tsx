import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppSettings } from '../../../hooks/useAppSettings';
import { saveConversationLog } from '../../../lib/conversationLogs';
import { STUDENTS } from '../../../data/students';
import { useSpeechRecognition } from '../../../hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '../../../hooks/useSpeechSynthesis';
import { usePoints } from '../../../hooks/usePoints';
import { Button } from '../../ui/Button';
import { MicButton } from '../../ui/MicButton';
import { ArrowLeft, Send, Sparkles, Coins, HelpCircle, Languages, Trophy, RefreshCw } from 'lucide-react';
import { SAFETY_INSTRUCTION, isInappropriate } from '../../../lib/contentFilter';
import { DIALOGUES } from '../../dialogue/dialogueData';
import { isOverCap, incUsage } from '../../../lib/apiUsage';
import { generateWithGemini, ProxyError, type GeminiContent } from '../../../lib/aiProxy';
import { EIKEN_LEVELS, findEiken, loadEiken, saveEiken } from '../../../data/eikenLevels';
import { isArchived } from '../../../data/archivedUnits';
import { useSafeBack } from '../../../hooks/useSafeBack';
import { markUnitClear } from '../../../lib/unitProgress';

// 教科書の各Unitに紐づくフリートークの場面とゴール。
// goal は英語（AIがこの条件を満たしたら最後に [CLEAR] を付ける＝クリア判定の基準）。
// missionJa は子ども向けの「クリア条件」表示。situation は場面（日本語）。
interface FreetalkUnit { id: string; label: string; situation: string; goal: string; missionJa: string; greeting: { en: string; ja: string }; }
export const FREETALK_UNITS: FreetalkUnit[] = [
  // English Workshop（789年生主催）向け：名前・ニックネーム・好きなもの1つで自己紹介
  { id: 'intro-workshop', label: '👋 自己紹介（789 English Workshop）', situation: 'English Workshopで、はじめて会った上級生に自己紹介する', goal: 'You are a friendly older student meeting the user for the first time at an English workshop. The goal is reached ONLY after the user has told you ALL THREE: (1) their NAME, (2) a nickname or what to call them, AND (3) one thing they like (a favorite color, food, sport, etc.). Ask short, friendly follow-up questions to draw out anything missing. Keep replies very short.', missionJa: '名前・ニックネーム・好きなもの（色/食べ物/スポーツ）の3つを伝えよう！', greeting: { en: "Hi! Nice to meet you! What's your name?", ja: 'こんにちは！はじめまして！お名前は？' } },
  { id: 'g5-u1', label: '5年 U1 好きな教科', situation: '休み時間に、好きな教科について話す', goal: 'The goal is reached only after the user has BOTH asked you what subject you like AND told you their own favorite subject.', missionJa: 'すきな教科をたずねて、自分のすきな教科も伝えよう！', greeting: { en: 'Hi! What subject do you like?', ja: 'やあ！何の教科が好き？' } },
  { id: 'g5-u2', label: '5年 U2 誕生日', situation: '友だちの誕生日とほしいものを聞き合う', goal: 'The goal is reached only after the user has asked when your birthday is AND told you their own birthday AND said one thing they want.', missionJa: '誕生日をたずね合って、ほしいものも伝えよう！', greeting: { en: 'Hi! When is your birthday?', ja: 'やあ！誕生日はいつ？' } },
  { id: 'g5-u3', label: '5年 U3 できること', situation: 'お互いにできること（楽器・スポーツ）を聞き合う', goal: 'The goal is reached only after the user has asked what you can do AND told you one thing they can do.', missionJa: 'おたがいの「できること」をたずね合おう！', greeting: { en: 'Can you play the piano?', ja: 'ピアノは弾ける？' } },
  { id: 'g5-u4', label: '5年 U4 友だちの特技', situation: '友だちが上手にできることを紹介し合う', goal: 'The goal is reached only after the user has introduced what their friend can do well using "He can ..." or "She can ...".', missionJa: '友だちが上手にできることを紹介しよう！', greeting: { en: 'My friend can run fast. How about your friend?', ja: '友だちは速く走れるよ。きみの友だちは？' } },
  { id: 'g5-u5', label: '5年 U5 道案内', situation: '町で道をたずねて案内する', goal: 'You are lost and looking for the station. The goal is reached only after the user gives directions (go straight / turn right / turn left) and you arrive at the station.', missionJa: '駅まで道案内しよう！（まっすぐ・右・左）', greeting: { en: 'Excuse me. Where is the station?', ja: 'すみません、駅はどこ？' } },
  // 観光スポット案内（Unit 5 話型D）：観光客Lucyの追加質問（遠い？いくら？何が食べられる？写真いい？）に答える。子どもがガイド。
  // 以前はダイアログの「AIのLucyを案内してみる」が 'g5-u5'（駅を探すTaylorの道案内）につながっていた（2026-09-28）
  { id: 'g5-u5d', label: '5年 U5 観光スポット案内（Lucy）', situation: '観光客のLucyの質問に、ガイドとして答える', goal: 'You are Lucy, a friendly tourist in Karuizawa. The user is your guide who has just told you about a place. Ask these questions ONE AT A TIME, in simple English, waiting for an answer each time: "Is it far?", "How much is it?", "What can I eat there?", "Can I take a photo?". The goal is reached ONLY after the user has answered AT LEAST THREE of these questions with a sentence (for example "No, it\'s near. It\'s about five minutes.", "It\'s free!", "You can eat soba there.", "Sure!"). Keep replies very short.', missionJa: 'Lucyの質問（遠い？いくら？何が食べられる？写真いい？）に3つ以上答えよう！', greeting: { en: "Hello! I'm Lucy. Thank you for your guide! Excuse me. Is it far?", ja: 'こんにちは！ルーシーです。案内ありがとう！すみません、遠いですか？' } },
  { id: 'g5-u6', label: '5年 U6 レストラン注文', situation: 'レストランで食べ物や飲み物を注文する', goal: 'You are a cashier. The goal is reached only after the user orders food and/or drink, hears the price, and pays or says thank you/goodbye.', missionJa: 'ごはんを注文して、お会計までしよう！', greeting: { en: 'What would you like?', ja: '何にする？' } },
  { id: 'g5-u7', label: '5年 U7 行きたい場所', situation: '行きたい場所とその理由を話す', goal: 'The goal is reached only after the user has said where they want to go AND given a reason (because ...).', missionJa: '行きたい場所と、その理由をつたえよう！', greeting: { en: 'Where do you want to go?', ja: 'どこに行きたい？' } },
  // 季節ガイド（Unit 7 の話型）：観光客Lucyに、おすすめの季節を紹介する。子どもがガイド。
  // 以前はダイアログの「AIのLucyに季節をすすめる」が 'g5-u7'（行きたい場所）につながっていた（子どもの声 2026-09-28）
  { id: 'g5-u7s', label: '5年 U7 季節ガイド（Lucy）', situation: '日本に来た観光客のLucyに、おすすめの季節を紹介する', goal: 'You are Lucy, a friendly tourist visiting Japan. The user is your guide. Ask which season they like, then "Why?", then "When?". The goal is reached ONLY after the user has told you ALL THREE: (1) a season they recommend (I like ...), (2) a reason with "You can ..." (for example "You can see red leaves."), AND (3) a month to come (Come in ...!). Ask short follow-up questions to draw out anything missing. Keep replies very short.', missionJa: 'Lucyに、すきな季節・その理由（You can ～）・来てほしい月を伝えよう！', greeting: { en: "Hello! I'm Lucy. What season do you like?", ja: 'こんにちは！ルーシーです。どの季節が好き？' } },
  { id: 'g5-u8', label: '5年 U8 ヒーロー', situation: '自分のヒーローについて紹介する', goal: 'The goal is reached only after the user has told you who their hero is AND why (what the hero can do or is good at).', missionJa: '自分のヒーローと、その理由を紹介しよう！', greeting: { en: 'Who is your hero?', ja: 'あなたのヒーローは誰？' } },
  { id: 'g6-u1', label: '6年 U1 自己紹介', situation: 'はじめて会った人に自己紹介する', goal: 'The goal is reached only after the user has told you their name AND one thing they can do.', missionJa: '名前と、できることを紹介しよう！', greeting: { en: "Hi! I'm Jordan. What can you do?", ja: 'やあ！ジョーダンだよ。何ができる？' } },
  { id: 'g6-u2', label: '6年 U2 一日の生活', situation: '毎日の生活（起きる時間など）を聞き合う', goal: 'The goal is reached only after the user has asked about your daily routine AND told you what time they do something (get up / go to bed, etc.).', missionJa: '毎日の生活（起きる時間など）をたずね合おう！', greeting: { en: 'What time do you get up?', ja: '何時に起きる？' } },
  { id: 'g6-u3', label: '6年 U3 週末のこと', situation: '週末にしたことを話す', goal: 'The goal is reached only after the user has told you TWO things they did on the weekend in the past tense (I went / I played ...).', missionJa: '週末にしたことを2つ伝えよう！（過去形）', greeting: { en: 'How was your weekend?', ja: '週末はどうだった？' } },
  { id: 'g6-u4', label: '6年 U4 行きたい国', situation: '行きたい国と見られるものを話す', goal: 'The goal is reached only after the user has said which country they want to visit AND what they can see or do there.', missionJa: '行きたい国と、そこで見られるものを伝えよう！', greeting: { en: 'Where do you want to go?', ja: 'どこの国に行きたい？' } },
  { id: 'g6-u5', label: '6年 U5 ○○産', situation: '持ち物がどこの国から来たか話す', goal: 'The goal is reached only after the user has said where an item is from using "It\'s from ...".', missionJa: '持ち物がどこの国から来たか伝えよう！', greeting: { en: 'Nice bag! Where is it from?', ja: 'いいかばん！どこ産？' } },
  // P7 World Fashion Show & Shop（2026-10-05）。お店はAIがお客さん（World Bento の型の再演）、ショーはAIが観客。
  { id: 'p7-shop', label: '6年 U5 お店（服）', situation: '服と小物のお店で、店員としてお客さんに売る', goal: 'You are a friendly CUSTOMER at a "World Fashion" shop run by elementary-school students. The user is the SHOP STAFF. Speak ONLY in simple, slow English. You do not know the shop\'s items until the staff tells you. Flow: greet and ask "What do you have?" -> order clothes ONE at a time ("I\'d like a blue cap, please.") -> ask "How much is it?" -> once, ask "Where is it from?" -> after two items ask "How much is it in total?" -> if the total is correct, say "Here you are." and goodbye; if not, kindly let them try again. The goal is reached ONLY after the staff has told you at least TWO items with a price for each AND the CORRECT total. Keep replies very short.', missionJa: 'お店の人になろう！ 服を2つ売って、値段と合計を言えたらクリア！ "Where is it from?" にも答えてね', greeting: { en: 'Hello! What do you have?', ja: 'こんにちは！ 何がありますか？' } },
  { id: 'p7-show', label: '6年 U5 ファッションショー', situation: 'ファッションショーで、自分の服と手作りの小物を観客に紹介する', goal: 'You are an excited AUDIENCE member at a kids\' fashion show. The user is a model on the runway, wearing their own clothes and one handmade item (like a paper poncho or crown). React warmly ("Wow!", "Nice!"). Ask "Tell me about your clothes!" and, if needed, "Where is it from?" or "What color is it?". The goal is reached ONLY after the user has said BOTH "This is my ___." (an item) AND "It\'s from ___." (a country). Keep replies very short.', missionJa: 'ショーのモデルになろう！ This is my ◯◯. と It\'s from ◯◯. を言えたらクリア！ Look! I made a ◯◯. で手作りの小物も見せたらボーナス！', greeting: { en: 'Wow, nice clothes! Tell me about your clothes!', ja: 'わあ、すてきな服！ 服のことを教えて！' } },
  { id: 'g6-u6', label: '6年 U6 環境', situation: '危機にある動物や環境のためにできることを話す', goal: 'The goal is reached only after the user has named an animal or environmental problem AND said one thing we can do about it.', missionJa: '危機にある動物と、自分たちにできることを伝えよう！', greeting: { en: 'Sea turtles are in danger. What can we do?', ja: 'ウミガメが危ないよ。何ができるかな？' } },
  { id: 'g6-u7', label: '6年 U7 一番の思い出', situation: '小学校の一番の思い出を話す', goal: 'The goal is reached only after the user has told you their best school memory AND what they did, in the past tense.', missionJa: '小学校の一番の思い出を伝えよう！（過去形）', greeting: { en: 'What is your best memory?', ja: '一番の思い出は？' } },
  { id: 'g6-u8', label: '6年 U8 将来の夢', situation: '将来なりたいものとその理由を話す', goal: 'The goal is reached only after the user has said what they want to be AND why.', missionJa: '将来なりたいものと、その理由を伝えよう！', greeting: { en: 'What do you want to be?', ja: '将来何になりたい？' } },
];


// AIの通信エラーを、子どもが読んで次の行動が分かる日本語にする。
// （英語の生エラーが会話に混ざると、何が起きたのか分からず不安になるため）
const friendlyAiError = (err: any): string => {
  // 中継役（Edge Function）からのメッセージは、そのまま子ども向けの文になっている
  if (err instanceof ProxyError && err.status) return err.message;
  const raw = String(err?.message || err || '');
  if (/Failed to fetch|NetworkError|ERR_INTERNET|Load failed/i.test(raw)) {
    return '📶 いま インターネットに つながらないみたい。少し待って もう一度送ってね。（直らないときは先生を呼ぼう）';
  }
  if (/429|quota|RESOURCE_EXHAUSTED|rate/i.test(raw)) {
    return '⏳ いま みんなが たくさん使っていて 混んでいます。少し待って もう一度送ってね。';
  }
  if (/API key|401|403|PERMISSION|invalid/i.test(raw)) {
    return '🔑 AIの設定に 問題があるみたい。先生を呼んでね。';
  }
  if (/500|503|internal|unavailable/i.test(raw)) {
    return '🛠 AIのサーバーが 混んでいます。少し待って もう一度試してね。';
  }
  return '⚠️ うまく 送れませんでした。もう一度試して、直らないときは先生を呼んでね。';
};

const stripSlots = (s: string) => s.replace(/[{}]/g, '');

interface InitOpts {
  situation?: string;
  goal?: string;
  goalLabel?: string;
  greeting?: { en: string; ja: string };
  suggestions?: Suggestion[];
  title?: string;
  histSuffix?: string;
}

const shortHash = (s: string): string => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

// Unit別フリートークを開始するための opts を組み立てる（例文サジェストはダイアログから流用）
const buildUnitOpts = (u: FreetalkUnit): InitOpts => {
  const d = DIALOGUES.find(x => x.id === u.id);
  const suggestions = d ? d.lines.map(l => ({ en: stripSlots(l.en), ja: l.ja })) : undefined;
  return {
    situation: u.situation,
    goal: u.goal,
    goalLabel: `🎯 ミッション：${u.missionJa}`,
    greeting: u.greeting,
    suggestions,
    title: u.label,
    histSuffix: u.id,
  };
};

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  ja?: string;
  speakerName?: string; // チームモードで、その発話を話したメンバー名
}

interface Suggestion { en: string; ja: string; }
interface Scenario {
  emoji: string;
  title: string;
  desc: string;
  role: string;
  goal: string;
  goalLabel: string;
  greeting: { en: string; ja: string };
  suggestions: Suggestion[];
}

// お店屋さんモードのゴール文（AIへの指示）。シンプル／チャレンジで goal を差し替える。
const BENTO_SHOP_SIMPLE_GOAL =
  'Flow:\n' +
  '1) Greet and ask what they have.\n' +
  '2) After the staff lists items, order ONE item at a time ("I\'d like ___, please."). Wait for the staff to tell you the price. If they don\'t say a price, ask "How much is it?".\n' +
  '3) Order 2 or 3 items in total this way.\n' +
  '4) Then say "That\'s all, thank you." and ask for the total ("How much is it all together?").\n' +
  '5) Add up the prices the staff told you. If the total they say is correct, say "Great! Here you are." pay, and say goodbye. If it is wrong, kindly say what you think it should be and let them try once more.\n' +
  'Be patient; if the staff is stuck, give a gentle hint.\n' +
  'The goal is reached ONLY after the staff has: welcomed you, listed items, taken at least TWO orders with a price for each, and given the CORRECT total, and you have paid.';

const BENTO_SHOP_CHALLENGE_GOAL =
  'Follow the same flow as a normal customer (order 2-3 items one at a time, get each price, then get the total and pay).\n' +
  'ALSO: one or two times during the ordering, ask a short, curious question about the food, such as "What\'s in it?", "What is ___?", or "Is it spicy?". React kindly to the answer, then continue ordering. Ask at most TWO such questions total — keep it light.\n' +
  'The goal is reached ONLY after the staff has welcomed you, taken at least TWO orders with a price for each, given the CORRECT total, and you have paid.';

const BENTO_SHOP_SIMPLE_LABEL =
  '🎯 ミッション：お店の人になろう！ メニューを伝える→注文を受ける→値段を言う→合計を伝える→お客さんがはらったらクリア！';
const BENTO_SHOP_CHALLENGE_LABEL =
  '🎯 ミッション（チャレンジ）：お客さんが料理の質問（What\'s in it? など）もしてくるよ。答えながら、注文と合計までいけたらクリア！';

const SCENARIOS: Record<string, Scenario> = {
  restaurant: {
    emoji: '🍔', title: 'お店屋さんごっこ', desc: 'ハンバーガー屋さんでお買い物をしてみよう！',
    role: 'You are Alex, a friendly cashier at a fast food restaurant.',
    goal: 'The customer orders some food and/or drinks, you tell the total price, and the customer pays or says thank you/goodbye. That is the goal.',
    goalLabel: '🎯 ミッション：ごはんを注文して、お会計までしよう！',
    greeting: { en: 'Welcome! May I help you?', ja: 'いらっしゃいませ！ご注文は？' },
    suggestions: [
      { en: "I'd like a hamburger.", ja: 'ハンバーガーをください。' },
      { en: "Orange juice, please.", ja: 'オレンジジュースをください。' },
      { en: "How much is it?", ja: 'いくらですか？' },
      { en: "Here you are.", ja: 'はい、どうぞ。' },
      { en: "Thank you. Goodbye!", ja: 'ありがとう。さようなら！' },
    ],
  },
  directions: {
    emoji: '🗺️', title: '道案内', desc: '迷子の友だちに道を教えてあげよう！',
    role: 'You are Taylor, a tourist who is lost in a town in Japan and is looking for the station.',
    goal: 'The user gives you directions (go straight, turn right, turn left). When you arrive at the station thanks to their directions, that is the goal.',
    goalLabel: '🎯 ミッション：駅まで道案内してあげよう！',
    greeting: { en: 'Excuse me! Where is the station?', ja: 'すみません！駅はどこですか？' },
    suggestions: [
      { en: 'Go straight.', ja: 'まっすぐ行ってください。' },
      { en: 'Turn right.', ja: '右に曲がってください。' },
      { en: 'Turn left.', ja: '左に曲がってください。' },
      { en: "It's on your right.", ja: '右側にありますよ。' },
      { en: 'You can see it.', ja: '見えますよ。' },
    ],
  },
  freetalk: {
    emoji: '👋', title: 'フリートーク', desc: 'すきなことについて自由に話そう！',
    role: 'You are Jordan, a friendly 10-year-old talking with the user.',
    goal: 'Have a friendly chat. After several good exchanges, you may wrap up the conversation nicely.',
    goalLabel: '🎯 ミッション：すきなことを英語で話してみよう！',
    greeting: { en: 'Hi! I am Jordan. Nice to meet you!', ja: 'やあ！ジョーダンだよ。よろしく！' },
    suggestions: [
      { en: 'I like soccer.', ja: 'サッカーが好きです。' },
      { en: 'What sport do you like?', ja: 'どんなスポーツが好き？' },
      { en: 'My favorite food is pizza.', ja: '好きな食べ物はピザです。' },
      { en: 'I have a dog.', ja: '犬を飼っています。' },
      { en: 'How are you?', ja: '元気ですか？' },
    ],
  },
  // World Bento「お店屋さん」：役割を反転。AI＝お客さん／児童＝店員（店員の所作を練習）。
  bentoShop: {
    emoji: '🍱', title: 'World Bento お店屋さん', desc: 'あなたが店員さん！ AIのお客さんの注文をうけよう。',
    role: 'You are a friendly, hungry CUSTOMER visiting a "World Bento" food shop run by young elementary-school students. The students are the SHOP STAFF; you are the CUSTOMER. Speak ONLY in simple, slow English (no Japanese). Keep every sentence short. Stay in character as the customer the whole time. Do NOT act as the staff and do NOT list the menu yourself — you do not know the menu until the staff tells you.',
    goal: BENTO_SHOP_SIMPLE_GOAL,
    goalLabel: BENTO_SHOP_SIMPLE_LABEL,
    greeting: { en: "Hi! I'm so hungry. What do you have?", ja: 'こんにちは！おなかぺこぺこ。何がありますか？' },
    suggestions: [
      { en: 'We have curry and rice.', ja: 'カレーとごはんがあります。' },
      { en: "It's 300 yen.", ja: '300円です。' },
      { en: 'Anything else?', ja: 'ほかにはいかがですか？' },
      { en: "That's 500 yen in total.", ja: '合計で500円です。' },
      { en: 'Here you are. Thank you!', ja: 'はい、どうぞ。ありがとう！' },
    ],
  },
};

// 出力フォーマット。英文の本数は申告した英検レベルで変わる（上ほど長く自然に話す）。
const formatInstruction = (sentences: string) =>
  `OUTPUT FORMAT: Reply with ${sentences}. Then a new line starting with "JA:" and the natural Japanese translation. ` +
  'Nothing else. When the GOAL has been reached, add the token [CLEAR] at the very end (after the JA line). ' +
  'If the GOAL text defines a BONUS and the user has just earned it, add the token [BONUS] at the very end instead.';

const REDIRECT_MESSAGE = "Let's keep it kind! 😊 そういう言葉はお返事できないよ。すきな食べ物やスポーツを英語で話してみよう！";

// AIの返答から英語・日本語訳・クリア判定を取り出す
const parseReply = (raw: string): { en: string; ja: string; cleared: boolean; bonus: boolean } => {
  const cleared = /\[CLEAR\]/i.test(raw);
  const bonus = /\[BONUS\]/i.test(raw);
  let t = raw.replace(/\[CLEAR\]|\[BONUS\]/gi, '').trim();
  const parts = t.split(/\n?\s*JA[:：]/i);
  const en = (parts[0] || '').trim();
  const ja = parts.length > 1 ? parts.slice(1).join(' ').trim() : '';
  return { en, ja, cleared, bonus };
};

export const AIAssistant: React.FC = () => {
  const goBack = useSafeBack();
  const { freetalkGoals } = useAppSettings();
  const studentName = localStorage.getItem('studentName') || 'ゲスト';
  const { speak } = useSpeechSynthesis();
  const { transcript, isRecording, startListening, stopListening, setTranscript } = useSpeechRecognition();
  const { totalPoints, addPoints } = usePoints();
  const studentId = localStorage.getItem('studentId');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<keyof typeof SCENARIOS | null>(null);
  // Geminiに毎回送る会話の文脈（システム指示＋これまでのやりとり）。nullの間は会話未開始。
  const [chat, setChat] = useState<{ system: string; history: GeminiContent[]; maxOutputTokens: number } | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showTranslation, setShowTranslation] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [situationInput, setSituationInput] = useState('');
  const [pendingFreetalk, setPendingFreetalk] = useState(true);
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  // 「この会話を記録する」用（記録はオプトイン。班名を入れるとチームの記録になる）
  const [showRecord, setShowRecord] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [recordMsg, setRecordMsg] = useState('');

  // 上級モード（P1-3）：高習熟層向け。文で話す・追加質問・日本語NGを厳格化
  const [isAdvanced, setIsAdvanced] = useState(false);

  // 申告した英検レベル（AIの英語の難しさとクリア条件の土台になる）
  const [eiken, setEiken] = useState<string>(() => loadEiken(studentId));
  const chooseEiken = (id: string) => { setEiken(id); saveEiken(studentId, id); };

  // チームモード（4人1組などで、ターンごとに話す人を選んでリレー）
  const [isTeam, setIsTeam] = useState(false);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<{ id: string; name: string } | null>(null);
  const [lastSpeakerId, setLastSpeakerId] = useState<string | null>(null);
  const toggleMember = (m: { id: string; name: string }) =>
    setTeamMembers(prev => prev.some(x => x.id === m.id) ? prev.filter(x => x.id !== m.id) : [...prev, m]);

  // 先生がダッシュボードで編集したUnitゴールがあれば上書きする
  const activeUnitIdRef = useRef<string | null>(null);
  const withGoalOverride = (opts: InitOpts, unitId: string): InitOpts => {
    activeUnitIdRef.current = unitId;
    const ov = freetalkGoals?.[unitId];
    if (!ov) return opts;
    return {
      ...opts,
      goal: ov.goal || opts.goal,
      goalLabel: ov.missionJa ? `🎯 ミッション：${ov.missionJa}` : opts.goalLabel,
      // 場面を変えたとき、AIの第一声がゴールと食い違わないように第一声も差し替えられる
      greeting: ov.greetingEn ? { en: ov.greetingEn, ja: ov.greetingJa || '' } : opts.greeting,
      // 前の場面の会話が残っていると、画面は古い第一声のまま、AIは新しい第一声の続きとして話し始めてしまう
      histSuffix: ov.greetingEn ? `${opts.histSuffix || 'default'}_${shortHash(ov.greetingEn)}` : opts.histSuffix,
      // ヘルプの例文もUnitごとに差し替えられる（既定はダイアログの文＝役が逆になることがある）
      suggestions: ov.hints?.length ? ov.hints : opts.suggestions,
    };
  };

  // 今の会話を記録する（班名があればチーム記録＝チーム[CLEAR]の証跡になる）
  const handleRecord = async () => {
    const log = {
      id: `log_${Date.now()}`,
      ts: Date.now(),
      studentId,
      studentName,
      unitId: activeOptsRef.current?.histSuffix || mode || 'freetalk',
      unitTitle: (activeScenario || (mode ? SCENARIOS[mode] : null))?.title || 'AI英会話',
      team: teamName.trim(),
      cleared,
      lines: messages.map(m => ({ role: m.role, text: m.text, ...(m.speakerName ? { speaker: m.speakerName } : {}) })),
    };
    const { error } = await saveConversationLog(log);
    setRecordMsg(error ? '記録できなかった…通信を確認してね' : (teamName.trim() ? `班「${teamName.trim()}」の会話を記録したよ！` : '会話を記録したよ！'));
    if (!error) { setShowRecord(false); setTeamName(''); }
    setTimeout(() => setRecordMsg(''), 4000);
  };
  const awardedRef = useRef(false);
  const bonusAwardedRef = useRef(false);
  const [bonusMsg, setBonusMsg] = useState(false);
  const activeOptsRef = useRef<InitOpts | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initChat = async (selectedMode: keyof typeof SCENARIOS, opts?: InitOpts) => {
    // 基本シナリオに、Unit別フリートーク等の上書きを適用した「実シナリオ」を作る
    const base = SCENARIOS[selectedMode];
    const scenario: Scenario = {
      ...base,
      goal: opts?.goal || base.goal,
      goalLabel: opts?.goalLabel || base.goalLabel,
      greeting: opts?.greeting || base.greeting,
      suggestions: opts?.suggestions || base.suggestions,
      title: opts?.title || base.title,
    };
    setActiveScenario(scenario);
    activeOptsRef.current = opts;
    setMode(selectedMode);
    setPendingFreetalk(false);
    setCleared(false);
    awardedRef.current = false;
    bonusAwardedRef.current = false;
    setBonusMsg(false);
    setShowHelp(false);
    setCurrentSpeaker(null);
    setLastSpeakerId(null);

    // レベルごとに会話を分ける（3級で話した続きを5級で読むと、難易度がちぐはぐになるため）
    const histKey = `ai_hist_${studentId}_${selectedMode}_${opts?.histSuffix || 'default'}_${eiken}`;
    const savedHist = localStorage.getItem(histKey);
    let pastMessages: ChatMessage[] = [];
    if (savedHist) {
      try { pastMessages = JSON.parse(savedHist); } catch (e) {}
    }
    setMessages(pastMessages);

    try {
      const situationLine = opts?.situation && opts.situation.trim()
        ? `The user set this situation (in Japanese): 「${opts.situation.trim()}」. Play along with this situation.`
        : '';

      // 申告された英検レベルで、AIの英語の難しさとクリア条件を変える
      const lv = findEiken(eiken);
      const systemText = [
        scenario.role,
        situationLine,
        `GOAL: ${scenario.goal}${lv.goalSuffix}`,
        lv.spec,
        'Always reply in English only (never Japanese in the English line).',
        SAFETY_INSTRUCTION,
        formatInstruction(lv.sentences),
      ].filter(Boolean).join('\n');

      const greetSeed = `${scenario.greeting.en}\nJA: ${scenario.greeting.ja}`;
      let historyForGemini: GeminiContent[];
      if (pastMessages.length === 0) {
        historyForGemini = [
          { role: 'user', parts: [{ text: `[SYSTEM]\n${systemText}` }] },
          { role: 'model', parts: [{ text: greetSeed }] },
        ];
      } else {
        historyForGemini = [
          { role: 'user', parts: [{ text: `[SYSTEM]\n${systemText}` }] },
          { role: 'model', parts: [{ text: greetSeed }] },
          ...pastMessages.slice(1).map(m => ({ role: m.role, parts: [{ text: m.text }] })),
        ];
      }

      setChat({
        system: systemText,
        history: historyForGemini,
        maxOutputTokens: lv.multiplier >= 1.4 ? 300 : lv.multiplier >= 1.25 ? 220 : 140,
      });

      if (pastMessages.length === 0) {
        const initialMsg: ChatMessage = { role: 'model', text: scenario.greeting.en, ja: scenario.greeting.ja };
        setMessages([initialMsg]);
        localStorage.setItem(histKey, JSON.stringify([initialMsg]));
        speak(scenario.greeting.en);
      }
    } catch (err: any) {
      console.error('AI Init Error:', err);
      console.error('AI init failed', err);
      setMessages([{ role: 'model', text: friendlyAiError(err) }]);
      setIsAiThinking(false);
    }
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || !chat) return;
    if (isTeam && !currentSpeaker) { alert('だれが話すか、チームで選んでね！'); return; }

    if (isInappropriate(text)) {
      setMessages(prev => [...prev, { role: 'model', text: REDIRECT_MESSAGE }]);
      setTranscript(''); setInputText('');
      speak("Let's keep it kind!");
      return;
    }

    // トーク中は日本語NG。日本語が含まれていたら送らず（ポイントも消費せず）英語をうながす。
    if (/[぀-ヿ㐀-鿿]/.test(text)) {
      setMessages(prev => [...prev, { role: 'model', text: 'English, please! 英語で話してみよう。困ったら 💡ヘルプ を見てね。' }]);
      setShowHelp(true);
      speak('In English, please!');
      return;
    }

    // 1日のAI会話の上限に達していたら、Gemini を呼ばずに止める（課金の安全装置）。
    if (isOverCap('gemini')) {
      setMessages(prev => [...prev, { role: 'model', text: '今日はここまで！🌙 AIとのおしゃべりは1日の上限に達したよ。また明日ね！' }]);
      return;
    }

    // ポイント消費は廃止（2026-07 1学期ふりかえり反映）。
    // 「AI会話だけ損」で子どもが会話練習を避けていたため。APIコストは1日上限（先生設定）で制御する。

    const newMessages: ChatMessage[] = [...messages, { role: 'user', text, ...(isTeam && currentSpeaker ? { speakerName: currentSpeaker.name } : {}) }];
    setMessages(newMessages);
    setTranscript(''); setInputText(''); setShowHelp(false); setIsAiThinking(true);
    // チーム：話したら次は別の人がえらべるよう、直前の話者を記録して選択をリセット
    if (isTeam && currentSpeaker) { setLastSpeakerId(currentSpeaker.id); setCurrentSpeaker(null); }

    const histKey = `ai_hist_${studentId}_${mode}_${activeOptsRef.current?.histSuffix || 'default'}_${eiken}`;
    // 先生が判定ルール（正規表現）を設定したUnitは、AIの[CLEAR]を待たず子どもの発言で判定する。
    // 軽量モデルが「2ブロック進んで右」のような一文の中の2条件を取りこぼすことがあるため。
    const rules = activeUnitIdRef.current ? freetalkGoals?.[activeUnitIdRef.current] : undefined;
    const saidSoFar = newMessages.filter(m => m.role === 'user').map(m => m.text).join(' ').toLowerCase();
    const safeTest = (re: string, s: string) => { try { return new RegExp(re, 'i').test(s); } catch { return false; } };
    if (rules?.clearAll?.length && !awardedRef.current && rules.clearAll.every(re => safeTest(re, saidSoFar))) {
      awardedRef.current = true;
      setCleared(true);
      addPoints(`ai_clear_${mode}`, { multiplier: findEiken(eiken).multiplier })
        .then(() => { if (activeUnitIdRef.current) markUnitClear(`ai_unit_clear_${activeUnitIdRef.current}`); });
    } else if (rules?.bonusAny?.length && awardedRef.current && !bonusAwardedRef.current && rules.bonusAny.some(re => safeTest(re, text.toLowerCase()))) {
      bonusAwardedRef.current = true;
      setBonusMsg(true);
      addPoints(`ai_bonus_${mode}`, { multiplier: findEiken(eiken).multiplier * 0.5 })
        .then(() => { if (activeUnitIdRef.current) markUnitClear(`ai_unit_bonus_${activeUnitIdRef.current}`); });
    }
    try {
      incUsage('gemini'); // Geminiを実際に呼ぶので1回ぶん計上する
      const userTurn: GeminiContent = { role: 'user', parts: [{ text }] };
      const raw = await generateWithGemini({
        system: chat.system,
        contents: [...chat.history, userTurn],
        maxOutputTokens: chat.maxOutputTokens,
        temperature: 0.7,
      });
      setChat({ ...chat, history: [...chat.history, userTurn, { role: 'model', parts: [{ text: raw }] }] });
      const { en, ja, cleared: didClear, bonus: didBonus } = parseReply(raw);
      const safeEn = isInappropriate(en) ? REDIRECT_MESSAGE : en;

      const updated: ChatMessage[] = [...newMessages, { role: 'model', text: safeEn, ja }];
      setMessages(updated);
      const savable = updated.filter(m => m.text !== "Oops, I didn't catch that. Can you say it again?");
      localStorage.setItem(histKey, JSON.stringify(savable));
      speak(safeEn);

      // ルール判定があるUnitでは、AIのトークンでは加点しない（軽量モデルの誤発火を防ぐ）
      if (didClear && !awardedRef.current && !rules?.clearAll?.length) {
        awardedRef.current = true;
        setCleared(true);
        // きびしい条件をクリアした分だけ上乗せ（レベルを盛ってもラクにはならないので自己申告でよい）
        addPoints(`ai_clear_${mode}`, { multiplier: findEiken(eiken).multiplier })
        .then(() => { if (activeUnitIdRef.current) markUnitClear(`ai_unit_clear_${activeUnitIdRef.current}`); });
      }
      if (didBonus && awardedRef.current && !bonusAwardedRef.current && !rules?.bonusAny?.length) {
        bonusAwardedRef.current = true;
        setBonusMsg(true);
        addPoints(`ai_bonus_${mode}`, { multiplier: findEiken(eiken).multiplier * 0.5 })
        .then(() => { if (activeUnitIdRef.current) markUnitClear(`ai_unit_bonus_${activeUnitIdRef.current}`); });
      }
    } catch (err: any) {
      console.error('AI Send Error:', err);
      console.error('AI send failed', err);
      setMessages([...newMessages, { role: 'model', text: friendlyAiError(err) }]);
    } finally {
      setIsAiThinking(false);
    }
  };

  useEffect(() => {
    if (isRecording && transcript) setInputText(transcript);
  }, [transcript, isRecording]);

  const onMicClick = () => {
    if (isTeam && !currentSpeaker) { alert('先に「話す人」を選んでね！'); return; }
    if (isRecording) { stopListening(); }
    else { setTranscript(''); setInputText(''); startListening(); }
  };

  // 上級モードでgoalに追記する指示（AIをきびしめに）
  const ADVANCED_SUFFIX =
    ' ADVANCED MODE: Be stricter. Require complete English sentences (not single words).' +
    ' Before granting the goal, ask ONE extra follow-up question and wait for a good answer.' +
    ' If the user writes Japanese, kindly ask them to say it in English. You may use slightly longer sentences yourself.';

  // 会話を開始（チーム時はメンバー2人以上が必要。上級ONならgoalをきびしく）
  const startFreetalk = (opts: InitOpts) => {
    if (isTeam && teamMembers.length < 2) { alert('チームは2人以上選んでね！'); return; }
    const o = isAdvanced
      ? {
          ...opts,
          goal: (opts.goal || SCENARIOS.freetalk.goal) + ADVANCED_SUFFIX,
          goalLabel: `${opts.goalLabel || SCENARIOS.freetalk.goalLabel}（🔥上級）`,
          histSuffix: `${opts.histSuffix || 'default'}_adv`,
        }
      : opts;
    initChat('freetalk', o);
  };

  // お店屋さんモード開始（AI＝客／児童＝店員）。シンプル／チャレンジで goal を差し替える。
  const startShop = (variant: 'simple' | 'challenge') => {
    activeUnitIdRef.current = null; // Unit の記録・判定ルールを持ち越さない
    if (isTeam && teamMembers.length < 2) { alert('チームは2人以上選んでね！'); return; }
    if (variant === 'challenge') {
      initChat('bentoShop', {
        goal: BENTO_SHOP_CHALLENGE_GOAL,
        goalLabel: BENTO_SHOP_CHALLENGE_LABEL,
        title: 'お店屋さん（チャレンジ）',
        histSuffix: 'challenge',
      });
    } else {
      initChat('bentoShop', { histSuffix: 'simple' });
    }
  };

  // URLパラメータ（?unit=g5-u1）で特定Unitのフリートークを直接ひらく（今日のミッション用）。
  // APIキーの読み込みを待ってから一度だけ自動開始する（キー未取得だとinitChatが空振りするため）。
  const [searchParams] = useSearchParams();
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current) return;
    // ?shop=simple / ?shop=challenge でお店屋さんモードを直接ひらく（今日のミッション用）
    const shop = searchParams.get('shop');
    if (shop === 'simple' || shop === 'challenge') {
      autoStartedRef.current = true;
      startShop(shop);
      return;
    }
    // ?unit=g5-u1 で特定Unitのフリートークを直接ひらく
    const unitId = searchParams.get('unit');
    if (!unitId) return;
    const u = FREETALK_UNITS.find(x => x.id === unitId);
    if (!u) return;
    autoStartedRef.current = true;
    initChat('freetalk', withGoalOverride(buildUnitOpts(u), u.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);


  // 状況設定（フリートーク）
  if (pendingFreetalk) {
    return (
      <div className="flex-col gap-lg" style={{ flex: 1, maxWidth: '600px', margin: '0 auto', width: '100%', paddingBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Button variant="outline" onClick={goBack} icon={ArrowLeft}>もどる</Button>
          <h2 className="text-primary" style={{ flex: 1, textAlign: 'center', margin: 0, marginRight: '80px' }}>🤖 AIと英語で話そう！</h2>
        </div>

        {/* チームでやる（メンバーを選んでリレー会話） */}
        <div className="glass-card flex-col gap-md" style={{ padding: '1.2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0 }}>👥 チームでやる</h3>
            <Button variant={isTeam ? 'primary' : 'outline'} onClick={() => { setIsTeam(t => !t); }} style={{ fontSize: '0.9rem', padding: '0.4rem 1rem' }}>
              {isTeam ? 'ON（チーム）' : 'OFF（ひとり）'}
            </Button>
          </div>
          {isTeam && (
            <>
              <p style={{ color: '#666', margin: 0, fontSize: '0.85rem' }}>チーム名を入れて、メンバーを2人以上選んでね。話す番をリレーで回すよ。</p>
              <input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="チーム名（れい：A班）"
                style={{ padding: '0.5rem', fontSize: '1rem', borderRadius: '8px', border: '2px solid #e2e8f0', boxSizing: 'border-box' }} />
              <div style={{ fontSize: '0.85rem', color: '#475569' }}>えらんだ人：{teamMembers.length}人 {teamMembers.map(m => m.name).join('・')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '160px', overflowY: 'auto' }}>
                {STUDENTS.map((s: any) => {
                  const on = teamMembers.some(m => m.id === s.id);
                  return (
                    <button key={s.id} onClick={() => toggleMember({ id: s.id, name: s.name })}
                      style={{ padding: '0.35rem 0.7rem', borderRadius: '999px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold',
                        border: `2px solid ${on ? 'var(--color-primary)' : '#cbd5e1'}`, background: on ? 'var(--color-primary)' : 'white', color: on ? 'white' : '#475569' }}>
                      {on ? '✓ ' : ''}{s.name}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* 英検レベルの申告（AIの英語の難しさとクリア条件が変わる） */}
        <div className="glass-card flex-col gap-md" style={{ padding: '1.2rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>🎖 英検レベル</h3>
            <p style={{ color: '#666', margin: '0.2rem 0 0 0', fontSize: '0.85rem' }}>
              いまの自分に近いものを選んでね。上のレベルほど<b>AIの英語が難しくなり、クリアの条件も増える</b>よ。
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {EIKEN_LEVELS.map(l => {
              const on = l.id === eiken;
              return (
                <button key={l.id} onClick={() => chooseEiken(l.id)}
                  style={{ padding: '0.45rem 0.9rem', borderRadius: '999px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold',
                    border: `2px solid ${l.color}`, background: on ? l.color : 'white', color: on ? 'white' : l.color }}>
                  {on ? '✓ ' : ''}{l.label}
                </button>
              );
            })}
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>{findEiken(eiken).hintJa}</p>
          {findEiken(eiken).multiplier > 1 && (
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#b45309', fontWeight: 'bold' }}>
              クリアすると ポイント ×{findEiken(eiken).multiplier}（条件がきびしいぶん多くもらえる）
            </p>
          )}
        </div>

        {/* 上級モード（高習熟層向け。AIがきびしめになる） */}
        <div className="glass-card" style={{ padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>🔥 上級モード</h3>
            <p style={{ color: '#666', margin: '0.2rem 0 0 0', fontSize: '0.85rem' }}>文で話す・追加の質問あり・日本語NG。物足りない人向け！</p>
          </div>
          <Button variant={isAdvanced ? 'primary' : 'outline'} onClick={() => setIsAdvanced(a => !a)} style={{ fontSize: '0.9rem', padding: '0.4rem 1rem' }}>
            {isAdvanced ? 'ON（上級）' : 'OFF（ふつう）'}
          </Button>
        </div>

        {/* World Bento お店屋さん（AI＝お客さん／児童＝店員）。
            アーカイブ中は出さない → もどすときは archivedUnits.ts の 'worldbento' を消すだけ */}
        {!isArchived('worldbento') && (<>
        <div className="glass-card flex-col gap-md" style={{ padding: '1.5rem', border: '2px solid #f59e0b', background: 'rgba(245, 158, 11, 0.08)' }}>
          <h3 style={{ margin: 0, color: '#b45309' }}>🍱 World Bento お店屋さん（店員の練習）</h3>
          <p style={{ color: '#7a5a00', margin: 0, fontSize: '0.9rem' }}>
            <b>あなたが店員さん！</b> AIがお客さんになって注文しに来るよ。メニューを伝えて、値段と合計を言おう。
          </p>
          <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
            <button className="hover-scale" onClick={() => startShop('simple')}
              style={{ flex: 1, minWidth: '140px', padding: '0.9rem', borderRadius: '12px', border: '2px solid #f59e0b', background: '#f59e0b', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>
              🟢 シンプル<br /><span style={{ fontSize: '0.8rem', fontWeight: 'normal' }}>注文→値段→合計</span>
            </button>
            <button className="hover-scale" onClick={() => startShop('challenge')}
              style={{ flex: 1, minWidth: '140px', padding: '0.9rem', borderRadius: '12px', border: '2px solid #b45309', background: 'white', color: '#b45309', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>
              🔥 チャレンジ<br /><span style={{ fontSize: '0.8rem', fontWeight: 'normal' }}>料理の質問もくるよ</span>
            </button>
          </div>
        </div>
        </>)}

        {/* 教科書のUnitから場面を選ぶ */}
        <div className="glass-card flex-col gap-md" style={{ padding: '1.5rem' }}>
          <h3 style={{ margin: 0 }}>📖 教科書のUnitから場面を選ぶ</h3>
          <p style={{ color: '#666', margin: 0, fontSize: '0.9rem' }}>そのUnitの表現を使って、AIと会話の練習ができるよ。</p>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.6rem' }}>
            {FREETALK_UNITS.filter(u => !isArchived(u.id)).map(u => (
              <button key={u.id} className="hover-scale"
                onClick={() => startFreetalk(withGoalOverride(buildUnitOpts(u), u.id))}
                style={{ padding: '0.7rem', borderRadius: '10px', border: '2px solid var(--color-primary)', background: 'white', color: 'var(--color-primary)', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem', textAlign: 'center' }}>
                {u.label}
              </button>
            ))}
          </div>
        </div>

        {/* 自由に場面を決める */}
        <div className="glass-card flex-col gap-md" style={{ padding: '1.5rem' }}>
          <h3 style={{ margin: 0 }}>✏️ 自由に場面を決める（日本語OK・なくてもOK）</h3>
          <textarea
            value={situationInput}
            onChange={e => setSituationInput(e.target.value)}
            placeholder="（れい）休み時間に、すきなスポーツの話をする"
            style={{ width: '100%', minHeight: '70px', padding: '1rem', fontSize: '1.1rem', borderRadius: '12px', border: '2px solid #e2e8f0', boxSizing: 'border-box' }}
          />
          <Button size="lg" onClick={() => { activeUnitIdRef.current = null; startFreetalk({ situation: situationInput }); }} icon={Sparkles} style={{ background: 'var(--color-accent)', color: 'black' }}>
            この場面で始める！
          </Button>
          <Button variant="outline" onClick={() => { activeUnitIdRef.current = null; startFreetalk({}); }}>場面なしで始める</Button>
        </div>
      </div>
    );
  }

  // mode未選択のときは必ず上の「場面えらび」画面を表示しているので、ここは型ガード兼フォールバック
  if (!mode) {
    return null;
  }

  const scenario = activeScenario || SCENARIOS[mode];
  // AIが「さよなら」を言ったら会話はおしまい。入力欄をしまって、クリアの条件か次の一手を出す。
  // （子どもの声 2026-10-11「終わることがない会話…一生 Goodbye! しか言ってない」）
  const lastModel = [...messages].reverse().find(m => m.role === 'model');
  const ended = messages.some(m => m.role === 'user') && !isAiThinking && !!lastModel && /\b(good ?bye|bye|see you)\b/i.test(lastModel.text);
  const restartChat = () => {
    if (!mode) return;
    localStorage.removeItem(`ai_hist_${studentId}_${mode}_${activeOptsRef.current?.histSuffix || 'default'}_${eiken}`);
    initChat(mode, activeOptsRef.current);
  };

  return (
    <div className="flex-col" style={{ height: '100%', maxHeight: 'calc(100vh - 120px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Button variant="outline" onClick={() => { setMode(null); setMessages([]); setPendingFreetalk(true); }} icon={ArrowLeft}>もどる</Button>
        <h2 className="text-primary" style={{ flex: 1, textAlign: 'center', margin: 0, fontSize: '1.3rem' }}>{scenario.emoji} {scenario.title}</h2>
        <Button variant="outline" onClick={() => setShowTranslation(t => !t)} style={{ fontSize: '0.85rem', padding: '0.4rem 0.7rem' }} icon={Languages}>
          {showTranslation ? '訳オフ' : '訳オン'}
        </Button>
        <Button variant="outline" onClick={() => { if (window.confirm('会話をリセットして最初からやり直しますか？')) { localStorage.removeItem(`ai_hist_${studentId}_${mode}_${activeOptsRef.current?.histSuffix || 'default'}_${eiken}`); initChat(mode, activeOptsRef.current); } }} style={{ fontSize: '0.8rem', padding: '0.4rem' }}>リセット</Button>
        <Button variant="outline" onClick={() => setShowRecord(s => !s)} style={{ fontSize: '0.8rem', padding: '0.4rem' }} disabled={messages.length === 0}>📝 記録</Button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--color-primary)', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.9rem' }}>
          <Coins size={18} color="#FFD700" />{totalPoints} P
        </div>
      </div>

      {/* 会話を記録（オプトイン。班名を入れるとチームの記録＝チーム[CLEAR]の証跡に） */}
      {showRecord && (
        <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '12px', padding: '0.7rem 1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: '#4338ca', fontWeight: 'bold' }}>この会話をスタッフに記録：</span>
          <input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="班名（個人なら空でOK）"
            style={{ padding: '0.4rem 0.6rem', borderRadius: '8px', border: '2px solid #c7d2fe', fontSize: '0.9rem' }} />
          <Button onClick={handleRecord} style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>{cleared ? '✅ クリアを記録' : '記録する'}</Button>
          <Button variant="outline" onClick={() => setShowRecord(false)} style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>やめる</Button>
        </div>
      )}
      {recordMsg && <div style={{ color: recordMsg.includes('記録した') ? 'var(--color-success)' : 'var(--color-error)', fontWeight: 'bold', textAlign: 'center', marginBottom: '0.5rem' }}>{recordMsg}</div>}

      {/* ゴール表示 */}
      <div style={{ background: 'rgba(253, 203, 110, 0.25)', border: '1px solid var(--color-accent)', borderRadius: '12px', padding: '0.5rem 1rem', marginBottom: '0.5rem', fontWeight: 'bold', color: '#7a5a00', textAlign: 'center', fontSize: '0.95rem' }}>
        {scenario.goalLabel}
      </div>

      {/* チームの順番ボード */}
      {isTeam && (
        <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '12px', padding: '0.6rem 0.9rem', marginBottom: '0.5rem' }}>
          {!currentSpeaker ? (
            <>
              <div style={{ fontSize: '0.9rem', color: '#4338ca', fontWeight: 'bold', marginBottom: '0.4rem' }}>📣 作戦タイム：「なんて言う？」を相談しよう（日本語OK）→ 話す人を選ぶ👇</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {teamMembers.map(m => {
                  const isLast = m.id === lastSpeakerId;
                  return (
                    <button key={m.id} disabled={isLast} onClick={() => setCurrentSpeaker(m)}
                      style={{ padding: '0.4rem 0.8rem', borderRadius: '999px', fontWeight: 'bold', fontSize: '0.9rem',
                        cursor: isLast ? 'not-allowed' : 'pointer', border: '2px solid var(--color-primary)',
                        background: isLast ? '#e2e8f0' : 'white', color: isLast ? '#94a3b8' : 'var(--color-primary)' }}>
                      {m.name}{isLast ? '（直前）' : ''}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#4338ca' }}>🎤 いま話す人：{currentSpeaker.name} さん</span>
              <span style={{ fontSize: '0.85rem', color: '#6366f1' }}>マイクで話して、文を確認してから送ってね</span>
              <Button variant="outline" onClick={() => setCurrentSpeaker(null)} style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', marginLeft: 'auto' }}>選び直す</Button>
            </div>
          )}
        </div>
      )}

      {cleared && (
        <div className="animate-pop" style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '2px solid var(--color-success)', borderRadius: '12px', padding: '0.8rem', marginBottom: '0.5rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <Trophy color="var(--color-accent)" />
          <span style={{ fontWeight: 'bold', color: 'var(--color-success)', fontSize: '1.2rem' }}>ミッションクリア！🎉 よくがんばったね！</span>
        </div>
      )}
      {bonusMsg && (
        <div className="animate-pop" style={{ background: 'linear-gradient(135deg, #fefce8, #fef9c3)', border: '2px solid var(--color-accent)', borderRadius: '12px', padding: '0.6rem', marginBottom: '0.5rem', textAlign: 'center' }}>
          <span style={{ fontWeight: 'bold', color: '#a16207', fontSize: '1.1rem' }}>⭐ ボーナス！ おすすめまで言えた！</span>
        </div>
      )}

      {/* Chat Area */}
      <div className="glass-card flex-col" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', gap: '1.2rem', marginBottom: '0.5rem', background: '#f8f9fa' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: '0.5rem' }}>
            {msg.role === 'model' && (
              <div style={{ fontSize: '2rem', background: '#fff', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)', flexShrink: 0 }}>🤖</div>
            )}
            <div className="animate-pop" style={{ maxWidth: '72%' }}>
              {msg.speakerName && (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 'bold', textAlign: 'right', marginBottom: '0.2rem', paddingRight: '0.3rem' }}>🎤 {msg.speakerName}</div>
              )}
              <div
                onClick={() => msg.role === 'model' && speak(msg.text)}
                style={{ padding: '0.9rem 1.3rem', borderRadius: '20px', borderBottomLeftRadius: msg.role === 'model' ? '0' : '20px', borderBottomRightRadius: msg.role === 'user' ? '0' : '20px', background: msg.role === 'user' ? 'var(--color-primary)' : 'white', color: msg.role === 'user' ? 'white' : 'var(--color-text-main)', fontSize: '1.4rem', fontFamily: 'var(--font-heading)', boxShadow: 'var(--shadow-sm)', cursor: msg.role === 'model' ? 'pointer' : 'default' }}
              >
                {msg.text}
              </div>
              {showTranslation && msg.role === 'model' && msg.ja && (
                <div style={{ fontSize: '0.95rem', color: '#777', marginTop: '0.3rem', paddingLeft: '0.3rem' }}>🇯🇵 {msg.ja}</div>
              )}
            </div>
          </div>
        ))}
        {isAiThinking && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ fontSize: '2rem' }}>🤖</div>
            <div className="glass-card" style={{ padding: '0.8rem', display: 'flex', gap: '0.5rem' }}>
              <Sparkles className="animate-float" color="var(--color-accent)" /><span style={{ color: '#666' }}>考え中…</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ヘルプパネル */}
      {showHelp && (
        <div className="glass-card animate-pop" style={{ padding: '1rem', marginBottom: '0.5rem', background: 'rgba(72, 219, 251, 0.12)', border: '2px solid var(--color-primary)' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--color-primary)' }}>💡 こんなふうに言ってみよう！（タップで入力）</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {scenario.suggestions.map((s, i) => (
              <button key={i} onClick={() => { setInputText(s.en); setShowHelp(false); }}
                style={{ textAlign: 'left', padding: '0.6rem 0.9rem', borderRadius: '10px', border: '1px solid #cde', background: 'white', cursor: 'pointer' }}>
                <span style={{ fontWeight: 'bold', fontSize: '1.05rem' }}>{s.en}</span>
                <span style={{ color: '#888', fontSize: '0.85rem', marginLeft: '0.5rem' }}>{s.ja}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {ended && (
        <div className="glass-card animate-pop" style={{ padding: '1rem', textAlign: 'center', border: `2px solid ${cleared ? 'var(--color-success)' : 'var(--color-accent)'}` }}>
          <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.4rem' }}>👋 会話は ここで おしまい！</div>
          {!cleared && (
            <div style={{ color: '#7a5a00', marginBottom: '0.6rem' }}>まだクリアになっていないよ。ミッションを たしかめて、もう一度 やってみよう：<br /><b>{scenario.goalLabel}</b></div>
          )}
          <Button onClick={restartChat} icon={RefreshCw}>{cleared ? 'もう一度 話す' : 'もう一度 はじめから'}</Button>
        </div>
      )}

      {/* Input Area */}
      {!ended && (
        <div className="glass-card" style={{ padding: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <MicButton isRecording={isRecording} onClick={onMicClick} />
            <Button variant="outline" onClick={() => setShowHelp(h => !h)} icon={HelpCircle} style={{ padding: '0.6rem 1rem' }}>ヘルプ</Button>
            <form onSubmit={(e) => { e.preventDefault(); handleSend(inputText); }} style={{ display: 'flex', flex: 1, gap: '0.5rem', minWidth: '220px' }}>
              <input type="text" value={inputText} onChange={e => setInputText(e.target.value)} placeholder="ここに入力 or マイク/ヘルプ"
                style={{ flex: 1, padding: '0.8rem 1rem', fontSize: '1.1rem', borderRadius: '20px', border: '1px solid #ccc' }} />
              <Button type="submit" disabled={isAiThinking || !inputText.trim() || (isTeam && !currentSpeaker)} style={{ borderRadius: '20px', padding: '0.8rem 1.2rem' }} icon={Send}>送る</Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
