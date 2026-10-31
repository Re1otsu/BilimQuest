/* ════════════════════════════════════════════════════════════
   Кронос — ЖИ зертханасының ойын ішіндегі ЖИ-серіктесі.
   BilimAI чатынан айырмашылығы: ойынның ішінде тұрады және кейде әдейі қателеседі.

     Kronos.ask({text, wrong, onAgree, onCheck})  — ұсыныс + «Келісемін» / «Тексеремін»
     Kronos.caughtOne()                           — білім алушы Кроностың қатесін тапты
     Kronos.choose(text,[{label,fn}])             — тексеру кезіндегі таңдау
     Kronos.show(text, {button, onClose})         — жай хабарлама
     Kronos.wrongAgreed()                         — қате ұсынысқа келісілді ме (сахна соңы үшін)
     Kronos.summary()                             — «Сен менің 2 қатемнің 2-ін таптың.»
════════════════════════════════════════════════════════════ */
(function(){
  const ROBOT='/static/img/toqsan4/lab/robot.webp';
  /* Кронос — төменгі панель: тапсырма жабылмайды, білім алушы экранды көре отырып шешеді */
  const css=`
  #krBox{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:900;display:none;width:min(720px,calc(100vw - 24px));font-family:'Rubik',system-ui,'Segoe UI',sans-serif}
  #krBox.on{display:block}
  #krBox .kr-card{display:flex;gap:14px;align-items:center;padding:13px 16px;border-radius:18px;color:#eaf6ff;
    background:linear-gradient(180deg,#16294f,#0b1833);border:2px solid #37b4ff;box-shadow:0 0 28px rgba(55,180,255,.35),0 14px 40px rgba(0,0,0,.65);
    animation:krIn .28s cubic-bezier(.3,1.3,.5,1)}
  @keyframes krIn{from{transform:translateY(24px)}}
  #krBox img{width:66px;flex-shrink:0;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5))}
  #krBox .kr-body{flex:1;min-width:0}
  #krBox .kr-name{font-size:11.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#7fe8ff;margin-bottom:3px}
  #krBox .kr-text{font-size:16px;font-weight:700;line-height:1.38}
  #krBox .kr-hint{display:none;margin-top:5px;font-size:13px;font-weight:600;line-height:1.35;color:#ffd98a}
  #krBox .kr-hint.on{display:block}
  #krBox .kr-btns{display:flex;gap:9px;margin-top:10px;flex-wrap:wrap}
  #krBox button{flex:1;min-width:150px;min-height:48px;padding:7px 12px;border-radius:12px;border:none;cursor:pointer;font:inherit;font-size:15px;font-weight:800;line-height:1.15;transition:filter .15s}
  #krBox button small{display:block;margin-top:2px;font-size:11.5px;font-weight:600;opacity:.85}
  #krBox button:hover{filter:brightness(1.1)}
  #krBox button:focus-visible{outline:3px solid #fff;outline-offset:2px}
  #krBox .kr-agree{color:#dceaff;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.25)}
  #krBox .kr-check{color:#06231a;background:linear-gradient(180deg,#7dffb0,#33c75e)}
  body.kr-on{padding-bottom:210px!important}
  @media(max-width:560px){#krBox{bottom:8px}#krBox img{width:44px;align-self:flex-start}#krBox .kr-text{font-size:15px}#krBox button{min-width:120px}}`;

  let box, wrongTotal=0, caught=0, agreedWrong=false;

  function mount(){
    if(box) return;
    const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
    box=document.createElement('div'); box.id='krBox'; box.setAttribute('role','status');
    box.innerHTML=`<div class="kr-card"><img src="${ROBOT}" alt="Кронос"><div class="kr-body"><div class="kr-name">ЖИ-серіктес Кронос</div><div class="kr-text"></div><div class="kr-hint"></div><div class="kr-btns"></div></div></div>`;
    document.body.appendChild(box);
  }
  function open(text,buttons,hint){
    mount();
    box.querySelector('.kr-text').textContent=text;
    const h=box.querySelector('.kr-hint'); h.textContent=hint||''; h.classList.toggle('on',!!hint);
    const w=box.querySelector('.kr-btns'); w.innerHTML='';
    buttons.forEach(b=>{
      const e=document.createElement('button'); e.type='button'; e.className=b.cls||'kr-check';
      e.textContent=b.label;
      if(b.sub){ const s=document.createElement('small'); s.textContent=b.sub; e.appendChild(s); }
      e.onclick=()=>{ box.classList.remove('on'); document.body.classList.remove('kr-on'); b.fn&&b.fn(); };
      w.appendChild(e);
    });
    box.classList.add('on'); document.body.classList.add('kr-on');
  }

  window.Kronos={
    PHRASE:{
      found:'Жарайсың! Сен менің қатемді таптың. Нағыз зерттеуші осылай жасайды.',
      wrong:'Мен қателесіппін. ЖИ де қателеседі, сондықтан оның жауабын әрқашан тексер.',
      right:'Дұрыс! Бұл жолы мен қателескен жоқпын.',
    },
    ask(o){
      if(o.wrong) wrongTotal++;
      agreedWrong=false;
      open(o.text,[
        {label:'Келісемін',sub:'Кроносқа сенемін, тексермеймін',cls:'kr-agree',fn(){ if(o.wrong) agreedWrong=true; o.onAgree&&o.onAgree(); }},
        {label:'Тексеремін',sub:'Өзім тексеріп көремін',fn(){ o.onCheck&&o.onCheck(); }},
      ],'Кронос ЖИ, сондықтан кейде қателеседі. Экранға қарап ойлан: оның қатесін тапсаң, балл аласың.');
    },
    caughtOne(){ caught++; },
    wrongAgreed(){ const v=agreedWrong; agreedWrong=false; return v; },
    show(text,o){ o=o||{}; open(text,[{label:o.button||'Жарайды',fn:o.onClose}]); },
    choose(text,opts){ open(text,opts.map(o=>({label:o.label,fn:o.fn}))); },
    reset(){ wrongTotal=0; caught=0; agreedWrong=false; },
    summary(){
      if(!wrongTotal) return '';
      return `Сен менің ${wrongTotal} қатемнің ${caught}-ін таптың.`;
    },
  };
})();
