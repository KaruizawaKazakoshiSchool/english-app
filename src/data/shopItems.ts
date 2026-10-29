// ごほうびショップのカタログ。学習の注意を奪わない低刺激なごほうび。
export interface ShopItem { id: string; emoji: string; name: string; desc: string; price: number; }

export const TITLES: ShopItem[] = [
  { id: 't-phonics', emoji: '🔤', name: 'フォニックスの旅人', desc: '音のぼうけんに出た証', price: 100 },
  { id: 't-talk', emoji: '🗣️', name: 'トーキング・スター', desc: '会話をがんばる人', price: 150 },
  { id: 't-bento', emoji: '🍱', name: 'ベントーマスター', desc: '世界の料理博士', price: 150 },
  { id: 't-word', emoji: '📚', name: 'たんごハンター', desc: '単語を集める人', price: 200 },
  { id: 't-mic', emoji: '🎤', name: '発音キング', desc: '発音チェックの達人', price: 300 },
  { id: 't-trophy', emoji: '🏆', name: 'レジェンド', desc: 'つよい。', price: 500 },
  { id: 't-star', emoji: '🌟', name: 'スーパースター', desc: 'かがやいている', price: 800 },
  { id: 't-dragon', emoji: '🐉', name: 'ドラゴンマスター', desc: '最高位のあかし', price: 1500 },
  // かわいい系（子どもの声 2026-09-16）。英語の称号にして、説明に意味を書く＝買うついでに1語覚える
  { id: 't-rainbow', emoji: '🌈', name: 'Rainbow Friend', desc: 'rainbow＝にじ。にじ色のなかま', price: 100 },
  { id: 't-clover', emoji: '🍀', name: 'Lucky Clover', desc: 'lucky＝運がいい。しあわせのクローバー', price: 100 },
  { id: 't-cloud', emoji: '☁️', name: 'Fluffy Cloud', desc: 'fluffy＝ふわふわ。ふわふわの雲', price: 150 },
  { id: 't-bunny', emoji: '🐰', name: 'Happy Bunny', desc: 'bunny＝うさちゃん。ごきげんうさぎ', price: 150 },
  { id: 't-moon', emoji: '🌙', name: 'Moon Dreamer', desc: 'dreamer＝夢を見る人。月の夢みる人', price: 200 },
  { id: 't-twinkle', emoji: '⭐', name: 'Twinkle Star', desc: 'twinkle＝きらきら光る。きらきら星', price: 200 },
  { id: 't-cookie', emoji: '🍪', name: 'Sweet Cookie', desc: 'sweet＝あまい。あまいクッキー', price: 200 },
  { id: 't-panda', emoji: '🐼', name: 'Sleepy Panda', desc: 'sleepy＝ねむい。ねむねむパンダ', price: 250 },
  { id: 't-heart', emoji: '🎀', name: 'Sweet Heart', desc: 'sweetheart＝大切な人', price: 250 },
  { id: 't-cat', emoji: '🐱', name: 'Little Kitty', desc: 'kitty＝子ねこ。ちいさな子ねこ', price: 300 },
  { id: 't-dog', emoji: '🐶', name: 'Lovely Puppy', desc: 'puppy＝子犬。かわいい子犬', price: 300 }, // 子どもの声 2026-10-07
  // 動物の称号（子どもの声 2026-10-16「称号に動物系の称号がほしい」）
  { id: 't-fox', emoji: '🦊', name: 'Clever Fox', desc: 'clever＝かしこい。かしこいキツネ', price: 300 },
  { id: 't-penguin', emoji: '🐧', name: 'Cool Penguin', desc: 'cool＝かっこいい。かっこいいペンギン', price: 300 },
  { id: 't-koala', emoji: '🐨', name: 'Cozy Koala', desc: 'cozy＝ぬくぬく。ぬくぬくコアラ', price: 300 },
  { id: 't-hamster', emoji: '🐹', name: 'Tiny Hamster', desc: 'tiny＝とても小さい。ちびハムスター', price: 300 },
  { id: 't-owl', emoji: '🦉', name: 'Wise Owl', desc: 'wise＝ものしり。ものしりフクロウ', price: 300 },
  { id: 't-lion', emoji: '🦁', name: 'Brave Lion', desc: 'brave＝ゆうかん。ゆうかんなライオン', price: 300 },
  { id: 't-bubble', emoji: '🫧', name: 'Soda Bubble', desc: 'bubble＝あわ。ラムネのしゅわしゅわ', price: 100 }, // 子どもの声 2026-10-23「ラムネの🫧を100Pくらいで」
];

// 今月限定の称号。その月のあいだだけ買える。買ったら月が変わっても持ったまま・つけられる。
// month は 1〜12。毎年くり返す（来年の同じ月にまた出る）。
export interface SeasonalTitle extends ShopItem { month: number; }
export const SEASONAL_TITLES: SeasonalTitle[] = [
  { month: 1, id: 's-01', emoji: '🎍', name: 'New Year Hero', desc: 'new year＝新年。お正月のヒーロー', price: 250 },
  { month: 2, id: 's-02', emoji: '⛄', name: 'Snow Buddy', desc: 'buddy＝なかま。雪だるまのなかま', price: 250 },
  { month: 3, id: 's-03', emoji: '🌸', name: 'Cherry Blossom', desc: 'cherry blossom＝さくらの花', price: 250 },
  { month: 4, id: 's-04', emoji: '🌷', name: 'Spring Sprout', desc: 'sprout＝芽。春の新しい芽', price: 250 },
  { month: 5, id: 's-05', emoji: '🎏', name: 'Carp Streamer', desc: 'carp streamer＝こいのぼり', price: 250 },
  { month: 6, id: 's-06', emoji: '☔', name: 'Rainy Frog', desc: 'rainy＝雨の。雨がすきなカエル', price: 250 },
  { month: 7, id: 's-07', emoji: '🎋', name: 'Wish Star', desc: 'wish＝ねがい。七夕のねがい星', price: 250 },
  { month: 8, id: 's-08', emoji: '🍉', name: 'Summer Splash', desc: 'splash＝パシャッ。夏の水しぶき', price: 250 },
  { month: 9, id: 's-09', emoji: '🎑', name: 'Moon Bunny', desc: 'moon＝月。お月見うさぎ', price: 250 },
  { month: 10, id: 's-10', emoji: '🎃', name: 'Pumpkin Ghost', desc: 'pumpkin＝かぼちゃ。ハロウィンのおばけ', price: 250 },
  { month: 11, id: 's-11', emoji: '🍁', name: 'Maple Leaf', desc: 'maple leaf＝もみじの葉', price: 250 },
  { month: 12, id: 's-12', emoji: '🎄', name: 'Snowy Santa', desc: 'snowy＝雪の。雪の日のサンタ', price: 250 },
];

// 名前のわく色（子どもの声 2026-09-22「共有のホーム画面の自分の名前の枠の色を変えたい」）。
// ログイン画面（名前をえらぶ画面）で、自分のタイルのふちの色が変わる。
export interface FrameItem extends ShopItem { color: string; }
export const FRAMES: FrameItem[] = [
  { id: 'fr-pink', emoji: '🩷', name: 'ピンクのわく', desc: '名前のふちが ピンクに', price: 200, color: '#ec4899' },
  { id: 'fr-gold', emoji: '💛', name: 'ゴールドのわく', desc: '名前のふちが 金色に', price: 300, color: '#f59e0b' },
  { id: 'fr-mint', emoji: '💚', name: 'ミントのわく', desc: '名前のふちが 黄緑に', price: 200, color: '#10b981' },
  { id: 'fr-sky', emoji: '💙', name: 'そらのわく', desc: '名前のふちが 水色に', price: 200, color: '#38bdf8' },
  { id: 'fr-purple', emoji: '💜', name: 'むらさきのわく', desc: '名前のふちが むらさきに', price: 200, color: '#8b5cf6' },
  { id: 'fr-rainbow', emoji: '🌈', name: 'にじのわく', desc: '名前のふちが にじ色に', price: 600, color: 'rainbow' },
];
export const findFrame = (id: string | null | undefined) => FRAMES.find(f => f.id === id) || null;

// 今月限定の着せ替え（2026-10〜）。称号と同じく、その月だけ買えて、買ったものはずっと使える。
export const SEASONAL_THEMES: SeasonalTitle[] = [
  { month: 10, id: 'th-halloween', emoji: '🎃', name: 'ハロウィンテーマ', desc: 'オレンジとむらさきの、ちょっとこわい夜', price: 400 },
];
export const seasonalThemesThisMonth = () => SEASONAL_THEMES.filter(t => t.month === currentMonth());

export const currentMonth = () => new Date().getMonth() + 1;
export const seasonalThisMonth = () => SEASONAL_TITLES.filter(t => t.month === currentMonth());

export const THEMES: ShopItem[] = [
  { id: 'th-sakura', emoji: '🌸', name: 'さくらテーマ', desc: 'ピンクの画面', price: 250 },
  { id: 'th-umi', emoji: '🌊', name: 'うみテーマ', desc: '青い画面', price: 250 },
  { id: 'th-mori', emoji: '🌲', name: 'もりテーマ', desc: '緑の画面', price: 250 },
  { id: 'th-yozora', emoji: '🌌', name: 'よぞらテーマ', desc: '夜空のダーク画面', price: 400 },
  { id: 'th-gold', emoji: '👑', name: 'ゴールドテーマ', desc: '金ぴか。えらい。', price: 800 },
  { id: 'th-fuji', emoji: '💜', name: 'ふじいろテーマ', desc: 'やさしい紫の画面', price: 250 },
  { id: 'th-ruby', emoji: '💎', name: 'ルビーテーマ', desc: '深い赤の画面', price: 400 },
  { id: 'th-mikan', emoji: '🍊', name: 'みかんテーマ', desc: 'オレンジの画面', price: 250 },
  { id: 'th-sora', emoji: '☁️', name: 'そらいろテーマ', desc: '水色の画面', price: 250 },
  { id: 'th-sumi', emoji: '🖤', name: 'すみテーマ', desc: '黒と白のかっこいい画面', price: 400 },
  // グラデーション（子どもの声 2026-09-20）。背景の色が すこしずつ 変わる
  { id: 'th-yuyake', emoji: '🌇', name: 'ゆうやけグラデ', desc: 'オレンジ→ピンクの空', price: 500 },
  { id: 'th-umizora', emoji: '🌅', name: 'うみぞらグラデ', desc: '水色→青むらさきの空', price: 500 },
  { id: 'th-mint', emoji: '🍈', name: 'ミントグラデ', desc: '黄緑→水色のさわやか', price: 500 },
  { id: 'th-yume', emoji: '🦄', name: 'ゆめいろグラデ', desc: 'むらさき→ピンク→水色', price: 600 },
  // 青系をもっと（子どもの声 2026-10-03）
  { id: 'th-shinkai', emoji: '🌃', name: 'しんかいテーマ', desc: '深い紺色のダーク画面', price: 400 },
  { id: 'th-ramune', emoji: '🫧', name: 'ラムネテーマ', desc: '明るい水色〜青緑', price: 250 },
  { id: 'th-sapphire', emoji: '💠', name: 'サファイアグラデ', desc: '青→あい色の宝石', price: 500 },
  // 白い冬のテーマ・グラデーションをもっと（子どもの声 2026-10-07）
  { id: 'th-yuki', emoji: '❄️', name: 'ゆきテーマ', desc: '白と水色の 冬の画面', price: 300 },
  { id: 'th-aurora', emoji: '🌌', name: 'オーロラグラデ', desc: '緑→青→むらさきの夜空', price: 600 },
  { id: 'th-momo', emoji: '🍑', name: 'ももグラデ', desc: 'もも色→ピンクの やさしい色', price: 500 },
  { id: 'th-soda', emoji: '🍋', name: 'レモンソーダグラデ', desc: '黄色→水色の しゅわしゅわ', price: 500 },
];

// カタログからidで引く（表示や称号絵文字の解決に使う）
export const findTitle = (id: string | null | undefined) =>
  TITLES.find(t => t.id === id) || SEASONAL_TITLES.find(t => t.id === id) || null;
export const findTheme = (id: string | null | undefined) =>
  THEMES.find(t => t.id === id) || SEASONAL_THEMES.find(t => t.id === id) || null;

// 背景画像を使えるようにするポイント（最初の1回だけ）。
// 買ったあとは「つける／けす」は無料。写真の入れかえは BG_REPLACE_PRICE。
// ※ 以前は“つけるたび”に消費していたので、けすと再課金になり、
//   実質つけっぱなしにするしかなかった（子どもからの要望で変更）。
export const BG_PRICE = 1000;
// 写真を新しい写真に買い直すときのポイント（子どもの声 2026-10-05）。前の写真は上書きされる。
export const BG_REPLACE_PRICE = 1000;

// 背景の持ち物は「1人1枚」。保存先も {studentId}.jpg の上書きなので増えない。
export const BG_UNLOCK_ID = 'bg-unlock';       // 買ったかどうかの印（owned に入る）
export const BG_MAX_INPUT_MB = 12;             // これより大きい写真は受け取らない
export const BG_MAX_STORED_KB = 900;           // 保存する画像はこのサイズ以下まで圧縮する

// クラスの木：TREE_STEP ポイントごとに1段階成長（最大10段階）
export const TREE_STAGES = ['🌱', '🌿', '🪴', '🌳', '🌳✨', '🌸🌳', '🌸🌳✨', '🍎🌳', '🍎🌳✨', '🏆🌳'];
export const TREE_STEP = 500;
