const log = document.getElementById('log');
const form = document.getElementById('form');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const chips = document.getElementById('chips');

const history = [];
let busy = false;

for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'chip';
  btn.textContent = letter;
  btn.title = `Dessiner la lettre ${letter} en vecto`;
  btn.addEventListener('click', () => {
    input.value = `Dessine la lettre « ${letter} » en vecto`;
    form.requestSubmit();
  });
  chips.appendChild(btn);
}

function extractSvg(text) {
  const m = text.match(/<svg[\s\S]*?<\/svg>/i);
  return m ? m[0] : null;
}

function sanitizeSvg(svgText) {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const svg = doc.documentElement;
  if (svg.tagName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) return null;
  const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_ELEMENT);
  const toRemove = [];
  while (walker.nextNode()) {
    const el = walker.currentNode;
    if (el.tagName.toLowerCase() === 'script') { toRemove.push(el); continue; }
    for (const attr of [...el.attributes]) {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
    }
  }
  for (const el of toRemove) el.remove();
  return svg;
}

function appendAssistantContent(bubble, content) {
  const svgText = extractSvg(content);
  const text = (svgText ? content.replace(svgText, '') : content).trim();
  if (text) {
    const p = document.createElement('div');
    p.textContent = text;
    bubble.appendChild(p);
  }
  if (svgText) {
    const svg = sanitizeSvg(svgText);
    if (svg) {
      const box = document.createElement('div');
      box.className = 'vecto';
      box.appendChild(svg);
      bubble.appendChild(box);
      const a = document.createElement('a');
      a.className = 'dl';
      a.textContent = 'Télécharger le .svg';
      a.download = 'lettre.svg';
      a.href = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
      bubble.appendChild(a);
    }
  }
}

function addMessage(role, content) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  if (role === 'assistant') {
    appendAssistantContent(div, content);
  } else {
    div.textContent = content;
  }
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}

input.addEventListener('input', () => {
  sendBtn.disabled = !input.value.trim() || busy;
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const content = input.value.trim();
  if (!content || busy) return;
  busy = true;
  sendBtn.disabled = true;
  input.value = '';
  history.push({ role: 'user', content });
  addMessage('user', content);
  const pending = addMessage('assistant', '…');
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    history.push({ role: 'assistant', content: data.reply });
    pending.textContent = '';
    appendAssistantContent(pending, data.reply);
    log.scrollTop = log.scrollHeight;
  } catch (err) {
    pending.className = 'msg error';
    pending.textContent = `Erreur : ${err.message}`;
  } finally {
    busy = false;
    sendBtn.disabled = !input.value.trim();
    input.focus();
  }
});
