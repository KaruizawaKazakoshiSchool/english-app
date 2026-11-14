// ことばパズル（文の並べかえ）の問題。
// 子どもの声「文法ゲームがほしい」から（2026-11-15）。
//
// 書き方：
//   en    … 正しい文。カードは空白で区切る。2語で1枚にしたいときは _ でつなぐ（New_Zealand）
//           文の終わりの . ? ! は自動でカードから外して、最後に固定で出す
//   ja    … 日本語（これを見て並べる）
//   extra … 「ふつう」でまざる よけいなカード（do/does、is/are など まちがえやすい形）
//
// 文を足す・直すときは、この配列だけ直せばよい。

export interface PuzzleSentence { en: string; ja: string; extra: string[] }
export interface PuzzleUnit { id: string; grade: 5 | 6; unitName: string; sentences: PuzzleSentence[] }

export const PUZZLE_UNITS: PuzzleUnit[] = [
  // ===== 5年生 =====
  { id: 'g5-u1', grade: 5, unitName: 'Unit 1: Hello, friends!', sentences: [
    { en: 'What subject do you like?', ja: '何の教科が好きですか？', extra: ['does'] },
    { en: 'I like music very much.', ja: '音楽がとても好きです。', extra: ['am'] },
    { en: 'How do you spell your name?', ja: '名前はどうつづりますか？', extra: ['are'] },
    { en: 'My name is Ken.', ja: 'ぼくの名前はケンです。', extra: ['am'] },
    { en: 'What sport do you like?', ja: '何のスポーツが好きですか？', extra: ['is'] },
    { en: "I don't like math.", ja: '算数は好きではありません。', extra: ['not'] },
  ] },
  { id: 'g5-u2', grade: 5, unitName: 'Unit 2: Happy birthday!', sentences: [
    { en: 'When is your birthday?', ja: '誕生日はいつですか？', extra: ['are'] },
    { en: 'My birthday is May_5th.', ja: 'わたしの誕生日は5月5日です。', extra: ['am'] },
    { en: 'What do you want for your birthday?', ja: '誕生日に何がほしいですか？', extra: ['does'] },
    { en: 'I want a new ball.', ja: '新しいボールがほしいです。', extra: ['an'] },
    { en: 'Is your birthday in July?', ja: 'あなたの誕生日は7月ですか？', extra: ['are'] },
    { en: 'Happy birthday to you!', ja: 'お誕生日おめでとう！', extra: ['for'] },
  ] },
  { id: 'g5-u3', grade: 5, unitName: 'Unit 3: Can you play dodgeball?', sentences: [
    { en: 'Can you play the piano?', ja: 'ピアノをひけますか？', extra: ['do'] },
    { en: 'I can swim fast.', ja: '速く泳げます。', extra: ['am'] },
    { en: "I can't ride a unicycle.", ja: '一輪車には乗れません。', extra: ['not'] },
    { en: 'Can you cook curry_and_rice?', ja: 'カレーライスを作れますか？', extra: ['are'] },
    { en: 'I can play soccer well.', ja: 'サッカーが上手にできます。', extra: ['the'] },
    { en: 'Can you sing well?', ja: '上手に歌えますか？', extra: ['does'] },
  ] },
  { id: 'g5-u4', grade: 5, unitName: 'Unit 4: Who is this?', sentences: [
    { en: 'Who is this?', ja: 'この人は誰ですか？', extra: ['are'] },
    { en: 'This is my friend, Ken.', ja: 'こちらは友だちのケンです。', extra: ['am'] },
    { en: 'He can play tennis very well.', ja: 'かれはテニスがとても上手です。', extra: ['is'] },
    { en: 'She is good at cooking.', ja: 'かのじょは料理が得意です。', extra: ['are'] },
    { en: 'What can she do?', ja: 'かのじょは何ができますか？', extra: ['does'] },
    { en: 'He is my brother.', ja: 'かれはぼくの兄です。', extra: ['are'] },
  ] },
  { id: 'g5-u5', grade: 5, unitName: "Unit 5: Let's go to the zoo.", sentences: [
    { en: 'Where is the post_office?', ja: '郵便局はどこですか？', extra: ['are'] },
    { en: 'Go straight and turn right.', ja: 'まっすぐ行って、右に曲がってください。', extra: ['to'] },
    { en: 'Turn left at the corner.', ja: '角を左に曲がってください。', extra: ['in'] },
    { en: "It's by the park.", ja: '公園のそばにあります。', extra: ['is'] },
    { en: 'You can see it on your left.', ja: '左がわに見えます。', extra: ['in'] },
    { en: 'Go straight for two blocks.', ja: '2ブロックまっすぐ行ってください。', extra: ['at'] },
  ] },
  { id: 'g5-u6', grade: 5, unitName: 'Unit 6: At a restaurant.', sentences: [
    { en: 'What would you like?', ja: '何になさいますか？', extra: ['do'] },
    { en: "I'd like a hamburger.", ja: 'ハンバーガーをください。', extra: ['an'] },
    { en: 'How much is it?', ja: 'いくらですか？', extra: ['many'] },
    { en: 'The pizza is 600 yen.', ja: 'ピザは600円です。', extra: ['are'] },
    { en: 'What would you like to drink?', ja: '飲み物は何になさいますか？', extra: ['does'] },
    { en: "I'd like orange_juice, please.", ja: 'オレンジジュースをお願いします。', extra: ['am'] },
  ] },
  { id: 'g5-u7', grade: 5, unitName: 'Unit 7: Welcome to Japan!', sentences: [
    { en: 'Where do you want to go?', ja: 'どこに行きたいですか？', extra: ['does'] },
    { en: 'I want to go to Okinawa.', ja: '沖縄に行きたいです。', extra: ['at'] },
    { en: 'Why do you want to go there?', ja: 'どうしてそこに行きたいのですか？', extra: ['are'] },
    { en: 'I want to see the sea.', ja: '海が見たいです。', extra: ['look'] },
    { en: 'You can eat fresh fish.', ja: '新鮮な魚が食べられます。', extra: ['are'] },
    { en: 'We have a summer_festival in August.', ja: '8月に夏祭りがあります。', extra: ['at'] },
  ] },
  { id: 'g5-u8', grade: 5, unitName: 'Unit 8: Who is your hero?', sentences: [
    { en: 'Who is your hero?', ja: 'あなたのヒーローは誰ですか？', extra: ['are'] },
    { en: 'My hero is my mother.', ja: 'わたしのヒーローはお母さんです。', extra: ['am'] },
    { en: 'She is very kind.', ja: 'かのじょはとてもやさしいです。', extra: ['are'] },
    { en: 'He is good at playing soccer.', ja: 'かれはサッカーをするのが得意です。', extra: ['can'] },
    { en: 'She can cook well.', ja: 'かのじょは上手に料理ができます。', extra: ['is'] },
    { en: 'Why is he your hero?', ja: 'どうしてかれがあなたのヒーローなのですか？', extra: ['does'] },
  ] },

  // ===== 6年生 =====
  { id: 'g6-u1', grade: 6, unitName: 'Unit 1: This is me!', sentences: [
    { en: 'Where are you from?', ja: 'どこの出身ですか？', extra: ['is'] },
    { en: 'Nice to meet you, too.', ja: 'こちらこそ、はじめまして。', extra: ['two'] },
    { en: 'I can speak Japanese and English.', ja: '日本語と英語が話せます。', extra: ['am'] },
    { en: 'My birthday is April_2nd.', ja: 'わたしの誕生日は4月2日です。', extra: ['in'] },
    { en: "I'm good at swimming.", ja: '水泳が得意です。', extra: ['can'] },
    { en: 'What sport do you like?', ja: '何のスポーツが好きですか？', extra: ['are'] },
  ] },
  { id: 'g6-u2', grade: 6, unitName: 'Unit 2: My Daily Schedule', sentences: [
    { en: 'What time do you get up?', ja: '何時に起きますか？', extra: ['does'] },
    { en: 'I get up at 6:30.', ja: '6時半に起きます。', extra: ['in'] },
    { en: 'I usually go to bed at 9:30.', ja: 'たいてい9時半にねます。', extra: ['on'] },
    { en: 'What do you do on Sundays?', ja: '日曜日は何をしますか？', extra: ['in'] },
    { en: 'I always walk my dog.', ja: 'いつも犬の散歩をします。', extra: ['am'] },
    { en: 'I sometimes wash the dishes.', ja: 'ときどき皿をあらいます。', extra: ['washes'] },
  ] },
  { id: 'g6-u3', grade: 6, unitName: 'Unit 3: My Weekend', sentences: [
    { en: 'How was your weekend?', ja: '週末はどうでしたか？', extra: ['were'] },
    { en: 'I went to the park.', ja: '公園に行きました。', extra: ['go'] },
    { en: 'I played soccer with my friends.', ja: '友だちとサッカーをしました。', extra: ['play'] },
    { en: 'I ate pizza for lunch.', ja: '昼ごはんにピザを食べました。', extra: ['eat'] },
    { en: 'I saw a movie on Sunday.', ja: '日曜日に映画を見ました。', extra: ['see'] },
    { en: 'What did you do on Saturday?', ja: '土曜日は何をしましたか？', extra: ['does'] },
  ] },
  { id: 'g6-u4', grade: 6, unitName: "Unit 4: Let's see the world.", sentences: [
    { en: "Let's go to Australia.", ja: 'オーストラリアに行きましょう。', extra: ['at'] },
    { en: 'You can see many unique animals.', ja: 'めずらしい動物がたくさん見られます。', extra: ['are'] },
    { en: 'You can eat delicious pizza.', ja: 'おいしいピザが食べられます。', extra: ['is'] },
    { en: "It's a beautiful country.", ja: '美しい国です。', extra: ['an'] },
    { en: 'Why do you want to go to Italy?', ja: 'どうしてイタリアに行きたいのですか？', extra: ['does'] },
    { en: 'I want to visit Egypt.', ja: 'エジプトをおとずれたいです。', extra: ['go'] },
  ] },
  { id: 'g6-u5', grade: 6, unitName: 'Unit 5: Where is it from?', sentences: [
    { en: 'Where is it from?', ja: 'それはどこから来ましたか？', extra: ['are'] },
    { en: 'This sweater is from New_Zealand.', ja: 'このセーターはニュージーランド産です。', extra: ['are'] },
    { en: 'These shoes are from Vietnam.', ja: 'このくつはベトナム産です。', extra: ['is'] },
    { en: 'Where is your cap from?', ja: 'あなたのぼうしはどこ産ですか？', extra: ['does'] },
    { en: 'This is my favorite sweater.', ja: 'これはわたしのお気に入りのセーターです。', extra: ['am'] },
    { en: 'We eat beef from Australia.', ja: 'わたしたちはオーストラリア産の牛肉を食べます。', extra: ['at'] },
  ] },
  { id: 'g6-u6', grade: 6, unitName: 'Unit 6: Save the animals.', sentences: [
    { en: 'What do sea_turtles eat?', ja: 'ウミガメは何を食べますか？', extra: ['does'] },
    { en: 'Sea_turtles eat jellyfish.', ja: 'ウミガメはクラゲを食べます。', extra: ['eats'] },
    { en: 'Where do lions live?', ja: 'ライオンはどこに住んでいますか？', extra: ['does'] },
    { en: 'Lions live in the savanna.', ja: 'ライオンはサバンナに住んでいます。', extra: ['lives'] },
    { en: 'Sea_turtles are in danger.', ja: 'ウミガメが危ない。', extra: ['is'] },
    { en: 'We can pick_up trash.', ja: 'わたしたちはごみを拾うことができます。', extra: ['are'] },
    { en: 'Plastic is a big problem.', ja: 'プラスチックは大きな問題です。', extra: ['are'] },
  ] },
  { id: 'g6-u7', grade: 6, unitName: 'Unit 7: My Best Memory', sentences: [
    { en: 'What is your best memory?', ja: '一番の思い出は何ですか？', extra: ['are'] },
    { en: 'My best memory is the school_trip.', ja: '一番の思い出は修学旅行です。', extra: ['am'] },
    { en: 'We went to Kyoto.', ja: 'わたしたちは京都に行きました。', extra: ['go'] },
    { en: 'We saw a big castle.', ja: '大きなお城を見ました。', extra: ['see'] },
    { en: 'I enjoyed the sports_day.', ja: '運動会を楽しみました。', extra: ['enjoy'] },
    { en: 'It was a lot of fun.', ja: 'とても楽しかったです。', extra: ['were'] },
  ] },
  { id: 'g6-u8', grade: 6, unitName: 'Unit 8: My Future, My Dream', sentences: [
    { en: 'What do you want to be?', ja: '将来、何になりたいですか？', extra: ['are'] },
    { en: 'I want to be a vet.', ja: 'じゅう医になりたいです。', extra: ['an'] },
    { en: 'I like animals very much.', ja: '動物がとても好きです。', extra: ['likes'] },
    { en: 'I want to help sick animals.', ja: '病気の動物を助けたいです。', extra: ['helps'] },
    { en: 'I want to join the soccer_team.', ja: 'サッカー部に入りたいです。', extra: ['at'] },
    { en: "I'm good at drawing pictures.", ja: '絵をかくのが得意です。', extra: ['can'] },
  ] },
];

/** 文をカードに分ける。終わりの記号は別に返す。先頭の大文字は小文字にもどす（I は そのまま） */
export const toCards = (en: string): { words: string[]; end: string } => {
  const m = en.match(/^(.*?)([.?!])$/);
  const body = m ? m[1] : en;
  const end = m ? m[2] : '';
  const words = body.split(' ').map(w => w.replace(/_/g, ' '));
  if (!/^I(\b|')/.test(words[0])) words[0] = words[0].charAt(0).toLowerCase() + words[0].slice(1);
  return { words, end };
};
