/**
 * 浏览器语音识别。
 *
 * 只负责「声音 -> 文字」；文字后面走和打字完全一样的流程，
 * 所以语音不会绕过检查、预览和确认。
 */
export function speechSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function createRecognizer({ lang = 'zh-CN', onResult, onError, onEnd } = {}) {
  if (!speechSupported()) return null;
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = event => {
    const text = Array.from(event.results).map(result => result[0].transcript).join('');
    if (onResult) onResult(text);
  };
  recognition.onerror = event => { if (onError) onError(event.error); };
  recognition.onend = () => { if (onEnd) onEnd(); };

  return {
    start() {
      try { recognition.start(); return true; }
      catch (error) { if (onError) onError(error.message); return false; }
    },
    stop() {
      try { recognition.stop(); } catch (error) { /* 已经停了就算了 */ }
    },
  };
}
