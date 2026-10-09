/* Cozy Notebook – sticker catalogue and page templates */
(function () {
  const NB = window.NB;

  NB.EMOJI = {
    Cozy: '☕ 🍵 🧸 🕯️ 🧶 🧦 📚 🪴 🌿 🍂 🍁 🔥 🛋️ 🧣 🍪 🥐 🍯 🫖 🪟 🌙 ⭐ ✨ 🏡 💌'.split(' '),
    Nature: '🌸 🌼 🌻 🌷 🌹 🌺 🍀 🌱 🌳 🌲 🌵 🍄 🪻 🌾 🐝 🦋 🐞 🌈 ☀️ 🌤️ ☁️ 🌧️ ❄️ ⚡'.split(' '),
    Animals: '🐶 🐱 🐰 🦊 🐻 🐼 🐨 🐸 🐥 🦉 🐢 🐙 🐳 🦄 🐝 🦔 🐿️ 🐑 🐮 🐷 🦆 🐠 🐾 🐈'.split(' '),
    Food: '🍎 🍓 🍒 🍑 🍋 🍉 🍇 🥑 🥕 🌽 🍞 🧀 🍕 🍔 🍜 🍣 🍰 🧁 🍩 🍫 🍦 🥤 🍷 🍳'.split(' '),
    Hearts: '❤️ 🧡 💛 💚 💙 💜 🩷 🤎 🖤 🤍 💖 💗 💝 💕 💞 💘 💓 💟 ♥️ 😍 🥰 😘 🫶 ❣️'.split(' '),
    Faces: '😀 😊 😂 🥹 😌 😎 🤓 🤔 😴 🥳 😭 😡 🤯 😇 🙃 😋 🤗 😬 🥺 😮 😅 🫠 😏 🤩'.split(' '),
    Study: '📝 ✏️ 🖍️ 🖊️ 📏 📐 📌 📍 🔖 📎 🗂️ 📅 📆 ⏰ 💡 🔍 🎯 🏆 ✅ ❗ ❓ 💯 📖 🎓'.split(' '),
    Fun: '🎉 🎊 🎈 🎁 🎂 🎵 🎶 🎨 🎬 🎮 📷 ✈️ 🚲 ⚽ 🏀 🎸 🧩 🎲 🪁 🚀 🌍 🏖️ ⛺ 🧳'.split(' '),
    Symbols: '⭐ 🌟 ✨ 💫 🔥 💥 💬 💭 ➡️ ⬅️ ⬆️ ⬇️ ↩️ ➕ ➖ ✔️ ❌ ⭕ 🔴 🟠 🟡 🟢 🔵 🟣 ♾️'.split(' '),
  };

  const mk = (type, props) => NB.makeItem(type, props);
  const F = () => NB.FONTS;

  const T = (x, y, w, html, extra = {}) => mk('text', Object.assign({ x, y, w, h: 40, html, size: 22 }, extra));
  const Head = (x, y, w, txt) => mk('text', { x, y, w, h: 40, html: '<b>' + txt + '</b>', font: F()[0].css, size: 32, textColor: '#b5533c' });

  NB.TEMPLATES = [
    { id: 'blank', name: 'Blank page', icon: '📄', paper: null, build: () => [] },
    { id: 'lined', name: 'Lined', icon: '📃', paper: 'lined', build: () => [] },
    { id: 'grid', name: 'Grid', icon: '▦', paper: 'grid', build: () => [] },
    { id: 'dots', name: 'Dotted', icon: '⠿', paper: 'dots', build: () => [] },
    { id: 'cornell', name: 'Cornell notes', icon: '🎓', paper: 'cornell', build: () => [mk('text', { x: 40, y: 120, w: 170, h: 60, html: '<b>Cues</b>', font: F()[0].css, size: 28, textColor: '#b5533c' }), mk('text', { x: 40, y: 960, w: 600, h: 40, html: '<b>Summary</b>', font: F()[0].css, size: 28, textColor: '#b5533c' })] },
    {
      id: 'journal', name: 'Daily journal', icon: '🌅', paper: 'lined', title: 'Today ☀️',
      build: () => [
        Head(90, 110, 400, 'How I feel'),
        mk('sticker', { glyph: '🙂', x: 520, y: 100, w: 70, h: 70 }),
        mk('sticker', { glyph: '😴', x: 600, y: 100, w: 70, h: 70, opacity: 0.45 }),
        mk('sticker', { glyph: '🤩', x: 680, y: 100, w: 70, h: 70, opacity: 0.45 }),
        mk('todo', { x: 90, y: 200, w: 340, h: 220, title: 'Top 3 today', items: [{ t: '', d: false }, { t: '', d: false }, { t: '', d: false }] }),
        mk('sticky', { x: 500, y: 210, w: 230, h: 200, rot: 2, color: '#d7f0c2', html: '<b>Grateful for…</b><br>', size: 26 }),
        Head(90, 470, 400, 'Notes'),
        T(90, 530, 650, ''),
        mk('deco', { kind: 'tape-yellow', x: 540, y: 192, w: 120, h: 30, rot: -4 }),
      ],
    },
    {
      id: 'weekly', name: 'Weekly planner', icon: '🗓️', paper: 'blank', title: 'Week of …',
      build: () => {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const out = [];
        days.forEach((d, i) => {
          const col = i % 2, row = Math.floor(i / 2);
          out.push(mk('shape', { kind: 'round', x: 60 + col * 370, y: 110 + row * 230, w: 340, h: 210, fill: i > 4 ? '#ffe9ef' : '#ffffff', stroke: '#9c8567', sw: 2, label: '', size: 20 }));
          out.push(mk('text', { x: 74 + col * 370, y: 118 + row * 230, w: 300, h: 34, html: '<b>' + d + '</b>', font: F()[0].css, size: 28, textColor: '#b5533c' }));
        });
        out.push(mk('sticky', { x: 430, y: 800, w: 340, h: 180, rot: -1.5, color: '#fff2a8', html: '<b>Focus this week</b><br>', size: 28 }));
        return out;
      },
    },
    {
      id: 'meeting', name: 'Meeting notes', icon: '👥', paper: 'lined', title: 'Meeting – ',
      build: () => [
        mk('shape', { kind: 'round', x: 80, y: 110, w: 650, h: 70, fill: '#e8f0fb', stroke: '#6c9bd1', sw: 2, label: 'Date · Time · Attendees', size: 22 }),
        Head(80, 210, 300, 'Agenda'),
        mk('todo', { x: 80, y: 270, w: 300, h: 200, items: [{ t: '', d: false }, { t: '', d: false }, { t: '', d: false }] }),
        Head(420, 210, 300, 'Decisions'),
        mk('sticky', { x: 420, y: 270, w: 300, h: 200, color: '#c9f0e6', rot: 1, html: '', size: 24 }),
        Head(80, 510, 400, 'Notes'),
        T(80, 570, 650, ''),
        Head(80, 800, 400, 'Action items'),
        mk('todo', { x: 80, y: 860, w: 650, h: 160, color: '#fff2a8', items: [{ t: '', d: false }, { t: '', d: false }] }),
      ],
    },
    {
      id: 'todo', name: 'To-do list', icon: '✅', paper: 'dots', title: 'To do',
      build: () => [
        mk('todo', { x: 90, y: 120, w: 380, h: 340, title: 'Must do', color: '#ffffff', items: Array.from({ length: 6 }, () => ({ t: '', d: false })) }),
        mk('todo', { x: 500, y: 120, w: 260, h: 240, title: 'Nice to do', color: '#e9f3ea', items: Array.from({ length: 4 }, () => ({ t: '', d: false })) }),
        mk('deco', { kind: 'clip-red', x: 420, y: 100, w: 34, h: 84, rot: 6 }),
        mk('deco', { kind: 'pin-blue', x: 610, y: 98, w: 34, h: 52 }),
      ],
    },
    {
      id: 'recipe', name: 'Recipe', icon: '🍳', paper: 'lined', title: 'Recipe – ',
      build: () => [
        mk('shape', { kind: 'round', x: 80, y: 110, w: 320, h: 240, fill: '#fff4e0', stroke: '#d9a066', sw: 2, dash: true, label: '📷 Drop a photo here', size: 20 }),
        mk('sticky', { x: 440, y: 120, w: 300, h: 220, color: '#ffe0f0', rot: 1.5, html: '<b>Info</b><br>Serves: <br>Prep: <br>Cook: ', size: 26 }),
        Head(80, 390, 300, 'Ingredients'),
        mk('todo', { x: 80, y: 450, w: 300, h: 300, items: Array.from({ length: 6 }, () => ({ t: '', d: false })) }),
        Head(420, 390, 300, 'Steps'),
        T(420, 450, 320, '1. '),
        mk('sticker', { glyph: '🍋', x: 650, y: 870, w: 90, h: 90, rot: 10 }),
      ],
    },
    {
      id: 'mood', name: 'Mood board', icon: '🎨', paper: 'blank', title: 'Mood board',
      build: () => [
        mk('shape', { kind: 'rect', x: 70, y: 120, w: 300, h: 240, fill: '#f3e6d4', stroke: '', sw: 0, label: 'Photo', size: 22 }),
        mk('shape', { kind: 'ellipse', x: 400, y: 150, w: 200, h: 200, fill: '#d7f0c2', stroke: '', sw: 0, label: 'Colours', size: 22 }),
        mk('shape', { kind: 'rect', x: 520, y: 400, w: 240, h: 300, fill: '#e2d4ff', stroke: '', sw: 0, label: 'Texture', size: 22, rot: 3 }),
        mk('sticky', { x: 90, y: 420, w: 200, h: 170, rot: -3, color: '#fff2a8', html: 'Words that feel like this…', size: 26 }),
        mk('deco', { kind: 'tape-dots', x: 160, y: 104, w: 120, h: 30, rot: -5 }),
        mk('deco', { kind: 'tape-stripe', x: 560, y: 384, w: 120, h: 30, rot: 4 }),
      ],
    },
  ];
  NB.TEMPLATES.forEach((t) => { const b = t.build; t.build = () => NB.fit(b()); });
})();
