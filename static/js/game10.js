/* Инициализация данных */
const ZONES = [
  {id:'audio', label:'Дыбыс'},
  {id:'video', label:'Видео'},
  {id:'text',  label:'Мәтін'},
  {id:'image', label:'Бейне'}
];

const ITEMS = [
  {id:'music', img:'static/img/dictaphone.png', label:'Музыка', type:'audio'},
  {id:'movie', img:'static/img/camera.png', label:'Фильм', type:'video'},
  {id:'book',  img:'static/img/book.png',  label:'Кітап',  type:'text'},
  {id:'picture', img:'static/img/canvas.png', label:'Сурет', type:'image'}
];

const zonesWrap = document.getElementById('zones');
const invWrap = document.getElementById('inventory');
const resultBubble = document.getElementById('resultBubble');
const finalBox = document.getElementById('finalBox');
const star1 = document.getElementById('star1'), star2 = document.getElementById('star2');

const maxPoints = 2.0;
const pointPer = 0.5;

let state = {
  lockedPuzzles: {music:true, movie:true, book:true, picture:true}, // puzzle not solved => item locked
  placed: {}, // zoneId -> itemId
  scorePoints: 0.0
};

function shuffleArray(arr){
  return arr.map(v=>({v,sort:Math.random()}))
            .sort((a,b)=>a.sort-b.sort)
            .map(({v})=>v);
}

/* --- Рендер зон --- */
function renderZones(){
  zonesWrap.innerHTML = '';
  const shuffledZones = shuffleArray(ZONES);  // <== перемешали
  shuffledZones.forEach(z=>{
    const el = document.createElement('div');
    el.className = 'zone';
    el.id = `zone-${z.id}`;
    el.dataset.zone = z.id;
    el.innerHTML = `<div class="lock locked" id="lock-${z.id}">🔒 Жабық</div>
                    <h3>${z.label}</h3>
                    <div class="ph" id="ph-${z.id}">Бұл жерге затты апарыңыз</div>`;
    // drag/drop
    el.addEventListener('dragover', e=>e.preventDefault());
    el.addEventListener('drop', e=>{
      e.preventDefault();
      const itemId = e.dataTransfer.getData('text/plain');
      if(!itemId) return;
      if(state.placed[z.id]) return;
      if(state.lockedPuzzles[itemId]) {
        showSimpleModal('Ескерту', 'Алдымен осы заттың пазлын шешіңіз.');
        return;
      }
      const itemObj = ITEMS.find(i=>i.id===itemId);
      if(itemObj.type === z.id){
        placeItemToZone(z.id, itemId);
      } else {
        shakeZone(z.id);
        showSimpleModal('Қате', 'Бұл зат осы орынға сай келмейді.');
      }
    });
    zonesWrap.appendChild(el);
  });
}

/* --- Рендер инвентаря --- */
function renderInventory(){
  invWrap.innerHTML = '';
  const shuffledItems = shuffleArray(ITEMS); // <== перемешали
  shuffledItems.forEach(it=>{
    if(Object.values(state.placed).includes(it.id)) return;
    const el = document.createElement('div');
    el.className = 'item';
    el.id = `item-${it.id}`;
    if(state.lockedPuzzles[it.id]) el.classList.add('locked');
    el.draggable = !state.lockedPuzzles[it.id];
    el.innerHTML = `<img src="${it.img}" alt="${it.label}">`;
    invWrap.appendChild(el);

    if(!state.lockedPuzzles[it.id]){
      el.addEventListener('dragstart', ev=>{
        ev.dataTransfer.setData('text/plain', it.id);
        el.classList.add('dragging');
      });
      el.addEventListener('dragend', ()=>el.classList.remove('dragging'));
    } else {
      el.addEventListener('click', ()=> openPuzzleFor(it.id));
    }
  });
}

/* --- Утилиты UI --- */
function updateResult(){
  resultBubble.textContent = `Ұпай: ${state.scorePoints.toFixed(1)} / ${maxPoints.toFixed(1)}`;
}
function shakeZone(zoneId){
  const z = document.getElementById(`zone-${zoneId}`);
  if(!z) return;
  z.animate([{transform:'translateX(0)'},{transform:'translateX(-8px)'},{transform:'translateX(8px)'},{transform:'translateX(0)'}],{duration:300});
}

/* --- Размещение предмета в зону (после проверки) --- */
function placeItemToZone(zoneId, itemId){
  // visual place
  const ph = document.getElementById(`ph-${zoneId}`);
  const itemObj = ITEMS.find(i=>i.id===itemId);
  ph.innerHTML = `<div style="display:flex;align-items:center;gap:10px">
                    <img src="${itemObj.img}" style="width:44px;height:44px;object-fit:contain;border-radius:6px">
                    <div style="font-weight:700;color:#dff8ff">${itemObj.label}</div>
                  </div>`;
  // mark placed
  state.placed[zoneId] = itemId;
  // remove from inventory element
  const invEl = document.getElementById(`item-${itemId}`);
  if(invEl) invEl.remove();
  // unlock zone UI
  const lockEl = document.getElementById(`lock-${zoneId}`);
  if(lockEl){ lockEl.classList.remove('locked'); lockEl.classList.add('open'); lockEl.textContent = '🔓 Ашылды'; }
  const zoneEl = document.getElementById(`zone-${zoneId}`);
  if(zoneEl) zoneEl.classList.add('correct');
  // increase score
  state.scorePoints = Math.min(maxPoints, +(state.scorePoints + pointPer).toFixed(3));
  updateResult();

  // check final
  if(Object.keys(state.placed).length === ZONES.length){
    setTimeout(showFinal, 700);
  }
}

/* --- Модалки --- */
function showSimpleModal(title, text){
  const tpl = document.getElementById('modalTpl');
  const node = tpl.content.cloneNode(true);
  const back = node.querySelector('.modal-back');
  const mTitle = node.getElementById('modalTitle');
  const mHint = node.getElementById('modalHint');
  const body = node.getElementById('modalBody');
  const close = node.getElementById('modalClose');

  mTitle.textContent = title;
  mHint.textContent = text;
  body.innerHTML = '';
  close.addEventListener('click', ()=> document.body.removeChild(back));
  document.body.appendChild(back);
}

/* --- Открыть пазл для конкретного предмета --- */
function openPuzzleFor(itemId){
  if(!state.lockedPuzzles[itemId]) return; // уже открыт
  if(itemId === 'music') showPuzzleTypes(itemId);
  else if(itemId === 'movie') showPuzzleCaesar(itemId);
  else if(itemId === 'book') showPuzzleBinary(itemId);
  else if(itemId === 'picture') showPuzzleDecimal(itemId);
}

/* ---------- ПАЗЛ 1: Виды информации (drag images в категории) ---------- */
/* --- Хелпер: перемешивание массива --- */
function shuffleArray(arr){
  return arr
    .map(v => ({ v, sort: Math.random() }))
    .sort((a,b) => a.sort - b.sort)
    .map(({ v }) => v);
}

function showPuzzleTypes(itemId){
  let old = document.getElementById("puzzleModal");
  if(old) old.remove();

  const back = document.createElement("div");
  back.className = "modal-back";
  back.id = "puzzleModal";
  back.innerHTML = `
    <div class="modal">
      <h2 id="modalTitle">Ақпарат тұрлері</h2>
      <p id="modalHint">Перетағыңыз суреттерді дұрыс категорияға: Дыбыс / Бейне / Мәтін</p>
      <div id="modalBody"></div>
      <div style="margin-top:10px;display:flex;gap:8px;justify-content:flex-end">
        <button class="btn ghost" id="modalClose">Жабу</button>
      </div>
    </div>
  `;

  const body = back.querySelector("#modalBody");

  let IMGS = [
    {id:'pimg-sound', icon:'🔊', kind:'audio'},
    {id:'pimg-pic',   icon:'🖼️', kind:'image'},
    {id:'pimg-text',  icon:'📄', kind:'text'}
  ];
  let TARGETS = [
    {id:'t-audio', label:'Дыбыс', accept:'audio'},
    {id:'t-image', label:'Бейне', accept:'image'},
    {id:'t-text',  label:'Мәтін', accept:'text'}
  ];

  // перемешиваем перед выводом
  IMGS = shuffleArray(IMGS);
  TARGETS = shuffleArray(TARGETS);

  body.innerHTML = `
    <div class="drag-pad" id="dragpad">
      ${IMGS.map(img=>`<div class="puzzle-img" draggable="true" data-kind="${img.kind}" id="${img.id}">${img.icon}</div>`).join('')}
    </div>
    <div class="targets" id="targets">
      ${TARGETS.map(t=>`<div class="target" data-accept="${t.accept}" id="${t.id}"><strong>${t.label}</strong></div>`).join('')}
    </div>
    <div class="small" style="margin-top:8px">Барлық суреттер дұрыс орналастырса — пазл ашылады.</div>
  `;

  body.querySelectorAll('.puzzle-img').forEach(img=>{
    img.addEventListener('dragstart', ev=>{
      ev.dataTransfer.setData('text/plain', img.id);
    });
  });
  body.querySelectorAll('.target').forEach(t=>{
    t.addEventListener('dragover', e=>e.preventDefault());
    t.addEventListener('drop', e=>{
      e.preventDefault();
      const pid = e.dataTransfer.getData('text/plain');
      if(!pid) return;
      const p = document.getElementById(pid);
      const kind = p.dataset.kind;
      if(kind === t.dataset.accept){
        t.appendChild(p);
        p.style.pointerEvents = "none";
        checkTypesSolved(back, itemId);
      } else {
        p.animate([{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}],{duration:250});
      }
    });
  });

  back.querySelector("#modalClose").addEventListener("click", ()=> back.remove());
  document.body.appendChild(back);
}

function checkTypesSolved(backdropNode, itemId){
  const allPlaced = Array.from(document.querySelectorAll('#targets .target'))
    .every(t=> t.querySelector('.puzzle-img') );
  if(allPlaced){
    setTimeout(()=>{
      state.lockedPuzzles[itemId] = false;
      renderInventory();
      backdropNode.remove();
      showSimpleModal('Жарайсың!', 'Пазл шешілді — зат инвентарда ашылды. Енді оны орнатуға болады.');
    },300);
  }
}
/* ---------- ПАЗЛ 2: Шифрование (Цезарь, декодирование) ---------- */
// вынеси глобально
const KAZ_ALPHABET = "АӘБВГҒДЕЁЖЗИІЙКҚЛМНҢОӨПРСТУҰҮФХҺЦЧШЩЪЫІЬЭЮЯ".split('');

function caesarEncodeKaz(s, shift){
  return s.split('').map(ch=>{
    const idx = KAZ_ALPHABET.indexOf(ch.toUpperCase());
    if(idx === -1) return ch; // егер әріп болмаса, өзгеріссіз қалады
    const newIdx = (idx + shift) % KAZ_ALPHABET.length;
    return KAZ_ALPHABET[newIdx];
  }).join('');
}

function showPuzzleCaesar(itemId){
  const tpl = document.getElementById('modalTpl').content.cloneNode(true);
  const back = tpl.querySelector('.modal-back');
  const title = tpl.getElementById('modalTitle');
  const hint = tpl.getElementById('modalHint');
  const body = tpl.getElementById('modalBody');

  const plain = 'КЕМЕ';
  const shift = 2;
  const encoded = caesarEncodeKaz(plain, shift);

  title.textContent = 'Шифр — Цезарь';
  hint.textContent = `Декодтаңыз (Цезарь +${shift}): ${encoded}`;

  body.innerHTML = `
    <div class="small">Ескі Цезарь шифрын қолданыңыз. Бастапқы сөзді енгізіңіз.</div>
    <div style="margin-top:10px">
      <input id="caesarInput" placeholder="Жауапты енгізіңіз"
        style="width:100%;padding:8px;border-radius:8px;
        border:1px solid rgba(255,255,255,0.06);
        background:transparent;color:#e6f6ff">
    </div>
    <div style="margin-top:10px;display:flex;gap:8px;justify-content:flex-end">
      <button class="btn" id="checkCaesar">Тексеру</button>
      <button class="btn ghost" id="closeCaesar">Жабу</button>
    </div>
  `;

  body.querySelector('#checkCaesar').addEventListener('click', ()=>{
    const val = body.querySelector('#caesarInput').value.trim().toUpperCase();
    if(val === plain){
      state.lockedPuzzles[itemId] = false;
      renderInventory();
      document.body.removeChild(back);
      showSimpleModal('Жарайсың!', `Дұрыс — бастапқы сөз: ${plain}. Зат ашылды.`);
    } else {
      const inp = body.querySelector('#caesarInput');
      inp.animate(
        [
          {transform:'translateX(0)'},
          {transform:'translateX(-6px)'},
          {transform:'translateX(6px)'},
          {transform:'translateX(0)'}
        ],
        {duration:280}
      );
    }
  });

  body.querySelector('#closeCaesar').addEventListener('click', ()=>{
    document.body.removeChild(back);
  });

  document.body.appendChild(back);
}
/* ---------- ПАЗЛ 3: Двоичный код (собери биты) ---------- */
function showPuzzleBinary(itemId){
  const tpl = document.getElementById('modalTpl').content.cloneNode(true);
  const back = tpl.querySelector('.modal-back');
  const title = tpl.getElementById('modalTitle');
  const hint = tpl.getElementById('modalHint');
  const body = tpl.getElementById('modalBody');
  const close = tpl.getElementById('modalClose');

  // фиксируем число 68
  const num = 68;
  const bin = num.toString(2).padStart(8, '0');

  title.textContent = 'Екілік код';
  hint.textContent = `Санды екілікке түрлендіріңіз: ${num}`;

  body.innerHTML = `
    <div class="small">Түсу: биттерді басып, 0/1 ретімен құрастыру. Қажет ұзындық: ${bin.length} бит.</div>
    <div style="margin-top:10px" id="bitRow"></div>
    <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
      <button class="btn" id="checkBin">Тексеру</button>
      <button class="btn ghost" id="closeBin">Жабу</button>
    </div>
  `;

    const row = body.querySelector('#bitRow');
    row.style.display = 'flex';
    row.style.gap = '6px';
  // создаём битовые "клетки"
  for(let i=0;i<bin.length;i++){
    const b = document.createElement('div');
    b.className = 'bit';
    b.dataset.val = '0';
    b.textContent = '0';
    b.addEventListener('click', ()=> {
      if(b.dataset.val === '0'){
        b.dataset.val='1';
        b.classList.add('on');
        b.textContent='1';
      } else {
        b.dataset.val='0';
        b.classList.remove('on');
        b.textContent='0';
      }
    });
    row.appendChild(b);
  }

  body.querySelector('#checkBin').addEventListener('click', ()=>{
    const val = Array.from(row.children).map(c=>c.dataset.val).join('');
    if(val === bin){
      state.lockedPuzzles[itemId] = false;
      renderInventory();
      document.body.removeChild(back);
      showSimpleModal('Дұрыс!', `Екілік: ${bin} — зат ашылды.`);
    } else {
      row.animate([{transform:'translateY(0)'},{transform:'translateY(-6px)'},{transform:'translateY(6px)'},{transform:'translateY(0)'}],{duration:260});
    }
  });

  body.querySelector('#closeBin').addEventListener('click', ()=>document.body.removeChild(back));
  document.body.appendChild(back);
}

/* ---------- ПАЗЛ 4: Десятичный (перевести двоичное в десятичное) ---------- */
function showPuzzleDecimal(itemId){
  const tpl = document.getElementById('modalTpl').content.cloneNode(true);
  const back = tpl.querySelector('.modal-back');
  const title = tpl.getElementById('modalTitle');
  const hint = tpl.getElementById('modalHint');
  const body = tpl.getElementById('modalBody');
  const close = tpl.getElementById('modalClose');

  const bin = '01110110'; // 11
  const dec = parseInt(bin,2);

  title.textContent = 'Ондық код';
  hint.textContent = `Берілген екілік: ${bin} — оны ондыққа түрлендіріңіз`;

  body.innerHTML = `
    <div class="small">Екілік санды ондыққа айналдырып, нәтижені енгізіңіз.</div>
    <div style="margin-top:10px"><input id="decInput" placeholder="Жауапты енгізіңіз" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);background:transparent;color:#e6f6ff"></div>
    <div style="margin-top:10px;display:flex;gap:8px;justify-content:flex-end">
      <button class="btn" id="checkDec">Тексеру</button>
      <button class="btn ghost" id="closeDec">Жабу</button>
    </div>
  `;
  body.querySelector('#checkDec').addEventListener('click', ()=>{
    const val = parseInt(body.querySelector('#decInput').value.trim(),10);
    if(val === dec){
      state.lockedPuzzles[itemId] = false;
      renderInventory();
      document.body.removeChild(back);
      showSimpleModal('Жарайсың!', `Дұрыс жауап: ${dec}. Зат ашылды.`);
    } else {
      const inp = body.querySelector('#decInput');
      inp.animate([{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}],{duration:260});
    }
  });
  body.querySelector('#closeDec').addEventListener('click', ()=>document.body.removeChild(back));
  document.body.appendChild(back);
}

/* --- Финал --- */
function showFinal(){
  finalBox.style.display = 'block';
  // stars: 2 if full, 1 if >=1, else 0
  star1.classList.remove('on'); star1.classList.add('off');
  star2.classList.remove('on'); star2.classList.add('off');
  if(Math.abs(state.scorePoints - maxPoints) < 0.001){
    star1.classList.remove('off'); star1.classList.add('on');
    star2.classList.remove('off'); star2.classList.add('on');
  } else if(state.scorePoints >= 1.0){
    star1.classList.remove('off'); star1.classList.add('on');
  }
  document.getElementById('finalText').textContent = `Ұпай: ${state.scorePoints.toFixed(1)} / ${maxPoints.toFixed(1)}`;
  // (optional) send to server here
}

/* --- Инициализация и рендер --- */
function init(){
  // reset state
  state.lockedPuzzles = {music:true, movie:true, book:true, picture:true};
  state.placed = {};
  state.scorePoints = 0.0;
  renderZones();
  renderInventory();
  updateResult();
  finalBox.style.display = 'none';
}
init();
