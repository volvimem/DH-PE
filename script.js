// ==========================================================
// 1. CONFIGURAÇÃO FIREBASE E VARIÁVEIS GLOBAIS
// ==========================================================
const firebaseConfig = {
    apiKey: "AIzaSyDilUDfyFsebnbQ9pAXyL7ptbSy5CY_cmk",
    authDomain: "fpc-per.firebaseapp.com",
    databaseURL: "https://fpc-per-default-rtdb.firebaseio.com",
    projectId: "fpc-per",
    storageBucket: "fpc-per.firebasestorage.app",
    messagingSenderId: "817616563956",
    appId: "1:817616563956:web:21dbbbcbb69e0cae10f8a1"
};
var database = null; var storage = null; var auth = null;
const SYSTEM_YEAR = new Date().getFullYear();
let defaultKey = 'dhpe_v25_final_stable_fix';
if (SYSTEM_YEAR === 2027) defaultKey = 'dhpe_2027_active';
if (SYSTEM_YEAR >= 2028) defaultKey = `dhpe_${SYSTEM_YEAR}_active`;
let DB_KEY = localStorage.getItem('dhpe_active_season') || defaultKey;

const SESS_KEY = 'dhpe_sess_v25';
const LAST_TAB_KEY = 'dhpe_last_tab_v25';
const LAST_ADM_KEY = 'dhpe_last_adm_v25';
const BLANK_POINTS = Array(20).fill("");
const DEFAULT_CATS = [
    {name: "ELITE", active: true}, {name: "SUB-30", active: true}, {name: "JUNIOR", active: true},
    {name: "JUVENIL", active: true}, {name: "INFANTO-JUVENIL", active: true}, {name: "MASTER A1", active: true},
    {name: "MASTER A2", active: true}, {name: "MASTER B1", active: true}, {name: "MASTER B2", active: true},
    {name: "MASTER C1", active: true}, {name: "MASTER C2", active: true}, {name: "MASTER D", active: true},
    {name: "FEMININO ELITE", active: true}, {name: "FEMININO MASTER", active: true},
    {name: "OPEN", active: true}, {name: "RÍGIDA", active: true}, {name: "ESTREANTE", active: true},
    {name: "E-BIKE", active: true}, {name: "PCD", active: true}
];
const DEFAULT_DB = { users: [], events: [], tempos: [], ranking: [], notifications: [], auditLog: [], config: { phone: '', rerunPass: 'admin123', allowAllIDs: false, categories: DEFAULT_CATS } };
var db = DEFAULT_DB;

let currentTab = 'calendar'; let loggedUser = null; let currentAdmSection = null;
let currentPayId = null;
let currentFilterStatus = 'ALL'; let tempEvtIdExtra = null;
let currentInscricaoPendente = null; let currentGalleryList = []; let currentGalleryIndex = 0;
let liveViewType = '1st'; 

// ==========================================================
// 2. FUNÇÕES UTILITÁRIAS E LÓGICA DE DIVISÃO DO MENU
// ==========================================================
window.toggleEventType = function() {
    const type = document.getElementById('adm-evt-type').value;
    const isNonOfficial = (type === 'NON_OFFICIAL');

    const offGroup = document.getElementById('adm-evt-official-group');
    const nonOffGroup = document.getElementById('adm-evt-nonofficial-group');

    if (offGroup) offGroup.style.display = isNonOfficial ? 'none' : 'block';
    if (nonOffGroup) nonOffGroup.style.display = isNonOfficial ? 'block' : 'none';
};
function getBadgeHtml(evt) { 
    let txt = "FPC/PE"; let cls = "badge-pe";
    if(evt.type==='CBC') { txt="CBC NACIONAL"; cls="badge-cbc"; } 
    else if(evt.type==='NON_OFFICIAL') { txt="NÃO OFICIAL"; cls="badge-pe"; } 
    
    if(evt.status==='POSTPONED') { txt="ADIADO"; cls="badge-postponed"; } 
    if(evt.status==='CANCELLED') { txt="CANCELADO"; cls="badge-postponed"; } 
    
    return `<div class="evt-badge ${cls}" ${evt.type==='NON_OFFICIAL' && evt.status==='OPEN' ? 'style="background:#1e293b; color:white; border-color:#475569;"' : ''}>${txt}</div>`;
}

function toast(m, type="info") { 
    const t = document.getElementById('toast');
    if(t){ 
        t.className = "toast"; 
        let icon = '<i class="fas fa-info-circle"></i>';
        if(type === "error") { t.classList.add("error"); icon = '<i class="fas fa-exclamation-triangle"></i>'; } 
        t.innerHTML = `${icon} <span>${m}</span>`; 
        t.classList.add('show'); 
        setTimeout(()=>t.classList.remove('show'), 3000);
    } 
}

function cleanCPF(v) { return String(v).replace(/\D/g, ""); }
function openWhatsApp(p, t) { if(p) window.open(`https://wa.me/55${cleanCPF(p)}?text=${encodeURIComponent(t)}`); }
function updateSupportLink() { 
    const phone = (db && db.config && db.config.phone) ? db.config.phone : '';
    const btn = document.getElementById('btn-support-header');
    if (btn) btn.href = `https://wa.me/55${phone}`; 
}

function compressImage(file, maxWidth, callback) {
    if(!file) { callback(null); return; } const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onload = event => { 
        const img = new Image();
        img.onload = () => { 
            try { 
                const canvas = document.createElement('canvas');
                let width = img.width; let height = img.height;
                if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; } 
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                callback(canvas.toDataURL('image/jpeg', 0.7));
            } catch (e) { callback(event.target.result); } 
        };
        img.onerror = () => callback(null); img.src = event.target.result; 
    };
    reader.onerror = () => callback(null);
}

function uploadImageToStorage(base64Data, path) { 
    return fetch(base64Data).then(res => res.blob()).then(blob => { 
        if(!storage) throw new Error("Storage não inicializado"); 
        const storageRef = storage.ref(path); 
        return storageRef.put(blob).then(snapshot => snapshot.ref.getDownloadURL()); 
    });
}

function validarCPF(strCPF) { 
    let Soma; let Resto; Soma = 0; if (strCPF == "00000000000") return false;
    for (let i=1; i<=9; i++) Soma = Soma + parseInt(strCPF.substring(i-1, i)) * (11 - i);
    Resto = (Soma * 10) % 11; if ((Resto == 10) || (Resto == 11)) Resto = 0;
    if (Resto != parseInt(strCPF.substring(9, 10)) ) return false; Soma = 0;
    for (let i = 1; i <= 10; i++) Soma = Soma + parseInt(strCPF.substring(i-1, i)) * (12 - i);
    Resto = (Soma * 10) % 11; if ((Resto == 10) || (Resto == 11)) Resto = 0;
    if (Resto != parseInt(strCPF.substring(10, 11) ) ) return false; return true; 
}

function mascaraCPF(i){ var v = i.value; v=v.replace(/\D/g,""); v=v.replace(/(\d{3})(\d)/,"$1.$2"); v=v.replace(/(\d{3})(\d)/,"$1.$2");
v=v.replace(/(\d{3})(\d{1,2})$/,"$1-$2"); i.value = v; }
function mascaraTel(i){ var v=i.value; v=v.replace(/\D/g,""); v=v.replace(/^(\d{2})(\d)/g,"($1) $2"); v=v.replace(/(\d)(\d{4})$/,"$1-$2"); i.value = v; }
function mascaraDias(i){ var v=i.value; v=v.replace(/\D/g,"");
v=v.replace(/^(\d{2})(\d)/g,"$1/$2"); i.value = v; }

window.mascaraTempo = function(i) {
    let v = i.value.replace(/\D/g, "");
    if(v.length > 7) v = v.substring(0,7);
    if(v.length > 4) { v = v.replace(/^(\d{2})(\d{2})(\d{1,3})/, "$1:$2.$3"); }
    else if(v.length > 2) { v = v.replace(/^(\d{2})(\d{1,2})/, "$1:$2"); }
    i.value = v;
};

function copiarPix(){navigator.clipboard.writeText(document.getElementById('pix-copy').innerText);toast("COPIADO!");}

function checkCPFLive(input) {
    mascaraCPF(input);
    const v = cleanCPF(input.value);
    input.classList.remove('cpf-valid', 'cpf-invalid');
    if(v.length === 11) {
        if(validarCPF(v)) input.classList.add('cpf-valid');
        else input.classList.add('cpf-invalid');
    } else if (v.length > 0) {
        input.classList.add('cpf-invalid');
    }
}

window.baixarImagem = function(elementId, fileName) {
    const element = document.getElementById(elementId);
    if (!element) return toast("ELEMENTO NÃO ENCONTRADO", "error");
    const btnClicado = document.activeElement;
    const textoOriginal = btnClicado ? btnClicado.innerHTML : "";
    if(btnClicado && btnClicado.tagName === 'BUTTON') {
        btnClicado.disabled = true;
        btnClicado.innerHTML = '<i class="fas fa-spinner fa-spin"></i> GERANDO...';
    }

    toast("GERANDO IMAGEM EM ALTA QUALIDADE...");
    const options = { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false, scrollY: -window.scrollY };
    html2canvas(element, options).then(canvas => {
        try {
            const imgData = canvas.toDataURL("image/png", 1.0);
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

            if (isIOS) {
                const iosImg = document.getElementById('ios-print-img');
                
                if(iosImg) {
                    iosImg.src = imgData;
                    openModal('modal-ios-print');
                    toast("PRONTO! SEGURE A IMAGEM PARA SALVAR.");
                }
            } else {
  
                const link = document.createElement('a');
                link.download = `${fileName}_${new Date().getTime()}.png`;
                link.href = imgData;
                document.body.appendChild(link);
                link.click();
              
                document.body.removeChild(link);
                toast("DOWNLOAD CONCLUÍDO!");
            }
        } catch (err) {
            toast("ERRO DE SEGURANÇA (CORS) NA FOTO.", "error");
        }
        if(btnClicado && btnClicado.tagName === 'BUTTON') { btnClicado.innerHTML = textoOriginal; btnClicado.disabled = false; }
    }).catch(err => {
        toast("FALHA AO GERAR IMAGEM.", "error");
        if(btnClicado && btnClicado.tagName === 'BUTTON') { btnClicado.innerHTML = textoOriginal; btnClicado.disabled = false; }
    });
};

function openModal(id){ const el=document.getElementById(id); if(el) el.style.display='flex'; }
function fecharModal(id){ const el=document.getElementById(id); if(el) el.style.display='none'; }

// ==========================================================
// 3. FUNÇÕES GERAIS E BANCO DE DADOS
// ==========================================================
function tempoParaMilissegundos(tempoStr) {
    if (!tempoStr || tempoStr === "--:--.---" || !tempoStr.includes(':')) return Infinity;
    let partes = tempoStr.split(':'); let minutos = parseInt(partes[0]) || 0;
    let segundosEms = (partes[1] || "0").split('.');
    let segundos = parseInt(segundosEms[0]) || 0; let ms = parseInt(segundosEms[1]) || 0;
    return (minutos * 60000) + (segundos * 1000) + ms;
}

function formatarDiferenca(msDiferenca) {
    if (msDiferenca <= 0 || msDiferenca === Infinity) return "";
    let minutos = Math.floor(msDiferenca / 60000); msDiferenca %= 60000;
    let segundos = Math.floor(msDiferenca / 1000);
    let ms = msDiferenca % 1000;
    let secStr = segundos.toString().padStart(2, '0'); let msStr = ms.toString().padStart(3, '0');
    if (minutos > 0) return `+${minutos.toString().padStart(2, '0')}:${secStr}.${msStr}`; return `+${secStr}.${msStr}`;
}

window.getPilotName = function(cpf, fallbackName) { const u = db.users.find(user => String(user.cpf) === String(cpf));
return (u && u.nome) ? u.nome.toUpperCase() : (fallbackName || "").toUpperCase(); };
window.getPilotCityUF = function(cpf, fallbackCity) { const u = db.users.find(user => String(user.cpf) === String(cpf)); const city = (u && u.city) ?
u.city : (fallbackCity || ""); const uf = (u && u.uf) ? u.uf : "PE"; return `${city}-${uf}`.toUpperCase(); };
window.getCatClass = function(catName) { if(catName && catName.includes("EXTRA")) return "badge-cat badge-cat-extra"; return "badge-cat"; };
window.normalizeCatName = function(catName) { if(!catName) return "GERAL";
let c = catName.toUpperCase().trim(); if(c === "OPEN") return "OPEN (EXTRA)"; if(c === "ESTREANTE") return "ESTREANTE (EXTRA)";
if(c === "RÍGIDA" || c === "RIGIDA") return "RÍGIDA (EXTRA)"; if(c === "E-BIKE") return "E-BIKE (EXTRA)";
if(c === "PCD") return "PCD (EXTRA)"; return c; };

window.isSuperAdmin = function(u) {
    if(!u) return false;
    if(u.role === 'ADMIN') return true; 
    const c = cleanCPF(u.cpf); if(c === "08327632418" || c === "00000000000") return true; return false;
};

window.canManageEvent = function(evtId) {
    if(isSuperAdmin(loggedUser)) return true;
    if(loggedUser && loggedUser.role === 'ORGANIZER' && loggedUser.allowedEvts && loggedUser.allowedEvts.includes(String(evtId))) return true;
    return false;
};
function applyAdminPermissions() {
    if(!loggedUser) return;
    const isSuper = isSuperAdmin(loggedUser); const displayMode = isSuper ? 'flex' : 'none';
    document.getElementById('btn-adm-events').style.display = displayMode; document.getElementById('btn-adm-cats').style.display = displayMode;
    document.getElementById('btn-adm-users').style.display = displayMode; document.getElementById('btn-adm-org').style.display = displayMode; document.getElementById('btn-adm-cfg').style.display = displayMode;
    const auditBtn = document.getElementById('btn-adm-audit');
    if(auditBtn) auditBtn.style.display = displayMode;
    document.getElementById('btn-adm-results').style.display = 'flex'; document.getElementById('btn-adm-fin').style.display = 'flex'; document.getElementById('btn-adm-backup').style.display = 'flex'; document.getElementById('btn-adm-restore').style.display = 'flex';
}

function setupAutoSave() {
    const elements = document.querySelectorAll('input:not([type="password"]):not([type="file"]), select, textarea');
    elements.forEach(el => {
        if(!el.id) return;
        const ignoreList = ['login-cpf', 'login-pass', 'cad-nome', 'cad-cpf', 'cad-tel', 'cad-city', 'cad-uf', 'cad-gender', 'cad-nasc', 'cad-cat-override', 'cad-sec-a', 'cad-pass', 'adm-pass-check', 'rec-cpf', 'rec-answer', 'rec-new-pass', 'prof-new-pass', 'backup-input-file', 'adm-res-idx-edit', 'adm-res-id', 'adm-evt-id-edit', 'adm-org-selected-cpf', 'super-edit-old-cpf', 'adm-edit-user-search', 'adm-cfg-search', 'adm-org-search', 'cad-cbc', 'prof-edit-cbc', 'super-edit-cbc'];
        if(ignoreList.includes(el.id)) return;
        const savedVal = localStorage.getItem('autosave_' + el.id);
        if(savedVal !== null) { if(el.type === 'checkbox') el.checked = (savedVal === 'true'); else el.value = savedVal; }
    
        const saveFn = () => { if(el.type === 'checkbox') localStorage.setItem('autosave_' + el.id, el.checked); else localStorage.setItem('autosave_' + el.id, el.value); };
        el.addEventListener('input', saveFn);
        el.addEventListener('change', saveFn);
    });
}

window.showConfirm = function(title, msg, iconHtml, callback) {
    document.getElementById('custom-dialog-title').innerText = title; document.getElementById('custom-dialog-msg').innerHTML = msg;
    document.getElementById('custom-dialog-icon').innerHTML = iconHtml || '<i class="fas fa-exclamation-triangle" style="color:#f59e0b"></i>';
    document.getElementById('custom-dialog-input').style.display = 'none'; document.getElementById('custom-dialog-input').value = ''; document.getElementById('btn-dialog-cancel').style.display = 'inline-block';
    document.getElementById('btn-dialog-confirm').onclick = function() { fecharModal('modal-custom-dialog'); if(callback) callback(true); }; openModal('modal-custom-dialog');
};
window.showPrompt = function(title, msg, callback) {
    document.getElementById('custom-dialog-title').innerText = title; document.getElementById('custom-dialog-msg').innerHTML = msg;
    document.getElementById('custom-dialog-icon').innerHTML = '<i class="fas fa-lock" style="color:var(--pe-red)"></i>';
    const inputEl = document.getElementById('custom-dialog-input'); inputEl.style.display = 'block'; inputEl.value = ''; document.getElementById('btn-dialog-cancel').style.display = 'inline-block';
    document.getElementById('btn-dialog-confirm').onclick = function() { const val = inputEl.value; fecharModal('modal-custom-dialog'); if(callback) callback(val); }; openModal('modal-custom-dialog'); setTimeout(() => inputEl.focus(), 100);
};
window.cancelCustomDialog = function() { fecharModal('modal-custom-dialog'); };

// ==========================================================
// 4. FIREBASE SYNC E INICIALIZAÇÃO DA APLICAÇÃO
// ==========================================================
try { if (typeof firebase !== 'undefined') { firebase.initializeApp(firebaseConfig);
database = firebase.database(); storage = firebase.storage(); auth = firebase.auth(); } } catch (e) { console.log("Firebase Error");
}
try { 
    const localData = localStorage.getItem(DB_KEY);
    if(localData) { 
        db = JSON.parse(localData); 
        if(db.users && !Array.isArray(db.users)) db.users = Object.values(db.users);
        if(db.events && !Array.isArray(db.events)) db.events = Object.values(db.events);
        if(db.tempos && !Array.isArray(db.tempos)) db.tempos = Object.values(db.tempos);
        if(db.ranking && !Array.isArray(db.ranking)) db.ranking = Object.values(db.ranking);
        if(db.notifications && !Array.isArray(db.notifications)) db.notifications = Object.values(db.notifications);
        
        // PROTEÇÃO 1: Limpa qualquer "sujeira" do Firebase antes de iniciar o app
        if(db.users) db.users = db.users.filter(x => x !== null && x !== undefined);
        if(db.events) db.events = db.events.filter(x => x !== null && x !== undefined);
        if(db.tempos) db.tempos = db.tempos.filter(x => x !== null && x !== undefined);
        if(db.notifications) db.notifications = db.notifications.filter(x => x !== null && x !== undefined);
    } 
} catch (e) { db = DEFAULT_DB; }

function checkDbIntegrity() {
    if(!db.users || !Array.isArray(db.users)) db.users = db.users ? Object.values(db.users) : [];
    if(!db.events || !Array.isArray(db.events)) db.events = db.events ? Object.values(db.events) : [];
    if(!db.tempos || !Array.isArray(db.tempos)) db.tempos = db.tempos ? Object.values(db.tempos) : [];
    if(!db.ranking || !Array.isArray(db.ranking)) db.ranking = db.ranking ? Object.values(db.ranking) : [];
    if(!db.notifications || !Array.isArray(db.notifications)) db.notifications = db.notifications ? Object.values(db.notifications) : [];
    if(!db.auditLog || !Array.isArray(db.auditLog)) db.auditLog = db.auditLog ? Object.values(db.auditLog) : [];
    // PROTEÇÃO 2: Limpa novamente sempre que o Firebase enviar atualização
    db.users = db.users.filter(x => x !== null && x !== undefined);
    db.events = db.events.filter(x => x !== null && x !== undefined);
    db.tempos = db.tempos.filter(x => x !== null && x !== undefined);
    db.notifications = db.notifications.filter(x => x !== null && x !== undefined);
    const monthMap = { "JAN":1, "FEV":2, "MAR":3, "ABR":4, "MAI":5, "JUN":6, "JUL":7, "AGO":8, "SET":9, "OUT":10, "NOV":11, "DEZ":12 };
    db.events.sort((a, b) => {
        if(!a || !b || !a.t || !b.t) return 0;
        const numA = parseInt((a.t.match(/\d+/) || [999])[0]);
        const numB = parseInt((b.t.match(/\d+/) || [999])[0]);
        if (numA !== numB) return numA - numB; 
        const mA = monthMap[a.m] || 0;
        const mB = monthMap[b.m] || 0;
        if (mA !== mB) return mB - mA; 
        const dayA = parseInt((a.d || "0").split('/')[0], 10) || 0;
        const dayB = parseInt((b.d || "0").split('/')[0], 10) || 0;
        return dayB - dayA; 
    });
    const todayStr = new Date().toISOString().slice(0, 10);
    db.events.forEach(e => { if (e && e.status === 'OPEN' && e.closeDate && e.closeDate < todayStr) { e.status = 'CLOSED'; } });
    if(!db.config) db.config = { phone: '', rerunPass: 'admin123', allowAllIDs: false, categories: DEFAULT_CATS };
    if(!db.config.categories) db.config.categories = DEFAULT_CATS;
    if(!db.config.rerunPass) db.config.rerunPass = 'admin123';
    ensureAdminExists();
}

function ensureAdminExists() {
    const hasAdmin = db.users.some(u => u.cpf === "00000000000");
    if (!hasAdmin) db.users.push({ nome: "ADMINISTRADOR DO SISTEMA", cpf: "00000000000", pass: "admin123", role: "ADMIN", city: "SEDE", uf: "PE", cat: "MASTER", tel: "", cbc: "", nasc: "1990-01-01", secA: "MESTRE", gender: "M", team: "ORGANIZAÇÃO", idReleased: true, filiadoPE: true, inscricoes: [], selfie: null, allowedEvts: [] });
}

let pendingSaves = new Set(); let saveTimeout = null;
window.saveDB = function(moduleName = null) { 
    if(DB_KEY.includes('archive')) return console.warn("Bloqueado: Tentativa de edição em arquivo histórico.");
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { console.warn("Aviso: Limite do LocalStorage atingido."); }
    if(!database) return;
    if (moduleName) { if (Array.isArray(moduleName)) moduleName.forEach(m => pendingSaves.add(m)); else pendingSaves.add(moduleName);
    } 
    else { ['users', 'events', 'tempos', 'config', 'notifications', 'auditLog'].forEach(m => pendingSaves.add(m));
    }
    if(saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => { let updates = {}; pendingSaves.forEach(m => { if(db[m] !== undefined) updates['/' + DB_KEY + '/' + m] = db[m]; });
        if(Object.keys(updates).length > 0) database.ref().update(updates).catch(err => { console.error("Erro Firebase"); });
        pendingSaves.clear(); }, 250);
};

if(database) {
    database.ref(DB_KEY).on('value', (snapshot) => {
        const data = snapshot.val();
        if(data) {
            if(data.tempos && !Array.isArray(data.tempos)) data.tempos = Object.values(data.tempos);
            if(data.users && !Array.isArray(data.users)) data.users = Object.values(data.users);
            if(data.events && !Array.isArray(data.events)) data.events = Object.values(data.events);
            if(data.notifications && !Array.isArray(data.notifications)) data.notifications = Object.values(data.notifications);
            if(data.auditLog && !Array.isArray(data.auditLog)) data.auditLog = Object.values(data.auditLog);
            db = data; checkDbIntegrity(); localStorage.setItem(DB_KEY, JSON.stringify(db));
            if(loggedUser) { const fresh = db.users.find(u => cleanCPF(u.cpf) === cleanCPF(loggedUser.cpf)); if(fresh) { loggedUser = fresh; updateSessionStorage(); } }
            refreshCurrentView(); atualizarBadgeNotificacoes();
            if(document.getElementById('screen-live-monitor').classList.contains('active')) renderLiveContent(liveViewType);
            if (window.liveTimingWindow && !window.liveTimingWindow.closed) { if (typeof gatherAndPushData === 'function') gatherAndPushData(window.liveTimingWindow); }
        }
    });
}

function updateSessionStorage() { if(localStorage.getItem(SESS_KEY)) localStorage.setItem(SESS_KEY, JSON.stringify(loggedUser));
else sessionStorage.setItem(SESS_KEY, JSON.stringify(loggedUser)); }

function refreshCurrentView() {
    let filter = 'ALL'; const filterEl = document.getElementById('filter-evt-ranking');
    if(filterEl) filter = filterEl.value; recalcRanking(filter);
    if(currentTab === 'tempos') renderContent('tempos'); if(currentTab === 'ranking') renderContent('ranking'); if(currentTab === 'calendar') renderContent('calendar');
    if(currentTab === 'profile') { updateCardLive(); loadProfileData(); }
    if(currentTab === 'adm' && document.getElementById('adm-panel-real').style.display === 'block') {
        if(currentAdmSection === 'results') renderAdmResults();
        if(currentAdmSection === 'financial') renderInscriptions(); if(currentAdmSection === 'users-edit') filterPilots('edit-user', true);
        if(currentAdmSection === 'events') renderAdmEvents(); if(currentAdmSection === 'cats') renderAdmCategories();
        if(currentAdmSection === 'organizer') renderOrgList();
        if(currentAdmSection === 'config-global') filterPilots('cfg-search', true); if(currentAdmSection === 'audit') renderAuditLog();
    }
}

// ==========================================================
// 5. AUDITORIA E NOTIFICAÇÕES
// ==========================================================
window.logAction = function(desc) {
    if (!db.auditLog) db.auditLog = [];
    let authorName = loggedUser ? loggedUser.nome : "SISTEMA"; let authorRole = loggedUser ? (isSuperAdmin(loggedUser) ? 'SUPER-ADM' : loggedUser.role) : "";
    db.auditLog.push({ id: Date.now() + Math.random().toString(36).substr(2, 5), date: new Date().toISOString(), author: `${authorName} (${authorRole})`, desc: desc });
    if(db.auditLog.length > 500) db.auditLog = db.auditLog.slice(db.auditLog.length - 500); saveDB('auditLog');
};

function ensureAuditUI() {
    const menu = document.getElementById('adm-menu');
    if(menu && !document.getElementById('btn-adm-audit')) {
        menu.insertAdjacentHTML('beforeend', `<div class="adm-dash-btn" id="btn-adm-audit" onclick="openAdmSection('audit')" style="border-color:#8b5cf6;"><i class="fas fa-clipboard-list" style="color:#8b5cf6"></i><span>AUDITORIA (LOG)</span></div>`);
    }
    
    // 👇 O TRATOR: Remove o HTML velho em cache para dar lugar ao novo botão 👇
    const oldPanel = document.getElementById('adm-sec-audit');
    if(oldPanel) oldPanel.remove();

    const panel = document.getElementById('adm-panel-real');
    if(panel) {
        panel.insertAdjacentHTML('beforeend', `<div id="adm-sec-audit" class="adm-section" style="display:none"><div style="background:white; border:1px solid #ddd; padding:10px; border-radius:8px;"><b style="color:var(--pe-blue); font-size:12px; display:flex; align-items:center; gap:5px;"><i class="fas fa-clipboard-list"></i> HISTÓRICO DO SISTEMA</b><p style="font-size:10px; color:#666; margin-top:5px; margin-bottom:10px;">Monitoramento de ações realizadas por Organizadores e Administradores.</p><button onclick="window.limparAuditoriaOrganizador()" style="background:#d50000; color:white; border:none; padding:8px 10px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer; margin-bottom:10px; width:100%; box-shadow:0 2px 4px rgba(0,0,0,0.1);"><i class="fas fa-trash-alt"></i> APAGAR REGISTROS DA TELA</button><select id="adm-audit-filter" class="input-field" style="margin-bottom: 10px; font-size: 11px; padding: 8px; font-weight: bold; border-color: #8b5cf6; color: var(--pe-blue);" onchange="renderAuditLog()"><option value="ALL">TODOS OS ORGANIZADORES (GERAL)</option></select><div id="adm-audit-list" style="max-height:400px; overflow-y:auto; border:1px solid #eee; padding:5px; border-radius:5px; background:#f8fafc; font-size:11px;"></div></div><button class="btn" style="background:#333; margin-top:20px" onclick="backToAdmMenu()">VOLTAR</button></div>`);
    }
}

window.renderAuditLog = function() {
    const listDiv = document.getElementById('adm-audit-list'); const filterSelect = document.getElementById('adm-audit-filter'); if(!listDiv) return;
    if(!db.auditLog || db.auditLog.length === 0) listDiv.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">Nenhum registro de auditoria encontrado.</div>';
    if(filterSelect) filterSelect.style.display = 'block'; let currentFilter = filterSelect ? filterSelect.value : 'ALL';
    if(filterSelect) {
        let logAuthors = db.auditLog ? db.auditLog.map(log => log.author).filter(Boolean) : [];
        let currentOrgs = db.users.filter(u => u.role === 'ORGANIZER' || u.role === 'ADMIN' || isSuperAdmin(u)).map(u => `${u.nome} (${isSuperAdmin(u) ? 'SUPER-ADM' : u.role})`);
        const uniqueAuthors = [...new Set([...logAuthors, ...currentOrgs])].sort();
        let optionsHtml = '<option value="ALL">TODOS OS ORGANIZADORES (GERAL)</option>';
        uniqueAuthors.forEach(author => { optionsHtml += `<option value="${author}">${author}</option>`; });
        filterSelect.innerHTML = optionsHtml;
        if (uniqueAuthors.includes(currentFilter) || currentFilter === 'ALL') filterSelect.value = currentFilter; else { currentFilter = 'ALL'; filterSelect.value = 'ALL'; }
    }
    let filteredLogs = db.auditLog || []; if (currentFilter !== 'ALL') filteredLogs = filteredLogs.filter(log => log.author === currentFilter);
    const sorted = [...filteredLogs].sort((a,b) => new Date(b.date) - new Date(a.date));
    if(sorted.length === 0) { listDiv.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">Nenhum registro encontrado para este organizador.</div>'; return; }
    listDiv.innerHTML = sorted.map(log => `<div style="padding:10px; border-bottom:1px solid #e2e8f0; margin-bottom:5px; background:white; border-radius:6px; box-shadow:0 1px 3px rgba(0,0,0,0.05); position:relative;"><div style="font-size:9px; color:#94a3b8; margin-bottom:4px; display:flex; justify-content:space-between; padding-right: 25px;"><span>${new Date(log.date).toLocaleString('pt-BR')}</span><b style="color:var(--pe-blue)">${log.author}</b></div><div style="color:#334155; font-weight:bold; font-size:11px; line-height:1.3; padding-right: 25px;">${log.desc}</div><button onclick="confirmarDeletarLog('${log.id}')" style="position:absolute; right:5px; top:50%; transform:translateY(-50%); background:transparent; border:none; color:var(--pe-red); cursor:pointer; font-size:14px; padding:10px;"><i class="fas fa-trash-alt"></i></button></div>`).join('');
};

window.confirmarDeletarLog = function(logId) { showConfirm("EXCLUIR REGISTRO?", "Deseja apagar este registro do histórico?", '<i class="fas fa-trash-alt" style="color:var(--pe-red)"></i>', function(res) { if(res) { const idx = db.auditLog.findIndex(l => String(l.id) === String(logId)); if(idx > -1) { db.auditLog.splice(idx, 1); saveDB('auditLog'); renderAuditLog(); toast("REGISTRO EXCLUÍDO"); } } }); };

window.enviarNotificacao = function(msg, targetRole, targetCpf, targetEvtId) {
    if (!db.notifications) db.notifications = [];
    db.notifications.push({ id: Date.now() + Math.random().toString(36).substr(2, 5), msg: msg, targetRole: targetRole, targetCpf: targetCpf, targetEvtId: targetEvtId, date: new Date().toISOString(), readBy: [], deletedBy: [] });
    if(db.notifications.length > 2000) db.notifications = db.notifications.slice(db.notifications.length - 2000); saveDB('notifications');
};

window.obterMinhasNotificacoes = function() {
    if(!db.notifications) return [];
    return db.notifications.filter(n => { if (n.deletedBy && n.deletedBy.includes(loggedUser.cpf)) return false; if (n.targetCpf && n.targetCpf === loggedUser.cpf) return true; if (n.targetRole === 'ADMIN' && isSuperAdmin(loggedUser)) return true; if (n.targetRole === 'ORGANIZER' && loggedUser.role === 'ORGANIZER' && n.targetEvtId) { if (loggedUser.allowedEvts && loggedUser.allowedEvts.includes(String(n.targetEvtId))) return true; } return false; }).sort((a,b) => new Date(b.date) - new Date(a.date));
};

window.confirmarDeletarNotificacao = function(notifId) { 
    if(!loggedUser) return;
    
    if (isSuperAdmin(loggedUser)) {
        // Remove modal antigo se houver para não duplicar
        let oldModal = document.getElementById('modal-notif-delete-choice');
        if (oldModal) oldModal.remove();

        const modalHtml = `
        <div class="modal-overlay" id="modal-notif-delete-choice" style="z-index: 300001; display: flex; padding: 20px;">
            <div class="modal-box" style="max-width: 300px; padding: 20px; text-align: center;">
                <i class="fas fa-trash-alt" style="font-size: 30px; color: var(--pe-red); margin-bottom: 10px;"></i>
                <h3 style="color: var(--pe-blue); margin-bottom: 10px; font-size: 16px;">APAGAR NOTIFICAÇÃO</h3>
                <p style="font-size: 12px; color: #666; margin-bottom: 15px;">Como deseja excluir esta notificação específica?</p>
                
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <button class="btn" style="background: #f87171; margin: 0; padding: 10px; font-size: 12px;" onclick="window.deletarNotificacao('${notifId}', 'MIM'); fecharModal('modal-notif-delete-choice');">
                        <i class="fas fa-user-slash"></i> APAGAR P/ MIM
                    </button>
                    <button class="btn" style="background: #d50000; margin: 0; padding: 10px; font-size: 12px;" onclick="window.deletarNotificacao('${notifId}', 'TODOS'); fecharModal('modal-notif-delete-choice');">
                        <i class="fas fa-globe"></i> APAGAR P/ TODOS
                    </button>
                    <button class="btn" style="background: #f1f5f9; color: #64748b; margin: 0; padding: 10px; font-size: 12px; border: 1px solid #cbd5e1;" onclick="fecharModal('modal-notif-delete-choice')">
                        CANCELAR
                    </button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    } else {
        // Para atletas e organizadores comuns, apenas confirma exclusão pessoal
        showConfirm("APAGAR NOTIFICAÇÃO?", "Deseja remover esta notificação da sua lista?", '<i class="fas fa-trash-alt" style="color:var(--pe-red)"></i>', function(res) { 
            if(res) window.deletarNotificacao(notifId, 'MIM'); 
        });
    }
};

window.deletarNotificacao = function(notifId, modo = 'MIM') { 
    if(!loggedUser) return; 
    const idx = db.notifications.findIndex(n => n.id === notifId);
    
    if(idx > -1) { 
        if (modo === 'TODOS' && isSuperAdmin(loggedUser)) {
            // Remove do banco de dados globalmente
            db.notifications.splice(idx, 1);
            toast("NOTIFICAÇÃO APAGADA PARA TODOS!");
        } else {
            // Oculta apenas para o usuário atual
            if(!db.notifications[idx].deletedBy) db.notifications[idx].deletedBy = []; 
            if(!db.notifications[idx].deletedBy.includes(loggedUser.cpf)) { 
                db.notifications[idx].deletedBy.push(loggedUser.cpf); 
            }
            toast("NOTIFICAÇÃO APAGADA PARA VOCÊ!");
        }
        saveDB('notifications'); 
        abrirNotificacoes(); 
        atualizarBadgeNotificacoes(); 
    } 
};

function injectNotificationUI() {
    let headerRight = document.querySelector('#main-app-header > div:nth-child(2)');
    if(!headerRight) headerRight = document.getElementById('main-app-header');

    if (headerRight && !document.getElementById('btn-notifications')) { 
        const notifBtn = document.createElement('div'); notifBtn.id = 'btn-notifications';
        notifBtn.style.cssText = 'position:relative; margin-right:15px; cursor:pointer; padding-top:2px;'; 
        notifBtn.innerHTML = '<i class="fas fa-bell" style="font-size:22px; color:var(--pe-blue)"></i><span id="notif-badge" style="display:none; position:absolute; top:-2px; right:-8px; background:var(--pe-red); color:white; border-radius:50%; font-size:10px; padding:2px 6px; font-weight:bold; border:1px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.2);">0</span>';
        notifBtn.onclick = window.abrirNotificacoes; 
        headerRight.insertBefore(notifBtn, headerRight.firstChild); 
    }
    
    // O trator agora é inteligente: só destrói o modal se faltar o botão "P/ TODOS" (se for o velho)
    const oldModal = document.getElementById('modal-notifications');
    if(oldModal && !document.getElementById('btn-del-notif-all')) {
        oldModal.remove();
    }

    // Só cria de novo se não existir (impede o erro de apagar e fechar sozinho)
    if(!document.getElementById('modal-notifications')) {
        const modalHtml = `<div class="modal-overlay" id="modal-notifications" style="z-index:300000; padding:20px;"><div class="modal-box" style="text-align:left; max-height:85vh; display:flex; flex-direction:column; padding:15px; width:100%; max-width:400px; border-top: 5px solid var(--pe-blue); overflow:hidden; border-radius:12px;"><h3 style="color:var(--pe-blue); border-bottom:1px solid #eee; padding-bottom:10px; display:flex; justify-content:space-between; align-items:center; margin:0; flex-shrink:0; font-size:16px;">NOTIFICAÇÕES <i class="fas fa-times" style="cursor:pointer; color:#999; font-size:18px;" onclick="fecharModal('modal-notifications')"></i></h3><div style="display:flex; gap:5px; margin-top:10px; width:100%;"><button onclick="window.limparNotificacoesPremium('MIM')" style="background:#f87171; color:white; border:none; padding:8px; border-radius:4px; font-size:10px; font-weight:bold; cursor:pointer; flex:1; box-shadow:0 2px 4px rgba(0,0,0,0.1);"><i class="fas fa-user-slash"></i> APAGAR P/ MIM</button><button onclick="window.limparNotificacoesPremium('TODOS')" id="btn-del-notif-all" style="background:#d50000; color:white; border:none; padding:8px; border-radius:4px; font-size:10px; font-weight:bold; cursor:pointer; flex:1; box-shadow:0 2px 4px rgba(0,0,0,0.1); display:none;"><i class="fas fa-globe"></i> P/ TODOS</button></div><select id="notif-filter-evt" onchange="window.abrirNotificacoes()" class="input-field" style="margin-top:10px; padding:8px; font-size:11px; font-weight:bold;"><option value="ALL">TODOS OS EVENTOS (GERAL)</option></select><div id="notif-list-content" style="flex:1; overflow-y:auto; margin-top:10px; font-size:12px; padding-right:5px; -webkit-overflow-scrolling:touch;"></div></div></div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml); 
    }
}

window.atualizarBadgeNotificacoes = function() { 
    if(!loggedUser) return; 
    injectNotificationUI(); 
    let unreadCount = 0; 
    const minhasNotificacoes = window.obterMinhasNotificacoes();
    
    minhasNotificacoes.forEach(n => { 
        if(!n.readBy) n.readBy = []; 
        if(!n.readBy.includes(loggedUser.cpf)) unreadCount++; 
    }); 
    
    const badge = document.getElementById('notif-badge');
    if(badge) { 
        if(unreadCount > 0) { 
            badge.style.display = 'block'; 
            badge.innerText = unreadCount > 9 ? '9+' : unreadCount; 
        } else { 
            badge.style.display = 'none'; 
        } 
    }

    // NOVA LÓGICA: Atualiza o selo numérico no ícone do celular (PWA)
    if ('setAppBadge' in navigator) {
        if (unreadCount > 0) {
            navigator.setAppBadge(unreadCount).catch(err => console.log("Erro no badge:", err));
        } else {
            navigator.clearAppBadge().catch(err => console.log("Erro ao limpar badge:", err));
        }
    }
};

window.abrirNotificacoes = function() {
    // Garante que o painel exista no HTML antes de manipular
    injectNotificationUI();

    const listDiv = document.getElementById('notif-list-content');
    const filterEvt = document.getElementById('notif-filter-evt');
    
    if (filterEvt && filterEvt.options.length <= 1 && db.events) {
        let htmlOpts = '<option value="ALL">TODOS OS EVENTOS (GERAL)</option>';
        db.events.forEach(e => { htmlOpts += `<option value="${e.id}">${e.t}</option>`; });
        filterEvt.innerHTML = htmlOpts;
    }

    let minhasNotificacoes = window.obterMinhasNotificacoes();
    const selectedEvtId = filterEvt ? filterEvt.value : 'ALL';

    if (selectedEvtId !== 'ALL') {
        minhasNotificacoes = minhasNotificacoes.filter(n => String(n.targetEvtId) === String(selectedEvtId) || !n.targetEvtId);
    }

    if (minhasNotificacoes.length === 0) { 
        listDiv.innerHTML = '<div style="padding:20px; text-align:center; color:#999;">Nenhuma notificação encontrada para este filtro.</div>';
    } 
    else { 
        listDiv.innerHTML = minhasNotificacoes.map(n => { 
            const isRead = n.readBy && n.readBy.includes(loggedUser.cpf); 
            const bg = isRead ? 'transparent' : '#f0f9ff'; 
            const fw = isRead ? 'normal' : 'bold'; 
            const iconColor = isRead ? '#cbd5e1' : 'var(--pe-blue)'; 
            
            let evtNameTag = '';
            if (n.targetEvtId) {
                const evtObj = db.events.find(e => String(e.id) === String(n.targetEvtId));
                if (evtObj) evtNameTag = `<span style="font-size:9px; background:#e2e8f0; color:#475569; padding:2px 6px; border-radius:4px; display:inline-block; margin-top:4px;">${evtObj.t}</span>`;
            }

            return `<div style="padding:12px 10px; border-bottom:1px solid #eee; background:${bg}; font-weight:${fw}; display:flex; gap:10px; align-items:flex-start; position:relative; border-radius:6px; margin-bottom:5px;"><i class="fas fa-bell" style="color:${iconColor}; margin-top:2px; flex-shrink:0;"></i><div style="flex:1; padding-right:35px;"><div style="color:#333; line-height:1.3; font-size:12px;">${n.msg}</div>${evtNameTag}<div style="font-size:9px; color:#94a3b8; margin-top:6px;">${new Date(n.date).toLocaleString('pt-BR')}</div></div><button onclick="confirmarDeletarNotificacao('${n.id}')" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:var(--pe-red); border:none; color:white; cursor:pointer; font-size:12px; padding:8px; border-radius:6px; box-shadow:0 2px 5px rgba(213,0,0,0.2);"><i class="fas fa-trash-alt"></i></button></div>`; 
        }).join(''); 
    }
    
    // 👇 O COMANDO CRUCIAL QUE HAVIA SUMIDO ESTÁ DE VOLTA AQUI 👇
    openModal('modal-notifications'); 
    
    const btnAll = document.getElementById('btn-del-notif-all');
    if(btnAll) btnAll.style.display = isSuperAdmin(loggedUser) ? 'block' : 'none'; 
    
    let hasChanges = false; 
    window.obterMinhasNotificacoes().forEach(n => { 
        if(!n.readBy) n.readBy = []; 
        if(!n.readBy.includes(loggedUser.cpf)) { n.readBy.push(loggedUser.cpf); hasChanges = true; } 
    }); 
    if(hasChanges) { saveDB('notifications'); atualizarBadgeNotificacoes(); }
};

// ==========================================================
// 6. EVENTOS DE INICIALIZAÇÃO DA PÁGINA (LOAD)
// ==========================================================
document.addEventListener("DOMContentLoaded", function() {
    if(window.location.search.includes('live_external')) { checkExternalMode(); return; }
    ensureAdminExists(); ensureAuditUI(); 
    if(document.getElementById('lbl-cad-season')) document.getElementById('lbl-cad-season').innerText = SYSTEM_YEAR;
    
    const selSeason = document.getElementById('season-selector');
    if(selSeason) {
        let html = '';
        if (SYSTEM_YEAR <= 2026) { html += `<option value="dhpe_v25_final_stable_fix">TEMP. ATUAL (2026)</option><option value="dhpe_2025_archive">HISTÓRICO 2025</option>`; } 
        else if (SYSTEM_YEAR === 2027) { html += `<option value="dhpe_2027_active">TEMP. ATUAL (2027)</option><option value="dhpe_2026_archive">HISTÓRICO 2026</option><option value="dhpe_2025_archive">HISTÓRICO 2025</option>`; } 
        else { html += `<option value="dhpe_${SYSTEM_YEAR}_active">TEMP. ATUAL (${SYSTEM_YEAR})</option><option value="dhpe_${SYSTEM_YEAR - 1}_archive">HISTÓRICO ${SYSTEM_YEAR - 1}</option><option value="dhpe_2026_archive">HISTÓRICO 2026</option>`; }
        selSeason.innerHTML = html;
        if(selSeason.querySelector(`option[value="${DB_KEY}"]`)) { selSeason.value = DB_KEY; } else { selSeason.value = defaultKey; localStorage.setItem('dhpe_active_season', defaultKey); DB_KEY = defaultKey; }
    }
    if(DB_KEY.includes('archive')) { document.body.classList.add('archive-mode'); const badge = document.getElementById('archive-badge-display'); if(badge) badge.style.display = 'block'; }
    
    const uiElementsToSave = ['filter-region-tempos', 'filter-evt-tempos', 'filter-type-tempos', 'filter-cat-tempos', 'filter-region-ranking', 'filter-evt-ranking', 'filter-cat-ranking', 'adm-res-evt', 'adm-res-runtype', 'adm-res-filter-cat', 'adm-res-filter-type', 'adm-user-filter-cat', 'fin-evt-select', 'adm-edit-user-search', 'adm-cfg-search', 'adm-org-search'];
    uiElementsToSave.forEach(id => { const el = document.getElementById(id); if(el) { el.addEventListener('change', () => localStorage.setItem('ui_'+id, el.value)); if(el.tagName === 'INPUT') el.addEventListener('input', () => localStorage.setItem('ui_'+id, el.value)); } });
    ['filter-region-tempos', 'filter-type-tempos', 'filter-region-ranking', 'adm-res-runtype', 'adm-res-filter-type', 'adm-edit-user-search', 'adm-cfg-search', 'adm-org-search'].forEach(id => { const el = document.getElementById(id); const val = localStorage.getItem('ui_'+id); if(el && val !== null) el.value = val; });
    currentFilterStatus = localStorage.getItem('ui_fin-status') || 'ALL'; setupAutoSave();
    
    let savedSession = localStorage.getItem(SESS_KEY) || sessionStorage.getItem(SESS_KEY);
    if(savedSession) { 
        try { 
            const u = JSON.parse(savedSession);
            // Garante que a configuração base exista antes de montar a tela
            if(!db.config) db.config = { phone: '', rerunPass: 'admin123', allowAllIDs: false, categories: DEFAULT_CATS };
            if(db.users && !Array.isArray(db.users)) db.users = Object.values(db.users);
            if(db.users) db.users = db.users.filter(x => x !== null && x !== undefined);
            const fresh = (db.users || []).find(x => x && x.cpf && cleanCPF(x.cpf) === cleanCPF(u.cpf)); 
            loggedUser = fresh ? fresh : u; 
            initApp(true); 
            
            if(localStorage.getItem('draft_evt_t')) document.getElementById('adm-evt-t').value = localStorage.getItem('draft_evt_t'); 
            if(localStorage.getItem('draft_evt_d')) document.getElementById('adm-evt-d').value = localStorage.getItem('draft_evt_d'); 
            if(localStorage.getItem('draft_evt_c')) document.getElementById('adm-evt-c').value = localStorage.getItem('draft_evt_c');
        } catch(e) { 
            console.error("Erro ignorado. Mantendo o usuário logado:", e);
            // Se der erro menor, não derruba o usuário. Força a tela do App.
            if(loggedUser) trocarTela('app'); else mostrarLoginInicial();
        } 
    } else { 
        mostrarLoginInicial();
    }
    
    const timeInput = document.getElementById('adm-res-val'); if(timeInput) timeInput.addEventListener('input', function() { window.mascaraTempo(this); });
    const qualifyCheck = document.getElementById('adm-evt-has-qualify'); if(qualifyCheck) qualifyCheck.addEventListener('change', toggleQualifyInputs);
    const inputEvtName = document.getElementById('adm-evt-t'); if(inputEvtName) inputEvtName.addEventListener('input', function() { localStorage.setItem('draft_evt_t', this.value); });
    const inputEvtDate = document.getElementById('adm-evt-d'); if(inputEvtDate) inputEvtDate.addEventListener('input', function() { localStorage.setItem('draft_evt_d', this.value); });
    const inputEvtCity = document.getElementById('adm-evt-c');
    if(inputEvtCity) inputEvtCity.addEventListener('input', function() { localStorage.setItem('draft_evt_c', this.value); });
    
    if ('serviceWorker' in navigator) { navigator.serviceWorker.ready.then((reg) => { reg.update(); }); }
});
function trocarTela(id) { document.querySelectorAll('.screen').forEach(e => e.classList.remove('active')); const tela = document.getElementById('screen-' + id); if(tela) tela.classList.add('active'); const nav = document.getElementById('main-nav-bar');
const head = document.getElementById('main-app-header'); if(id === 'app') { if(nav) nav.style.display='flex'; if(head) head.style.display='flex'; } else { if(nav) nav.style.display='none'; if(head) head.style.display='none'; } }
function mostrarLoginInicial() { document.getElementById('lbl-season-year').innerText = SYSTEM_YEAR; trocarTela('login'); }
window.togglePass = function(id) { const input = document.getElementById(id); const icon = input.nextElementSibling;
if (input.type === "password") { input.type = "text"; icon.classList.remove("fa-eye"); icon.classList.add("fa-eye-slash"); } else { input.type = "password"; icon.classList.remove("fa-eye-slash"); icon.classList.add("fa-eye"); } };

// ==========================================================
// 7. SISTEMA DE LOGIN, CADASTRO E CONTAS
// ==========================================================
window.fazerLogin = function() { 
    const cpfRaw = document.getElementById('login-cpf').value;
    const passRaw = document.getElementById('login-pass').value; const remember = document.getElementById('login-remember').checked;
    if(!cpfRaw || !passRaw) return toast("PREENCHA TUDO", "error");
    const clean = cleanCPF(cpfRaw);
    const emailFake = clean + "@dhpe.com.br"; const authPass = passRaw.length < 6 ? passRaw.padEnd(6, '0') : passRaw;
    toast("AUTENTICANDO...", "info");
    let localUser = db.users.find(x => cleanCPF(x.cpf) === clean);
    if(localUser && localUser.tempPass && localUser.tempPass === passRaw) { if(Date.now() <= localUser.tempPassExp) return executeLogin(localUser, remember);
    else return toast("SENHA TEMPORÁRIA EXPIRADA", "error"); }
    if(auth) { auth.signInWithEmailAndPassword(emailFake, authPass).then(() => { finishLogin(clean, remember); }).catch((error) => { if (localUser && (localUser.pass === passRaw || localUser.adminNewPass === passRaw)) { if (error.code === 'auth/user-not-found') { auth.createUserWithEmailAndPassword(emailFake, authPass).catch(()=>{}); } executeLogin(localUser, remember); } else { toast("CPF OU SENHA INCORRETOS", "error"); } });
    } else { if(localUser && (localUser.pass === passRaw || localUser.adminNewPass === passRaw)) { executeLogin(localUser, remember);
    } else { toast("CPF OU SENHA INCORRETOS", "error"); } }
};

function finishLogin(cpfClean, remember) { if(cpfClean === "00000000000") ensureAdminExists();
let user = db.users.find(x => cleanCPF(x.cpf) === cpfClean); if(user) { executeLogin(user, remember);
} else { toast("DADOS NÃO ENCONTRADOS NO SISTEMA", "error"); if(auth) auth.signOut(); } }
function executeLogin(user, remember) { loggedUser = user;
if(remember) { localStorage.setItem(SESS_KEY, JSON.stringify(user)); sessionStorage.removeItem(SESS_KEY); } else { sessionStorage.setItem(SESS_KEY, JSON.stringify(user)); localStorage.removeItem(SESS_KEY); } toast("BEM-VINDO DE VOLTA!"); initApp(false);
}
window.fazerLogout = function() { if(auth) auth.signOut(); localStorage.removeItem(SESS_KEY); sessionStorage.removeItem(SESS_KEY); localStorage.removeItem(LAST_TAB_KEY); localStorage.removeItem(LAST_ADM_KEY); loggedUser = null; window.location.reload(true); };
window.cadastrar = function() { 
    const nome = document.getElementById('cad-nome').value.toUpperCase(); const cpf = document.getElementById('cad-cpf').value; const tel = document.getElementById('cad-tel').value;
    const city = document.getElementById('cad-city').value.toUpperCase(); const uf = document.getElementById('cad-uf').value; const gender = document.getElementById('cad-gender').value; const pass = document.getElementById('cad-pass').value; const cat = document.getElementById('cad-cat-final').value;
    const nasc = document.getElementById('cad-nasc').value; const secA = document.getElementById('cad-sec-a').value.toUpperCase(); const cbc = document.getElementById('cad-cbc') ? document.getElementById('cad-cbc').value : "";
    if(!nome || !cpf || !tel || !city || !gender || !pass || !secA || !cat || !nasc) return toast("PREENCHA TUDO", "error");
    if(!validarCPF(cleanCPF(cpf))) return toast("CPF INVÁLIDO! VERIFIQUE.", "error"); if(db.users.find(u => cleanCPF(u.cpf) === cleanCPF(cpf))) return toast("CPF JÁ CADASTRADO NO BANCO", "error");
    if(pass.length < 6) return toast("A SENHA DEVE TER NO MÍNIMO 6 CARACTERES", "error");
    const emailFake = cleanCPF(cpf) + "@dhpe.com.br";
    toast("CRIANDO CONTA...", "info");
    if(auth) { auth.createUserWithEmailAndPassword(emailFake, pass).then((userCredential) => { const newUser = { nome, cpf, tel, city, uf, gender, cat, nasc, secA, team: '', cbc: cbc, role: 'USER', inscricoes: [], selfie: null, allowedEvts: [], idReleased: false, filiadoPE: false }; db.users.push(newUser); saveDB('users'); window.enviarNotificacao(`Novo atleta cadastrado no sistema: ${nome} (${city}-${uf}).`, 'ADMIN', null, null); loggedUser = newUser; updateSessionStorage(); toast("CADASTRO REALIZADO COM SUCESSO!"); initApp(false); }).catch((error) => { if(error.code === 'auth/email-already-in-use') toast("ESTE CPF JÁ ESTÁ REGISTRADO NO FIREBASE", "error"); else toast("ERRO AO CADASTRAR: " + error.message, "error"); });
    }
};

window.abrirModalRecovery = function() { document.getElementById('rec-cpf').value = ''; document.getElementById('rec-answer').value = ''; document.getElementById('rec-new-pass').value = ''; document.getElementById('rec-security-area').style.display = 'none'; document.getElementById('rec-change-pass-area').style.display = 'none';
openModal('modal-recovery'); };
window.buscarUsuarioRecuperacao = function() { const cpfRaw = document.getElementById('rec-cpf').value; const user = db.users.find(u => cleanCPF(u.cpf) === cleanCPF(cpfRaw));
if(user) { document.getElementById('rec-security-area').style.display='block'; document.getElementById('rec-change-pass-area').style.display='none'; toast("USUÁRIO ENCONTRADO"); } else { toast("CPF NÃO ENCONTRADO", "error"); } };
window.revelarSenha = function() { const cpfRaw = document.getElementById('rec-cpf').value; const ans = document.getElementById('rec-answer').value.toUpperCase(); const user = db.users.find(u => cleanCPF(u.cpf) === cleanCPF(cpfRaw));
if(user && user.secA === ans) { document.getElementById('rec-security-area').style.display = 'none'; document.getElementById('rec-change-pass-area').style.display = 'block'; toast("RESPOSTA CORRETA!", "success");
} else { showConfirm("ERRO DE SEGURANÇA", "Resposta Incorreta. Tente novamente.", '<i class="fas fa-times-circle" style="color:#d50000"></i>', null); } };
window.mudarSenhaRecuperacao = function() {
    const cpfRaw = document.getElementById('rec-cpf').value; const clean = cleanCPF(cpfRaw);
    const user = db.users.find(u => cleanCPF(u.cpf) === clean); const newPass = document.getElementById('rec-new-pass').value;
    if(newPass.length > 0 && newPass.length < 6) return toast("A nova senha deve ter no mínimo 6 dígitos", "error");
    if(newPass.length >= 6) {
        const emailFake = clean + "@dhpe.com.br"; toast("ATUALIZANDO SENHA...", "info");
        const salvarLocal = () => { const idx = db.users.findIndex(u => cleanCPF(u.cpf) === clean);
        if(idx > -1) { db.users[idx].pass = newPass; db.users[idx].tempPass = null; db.users[idx].adminNewPass = null; saveDB('users'); } toast("SENHA ALTERADA COM SUCESSO!"); fecharModal('modal-recovery');
        };
        salvarLocal();
        if(auth) { const authPass = newPass.padEnd(6, '0'); auth.signInWithEmailAndPassword(emailFake, user.pass || 'default123').then(() => { auth.currentUser.updatePassword(authPass).catch(()=>{}); }).catch((e) => { if (e.code === 'auth/user-not-found') { auth.createUserWithEmailAndPassword(emailFake, authPass).catch(()=>{}); } });
        }
    } else { toast("Nenhuma alteração feita. Você pode logar."); fecharModal('modal-recovery'); }
};
function initApp(isRestoring = false) { 
    trocarTela('app');
    if(loggedUser && (isSuperAdmin(loggedUser) || loggedUser.role === 'ORGANIZER' || loggedUser.role === 'ADMIN')) { document.getElementById('btn-adm').style.display = 'flex';
    } else { document.getElementById('btn-adm').style.display = 'none'; } 
    let savedTab = localStorage.getItem(LAST_TAB_KEY) || 'calendar';
    if(savedTab === 'adm' && (!loggedUser || (!isSuperAdmin(loggedUser) && loggedUser.role !== 'ORGANIZER' && loggedUser.role !== 'ADMIN'))) { savedTab = 'calendar';
    }
    document.getElementById('lbl-season-year').innerText = SYSTEM_YEAR; recalcRanking(); nav(savedTab); 
    if (isRestoring && savedTab === 'adm') { setTimeout(() => { document.getElementById('adm-login-box').style.display = 'none'; document.getElementById('adm-panel-real').style.display = 'block'; applyAdminPermissions(); let lastAdm = localStorage.getItem(LAST_ADM_KEY) || 'menu'; openAdmSection(lastAdm); }, 100);
    }
    updateSupportLink(); atualizarBadgeNotificacoes(); window.solicitarPermissaoPush();
}

function nav(t) { currentTab = t; localStorage.setItem(LAST_TAB_KEY, t); document.querySelectorAll('.bar-item').forEach(b => b.classList.remove('active')); if(document.getElementById('btn-'+t)) document.getElementById('btn-'+t).classList.add('active');
document.querySelectorAll('.c-sec').forEach(e => { e.style.display='none'; e.classList.remove('active'); }); const activeSec = document.getElementById('cont-'+t); if(activeSec) { activeSec.style.display='block'; activeSec.classList.add('active');
} if(t === 'tempos' || t === 'ranking') populatePublicFilters(t); if(t === 'profile') { updateCardLive(); loadProfileData(); } if(t === 'adm') tryOpenAdmin(true);
else renderContent(t); }

// ==========================================================
// 8. TELA DE PERFIL DO USUÁRIO
// ==========================================================
function loadProfileData() { if(!loggedUser) return; document.getElementById('prof-edit-name').value = loggedUser.nome;
document.getElementById('prof-edit-city').value = loggedUser.city; document.getElementById('prof-edit-cat').value = loggedUser.cat; document.getElementById('prof-edit-team').value = loggedUser.team || ""; document.getElementById('prof-edit-tel').value = loggedUser.tel || ""; document.getElementById('prof-edit-uf').value = loggedUser.uf ||
"PE"; if(document.getElementById('prof-edit-cbc')) document.getElementById('prof-edit-cbc').value = loggedUser.cbc || ""; }

window.salvarFullProfile = function() { if(!loggedUser) return; const team = document.getElementById('prof-edit-team').value.toUpperCase();
const tel = document.getElementById('prof-edit-tel').value; const uf = document.getElementById('prof-edit-uf').value; const cbc = document.getElementById('prof-edit-cbc') ? document.getElementById('prof-edit-cbc').value : "";
const idx = db.users.findIndex(u => u.cpf === loggedUser.cpf); if(idx > -1) { db.users[idx].team = team; db.users[idx].tel = tel;
db.users[idx].uf = uf; db.users[idx].cbc = cbc; loggedUser.team = team; loggedUser.tel = tel; loggedUser.uf = uf; loggedUser.cbc = cbc; saveDB('users'); updateSessionStorage();
toast("DADOS SALVOS!"); updateCardLive(); } };

window.mudarSenhaPerfil = function() { const novaSenha = document.getElementById('prof-new-pass').value;
if(novaSenha.length < 6) return toast("A SENHA DEVE TER NO MÍNIMO 6 DÍGITOS", "error");
const idx = db.users.findIndex(u => cleanCPF(u.cpf) === cleanCPF(loggedUser.cpf)); if(idx > -1) { db.users[idx].adminNewPass = null; db.users[idx].tempPass = null;
db.users[idx].tempPassExp = null; db.users[idx].pass = novaSenha; saveDB('users'); updateSessionStorage(); } toast("SENHA ATUALIZADA COM SUCESSO!"); document.getElementById('prof-new-pass').value = '';
if(auth && auth.currentUser) { auth.currentUser.updatePassword(novaSenha.padEnd(6, '0')).catch(()=>{}); } };

window.uploadSelfie = function(input) { if (input.files && input.files[0]) { toast("PROCESSANDO FOTO... AGUARDE");
compressImage(input.files[0], 400, (base64) => { if(!base64) return toast("ERRO AO PROCESSAR FOTO", "error"); const img = document.getElementById('card-img-display'); if(img) img.src = base64; const fileName = `selfies/piloto_${cleanCPF(loggedUser.cpf)}_${Date.now()}.jpg`; uploadImageToStorage(base64, fileName).then(url => { if(url) { const idx = db.users.findIndex(u => u.cpf === loggedUser.cpf); if(idx > -1) { db.users[idx].selfie = url; loggedUser.selfie = url; saveDB('users'); updateSessionStorage(); } toast("FOTO ATUALIZADA COM SUCESSO!"); input.value = ''; } else toast("ERRO AO SALVAR FOTO NA NUVEM", "error"); }).catch(e => { toast("FALHA DE CONEXÃO AO ENVIAR FOTO", "error"); }); });
} };

function updateCardLive() { if(!loggedUser) return; const setText = (id, val) => { const el = document.getElementById(id);
if(el) el.innerText = val; }; setText('card-name', loggedUser.nome); setText('card-cat', loggedUser.cat); setText('card-city', `${loggedUser.city} - ${loggedUser.uf || 'PE'}`); setText('card-cpf', loggedUser.cpf);
setText('card-team', loggedUser.team || "INDEPENDENTE"); setText('card-cbc', loggedUser.cbc || "NÃO INFORMADA"); const img = document.getElementById('card-img-display'); if(img) { img.crossOrigin = "anonymous";
let picUrl = loggedUser.selfie || "https://via.placeholder.com/80"; img.src = picUrl; } const yearEl = document.getElementById('card-year-display'); if(yearEl) yearEl.innerText = SYSTEM_YEAR;
const isGlobalReleased = db.config.allowAllIDs === true; const isUserReleased = loggedUser.idReleased === true; const layer = document.getElementById('id-locked-layer'); const btn = document.getElementById('btn-dl-card');
if(isGlobalReleased || isUserReleased) { if(layer) layer.style.display = 'none'; if(btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> SALVAR CARTEIRINHA';
btn.style.background = 'var(--pe-blue)'; } } else { if(layer) layer.style.display = 'flex'; if(btn) { btn.disabled = true;
btn.innerHTML = '<i class="fas fa-lock"></i> BLOQUEADO'; btn.style.background = '#999'; } } }

// ==========================================================
// 9. EVENTOS, INSCRIÇÕES E LISTAS DE CONTEÚDO (HOME)
// ==========================================================
window.iniciarInscricao = function(evtId, mode = 'MAIN') {
    if(!loggedUser) return toast("FAÇA LOGIN PARA INSCREVER-SE", "error");
    const evt = db.events.find(e => e.id == evtId); if(!evt) return toast("EVENTO NÃO ENCONTRADO", "error"); if(!loggedUser.inscricoes) loggedUser.inscricoes = [];
    const minhasInscricoes = loggedUser.inscricoes.filter(i => String(i.id) === String(evtId)); if (minhasInscricoes.length >= 3) return toast("MÁXIMO DE 3 INSCRIÇÕES ATINGIDO!", "error");
    
    if(mode === 'EXTRA') { 
        tempEvtIdExtra = evtId; 
        const selectExtra = document.getElementById('extra-sub-cat');
        let catsOptionsHtml = '<option value="">SELECIONE...</option>';
        
        // Mapeia as categorias já inscritas para OMITIR na lista de opções
        const categoriasJaInscritas = minhasInscricoes.map(i => {
            let nomeCat = i.extraCat ? i.extraCat : loggedUser.cat;
            return window.normalizeCatName(nomeCat).replace(" (EXTRA)", "");
        });
        
        if (evt.type === 'NON_OFFICIAL' && evt.extraVals) {
             Object.keys(evt.extraVals).forEach(cName => {
                 let cleanName = cName.replace(" (EXTRA)", "");
                 // Só adiciona a opção se NÃO estiver na lista das que ele já se inscreveu
                 if(!categoriasJaInscritas.includes(cleanName)) {
                     catsOptionsHtml += `<option value="${cName}">${cleanName} - R$ ${evt.extraVals[cName]}</option>`;
                 }
             });
        } else {
             const allowedExtra = ["OPEN", "RÍGIDA", "E-BIKE", "ESTREANTE", "PCD"];
             const activeExtraCats = db.config.categories.filter(c => c.active && allowedExtra.includes(c.name)); 
             
             activeExtraCats.forEach(c => { 
                 let catNormalized = window.normalizeCatName(c.name); 
                 let cleanName = catNormalized.replace(" (EXTRA)", "");
                 
                 // Só adiciona a opção se NÃO estiver na lista das que ele já se inscreveu
                 if(!categoriasJaInscritas.includes(cleanName)) {
                     let precoExtra = (evt.extraVals && evt.extraVals[catNormalized] && evt.extraVals[catNormalized].trim() !== "") ? evt.extraVals[catNormalized] : (evt.val || "0,00"); 
                     catsOptionsHtml += `<option value="${c.name}">${cleanName} - R$ ${precoExtra}</option>`; 
                 }
             });
        }
        
        selectExtra.innerHTML = catsOptionsHtml;
        const listDiv = document.getElementById('extra-existing-list'); 
        const container = document.getElementById('extra-existing-subs'); 
        
        if (minhasInscricoes.length > 0) { 
            container.style.display = 'block';
            listDiv.innerHTML = minhasInscricoes.map(s => { 
                // Padroniza a cor forçando a classe 'badge-cat' (Azul padrão)
                const cClass = "badge-cat"; 
                // Remove o texto "(EXTRA)" ou "(OFICIAL)" da visualização
                let display = s.extraCat ? s.extraCat : loggedUser.cat;
                display = display.replace(" (EXTRA)", "").replace(" (OFICIAL)", ""); 
                
                const statusHtml = s.status === 'PENDENTE' ? `<button class="btn-mini-adm btn-jump" style="background:orange; color:white; font-weight:bold; box-shadow:0 2px 4px rgba(0,0,0,0.2); margin-left:10px; cursor:pointer;" onclick="fecharModal('modal-extra-sub'); iniciarInscricao(${evtId}, '${s.extraCat ? s.extraCat : 'MAIN'}')"><i class="fas fa-qrcode"></i> PAGAR INSCRIÇÃO</button>` : `<i class="fas fa-check-circle" style="color:green; margin-left:10px;"></i>`; 
                
                return `<div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #ddd; padding-bottom:5px;"><span class="${cClass}">${display}</span> ${statusHtml}</div>`; 
            }).join('');
        } else { 
            container.style.display = 'none'; 
        } 
        openModal('modal-extra-sub'); 
        return;
    }
    
    if (mode === 'MAIN') { 
        const freshUser = db.users.find(u => u.cpf === loggedUser.cpf);
        const liberacaoGlobal = (db.config.allowAllIDs === true); 
        const liberacaoUsuario = (freshUser && freshUser.idReleased === true);
        const jaInscritoOficial = loggedUser.inscricoes.some(i => String(i.id) === String(evtId) && !i.extraCat); 
        if (!liberacaoGlobal && !liberacaoUsuario && !jaInscritoOficial) { 
            tempEvtIdExtra = evtId;
            openModal('modal-lock-alert'); 
            return; 
        } 
    }
    
    let inscExistente = mode === 'MAIN' ? minhasInscricoes.find(i => !i.extraCat) : minhasInscricoes.find(i => window.normalizeCatName(i.extraCat) === window.normalizeCatName(mode)); 
    if (inscExistente) { abrirModalPagamento(evt, inscExistente); return; }
    currentInscricaoPendente = { id: evtId, status: 'PENDENTE', date: new Date().toISOString(), extraCat: mode === 'MAIN' ? null : mode }; 
    abrirModalPagamento(evt, currentInscricaoPendente);
};

window.confirmarInscricaoExtra = function() { const catEscolhida = document.getElementById('extra-sub-cat').value;
if(!catEscolhida) return toast("SELECIONE A CATEGORIA!", "error"); const jaTem = loggedUser.inscricoes.some(i => String(i.id) === String(tempEvtIdExtra) && window.normalizeCatName(i.extraCat) === window.normalizeCatName(catEscolhida));
if(jaTem) return toast("VOCÊ JÁ ESTÁ NESSA CATEGORIA!", "error"); currentInscricaoPendente = { id: tempEvtIdExtra, status: 'PENDENTE', date: new Date().toISOString(), extraCat: window.normalizeCatName(catEscolhida) };
fecharModal('modal-extra-sub'); const evt = db.events.find(e => e.id == tempEvtIdExtra); abrirModalPagamento(evt, currentInscricaoPendente); };
window.abrirModalPagamento = function(evt, inscPendente) { 
    currentPayId = {id: parseInt(evt.id), name: evt.t}; 
    let finalPrice = evt.val ||
    "0,00";
    
    if (evt.type === 'NON_OFFICIAL') {
        const catNormalized = inscPendente && inscPendente.extraCat ?
        window.normalizeCatName(inscPendente.extraCat) : window.normalizeCatName(loggedUser.cat);
        const cleanCat = catNormalized.replace(" (EXTRA)", ""); 
        
        if (evt.extraVals && evt.extraVals[catNormalized] && evt.extraVals[catNormalized].trim() !== "") { 
            finalPrice = evt.extraVals[catNormalized];
        } else if (evt.extraVals && evt.extraVals[cleanCat] && evt.extraVals[cleanCat].trim() !== "") {
            finalPrice = evt.extraVals[cleanCat];
        }
    } else {
        if (inscPendente && inscPendente.extraCat && evt.extraVals) { 
            const catNormalized = window.normalizeCatName(inscPendente.extraCat);
            if (evt.extraVals[catNormalized] && evt.extraVals[catNormalized].trim() !== "") { 
                finalPrice = evt.extraVals[catNormalized];
            } 
        }
    }
    
    const valorEl = document.getElementById('pix-valor-display');
    const pixEl = document.getElementById('pix-copy'); 
    if(valorEl) valorEl.innerText = "R$ " + finalPrice; 
    if(pixEl) pixEl.innerText = evt.pix || "Chave não cadastrada"; 
    openModal('modal-pix');
};

window.confirmarInscricaoPendente = function() {
    if(!currentPayId) return toast("Erro no evento", "error");
    if(currentInscricaoPendente) { 
        loggedUser.inscricoes.push(currentInscricaoPendente); 
        const idx = db.users.findIndex(u => u.cpf === loggedUser.cpf);
        if(idx > -1) { saveDB('users'); } 
        updateSessionStorage(); 
        const catName = currentInscricaoPendente.extraCat ? currentInscricaoPendente.extraCat : loggedUser.cat; 
        
        // Notificação Interna (Sininho)
        window.enviarNotificacao(`Nova Inscrição Pendente: ${loggedUser.nome} - Etapa: ${currentPayId.name} (${catName})`, 'ADMIN', null, currentPayId.id);
        window.enviarNotificacao(`Nova Inscrição Pendente: ${loggedUser.nome} - Etapa: ${currentPayId.name} (${catName})`, 'ORGANIZER', null, currentPayId.id); 
        
        // Notificação Push (Celular)
        window.dispararPushParaEquipe(currentPayId.id, "Nova Inscrição! 🚴‍♂️", `${loggedUser.nome} se inscreveu em ${currentPayId.name} (${catName}).`);
        
        currentInscricaoPendente = null; 
        renderContent('calendar'); 
        toast("INSCRIÇÃO REGISTRADA COMO PENDENTE!");
    } else { 
        toast("Sua inscrição já foi registrada.", "info"); 
    } 
    fecharModal('modal-pix'); 
};
window.enviarComprovanteWhatsApp = function(){ 
    if(!currentPayId) return toast("Erro no evento", "error");
    if(currentInscricaoPendente) { 
        loggedUser.inscricoes.push(currentInscricaoPendente); 
        const idx = db.users.findIndex(u => u.cpf === loggedUser.cpf);
        if(idx > -1) { saveDB('users'); } 
        updateSessionStorage(); 
        const catName = currentInscricaoPendente.extraCat ? currentInscricaoPendente.extraCat : loggedUser.cat; 
        
        // Notificação Interna (Sininho)
        window.enviarNotificacao(`Nova Inscrição Pendente: ${loggedUser.nome} - Etapa: ${currentPayId.name} (${catName})`, 'ADMIN', null, currentPayId.id);
        window.enviarNotificacao(`Nova Inscrição Pendente: ${loggedUser.nome} - Etapa: ${currentPayId.name} (${catName})`, 'ORGANIZER', null, currentPayId.id); 
        
        // Notificação Push (Celular)
        window.dispararPushParaEquipe(currentPayId.id, "Comprovante Enviado! 🧾", `${loggedUser.nome} enviou comprovante para ${currentPayId.name} (${catName}).`);
        
        currentInscricaoPendente = null; 
        renderContent('calendar');
    }
    const evt = db.events.find(e => e.id == currentPayId.id); 
    const phone = (evt && evt.wpp) ? evt.wpp : db.config.phone; 
    const msg = `Olá!\nRealizei o pagamento da inscrição.\n\n*Atleta:* ${loggedUser.nome}\n*Evento:* ${currentPayId.name}\n\nSegue o comprovante:`; 
    openWhatsApp(phone, msg); 
    fecharModal('modal-pix'); 
};
window.verDetalhesEvento = function(id) { 
    const e = db.events.find(x => String(x.id) === String(id)); if(!e) return;
    document.getElementById('det-evt-title').innerText = e.t; document.getElementById('det-evt-info').innerText = `${e.d} | ${e.city}`; document.getElementById('det-evt-img').src = e.img || ""; const ptsDiv = document.getElementById('det-evt-points');
    if(ptsDiv) { let html = ""; if(e.points) { html += `<div style="grid-column:span 5; font-size:10px; font-weight:bold; margin-bottom:5px; color:#15803d; border-bottom:1px solid #ddd;">PONTUAÇÃO CORRIDA</div>`;
    html += e.points.map((p, i) => `<div style="background:#f0fdf4; padding:5px; text-align:center; font-size:10px; border-radius:4px; border:1px solid #bbf7d0;"><b>${i+1}º</b><br>${p}</div>`).join('');
    } if(e.hasQualify && e.qPoints) { html += `<div style="grid-column:span 5; font-size:10px; font-weight:bold; margin-top:10px; margin-bottom:5px; color:#d65a00; border-bottom:1px solid #ddd;">PONTUAÇÃO QUALIFY</div>`;
    html += e.qPoints.map((p, i) => `<div style="background:#fff7ed; padding:5px; text-align:center; font-size:10px; border-radius:4px; border:1px solid #fed7aa;"><b>${i+1}º</b><br>${p}</div>`).join(''); } ptsDiv.innerHTML = html;
    } const galDiv = document.getElementById('det-evt-gallery-area'); const galScroll = document.getElementById('det-evt-gallery-scroll'); if(galDiv && galScroll) { if(e.gallery && e.gallery.length > 0) { galDiv.style.display = 'block';
    currentGalleryList = e.gallery; galScroll.innerHTML = e.gallery.map((img, idx) => `<img src="${img}" class="gallery-scroll-item" onclick="openGalleryViewer(${idx})">`).join(''); } else { galDiv.style.display = 'none';
    } } openModal('modal-event-details'); 
};

window.verGaleriaEvento = function(id) { const e = db.events.find(x => String(x.id) === String(id)); if(!e) return;
let fotos = []; if(e.img) fotos.push(e.img); if(e.gallery && e.gallery.length > 0) fotos = fotos.concat(e.gallery);
if(fotos.length === 0) return toast("Nenhuma foto disponível para este evento.", "error"); currentGalleryList = fotos; openGalleryViewer(0); };
window.openGalleryViewer = function(index) { currentGalleryIndex = index; const img = document.getElementById('gallery-main-img'); const counter = document.getElementById('gallery-counter'); if(img) img.src = currentGalleryList[index];
if(counter) counter.innerText = `${index + 1} / ${currentGalleryList.length}`; openModal('modal-gallery-view'); };
window.navGallery = function(direction) { let newIndex = currentGalleryIndex + direction;
if(newIndex < 0) newIndex = currentGalleryList.length - 1; if(newIndex >= currentGalleryList.length) newIndex = 0; openGalleryViewer(newIndex); };
window.abrirTicket = function(evtId) { const e = db.events.find(x => String(x.id) === String(evtId)); if(!e || !loggedUser) return; document.getElementById('share-event-name').innerText = e.t;
document.getElementById('share-event-details').innerText = `${e.d} | ${e.city}`; document.getElementById('share-piloto-name').innerText = loggedUser.nome; document.getElementById('share-piloto-details').innerText = `${loggedUser.cat} • ${loggedUser.city}`; document.getElementById('ticket-year-display').innerText = SYSTEM_YEAR; openModal('modal-share'); };
window.verOrdemLargada = function() {
    if (!loggedUser) return toast("Faça login", "error"); const listDiv = document.getElementById('ordem-largada-list'); if (!listDiv) return;
    listDiv.innerHTML = '';
    if (!loggedUser.inscricoes || loggedUser.inscricoes.length === 0) { listDiv.innerHTML = '<div style="padding:15px; color:#666; text-align:center;">Você não possui inscrições.</div>'; openModal('modal-ordem-largada');
    return; }
    let hasConfirmed = false;
    loggedUser.inscricoes.forEach(insc => {
        if (insc.status !== 'CONFIRMADO') return;
        const evt = db.events.find(e => String(e.id) === String(insc.id)); 
        if (!evt || evt.status === 'CLOSED' || evt.status === 'CANCELLED') return; 
        hasConfirmed = true;
        const catToSearch = window.normalizeCatName(insc.extraCat || loggedUser.cat);
        let isReleased = false; if (evt.startListDate) { const releaseDate = new Date(evt.startListDate); const now = new Date(); if (now >= releaseDate) isReleased = true; }
        if (!isReleased) { listDiv.innerHTML += `<div style="background:#fff8e1; border:1px solid #ffe082; padding:10px; border-radius:8px; margin-bottom:10px;"><b style="color:var(--pe-blue); font-size:12px;">${evt.t}</b><br><span class="badge-cat" style="margin-top:5px;">${catToSearch}</span><br><div style="color:#d65a00; font-size:11px; font-weight:bold; margin-top:8px;"><i class="fas fa-clock"></i> Lista será revelada em:<br>${evt.startListDate ? new Date(evt.startListDate).toLocaleString('pt-BR') : 'Data não definida'}</div></div>`; return; }
        let competitors = [];
        db.users.forEach(u => { if (u.inscricoes) { const uInsc = u.inscricoes.find(i => String(i.id) === String(evt.id) && window.normalizeCatName(i.extraCat || u.cat) === catToSearch && i.status === 'CONFIRMADO'); if (uInsc) { competitors.push({ cpf: u.cpf, name: u.nome, city: u.city, uf: u.uf || 'PE', date: new Date(uInsc.date || 0).getTime() }); } } });
        competitors.sort((a, b) => a.date - b.date);
        let listHtml = `<div style="background:white; border:1px solid #ddd; border-radius:8px; overflow:hidden; margin-bottom:15px;"><div style="background:var(--pe-blue); color:white; padding:10px; font-weight:bold; font-size:12px; text-align:center;">${evt.t}<br><span style="font-size:10px; color:#ffe500; font-weight:900;">${catToSearch}</span></div>`;
        competitors.forEach((c, index) => { const isMe = c.cpf === loggedUser.cpf; const bgColor = isMe ? '#fffbeb' : (index % 2 === 0 ? '#f8fafc' : 'white'); const borderColor = isMe ? 'border-left: 4px solid var(--pe-yellow);' : ''; const nameColor = isMe ? 'var(--pe-blue)' : '#333'; const meBadge = isMe ? `<span style="background:var(--pe-yellow); color:black; font-size:8px; padding:2px 5px; border-radius:4px; font-weight:900; margin-left:5px;">VOCÊ</span>` : ''; listHtml += `<div style="padding:10px; border-bottom:1px solid #eee; background:${bgColor}; display:flex; align-items:center; ${borderColor}"><div style="width:30px; font-size:14px; font-weight:900; color:#64748b; text-align:center;">${index + 1}º</div><div style="flex:1; padding-left:10px;"><div style="font-size:12px; font-weight:bold; color:${nameColor};">${c.name} ${meBadge}</div><div style="font-size:9px; color:#94a3b8; margin-top:2px;">${c.city}-${c.uf}</div></div></div>`; });
        listHtml += `</div>`; listDiv.innerHTML += listHtml;
    });
    if (!hasConfirmed) { listDiv.innerHTML = '<div style="padding:15px; color:#666; text-align:center;">Você não possui inscrições CONFIRMADAS para visualizar a ordem.</div>';
    }
    openModal('modal-ordem-largada');
};

window.renderPilotHistoryModal = function(cpf, name) {
    const histDiv = document.getElementById('my-history-list'); if(!histDiv) return;
    openModal('modal-history'); const titleEl = document.querySelector('#modal-history h3'); if(titleEl) titleEl.innerText = `HISTÓRICO: ${name}`; const user = db.users.find(u => u.cpf === cpf);
    let html = "";
    if(user && user.inscricoes && user.inscricoes.length > 0) { html += `<div style="background:#f0f9ff; padding:8px; border-radius:5px; margin-bottom:10px;"><b style="color:#0038a8; font-size:12px;">INSCRIÇÕES</b>`;
    user.inscricoes.forEach(i => { const evt = db.events.find(e => String(e.id) === String(i.id)); const evtName = evt ? evt.t : "Evento " + i.id; const extra = i.extraCat ? `(${i.extraCat})` : '<span style="color:#0038a8; font-weight:bold; font-size:10px; background:#e0e7ff; padding:2px 4px; border-radius:4px;">(CATEGORIA OFICIAL)</span>'; html += `<div style="font-size:11px; margin-top:5px; border-bottom:1px solid #dee;">${evtName} ${extra} <span style="float:right">${i.status}</span></div>`; });
    html += `</div>`; }
    const times = db.tempos.filter(t => t.cpf === cpf);
    if(times.length > 0) { html += `<div style="background:#f0fdf4; padding:8px; border-radius:5px;"><b style="color:#15803d; font-size:12px;">TEMPOS</b>`;
    times.forEach(t => { const evt = db.events.find(e => String(e.id) === String(t.evtId)); let evtCity = evt && evt.city ? evt.city : "Cidade não informada"; let typeBadge = ""; if(t.runType === 'qualify') typeBadge = `<span style="background:#E6E6FA; color:#4B0082; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:9px;">QUALIFY</span>`; else if(t.runType === '2nd') typeBadge = `<span style="background:#fff3e0; color:#d65a00; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:9px;">2ª DESCIDA</span>`; else typeBadge = `<span style="background:#dcfce7; color:#166534; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:9px;">OFICIAL</span>`; let clockHtml = t.startClock ? `<div style="font-size:9px; color:#059669; font-weight:bold; margin-top:2px;"><i class="fas fa-flag-checkered"></i> Largada: ${t.startClock}</div>` : ''; html += `<div style="font-size:11px; margin-top:5px; border-bottom:1px solid #dee; display:flex; justify-content:space-between; align-items:center;"><div><span>${evt ? evt.t : t.evtId}</span><br><div style="font-size:9px; color:#666; margin-top:2px;"><i class="fas fa-map-marker-alt"></i> ${evtCity}</div><div style="display:flex; gap:5px; align-items:center; margin-top:2px;">${typeBadge}<span style="font-size:10px; color:#333; font-weight:bold;">${t.cat}</span></div>${clockHtml}</div><b style="font-family:monospace">${t.val}</b></div>`; });
    html += `</div>`; }
    if(html === "") html = "<div style='text-align:center; color:#999; padding:20px'>Nenhum registro.</div>"; histDiv.innerHTML = html;
};

// ==========================================================
// FUNÇÃO PARA PREENCHER OS FILTROS PÚBLICOS (TEMPOS E RANKING)
// ==========================================================
window.populatePublicFilters = function(tab) {
    if (!db) return;
    const selEvt = document.getElementById('filter-evt-' + tab);
    let currentEvtId = 'ALL';
    if (selEvt) {
        currentEvtId = selEvt.value;
        let evtHtml = tab === 'ranking' ? '<option value="ALL">GERAL (SOMA)</option>' : '<option value="ALL">TODAS AS ETAPAS</option>';
        
        if (db.events && db.events.length > 0) {
            db.events.forEach(e => {
                if (e.status !== 'CANCELLED') {
                    evtHtml += `<option value="${e.id}">${e.t}</option>`;
                }
            });
        }
        selEvt.innerHTML = evtHtml;
        if (currentEvtId && selEvt.querySelector(`option[value="${currentEvtId}"]`)) {
            selEvt.value = currentEvtId;
        } else {
            currentEvtId = 'ALL';
            selEvt.value = 'ALL';
        }
    }

    const selCat = document.getElementById('filter-cat-' + tab);
    if (selCat) {
        const currentCat = selCat.value;
        // ---> TEXTO ALTERADO AQUI <---
        let catHtml = '<option value="ALL">GERAL / MELHOR TEMPO DA PISTA</option>';
        catHtml += '<option value="ALL_SEP">TODAS (SEPARADAS POR CAT)</option>';
        
        let catsToShow = [];
        if (currentEvtId !== 'ALL') {
            const evtObj = db.events.find(e => String(e.id) === String(currentEvtId));
            if (evtObj && evtObj.type === 'NON_OFFICIAL' && evtObj.extraVals) {
                catsToShow = Object.keys(evtObj.extraVals).filter(k => evtObj.extraVals[k] && String(evtObj.extraVals[k]).trim() !== "");
                catsToShow.sort((a,b) => a.localeCompare(b));
            }
        }
        
        if (catsToShow.length === 0 && db.config && db.config.categories) {
            catsToShow = db.config.categories.filter(c => c.active).map(c => c.name).sort((a,b) => a.localeCompare(b));
        }
        
        catsToShow.forEach(c => {
            catHtml += `<option value="${c}">${c}</option>`;
        });
        selCat.innerHTML = catHtml;
        if (currentCat && selCat.querySelector(`option[value="${currentCat}"]`)) {
            selCat.value = currentCat;
        }
    }
};

function renderContent(t) { 
    if(t === 'calendar') { 
        document.getElementById('lbl-cal-year').innerText = SYSTEM_YEAR;
        const hD = document.getElementById('calendar-highlight'); const oD = document.getElementById('calendar-others'); const pD = document.getElementById('calendar-past-bar');
        if(!db.events || db.events.length === 0) { hD.innerHTML = '<div style="padding:20px;text-align:center">Nenhum evento cadastrado.</div>'; oD.innerHTML = ''; pD.style.display = 'none'; return; } 
        
        const activeEvents = db.events.filter(e => e.status === 'OPEN');
        const inactiveEvents = db.events.filter(e => e.status === 'CLOSED' || e.status === 'CANCELLED' || e.status === 'POSTPONED');
        const monthMap = { "JAN":1, "FEV":2, "MAR":3, "ABR":4, "MAI":5, "JUN":6, "JUL":7, "AGO":8, "SET":9, "OUT":10, "NOV":11, "DEZ":12 };
        activeEvents.sort((a,b) => { const mA = monthMap[a.m] || 99; const mB = monthMap[b.m] || 99; if (mA !== mB) return mA - mB; const dayA = parseInt((a.d || "0").split('/')[0], 10) || 0; const dayB = parseInt((b.d || "0").split('/')[0], 10) || 0; return dayA - dayB; });
        if(inactiveEvents.length > 0) { 
            pD.style.display = 'flex';
            pD.innerHTML = inactiveEvents.map(e => { 
                if(e.status === 'CLOSED') {
                    return `<div class="past-event-chip" style="background:var(--pe-green); color:white; border:none; cursor:pointer; min-width:160px; box-shadow:0 4px 6px rgba(0,0,0,0.2); transition:transform 0.2s;" onclick="verGaleriaEvento(${e.id})" onmousedown="this.style.transform='scale(0.95)'" onmouseup="this.style.transform='scale(1)'"><b style="color:var(--pe-yellow); font-size:11px; display:block; margin-bottom:2px;"><i class="fas fa-check-circle"></i> CONCLUÍDO</b><span style="font-weight:900; font-size:12px; display:block; white-space:normal; line-height:1.1;">${e.t}</span><span style="font-size:9px; opacity:0.9;">${e.d} ${e.m}</span><div style="font-size:9px; background:rgba(0,0,0,0.2); padding:4px; border-radius:4px; margin-top:5px; font-weight:bold;"><i class="fas fa-images"></i> VER ÁLBUM</div></div>`;
                } else {
                    let stTxt = e.status === 'CANCELLED' ? 'CANCELADO' : 'ADIADO'; let stColor = e.status === 'CANCELLED' ? 'red' : '#d65a00'; 
                    return `<div class="past-event-chip chip-closed"><b style="color:${stColor}">${stTxt}</b><br>${e.t}</div>`;
                }
            }).join('');
        } else { pD.style.display = 'none'; }
        
       const renderEvtCard = (e, isHighlight) => {
            let qualifyInfo = '';
            if (e.hasQualify && e.qDate) { const qDateDisplay = e.qDate.split('-').reverse().join('/'); qualifyInfo = `<div style="margin-top:5px; font-size:10px; color:#d65a00; font-weight:bold; background:#fff3e0; padding:4px; border-radius:4px; border:1px solid #ffe0b2;"><i class="fas fa-stopwatch"></i> QUALIFY: ${qDateDisplay} às ${e.qTime || '??:??'}</div>`; }
            const limitDate = e.closeDate ? e.closeDate.split('-').reverse().join('/') : '---'; const subs = (loggedUser && loggedUser.inscricoes) ? loggedUser.inscricoes.filter(i => String(i.id) === String(e.id)) : [];
            const count = subs.length; const btnBaseStyle = "margin:0; width:100%; padding:10px 4px; font-weight:900; font-size:11px; white-space:normal; line-height:1.2; display:flex; align-items:center; justify-content:center; text-align:center;";
            let extraBtnHtml = (count < 3) ? `<button class="btn" style="${btnBaseStyle} background:var(--pe-yellow); color:black; border:1px solid #e6c200" onclick="window.iniciarInscricao(${e.id}, 'EXTRA')">INSCRIÇÕES NÃO OFICIAIS (+)</button>` : '';
            let viewBtnHtml = `<button class="btn" style="${btnBaseStyle} background:#1e293b;" onclick="window.verDetalhesEvento(${e.id})">VER DETALHES</button>`; 
            let mainBtnHtml = '';
            if (e.type === 'NON_OFFICIAL') {
                if(count < 3) mainBtnHtml = `<button class="btn" style="${btnBaseStyle} background:var(--pe-blue);" onclick="window.iniciarInscricao(${e.id}, 'EXTRA')">INSCRIÇÃO NO EVENTO</button>`;
                extraBtnHtml = '';
            } else {
                const oficialInsc = subs.find(i => !i.extraCat);
                if (!oficialInsc) { mainBtnHtml = `<button class="btn" style="${btnBaseStyle} background:var(--pe-blue);" onclick="window.iniciarInscricao(${e.id}, 'MAIN')">INSCRIÇÃO OFICIAL</button>`; } 
                else { if (oficialInsc.status === 'PENDENTE') mainBtnHtml = `<button class="btn" style="${btnBaseStyle} background:orange;" onclick="window.iniciarInscricao(${e.id}, 'MAIN')">PENDENTE / PAGAR</button>`; else if (oficialInsc.status === 'CONFIRMADO') mainBtnHtml = `<button class="btn" style="${btnBaseStyle} background:green;" onclick="window.abrirTicket(${e.id})">COMPROVANTE DE INSCRIÇÃO</button>`; }
            }

            let imgHtml = e.img ? `<img src="${e.img}" class="evt-img-standard">` : `<div class="evt-img-placeholder">SEM FOTO</div>`; let html = `${getBadgeHtml(e)}${imgHtml}<div class="event-body">`;
            let wppBtn = e.wpp ? `<button onclick="openWhatsApp('${e.wpp}', 'Dúvida ${e.t}')" style="border:none; background:none; color:#25D366; font-size:18px; cursor:pointer;"><i class="fab fa-whatsapp"></i></button>` : '';
            if(isHighlight) { html += `<div style="display:flex; justify-content:space-between; align-items:center"><div style="font-size:14px; font-weight:900; color:var(--pe-blue)">${e.t}</div>${wppBtn}</div>`; } else { html += `<div style="display:flex; justify-content:space-between; align-items:flex-start"><b style="line-height:1.2;">${e.t}</b>${wppBtn}</div>`; }
            
            let priceHtml = `R$ ${e.val || "0,00"}`;
            
            if (e.type === 'NON_OFFICIAL' && e.extraVals) {
                let validPrices = [];
                let hasIniciante = null;
                let firstValidCat = null;
                
                Object.keys(e.extraVals).forEach(cat => {
                    let v = e.extraVals[cat];
                    if (v && v.trim() !== '') {
                        validPrices.push(v);
                        if (!firstValidCat) firstValidCat = cat;
                        if (cat === 'INICIANTE' || cat === 'INICIANTE (EXTRA)') hasIniciante = v;
                    }
                });
                if (validPrices.length > 0) {
                    let allSame = validPrices.every(v => v === validPrices[0]);
                    if (allSame) {
                        priceHtml = `R$ ${validPrices[0]}`;
                    } else {
                        if (hasIniciante) {
                            priceHtml = `Ex: Iniciante R$ ${hasIniciante}`;
                        } else {
                            let displayCat = firstValidCat.charAt(0).toUpperCase() + firstValidCat.slice(1).toLowerCase();
                            priceHtml = `Ex: ${displayCat} R$ ${validPrices[0]}`;
                        }
                    }
                }
            }
            
            html += `<span style="font-size:12px; color:#666">${e.d} ${e.m} | ${e.city}</span>${qualifyInfo}<div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;"><div class="event-price">${priceHtml}</div><div style="font-size:9px; color:#d50000; font-weight:bold;">INSCRIÇÕES ENCERRAM: ${limitDate}</div></div><div style="display:flex; flex-direction:column; gap:5px; margin-top:10px; width:100%;">${mainBtnHtml}${extraBtnHtml}${viewBtnHtml}</div></div>`;
            return html;
        };
        const h = activeEvents.length > 0 ? activeEvents[0] : null;
        if (h) { hD.innerHTML = `<div class="highlight-event">${renderEvtCard(h, true)}</div>`;
        oD.innerHTML = activeEvents.filter(e => e.id !== h.id).map(e => `<div class="event-card">${renderEvtCard(e, false)}</div>`).join('');
        } else { hD.innerHTML = '<div style="text-align:center; padding:20px; color:#666">Sem eventos abertos.</div>'; oD.innerHTML = ''; }
    } else if (t === 'tempos') {
         const listDiv = document.getElementById('list-'+t);
         if(listDiv) {
             populatePublicFilters(t);
             const fEvt = document.getElementById('filter-evt-'+t).value;
             const fCat = document.getElementById('filter-cat-'+t).value; const fType = document.getElementById('filter-type-tempos').value; const fRegion = document.getElementById('filter-region-tempos').value;
             let allTimes = db.tempos || [];
             if (fEvt && fEvt !== 'ALL') allTimes = allTimes.filter(i => String(i.evtId) === String(fEvt));
             if (fCat && fCat !== 'ALL' && fCat !== 'ALL_SEP') allTimes = allTimes.filter(i => window.normalizeCatName(i.cat) === window.normalizeCatName(fCat));
             if (fRegion === 'PE') allTimes = allTimes.filter(t => { const u = db.users.find(user => user.cpf === t.cpf); return u && (u.uf === 'PE' || !u.uf || u.filiadoPE === true); });
             const grouped = {};
             allTimes.forEach(t => { const key = t.cpf + '_' + t.cat + '_' + t.evtId; if(!grouped[key]) { const evtObj = db.events.find(e => String(e.id) === String(t.evtId)); grouped[key] = { cpf: t.cpf, name: t.name, city: t.city, cat: t.cat, evtName: evtObj ? evtObj.t : "ETAPA", q: '--:--.---', o: '--:--.---', s: '--:--.---' }; } if(t.runType === 'qualify') grouped[key].q = t.val; else if(t.runType === '2nd') grouped[key].s = t.val; else grouped[key].o = t.val; });
             let sortedList = Object.values(grouped);
             
             if(fType !== 'ALL') { 
                 sortedList = sortedList.filter(item => { if(fType === 'qualify') return item.q !== '--:--.---'; if(fType === '1st') return item.o !== '--:--.---'; if(fType === '2nd') return item.s !== '--:--.---'; return true; });
                 sortedList.sort((a,b) => { 
                     if (fCat === 'ALL_SEP' && a.cat !== b.cat) return a.cat.localeCompare(b.cat);
                     let tA = (fType === 'qualify') ? a.q : (fType === '1st' ? a.o : a.s); 
                     let tB = (fType === 'qualify') ? b.q : (fType === '1st' ? b.o : b.s); 
                     return tA.localeCompare(tB); 
                 });
             } else { 
                 sortedList.sort((a,b) => { 
                     if (fCat === 'ALL_SEP' && a.cat !== b.cat) return a.cat.localeCompare(b.cat);
                     const tA = a.o !== '--:--.---' ? a.o : (a.q !== '--:--.---' ? a.q : a.s); 
                     const tB = b.o !== '--:--.---' ? b.o : (b.q !== '--:--.---' ? b.q : b.s); 
                     return tA.localeCompare(tB); 
                 });
             }
             
             let temposLideres = {};
             sortedList.forEach(item => {
                 let tA = (fType === 'qualify') ? item.q : (fType === '1st' ? item.o : (fType === '2nd' ? item.s : (item.o !== '--:--.---' ? item.o : (item.q !== '--:--.---' ? item.q : item.s))));
                 let ms = tempoParaMilissegundos(tA);
                 let catKey = fCat === 'ALL_SEP' ? item.cat : 'GERAL';
                 if (!temposLideres[catKey] || ms < temposLideres[catKey]) temposLideres[catKey] = ms;
             });
             const evtObjH = db.events.find(e => String(e.id) === String(fEvt)); const evtNameHeader = fEvt === 'ALL' ? 'TODAS AS ETAPAS' : (evtObjH ? evtObjH.t : 'ETAPA'); const catNameHeader = fCat === 'ALL' ? 'MELHORES DA PISTA' : (fCat === 'ALL_SEP' ? 'GERAL SEPARADA (POR CATEGORIA)' : fCat);
             const regionNameHeader = fRegion === 'PE' ? 'RESULTADO PERNAMBUCO' : 'RESULTADO NORDESTE (OPEN)'; const typeNameHeader = fType === 'ALL' ? 'GERAL (TODAS AS DESCIDAS)' : (fType === 'qualify' ? 'QUALIFY' : (fType === '1st' ? '1ª DESCIDA (OFICIAL)' : '2ª DESCIDA'));
             const headerTag = `<div class="print-header" style="background: linear-gradient(135deg, var(--pe-blue), #1e3a8a); color: white; padding: 15px; border-radius: 8px; margin-bottom: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center;"><h2 style="margin: 0; font-size: 18px; font-weight: 900; text-transform: uppercase;">RESULTADOS OFICIAIS</h2><div style="font-size: 11px; margin-top: 5px; opacity: 0.9; font-weight: bold;"><i class="fas fa-map-marker-alt"></i> ${regionNameHeader} &nbsp;|&nbsp; <i class="fas fa-bicycle"></i> ${catNameHeader}</div><div style="font-size: 11px; margin-top: 5px; opacity: 0.9; font-weight: bold;"><i class="fas fa-stopwatch"></i> ${typeNameHeader}</div><div style="font-size: 12px; margin-top: 5px; color: #ffe500; font-weight: bold;">${evtNameHeader}</div></div>`;
             if(sortedList.length === 0) listDiv.innerHTML = headerTag + '<div style="padding:20px; text-align:center; color:#999; font-size:11px">Nenhum resultado para os filtros selecionados.</div>';
             else {
                 const has2nd = sortedList.some(item => item.s && item.s !== '--:--.---');
                 const listHtml = sortedList.map((r, i) => {
                     let pNameFull = getPilotName(r.cpf, r.name); let _pts = pNameFull.split(' '); let _lim = ['DE','DA','DO','DOS','DAS'].includes(_pts[1]) ? 3 : 2; const pName = _pts.slice(0, _lim).join(' '); const pCityUF = getPilotCityUF(r.cpf, r.city); const cClass = getCatClass(r.cat); let columnsHtml = '';
                     const evtTag = `<div style="font-size:9px; color:var(--pe-blue); font-weight:900; margin-bottom:2px; text-transform:uppercase;"><i class="fas fa-flag-checkered"></i> ETAPA: ${r.evtName}</div>`;
                     
                     let catHeader = '';
                     let posDisplay = (i + 1) + 'º';
                     if (fCat === 'ALL_SEP') {
                         if (i === 0 || sortedList[i-1].cat !== r.cat) {
                             let closeTag = i > 0 ? '</div></div>' : '';
                             catHeader = `${closeTag}<div class="cat-print-page" style="margin-bottom: 30px; border: 2px solid var(--pe-blue); border-radius: 8px; background: #fff; overflow: hidden; page-break-inside: avoid; break-inside: avoid;"><div class="cat-title-box" style="background: var(--pe-blue); color: white; padding: 10px; font-size: 16px; font-weight: 900; text-align: center; text-transform: uppercase; letter-spacing: 1px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">🏆 ${r.cat}</div><div style="padding: 10px; display: flex; flex-direction: column; gap: 8px;">`;
                         }
                         let catIndex = 0;
                         for (let j = 0; j < i; j++) { if (sortedList[j].cat === r.cat) catIndex++; }
                         posDisplay = (catIndex + 1) + 'º';
                     }
                     
                     let tA = (fType === 'qualify') ? r.q : (fType === '1st' ? r.o : (fType === '2nd' ? r.s : (r.o !== '--:--.---' ? r.o : (r.q !== '--:--.---' ? r.q : r.s))));
                     let msAtleta = tempoParaMilissegundos(tA);
                     let catKey = fCat === 'ALL_SEP' ? r.cat : 'GERAL';
                     
                     let gapStr = (msAtleta !== Infinity && msAtleta > temposLideres[catKey]) ? formatarDiferenca(msAtleta - temposLideres[catKey]) : '';
                     let gapHtml = gapStr ? `<div style="font-size:10px; color:#e11d48; font-weight:bold; margin-top:2px; text-align:center;">${gapStr}</div>` : '';

                     const getTpl = (val, pen) => { let vHTML = val === 'DNF' ? '<span style="color:red">DNF</span>' : val; let pHTML = pen ? `<span style="color:red; font-size:8px; display:block;">(${pen})</span>` : ''; return `${vHTML}${pHTML}`; };
                     if(fType === 'ALL') { 
                         let gridCols = has2nd ? '1fr 1fr 1fr' : '1fr 1fr';
                         let secondRunHtml = has2nd ? `<div style="padding:5px; text-align:center; background:#ffe5b4;"><div style="font-size:8px; color:#d65a00; font-weight:bold">2ª DESCIDA</div><div style="font-family:monospace; font-size:11px; color:#333">${getTpl(r.s, r.sPen)}</div></div>` : '';
                         columnsHtml = `<div style="display:grid; grid-template-columns: ${gridCols}; width:100%; border-top:1px dashed #eee;"><div style="padding:5px; text-align:center; border-right:1px solid #eee; background:#E6E6FA;"><div style="font-size:8px; color:#4B0082; font-weight:bold">QUALIFY</div><div style="font-family:monospace; font-size:11px; color:#333">${getTpl(r.q, r.qPen)}</div></div><div style="padding:5px; text-align:center; ${has2nd ? 'border-right:1px solid #eee;' : ''} background:#d4edda;"><div style="font-size:8px; color:#15803d; font-weight:bold">OFICIAL</div><div style="font-family:monospace; font-size:12px; font-weight:bold; color:#000">${getTpl(r.o, r.oPen)}</div>${gapHtml}</div>${secondRunHtml}</div>`;
                     } else { 
                         let label = fType === 'qualify' ? 'QUALIFY' : (fType === '1st' ? 'OFICIAL' : '2ª DESCIDA'); let val = fType === 'qualify' ? r.q : (fType === '1st' ? r.o : r.s); let pen = fType === 'qualify' ? r.qPen : (fType === '1st' ? r.oPen : r.sPen); let bg = fType === 'qualify' ? '#E6E6FA' : (fType === '1st' ? '#d4edda' : '#ffe5b4'); let color = fType === 'qualify' ? '#4B0082' : (fType === '1st' ? '#15803d' : '#d65a00'); 
                         columnsHtml = `<div style="width:100%; border-top:1px dashed #eee; padding:10px; background:${bg}; text-align:center;"><div style="font-size:10px; color:${color}; font-weight:bold; margin-bottom:2px;">TEMPO ${label}</div><div style="font-family:monospace; font-size:16px; font-weight:bold; color:#333">${getTpl(val, pen)}</div>${gapHtml}</div>`; 
                     }
                     
                     let rowHtml = `<div class="rank-row" style="flex-direction:column; padding:0; margin-bottom:${fCat==='ALL_SEP'?'0':'5px'}; background:${i%2==0 ? '#fff' : '#f9f9f9'}; border-bottom:1px solid #ddd; border-radius: 6px; overflow: hidden; border: 1px solid #e2e8f0;"><div style="padding:8px 10px; display:flex; justify-content:space-between; width:100%; align-items:center;"><div>${evtTag}<div style="font-weight:bold; font-size:13px; color:#333; display:flex; align-items:center; flex-wrap:wrap;">${posDisplay} ${pName} <span class="badge-city" style="margin-left:5px">${pCityUF}</span></div><span class="${cClass}">${r.cat}</span></div></div>${columnsHtml}</div>`;

                     return catHeader + rowHtml;
                 }).join('');
                 
                 let finalHtml = headerTag + listHtml;
                 if (fCat === 'ALL_SEP' && sortedList.length > 0) finalHtml += '</div></div>';
                 listDiv.innerHTML = finalHtml;
             }
         }
    } else if (t === 'ranking') {
         populatePublicFilters(t);
         const fEvt = document.getElementById('filter-evt-ranking').value;
         const fCat = document.getElementById('filter-cat-'+t).value; 
         const fRegion = document.getElementById('filter-region-ranking').value;
         recalcRanking(fEvt); 
         const list = db.ranking || []; 
         const div = document.getElementById('list-'+t);
         if(div) {
             let filteredList = list;
             if (fCat && fCat !== 'ALL' && fCat !== 'ALL_SEP') filteredList = filteredList.filter(i => window.normalizeCatName(i.cat) === window.normalizeCatName(fCat));
             if (fRegion === 'PE') filteredList = filteredList.filter(r => { const u = db.users.find(user => user.cpf === r.cpf); return u && (u.uf === 'PE' || !u.uf || u.filiadoPE === true); });
             filteredList.sort((a,b) => {
                 if (fCat === 'ALL_SEP' && a.cat !== b.cat) return a.cat.localeCompare(b.cat);
                 return b.totalPts - a.totalPts;
             });
             const evtObjH = db.events.find(e => String(e.id) === String(fEvt)); const evtNameHeader = fEvt === 'ALL' ? 'GERAL (SOMA DAS ETAPAS)' : (evtObjH ? evtObjH.t : 'ETAPA'); const catNameHeader = fCat === 'ALL' ? 'MELHORES DA PISTA' : (fCat === 'ALL_SEP' ? 'GERAL SEPARADA (POR CATEGORIA)' : fCat);
             const regionNameHeader = fRegion === 'PE' ? 'RANKING PERNAMBUCO' : 'RANKING NORDESTE (OPEN)';
             const headerTag = `<div class="print-header" style="background: linear-gradient(135deg, #d50000, #990000); color: white; padding: 15px; border-radius: 8px; margin-bottom: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center;"><h2 style="margin: 0; font-size: 18px; font-weight: 900; text-transform: uppercase;">RANKING OFICIAL</h2><div style="font-size: 11px; margin-top: 5px; opacity: 0.9; font-weight: bold;"><i class="fas fa-map-marker-alt"></i> ${regionNameHeader} &nbsp;|&nbsp; <i class="fas fa-bicycle"></i> ${catNameHeader}</div><div style="font-size: 12px; margin-top: 5px; color: #ffe500; font-weight: bold;">${evtNameHeader}</div></div>`;
             if(filteredList.length === 0) div.innerHTML = headerTag + '<div style="padding:20px; text-align:center; color:#999; font-size:11px">Nenhum ponto registrado.</div>';
             else {
                 const listHtml = filteredList.map((r, i) => {
                    let pNameFull = getPilotName(r.cpf, r.name); let _pts = pNameFull.split(' '); let _lim = ['DE','DA','DO','DOS','DAS'].includes(_pts[1]) ? 3 : 2; const pName = _pts.slice(0, _lim).join(' '); const pCityUF = getPilotCityUF(r.cpf, r.city); const cClass = getCatClass(r.cat);
                    let evtsHtml = '';
                    if (fEvt === 'ALL' && r.evts && r.evts.length > 0) { evtsHtml = `<div style="margin-top:4px; display:flex; gap:4px; flex-wrap:wrap;">` + r.evts.map(en => `<span style="background:#eef2ff; color:#3730a3; font-size:8px; padding:2px 4px; border-radius:4px; font-weight:bold; border:1px solid #c7d2fe;">${en}</span>`).join('') + `</div>`; }

                     let catHeader = '';
                     let posDisplay = (i + 1) + 'º';
                     if (fCat === 'ALL_SEP') {
                         if (i === 0 || filteredList[i-1].cat !== r.cat) {
                             let closeTag = i > 0 ? '</div></div>' : '';
                             catHeader = `${closeTag}<div class="cat-print-page" style="margin-bottom: 30px; border: 2px solid #d50000; border-radius: 8px; background: #fff; overflow: hidden; page-break-inside: avoid; break-inside: avoid;"><div class="cat-title-box" style="background: #d50000; color: white; padding: 10px; font-size: 16px; font-weight: 900; text-align: center; text-transform: uppercase; letter-spacing: 1px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">🏆 ${r.cat}</div><div style="padding: 10px; display: flex; flex-direction: column; gap: 8px;">`;
                         }
                         let catIndex = 0;
                         for (let j = 0; j < i; j++) { if (filteredList[j].cat === r.cat) catIndex++; }
                         posDisplay = (catIndex + 1) + 'º';
                     }

                    let rowHtml = `<div class="rank-row" style="flex-direction:column; align-items:flex-start; gap:0; padding:0; margin-bottom:${fCat==='ALL_SEP'?'0':'10px'}; border:1px solid #e2e8f0; border-radius:6px; overflow:hidden; background:white;"><div style="display:flex; justify-content:space-between; width:100%; align-items:center; padding:10px; background:#f8fafc; border-bottom:1px solid #e2e8f0;"><div style="display:flex; align-items:flex-start; gap:10px;"><div class="rank-pos" style="background:#333; color:#fff; width:28px; height:28px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-size:12px; margin-top:2px;">${posDisplay}</div><div><div style="font-weight:bold; font-size:14px; color:#0f172a; display:flex; align-items:center; flex-wrap:wrap;">${pName} <span class="badge-city" style="margin-left:5px">${pCityUF}</span></div><span class="${cClass}">${r.cat}</span>${evtsHtml}</div></div><div style="text-align:right"><div style="font-size:20px; font-weight:900; color:var(--pe-blue); line-height:1">${r.totalPts}</div><div style="font-size:9px; color:#666; font-weight:bold; margin-top:2px; display:flex; gap:5px; justify-content:flex-end;"><span>Q: <span style="color:#d65a00">${r.qPts || 0}</span></span><span>| O: <span style="color:#15803d">${r.oPts || 0}</span></span></div></div></div></div>`;
                    
                    return catHeader + rowHtml;
                 }).join('');
                 
                 let finalHtml = headerTag + listHtml;
                 if (fCat === 'ALL_SEP' && filteredList.length > 0) finalHtml += '</div></div>';
                 div.innerHTML = finalHtml;
             }
         }
    }
}

// ==========================================================
// 10. PAINEL DE ADMINISTRAÇÃO E PERMISSÕES
// ==========================================================
function tryOpenAdmin(force = false) { 
    if(loggedUser && (isSuperAdmin(loggedUser) || loggedUser.role === 'ORGANIZER' || loggedUser.role === 'ADMIN')) { 
        const today = new Date().toISOString().slice(0,10);
        if (localStorage.getItem('dhpe_auto_backup_date') !== today && !force) { localStorage.setItem('dhpe_auto_backup_date', today);
        toast("GERANDO BACKUP AUTOMÁTICO DIÁRIO..."); downloadBackup(); }
        if(force) { 
            document.getElementById('adm-login-box').style.display = 'none';
            document.getElementById('adm-panel-real').style.display = 'block'; 
            applyAdminPermissions();
            openAdmSection(localStorage.getItem(LAST_ADM_KEY) || 'menu'); 
        } else { nav('adm'); } 
    } else { 
        if(force) { document.getElementById('adm-login-box').style.display = 'block';
        document.getElementById('adm-panel-real').style.display = 'none'; } 
        else toast("ACESSO NEGADO", "error");
    } 
}

window.openAdmSection = function(sec) { 
    currentAdmSection = sec; localStorage.setItem(LAST_ADM_KEY, sec);
    if(!isSuperAdmin(loggedUser) && ['cats', 'events', 'users-edit', 'organizer', 'config-global', 'audit'].includes(sec)) { toast("ACESSO RESTRITO AO ADMINISTRADOR GERAL", "error"); sec = 'menu'; }
    document.querySelectorAll('.adm-section').forEach(el => el.style.display = 'none'); document.getElementById('adm-menu').style.display = 'none';
    if(sec === 'menu') { document.getElementById('adm-menu').style.display = 'grid'; return; } 
    const secEl = document.getElementById('adm-sec-' + sec); if(secEl) secEl.style.display = 'block';
    
    if(sec === 'cats') renderAdmCategories();
    if(sec === 'users-edit') { 
        const catSel = document.getElementById('adm-user-filter-cat');
        const activeCats = db.config.categories.filter(c => c.active).map(c => c.name).sort(); 
        let catHtml = '<option value="ALL">TODAS CATEGORIAS</option>';
        activeCats.forEach(c => { catHtml += `<option value="${c}">${c}</option>`; }); catSel.innerHTML = catHtml; 
        const savedCat = localStorage.getItem('ui_adm-user-filter-cat');
        if(savedCat && catSel.querySelector(`option[value="${savedCat}"]`)) catSel.value = savedCat;
        document.getElementById('adm-edit-user-search').value = localStorage.getItem('ui_adm-edit-user-search') || ''; filterPilots('edit-user', true);
    } 
    if(sec === 'results') { 
        const sel = document.getElementById('adm-res-evt');
        let html = '<option value="">SELECIONE EVENTO...</option>'; 
        db.events.forEach(e => { if(!isSuperAdmin(loggedUser) && (!loggedUser.allowedEvts || !loggedUser.allowedEvts.includes(String(e.id)))) return; html += `<option value="${e.id}">${e.t}</option>`; });
        sel.innerHTML = html; const savedEvt = localStorage.getItem('ui_adm-res-evt'); if(savedEvt && sel.querySelector(`option[value="${savedEvt}"]`)) sel.value = savedEvt;
        // A construção do dropdown de categorias agora acontece inteiramente no renderAdmResults!
        renderAdmResults();
    }
    if(sec === 'events') { 
        renderAdmEvents();
        const copySel = document.getElementById('adm-evt-copy-source');
        if(copySel) { let htmlCopy = '<option value="">SELECIONE EVENTO PARA COPIAR...</option>';
        db.events.forEach(e => { htmlCopy += `<option value="${e.id}">${e.t} (${e.d})</option>`; }); copySel.innerHTML = htmlCopy; }
        if(!document.getElementById('adm-evt-id-edit').value) { renderPointsInputs(BLANK_POINTS, 'evt-points-grid', 'pt-'); renderPointsInputs(BLANK_POINTS, 'evt-q-points-grid', 'q-pt-'); } toggleQualifyInputs(); toggleEventType();
    }
    if(sec === 'financial') { 
        if(!document.getElementById('inputBuscaAtleta')) {
            const finHeader = document.getElementById('fin-evt-select');
            if(finHeader) finHeader.insertAdjacentHTML('afterend', `<input type="text" id="inputBuscaAtleta" placeholder="🔍 Buscar por Nome, CPF ou Cidade..." onkeyup="filtrarAtletasStatus()" style="width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box; font-size: 14px;">`);
        }
        const sel = document.getElementById('fin-evt-select'); let html = isSuperAdmin(loggedUser) ?
        '<option value="ALL">GERAL (TODOS EVENTOS)</option>' : '<option value="">SELECIONE SEU EVENTO...</option>';
        db.events.forEach(e => { if(!isSuperAdmin(loggedUser) && (!loggedUser.allowedEvts || !loggedUser.allowedEvts.includes(String(e.id)))) return; html += `<option value="${e.id}">${e.t}</option>`; });
        sel.innerHTML = html; const savedFin = localStorage.getItem('ui_fin-evt-select'); if(savedFin && sel.querySelector(`option[value="${savedFin}"]`)) sel.value = savedFin;
        renderInscriptions();
    }
    if(sec === 'organizer') { renderOrgList(); const evtsHtml = db.events.map(e => `<label style="display:block; text-align:left; font-size:12px; margin-bottom:5px;"><input type="checkbox" class="org-evt-cb" value="${e.id}"> ${e.t}</label>`).join('');
    document.getElementById('org-events-list').innerHTML = evtsHtml; }
    if(sec === 'config-global') { document.getElementById('adm-cfg-phone').value = db.config.phone || ''; document.getElementById('adm-cfg-rerun-pass').value = db.config.rerunPass ||
    'admin123'; document.getElementById('adm-cfg-allow-ids').checked = db.config.allowAllIDs || false; document.getElementById('adm-cfg-search').value = ''; document.getElementById('adm-cfg-list').style.display = 'none';
    }
    if(sec === 'audit') { renderAuditLog(); }
};

window.checkAdmPass = function() { const inputPass = document.getElementById('adm-pass-check').value;
if(loggedUser && inputPass === (loggedUser.pass || "admin123") && (loggedUser.role === 'ADMIN' || loggedUser.role === 'ORGANIZER' || isSuperAdmin(loggedUser))) { document.getElementById('adm-login-box').style.display='none'; document.getElementById('adm-panel-real').style.display='block';
applyAdminPermissions(); backToAdmMenu(); document.getElementById('adm-pass-check').value = ''; } else { toast("SENHA INCORRETA OU ACESSO NEGADO", "error"); } };
window.backToAdmMenu = function() { openAdmSection('menu'); };

window.filtrarAtletasStatus = function() {
    let input = document.getElementById("inputBuscaAtleta");
    if(!input) return;
    let termoDigitado = input.value.toLowerCase();
    let listaDeAtletas = document.querySelectorAll("#fin-list-container > div");
    listaDeAtletas.forEach(function(el) {
        if (el.innerText.toLowerCase().includes(termoDigitado)) { el.style.display = "flex"; } 
        else { el.style.display = "none"; }
    });
};

function filterPilots(ctx, force) { 
    let inputId = 'adm-edit-user-search'; if(ctx === 'res') inputId = 'adm-res-search';
    if(ctx === 'cfg-search') inputId = 'adm-cfg-search'; if(ctx === 'org') inputId = 'adm-org-search';
    const inputEl = document.getElementById(inputId);
    const term = inputEl ? inputEl.value.toUpperCase() : ""; 
    let listDivId = 'adm-edit-user-list'; if(ctx === 'res') listDivId = 'adm-res-list';
    if(ctx === 'cfg-search') listDivId = 'adm-cfg-list'; if(ctx === 'org') listDivId = 'adm-org-list-search';
    const listDiv = document.getElementById(listDivId);
    if(term.length < 2 && !force) { if(listDiv) listDiv.style.display = 'none'; return; } 
    let found = db.users.filter(u => (u.nome && u.nome.includes(term)) || (u.cpf && u.cpf.includes(term)) || (u.city && u.city.toUpperCase().includes(term)));
    if(listDiv) { 
        listDiv.style.display = 'block';
        if(ctx === 'edit-user') { 
            const filterCat = document.getElementById('adm-user-filter-cat').value;
            if(filterCat !== 'ALL') found = found.filter(u => u.cat === filterCat);
            document.getElementById('adm-stat-total').innerText = "Total Geral: " + db.users.length;
            document.getElementById('adm-stat-filter').innerText = "Lista Atual: " + found.length;
            listDiv.innerHTML = found.map(u => { 
                const pName = getPilotName(u.cpf, u.nome); const pCityUF = getPilotCityUF(u.cpf, u.city); const cClass = getCatClass(u.cat); const wppBtn = u.tel ? `<i class="fab fa-whatsapp" onclick="openWhatsApp('${u.tel}', 'Olá ${u.nome}')" style="color:#25D366; cursor:pointer; font-size:16px;"></i>` : ''; const statusIcon = u.idReleased ? '<i class="fas fa-check-circle" style="color:green" title="Liberado"></i>' : '<i class="fas fa-lock" style="color:#999" title="Bloqueado"></i>'; 
                let filiadoHtml = '';
                if (u.uf && u.uf !== 'PE') {
                    const isFiliado = u.filiadoPE === true; const filBg = isFiliado ? '#009b3a' : '#f1f5f9'; const filColor = isFiliado ? '#fff' : '#64748b'; const filIcon = isFiliado ? 'fa-check' : 'fa-id-card'; const filText = isFiliado ? 'FILIADO EM PE' : 'TORNAR FILIADO (PE)';
                    filiadoHtml = `<div style="margin-top: 8px;"><button class="btn-mini-adm" style="background:${filBg}; color:${filColor}; width: 100%; border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;" onclick="toggleFiliacaoPE('${u.cpf}')"><i class="fas ${filIcon}"></i> ${filText}</button></div>`;
                }
                return `<div class="adm-card" style="display: flex; flex-direction: column; gap: 8px; padding: 12px;"><div style="display: flex; justify-content: space-between; align-items: flex-start;"><div style="width: 100%;"><b style="font-size: 14px; color: var(--pe-blue); display: block; margin-bottom: 5px;">${pName}</b><div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;"><span class="badge-city">${pCityUF}</span><span class="${cClass}">${u.cat}</span>${statusIcon} ${wppBtn}</div></div></div><div style="display: flex; gap: 5px; border-top: 1px dashed #cbd5e1; padding-top: 10px; margin-top: 5px;"><button class="btn-mini-adm" style="background:#3b82f6; flex: 1; margin:0; padding: 8px 0;" onclick="openEditUserModal('${u.cpf}')"><i class="fas fa-pen"></i> EDITAR</button><button class="btn-mini-adm" style="background:#6b7280; flex: 1; margin:0; padding: 8px 0;" onclick="renderPilotHistoryModal('${u.cpf}', '${u.nome}')"><i class="fas fa-history"></i> LOG</button><button class="btn-mini-adm" style="background:#ef4444; flex: 1; margin:0; padding: 8px 0;" onclick="delUser('${u.cpf}')"><i class="fas fa-trash"></i> APAGAR</button></div>${filiadoHtml}</div>`;
            }).join('');
        } else if(ctx === 'cfg-search') {
            if(found.length === 0) { listDiv.innerHTML = '<div style="padding:10px; text-align:center">Nenhum atleta encontrado.</div>'; return; }
            listDiv.innerHTML = found.map(u => { const isOn = u.idReleased === true; const pName = getPilotName(u.cpf, u.nome); const pCityUF = getPilotCityUF(u.cpf, u.city); const cClass = getCatClass(u.cat); return `<div class="adm-card" style="display:block; margin-bottom:10px;"><div style="margin-bottom:5px;"><b>${pName}</b> <span class="badge-city">${pCityUF}</span><br><span class="${cClass}">${u.cat}</span><br><span style="font-size:9px; color:#666">CPF: ${u.cpf}</span></div><div class="cfg-toggle-container"><div class="cfg-toggle-btn ${isOn ? 'active-on' : ''}" onclick="toggleUserId('${u.cpf}', true)"><i class="fas fa-check"></i> LIBERADO</div><div class="cfg-toggle-btn ${!isOn ? 'active-off' : ''}" onclick="toggleUserId('${u.cpf}', false)"><i class="fas fa-ban"></i> BLOQUEADO</div></div></div>`; }).join('');
        } else if (ctx === 'res') {
            const evtId = document.getElementById('adm-res-evt').value;
            if(evtId) { let entries = [];
            found.forEach(u => { if(u.inscricoes) { u.inscricoes.forEach(i => { if(String(i.id) === String(evtId) && i.status === 'CONFIRMADO') { entries.push({cpf: u.cpf, name: u.nome, city: u.city, cat: window.normalizeCatName(i.extraCat || u.cat)}); } }); } });
            if(entries.length === 0) listDiv.innerHTML = '<div style="padding:10px; color:red">Nenhum piloto CONFIRMADO nesta etapa.</div>';
            else listDiv.innerHTML = entries.map(e => `<div class="smart-item" onclick="selectResPilot('${e.cpf}', '${e.name}', '${e.city}', '${e.cat}')"><b>${getPilotName(e.cpf, e.name)}</b> <span class="badge-city">${getPilotCityUF(e.cpf, e.city)}</span> <span style="font-size:10px; color:#666">(${e.cat})</span></div>`).join('');
            } else listDiv.innerHTML = 'Selecione o evento.';
        } else if (ctx === 'org') {
            if(found.length === 0) { listDiv.innerHTML = '<div style="padding:10px; text-align:center">Nenhum atleta encontrado.</div>'; return; }
            listDiv.innerHTML = found.map(u => `<div class="smart-item" style="padding:10px; border-bottom:1px solid #eee; cursor:pointer;" onclick="selectOrgPilot('${u.cpf}', '${u.nome}')"><b>${getPilotName(u.cpf, u.nome)}</b> <span class="badge-city">${getPilotCityUF(u.cpf, u.city)}</span><br><span style="font-size:9px; color:#666">CPF: ${u.cpf}</span></div>`).join('');
        }
    } 
}

window.delUser = function(cpf) { 
    if(!isSuperAdmin(loggedUser)) return toast("Apenas o Super Admin pode excluir usuários", "error");
    showConfirm("EXCLUIR ATLETA?", "Deseja excluir este atleta permanentemente do banco de dados?", '<i class="fas fa-trash-alt" style="color:var(--pe-red)"></i>', function(res) {
        if(res) { const idx = db.users.findIndex(u => u.cpf === cpf); if(idx > -1) { db.users.splice(idx, 1); saveDB('users'); filterPilots('edit-user', true); window.logAction(`Excluiu do sistema o atleta CPF: ${cpf}`); toast("ATLETA EXCLUÍDO"); } }
    });
};

window.openEditUserModal = function(cpf){ 
    if(!isSuperAdmin(loggedUser)) return toast("Apenas o Super Admin pode editar usuários", "error");
    const u = db.users.find(x => x.cpf === cpf);
    if(u){ 
        document.getElementById('super-edit-old-cpf').value = u.cpf;
        document.getElementById('super-edit-name').value = u.nome; document.getElementById('super-edit-cpf').value = u.cpf; document.getElementById('super-edit-city').value = u.city; document.getElementById('super-edit-uf').value = u.uf || "PE"; document.getElementById('super-edit-tel').value = u.tel;
        document.getElementById('super-edit-nasc').value = u.nasc || ""; if(document.getElementById('super-edit-cbc')) document.getElementById('super-edit-cbc').value = u.cbc || ""; const newPassInput = document.getElementById('super-edit-new-pass'); if(newPassInput) newPassInput.value = "";
        const catSelect = document.getElementById('super-edit-cat'); const allCats = db.config.categories.filter(c => c.active).sort((a,b) => a.name.localeCompare(b.name)); catSelect.innerHTML = allCats.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        catSelect.value = u.cat; openModal('modal-super-edit'); 
    } 
};

window.saveSuperEdit = function() { 
    if(!isSuperAdmin(loggedUser)) return;
    const oldCpf = document.getElementById('super-edit-old-cpf').value;
    const idx = db.users.findIndex(x => x.cpf === oldCpf);
    if(idx > -1) { 
        const oldU = db.users[idx];
        const newName = document.getElementById('super-edit-name').value.toUpperCase(); const newCpf = document.getElementById('super-edit-cpf').value; const newCity = document.getElementById('super-edit-city').value.toUpperCase(); const newUf = document.getElementById('super-edit-uf').value; const newCat = document.getElementById('super-edit-cat').value.toUpperCase();
        const newTel = document.getElementById('super-edit-tel').value; const newNasc = document.getElementById('super-edit-nasc').value; const newCbc = document.getElementById('super-edit-cbc') ? document.getElementById('super-edit-cbc').value : ""; const passField = document.getElementById('super-edit-new-pass');
        const newPassInput = passField ? passField.value.trim() : "";
        let changes = []; if (oldU.cat !== newCat) changes.push(`Categoria: ${oldU.cat} ➔ ${newCat}`);
        if (oldU.nome !== newName) changes.push(`Nome: ${oldU.nome} ➔ ${newName}`); if (oldU.city !== newCity) changes.push(`Cidade: ${oldU.city} ➔ ${newCity}`);
        if (oldU.uf !== newUf) changes.push(`UF: ${oldU.uf} ➔ ${newUf}`); if (oldU.cbc !== newCbc) changes.push(`CBC: ${oldU.cbc || '(Vazio)'} ➔ ${newCbc || '(Vazio)'}`);
        if (newPassInput !== "") changes.push(`Senha Master Alterada`);
        db.users[idx].nome = newName; db.users[idx].cpf = newCpf; db.users[idx].city = newCity; db.users[idx].uf = newUf;
        db.users[idx].cat = newCat; db.users[idx].tel = newTel; db.users[idx].nasc = newNasc; db.users[idx].cbc = newCbc;
        if(newPassInput !== "") { if(newPassInput.length < 6) return toast("A senha deve ter no mínimo 6 dígitos", "error"); db.users[idx].adminNewPass = newPassInput; }
        saveDB('users'); 
        if(changes.length > 0) { window.logAction(`Editou o atleta ${oldU.nome}. Alterações: ${changes.join(' | ')}`); } else { window.logAction(`Acessou a edição do atleta ${oldU.nome} sem realizar mudanças.`); }
        toast("ALTERADO!"); fecharModal('modal-super-edit'); filterPilots('edit-user', true);
    } 
};
window.gerarSenhaTemporaria = function() {
    if(!isSuperAdmin(loggedUser)) return; const oldCpf = document.getElementById('super-edit-old-cpf').value;
    const idx = db.users.findIndex(x => x.cpf === oldCpf);
    if(idx > -1) { const pin = Math.floor(100000 + Math.random() * 900000).toString();
    db.users[idx].tempPass = pin; db.users[idx].tempPassExp = Date.now() + (5 * 60 * 1000); saveDB('users'); const tempDisplay = document.getElementById('super-edit-temp-pass-display');
    if(tempDisplay) tempDisplay.innerText = `SENHA: ${pin}`; toast("SENHA TEMPORÁRIA GERADA!"); } else { toast("Usuário não encontrado.", "error"); }
};
window.toggleFiliacaoPE = function(cpf) {
    if(!isSuperAdmin(loggedUser)) return toast("APENAS O SUPER ADMIN PODE ALTERAR", "error");
    const idx = db.users.findIndex(u => u.cpf === cpf);
    if(idx > -1) {
        const u = db.users[idx];
        const isFiliadoAtualmente = u.filiadoPE === true; const novoStatus = !isFiliadoAtualmente;
        const titulo = novoStatus ? "CONFIRMAR FILIAÇÃO PE?" : "REMOVER FILIAÇÃO PE?";
        const msg = novoStatus ? `Deseja registrar que <b>${u.nome}</b> é federado em Pernambuco, mesmo sendo do estado de ${u.uf}? Ele passará a pontuar no Ranking Oficial.` : `Deseja remover a filiação pernambucana de <b>${u.nome}</b>?`;
        const icone = `<i class="fas fa-id-card" style="color:var(--pe-blue)"></i>`;
        showConfirm(titulo, msg, icone, function(res) {
            if(res) { db.users[idx].filiadoPE = novoStatus; saveDB('users'); if (novoStatus) {
    dispararPushAtleta(cpf, "Filiação Ativa! 🪪", "Seu status de Filiado em PE foi aprovado. Acelera!");
} filterPilots('edit-user', true); toast("STATUS DE FILIAÇÃO ATUALIZADO!", "success"); }
        });
    }
};

window.reCalcCat = function() { 
    const gender = document.getElementById('cad-gender').value; const birthDate = document.getElementById('cad-nasc').value;
    const catInput = document.getElementById('cad-cat-age'); const overrideSel = document.getElementById('cad-cat-override'); const finalInput = document.getElementById('cad-cat-final');
    if(!gender) return;
    let allowedManual = [];
    if (gender === 'F') { allowedManual = ["FEMININO ELITE", "FEMININO MASTER"]; } else { allowedManual = ["ELITE", "OPEN", "RÍGIDA", "ESTREANTE", "E-BIKE", "PCD"]; }
    const visibleCats = db.config.categories.filter(c => { const cleanName = c.name.trim().toUpperCase(); return c.active === true && allowedManual.includes(cleanName); }).sort((a,b) => a.name.localeCompare(b.name));
    const currentSel = overrideSel.value; overrideSel.innerHTML = '<option value="">(SEGUIR CÁLCULO DE IDADE)</option>' + visibleCats.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    if (visibleCats.some(c => c.name === currentSel)) { overrideSel.value = currentSel; } else { overrideSel.value = ""; }
    if(!birthDate) return;
    const birthYear = parseInt(birthDate.split('-')[0]); const age = SYSTEM_YEAR - birthYear; let cat = "AMADOR";
    if(gender === 'F') { if(age >= 30) cat = "FEMININO MASTER"; else cat = "FEMININO ELITE"; } else { if(age >= 12 && age <= 14) cat = "INFANTO-JUVENIL";
    else if(age >= 15 && age <= 16) cat = "JUVENIL";
    else if(age >= 17 && age <= 18) cat = "JUNIOR";
    else if(age >= 19 && age <= 29) cat = "SUB-30";
    else if(age >= 30 && age <= 34) cat = "MASTER A1";
    else if(age >= 35 && age <= 39) cat = "MASTER A2";
    else if(age >= 40 && age <= 44) cat = "MASTER B1";
    else if(age >= 45 && age <= 49) cat = "MASTER C1";
    else if(age >= 55 && age <= 59) cat = "MASTER C2"; else if(age >= 60) cat = "MASTER D";
    else cat = "ELITE"; } 
    const isCalculatedActive = db.config.categories.some(c => c.name.trim().toUpperCase() === cat && c.active);
    if(!isCalculatedActive) { cat = gender === 'F' ? "FEMININO ELITE" : "ELITE";
    const isFallbackActive = db.config.categories.some(c => c.name.trim().toUpperCase() === cat && c.active); if (!isFallbackActive) cat = "GERAL"; }
    catInput.value = `${cat} (${age} ANOS)`; finalInput.value = overrideSel.value || cat; 
};

window.applyCatOverride = function() { window.reCalcCat(); };

window.toggleCategory = function(catName) { if(!isSuperAdmin(loggedUser)) return toast("APENAS ADMIN", "error"); const idx = db.config.categories.findIndex(c => c.name === catName);
if(idx > -1) { db.config.categories[idx].active = !db.config.categories[idx].active; saveDB('config'); window.logAction(`Alterou o status da categoria ${catName} para ${db.config.categories[idx].active ? 'ATIVO' : 'INATIVO'}`);
renderAdmCategories(); } };
window.renderAdmCategories = function() {
    const list = document.getElementById('adm-cats-list');
    if (!list) return;
    
    if (!db.config.categories || db.config.categories.length === 0) {
        list.innerHTML = '<div style="padding:10px; color:#666; text-align:center;">Nenhuma categoria encontrada.</div>';
        return;
    }
    
    const sortedCats = [...db.config.categories].sort((a,b) => a.name.localeCompare(b.name));
    list.innerHTML = sortedCats.map(c => {
        const isActive = c.active;
        const bg = isActive ? 'var(--pe-green)' : '#94a3b8';
        const icon = isActive ? 'fa-check' : 'fa-times';
        
        return `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #cbd5e1; padding:10px; border-radius:6px;">
            <b style="font-size:12px; color:#334155;">${c.name}</b>
            <button class="btn-mini-adm" style="background:${bg}; margin:0; width:80px; text-align:center;" onclick="toggleCategory('${c.name}')">
                <i class="fas ${icon}"></i> ${isActive ? 'ATIVA' : 'INATIVA'}
            </button>
        </div>`;
    }).join('');
};
window.saveGlobalConfig = function(){ if(!isSuperAdmin(loggedUser)) return toast("APENAS ADMIN", "error"); db.config.phone = document.getElementById('adm-cfg-phone').value; db.config.rerunPass = document.getElementById('adm-cfg-rerun-pass').value || 'admin123'; db.config.allowAllIDs = document.getElementById('adm-cfg-allow-ids').checked;
saveDB('config'); window.logAction(`Alterou Configurações Gerais do Sistema`); toast("CONFIGURAÇÕES SALVAS"); updateCardLive(); };
// ==========================================================
// 11. GERENCIAMENTO DE EVENTOS (CRIAR/EDITAR/EXCLUIR)
// ==========================================================
function renderPointsInputs(pts, containerId = 'evt-points-grid', prefix = 'pt-') { const grid = document.getElementById(containerId);
if(!grid) return; grid.innerHTML = pts.map((p, i) => { const saved = localStorage.getItem(`autosave_${prefix}${i}`); const val = saved !== null ? saved : p; return `<input type="number" id="${prefix}${i}" value="${val}" class="input-field" style="text-align:center" placeholder="${i+1}º" oninput="localStorage.setItem('autosave_${prefix}${i}', this.value)">`; }).join('');
}
function renderAdmEvents() { const list = document.getElementById('adm-list-events'); if(!list) return; if(!db.events || db.events.length === 0) { list.innerHTML = '<div style="color:#666; padding:10px">Nenhum evento.</div>';
return; } list.innerHTML = db.events.map(e => `<div class="adm-card" style="display:flex; justify-content:space-between; align-items:center;"><div><b>${e.t}</b> (${e.type})<br><span style="font-size:10px; color:#666">${e.d} | ${e.city} | ${e.status}</span></div><div style="display:flex; gap:5px;"><button class="btn-mini-adm" style="background:#3b82f6" onclick="editEvent(${e.id})"><i class="fas fa-pen"></i></button><button class="btn-mini-adm" style="background:#ef4444" onclick="delEvent(${e.id})"><i class="fas fa-trash"></i></button></div></div>`).join('');
}

window.toggleQualifyInputs = function() {
    const check = document.getElementById('adm-evt-has-qualify');
    const inputs = document.getElementById('adm-qualify-inputs');
    if(check && inputs) {
        if(check.checked) {
            inputs.style.opacity = '1';
            inputs.style.pointerEvents = 'auto';
        } else {
            inputs.style.opacity = '0.5';
            inputs.style.pointerEvents = 'none';
            document.getElementById('adm-evt-q-date').value = '';
            document.getElementById('adm-evt-q-time').value = '';
        }
    }
};
function clearEventForm() { 
    document.querySelectorAll('#adm-sec-events input').forEach(i => { if(i.type !== 'checkbox') { i.value = ''; localStorage.removeItem('autosave_' + i.id); } else { i.checked = false; localStorage.removeItem('autosave_' + i.id); } });
    const galArea = document.getElementById('adm-gallery-preview-area');
    if(galArea) galArea.innerHTML = ''; 
    const btnSave = document.getElementById('btn-save-event');
    if(btnSave) btnSave.innerText = "SALVAR EVENTO";
    for(let i=0; i<20; i++) { localStorage.removeItem('autosave_pt-'+i); localStorage.removeItem('autosave_q-pt-'+i); } 
    renderPointsInputs(BLANK_POINTS, 'evt-points-grid', 'pt-'); renderPointsInputs(BLANK_POINTS, 'evt-q-points-grid', 'q-pt-');
    if (typeof window.toggleQualifyInputs === 'function') window.toggleQualifyInputs(); 
    if (typeof toggleEventType === 'function') toggleEventType();
}

window.abrirModalPoster = function(imgSrc) { document.getElementById('img-poster-view').src = imgSrc; openModal('modal-poster'); };
function renderAdmGalleryPreviews(evt) { const area = document.getElementById('adm-gallery-preview-area'); if(!area) return; area.innerHTML = '';
if(!evt.gallery || evt.gallery.length === 0) { area.innerHTML = '<span style="font-size:10px; color:#999; grid-column:span 4; text-align:center">Sem fotos adicionais.</span>'; return; } evt.gallery.forEach((img, idx) => { area.innerHTML += `<div class="adm-gallery-edit-item"><img src="${img}" onclick="abrirModalPoster('${img}')"><button class="adm-gallery-del-btn" onclick="deleteGalleryImage(${evt.id}, ${idx})"><i class="fas fa-trash"></i></button></div>`; });
}
window.deleteGalleryImage = function(evtId, imgIndex) { if(!isSuperAdmin(loggedUser)) return; showConfirm("EXCLUIR FOTO?", "Tem certeza que deseja excluir esta foto da galeria?", '<i class="fas fa-trash-alt" style="color:var(--pe-red)"></i>', function(res) { if(res) { const evtIndex = db.events.findIndex(e => e.id == evtId); if(evtIndex > -1) { db.events[evtIndex].gallery.splice(imgIndex, 1); saveDB('events'); renderAdmGalleryPreviews(db.events[evtIndex]); } } }); }

window.addEvent = function() { 
    if(!isSuperAdmin(loggedUser)) return toast("Apenas Super Admin pode criar/editar eventos", "error");
    const btn = document.getElementById('btn-save-event'); const isEdit = !!document.getElementById('adm-evt-id-edit').value; const originalText = isEdit ? "ATUALIZAR EVENTO" : "SALVAR EVENTO";
    btn.innerText = isEdit ? "ATUALIZANDO..." : "SALVANDO...";
    const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value : "";
    const t = getVal('adm-evt-t').toUpperCase(); 
    const d = getVal('adm-evt-d'); 
    if(!t || !d) { btn.innerText = originalText;
    return toast("NOME E DATA OBRIGATÓRIOS", "error"); } 
    
    const evtType = getVal('adm-evt-type') || 'PE';
    let extraVals = {};
    let newPoints = [], newQPoints = [];
    let hasQualify = false;
    let geralVal = "";
    if (evtType === 'NON_OFFICIAL') {
        extraVals = {
            'ELITE': getVal('adm-evt-v-elite'),
            'FEMININO': getVal('adm-evt-v-feminino'),
            'SUB-30': getVal('adm-evt-v-sub30'),
            'JUNIOR': getVal('adm-evt-v-junior'),
            'INICIANTE': getVal('adm-evt-v-iniciante'),
            'MASTER A': getVal('adm-evt-v-mastera'),
            'MASTER B': getVal('adm-evt-v-masterb'),
            'MASTER C': getVal('adm-evt-v-masterc'),
            'RÍGIDA': getVal('adm-evt-v-rigida-non')
        };
        const extra1Name = getVal('adm-evt-n-extra1').toUpperCase();
        if (extra1Name) extraVals[extra1Name] = getVal('adm-evt-v-extra1');
        const extra2Name = getVal('adm-evt-n-extra2').toUpperCase();
        if (extra2Name) extraVals[extra2Name] = getVal('adm-evt-v-extra2');
        Object.keys(extraVals).forEach(k => { if(!extraVals[k]) delete extraVals[k]; });
    } else {
        geralVal = getVal('adm-evt-v');
        extraVals = { 'ESTREANTE (EXTRA)': getVal('adm-evt-v-estreante'), 'OPEN (EXTRA)': getVal('adm-evt-v-open'), 'RÍGIDA (EXTRA)': getVal('adm-evt-v-rigida'), 'E-BIKE (EXTRA)': getVal('adm-evt-v-ebike'), 'PCD (EXTRA)': getVal('adm-evt-v-pcd') };
        hasQualify = document.getElementById('adm-evt-has-qualify').checked;
        for(let i=0; i<20; i++) { const el = document.getElementById(`pt-${i}`);
        newPoints.push(el && el.value !== "" ? parseInt(el.value, 10) : ""); } 
        for(let i=0; i<20; i++) { const el = document.getElementById(`q-pt-${i}`);
        newQPoints.push(el && el.value !== "" ? parseInt(el.value, 10) : ""); } 
    }

    const evtObj = { 
        id: getVal('adm-evt-id-edit') ? parseInt(getVal('adm-evt-id-edit'), 10) : Date.now(), 
        t: t, d: d, m: getVal('adm-evt-month'), type: evtType, city: getVal('adm-evt-c').toUpperCase(), 
        val: geralVal, pix: getVal('adm-evt-pix'), status: getVal('adm-evt-status') || 'OPEN', 
        points: newPoints, qPoints: newQPoints, closeDate: getVal('adm-evt-close-date'), 
        startListDate: getVal('adm-evt-startlist-date'), open: true, img: null, gallery: [], 
        wpp: document.getElementById('adm-evt-wpp').value, 
        hasQualify: hasQualify, qDate: hasQualify ? document.getElementById('adm-evt-q-date').value : null, 
        qTime: hasQualify ? document.getElementById('adm-evt-q-time').value : null, 
        extraVals: extraVals 
    };
    if(getVal('adm-evt-id-edit')) { const oldIdx = db.events.findIndex(e => e.id == evtObj.id); if(oldIdx > -1) { if(db.events[oldIdx].img) evtObj.img = db.events[oldIdx].img;
    if(db.events[oldIdx].gallery) evtObj.gallery = db.events[oldIdx].gallery; } } 
    
    const fileInput = document.getElementById('adm-evt-img');
    const galleryInput = document.getElementById('adm-evt-gallery'); 
    const p1 = new Promise((resolve) => { if(fileInput && fileInput.files && fileInput.files[0]) { compressImage(fileInput.files[0], 800, (base64) => { if(base64) { uploadImageToStorage(base64, `capa_${evtObj.id}.jpg`).then(url => { evtObj.img = url; resolve(); }).catch(() => resolve()); } else resolve(); }); } else resolve(); });
    const p2 = new Promise((resolve) => { if(galleryInput && galleryInput.files && galleryInput.files.length > 0) { let loaded = 0; if(!evtObj.gallery) evtObj.gallery = []; for(let i=0; i<galleryInput.files.length; i++) { compressImage(galleryInput.files[i], 800, (base64) => { if(base64) { uploadImageToStorage(base64, `galeria_${evtObj.id}_${i}_${Date.now()}.jpg`).then(url => { if(url) evtObj.gallery.push(url); loaded++; if(loaded === galleryInput.files.length) resolve(); }).catch(() => { loaded++; if(loaded === galleryInput.files.length) resolve(); }); } else { loaded++; if(loaded === galleryInput.files.length) resolve(); } }); } } else resolve(); });
    Promise.all([p1, p2]).then(() => { 
        const idx = db.events.findIndex(e => e.id == evtObj.id); 
        if(idx > -1) { db.events[idx] = evtObj; saveDB('events'); } 
        else { db.events.push(evtObj); saveDB('events'); } 
        if (!isEdit && evtObj.status === 'OPEN') {
    dispararPushGeral("Nova Etapa no Ar! 🏁🏆", `As inscrições para a etapa "${evtObj.t}" estão abertas. Garanta sua vaga!`);
} 
        toast(isEdit ? "EVENTO ATUALIZADO!" : "EVENTO SALVO!"); 
        btn.innerText = "SALVAR EVENTO"; renderAdmEvents(); clearEventForm(); renderContent('calendar'); 
    }).catch((e) => { toast("ERRO: Falha ao salvar.", "error"); btn.innerText = originalText; });
};
window.editEvent = function(id) { 
    const e = db.events.find(ev => ev.id == id);
    if(e) { 
        const setAndSave = (elId, val) => { const el = document.getElementById(elId);
        if(el) { el.value = val; localStorage.setItem('autosave_' + elId, val); } };
        setAndSave('adm-evt-id-edit', e.id); setAndSave('adm-evt-t', e.t); setAndSave('adm-evt-d', e.d); setAndSave('adm-evt-c', e.city);
        setAndSave('adm-evt-v', e.val || ''); setAndSave('adm-evt-pix', e.pix || ''); setAndSave('adm-evt-status', e.status || 'OPEN'); setAndSave('adm-evt-close-date', e.closeDate || ''); setAndSave('adm-evt-startlist-date', e.startListDate || '');
        setAndSave('adm-evt-wpp', e.wpp || ''); 
        if(e.m) setAndSave('adm-evt-month', e.m); if(e.type) setAndSave('adm-evt-type', e.type);
        if (e.type === 'NON_OFFICIAL') {
            if(e.extraVals) {
                setAndSave('adm-evt-v-elite', e.extraVals['ELITE'] || '');
                setAndSave('adm-evt-v-feminino', e.extraVals['FEMININO'] || '');
                setAndSave('adm-evt-v-sub30', e.extraVals['SUB-30'] || '');
                setAndSave('adm-evt-v-junior', e.extraVals['JUNIOR'] || '');
                setAndSave('adm-evt-v-iniciante', e.extraVals['INICIANTE'] || '');
                setAndSave('adm-evt-v-mastera', e.extraVals['MASTER A'] || '');
                setAndSave('adm-evt-v-masterb', e.extraVals['MASTER B'] || '');
                setAndSave('adm-evt-v-masterc', e.extraVals['MASTER C'] || '');
                setAndSave('adm-evt-v-rigida-non', e.extraVals['RÍGIDA'] || '');
                const defaultKeys = ['ELITE', 'FEMININO', 'SUB-30', 'JUNIOR', 'INICIANTE', 'MASTER A', 'MASTER B', 'MASTER C', 'RÍGIDA'];
                const customKeys = Object.keys(e.extraVals).filter(k => !defaultKeys.includes(k));
                
                if (customKeys.length > 0) { setAndSave('adm-evt-n-extra1', customKeys[0]); setAndSave('adm-evt-v-extra1', e.extraVals[customKeys[0]]); } 
                else { setAndSave('adm-evt-n-extra1', ''); setAndSave('adm-evt-v-extra1', ''); }
                if (customKeys.length > 1) { setAndSave('adm-evt-n-extra2', customKeys[1]); setAndSave('adm-evt-v-extra2', e.extraVals[customKeys[1]]); } 
                else { setAndSave('adm-evt-n-extra2', ''); setAndSave('adm-evt-v-extra2', ''); }
            }
        } else {
            if(e.extraVals) { setAndSave('adm-evt-v-estreante', e.extraVals['ESTREANTE (EXTRA)'] || '');
            setAndSave('adm-evt-v-open', e.extraVals['OPEN (EXTRA)'] || ''); setAndSave('adm-evt-v-rigida', e.extraVals['RÍGIDA (EXTRA)'] || ''); setAndSave('adm-evt-v-ebike', e.extraVals['E-BIKE (EXTRA)'] || ''); setAndSave('adm-evt-v-pcd', e.extraVals['PCD (EXTRA)'] || '');
            } else { setAndSave('adm-evt-v-estreante', ''); setAndSave('adm-evt-v-open', ''); setAndSave('adm-evt-v-rigida', ''); setAndSave('adm-evt-v-ebike', ''); setAndSave('adm-evt-v-pcd', ''); }
            const checkQ = document.getElementById('adm-evt-has-qualify');
            if(e.hasQualify) { checkQ.checked = true; localStorage.setItem('autosave_adm-evt-has-qualify', true); setAndSave('adm-evt-q-date', e.qDate || ''); setAndSave('adm-evt-q-time', e.qTime || '');
            } else { checkQ.checked = false; localStorage.setItem('autosave_adm-evt-has-qualify', false); setAndSave('adm-evt-q-date', ''); setAndSave('adm-evt-q-time', ''); }
            toggleQualifyInputs(); renderPointsInputs(e.points || BLANK_POINTS, 'evt-points-grid', 'pt-');
            renderPointsInputs(e.qPoints || BLANK_POINTS, 'evt-q-points-grid', 'q-pt-'); 
            for(let i=0; i<20; i++) { localStorage.setItem('autosave_pt-'+i, e.points ? (e.points[i]||'') : '');
            localStorage.setItem('autosave_q-pt-'+i, e.qPoints ? (e.qPoints[i]||'') : ''); }
        }

        toggleEventType();
        renderAdmGalleryPreviews(e); 
        document.getElementById('btn-save-event').innerText = "ATUALIZAR EVENTO"; 
    } 
};

window.delEvent = function(id) { 
    if(!isSuperAdmin(loggedUser)) return toast("Sem permissão", "error");
    showConfirm("EXCLUIR EVENTO?", "Tem certeza que deseja excluir este evento e todos os seus dados?", '<i class="fas fa-trash-alt" style="color:var(--pe-red)"></i>', function(res) {
        if(res) { const idx = db.events.findIndex(e => e.id == id); if(idx > -1) { db.events.splice(idx, 1); saveDB('events'); window.logAction(`Excluiu o evento ID: ${id}`); renderAdmEvents(); toast("EVENTO EXCLUÍDO"); } }
    });
};

// ==========================================================
// 12. ORGANIZAÇÃO, MEMBROS DA EQUIPE E EXPORTAÇÕES
// ==========================================================
window.demoteOrg = function(cpf) { 
    if(!isSuperAdmin(loggedUser)) return toast("Apenas Super Admin pode remover", "error");
    const clean = cleanCPF(cpf); if(clean === "08327632418" || clean === "00000000000") { return showConfirm("AÇÃO BLOQUEADA", "Este usuário é o Administrador Master do sistema e não pode ser removido da equipe.", '<i class="fas fa-shield-alt" style="color:var(--pe-blue)"></i>', null); }
    const idx = db.users.findIndex(x => x.cpf === cpf);
    if(idx > -1) { const userName = db.users[idx].nome || "este organizador";
    showConfirm("REMOVER DA EQUIPE?", `Tem certeza que deseja remover <b>${userName}</b> do painel de organização? Ele(a) perderá os acessos administrativos.`, '<i class="fas fa-user-times" style="color:var(--pe-red)"></i>', function(res) { if(res) { db.users[idx].role = 'USER'; saveDB('users'); window.logAction(`Removeu o acesso de Organizador de: ${userName} (CPF: ${cpf})`); renderOrgList(); toast("REMOVIDO DA ORGANIZAÇÃO"); } }); } 
};

window.renderOrgList = function() { 
    const list = document.getElementById('adm-list-orgs'); const perms = document.getElementById('org-perms-area'); if(!list) return;
    list.style.display='block'; perms.style.display='none'; document.getElementById('icon-org-toggle').classList.remove('fa-chevron-up'); document.getElementById('icon-org-toggle').classList.add('fa-chevron-down');
    const orgs = db.users.filter(u => u.role === 'ORGANIZER' || u.role === 'ADMIN');
    list.innerHTML = orgs.map(o => { const pName = getPilotName(o.cpf, o.nome); const pCityUF = getPilotCityUF(o.cpf, o.city); let evtsHtml = ''; if (isSuperAdmin(o) || o.role === 'ADMIN') { evtsHtml = `<span style="background:var(--pe-blue); color:white; padding:2px 6px; border-radius:4px; margin-left:5px; font-weight:bold; display:inline-block; margin-top:2px;">TODOS OS EVENTOS</span>`; } else if (o.allowedEvts && o.allowedEvts.length > 0) { const eventNames = o.allowedEvts.map(evtId => { const evt = db.events.find(e => String(e.id) === String(evtId)); return evt ? evt.t : 'Evento Removido'; }); evtsHtml = eventNames.map(name => `<span style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; padding:2px 6px; border-radius:4px; margin-left:5px; font-weight:bold; display:inline-block; margin-top:2px; font-size: 8px;">${name}</span>`).join(''); } else { evtsHtml = `<span style="background:#fee2e2; color:#b91c1c; padding:2px 6px; border-radius:4px; margin-left:5px; font-weight:bold; display:inline-block; margin-top:2px; font-size: 8px;">NENHUM EVENTO</span>`; } return `<div class="adm-card"><div><b>${pName}</b> <span class="badge-city">${pCityUF}</span><br><div style="display:flex; align-items:center; flex-wrap:wrap; margin-top:4px;"><span style="font-size:9px; font-weight:bold; color:#666;">${o.role}</span>${evtsHtml}</div></div><button class="btn-mini-adm" style="background:red" onclick="demoteOrg('${o.cpf}')">REMOVER</button></div>`; }).join('');
};

window.toggleOrgList = function() { const list = document.getElementById('adm-list-orgs'); const icon = document.getElementById('icon-org-toggle'); if(list.style.display === 'none') { list.style.display='block'; icon.classList.remove('fa-chevron-down'); icon.classList.add('fa-chevron-up'); } else { list.style.display='none'; icon.classList.remove('fa-chevron-up'); icon.classList.add('fa-chevron-down'); } };
window.promoteToOrganizer = function() { if(!isSuperAdmin(loggedUser)) return toast("Apenas Super Admin pode promover", "error"); const cpf = document.getElementById('adm-org-selected-cpf').value; const idx = db.users.findIndex(u => u.cpf === cpf); if(idx > -1) { const checkboxes = document.querySelectorAll('.org-evt-cb:checked'); const allowed = Array.from(checkboxes).map(c => c.value); db.users[idx].role = 'ORGANIZER';
db.users[idx].allowedEvts = allowed; saveDB('users'); window.logAction(`Promoveu a Organizador o atleta CPF: ${cpf}`); toast("PROMOVIDO E PERMISSÕES SALVAS!"); renderOrgList(); document.getElementById('adm-org-search').value=''; document.getElementById('org-perms-area').style.display='none'; } };
window.selectOrgPilot = function(cpf, name) { document.getElementById('adm-org-selected-cpf').value = cpf; document.getElementById('adm-org-search').value = name; document.getElementById('adm-org-list-search').style.display = 'none'; document.getElementById('org-perms-area').style.display = 'block'; };
window.compartilListaInscritos = function() {
    const evtId = document.getElementById('fin-evt-select').value;
    if (!evtId || evtId === 'ALL') return toast("SELECIONE UM EVENTO ESPECÍFICO NA LISTA PRIMEIRO!", "error");
    const evt = db.events.find(e => String(e.id) === String(evtId)); if (!evt) return;
    let inscritos = []; let contagemPorCategoria = {};
    let totalInscritos = 0; let totalArrecadado = 0;
    db.users.forEach(u => {
        if (u.inscricoes) {
            u.inscricoes.forEach(i => {
                if (String(i.id) === String(evtId)) {
                    let cat = window.normalizeCatName(i.extraCat || u.cat);
                    let valStr = evt.val || "0"; 
                    if (evt.type === 'NON_OFFICIAL') {
                         let cleanCat = cat.replace(" (EXTRA)", "");
                         if (evt.extraVals && evt.extraVals[cat] && evt.extraVals[cat].trim() !== "") {
                             valStr = evt.extraVals[cat];
                         } else if (evt.extraVals && evt.extraVals[cleanCat] && evt.extraVals[cleanCat].trim() !== "") {
                             valStr = evt.extraVals[cleanCat];
                         }
                         cat = cleanCat; 
                    } else {
                         if (i.extraCat && evt.extraVals && evt.extraVals[cat] && evt.extraVals[cat].trim() !== "") valStr = evt.extraVals[cat];
                    }
                    let val = parseFloat(valStr.replace(',', '.')) || 0;
                    if (i.status === 'CONFIRMADO') { totalArrecadado += val; }
                    inscritos.push({ nome: u.nome, city: u.city, uf: u.uf || 'PE', cat: cat, status: i.status });
                    if (!contagemPorCategoria[cat]) contagemPorCategoria[cat] = 0; contagemPorCategoria[cat]++; totalInscritos++;
                }
            });
        }
    });
    if (totalInscritos === 0) return toast("NENHUM ATLETA INSCRITO NESTE EVENTO", "error");
    let printWin = window.open('', '_blank');
    let html = `<html><head><title>Lista de Inscritos - ${evt.t}</title><style>body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; } h1 { text-align: center; color: #0038a8; margin-bottom: 5px; text-transform: uppercase; font-size: 22px; } h2 { text-align: center; color: #666; margin-top: 0; margin-bottom: 20px; font-size: 14px; text-transform: uppercase; } .resumo-box { border: 2px solid #0038a8; padding: 15px; border-radius: 8px; margin-bottom: 20px; background: #f8fafc; } .resumo-title { font-weight: bold; color: #0038a8; font-size: 16px; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px; } table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; } th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; font-size: 12px; text-transform: uppercase; } th { background-color: #f0f0f0; color: #333; font-weight: bold; } .status-CONFIRMADO { color: #15803d; font-weight: bold; } .status-PENDENTE { color: #d65a00; font-weight: bold; } .pos { width: 30px; text-align: center; font-weight: bold; color: #666; } .cat-title { background: #0038a8; color: white; padding: 8px; font-weight: bold; font-size: 14px; border-radius: 4px 4px 0 0; margin-bottom: 0; margin-top: 20px; } .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #999; } @media print { @page { margin: 1cm; size: A4 portrait; } button { display: none !important; } body { padding: 0; } .cat-title { background-color: #0038a8 !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .resumo-box { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }</style></head><body><div style="text-align:center; margin-bottom: 20px; display: flex; justify-content: center; gap: 15px;"><button onclick="window.print()" style="padding:12px 24px; font-size:14px; font-weight:bold; background:#009b3a; color:white; border:none; border-radius:6px; cursor:pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">🖨️ SALVAR COMO PDF / IMPRIMIR</button><button onclick="window.close()" style="padding:12px 24px; font-size:14px; font-weight:bold; background:#d50000; color:white; border:none; border-radius:6px; cursor:pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">❌ FECHAR</button></div><h1>${evt.t}</h1><h2>RELAÇÃO OFICIAL DE INSCRITOS</h2><div class="resumo-box"><div class="resumo-title">RESUMO DO EVENTO</div><p style="margin: 5px 0;"><b>TOTAL GERAL DE INSCRITOS:</b> ${totalInscritos} atleta(s)</p><p style="margin: 5px 0;"><b>VALOR ARRECADADO (APENAS PAGOS):</b> R$ ${totalArrecadado.toFixed(2).replace('.', ',')}</p><div style="margin-top: 15px; border-top: 1px dashed #ccc; padding-top: 10px;"><b style="font-size: 12px; color: #666; display: block; margin-bottom: 8px;">INSCRITOS POR CATEGORIA:</b><div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px;">`;
    let catKeys = Object.keys(contagemPorCategoria).sort();
    catKeys.forEach(cat => { html += `<div style="font-size: 11px; background: white; padding: 5px 8px; border: 1px solid #ddd; border-radius: 4px;"><b>${cat}:</b> ${contagemPorCategoria[cat]}</div>`; });
    html += `</div></div></div>`; 
    catKeys.forEach(cat => {
        let atletasCat = inscritos.filter(a => a.cat === cat).sort((a,b) => a.nome.localeCompare(b.nome));
        html += `<div class="cat-title">${cat} <span style="float: right; font-size: 11px; margin-top: 2px;">(${atletasCat.length} atletas)</span></div><table><thead><tr><th class="pos">#</th><th>NOME DO ATLETA</th><th>CIDADE/UF</th><th style="width: 100px;">STATUS</th></tr></thead><tbody>`;
        atletasCat.forEach((a, idx) => { html += `<tr><td class="pos">${idx + 1}</td><td style="font-weight:bold;">${a.nome}</td><td>${a.city}-${a.uf}</td><td class="status-${a.status}">${a.status}</td></tr>`; });
        html += `</tbody></table>`;
    });
    html += `<div class="footer">Documento gerado oficialmente pelo Sistema FPC/PE em ${new Date().toLocaleString('pt-BR')}</div></body></html>`;
    printWin.document.write(html); printWin.document.close(); setTimeout(() => { printWin.focus(); }, 250);
};

window.abrirModalExportCBC = function() {
    const sel = document.getElementById('export-cbc-evt'); let html = '<option value="">SELECIONE O EVENTO...</option>';
    db.events.forEach(e => { html += `<option value="${e.id}">${e.t}</option>`; }); sel.innerHTML = html; openModal('modal-export-cbc');
};
window.gerarExcelCBC = function() {
    const evtId = document.getElementById('export-cbc-evt').value;
    if(!evtId) return toast("Selecione um evento!", "error");
    const evt = db.events.find(e => String(e.id) === String(evtId));
    if(!evt) return toast("Evento não encontrado", "error");

    const btnClicado = document.activeElement;
    const textoOriginal = btnClicado ? btnClicado.innerHTML : ""; 
    if(btnClicado && btnClicado.tagName === 'BUTTON') { btnClicado.disabled = true;
    btnClicado.innerHTML = '<i class="fas fa-spinner fa-spin"></i> GERANDO...'; } 
    toast("PROCESSANDO PLANILHA...", "info");
    setTimeout(() => {
        try {
            let temposEvt = db.tempos.filter(t => String(t.evtId) === String(evtId));
            let pilotResults = {};
            temposEvt.forEach(t => {
                let key = t.cpf + '_' + t.cat;
                if(!pilotResults[key]) {
                    let u = db.users.find(x => x.cpf === t.cpf) || {};
                    pilotResults[key] = { cpf: t.cpf, nome: t.name, cbc: u.cbc || "", equipe: u.team || "", cidade: t.city, estado: u.uf || "PE", cat: t.cat, qualify: "", final: "", num: u.numero || u.numPlaca || u.placa || "" };
                }
                if(t.runType === 'qualify') pilotResults[key].qualify = t.val;
                if(t.runType === '1st' || !t.runType) pilotResults[key].final = t.val;
            });

            let listArray = Object.values(pilotResults);
            let cats = [...new Set(listArray.map(item => item.cat))].sort();

            let ws_data = []; let merges = []; let rowIndex = 0;

            cats.forEach(cat => {
                let catRow = [ {v: cat, t: 's', s: { font: { bold: true, sz: 12 }, fill: { fgColor: { rgb: "FFFFFF00" } }, alignment: { horizontal: "center", vertical: "center" } } }, "", "", "", "", "", "", "" ];
                ws_data.push(catRow); merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 2 } }); rowIndex++;
                let thStyle = { font: { bold: true }, alignment: { horizontal: "center", vertical: "center" }, border: { top: {style:"thin"}, bottom: {style:"thin"}, left: {style:"thin"}, right: {style:"thin"} } };
                let headerRow = [ {v: "Nº", t: 's', s: thStyle}, {v: "NOME", t: 's', s: thStyle}, {v: "LIC CBC", t: 's', s: thStyle}, {v: "EQUIPE/CLUBE/PATROCINADOR", t: 's', s: thStyle}, {v: "CIDADE", t: 's', s: thStyle}, {v: "ESTADO", t: 's', s: thStyle}, {v: "QUALIFY", t: 's', s: thStyle}, {v: "FINAL", t: 's', s: thStyle} ];
                ws_data.push(headerRow); rowIndex++;
                
                let pilotosDaCat = listArray.filter(p => p.cat === cat);
                pilotosDaCat.sort((a,b) => { let tA = a.final !== "" ? a.final : "99:99.999"; let tB = b.final !== "" ? b.final : "99:99.999"; return tA.localeCompare(tB); });
                let borderStyle = { top: {style:"thin"}, bottom: {style:"thin"}, left: {style:"thin"}, right: {style:"thin"} };
                pilotosDaCat.forEach((p, index) => {
                    ws_data.push([ {v: p.num || (index+1), t: 'n', s: { border: borderStyle, alignment: { horizontal: "center" } }}, {v: p.nome, t: 's', s: { border: borderStyle }}, {v: p.cbc, t: 's', s: { border: borderStyle, alignment: { horizontal: "center" } }}, {v: p.equipe, t: 's', s: { border: borderStyle }}, {v: p.cidade, t: 's', s: { border: borderStyle }}, {v: p.estado, t: 's', s: { border: borderStyle, alignment: { horizontal: "center" } }}, {v: p.qualify === "--:--.---" ? "" : p.qualify, t: 's', s: { border: borderStyle, alignment: { horizontal: "center" } }}, {v: p.final === "--:--.---" ? "" : p.final, t: 's', s: { border: borderStyle, alignment: { horizontal: "center", font: {bold: true} } }} ]);
                    rowIndex++;
                });
                ws_data.push(["", "", "", "", "", "", "", ""]); rowIndex++;
            });

            let ws = XLSX.utils.aoa_to_sheet(ws_data);
            ws['!merges'] = merges;
            ws['!cols'] = [ {wch: 5}, {wch: 40}, {wch: 15}, {wch: 35}, {wch: 25}, {wch: 8}, {wch: 12}, {wch: 12} ];
            let wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Resultados");

            let safeTitle = evt.t.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            let fileName = `Resultados_CBC_${safeTitle}.xlsx`;
            XLSX.writeFile(wb, fileName);
            toast("EXCEL GERADO COM SUCESSO!", "success"); fecharModal('modal-export-cbc');
        } catch (err) { console.error(err); toast("ERRO AO GERAR EXCEL", "error");
        }
        if(btnClicado && btnClicado.tagName === 'BUTTON') { btnClicado.innerHTML = textoOriginal; btnClicado.disabled = false;
        } 
    }, 500);
};

// ==========================================================
// 13. RESULTADOS (LANÇAR, EDITAR, PENALIZAR E RANKING)
// ==========================================================
window.addResult = function() { 
    const evtId = document.getElementById('adm-res-evt').value;
    if(!canManageEvent(evtId)) return toast("VOCÊ NÃO TEM PERMISSÃO NESTE EVENTO", "error"); 
    const cpf = document.getElementById('adm-res-id').value; 
    const name = document.getElementById('adm-res-name-display').value;
    const city = document.getElementById('adm-res-city-edit').value.toUpperCase(); 
    const cat = window.normalizeCatName(document.getElementById('adm-res-cat-edit').value); 
    const val = document.getElementById('adm-res-val').value; 
    const runTypeManual = document.getElementById('adm-res-runtype').value; 
    const editIdxInput = document.getElementById('adm-res-idx-edit').value;
    if(!evtId || !name || !val || !cpf) return toast("PREENCHA TUDO", "error"); 
    if(val.length < 4) return toast("FORMATO DE TEMPO INVÁLIDO", "error");
    const newTime = { evtId: evtId, cpf: cpf, name: name.toUpperCase(), city: city, cat: cat, val: val, status: 'OK', runType: runTypeManual };
    const existingIndex = editIdxInput !== "" ? parseInt(editIdxInput, 10) : db.tempos.findIndex(t => t && String(t.evtId) === String(evtId) && t.cpf === cpf && t.runType === runTypeManual && t.cat === cat );
    const performSave = (idx) => { 
        if(idx > -1) { db.tempos[idx] = newTime;
        } else { db.tempos.push(newTime); } 
        saveDB('tempos');
        dispararPushAtleta(cpf, "Tempo Registrado! ⏱️", `Seu tempo de ${val} acabou de entrar no sistema. Confira sua posição!`); 
        toast("✅ TEMPO ATUALIZADO NO SISTEMA!"); 
        clearResultFormUI(); renderAdmResults(); recalcRanking(); 
        if (document.getElementById('list-tempos')) renderContent('tempos');
    }; 
    
    if (existingIndex > -1 && editIdxInput === "") { 
        showConfirm("SUBSTITUIR TEMPO?", "ATENÇÃO: Este atleta já possui um tempo lançado nesta descida. Deseja SUBSTITUIR pelo novo tempo?", '<i class="fas fa-history" style="color:var(--pe-blue)"></i>', function(res) { 
            if(res) { 
                if(!isSuperAdmin(loggedUser)) { 
                    showPrompt("AUTORIZAÇÃO NECESSÁRIA", "Digite a Senha Master para substituir este tempo:", function(pwd) { if(pwd === db.config.rerunPass) performSave(existingIndex); else toast("SENHA INCORRETA", "error"); }); 
                } else { performSave(existingIndex); } 
            } 
        });
    } else { performSave(existingIndex); } 
};

window.clearResultFormUI = function() { 
    const camposParaLimpar = ['adm-res-search', 'adm-res-name-display', 'adm-res-city-edit', 'adm-res-cat-edit', 'adm-res-num', 'adm-res-val', 'adm-res-id', 'adm-res-idx-edit'];
    camposParaLimpar.forEach(id => { const el = document.getElementById(id); if(el) { el.value = ''; localStorage.removeItem('autosave_' + id); } });
    const searchList = document.getElementById('adm-res-list'); if (searchList) searchList.style.display = 'none';
    document.getElementById('btn-save-res').innerText = "LANÇAR / SALVAR"; const btnCancel = document.getElementById('btn-cancel-res');
    if (btnCancel) btnCancel.style.display = 'none'; 
};
window.clearResultForm = window.clearResultFormUI;

window.selectResPilot = function(cpf, name, city, cat) { const setAndSave = (elId, val) => { const el = document.getElementById(elId);
if(el) { el.value = val; localStorage.setItem('autosave_' + elId, val); } }; setAndSave('adm-res-id', cpf); setAndSave('adm-res-name-display', name); setAndSave('adm-res-city-edit', city); setAndSave('adm-res-cat-edit', cat);
setAndSave('adm-res-search', ''); document.getElementById('adm-res-list').style.display = 'none'; };

window.editRes = function(index) { 
    const execEdit = () => { const t = db.tempos[index];
    if(!t) return; const setAndSave = (elId, val) => { const el = document.getElementById(elId); if(el) { el.value = val;
    localStorage.setItem('autosave_' + elId, val); } }; setAndSave('adm-res-evt', t.evtId); setAndSave('adm-res-id', t.cpf || ""); setAndSave('adm-res-name-display', t.name); setAndSave('adm-res-city-edit', t.city); setAndSave('adm-res-cat-edit', t.cat); setAndSave('adm-res-val', t.val);
    setAndSave('adm-res-idx-edit', index); document.getElementById('btn-save-res').innerText = "SALVAR ALTERAÇÃO"; document.getElementById('btn-cancel-res').style.display = 'block'; };
    if(!isSuperAdmin(loggedUser)) { showPrompt("AUTORIZAÇÃO NECESSÁRIA", "Digite a Senha Master para editar este tempo:", function(pwd) { if(pwd === db.config.rerunPass) execEdit(); else toast("SENHA INCORRETA", "error"); });
    } else { execEdit(); }
};

window.cancelEditRes = function() { ['adm-res-idx-edit', 'adm-res-name-display', 'adm-res-val', 'adm-res-id'].forEach(id => { const el = document.getElementById(id); if(el) { el.value = ''; localStorage.removeItem('autosave_' + id); } });
document.getElementById('btn-save-res').innerText = "LANÇAR / SALVAR"; document.getElementById('btn-cancel-res').style.display = 'none'; };

window.renderAdmResults = function() { 
    const evtId = document.getElementById('adm-res-evt').value;
    const listDiv = document.getElementById('adm-list-results'); 

    // --- ATUALIZA O DROPDOWN DE CATEGORIAS DINAMICAMENTE ---
    const catFilter = document.getElementById('adm-res-filter-cat');
    if (catFilter) {
        const currentSelCat = catFilter.value;
        let catHtml = '<option value="ALL">TODAS CATEGORIAS</option>';
        let catsToShow = [];
        
        if (evtId) {
            const evtObj = db.events.find(e => String(e.id) === String(evtId));
            if (evtObj && evtObj.type === 'NON_OFFICIAL' && evtObj.extraVals) {
                catsToShow = Object.keys(evtObj.extraVals).filter(k => evtObj.extraVals[k] && String(evtObj.extraVals[k]).trim() !== "");
                catsToShow.sort((a,b) => a.localeCompare(b));
            }
        }
        
        if (catsToShow.length === 0 && db.config && db.config.categories) {
            catsToShow = db.config.categories.filter(c => c.active).map(c => c.name).sort((a,b) => a.localeCompare(b));
        }
        
        catsToShow.forEach(c => { catHtml += `<option value="${c}">${c}</option>`; });
        catFilter.innerHTML = catHtml;
        if (currentSelCat && catFilter.querySelector(`option[value="${currentSelCat}"]`)) {
            catFilter.value = currentSelCat;
        }
    }
    // --------------------------------------------------------

    const fCat = catFilter ? catFilter.value : 'ALL'; 
    const fType = document.getElementById('adm-res-filter-type') ? document.getElementById('adm-res-filter-type').value : 'ALL';
    
    if(!evtId) { listDiv.innerHTML = "Selecione um evento."; return; } 
    let results = db.tempos.filter(t => String(t.evtId) === String(evtId));
    if(fCat !== 'ALL') results = results.filter(t => window.normalizeCatName(t.cat) === window.normalizeCatName(fCat)); 
    if(fType !== 'ALL') results = results.filter(t => t.runType === fType);
    results.sort((a,b) => a.val.localeCompare(b.val));
    
    if(results.length === 0) { listDiv.innerHTML = '<div style="padding:15px; text-align:center; color:#999">Nenhum tempo encontrado.</div>'; return; } 
    listDiv.innerHTML = results.map((t, i) => { 
        const realIndex = db.tempos.findIndex(x => x === t); const pName = getPilotName(t.cpf, t.name); const pCityUF = getPilotCityUF(t.cpf, t.city); const cClass = getCatClass(t.cat); let tags = ""; 
        if(t.runType === 'qualify') tags = '<span style="background:#E6E6FA; color:#4B0082; font-size:10px; padding:3px 6px; border-radius:4px; margin-right:3px; font-weight:bold;">QUALIFY</span>'; else if(t.runType === '1st' || !t.runType) tags = '<span style="background:#d4edda; color:#155724; font-size:10px; padding:3px 6px; border-radius:4px; margin-right:3px; font-weight:bold;">OFICIAL</span>'; else if(t.runType === '2nd') tags = '<span style="background:#ffe5b4; color:#d65a00; font-size:10px; padding:3px 6px; border-radius:4px; margin-right:3px; font-weight:bold;">2ª DESCIDA</span>'; 

        let penTag = t.penaltyStr ? ` <span style="color:var(--pe-red); font-size:10px; font-weight:bold; display:block;">(${t.penaltyStr})</span>` : '';
        let valStyle = t.val === 'DNF' ? 'color:var(--pe-red); font-weight:900;' : '';
        return `<div class="adm-card" style="display:flex; flex-direction:column; gap:8px;"><div style="display:flex; justify-content:space-between; align-items:start;"><div><div style="font-weight:bold; font-size:13px;">${pName} <span class="badge-city">${pCityUF}</span></div><div style="margin-top:4px;">${tags} <span class="${cClass}">${t.cat}</span></div></div><div style="text-align:right;"><b style="font-family:monospace; font-size:14px; background:#eee; padding:2px 5px; border-radius:4px; ${valStyle}">${t.val}</b>${penTag}</div></div><div style="display:flex; gap:5px; border-top:1px dashed #eee; padding-top:8px;"><button class="btn-mini-adm" style="background:#d65a00; color:white; flex:1; font-weight:bold;" onclick="aplicarPenalidade('${realIndex}')"><i class="fas fa-stopwatch"></i> PENALIZAR</button><button class="btn-mini-adm" style="background:var(--pe-blue); flex:1;" onclick="editRes('${realIndex}')"><i class="fas fa-pen"></i> EDITAR</button><button class="btn-mini-adm" style="background:var(--pe-red); width:40px;" onclick="deleteRes('${realIndex}')"><i class="fas fa-trash"></i></button></div></div>`; 
    }).join(''); 
};
window.deleteRes = function(index) { 
    const execDelete = () => { showConfirm("EXCLUIR TEMPO?", "Deseja realmente excluir este tempo do sistema?", '<i class="fas fa-trash-alt" style="color:var(--pe-red)"></i>', function(res) { if(res) { database.ref(DB_KEY + '/tempos').once('value').then(snap => { let temposRemotos = snap.val() || []; if(!Array.isArray(temposRemotos)) temposRemotos = Object.values(temposRemotos); const tInfo = temposRemotos[index]; if(tInfo) { window.logAction(`Excluiu tempo do CPF ${tInfo.cpf} na Etapa ID: ${tInfo.evtId}`); } temposRemotos.splice(index, 1); database.ref(DB_KEY + '/tempos').set(temposRemotos).then(() => { toast("ATUALIZADO!"); renderAdmResults(); recalcRanking(); refreshCurrentView(); }); }); } });
    };
    if(!isSuperAdmin(loggedUser)) { showPrompt("AUTORIZAÇÃO NECESSÁRIA", "Digite a Senha Master para excluir este tempo:", function(pwd) { if(pwd === db.config.rerunPass) execDelete(); else toast("SENHA INCORRETA", "error"); });
    } else { execDelete(); }
};

window.aplicarPenalidade = function(index) {
    if(!isSuperAdmin(loggedUser)) return toast("APENAS ADMIN PODE PENALIZAR", "error");
    const tInfo = db.tempos[index]; if(!tInfo || tInfo.val === 'DNF' || tInfo.val === '--:--.---') return toast("TEMPO INVÁLIDO PARA PENALIDADE", "error");
    showPrompt("APLICAR PENALIDADE", `Quantos segundos de penalidade para ${tInfo.name}? (Apenas números)`, function(segundosInput) {
        let sec = parseInt(segundosInput, 10); if(isNaN(sec) || sec <= 0) return toast("VALOR INVÁLIDO", "error");
        let ms = tempoParaMilissegundos(tInfo.val); if(ms === Infinity) return toast("ERRO NO TEMPO", "error");
        ms += sec * 1000; let newMin = Math.floor(ms / 60000); let newSec = Math.floor((ms % 60000) / 1000); let newMs = ms % 1000; let newVal = `${newMin.toString().padStart(2,'0')}:${newSec.toString().padStart(2,'0')}.${newMs.toString().padStart(3,'0')}`;
        db.tempos[index].val = newVal; db.tempos[index].penaltyStr = tInfo.penaltyStr ? `${tInfo.penaltyStr}, +${sec}s` : `+${sec}s`;
        saveDB('tempos'); window.logAction(`Aplicou penalidade de +${sec}s para ${tInfo.name} (Cat: ${tInfo.cat})`); toast(`PENALIDADE DE +${sec}s APLICADA!`, "success"); renderAdmResults(); recalcRanking(); refreshCurrentView();
    });
};

function recalcRanking(filterEvtId = 'ALL') { let pointsMap = {}; if(!db.events || !db.tempos) { db.ranking = []; return;
} db.events.forEach(evt => { if(filterEvtId !== 'ALL' && String(evt.id) !== String(filterEvtId)) return; if(evt.status === 'CANCELLED') return; let timesByCat = {}; let qTimesByCat = {}; const evtTimes = db.tempos.filter(t => String(t.evtId) === String(evt.id)); evtTimes.forEach(t => { if(!timesByCat[t.cat]) timesByCat[t.cat] = []; if(!qTimesByCat[t.cat]) qTimesByCat[t.cat] = []; if(t.runType === '1st' || !t.runType) timesByCat[t.cat].push(t); if(t.runType === 'qualify') qTimesByCat[t.cat].push(t); }); const sortLogic = (a, b) => { if(a.val === 'DNF' && b.val !== 'DNF') return 1; if(b.val === 'DNF' && a.val !== 'DNF') return -1; return a.val.localeCompare(b.val); }; Object.keys(timesByCat).forEach(cat => { timesByCat[cat].sort(sortLogic); const uniquePilots = {}; timesByCat[cat].forEach(t => { if(!uniquePilots[t.cpf] || (t.val !== 'DNF' && uniquePilots[t.cpf].val === 'DNF') || (t.val !== 'DNF' && t.val < uniquePilots[t.cpf].val)) uniquePilots[t.cpf] = t; }); const sortedUnique = Object.values(uniquePilots).sort(sortLogic);
    sortedUnique.forEach((t, index) => { let pts = 0; if(t.val !== 'DNF' && evt.points && index < evt.points.length && evt.points[index] !== "") pts = parseInt(evt.points[index], 10); addPointsToMap(pointsMap, t, pts, false, evt.t); });
}); Object.keys(qTimesByCat).forEach(cat => { qTimesByCat[cat].sort(sortLogic); const uniquePilots = {}; qTimesByCat[cat].forEach(t => { if(!uniquePilots[t.cpf] || (t.val !== 'DNF' && uniquePilots[t.cpf].val === 'DNF') || (t.val !== 'DNF' && t.val < uniquePilots[t.cpf].val)) uniquePilots[t.cpf] = t; }); const sortedUnique = Object.values(uniquePilots).sort(sortLogic); sortedUnique.forEach((t, index) => { let pts = 0; if(t.val !== 'DNF' && evt.qPoints && index < evt.qPoints.length && evt.qPoints[index] !== "") pts = parseInt(evt.qPoints[index], 10); addPointsToMap(pointsMap, t, pts, true, evt.t); }); });
}); let newRanking = Object.values(pointsMap); newRanking.sort((a,b) => b.totalPts - a.totalPts); db.ranking = newRanking;
}

function addPointsToMap(map, t, pts, isQualify, evtName) { if(pts === 0) return; const key = t.cpf + '_' + t.cat;
if(!map[key]) map[key] = { name: t.name, city: t.city, cat: t.cat, cpf: t.cpf, totalPts: 0, qPts: 0, oPts: 0, evts: [] };
map[key].totalPts += pts; if(isQualify) map[key].qPts += pts; else map[key].oPts += pts; if(evtName && !map[key].evts.includes(evtName)) map[key].evts.push(evtName);
}

window.compartilharResultados = function(tipo) {
    const listDiv = document.getElementById('list-' + tipo);
    if (!listDiv || listDiv.innerHTML.trim() === '') return toast("Nenhum dado para compartilhar", "error");
    let printWin = window.open('', '_blank');
    let title = tipo === 'tempos' ? 'Resultados Oficiais' : 'Ranking Geral Oficial';
    let html = `<html><head><title>${title}</title><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"><style>:root { --pe-blue: #0038a8; --pe-red: #d50000; --pe-green: #009b3a; --pe-yellow: #ffe500; } * { box-sizing: border-box !important; } body { font-family: Arial, sans-serif; padding: 20px; color: #333; background: #fff; margin:0; } .print-container { max-width: 800px; margin: 0 auto; background: #fff; padding: 10px; width: 100%; overflow: hidden; } .print-header { padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 20px; color: white; background: var(--pe-blue); -webkit-print-color-adjust: exact; print-color-adjust: exact; } .rank-row { border: 1px solid #ddd; margin-bottom: 5px; padding: 8px; border-radius: 6px; width: 100%; } .badge-city { background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; color: #475569; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .badge-cat, .badge-cat-extra { background: #e0e7ff; color: #3730a3; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .cat-print-page { margin-bottom: 10px; border: 2px solid #0038a8; border-radius: 8px; overflow: hidden; width: 100%; } .cat-title-box { background: #0038a8 !important; color: white !important; padding: 10px; font-weight: bold; text-align: center; text-transform: uppercase; font-size: 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact; } @media print { @page { margin: 1cm; size: A4 portrait; } body { padding: 0; } .print-container { max-width: 100%; width: 100%; padding:0; overflow: hidden; } .cat-print-page { page-break-after: auto !important; page-break-inside: auto !important; break-inside: auto !important; margin-bottom: 15px !important; } .rank-row { page-break-inside: avoid !important; break-inside: avoid !important; width: 100%; } .no-print { display: none !important; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }</style></head><body><div style="text-align:center; margin-bottom:20px;" class="no-print"><button onclick="window.print()" style="padding:12px 24px; background:#009b3a; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">🖨️ IMPRIMIR / SALVAR PDF</button><button onclick="window.close()" style="padding:12px 24px; background:#d50000; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer; margin-left:10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">❌ FECHAR ABA</button></div><div class="print-container">${listDiv.innerHTML}</div></body></html>`;
    printWin.document.write(html); printWin.document.close(); setTimeout(() => { printWin.focus(); }, 250);
};

// ==========================================================
// 14. LIVE TIMING, SERVICE WORKER E PWA
// ==========================================================
window.syncLiveTimes = function(liveData) {
    try {
        let evtId = document.getElementById('adm-res-evt').value;
        if(!evtId) return; let hasChanges = false;
        liveData.forEach(liveAthlete => {
            let cpf = liveAthlete.originalCpf; let cat = liveAthlete.category; let times = liveAthlete.times;
            const updateOrAddTime = (runTypeKey, runTypeDb) => {
                let msVal = times[runTypeKey]; let clockVal = liveAthlete.startClocks ? liveAthlete.startClocks[runTypeKey] : null;
                if (msVal !== null) {
                    let strVal = msToTime(msVal); let existingIndex = db.tempos.findIndex(t => t && String(t.evtId) === String(evtId) && t.cpf === cpf && t.cat === cat && t.runType === runTypeDb);
                    if (existingIndex > -1) { if(db.tempos[existingIndex].val !== strVal) { db.tempos[existingIndex].val = strVal; db.tempos[existingIndex].startClock = clockVal; hasChanges = true; } } else { db.tempos.push({ evtId: evtId, cpf: cpf, name: liveAthlete.name, city: liveAthlete.city, cat: cat, val: strVal, startClock: clockVal, status: 'OK', runType: runTypeDb }); hasChanges = true; }
                }
            };
            updateOrAddTime('qualify', 'qualify'); updateOrAddTime('oficial', '1st'); updateOrAddTime('segunda', '2nd');
        });
        if(hasChanges) { saveDB('tempos'); toast("DADOS DO LIVE SINCRONIZADOS!"); renderAdmResults(); }
    } catch(e) { console.error("Falha ao salvar de volta:", e); }
};

function gatherAndPushData(win) {
    let evtId = document.getElementById('adm-res-evt').value;
    const evtObj = db.events.find(e => String(e.id) === String(evtId));
    let activeCategories = []; 
    if (evtObj && evtObj.type === 'NON_OFFICIAL' && evtObj.extraVals) {
        activeCategories = Object.keys(evtObj.extraVals).filter(k => evtObj.extraVals[k] && String(evtObj.extraVals[k]).trim() !== "").sort((a,b) => a.localeCompare(b));
    } else if (db.config && db.config.categories) {
        activeCategories = db.config.categories.filter(c => c.active).map(c => c.name).sort((a,b) => a.localeCompare(b));
    }
    if (activeCategories.length === 0) activeCategories = ["ELITE", "OPEN (EXTRA)", "RÍGIDA (EXTRA)"];
    
    let liveDataArray = [];
    if (typeof db !== 'undefined' && db.users) { 
        db.users.forEach(u => { 
            let nome = (u.nome || u.name || "").toString().trim().toUpperCase(); 
            let city = (u.cidade || u.city || "-").toString().trim().toUpperCase(); 
            let uf = (u.uf || u.estado || "PE").toString().trim().toUpperCase(); 
            let cityUF = `${city}-${uf}`; 
            
            if(nome && u.inscricoes) { 
                u.inscricoes.forEach(insc => { 
                    if(String(insc.id) === String(evtId) && insc.status === 'CONFIRMADO') { 
                        let cat = window.normalizeCatName ? window.normalizeCatName(insc.extraCat ? insc.extraCat : (u.cat || "GERAL")) : (insc.extraCat || u.cat).toUpperCase(); 
                        
                        if (evtObj && evtObj.type === 'NON_OFFICIAL') {
                            cat = cat.replace(" (EXTRA)", "");
                        }

                        let times = {qualify: null, oficial: null, segunda: null};
                        let startClocks = {qualify: null, oficial: null, segunda: null}; 
                        
                        if (db.tempos) { 
                            db.tempos.forEach(t => { 
                                let timeCat = t.cat;
                                if (evtObj && evtObj.type === 'NON_OFFICIAL') timeCat = timeCat.replace(" (EXTRA)", "");

                                if (String(t.evtId) === String(evtId) && t.cpf === u.cpf && timeCat === cat) { 
                                    let key = t.runType === '1st' ? 'oficial' : (t.runType === '2nd' ? 'segunda' : 'qualify'); 
                                    times[key] = timeToMs(t.val); 
                                    startClocks[key] = t.startClock || null; 
                                } 
                            }); 
                        } 
                        liveDataArray.push({ id: u.cpf + '||' + cat, originalCpf: u.cpf, name: nome, city: cityUF, region: uf, number: u.numero || u.numPlaca || u.placa || "S/N", category: cat, status: 'CONFIRMADO', times: times, startClocks: startClocks, isRerun: false });
                    } 
                });
            } 
        });
    }
    
    if (win && win.receiveData) { win.receiveData(liveDataArray, activeCategories, db.config.rerunPass || "admin123", DB_KEY, evtId);
    }
}

window.forcePushData = function(win) { gatherAndPushData(win); };
window.liveTimingWindow = null;

function launchUnifiedLiveTiming() {
    const btn = document.querySelector('.btn-live-launch');
    const evtId = document.getElementById('adm-res-evt').value; if(!evtId) return toast("SELECIONE UM EVENTO PRIMEIRO", "error");
    const origHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ABRINDO...'; const width = 1280, height = 720;
    const left = (screen.width / 2) - (width / 2); const top = (screen.height / 2) - (height / 2);
    const win = window.open('', 'DHPE_Unified_Live', `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no,directories=no,status=no`);
    if (win) { window.liveTimingWindow = win; const template = document.getElementById('template-live-timing'); win.document.open(); win.document.write(template.innerHTML); win.document.close();
    setTimeout(() => { gatherAndPushData(win); btn.innerHTML = origHtml; }, 600); } else { alert("O navegador bloqueou o pop-up. Permita e tente novamente.");
    btn.innerHTML = origHtml; }
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; setTimeout(() => { const banner = document.getElementById('pwa-install-banner'); if(banner) banner.style.display = 'flex'; }, 2000); });
window.installApp = async () => { if (deferredPrompt) { deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice;
if (outcome === 'accepted') { const banner = document.getElementById('pwa-install-banner'); if(banner) banner.style.display = 'none'; } deferredPrompt = null; } };
window.closeInstallBanner = () => { const banner = document.getElementById('pwa-install-banner'); if(banner) banner.style.display = 'none'; };
if ('serviceWorker' in navigator) { 
    window.addEventListener('load', () => { 
        navigator.serviceWorker.register('./sw.js').then((reg) => { 
            console.log('[SW] Registrado com Sucesso:', reg.scope); 
            reg.update();
        }).catch((err) => { 
            console.error('[SW] Erro no registro:', err); 
        }); 
    });
}

// ==========================================================
// 15. BACKUPS
// ==========================================================
window.downloadBackup = function() { if(!isSuperAdmin(loggedUser) && (!loggedUser || loggedUser.role !== 'ORGANIZER')) return toast("Sem permissão", "error");
if(!db) return toast("Sem dados para salvar", "error"); const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db)); const downloadAnchorNode = document.createElement('a'); downloadAnchorNode.setAttribute("href", dataStr);
downloadAnchorNode.setAttribute("download", "backup_dhpe_" + new Date().toISOString().slice(0,10) + ".json"); document.body.appendChild(downloadAnchorNode); downloadAnchorNode.click(); downloadAnchorNode.remove(); toast("BACKUP BAIXADO!"); };
window.restoreBackup = function() { if(!isSuperAdmin(loggedUser) && (!loggedUser || loggedUser.role !== 'ORGANIZER')) return toast("Sem permissão", "error"); const input = document.getElementById('backup-input-file');
if(input) input.click(); };
window.processRestoreFile = function(input) { const file = input.files[0]; if(!file) return; const reader = new FileReader();
reader.onload = function(e) { try { const restoredDb = JSON.parse(e.target.result);
if(restoredDb && Array.isArray(restoredDb.users)) { showConfirm("RESTAURAR DADOS?", "Isso substituirá TODOS os dados atuais pelos do backup. Continuar?", '<i class="fas fa-exclamation-triangle" style="color:var(--pe-red)"></i>', function(res) { if(res) { db = restoredDb; saveDB(); toast("DADOS RESTAURADOS!"); setTimeout(() => window.location.reload(), 1500); } });
} else { toast("ARQUIVO INVÁLIDO", "error"); } } catch(err) { console.error(err); toast("ERRO AO LER ARQUIVO", "error"); } }; reader.readAsText(file); };

// ==========================================================
// FUNÇÕES DE GERENCIAMENTO DE INSCRIÇÕES E STATUS
// ==========================================================
window.renderInscriptions = function() {
    const evtId = document.getElementById('fin-evt-select').value;
    const listContainer = document.getElementById('fin-list-container');
    if (!listContainer) return;
    
    if (!evtId || evtId === "") {
        listContainer.innerHTML = '<div style="padding:15px; text-align:center; color:#999;">Selecione um evento acima.</div>';
        document.getElementById('fin-total-val').innerText = 'Total: 0';
        document.getElementById('fin-paid-val').innerText = 'Pagos: 0';
        return;
    }

    let inscritos = [];
    let totalArrecadado = 0;
    let totalPagos = 0;
    const isGeral = (evtId === 'ALL');
    db.users.forEach(u => {
        if (u.inscricoes && u.inscricoes.length > 0) {
            u.inscricoes.forEach(i => {
                if (isGeral || String(i.id) === String(evtId)) {
                    let evtObj = db.events.find(e => String(e.id) === String(i.id));
                    if(evtObj) {
                        let catNome = window.normalizeCatName(i.extraCat || u.cat);
                        let valStr = evtObj.val || "0";
                        
                        if (evtObj.type === 'NON_OFFICIAL') {
                            let cleanCat = catNome.replace(" (EXTRA)", "");
                            if (evtObj.extraVals && evtObj.extraVals[catNome] && evtObj.extraVals[catNome].trim() !== "") {
                                valStr = evtObj.extraVals[catNome];
                            } else if (evtObj.extraVals && evtObj.extraVals[cleanCat] && evtObj.extraVals[cleanCat].trim() !== "") {
                                valStr = evtObj.extraVals[cleanCat];
                            }
                            catNome = cleanCat;
                        } else {
                            if (i.extraCat && evtObj.extraVals && evtObj.extraVals[catNome] && evtObj.extraVals[catNome].trim() !== "") {
                                valStr = evtObj.extraVals[catNome];
                            }
                        }
                        
                        let valNum = parseFloat(valStr.replace(',', '.')) || 0;
                        
                        if (i.status === 'CONFIRMADO') {
                            totalArrecadado += valNum;
                            totalPagos++;
                        }

                        inscritos.push({
                            cpf: u.cpf, nome: u.nome, city: u.city, uf: u.uf || 'PE', cat: catNome,
                            status: i.status, evtName: evtObj.t, evtIdInsc: i.id, valDisplay: valStr, 
                            date: i.date || 0
                        });
                    }
                }
            });
        }
    });

    document.getElementById('fin-total-val').innerText = `Total: ${inscritos.length}`;
    document.getElementById('fin-paid-val').innerHTML = `Pagos: ${totalPagos} <span style="font-size:9px; margin-left:5px; opacity:0.8;">(R$ ${totalArrecadado.toFixed(2).replace('.', ',')})</span>`;
    if (currentFilterStatus !== 'ALL') {
        inscritos = inscritos.filter(a => a.status === currentFilterStatus);
    }

    const buscaInput = document.getElementById('inputBuscaAtleta');
    const termo = buscaInput ? buscaInput.value.toLowerCase() : "";
    if (termo) {
        inscritos = inscritos.filter(a => 
            a.nome.toLowerCase().includes(termo) || 
            a.cpf.includes(termo) || 
            a.city.toLowerCase().includes(termo)
        );
    }

    inscritos.sort((a, b) => a.nome.localeCompare(b.nome));

    if (inscritos.length === 0) {
        listContainer.innerHTML = '<div style="padding:15px; text-align:center; color:#999;">Nenhuma inscrição encontrada para este filtro.</div>';
        return;
    }

    listContainer.innerHTML = inscritos.map(a => {
        const isPago = a.status === 'CONFIRMADO';
        const bgStatus = isPago ? '#dcfce7' : '#fff7ed';
        const colorStatus = isPago ? '#166534' : '#c2410c';
        const iconStatus = isPago ? 'fa-check-circle' : 'fa-clock';
        
        const btnAcao = !isPago 
            ? `<button class="btn-mini-adm" style="background:#009b3a; flex:1;" onclick="aprovarInscricao('${a.cpf}', '${a.evtIdInsc}', '${a.cat}')"><i class="fas fa-check"></i> APROVAR</button>` 
            : `<button class="btn-mini-adm" style="background:#d50000; flex:1;" onclick="estornarInscricao('${a.cpf}', '${a.evtIdInsc}', '${a.cat}')"><i class="fas fa-undo"></i> ESTORNAR</button>`;
        
        return `
        <div style="padding:12px; border-bottom:1px solid #eee; background:${isPago ? '#f8fafc' : 'white'};">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                    <b style="font-size:13px; color:var(--pe-blue);">${a.nome}</b>
                    <div style="font-size:10px; color:#666; margin-top:2px;">
                        <span class="badge-city">${a.city}-${a.uf}</span> | Cat: <b>${a.cat}</b>
                        ${isGeral ? `<br><b style="color:#333;">Evento: ${a.evtName}</b>` : ''}
                    </div>
                </div>
                <div style="text-align:right;">
                    <div style="background:${bgStatus}; color:${colorStatus}; font-size:10px; font-weight:900; padding:4px 8px; border-radius:4px; text-transform:uppercase;">
                        <i class="fas ${iconStatus}"></i> ${isPago ? 'PAGO' : 'PENDENTE'}
                    </div>
                    <div style="font-size:11px; font-weight:bold; color:#333; margin-top:5px;">R$ ${a.valDisplay}</div>
                </div>
            </div>
            <div style="display:flex; gap:8px; margin-top:10px;">
                ${btnAcao}
                <button class="btn-mini-adm" style="background:#64748b; width:40px;" onclick="removerInscricao('${a.cpf}', '${a.evtIdInsc}', '${a.cat}')"><i class="fas fa-trash"></i></button>
                <button class="btn-mini-adm" style="background:#25D366; width:40px;" onclick="openWhatsApp('${loggedUser.tel}', 'Olá ${a.nome}, vimos sua inscrição...')"><i class="fab fa-whatsapp"></i></button>
            </div>
        </div>`;
    }).join('');
};

window.filterFinList = function(status) {
    currentFilterStatus = status;
    localStorage.setItem('ui_fin-status', status);
    renderInscriptions();
};

window.filtrarAtletasStatus = function() {
    renderInscriptions(); 
};

// FIX APLICADO NO APROVARINSCRIÇÃO: Agora ele faz o .replace(" (EXTRA)", "") nos dois lados da verificação
window.aprovarInscricao = function(cpf, evtId, cat) {
    if(!isSuperAdmin(loggedUser) && loggedUser.role !== 'ORGANIZER') return toast("SEM PERMISSÃO", "error");
    showConfirm("APROVAR INSCRIÇÃO?", "Confirmar o recebimento do pagamento e liberar o atleta?", '<i class="fas fa-check-circle" style="color:#009b3a"></i>', function(res) {
        if(res) {
            const uIdx = db.users.findIndex(u => u.cpf === cpf);
            if(uIdx > -1 && db.users[uIdx].inscricoes) {
                const iIdx = db.users[uIdx].inscricoes.findIndex(i => String(i.id) === String(evtId) && window.normalizeCatName(i.extraCat || db.users[uIdx].cat).replace(" (EXTRA)", "") === cat.replace(" (EXTRA)", ""));
                
                if(iIdx > -1) {
                    db.users[uIdx].inscricoes[iIdx].status = 'CONFIRMADO';
                    saveDB('users');
                    const author = loggedUser.nome;
                    window.logAction(`Aprovou a inscrição de ${db.users[uIdx].nome} (Cat: ${cat}) no evento ID: ${evtId}`);
                    window.enviarNotificacao(`✅ Seu pagamento foi aprovado! Inscrição confirmada na categoria ${cat}.`, 'USER', cpf, evtId);
                    window.enviarNotificacao(`✅ O(a) org. ${author} APROVOU a inscrição de ${db.users[uIdx].nome} (${cat}).`, 'ADMIN', null, evtId);
                    
                    try {
                        if (database && db.users[uIdx].fcmToken) {
                            database.ref('push_queue').push({
                                token: db.users[uIdx].fcmToken,
                                title: "Inscrição Aprovada! 🚵‍♂️",
                                body: `Sua inscrição na categoria ${cat} foi confirmada pela organização.`,
                                status: "pending",
                                timestamp: Date.now()
                            });
                        }
                    } catch (pushError) {
                        console.log("Notificação Push em background ignorada para não travar a aprovação:", pushError);
                    }
                    
                    toast("INSCRIÇÃO APROVADA!", "success");
                    renderInscriptions();
                } else {
                    toast("ERRO: Inscrição não encontrada no banco.", "error");
                }
            }
        }
    });
};

window.estornarInscricao = function(cpf, evtId, cat) {
    if(!isSuperAdmin(loggedUser) && loggedUser.role !== 'ORGANIZER') return toast("SEM PERMISSÃO", "error");
    showConfirm("VOLTAR PARA PENDENTE?", "Deseja remover a confirmação de pagamento deste atleta?", '<i class="fas fa-undo" style="color:#d50000"></i>', function(res) {
        if(res) {
            const uIdx = db.users.findIndex(u => u.cpf === cpf);
            if(uIdx > -1 && db.users[uIdx].inscricoes) {
                const iIdx = db.users[uIdx].inscricoes.findIndex(i => String(i.id) === String(evtId) && window.normalizeCatName(i.extraCat || db.users[uIdx].cat).replace(" (EXTRA)", "") === cat.replace(" (EXTRA)", ""));
                
                if(iIdx > -1) {
                    db.users[uIdx].inscricoes[iIdx].status = 'PENDENTE';
                    saveDB('users');
                    const author = loggedUser.nome;
                    window.logAction(`Estornou a inscrição de ${db.users[uIdx].nome} (Cat: ${cat}) no evento ID: ${evtId} para PENDENTE`);
                    dispararPushAtleta(cpf, "Inscrição Pendente ⚠️", "Sua inscrição voltou para o status pendente (Estorno).");
                    
                    toast("INSCRIÇÃO ESTORNADA!");
                    renderInscriptions();
                } else {
                    toast("ERRO: Inscrição não encontrada no banco.", "error");
                }
            }
        }
    });
};

window.removerInscricao = function(cpf, evtId, cat) {
    if(!isSuperAdmin(loggedUser) && loggedUser.role !== 'ORGANIZER') return toast("SEM PERMISSÃO", "error");
    showConfirm("APAGAR INSCRIÇÃO?", "Esta ação removerá completamente a inscrição do atleta neste evento.", '<i class="fas fa-trash" style="color:#d50000"></i>', function(res) {
        if(res) {
            const uIdx = db.users.findIndex(u => u.cpf === cpf);
            if(uIdx > -1 && db.users[uIdx].inscricoes) {
                const iIdx = db.users[uIdx].inscricoes.findIndex(i => String(i.id) === String(evtId) && window.normalizeCatName(i.extraCat || db.users[uIdx].cat).replace(" (EXTRA)", "") === cat.replace(" (EXTRA)", ""));
                
                if(iIdx > -1) {
                    db.users[uIdx].inscricoes.splice(iIdx, 1);
                    saveDB('users');
                    const author = loggedUser.nome;
                    window.logAction(`Apagou a inscrição de ${db.users[uIdx].nome} (Cat: ${cat}) no evento ID: ${evtId}`);
                    dispararPushAtleta(cpf, "Inscrição Excluída ❌", "Sua inscrição na etapa foi removida pela organização.");
                    
                    toast("INSCRIÇÃO APAGADA!");
                    renderInscriptions();
                } else {
                    toast("ERRO: Inscrição não encontrada no banco.", "error");
                }
            }
        }
    });
};

// ==========================================================
// FUNÇÃO PARA IMPRIMIR ORDEM DE LARGADA (PAINEL RESULTADOS)
// ==========================================================
window.imprimirOrdemLargadaGeral = function() {
    const evtId = document.getElementById('adm-res-evt').value;
    if (!evtId || evtId === "") return toast("SELECIONE UM EVENTO PRIMEIRO!", "error");
    
    const evt = db.events.find(e => String(e.id) === String(evtId));
    if (!evt) return toast("Evento não encontrado.", "error");

    let inscritos = [];
    db.users.forEach(u => {
        if (u.inscricoes && u.inscricoes.length > 0) {
            u.inscricoes.forEach(i => {
                if (String(i.id) === String(evtId) && i.status === 'CONFIRMADO') {
                    let cat = window.normalizeCatName(i.extraCat || u.cat);
                    
                    let qualifyTime = "99:99.999";
                    let hasQ = false;
                    if (db.tempos) {
                        let tQ = db.tempos.find(t => String(t.evtId) === String(evtId) && t.cpf === u.cpf && t.runType === 'qualify' && t.cat === cat);
                        if (tQ && tQ.val && tQ.val !== '--:--.---' && tQ.val !== 'DNF') {
                            qualifyTime = tQ.val;
                            hasQ = true;
                        }
                    }
                    
                    inscritos.push({
                        nome: u.nome,
                        city: u.city,
                        uf: u.uf || 'PE',
                        cat: cat,
                        num: u.numero || u.numPlaca || u.placa || "",
                        qTime: qualifyTime,
                        hasQ: hasQ
                    });
                }
            });
        }
    });
    
    if (inscritos.length === 0) return toast("Nenhum atleta confirmado neste evento.", "error");
    
    let cats = [...new Set(inscritos.map(a => a.cat))].sort();
    let html = `<html><head><title>Ordem de Largada - ${evt.t}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #000; }
        h1 { text-align: center; text-transform: uppercase; margin-bottom: 5px; font-size: 22px; }
        h2 { text-align: center; font-size: 14px; margin-top: 0; margin-bottom: 20px; color: #555; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 12px; text-transform: uppercase; }
        th { background-color: #eee; font-weight: bold; }
        .cat-title { background-color: #333; color: #fff; padding: 8px; font-weight: bold; font-size: 14px; margin-bottom: 0; margin-top: 15px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .print-btn { display: block; margin: 0 auto 20px auto; padding: 12px 24px; background: #ff9800; color: #fff; border: none; font-weight: bold; cursor: pointer; border-radius: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #999; }
        @media print { 
            .print-btn { display: none !important; } 
            .cat-title { background-color: #333 !important; color: #fff !important; }
        }
    </style></head><body>
    <button class="print-btn" onclick="window.print()">🖨️ IMPRIMIR ORDEM DE LARGADA</button>
    <h1>${evt.t}</h1>
    <h2>ORDEM DE LARGADA OFICIAL</h2>`;
    
    cats.forEach(cat => {
        let pilotos = inscritos.filter(a => a.cat === cat);
        
        pilotos.sort((a, b) => {
            if (a.hasQ || b.hasQ) {
                return b.qTime.localeCompare(a.qTime);
            }
            return a.nome.localeCompare(b.nome);
        });

        html += `<div class="cat-title">${cat} <span style="float: right; font-size: 11px; margin-top: 2px;">(${pilotos.length} atletas)</span></div>
        <table>
            <thead><tr>
                <th style="width: 40px; text-align: center;">ORD.</th>
                <th>NOME DO ATLETA</th>
                <th>CIDADE/UF</th>
                <th style="width: 100px; text-align: center;">QUALIFY</th>
                <th style="width: 120px; text-align: center;">TEMPO OFICIAL</th>
            </tr></thead>
            <tbody>`;
        
        pilotos.forEach((p, idx) => {
            let qDisp = p.hasQ ? p.qTime : "";
            html += `<tr>
                <td style="text-align: center; font-weight: bold; font-size: 14px;">${idx + 1}º</td>
                <td style="font-weight: bold; font-size: 13px;">${p.nome}</td>
                <td>${p.city}-${p.uf}</td>
                <td style="text-align: center; font-family: monospace; color:#666;">${qDisp}</td>
                <td></td>
            </tr>`;
        });
        html += `</tbody></table>`;
    });

    html += `<div class="footer">Gerado pelo Sistema DH-PE • ${new Date().toLocaleString('pt-BR')}</div></body></html>`;

    let printWin = window.open('', '_blank');
    printWin.document.write(html);
    printWin.document.close();
    setTimeout(() => { printWin.focus(); }, 250);
};

// ==========================================================
// FUNÇÕES DE PUSH NOTIFICATION (FCM)
// ==========================================================
window.solicitarPermissaoPush = async function() {
    console.log("1. Iniciando setup do Push...");
    try {
        // Verifica se o navegador suporta notificações
        if (!('Notification' in window)) {
            console.log("ERRO: Este navegador não suporta notificações.");
            return;
        }

        // Verifica se o Firebase base carregou
        if (typeof firebase === 'undefined') {
            console.log("ERRO: Firebase não está carregado.");
            return;
        }

        // Verifica se o motor de Push carregou do index.html
        if (!firebase.messaging || typeof firebase.messaging !== 'function') {
            console.log("ERRO: firebase.messaging não é uma função. O script compat não carregou.");
            return;
        }

        // Inicia o motor
        let messaging;
        try {
            messaging = firebase.messaging();
            console.log("2. Motor de Push iniciado com sucesso.");
        } catch(e) {
            console.log("ERRO ao inicializar firebase.messaging():", e);
            return;
        }

        // Pede a permissão para o usuário (Abre a Janelinha)
        console.log("3. Pedindo permissão ao usuário...");
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log("AVISO: Permissão negada pelo usuário.");
            return;
        }

        // Registra o Service Worker
        console.log("4. Registrando Service Worker no GitHub Pages...");
        const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
        console.log("5. SW Registrado com sucesso!");

        // Busca o Token
        console.log("6. Buscando Token FCM (isso pode demorar alguns segundos)...");
        const token = await messaging.getToken({
            vapidKey: "BOyOBCDy_sTvkuUE18CsXv7juuSuRMsC02NdKKve4KpQBSXqfQKjjyOVhSWYxeQ9KheuBahkbTOu_DfQYXH_PfE",
            serviceWorkerRegistration: registration
        });

        // Salva o Token no Banco
        if (token) {
            console.log("7. ✅ TOKEN RECEBIDO:", token);
            if (loggedUser && loggedUser.fcmToken !== token) {
                const uIdx = db.users.findIndex(u => u.cpf === loggedUser.cpf);
                if (uIdx > -1) {
                    db.users[uIdx].fcmToken = token;
                    loggedUser.fcmToken = token;
                    saveDB('users');
                    updateSessionStorage();
                    console.log("8. ✅ Token salvo no banco de dados com sucesso!");
                }
            } else {
                console.log("8. Token já estava salvo corretamente no banco de dados.");
            }
        } else {
            console.log("ERRO: Nenhum token foi retornado pelo Firebase.");
        }
    } catch (err) {
        console.log("🚨 ERRO FATAL no setup do Push:", err);
    }
};
// ==========================================
// MOTOR DE NOTIFICAÇÕES PREMIUM E LIMPEZA
// ==========================================

// 1. Disparo individual (Atletas)
function dispararPushAtleta(cpfDestino, tituloPremium, mensagemPremium) {
    try {
        const atleta = db.users.find(u => u.cpf === cpfDestino);
        if (atleta && atleta.fcmToken && typeof database !== 'undefined') {
            database.ref('push_queue').push({
                token: atleta.fcmToken,
                title: tituloPremium,
                body: mensagemPremium,
                status: "pending",
                timestamp: Date.now()
            });
        }
    } catch (e) {
        console.log("Erro ao disparar push:", e);
    }
}

// 2. Disparo Geral (Todos)
function dispararPushGeral(tituloPremium, mensagemPremium) {
    try {
        if (typeof database !== 'undefined') {
            db.users.forEach(atleta => {
                if (atleta.fcmToken) {
                    database.ref('push_queue').push({
                        token: atleta.fcmToken,
                        title: tituloPremium,
                        body: mensagemPremium,
                        status: "pending",
                        timestamp: Date.now()
                    });
                }
            });
        }
    } catch (e) {
        console.log("Erro ao disparar push geral:", e);
    }
}

// 3. Limpar Notificações PREMIUM (Mim ou Todos)
window.limparNotificacoesPremium = function(modo) {
    if (!loggedUser) return;
    
    let title = modo === 'TODOS' ? "APAGAR PARA TODOS?" : "APAGAR MINHAS MENSAGENS?";
    let msg = modo === 'TODOS' ? "Isso apagará o histórico de notificações de <b>TODOS OS USUÁRIOS</b> do sistema. Confirma a exclusão global?" : "Deseja limpar a sua lixeira pessoal? Isso não afeta o painel dos outros.";
    let icon = '<i class="fas ' + (modo === 'TODOS' ? 'fa-globe' : 'fa-trash-alt') + '" style="color:var(--pe-red)"></i>';

    showConfirm(title, msg, icon, function(res) {
        if(res) {
            if (modo === 'TODOS') {
                if (!isSuperAdmin(loggedUser)) return toast("APENAS SUPER ADMIN", "error");
                db.notifications = [];
                toast("Lixeira global esvaziada!");
            } else {
                let minhasNotificacoes = window.obterMinhasNotificacoes();
                if (minhasNotificacoes.length === 0) return toast("Sua lista já está vazia.");
                
                minhasNotificacoes.forEach(n => {
                    const idx = db.notifications.findIndex(x => x.id === n.id);
                    if (idx > -1) {
                        if (!db.notifications[idx].deletedBy) db.notifications[idx].deletedBy = [];
                        if (!db.notifications[idx].deletedBy.includes(loggedUser.cpf)) {
                            db.notifications[idx].deletedBy.push(loggedUser.cpf);
                        }
                    }
                });
                toast("Suas notificações foram apagadas!");
            }
            saveDB('notifications');
            window.abrirNotificacoes();
            window.atualizarBadgeNotificacoes();
        }
    });
};

// 4. Limpar Auditoria PREMIUM Inteligente
window.limparAuditoriaOrganizador = function() {
    const filterSelect = document.getElementById('adm-audit-filter');
    const authorTarget = filterSelect ? filterSelect.value : 'ALL';

    if (authorTarget === 'ALL') {
        showConfirm("APAGAR AUDITORIA GERAL?", "ATENÇÃO: Tem certeza que deseja apagar o histórico de <b>TODOS</b> os organizadores?", '<i class="fas fa-exclamation-triangle" style="color:var(--pe-red)"></i>', function(res) {
            if(res) {
                db.auditLog = [];
                saveDB('auditLog');
                renderAuditLog();
                toast("Auditoria geral limpa com sucesso!");
            }
        });
    } else {
        showConfirm("APAGAR REGISTROS?", `Deseja apagar todo o histórico apenas de <b>${authorTarget}</b>?`, '<i class="fas fa-trash-alt" style="color:var(--pe-red)"></i>', function(res) {
            if(res) {
                db.auditLog = db.auditLog.filter(log => log.author !== authorTarget);
                saveDB('auditLog');
                renderAuditLog();
                toast(`Histórico de ${authorTarget} apagado!`);
            }
        });
    }
};
// ==========================================
// 5. DISPARO DE PUSH PARA EQUIPE (ALVO INTELIGENTE)
// ==========================================
window.dispararPushParaEquipe = function(evtId, titulo, mensagem) {
    try {
        if (typeof database !== 'undefined' && db.users) {
            db.users.forEach(u => {
                let temPermissao = false;
                
                // 1. É Super Admin ou Admin Geral? Recebe tudo.
                if (window.isSuperAdmin(u) || u.role === 'ADMIN') {
                    temPermissao = true;
                } 
                // 2. É Organizador? Só recebe se o ID do evento estiver na lista dele.
                else if (u.role === 'ORGANIZER' && u.allowedEvts && u.allowedEvts.includes(String(evtId))) {
                    temPermissao = true;
                }

                // 3. Tem permissão e tem o token salvo no celular? Envia pra fila!
                if (temPermissao && u.fcmToken) {
                    database.ref('push_queue').push({
                        token: u.fcmToken,
                        title: titulo,
                        body: mensagem,
                        status: "pending",
                        timestamp: Date.now()
                    });
                }
            });
        }
    } catch (e) {
        console.log("Erro ao disparar push para a equipe:", e);
    }
};