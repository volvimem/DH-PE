/* DH-CLUB+ BETA — módulo separado do DH-PE principal */
(function(){
'use strict';

const firebaseConfig = {
  apiKey: "AIzaSyDilUDfyFsebnbQ9pAXyL7ptbSy5CY_cmk",
  authDomain: "fpc-per.firebaseapp.com",
  databaseURL: "https://fpc-per-default-rtdb.firebaseio.com",
  projectId: "fpc-per",
  storageBucket: "fpc-per.firebasestorage.app",
  messagingSenderId: "817616563956",
  appId: "1:817616563956:web:21dbbbcbb69e0cae10f8a1"
};

const SYSTEM_YEAR = new Date().getFullYear();

let defaultKey = 'dhpe_v25_final_stable_fix';

if (SYSTEM_YEAR === 2027) {
  defaultKey = 'dhpe_2027_active';
}

if (SYSTEM_YEAR >= 2028) {
  defaultKey = `dhpe_${SYSTEM_YEAR}_active`;
}

const DB_KEY =
  localStorage.getItem('dhpe_active_season') ||
  defaultKey;

const SESS_KEY = 'dhpe_sess_v25';

const CLUB_ROOT = 'dhclub';


if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const database = firebase.database();
const auth = firebase.auth();


let loggedUser = null;

let core = {
  users: [],
  events: [],
  tempos: [],
  config: {}
};

let club = {
  config: {},
  members: {},
  challenges: {},
  trainings: {},
  benefits: {},
  sponsors: {},
  x1_duels: {},
  challenge_entries: {},
  training_presence: {}
};

let currentView = 'home';


const cleanCPF = v =>
  String(v || '').replace(/\D/g, '');


const esc = v =>
  String(v ?? '').replace(
    /[&<>'"]/g,
    ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#039;',
      '"': '&quot;'
    }[ch])
  );


const objValues = v =>
  Array.isArray(v)
    ? v.filter(Boolean)
    : (
        v &&
        typeof v === 'object'
          ? Object.values(v).filter(Boolean)
          : []
      );


const brl = n =>
  Number(n || 0).toLocaleString(
    'pt-BR',
    {
      style: 'currency',
      currency: 'BRL'
    }
  );


const dateBR = v => {

  try {

    return new Date(v)
      .toLocaleDateString('pt-BR');

  } catch {

    return '--';
  }
};


const isAdmin = u =>
  !!u &&
  u.role === 'ADMIN';


// ==========================================================
// SESSÃO
// ==========================================================

function sessionUser() {

  const raw =
    localStorage.getItem(SESS_KEY) ||
    sessionStorage.getItem(SESS_KEY);

  if (!raw) {
    return null;
  }

  try {

    return JSON.parse(raw);

  } catch {

    return null;
  }
}


// ==========================================================
// MEMBRO DH-CLUB
// ==========================================================

function memberRecord() {

  return club.members?.[
    cleanCPF(loggedUser?.cpf)
  ] || null;
}


function hasClubAccess() {

  if (isAdmin(loggedUser)) {
    return true;
  }

  const m = memberRecord();

  return !!m &&
    [
      'BETA',
      'ACTIVE',
      'FOUNDER'
    ].includes(
      String(m.status || '')
        .toUpperCase()
    );
}


function planLabel() {

  if (isAdmin(loggedUser)) {
    return 'ADMIN • BETA';
  }

  const m = memberRecord();

  if (!m) {
    return 'SEM PLANO';
  }

  if (m.status === 'FOUNDER') {
    return 'FUNDADOR';
  }

  if (m.status === 'BETA') {
    return 'BETA TESTER';
  }

  if (m.status === 'ACTIVE') {
    return 'CLUB+ ATIVO';
  }

  return String(
    m.status || 'INATIVO'
  );
}


// ==========================================================
// TOAST
// ==========================================================

function toast(msg) {

  const el =
    document.getElementById(
      'club-toast'
    );

  el.textContent = msg;

  el.classList.remove(
    'hidden'
  );

  clearTimeout(
    window.__clubToast
  );

  window.__clubToast =
    setTimeout(
      () => {
        el.classList.add(
          'hidden'
        );
      },
      2800
    );
}


// ==========================================================
// UTILIDADES
// ==========================================================

function initials(name) {

  return String(
    name || 'DH'
  )
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(x => x[0])
    .join('')
    .toUpperCase();
}


function normalizeCat(c) {

  return String(
    c || 'GERAL'
  )
    .toUpperCase()
    .replace(
      'RIGIDA',
      'RÍGIDA'
    )
    .trim();
}


function timeMs(v) {

  if (
    !v ||
    v === 'DNF' ||
    v === 'DNS' ||
    v === 'DSQ'
  ) {
    return Infinity;
  }

  const m =
    String(v).match(
      /^(\d+):(\d+)(?:\.(\d+))?$/
    );

  if (!m) {
    return Infinity;
  }

  return (
    Number(m[1]) * 60000 +
    Number(m[2]) * 1000 +
    Number(
      String(
        m[3] || '0'
      )
        .padEnd(3, '0')
        .slice(0, 3)
    )
  );
}


function bestTimeLabel(ms) {

  if (!Number.isFinite(ms)) {
    return '--:--.---';
  }

  const min =
    Math.floor(
      ms / 60000
    );

  const sec =
    Math.floor(
      ms % 60000 / 1000
    );

  const milli =
    Math.floor(
      ms % 1000
    );

  return `${
    String(min)
      .padStart(2, '0')
  }:${
    String(sec)
      .padStart(2, '0')
  }.${
    String(milli)
      .padStart(3, '0')
  }`;
}


// ==========================================================
// RESULTADOS OFICIAIS
// ==========================================================

function myOfficialResults() {

  if (!loggedUser) {
    return [];
  }

  const cpf =
    cleanCPF(
      loggedUser.cpf
    );

  return core.tempos.filter(
    t =>
      t &&
      cleanCPF(t.cpf) === cpf &&
      (
        t.runType === '1st' ||
        !t.runType
      )
  );
}


function eventById(id) {

  return core.events.find(
    e =>
      String(e.id) ===
      String(id)
  );
}


function resultPlacement(t) {

  const cat =
    normalizeCat(t.cat);

  const same =
    core.tempos
      .filter(
        x =>
          x &&
          String(x.evtId) ===
            String(t.evtId) &&
          normalizeCat(x.cat) === cat &&
          (
            x.runType === '1st' ||
            !x.runType
          ) &&
          Number.isFinite(
            timeMs(x.val)
          )
      )
      .sort(
        (a, b) =>
          timeMs(a.val) -
          timeMs(b.val)
      );

  const idx =
    same.findIndex(
      x =>
        cleanCPF(x.cpf) ===
        cleanCPF(t.cpf)
    );

  return idx >= 0
    ? idx + 1
    : null;
}


// ==========================================================
// ESTATÍSTICAS DA CARREIRA
// ==========================================================

function careerStats() {

  const results =
    myOfficialResults();

  let wins = 0;

  let podiums = 0;

  let best = Infinity;


  results.forEach(
    t => {

      const p =
        resultPlacement(t);

      if (p === 1) {
        wins++;
      }

      if (
        p &&
        p <= 5
      ) {
        podiums++;
      }

      best =
        Math.min(
          best,
          timeMs(t.val)
        );
    }
  );


  return {

    races:
      new Set(
        results.map(
          r =>
            String(r.evtId)
        )
      ).size,

    wins,

    podiums,

    best,

    results
  };
}


// ==========================================================
// CONQUISTAS
// ==========================================================

function achievements() {

  const s =
    careerStats();

  const races =
    s.results.length;

  const allClosed =
    core.events.filter(
      e =>
        e.status ===
        'CLOSED'
    ).length;


  return [

    {
      id: 'first',
      icon: 'fa-flag-checkered',
      title: 'PRIMEIRO RESULTADO',
      desc: 'Registrou o primeiro resultado oficial no DH-PE.',
      ok: races >= 1
    },

    {
      id: 'top10',
      icon: 'fa-ranking-star',
      title: 'TOP 10',
      desc: 'Terminou uma etapa entre os 10 melhores da categoria.',
      ok:
        s.results.some(
          t => {

            const p =
              resultPlacement(t);

            return (
              p &&
              p <= 10
            );
          }
        )
    },

    {
      id: 'top5',
      icon: 'fa-fire',
      title: 'TOP 5',
      desc: 'Terminou uma etapa entre os 5 melhores da categoria.',
      ok:
        s.results.some(
          t => {

            const p =
              resultPlacement(t);

            return (
              p &&
              p <= 5
            );
          }
        )
    },

    {
      id: 'podium',
      icon: 'fa-medal',
      title: 'PÓDIO',
      desc: 'Terminou uma etapa entre os 5 primeiros da categoria.',
      ok: s.podiums > 0
    },

    {
      id: 'win',
      icon: 'fa-trophy',
      title: 'VITÓRIA',
      desc: 'Venceu uma etapa na categoria.',
      ok: s.wins > 0
    },

    {
      id: 'sub230',
      icon: 'fa-bolt',
      title: '-2:30 MIN',
      desc: 'Registrou uma descida oficial abaixo de 2 minutos e 30 segundos.',
      ok:
        s.results.some(
          t =>
            timeMs(t.val) <
            150000
        )
    },

    {
      id: 'season',
      icon: 'fa-calendar-check',
      title: 'TEMPORADA COMPLETA',
      desc: 'Participou de todas as etapas encerradas da temporada.',
      ok:
        allClosed > 0 &&
        s.races >= allClosed
    },

    {
      id: 'club',
      icon: 'fa-crown',
      title: 'MEMBRO DH-CLUB',
      desc: 'Faz parte da primeira geração do DH-Club+.',
      ok: hasClubAccess()
    }

  ];
}


// ==========================================================
// HOME
// ==========================================================

function renderHome() {

  const s =
    careerStats();

  const name =
    esc(
      loggedUser.nome ||
      'ATLETA'
    );

  const challenges =
    objValues(
      club.challenges
    )
      .filter(
        c =>
          c.active !== false
      )
      .slice(0, 2);


  const trainings =
    objValues(
      club.trainings
    )
      .filter(
        t =>
          t.active !== false
      )
      .slice(0, 2);


  const sponsors =
    objValues(
      club.sponsors
    )
      .filter(
        s =>
          s.active !== false
      )
      .slice(0, 4);


  document
    .getElementById(
      'view-home'
    )
    .innerHTML = `

    <div class="hero">

      <div class="eyebrow">
        BEM-VINDO AO SEU ESPAÇO PREMIUM
      </div>

      <h2>
        ${name}
      </h2>

      <p>
        Carreira, conquistas,
        desafios, treinos,
        X1 e benefícios
        em um único lugar.
      </p>

      <div class="member-chip">

        <i class="fa-solid fa-crown"></i>

        ${esc(planLabel())}

        •

        ${SYSTEM_YEAR}

      </div>

    </div>


    <div class="grid-stats">

      ${stat(
        'ETAPAS',
        s.races,
        'na temporada'
      )}

      ${stat(
        'PÓDIOS',
        s.podiums,
        'top 5'
      )}

      ${stat(
        'VITÓRIAS',
        s.wins,
        '1º lugar'
      )}

      ${stat(
        'MELHOR TEMPO',
        bestTimeLabel(s.best),
        'oficial'
      )}

    </div>


    <div class="section-title">

      <h3>
        SEU DH-CLUB
      </h3>

      <span>
        ACESSO RÁPIDO
      </span>

    </div>


    <div class="quick-grid">

      ${quick(
        'fa-chart-line',
        'MINHA CARREIRA',
        'Histórico e evolução',
        'career',
        'green'
      )}

      ${quick(
        'fa-medal',
        'CONQUISTAS',
        'Troféus digitais',
        'achievements',
        'purple'
      )}

      ${quick(
        'fa-bolt',
        'X1 PREMIUM',
        'Taxa DH-Club R$ 0,00',
        'x1',
        ''
      )}

      ${quick(
        'fa-gift',
        'BENEFÍCIOS',
        'Vantagens de parceiros',
        'benefits',
        'cyan'
      )}

    </div>


    <div class="section-title">

      <h3>
        DESAFIOS OFF SEASON
      </h3>

      <span>
        ${
          challenges.length
            ? 'ATIVOS'
            : 'EM BREVE'
        }
      </span>

    </div>


    <div class="list">

      ${
        challenges.length

          ? challenges
              .map(
                challengeCard
              )
              .join('')

          : `
            <div class="empty">
              Nenhum desafio publicado ainda.
            </div>
          `
      }

    </div>


    <div class="section-title">

      <h3>
        TREINOS & ENCONTROS
      </h3>

      <span>
        COMUNIDADE
      </span>

    </div>


    <div class="list">

      ${
        trainings.length

          ? trainings
              .map(
                trainingCard
              )
              .join('')

          : `
            <div class="empty">
              Nenhum treino publicado ainda.
            </div>
          `
      }

    </div>


    <div class="section-title">

      <h3>
        PARCEIROS DH-CLUB
      </h3>

      <span>
        APOIO À COMUNIDADE
      </span>

    </div>


    <div
      style="
        display:flex;
        gap:8px;
        overflow:auto;
        padding-bottom:5px
      "
    >

      ${
        sponsors.length

          ? sponsors
              .map(
                s => `
                  <div class="sponsor-logo">
                    ${esc(
                      s.name ||
                      'PARCEIRO'
                    )}
                  </div>
                `
              )
              .join('')

          : `
            <div
              class="empty"
              style="min-width:100%"
            >
              Espaço pronto
              para os patrocinadores
              de 2027.
            </div>
          `
      }

    </div>


    ${
      isAdmin(loggedUser)

        ? `

          <div class="section-title">

            <h3>
              ADMINISTRAÇÃO
            </h3>

            <span>
              BETA
            </span>

          </div>


          <button
            class="secondary-btn"
            style="width:100%"
            onclick="Club.go('admin')"
          >

            <i class="fa-solid fa-sliders"></i>

            ABRIR PAINEL DH-CLUB

          </button>

        `

        : ''
    }

  `;
}


// ==========================================================
// CARDS
// ==========================================================

function stat(
  label,
  value,
  sub
) {

  return `

    <div class="stat-card">

      <div class="stat-label">
        ${label}
      </div>

      <div class="stat-value">
        ${esc(value)}
      </div>

      <div class="stat-sub">
        ${sub}
      </div>

    </div>

  `;
}


function quick(
  icon,
  title,
  desc,
  view,
  color
) {

  return `

    <div
      class="quick-card ${color || ''}"
      onclick="Club.go('${view}')"
    >

      <i class="fa-solid ${icon}"></i>

      <b>
        ${title}
      </b>

      <small>
        ${desc}
      </small>

    </div>

  `;
}


function challengeCard(c) {

  const joined =
    !!club
      .challenge_entries
      ?.[c.id]
      ?.[cleanCPF(
        loggedUser.cpf
      )];


  return `

    <div class="list-card">

      <div class="list-icon">

        <i class="fa-solid fa-fire"></i>

      </div>


      <div class="list-main">

        <b>
          ${esc(
            c.title ||
            'DESAFIO'
          )}
        </b>

        <small>

          ${esc(
            c.description ||
            ''
          )}

          ${
            c.points
              ? `• +${c.points} pts`
              : ''
          }

        </small>

      </div>


      <button
        class="${
          joined
            ? 'secondary-btn'
            : 'primary-btn'
        }"

        onclick="
          Club.toggleChallenge(
            '${c.id}'
          )
        "
      >

        ${
          joined
            ? 'PARTICIPANDO'
            : 'PARTICIPAR'
        }

      </button>

    </div>

  `;
}


function trainingCard(t) {

  const joined =
    !!club
      .training_presence
      ?.[t.id]
      ?.[cleanCPF(
        loggedUser.cpf
      )];


  return `

    <div class="list-card">

      <div
        class="list-icon"

        style="
          color:var(--green);
          background:rgba(
            49,
            208,
            124,
            .1
          )
        "
      >

        <i class="fa-solid fa-bicycle"></i>

      </div>


      <div class="list-main">

        <b>
          ${esc(
            t.title ||
            'TREINO'
          )}
        </b>

        <small>

          ${esc(
            t.dateText ||
            dateBR(t.date)
          )}

          •

          ${esc(
            t.place ||
            'Local a confirmar'
          )}

        </small>

      </div>


      <button
        class="${
          joined
            ? 'secondary-btn'
            : 'primary-btn'
        }"

        onclick="
          Club.toggleTraining(
            '${t.id}'
          )
        "
      >

        ${
          joined
            ? 'CONFIRMADO'
            : 'EU VOU'
        }

      </button>

    </div>

  `;
}


// ==========================================================
// MINHA CARREIRA
// ==========================================================

function renderCareer() {

  const s =
    careerStats();


  const rows =
    s.results
      .slice()
      .sort(
        (a, b) =>
          String(b.evtId)
            .localeCompare(
              String(a.evtId)
            )
      )
      .map(
        t => {

          const e =
            eventById(
              t.evtId
            );

          const p =
            resultPlacement(t);


          return `

            <div
              class="
                premium-card
                career-row
              "
            >

              <div class="place-badge">

                ${
                  p
                    ? `${p}º`
                    : '—'
                }

              </div>


              <div>

                <b>
                  ${esc(
                    e?.t ||
                    'ETAPA'
                  )}
                </b>

                <div
                  style="
                    font-size:9px;
                    color:var(--muted);
                    margin-top:4px
                  "
                >

                  ${esc(
                    normalizeCat(
                      t.cat
                    )
                  )}

                  •

                  ${esc(
                    e?.city ||
                    t.city ||
                    ''
                  )}

                </div>

              </div>


              <div
                style="
                  text-align:right
                "
              >

                <b
                  style="
                    color:var(--gold2)
                  "
                >

                  ${esc(
                    t.val ||
                    '--'
                  )}

                </b>

                <div
                  style="
                    font-size:8px;
                    color:var(--muted);
                    margin-top:4px
                  "
                >

                  OFICIAL

                </div>

              </div>

            </div>

          `;
        }
      )
      .join('');


  document
    .getElementById(
      'view-career'
    )
    .innerHTML = `

    <div class="hero">

      <div class="eyebrow">
        HISTÓRICO ESPORTIVO
      </div>

      <h2>
        Minha Carreira
      </h2>

      <p>
        Seu desempenho oficial
        organizado em um só lugar.
      </p>

    </div>


    <div class="grid-stats">

      ${stat(
        'ETAPAS',
        s.races,
        'disputadas'
      )}

      ${stat(
        'PÓDIOS',
        s.podiums,
        'na carreira atual'
      )}

      ${stat(
        'VITÓRIAS',
        s.wins,
        'na categoria'
      )}

      ${stat(
        'RECORDE',
        bestTimeLabel(s.best),
        'melhor oficial'
      )}

    </div>


    <div class="section-title">

      <h3>
        RESULTADOS OFICIAIS
      </h3>

      <span>
        ${SYSTEM_YEAR}
      </span>

    </div>


    <div class="list">

      ${
        rows ||
        `
          <div class="empty">

            Ainda não há
            resultados oficiais
            para mostrar.

          </div>
        `
      }

    </div>


    <div class="section-title">

      <h3>
        RETROSPECTIVA
      </h3>

      <span>
        COMPARTILHÁVEL
      </span>

    </div>


    <div class="premium-card">

  <div
    style="
      display:flex;
      align-items:center;
      gap:14px;
      margin-bottom:15px;
    "
  >

    <img
      src="${esc(loggedUser.selfie || 'logo.png')}"
      crossorigin="anonymous"
      style="
        width:82px;
        height:82px;
        border-radius:18px;
        object-fit:cover;
        border:2px solid var(--gold);
        background:#07111f;
      "
    >


    <div style="flex:1;">

      <div
        style="
          font-size:9px;
          letter-spacing:2px;
          color:var(--gold2);
          font-weight:900;
          margin-bottom:5px;
        "
      >
        RETROSPECTIVA ${SYSTEM_YEAR}
      </div>


      <b
        style="
          display:block;
          font-size:16px;
        "
      >
        ${esc(loggedUser.nome)}
      </b>


      <div
        style="
          font-size:10px;
          color:var(--muted);
          margin-top:4px;
        "
      >
        ${esc(loggedUser.cat || 'ATLETA DH-PE')}
      </div>

    </div>

  </div>


  <div
    style="
      background:rgba(255,193,7,.08);
      border:1px solid rgba(255,193,7,.22);
      border-radius:14px;
      padding:12px;
      margin-bottom:14px;
    "
  >

    <div
      style="
        display:flex;
        gap:9px;
        align-items:flex-start;
      "
    >

      <i
        class="fa-solid fa-camera"
        style="
          color:var(--gold);
          margin-top:2px;
        "
      ></i>


      <div>

        <b
          style="
            display:block;
            font-size:10px;
            color:var(--gold2);
            margin-bottom:5px;
          "
        >
          FOTO DA RETROSPECTIVA
        </b>


        <div
          style="
            font-size:10px;
            color:var(--muted);
            line-height:1.55;
          "
        >
          A retrospectiva oficial do DH-Club será criada
          usando a mesma foto cadastrada na sua carteirinha
          digital.
          <br><br>
          Se desejar aparecer com outra foto na arte final,
          atualize sua imagem no perfil do DH-PE antes de
          gerar a retrospectiva.
        </div>

      </div>

    </div>

  </div>


  <div
    style="
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:8px;
      margin-bottom:14px;
    "
  >

    <div
      style="
        padding:10px;
        border-radius:12px;
        background:rgba(255,255,255,.04);
        text-align:center;
      "
    >

      <div
        style="
          font-size:8px;
          color:var(--muted);
        "
      >
        ETAPAS
      </div>

      <b
        style="
          font-size:18px;
          color:white;
        "
      >
        ${s.races}
      </b>

    </div>


    <div
      style="
        padding:10px;
        border-radius:12px;
        background:rgba(255,255,255,.04);
        text-align:center;
      "
    >

      <div
        style="
          font-size:8px;
          color:var(--muted);
        "
      >
        TOP 5
      </div>

      <b
        style="
          font-size:18px;
          color:var(--gold2);
        "
      >
        ${s.podiums}
      </b>

    </div>


    <div
      style="
        padding:10px;
        border-radius:12px;
        background:rgba(255,255,255,.04);
        text-align:center;
      "
    >

      <div
        style="
          font-size:8px;
          color:var(--muted);
        "
      >
        VITÓRIAS
      </div>

      <b
        style="
          font-size:18px;
          color:white;
        "
      >
        ${s.wins}
      </b>

    </div>


    <div
      style="
        padding:10px;
        border-radius:12px;
        background:rgba(255,255,255,.04);
        text-align:center;
      "
    >

      <div
        style="
          font-size:8px;
          color:var(--muted);
        "
      >
        MELHOR TEMPO
      </div>

      <b
        style="
          font-size:15px;
          color:var(--gold2);
        "
      >
        ${bestTimeLabel(s.best)}
      </b>

    </div>

  </div>


  <button
    class="secondary-btn"
    style="
      width:100%;
      margin-bottom:8px;
    "
    onclick="
      Club.voltarParaAtualizarFoto()
    "
  >

    <i class="fa-solid fa-camera"></i>

    ATUALIZAR FOTO DA CARTEIRINHA

  </button>


  <button
    class="primary-btn"
    style="width:100%"
    onclick="
      Club.shareRetrospective()
    "
  >

    <i class="fa-solid fa-image"></i>

    GERAR MINHA RETROSPECTIVA

  </button>

</div>

  `;
}


// ==========================================================
// CONQUISTAS
// ==========================================================

function renderAchievements() {

  const a =
    achievements();

  const unlocked =
    a.filter(
      x =>
        x.ok
    ).length;


  document
    .getElementById(
      'view-achievements'
    )
    .innerHTML = `

    <div class="hero">

      <div class="eyebrow">
        TROFÉUS DIGITAIS
      </div>

      <h2>
        Conquistas
      </h2>

      <p>
        ${unlocked}
        de
        ${a.length}
        conquistas desbloqueadas.
      </p>

      <div class="member-chip">

        <i class="fa-solid fa-medal"></i>

        ${unlocked}/${a.length}

      </div>

    </div>


    <div class="section-title">

      <h3>
        MINHA COLEÇÃO
      </h3>

      <span>
        EVOLUA E DESBLOQUEIE
      </span>

    </div>


    <div class="achievement-grid">

      ${
        a.map(
          x => `

            <div
              class="
                achievement
                ${
                  x.ok
                    ? ''
                    : 'locked'
                }
              "
            >

              <div class="medal">

                <i
                  class="
                    fa-solid
                    ${x.icon}
                  "
                ></i>

              </div>


              <b>
                ${x.title}
              </b>


              <small>
                ${x.desc}
              </small>


              <div
                style="
                  margin-top:12px
                "
              >

                <span
                  class="
                    tag
                    ${
                      x.ok
                        ? 'gold'
                        : ''
                    }
                  "
                >

                  ${
                    x.ok
                      ? 'DESBLOQUEADA'
                      : 'BLOQUEADA'
                  }

                </span>

              </div>

            </div>

          `
        )
        .join('')
      }

    </div>

  `;
}


// ==========================================================
// X1 DH-CLUB
// ==========================================================

function clubX1Values() {

  return objValues(
    club.x1_duels
  )
    .sort(
      (a, b) =>
        new Date(
          b.date || 0
        ) -
        new Date(
          a.date || 0
        )
    );
}


function renderX1() {

  const duels =
    clubX1Values();


  document
    .getElementById(
      'view-x1'
    )
    .innerHTML = `

    <div class="hero x1-hero">

      <div class="eyebrow">
        X1 EXCLUSIVO DH-CLUB
      </div>


      <h2>

        <i
          class="
            fa-solid
            fa-bolt
          "

          style="
            color:var(--gold)
          "
        ></i>

        X1 Premium

      </h2>


      <p>

        Desafie outro atleta.

        No DH-Club
        a taxa de serviço
        de R$ 5,00
        por participante
        é

        <b
          style="
            color:var(--green)
          "
        >
          ISENTA
        </b>.

      </p>


      <div class="member-chip">

        <i
          class="
            fa-solid
            fa-circle-check
          "
        ></i>

        TAXA DH-CLUB:
        R$ 0,00

      </div>

    </div>


    <div
      class="btn-row"
      style="margin-top:12px"
    >

      <button
        class="primary-btn"

        onclick="
          Club.openNewX1()
        "
      >

        <i class="fa-solid fa-plus"></i>

        NOVO DESAFIO

      </button>


      <button
        class="secondary-btn"

        onclick="
          Club.render('x1')
        "
      >

        <i class="fa-solid fa-rotate"></i>

        ATUALIZAR

      </button>

    </div>


    <div class="section-title">

      <h3>
        COMBATES
      </h3>

      <span>
        ${duels.length}
      </span>

    </div>


    <div class="list">

      ${
        duels.length

          ? duels
              .map(
                x1Card
              )
              .join('')

          : `

            <div class="empty">

              Nenhum X1
              no DH-Club ainda.

              Lance o primeiro
              desafio.

            </div>

          `
      }

    </div>

  `;
}


// ==========================================================
// STATUS DO X1
// ==========================================================

function x1Status(d) {

  const map = {

    PENDENTE_RESPOSTA:
      'AGUARDANDO ACEITE',

    AGUARDANDO_PAGAMENTO:
      'AGUARDANDO PAGAMENTO',

    AGUARDANDO_APROVACAO:
      'AGUARDANDO APROVAÇÃO',

    ATIVO:
      'COMBATE ATIVO',

    CONCLUIDO:
      'CONCLUÍDO',

    ARREGOU:
      'ENCERRADO'

  };


  return (
    map[d.status] ||
    d.status ||
    'PENDENTE'
  );
}


// ==========================================================
// CARD X1
// ==========================================================

function x1Card(d) {

  const me =
    cleanCPF(
      loggedUser.cpf
    );


  const isTarget =
    cleanCPF(
      d.challengedCpf
    ) === me;


  const isParty =
    [
      cleanCPF(
        d.challengerCpf
      ),

      cleanCPF(
        d.challengedCpf
      )
    ].includes(me);


  let actions = '';


  if (
    isTarget &&
    d.status ===
      'PENDENTE_RESPOSTA'
  ) {

    actions = `

      <div
        class="btn-row"
        style="margin-top:12px"
      >

        <button
          class="primary-btn"

          onclick="
            Club.acceptX1(
              '${d.id}'
            )
          "
        >

          ACEITAR

        </button>


        <button
          class="danger-btn"

          onclick="
            Club.declineX1(
              '${d.id}'
            )
          "
        >

          RECUSAR

        </button>

      </div>

    `;
  }


  if (
    isParty &&
    d.status ===
      'AGUARDANDO_PAGAMENTO'
  ) {

    const paid =
      cleanCPF(
        d.challengerCpf
      ) === me

        ? d.challengerStakePaid

        : d.challengedStakePaid;


    actions =
      paid

        ? `

          <div
            style="
              margin-top:12px
            "
          >

            <span
              class="tag green"
            >

              SEU VALOR REGISTRADO

            </span>

          </div>

        `

        : `

          <button
            class="primary-btn"

            style="
              width:100%;
              margin-top:12px
            "

            onclick="
              Club.payX1(
                '${d.id}'
              )
            "
          >

            <i
              class="
                fa-brands
                fa-whatsapp
              "
            ></i>

            REGISTRAR PAGAMENTO
            ${brl(
              d.betValue
            )}

          </button>

        `;
  }


  return `

    <div class="x1-duel">

      <div class="x1-head">

        <span class="tag gold">

          ${esc(
            eventById(
              d.evtId
            )?.t ||
            'X1'
          )}

        </span>


        <div>

          <b>
            ${brl(
              d.betValue
            )}
          </b>

          <div class="fee-zero">
            + R$ 0,00 TAXA CLUB
          </div>

        </div>

      </div>


      <div class="x1-versus">

        <div class="fighter">

          <b>
            ${esc(
              d.challengerName
            )}
          </b>

          <small>
            DESAFIANTE
          </small>

        </div>


        <div class="vs">
          VS
        </div>


        <div class="fighter">

          <b>
            ${esc(
              d.challengedName
            )}
          </b>

          <small>
            DESAFIADO
          </small>

        </div>

      </div>


      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          margin-top:13px
        "
      >

        <span class="tag blue">

          ${esc(
            x1Status(d)
          )}

        </span>


        ${
          d.advantageSec

            ? `

              <span class="tag">

                Vantagem
                ${esc(
                  d.advantageSec
                )}s

              </span>

            `

            : ''
        }

      </div>


      ${actions}

    </div>

  `;
}


// ==========================================================
// BENEFÍCIOS
// ==========================================================

function renderBenefits() {

  const benefits =
    objValues(
      club.benefits
    )
      .filter(
        b =>
          b.active !== false
      );


  document
    .getElementById(
      'view-benefits'
    )
    .innerHTML = `

    <div class="hero">

      <div class="eyebrow">
        VANTAGENS PARA MEMBROS
      </div>

      <h2>
        Benefícios
      </h2>

      <p>
        Descontos e experiências
        que ajudam a mensalidade
        do Club a se pagar.
      </p>

      <div class="member-chip">

        <i class="fa-solid fa-tag"></i>

        CLUBE DE VANTAGENS

      </div>

    </div>


    <div class="section-title">

      <h3>
        BENEFÍCIOS ATIVOS
      </h3>

      <span>
        ${benefits.length}
      </span>

    </div>


    <div class="list">

      ${
        benefits.length

          ? benefits
              .map(
                b => `

                  <div class="benefit-card">

                    <span class="tag gold">

                      ${esc(
                        b.discount ||
                        'EXCLUSIVO'
                      )}

                    </span>


                    <h4>

                      ${esc(
                        b.title ||
                        b.partner ||
                        'BENEFÍCIO'
                      )}

                    </h4>


                    <p>
                      ${esc(
                        b.description ||
                        ''
                      )}
                    </p>


                    ${
                      b.code

                        ? `

                          <div
                            style="
                              margin:10px 0
                            "
                          >

                            <span
                              class="
                                tag
                                green
                              "
                            >

                              CUPOM:
                              ${esc(
                                b.code
                              )}

                            </span>

                          </div>

                        `

                        : ''
                    }


                    ${
                      b.contact

                        ? `

                          <button
                            class="
                              secondary-btn
                            "

                            onclick="
                              Club.openContact(
                                '${esc(
                                  b.contact
                                )}'
                              )
                            "
                          >

                            USAR BENEFÍCIO

                          </button>

                        `

                        : ''
                    }

                  </div>

                `
              )
              .join('')

          : `

            <div class="empty">

              Área pronta
              para receber benefícios
              de patrocinadores
              e parceiros.

            </div>

          `
      }

    </div>

  `;
}


// ==========================================================
// ADMIN DH-CLUB
// ==========================================================

function renderAdmin() {

  if (
    !isAdmin(
      loggedUser
    )
  ) {

    document
      .getElementById(
        'view-admin'
      )
      .innerHTML = `

        <div class="empty">
          Acesso restrito.
        </div>

      `;

    return;
  }


  document
    .getElementById(
      'view-admin'
    )
    .innerHTML = `

    <div class="hero">

      <div class="eyebrow">
        PAINEL INTERNO
      </div>

      <h2>
        Admin DH-Club
      </h2>

      <p>
        Controle separado
        do sistema principal.
      </p>

    </div>


    <div class="section-title">

      <h3>
        MEMBROS BETA
      </h3>

      <span>
        ATIVAÇÃO MANUAL
      </span>

    </div>


    <div class="admin-box">

      <div class="field">

        <label>
          CPF DO ATLETA
        </label>

        <input
          id="adm-club-cpf"
          inputmode="numeric"
          placeholder="Somente números"
        >

      </div>


      <div class="field">

        <label>
          STATUS
        </label>

        <select
          id="adm-club-status"
        >

          <option value="BETA">
            BETA TESTER
          </option>

          <option value="FOUNDER">
            FUNDADOR
          </option>

          <option value="ACTIVE">
            ATIVO
          </option>

          <option value="INACTIVE">
            INATIVO
          </option>

        </select>

      </div>


      <button
        class="primary-btn"
        style="width:100%"

        onclick="
          Club.saveMember()
        "
      >

        SALVAR ACESSO

      </button>

    </div>


    <div class="section-title">

      <h3>
        CONTEÚDO
      </h3>

      <span>
        OFF SEASON
      </span>

    </div>


    <div class="quick-grid">

      <div
        class="quick-card"

        onclick="
          Club.adminForm(
            'challenge'
          )
        "
      >

        <i class="fa-solid fa-fire"></i>

        <b>
          NOVO DESAFIO
        </b>

        <small>
          Desafio semanal
          com pontos
        </small>

      </div>


      <div
        class="quick-card green"

        onclick="
          Club.adminForm(
            'training'
          )
        "
      >

        <i class="fa-solid fa-bicycle"></i>

        <b>
          NOVO TREINO
        </b>

        <small>
          Treino ou encontro
        </small>

      </div>


      <div
        class="quick-card cyan"

        onclick="
          Club.adminForm(
            'benefit'
          )
        "
      >

        <i class="fa-solid fa-gift"></i>

        <b>
          NOVO BENEFÍCIO
        </b>

        <small>
          Parceiro + cupom
        </small>

      </div>


      <div
        class="quick-card purple"

        onclick="
          Club.adminForm(
            'sponsor'
          )
        "
      >

        <i class="fa-solid fa-handshake"></i>

        <b>
          PATROCINADOR
        </b>

        <small>
          Marca apoiadora
        </small>

      </div>

    </div>


    <div class="section-title">

      <h3>
        CONFIGURAÇÃO
      </h3>

      <span>
        LANÇAMENTO 2027
      </span>

    </div>


    <div class="admin-box">

      <div class="field">

        <label>
          PREÇO MENSAL PREVISTO
        </label>

        <input
          id="adm-club-price"
          type="number"
          step="0.01"
          value="${
            Number(
              club.config
                ?.monthlyPrice ||
              9.90
            ).toFixed(2)
          }"
        >

      </div>


      <div class="field">

        <label>
          MODO BETA
        </label>

        <select
          id="adm-club-beta"
        >

          <option
            value="true"
            ${
              club.config
                ?.betaMode !== false
                ? 'selected'
                : ''
            }
          >
            ATIVO
          </option>

          <option
            value="false"
            ${
              club.config
                ?.betaMode === false
                ? 'selected'
                : ''
            }
          >
            DESATIVADO
          </option>

        </select>

      </div>


      <button
        class="secondary-btn"
        style="width:100%"

        onclick="
          Club.saveConfig()
        "
      >

        SALVAR CONFIGURAÇÃO

      </button>

    </div>

  `;
}


// ==========================================================
// NAVEGAÇÃO
// ==========================================================

function render(
  view = currentView
) {

  currentView = view;

  if (view === 'home') {
    renderHome();
  }

  if (view === 'career') {
    renderCareer();
  }

  if (
    view ===
    'achievements'
  ) {
    renderAchievements();
  }

  if (view === 'x1') {
    renderX1();
  }

  if (
    view ===
    'benefits'
  ) {
    renderBenefits();
  }

  if (view === 'admin') {
    renderAdmin();
  }
}


function go(view) {

  document
    .querySelectorAll(
      '.club-view'
    )
    .forEach(
      x =>
        x.classList.remove(
          'active'
        )
    );


  const el =
    document.getElementById(
      'view-' + view
    );


  if (el) {
    el.classList.add(
      'active'
    );
  }


  document
    .querySelectorAll(
      '.club-nav-item'
    )
    .forEach(
      x =>
        x.classList.toggle(
          'active',
          x.dataset.view === view
        )
    );


  render(view);


  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}


// ==========================================================
// MODAIS
// ==========================================================

function openModal(html) {

  document
    .getElementById(
      'club-modal-content'
    )
    .innerHTML = html;


  document
    .getElementById(
      'club-modal'
    )
    .classList.remove(
      'hidden'
    );
}


function closeModal() {

  document
    .getElementById(
      'club-modal'
    )
    .classList.add(
      'hidden'
    );
}


// ==========================================================
// PUSH
// ==========================================================

async function pushToCpf(
  cpf,
  title,
  body
) {

  const u =
    core.users.find(
      x =>
        cleanCPF(x.cpf) ===
        cleanCPF(cpf)
    );


  if (!u?.fcmToken) {
    return;
  }


  await database
    .ref(
      'push_queue'
    )
    .push({

      token:
        u.fcmToken,

      title,

      body,

      status:
        'pending',

      timestamp:
        Date.now()

    });
}


// ==========================================================
// DESAFIOS OFF SEASON
// ==========================================================

async function toggleChallenge(
  id
) {

  const cpf =
    cleanCPF(
      loggedUser.cpf
    );


  const ref =
    database.ref(
      `${CLUB_ROOT}/challenge_entries/${id}/${cpf}`
    );


  const joined =
    !!club
      .challenge_entries
      ?.[id]
      ?.[cpf];


  if (joined) {

    await ref.remove();

  } else {

    await ref.set({

      joinedAt:
        new Date()
          .toISOString()

    });
  }


  toast(
    joined
      ? 'Participação removida.'
      : 'Você entrou no desafio!'
  );
}


// ==========================================================
// TREINOS
// ==========================================================

async function toggleTraining(
  id
) {

  const cpf =
    cleanCPF(
      loggedUser.cpf
    );


  const ref =
    database.ref(
      `${CLUB_ROOT}/training_presence/${id}/${cpf}`
    );


  const joined =
    !!club
      .training_presence
      ?.[id]
      ?.[cpf];


  if (joined) {

    await ref.remove();

  } else {

    await ref.set({

      joinedAt:
        new Date()
          .toISOString(),

      name:
        loggedUser.nome

    });
  }


  toast(
    joined
      ? 'Presença removida.'
      : 'Presença confirmada!'
  );
}


// ==========================================================
// NOVO X1
// ==========================================================

function openNewX1() {

  const evts =
    core.events
      .filter(
        e =>
          e.status === 'OPEN'
      )
      .map(
        e => `

          <option
            value="${esc(e.id)}"
          >

            ${esc(e.t)}

          </option>

        `
      )
      .join('');


  const opponents =
    core.users
      .filter(
        u =>
          cleanCPF(u.cpf) !==
            cleanCPF(
              loggedUser.cpf
            ) &&
          u.role !== 'ADMIN'
      )
      .sort(
        (a, b) =>
          String(a.nome)
            .localeCompare(
              String(b.nome)
            )
      )
      .map(
        u => `

          <option
            value="${
              esc(
                cleanCPF(
                  u.cpf
                )
              )
            }"
          >

            ${esc(u.nome)}

            •

            ${esc(
              u.cat || ''
            )}

          </option>

        `
      )
      .join('');


  openModal(`

    <div class="eyebrow">

      X1 PREMIUM
      •
      TAXA R$ 0,00

    </div>


    <h2>
      Novo desafio
    </h2>


    <div class="field">

      <label>
        ETAPA
      </label>

      <select
        id="club-x1-evt"
      >

        <option value="">
          Selecione…
        </option>

        ${evts}

      </select>

    </div>


    <div class="field">

      <label>
        ADVERSÁRIO
      </label>

      <select
        id="club-x1-opponent"
      >

        <option value="">
          Selecione…
        </option>

        ${opponents}

      </select>

    </div>


    <div class="field">

      <label>
        VALOR DO X1 POR ATLETA
      </label>

      <input
        id="club-x1-bet"
        type="number"
        min="0"
        step="1"
        placeholder="Ex.: 50"
      >

    </div>


    <div class="field">

      <label>
        VANTAGEM EM SEGUNDOS
        (OPCIONAL)
      </label>

      <input
        id="club-x1-adv"
        type="number"
        min="0"
        step="0.001"
        placeholder="0"
      >

    </div>


    <p
      style="
        font-size:10px;
        color:var(--muted);
        line-height:1.5
      "
    >

      No DH-Club
      a taxa adicional
      de R$ 5,00
      do sistema
      é isenta.

      Se houver valor
      do X1,
      permanece apenas
      o valor combinado
      entre os atletas.

    </p>


    <button
      class="primary-btn"
      style="width:100%"

      onclick="
        Club.createX1()
      "
    >

      LANÇAR DESAFIO

    </button>

  `);
}


// ==========================================================
// CRIAR X1
// ==========================================================

async function createX1() {

  const evtId =
    document
      .getElementById(
        'club-x1-evt'
      )
      .value;


  const oppCpf =
    cleanCPF(
      document
        .getElementById(
          'club-x1-opponent'
        )
        .value
    );


  const bet =
    Number(
      document
        .getElementById(
          'club-x1-bet'
        )
        .value || 0
    );


  const adv =
    Number(
      document
        .getElementById(
          'club-x1-adv'
        )
        .value || 0
    );


  if (
    !evtId ||
    !oppCpf
  ) {

    return toast(
      'Selecione etapa e adversário.'
    );
  }


  if (
    bet < 0 ||
    adv < 0
  ) {

    return toast(
      'Valores inválidos.'
    );
  }


  const opp =
    core.users.find(
      u =>
        cleanCPF(u.cpf) ===
        oppCpf
    );


  if (!opp) {

    return toast(
      'Adversário não encontrado.'
    );
  }


  const id =
    'clubx1_' +
    Date.now();


  const duel = {

    id,

    evtId,

    challengerCpf:
      cleanCPF(
        loggedUser.cpf
      ),

    challengerName:
      loggedUser.nome,

    challengedCpf:
      oppCpf,

    challengedName:
      opp.nome,

    betValue:
      bet,

    platformFee:
      0,

    feeExempt:
      true,

    advantageSec:
      adv,

    advantageCpf:
      adv > 0
        ? oppCpf
        : null,

    status:
      'PENDENTE_RESPOSTA',

    challengerStakePaid:
      bet === 0,

    challengedStakePaid:
      bet === 0,

    winnerCpf:
      null,

    date:
      new Date()
        .toISOString(),

    source:
      'DHCLUB'

  };


  await database
    .ref(
      `${CLUB_ROOT}/x1_duels/${id}`
    )
    .set(
      duel
    );


  await pushToCpf(

    oppCpf,

    '🔥 X1 DH-Club recebido!',

    `${
      loggedUser.nome
    } desafiou você para um X1. Taxa DH-Club: R$ 0,00.`

  );


  closeModal();


  toast(
    'Desafio lançado!'
  );
}


// ==========================================================
// ACEITAR X1
// ==========================================================

async function acceptX1(
  id
) {

  const d =
    club.x1_duels?.[id];


  if (!d) {
    return;
  }


  const next =
    Number(
      d.betValue || 0
    ) > 0

      ? 'AGUARDANDO_PAGAMENTO'

      : 'ATIVO';


  await database
    .ref(
      `${CLUB_ROOT}/x1_duels/${id}`
    )
    .update({

      status:
        next,

      acceptedAt:
        new Date()
          .toISOString()

    });


  await pushToCpf(

    d.challengerCpf,

    '✅ X1 aceito!',

    `${
      d.challengedName
    } aceitou o desafio no DH-Club.`

  );


  toast(

    next === 'ATIVO'

      ? 'X1 ativado!'

      : 'Desafio aceito. Agora registre o valor combinado.'

  );
}


// ==========================================================
// RECUSAR X1
// ==========================================================

async function declineX1(
  id
) {

  const d =
    club.x1_duels?.[id];


  if (!d) {
    return;
  }


  await database
    .ref(
      `${CLUB_ROOT}/x1_duels/${id}`
    )
    .update({

      status:
        'ARREGOU',

      endedAt:
        new Date()
          .toISOString()

    });


  await pushToCpf(

    d.challengerCpf,

    'X1 encerrado',

    `${
      d.challengedName
    } não aceitou o desafio.`

  );


  toast(
    'Desafio encerrado.'
  );
}


// ==========================================================
// REGISTRAR PAGAMENTO DO X1
// ==========================================================

async function payX1(
  id
) {

  const d =
    club.x1_duels?.[id];


  if (!d) {
    return;
  }


  const me =
    cleanCPF(
      loggedUser.cpf
    );


  const updates = {};


  if (
    cleanCPF(
      d.challengerCpf
    ) === me
  ) {

    updates
      .challengerStakePaid =
      true;
  }


  if (
    cleanCPF(
      d.challengedCpf
    ) === me
  ) {

    updates
      .challengedStakePaid =
      true;
  }


  updates.lastPaymentAt =
    new Date()
      .toISOString();


  await database
    .ref(
      `${CLUB_ROOT}/x1_duels/${id}`
    )
    .update(
      updates
    );


  const phone =
    String(
      core.config
        ?.phone ||
      ''
    )
      .replace(
        /\D/g,
        ''
      );


  const msg = `Olá! Registro do X1 DH-Club.

Combate: ${d.challengerName} VS ${d.challengedName}
Valor combinado: ${brl(d.betValue)}
Taxa DH-Club: R$ 0,00

Segue o comprovante:`;


  if (phone) {

    window.open(

      `https://wa.me/55${phone}?text=${
        encodeURIComponent(msg)
      }`,

      '_blank'

    );
  }


  toast(
    'Pagamento registrado. Taxa do Club isenta.'
  );
}


// ==========================================================
// ADMIN — SALVAR MEMBRO
// ==========================================================

async function saveMember() {

  const cpf =
    cleanCPF(
      document
        .getElementById(
          'adm-club-cpf'
        )
        .value
    );


  const status =
    document
      .getElementById(
        'adm-club-status'
      )
      .value;


  if (
    cpf.length < 11
  ) {

    return toast(
      'CPF inválido.'
    );
  }


  const user =
    core.users.find(
      u =>
        cleanCPF(u.cpf) ===
        cpf
    );


  await database
    .ref(
      `${CLUB_ROOT}/members/${cpf}`
    )
    .set({

      status,

      plan:
        status === 'BETA'
          ? 'BETA'
          : 'MONTHLY',

      name:
        user?.nome || '',

      memberSince:
        new Date()
          .toISOString(),

      updatedAt:
        Date.now()

    });


  toast(
    'Acesso DH-Club atualizado.'
  );
}


// ==========================================================
// ADMIN — CONFIGURAÇÃO
// ==========================================================

async function saveConfig() {

  const monthlyPrice =
    Number(
      document
        .getElementById(
          'adm-club-price'
        )
        .value ||
      9.90
    );


  const betaMode =
    document
      .getElementById(
        'adm-club-beta'
      )
      .value ===
      'true';


  await database
    .ref(
      `${CLUB_ROOT}/config`
    )
    .update({

      monthlyPrice,

      betaMode,

      launchYear:
        2027,

      updatedAt:
        Date.now()

    });


  toast(
    'Configuração salva.'
  );
}


// ==========================================================
// ADMIN — FORMULÁRIOS
// ==========================================================

function adminForm(type) {

  const defs = {

    challenge: {

      title:
        'Novo desafio',

      fields: `

        <div class="field">

          <label>
            TÍTULO
          </label>

          <input
            id="af-title"
          >

        </div>


        <div class="field">

          <label>
            DESCRIÇÃO
          </label>

          <textarea
            id="af-desc"
          ></textarea>

        </div>


        <div class="field">

          <label>
            PONTOS
          </label>

          <input
            id="af-points"
            type="number"
            value="50"
          >

        </div>

      `
    },


    training: {

      title:
        'Novo treino',

      fields: `

        <div class="field">

          <label>
            TÍTULO
          </label>

          <input
            id="af-title"
          >

        </div>


        <div class="field">

          <label>
            DATA / TEXTO
          </label>

          <input
            id="af-date"
            placeholder="Domingo • 08:00"
          >

        </div>


        <div class="field">

          <label>
            LOCAL
          </label>

          <input
            id="af-place"
          >

        </div>

      `
    },


    benefit: {

      title:
        'Novo benefício',

      fields: `

        <div class="field">

          <label>
            TÍTULO
          </label>

          <input
            id="af-title"
          >

        </div>


        <div class="field">

          <label>
            DESCONTO
          </label>

          <input
            id="af-discount"
            placeholder="10% OFF"
          >

        </div>


        <div class="field">

          <label>
            DESCRIÇÃO
          </label>

          <textarea
            id="af-desc"
          ></textarea>

        </div>


        <div class="field">

          <label>
            CUPOM
          </label>

          <input
            id="af-code"
          >

        </div>


        <div class="field">

          <label>
            CONTATO/URL
          </label>

          <input
            id="af-contact"
          >

        </div>

      `
    },


    sponsor: {

      title:
        'Novo patrocinador',

      fields: `

        <div class="field">

          <label>
            NOME DA MARCA
          </label>

          <input
            id="af-title"
          >

        </div>


        <div class="field">

          <label>
            CONTATO/URL
          </label>

          <input
            id="af-contact"
          >

        </div>

      `
    }

  };


  const d =
    defs[type];


  openModal(`

    <div class="eyebrow">
      ADMIN DH-CLUB
    </div>

    <h2>
      ${d.title}
    </h2>

    ${d.fields}

    <button
      class="primary-btn"
      style="width:100%"

      onclick="
        Club.saveAdminItem(
          '${type}'
        )
      "
    >

      SALVAR

    </button>

  `);
}


// ==========================================================
// ADMIN — SALVAR CONTEÚDO
// ==========================================================

async function saveAdminItem(
  type
) {

  const id =
    type +
    '_' +
    Date.now();


  const base = {

    id,

    active:
      true,

    createdAt:
      new Date()
        .toISOString()

  };


  let path;

  let obj;


  if (
    type ===
    'challenge'
  ) {

    path =
      'challenges';

    obj = {

      ...base,

      title:
        document
          .getElementById(
            'af-title'
          )
          .value,

      description:
        document
          .getElementById(
            'af-desc'
          )
          .value,

      points:
        Number(
          document
            .getElementById(
              'af-points'
            )
            .value || 0
        )

    };
  }


  if (
    type ===
    'training'
  ) {

    path =
      'trainings';

    obj = {

      ...base,

      title:
        document
          .getElementById(
            'af-title'
          )
          .value,

      dateText:
        document
          .getElementById(
            'af-date'
          )
          .value,

      place:
        document
          .getElementById(
            'af-place'
          )
          .value

    };
  }


  if (
    type ===
    'benefit'
  ) {

    path =
      'benefits';

    obj = {

      ...base,

      title:
        document
          .getElementById(
            'af-title'
          )
          .value,

      discount:
        document
          .getElementById(
            'af-discount'
          )
          .value,

      description:
        document
          .getElementById(
            'af-desc'
          )
          .value,

      code:
        document
          .getElementById(
            'af-code'
          )
          .value,

      contact:
        document
          .getElementById(
            'af-contact'
          )
          .value

    };
  }


  if (
    type ===
    'sponsor'
  ) {

    path =
      'sponsors';

    obj = {

      ...base,

      name:
        document
          .getElementById(
            'af-title'
          )
          .value,

      contact:
        document
          .getElementById(
            'af-contact'
          )
          .value

    };
  }


  if (!obj) {
    return;
  }


  await database
    .ref(
      `${CLUB_ROOT}/${path}/${id}`
    )
    .set(
      obj
    );


  closeModal();


  toast(
    'Conteúdo publicado.'
  );


  renderAdmin();
}


// ==========================================================
// CONTATO BENEFÍCIO
// ==========================================================

function openContact(
  contact
) {

  if (
    /^https?:/i.test(
      contact
    )
  ) {

    window.open(
      contact,
      '_blank'
    );

  } else {

    const p =
      String(contact)
        .replace(
          /\D/g,
          ''
        );


    if (p) {

      window.open(
        `https://wa.me/55${p}`,
        '_blank'
      );
    }
  }
}


// ==========================================================
// RETROSPECTIVA
// ==========================================================

  function voltarParaAtualizarFoto() {

  const confirmou = confirm(
    "A retrospectiva usa a mesma foto da sua carteirinha digital.\n\n" +
    "Você será levado de volta ao DH-PE para atualizar sua foto no PERFIL."
  );


  if (!confirmou) {
    return;
  }


  localStorage.setItem(
    'dhclub_voltar_para_perfil',
    '1'
  );


  window.location.href =
    'index.html';
}
  
async function shareRetrospective() {

  const s =
    careerStats();


  const txt =
`🏁 Minha temporada DH-PE ${SYSTEM_YEAR}

${s.races} etapas
${s.podiums} pódios
${s.wins} vitórias

Melhor tempo:
${bestTimeLabel(s.best)}

DH-Club+`;


  try {

    if (
      navigator.share
    ) {

      await navigator.share({

        title:
          `Minha temporada ${SYSTEM_YEAR}`,

        text:
          txt

      });

    } else {

      await navigator
        .clipboard
        .writeText(
          txt
        );


      toast(
        'Retrospectiva copiada!'
      );
    }

  } catch (e) {
  }
}


// ==========================================================
// NORMALIZAR BANCO DO CLUB
// ==========================================================

function normalizeClub(raw) {

  return {

    config:
      raw?.config || {},

    members:
      raw?.members || {},

    challenges:
      raw?.challenges || {},

    trainings:
      raw?.trainings || {},

    benefits:
      raw?.benefits || {},

    sponsors:
      raw?.sponsors || {},

    x1_duels:
      raw?.x1_duels || {},

    challenge_entries:
      raw?.challenge_entries || {},

    training_presence:
      raw?.training_presence || {}

  };
}


// ==========================================================
// EVENTOS DA INTERFACE
// ==========================================================

function bind() {

  document
    .querySelectorAll(
      '.club-nav-item'
    )
    .forEach(
      b =>
        b.addEventListener(
          'click',
          () =>
            go(
              b.dataset.view
            )
        )
    );


  document
    .getElementById(
      'club-notif-btn'
    )
    .addEventListener(
      'click',
      () => {

        render();

        toast(
          'DH-Club atualizado.'
        );
      }
    );


  document
    .getElementById(
      'club-avatar-btn'
    )
    .addEventListener(
      'click',
      () =>
        openModal(`

          <div class="eyebrow">
            MEMBRO DH-CLUB
          </div>

          <h2>
            ${esc(
              loggedUser.nome
            )}
          </h2>

          <p
            style="
              color:var(--muted);
              font-size:11px
            "
          >

            ${esc(
              loggedUser.cat ||
              ''
            )}

            •

            ${esc(
              loggedUser.city ||
              ''
            )}

          </p>


          <div class="premium-card">

            <b>
              ${esc(
                planLabel()
              )}
            </b>

            <p
              style="
                font-size:10px;
                color:var(--muted)
              "
            >

              Preço previsto
              para lançamento:

              ${
                brl(
                  club.config
                    ?.monthlyPrice ||
                  9.90
                )
              }/mês.

            </p>

          </div>


          <button
            class="secondary-btn"

            style="
              width:100%;
              margin-top:10px
            "

            onclick="
              location.href='index.html'
            "
          >

            VOLTAR AO DH-PE

          </button>

        `)
    );
}


// ==========================================================
// INICIALIZAÇÃO
// ==========================================================

async function init() {

  loggedUser =
    sessionUser();

  // Aguarda o Firebase Authentication restaurar
// o usuário que já entrou pelo DH-PE.
await new Promise((resolve) => {

    const unsubscribe =
        auth.onAuthStateChanged(() => {

            unsubscribe();

            resolve();

        });

});

  if (!loggedUser) {

    document
      .getElementById(
        'club-splash'
      )
      .classList.add(
        'hidden'
      );


    document
      .getElementById(
        'club-gate'
      )
      .classList.remove(
        'hidden'
      );


    return;
  }


  document
    .getElementById(
      'club-avatar-initials'
    )
    .textContent =
      initials(
        loggedUser.nome
      );


  const [
    coreSnap,
    clubSnap
  ] =
    await Promise.all([

      database
        .ref(
          DB_KEY
        )
        .once(
          'value'
        ),

      database
        .ref(
          CLUB_ROOT
        )
        .once(
          'value'
        )

    ]);


  const c =
    coreSnap.val() || {};


  core = {

    users:
      objValues(
        c.users
      ),

    events:
      objValues(
        c.events
      ),

    tempos:
      objValues(
        c.tempos
      ),

    config:
      c.config || {}

  };


  club =
    normalizeClub(
      clubSnap.val() ||
      {}
    );


  const fresh =
    core.users.find(
      u =>
        cleanCPF(u.cpf) ===
        cleanCPF(
          loggedUser.cpf
        )
    );


  if (fresh) {

    loggedUser =
      fresh;
  }


  if (!hasClubAccess()) {

    document
      .getElementById(
        'club-splash'
      )
      .classList.add(
        'hidden'
      );


    document
      .getElementById(
        'club-gate'
      )
      .classList.remove(
        'hidden'
      );


    document
      .getElementById(
        'gate-title'
      )
      .textContent =
        'DH-Club em Beta';


    document
      .getElementById(
        'gate-message'
      )
      .innerHTML =
        `O DH-Club está sendo testado antes do lançamento de 2027.<br><br>Seu acesso ainda não foi liberado pela organização.`;


    return;
  }


  document
    .getElementById(
      'club-splash'
    )
    .classList.add(
      'hidden'
    );


  document
    .getElementById(
      'club-app'
    )
    .classList.remove(
      'hidden'
    );


  bind();


  renderHome();


  // ========================================================
  // ATUALIZAÇÕES DO BANCO PRINCIPAL EM TEMPO REAL
  // ========================================================

  database
    .ref(
      DB_KEY
    )
    .on(
      'value',
      snap => {

        const c =
          snap.val() ||
          {};


        core = {

          users:
            objValues(
              c.users
            ),

          events:
            objValues(
              c.events
            ),

          tempos:
            objValues(
              c.tempos
            ),

          config:
            c.config ||
            {}

        };


        const fresh =
          core.users.find(
            u =>
              cleanCPF(u.cpf) ===
              cleanCPF(
                loggedUser.cpf
              )
          );


        if (fresh) {

          loggedUser =
            fresh;
        }


        render(
          currentView
        );
      }
    );


  // ========================================================
  // ATUALIZAÇÕES DO DH-CLUB EM TEMPO REAL
  // ========================================================

  database
    .ref(
      CLUB_ROOT
    )
    .on(
      'value',
      snap => {

        club =
          normalizeClub(
            snap.val() ||
            {}
          );


        render(
          currentView
        );
      }
    );
}


// ==========================================================
// EXPORTA FUNÇÕES PARA O HTML
// ==========================================================

window.Club = {

  voltarParaAtualizarFoto,

  go,

  render,

  closeModal,

  toggleChallenge,

  toggleTraining,

  openNewX1,

  createX1,

  acceptX1,

  declineX1,

  payX1,

  saveMember,

  saveConfig,

  adminForm,

  saveAdminItem,

  openContact,

  shareRetrospective

};


// ==========================================================
// INICIA O DH-CLUB
// ==========================================================

init().catch(err => {

    console.error("ERRO DH-CLUB:", err);

    const splash =
        document.getElementById('club-splash');

    const gate =
        document.getElementById('club-gate');

    const title =
        document.getElementById('gate-title');

    const message =
        document.getElementById('gate-message');


    if (splash) {
        splash.classList.add('hidden');
    }


    if (gate) {
        gate.classList.remove('hidden');
    }


    if (title) {
        title.textContent =
            'Erro ao abrir DH-Club';
    }


    if (message) {

        const codigo =
            err && err.code
                ? err.code
                : 'SEM_CODIGO';

        const detalhe =
            err && err.message
                ? err.message
                : String(err);


        message.innerHTML = `
            <b style="color:#ffcc4d;">
                ${codigo}
            </b>

            <br><br>

            <span style="
                font-size:12px;
                word-break:break-word;
            ">
                ${detalhe}
            </span>
        `;
    }

});

})();
