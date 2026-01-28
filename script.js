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
const DEFAULT_DB = { 
    users: [], events: [], tempos: [], ranking: [], 
    config: { phone: '', theme: {}, labels: {} } 
};

var db = JSON.parse(localStorage.getItem(DB_KEY));
if(!db) db = DEFAULT_DB;
if(!db.users) db.users = []; if(!db.events) db.events = []; if(!db.tempos) db.tempos = [];
if(!db.ranking) db.ranking = [];
if(!db.config) db.config = { phone: '', theme: {}, labels: {} };

// Força Admin
const adminIndex = db.users.findIndex(u => cleanCPF(u.cpf) === cleanCPF(ADMIN_CPF));
if(adminIndex < 0) {
    db.users.push({ nome: "ABRAAO EVERTON", cpf: ADMIN_CPF, pass: ADMIN_PASS, cat: "ORGANIZAÇÃO", tel: "81900000000", city: "RECIFE", gender:"M", role: "ADMIN", allowedEvts: [], inscricoes: [], selfie: null, secQ: 'time', secA: 'SPORT', team: 'ORGANIZAÇÃO' });
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
            checkInscricaoNotification();
            applyCustomization();
        }
    });
}

function saveDB() { 
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    if(typeof database !== 'undefined') { database.ref(DB_KEY).set(db); }
}

function cleanCPF(v) { if(!v) return ""; return String(v).replace(/\D/g, ""); } 

function toast(m, loading=false) { 
    const t=document.getElementById('toast'); 
    if(t) { 
        t.innerHTML = loading ? `<i class="fas fa-spinner fa-spin"></i> ${m.toUpperCase()}` : `<i class="fas fa-check"></i> ${m.toUpperCase()}`; 
        t.style.background = loading ? "#0038a8" : "#28a745"; 
        t.classList.add('show'); 
        if(!loading) setTimeout(()=>t.classList.remove('show'),3000); 
    } 
}
function hideToast() { document.getElementById('toast').classList.remove('show'); }

function getUser() { return JSON.parse(localStorage.getItem(SESS_KEY)); }

function saveInput(el) { if(el && el.id && el.type !== 'file') localStorage.setItem('autosave_' + el.id, el.value); }
function restoreInputs() { document.querySelectorAll('input, select').forEach(el => { if(el.id && el.type !== 'file' && localStorage.getItem('autosave_' + el.id)) el.value = localStorage.getItem('autosave_' + el.id); }); }

// --- PERSONALIZAÇÃO ---
function applyCustomization() {
    if(!db.config) return;
    const theme = db.config.theme || {};
    const labels = db.config.labels || {};
    const root = document.documentElement;
    if(theme.blue) root.style.setProperty('--pe-blue', theme.blue);
    if(theme.yellow) root.style.setProperty('--pe-yellow', theme.yellow);
    if(theme.red) root.style.setProperty('--pe-red', theme.red);
    if(theme.green) root.style.setProperty('--pe-green', theme.green);
    if(labels.cal) document.getElementById('nav-lbl-calendar').innerText = labels.cal;
    if(labels.tempos) document.getElementById('nav-lbl-tempos').innerText = labels.tempos;
    if(labels.ranking) document.getElementById('nav-lbl-ranking').innerText = labels.ranking;
    document.getElementById('cust-color-blue').value = theme.blue || '#0038a8';
    document.getElementById('cust-color-yellow').value = theme.yellow || '#ffe500';
    document.getElementById('cust-color-red').value = theme.red || '#d50000';
    document.getElementById('cust-color-green').value = theme.green || '#009b3a';
    document.getElementById('cust-lbl-cal').value = labels.cal || 'CAL';
    document.getElementById('cust-lbl-tempos').value = labels.tempos || 'TEMPO';
    document.getElementById('cust-lbl-ranking').value = labels.ranking || 'RANK';
}

function saveCustomization() {
    if(!db.config) db.config = {};
    db.config.theme = {
        blue: document.getElementById('cust-color-blue').value,
        yellow: document.getElementById('cust-color-yellow').value,
        red: document.getElementById('cust-color-red').value,
        green: document.getElementById('cust-color-green').value
    };
    db.config.labels = {
        cal: document.getElementById('cust-lbl-cal').value.toUpperCase(),
        tempos: document.getElementById('cust-lbl-tempos').value.toUpperCase(),
        ranking: document.getElementById('cust-lbl-ranking').value.toUpperCase()
    };
    saveDB();
    applyCustomization();
    toast("PERSONALIZAÇÃO SALVA!");
    fecharModal('modal-customize');
}

function reCalcCat() {
    const nasc = document.getElementById('cad-nasc').value;
    const gender = document.getElementById('cad-gender').value;
    const display = document.getElementById('cad-cat-age');
    const finalInput = document.getElementById('cad-cat-final');
    if(!nasc || !gender) return;
    const year = parseInt(nasc.split('-')[0]);
    const currentYear = 2026;
    const age = currentYear - year;
    let cat = "AMADOR";
    if(gender === 'F') { cat = "FEMININO"; } 
    else {
        if(age >= 12 && age <= 14) cat = "INFANTO-JUVENIL";
        else if(age >= 15 && age <= 16) cat = "JUVENIL";
        else if(age >= 17 && age <= 18) cat = "JUNIOR";
        else if(age >= 19 && age <= 29) cat = "SUB-30";
        else if(age >= 30 && age <= 34) cat = "MASTER A1";
        else if(age >= 35 && age <= 39) cat = "MASTER A2";
        else if(age >= 40 && age <= 44) cat = "MASTER B1";
        else if(age >= 45 && age <= 49) cat = "MASTER B2";
        else if(age >= 50 && age <= 54) cat = "MASTER C1";
        else if(age >= 55 && age <= 59) cat = "MASTER C2";
        else if(age >= 60) cat = "MASTER D";
        else cat = "SUB-30";
    }
    display.value = `${cat} (${age} ANOS)`;
    finalInput.value = cat;
    applyCatOverride();
}

function applyCatOverride() {
    const override = document.getElementById('cad-cat-override').value;
    const finalInput = document.getElementById('cad-cat-final');
    if(override) { finalInput.value = override; } 
    else { const displayVal = document.getElementById('cad-cat-age').value; if(displayVal) finalInput.value = displayVal.split(' ')[0]; }
}

let lastStatusMap = {};
function checkInscricaoNotification() {
    if(!loggedUser) return;
    const freshUser = db.users.find(u => u.cpf === loggedUser.cpf);
    if(!freshUser || !freshUser.inscricoes) return;
    freshUser.inscricoes.forEach(ins => {
        const key = ins.id;
        if(lastStatusMap[key] && lastStatusMap[key] !== 'CONFIRMADO' && ins.status === 'CONFIRMADO') {
            const evt = db.events.find(e => e.id == ins.id);
            if(evt) {
                alert(`PARABÉNS! SUA INSCRIÇÃO EM "${evt.t}" FOI APROVADA!`);
                loggedUser = freshUser;
                localStorage.setItem(SESS_KEY, JSON.stringify(loggedUser));
                renderContent(currentTab);
            }
        }
        lastStatusMap[key] = ins.status;
    });
}

function validarCPF(cpf) { cpf = cpf.replace(/[^\d]+/g,''); if(cpf == '') return false; if (cpf.length != 11 || cpf == "00000000000" || cpf == "11111111111" || cpf == "22222222222" || cpf == "33333333333" || cpf == "44444444444" || cpf == "55555555555" || cpf == "66666666666" || cpf == "77777777777" || cpf == "88888888888" || cpf == "99999999999") return false; add = 0; for (i=0; i < 9; i ++) add += parseInt(cpf.charAt(i)) * (10 - i); rev = 11 - (add % 11); if (rev == 10 || rev == 11) rev = 0; if (rev != parseInt(cpf.charAt(9))) return false; add = 0; for (i = 0; i < 10; i ++) add += parseInt(cpf.charAt(i)) * (11 - i); rev = 11 - (add % 11); if (rev == 10 || rev == 11) rev = 0; if (rev != parseInt(cpf.charAt(10))) return false; return true; }
function mascaraCPF(i) { let v = i.value.replace(/\D/g, ""); i.value = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"); if(v.length >= 11) { if(validarCPF(v)) { i.classList.add('valid'); i.classList.remove('invalid'); } else { i.classList.add('invalid'); i.classList.remove('valid'); } } else { i.classList.remove('valid'); i.classList.remove('invalid'); } saveInput(i); }
function mascaraTel(i) { let v = i.value.replace(/\D/g, ""); i.value = v.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3"); saveInput(i); }
function mascaraDias(i) { let v=i.value.replace(/\D/g,""); if(v.length>4)v=v.substring(0,4); if(v.length>2)v=v.substring(0,2)+'/'+v.substring(2); i.value=v; saveInput(i); }
function togglePass(id) { const el = document.getElementById(id); if(el) el.type = el.type === 'password' ? 'text' : 'password'; }
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); }

function cadastrar() { 
    const nome = document.getElementById('cad-nome').value.toUpperCase(); 
    const cpf = document.getElementById('cad-cpf').value; 
    const tel = document.getElementById('cad-tel').value; 
    const city = document.getElementById('cad-city').value.toUpperCase(); 
    const gender = document.getElementById('cad-gender').value; 
    const pass = document.getElementById('cad-pass').value; 
    const cat = document.getElementById('cad-cat-final').value; 
    const secA = document.getElementById('cad-sec-a').value.toUpperCase(); 
    if(!nome || !cpf || !tel || !city || !gender || !pass || !secA) return toast("PREENCHA TUDO"); 
    if(cleanCPF(cpf).length !== 11 || !validarCPF(cpf)) return toast("CPF INVÁLIDO"); 
    const exists = db.users.find(u => cleanCPF(u.cpf) === cleanCPF(cpf)); 
    if(exists) return toast("CPF JÁ CADASTRADO"); 
    const newUser = { nome, cpf, tel, city, gender, pass, cat, secA, team: '', role: 'USER', inscricoes: [], selfie: null, allowedEvts: [] }; 
    db.users.push(newUser); 
    saveDB(); 
    toast("BEM-VINDO!"); 
    loggedUser = newUser; 
    localStorage.setItem(SESS_KEY, JSON.stringify(newUser)); 
    localStorage.removeItem('autosave_cad-nome'); 
    localStorage.removeItem('autosave_cad-cpf'); 
    initApp(); 
}

function buscarUsuarioRecuperacao() { const cpf = document.getElementById('rec-cpf').value; const tel = document.getElementById('rec-tel').value; const user = db.users.find(u => cleanCPF(u.cpf) === cleanCPF(cpf)); if(user) { const cleanTelUser = user.tel.replace(/\D/g,''); const cleanTelInput = tel.replace(/\D/g,''); if(cleanTelUser === cleanTelInput) { document.getElementById('rec-security-area').style.display = 'block'; document.getElementById('btn-buscart-rec').style.display = 'none'; toast("USUÁRIO ENCONTRADO"); } else { toast("TELEFONE NÃO CONFERE"); } } else { toast("USUÁRIO NÃO ENCONTRADO"); } }
function revelarSenha() { const cpf = document.getElementById('rec-cpf').value; const answer = document.getElementById('rec-answer').value.toUpperCase(); const user = db.users.find(u => cleanCPF(u.cpf) === cleanCPF(cpf)); if(user && user.secA === answer) { alert("SUA SENHA É: " + user.pass); fecharModal('modal-recovery'); trocarTela('login'); } else { toast("RESPOSTA INCORRETA"); } }
function fazerLogin() { try { const cpfRaw = document.getElementById('login-cpf').value; const pass = document.getElementById('login-pass').value; if(!cpfRaw || !pass) return toast("PREENCHA TUDO"); const user = db.users.find(x => cleanCPF(x.cpf) === cleanCPF(cpfRaw) && x.pass === pass); if(user) { loggedUser = user; localStorage.setItem(SESS_KEY, JSON.stringify(user)); initApp(); } else { toast("DADOS INCORRETOS"); } } catch(e) { console.log(e); } }
function fazerLogout() { localStorage.removeItem(SESS_KEY); window.location.reload(true); }

let currentTab = 'calendar'; let loggedUser = null; let currentAdmSection = null; let currentPayId = null; let currentFilterStatus = 'ALL';

function trocarTela(id) { document.querySelectorAll('.screen').forEach(e=>e.classList.remove('active')); const tela = document.getElementById('screen-'+id); if(tela) tela.classList.add('active'); if(id === 'app') { document.getElementById('main-nav-bar').style.display = 'flex'; document.getElementById('main-app-header').style.display = 'flex'; } else { document.getElementById('main-nav-bar').style.display = 'none'; document.getElementById('main-app-header').style.display = 'none'; } }
function nav(t) { currentTab = t; localStorage.setItem(LAST_TAB_KEY, t); document.querySelectorAll('.bar-item').forEach(b => b.classList.remove('active')); if(document.getElementById('btn-'+t)) document.getElementById('btn-'+t).classList.add('active'); document.querySelectorAll('.c-sec').forEach(e => e.style.display='none'); document.getElementById('cont-'+t).style.display='block'; if(t === 'tempos' || t === 'ranking') { populatePublicFilters(t); } if(t === 'adm') { if(loggedUser && (loggedUser.role === 'ADMIN' || loggedUser.role === 'ORGANIZER')) { document.getElementById('adm-login-box').style.display = 'none'; document.getElementById('adm-panel-real').style.display = 'block'; openAdmSection(localStorage.getItem(LAST_ADM_KEY) || 'menu'); } else { document.getElementById('adm-login-box').style.display = 'block'; document.getElementById('adm-panel-real').style.display = 'none'; } } else { renderContent(t); } }
function tryOpenAdmin() { if(loggedUser && (loggedUser.role === 'ADMIN' || loggedUser.role === 'ORGANIZER')) nav('adm'); else toast("ACESSO NEGADO"); }
function initApp() { trocarTela('app'); if(loggedUser && (loggedUser.role === 'ADMIN' || loggedUser.role === 'ORGANIZER')) document.getElementById('btn-adm').style.display = 'flex'; else document.getElementById('btn-adm').style.display = 'none'; nav(localStorage.getItem(LAST_TAB_KEY) || 'calendar'); applyCustomization(); }

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
    if(sec === 'events') { 
        renderAdmEvents(); 
        if(!document.getElementById('adm-evt-id-edit').value) renderPointsInputs(DEFAULT_POINTS); 
    } 
    if(sec === 'results') { renderAdmResults(); } 
    if(sec === 'users-edit') { filterPilots('edit-user', true); } 
    if(sec === 'financial') { let evts = db.events; if(loggedUser.role === 'ORGANIZER' && loggedUser.allowedEvts) { evts = db.events.filter(e => loggedUser.allowedEvts.includes(e.id.toString())); } const sel = document.getElementById('fin-evt-select'); sel.innerHTML = '<option value="">SELECIONE...</option><option value="ALL">GERAL</option>' + evts.map(e => `<option value="${e.id}">${e.t}</option>`).join(''); } 
    if(sec === 'organizer') renderOrgList(); 
    if(sec === 'config-global') document.getElementById('adm-cfg-phone').value = db.config.phone || ''; 
}
function backToAdmMenu() { openAdmSection('menu'); }

// --- ADMINISTRAÇÃO E LÓGICA DE DADOS ---
function renderPointsInputs(pts) { const grid = document.getElementById('evt-points-grid'); if(!grid) return; const finalPts = (pts && pts.length === 20) ? pts : DEFAULT_POINTS; grid.innerHTML = finalPts.map((p, i) => `<input type="number" placeholder="${i+1}º" id="pt-${i}" value="${p}" style="text-align:center; font-size:10px; padding:4px;" class="input-field">`).join(''); }
function copyPointsFrom(sourceId) { if(!sourceId) return; const sourceEvt = db.events.find(e => e.id == sourceId); if(sourceEvt && sourceEvt.points) { renderPointsInputs(sourceEvt.points); toast("PONTOS COPIADOS!"); } else { toast("EVENTO S/ PONTOS"); } }
function renderAdmEvents() { const list = db.events || []; document.getElementById('adm-list-events').innerHTML = list.map((e, i) => ` <div class="adm-card"> <div><span style="font-size:9px; font-weight:bold; color:${e.type==='CBC'?'goldenrod':'blue'}">[${e.type||'PE'}]</span> <b>${e.t}</b> <br> <span style="font-size:10px">${e.d} ${e.m} | ${e.status}</span></div> <div style="display:flex; gap:5px"> <button class="btn-mini-adm" style="background:#3b82f6" onclick="editEvent(${e.id})"><i class="fas fa-pen"></i></button> <button class="btn-mini-adm" style="background:#ef4444" onclick="delEvent('${e.id}')"><i class="fas fa-trash"></i></button> </div> </div>`).join(''); }

function addEvent() { const btn = document.getElementById('btn-save-event'); btn.innerText = "PROCESSANDO..."; const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value : ""; const t = getVal('adm-evt-t').toUpperCase(); const d = getVal('adm-evt-d'); if(!t || !d) { btn.innerText = "SALVAR EVENTO"; return toast("PREENCHA NOME E DATA"); } const newPoints = []; for(let i=0; i<20; i++) { const el = document.getElementById(`pt-${i}`); if(el) newPoints.push(el.value ? parseInt(el.value) : 0); } 
    const evtObj = { 
        id: getVal('adm-evt-id-edit') ? parseInt(getVal('adm-evt-id-edit')) : Date.now(), 
        t: t, d: d, m: getVal('adm-evt-month'), 
        type: getVal('adm-evt-type') || 'PE', 
        city: getVal('adm-evt-c').toUpperCase(), val: getVal('adm-evt-v'), pix: getVal('adm-evt-pix'), status: getVal('adm-evt-status'), points: newPoints, closeDate: getVal('adm-evt-close-date'), open: true, img: null, wpp: document.getElementById('adm-evt-wpp').value 
    }; 
    if(getVal('adm-evt-id-edit')) { const old = db.events.find(e => e.id == evtObj.id); if(old && old.img) evtObj.img = old.img; } const fileInput = document.getElementById('adm-evt-img'); if (fileInput && fileInput.files[0]) { compressImage(fileInput.files[0], 800, (base64) => { evtObj.img = base64; finishSavingEvent(evtObj); }); } else { finishSavingEvent(evtObj); } 
}

function finishSavingEvent(evtObj) { const idx = db.events.findIndex(e => e.id == evtObj.id); if(idx > -1) db.events[idx] = evtObj; else db.events.push(evtObj); saveDB(); toast("EVENTO SALVO!"); document.getElementById('btn-save-event').innerText = "SALVAR EVENTO"; renderAdmEvents(); renderContent('calendar'); clearEventForm(); }
function delEvent(id) { if(confirm("Excluir evento?")) { const idx = db.events.findIndex(e => e.id == id); if(idx > -1) { db.events.splice(idx, 1); saveDB(); renderAdmEvents(); renderContent('calendar'); } } }
function editEvent(id) { const e = db.events.find(ev => ev.id == id); if(e) { document.getElementById('adm-evt-id-edit').value = e.id; document.getElementById('adm-evt-t').value = e.t; document.getElementById('adm-evt-d').value = e.d; document.getElementById('adm-evt-c').value = e.city; document.getElementById('adm-evt-v').value = e.val; document.getElementById('adm-evt-pix').value = e.pix || ''; document.getElementById('adm-evt-month').value = e.m || 'MAI'; document.getElementById('adm-evt-type').value = e.type || 'PE'; document.getElementById('adm-evt-status').value = e.status || 'OPEN'; document.getElementById('adm-evt-close-date').value = e.closeDate || ''; document.getElementById('adm-evt-wpp').value = e.wpp || ''; renderPointsInputs(e.points || DEFAULT_POINTS); document.getElementById('btn-save-event').innerText = "ATUALIZAR EVENTO"; document.getElementById('adm-sec-events').scrollIntoView(); } }
function clearEventForm() { document.getElementById('adm-evt-id-edit').value = ''; document.getElementById('adm-evt-t').value = ''; document.getElementById('btn-save-event').innerText = "SALVAR EVENTO"; renderPointsInputs(DEFAULT_POINTS); }
function persistEventForm() { saveInput(document.getElementById('adm-evt-t')); }

// --- FUNÇÃO DE FILTROS ADICIONADA (CORREÇÃO) ---
function populatePublicFilters(t) {
    const evtSel = document.getElementById('filter-evt-' + t);
    const catSel = document.getElementById('filter-cat-' + t);
    if (!evtSel || !catSel) return;

    // Salvar seleção atual
    const curEvt = evtSel.value;
    const curCat = catSel.value;

    // Preencher Eventos
    let htmlEvt = '<option value="ALL">GERAL (TODAS ETAPAS)</option>';
    if (db.events) {
        db.events.forEach(e => {
            htmlEvt += `<option value="${e.id}">${e.t}</option>`;
        });
    }
    evtSel.innerHTML = htmlEvt;
    // Restaurar seleção se ainda existir
    if (curEvt && [...evtSel.options].some(o => o.value == curEvt)) evtSel.value = curEvt;

    // Preencher Categorias
    let source = (t === 'tempos') ? db.tempos : db.ranking;
    let cats = [];
    if (source) {
        cats = [...new Set(source.map(i => i.cat))].sort();
    }
    let htmlCat = '<option value="ALL">TODAS CATEGORIAS</option>';
    if (t === 'tempos') htmlCat += '<option value="KING_OF_HILL">👑 TOP PISTA (GERAL)</option>';
    
    cats.forEach(c => {
        htmlCat += `<option value="${c}">${c}</option>`;
    });
    catSel.innerHTML = htmlCat;
    if (curCat && [...catSel.options].some(o => o.value == curCat)) catSel.value = curCat;
}

// --- RENDERIZAÇÃO E CORREÇÃO DO FILTRO ---
function renderContent(t) { 
    if(t === 'calendar') { 
        const hD = document.getElementById('calendar-highlight'); const oD = document.getElementById('calendar-others'); 
        if(!db.events || db.events.length === 0) { hD.innerHTML = '<div style="padding:20px;text-align:center">Nenhum evento.</div>'; oD.innerHTML = ''; return; } 
        const events = db.events; const h = events.find(e => e.status === 'OPEN') || events[events.length-1]; if (!h) return; 
        
        const getBadge = (evt) => {
            const type = evt.type || 'PE';
            const cls = type === 'CBC' ? 'badge-cbc' : 'badge-pe';
            const txt = type === 'CBC' ? 'CBC NACIONAL' : 'FPC/PE';
            return `<div class="evt-badge ${cls}">${txt}</div>`;
        };

        const imgHtml = (evt) => evt.img ? `<img src="${evt.img}" style="display:block; border-bottom:1px solid #eee">` : ''; 
        const today = new Date().toISOString().split('T')[0]; 
        const isClosed = (evt) => evt.closeDate && evt.closeDate < today; 
        const getBtn = (evt) => { 
            if(isClosed(evt) || evt.status === 'CLOSED') return `<button class="btn" style="margin-top:10px; background:#666" disabled>ENCERRADO</button>`; 
            let btnText = "INSCREVER-SE"; let btnColor = "var(--pe-blue)"; let btnClass = "btn"; let btnAction = `iniciarInscricao('${evt.id}','${evt.t}','${evt.val}')`; 
            if(loggedUser) { 
                const subs = loggedUser.inscricoes || []; const sub = subs.find(i => i.id == evt.id); 
                if(sub) { 
                    if(sub.status === 'PENDENTE') { btnText = "PENDENTE (PAGAR)"; btnColor = "orange"; btnAction = `iniciarInscricao('${evt.id}','${evt.t}','${evt.val}')`; } 
                    else { btnText = "CONFIRMADO (VER TICKET)"; btnColor = "green"; btnAction = `abrirTicket('${evt.id}')`; } 
                } 
            } 
            return `<div style="display:flex; gap:5px; margin-top:10px;"> <button class="${btnClass} btn-cal-action" style="flex:2; margin:0;" onclick="${btnAction}">${btnText}</button> <button class="btn btn-cal-pts" style="flex:1; margin:0; font-size:10px" onclick="showPublicPointsEvent('${evt.id}')">PTS</button> <button class="btn btn-cal-wpp" style="flex:1; margin:0;" onclick="falarZapTicket()"><i class="fab fa-whatsapp"></i></button> </div>`; 
        }; 
        hD.innerHTML = `<div class="highlight-event">${getBadge(h)}${imgHtml(h)}<div class="event-body"><div style="font-size:14px; font-weight:900; color:var(--pe-blue)">${h.t}</div><div style="font-size:12px; color:#666; margin:5px 0">${h.d} ${h.m} | ${h.city}</div><div class="event-price">INSCRIÇÃO: R$ ${h.val}</div><div style="margin-top:10px; font-size:10px"><b>STATUS:</b> <span style="color:${h.status==='OPEN'?'green':'red'}">${h.status==='OPEN'?'ABERTO':'ENCERRADO'}</span><br><b>ENCERRA EM:</b> ${h.closeDate ? h.closeDate.split('-').reverse().join('/') : 'INDEFINIDO'}</div>${getBtn(h)}</div></div>`; 
        oD.innerHTML = events.filter(e => e.id !== h.id).map(e => `<div class="event-card" style="position:relative">${getBadge(e)}${imgHtml(e)}<div class="event-body" style="text-align:left"><div style="font-size:12px; font-weight:bold; color:var(--pe-blue)">${e.t}</div><div style="font-size:10px; color:#666">${e.d} ${e.m} - ${e.city}</div>${getBtn(e)}</div></div>`).join(''); 
    } else if (t === 'tempos' || t === 'ranking') { 
        // 1. CORREÇÃO DE STATUS E FILTRO DE ID
        const list = db[t] ? db[t].filter(i => i.status === 'OK' || !i.status) : []; 
        const div = document.getElementById('list-'+t); if(!div) return; 
        
        const fEvt = document.getElementById('filter-evt-'+t).value; 
        const fCat = document.getElementById('filter-cat-'+t).value; 
        
        let filteredList = list; 
        // Força comparação de String para evitar erro de tipo
        if (fEvt !== 'ALL') filteredList = filteredList.filter(i => String(i.evtId) === String(fEvt)); 
        
        if (fCat === 'KING_OF_HILL') { filteredList.sort((a,b) => a.val.localeCompare(b.val)); filteredList = filteredList.slice(0, 20); } 
        else if (fCat !== 'ALL') { filteredList = filteredList.filter(i => i.cat === fCat); } 
        
        if(filteredList.length === 0) div.innerHTML = '<div style="padding:20px; text-align:center; color:#999">Nenhum resultado encontrado.</div>';
        else div.innerHTML = filteredList.map((r, i) => `<div class="rank-row"><div class="rank-pos">${i+1}</div><div class="rank-name">${r.name}<span class="rank-cat">${r.city} - ${r.cat}</span></div><div class="rank-val">${r.val}</div></div>`).join(''); 
    } else if (t === 'profile') { 
        if(loggedUser) { 
            document.getElementById('prof-edit-name').value = loggedUser.nome;
            document.getElementById('prof-edit-tel').value = loggedUser.tel;
            document.getElementById('prof-edit-city').value = loggedUser.city;
            document.getElementById('prof-edit-cat').value = loggedUser.cat;
            const userTeam = loggedUser.team || loggedUser.secA || "";
            document.getElementById('prof-edit-team').value = userTeam;
            document.getElementById('card-name').innerText = loggedUser.nome;
            document.getElementById('card-cat').innerText = loggedUser.cat;
            document.getElementById('card-cpf').innerText = loggedUser.cpf;
            document.getElementById('card-city').innerText = loggedUser.city;
            document.getElementById('card-team').innerText = userTeam || "SEM EQUIPE";
            if(loggedUser.selfie) {
                // CORREÇÃO: Removida referência ao ID que não existia (prof-img-display)
                document.getElementById('card-img-display').src = loggedUser.selfie;
            }
        } 
    } 
}

function updateCardLive() { const teamVal = document.getElementById('prof-edit-team').value; document.getElementById('card-team').innerText = teamVal.toUpperCase() || "SEM EQUIPE"; }
function showPublicPointsEvent(evtId) { const evt = db.events.find(e => e.id == evtId); if(!evt) return; const pts = evt.points || DEFAULT_POINTS; const title = document.getElementById('modal-points-title'); const list = document.getElementById('public-points-list'); title.innerText = "PONTOS: " + evt.t; list.innerHTML = pts.map((p, i) => `<div style="border-bottom:1px solid #eee; padding:5px; display:flex; justify-content:space-between;"><span>${i+1}º LUGAR</span><b>${p} PTS</b></div>`).join(''); openModal('modal-points'); }

function salvarFullProfile() {
    if(!loggedUser) return;
    const idx = db.users.findIndex(u => u.cpf === loggedUser.cpf);
    if(idx > -1) {
        db.users[idx].tel = document.getElementById('prof-edit-tel').value;
        db.users[idx].team = document.getElementById('prof-edit-team').value.toUpperCase();
        db.users[idx].secA = db.users[idx].team; 
        loggedUser = db.users[idx];
        saveDB();
        localStorage.setItem(SESS_KEY, JSON.stringify(loggedUser));
        toast("PERFIL ATUALIZADO!");
        renderContent('profile');
    }
}

function baixarImagem(id, nome){
    toast("GERANDO IMAGEM...", true);
    const el = document.getElementById(id);
    setTimeout(() => {
        html2canvas(el, { scale: 3, useCORS: true }).then(canvas => {
            const link = document.createElement('a');
            link.download = nome + '_' + Date.now() + '.jpg';
            link.href = canvas.toDataURL('image/jpeg', 0.95);
            link.click();
            hideToast();
            toast("DOWNLOAD CONCLUÍDO!");
        }).catch(err => {
            console.error(err);
            hideToast();
            toast("ERRO AO GERAR");
        });
    }, 150);
}

// --- LÓGICA LIVE TIMING ---
let liveInterval = null;
let chronoInterval = null;
let liveStartTime = 0;
let liveCurrentPilot = null;

function abrirPopUpLive() { 
    const evtId = document.getElementById('adm-res-evt').value; 
    if(!evtId) return toast("Selecione um evento!"); 
    localStorage.setItem('live_event_id', evtId); 
    trocarTela('live-monitor'); 
    document.getElementById('screen-live-monitor').style.display = 'flex';
    document.getElementById('main-app-container').style.display = 'none';
    iniciarLiveLoop(); 
}

function sairModoLive() {
    if(chronoInterval) clearInterval(chronoInterval);
    if(liveInterval) clearInterval(liveInterval);
    document.getElementById('screen-live-monitor').style.display = 'none';
    document.getElementById('main-app-container').style.display = 'block';
    renderContent('adm');
}

function iniciarLiveLoop() { 
    const evtId = localStorage.getItem('live_event_id');
    const evt = db.events.find(e => e.id == evtId);
    if(evt) document.getElementById('live-header-event').innerText = evt.t;
    renderLiveRanking();
    populateLiveCatFilter();
}

function liveSearchPilot() {
    const term = document.getElementById('live-search-pilot').value.toUpperCase();
    const resDiv = document.getElementById('live-search-res');
    if(term.length < 2) { resDiv.style.display = 'none'; return; }
    const found = db.users.filter(u => u.nome.includes(term) || u.cpf.includes(term));
    resDiv.style.display = 'block';
    resDiv.innerHTML = found.map(u => `<div class="smart-item" onclick="selectPilotForPreview('${u.cpf}')"><b>${u.nome}</b> (${u.cat})</div>`).join('');
}

function selectPilotForPreview(cpf) {
    const u = db.users.find(x => x.cpf === cpf);
    if(u) {
        document.getElementById('live-search-res').style.display = 'none';
        document.getElementById('live-search-pilot').value = '';
        document.getElementById('next-pilot-box').style.display = 'block';
        document.getElementById('preview-name').innerText = u.nome;
        document.getElementById('preview-cat').innerText = u.cat;
        document.getElementById('preview-cpf').value = u.cpf;
    }
}

function sendToTrack() {
    const cpf = document.getElementById('preview-cpf').value;
    const u = db.users.find(x => x.cpf === cpf);
    if(!u) return;
    const evtId = localStorage.getItem('live_event_id');
    const exists = db.tempos.find(t => t.evtId == evtId && t.name === u.nome);
    if(exists) { if(!confirm("ATENÇÃO: Este piloto já tem tempo registrado! Deseja sobrescrever?")) return; }

    liveCurrentPilot = u;
    let plate = "??";
    if(u.inscricoes) {
        const sub = u.inscricoes.find(i=>i.id==evtId);
        if(sub && sub.num) plate = sub.num;
    }
    document.getElementById('live-plate').innerText = plate;
    document.getElementById('live-name').innerText = u.nome;
    document.getElementById('live-info').innerHTML = `<span id="live-city">${u.city}</span> • <span id="live-team">${u.team || u.secA || "-"}</span>`;
    document.getElementById('live-cat-badge').innerText = u.cat;
    
    document.getElementById('next-pilot-box').style.display = 'none';
    document.getElementById('live-chrono').innerText = "00:00.000";
    document.getElementById('live-chrono').style.color = "#d50000";
}

function startChrono() {
    if(!liveCurrentPilot) return toast("ENVIE UM PILOTO PARA A PISTA");
    if(chronoInterval) clearInterval(chronoInterval);
    liveStartTime = Date.now();
    document.getElementById('live-chrono').style.color = "#d50000"; 
    chronoInterval = setInterval(() => {
        const diff = Date.now() - liveStartTime;
        document.getElementById('live-chrono').innerText = formatTimeMs(diff);
    }, 45); 
}

function stopChrono() {
    if(!chronoInterval) return;
    clearInterval(chronoInterval);
    chronoInterval = null;
    const finalDiff = Date.now() - liveStartTime;
    const finalString = formatTimeMs(finalDiff);
    document.getElementById('live-chrono').innerText = finalString;
    document.getElementById('live-chrono').style.color = "#009b3a";

    /* 1. REGISTRO AUTOMATICO COM STATUS OK */
    const evtId = localStorage.getItem('live_event_id');
    const newData = { 
        evtId: evtId, 
        name: liveCurrentPilot.nome, 
        cat: liveCurrentPilot.cat, 
        city: liveCurrentPilot.city, 
        val: finalString, 
        num: document.getElementById('live-plate').innerText, 
        status: 'OK' 
    };

    const existingIdx = db.tempos.findIndex(t => t.evtId == evtId && t.name === liveCurrentPilot.nome);
    if(existingIdx > -1) db.tempos.splice(existingIdx, 1);

    db.tempos.push(newData);
    recalcEventRanking(evtId); 
    saveDB();
    renderLiveRanking();
    toast("TEMPO REGISTRADO COM SUCESSO!");
    liveCurrentPilot = null;
}

function formatTimeMs(ms) {
    let min = Math.floor(ms / 60000);
    let sec = Math.floor((ms % 60000) / 1000);
    let mil = ms % 1000;
    return `${pad(min)}:${pad(sec)}.${pad(mil, 3)}`;
}
function pad(n, z=2) { return ('000' + n).slice(-z); }

function renderLiveRanking() {
    const evtId = localStorage.getItem('live_event_id');
    const filter = document.getElementById('live-rank-filter').value;
    let list = db.tempos.filter(t => t.evtId == evtId);
    if(filter !== 'ALL') list = list.filter(t => t.cat === filter);
    list.sort((a,b) => a.val.localeCompare(b.val));

    document.getElementById('live-ranking-list').innerHTML = list.map((t, i) => `
        <div class="live-list-item" style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center">
                <div style="background:#333; color:white; width:25px; height:25px; border-radius:50%; display:flex; justify-content:center; align-items:center; margin-right:10px; font-weight:bold">${i+1}</div>
                <div>
                    <div style="font-weight:bold; font-size:14px">${t.name}</div>
                    <div style="font-size:10px; color:#666">${t.cat}</div>
                </div>
            </div>
            <div style="font-weight:900; font-size:16px; color:var(--pe-blue)">${t.val}</div>
        </div>
    `).join('');
}

function populateLiveCatFilter() {
    const evtId = localStorage.getItem('live_event_id');
    const list = db.tempos.filter(t => t.evtId == evtId);
    const cats = [...new Set(list.map(t => t.cat))].sort();
    const sel = document.getElementById('live-rank-filter');
    const current = sel.value;
    sel.innerHTML = '<option value="ALL">GERAL</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
    sel.value = current;
}

function changeLiveScale(val) {
    const wrap = document.getElementById('live-wrapper');
    if(wrap) wrap.style.transform = `scale(${val})`;
}

// --- FUNÇÕES DE SUPORTE E ADMIN ---
// CORREÇÃO: Função uploadSelfie agora atualiza o elemento correto
function uploadSelfie(input){
    if(input.files[0]){
        compressImage(input.files[0],300,(base64)=>{
            if(loggedUser){loggedUser.selfie=base64;saveDB();}
            // Apenas atualiza o que existe no HTML
            const cardImg = document.getElementById('card-img-display');
            if(cardImg) cardImg.src=base64;
        });
    }
}
function compressImage(file, maxWidth, callback) { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = event => { const img = new Image(); img.src = event.target.result; img.onload = () => { const canvas = document.createElement('canvas'); let width = img.width; let height = img.height; if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; } canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height); callback(canvas.toDataURL('image/jpeg', 0.7)); }; }; }
function openEditUserModal(cpf){const u=db.users.find(x=>x.cpf===cpf);if(u){document.getElementById('edit-user-original-cpf').value=u.cpf;document.getElementById('edit-user-name').value=u.nome;document.getElementById('edit-user-cpf').value=u.cpf;document.getElementById('edit-user-tel').value=u.tel;document.getElementById('edit-user-city').value=u.city;document.getElementById('edit-user-cat').value=u.cat;document.getElementById('edit-user-gender').value=u.gender;document.getElementById('edit-user-pass').value=u.pass;document.getElementById('modal-edit-user').style.display='flex';}}
function saveUserEdit(){const old=document.getElementById('edit-user-original-cpf').value;const idx=db.users.findIndex(x=>x.cpf===old);if(idx>-1){db.users[idx].nome=document.getElementById('edit-user-name').value.toUpperCase();db.users[idx].cpf=document.getElementById('edit-user-cpf').value;db.users[idx].cat=document.getElementById('edit-user-cat').value.toUpperCase();saveDB();toast("SALVO");document.getElementById('modal-edit-user').style.display='none';filterPilots('edit-user',true);}}
function delUser(cpf){if(confirm("Excluir?")){const i=db.users.findIndex(u=>u.cpf===cpf);if(i>-1){db.users.splice(i,1);saveDB();filterPilots('edit-user',true);}}}
function renderOrgList(){document.getElementById('adm-list-orgs').innerHTML=db.users.filter(u=>u.role==='ORGANIZER').map(u=>`<div class="adm-card">${u.nome}</div>`).join('');}
function saveGlobalConfig(){db.config.phone=document.getElementById('adm-cfg-phone').value;saveDB();toast("SALVO");}
function checkAdmPass(){if(document.getElementById('adm-pass-check').value===ADMIN_PASS){document.getElementById('adm-login-box').style.display='none';document.getElementById('adm-panel-real').style.display='block';backToAdmMenu();}else toast("ERRO");}
function renderInscriptions(){const evtId=document.getElementById('fin-evt-select').value;const div=document.getElementById('fin-list-container');if(!evtId)return div.innerHTML='';let t=0;let p=0;let html='<table class="fin-table" style="width:100%">';db.users.forEach(u=>{u.inscricoes.forEach(i=>{if(evtId==='ALL'||i.id==evtId){const evt=db.events.find(e=>e.id==i.id);if(i.status==='CONFIRMADO'&&evt)p+=parseFloat(evt.val);html+=`<tr><td><b>${u.nome}</b><br><small>${u.city} | ${u.cat}</small></td><td style="text-align:right"><button class="btn-mini-adm" style="background:${i.status==='CONFIRMADO'?'green':'orange'}" onclick="togglePay('${u.cpf}','${i.id}')">${i.status}</button></td></tr>`;}});});div.innerHTML=html;}
function togglePay(cpf,evtId){const u=db.users.find(x=>x.cpf===cpf);const i=u.inscricoes.find(x=>x.id==evtId);i.status=i.status==='CONFIRMADO'?'PENDENTE':'CONFIRMADO';saveDB();renderInscriptions();}
function cancelEditRes(){document.getElementById('adm-res-id').value='';}
function iniciarInscricao(evtId,evtName,val){if(!loggedUser)return toast("FAÇA LOGIN");if(!loggedUser.inscricoes)loggedUser.inscricoes=[];if(!loggedUser.inscricoes.some(i=>i.id==evtId)) currentPayId={id:parseInt(evtId),name:evtName};const evt=db.events.find(e=>e.id==parseInt(evtId));document.getElementById('pix-valor-display').innerText=val;document.getElementById('pix-copy').innerText=evt.pix||"";document.getElementById('modal-pix').style.display='flex';}
function enviarComprovanteWhatsApp(){
    const evt = db.events.find(e => e.id == currentPayId.id);
    const phone = (evt && evt.wpp) ? evt.wpp : db.config.phone;
    window.open(`https://wa.me/55${phone.replace(/\D/g,'')}?text=Ola, segue comprovante para ${currentPayId.name}`,'_blank');
}
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
function copiarPix(){navigator.clipboard.writeText(document.getElementById('pix-copy').innerText);toast("COPIADO!");}
function shareTicketImage(){baixarImagem('ticket-capture-area', 'ticket_dhpe');}
function showPublicPoints(){openModal('modal-points');}
function filterFinList(s){currentFilterStatus=s;renderInscriptions();}
function promoteToOrganizer() { const cpf = document.getElementById('adm-org-selected-cpf').value;
if(!cpf) return toast("SELECIONE UM ATLETA"); const perms = []; document.querySelectorAll('.perm-cb:checked').forEach(cb => perms.push(cb.value)); const idx = db.users.findIndex(u => u.cpf === cpf);
if(idx > -1) { db.users[idx].role = 'ORGANIZER'; db.users[idx].allowedEvts = perms; db.users[idx].cat = "ORGANIZAÇÃO"; saveDB(); toast("PROMOVIDO!"); document.getElementById('adm-org-search').value = '';
document.getElementById('org-perms-area').style.display = 'none'; renderOrgList(); } }
function abrirTicket(evtId) {
    const evt = db.events.find(e=>e.id==evtId);
    document.getElementById('share-piloto-name').innerText = loggedUser.nome;
    document.getElementById('share-cpf').innerText = loggedUser.cpf;
    document.getElementById('share-cat').innerText = loggedUser.cat;
    document.getElementById('share-event-name').innerText = evt.t;
    document.getElementById('modal-share').style.display = 'flex';
}
function delItem(col,idx){ if(confirm("Deletar?")){db[col].splice(idx,1);saveDB();renderAdmResults();} }
function filterPilots(ctx, force) { const inputEl = document.getElementById(ctx === 'res' ? 'adm-res-search' : (ctx === 'org' ? 'adm-org-search' : (ctx === 'hist' ? 'adm-hist-search' : 'adm-edit-user-search'))); const term = inputEl.value.toUpperCase(); const listDiv = document.getElementById(ctx === 'res' ? 'adm-res-list' : (ctx === 'org' ? 'adm-org-list-search' : (ctx === 'hist' ? 'adm-hist-list' : 'adm-edit-user-list'))); if(term.length < 2 && !force) { listDiv.style.display = 'none'; return; } let found = db.users.filter(u => u.nome.includes(term) || u.cpf.includes(term) || u.city.includes(term)); if (ctx === 'res') { const evtId = document.getElementById('adm-res-evt').value; if (!evtId) { toast("SELECIONE O EVENTO!"); return; } found = found.filter(u => u.inscricoes.some(i => i.id == evtId && i.status === 'CONFIRMADO')); } listDiv.style.display = 'block'; if(ctx === 'hist') { listDiv.innerHTML = found.map(u => `<div class="smart-item" onclick="selectHistPilot('${u.cpf}')">${u.nome}</div>`).join(''); } else if(ctx === 'res') { if(found.length === 0) listDiv.innerHTML = '<div style="padding:10px; color:red">Nenhum piloto CONFIRMADO.</div>'; else listDiv.innerHTML = found.map(u => `<div class="smart-item" onclick="selectResPilot('${u.cpf}', '${u.nome}', '${u.city}', '${u.cat}')">${u.nome} - ${u.city}</div>`).join(''); } else if (ctx === 'org') { listDiv.innerHTML = found.map(u => `<div class="smart-item" onclick="selectOrgPilot('${u.cpf}', '${u.nome}')">${u.nome} - ${u.city}</div>`).join(''); } else { listDiv.innerHTML = found.map(u => { const wpp = `https://wa.me/55${u.tel ? u.tel.replace(/\D/g,'') : ''}`; return `<div class="adm-card"><div><b>${u.nome}</b><br><span style="font-size:10px;color:#666">${u.city} | ${u.cat}</span></div><div style="display:flex; gap:5px"><button class="btn-mini-adm" style="background:#25D366" onclick="window.open('${wpp}', '_blank')"><i class="fab fa-whatsapp"></i></button><button class="btn-mini-adm" style="background:#3b82f6" onclick="openEditUserModal('${u.cpf}')"><i class="fas fa-pen"></i></button><button class="btn-mini-adm" style="background:#ef4444" onclick="delUser('${u.cpf}')"><i class="fas fa-trash"></i></button></div></div>`; }).join(''); } }
function selectHistPilot(cpf) { const user = db.users.find(u => u.cpf === cpf); if(!user) return; document.getElementById('adm-hist-list').style.display = 'none'; document.getElementById('hist-result-area').style.display = 'block'; document.getElementById('hist-name').innerText = user.nome; document.getElementById('hist-details').innerText = `CPF: ${user.cpf} | Cidade: ${user.city} | Cat: ${user.cat}`; let html = ''; user.inscricoes.forEach(ins => { const evt = db.events.find(e => e.id == ins.id); const tempo = db.tempos.find(t => t.evtId == ins.id && t.name === user.nome); const rank = db.ranking.find(r => r.evtId == ins.id && r.name === user.nome); if(evt) { html += `<div style="border-left: 2px solid var(--pe-blue); padding-left: 10px; margin-bottom: 10px; background:#fff"> <b>${evt.t}</b> <span style="font-size:9px; color:#666">${evt.d}</span><br> Status: <span style="color:${ins.status==='CONFIRMADO'?'green':'orange'}">${ins.status}</span><br> Tempo: <b>${tempo ? tempo.val : '-'}</b> | Pts: <b>${rank ? rank.val : '-'}</b> </div>`; } }); if(html === '') html = '<div style="padding:10px; color:#999">Nenhum histórico encontrado.</div>'; document.getElementById('hist-timeline').innerHTML = html; }
function selectResPilot(cpf, name, city, cat) { document.getElementById('adm-res-id').value = cpf; document.getElementById('adm-res-name-display').value = name; document.getElementById('adm-res-city-edit').value = city; document.getElementById('adm-res-cat-edit').value = cat; document.getElementById('adm-res-search').value = ''; document.getElementById('adm-res-list').style.display = 'none'; }
function selectOrgPilot(cpf, name) { document.getElementById('adm-org-selected-cpf').value = cpf; document.getElementById('adm-org-search').value = name; document.getElementById('adm-org-list-search').style.display = 'none'; document.getElementById('org-perms-area').style.display = 'block'; document.getElementById('org-events-list').innerHTML = db.events.map(e => `<label class="perm-item" style="display:block; margin:5px 0"><input type="checkbox" value="${e.id}" class="perm-cb"> ${e.t}</label>`).join(''); }
function toggleOrgList() { const list = document.getElementById('adm-list-orgs'); const icon = document.getElementById('icon-org-toggle'); if(list.style.display === 'none') { list.style.display = 'block'; icon.classList.remove('fa-chevron-down'); icon.classList.add('fa-chevron-up'); } else { list.style.display = 'none'; icon.classList.remove('fa-chevron-up'); icon.classList.add('fa-chevron-down'); } }
function editRes(idx) { const t = db.tempos[idx]; document.getElementById('adm-res-evt').value = t.evtId; const u = db.users.find(user => user.nome === t.name); if(u) document.getElementById('adm-res-id').value = u.cpf; document.getElementById('adm-res-name-display').value = t.name; document.getElementById('adm-res-val').value = t.val; document.getElementById('adm-res-num').value = t.num; document.getElementById('adm-res-city-edit').value = t.city; document.getElementById('adm-res-cat-edit').value = t.cat; document.getElementById('adm-res-idx-edit').value = idx; document.getElementById('btn-save-res').innerText = "SALVAR ALTERAÇÃO"; document.getElementById('btn-cancel-res').style.display = 'block'; toast("MODO EDIÇÃO"); document.getElementById('adm-sec-results').scrollIntoView(); }
function cancelEditRes() { document.getElementById('adm-res-idx-edit').value = ""; document.getElementById('btn-save-res').innerText = "LANÇAR / SALVAR"; document.getElementById('btn-cancel-res').style.display = 'none'; document.getElementById('adm-res-name-display').value = ""; document.getElementById('adm-res-val').value = ""; document.getElementById('adm-res-city-edit').value = ""; document.getElementById('adm-res-cat-edit').value = ""; }
function renderAdmResults() { const evtId = document.getElementById('adm-res-evt').value; if(document.getElementById('adm-res-evt').options.length <= 1) { document.getElementById('adm-res-evt').innerHTML = '<option value="">SELECIONE...</option>' + db.events.map(e => `<option value="${e.id}">${e.t}</option>`).join(''); } populateLiveCategorySelector(evtId); if(evtId) document.getElementById('adm-res-evt').value = evtId; const lista = db.tempos || []; document.getElementById('adm-list-results').innerHTML = lista.map((t, i) => { if(evtId && t.evtId != evtId) return ''; const isPending = t.status === 'PENDING'; const approveBtn = (isPending && loggedUser.role === 'ADMIN') ? `<button class="btn-mini-adm" style="background:green" onclick="approveRes(${i})">OK</button>` : ''; return `<div class="adm-card" style="${isPending ? 'border-left:4px solid orange':''}"><span>${t.name} (${t.cat}) - ${t.val} ${isPending?'(PEND)':''}</span><div style="display:flex; gap:5px">${approveBtn}<button class="btn-mini-adm" style="background:#f59e0b" onclick="editRes(${i})"><i class="fas fa-pen"></i></button><button class="btn-mini-adm" style="background:#ef4444" onclick="delItem('tempos', ${i})">X</button></div></div>`; }).reverse().join(''); }
function refreshAdmLists() { renderAdmResults(); }
function approveRes(idx) { db.tempos[idx].status = 'OK'; saveDB(); renderAdmResults(); }
function maskTimeOrPoints(i){ let v = i.value.replace(/\D/g, ""); if(v.length > 7) v = v.substring(0, 7); if(v.length > 4) { v = v.substring(0, 2) + ':' + v.substring(2, 4) + '.' + v.substring(4); } else if(v.length > 2) { v = v.substring(0, 2) + ':' + v.substring(2); } i.value = v; }
function populateLiveCategorySelector(evtId) { if(!evtId) return; const select = document.getElementById('adm-live-cat-selector'); if(!select) return; const temposEvento = db.tempos.filter(t => t.evtId == evtId); const cats = [...new Set(temposEvento.map(t => t.cat))].sort(); const currentVal = select.value; let html = '<option value="ALL">MOSTRAR GERAL (TODOS)</option><option value="KING_OF_HILL">👑 RANKING GERAL (TOP PISTA)</option>'; cats.forEach(c => { html += `<option value="${c}">${c}</option>`; }); select.innerHTML = html; select.value = currentVal; }
function updateLiveFilterConfig() { const val = document.getElementById('adm-live-cat-selector').value; localStorage.setItem('live_filter_cat', val); toast("TV ATUALIZADA"); }

/* 1. CORREÇÃO CRÍTICA: STATUS E RANKING */
function recalcEventRanking(evtId) { 
    if (!db.tempos) return; 
    const temposEvento = db.tempos.filter(t => t.evtId == evtId); 
    temposEvento.sort((a, b) => a.val.localeCompare(b.val)); 
    const evt = db.events.find(e => e.id == evtId); 
    const pontosRef = (evt && evt.points) ? evt.points : DEFAULT_POINTS; 
    if(!db.ranking) db.ranking = []; 
    // Remove antigos
    db.ranking = db.ranking.filter(r => r.evtId != evtId); 
    temposEvento.forEach((t, index) => { 
        let pontos = 0; 
        if(index < pontosRef.length) pontos = pontosRef[index]; 
        db.ranking.push({ 
            evtId: t.evtId, 
            name: t.name, 
            cat: t.cat, 
            city: t.city, 
            num: t.num, 
            val: pontos + " PTS", 
            status: 'OK' // Garante que o ranking tenha status OK
        }); 
    }); 
}

/* 1. CORREÇÃO CRÍTICA: SALVAR TEMPO COM STATUS OK */
function addResult() { 
    if(!db.tempos) db.tempos = []; 
    if(!db.ranking) db.ranking = []; 
    if(!loggedUser) return toast("SESSÃO EXPIROU, FAÇA LOGIN"); 
    const evtId = document.getElementById('adm-res-evt').value; 
    const cpf = document.getElementById('adm-res-id').value; 
    const val = document.getElementById('adm-res-val').value; 
    const num = document.getElementById('adm-res-num').value; 
    const city = document.getElementById('adm-res-city-edit').value.toUpperCase(); 
    const cat = document.getElementById('adm-res-cat-edit').value.toUpperCase(); 
    const idxEdit = document.getElementById('adm-res-idx-edit').value; 
    if(!evtId || !cpf || !val || !city || !cat) return toast("PREENCHA TUDO"); 
    const user = db.users.find(u => cleanCPF(u.cpf) === cleanCPF(cpf)); 
    if(!user) return toast("ERRO AO BUSCAR USUÁRIO"); 
    
    // FORÇA O STATUS PARA OK AO LANÇAR
    const status = 'OK'; 
    const newData = { evtId, name: user.nome, cat: cat, city: city, val, num, status: status }; 
    
    if (idxEdit !== "") { 
        db.tempos[idxEdit] = newData; 
        toast("ATUALIZADO!"); 
        cancelEditRes(); 
    } else { 
        const exists = db.tempos.find(t => t.evtId == evtId && t.name === document.getElementById('adm-res-name-display').value); 
        if(exists) return toast("PILOTO JÁ TEM TEMPO!"); 
        db.tempos.push(newData); 
        toast("LANÇADO!"); 
    } 
    recalcEventRanking(evtId); 
    saveDB(); 
    renderAdmResults(); 
    if(window.liveInterval) atualizarLiveScreen(); 
    if(idxEdit === "") { 
        document.getElementById('adm-res-id').value = ''; 
        document.getElementById('adm-res-name-display').value = ''; 
        document.getElementById('adm-res-val').value = ''; 
        document.getElementById('adm-res-num').value = ''; 
        document.getElementById('adm-res-city-edit').value = ''; 
        document.getElementById('adm-res-cat-edit').value = ''; 
        document.getElementById('adm-res-search').value = ''; 
    } 
}

document.addEventListener('DOMContentLoaded', () => { const urlParams = new URLSearchParams(window.location.search); if (urlParams.get('mode') === 'live') { document.getElementById('main-app-container').style.display = 'none'; document.getElementById('screen-live-monitor').style.display = 'flex'; document.getElementById('screen-live-monitor').classList.add('fullscreen-mode'); iniciarLiveLoop(); return; } restoreInputs(); document.querySelectorAll('input').forEach(el => { el.addEventListener('input', () => saveInput(el)); }); const b = document.getElementById('btn-acessar'); if(b) b.addEventListener('click', fazerLogin); const s = getUser(); if(s && db.users) { loggedUser = db.users.find(u=>cleanCPF(u.cpf)===cleanCPF(s.cpf)); if(loggedUser) initApp(); } });
