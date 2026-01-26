// --- 1. CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDilUDfyFsebnbQ9pAXyL7ptbSy5CY_cmk",
  authDomain: "fpc-per.firebaseapp.com",
  databaseURL: "https://fpc-per-default-rtdb.firebaseio.com",
  projectId: "fpc-per",
  storageBucket: "fpc-per.firebasestorage.app",
  messagingSenderId: "817616563956",
  appId: "1:817616563956:web:21dbbbcbb69e0cae10f8a1"
};

try {
    firebase.initializeApp(firebaseConfig);
    var database = firebase.database();
} catch (e) {
    console.log("Modo Offline");
}

window.onerror = function(msg, url, line) { console.error("Erro capturado: " + msg); return false; };
function appRefresh() { window.location.reload(true); }

const DB_KEY = 'dhpe_v01_db'; const SESS_KEY = 'dhpe_sess_v01'; const REMEMBER_KEY = 'dhpe_remember_token_v01';
const ADMIN_CPF = "083.276.324-18"; const ADMIN_PASS = "0800"; 
const LAST_TAB_KEY = 'dhpe_last_tab_v01'; const LAST_ADM_KEY = 'dhpe_last_adm_v01';
const DEFAULT_POINTS = [50, 45, 40, 35, 30, 26, 24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4, 3, 2, 1];
const DEFAULT_DB = { users: [], events: [], tempos: [], ranking: [], config: { phone: '' } };

var db = JSON.parse(localStorage.getItem(DB_KEY));
if(!db) db = DEFAULT_DB;
if(!db.users) db.users = []; if(!db.events) db.events = []; if(!db.tempos) db.tempos = []; if(!db.ranking) db.ranking = [];

// Força Admin
const adminIndex = db.users.findIndex(u => cleanCPF(u.cpf) === cleanCPF(ADMIN_CPF));
if(adminIndex < 0) {
    db.users.push({ nome: "ABRAAO EVERTON", cpf: ADMIN_CPF, pass: ADMIN_PASS, cat: "ORGANIZAÇÃO", tel: "81900000000", city: "RECIFE", gender:"M", role: "ADMIN", allowedEvts: [], inscricoes: [], selfie: null, secQ: 'time', secA: 'SPORT' });
} else {
    db.users[adminIndex].role = "ADMIN";
}

if(typeof database !== 'undefined') {
    database.ref(DB_KEY).on('value', (snapshot) => {
        const remoteData = snapshot.val();
        if (remoteData) {
            db = remoteData;
            if(!db.events) db.events = [];
            localStorage.setItem(DB_KEY, JSON.stringify(db));
            if(currentTab === 'calendar') renderContent('calendar');
        }
    });
}

function saveDB() { 
    localStorage.setItem(DB_KEY, JSON.stringify(db)); 
    if(typeof database !== 'undefined') { database.ref(DB_KEY).set(db); }
}

function cleanCPF(v) { if(!v) return ""; return String(v).replace(/\D/g, ""); } 
function toast(m) { const t=document.getElementById('toast'); if(t) { t.innerText=m.toUpperCase(); t.style.background = "#28a745"; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3000); } }
function getUser() { return JSON.parse(localStorage.getItem(SESS_KEY)); }
function saveInput(el) { if(el && el.id && el.type !== 'file') localStorage.setItem('autosave_' + el.id, el.value); }
function restoreInputs() { document.querySelectorAll('input, select').forEach(el => { if(el.id && el.type !== 'file' && localStorage.getItem('autosave_' + el.id)) el.value = localStorage.getItem('autosave_' + el.id); }); }
function mascaraCPF(i) { let v = i.value.replace(/\D/g, ""); i.value = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"); saveInput(i); }
function mascaraTel(i) { let v = i.value.replace(/\D/g, ""); i.value = v.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3"); saveInput(i); }
function mascaraDias(i) { let v=i.value.replace(/\D/g,""); if(v.length>4)v=v.substring(0,4); if(v.length>2)v=v.substring(0,2)+'/'+v.substring(2); i.value=v; saveInput(i); }
function togglePass(id) { const el = document.getElementById(id); if(el) el.type = el.type === 'password' ? 'text' : 'password'; }
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); }

// --- LOGIN ---
function fazerLogin() { 
    try {
        const cpfRaw = document.getElementById('login-cpf').value;
        const pass = document.getElementById('login-pass').value; 
        if(!cpfRaw || !pass) return toast("PREENCHA TUDO");
        const user = db.users.find(x => cleanCPF(x.cpf) === cleanCPF(cpfRaw) && x.pass === pass);
        if(user) { 
            loggedUser = user; 
            localStorage.setItem(SESS_KEY, JSON.stringify(user));
            initApp(); 
        } else { toast("DADOS INCORRETOS"); }
    } catch(e) { console.log(e); }
}
function fazerLogout() { localStorage.removeItem(SESS_KEY); window.location.reload(true); }

let currentTab = 'calendar'; let loggedUser = null; let currentAdmSection = null; let currentPayId = null; let currentFilterStatus = 'ALL';

function trocarTela(id) { 
    document.querySelectorAll('.screen').forEach(e=>e.classList.remove('active')); 
    const tela = document.getElementById('screen-'+id); if(tela) tela.classList.add('active');
    if(id === 'app') { document.getElementById('main-nav-bar').style.display = 'flex'; document.getElementById('main-app-header').style.display = 'flex'; } 
    else { document.getElementById('main-nav-bar').style.display = 'none'; document.getElementById('main-app-header').style.display = 'none'; }
}

function nav(t) {
    currentTab = t; localStorage.setItem(LAST_TAB_KEY, t);
    document.querySelectorAll('.bar-item').forEach(b => b.classList.remove('active'));
    if(document.getElementById('btn-'+t)) document.getElementById('btn-'+t).classList.add('active');
    document.querySelectorAll('.c-sec').forEach(e => e.style.display='none');
    document.getElementById('cont-'+t).style.display='block';
    
    if(t === 'adm') { 
        if(loggedUser && (loggedUser.role === 'ADMIN' || loggedUser.role === 'ORGANIZER')) {
            document.getElementById('adm-login-box').style.display = 'none';
            document.getElementById('adm-panel-real').style.display = 'block';
            openAdmSection(localStorage.getItem(LAST_ADM_KEY) || 'menu');
        } else {
             document.getElementById('adm-login-box').style.display = 'block';
             document.getElementById('adm-panel-real').style.display = 'none';
        }
    } else { renderContent(t); }
}

function tryOpenAdmin() { if(loggedUser && (loggedUser.role === 'ADMIN' || loggedUser.role === 'ORGANIZER')) nav('adm'); else toast("ACESSO NEGADO"); }

function initApp() { 
    trocarTela('app'); 
    if(loggedUser && (loggedUser.role === 'ADMIN' || loggedUser.role === 'ORGANIZER')) document.getElementById('btn-adm').style.display = 'flex'; 
    else document.getElementById('btn-adm').style.display = 'none'; 
    nav(localStorage.getItem(LAST_TAB_KEY) || 'calendar');
}

// --- ADMIN ---
function openAdmSection(sec) {
    currentAdmSection = sec; localStorage.setItem(LAST_ADM_KEY, sec);
    document.querySelectorAll('.adm-section').forEach(el => el.style.display = 'none');
    document.getElementById('adm-menu').style.display = 'none';
    if(sec === 'menu') {
        document.getElementById('adm-menu').style.display = 'grid';
        const isMaster = loggedUser.cpf && cleanCPF(loggedUser.cpf) === cleanCPF(ADMIN_CPF);
        const isAdmin = (loggedUser.role === 'ADMIN') || isMaster;
        document.getElementById('btn-adm-events').style.display = isAdmin ? 'block' : 'none';
        document.getElementById('btn-adm-users').style.display = isAdmin ? 'block' : 'none';
        document.getElementById('btn-adm-org').style.display = isAdmin ? 'block' : 'none';
        document.getElementById('btn-adm-cfg').style.display = isAdmin ? 'block' : 'none';
        return;
    }
    document.getElementById('adm-sec-' + sec).style.display = 'block';
    if(sec === 'events') { renderAdmEvents(); if(!document.getElementById('adm-evt-id-edit').value) renderPointsInputs(DEFAULT_POINTS); }
    if(sec === 'results') { renderAdmResults(); }
    if(sec === 'users-edit') { filterPilots('edit-user', true); }
    if(sec === 'financial') { 
        let evts = db.events;
        if(loggedUser.role === 'ORGANIZER' && loggedUser.allowedEvts) { evts = db.events.filter(e => loggedUser.allowedEvts.includes(e.id.toString())); }
        const sel = document.getElementById('fin-evt-select');
        sel.innerHTML = '<option value="">SELECIONE...</option><option value="ALL">GERAL</option>' + evts.map(e => `<option value="${e.id}">${e.t}</option>`).join('');
    }
    if(sec === 'organizer') renderOrgList();
    if(sec === 'config-global') document.getElementById('adm-cfg-phone').value = db.config.phone || '';
}

function backToAdmMenu() { openAdmSection('menu'); }

// 1. EVENTOS
function renderPointsInputs(pts) {
    const grid = document.getElementById('evt-points-grid'); if(!grid) return;
    const finalPts = (pts && pts.length === 20) ? pts : DEFAULT_POINTS;
    grid.innerHTML = finalPts.map((p, i) => `<input type="number" placeholder="${i+1}º" id="pt-${i}" value="${p}" style="text-align:center; font-size:10px; padding:4px;" class="input-field">`).join('');
}

function renderAdmEvents() {
    const list = db.events || [];
    document.getElementById('adm-list-events').innerHTML = list.map((e, i) => `
        <div class="adm-card">
            <div><b>${e.t}</b> <br> <span style="font-size:10px">${e.d} ${e.m} | ${e.status}</span></div>
            <div style="display:flex; gap:5px">
                <button class="btn-mini-adm" style="background:#3b82f6" onclick="editEvent(${e.id})"><i class="fas fa-pen"></i></button>
                <button class="btn-mini-adm" style="background:#ef4444" onclick="delEvent('${e.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>`).join('');
}

function addEvent() {
    const btn = document.getElementById('btn-save-event'); btn.innerText = "PROCESSANDO...";
    const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value : "";
    const t = getVal('adm-evt-t').toUpperCase(); const d = getVal('adm-evt-d');
    
    if(!t || !d) { btn.innerText = "SALVAR EVENTO"; return toast("PREENCHA NOME E DATA"); }

    const newPoints = []; 
    for(let i=0; i<20; i++) { const el = document.getElementById(`pt-${i}`); if(el) newPoints.push(el.value ? parseInt(el.value) : 0); }

    const evtObj = {
        id: getVal('adm-evt-id-edit') ? parseInt(getVal('adm-evt-id-edit')) : Date.now(),
        t: t, d: d, m: getVal('adm-evt-month'), city: getVal('adm-evt-c').toUpperCase(), val: getVal('adm-evt-v'),
        pix: getVal('adm-evt-pix'), status: getVal('adm-evt-status'), points: newPoints,
        closeDate: getVal('adm-evt-close-date'), open: true, img: null
    };

    if(getVal('adm-evt-id-edit')) {
        const old = db.events.find(e => e.id == evtObj.id);
        if(old && old.img) evtObj.img = old.img;
    }

    const fileInput = document.getElementById('adm-evt-img');
    if (fileInput && fileInput.files[0]) {
        compressImage(fileInput.files[0], 800, (base64) => { evtObj.img = base64; finishSavingEvent(evtObj); });
    } else { finishSavingEvent(evtObj); }
}

function finishSavingEvent(evtObj) {
    const idx = db.events.findIndex(e => e.id == evtObj.id);
    if(idx > -1) db.events[idx] = evtObj; else db.events.push(evtObj);
    saveDB(); toast("EVENTO SALVO!");
    document.getElementById('btn-save-event').innerText = "SALVAR EVENTO";
    renderAdmEvents(); renderContent('calendar'); clearEventForm(); 
}

function delEvent(id) {
    if(confirm("Excluir evento?")) {
        const idx = db.events.findIndex(e => e.id == id);
        if(idx > -1) { db.events.splice(idx, 1); saveDB(); renderAdmEvents(); renderContent('calendar'); }
    }
}

function editEvent(id) {
    const e = db.events.find(ev => ev.id == id);
    if(e) {
        document.getElementById('adm-evt-id-edit').value = e.id;
        document.getElementById('adm-evt-t').value = e.t;
        document.getElementById('adm-evt-d').value = e.d;
        document.getElementById('adm-evt-c').value = e.city;
        document.getElementById('adm-evt-v').value = e.val;
        document.getElementById('adm-evt-pix').value = e.pix || '';
        document.getElementById('adm-evt-month').value = e.m || 'MAI';
        document.getElementById('adm-evt-status').value = e.status || 'OPEN';
        document.getElementById('adm-evt-close-date').value = e.closeDate || '';
        renderPointsInputs(e.points || DEFAULT_POINTS); 
        document.getElementById('btn-save-event').innerText = "ATUALIZAR EVENTO";
        document.getElementById('adm-sec-events').scrollIntoView();
    }
}

function clearEventForm() {
    document.getElementById('adm-evt-id-edit').value = ''; document.getElementById('adm-evt-t').value = '';
    document.getElementById('btn-save-event').innerText = "SALVAR EVENTO";
    renderPointsInputs(DEFAULT_POINTS);
}

function persistEventForm() { saveInput(document.getElementById('adm-evt-t')); }

// 2. BUSCA
function filterPilots(ctx, force) {
    const inputEl = document.getElementById(ctx === 'res' ? 'adm-res-search' : (ctx === 'org' ? 'adm-org-search' : 'adm-edit-user-search'));
    const term = inputEl.value.toUpperCase();
    const listDiv = document.getElementById(ctx === 'res' ? 'adm-res-list' : (ctx === 'org' ? 'adm-org-list-search' : 'adm-edit-user-list'));
    
    if(term.length < 2 && !force) { listDiv.style.display = 'none'; return; }
    
    let found = db.users.filter(u => u.nome.includes(term) || u.cpf.includes(term) || u.city.includes(term));

    if (ctx === 'res') {
        const evtId = document.getElementById('adm-res-evt').value;
        if (!evtId) { toast("SELECIONE O EVENTO!"); return; }
        // FILTRO: SÓ PAGO E INSCRITO
        found = found.filter(u => u.inscricoes.some(i => i.id == evtId && i.status === 'CONFIRMADO'));
    }

    listDiv.style.display = 'block';
    
    if(ctx === 'res') {
        if(found.length === 0) listDiv.innerHTML = '<div style="padding:10px; color:red">Nenhum piloto CONFIRMADO.</div>';
        else listDiv.innerHTML = found.map(u => `<div class="smart-item" onclick="selectResPilot('${u.cpf}', '${u.nome}')">${u.nome} - ${u.city}</div>`).join('');
    } else if (ctx === 'org') {
        listDiv.innerHTML = found.map(u => `<div class="smart-item" onclick="selectOrgPilot('${u.cpf}', '${u.nome}')">${u.nome} - ${u.city}</div>`).join('');
    } else {
        listDiv.innerHTML = found.map(u => {
            const wpp = `https://wa.me/55${u.tel ? u.tel.replace(/\D/g,'') : ''}`;
            return `<div class="adm-card"><div><b>${u.nome}</b><br><span style="font-size:10px;color:#666">${u.city} | ${u.cat}</span></div><div style="display:flex; gap:5px"><button class="btn-mini-adm" style="background:#25D366" onclick="window.open('${wpp}', '_blank')"><i class="fab fa-whatsapp"></i></button><button class="btn-mini-adm" style="background:#3b82f6" onclick="openEditUserModal('${u.cpf}')"><i class="fas fa-pen"></i></button><button class="btn-mini-adm" style="background:#ef4444" onclick="delUser('${u.cpf}')"><i class="fas fa-trash"></i></button></div></div>`;
        }).join('');
    }
}

function selectResPilot(cpf, name) { document.getElementById('adm-res-id').value = cpf; document.getElementById('adm-res-name-display').value = name; document.getElementById('adm-res-search').value = ''; document.getElementById('adm-res-list').style.display = 'none'; }
function selectOrgPilot(cpf, name) { document.getElementById('adm-org-selected-cpf').value = cpf; document.getElementById('adm-org-search').value = name; document.getElementById('adm-org-list-search').style.display = 'none'; document.getElementById('org-perms-area').style.display = 'block'; document.getElementById('org-events-list').innerHTML = db.events.map(e => `<label class="perm-item" style="display:block; margin:5px 0"><input type="checkbox" value="${e.id}" class="perm-cb"> ${e.t}</label>`).join(''); }

function toggleOrgList() {
    const list = document.getElementById('adm-list-orgs');
    const icon = document.getElementById('icon-org-toggle');
    if(list.style.display === 'none') { list.style.display = 'block'; icon.classList.remove('fa-chevron-down'); icon.classList.add('fa-chevron-up'); } 
    else { list.style.display = 'none'; icon.classList.remove('fa-chevron-up'); icon.classList.add('fa-chevron-down'); }
}

// FUNÇÃO CRÍTICA DE RESULTADOS CORRIGIDA
function addResult() {
    const evtId = document.getElementById('adm-res-evt').value;
    const cpf = document.getElementById('adm-res-id').value;
    const val = document.getElementById('adm-res-val').value;
    const num = document.getElementById('adm-res-num').value;
    const type = document.getElementById('adm-res-type').value;

    if(!evtId || !cpf || !val) return toast("PREENCHA TUDO");

    const exists = db.tempos.find(t => t.evtId == evtId && t.name === document.getElementById('adm-res-name-display').value);
    if(exists) return toast("PILOTO JÁ TEM TEMPO!");

    const user = db.users.find(u => u.cpf === cpf);
    const newData = { evtId, name: user.nome, cat: user.cat, city: user.city, val, num, status: loggedUser.role === 'ADMIN' ? 'OK' : 'PENDING' };

    if(type === 'tempos') db.tempos.push(newData); else db.ranking.push({ ...newData, val: val + ' PTS' });

    saveDB();
    toast("LANÇADO!");
    // ATUALIZA IMEDIATAMENTE
    renderAdmResults();
    // ATUALIZA TELA LIVE SE ESTIVER ABERTA
    if(window.liveInterval) atualizarLiveScreen(evtId);
    
    document.getElementById('adm-res-id').value = '';
    document.getElementById('adm-res-name-display').value = '';
    document.getElementById('adm-res-val').value = '';
}

function renderAdmResults() {
    const evtId = document.getElementById('adm-res-evt').value;
    document.getElementById('adm-res-evt').innerHTML = '<option value="">SELECIONE...</option>' + db.events.map(e => `<option value="${e.id}">${e.t}</option>`).join('');
    if(evtId) document.getElementById('adm-res-evt').value = evtId;

    // Filtra últimos resultados para mostrar
    document.getElementById('adm-list-results').innerHTML = db.tempos.slice(-10).reverse().map((t, i) => {
        const isPending = t.status === 'PENDING';
        const approveBtn = (isPending && loggedUser.role === 'ADMIN') ? `<button class="btn-mini-adm" style="background:green" onclick="approveRes(${db.tempos.indexOf(t)})">OK</button>` : '';
        return `<div class="adm-card" style="${isPending ? 'border-left:4px solid orange':''}"><span>${t.name} - ${t.val} ${isPending?'(PEND)':''}</span><div style="display:flex; gap:5px">${approveBtn}<button class="btn-mini-adm" style="background:#ef4444" onclick="delItem('tempos', ${db.tempos.indexOf(t)})">X</button></div></div>`;
    }).join('');
}

function approveRes(idx) { db.tempos[idx].status = 'OK'; saveDB(); renderAdmResults(); }

// --- TELA LIVE ---
function abrirLiveScreen() {
    const evtId = document.getElementById('adm-res-evt').value;
    if(!evtId) return toast("Selecione um evento!");
    document.getElementById('screen-live-monitor').style.display = 'flex';
    document.getElementById('live-title-display').innerText = db.events.find(e=>e.id==evtId).t;
    
    window.liveInterval = setInterval(() => { atualizarLiveScreen(evtId); }, 3000);
    atualizarLiveScreen(evtId);
}

function fecharLiveScreen() {
    document.getElementById('screen-live-monitor').style.display = 'none';
    if(window.liveInterval) clearInterval(window.liveInterval);
}

function atualizarLiveScreen(evtId) {
    const tempos = db.tempos.filter(t => t.evtId == evtId).sort((a,b) => (a.val > b.val) ? 1 : -1);
    const feed = db.tempos.filter(t => t.evtId == evtId).slice(-10).reverse();
    document.getElementById('live-feed-list').innerHTML = feed.map(t => `<div class="live-item"><span>${t.name}</span><b>${t.val}</b></div>`).join('');
    document.getElementById('live-ranking-list').innerHTML = tempos.map((t, i) => `<div class="live-item"><span class="pos">${i+1}</span> <span>${t.name}</span><b>${t.val}</b></div>`).join('');
}

// 5. RENDERIZAÇÃO PÚBLICA
function renderContent(t) {
    if(t === 'calendar') {
        const hD = document.getElementById('calendar-highlight');
        const oD = document.getElementById('calendar-others');
        if(!db.events || db.events.length === 0) { hD.innerHTML = '<div style="padding:20px;text-align:center">Nenhum evento.</div>'; oD.innerHTML = ''; return; }

        const events = db.events;
        const h = events.find(e => e.status === 'OPEN') || events[events.length-1];
        const imgHtml = (evt) => evt.img ? `<img src="${evt.img}" style="width:100%; height:auto; display:block; border-bottom:1px solid #eee">` : '';
        const today = new Date().toISOString().split('T')[0];
        const isClosed = (evt) => evt.closeDate && evt.closeDate < today;

        const getBtn = (evt) => {
            if(isClosed(evt) || evt.status === 'CLOSED') return `<button class="btn" style="margin-top:10px; background:#666" disabled>ENCERRADO</button>`;
            let btnText = "INSCREVER-SE";
            let btnColor = "var(--pe-blue)";
            let btnAction = `iniciarInscricao('${evt.id}','${evt.t}','${evt.val}')`;
            if(loggedUser) {
                const sub = loggedUser.inscricoes.find(i => i.id == evt.id);
                if(sub) {
                    if(sub.status === 'PENDENTE') { btnText = "PENDENTE (PAGAR)"; btnColor = "orange"; btnAction = `iniciarInscricao('${evt.id}','${evt.t}','${evt.val}')`; } 
                    else { btnText = "CONFIRMADO (VER TICKET)"; btnColor = "green"; btnAction = `abrirTicket('${evt.id}')`; }
                }
            }
            return `<div style="display:flex; gap:5px; margin-top:10px;"><button class="btn" style="flex:2; margin:0; background:${btnColor}" onclick="${btnAction}">${btnText}</button><button class="btn" style="flex:1; margin:0; background:#25D366" onclick="falarZapTicket()"><i class="fab fa-whatsapp"></i></button></div>`;
        };

        hD.innerHTML = `<div class="highlight-event">${imgHtml(h)}<div class="event-body"><div style="font-size:14px; font-weight:900; color:var(--pe-blue)">${h.t}</div><div style="font-size:12px; color:#666; margin:5px 0">${h.d} ${h.m} | ${h.city}</div><div class="event-price">INSCRIÇÃO: R$ ${h.val}</div><div style="margin-top:10px; font-size:10px"><b>STATUS:</b> <span style="color:${h.status==='OPEN'?'green':'red'}">${h.status==='OPEN'?'ABERTO':'ENCERRADO'}</span><br><b>ENCERRA EM:</b> ${h.closeDate ? h.closeDate.split('-').reverse().join('/') : 'INDEFINIDO'}</div>${getBtn(h)}</div></div>`;
        oD.innerHTML = events.filter(e => e.id !== h.id).map(e => `<div class="event-card">${imgHtml(e)}<div class="event-body" style="text-align:left"><div style="font-size:12px; font-weight:bold; color:var(--pe-blue)">${e.t}</div><div style="font-size:10px; color:#666">${e.d} ${e.m} - ${e.city}</div>${getBtn(e)}</div></div>`).join('');
    } else if (t === 'tempos' || t === 'ranking') {
        const list = db[t] ? db[t].filter(i => i.status === 'OK') : [];
        const div = document.getElementById('list-'+t);
        if(!div) return;
        div.innerHTML = list.map((r, i) => `<div class="rank-row"><div class="rank-pos">${i+1}</div><div class="rank-name">${r.name}<span class="rank-cat">${r.cat}</span></div><div class="rank-val">${r.val}</div></div>`).join('');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    restoreInputs(); 
    document.querySelectorAll('input').forEach(el => { el.addEventListener('input', () => saveInput(el)); });
    const b = document.getElementById('btn-acessar'); if(b) b.addEventListener('click', fazerLogin);
    const s = getUser(); if(s && db.users) { loggedUser = db.users.find(u=>cleanCPF(u.cpf)===cleanCPF(s.cpf)); if(loggedUser) initApp(); }
});

function compressImage(file, maxWidth, callback) {
    const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onload = event => { const img = new Image(); img.src = event.target.result; img.onload = () => { const canvas = document.createElement('canvas'); let width = img.width; let height = img.height; if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; } canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height); callback(canvas.toDataURL('image/jpeg', 0.7)); }; };
}

function openEditUserModal(cpf){const u=db.users.find(x=>x.cpf===cpf);if(u){document.getElementById('edit-user-original-cpf').value=u.cpf;document.getElementById('edit-user-name').value=u.nome;document.getElementById('edit-user-cpf').value=u.cpf;document.getElementById('edit-user-tel').value=u.tel;document.getElementById('edit-user-city').value=u.city;document.getElementById('edit-user-cat').value=u.cat;document.getElementById('edit-user-gender').value=u.gender;document.getElementById('edit-user-pass').value=u.pass;document.getElementById('modal-edit-user').style.display='flex';}}
function saveUserEdit(){const old=document.getElementById('edit-user-original-cpf').value;const idx=db.users.findIndex(x=>x.cpf===old);if(idx>-1){db.users[idx].nome=document.getElementById('edit-user-name').value.toUpperCase();db.users[idx].cpf=document.getElementById('edit-user-cpf').value;db.users[idx].cat=document.getElementById('edit-user-cat').value.toUpperCase();saveDB();toast("SALVO");document.getElementById('modal-edit-user').style.display='none';filterPilots('edit-user',true);}}
function delUser(cpf){if(confirm("Excluir?")){const i=db.users.findIndex(u=>u.cpf===cpf);if(i>-1){db.users.splice(i,1);saveDB();filterPilots('edit-user',true);}}}
function renderOrgList(){document.getElementById('adm-list-orgs').innerHTML=db.users.filter(u=>u.role==='ORGANIZER').map(u=>`<div class="adm-card">${u.nome}</div>`).join('');}
function saveGlobalConfig(){db.config.phone=document.getElementById('adm-cfg-phone').value;saveDB();toast("SALVO");}
function checkAdmPass(){if(document.getElementById('adm-pass-check').value===ADMIN_PASS){document.getElementById('adm-login-box').style.display='none';document.getElementById('adm-panel-real').style.display='block';backToAdmMenu();}else toast("ERRO");}
function copyPointsFrom(evtId){if(!evtId)return;const evt=db.events.find(e=>e.id==evtId);if(evt&&evt.points){renderPointsInputs(evt.points);toast("COPIADO!");}}
function saveAdmState(){localStorage.setItem(FORM_STATE_KEY,JSON.stringify({evt:document.getElementById('adm-res-evt').value}));}
function restoreAdmState(){const saved=JSON.parse(localStorage.getItem(FORM_STATE_KEY));if(saved&&saved.evt)document.getElementById('adm-res-evt').value=saved.evt;}
function restoreEventForm(){const saved=JSON.parse(localStorage.getItem(EVENT_FORM_KEY));if(saved)document.getElementById('adm-evt-t').value=saved.t||'';}
function renderInscriptions(){const evtId=document.getElementById('fin-evt-select').value;const div=document.getElementById('fin-list-container');if(!evtId)return div.innerHTML='';let t=0;let p=0;let html='<table class="fin-table" style="width:100%">';db.users.forEach(u=>{u.inscricoes.forEach(i=>{if(evtId==='ALL'||i.id==evtId){const evt=db.events.find(e=>e.id==i.id);if(i.status==='CONFIRMADO'&&evt)p+=parseFloat(evt.val);html+=`<tr><td><b>${u.nome}</b><br><small>${u.city} | ${u.cat}</small></td><td style="text-align:right"><button class="btn-mini-adm" style="background:${i.status==='CONFIRMADO'?'green':'orange'}" onclick="togglePay('${u.cpf}','${i.id}')">${i.status}</button></td></tr>`;}});});div.innerHTML=html;}
function togglePay(cpf,evtId){const u=db.users.find(x=>x.cpf===cpf);const i=u.inscricoes.find(x=>x.id==evtId);i.status=i.status==='CONFIRMADO'?'PENDENTE':'CONFIRMADO';saveDB();renderInscriptions();}
function cancelEditRes(){document.getElementById('adm-res-id').value='';}
function iniciarInscricao(evtId,evtName,val){if(!loggedUser)return toast("FAÇA LOGIN");if(!loggedUser.inscricoes.some(i=>i.id==evtId)) currentPayId={id:parseInt(evtId),name:evtName};const evt=db.events.find(e=>e.id==parseInt(evtId));document.getElementById('pix-valor-display').innerText=val;document.getElementById('pix-copy').innerText=evt.pix||"";document.getElementById('modal-pix').style.display='flex';}
function enviarComprovanteWhatsApp(){window.open(`https://wa.me/${db.config.phone}?text=Comprovante`,'_blank');}
function falarZapTicket(){window.open(`https://wa.me/${db.config.phone}?text=Duvida`,'_blank');}
function confirmarJaPaguei(){if(!loggedUser.inscricoes.some(i=>i.id==currentPayId.id)){loggedUser.inscricoes.push({id:currentPayId.id,status:'PENDENTE'});const i=db.users.findIndex(x=>x.cpf===loggedUser.cpf);db.users[i]=loggedUser;saveDB();localStorage.setItem(SESS_KEY,JSON.stringify(loggedUser));}fecharModal('modal-pix');toast("REGISTRADO!");renderContent('calendar');}
function verCartaz(id){const evt=db.events.find(e=>e.id==id);if(evt&&evt.img){document.getElementById('img-poster-view').src=evt.img;document.getElementById('modal-poster').style.display='flex';}}
function fecharModal(id){document.getElementById(id).style.display='none';}
function openModal(id){document.getElementById(id).style.display='flex';}
function toggleNovoEventoForm(){const f=document.getElementById('form-novo-evento');f.style.display=f.style.display==='none'?'block':'none';}
function toggleEventStatus(id){const e=db.events.find(ev=>ev.id==id);if(e){e.status=e.status==='OPEN'?'CLOSED':'OPEN';saveDB();renderAdmEvents();}}
function editarUsuario(cpf){openEditUserModal(cpf);}
function abrirRecuperacao(){document.getElementById('modal-recovery').style.display='flex';}
function navToRegister(){trocarTela('cadastro');}
function salvarDadosPerfil(){if(!loggedUser)return;loggedUser.tel=document.getElementById('prof-edit-tel').value;saveDB();toast("SALVO");}
function toggleCarteirinha(){const a=document.getElementById('carteirinha-area');a.style.display=a.style.display==='none'?'block':'none';}
function uploadSelfie(input){if(input.files[0]){compressImage(input.files[0],300,(base64)=>{if(loggedUser){loggedUser.selfie=base64;saveDB();}document.getElementById('prof-img-display').src=base64;});}}
function maskTimeOrPoints(i){let v=i.value.replace(/\D/g,"");if(v.length>7)v=v.substring(0,7);i.value=v;}
function copiarPix(){navigator.clipboard.writeText(document.getElementById('pix-copy').innerText);toast("COPIADO!");}
function shareTicketImage(){html2canvas(document.getElementById('ticket-capture-area')).then(canvas=>{const link=document.createElement('a');link.download='ticket_dhpe.jpg';link.href=canvas.toDataURL();link.click();});}
function baixarImagem(id, nome){html2canvas(document.getElementById(id)).then(canvas=>{const link=document.createElement('a');link.download=nome+'.jpg';link.href=canvas.toDataURL();link.click();});}
function showPublicPoints(){openModal('modal-points');}
function filterFinList(s){currentFilterStatus=s;renderInscriptions();}
function promoteToOrganizer() { const cpf = document.getElementById('adm-org-selected-cpf').value; if(!cpf) return toast("SELECIONE UM ATLETA"); const perms = []; document.querySelectorAll('.perm-cb:checked').forEach(cb => perms.push(cb.value)); const idx = db.users.findIndex(u => u.cpf === cpf); if(idx > -1) { db.users[idx].role = 'ORGANIZER'; db.users[idx].allowedEvts = perms; db.users[idx].cat = "ORGANIZAÇÃO"; saveDB(); toast("PROMOVIDO!"); document.getElementById('adm-org-search').value = ''; document.getElementById('org-perms-area').style.display = 'none'; renderOrgList(); } }
function abrirTicket(evtId) {
    const evt = db.events.find(e=>e.id==evtId);
    document.getElementById('share-piloto-name').innerText = loggedUser.nome;
    document.getElementById('share-cpf').innerText = loggedUser.cpf;
    document.getElementById('share-cat').innerText = loggedUser.cat;
    document.getElementById('share-event-name').innerText = evt.t;
    document.getElementById('modal-share').style.display = 'flex';
}
function delItem(col,idx){ if(confirm("Deletar?")){db[col].splice(idx,1);saveDB();renderAdmResults();} }
