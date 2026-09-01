(() => {
  const TOKEN_URL = "https://rraooqedkpyhokattwdz.supabase.co/functions/v1/ai_live_token";
  const WS_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";
  const MODEL = "models/gemini-3.1-flash-live-preview";

  let ws = null;
  let mediaStream = null;
  let inputContext = null;
  let inputSource = null;
  let processor = null;
  let silentGain = null;
  let outputContext = null;
  let nextPlayTime = 0;
  let activeSources = new Set();
  let connected = false;
  let starting = false;

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  function ensurePanel() {
    if ($("#aiLiveBackdrop")) return;
    const node = document.createElement("div");
    node.id = "aiLiveBackdrop";
    node.className = "ai-live-backdrop";
    node.hidden = true;
    node.innerHTML = `
      <section class="ai-live-panel" role="dialog" aria-modal="true" aria-labelledby="aiLiveTitle">
        <header class="ai-live-head">
          <div class="ai-live-badge" aria-hidden="true">🎙️</div>
          <div class="ai-live-title"><small>AI-CLO LIVE</small><h2 id="aiLiveTitle">Hỏi AI-CLO</h2></div>
          <button class="ai-live-close" type="button" aria-label="Đóng">×</button>
        </header>
        <div class="ai-live-body">
          <p class="ai-live-intro">Hỏi bằng tiếng Việt về hệ thống AI-CLO, các chức năng hoặc cách sử dụng. Micro chỉ bật sau khi bạn nhấn bắt đầu.</p>
          <div class="ai-live-status" data-state="idle"><span class="ai-live-dot"></span><span data-status>Chưa kết nối</span></div>
          <div class="ai-live-transcript" aria-live="polite"></div>
          <div class="ai-live-actions">
            <button class="ai-live-main" type="button">🎙️ Bắt đầu trò chuyện</button>
            <button class="ai-live-stop" type="button" hidden>Kết thúc</button>
          </div>
          <ul class="ai-live-hints"><li>“Giới thiệu hệ thống AI-CLO.”</li><li>“Giảng viên dùng hệ thống như thế nào?”</li><li>“Chấm thi CLO dùng để làm gì?”</li></ul>
          <p class="ai-live-privacy">Phiên thoại dùng Gemini Live. API key thật được giữ trên Supabase; trình duyệt chỉ nhận token tạm thời cho phiên hiện tại.</p>
        </div>
      </section>`;
    document.body.appendChild(node);
    $(".ai-live-close", node).addEventListener("click", closePanel);
    $(".ai-live-main", node).addEventListener("click", startLive);
    $(".ai-live-stop", node).addEventListener("click", stopLive);
    node.addEventListener("click", (e) => { if (e.target === node) closePanel(); });
  }

  function openPanel() {
    ensurePanel();
    $("#aiLiveBackdrop").hidden = false;
    document.documentElement.style.overflow = "hidden";
  }

  async function closePanel() {
    await stopLive();
    const panel = $("#aiLiveBackdrop");
    if (panel) panel.hidden = true;
    document.documentElement.style.overflow = "";
  }

  function setStatus(text, state = "idle") {
    const box = $(".ai-live-status");
    if (!box) return;
    box.dataset.state = state;
    $("[data-status]", box).textContent = text;
  }

  function resetButtons() {
    const main = $(".ai-live-main");
    const stop = $(".ai-live-stop");
    if (main) { main.disabled = false; main.textContent = "🎙️ Bắt đầu trò chuyện"; }
    if (stop) stop.hidden = true;
  }

  function addLine(role, text, append = false) {
    if (!text) return;
    const host = $(".ai-live-transcript");
    if (!host) return;
    const cls = role === "user" ? "user" : "ai";
    const label = role === "user" ? "BẠN" : "AI-CLO";
    let line = append ? host.querySelector(`.ai-live-line.${cls}:last-child`) : null;
    if (!line) {
      line = document.createElement("div");
      line.className = `ai-live-line ${cls}`;
      line.innerHTML = `<b>${label}</b><span></span>`;
      host.appendChild(line);
    }
    const span = $("span", line);
    span.textContent = append ? (span.textContent + text) : text;
    host.scrollTop = host.scrollHeight;
  }

  function base64FromBytes(bytes) {
    let binary = "";
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) {
      binary += String.fromCharCode(...bytes.subarray(i, i + step));
    }
    return btoa(binary);
  }

  function bytesFromBase64(b64) {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }

  function downsampleToPcm16(input, inputRate, outputRate = 16000) {
    if (outputRate >= inputRate) {
      const out = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const sample = Math.max(-1, Math.min(1, input[i]));
        out[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      }
      return out;
    }
    const ratio = inputRate / outputRate;
    const length = Math.round(input.length / ratio);
    const result = new Int16Array(length);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < input.length; i++) { accum += input[i]; count++; }
      const sample = Math.max(-1, Math.min(1, accum / Math.max(1, count)));
      result[offsetResult++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }

  function prepareOutputAudio() {
    if (!outputContext) {
      outputContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      nextPlayTime = outputContext.currentTime;
    }
    if (outputContext.state === "suspended") outputContext.resume().catch(() => {});
  }

  async function startMic() {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      video: false,
    });
    inputContext = new (window.AudioContext || window.webkitAudioContext)();
    await inputContext.resume();
    inputSource = inputContext.createMediaStreamSource(mediaStream);
    processor = inputContext.createScriptProcessor(4096, 1, 1);
    silentGain = inputContext.createGain();
    silentGain.gain.value = 0;
    processor.onaudioprocess = (event) => {
      if (!connected || !ws || ws.readyState !== WebSocket.OPEN) return;
      const samples = event.inputBuffer.getChannelData(0);
      const pcm16 = downsampleToPcm16(samples, inputContext.sampleRate, 16000);
      const bytes = new Uint8Array(pcm16.buffer);
      ws.send(JSON.stringify({ realtimeInput: { audio: { data: base64FromBytes(bytes), mimeType: "audio/pcm;rate=16000" } } }));
    };
    inputSource.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(inputContext.destination);
  }

  async function playPcm(base64) {
    if (!base64) return;
    prepareOutputAudio();
    await outputContext.resume();
    const bytes = bytesFromBase64(base64);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const samples = new Float32Array(Math.floor(bytes.byteLength / 2));
    for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
    const buffer = outputContext.createBuffer(1, samples.length, 24000);
    buffer.copyToChannel(samples, 0);
    const source = outputContext.createBufferSource();
    source.buffer = buffer;
    source.connect(outputContext.destination);
    const now = outputContext.currentTime;
    nextPlayTime = Math.max(nextPlayTime, now + 0.02);
    source.start(nextPlayTime);
    nextPlayTime += buffer.duration;
    activeSources.add(source);
    source.onended = () => activeSources.delete(source);
    setStatus("AI-CLO đang trả lời…", "speaking");
  }

  function clearPlayback() {
    for (const source of activeSources) { try { source.stop(); } catch {} }
    activeSources.clear();
    nextPlayTime = outputContext?.currentTime || 0;
  }

  async function getToken() {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok || !data.token) {
      throw new Error(data.detail || data.error || `Không lấy được Live token (${response.status}).`);
    }
    return data.token;
  }

  async function startLive() {
    if (starting || connected) return;
    starting = true;
    const main = $(".ai-live-main");
    const stop = $(".ai-live-stop");
    if (main) main.disabled = true;
    setStatus("Đang xin phiên trò chuyện an toàn…", "connecting");

    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Trình duyệt này chưa hỗ trợ microphone trên trang web.");

      // Khởi tạo audio output ngay từ thao tác bấm của người dùng để Safari/iOS cho phép phát tiếng.
      prepareOutputAudio();

      const token = await getToken();
      await startMic();
      const url = `${WS_URL}?access_token=${encodeURIComponent(token)}`;
      const socket = new WebSocket(url);
      ws = socket;

      socket.onopen = () => {
        const knowledge = window.AICLO_LIVE_KNOWLEDGE || "Bạn là trợ lý AI-CLO PTITHCM. Hãy nói tiếng Việt và chỉ giới thiệu hệ thống.";
        socket.send(JSON.stringify({
          setup: {
            model: MODEL,
            generationConfig: { responseModalities: ["AUDIO"] },
            systemInstruction: { parts: [{ text: knowledge }] },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            realtimeInputConfig: {
              automaticActivityDetection: {
                prefixPaddingMs: 120,
                silenceDurationMs: 700,
              },
            },
          },
        }));
      };

      socket.onmessage = async (event) => {
        let message;
        try { message = JSON.parse(event.data); } catch { return; }

        if (message.setupComplete) {
          connected = true;
          starting = false;
          if (main) { main.disabled = false; main.textContent = "🎙️ Đang trò chuyện"; }
          if (stop) stop.hidden = false;
          setStatus("Đang nghe — bạn hãy nói bằng tiếng Việt", "listening");
          return;
        }

        if (message.goAway?.timeLeft) {
          setStatus("Phiên Live sắp kết thúc, bạn có thể hoàn tất câu hỏi hiện tại", "connecting");
        }

        const content = message.serverContent;
        if (!content) return;
        if (content.interrupted) {
          clearPlayback();
          setStatus("Đang nghe — bạn có thể nói tiếp", "listening");
        }
        if (content.inputTranscription?.text) addLine("user", content.inputTranscription.text, true);
        if (content.outputTranscription?.text) addLine("ai", content.outputTranscription.text, true);
        for (const part of content.modelTurn?.parts || []) {
          if (part.inlineData?.data) await playPcm(part.inlineData.data);
        }
        if (content.turnComplete) setStatus("Đang nghe — bạn có thể hỏi tiếp", "listening");
      };

      socket.onerror = () => setStatus("Lỗi kết nối Gemini Live", "error");
      socket.onclose = (event) => {
        if (ws === socket) ws = null;
        connected = false;
        starting = false;
        clearPlayback();
        void releaseMic();
        resetButtons();
        if (!$("#aiLiveBackdrop")?.hidden) {
          const detail = event.reason ? `: ${event.reason}` : "";
          setStatus(`Phiên trò chuyện đã kết thúc${detail}`, event.code === 1000 ? "idle" : "error");
        }
      };
    } catch (error) {
      starting = false;
      if (main) main.disabled = false;
      setStatus(error?.message || "Không thể bắt đầu AI-CLO Live", "error");
      await releaseMic();
    }
  }

  async function releaseMic() {
    if (processor) { processor.onaudioprocess = null; try { processor.disconnect(); } catch {} processor = null; }
    if (silentGain) { try { silentGain.disconnect(); } catch {} silentGain = null; }
    if (inputSource) { try { inputSource.disconnect(); } catch {} inputSource = null; }
    if (mediaStream) { mediaStream.getTracks().forEach((t) => t.stop()); mediaStream = null; }
    if (inputContext) { try { await inputContext.close(); } catch {} inputContext = null; }
  }

  async function stopLive() {
    const currentSocket = ws;
    ws = null;
    if (currentSocket) {
      currentSocket.onclose = null;
      currentSocket.onerror = null;
      if (currentSocket.readyState === WebSocket.OPEN) {
        try { currentSocket.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } })); } catch {}
        try { currentSocket.close(1000, "User ended session"); } catch {}
      } else {
        try { currentSocket.close(); } catch {}
      }
    }
    connected = false;
    starting = false;
    clearPlayback();
    await releaseMic();
    if (outputContext) { try { await outputContext.close(); } catch {} outputContext = null; }
    resetButtons();
    setStatus("Chưa kết nối", "idle");
  }

  document.addEventListener("DOMContentLoaded", () => {
    ensurePanel();
    $$(".public-ai-button").forEach((btn) => btn.addEventListener("click", openPanel));
  });
})();
