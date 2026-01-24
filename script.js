window.onerror = function(msg, url, line) { alert("ERRO: " + msg + "\nLinha: " + line); return true; };
function appRefresh() { window.location.reload(true); }

const DB_KEY = 'dhpe_v01_db'; const SESS_KEY = 'dhpe_sess_v01'; const REMEMBER_KEY = 'dhpe_remember_token_v01';
const ADMIN_CPF = "083.276.324-18"; const ADMIN_PASS = "0800"; 
const LAST_TAB_KEY = 'dhpe_last_tab_v01';
const LAST_ADM_KEY = 'dhpe_last_adm_v01';
const FORM_STATE_KEY = 'dhpe_form_state_v01';
const EVENT_FORM_KEY = 'dhpe_event_form_v01';
const DARK_MODE_KEY = 'dhpe_dark_mode';

const OLD_KEYS = ['dhpe_v59_1_db'];

// Usuário Admin Padrão
const usersList = [{ nome: "ABRAAO EVERTON LOPES DE ARAUJO", cpf: ADMIN_CPF, pass: ADMIN_PASS, cat: "ORGANIZAÇÃO", tel: "81900000000", city: "RECIFE", gender:"M", role: "ADMIN", allowedEvts: [], inscricoes: [], selfie: null, secQ: 'time', secA: 'SPORT' }];

const DEFAULT_POINTS = [50, 45, 40, 35, 30, 26, 24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4, 3, 2, 1];
const DEFAULT_DB = {
    users: usersList,
    events: [{ id:1, d:'25/26', m:'ABR', city:'OURICURI-PE', t:'1ª ETAPA ESTADUAL', val: "100,00", est:true, cbc:false, open:true, img:null, points: [...DEFAULT_POINTS], status: 'OPEN', closeDate: '', pix: '' }],
    tempos: [], ranking: [],
    config: { phone: '' } 
};

function cleanCPF(v) { return v ? v.replace(/\D/g, "") : ""; } 

// --- 1. PERSISTÊNCIA DE FORMULÁRIO ---
function saveInput(el) {
    if(el.id) localStorage.setItem('autosave_' + el.id, el.value);
}

function restoreInputs() {
    document.querySelectorAll('input, select, textarea').forEach(el => {
        if(el.id && localStorage.getItem('autosave_' + el.id)) {
            el.value = localStorage.getItem('autosave_' + el.id);
        }
    });
}

// --- 2. VALIDAÇÃO CPF VISUAL ---
function mascaraCPF(i) { 
    let v = i.value.replace(/\D/g, "").substring(0, 11); 
    i.value = v.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2"); 
    if(validarCPF(i.value)) { i.classList.add('valid'); i.classList.remove('invalid'); }
    else { i.classList.add('invalid'); i.classList.remove('valid'); }
    saveInput(i); 
}

function validarCPF(strCPF) {
    strCPF = strCPF.replace(/[^\d]+/g,'');
    if (strCPF == '') return false;
    if (strCPF.length != 11 || /^(\d)\1{10}$/.test(strCPF)) return false;
    let add = 0; for (let i=0; i < 9; i ++) add += parseInt(strCPF.charAt(i)) * (10 - i);
    let rev = 11 - (add % 11); if (rev == 10 || rev == 11) rev = 0;
    if (rev != parseInt(strCPF.charAt(9))) return false;
    add = 0; for (let i = 0; i < 10; i ++) add += parseInt(strCPF.charAt(i)) * (11 - i);
    rev = 11 - (add % 11); if (rev == 10 || rev == 11) rev = 0;
    if (rev != parseInt(strCPF.charAt(10))) return false;
    return true;
}

function mascaraTel(i) { let v = i.value.replace(/\D/g, "").substring(0, 11); v = v.replace(/^(\d{2})(\d)/g, "($1) $2"); v = v.replace(/(\d)(\d{4})$/, "$1-$2"); i.value = v; saveInput(i); }
function mascaraData(i) { let v = i.value.replace(/\D/g,""); if(v.length > 4) v = v.substring(0,4); if(v.length > 2) v = v.substring(0,2) + '/' + v.substring(2); i.value = v; saveInput(i); }
function togglePass(id) { const el = document.getElementById(id); el.type = el.type === 'password' ? 'text' : 'password'; }

// MIGRATION LOGIC
let db = JSON.parse(localStorage.getItem(DB_KEY));
if(!db) {
    for(let key of OLD_KEYS) {
        const oldData = localStorage.getItem(key);
        if(oldData) {
            try {
                db = JSON.parse(oldData);
                console.log("Migrado de " + key);
                break;
            } catch(e) {}
        }
    }
}
if(!db) db = DEFAULT_DB;
if(!db.config) db.config = { phone: '' };

// GARANTE QUE O ADMIN EXISTE E ESTÁ CORRETO (Correção 1)
const adminIndex = db.users.findIndex(u => cleanCPF(u.cpf) === cleanCPF(ADMIN_CPF));
if(adminIndex >= 0) { 
    db.users[adminIndex].role = "ADMIN"; 
    db.users[adminIndex].pass = ADMIN_PASS; 
} else { 
    db.users.push(DEFAULT_DB.users[0]); 
}

db.events.forEach(e => { 
    if(!e.points || e.points.length < 20) e.points = [...DEFAULT_POINTS]; 
    if(!e.status) e.status = 'OPEN';
    if(e.pix === undefined) e.pix = '';
});
saveDB();

// INSTALL PROMPT LOGIC
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); 
    deferredPrompt = e;
    const banner = document.getElementById('install-banner');
    if(banner) banner.style.display = 'block';
    const btnHeader = document.getElementById('header-install-btn');
    if(btnHeader) btnHeader.style.display = 'inline-block';
});

function installPWA() {
    if(deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                document.getElementById('install-banner').style.display = 'none';
                document.getElementById('header-install-btn').style.display = 'none';
            }
            deferredPrompt = null;
        });
    } else {
        alert("Para instalar: Toque em 'Compartilhar' (iPhone) ou 'Mais opções' (Android) e escolha 'Adicionar à Tela de Início'.");
    }
}

let currentTab = localStorage.getItem(LAST_TAB_KEY) || 'calendar'; 
let currentAdmSection = null; let loggedUser = null; let currentPayId = null;

function saveDB() { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
function getUser() { return JSON.parse(localStorage.getItem(SESS_KEY)); }
function toast(m) { const t=document.getElementById('toast'); t.innerText=m.toUpperCase(); t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3000); }

function compressImage(file, maxWidth, callback) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ratio = maxWidth / img.width;
            canvas.width = maxWidth;
            canvas.height = img.height * ratio;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            callback(canvas.toDataURL('image/jpeg', 0.7));
        };
    };
}

function downloadSectionImage(elementId, title) {
    const element = document.getElementById(elementId);
    if(!element || element.innerHTML.trim() === '') return toast("NADA PARA BAIXAR");
    
    toast("GERANDO IMAGEM...");
    html2canvas(element, { scale: 2, useCORS: true, backgroundColor: document.body.classList.contains('dark-mode') ? "#1e1e1e" : "#ffffff" }).then(canvas => {
        const link = document.createElement('a');
        link.download = title + '.png';
        link.href = canvas.toDataURL();
        link.click();
    });
}

function shareTicketImage() {
    const element = document.querySelector('#share-card-content'); 
    if(!element) return;
    toast("GERANDO IMAGEM...");
    html2canvas(element, { scale: 2, useCORS: true }).then(canvas => {
        canvas.toBlob(blob => {
            if (blob) {
                const file = new File([blob], "ticket_dhpe.png", { type: "image/png" });
                if (navigator.share && navigator.canShare({ files: [file] })) {
                    navigator.share({ files: [file], title: 'Meu Ticket DH-PE', text: 'Confirmei minha presença no Campeonato Pernambucano!' }).catch(e => console.log(e));
                } else {
                    const a = document.createElement('a'); a.href = canvas.toDataURL("image/png"); a.download = 'ticket_dhpe.png'; a.click(); alert("Imagem salva! Compartilhe manualmente.");
                }
            }
        });
    });
}

function trocarTela(id) { 
    document.querySelectorAll('.screen').forEach(e=>e.classList.remove('active')); 
    document.getElementById('screen-'+id).classList.add('active'); 
    if(id === 'app') {
        document.getElementById('main-nav-bar').style.display = 'flex';
        document.getElementById('main-app-header').style.display = 'flex';
    } else {
        document.getElementById('main-nav-bar').style.display = 'none';
        document.getElementById('main-app-header').style.display = 'none';
    }
}

function toggleSearch(id) { const el = document.getElementById('search-box-'+id); el.style.display = el.style.display === 'block' ? 'none' : 'block'; }

function toggleUserSearch() { 
    const el = document.getElementById('adm-user-search-wrapper'); 
    const isHidden = el.style.display === 'none';
    el.style.display = isHidden ? 'block' : 'none';
    if(!isHidden) { 
        document.getElementById('adm-edit-user-search').value = '';
        document.getElementById('adm-edit-user-list').style.display = 'none';
    } else {
        document.getElementById('adm-edit-user-search').value = '';
        filterPilots('edit-user', true);
    }
}

// Alteração 4: Dark Mode Logic
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem(DARK_MODE_KEY, isDark ? 'true' : 'false');
}

function loadDarkMode() {
    const isDark = localStorage.getItem(DARK_MODE_KEY) === 'true';
    if(isDark) document.body.classList.add('dark-mode');
}

function nav(t) {
    if(t === 'adm' && (!loggedUser || (loggedUser.role !== 'ADMIN' && loggedUser.role !== 'ORGANIZER'))) return toast("ACESSO NEGADO (APENAS ORGANIZADORES)");
    currentTab = t;
    localStorage.setItem(LAST_TAB_KEY, t);

    document.querySelectorAll('.bar-item').forEach(b => b.classList.remove('active'));
    if(document.getElementById('btn-'+t)) document.getElementById('btn-'+t).classList.add('active');
    document.querySelectorAll('.c-sec').forEach(e => e.style.display='none');
    document.getElementById('cont-'+t).style.display='block';
    
    if(t === 'adm') { 
        if(loggedUser.role === 'ADMIN' || loggedUser.role === 'ORGANIZER') { 
            document.getElementById('adm-login-box').style.display='none'; 
            document.getElementById('adm-panel-real').style.display='block'; 
            
            if(loggedUser.role !== 'ADMIN') document.getElementById('btn-adm-events').style.display = 'none';
            else document.getElementById('btn-adm-events').style.display = 'flex';

            const lastAdm = localStorage.getItem(LAST_ADM_KEY);
            if(lastAdm) openAdmSection(lastAdm);
            else backToAdmMenu(); 
        } else { 
            document.getElementById('adm-pass-check').value = ''; 
            document.getElementById('adm-panel-real').style.display = 'none'; 
            document.getElementById('adm-login-box').style.display = 'block'; 
        }
    } else { 
        localStorage.removeItem(LAST_ADM_KEY); 
        renderContent(t); 
    }
}

function tryOpenAdmin() { if(loggedUser && (loggedUser.role === 'ADMIN' || loggedUser.role === 'ORGANIZER')) nav('adm'); else alert("Painel restrito a Organizadores."); }

function renderContent(t) {
    if(t === 'calendar') {
        const div = document.getElementById('list-calendar');
        const highlightDiv = document.getElementById('calendar-highlight');
        const othersDiv = document.getElementById('calendar-others');
        
        const events = db.events;
        const highlight = events.find(e => e.status === 'OPEN') || events[events.length-1];
        
        const createCard = (e, isHighlight) => {
            const btnPoster = e.img ? `<img src="${e.img}" class="${isHighlight ? 'event-poster-full' : 'card-poster-thumb'}" onclick="verCartaz('${e.id}')">` : '';
            const valShow = e.val ? `<div class="event-price">R$ ${e.val}</div>` : '';
            
            let isClosed = e.status === 'CLOSED';
            if(e.closeDate && new Date().toISOString().split('T')[0] > e.closeDate) isClosed = true;

            let closeDateDisplay = '';
            if(e.closeDate) {
                const parts = e.closeDate.split('-');
                closeDateDisplay = `<div class="event-close-date">ENCERRA EM: ${parts[2]}/${parts[1]}/${parts[0]}</div>`;
            }

            let actionBtn = isClosed 
                ? `<button class="btn-closed">INSCRIÇÕES ENCERRADAS</button>` 
                : `<button class="btn-insc" onclick="iniciarInscricao('${e.id}','${e.t}', '${e.val}')">INSCREVER</button>`;
            
            const btnPoints = `<button class="btn-points" onclick="showPublicPoints(${e.id})">TABELA DE PONTOS</button>`;

            if(loggedUser) {
                const ins = loggedUser.inscricoes.find(i => i.id == e.id);
                if(ins && ins.status === 'CONFIRMADO') { actionBtn = `<button class="btn-share" onclick="openShareModal('${e.t}')"><i class="fab fa-instagram"></i> TICKET</button>`; } 
                else if(ins) { actionBtn = `<button class="btn-insc" style="background:orange">PENDENTE</button>`; }
                else if(isClosed) { actionBtn = `<button class="btn-closed">ENCERRADO</button>`; }
            }
            
            const cardClass = isHighlight ? 'highlight-event' : 'event-card';
            return `<div class="${cardClass} ${e.status==='CLOSED'?'closed':''}">
                        ${isHighlight ? '' : `<div class="event-top"><span class="event-date">${e.d} ${e.m}</span></div>`}
                        ${isHighlight ? btnPoster : ''}
                        <div class="event-body">
                            ${isHighlight ? `<h2 style="color:#0038a8; margin:0" class="event-title">${e.t}</h2><p>${e.d} ${e.m} - ${e.city}</p>` : `<div class="event-title">${e.t}</div>`}
                            ${!isHighlight ? btnPoster : ''}
                            ${valShow}
                            ${!isHighlight ? `<div class="event-city"><i class="fas fa-map-marker-alt"></i> ${e.city}</div>` : ''}
                            ${closeDateDisplay}
                            <div class="badge-box">${e.est?'<span class="badge-pe">PE</span>':''}${e.cbc?'<span class="badge-cbc">CBC</span>':''}</div>
                            ${btnPoints}
                            ${actionBtn}
                        </div>
                    </div>`;
        };

        if(highlight) {
            highlightDiv.innerHTML = createCard(highlight, true);
            othersDiv.innerHTML = events.filter(e => e.id !== highlight.id).map(e => createCard(e, false)).join('');
        } else {
            highlightDiv.innerHTML = '';
            othersDiv.innerHTML = events.map(e => createCard(e, false)).join('');
        }

    } else if (t === 'tempos' || t === 'ranking') {
        const list = db[t].filter(i => i.status === 'OK'); 
        const div = document.getElementById('list-'+t);
        const selCat = document.getElementById('filter-cat-'+t);
        const selEvt = document.getElementById('filter-evt-'+t);
        if(selCat.innerHTML === '') { const cats = [...new Set(list.map(i => i.cat))]; selCat.innerHTML = `<option value="ALL">TODAS CATEGORIAS</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join(''); }
        if(selEvt.innerHTML === '' || (selEvt.options.length === 1 && t === 'tempos')) { const evts = db.events; let opts = t==='ranking' ? `<option value="ALL">GERAL (SOMA)</option>` : `<option value="ALL">TODAS ETAPAS</option>`; opts += evts.map(e => `<option value="${e.id}">${e.t}</option>`).join(''); selEvt.innerHTML = opts; }
        let filtered = list;
        if(selCat.value !== 'ALL') filtered = filtered.filter(i => i.cat === selCat.value);
        if(selEvt.value !== 'ALL') filtered = filtered.filter(i => i.evtId == selEvt.value);
        
        div.innerHTML = filtered.map((r, i) => {
            const evt = db.events.find(e => e.id == r.evtId);
            const cityDisplay = evt ? ` - ${evt.city}` : '';
            return `<div class="rank-row"><div class="rank-pos">${i+1}</div><div class="rank-name">${r.name}<span class="rank-cat">${r.cat}${cityDisplay}</span></div><div class="rank-val">${r.val}</div></div>`;
        }).join('');
    }
}

function openAdmSection(sec) {
    if(sec === 'events' && loggedUser.role !== 'ADMIN') { toast("APENAS ADMIN"); return backToAdmMenu(); }

    currentAdmSection = sec;
    localStorage.setItem(LAST_ADM_KEY, sec); 
    
    document.getElementById('adm-menu').style.display = 'none';
    
    if(sec === 'config-global') {
        document.getElementById('adm-sec-config-global').style.display = 'block';
        document.getElementById('adm-cfg-phone').value = db.config.phone || '';
    }
    if(sec === 'events') { 
        document.getElementById('adm-sec-events').style.display='block'; 
        refreshAdmLists(); 
        restoreEventForm();
        const copySel = document.getElementById('adm-copy-points-source');
        copySel.innerHTML = '<option value="">SELECIONE UM EVENTO...</option>' + db.events.map(e => `<option value="${e.id}">${e.t}</option>`).join('');
        const savedPoints = JSON.parse(localStorage.getItem(EVENT_FORM_KEY))?.points;
        const pts = savedPoints || Array(20).fill(0);
        document.getElementById('evt-points-grid').innerHTML = pts.map((p, i) => `<input type="number" placeholder="${i+1}º" id="pt-${i}" value="${p||''}" style="text-align:center; font-size:10px; padding:4px;" oninput="saveEventForm()">`).join('');
    }
    if(sec === 'results') { 
        document.getElementById('adm-sec-results').style.display='block'; refreshAdmLists(); 
        const selEvt = document.getElementById('adm-res-evt'); selEvt.innerHTML = '<option value="">SELECIONE EVENTO...</option>' + db.events.map(e => `<option value="${e.id}">${e.t}</option>`).join('');
        restoreAdmState(); 
    }
    if(sec === 'organizer') {
        document.getElementById('adm-sec-organizer').style.display='block';
        document.getElementById('org-events-list').innerHTML = db.events.map(e => `<label class="perm-item"><input type="checkbox" value="${e.id}" class="perm-cb"> ${e.t}</label>`).join('');
        renderOrgList();
    }
    if(sec === 'users-edit') {
            document.getElementById('adm-sec-users-edit').style.display='block';
    }
    if(sec === 'financial') { 
        document.getElementById('adm-sec-financial').style.display='block'; 
        const sel = document.getElementById('fin-evt-select'); 
        let availableEvents = db.events;
        if(loggedUser.role === 'ORGANIZER' && loggedUser.allowedEvts) {
            availableEvents = db.events.filter(e => loggedUser.allowedEvts.includes(e.id.toString()));
        }
        sel.innerHTML = '<option value="">SELECIONE...</option><option value="ALL">GERAL (TODOS EVENTOS)</option>' + availableEvents.map(e => `<option value="${e.id}">${e.t}</option>`).join(''); 
    }
}

function saveGlobalConfig() {
    db.config.phone = document.getElementById('adm-cfg-phone').value;
    saveDB();
    toast("DADOS SALVOS!");
}

function copyPointsFrom(evtId) {
    if(!evtId) return;
    const evt = db.events.find(e => e.id == evtId);
    if(evt && evt.points) {
        evt.points.forEach((p, i) => {
            const el = document.getElementById('pt-'+i);
            if(el) el.value = p;
        });
        saveEventForm(); 
        toast("PONTUAÇÃO COPIADA!");
    }
}

function saveAdmState() {
    const state = {
        evt: document.getElementById('adm-res-evt').value,
        type: document.getElementById('adm-res-type').value,
        id: document.getElementById('adm-res-id').value,
        text: document.getElementById('adm-res-id').options[0]?.text || '',
        num: document.getElementById('adm-res-num').value,
        val: document.getElementById('adm-res-val').value
    };
    localStorage.setItem(FORM_STATE_KEY, JSON.stringify(state));
}

function restoreAdmState() {
    const saved = JSON.parse(localStorage.getItem(FORM_STATE_KEY));
    if(saved) {
        if(saved.evt) document.getElementById('adm-res-evt').value = saved.evt;
        if(saved.type) document.getElementById('adm-res-type').value = saved.type;
        if(saved.id) {
            const sel = document.getElementById('adm-res-id');
            sel.innerHTML = `<option value="${saved.id}">${saved.text}</option>`;
            sel.value = saved.id;
        }
        if(saved.num) document.getElementById('adm-res-num').value = saved.num;
        if(saved.val) document.getElementById('adm-res-val').value = saved.val;
    }
}

function saveEventForm() {
    const newPoints = [];
    for(let i=0; i<20; i++) {
        const el = document.getElementById(`pt-${i}`);
        newPoints.push(el && el.value ? parseInt(el.value) : 0);
    }

    const state = {
        t: document.getElementById('adm-evt-t').value,
        m: document.getElementById('adm-evt-month').value,
        d: document.getElementById('adm-evt-d').value,
        c: document.getElementById('adm-evt-c').value,
        v: document.getElementById('adm-evt-v').value,
        close: document.getElementById('adm-evt-close-date').value,
        status: document.getElementById('adm-evt-status').value,
        pix: document.getElementById('adm-evt-pix').value,
        points: newPoints
    };
    localStorage.setItem(EVENT_FORM_KEY, JSON.stringify(state));
}

function restoreEventForm() {
    const saved = JSON.parse(localStorage.getItem(EVENT_FORM_KEY));
    if(saved) {
        document.getElementById('adm-evt-t').value = saved.t || '';
        document.getElementById('adm-evt-month').value = saved.m || 'JAN';
        document.getElementById('adm-evt-d').value = saved.d || '';
        document.getElementById('adm-evt-c').value = saved.c || '';
        document.getElementById('adm-evt-v').value = saved.v || '';
        document.getElementById('adm-evt-close-date').value = saved.close || '';
        document.getElementById('adm-evt-status').value = saved.status || 'OPEN';
        document.getElementById('adm-evt-pix').value = saved.pix || '';
    }
}

function clearEventForm() {
    localStorage.removeItem(EVENT_FORM_KEY);
    document.getElementById('adm-evt-id-edit').value = '';
    document.getElementById('adm-evt-t').value = '';
    document.getElementById('adm-evt-d').value = '';
    document.getElementById('adm-evt-c').value = '';
    document.getElementById('adm-evt-v').value = '';
    document.getElementById('adm-evt-close-date').value = '';
    document.getElementById('adm-evt-pix').value = '';
    document.getElementById('btn-save-event').innerText = 'CADASTRAR EVENTO';
    document.getElementById('evt-points-grid').innerHTML = Array(20).fill(0).map((_, i) => `<input type="number" placeholder="${i+1}º" id="pt-${i}" style="text-align:center; font-size:10px; padding:4px;" oninput="saveEventForm()">`).join('');
}

function backToAdmMenu() {
    localStorage.removeItem(LAST_ADM_KEY);
    clearEventForm(); 
    
    document.querySelectorAll('[id^="adm-sub-"]').forEach(e => e.style.display='none'); 
    document.getElementById('adm-sec-events').style.display='none'; document.getElementById('adm-sec-results').style.display='none';
    document.getElementById('adm-sec-organizer').style.display='none'; document.getElementById('adm-sec-financial').style.display='none';
    document.getElementById('adm-sec-users-edit').style.display='none'; document.getElementById('adm-sec-config-global').style.display='none';
    document.getElementById('adm-menu').style.display='grid';
}

function checkAdmPass() { if(document.getElementById('adm-pass-check').value === ADMIN_PASS) { document.getElementById('adm-login-box').style.display='none'; document.getElementById('adm-panel-real').style.display='block'; backToAdmMenu(); } else { toast("SENHA INVÁLIDA"); } }

function filterPilots(ctx, forceShow) {
    const inputId = ctx === 'res' ? 'adm-res-search' : (ctx === 'org' ? 'adm-org-search' : 'adm-edit-user-search');
    const listId = ctx === 'res' ? 'adm-res-list' : (ctx === 'org' ? 'adm-org-list-search' : 'adm-edit-user-list');
    const text = document.getElementById(inputId).value.toUpperCase();
    const listDiv = document.getElementById(listId);
    
    let currentEvtId = null;
    if(ctx === 'res') {
        currentEvtId = document.getElementById('adm-res-evt').value;
        if(!currentEvtId) { listDiv.style.display = 'none'; return; } 
    }

    listDiv.innerHTML = '';
    if(!forceShow && text.length < 2) { if(ctx!=='edit-user') listDiv.style.display = 'none'; return; }
    
    const filtered = db.users.filter(u => {
        const matchesText = (u.nome.includes(text) || u.cpf.includes(text) || u.city.includes(text));
        if(!matchesText) return false;
        if(ctx === 'res') {
            const insc = u.inscricoes.find(i => i.id == currentEvtId);
            return insc && insc.status === 'CONFIRMADO';
        }
        return true;
    });
    
    if(filtered.length === 0) { listDiv.style.display='none'; return; }
    
    listDiv.style.display = 'block';
    listDiv.innerHTML = filtered.map(u => {
        const wppUrl = `https://wa.me/55${u.tel ? u.tel.replace(/\D/g,'') : ''}`;
        let actions = '';
        if(ctx === 'edit-user') {
           actions = `
           <div class="smart-actions">
               <button class="btn-mini-adm btn-green" onclick="window.open('${wppUrl}')"><i class="fab fa-whatsapp"></i></button>
               <button class="btn-mini-adm btn-blue" onclick="openEditUserModal('${u.cpf}')"><i class="fas fa-pen"></i></button>
               <button class="btn-mini-adm btn-red" onclick="deleteUser('${u.cpf}', '${u.nome}')"><i class="fas fa-trash"></i></button>
           </div>`;
        }
        
        return `<div class="smart-item" onclick="${ctx!=='edit-user' ? `selectPilot('${u.cpf}', '${u.nome}', '${ctx}')` : ''}"><div><b>${u.nome}</b><br><span style="color:#666">${u.cat} | ${u.cpf}</span></div>${actions}</div>`;
    }).join('');
}

function deleteUser(cpf, nome) {
    if(confirm("TEM CERTEZA QUE DESEJA EXCLUIR " + nome + "?\nEssa ação é irreversível e remove o atleta do banco de dados local.")) {
        const idx = db.users.findIndex(u => u.cpf === cpf);
        if(idx > -1) {
            db.users.splice(idx, 1);
            saveDB();
            filterPilots('edit-user', true); 
            toast("ATLETA EXCLUÍDO COM SUCESSO!");
        } else {
            toast("Erro ao excluir: Atleta não encontrado.");
        }
    }
}

function selectPilot(cpf, name, ctx) {
    if(ctx === 'res') { 
        const sel = document.getElementById('adm-res-id');
        sel.innerHTML = `<option value="${cpf}">${name}</option>`;
        sel.value = cpf;
        document.getElementById('adm-res-search').value = '';
        document.getElementById('adm-res-list').style.display = 'none'; 
        saveAdmState();
    } 
    else if(ctx === 'org') { 
        document.getElementById('adm-org-selected-cpf').value = cpf; 
        document.getElementById('adm-org-search').value = name; 
        document.getElementById('adm-org-list-search').style.display = 'none'; 
    } 
}

function openEditUserModal(cpf) {
    const u = db.users.find(x => x.cpf === cpf);
    if(u) {
        document.getElementById('edit-user-original-cpf').value = u.cpf;
        document.getElementById('edit-user-name').value = u.nome;
        document.getElementById('edit-user-cpf').value = u.cpf;
        document.getElementById('edit-user-tel').value = u.tel;
        document.getElementById('edit-user-city').value = u.city;
        document.getElementById('edit-user-cat').value = u.cat;
        document.getElementById('edit-user-gender').value = u.gender || 'M';
        document.getElementById('edit-user-pass').value = u.pass;
        document.getElementById('modal-edit-user').style.display = 'flex';
    }
}

function saveUserEdit() {
    const cpf = document.getElementById('edit-user-original-cpf').value;
    const idx = db.users.findIndex(x => x.cpf === cpf);
    
    const newCpf = document.getElementById('edit-user-cpf').value;
    if(!validarCPF(newCpf)) return toast("CPF INVÁLIDO");

    if(idx > -1) {
        db.users[idx].nome = document.getElementById('edit-user-name').value.toUpperCase();
        db.users[idx].cpf = newCpf;
        db.users[idx].tel = document.getElementById('edit-user-tel').value;
        db.users[idx].city = document.getElementById('edit-user-city').value.toUpperCase();
        db.users[idx].cat = document.getElementById('edit-user-cat').value.toUpperCase();
        db.users[idx].gender = document.getElementById('edit-user-gender').value.toUpperCase();
        db.users[idx].pass = document.getElementById('edit-user-pass').value;
        
        saveDB(); toast("DADOS ATUALIZADOS"); fecharModal('modal-edit-user');
        filterPilots('edit-user', true);
    }
}

function promoteToOrganizer() {
    const cpf = document.getElementById('adm-org-selected-cpf').value;
    if(!cpf) return toast("SELECIONE UM ATLETA");
    const perms = []; document.querySelectorAll('.perm-cb:checked').forEach(cb => perms.push(cb.value));
    const idx = db.users.findIndex(u => u.cpf === cpf);
    if(idx > -1) { db.users[idx].role = 'ORGANIZER'; db.users[idx].allowedEvts = perms; db.users[idx].cat = "ORGANIZAÇÃO"; saveDB(); toast("PROMOVIDO!"); document.getElementById('adm-org-search').value = ''; renderOrgList(); }
}

function demoteOrganizer(cpf) {
    if(confirm("REMOVER PERMISSÃO DE ORGANIZADOR?")) {
        const idx = db.users.findIndex(u => u.cpf === cpf);
        if(idx > -1) { db.users[idx].role = 'USER'; db.users[idx].cat = "RÍGIDA"; db.users[idx].allowedEvts = []; saveDB(); renderOrgList(); }
    }
}

function renderOrgList() { document.getElementById('adm-list-orgs').innerHTML = db.users.filter(u => u.role === 'ORGANIZER').map(o => `<div class="admin-item-row"><span>${o.nome}</span><div class="admin-actions"><button class="btn-mini-adm btn-red" onclick="demoteOrganizer('${o.cpf}')"><i class="fas fa-trash"></i></button></div></div>`).join(''); }

let currentFilterStatus = 'ALL';
function filterFinList(status) { currentFilterStatus = status; renderInscriptions(); }

function renderInscriptions() {
    const evtId = document.getElementById('fin-evt-select').value; const div = document.getElementById('fin-list-container');
    if(!evtId) return div.innerHTML = '';
    
    let totalCount = 0; let paidCount = 0; let totalMoney = 0;
    let html = '<table class="fin-table"><thead><tr><th>NOME</th><th>STATUS</th><th>AÇÃO</th></tr></thead><tbody>';
    
    if(evtId === 'ALL') {
         db.users.forEach(u => {
            u.inscricoes.forEach(ins => {
                totalCount++;
                if(ins.status === 'CONFIRMADO') { 
                    paidCount++; 
                    const evt = db.events.find(e => e.id == ins.id);
                    if(evt) totalMoney += parseFloat(evt.val.replace(',','.'));
                }
                if(currentFilterStatus !== 'ALL' && ins.status !== currentFilterStatus) return;
                
                const evtName = db.events.find(e => e.id == ins.id)?.t || '???';
                const statusClass = ins.status === 'CONFIRMADO' ? 'status-ok' : 'status-pend';
                html += `<tr><td><b>${u.nome}</b><br><span style="color:#666;font-size:9px">${evtName}</span></td><td><span class="${statusClass}" onclick="toggleStatus('${u.cpf}','${ins.id}')">${ins.status}</span></td><td></td></tr>`;
            });
         });
    } else {
        db.users.forEach(u => {
            const insc = u.inscricoes.find(i => i.id == evtId);
            if(insc) {
                totalCount++;
                if(insc.status === 'CONFIRMADO') { paidCount++; }
                if(currentFilterStatus !== 'ALL' && insc.status !== currentFilterStatus) return;

                const wppUrl = `https://wa.me/55${u.tel ? u.tel.replace(/\D/g,'') : ''}`;
                const statusClass = insc.status === 'CONFIRMADO' ? 'status-ok' : 'status-pend';
                
                html += `<tr><td>${u.nome} <a href="${wppUrl}" target="_blank" style="text-decoration:none;" class="wpp-big"><i class="fab fa-whatsapp"></i></a><br><span style="color:#666;font-size:9px">${u.cat}</span></td><td><span class="${statusClass}" onclick="toggleStatus('${u.cpf}','${evtId}')">${insc.status}</span></td><td></td></tr>`;
            }
        });
        const evt = db.events.find(e => e.id == evtId);
        if(evt) totalMoney = paidCount * parseFloat(evt.val.replace(',','.'));
    }

    document.getElementById('stat-total').innerText = `Total: ${totalCount}`;
    document.getElementById('stat-paid').innerText = `Pagos: ${paidCount}`;
    document.getElementById('stat-money').innerText = `R$ ${totalMoney.toFixed(2)}`;

    div.innerHTML = html + '</tbody></table>';
}

function toggleStatus(cpf, evtId) { 
    const u = db.users.find(x => x.cpf === cpf); 
    const ins = u.inscricoes.find(i => i.id == evtId); 
    if(ins.status === 'CONFIRMADO') { ins.status = 'PENDENTE'; ins.confirmedBy = null; } 
    else { ins.status = 'CONFIRMADO'; ins.confirmedBy = loggedUser.nome.split(' ')[0]; }
    saveDB(); renderInscriptions(); 
}

// --- PRINT REPORT ---
function openPrintOptions() {
    const evtId = document.getElementById('fin-evt-select').value;
    if(!evtId || evtId === 'ALL') return toast("SELECIONE UM EVENTO ESPECÍFICO");
    let cats = new Set();
    db.users.forEach(u => { if(u.inscricoes.some(i => i.id == evtId)) cats.add(u.cat); });
    document.getElementById('print-cat-list').innerHTML = Array.from(cats).map(c => `<button class="btn-mini-adm" style="text-align:left; padding:8px; width:100%" onclick="generatePrint('${c}')">${c}</button>`).join('');
    document.getElementById('modal-print-options').style.display = 'flex';
}

function generatePrint(categoryFilter) {
    const evtId = document.getElementById('fin-evt-select').value;
    const evt = db.events.find(e => e.id == evtId);
    let usersIn = [];
    db.users.forEach(u => { const insc = u.inscricoes.find(i => i.id == evtId); if(insc && (categoryFilter === 'ALL' || u.cat === categoryFilter)) usersIn.push({ ...u, status: insc.status }); });
    const grouped = {};
    usersIn.forEach(u => { if(!grouped[u.cat]) grouped[u.cat] = []; grouped[u.cat].push(u); });

    let html = `<div class="print-header"><h1>${evt.t}</h1><p>PLANILHA DE CRONOMETRAGEM - ${categoryFilter === 'ALL' ? 'GERAL' : categoryFilter}</p></div>`;
    for (const cat in grouped) {
        html += `<div class="print-cat-block"><div class="print-cat-title">${cat}</div>
        <table class="print-table"><thead><tr><th>NOME</th><th>CIDADE</th><th>CATEGORIA</th><th class="manual-cell">Nº</th><th class="manual-cell">TEMPO</th></tr></thead><tbody>`;
        grouped[cat].forEach(u => { html += `<tr><td>${u.nome}</td><td>${u.city}</td><td>${u.cat}</td><td></td><td></td></tr>`; });
        html += `</tbody></table></div>`;
    }
    document.getElementById('printable-area').innerHTML = html;
    fecharModal('modal-print-options');
    window.print();
}

function openShareModal(evtName) {
    document.getElementById('share-piloto-name').innerText = loggedUser.nome;
    document.getElementById('share-event-name').innerText = evtName;
    document.getElementById('modal-share').style.display = 'flex';
}

function recalcRankingFromTimes(evtId) {
    db.ranking = db.ranking.filter(r => r.evtId != evtId);
    const times = db.tempos.filter(t => t.evtId == evtId && t.status === 'OK');
    const grouped = {};
    times.forEach(t => { if(!grouped[t.cat]) grouped[t.cat] = []; grouped[t.cat].push(t); });
    
    const evt = db.events.find(e => e.id == evtId);
    const ptsRule = evt.points || [50,45,40,35,30,26,24,22,20,18,16,14,12,10,8,6,4,3,2,1];

    for(let cat in grouped) {
        grouped[cat].sort((a,b) => a.val.localeCompare(b.val));
        grouped[cat].forEach((t, index) => {
            if(index < 20) {
                const pts = ptsRule[index] || 0;
                if(pts > 0) {
                    db.ranking.push({ name: t.name, val: pts + ' PTS', cat: cat, city: t.city, evtId: evtId, status: 'OK' });
                }
            }
        });
    }
    saveDB();
}

function showPublicPoints(evtId) {
    const evt = db.events.find(e => e.id == evtId);
    const pts = evt.points || [50,45,40,35,30,26,24,22,20,18,16,14,12,10,8,6,4,3,2,1];
    document.getElementById('modal-points-subtitle').innerText = evt.t;
    document.getElementById('public-points-list').innerHTML = pts.map((p, i) => `<div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:5px;"><b>${i+1}º LUGAR</b> <span>${p} PTS</span></div>`).join('');
    document.getElementById('modal-points').style.display = 'flex';
}

function gerarTermo(evtId) {
    const evt = db.events.find(e => e.id == evtId);
    const user = loggedUser;
    const isMinor = user.cat.includes("INFANTO") || user.cat.includes("JUVENIL") || user.cat.includes("JUNIOR"); 
    
    const content = `
        <div class="termo-container">
            <div class="termo-title">TERMO DE RESPONSABILIDADE</div>
            <div class="termo-body">
                Eu, <b>${user.nome}</b>, inscrito no CPF nº <b>${user.cpf}</b>, na categoria <b>${user.cat}</b>, declaro para os devidos fins que:
                <br><br>
                1. Estou apto fisicamente e mentalmente para participar do evento <b>${evt.t}</b> em <b>${evt.city}</b>.<br>
                2. Assumo total responsabilidade por qualquer acidente, lesão ou dano material que venha a sofrer ou causar a terceiros.<br>
                3. Isento a organização, patrocinadores e a Federação de qualquer responsabilidade civil ou criminal.<br>
                4. Uso obrigatório de equipamentos de segurança (Capacete Integral, etc).
            </div>
            <div class="termo-sign">Assinatura do Atleta</div>
            ${isMinor ? `<div class="termo-body" style="margin-top:30px"><b>AUTORIZAÇÃO PARA MENOR DE IDADE</b><br>Eu, responsável legal pelo atleta acima, autorizo sua participação e assumo todas as responsabilidades citadas.</div><div class="termo-field">Nome do Responsável: __________________________________________________</div><div class="termo-field">CPF do Responsável: __________________________________________________</div><div class="termo-sign">Assinatura do Responsável</div>` : ''}
            <div class="termo-obs">Data: ____/____/2026 - Entregar assinado na retirada do numeral.</div>
        </div>
    `;
    document.getElementById('printable-area').innerHTML = content;
    fecharModal('modal-ticket');
    window.print();
}

function refreshAdmLists() { 
    document.getElementById('adm-list-events').innerHTML = db.events.map((e, i) => `<div class="admin-item-row"><span>${e.t}</span><div class="admin-actions"><button class="btn-mini-adm btn-blue" onclick="editEvent(${e.id})"><i class="fas fa-pen"></i></button><button class="btn-mini-adm btn-red" onclick="delItem('events', ${i})"><i class="fas fa-trash"></i></button></div></div>`).join(''); 
    document.getElementById('adm-list-results').innerHTML = db.tempos.map((t, i) => { 
        const approveBtn = (t.status === 'PENDING' && loggedUser.role === 'ADMIN') ? `<button class="btn-mini-adm btn-green" onclick="approveResult('tempos', ${i})">✅</button>` : ''; 
        const statusTag = t.status === 'PENDING' ? '<span class="pending-tag">PENDENTE</span>' : ''; 
        const numDisplay = t.num ? `<b>#${t.num}</b> - ` : '';
        return `<div class="admin-item-row ${t.status==='PENDING'?'pending-row':''}"><span>${numDisplay}${t.name} - ${t.val}${statusTag}</span><div class="admin-actions">${approveBtn}<button class="btn-mini-adm btn-blue" onclick="editResult('tempos', ${i})"><i class="fas fa-pen"></i></button><button class="btn-mini-adm btn-red" onclick="delItem('tempos', ${i})"><i class="fas fa-trash"></i></button></div></div>`; 
    }).join(''); 
}

function editEvent(id) { 
    const evt = db.events.find(e => e.id == id); 
    if(evt) { 
        document.getElementById('adm-evt-id-edit').value = evt.id; 
        document.getElementById('adm-evt-t').value = evt.t; 
        document.getElementById('adm-evt-month').value = evt.m; 
        document.getElementById('adm-evt-d').value = evt.d; 
        document.getElementById('adm-evt-c').value = evt.city; 
        document.getElementById('adm-evt-v').value = evt.val || ''; 
        document.getElementById('adm-evt-close-date').value = evt.closeDate || '';
        document.getElementById('adm-evt-status').value = evt.status || 'OPEN';
        document.getElementById('adm-evt-pix').value = evt.pix || '';
        
        const pts = evt.points || [50,45,40,35,30,26,24,22,20,18,16,14,12,10,8,6,4,3,2,1];
        document.getElementById('evt-points-grid').innerHTML = pts.map((p, i) => `<input type="number" placeholder="${i+1}º" value="${p}" id="pt-${i}" style="text-align:center; font-size:10px; padding:4px;" oninput="saveEventForm()">`).join('');
        document.getElementById('btn-save-event').innerText = "ATUALIZAR"; 
        
        document.querySelector('.admin-dashboard-grid').scrollIntoView();
    } 
}

function addEvent() { 
    const idEdit = document.getElementById('adm-evt-id-edit').value; 
    const t = document.getElementById('adm-evt-t').value.toUpperCase(); 
    const m = document.getElementById('adm-evt-month').value; 
    const d = document.getElementById('adm-evt-d').value; 
    const c = document.getElementById('adm-evt-c').value.toUpperCase(); 
    const v = document.getElementById('adm-evt-v').value; 
    const closeDate = document.getElementById('adm-evt-close-date').value;
    const status = document.getElementById('adm-evt-status').value;
    const imgInput = document.getElementById('adm-evt-img'); 
    const pix = document.getElementById('adm-evt-pix').value;
    
    const newPoints = [];
    for(let i=0; i<20; i++) {
        const el = document.getElementById(`pt-${i}`);
        newPoints.push(el && el.value ? parseInt(el.value) : 0);
    }

    const finalizeSave = (imgData) => {
         if(t && d && c) { 
            if(idEdit) { 
                const idx = db.events.findIndex(e => e.id == idEdit); 
                if(idx > -1) { 
                    db.events[idx] = { ...db.events[idx], t, m, d, city:c, val:v, points: newPoints, status: status, closeDate: closeDate, pix: pix }; 
                    if(imgData) db.events[idx].img = imgData; 
                    toast("ATUALIZADO"); 
                } 
            } else { 
                const newEvt = {id:Date.now(), t, d, m, city:c, val:v, est:document.getElementById('adm-evt-cb-pe').checked, cbc:document.getElementById('adm-evt-cb-cbc').checked, open:true, img: imgData, points: newPoints, status: status, closeDate: closeDate, pix: pix};
                db.events.push(newEvt); 
                toast("CRIADO"); 
            } 
            saveDB(); refreshAdmLists(); 
            clearEventForm(); 
        } else {
            toast("PREENCHA OS CAMPOS");
        }
    };

    if(imgInput.files[0]) { 
        compressImage(imgInput.files[0], 800, (compressed) => finalizeSave(compressed)); 
    } else { 
        finalizeSave(null); 
    } 
}

function editResult(type, index) { const res = db[type][index]; if(res) { document.getElementById('adm-res-index-edit').value = index; document.getElementById('adm-res-type-edit').value = type; document.getElementById('adm-res-type').value = type; document.getElementById('adm-res-evt').value = res.evtId; const u = db.users.find(u => u.nome === res.name); if(u) { document.getElementById('adm-res-id').innerHTML = `<option value="${u.cpf}">${u.nome}</option>`; document.getElementById('adm-res-id').value = u.cpf; document.getElementById('adm-res-search').value = u.nome; } document.getElementById('adm-res-val').value = res.val; document.getElementById('adm-res-num').value = res.num || ''; document.getElementById('btn-save-res').innerText = "ATUALIZAR"; document.getElementById('btn-cancel-res').style.display = 'block'; } }
function cancelEditRes() { document.getElementById('adm-res-index-edit').value=''; document.getElementById('adm-res-val').value=''; document.getElementById('adm-res-num').value=''; document.getElementById('adm-res-search').value=''; document.getElementById('btn-save-res').innerText='LANÇAR'; document.getElementById('btn-cancel-res').style.display='none'; }

function addResult() { 
    const idx = document.getElementById('adm-res-index-edit').value; 
    const type = document.getElementById('adm-res-type').value; 
    const evtId = document.getElementById('adm-res-evt').value; 
    const cpf = document.getElementById('adm-res-id').value; 
    const val = document.getElementById('adm-res-val').value; 
    const num = document.getElementById('adm-res-num').value; 
    
    if(!evtId || !cpf || !val) return toast("PREENCHA TUDO"); 
    
    const piloto = db.users.find(u => u.cpf === cpf); 
    
    if(!idx && db[type].some(x => x.evtId == evtId && x.name == piloto.nome)) {
        return toast("PILOTO JÁ LANÇADO NESTE EVENTO!");
    }

    const newData = { name: piloto.nome, val: val, num: num, cat: piloto.cat.split('(')[0].trim(), city: piloto.city || 'PE', evtId: evtId, status: loggedUser.role === 'ADMIN' ? 'OK' : 'PENDING' }; 
    
    if(idx) { 
        const oldType = document.getElementById('adm-res-type-edit').value; 
        db[oldType][idx] = newData; 
        toast("ATUALIZADO"); 
    } else { 
        db[type].push(newData); 
        toast("LANÇADO"); 
    } 
    
    if(type === 'tempos') {
         db[type].sort((a,b) => a.val.localeCompare(b.val)); 
         if(loggedUser.role === 'ADMIN') recalcRankingFromTimes(evtId);
    } else {
         db[type].sort((a,b) => parseInt(b.val) - parseInt(a.val));
    }

    document.getElementById('adm-res-val').value=''; 
    document.getElementById('adm-res-num').value=''; 
    document.getElementById('adm-res-search').value=''; 
    document.getElementById('adm-res-id').innerHTML = '<option value="">⬇ BUSQUE ABAIXO ⬇</option>';
    document.getElementById('adm-res-id').value = '';
    
    saveDB(); 
    refreshAdmLists(); 
    cancelEditRes(); 
}

function approveResult(type, index) { 
    db[type][index].status = 'OK'; 
    if(type === 'tempos') recalcRankingFromTimes(db[type][index].evtId);
    saveDB(); 
    refreshAdmLists(); 
    toast("APROVADO!"); 
}

function iniciarInscricao(evtId, evtName, val) { 
    if(!loggedUser) return toast("FAÇA LOGIN PRIMEIRO"); 
    if(loggedUser.inscricoes.some(i => i.id == evtId)) return toast("JÁ INSCRITO"); 
    
    currentPayId = { id: parseInt(evtId), name: evtName }; 
    const evt = db.events.find(e => e.id == parseInt(evtId));
    
    document.getElementById('pix-valor-display').innerText = val ? `R$ ${val}` : "R$ 100,00"; 
    document.getElementById('pix-copy').innerText = evt.pix || "CHAVE PIX NÃO DEFINIDA"; 
    document.getElementById('support-phone-display').innerText = db.config.phone || "SEM TELEFONE"; 
    document.getElementById('modal-pix').style.display='flex'; 
}

function enviarComprovanteWhatsApp() { 
    const phone = db.config.phone ? db.config.phone.replace(/\D/g,'') : '';
    if(phone) window.open(`https://wa.me/${phone}?text=Olá, segue comprovante de inscrição para: ${currentPayId.name} - Piloto: ${loggedUser.nome}`, '_blank'); 
    else alert("Telefone de suporte não configurado!");
}
function confirmarJaPaguei() { if(!loggedUser.inscricoes.some(i => i.id == currentPayId.id)) { loggedUser.inscricoes.push({ id: currentPayId.id, status: 'PENDENTE' }); const idx = db.users.findIndex(x => x.cpf === loggedUser.cpf); if(idx > -1) db.users[idx].inscricoes = loggedUser.inscricoes; saveDB(); localStorage.setItem(SESS_KEY, JSON.stringify(loggedUser)); } fecharModal('modal-pix'); toast("REGISTRADO!"); renderContent('calendar'); }
function verCartaz(id) { const evt = db.events.find(e => e.id == id); if(evt && evt.img) { document.getElementById('img-poster-view').src = evt.img; document.getElementById('modal-poster').style.display = 'flex'; } }
function fecharModal(id){ document.getElementById(id).style.display='none'; }
function delItem(col, idx) { 
    if(confirm("APAGAR?")) { 
        const item = db[col][idx];
        db[col].splice(idx, 1); 
        if(col === 'tempos') recalcRankingFromTimes(item.evtId); 
        saveDB(); 
        refreshAdmLists(); 
    } 
}

function maskTimeOrPoints(i, e) { 
    if(document.getElementById('adm-res-type').value === 'ranking') return; 
    if(e && e.inputType === 'deleteContentBackward') return; 
    let v = i.value.replace(/\D/g, ""); 
    if (v.length > 7) v = v.substring(0, 7); 
    if (v.length > 5) v = v.substring(0, 5) + "." + v.substring(5); 
    if (v.length > 2) v = v.substring(0, 2) + ":" + v.substring(2); 
    i.value = v; 
}

function copiarPix() { navigator.clipboard.writeText(document.getElementById('pix-copy').innerText); toast("PIX COPIADO!"); }
function imprimirTicket() { document.body.classList.add('printing-cupom'); setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove('printing-cupom'), 1000); }, 500); }

// --- LOGICA DE LOGIN E CADASTRO ATUALIZADA (Correção 2 e 1) ---
function fazerLogin() { 
    try {
        const cpfRaw = document.getElementById('login-cpf').value; 
        const pass = document.getElementById('login-pass').value; 
        const remember = document.getElementById('login-remember').checked;
        
        if(!cpfRaw || !pass) return toast("PREENCHA TUDO");
        
        // Verifica usando cleanCPF para evitar erro de pontuação
        const user = db.users.find(x => cleanCPF(x.cpf) === cleanCPF(cpfRaw) && x.pass === pass);
        
        if(user) { 
            loggedUser = user; localStorage.setItem(SESS_KEY, JSON.stringify(user)); 
            if(remember) localStorage.setItem(REMEMBER_KEY, cpfRaw + "|" + pass); 
            initApp(); 
        } else { toast("DADOS INCORRETOS"); }
    } catch(e) { console.log(e); }
}

function fazerLogout() { localStorage.removeItem(SESS_KEY); window.location.reload(true); }
function closeModal(id) { document.getElementById(id).style.display='none'; }

function cadastrar() { 
    const u = { 
        nome: document.getElementById('cad-nome').value.toUpperCase(), 
        cpf: document.getElementById('cad-cpf').value, 
        tel: document.getElementById('cad-tel').value, 
        city: document.getElementById('cad-city').value.toUpperCase(), 
        pass: document.getElementById('cad-pass').value, 
        cat: document.getElementById('cad-cat').value, 
        gender: document.getElementById('cad-gender').value, 
        role: 'USER', 
        inscricoes: [],
        // Novos campos de segurança
        secQ: document.getElementById('cad-sec-q').value,
        secA: document.getElementById('cad-sec-a').value.toUpperCase()
    }; 
    
    if(!u.nome || !u.cpf || !u.pass) return toast("PREENCHA TUDO");
    if(u.pass.length < 6) return toast("SENHA MÍNIMO 6 DÍGITOS");
    if(!validarCPF(u.cpf)) return toast("CPF INVÁLIDO");
    if(!u.secA) return toast("RESPONDA A PERGUNTA DE SEGURANÇA");
    
    if(db.users.some(x => cleanCPF(x.cpf) === cleanCPF(u.cpf))) return toast("CPF JÁ EXISTE");
    
    db.users.push(u); 
    saveDB(); 
    toast("SUCESSO!"); 
    trocarTela('login');
}

// --- RECUPERAÇÃO DE SENHA (Alteração 2) ---
function abrirRecuperacao() {
    document.getElementById('rec-cpf').value = '';
    document.getElementById('rec-tel').value = '';
    document.getElementById('rec-answer').value = '';
    document.getElementById('rec-security-area').style.display = 'none';
    document.getElementById('btn-buscart-rec').style.display = 'block';
    document.getElementById('modal-recovery').style.display = 'flex';
}

function buscarUsuarioRecuperacao() {
    const cpf = document.getElementById('rec-cpf').value;
    const tel = document.getElementById('rec-tel').value;
    
    if(!cpf || !tel) return toast("PREENCHA CPF E TELEFONE");
    
    // Busca usuário pelo CPF (limpo) e verifica se o telefone (limpo) bate
    const user = db.users.find(u => cleanCPF(u.cpf) === cleanCPF(cpf));
    
    if(user && cleanCPF(user.tel) === cleanCPF(tel)) {
        // Usuário encontrado, mostrar pergunta
        const questions = {
            'nome_mae': 'Qual o primeiro nome da sua mãe?',
            'animal': 'Qual o nome do seu primeiro animal?',
            'cidade_nas': 'Em que cidade você nasceu?',
            'time': 'Qual seu time do coração?'
        };
        
        let qText = questions[user.secQ] || "Pergunta de Segurança";
        if(!user.secQ) {
            // Se usuário antigo não tiver pergunta, libera se telefone bater (fallback)
            alert("SUA SENHA É: " + user.pass);
            fecharModal('modal-recovery');
            return;
        }

        document.getElementById('rec-question-display').innerText = qText;
        document.getElementById('rec-security-area').style.display = 'block';
        document.getElementById('btn-buscart-rec').style.display = 'none';
    } else {
        toast("DADOS NÃO CONFEREM");
    }
}

function revelarSenha() {
    const cpf = document.getElementById('rec-cpf').value;
    const ans = document.getElementById('rec-answer').value.toUpperCase();
    
    const user = db.users.find(u => cleanCPF(u.cpf) === cleanCPF(cpf));
    
    if(user && user.secA === ans) {
        alert("SUA SENHA É: " + user.pass);
        fecharModal('modal-recovery');
    } else {
        toast("RESPOSTA INCORRETA");
    }
}

function reCalcCat() { const gender = document.getElementById('cad-gender').value; const date = document.getElementById('cad-nasc').value; calcCat(date, gender); }
function calcCat(dateStr, gender) { if(gender === 'F') { document.getElementById('cad-cat').value = "FEMININA"; return; } if(!dateStr) return; const age = 2026 - new Date(dateStr).getFullYear(); let cat = "RÍGIDA"; if (age >= 12 && age <= 14) cat = "INFANTO-JUVENIL"; else if (age >= 15 && age <= 16) cat = "JUVENIL"; else if (age >= 17 && age <= 18) cat = "JUNIOR"; else if (age >= 19 && age <= 29) cat = "SUB-30 / ELITE"; else if (age >= 30 && age <= 34) cat = "MASTER A1"; else if (age >= 35 && age <= 39) cat = "MASTER A2"; else if (age >= 40 && age <= 44) cat = "MASTER B1"; else if (age >= 45 && age <= 49) cat = "MASTER B2"; else if (age >= 50 && age <= 54) cat = "MASTER C1"; else if (age >= 55 && age <= 59) cat = "MASTER C2"; else if (age >= 60) cat = "MASTER D"; document.getElementById('cad-cat').value = cat + ` (${age} ANOS)`; }

function initApp() { 
    if(db.config.logo) document.querySelectorAll('.app-logo-img').forEach(el => el.src = db.config.logo);
    loadDarkMode(); // Carregar modo escuro
    trocarTela('app'); 
    
    const lastTab = localStorage.getItem(LAST_TAB_KEY);
    
    if(loggedUser && (loggedUser.role === 'ADMIN' || loggedUser.role === 'ORGANIZER' || loggedUser.cpf === '083.276.324-18')) {
         document.getElementById('btn-adm').style.display = 'flex';
    } else {
         document.getElementById('btn-adm').style.display = 'none';
    }

    if(lastTab) {
        nav(lastTab);
    } else {
         nav('calendar');
    }
}

document.getElementById('btn-acessar').addEventListener('click', fazerLogin);
const savedCreds = localStorage.getItem(REMEMBER_KEY); const session = getUser();
if(session) { loggedUser = db.users.find(u => cleanCPF(u.cpf) === cleanCPF(session.cpf)); if(loggedUser) initApp(); } 
else if (savedCreds) { const p = savedCreds.split('|'); document.getElementById('login-cpf').value = p[0]; document.getElementById('login-pass').value = p[1]; document.getElementById('login-remember').checked = true; }
if(db.config.logo) document.querySelectorAll('.app-logo-img').forEach(el => el.src = db.config.logo);

document.addEventListener('DOMContentLoaded', () => {
    restoreInputs();
    document.querySelectorAll('input, select, textarea').forEach(el => {
        el.addEventListener('input', () => saveInput(el));
        el.addEventListener('change', () => saveInput(el));
    });
});
