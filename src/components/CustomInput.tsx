import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';

type SpeechRecognitionErrorCode =
  | 'aborted'
  | 'audio-capture'
  | 'bad-grammar'
  | 'language-not-supported'
  | 'network'
  | 'no-speech'
  | 'not-allowed'
  | 'phrases-not-supported'
  | 'service-not-allowed';

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative | undefined;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult | undefined;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: SpeechRecognitionErrorCode;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const SPEECH_IDLE_TIMEOUT_MS = 2000;

const getSpeechRecognition = (): SpeechRecognitionConstructor | null => {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
};

const isMobileBrowser = () => {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
};

const isSpeechAllowedContext = () => {
  if (typeof window === 'undefined') return false;
  return window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname);
};

const joinSpeechText = (parts: string[]) => parts.map(part => part.trim()).filter(Boolean).join(' ');

const getSpeechErrorText = (error: SpeechRecognitionErrorCode) => {
  const messages: Partial<Record<SpeechRecognitionErrorCode, string>> = {
    'audio-capture': '没有检测到可用麦克风。',
    'language-not-supported': '当前浏览器不支持中文语音识别。',
    network: '语音识别网络服务暂时不可用。',
    'no-speech': '没有听到语音，请再试一次。',
    'not-allowed': '麦克风权限被拒绝，请在浏览器地址栏允许麦克风。',
    'service-not-allowed': '浏览器阻止了语音识别服务。',
  };

  return messages[error] || '语音识别中断，请再试一次。';
};

export default function CustomInput() {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechMessage, setSpeechMessage] = useState('');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const speechBaseRef = useRef('');
  const idleTimerRef = useRef<number | null>(null);
  const intentionalStopRef = useRef(false);
  const gotSpeechRef = useRef(false);
  const submitAction = useGameStore(s => s.submitAction);
  const isProcessing = useGameStore(s => s.isProcessing);
  const errorMessage = useGameStore(s => s.errorMessage);
  const supportsSpeech = Boolean(getSpeechRecognition());

  const clearIdleTimer = () => {
    if (idleTimerRef.current === null) return;
    window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
  };

  const stopSpeechInput = (message?: string) => {
    clearIdleTimer();
    intentionalStopRef.current = true;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    if (message) setSpeechMessage(message);
  };

  const resetIdleTimer = () => {
    clearIdleTimer();
    idleTimerRef.current = window.setTimeout(() => {
      stopSpeechInput(gotSpeechRef.current ? '语音输入已自动结束。' : '没有听到语音，已自动结束。');
    }, SPEECH_IDLE_TIMEOUT_MS);
  };

  useEffect(() => {
    return () => {
      clearIdleTimer();
      intentionalStopRef.current = true;
      recognitionRef.current?.stop();
    };
  }, []);

  const handleSubmit = () => {
    if (!input.trim() || isProcessing) return;
    stopSpeechInput();
    submitAction('custom', input.trim());
    setInput('');
    speechBaseRef.current = '';
    setSpeechMessage('');
  };

  const toggleSpeechInput = () => {
    if (isProcessing) return;

    if (isListening) {
      stopSpeechInput('语音输入已停止。');
      return;
    }

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setSpeechMessage('当前浏览器不支持网页语音识别。手机端请优先使用安卓 Chrome / Edge，或使用系统键盘自带听写。');
      return;
    }

    if (!isSpeechAllowedContext()) {
      setSpeechMessage('语音输入需要 HTTPS 或 localhost 环境。请用 https 页面打开游戏。');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = !isMobileBrowser();
    recognition.interimResults = true;
    speechBaseRef.current = input.trim();
    intentionalStopRef.current = false;
    gotSpeechRef.current = false;

    recognition.onstart = () => {
      setIsListening(true);
      setSpeechMessage('正在听取中文语音，停顿 2 秒后自动结束...');
      resetIdleTimer();
    };

    recognition.onresult = event => {
      const finalParts: string[] = [];
      const interimParts: string[] = [];

      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript || '';
        if (!transcript.trim()) continue;

        if (result?.isFinal) {
          finalParts.push(transcript);
        } else {
          interimParts.push(transcript);
        }
      }

      const nextInput = joinSpeechText([
        speechBaseRef.current,
        joinSpeechText(finalParts),
        joinSpeechText(interimParts),
      ]);

      if (nextInput) {
        gotSpeechRef.current = true;
        setInput(nextInput);
      }
      setSpeechMessage('正在听取中文语音，停顿 2 秒后自动结束...');
      resetIdleTimer();
    };

    recognition.onerror = event => {
      if (intentionalStopRef.current && (event.error === 'aborted' || event.error === 'no-speech')) return;
      clearIdleTimer();
      recognitionRef.current = null;
      setIsListening(false);
      setSpeechMessage(getSpeechErrorText(event.error));
    };

    recognition.onend = () => {
      clearIdleTimer();
      recognitionRef.current = null;
      setIsListening(false);
      if (!intentionalStopRef.current && gotSpeechRef.current) {
        setSpeechMessage('语音输入已结束。');
      }
    };

    try {
      recognitionRef.current = recognition;
      setIsListening(true);
      setSpeechMessage('正在启动语音输入...');
      recognition.start();
      resetIdleTimer();
    } catch {
      clearIdleTimer();
      recognitionRef.current = null;
      setIsListening(false);
      setSpeechMessage('语音识别启动失败，请稍后再试。');
    }
  };

  return (
    <div>
      <div className="flex gap-1.5 lg:gap-2">
        <input
          className="input flex-1 min-w-0 text-sm"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
          placeholder="输入行动意图（如：绕到后门看看、调查痕迹、悄悄跟踪、询问NPC...）"
          disabled={isProcessing}
        />
        <button
          className={`btn voice-btn px-3 py-2 text-sm ${isListening ? 'listening' : ''}`}
          onClick={toggleSpeechInput}
          disabled={isProcessing}
          title={supportsSpeech ? '中文语音输入' : '当前浏览器不支持网页语音识别'}
          type="button"
        >
          <span className="voice-dot" aria-hidden="true" />
          <span>{isListening ? '停止' : '语音'}</span>
        </button>
        <button className="btn btn-primary px-3 lg:px-4 py-2" onClick={handleSubmit} disabled={!input.trim() || isProcessing}>
          行动
        </button>
      </div>
      <div className="hidden lg:block text-xs text-muted mt-1">
        可以写：移动/探索、观察/调查、对话/询问、潜行/跟踪、说服/交涉、使用物品、休息。不能写：直接获得金钱/物品/技能、生成NPC/敌人、秒杀、瞬移。
      </div>
      {speechMessage && (
        <div className={`text-xs mt-1 ${isListening ? 'text-muted' : 'text-danger'}`}>{speechMessage}</div>
      )}
      {errorMessage && (
        <div className="text-xs text-danger mt-1">{errorMessage}</div>
      )}
    </div>
  );
}
