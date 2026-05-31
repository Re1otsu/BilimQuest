/* Shared game result overlay – shown after every game completes */
(function () {
  const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Exo+2:wght@700;800;900&display=swap');

#gro-backdrop {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(7,5,26,.82);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  animation: groFadeIn .35s ease both;
}
@keyframes groFadeIn { from { opacity:0 } to { opacity:1 } }

#gro-card {
  background: linear-gradient(145deg, rgba(40,30,80,.95), rgba(15,10,40,.98));
  border: 1px solid rgba(167,139,250,.35);
  border-radius: 28px;
  padding: 44px 52px 40px;
  text-align: center;
  min-width: 320px; max-width: 420px; width: 90vw;
  box-shadow: 0 0 80px rgba(88,28,220,.4), 0 24px 60px rgba(0,0,0,.6);
  animation: groPop .45s cubic-bezier(.34,1.56,.64,1) .1s both;
  font-family: 'Nunito','Open Sans',sans-serif;
}
@keyframes groPop {
  from { opacity:0; transform: scale(.7) translateY(30px) }
  to   { opacity:1; transform: scale(1) translateY(0) }
}

#gro-title {
  font-size: 1.4rem; font-weight: 900; color: #fff;
  margin-bottom: 24px; letter-spacing: .3px;
  font-family: 'Exo 2','Nunito',sans-serif;
  text-shadow: 0 0 18px rgba(167,139,250,.7);
}

#gro-stars {
  display: flex; justify-content: center; gap: 12px;
  margin-bottom: 28px;
}
#gro-stars span {
  font-size: 2.8rem;
  filter: drop-shadow(0 0 10px rgba(251,191,36,.6));
  animation: groStarPop .5s cubic-bezier(.34,1.56,.64,1) both;
}
#gro-stars span:nth-child(2) { animation-delay:.12s }
#gro-stars span:nth-child(3) { animation-delay:.24s }
@keyframes groStarPop {
  from { transform: scale(0) rotate(-20deg); opacity:0 }
  to   { transform: scale(1) rotate(0deg);  opacity:1 }
}
#gro-stars span.dim { filter: grayscale(1) opacity(.3); animation: none; }

#gro-stats {
  display: flex; gap: 20px; justify-content: center;
  margin-bottom: 32px;
}
.gro-stat {
  background: rgba(255,255,255,.07);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 16px;
  padding: 16px 22px;
  min-width: 110px;
}
.gro-stat-label {
  font-size: .82rem; color: rgba(196,181,253,.75);
  font-weight: 700; letter-spacing: .2px;
  margin-bottom: 6px;
  font-family: 'Nunito', sans-serif;
}
.gro-stat-value {
  font-size: 1.6rem; font-weight: 900; color: #fff;
  font-family: 'Exo 2','Nunito',sans-serif;
}
.gro-stat-value.gold { color: #fbbf24; text-shadow: 0 0 12px rgba(251,191,36,.5); }
.gro-stat-value.purple { color: #c4b5fd; text-shadow: 0 0 12px rgba(167,139,250,.5); }

#gro-btn {
  display: inline-block;
  background: linear-gradient(135deg, #7c3aed, #4f46e5);
  color: #fff; border: none; border-radius: 50px;
  padding: 13px 42px;
  font-size: 1rem; font-weight: 800;
  font-family: 'Nunito','Open Sans',sans-serif;
  cursor: pointer; letter-spacing: .3px;
  box-shadow: 0 6px 24px rgba(124,58,237,.5);
  transition: transform .2s, box-shadow .2s;
}
#gro-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(124,58,237,.65);
}
`;

  function inject() {
    if (document.getElementById('gro-style')) return;
    const s = document.createElement('style');
    s.id = 'gro-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  window.showGameResult = function (data) {
    inject();

    const earned  = parseFloat(data.score  || 0);
    const stars   = parseInt(data.stars    || 0, 10);
    const total   = parseFloat(data.total_score || 0);
    const tStars  = parseInt(data.total_stars   || 0, 10);

    // Build overlay
    const backdrop = document.createElement('div');
    backdrop.id = 'gro-backdrop';

    const maxStars = 1; // games give 0 or 1 star
    let starsHTML = '';
    for (let i = 0; i < maxStars; i++) {
      starsHTML += `<span class="${i < stars ? '' : 'dim'}">⭐</span>`;
    }

    backdrop.innerHTML = `
      <div id="gro-card">
        <div id="gro-title">Ойын аяқталды!</div>
        <div id="gro-stars">${starsHTML}</div>
        <div id="gro-stats">
          <div class="gro-stat">
            <div class="gro-stat-label">Бұл ойын</div>
            <div class="gro-stat-value gold">+${earned.toFixed(2)}</div>
          </div>
          <div class="gro-stat">
            <div class="gro-stat-label">Жалпы ұпай</div>
            <div class="gro-stat-value purple">${total.toFixed(2)}</div>
          </div>
          <div class="gro-stat">
            <div class="gro-stat-label">Жұлдыз</div>
            <div class="gro-stat-value gold">⭐ ${tStars}</div>
          </div>
        </div>
        <button id="gro-btn">Артқа</button>
      </div>`;

    document.body.appendChild(backdrop);

    document.getElementById('gro-btn').addEventListener('click', function () {
      backdrop.remove();
      // Navigate back to student main page
      if (window.parent && window.parent !== window) {
        const modal = window.parent.document.getElementById('module-modal');
        const iframe = window.parent.document.getElementById('module-frame');
        if (modal) modal.style.display = 'none';
        if (iframe) iframe.src = '';
      } else {
        window.location.href = '/student';
      }
    });
  };
})();
