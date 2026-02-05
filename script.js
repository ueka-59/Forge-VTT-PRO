const State = {
    view: document.getElementById('game-container'),
    layer: document.getElementById('token-layer'),
    mapCnv: document.getElementById('map-canvas'),
    fogCnv: document.getElementById('fog-canvas'),
    mapCtx: null, fogCtx: null,
    mapFiles: ["31042.jpg", "battlemap.jpg", "desert.jpg", "grotte.jpg", "neige.jpg"],
    pionFiles: ["30985.gif", "31040.png", "31041.png", "31065.png", "31066.png", "31071.png", "31072.png", "31073.png", "31074.png", "31075.png", "31076.png", "31077.png", "31078.png", "31079.png", "31082.png", "balleombre.png", "baton.png", "bouclier.png", "casque.png", "épée.png", "grotte.png", "plastron.png", "roche.png", "guerrier.png", "mage.png", "rodeur.png", "voleur.png"],
    scenes: [], activeScene: -1, selectedTokens: [],
    isDragging: false, dragType: null, lastX: 0, lastY: 0,
    gridSize: 50, gridOpacity: 0.2, gridEnabled: true,
    isFogMode: false, fogBrush: 'erase', isMapLocked: false
};

const App = {
    init() {
        State.mapCtx = State.mapCnv.getContext('2d', { alpha: false });
        State.fogCtx = State.fogCnv.getContext('2d');
        this.resize(); window.onresize = () => this.resize();
        this.events(); UI.initLib();
    },
    resize() {
        State.mapCnv.width = State.fogCnv.width = State.view.offsetWidth;
        State.mapCnv.height = State.fogCnv.height = State.view.offsetHeight;
        this.render();
    },
    toggleMapLock() {
        State.isMapLocked = !State.isMapLocked;
        document.getElementById('btn-lock-map').innerText = State.isMapLocked ? "🔒" : "🔓";
    },
    events() {
        let startX, startY, lastTap = 0;
        const getPos = (e) => {
            const t = e.touches ? e.touches[0] : e;
            return { x: t.clientX, y: t.clientY };
        };
        const onDown = (e) => {
            // Si on touche un menu, on ne fait rien pour laisser le scroll agir
            if (e.target.closest('.side-bar') || e.target.closest('#library-panel') || e.target.closest('.modal')) return;
            
            const pos = getPos(e);
            State.isDragging = true; State.lastX = pos.x; State.lastY = pos.y;
            startX = pos.x; startY = pos.y;
            
            const tokenEl = e.target.closest('.token');
            if (tokenEl && !State.isFogMode) {
                const id = parseFloat(tokenEl.dataset.id);
                const t = State.scenes[State.activeScene].tokens.find(tk => tk.id === id);
                if (!State.selectedTokens.includes(t)) { this.clearSelection(); State.selectedTokens.push(t); t.el.classList.add('selected'); }
                State.dragType = 'token';
                let now = Date.now(); if (now - lastTap < 300) UI.openConfig(t); lastTap = now;
            } else { State.dragType = 'map'; }
        };
        const onMove = (e) => {
            if (!State.isDragging) return;
            if (e.target.closest('.side-bar') || e.target.closest('#library-panel') || e.target.closest('.modal')) return;

            const pos = getPos(e); const dx = pos.x - State.lastX; const dy = pos.y - State.lastY;
            if (Math.abs(pos.x - startX) < 3 && Math.abs(pos.y - startY) < 3) return;
            
            if (e.cancelable) e.preventDefault(); 

            if (State.isFogMode) { this.paintFog(pos.x, pos.y); }
            else if (State.dragType === 'token') {
                State.selectedTokens.forEach(t => { if (!t.isLocked) { t.x += dx; t.y += dy; this.updateTokenPos(t); } });
            } else if (State.dragType === 'map' && !State.isMapLocked && State.activeScene !== -1) {
                const s = State.scenes[State.activeScene]; s.offX += dx; s.offY += dy; this.render();
            }
            State.lastX = pos.x; State.lastY = pos.y;
        };
        const onUp = () => { State.isDragging = false; };
        
        State.view.addEventListener('mousedown', onDown);
        window.addEventListener('mousemove', onMove, {passive: false});
        window.addEventListener('mouseup', onUp);
        State.view.addEventListener('touchstart', onDown, {passive: true});
        window.addEventListener('touchmove', onMove, {passive: false});
        window.addEventListener('touchend', onUp);
    },
    render() {
        const ctx = State.mapCtx; ctx.clearRect(0, 0, State.mapCnv.width, State.mapCnv.height);
        if (State.activeScene === -1) return;
        const s = State.scenes[State.activeScene];
        ctx.save(); ctx.translate(s.offX, s.offY);
        if (s.img.complete) ctx.drawImage(s.img, 0, 0, s.w, s.h);
        if (State.gridEnabled) {
            ctx.beginPath(); ctx.strokeStyle = `rgba(255,255,255,${State.gridOpacity})`;
            for (let x = 0; x <= s.w; x += State.gridSize) { ctx.moveTo(x, 0); ctx.lineTo(x, s.h); }
            for (let y = 0; y <= s.h; y += State.gridSize) { ctx.moveTo(0, y); ctx.lineTo(s.w, y); }
            ctx.stroke();
        }
        ctx.restore(); State.layer.style.transform = `translate3d(${s.offX}px, ${s.offY}px, 0)`;
    },
    updateTokenPos(t) {
        if (!t.el) return; const el = t.el;
        el.style.width = el.style.height = t.s + 'px'; el.style.left = t.x + 'px'; el.style.top = t.y + 'px';
        el.querySelector('img').style.transform = `rotate(${t.rot}deg) scaleX(${t.flip})`;
        el.querySelector('.token-name').innerText = t.name;
        el.querySelector('.hp-fill').style.width = Math.min(100, (t.hp/t.hpMax*100)) + "%";
        const aura = el.querySelector('.aura');
        if (t.auraS > 0) { 
            aura.style.display = "block"; aura.style.width = aura.style.height = (parseInt(t.s)+parseInt(t.auraS))+"px";
            aura.style.backgroundColor = t.auraC; aura.style.left = aura.style.top = `-${t.auraS/2}px`;
        } else aura.style.display = "none";
    },
    addToken(src) {
        if (State.activeScene === -1) return;
        const t = { id: Math.random(), x: 100, y: 100, s: 60, src, name: "", hp: 10, hpMax: 10, rot: 0, flip: 1, auraS: 0, auraC: "#ff0000", isLocked: false, group: 0 };
        State.scenes[State.activeScene].tokens.push(t); this.drawToken(t);
    },
    drawToken(t) {
        const div = document.createElement('div'); div.className = 'token'; div.dataset.id = t.id;
        div.innerHTML = `<div class="aura"></div><div class="token-info"><div class="token-name"></div><div class="hp-bar"><div class="hp-fill"></div></div></div><img src="${t.src}">`;
        State.layer.appendChild(div); t.el = div; this.updateTokenPos(t);
    },
    clearSelection() { State.selectedTokens = []; document.querySelectorAll('.token').forEach(el => el.classList.remove('selected')); },
    selectGroup(num) {
        this.clearSelection();
        State.scenes[State.activeScene]?.tokens.forEach(t => { if (parseInt(t.group) === parseInt(num)) { State.selectedTokens.push(t); t.el.classList.add('selected'); } });
    },
    toggleGrid() { State.gridEnabled = !State.gridEnabled; this.render(); },
    updateGridSettings() {
        State.gridSize = parseInt(document.getElementById('in-grid-size').value);
        document.getElementById('val-grid').innerText = State.gridSize; this.render();
    },
    toggleFog() {
        State.isFogMode = !State.isFogMode; document.getElementById('fog-sub-tools').style.display = State.isFogMode ? "flex" : "none";
        State.fogCnv.style.pointerEvents = State.isFogMode ? "auto" : "none";
    },
    setFogBrush(m) { State.fogBrush = m; },
    fillFog() { State.fogCtx.globalCompositeOperation = "source-over"; State.fogCtx.fillStyle = "black"; State.fogCtx.fillRect(0,0,State.fogCnv.width, State.fogCnv.height); },
    paintFog(x, y) {
        const r = State.view.getBoundingClientRect(); State.fogCtx.globalCompositeOperation = (State.fogBrush === 'erase') ? "destination-out" : "source-over";
        State.fogCtx.fillStyle = "black"; State.fogCtx.beginPath(); State.fogCtx.arc(x - r.left, y - r.top, 40, 0, Math.PI * 2); State.fogCtx.fill();
    }
};

const UI = {
    initLib() {
        const pList = document.getElementById('pion-list');
        State.pionFiles.forEach(f => {
            const d = document.createElement('div'); d.className = 'pion-thumb'; d.style.backgroundImage = `url('pions/${f}')`;
            d.onclick = () => App.addToken(`pions/${f}`); pList.appendChild(d);
        });
        const mList = document.getElementById('map-list');
        State.mapFiles.forEach(f => {
            const d = document.createElement('div'); d.className = 'pion-thumb'; d.style.backgroundImage = `url('maps/${f}')`;
            d.onclick = () => IO.loadMap(`maps/${f}`); mList.appendChild(d);
        });
    },
    showTab(t) {
        document.getElementById('library-panel').style.display = 'flex';
        document.getElementById('section-pions').style.display = t === 'pions' ? 'block' : 'none';
        document.getElementById('section-maps').style.display = t === 'maps' ? 'block' : 'none';
        document.getElementById('lib-title').innerText = t === 'pions' ? 'PIONS' : 'MAPS';
    },
    hidePanel() { document.getElementById('library-panel').style.display = 'none'; },
    openConfig(t) {
        document.getElementById('in-name').value = t.name; document.getElementById('in-hp').value = t.hp;
        document.getElementById('in-hpmax').value = t.hpMax; document.getElementById('in-size').value = t.s;
        document.getElementById('in-aura-s').value = t.auraS; document.getElementById('in-aura-c').value = t.auraC;
        document.getElementById('pop-pion').style.display = 'flex';
    },
    close() { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); },
    toggleDiceMenu() { const m = document.getElementById('dice-menu'); m.style.display = m.style.display === 'flex' ? 'none' : 'flex'; },
    toggleGroupMenu() { const m = document.getElementById('group-select-menu'); m.style.display = m.style.display === 'flex' ? 'none' : 'flex'; },
    roll(f) { this.toast(`🎲 D${f} : ${Math.floor(Math.random()*f)+1}`); },
    toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.innerText = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2500); },
    updateScenesList() {
        const list = document.getElementById('active-scenes-list'); list.innerHTML = "";
        State.scenes.forEach((s, i) => {
            const d = document.createElement('div'); d.className = `scene-item ${i === State.activeScene ? 'active' : ''}`;
            d.innerHTML = `<span>${s.name}</span><button onclick="IO.deleteScene(${s.id}, event)" style="background:none; border:none; color:red; cursor:pointer;">✕</button>`;
            d.onclick = () => IO.switchScene(s.id); list.appendChild(d);
        });
    },
    openMapConfig() { document.getElementById('pop-map').style.display = 'flex'; }
};

const IO = {
    loadMap(src) {
        const img = new Image(); img.onload = () => {
            const s = { id: Date.now(), name: src.split('/').pop(), img, src, offX: 0, offY: 0, w: State.view.offsetWidth, h: img.height * (State.view.offsetWidth/img.width), tokens: [] };
            State.scenes.push(s); this.switchScene(s.id);
        }; img.src = src;
    },
    switchScene(id) {
        State.layer.innerHTML = ""; State.activeScene = State.scenes.findIndex(s => s.id === id);
        State.scenes[State.activeScene].tokens.forEach(t => App.drawToken(t)); App.render(); UI.updateScenesList();
    },
    deleteScene(id, e) { e.stopPropagation(); if (State.scenes.length <= 1) return; State.scenes = State.scenes.filter(s => s.id !== id); this.switchScene(State.scenes[0].id); },
    save() {
        const data = State.scenes.map(s => ({ ...s, img: null, tokens: s.tokens.map(({el, ...t}) => t) }));
        localStorage.setItem('vtt_save', JSON.stringify(data)); UI.toast("💾 Sauvegardé");
    },
    load() {
        const saved = localStorage.getItem('vtt_save'); if (!saved) return;
        const data = JSON.parse(saved); State.scenes = [];
        data.forEach((sD, idx) => {
            const img = new Image(); img.onload = () => { const s = { ...sD, img }; State.scenes.push(s); if (idx === 0) this.switchScene(s.id); };
            img.src = sD.src;
        });
    }
};

function updateSelected(k, v) { State.selectedTokens.forEach(t => { t[k] = v; App.updateTokenPos(t); }); }
function rotateS() { State.selectedTokens.forEach(t => { t.rot = (t.rot + 45) % 360; App.updateTokenPos(t); }); }
function flipS() { State.selectedTokens.forEach(t => { t.flip *= -1; App.updateTokenPos(t); }); }
function lockS() { State.selectedTokens.forEach(t => { t.isLocked = !t.isLocked; document.getElementById('btn-lock').innerText = t.isLocked ? "🔒" : "🔓"; }); }
function deleteS() { State.selectedTokens.forEach(t => { t.el.remove(); State.scenes[State.activeScene].tokens = State.scenes[State.activeScene].tokens.filter(tk => tk.id !== t.id); }); App.clearSelection(); UI.close(); }

App.init();
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js'); }