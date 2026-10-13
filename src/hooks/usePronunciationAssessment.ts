import { micPermissionHelp } from './useSpeechRecognition';
import { useState, useCallback, useRef, useEffect } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { isOverCap, incUsage, getUsage, getCap } from '../lib/apiUsage';
import { logVoiceEvent, azureCode } from '../lib/voiceLog';
import { showToast } from '../components/ui/Toast';
import { fetchAzureSpeechToken, ProxyError } from '../lib/aiProxy';
import { useAppSettings } from './useAppSettings';

export interface WordScore {
  word: string;
  accuracyScore: number;
  errorType: string;
}

export interface PronunciationResult {
  recognizedText: string;
  accuracyScore: number;      // 発音の正確さ (0-100)
  pronunciationScore: number; // 総合スコア (0-100)
  fluencyScore: number;       // なめらかさ
  completenessScore: number;  // 言い切れたか
  words: WordScore[];
}

// Float32(-1〜1) の音声サンプルを 16bit PCM (リトルエンディアン) に変換する。
const floatTo16BitPCM = (input: Float32Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
};

// 16kHz mono の 16bit PCM チャンクをまとめて、再生できる WAV(Blob) にする。
const encodeWav = (chunks: Float32Array[], sampleRate: number): Blob => {
  let length = 0;
  for (const c of chunks) length += c.length;
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, length * 2, true);

  let offset = 44;
  for (const c of chunks) {
    for (let i = 0; i < c.length; i++) {
      const s = Math.max(-1, Math.min(1, c[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
};

// マイクのサンプルレート（48000等）を Azure が要求する 16000Hz に落とす。
const downsample = (buffer: Float32Array, inRate: number, outRate: number): Float32Array => {
  if (outRate >= inRate) return buffer;
  const ratio = inRate / outRate;
  const newLen = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLen);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < newLen) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
};

/**
 * Azure Pronunciation Assessment hook.
 *
 * マイクは getUserMedia で「1回だけ」取得して保持し、WebAudio で 16kHz PCM に変換して
 * Azure の PushStream に流し込む。SDK 任せの fromDefaultMicrophoneInput だと、Chrome で
 * 2回目以降の録音が空（NoMatch）になる不具合があったため、自前で録音を握る方式にしている。
 *
 * キーはブラウザに置かない。Edge Function（azure-token）から10分有効のトークンを
 * 毎回もらって接続する。
 */
// 録音がほぼ無音か（RMSで判定）。マイク不調と「聞き取れなかった」を区別するために使う。
const isNearSilent = (chunks: Float32Array[]): boolean => {
  let sum = 0;
  let n = 0;
  for (const c of chunks) {
    for (let i = 0; i < c.length; i += 4) { // 1/4サンプリングで十分
      sum += c[i] * c[i];
      n++;
    }
  }
  if (n === 0) return true;
  return Math.sqrt(sum / n) < 0.008; // ほぼ無音のしきい値
};

// Azureからの中止理由を、子ども向けの言葉にする。混雑（429/throttle）は true を返して再試行の対象にする。
const explainCancel = (details: string): { msg: string; throttled: boolean } => {
  const d = details || '';
  if (/429|4429|Too many|throttl|quota|exceeded/i.test(d)) {
    return { msg: '⏳ いま みんなが 発音チェックを 使っていて 混んでいます。少し待って もう一度試してね', throttled: true };
  }
  if (/401|403|Authentication|subscription|key/i.test(d)) {
    return { msg: '🔑 発音チェックの 設定に 問題があるみたい。先生を呼んでね', throttled: false };
  }
  if (/1006|network|WebSocket|Unable to contact|connection/i.test(d)) {
    return { msg: '📶 通信が とぎれたみたい。少し待って もう一度試してね', throttled: false };
  }
  return { msg: '⚠️ 発音チェックが できなかったよ。もう一度試して、直らなければ 先生に 伝えてね', throttled: false };
};

// 「Azureが認証を拒否する／サーバーにキーが無い」状態を覚えておくための印。
// これが無いと、毎回1人ずつ失敗し続けるだけで、Web Speechへの切り替えも起きない
// （実際に2026年7月から、設定はあるのに全滅、という状態が続いていた）。
// キーはサーバー側で差し替わるので、印は1時間で自動的に切れる。
const AUTH_FLAG = 'azureAuthFailedAt';
const AUTH_FLAG_TTL_MS = 60 * 60 * 1000;
const readAuthFailed = () => {
  try { return Date.now() - Number(localStorage.getItem(AUTH_FLAG) || 0) < AUTH_FLAG_TTL_MS; } catch { return false; }
};

// 上限のお知らせ（故障ではない）。VoiceBattle側はこの文で始まるときだけ、
// 「⚠️ Azureエラー」ではなく「お知らせ」として出す。
export const CAP_NOTICE =
  '🌙 今日ぶんの 発音チェックは 終わり！ こわれてないよ。'
  + 'みんなで たくさん使ったので、また明日 使えるようになるよ。'
  + '今日は「聞く」「書く」「タイピング」で 練習しよう！';

export const usePronunciationAssessment = () => {
  const [isAssessing, setIsAssessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 直近の失敗理由（呼び出し側がトースト表示に使う。state更新の遅延に左右されないようref）
  const lastErrorRef = useRef<string | null>(null);

  const [lastRecordingUrl, setLastRecordingUrl] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  // 録音中だけ、ここに今回の PushStream を入れる。processor はこれがある時だけ書き込む。
  const activePushRef = useRef<SpeechSDK.PushAudioInputStream | null>(null);
  // 録音再生用に、流し込んだのと同じ 16kHz PCM を溜めておく。
  const recordedChunksRef = useRef<Float32Array[]>([]);

  // 認証に失敗していると分かっている間は「使えない」として扱う
  const [authFailed, setAuthFailed] = useState<boolean>(readAuthFailed);

  const markAuthFailed = useCallback(() => {
    try { localStorage.setItem(AUTH_FLAG, String(Date.now())); } catch { /* noop */ }
    setAuthFailed(true);
    showToast('🎙️ 発音チェックが いま使えないので、かんたんな聞き取りに きり変えたよ（先生に 伝えてね）', 'fail');
  }, []);

  // 認証に失敗すると分かっている／先生がオフにしている間は「使えない」＝呼び出し側は
  // Web Speech（ブラウザの聞き取り）に自動で切り替わる。
  const { azureDisabled } = useAppSettings();
  const isAvailable = !authFailed && !azureDisabled;

  // マイク＋WebAudio のパイプラインを一度だけ用意する（クリック起点で呼ぶ）。
  const ensurePipeline = useCallback(async () => {
    if (audioCtxRef.current) {
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }
      return;
    }
    // 教室の雑音対策：ノイズ抑制・エコー除去・自動ゲインをON。
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true,
      },
    });
    mediaStreamRef.current = stream;

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    if (ctx.state === 'suspended') await ctx.resume();

    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (e) => {
      const push = activePushRef.current;
      if (!push) return;
      const input = e.inputBuffer.getChannelData(0);
      const down = downsample(input, ctx.sampleRate, 16000);
      push.write(floatTo16BitPCM(down));
      recordedChunksRef.current.push(down); // 再生用に同じ音を控えておく
    };

    // 出力は無音にしてマイクの音がスピーカーに回り込まないようにする。
    const muteGain = ctx.createGain();
    muteGain.gain.value = 0;

    source.connect(processor);
    processor.connect(muteGain);
    muteGain.connect(ctx.destination);
  }, []);

  // アンマウント時にマイクとオーディオを片付ける。
  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      mediaStreamRef.current = null;
    };
  }, []);

  const assess = useCallback(
    async (referenceText: string, opts?: { graceExtra?: number }): Promise<PronunciationResult | null> => {
      // 1日の発音チェック上限に達していたら、Azureを呼ばずに止める（課金の安全装置）。
      // graceExtra：上限より前に始めたバトルは、上限を少し越えても最後まで終われる（子どもの声 2026-10-14
      // 「後一個だったのにー！」）。越えてよいのは graceExtra 回まで（無限には使えない）。
      const inGrace = !!opts?.graceExtra && getCap('azure') > 0 && getUsage('azure') < getCap('azure') + opts.graceExtra;
      if (isOverCap('azure') && !inGrace) {
        // 「⚠️Azureエラー」と並べると子どもには意味が伝わらない（子どもの声 2026-09-16）。
        // 故障ではなく「今日ぶんを使い切った」ことと、代わりにできることを伝える。
        setError(CAP_NOTICE);
        return null;
      }

      setError(null);
      lastErrorRef.current = null;
      setIsAssessing(true);

      // マイクの準備と並行して、Azureの使い捨てトークン（10分有効）をサーバーからもらう。
      const tokenPromise = fetchAzureSpeechToken().catch((e: unknown) => e as Error);

      try {
        await ensurePipeline();
      } catch (e) {
        setIsAssessing(false);
        lastErrorRef.current = micPermissionHelp();
        setError(lastErrorRef.current);
        logVoiceEvent({ kind: 'mic', ok: false, code: 'denied', detail: String(e) });
        return null;
      }

      const auth = await tokenPromise;
      if (auth instanceof Error) {
        setIsAssessing(false);
        const status = auth instanceof ProxyError ? auth.status : 0;
        // 429＝クラス全体の上限（故障ではない）／502・503＝キーが拒否 or 未設定
        const msg = status === 429 ? CAP_NOTICE : auth.message;
        logVoiceEvent({ kind: 'azure', ok: false, code: `token-${status || 'net'}`, detail: auth.message });
        if (status === 502 || status === 503) markAuthFailed();
        lastErrorRef.current = msg;
        setError(msg);
        return null;
      }

      // 1回の採点処理。live=true ならマイクから流し込む。
      // replay に録音済みチャンクを渡すと、同じ音声をもう一度Azureに送る（混雑時のリトライ用。
      // 子どもにもう一度言わせなくて済む）。
      const runOnce = (replay: Float32Array[] | null, allowRetry: boolean): Promise<PronunciationResult | null> =>
      new Promise((resolve) => {
        // エンドポイントが設定されていればそれを優先（カスタムドメインのリソース対応）
        let speechConfig: SpeechSDK.SpeechConfig;
        if (auth.endpoint) {
          speechConfig = SpeechSDK.SpeechConfig.fromEndpoint(new URL(auth.endpoint));
          speechConfig.authorizationToken = auth.token;
        } else {
          speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(auth.token, auth.region);
        }
        speechConfig.speechRecognitionLanguage = 'en-US';
        speechConfig.setProperty(
          SpeechSDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,
          '15000'
        );
        speechConfig.setProperty(
          SpeechSDK.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs,
          '1500'
        );
        // 言葉の途中で少し間があいても「言い終わった」と判定しない（子どもの声 2026-09-24
        // 「しゃべり切る前にミスになる」）。1回で聞き取るときの区切りは、こちらの「間」で決まる
        // （既定は0.5秒ほど。ゆっくり・区切って言う子には短すぎた）。
        speechConfig.setProperty(
          SpeechSDK.PropertyId.Speech_SegmentationSilenceTimeoutMs,
          '1200'
        );

        const format = SpeechSDK.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
        const pushStream = SpeechSDK.AudioInputStream.createPushStream(format);
        const audioConfig = SpeechSDK.AudioConfig.fromStreamInput(pushStream);
        const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

        const paConfig = new SpeechSDK.PronunciationAssessmentConfig(
          referenceText,
          SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
          SpeechSDK.PronunciationAssessmentGranularity.Phoneme,
          true // enableMiscue
        );
        paConfig.applyTo(recognizer);

        if (replay) {
          // 録音済みの音声をそのまま流し込んで閉じる（マイクは使わない）
          for (const c of replay) pushStream.write(floatTo16BitPCM(c));
          pushStream.close();
        } else {
          // ここから processor の音声が pushStream に流れ込む。録音バッファもリセット。
          recordedChunksRef.current = [];
          activePushRef.current = pushStream;
        }

        const finish = (value: PronunciationResult | null) => {
          activePushRef.current = null;
          // 今回マイクから拾った音を WAV にして、再生できるようにする。
          const chunks = replay || recordedChunksRef.current;
          if (!replay) recordedChunksRef.current = [];
          if (chunks.length > 0) {
            setLastRecordingUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return URL.createObjectURL(encodeWav(chunks, 16000));
            });
          }
          try {
            pushStream.close();
          } catch {
            /* noop */
          }
          recognizer.close();
          setIsAssessing(false);
          resolve(value);
        };

        incUsage('azure'); // ここでAzureを実際に呼ぶので1回ぶん計上する
        recognizer.recognizeOnceAsync(
          (result) => {
            try {
              if (result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
                const pa = SpeechSDK.PronunciationAssessmentResult.fromResult(result);
                const detail: any = pa.detailResult || {};
                const words: WordScore[] = (detail.Words || []).map((w: any) => ({
                  word: w.Word,
                  accuracyScore: w.PronunciationAssessment?.AccuracyScore ?? 0,
                  errorType: w.PronunciationAssessment?.ErrorType ?? 'None',
                }));
                logVoiceEvent({ kind: 'azure', ok: true, code: replay ? 'ok-after-retry' : 'ok' });
                finish({
                  recognizedText: result.text || '',
                  accuracyScore: pa.accuracyScore,
                  pronunciationScore: pa.pronunciationScore,
                  fluencyScore: pa.fluencyScore,
                  completenessScore: pa.completenessScore,
                  words,
                });
              } else if (result.reason === SpeechSDK.ResultReason.Canceled) {
                const cancel = SpeechSDK.CancellationDetails.fromResult(result);
                console.error('Azure canceled:', cancel.errorDetails);
                const { msg, throttled } = explainCancel(cancel.errorDetails || '');
                const chunks = replay || recordedChunksRef.current;
                const code = azureCode(cancel.errorDetails || '');
                logVoiceEvent({ kind: 'azure', ok: false, code: code + (replay ? '-retry' : ''), detail: cancel.errorDetails || '' });
                // キーや設定が原因（401/403）なら、以後この設定ではAzureを使わない
                if (code === 'auth') markAuthFailed();
                if (throttled && allowRetry && chunks.length > 0) {
                  // 混雑：同じ録音で1回だけ自動リトライ（子どもは待つだけ）
                  const keep = chunks.slice();
                  activePushRef.current = null;
                  try { pushStream.close(); } catch { /* noop */ }
                  recognizer.close();
                  setTimeout(() => { runOnce(keep, false).then(resolve); }, 1800);
                  return;
                }
                lastErrorRef.current = msg;
                setError(msg);
                finish(null);
              } else {
                // 無音 / 認識できず（NoMatch）：0点として記録せず null を返して再挑戦させる。
                // さらに録音がほぼ無音なら「マイクが拾えていない」と案内を分ける（P0-3）。
                const silent = isNearSilent(replay || recordedChunksRef.current);
                logVoiceEvent({ kind: 'azure', ok: false, code: silent ? 'silent' : 'nomatch' });
                const msg = silent
                  ? '🎙️ マイクの音が届いていないみたい。イヤホンマイクのさしこみや、マイクの許可を確かめて、先生を呼ぼう！'
                  : '声が聞き取れなかったよ。もう一度マイクを押して、ゆっくりはっきり言ってみてね';
                lastErrorRef.current = msg;
                setError(msg);
                finish(null);
              }
            } catch (e) {
              setError(String(e));
              finish(null);
            }
          },
          (err) => {
            const { msg } = explainCancel(String(err));
            logVoiceEvent({ kind: 'azure', ok: false, code: azureCode(String(err)), detail: String(err) });
            lastErrorRef.current = msg;
            setError(msg);
            finish(null);
          }
        );
      });

      return runOnce(null, true);
    },
    [ensurePipeline, markAuthFailed]
  );

  // 直近の失敗理由（トースト用）。assessがnullを返した直後に呼ぶ。
  const getLastError = () => lastErrorRef.current;

  return { assess, isAssessing, error, isAvailable, lastRecordingUrl, getLastError };
};
