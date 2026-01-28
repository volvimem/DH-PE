// --- 1. CONFIGURAÇÃO FIREBASE E INICIALIZAÇÃO ---
const firebaseConfig = {
  apiKey: "AIzaSyDilUDfyFsebnbQ9pAXyL7ptbSy5CY_cmk",
  authDomain: "fpc-per.firebaseapp.com",
  databaseURL: "https://fpc-per-default-rtdb.firebaseio.com",
  projectId: "fpc-per",
  storageBucket: "fpc-per.firebasestorage.app",
  messagingSenderId: "817616563956",
  appId: "1:817616563956:web:21dbbbcbb69e0cae10f8a1"
};

// Variáveis Globais
var database = null;
const DB_KEY = 'dhpe_v13_db'; 
const SESS_KEY = 'dhpe_sess_v13'; 
const ADMIN_CPF = "083.276.324-18"; 
const ADMIN_PASS = "0800";
const LAST_TAB_KEY = 'dhpe_last_tab_v13'; 
const LAST_ADM_KEY = 'dhpe_last_adm_v13';
const DEFAULT_POINTS = [50, 45, 40, 35, 30, 26, 24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4, 3, 2, 1];

const DEFAULT_DB = { 
    users: [], events: [], tempos: [], ranking: [], 
    config: { phone: '', theme: {}, labels: {} } 
};

var db = DEFAULT_DB;

try {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        database = firebase.database();
    }
} catch (e) { console.log("Modo Offline"); }

try {
    const localData = localStorage.getItem(DB_KEY);
    if(localData) {
        db = JSON.parse(localData);
        if(!db.users) db.users = [];
        if(!db.events) db.events = [];
        if(!db.tempos) db.tempos = [];
        if(!db.ranking) db.ranking = [];
        if(!db.config) db.config = {};
    }
} catch (e) {
    db = DEFAULT_DB;
}

function saveDB() { 
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    if(database) { database.ref(DB_KEY).set(db); }
}

function cleanCPF(v) { if(!v) return ""; return String(v).replace(/\D/g, ""); } 

function toast(m, loading=false) { 
    const t = document.getElementById('toast'); 
    if(t) { 
        t.innerHTML = loading ? `<i class="fas fa-spinner fa-spin"></i> ${m.toUpperCase()}` : `<i class="fas fa-check"></i> ${m.toUpperCase()}`; 
        t.style.background = loading ? "#0038a8" : "#28a745"; 
        t.classList.add('show'); 
        if(!loading) setTimeout(()=>t.classList.remove('show'), 3000); 
    } 
}
function hideToast() { document.getElementById('toast').classList.remove('show'); }

function getUser() { 
    try { return JSON.parse(localStorage.getItem(SESS_KEY)); } catch(e) { return null; }
}

function saveInput(el) { if(el && el.id && el.type !== 'file') localStorage.setItem('autosave_' + el.id, el.value); }
function restoreInputs() { document.querySelectorAll('input, select').forEach(el => { if(el.id && el.type !== 'file' && localStorage.getItem('autosave_' + el.id)) el.value = localStorage.getItem('autosave_' + el.id); }); }

function ensureAdminExists() {
    const cleanAdminCpf = cleanCPF(ADMIN_CPF);
    const adminIndex = db.users.findIndex(u => cleanCPF(u.cpf) === cleanAdminCpf);
    
    if(adminIndex < 0) {
        db.users.push({ 
            nome: "ABRAAO EVERTON", cpf: ADMIN_CPF, pass: ADMIN_PASS, cat: "ORGANIZAÇÃO", 
            tel: "81900000000", city: "RECIFE", gender:"M", role: "ADMIN", 
            allowedEvts: [], inscricoes: [], selfie: null, secQ: 'time', secA: 'SPORT', team: 'ORGANIZAÇÃO' 
        });
        saveDB();
    } else {
        if(db.users[adminIndex].role !== "ADMIN") {
            db.users[adminIndex].role = "ADMIN";
            saveDB();
        }
    }
}
ensureAdminExists();

function fazerLogin() { 
    const cpfInput = document.getElementById('login-cpf');
    const passInput = document.getElementById('login-pass');
    if(!cpfInput || !passInput) return toast("Erro interno");
    const cpfRaw = cpfInput.value;
    const pass = passInput.value;
    if(!cpfRaw || !pass) return toast("PREENCHA TUDO"); 
    const user = db.users.find(x => cleanCPF(x.cpf) === cleanCPF(cpfRaw) && x.pass === pass); 
    if(user) { 
        loggedUser = user; 
        localStorage.setItem(SESS_KEY, JSON.stringify(user)); 
        toast("LOGIN SUCESSO!");
        initApp(); 
    } else { toast("DADOS INCORRETOS"); } 
}

function fazerLogout() { localStorage.removeItem(SESS_KEY); window.location.reload(true); }

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
    if(!validarCPF(cleanCPF(cpf))) return toast("CPF INVÁLIDO"); 
    const exists = db.users.find(u => cleanCPF(u.cpf) === cleanCPF(cpf)); 
    if(exists) return toast("CPF JÁ CADASTRADO"); 
    const newUser = { nome, cpf, tel, city, gender, pass, cat, secA, team: '', role: 'USER', inscricoes: [], selfie: null, allowedEvts: [] }; 
    db.users.push(newUser); 
    saveDB(); 
    toast("BEM-VINDO!"); 
    loggedUser = newUser; 
    localStorage.setItem(SESS_KEY, JSON.stringify(newUser)); 
    initApp(); 
}

let currentTab = 'calendar'; let loggedUser = null; let currentAdmSection = null; let currentPayId = null;

function trocarTela(id) { 
    document.querySelectorAll('.screen').forEach(e => e.classList.remove('active')); 
    const tela = document.getElementById('screen-' + id); 
    if(tela) tela.classList.add('active'); 
    if(id === 'app') { document.getElementById('main-nav-bar').style.display = 'flex'; document.getElementById('main-app-header').style.display = 'flex'; } else { document.getElementById('main-nav-bar').style.display = 'none'; document.getElementById('main-app-header').style.display = 'none'; } 
}

function nav(t) { 
    currentTab = t; 
    localStorage.setItem(LAST_TAB_KEY, t); 
    document.querySelectorAll('.bar-item').forEach(b => b.classList.remove('active')); 
    if(document.getElementById('btn-'+t)) document.getElementById('btn-'+t).classList.add('active'); 
    document.querySelectorAll('.c-sec').forEach(e => e.style.display='none'); 
    document.getElementById('cont-'+t).style.display='block'; 
    if(t === 'tempos' || t === 'ranking') populatePublicFilters(t); 
    if(t === 'adm') { 
        const isMaster = loggedUser && cleanCPF(loggedUser.cpf) === cleanCPF(ADMIN_CPF);
        if(loggedUser && (loggedUser.role === 'ADMIN' || loggedUser.role === 'ORGANIZER' || isMaster)) { 
            document.getElementById('adm-login-box').style.display = 'none'; 
            document.getElementById('adm-panel-real').style.display = 'block'; 
            openAdmSection(localStorage.getItem(LAST_ADM_KEY) || 'menu'); 
        } else { 
            document.getElementById('adm-login-box').style.display = 'block'; 
            document.getElementById('adm-panel-real').style.display = 'none'; 
        } 
    } else { renderContent(t); } 
}

function tryOpenAdmin() { 
    const isMaster = loggedUser && cleanCPF(loggedUser.cpf) === cleanCPF(ADMIN_CPF);
    if(loggedUser && (loggedUser.role === 'ADMIN' || loggedUser.role === 'ORGANIZER' || isMaster)) nav('adm'); 
    else toast("ACESSO NEGADO"); 
}

function initApp() { 
    trocarTela('app'); 
    const isMaster = loggedUser && cleanCPF(loggedUser.cpf) === cleanCPF(ADMIN_CPF);
    if(loggedUser && (loggedUser.role === 'ADMIN' || loggedUser.role === 'ORGANIZER' || isMaster)) {
        document.getElementById('btn-adm').style.display = 'flex'; 
    } else { 
        document.getElementById('btn-adm').style.display = 'none'; 
    }
    nav(localStorage.getItem(LAST_TAB_KEY) || 'calendar'); 
    updateSupportLink(); 
}

function openAdmSection(sec) { 
    currentAdmSection = sec; localStorage.setItem(LAST_ADM_KEY, sec); 
    document.querySelectorAll('.adm-section').forEach(el => el.style.display = 'none'); 
    document.getElementById('adm-menu').style.display = 'none'; 
    
    if(sec === 'menu') { 
        document.getElementById('adm-menu').style.display = 'grid'; 
        const isMaster = loggedUser && cleanCPF(loggedUser.cpf) === cleanCPF(ADMIN_CPF);
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
        const sel = document.getElementById('fin-evt-select'); 
        sel.innerHTML = '<option value="">SELECIONE...</option><option value="ALL">GERAL</option>' + evts.map(e => `<option value="${e.id}">${e.t}</option>`).join(''); 
    } 
    if(sec === 'organizer') renderOrgList(); 
    if(sec === 'config-global') document.getElementById('adm-cfg-phone').value = db.config.phone || ''; 
}

function backToAdmMenu() { openAdmSection('menu'); }

// --- RENDERIZAÇÃO DE CONTEÚDO ---
function renderContent(t) { 
    if(t === 'calendar') { 
        const hD = document.getElementById('calendar-highlight'); 
        const oD = document.getElementById('calendar-others'); 
        const pD = document.getElementById('calendar-past-bar'); 
        
        if(!db.events || db.events.length === 0) { 
            hD.innerHTML = '<div style="padding:20px;text-align:center">Nenhum evento.</div>'; 
            oD.innerHTML = ''; pD.style.display = 'none'; return; 
        } 
        
        const activeEvents = db.events.filter(e => e.status === 'OPEN' || e.status === 'POSTPONED');
        const inactiveEvents = db.events.filter(e => e.status === 'CLOSED' || e.status === 'CANCELLED');
        
        activeEvents.sort((a,b) => a.closeDate.localeCompare(b.closeDate));
        
        if(inactiveEvents.length > 0) {
            pD.style.display = 'flex';
            pD.innerHTML = inactiveEvents.map(e => `
                <div class="past-event-chip chip-closed">
                    <b style="color:${e.status === 'CANCELLED' ? 'red' : '#333'}">${e.status === 'CANCELLED' ? 'CANCELADO' : 'ENCERRADO'}</b><br>
                    ${e.t}
                </div>
            `).join('');
        } else { pD.style.display = 'none'; }

        const h = activeEvents.length > 0 ? activeEvents[0] : null;

        if (h) {
            const getBadge = (evt) => {
                let txt = "FPC/PE"; let cls = "badge-pe";
                if(evt.type==='CBC') { txt="CBC NACIONAL"; cls="badge-cbc"; }
                if(evt.status==='POSTPONED') { txt="ADIADO"; cls="badge-postponed"; }
                return `<div class="evt-badge ${cls}">${txt}</div>`;
            };
            
            let btnText = "INSCREVER-SE";
            let btnColor = "var(--pe-blue)";
            let btnAction = `iniciarInscricao(${h.id})`;
            
            if(loggedUser && loggedUser.inscricoes) {
                const sub = loggedUser.inscricoes.find(i => i.id == h.id);
                if(sub) {
                    if(sub.status === 'PENDENTE') {
                        btnText = "AGUARDANDO APROVAÇÃO";
                        btnColor = "orange";
                    } else if (sub.status === 'CONFIRMADO') {
                        btnText = "VER TICKET (CONFIRMADO)";
                        btnColor = "green";
                        btnAction = `abrirTicket(${h.id})`;
                    }
                }
            }

            hD.innerHTML = `
            <div class="highlight-event">
                ${getBadge(h)}
                ${h.img ? `<img src="${h.img}">` : ''}
                <div class="event-body">
                    <div style="font-size:14px; font-weight:900; color:var(--pe-blue)">${h.t}</div>
                    <div style="font-size:12px; color:#666">${h.d} ${h.m} | ${h.city}</div>
                    <div style="margin:5px 0; font-size:10px; color:#444">
                        <i class="far fa-clock"></i> Inscrições até: <b>${h.closeDate ? h.closeDate.split('-').reverse().join('/') : '??'}</b>
                    </div>
                    <div class="event-price">INSCRIÇÃO: R$ ${h.val}</div>
                    <div style="display:flex; gap:5px; margin-top:5px;">
                        <button class="btn" style="margin:0; flex:3; background:${btnColor}" onclick="${btnAction}">${btnText}</button>
                        <button class="btn" style="margin:0; flex:1; background:#25D366" onclick="openWhatsApp('${h.wpp}', 'Info Evento')"><i class="fab fa-whatsapp"></i></button>
                    </div>
                </div>
            </div>`;
            
            const others = activeEvents.filter(e => e.id !== h.id);
            oD.innerHTML = others.map(e => `
                <div class="event-card">
                    ${e.img ? `<img src="${e.img}" style="width:100%; height:100px; object-fit:cover; border-bottom:1px solid #eee">` : ''}
                    <div class="event-body">
                        <b>${e.t}</b><br>
                        <span style="font-size:10px">${e.d} | ${e.city}</span><br>
                        <button class="btn" style="margin-top:5px; padding:8px" onclick="iniciarInscricao(${e.id})">VER</button>
                    </div>
                </div>
            `).join('');
        } else {
            hD.innerHTML = '<div style="text-align:center; padding:20px; color:#666">Sem eventos abertos.</div>';
            oD.innerHTML = '';
        }

    } else if (t === 'tempos' || t === 'ranking') { 
        const list = db[t] ? db[t].filter(i => i.status === 'OK' || !i.status) : []; 
        const div = document.getElementById('list-'+t); if(!div) return; 
        const fEvt = document.getElementById('filter-evt-'+t).value; 
        const fCat = document.getElementById('filter-cat-'+t).value; 
        let filteredList = list; 
        if (fEvt !== 'ALL') filteredList = filteredList.filter(i => String(i.evtId) === String(fEvt)); 
        if (fCat === 'KING_OF_HILL') { 
            filteredList.sort((a,b) => a.val.localeCompare(b.val)); 
            filteredList = filteredList.slice(0, 20); 
        } else if (fCat !== 'ALL') { filteredList = filteredList.filter(i => i.cat === fCat); } 
        
        if(filteredList.length === 0) div.innerHTML = '<div style="padding:20px; text-align:center; color:#999">Nenhum resultado.</div>';
        else div.innerHTML = filteredList.map((r, i) => `<div class="rank-row"><div class="rank-pos">${i+1}</div><div class="rank-name">${r.name}<span class="rank-cat">${r.city} - ${r.cat}</span></div><div class="rank-val">${r.val}</div></div>`).join(''); 
    
    } else if (t === 'profile') { 
        if(loggedUser) { 
            document.getElementById('prof-edit-name').value = loggedUser.nome;
            document.getElementById('prof-edit-tel').value = loggedUser.tel;
            document.getElementById('prof-edit-city').value = loggedUser.city;
            document.getElementById('prof-edit-cat').value = loggedUser.cat;
            document.getElementById('prof-edit-team').value = loggedUser.team || "";
            document.getElementById('card-name').innerText = loggedUser.nome;
            document.getElementById('card-cat').innerText = loggedUser.cat;
            document.getElementById('card-cpf').innerText = loggedUser.cpf;
            document.getElementById('card-city').innerText = loggedUser.city;
            document.getElementById('card-team').innerText = (loggedUser.team || "SEM EQUIPE").toUpperCase();
            if(loggedUser.selfie) document.getElementById('card-img-display').src = loggedUser.selfie; 
        } 
    } 
}

function openEditUserModal(cpf){
    const isMaster = loggedUser && cleanCPF(loggedUser.cpf) === cleanCPF(ADMIN_CPF);
    if(!isMaster) return toast("Apenas ADMIN GERAL");

    const u = db.users.find(x => x.cpf === cpf);
    if(u){
        document.getElementById('super-edit-old-cpf').value = u.cpf;
        document.getElementById('super-edit-name').value = u.nome;
        document.getElementById('super-edit-cpf').value = u.cpf;
        document.getElementById('super-edit-city').value = u.city;
        document.getElementById('super-edit-cat').value = u.cat;
        document.getElementById('super-edit-tel').value = u.tel;
        document.getElementById('modal-super-edit').style.display = 'flex';
    }
}

function saveSuperEdit() {
    const oldCpf = document.getElementById('super-edit-old-cpf').value;
    const idx = db.users.findIndex(x => x.cpf === oldCpf);
    
    if(idx > -1) {
        db.users[idx].nome = document.getElementById('super-edit-name').value.toUpperCase();
        db.users[idx].cpf = document.getElementById('super-edit-cpf').value;
        db.users[idx].city = document.getElementById('super-edit-city').value.toUpperCase();
        db.users[idx].cat = document.getElementById('super-edit-cat').value.toUpperCase();
        db.users[idx].tel = document.getElementById('super-edit-tel').value;
        
        saveDB();
        toast("DADOS ALTERADOS COM SUCESSO!");
        document.getElementById('modal-super-edit').style.display = 'none';
        filterPilots('edit-user', true);
    }
}

function salvarFullProfile() {
    if(!loggedUser) return toast("ERRO: NÃO LOGADO");
    const idx = db.users.findIndex(u => cleanCPF(u.cpf) === cleanCPF(loggedUser.cpf));
    if(idx > -1) {
        db.users[idx].tel = document.getElementById('prof-edit-tel').value;
        db.users[idx].team = document.getElementById('prof-edit-team').value.toUpperCase();
        loggedUser = db.users[idx];
        saveDB();
        localStorage.setItem(SESS_KEY, JSON.stringify(loggedUser));
        toast("DADOS SALVOS!");
        renderContent('profile');
    }
}

function addEvent() {
    const btn = document.getElementById('btn-save-event');
    btn.innerText = "SALVANDO...";
    const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value : "";
    const t = getVal('adm-evt-t').toUpperCase();
    const d = getVal('adm-evt-d');
    
    if(!t || !d) { btn.innerText = "SALVAR EVENTO"; return toast("NOME E DATA OBRIGATÓRIOS"); }

    const newPoints = [];
    for(let i=0; i<20; i++) { const el = document.getElementById(`pt-${i}`); if(el) newPoints.push(el.value ? parseInt(el.value) : 0); } 
    
    const evtObj = { 
        id: getVal('adm-evt-id-edit') ? parseInt(getVal('adm-evt-id-edit')) : Date.now(), 
        t: t, d: d, m: getVal('adm-evt-month'), 
        type: getVal('adm-evt-type') || 'PE', 
        city: getVal('adm-evt-c').toUpperCase(), 
        val: getVal('adm-evt-v'), 
        pix: getVal('adm-evt-pix'), 
        status: getVal('adm-evt-status'), 
        points: newPoints, 
        closeDate: getVal('adm-evt-close-date'), 
        open: true, 
        img: null, 
        wpp: document.getElementById('adm-evt-wpp').value 
    }; 

    if(getVal('adm-evt-id-edit')) { 
        const old = db.events.find(e => e.id == evtObj.id); 
        if(old && old.img) evtObj.img = old.img; 
    }

    const finalize = (obj) => {
        const idx = db.events.findIndex(e => e.id == obj.id);
        if(idx > -1) db.events[idx] = obj; else db.events.push(obj); 
        saveDB(); 
        toast("EVENTO SALVO!"); 
        btn.innerText = "SALVAR EVENTO"; 
        renderAdmEvents(); 
        clearEventForm();
    };

    const fileInput = document.getElementById('adm-evt-img'); 
    if (fileInput && fileInput.files[0]) { 
        compressImage(fileInput.files[0], 800, (base64) => { evtObj.img = base64; finalize(evtObj); }); 
    } else { finalize(evtObj); } 
}

function clearEventForm() {
    document.getElementById('adm-evt-id-edit').value = ''; 
    document.getElementById('adm-evt-t').value = ''; 
    document.getElementById('adm-evt-d').value = '';
    document.getElementById('adm-evt-c').value = '';
    document.getElementById('adm-evt-v').value = '';
    document.getElementById('adm-evt-pix').value = '';
    document.getElementById('adm-evt-wpp').value = '';
    document.getElementById('adm-evt-close-date').value = '';
    document.getElementById('adm-evt-img').value = '';
    document.getElementById('btn-save-event').innerText = "SALVAR EVENTO"; 
    renderPointsInputs(DEFAULT_POINTS); 
}

function filterPilots(ctx, force) { 
    const inputEl = document.getElementById(ctx === 'res' ? 'adm-res-search' : (ctx === 'org' ? 'adm-org-search' : 'adm-edit-user-search'));
    const term = inputEl ? inputEl.value.toUpperCase() : "";
    
    let listDivId = 'adm-edit-user-list';
    if(ctx === 'res') listDivId = 'adm-res-list';
    if(ctx === 'org') listDivId = 'adm-org-list-search';
    
    const listDiv = document.getElementById(listDivId);
    
    if(term.length < 2 && !force) { if(listDiv) listDiv.style.display = 'none'; return; } 
    
    let found = db.users.filter(u => u.nome.includes(term) || u.cpf.includes(term) || u.city.includes(term)); 
    
    if(listDiv) {
        listDiv.style.display = 'block'; 
        if(ctx === 'edit-user') {
            listDiv.innerHTML = found.map(u => `
            <div class="adm-card">
                <div><b>${u.nome}</b><br><span style="font-size:10px;color:#666">${u.city} | ${u.cat}</span><br><span style="font-size:9px">${u.cpf}</span></div>
                <div style="display:flex; gap:5px">
                    <button class="btn-mini-adm" style="background:#25D366" onclick="openWhatsApp('${u.tel}')"><i class="fab fa-whatsapp"></i></button>
                    <button class="btn-mini-adm" style="background:#3b82f6" onclick="openEditUserModal('${u.cpf}')"><i class="fas fa-pen"></i></button>
                    <button class="btn-mini-adm" style="background:#ef4444" onclick="delUser('${u.cpf}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>`).join(''); 
        } else if (ctx === 'res') {
             const evtId = document.getElementById('adm-res-evt').value;
             if(evtId) {
                 found = found.filter(u => u.inscricoes.some(i => i.id == evtId && i.status === 'CONFIRMADO'));
                 if(found.length === 0) listDiv.innerHTML = '<div style="padding:10px; color:red">Nenhum piloto CONFIRMADO.</div>'; 
                 else listDiv.innerHTML = found.map(u => `<div class="smart-item" onclick="selectResPilot('${u.cpf}', '${u.nome}', '${u.city}', '${u.cat}')">${u.nome} - ${u.city}</div>`).join('');
             } else {
                 listDiv.innerHTML = '<div style="padding:10px; color:red">Selecione o evento primeiro.</div>';
             }
        }
    }
}

function iniciarInscricao(evtId){ 
    if(!loggedUser) return toast("FAÇA LOGIN PARA INSCREVER-SE");
    const evt = db.events.find(e => e.id == evtId);
    if(!evt) return toast("EVENTO NÃO ENCONTRADO");

    if(!loggedUser.inscricoes) loggedUser.inscricoes = [];
    
    const insc = loggedUser.inscricoes.find(i => i.id == evtId);
    
    if(!insc) {
        currentPayId = {id: parseInt(evtId), name: evt.t};
    } else {
        if(insc.status === 'CONFIRMADO') return abrirTicket(evtId);
        currentPayId = {id: parseInt(evtId), name: evt.t}; 
    }

    document.getElementById('pix-valor-display').innerText = "R$ " + evt.val;
    document.getElementById('pix-copy').innerText = evt.pix || "Chave não cadastrada";
    document.getElementById('modal-pix').style.display = 'flex';
}

function confirmarJaPaguei(){
    // Garante que pega o usuário mais atual do banco
    const dbUserIdx = db.users.findIndex(u => cleanCPF(u.cpf) === cleanCPF(loggedUser.cpf));
    if(dbUserIdx === -1) return toast("Erro de usuário");

    let freshUser = db.users[dbUserIdx];
    if(!freshUser.inscricoes) freshUser.inscricoes = [];

    // Check robusto de ID
    const payId = parseInt(currentPayId.id);

    if(!freshUser.inscricoes.some(i => i.id === payId)){
        freshUser.inscricoes.push({id: payId, status: 'PENDENTE'});
        db.users[dbUserIdx] = freshUser;
        saveDB();
        
        // Atualiza sessão local
        loggedUser = freshUser;
        localStorage.setItem(SESS_KEY, JSON.stringify(loggedUser));
        
        toast("SOLICITAÇÃO ENVIADA!");
    } else {
        toast("JÁ ENVIADO ANTES");
    }
    
    fecharModal('modal-pix');
    renderContent('calendar');
}

function delUser(cpf){
    if(cleanCPF(cpf) === cleanCPF(loggedUser.cpf)) return toast("NÃO PODE SE EXCLUIR");
    if(confirm("TEM CERTEZA?")){
        const i = db.users.findIndex(u => u.cpf === cpf);
        if(i > -1){
            db.users.splice(i, 1);
            saveDB();
            toast("USUÁRIO EXCLUÍDO");
            filterPilots('edit-user', true);
        }
    }
}

function getWppLink(rawPhone, text="") {
    if(!rawPhone) return "#";
    let nums = String(rawPhone).replace(/\D/g, "");
    if(nums.length > 0) {
        if(!nums.startsWith("55") && (nums.length === 10 || nums.length === 11)) nums = "55" + nums;
    }
    const txtEncoded = text ? `?text=${encodeURIComponent(text)}` : '';
    return `https://wa.me/${nums}${txtEncoded}`;
}

function openWhatsApp(rawPhone, text="") {
    const link = getWppLink(rawPhone, text);
    if(link !== "#") window.open(link, '_blank');
    else toast("Telefone inválido");
}

function updateSupportLink() {
    const btn = document.getElementById('btn-support-header');
    if(btn) {
        const phone = (db.config && db.config.phone) ? db.config.phone : "";
        if(phone) {
            btn.href = getWppLink(phone, "Olá, preciso de ajuda no sistema.");
            btn.onclick = null; btn.target = "_blank";
        } else {
            btn.href = "#"; btn.onclick = function(e) { e.preventDefault(); toast("NÚMERO NÃO CONFIGURADO"); };
        }
    }
}

function falarComSuporte(e) { if(!db.config || !db.config.phone) { if(e) e.preventDefault(); toast("SUPORTE NÃO CONFIGURADO"); } }
function saveGlobalConfig(){ db.config.phone = document.getElementById('adm-cfg-phone').value; saveDB(); updateSupportLink(); toast("SALVO"); }
function validarCPF(cpf) { cpf = cpf.replace(/[^\d]+/g,''); if(cpf == '') return false; if (cpf.length != 11 || /^(\d)\1{10}$/.test(cpf)) return false; let add = 0; for (let i=0; i < 9; i ++) add += parseInt(cpf.charAt(i)) * (10 - i); let rev = 11 - (add % 11); if (rev == 10 || rev == 11) rev = 0; if (rev != parseInt(cpf.charAt(9))) return false; add = 0; for (let i = 0; i < 10; i ++) add += parseInt(cpf.charAt(i)) * (11 - i); rev = 11 - (add % 11); if (rev == 10 || rev == 11) rev = 0; if (rev != parseInt(cpf.charAt(10))) return false; return true; }
function mascaraCPF(i) { let v = i.value.replace(/\D/g, ""); i.value = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"); i.classList.remove('valid', 'invalid'); if(v.length >= 11) { if(validarCPF(v)) i.classList.add('valid'); else i.classList.add('invalid'); } saveInput(i); }
function mascaraTel(i) { let v = i.value.replace(/\D/g, ""); i.value = v.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3"); saveInput(i); }
function mascaraDias(i) { let v=i.value.replace(/\D/g,""); if(v.length>4) v=v.substring(0,4); if(v.length>2) v=v.substring(0,2)+'/'+v.substring(2); i.value=v; saveInput(i); }
function togglePass(id) { const el = document.getElementById(id); if(el) el.type = el.type === 'password' ? 'text' : 'password'; }
function buscarUsuarioRecuperacao() { const cpf = document.getElementById('rec-cpf').value; const u = db.users.find(u => cleanCPF(u.cpf) === cleanCPF(cpf)); if(u) { document.getElementById('rec-security-area').style.display = 'block'; document.getElementById('btn-buscart-rec').style.display = 'none'; toast("ENCONTRADO"); } else { toast("NÃO ENCONTRADO"); } }
function revelarSenha() { const cpf = document.getElementById('rec-cpf').value; const ans = document.getElementById('rec-answer').value.toUpperCase(); const u = db.users.find(u => cleanCPF(u.cpf) === cleanCPF(cpf)); if(u && u.secA === ans) { alert("SENHA: " + u.pass); fecharModal('modal-recovery'); trocarTela('login'); } else { toast("RESPOSTA ERRADA"); } }
function renderPointsInputs(pts) { const grid = document.getElementById('evt-points-grid'); if(!grid) return; grid.innerHTML = pts.map((p, i) => `<input type="number" id="pt-${i}" value="${p}" class="input-field" style="text-align:center">`).join(''); }
function copyPointsFrom(sourceId) { if(!sourceId) return; const evt = db.events.find(e => e.id == sourceId); if(evt && evt.points) { renderPointsInputs(evt.points); toast("COPIADO!"); } }
function renderAdmEvents() { const list = db.events || []; document.getElementById('adm-list-events').innerHTML = list.map((e, i) => ` <div class="adm-card"> <div><b>${e.t}</b> <br> ${e.d} | ${e.status}</div> <div style="display:flex; gap:5px"> <button class="btn-mini-adm" style="background:#3b82f6" onclick="editEvent(${e.id})"><i class="fas fa-pen"></i></button> <button class="btn-mini-adm" style="background:#ef4444" onclick="delEvent('${e.id}')"><i class="fas fa-trash"></i></button> </div> </div>`).join(''); }
function editEvent(id) { const e = db.events.find(ev => ev.id == id); if(e) { document.getElementById('adm-evt-id-edit').value = e.id; document.getElementById('adm-evt-t').value = e.t; document.getElementById('adm-evt-d').value = e.d; document.getElementById('adm-evt-c').value = e.city; document.getElementById('adm-evt-v').value = e.val; document.getElementById('adm-evt-pix').value = e.pix || ''; document.getElementById('adm-evt-status').value = e.status || 'OPEN'; document.getElementById('adm-evt-close-date').value = e.closeDate || ''; document.getElementById('btn-save-event').innerText = "ATUALIZAR"; } }
function delEvent(id) { if(confirm("Excluir?")) { const idx = db.events.findIndex(e => e.id == id); if(idx > -1) { db.events.splice(idx, 1); saveDB(); renderAdmEvents(); } } }
function persistEventForm() { saveInput(document.getElementById('adm-evt-t')); }
function populatePublicFilters(t) { const evtSel = document.getElementById('filter-evt-' + t); const catSel = document.getElementById('filter-cat-' + t); if (!evtSel || !catSel) return; let htmlEvt = '<option value="ALL">GERAL</option>'; db.events.forEach(e => { htmlEvt += `<option value="${e.id}">${e.t}</option>`; }); evtSel.innerHTML = htmlEvt; let source = (t === 'tempos') ? db.tempos : db.ranking; let cats = [...new Set(source.map(i => i.cat))].sort(); let htmlCat = '<option value="ALL">CATEGORIAS</option>'; cats.forEach(c => { htmlCat += `<option value="${c}">${c}</option>`; }); catSel.innerHTML = htmlCat; }
function uploadSelfie(input){ if(input.files[0]){ compressImage(input.files[0],300,(base64)=>{ if(loggedUser){loggedUser.selfie=base64;saveDB();} const c = document.getElementById('card-img-display'); if(c) c.src=base64; }); } }
function compressImage(file, maxWidth, callback) { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = event => { const img = new Image(); img.src = event.target.result; img.onload = () => { const canvas = document.createElement('canvas'); let width = img.width; let height = img.height; if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; } canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height); callback(canvas.toDataURL('image/jpeg', 0.7)); }; }; }
function enviarComprovanteWhatsApp(){ const evt = db.events.find(e => e.id == currentPayId.id); const phone = (evt && evt.wpp) ? evt.wpp : db.config.phone; openWhatsApp(phone, `Comprovante: ${currentPayId.name}`); }
function falarZapTicket(){ openWhatsApp(db.config.phone, "Duvida Ticket"); }
function verCartaz(id){const evt=db.events.find(e=>e.id==id);if(evt&&evt.img){document.getElementById('img-poster-view').src=evt.img;document.getElementById('modal-poster').style.display='flex';}}
function fecharModal(id){document.getElementById(id).style.display='none';}
function openModal(id){document.getElementById(id).style.display='flex';}
function toggleNovoEventoForm(){const f=document.getElementById('form-novo-evento');f.style.display=f.style.display==='none'?'block':'none';}
function editarUsuario(cpf){openEditUserModal(cpf);}
function navToRegister(){trocarTela('cadastro');}
function salvarDadosPerfil(){salvarFullProfile();}
function toggleCarteirinha(){const a=document.getElementById('carteirinha-area');a.style.display=a.style.display==='none'?'block':'none';}
function copiarPix(){navigator.clipboard.writeText(document.getElementById('pix-copy').innerText);toast("COPIADO!");}
function shareTicketImage(){baixarImagem('ticket-capture-area', 'ticket_dhpe');}
function showPublicPoints(){openModal('modal-points');}
function filterFinList(s){currentFilterStatus=s;renderInscriptions();}
function promoteToOrganizer() { const cpf = document.getElementById('adm-org-selected-cpf').value; const idx = db.users.findIndex(u => u.cpf === cpf); if(idx > -1) { db.users[idx].role = 'ORGANIZER'; saveDB(); toast("PROMOVIDO!"); renderOrgList(); } }
function abrirTicket(evtId) { const evt = db.events.find(e=>e.id==evtId); document.getElementById('share-event-name').innerText = evt.t; document.getElementById('share-piloto-name').innerText = loggedUser.nome; document.getElementById('modal-share').style.display = 'flex'; }
function delItem(col, idx){ if(confirm("Deletar?")){ if(col==='tempos'){const id=db.tempos[idx].evtId;db.tempos.splice(idx,1);recalcEventRanking(id);} else {db[col].splice(idx,1);} saveDB(); renderAdmResults(); } }
function selectHistPilot(cpf) { const user = db.users.find(u => u.cpf === cpf); if(!user) return; document.getElementById('adm-hist-list').style.display = 'none'; document.getElementById('hist-result-area').style.display = 'block'; document.getElementById('hist-name').innerText = user.nome; }
function selectResPilot(cpf, name, city, cat) { document.getElementById('adm-res-id').value = cpf; document.getElementById('adm-res-name-display').value = name; document.getElementById('adm-res-city-edit').value = city; document.getElementById('adm-res-cat-edit').value = cat; document.getElementById('adm-res-search').value = ''; document.getElementById('adm-res-list').style.display = 'none'; }
function selectOrgPilot(cpf, name) { document.getElementById('adm-org-selected-cpf').value = cpf; document.getElementById('adm-org-search').value = name; document.getElementById('adm-org-list-search').style.display = 'none'; document.getElementById('org-perms-area').style.display = 'block'; }
function toggleOrgList() { const list = document.getElementById('adm-list-orgs'); list.style.display = list.style.display === 'none' ? 'block' : 'none'; }
function editRes(idx) { const t = db.tempos[idx]; document.getElementById('adm-res-evt').value = t.evtId; document.getElementById('adm-res-id').value = ""; document.getElementById('adm-res-name-display').value = t.name; document.getElementById('adm-res-val').value = t.val; document.getElementById('adm-res-idx-edit').value = idx; document.getElementById('btn-save-res').innerText = "SALVAR"; document.getElementById('btn-cancel-res').style.display = 'block'; }
function cancelEditRes() { document.getElementById('adm-res-idx-edit').value = ""; document.getElementById('btn-save-res').innerText = "LANÇAR"; document.getElementById('btn-cancel-res').style.display = 'none'; }
function renderAdmResults() { const evtId = document.getElementById('adm-res-evt').value; document.getElementById('adm-list-results').innerHTML = db.tempos.filter(t => t.evtId == evtId).map((t, i) => `<div>${t.name} - ${t.val}</div>`).join(''); }
function refreshAdmLists() { renderAdmResults(); }
function approveRes(idx) { db.tempos[idx].status = 'OK'; saveDB(); renderAdmResults(); }
function maskTimeOrPoints(i){ let v = i.value.replace(/\D/g, ""); if(v.length > 7) v = v.substring(0, 7); if(v.length > 4) v = v.substring(0, 2) + ':' + v.substring(2, 4) + '.' + v.substring(4); i.value = v; }
function updateLiveFilterConfig() { localStorage.setItem('live_filter_cat', document.getElementById('adm-live-cat-selector').value); }
function recalcEventRanking(evtId) { if (!db.tempos) return; const tempos = db.tempos.filter(t => t.evtId == evtId).sort((a,b)=>a.val.localeCompare(b.val)); db.ranking = db.ranking.filter(r => r.evtId != evtId); tempos.forEach((t, i) => db.ranking.push({evtId: t.evtId, name: t.name, cat: t.cat, city: t.city, val: (i < 20 ? [50,45,40,35,30,26,24,22,20,18,16,14,12,10,8,6,4,3,2,1][i] : 0) + ' PTS', status: 'OK'})); }
function addResult() { const evtId = document.getElementById('adm-res-evt').value; const name = document.getElementById('adm-res-name-display').value; const val = document.getElementById('adm-res-val').value; if(!evtId || !name || !val) return toast("Preencha"); db.tempos.push({evtId, name, cat: document.getElementById('adm-res-cat-edit').value, city: document.getElementById('adm-res-city-edit').value, val, num: document.getElementById('adm-res-num').value, status: 'OK'}); recalcEventRanking(evtId); saveDB(); renderAdmResults(); toast("Lançado"); }
function checkAdmPass(){if(document.getElementById('adm-pass-check').value===ADMIN_PASS){document.getElementById('adm-login-box').style.display='none';document.getElementById('adm-panel-real').style.display='block';backToAdmMenu();}else toast("ERRO");}
function resetSystemData() { if(confirm("Apagar tudo?")) { if(prompt("Digite ZERAR") === "ZERAR") { db.tempos = []; db.ranking = []; saveDB(); toast("RESETADO"); } } }
function sairModoLive() { if(chronoInterval) clearInterval(chronoInterval); document.getElementById('screen-live-monitor').style.display = 'none'; document.getElementById('main-app-container').style.display = 'flex'; renderContent('adm'); }

document.addEventListener('DOMContentLoaded', () => { const urlParams = new URLSearchParams(window.location.search); if (urlParams.get('mode') === 'live') { document.getElementById('main-app-container').style.display = 'none'; document.getElementById('screen-live-monitor').style.display = 'flex'; document.getElementById('screen-live-monitor').classList.add('fullscreen-mode'); iniciarLiveLoop(); return; } restoreInputs(); document.querySelectorAll('input').forEach(el => { el.addEventListener('input', () => saveInput(el)); }); const b = document.getElementById('btn-acessar'); if(b) b.addEventListener('click', fazerLogin); const s = getUser(); if(s && db.users) { loggedUser = db.users.find(u=>cleanCPF(u.cpf)===cleanCPF(s.cpf)); if(loggedUser) initApp(); } });
