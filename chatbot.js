(function () {
  const STYLES = `
    #eduleo-chat-wrapper {
      position: fixed; bottom: 28px; right: 24px; z-index: 9999;
      display: flex; align-items: center; gap: 10px;
    }
    #eduleo-chat-label {
      background: #7A5240; color: #fff;
      padding: 10px 16px; border-radius: 24px;
      font-size: 14px; font-weight: 700; white-space: nowrap;
      box-shadow: 0 4px 16px rgba(0,0,0,0.18);
      cursor: pointer; font-family: 'Nunito', sans-serif;
    }
    #eduleo-chat-label:hover { background: #5C3D2E; }
    #eduleo-chat-window {
      position: fixed; bottom: 90px; right: 24px; z-index: 9999;
      width: 340px; max-width: calc(100vw - 32px);
      background: #FAF7F5; border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
      display: none; flex-direction: column; overflow: hidden;
      font-family: 'Nunito', sans-serif;
    }
    #eduleo-chat-window.open { display: flex; }
    @media (max-width: 600px) {
      #eduleo-chat-wrapper {
        bottom: 20px;
      }
      #eduleo-chat-window {
        top: 80px; left: 0; right: 0; bottom: 0;
        width: 100%; max-width: 100%;
        border-radius: 0;
        height: auto;
      }
      #eduleo-chat-messages { max-height: none; }
      #eduleo-chat-wrapper.chat-active { display: none; }
    }
    #eduleo-chat-header {
      background: #7A5240; color: #fff;
      padding: 14px 18px; display: flex; align-items: center; gap: 10px;
    }
    #eduleo-chat-header img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
    #eduleo-chat-header-text { flex: 1; }
    #eduleo-chat-header-text strong { display: block; font-size: 14px; }
    #eduleo-chat-header-text span { font-size: 12px; opacity: 0.85; }
    #eduleo-chat-close {
      background: none; border: none; color: #fff; font-size: 20px;
      cursor: pointer; padding: 0; line-height: 1;
    }
    #eduleo-chat-messages {
      flex: 1; padding: 16px; overflow-y: auto; max-height: 320px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .eduleo-msg { max-width: 82%; padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.5; }
    .eduleo-msg.bot { background: #EDE6E2; color: #3D302A; align-self: flex-start; border-bottom-left-radius: 4px; }
    .eduleo-msg.user { background: #7A5240; color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }
    .eduleo-msg a { color: inherit; text-decoration: underline; }
    .eduleo-typing { display: flex; gap: 4px; align-items: center; padding: 10px 14px; }
    .eduleo-typing span { width: 7px; height: 7px; background: #9E7060; border-radius: 50%; animation: eduleo-bounce 1s infinite; }
    .eduleo-typing span:nth-child(2) { animation-delay: 0.15s; }
    .eduleo-typing span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes eduleo-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
    #eduleo-chat-input-area {
      padding: 12px 14px; border-top: 1px solid #D8CEC8;
      display: flex; gap: 8px; background: #fff;
    }
    #eduleo-chat-input {
      flex: 1; border: 1px solid #D8CEC8; border-radius: 8px;
      padding: 8px 12px; font-size: 14px; outline: none; resize: none;
      font-family: inherit; background: #FAF7F5; color: #3D302A;
    }
    #eduleo-chat-input:focus { border-color: #7A5240; }
    #eduleo-chat-send {
      background: #7A5240; color: #fff; border: none; border-radius: 8px;
      padding: 8px 14px; cursor: pointer; font-size: 18px; transition: background 0.2s;
    }
    #eduleo-chat-send:hover { background: #5C3D2E; }
    #eduleo-chat-send:disabled { background: #C4A092; cursor: default; }
  `;

  const style = document.createElement('style');
  style.textContent = STYLES;
  document.head.appendChild(style);

  const wrapper = document.createElement('div');
  wrapper.id = 'eduleo-chat-wrapper';

  const label = document.createElement('div');
  label.id = 'eduleo-chat-label';
  label.textContent = '💬 Frag uns!';

  wrapper.appendChild(label);
  document.body.appendChild(wrapper);

  const win = document.createElement('div');
  win.id = 'eduleo-chat-window';
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', 'EDULEO Chat');
  win.innerHTML = `
    <div id="eduleo-chat-header">
      <img src="/assets/images/logo.png" alt="EDULEO">
      <div id="eduleo-chat-header-text">
        <strong>EDULEO Akademie</strong>
        <span>Wie kann ich dir helfen?</span>
      </div>
      <button id="eduleo-chat-close" aria-label="Chat schließen">×</button>
    </div>
    <div id="eduleo-chat-messages"></div>
    <div id="eduleo-chat-input-area">
      <textarea id="eduleo-chat-input" rows="1" placeholder="Schreib uns..."></textarea>
      <button id="eduleo-chat-send" aria-label="Senden">➤</button>
    </div>
  `;
  document.body.appendChild(win);

  const messages = document.getElementById('eduleo-chat-messages');
  const input = document.getElementById('eduleo-chat-input');
  const sendBtn = document.getElementById('eduleo-chat-send');

  let history = [];
  let opened = false;

  function addMsg(text, role) {
    const el = document.createElement('div');
    el.className = 'eduleo-msg ' + role;
    el.innerHTML = text.replace(/\n/g, '<br>').replace(/(https?:\/\/\S+)/g, '<a href="$1" target="_blank">$1</a>').replace(/(\/fortbildungen\/[^\s,)]+)/g, '<a href="$1">$1</a>');
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  function showTyping() {
    const el = document.createElement('div');
    el.className = 'eduleo-msg bot eduleo-typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  async function send() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    sendBtn.disabled = true;
    addMsg(text, 'user');
    const typing = showTyping();
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      typing.remove();
      addMsg(data.reply, 'bot');
      history.push({ role: 'user', content: text });
      history.push({ role: 'assistant', content: data.reply });
    } catch {
      typing.remove();
      addMsg('Entschuldigung, da ist etwas schiefgelaufen. Schreib uns gerne an kontakt@eduleo-akademie.de!', 'bot');
    }
    sendBtn.disabled = false;
    input.focus();
  }

  function openChat() {
    win.classList.add('open');
    wrapper.classList.add('chat-active');
    if (!opened) {
      opened = true;
      addMsg('Hallo! 👋 Ich bin Leo, der Chatbot der EDULEO Akademie. Ich helfe dir gerne, die passende Fortbildung zu finden. Was interessiert dich?', 'bot');
    }
    input.focus();
  }

  function closeChat() {
    win.classList.remove('open');
    wrapper.classList.remove('chat-active');
  }

  label.addEventListener('click', () => {
    if (win.classList.contains('open')) { closeChat(); } else { openChat(); }
  });

  document.getElementById('eduleo-chat-close').addEventListener('click', closeChat);

  sendBtn.addEventListener('click', send);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
})();
