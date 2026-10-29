// ダイアログ・トレーナーの会話データ。
// en の中の {…} は「差し替えスロット」。中身は例で、子は自分のことに変えてOK。
// 教科書（東京書籍）の各Unitのキー表現に紐づけている。

export interface DialogueLine {
  speaker: 'A' | 'B';
  en: string;
  ja: string;
}

export interface Dialogue {
  id: string;
  grade: 5 | 6;
  unitName: string;
  targetPhrase: string;
  lines: DialogueLine[];
  note?: string; // 文法のワンポイント（任意）
  relatedCategories?: string[]; // 関連するPicture Dictionaryの単元（任意）
  aiRoute?: string; // 練習後に飛べるAI英会話へのリンク（任意。例 /ai?shop=simple）
  aiLabel?: string; // 上のリンクのボタン表示
}

export const DIALOGUES: Dialogue[] = [
  {
    // English Workshop（789年生主催）向けの自己紹介練習。児童＝B。
    // {…}は自分の名前・ニックネーム・好きなものに変える。→ 練習後にAI英会話や友だちと本番。
    id: 'intro-workshop', grade: 5, unitName: '👋 自己紹介（789 English Workshop）', targetPhrase: "I'm ___. Call me ___. I like ___.",
    lines: [
      { speaker: 'A', en: 'Hi! Nice to meet you! What\'s your name?', ja: 'こんにちは！はじめまして！お名前は？' },
      { speaker: 'B', en: "Hi! I'm {Eiji}.", ja: '【えいじ】です。' },
      { speaker: 'B', en: 'Call me {A-chan}.', ja: '【えーちゃん】と呼んでね。' },
      { speaker: 'A', en: 'Nice to meet you, {A-chan}! What do you like?', ja: 'よろしく、【えーちゃん】！何が好き？' },
      { speaker: 'B', en: 'I like {soccer}.', ja: '【サッカー】が好きです。' },
      { speaker: 'A', en: 'Me too! Let\'s have fun!', ja: 'ぼくも！楽しもう！' },
    ],
    note: 'あなたはB！ {…}を自分のことに変えよう。プラス1情報は好きな色・食べ物・スポーツなど何でもOK。れい："I like blue." / "I like pizza." / "I like baseball." れんしゅうしたら、AIや友だちと本番だ！',
    aiRoute: '/ai?unit=intro-workshop', aiLabel: 'AIと自己紹介の練習をする',
  },
  // ===== 5年生 =====
  {
    id: 'g5-u1', grade: 5, unitName: 'Unit 1: Hello, friends!', targetPhrase: 'What subject do you like?',
    lines: [
      { speaker: 'A', en: 'What subject do you like?', ja: '何の教科が好き？' },
      { speaker: 'B', en: 'I like {P.E.}.', ja: '【体育】が好き。' },
      { speaker: 'A', en: 'Oh, nice! I like {science}.', ja: 'いいね！ぼくは【理科】が好き。' },
    ],
    note: '相手と同じ教科が好きなときは "I like science, too."（〜も）と "too" をつけよう！ちがう教科のときは "too" はつけないよ。',
    relatedCategories: ['教科'],
  },
  {
    id: 'g5-u2', grade: 5, unitName: 'Unit 2: Happy birthday!', targetPhrase: 'When is your birthday?',
    lines: [
      { speaker: 'A', en: 'When is your birthday?', ja: '誕生日はいつ？' },
      { speaker: 'B', en: 'My birthday is {May 5th}.', ja: '【5月5日】だよ。' },
      { speaker: 'A', en: 'Happy birthday! What do you want?', ja: 'おめでとう！何がほしい？' },
      { speaker: 'B', en: 'I want {a new ball}.', ja: '【新しいボール】がほしい。' },
    ],
    relatedCategories: ['月'],
  },
  {
    id: 'g5-u3', grade: 5, unitName: 'Unit 3: Can you play dodgeball?', targetPhrase: 'Can you play the piano?',
    lines: [
      { speaker: 'A', en: 'Can you play the piano?', ja: 'ピアノ弾ける？' },
      { speaker: 'B', en: '{Yes, I can.}', ja: '【うん、できるよ。】' },
      { speaker: 'A', en: 'Can you {swim}?', ja: '【泳ぐ】のはできる？' },
      { speaker: 'B', en: 'Yes, I can!', ja: 'うん、できる！' },
    ],
    relatedCategories: ['動作など（5年）'],
  },
  {
    id: 'g5-u4', grade: 5, unitName: 'Unit 4: Who is this?', targetPhrase: 'She can play tennis very well.',
    lines: [
      { speaker: 'A', en: 'This is my friend, {Ken}.', ja: '友だちの【ケン】だよ。' },
      { speaker: 'B', en: 'What can {he} do?', ja: '【彼】は何ができるの？' },
      { speaker: 'A', en: '{He} can play tennis very well.', ja: '【彼】はテニスがすごく上手。' },
      { speaker: 'B', en: 'Wow, great!', ja: 'わー、すごい！' },
    ],
    relatedCategories: ['動作など（5年）'],
  },
  // P5「Town Guide 軽井沢あんない」の床。道案内は3つの話型で段階的に伸ばす。
  //   A=基本（たずねる→答える）／ B=軽井沢のスポットで目印とできることを足す／
  //   C=6年U4「行きたい場所」につながる型。仕様書_まちクイズ.md v2 §3。
  {
    id: 'g5-u5', grade: 5, unitName: "Unit 5: Let's go to the zoo.（話型A・基本）", targetPhrase: 'Where is the post office?',
    lines: [
      { speaker: 'A', en: 'Excuse me. Where is the {post office}?', ja: 'すみません、【郵便局】はどこですか？' },
      { speaker: 'B', en: 'Go straight and turn {right}.', ja: 'まっすぐ行って【右】に曲がってください。' },
      { speaker: 'A', en: 'Thank you!', ja: 'ありがとう！' },
    ],
    relatedCategories: ['町', '道案内'],
  },
  {
    // 話型B：距離(for ◯ blocks)・角(at the corner)・目印(It's by ◯◯.)と、
    //   そこでできること（You can …）を足す。配布物「まなぶこと」の5フレーズに対応。
    // {…}は自分が案内したい軽井沢のスポットに変えてOK。
    id: 'g5-u5b', grade: 5, unitName: "Unit 5: Let's go to the zoo.（話型B・軽井沢のスポット）", targetPhrase: "It's by the forest. You can take a photo there!",
    lines: [
      { speaker: 'A', en: 'Excuse me. Where is {Kumoba Pond}?', ja: 'すみません、【雲場池】はどこですか？' },
      { speaker: 'B', en: "Go straight for {two} blocks. Turn left at the corner. It's by the {forest}.", ja: '【2】ブロックまっすぐ行って、角を左に曲がってください。【森】のそばです。' },
      { speaker: 'B', en: 'You can {take a photo} there!', ja: 'そこで【写真をとる】ことができますよ！' },
      { speaker: 'A', en: 'Thank you so much!', ja: '本当にありがとうございます！' },
    ],
    note: 'It\'s by ◯◯. ＝「◯◯のそばです」。next to（となり）でもOK。block＝1区画、corner＝角。',
    relatedCategories: ['町', '道案内', '位置', '道案内＋（プラスアルファ）'],
    aiRoute: '/ai?unit=g5-u5',
    aiLabel: 'AIに道案内してみる',
  },
  {
    // 話型C：6年U4「行きたい国・場所」へつながる型。案内する側が提案までする。
    id: 'g5-u5c', grade: 5, unitName: "Unit 5: Let's go to the zoo.（話型C・行きたい場所）", targetPhrase: 'I want to go to ___.',
    lines: [
      { speaker: 'A', en: 'Where do you want to go?', ja: 'どこに行きたいですか？' },
      { speaker: 'B', en: 'I want to go to {Harunire Terrace}.', ja: '【ハルニレテラス】に行きたいです。' },
      { speaker: 'A', en: 'OK! Go straight. We have a nice {terrace}!', ja: 'いいですね！まっすぐ行ってください。すてきな【テラス】があるんですよ！' },
      { speaker: 'A', en: 'You can {eat lunch} there.', ja: 'そこで【昼ごはんを食べる】ことができます。' },
      { speaker: 'B', en: 'Sounds nice!', ja: 'いいですね！' },
    ],
    note: 'I want to go to ◯◯. ＝「◯◯に行きたい」。6年U4「行きたい国」でもそのまま使える型。We have a nice ◯◯! ＝「すてきな◯◯があるんです」＝まちの自慢の型。',
    relatedCategories: ['町', '町＋（プラスアルファ）', '道案内'],
    aiRoute: '/ai?unit=g6-u4',
    aiLabel: 'AIと「行きたい場所」を話す',
  },
  {
    // 話型D：案内のあと、観光客の追加質問にその場で答える（P5 L4〜本番のプラス1）。
    // 文は配布物「観光客の質問カード」とそろえてある。あなたはガイド(B)。
    id: 'g5-u5d', grade: 5, unitName: "Unit 5: Let's go to the zoo.（話型D・観光客の質問に答える）", targetPhrase: "Is it far? — No, it's near.",
    lines: [
      { speaker: 'A', en: 'Excuse me. Is it far?', ja: 'すみません、遠いですか？' },
      { speaker: 'B', en: "No, it's near. It's about {five} minutes.", ja: 'いいえ、近いですよ。【5】分くらいです。' },
      { speaker: 'A', en: 'How much is it?', ja: 'いくらですか？' },
      { speaker: 'B', en: "It's {free}!", ja: '【無料】です！' },
      { speaker: 'A', en: 'What can I eat there?', ja: 'そこで何が食べられますか？' },
      { speaker: 'B', en: 'You can eat {bread} there.', ja: 'そこで【パン】が食べられます。' },
      { speaker: 'A', en: 'Can I take a photo?', ja: '写真をとってもいいですか？' },
      { speaker: 'B', en: '{Sure}! Have a nice trip!', ja: '【もちろん】！よい旅を！' },
    ],
    note: 'あなたはガイド(B)！ {…}は自分のスポットに合わせて変えよう。れい："It\'s about ten minutes." / "It\'s 500 yen." / "You can eat soba there." / "Sorry, no."（ごめんなさい、だめです）。紙の「観光客の質問カード」と同じ文だよ。',
    relatedCategories: ['道案内＋（プラスアルファ）', '町＋（プラスアルファ）'],
    aiRoute: '/ai?unit=g5-u5d',
    aiLabel: 'AIのLucyを案内してみる',
  },
  {
    id: 'g5-u6', grade: 5, unitName: 'Unit 6: At a restaurant.', targetPhrase: 'What would you like?',
    lines: [
      { speaker: 'A', en: 'What would you like?', ja: '何にする？' },
      { speaker: 'B', en: "I'd like {a hamburger}.", ja: '【ハンバーガー】をください。' },
      { speaker: 'A', en: 'Anything to drink?', ja: '飲み物は？' },
      { speaker: 'B', en: '{Orange juice}, please.', ja: '【オレンジジュース】を。' },
    ],
    relatedCategories: ['食べ物', '飲み物'],
  },
  {
    // World Bento「お店屋さん」練習用。児童＝店員(B)の所作を練習 → AI英会話(お客さん)や
    // クラスメイトダイアログへ。{…}は自分のお店のメニュー・値段に変えてOK。
    id: 'wb-shop', grade: 5, unitName: 'World Bento お店屋さん（店員）', targetPhrase: 'How much is it all together?',
    lines: [
      { speaker: 'A', en: 'Hello! What do you have?', ja: 'こんにちは！なにが ありますか？' },
      { speaker: 'B', en: 'We have {curry}, {rice}, and {juice}.', ja: '【カレー・ごはん・ジュース】が あります。' },
      { speaker: 'A', en: "I'd like a {curry}, please.", ja: '【カレー】を ください。' },
      { speaker: 'B', en: 'Sure! Here you are.', ja: 'いいですよ！ どうぞ。' },
      { speaker: 'A', en: 'How much is it?', ja: 'いくら ですか？' },
      { speaker: 'B', en: "It's {300} yen.", ja: '【300】円 です。' },
      { speaker: 'A', en: 'How much is it all together?', ja: 'ぜんぶで いくら ですか？' },
      { speaker: 'B', en: "It's {500} yen in total.", ja: 'ごうけい【500】円 です。' },
      { speaker: 'A', en: 'Great! Here you are. Goodbye!', ja: 'ありがとう！ さようなら！' },
      { speaker: 'B', en: 'Thank you! Bye!', ja: 'ありがとう！ またね！' },
    ],
    note: 'あなたは店員さん(B)！ {…}は自分のお店のメニュー・値段に変えよう。チャレンジ：お客さんが "What\'s in it?"（なにが入ってる？）や "Is it spicy?"（からい？）と聞いてきたら、"It\'s {rice} and {meat}." や "It\'s yummy!" と答えてみよう。れんしゅうしたら、AIのお客さんや友だちと本番だ！',
    relatedCategories: ['食べ物＋（世界の料理）'],
    aiRoute: '/ai?shop=simple', aiLabel: 'AIのお客さんと練習する（お店屋さん）',
  },
  {
    id: 'g5-u7', grade: 5, unitName: 'Unit 7: Welcome to Japan!', targetPhrase: 'Why do you want to go there?',
    lines: [
      { speaker: 'A', en: 'Where do you want to go?', ja: 'どこに行きたい？' },
      { speaker: 'B', en: 'I want to go to {Okinawa}.', ja: '【沖縄】に行きたい。' },
      { speaker: 'A', en: 'Why do you want to go there?', ja: 'なんで？' },
      { speaker: 'B', en: 'I want to {see the sea}.', ja: '【海が見たい】から。' },
    ],
  },
  {
    // P7 お店の型（2026-10-23 さんだー作・冊子 p.2 と同じ順。冊子の合計の2行は今は読まない）。A＝お客さん、B＝お店の人
    id: 'p7-shop', grade: 6, unitName: '🛍️ P7 お店の型（Shop）', targetPhrase: "How much is it? — It's 500 yen.",
    lines: [
      { speaker: 'A', en: 'Hello! What do you have?', ja: 'こんにちは！何がありますか？' },
      { speaker: 'B', en: 'We have {caps and T-shirts}.', ja: '【ぼうしとTシャツ】があります。' },
      { speaker: 'A', en: "I'd like a {blue cap}, please.", ja: '【青いぼうし】をください。' },
      { speaker: 'B', en: 'Here you are.', ja: 'どうぞ。' },
      { speaker: 'A', en: 'How much is it?', ja: 'いくらですか？' },
      { speaker: 'B', en: "It's {five hundred} yen.", ja: '【500】円です。' },
      { speaker: 'A', en: 'Where is it from?', ja: 'どこで作られたのですか？' },
      { speaker: 'B', en: "It's from {Vietnam}.", ja: '【ベトナム】で作られました。' },
      { speaker: 'A', en: 'Here you are. Thank you!', ja: 'はい、どうぞ。ありがとう！' },
      { speaker: 'B', en: 'Thank you. Bye!', ja: 'ありがとう。さようなら！' },
    ],
    note: 'A＝お客さん、B＝お店の人。両方の役を練習しよう！ {…}は自分のお店の商品・値段・国に変えてOK。値段は数字を英語で言おう（500＝five hundred）。言葉は辞書「衣類」「衣類＋」「国＋」「色」「数」。',
    relatedCategories: ['衣類', '衣類＋（プラスアルファ）', '国＋（プラスアルファ）', '色', '数'],
    aiRoute: '/ai?unit=p7-shop',
    aiLabel: 'AIのお客さんに売ってみる',
  },
  {
    // P7 World Fashion Show & Shop（2026-10-09）。ショーのセリフ（3人1組で歩き、1人ずつ言う）。A＝観客、B＝モデル（自分）
    id: 'p7-show', grade: 6, unitName: '👗 P7 ファッションショー（ショーのセリフ）', targetPhrase: "This is my blue cap. It's from Vietnam.",
    lines: [
      { speaker: 'A', en: 'Wow! Tell me about your clothes!', ja: 'わあ！服のことを教えて！' },
      { speaker: 'B', en: 'This is my {blue cap}.', ja: 'これはわたしの【青いぼうし】です。' },
      { speaker: 'A', en: 'Where is it from?', ja: 'どこで作られたの？' },
      { speaker: 'B', en: "It's from {Vietnam}.", ja: '【ベトナム】で作られました。' },
      { speaker: 'B', en: 'I like {the color}.', ja: '【この色】が好きです。' },
      { speaker: 'B', en: 'Look! I made a {poncho}.', ja: '見て！【ポンチョ】を作ったよ。' },
      { speaker: 'A', en: 'Nice!', ja: 'いいね！' },
    ],
    note: 'あなたはB（モデル）！ {…}はデザイナーシートに合わせて変えよう。服の国は自分の服のタグで。「Look! I made a ◯◯.」は手作りの小物（➕1）。言葉は辞書「衣類」「衣類＋」「国＋」「色」。',
    relatedCategories: ['衣類', '衣類＋（プラスアルファ）', '国＋（プラスアルファ）', '色'],
    aiRoute: '/ai?unit=p7-show',
    aiLabel: 'AIの観客にショーのセリフを言う',
  },
  {
    // P7 本番の司会（MC）。A＝MC-A、B＝MC-B（P7_司会MCカード の台本と同じ順）。2026-10-30 お店中心の World Fashion Market 版
    id: 'p7-mc', grade: 6, unitName: '🎤 P7 本番の司会（MC）', targetPhrase: 'Welcome to the World Fashion Market!',
    lines: [
      { speaker: 'A', en: 'Hello, everyone!', ja: 'みなさん、こんにちは！' },
      { speaker: 'B', en: 'Welcome to the World Fashion Market!', ja: 'ワールド・ファッション・マーケットへようこそ！' },
      { speaker: 'A', en: 'You have 2,000 yen and a mission card.', ja: '2,000円とミッションカードがあります。' },
      { speaker: 'B', en: 'Our shops are open. Please enjoy shopping!', ja: 'お店が開きました。買い物を楽しんでください！' },
      { speaker: 'A', en: 'Round 1. The shops are on the right.', ja: 'ラウンド1。お店は右半分です。' },
      { speaker: 'B', en: 'Time sale! 100 yen off!', ja: 'タイムセール！100円引き！' },
      { speaker: 'A', en: 'Change! Round 2. The shops are on the left.', ja: '交代！ラウンド2。お店は左半分です。' },
      { speaker: 'B', en: 'Shop time is over. Thank you!', ja: 'お店の時間はおしまい。ありがとう！' },
      { speaker: 'A', en: 'The No.3 shop is {Blue Shop}!', ja: '3位のお店は【ブルー・ショップ】！' },
      { speaker: 'B', en: 'The No.2 shop is {Kaze Fashion}!', ja: '2位のお店は【カゼ・ファッション】！' },
      { speaker: 'A', en: "And the No.1 shop is ... {Lucy's Shop}! Let's give a big hand!", ja: 'そして1位は……【ルーシーの店】！大きな拍手を！' },
      { speaker: 'B', en: 'Grade 7, 8 and 9, please give us a comment.', ja: '789年生のみなさん、一言お願いします。' },
      { speaker: 'A', en: 'Thank you for coming! See you!', ja: '来てくれてありがとう！またね！' },
    ],
    note: '司会をやる人の練習。MC-A の人は A、MC-B の人は B を選んで読もう。{…}には本当のお店の名前が入るよ。大きな声で、ゆっくり、顔を上げて。台本は「P7 司会MCカード」と同じ。',
  },
  {
    // P6 Seasons Guide：観光客Lucyに、おすすめの季節を紹介する（冊子 p.3 観光客カード・ポスターと同じ4行）。あなたはガイド(B)。
    id: 'g5-u7s', grade: 5, unitName: 'Unit 7: Welcome to Japan!（季節ガイド話型）', targetPhrase: 'I like autumn. You can see red leaves.',
    lines: [
      { speaker: 'A', en: 'Hello! What season do you like?', ja: 'こんにちは！どの季節が好き？' },
      { speaker: 'B', en: 'I like {autumn}.', ja: '【秋】が好き。' },
      { speaker: 'A', en: 'Why?', ja: 'どうして？' },
      { speaker: 'B', en: 'You can {see red leaves}.', ja: '【紅葉が見られる】から。' },
      { speaker: 'A', en: 'When?', ja: 'いつ？' },
      { speaker: 'B', en: "Come in {October}! It's {beautiful}!", ja: '【10月】に来てね！【きれい】だよ！' },
      { speaker: 'A', en: 'Nice! Thank you!', ja: 'いいね！ありがとう！' },
    ],
    note: 'あなたはガイド(B)！ {…}は自分のポスターに合わせて変えよう。れい："I like winter." / "You can enjoy skating." / "Come in January! It\'s fun!"。冊子 p.2 に言葉の一覧があるよ。',
    relatedCategories: ['季節', '月', '年中行事', '感想・様子'],
    aiRoute: '/ai?unit=g5-u7s',
    aiLabel: 'AIのLucyに季節をすすめる',
  },
  {
    id: 'g5-u8', grade: 5, unitName: 'Unit 8: Who is your hero?', targetPhrase: 'Who is your hero?',
    lines: [
      { speaker: 'A', en: 'Who is your hero?', ja: 'ヒーローは誰？' },
      { speaker: 'B', en: 'My hero is my {mother}.', ja: '【お母さん】だよ。' },
      { speaker: 'A', en: 'Why?', ja: 'どうして？' },
      { speaker: 'B', en: '{She} is {kind}.', ja: '【やさしい】から。' },
    ],
    relatedCategories: ['人', '性格'],
  },

  // ===== 6年生 =====
  {
    id: 'g6-u1', grade: 6, unitName: 'Unit 1: This is me!', targetPhrase: 'I can speak Swahili and English.',
    lines: [
      { speaker: 'A', en: "Hi, I'm {Kenta}. Nice to meet you.", ja: '【けんた】だよ、よろしく。' },
      { speaker: 'B', en: 'Nice to meet you, too. What can you do?', ja: 'よろしく。何ができる？' },
      { speaker: 'A', en: 'I can speak {Japanese} and {English}.', ja: '【日本語】と【英語】が話せる。' },
    ],
    relatedCategories: ['動作など（6年）'],
  },
  {
    id: 'g6-u2', grade: 6, unitName: 'Unit 2: My Daily Schedule', targetPhrase: 'What time do you get up?',
    lines: [
      { speaker: 'A', en: 'What time do you get up?', ja: '何時に起きる？' },
      { speaker: 'B', en: 'I get up at {6:30}.', ja: '【6時半】に起きる。' },
      { speaker: 'A', en: 'What time do you go to bed?', ja: '何時に寝る？' },
      { speaker: 'B', en: 'I go to bed at {9:30}.', ja: '【9時半】に寝る。' },
    ],
    relatedCategories: ['一日の生活'],
  },
  {
    id: 'g6-u3', grade: 6, unitName: 'Unit 3: My Weekend', targetPhrase: 'How was your weekend?',
    lines: [
      { speaker: 'A', en: 'How was your weekend?', ja: '週末どうだった？' },
      { speaker: 'B', en: 'It was {fun}. I {played soccer}.', ja: '【楽しかった】。【サッカーした】。' },
      { speaker: 'A', en: 'Sounds nice!', ja: 'いいね！' },
    ],
    relatedCategories: ['したこと', '気分'],
  },
  {
    id: 'g6-u4', grade: 6, unitName: 'Unit 4: Let\'s see the world.', targetPhrase: 'You can see many unique animals.',
    lines: [
      { speaker: 'A', en: 'Where should we go?', ja: 'どこ行く？' },
      { speaker: 'B', en: "Let's go to {Australia}.", ja: '【オーストラリア】に行こう。' },
      { speaker: 'A', en: 'Why?', ja: 'なんで？' },
      { speaker: 'B', en: 'You can see many {unique animals}.', ja: '【めずらしい動物】がたくさん見られる。' },
    ],
    relatedCategories: ['動物'],
  },
  {
    id: 'g6-u5', grade: 6, unitName: 'Unit 5: Where is it from?', targetPhrase: 'This sweater is from New Zealand.',
    lines: [
      { speaker: 'A', en: 'Nice {sweater}! Where is it from?', ja: 'いい【セーター】！どこ産？' },
      { speaker: 'B', en: 'This {sweater} is from {New Zealand}.', ja: '【ニュージーランド】産だよ。' },
      { speaker: 'A', en: "Wow, that's far!", ja: '遠いね！' },
    ],
    relatedCategories: ['衣類'],
  },
  {
    id: 'g6-u6', grade: 6, unitName: 'Unit 6: Save the animals.', targetPhrase: 'What do sea turtles eat?',
    lines: [
      { speaker: 'A', en: '{Sea turtles} are in danger.', ja: '【ウミガメ】が危ない。' },
      { speaker: 'B', en: 'They live in {the sea}.', ja: '【海】に住んでいる。' },
      { speaker: 'A', en: 'We must reduce {plastic bags}.', ja: '【レジ袋】を減らさなきゃ。' },
    ],
    relatedCategories: ['海の生き物'],
  },
  {
    id: 'g6-u7', grade: 6, unitName: 'Unit 7: My Best Memory', targetPhrase: 'My best memory is the school trip.',
    lines: [
      { speaker: 'A', en: 'What is your best memory?', ja: '一番の思い出は？' },
      { speaker: 'B', en: 'My best memory is {the school trip}.', ja: '【修学旅行】。' },
      { speaker: 'A', en: 'What did you do?', ja: '何をした？' },
      { speaker: 'B', en: 'I {saw a big castle}.', ja: '【大きなお城を見た】。' },
    ],
    relatedCategories: ['したこと'],
  },
  {
    id: 'g6-u8', grade: 6, unitName: 'Unit 8: My Future, My Dream', targetPhrase: 'I want to be a programmer.',
    lines: [
      { speaker: 'A', en: 'What do you want to be?', ja: '将来何になりたい？' },
      { speaker: 'B', en: 'I want to be {a vet}.', ja: '【獣医】になりたい。' },
      { speaker: 'A', en: 'Why?', ja: 'どうして？' },
      { speaker: 'B', en: 'I like {animals}.', ja: '【動物】が好きだから。' },
    ],
    relatedCategories: ['職業'],
  },
];
