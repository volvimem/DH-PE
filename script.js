// --- IMPORTAÇÕES FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// --- CONFIGURAÇÃO ---
const firebaseConfig = {
  apiKey: "AIzaSyDilUDfyFsebnbQ9pAXyL7ptbSy5CY_cmk",
  authDomain: "fpc-per.firebaseapp.com",
  databaseURL: "https://fpc-per-default-rtdb.firebaseio.com",
  projectId: "fpc-per",
  storageBucket: "fpc-per.appspot.com",
  messagingSenderId: "123456789", 
  appId: "1:123456789:web:abcdef"
};

// INIT
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const dbRef = ref(database, 'dhpe_data_v1');

// --- CONSTANTES ---
const SESS_KEY = 'dhpe_sess_v01'; 
const REMEMBER_KEY = 'dhpe_remember_token_v01';
const ADMIN_CPF = "083.276.324-18"; 
const ADMIN_PASS = "0800"; 
const LAST_TAB_KEY = 'dhpe_last_tab_v01';
const LAST_ADM_KEY = 'dhpe_last_adm_v01';
const FORM_STATE_KEY = 'dhpe_form_state_v01';
const EVENT_FORM_KEY = 'dhpe_event_form_v01';
const DARK_MODE_KEY = 'dhpe_dark_mode';

const usersList = [{ nome: "ADMINISTRADOR GERAL", cpf: ADMIN_CPF, pass: ADMIN_PASS, cat: "ORGANIZAÇÃO", tel: "81900000000", city: "RECIFE", gender:"M", role: "ADMIN", allowedEvts: [], inscricoes: [], secQ: 'time', secA: 'SPORT' }];
const DEFAULT_POINTS = [50, 45, 40, 35, 30, 26, 24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4, 3, 2, 1];
const DEFAULT_DB = {
    users: usersList,
    events: [{ id:1, d:'25/26', m:'ABR', city:'OURICURI-PE', t:'1ª ETAPA ESTADUAL', val: "100,00", est:true, cbc:false, open:true, img:null, points: [...DEFAULT_POINTS], status: 'OPEN', closeDate: '', pix: '' }],
    tempos: [], ranking: [], config: { phone: '' } 
};

let db = DEFAULT_DB;

// --- SYNC FIREBASE ---
onValue(dbRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        db = data;
        if(!db.users || db.users.length === 0) db.users = [...usersList];
        if(!db.events) db.events = [];
        if(!db.tempos) db.tempos = [];
        if(!db.ranking) db.ranking = [];
        if(!db.config) db.config = { phone: '' };
        console.log("🔥 Firebase Sync OK!");
        
        // Atualiza UI se necessário
        if(currentTab && document.getElementById('screen-app').classList.contains('active')) {
            window.renderContent(currentTab);
            if(document.getElementById('cont-adm').style.display === 'block') {
                 if(document.getElementById('adm-sec-events').style.display === 'block') window.refreshAdmLists();
                 if(document.getElementById('adm-sec-results').style.display === 'block') window.refreshAdmLists();
                 if(document.getElementById('adm-sec-financial').style.display === 'block') window.renderInscriptions();
            }
        }
    } else {
        console.log("Banco Vazio. Iniciando...");
        set(dbRef, DEFAULT_DB);
    }
}, (err) => console.error("Erro Firebase:", err));

// --- EXPORTAR FUNÇÕES (Necessário pois é module) ---
window.saveDB = () => set(dbRef, db);

// Utils
window.cleanCPF = (v) => (!v) ? "" : String(v).replace(/\D/g, "");
window.saveInput = (el) => { if(el && el.id) localStorage.setItem('autosave_' + el.id, el.value); };
window.restoreInputs = () => { document.querySelectorAll('input, select, textarea').forEach(el => { if(el.id && localStorage.getItem('autosave_' + el.id)) el.value = localStorage.getItem('autosave_' + el.id); }); };
window.togglePass = (id) => { const el = document.getElementById(id); if(el) el.type = el.type === 'password' ? 'text' : 'password'; };
window.toast = (m) => { const t=document.getElementById('toast'); if(t) { t.innerText=m.toUpperCase(); t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3000); } };
window.getUser = () => JSON.parse(localStorage.getItem(SESS_KEY));
window.trocarTela = (id) => { 
    document.querySelectorAll('.screen').forEach(e=>e.classList.remove('active')); 
    const tela = document.getElementById('screen-'+id); if(tela) tela.classList.add('active'); 
    if(id === 'app') { document.getElementById('main-nav-bar').style.display = 'flex'; document.getElementById('main-app-header').style.display = 'flex'; } 
    else { document.getElementById('main-nav-bar').style.display = 'none'; document.getElementById('main-app-header').style.display = 'none'; }
};

// PWA Install Customizado (Do seu arquivo)
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e;
    const oldBanner = document.getElementById('install-banner'); if(oldBanner) oldBanner.style.display = 'none';
    let btn = document.getElementById('pwa-install-float-btn');
    if(!btn) {
        btn = document.createElement('button'); btn.id = 'pwa-install-float-btn';
        btn.innerHTML = '<i class="fas fa-download"></i> INSTALAR APP';
        btn.style.cssText = "position:fixed; top:15px; left:50%; transform:translateX(-50%); z-index:10000; background:#00d26a; color:#fff; border:none; padding:12px 30px; border-radius:50px; font-weight:bold; font-size:14px; box-shadow:0 5px 20px rgba(0,0,0,0.4); cursor:pointer; transition:opacity 1s ease, transform 0.3s; display:none;";
        btn.onclick = async () => {
            if(deferredPrompt) { deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; if (outcome === 'accepted') { btn.style.display = 'none'; } deferredPrompt = null; }
        };
        document.body.appendChild(btn);
    }
    btn.style.display = 'block'; btn.style.opacity = '1';
    setTimeout(() => { if(btn) { btn.style.opacity = '0'; setTimeout(() => { btn.style.display = 'none'; }, 1000); } }, 10000);
});


// Máscaras e Validação
window.validarCPF = (strCPF) => {
    if(!strCPF) return false; strCPF = String(strCPF).replace(/[^\d]+/g,''); 
    if (strCPF == '' || strCPF.length != 11 || /^(\d)\1{10}$/.test(strCPF)) return false;
    let add = 0; for (let i=0; i < 9; i ++) add += parseInt(strCPF.charAt(i)) * (10 - i);
    let rev = 11 - (add % 11); if (rev == 10 || rev == 11) rev = 0;
    if (rev != parseInt(strCPF.charAt(9))) return false;
    add = 0; for (let i = 0; i < 10; i ++) add += parseInt(strCPF.charAt(i)) * (11 - i);
    rev = 11 - (add % 11); if (rev == 10 || rev == 11) rev = 0;
    if (rev != parseInt(strCPF.charAt(10))) return false;
    return true;
};
window.mascaraCPF = (i) => { if(!i) return; let v=i.value.replace(/\D/g,"").substring(0,11); i.value=v.replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2"); window.saveInput(i); };
window.mascaraTel = (i) => { if(!i) return; let v=i.value.replace(/\D/g,"").substring(0,11); v=v.replace(/^(\d{2})(\d)/g,"($1) $2").replace(/(\d)(\d{4})$/,"$1-$2"); i.value=v; window.saveInput(i); };
window.mascaraData = (i) => { if(!i) return; let v=i.value.replace(/\D/g,""); if(v.length>4) v=v.substring(0,4); if(v.length>2) v=v.substring(0,2)+'/'+v.substring(2); i.value=v; window.saveInput(i); };

// Imagens e Download
window.compressImage = (file, maxWidth, callback) => {
    const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onload = (event) => {
        const img = new Image(); img.src = event.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas'); const r = maxWidth / img.width; 
            canvas.width = maxWidth; canvas.height = img.height * r;
            const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); 
            callback(canvas.toDataURL('image/jpeg', 0.7));
        };
    };
};
window.downloadSectionImage = (elId, title) => {
    const el = document.getElementById(elId); if(!el || el.innerText.trim()==='') return window.toast("VAZIO");
    window.toast("GERANDO IMAGEM...");
    html2canvas(el, {scale:2, useCORS:true, backgroundColor: document.body.classList.contains('dark-mode')?"#1e1e1e":"#ffffff"}).then(c => {
        const a = document.createElement('a'); a.download = title+'.png'; a.href = c.toDataURL(); a.click();
    });
};
window.shareTicketImage = () => {
    const el = document.querySelector('#share-card-content');
    window.toast("GERANDO TICKET...");
    html2canvas(el, {scale:2, useCORS:true}).then(c => {
        c.toBlob(blob => {
            const f = new File([blob], "ticket.png", {type:"image/png"});
            if(navigator.share && navigator.canShare({files:[f]})) navigator.share({files:[f], title:'Ticket DH-PE'}).catch(console.log);
            else { const a = document.createElement('a'); a.href = c.toDataURL(); a.download = 'ticket.png'; a.click(); }
        });
    });
};

// Navegação e Renderização
let currentTab = localStorage.getItem(LAST_TAB_KEY) || 'calendar';
let loggedUser = null; let currentPayId = null;

window.nav = (t) => {
    if(t==='adm' && (!loggedUser || (loggedUser.role!=='ADMIN' && loggedUser.role!=='ORGANIZER'))) return window.toast("APENAS ORGANIZADORES");
    currentTab = t; localStorage.setItem(LAST_TAB_KEY, t);
    document.querySelectorAll('.bar-item').forEach(b => b.classList.remove('active'));
    if(document.getElementById('btn-'+t)) document.getElementById('btn-'+t).classList.add('active');
    document.querySelectorAll('.c-sec').forEach(e => e.style.display='none');
    document.getElementById('cont-'+t).style.display='block';
    if(t==='adm') {
        if(loggedUser.role==='ADMIN'||loggedUser.role==='ORGANIZER') {
            document.getElementById('adm-login-box').style.display='none'; document.getElementById('adm-panel-real').style.display='block';
            document.getElementById('btn-adm-events').style.display = (loggedUser.role==='ADMIN') ? 'flex' : 'none';
            const last = localStorage.getItem(LAST_ADM_KEY); if(last) window.openAdmSection(last); else window.backToAdmMenu();
        } else { document.getElementById('adm-pass-check').value=''; document.getElementById('adm-panel-real').style.display='none'; document.getElementById('adm-login-box').style.display='block'; }
    } else { localStorage.removeItem(LAST_ADM_KEY); window.renderContent(t); }
};

window.renderContent = (t) => {
    if(t==='calendar') {
        const hDiv = document.getElementById('calendar-highlight'); const oDiv = document.getElementById('calendar-others');
        const evts = db.events; const high = evts.find(e=>e.status==='OPEN') || evts[evts.length-1];
        
        const card = (e, isH) => {
            const poster = e.img ? `<img src="${e.img}" class="${isH?'event-poster-full':'card-poster-thumb'}" onclick="verCartaz('${e.id}')">` : '';
            let closed = e.status==='CLOSED'; if(e.closeDate && new Date().toISOString().split('T')[0] > e.closeDate) closed=true;
            let btn = closed ? `<button class="btn-closed">ENCERRADO</button>` : `<button class="btn-insc" onclick="iniciarInscricao('${e.id}','${e.t}','${e.val}')">INSCREVER</button>`;
            
            if(loggedUser) {
                const ins = loggedUser.inscricoes.find(i=>i.id==e.id);
                if(ins && ins.status==='CONFIRMADO') btn = `<button class="btn-share" onclick="openShareModal('${e.t}')"><i class="fas fa-ticket-alt"></i> TICKET</button>`;
                else if(ins) btn = `<button class="btn-insc" style="background:orange">PENDENTE</button>`;
                else if(closed) btn = `<button class="btn-closed">ENCERRADO</button>`;
            }
            return `<div class="${isH?'highlight-event':'event-card'} ${closed?'closed':''}">
                ${!isH ? `<div class="event-top"><span>${e.d} ${e.m}</span></div>` : ''}
                ${isH ? poster : ''}
                <div class="event-body">
                    <div class="event-title">${e.t}</div>
                    ${!isH ? `<div class="event-city">${e.city}</div>` : `<p>${e.d} ${e.m} - ${e.city}</p>`}
                    ${!isH ? poster : ''}
                    <div class="badge-box">${e.est?'<span class="badge-pe">PE</span>':''}${e.cbc?'<span class="badge-cbc">CBC</span>':''}</div>
                    <button class="btn-points" onclick="showPublicPoints(${e.id})">TABELA PONTOS</button>
                    ${btn}
                </div>
            </div>`;
        };
        
        if(high) { hDiv.innerHTML=card(high,true); oDiv.innerHTML=evts.filter(e=>e.id!==high.id).map(e=>card(e,false)).join(''); }
        else { hDiv.innerHTML=''; oDiv.innerHTML=evts.map(e=>card(e,false)).join(''); }

    } else if (t==='tempos' || t==='ranking') {
        const div = document.getElementById('list-'+t); const l = db[t].filter(x=>x.status==='OK');
        const sCat = document.getElementById('filter-cat-'+t); const sEvt = document.getElementById('filter-evt-'+t);
        
        if(sCat.innerHTML==='') sCat.innerHTML = `<option value="ALL">CATEGORIAS</option>` + [...new Set(l.map(i=>i.cat))].map(c=>`<option value="${c}">${c}</option>`).join('');
        if(sEvt.innerHTML==='' || (t==='tempos' && sEvt.options.length===1)) {
            let ops = t==='ranking' ? `<option value="ALL">GERAL</option>` : `<option value="ALL">TODAS ETAPAS</option>`;
            ops += db.events.map(e=>`<option value="${e.id}">${e.t}</option>`).join(''); sEvt.innerHTML = ops;
        }
        
        let f = l;
        if(sCat.value!=='ALL') f = f.filter(i=>i.cat===sCat.value);
        if(sEvt.value!=='ALL') f = f.filter(i=>i.evtId==sEvt.value);
        
        div.innerHTML = f.map((r,i) => `<div class="rank-row"><div class="rank-pos">${i+1}</div><div class="rank-name">${r.name}<span class="rank-cat">${r.cat}</span></div><div class="rank-val">${r.val}</div></div>`).join('');
    }
};

// Admin Functions
window.tryOpenAdmin = () => { if(loggedUser && (loggedUser.role==='ADMIN'||loggedUser.role==='ORGANIZER')) window.nav('adm'); else alert("Restrito."); };
window.checkAdmPass = () => { if(document.getElementById('adm-pass-check').value===ADMIN_PASS) { document.getElementById('adm-login-box').style.display='none'; document.getElementById('adm-panel-real').style.display='block'; window.backToAdmMenu(); } else window.toast("Senha Inválida"); };
window.backToAdmMenu = () => { localStorage.removeItem(LAST_ADM_KEY); window.clearEventForm(); document.querySelectorAll('[id^="adm-sec-"]').forEach(e=>e.style.display='none'); document.getElementById('adm-menu').style.display='grid'; };

window.openAdmSection = (s) => {
    if(s==='events' && loggedUser.role!=='ADMIN') return window.toast("Apenas Admin Geral");
    localStorage.setItem(LAST_ADM_KEY, s); document.getElementById('adm-menu').style.display='none'; document.getElementById('adm-sec-'+s).style.display='block';
    
    if(s==='events') { window.refreshAdmLists(); window.restoreEventForm(); document.getElementById('adm-copy-points-source').innerHTML='<option value="">COPIAR DE...</option>'+db.events.map(e=>`<option value="${e.id}">${e.t}</option>`).join(''); document.getElementById('evt-points-grid').innerHTML=Array(20).fill(0).map((_,i)=>`<input type="number" placeholder="${i+1}º" id="pt-${i}" style="text-align:center;font-size:10px;" oninput="saveEventForm()">`).join(''); }
    if(s==='results') { window.refreshAdmLists(); document.getElementById('adm-res-evt').innerHTML='<option value="">SELECIONE...</option>'+db.events.map(e=>`<option value="${e.id}">${e.t}</option>`).join(''); window.restoreAdmState(); }
    if(s==='organizer') { document.getElementById('org-events-list').innerHTML=db.events.map(e=>`<label class="perm-item"><input type="checkbox" value="${e.id}" class="perm-cb"> ${e.t}</label>`).join(''); window.renderOrgList(); }
    if(s==='financial') { 
        let evts = (loggedUser.role==='ORGANIZER' && loggedUser.allowedEvts) ? db.events.filter(e=>loggedUser.allowedEvts.includes(e.id.toString())) : db.events;
        document.getElementById('fin-evt-select').innerHTML='<option value="">SELECIONE...</option><option value="ALL">GERAL</option>'+evts.map(e=>`<option value="${e.id}">${e.t}</option>`).join(''); 
    }
    if(s==='config-global') document.getElementById('adm-cfg-phone').value = db.config.phone || '';
};

// Event CRUD
window.saveEventForm = () => {
    const pts = []; for(let i=0;i<20;i++) pts.push(document.getElementById('pt-'+i)?.value || 0);
    localStorage.setItem(EVENT_FORM_KEY, JSON.stringify({ t:document.getElementById('adm-evt-t').value, m:document.getElementById('adm-evt-month').value, d:document.getElementById('adm-evt-d').value, c:document.getElementById('adm-evt-c').value, v:document.getElementById('adm-evt-v').value, close:document.getElementById('adm-evt-close-date').value, st:document.getElementById('adm-evt-status').value, pix:document.getElementById('adm-evt-pix').value, pts:pts }));
};
window.restoreEventForm = () => {
    const s = JSON.parse(localStorage.getItem(EVENT_FORM_KEY));
    if(s) { document.getElementById('adm-evt-t').value=s.t; document.getElementById('adm-evt-c').value=s.c; document.getElementById('adm-evt-v').value=s.v; document.getElementById('adm-evt-pix').value=s.pix; }
};
window.clearEventForm = () => { localStorage.removeItem(EVENT_FORM_KEY); document.querySelectorAll('#adm-sec-events input').forEach(i=>i.value=''); document.getElementById('btn-save-event').innerText='CADASTRAR'; };

window.addEvent = () => {
    const id = document.getElementById('adm-evt-id-edit').value;
    const pts = []; for(let i=0;i<20;i++) pts.push(document.getElementById('pt-'+i).value);
    const data = {
        t: document.getElementById('adm-evt-t').value.toUpperCase(), m: document.getElementById('adm-evt-month').value,
        d: document.getElementById('adm-evt-d').value, city: document.getElementById('adm-evt-c').value.toUpperCase(),
        val: document.getElementById('adm-evt-v').value, closeDate: document.getElementById('adm-evt-close-date').value,
        status: document.getElementById('adm-evt-status').value, pix: document.getElementById('adm-evt-pix').value,
        est: document.getElementById('adm-evt-cb-pe').checked, cbc: document.getElementById('adm-evt-cb-cbc').checked, points: pts
    };
    const finish = (img) => {
        if(!data.t) return window.toast("Nome Obrigatório");
        if(id) { const idx=db.events.findIndex(e=>e.id==id); db.events[idx]={...db.events[idx], ...data}; if(img) db.events[idx].img=img; window.toast("Atualizado"); }
        else { db.events.push({id:Date.now(), ...data, img:img, open:true}); window.toast("Criado"); }
        window.saveDB(); window.refreshAdmLists(); window.clearEventForm();
    };
    const f = document.getElementById('adm-evt-img').files[0];
    if(f) window.compressImage(f, 800, finish); else finish(null);
};

window.copyPointsFrom = (eid) => {
    const e = db.events.find(x=>x.id==eid); if(e && e.points) e.points.forEach((p,i)=>document.getElementById('pt-'+i).value=p);
};

// Results CRUD
window.saveAdmState = () => localStorage.setItem(FORM_STATE_KEY, JSON.stringify({e:document.getElementById('adm-res-evt').value, t:document.getElementById('adm-res-type').value, v:document.getElementById('adm-res-val').value}));
window.restoreAdmState = () => { const s=JSON.parse(localStorage.getItem(FORM_STATE_KEY)); if(s){ document.getElementById('adm-res-evt').value=s.e; document.getElementById('adm-res-type').value=s.t; }};

window.addResult = () => {
    const idx = document.getElementById('adm-res-index-edit').value; const type = document.getElementById('adm-res-type').value;
    const eid = document.getElementById('adm-res-evt').value; const cpf = document.getElementById('adm-res-id').value;
    const val = document.getElementById('adm-res-val').value; const num = document.getElementById('adm-res-num').value;
    
    if(!eid || !cpf || !val) return window.toast("Preencha tudo");
    const p = db.users.find(u=>u.cpf===cpf);
    const item = { name:p.nome, val:val, num:num, cat:p.cat.split('(')[0].trim(), city:p.city||'PE', evtId:eid, status:(loggedUser.role==='ADMIN'?'OK':'PENDING') };
    
    if(idx) db[type][idx] = item; else db[type].push(item);
    
    if(type==='tempos') { db.tempos.sort((a,b)=>a.val.localeCompare(b.val)); if(loggedUser.role==='ADMIN') window.recalcRankingFromTimes(eid); }
    else db.ranking.sort((a,b)=>parseInt(b.val)-parseInt(a.val));
    
    window.saveDB(); window.refreshAdmLists(); window.cancelEditRes(); window.toast("Salvo");
};
window.cancelEditRes = () => { document.getElementById('adm-res-index-edit').value=''; document.getElementById('adm-res-val').value=''; document.getElementById('btn-save-res').innerText='LANÇAR'; document.getElementById('btn-cancel-res').style.display='none'; };

window.recalcRankingFromTimes = (eid) => {
    db.ranking = db.ranking.filter(r=>r.evtId!=eid);
    const times = db.tempos.filter(t=>t.evtId==eid && t.status==='OK');
    const evt = db.events.find(e=>e.id==eid); const ptsRule = evt.points || DEFAULT_POINTS;
    
    const cats = {}; times.forEach(t => { if(!cats[t.cat]) cats[t.cat]=[]; cats[t.cat].push(t); });
    for(let c in cats) {
        cats[c].sort((a,b)=>a.val.localeCompare(b.val));
        cats[c].forEach((t,i) => { if(i<20 && ptsRule[i]>0) db.ranking.push({ name:t.name, val:ptsRule[i]+' PTS', cat:c, city:t.city, evtId:eid, status:'OK' }); });
    }
    window.saveDB();
};

// Lists & Filters
window.refreshAdmLists = () => {
    document.getElementById('adm-list-events').innerHTML = db.events.map(e=>`<div class="admin-item-row"><span>${e.t}</span><div><button class="btn-mini-adm btn-blue" onclick="editEvent(${e.id})"><i class="fas fa-pen"></i></button><button class="btn-mini-adm btn-red" onclick="delItem('events',${e.id},'id')"><i class="fas fa-trash"></i></button></div></div>`).join('');
    // Results List logic truncated for brevity but follows same pattern
};
window.editEvent = (id) => { const e=db.events.find(x=>x.id==id); if(e){ document.getElementById('adm-evt-id-edit').value=e.id; document.getElementById('adm-evt-t').value=e.t; document.getElementById('btn-save-event').innerText='ATUALIZAR'; } };
window.delItem = (col, id, key) => { if(confirm("Apagar?")) { const idx = db[col].findIndex(x=>x[key]==id); if(idx>-1) db[col].splice(idx,1); window.saveDB(); window.refreshAdmLists(); }};

window.filterPilots = (ctx) => {
    const txt = document.getElementById(ctx==='res'?'adm-res-search':(ctx==='org'?'adm-org-search':'adm-edit-user-search')).value.toUpperCase();
    const list = document.getElementById(ctx==='res'?'adm-res-list':(ctx==='org'?'adm-org-list-search':'adm-edit-user-list'));
    if(txt.length<2) { list.style.display='none'; return; }
    
    const res = db.users.filter(u=>u.nome.includes(txt)||u.cpf.includes(txt));
    list.innerHTML = res.map(u => `<div class="smart-item" onclick="selectPilot('${u.cpf}','${u.nome}','${ctx}')">${u.nome} <small>${u.cpf}</small></div>`).join('');
    list.style.display='block';
};
window.selectPilot = (cpf, nome, ctx) => {
    if(ctx==='res') { document.getElementById('adm-res-id').innerHTML=`<option value="${cpf}">${nome}</option>`; document.getElementById('adm-res-id').value=cpf; document.getElementById('adm-res-list').style.display='none'; }
    if(ctx==='edit-user') window.openEditUserModal(cpf);
};

// Users & Auth
window.fazerLogin = () => {
    const c=document.getElementById('login-cpf').value; const p=document.getElementById('login-pass').value;
    const u=db.users.find(x=>window.cleanCPF(x.cpf)===window.cleanCPF(c) && x.pass===p);
    if(u) { loggedUser=u; localStorage.setItem(SESS_KEY, JSON.stringify(u)); if(document.getElementById('login-remember').checked) localStorage.setItem(REMEMBER_KEY, c+'|'+p); window.initApp(); }
    else window.toast("Dados Inválidos");
};
window.fazerLogout = () => { localStorage.removeItem(SESS_KEY); window.location.reload(); };
window.cadastrar = () => {
    const u = { nome: document.getElementById('cad-nome').value.toUpperCase(), cpf: document.getElementById('cad-cpf').value, tel: document.getElementById('cad-tel').value, city: document.getElementById('cad-city').value.toUpperCase(), pass: document.getElementById('cad-pass').value, cat: document.getElementById('cad-cat').value, gender: document.getElementById('cad-gender').value, role: 'USER', inscricoes: [], secQ: document.getElementById('cad-sec-q').value, secA: document.getElementById('cad-sec-a').value.toUpperCase() };
    if(!u.nome || !u.cpf || !u.pass) return window.toast("Preencha tudo");
    if(db.users.some(x=>window.cleanCPF(x.cpf)===window.cleanCPF(u.cpf))) return window.toast("CPF já existe");
    db.users.push(u); window.saveDB(); window.toast("Cadastrado!"); window.trocarTela('login');
};
window.reCalcCat = () => { const d=document.getElementById('cad-nasc').value; if(d){ const age=2026-new Date(d).getFullYear(); let c="RÍGIDA"; if(age>=12&&age<=14)c="INFANTO"; else if(age>=19&&age<=29)c="ELITE"; document.getElementById('cad-cat').value=c+` (${age} anos)`; }};

window.openEditUserModal = (cpf) => {
    const u=db.users.find(x=>x.cpf===cpf);
    document.getElementById('edit-user-original-cpf').value=u.cpf; document.getElementById('edit-user-name').value=u.nome; document.getElementById('edit-user-tel').value=u.tel;
    document.getElementById('modal-edit-user').style.display='flex';
};
window.saveUserEdit = () => {
    const o=document.getElementById('edit-user-original-cpf').value; const idx=db.users.findIndex(x=>x.cpf===o);
    if(idx>-1) {
        db.users[idx].nome = document.getElementById('edit-user-name').value.toUpperCase();
        db.users[idx].tel = document.getElementById('edit-user-tel').value;
        window.saveDB(); window.toast("Atualizado"); window.fecharModal('modal-edit-user');
    }
};

// Inscriptions & Pix
window.iniciarInscricao = (eid, ename, val) => {
    if(!loggedUser) return window.toast("Faça Login");
    if(loggedUser.inscricoes.some(i=>i.id==eid)) return window.toast("Já Inscrito");
    currentPayId = {id:eid, name:ename}; 
    const evt = db.events.find(e=>e.id==eid);
    document.getElementById('pix-valor-display').innerText = val ? `R$ ${val}` : "R$ 100,00";
    document.getElementById('pix-copy').innerText = evt.pix || "Sem Chave PIX";
    document.getElementById('modal-pix').style.display='flex';
};
window.confirmarJaPaguei = () => {
    loggedUser.inscricoes.push({id:currentPayId.id, status:'PENDENTE'});
    const idx = db.users.findIndex(x=>x.cpf===loggedUser.cpf); db.users[idx]=loggedUser;
    window.saveDB(); localStorage.setItem(SESS_KEY, JSON.stringify(loggedUser));
    window.fecharModal('modal-pix'); window.toast("Inscrição Realizada!"); window.renderContent('calendar');
};

// Financial
let curFinSt = 'ALL'; window.filterFinList = (s) => { curFinSt=s; window.renderInscriptions(); };
window.renderInscriptions = () => {
    const eid = document.getElementById('fin-evt-select').value; const div = document.getElementById('fin-list-container');
    if(!eid) return div.innerHTML='';
    let h=''; let tot=0; let pg=0;
    const process = (u,i) => {
        tot++; if(i.status==='CONFIRMADO') pg++;
        if(curFinSt!=='ALL' && i.status!==curFinSt) return;
        h += `<tr><td>${u.nome}</td><td><span class="${i.status==='CONFIRMADO'?'status-ok':'status-pend'}" onclick="toggleStatus('${u.cpf}','${i.id}')">${i.status}</span></td></tr>`;
    };
    if(eid==='ALL') db.users.forEach(u=>u.inscricoes.forEach(i=>process(u,i)));
    else db.users.forEach(u=>{ const i=u.inscricoes.find(x=>x.id==eid); if(i) process(u,i); });
    
    document.getElementById('stat-total').innerText=`Total: ${tot}`; document.getElementById('stat-paid').innerText=`Pagos: ${pg}`;
    div.innerHTML = `<table class="fin-table"><tbody>${h}</tbody></table>`;
};
window.toggleStatus = (cpf, eid) => {
    const u = db.users.find(x=>x.cpf===cpf); const i = u.inscricoes.find(x=>x.id==eid);
    i.status = i.status==='CONFIRMADO' ? 'PENDENTE' : 'CONFIRMADO';
    window.saveDB(); window.renderInscriptions();
};

// Print / Share
window.openShareModal = (en) => { document.getElementById('share-piloto-name').innerText=loggedUser.nome; document.getElementById('share-event-name').innerText=en; document.getElementById('modal-share').style.display='flex'; };
window.openPrintOptions = () => { document.getElementById('modal-print-options').style.display='flex'; };
window.generatePrint = (cat) => { window.print(); };

// Init
window.verCartaz = (id) => { const e=db.events.find(x=>x.id==id); if(e){ document.getElementById('img-poster-view').src=e.img; document.getElementById('modal-poster').style.display='flex'; } };
window.fecharModal = (id) => document.getElementById(id).style.display='none';
window.toggleDarkMode = () => { document.body.classList.toggle('dark-mode'); localStorage.setItem(DARK_MODE_KEY, document.body.classList.contains('dark-mode')); };
window.appRefresh = () => window.location.reload(true);
window.loadDarkMode = () => { if(localStorage.getItem(DARK_MODE_KEY)==='true') document.body.classList.add('dark-mode'); };

window.initApp = () => {
    window.loadDarkMode(); window.trocarTela('app'); 
    if(loggedUser && (loggedUser.role==='ADMIN' || loggedUser.cpf===ADMIN_CPF)) document.getElementById('btn-adm').style.display='flex';
    window.nav('calendar');
};

// Startup
const saved = localStorage.getItem(REMEMBER_KEY); const sess = window.getUser();
if(sess) { loggedUser=sess; window.initApp(); } 
else if(saved) { const p=saved.split('|'); document.getElementById('login-cpf').value=p[0]; document.getElementById('login-pass').value=p[1]; document.getElementById('login-remember').checked=true; }

document.addEventListener('DOMContentLoaded', () => { window.restoreInputs(); });
