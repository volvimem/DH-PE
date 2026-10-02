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
// COMPARATIVOS DA TEMPORADA — DH-CLUB
// ==========================================================

function officialResultsAll() {

  return core.tempos.filter(
    t =>
      t &&
      (
        t.runType === '1st' ||
        !t.runType
      ) &&
      Number.isFinite(
        timeMs(t.val)
      )
  );
}


// ==========================================================
// GRID / POSIÇÃO DE UM RESULTADO
// ==========================================================

function resultComparisonInfo(t) {

  if (!t) {
    return null;
  }


  const cat =
    normalizeCat(
      t.cat
    );


  const same =
    officialResultsAll()
      .filter(
        x =>
          String(x.evtId) ===
            String(t.evtId) &&

          normalizeCat(x.cat) ===
            cat
      )
      .sort(
        (a, b) =>
          timeMs(a.val) -
          timeMs(b.val)
      );


  const cpf =
    cleanCPF(
      t.cpf
    );


  const index =
    same.findIndex(
      x =>
        cleanCPF(x.cpf) ===
        cpf
    );


  if (index < 0) {
    return null;
  }


  const position =
    index + 1;


  const fieldSize =
    same.length;


  // 1º = 100%
  // último = 0%
  // se só existir 1 atleta = 100%
  const performancePct =
    fieldSize <= 1

      ? 100

      : (
          (
            fieldSize -
            position
          ) /
          (
            fieldSize -
            1
          )
        ) * 100;


  return {

    position,

    fieldSize,

    performancePct:
      Math.max(
        0,
        Math.min(
          100,
          performancePct
        )
      )

  };
}


// ==========================================================
// RESULTADOS DE UM CPF
// ==========================================================

function athleteOfficialResults(
  cpf,
  category = null
) {

  const clean =
    cleanCPF(
      cpf
    );


  return officialResultsAll()
    .filter(
      t => {

        if (
          cleanCPF(t.cpf) !==
          clean
        ) {
          return false;
        }


        if (
          category &&
          normalizeCat(t.cat) !==
          normalizeCat(category)
        ) {
          return false;
        }


        return true;
      }
    );
}


// ==========================================================
// PERFIL COMPARATIVO DE UM ATLETA
// ==========================================================

function athleteSeasonProfile(
  cpf,
  category = null
) {

  const results =
    athleteOfficialResults(
      cpf,
      category
    );


  const valid =
    results
      .map(
        result => {

          const comparison =
            resultComparisonInfo(
              result
            );


          if (!comparison) {
            return null;
          }


          return {

            result,

            ...comparison

          };
        }
      )
      .filter(Boolean);


  if (!valid.length) {

    return {

      cpf:
        cleanCPF(cpf),

      races:
        0,

      score:
        0,

      firstPct:
        0,

      lastPct:
        0,

      improvement:
        0,

      topHalfCount:
        0,

      topHalfPct:
        0,

      avgField:
        0,

      bestPosition:
        null

    };
  }


  // Ordenação das etapas
  const ordered =
    valid
      .slice()
      .sort(
        (a, b) =>
          Number(
            a.result.evtId || 0
          ) -
          Number(
            b.result.evtId || 0
          )
      );


  const score =
    valid.reduce(
      (
        total,
        item
      ) =>
        total +
        item.performancePct,
      0
    ) /
    valid.length;


  const firstPct =
    ordered[0]
      .performancePct;


  const lastPct =
    ordered[
      ordered.length - 1
    ].performancePct;


  const improvement =
    lastPct -
    firstPct;


  const topHalfCount =
    valid.filter(
      item =>
        item.position <=
        Math.ceil(
          item.fieldSize / 2
        )
    ).length;


  const topHalfPct =
    (
      topHalfCount /
      valid.length
    ) * 100;


  const avgField =
    valid.reduce(
      (
        total,
        item
      ) =>
        total +
        item.fieldSize,
      0
    ) /
    valid.length;


  const bestPosition =
    Math.min(
      ...valid.map(
        item =>
          item.position
      )
    );


  return {

    cpf:
      cleanCPF(cpf),

    races:
      valid.length,

    score,

    firstPct,

    lastPct,

    improvement,

    topHalfCount,

    topHalfPct,

    avgField,

    bestPosition

  };
}


// ==========================================================
// TODOS OS CPFs COM RESULTADO OFICIAL
// ==========================================================

function seasonAthleteCpfs(
  category = null
) {

  return [
    ...new Set(

      officialResultsAll()
        .filter(
          t =>
            !category ||
            normalizeCat(t.cat) ===
              normalizeCat(category)
        )
        .map(
          t =>
            cleanCPF(
              t.cpf
            )
        )
        .filter(Boolean)

    )
  ];
}


// ==========================================================
// CLASSIFICAÇÃO COMPARATIVA
// ==========================================================

function comparativeRanking(
  category = null
) {

  const cpfs =
    seasonAthleteCpfs(
      category
    );


  return cpfs
    .map(
      cpf =>
        athleteSeasonProfile(
          cpf,
          category
        )
    )
    .filter(
      athlete =>
        athlete.races > 0
    )
    .sort(
      (
        a,
        b
      ) => {

        // Maior índice primeiro
        if (
          b.score !==
          a.score
        ) {

          return (
            b.score -
            a.score
          );
        }


        // Desempate:
        // quem participou de mais etapas
        if (
          b.races !==
          a.races
        ) {

          return (
            b.races -
            a.races
          );
        }


        // Segundo desempate:
        // melhor colocação
        return (
          (
            a.bestPosition ||
            9999
          ) -
          (
            b.bestPosition ||
            9999
          )
        );
      }
    );
}


// ==========================================================
// DADOS COMPARATIVOS DO USUÁRIO LOGADO
// ==========================================================

function mySeasonComparison() {

  if (!loggedUser) {
    return null;
  }


  const cpf =
    cleanCPF(
      loggedUser.cpf
    );


  const category =
    normalizeCat(
      loggedUser.cat
    );


  // --------------------------------------------------------
  // GERAL
  // --------------------------------------------------------

  const generalRanking =
    comparativeRanking();


  const generalIndex =
    generalRanking.findIndex(
      athlete =>
        athlete.cpf ===
        cpf
    );


  // --------------------------------------------------------
  // CATEGORIA
  // --------------------------------------------------------

  const categoryRanking =
    comparativeRanking(
      category
    );


  const categoryIndex =
    categoryRanking.findIndex(
      athlete =>
        athlete.cpf ===
        cpf
    );


  const me =
    athleteSeasonProfile(
      cpf,
      category
    );


  // --------------------------------------------------------
  // MÉDIA DA CATEGORIA
  // --------------------------------------------------------

  const categoryProfiles =
    categoryRanking;


  const categoryAverageScore =
    categoryProfiles.length

      ? categoryProfiles.reduce(
          (
            total,
            athlete
          ) =>
            total +
            athlete.score,
          0
        ) /
        categoryProfiles.length

      : 0;


  // --------------------------------------------------------
  // EVOLUÇÃO MÉDIA DA CATEGORIA
  // Apenas atletas com pelo menos 2 resultados
  // --------------------------------------------------------

  const categoryWithEvolution =
    categoryProfiles.filter(
      athlete =>
        athlete.races >= 2
    );


  const categoryAverageImprovement =
    categoryWithEvolution.length

      ? categoryWithEvolution.reduce(
          (
            total,
            athlete
          ) =>
            total +
            athlete.improvement,
          0
        ) /
        categoryWithEvolution.length

      : 0;


  const improvementVsCategory =
    me.improvement -
    categoryAverageImprovement;


  // --------------------------------------------------------
  // PERCENTUAL DE ATLETAS SUPERADOS NA CATEGORIA
  // --------------------------------------------------------

  let categoryBeatPct =
    0;


  if (
    categoryRanking.length > 1 &&
    categoryIndex >= 0
  ) {

    categoryBeatPct =
      (
        (
          categoryRanking.length -
          categoryIndex -
          1
        ) /
        (
          categoryRanking.length -
          1
        )
      ) * 100;
  }


  return {

    category,

    // geral
    generalPosition:
      generalIndex >= 0
        ? generalIndex + 1
        : null,

    generalTotal:
      generalRanking.length,

    // categoria
    categoryPosition:
      categoryIndex >= 0
        ? categoryIndex + 1
        : null,

    categoryTotal:
      categoryRanking.length,

    // índice pessoal
    score:
      me.score,

    bestPosition:
      me.bestPosition,

    races:
      me.races,

    avgField:
      me.avgField,

    topHalfCount:
      me.topHalfCount,

    topHalfPct:
      me.topHalfPct,

    firstPct:
      me.firstPct,

    lastPct:
      me.lastPct,

    improvement:
      me.improvement,

    // média da categoria
    categoryAverageScore,

    categoryAverageImprovement,

    improvementVsCategory,

    categoryBeatPct

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


  // Todas as posições oficiais do atleta
  const positions =
    s.results
      .map(
        t =>
          resultPlacement(t)
      )
      .filter(
        p =>
          Number.isFinite(
            Number(p)
          )
      )
      .map(Number);


  const hasPosition =
    pos =>
      positions.includes(
        pos
      );


  const hasTop =
    limit =>
      positions.some(
        pos =>
          pos <= limit
      );


  const hasTimeBelow =
    milliseconds =>
      s.results.some(
        t =>
          timeMs(t.val) <
          milliseconds
      );


  return [

    // ======================================================
    // INÍCIO
    // ======================================================

    {
      id: 'first',
      icon: 'fa-flag-checkered',
      title: 'PRIMEIRO RESULTADO',
      desc: 'Registrou seu primeiro resultado oficial no DH-PE.',
      ok:
        races >= 1
    },


    // ======================================================
    // FAIXAS DE CLASSIFICAÇÃO
    // ======================================================

    {
      id: 'top20',
      icon: 'fa-ranking-star',
      title: 'TOP 20',
      desc: 'Terminou uma etapa entre os 20 melhores da categoria.',
      ok:
        hasTop(20)
    },

    {
      id: 'top15',
      icon: 'fa-ranking-star',
      title: 'TOP 15',
      desc: 'Terminou uma etapa entre os 15 melhores da categoria.',
      ok:
        hasTop(15)
    },

    {
      id: 'top10',
      icon: 'fa-ranking-star',
      title: 'TOP 10',
      desc: 'Terminou uma etapa entre os 10 melhores da categoria.',
      ok:
        hasTop(10)
    },

    {
      id: 'top6',
      icon: 'fa-ranking-star',
      title: 'TOP 6',
      desc: 'Chegou ao grupo dos 6 melhores da categoria.',
      ok:
        hasTop(6)
    },


    // ======================================================
    // COLOCAÇÕES — 5º ATÉ CAMPEÃO
    // ======================================================

    {
      id: 'fifth',
      icon: 'fa-medal',
      title: '5º LUGAR',
      desc: 'Conquistou o 5º lugar em uma etapa oficial.',
      ok:
        hasPosition(5)
    },

    {
      id: 'fourth',
      icon: 'fa-medal',
      title: '4º LUGAR',
      desc: 'Conquistou o 4º lugar em uma etapa oficial.',
      ok:
        hasPosition(4)
    },

    {
      id: 'third',
      icon: 'fa-medal',
      title: '3º LUGAR',
      desc: 'Subiu ao 3º lugar em uma etapa oficial.',
      ok:
        hasPosition(3)
    },

    {
      id: 'second',
      icon: 'fa-medal',
      title: '2º LUGAR',
      desc: 'Conquistou o 2º lugar em uma etapa oficial.',
      ok:
        hasPosition(2)
    },

    {
      id: 'champion',
      icon: 'fa-trophy',
      title: 'CAMPEÃO — 1º LUGAR',
      desc: 'Venceu uma etapa oficial da sua categoria.',
      ok:
        hasPosition(1)
    },


    // ======================================================
    // MARCAS DE TEMPO
    // ======================================================

    {
      id: 'sub3',
      icon: 'fa-stopwatch',
      title: '-3:00 MIN',
      desc: 'Registrou uma descida oficial abaixo de 3 minutos.',
      ok:
        hasTimeBelow(
          180000
        )
    },

    {
      id: 'sub230',
      icon: 'fa-bolt',
      title: '-2:30 MIN',
      desc: 'Registrou uma descida oficial abaixo de 2 minutos e 30 segundos.',
      ok:
        hasTimeBelow(
          150000
        )
    },

    {
      id: 'sub2',
      icon: 'fa-gauge-high',
      title: '-2:00 MIN',
      desc: 'Registrou uma descida oficial abaixo de 2 minutos.',
      ok:
        hasTimeBelow(
          120000
        )
    },


    // ======================================================
    // CONSISTÊNCIA
    // ======================================================

    {
      id: 'consistent3',
      icon: 'fa-chart-line',
      title: 'CONSISTÊNCIA',
      desc: 'Registrou resultado oficial em pelo menos 3 etapas.',
      ok:
        s.races >= 3
    },


    // ======================================================
    // TEMPORADA
    // ======================================================

    {
      id: 'season',
      icon: 'fa-calendar-check',
      title: 'TEMPORADA COMPLETA',
      desc: 'Participou de todas as etapas encerradas da temporada.',
      ok:
        allClosed > 0 &&
        s.races >= allClosed
    },


    // ======================================================
    // CLUB
    // ======================================================

    {
      id: 'club',
      icon: 'fa-crown',
      title: 'MEMBRO DH-CLUB',
      desc: 'Faz parte da comunidade DH-Club.',
      ok:
        hasClubAccess()
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
'Desafios entre atletas',
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

    const comparison =
    mySeasonComparison();

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
        MINHA TEMPORADA
      </h3>

      <span>
        COMPARATIVO DH-CLUB
      </span>

    </div>


    <div class="premium-card">

      <div
        style="
          font-size:9px;
          letter-spacing:1.5px;
          color:var(--gold2);
          font-weight:900;
          margin-bottom:8px;
        "
      >
        CLASSIFICAÇÃO COMPARATIVA
      </div>


      <div
        style="
          font-size:34px;
          font-weight:1000;
          color:white;
          line-height:1;
        "
      >
        ${comparison?.generalPosition || '—'}º
      </div>


      <div
        style="
          font-size:11px;
          color:var(--muted);
          margin-top:7px;
        "
      >
        de
        <b style="color:white">
          ${comparison?.generalTotal || 0}
        </b>
        atletas com resultado oficial
        na temporada
      </div>


      <div
        style="
          height:1px;
          background:rgba(255,255,255,.08);
          margin:16px 0;
        "
      ></div>


      <div
        style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
        "
      >

        <div
          style="
            background:rgba(255,255,255,.04);
            border-radius:13px;
            padding:12px;
          "
        >

          <small
            style="
              color:var(--muted);
              font-size:8px;
            "
          >
            NA SUA CATEGORIA
          </small>

          <div
            style="
              font-size:21px;
              font-weight:900;
              color:var(--gold2);
              margin-top:4px;
            "
          >
            ${comparison?.categoryPosition || '—'}º
            /
            ${comparison?.categoryTotal || 0}
          </div>

        </div>


        <div
          style="
            background:rgba(255,255,255,.04);
            border-radius:13px;
            padding:12px;
          "
        >

          <small
            style="
              color:var(--muted);
              font-size:8px;
            "
          >
            ATLETAS SUPERADOS
          </small>

          <div
            style="
              font-size:21px;
              font-weight:900;
              color:var(--green);
              margin-top:4px;
            "
          >
            ${Math.round(
              comparison?.categoryBeatPct || 0
            )}%
          </div>

        </div>


        <div
          style="
            background:rgba(255,255,255,.04);
            border-radius:13px;
            padding:12px;
          "
        >

          <small
            style="
              color:var(--muted);
              font-size:8px;
            "
          >
            EVOLUÇÃO
          </small>

          <div
            style="
              font-size:21px;
              font-weight:900;
              color:${
                (
                  comparison?.improvement ||
                  0
                ) >= 0
                  ? 'var(--green)'
                  : '#ff6464'
              };
              margin-top:4px;
            "
          >
            ${
              (
                comparison?.improvement ||
                0
              ) > 0
                ? '+'
                : ''
            }${Math.round(
              comparison?.improvement || 0
            )} pts
          </div>

        </div>


        <div
          style="
            background:rgba(255,255,255,.04);
            border-radius:13px;
            padding:12px;
          "
        >

          <small
            style="
              color:var(--muted);
              font-size:8px;
            "
          >
            METADE SUPERIOR
          </small>

          <div
            style="
              font-size:21px;
              font-weight:900;
              color:white;
              margin-top:4px;
            "
          >
            ${comparison?.topHalfCount || 0}
            /
            ${comparison?.races || 0}
          </div>

        </div>

      </div>


      <div
        style="
          margin-top:14px;
          padding:12px;
          border-radius:13px;
          border:1px solid rgba(255,193,7,.22);
          background:rgba(255,193,7,.06);
        "
      >

        <div
          style="
            font-size:9px;
            color:var(--gold2);
            font-weight:900;
            margin-bottom:5px;
          "
        >
          VOCÊ X SUA CATEGORIA
        </div>


        <div
          style="
            font-size:11px;
            color:#d6deea;
            line-height:1.55;
          "
        >

          Seu índice de desempenho:
          <b>
            ${Math.round(
              comparison?.score || 0
            )}%
          </b>.

          <br>

          Média da
          ${esc(
            comparison?.category ||
            loggedUser.cat ||
            'categoria'
          )}:
          <b>
            ${Math.round(
              comparison?.categoryAverageScore ||
              0
            )}%
          </b>.

          <br>

          Sua evolução ficou

          <b
            style="
              color:${
                (
                  comparison
                    ?.improvementVsCategory ||
                  0
                ) >= 0
                  ? 'var(--green)'
                  : '#ff6464'
              }
            "
          >
            ${
              (
                comparison
                  ?.improvementVsCategory ||
                0
              ) >= 0
                ? '+'
                : ''
            }${Math.round(
              comparison
                ?.improvementVsCategory ||
              0
            )}
            pts
          </b>

          em relação à evolução média
          da sua categoria.

        </div>

      </div>


      <div
        style="
          margin-top:10px;
          font-size:8px;
          color:var(--muted);
          line-height:1.45;
        "
      >
        * Comparativo DH-Club calculado a partir
        dos resultados oficiais da temporada.
        Não substitui o ranking oficial do campeonato.
      </div>

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
  style="
    width:100%;
    min-height:54px;
    font-size:12px;
  "
  onclick="
    Club.openWrapped()
  "
>

  <i class="fa-solid fa-play"></i>

  VER MINHA RETROSPECTIVA ${SYSTEM_YEAR}

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

  Desafie outro atleta,
  combine o confronto
  e acompanhe tudo
  pelo DH-Club.

</p>


      <div class="member-chip">

  <i
    class="
      fa-solid
      fa-bolt
    "
  ></i>

  DESAFIOS ENTRE ATLETAS

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
    } desafiou você para um X1 no DH-Club.`

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
  'Pagamento registrado.'
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
// RETROSPECTIVA WRAPPED — DH-CLUB
// ==========================================================

let wrappedIndex = 0;
let wrappedSlides = [];
  // ==========================================================
// ATUALIZAR FOTO DA CARTEIRINHA
// ==========================================================

function voltarParaAtualizarFoto() {

  const confirmou =
    confirm(
      "A retrospectiva usa a mesma foto da sua carteirinha digital.\n\n" +
      "Você será levado ao DH-PE para atualizar sua foto no PERFIL."
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
  
// ==========================================================
// ÁUDIO CONTÍNUO DO WRAPPED — SEGURO
// ==========================================================

const WRAPPED_SOUND_KEY =
  'dhclub_wrapped_music_v3';


const WRAPPED_AUDIO_URL =
  './sounds/wrapped/wrapped-theme.mp3?v=3';


let wrappedSoundEnabled =
  localStorage.getItem(
    WRAPPED_SOUND_KEY
  ) !== 'off';


let wrappedAudio =
  null;


// ==========================================================
// CRIA O ÁUDIO SOMENTE QUANDO NECESSÁRIO
// ==========================================================

function ensureWrappedAudio() {

  if (wrappedAudio) {

    return wrappedAudio;
  }


  wrappedAudio =
    new Audio(
      WRAPPED_AUDIO_URL
    );


  wrappedAudio.preload =
    'auto';


  wrappedAudio.volume =
    0.40;


  wrappedAudio.loop =
    true;


  wrappedAudio.addEventListener(
    'canplay',
    () => {

      console.log(
        '[DH-CLUB] Música pronta para tocar.'
      );
    }
  );


  wrappedAudio.addEventListener(
    'error',
    () => {

      console.error(
        '[DH-CLUB] ERRO AO CARREGAR MÚSICA:',
        WRAPPED_AUDIO_URL,
        wrappedAudio?.error || null
      );
    }
  );


  return wrappedAudio;
}


// ==========================================================
// ATUALIZA BOTÃO DO SOM
// ==========================================================

function updateWrappedSoundButton() {

  const btn =
    document.getElementById(
      'wrapped-sound'
    );


  if (!btn) {

    return;
  }


  btn.innerHTML = `

    <i
      class="
        fa-solid
        ${
          wrappedSoundEnabled
            ? 'fa-volume-high'
            : 'fa-volume-xmark'
        }
      "
    ></i>

  `;


  btn.title =
    wrappedSoundEnabled
      ? 'Desativar música'
      : 'Ativar música';
}


// ==========================================================
// TOCA / CONTINUA A MÚSICA
// ==========================================================

function playWrappedSound() {

  if (
    !wrappedSoundEnabled
  ) {

    return;
  }


  const audio =
    ensureWrappedAudio();


  if (
    !audio.paused
  ) {

    return;
  }


  audio
    .play()
    .then(
      () => {

        console.log(
          '[DH-CLUB] Música tocando.'
        );
      }
    )
    .catch(
      err => {

        console.warn(
          '[DH-CLUB] Reprodução aguardando interação:',
          err
        );
      }
    );
}


// ==========================================================
// LIGA / DESLIGA A MÚSICA
// ==========================================================

function toggleWrappedSound() {

  wrappedSoundEnabled =
    !wrappedSoundEnabled;


  localStorage.setItem(
    WRAPPED_SOUND_KEY,

    wrappedSoundEnabled
      ? 'on'
      : 'off'
  );


  updateWrappedSoundButton();


  if (
    wrappedSoundEnabled
  ) {

    playWrappedSound();


    toast(
      'MÚSICA ATIVADA'
    );

  } else {

    if (wrappedAudio) {

      wrappedAudio.pause();
    }


    toast(
      'MÚSICA DESATIVADA'
    );
  }
}


// ==========================================================
// ESTILOS DO WRAPPED
// ==========================================================

function ensureWrappedStyles() {

  if (
    document.getElementById(
      'dhclub-wrapped-style'
    )
  ) {
    return;
  }


  const style =
    document.createElement(
      'style'
    );


  style.id =
    'dhclub-wrapped-style';


  style.textContent = `

    .wrapped-overlay {
      position:fixed;
      inset:0;
      z-index:99999;
      background:#020914;
      color:white;
      display:flex;
      flex-direction:column;
      font-family:Arial, sans-serif;
      overflow:hidden;
    }

    .wrapped-bg {
      position:absolute;
      inset:0;
      background:
        radial-gradient(circle at 20% 20%, rgba(34,116,255,.28), transparent 38%),
        radial-gradient(circle at 85% 25%, rgba(255,190,20,.18), transparent 32%),
        radial-gradient(circle at 50% 100%, rgba(0,196,120,.14), transparent 40%),
        linear-gradient(160deg,#061426,#020914 65%);
      pointer-events:none;
    }

    .wrapped-lines {
      position:absolute;
      inset:0;
      opacity:.12;
      background-image:
        linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px);
      background-size:42px 42px;
      pointer-events:none;
    }

    .wrapped-progress {
      position:relative;
      z-index:3;
      display:flex;
      gap:5px;
      padding:14px 14px 8px;
    }

    .wrapped-progress span {
      flex:1;
      height:3px;
      border-radius:10px;
      background:rgba(255,255,255,.18);
      overflow:hidden;
    }

    .wrapped-progress span.active {
      background:#ffc72c;
    }

    .wrapped-top {
      position:relative;
      z-index:3;
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:8px 16px;
    }

    .wrapped-brand {
      font-weight:1000;
      letter-spacing:1px;
      font-size:14px;
    }

    .wrapped-brand strong {
      color:#ffc72c;
    }

    .wrapped-top-actions {
      display:flex;
      align-items:center;
      gap:8px;
    }

    .wrapped-sound {
      width:38px;
      height:38px;
      border-radius:50%;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(255,255,255,.07);
      color:white;
      font-size:14px;
      display:flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
    }

    .wrapped-sound:active {
      transform:scale(.94);
    }

    .wrapped-close {
      width:38px;
      height:38px;
      border-radius:50%;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(255,255,255,.07);
      color:white;
      font-size:17px;
    }

    .wrapped-stage {
      position:relative;
      z-index:2;
      flex:1;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:18px 22px 90px;
      overflow:auto;
    }

    .wrapped-slide {
      width:100%;
      max-width:470px;
      animation:wrappedIn .38s ease;
    }

    @keyframes wrappedIn {
      from {
        opacity:0;
        transform:translateY(18px) scale(.98);
      }
      to {
        opacity:1;
        transform:none;
      }
    }

    .wrapped-eyebrow {
      color:#ffc72c;
      font-size:11px;
      font-weight:900;
      letter-spacing:2px;
      margin-bottom:12px;
    }

    .wrapped-title {
      font-size:40px;
      line-height:.98;
      font-weight:1000;
      margin:0 0 14px;
      letter-spacing:-1.5px;
    }

    .wrapped-subtitle {
      color:#9eabc0;
      font-size:14px;
      line-height:1.55;
    }

    .wrapped-photo {
      width:132px;
      height:132px;
      border-radius:32px;
      object-fit:cover;
      border:3px solid #ffc72c;
      box-shadow:0 20px 50px rgba(0,0,0,.45);
      margin-bottom:22px;
    }

    .wrapped-hero-number {
      font-size:82px;
      line-height:.92;
      font-weight:1000;
      color:#ffc72c;
      letter-spacing:-4px;
    }

    .wrapped-big-label {
      font-size:18px;
      font-weight:900;
      margin-top:7px;
    }

    .wrapped-grid {
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:10px;
      margin-top:22px;
    }

    .wrapped-card {
      background:rgba(255,255,255,.065);
      border:1px solid rgba(255,255,255,.10);
      border-radius:20px;
      padding:17px;
      backdrop-filter:blur(10px);
    }

    .wrapped-card small {
      display:block;
      color:#8796ac;
      font-size:9px;
      font-weight:900;
      letter-spacing:1px;
      margin-bottom:7px;
    }

    .wrapped-card b {
      display:block;
      font-size:27px;
      color:white;
    }

    .wrapped-card.gold b {
      color:#ffc72c;
    }

    .wrapped-card.green b {
      color:#35d48a;
    }

    .wrapped-card.red b {
      color:#ff6262;
    }

    .wrapped-rank-box {
      margin-top:18px;
      padding:20px;
      border-radius:24px;
      background:linear-gradient(135deg,rgba(255,199,44,.16),rgba(255,199,44,.04));
      border:1px solid rgba(255,199,44,.28);
    }

    .wrapped-meter {
      margin-top:16px;
    }

    .wrapped-meter-head {
      display:flex;
      justify-content:space-between;
      font-size:11px;
      font-weight:900;
      margin-bottom:7px;
    }

    .wrapped-meter-track {
      height:12px;
      background:rgba(255,255,255,.10);
      border-radius:20px;
      overflow:hidden;
    }

    .wrapped-meter-fill {
      height:100%;
      border-radius:20px;
      background:linear-gradient(90deg,#19b7ff,#33da86);
    }

    .wrapped-medals {
      display:grid;
      grid-template-columns:repeat(5,1fr);
      gap:7px;
      margin-top:20px;
    }

    .wrapped-medal {
      border-radius:16px;
      background:rgba(255,255,255,.06);
      border:1px solid rgba(255,255,255,.10);
      padding:12px 4px;
      text-align:center;
    }

    .wrapped-medal strong {
      display:block;
      font-size:23px;
      color:#ffc72c;
    }

    .wrapped-medal small {
      font-size:8px;
      color:#9aa8bc;
    }

    .wrapped-achievements {
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      margin-top:18px;
    }

    .wrapped-achievement {
      padding:9px 12px;
      border-radius:50px;
      background:rgba(255,199,44,.10);
      border:1px solid rgba(255,199,44,.24);
      color:#ffd75e;
      font-size:10px;
      font-weight:900;
    }

    .wrapped-speed {
      display:flex;
      flex-direction:column;
      gap:11px;
      margin-top:24px;
    }

    .wrapped-speed-item {
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:16px;
      border-radius:18px;
      background:rgba(255,255,255,.055);
      border:1px solid rgba(255,255,255,.09);
    }

    .wrapped-speed-item.unlocked {
      border-color:rgba(255,199,44,.42);
      background:rgba(255,199,44,.09);
    }

    .wrapped-speed-item strong {
      font-size:21px;
    }

    .wrapped-speed-item span {
      font-size:10px;
      font-weight:900;
      color:#7d8da4;
    }

    .wrapped-speed-item.unlocked span {
      color:#ffc72c;
    }

    .wrapped-actions {
      position:absolute;
      z-index:4;
      bottom:18px;
      left:14px;
      right:14px;
      display:flex;
      gap:10px;
    }

    .wrapped-btn {
      flex:1;
      min-height:48px;
      border:none;
      border-radius:16px;
      font-weight:1000;
      font-size:12px;
      cursor:pointer;
    }

    .wrapped-btn.secondary {
      background:rgba(255,255,255,.08);
      color:white;
      border:1px solid rgba(255,255,255,.12);
    }

    .wrapped-btn.primary {
      background:#ffc72c;
      color:#06101e;
    }

    .wrapped-share {
      width:100%;
      min-height:54px;
      margin-top:22px;
      border:0;
      border-radius:17px;
      background:#ffc72c;
      color:#06101e;
      font-weight:1000;
      font-size:13px;
    }

    @media (max-height:700px) {
      .wrapped-title {
        font-size:32px;
      }

      .wrapped-hero-number {
        font-size:65px;
      }

      .wrapped-stage {
        align-items:flex-start;
      }
    }

  `;


  document.head.appendChild(
    style
  );
}


// ==========================================================
// DADOS DO WRAPPED
// ==========================================================

function wrappedData() {

  const stats =
    careerStats();


  const comparison =
    typeof mySeasonComparison ===
      'function'

      ? mySeasonComparison()

      : null;


  const positions =
    stats.results
      .map(
        result =>
          resultPlacement(
            result
          )
      )
      .filter(
        p =>
          Number.isFinite(
            Number(p)
          )
      )
      .map(Number);


  const countPosition =
    position =>
      positions.filter(
        p =>
          p === position
      ).length;


  const unlocked =
    achievements()
      .filter(
        item =>
          item.ok
      );


  const best =
    stats.best;


  return {

    stats,

    comparison,

    name:
      String(
        loggedUser.nome ||
        'ATLETA'
      ),

    category:
      normalizeCat(
        loggedUser.cat ||
        'GERAL'
      ),

    photo:
      loggedUser.selfie ||
      'logo.png',

    first:
      countPosition(1),

    second:
      countPosition(2),

    third:
      countPosition(3),

    fourth:
      countPosition(4),

    fifth:
      countPosition(5),

    unlocked,

    sub3:
      Number.isFinite(best) &&
      best < 180000,

    sub230:
      Number.isFinite(best) &&
      best < 150000,

    sub2:
      Number.isFinite(best) &&
      best < 120000

  };
}


// ==========================================================
// MONTA AS TELAS
// ==========================================================

function buildWrappedSlides() {

  const d =
    wrappedData();


  const s =
    d.stats;


  const c =
    d.comparison;


  const beatPct =
    Math.round(
      c?.categoryBeatPct ||
      0
    );


  const score =
    Math.round(
      c?.score ||
      0
    );


  const avgScore =
    Math.round(
      c?.categoryAverageScore ||
      0
    );


  const improvement =
    Math.round(
      c?.improvement ||
      0
    );


  const improvementVsCategory =
    Math.round(
      c?.improvementVsCategory ||
      0
    );


  const closedEvents =
    core.events.filter(
      e =>
        e.status ===
        'CLOSED'
    ).length;


  const attendancePct =
    closedEvents > 0

      ? Math.min(
          100,
          Math.round(
            (
              s.races /
              closedEvents
            ) * 100
          )
        )

      : null;


  const unlockedNames =
    d.unlocked
      .slice(
        0,
        8
      )
      .map(
        item => `

          <span class="wrapped-achievement">

            <i
              class="
                fa-solid
                fa-check
              "
            ></i>

            ${esc(item.title)}

          </span>

        `
      )
      .join('');


  return [

    // ======================================================
    // STORY 1 — ABERTURA
    // ======================================================

    `

      <div class="wrapped-slide">

        <div class="wrapped-eyebrow">
          DH-CLUB • TEMPORADA ${SYSTEM_YEAR}
        </div>


        <img
          class="wrapped-photo"
          src="${esc(d.photo)}"
          alt="Foto do atleta"
        >


        <h1 class="wrapped-title">

          ESSA FOI<br>
          A SUA TEMPORADA.

        </h1>


        <div class="wrapped-subtitle">

          <b
            style="
              color:white;
              font-size:18px;
            "
          >
            ${esc(d.name)}
          </b>

          <br>

          ${esc(d.category)}

          <br><br>

          Preparado para descobrir
          os números que marcaram
          sua temporada no DH-PE?

        </div>

      </div>

    `,


    // ======================================================
    // STORY 2 — PRESENÇA
    // ======================================================

    `

      <div class="wrapped-slide">

        <div class="wrapped-eyebrow">
          SUA PRESENÇA
        </div>


        <h1 class="wrapped-title">

          VOCÊ ESTEVE<br>
          NA PISTA.

        </h1>


        <div class="wrapped-rank-box">

          <div class="wrapped-hero-number">
            ${s.races}
          </div>

          <div class="wrapped-big-label">

            ${
              s.races === 1
                ? 'ETAPA DISPUTADA'
                : 'ETAPAS DISPUTADAS'
            }

          </div>

        </div>


        ${
          attendancePct !== null

            ? `

              <div
                class="wrapped-meter"
                style="margin-top:28px"
              >

                <div class="wrapped-meter-head">

                  <span>
                    PRESENÇA NA TEMPORADA
                  </span>

                  <span>
                    ${attendancePct}%
                  </span>

                </div>


                <div class="wrapped-meter-track">

                  <div
                    class="wrapped-meter-fill"
                    style="
                      width:${attendancePct}%;
                    "
                  ></div>

                </div>

              </div>

            `

            : `

              <div
                class="wrapped-subtitle"
                style="margin-top:22px"
              >

                A temporada ainda está
                em andamento.

              </div>

            `
        }


        <div
          class="wrapped-subtitle"
          style="
            margin-top:24px;
          "
        >

          Cada largada fez parte
          da sua história em ${SYSTEM_YEAR}.

        </div>

      </div>

    `,


    // ======================================================
    // STORY 3 — VELOCIDADE
    // ======================================================

    `

      <div class="wrapped-slide">

        <div class="wrapped-eyebrow">
          VELOCIDADE
        </div>


        <h1 class="wrapped-title">

          CONTRA<br>
          O CRONÔMETRO.

        </h1>


        <div class="wrapped-rank-box">

          <div class="wrapped-subtitle">
            SEU MELHOR TEMPO OFICIAL
          </div>


          <div
            class="wrapped-hero-number"
            style="
              font-size:48px;
              margin-top:10px;
            "
          >

            ${bestTimeLabel(s.best)}

          </div>

        </div>


        <div class="wrapped-speed">

          <div
            class="
              wrapped-speed-item
              ${d.sub3 ? 'unlocked' : ''}
            "
          >

            <strong>
              -3:00
            </strong>

            <span>

              ${
                d.sub3
                  ? 'DESBLOQUEADA'
                  : 'A CONQUISTAR'
              }

            </span>

          </div>


          <div
            class="
              wrapped-speed-item
              ${d.sub230 ? 'unlocked' : ''}
            "
          >

            <strong>
              -2:30
            </strong>

            <span>

              ${
                d.sub230
                  ? 'DESBLOQUEADA'
                  : 'A CONQUISTAR'
              }

            </span>

          </div>


          <div
            class="
              wrapped-speed-item
              ${d.sub2 ? 'unlocked' : ''}
            "
          >

            <strong>
              -2:00
            </strong>

            <span>

              ${
                d.sub2
                  ? 'DESBLOQUEADA'
                  : 'A CONQUISTAR'
              }

            </span>

          </div>

        </div>

      </div>

    `,


    // ======================================================
    // STORY 4 — MELHOR POSIÇÃO
    // ======================================================

    `

      <div class="wrapped-slide">

        <div class="wrapped-eyebrow">
          SEU MELHOR RESULTADO
        </div>


        <h1 class="wrapped-title">

          ATÉ ONDE<br>
          VOCÊ CHEGOU?

        </h1>


        <div class="wrapped-rank-box">

          <div class="wrapped-hero-number">

            ${
              c?.bestPosition
                ? `${c.bestPosition}º`
                : '—'
            }

          </div>


          <div class="wrapped-big-label">
            MELHOR POSIÇÃO EM ETAPA
          </div>

        </div>


        <div class="wrapped-grid">

          <div class="wrapped-card gold">

            <small>
              TOP 5
            </small>

            <b>
              ${s.podiums}
            </b>

          </div>


          <div class="wrapped-card">

            <small>
              VITÓRIAS
            </small>

            <b>
              ${s.wins}
            </b>

          </div>

        </div>

      </div>

    `,


    // ======================================================
    // STORY 5 — TEMPORADA GERAL
    // ======================================================

    `

      <div class="wrapped-slide">

        <div class="wrapped-eyebrow">
          TEMPORADA ${SYSTEM_YEAR}
        </div>


        <h1 class="wrapped-title">

          ENTRE TODOS<br>
          OS ATLETAS.

        </h1>


        <div class="wrapped-rank-box">

          <div class="wrapped-hero-number">

            ${
              c?.generalPosition
                ? `${c.generalPosition}º`
                : '—'
            }

          </div>


          <div class="wrapped-big-label">

            DE
            ${c?.generalTotal || 0}
            ATLETAS

          </div>


          <div
            class="wrapped-subtitle"
            style="margin-top:8px"
          >

            classificação comparativa
            DH-Club

          </div>

        </div>


        <div
          class="wrapped-subtitle"
          style="margin-top:24px"
        >

          Um retrato comparativo dos
          resultados oficiais registrados
          durante a temporada.

        </div>

      </div>

    `,


    // ======================================================
    // STORY 6 — CATEGORIA
    // ======================================================

    `

      <div class="wrapped-slide">

        <div class="wrapped-eyebrow">
          SUA CATEGORIA
        </div>


        <h1 class="wrapped-title">

          AGORA ENTRE<br>
          OS SEUS RIVAIS.

        </h1>


        <div class="wrapped-rank-box">

          <div class="wrapped-subtitle">

            ${esc(d.category)}

          </div>


          <div class="wrapped-hero-number">

            ${
              c?.categoryPosition
                ? `${c.categoryPosition}º`
                : '—'
            }

          </div>


          <div class="wrapped-big-label">

            DE
            ${c?.categoryTotal || 0}
            ATLETAS

          </div>

        </div>


        <div
          class="wrapped-card green"
          style="margin-top:16px"
        >

          <small>
            ATLETAS SUPERADOS
          </small>

          <b>
            ${beatPct}%
          </b>

        </div>


        <div
          class="wrapped-subtitle"
          style="margin-top:18px"
        >

          Você terminou comparativamente
          à frente de ${beatPct}%
          dos atletas da sua categoria.

        </div>

      </div>

    `,


    // ======================================================
    // STORY 7 — EVOLUÇÃO
    // ======================================================

    `

      <div class="wrapped-slide">

        <div class="wrapped-eyebrow">
          SUA EVOLUÇÃO
        </div>


        <h1 class="wrapped-title">

          NÃO É SÓ<br>
          SOBRE GANHAR.

        </h1>


        <div class="wrapped-grid">

          <div
            class="
              wrapped-card
              ${
                improvement >= 0
                  ? 'green'
                  : 'red'
              }
            "
          >

            <small>
              SUA EVOLUÇÃO
            </small>

            <b>

              ${
                improvement > 0
                  ? '+'
                  : ''
              }

              ${improvement}
              pts

            </b>

          </div>


          <div
            class="
              wrapped-card
              ${
                improvementVsCategory >= 0
                  ? 'green'
                  : 'red'
              }
            "
          >

            <small>
              VS. CATEGORIA
            </small>

            <b>

              ${
                improvementVsCategory > 0
                  ? '+'
                  : ''
              }

              ${improvementVsCategory}
              pts

            </b>

          </div>

        </div>


        <div
          class="wrapped-meter"
          style="margin-top:28px"
        >

          <div class="wrapped-meter-head">

            <span>
              SEU ÍNDICE
            </span>

            <span>
              ${score}%
            </span>

          </div>


          <div class="wrapped-meter-track">

            <div
              class="wrapped-meter-fill"
              style="
                width:${
                  Math.max(
                    0,
                    Math.min(
                      100,
                      score
                    )
                  )
                }%;
              "
            ></div>

          </div>

        </div>


        <div class="wrapped-meter">

          <div class="wrapped-meter-head">

            <span>
              MÉDIA DA CATEGORIA
            </span>

            <span>
              ${avgScore}%
            </span>

          </div>


          <div class="wrapped-meter-track">

            <div
              class="wrapped-meter-fill"
              style="
                width:${
                  Math.max(
                    0,
                    Math.min(
                      100,
                      avgScore
                    )
                  )
                }%;
                background:#68788e;
              "
            ></div>

          </div>

        </div>

      </div>

    `,


    // ======================================================
    // STORY 8 — PÓDIOS
    // ======================================================

    `

      <div class="wrapped-slide">

        <div class="wrapped-eyebrow">
          PÓDIOS
        </div>


        <h1 class="wrapped-title">

          CADA POSIÇÃO<br>
          CONTA.

        </h1>


        <div class="wrapped-medals">

          <div class="wrapped-medal">

            <strong>
              ${d.first}
            </strong>

            <small>
              1º
            </small>

          </div>


          <div class="wrapped-medal">

            <strong>
              ${d.second}
            </strong>

            <small>
              2º
            </small>

          </div>


          <div class="wrapped-medal">

            <strong>
              ${d.third}
            </strong>

            <small>
              3º
            </small>

          </div>


          <div class="wrapped-medal">

            <strong>
              ${d.fourth}
            </strong>

            <small>
              4º
            </small>

          </div>


          <div class="wrapped-medal">

            <strong>
              ${d.fifth}
            </strong>

            <small>
              5º
            </small>

          </div>

        </div>


        <div class="wrapped-rank-box">

          <div class="wrapped-subtitle">
            RESULTADOS NO TOP 5
          </div>


          <div class="wrapped-hero-number">

            ${s.podiums}

          </div>

        </div>

      </div>

    `,


    // ======================================================
    // STORY 9 — CONQUISTAS
    // ======================================================

    `

      <div class="wrapped-slide">

        <div class="wrapped-eyebrow">
          CONQUISTAS
        </div>


        <h1 class="wrapped-title">

          O QUE VOCÊ<br>
          DESBLOQUEOU.

        </h1>


        <div class="wrapped-rank-box">

          <div class="wrapped-hero-number">

            ${d.unlocked.length}

          </div>


          <div class="wrapped-big-label">

            ${
              d.unlocked.length === 1
                ? 'CONQUISTA'
                : 'CONQUISTAS'
            }

          </div>

        </div>


        <div class="wrapped-achievements">

          ${
            unlockedNames ||

            `

              <span class="wrapped-subtitle">

                Sua jornada está apenas
                começando.

              </span>

            `
          }

        </div>


        <div
          class="wrapped-subtitle"
          style="margin-top:24px"
        >

          Continue competindo para
          desbloquear novas marcas
          durante o ano.

        </div>

      </div>

    `,


    // ======================================================
    // STORY 10 — FINAL
    // ======================================================

    `

      <div class="wrapped-slide">

        <div class="wrapped-eyebrow">
          DH-PE • ${SYSTEM_YEAR}
        </div>


        <img
          class="wrapped-photo"
          src="${esc(d.photo)}"
          alt="Foto do atleta"
        >


        <h1 class="wrapped-title">

          ESSA TEMPORADA<br>
          É SUA.

        </h1>


        <div class="wrapped-rank-box">

          <div
            style="
              font-size:18px;
              font-weight:1000;
              color:white;
            "
          >

            ${esc(d.name)}

          </div>


          <div
            class="wrapped-subtitle"
            style="margin-top:5px"
          >

            ${esc(d.category)}

          </div>


          <div
            style="
              margin-top:18px;
              font-size:18px;
              font-weight:900;
              line-height:1.7;
            "
          >

            ${s.races}
            ${
              s.races === 1
                ? 'ETAPA'
                : 'ETAPAS'
            }

            •

            ${s.podiums}
            TOP 5

            <br>

            ${bestTimeLabel(s.best)}
            MELHOR TEMPO

          </div>


          ${
            c?.categoryPosition

              ? `

                <div
                  style="
                    margin-top:12px;
                    color:#ffc72c;
                    font-size:13px;
                    font-weight:900;
                  "
                >

                  ${c.categoryPosition}º
                  DE
                  ${c.categoryTotal}
                  NA
                  ${esc(d.category)}

                </div>

              `

              : ''
          }

        </div>


        <div
          class="wrapped-subtitle"
          style="
            margin-top:18px;
            text-align:center;
          "
        >

          Mais que uma pista,
          uma comunidade.

        </div>


        <button
          class="wrapped-share"
          onclick="
            Club.shareWrapped()
          "
        >

          <i
            class="
              fa-solid
              fa-share-nodes
            "
          ></i>

          COMPARTILHAR MINHA TEMPORADA

        </button>

      </div>

    `

  ];
}


// ==========================================================
// ABRIR WRAPPED
// ==========================================================

function openWrapped() {

  ensureWrappedStyles();


  wrappedSlides =
    buildWrappedSlides();


  wrappedIndex =
    0;


  const antigo =
    document.getElementById(
      'dhclub-wrapped'
    );


  if (antigo) {

    antigo.remove();
  }


  const overlay =
    document.createElement(
      'div'
    );


  overlay.id =
    'dhclub-wrapped';


  overlay.className =
    'wrapped-overlay';


  overlay.innerHTML = `

    <div class="wrapped-bg"></div>

    <div class="wrapped-lines"></div>


    <div
      id="wrapped-progress"
      class="wrapped-progress"
    ></div>


    <div class="wrapped-top">

      <div class="wrapped-brand">

        DH-CLUB<strong>+</strong>

      </div>


      <div class="wrapped-top-actions">

        <button
          id="wrapped-sound"
          class="wrapped-sound"
          onclick="Club.toggleWrappedSound()"
          title="Som da retrospectiva"
        >

          <i
            class="
              fa-solid
              fa-volume-high
            "
          ></i>

        </button>


        <button
          class="wrapped-close"
          onclick="Club.closeWrapped()"
        >

          ×

        </button>

      </div>

    </div>


    <div
      id="wrapped-stage"
      class="wrapped-stage"
    ></div>


    <div class="wrapped-actions">

      <button
        id="wrapped-prev"
        class="wrapped-btn secondary"
        onclick="Club.wrappedPrev()"
      >

        ← VOLTAR

      </button>


      <button
        id="wrapped-next"
        class="wrapped-btn primary"
        onclick="Club.wrappedNext()"
      >

        PRÓXIMO →

      </button>

    </div>

  `;


  document.body.appendChild(
    overlay
  );


  document.body.style.overflow =
    'hidden';


  updateWrappedSoundButton();


  if (
    wrappedSoundEnabled
  ) {

    const audio =
      ensureWrappedAudio();


    try {

      audio.currentTime =
        0;

    } catch {}
  }


  renderWrappedSlide();
}


// ==========================================================
// MOSTRAR STORY ATUAL
// ==========================================================

function renderWrappedSlide() {

  const stage =
    document.getElementById(
      'wrapped-stage'
    );


  const progress =
    document.getElementById(
      'wrapped-progress'
    );


  const prev =
    document.getElementById(
      'wrapped-prev'
    );


  const next =
    document.getElementById(
      'wrapped-next'
    );


  if (
    !stage ||
    !progress
  ) {

    return;
  }


  stage.innerHTML =
    wrappedSlides[
      wrappedIndex
    ] || '';


  progress.innerHTML =
    wrappedSlides
      .map(
        (_, i) =>

          `<span class="${
            i <= wrappedIndex
              ? 'active'
              : ''
          }"></span>`

      )
      .join('');


  if (prev) {

    prev.style.visibility =
      wrappedIndex === 0
        ? 'hidden'
        : 'visible';
  }


  if (next) {

    if (
      wrappedIndex ===
      wrappedSlides.length - 1
    ) {

      next.textContent =
        'VER NOVAMENTE';

    } else {

      next.textContent =
        'PRÓXIMO →';
    }
  }


  updateWrappedSoundButton();


  if (
    wrappedSoundEnabled
  ) {

    playWrappedSound();
  }
}


// ==========================================================
// PRÓXIMO STORY
// ==========================================================

function wrappedNext() {

  if (
    wrappedIndex <
    wrappedSlides.length - 1
  ) {

    wrappedIndex++;

  } else {

    wrappedIndex =
      0;
  }


  renderWrappedSlide();
}


// ==========================================================
// STORY ANTERIOR
// ==========================================================

function wrappedPrev() {

  if (
    wrappedIndex > 0
  ) {

    wrappedIndex--;
  }


  renderWrappedSlide();
}


// ==========================================================
// FECHAR
// ==========================================================

function closeWrapped() {

  if (wrappedAudio) {

    wrappedAudio.pause();


    try {

      wrappedAudio.currentTime =
        0;

    } catch {}
  }


  const overlay =
    document.getElementById(
      'dhclub-wrapped'
    );


  if (overlay) {

    overlay.remove();
  }


  document.body.style.overflow =
    '';
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
// INICIALIZAÇÃO — ROBUSTA / COM DIAGNÓSTICO
// ==========================================================

function setClubLoading(text) {

  const el =
    document.querySelector(
      '.club-loading'
    );


  if (el) {

    el.textContent =
      text;
  }
}


function showClubGate(
  title,
  message
) {

  const splash =
    document.getElementById(
      'club-splash'
    );


  const gate =
    document.getElementById(
      'club-gate'
    );


  const gateTitle =
    document.getElementById(
      'gate-title'
    );


  const gateMessage =
    document.getElementById(
      'gate-message'
    );


  if (splash) {

    splash.classList.add(
      'hidden'
    );
  }


  if (gate) {

    gate.classList.remove(
      'hidden'
    );
  }


  if (gateTitle) {

    gateTitle.textContent =
      title;
  }


  if (gateMessage) {

    gateMessage.innerHTML =
      message;
  }
}


// ==========================================================
// LIMITE DE TEMPO PARA PROMISES
// ==========================================================

function withTimeout(
  promise,
  milliseconds,
  code
) {

  return Promise.race([

    promise,

    new Promise(
      (
        _,
        reject
      ) => {

        setTimeout(
          () => {

            const error =
              new Error(
                `${code}: operação excedeu ${milliseconds / 1000}s`
              );


            error.code =
              code;


            reject(
              error
            );

          },
          milliseconds
        );
      }
    )

  ]);
}


// ==========================================================
// INIT
// ==========================================================

async function init() {

  setClubLoading(
    'VERIFICANDO SESSÃO…'
  );


  loggedUser =
    sessionUser();


  // ========================================================
  // 1. CONFIRMA SESSÃO DO DH-PE
  // ========================================================

  if (!loggedUser) {

    showClubGate(
      'Entre pelo DH-PE',
      'Sua sessão não foi encontrada.<br><br>Volte ao DH-PE e faça login novamente com seu CPF e senha.'
    );


    return;
  }


  // ========================================================
  // 2. AGUARDA FIREBASE AUTH
  // ========================================================

  setClubLoading(
    'VALIDANDO ACESSO…'
  );


  await new Promise(
    resolve => {

      let finished =
        false;


      let unsubscribe =
        () => {};


      const finish =
        () => {

          if (finished) {

            return;
          }


          finished =
            true;


          clearTimeout(
            timer
          );


          try {

            unsubscribe();

          } catch {}


          resolve();
        };


      const timer =
        setTimeout(
          finish,
          3000
        );


      unsubscribe =
        auth.onAuthStateChanged(
          () => {

            finish();
          }
        );
    }
  );


  // ========================================================
  // 3. TENTA RESTAURAR LOGIN
  // ========================================================

  if (!auth.currentUser) {

    const cpfAuth =
      cleanCPF(
        loggedUser.cpf
      );


    const senhaLocal =
      String(
        loggedUser.pass ||
        ''
      );


    if (
      cpfAuth &&
      senhaLocal
    ) {

      const emailFake =
        `${cpfAuth}@dhpe.com.br`;


      const authPass =
        senhaLocal.length < 6

          ? senhaLocal.padEnd(
              6,
              '0'
            )

          : senhaLocal;


      setClubLoading(
        'RENOVANDO LOGIN…'
      );


      try {

        await withTimeout(

          auth
            .signInWithEmailAndPassword(
              emailFake,
              authPass
            ),

          8000,

          'AUTH_TIMEOUT'

        );


        console.log(
          '[DH-CLUB] Firebase Auth restaurado.'
        );


      } catch (
        authError
      ) {

        console.warn(
          '[DH-CLUB] Falha no login Firebase:',
          authError
        );
      }
    }
  }


  // ========================================================
  // 4. SE CONTINUA SEM AUTH
  // ========================================================

  if (!auth.currentUser) {

    localStorage.removeItem(
      SESS_KEY
    );


    sessionStorage.removeItem(
      SESS_KEY
    );


    showClubGate(
      'Sessão de segurança expirada',

      `
        Sua sessão precisa ser renovada.

        <br><br>

        Toque em
        <b>VOLTAR AO DH-PE</b>
        e faça login novamente
        com seu CPF e senha.

        <br><br>

        Depois entre novamente
        no DH-Club.
      `
    );


    return;
  }


  console.log(
    '[DH-CLUB] Firebase autenticado:',
    auth.currentUser.uid
  );


  const avatar =
    document.getElementById(
      'club-avatar-initials'
    );


  if (avatar) {

    avatar.textContent =
      initials(
        loggedUser.nome
      );
  }


  // ========================================================
  // 5. CARREGA DADOS
  // ========================================================

  setClubLoading(
    'CARREGANDO DADOS…'
  );


  const [
    coreSnap,
    clubSnap
  ] =
    await withTimeout(

      Promise.all([

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

      ]),

      10000,

      'DATABASE_TIMEOUT'

    );


  const c =
    coreSnap.val() ||
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


  club =
    normalizeClub(
      clubSnap.val() ||
      {}
    );


  const fresh =
    core.users.find(
      u =>
        cleanCPF(
          u.cpf
        ) ===
        cleanCPF(
          loggedUser.cpf
        )
    );


  if (fresh) {

    loggedUser =
      fresh;
  }


  // ========================================================
  // 6. CONFERE ACESSO DH-CLUB
  // ========================================================

  if (
    !hasClubAccess()
  ) {

    showClubGate(
      'DH-Club em Beta',

      'O DH-Club está sendo testado antes do lançamento de 2027.<br><br>Seu acesso ainda não foi liberado pela organização.'
    );


    return;
  }


  // ========================================================
  // 7. ABRE O DH-CLUB
  // ========================================================

  setClubLoading(
    'ABRINDO DH-CLUB…'
  );


  const splash =
    document.getElementById(
      'club-splash'
    );


  const app =
    document.getElementById(
      'club-app'
    );


  if (splash) {

    splash.classList.add(
      'hidden'
    );
  }


  if (app) {

    app.classList.remove(
      'hidden'
    );
  }


  bind();


  renderHome();


  // ========================================================
  // 8. BANCO PRINCIPAL EM TEMPO REAL
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
              cleanCPF(
                u.cpf
              ) ===
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
      },

      error => {

        console.error(
          '[DH-CLUB] Erro banco principal:',
          error
        );
      }
    );


  // ========================================================
  // 9. DH-CLUB EM TEMPO REAL
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
      },

      error => {

        console.error(
          '[DH-CLUB] Erro banco Club:',
          error
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

 openWrapped,

closeWrapped,

wrappedNext,

wrappedPrev,

toggleWrappedSound,

shareWrapped

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
