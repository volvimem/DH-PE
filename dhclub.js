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
  training_presence: {},
  memory_game: {},
  draws: {},
draw_cycles: {}
};

let currentView = 'home';

  let achievementFilter =
  'TODAS';


  // JOGOS — JOGO DA MEMÓRIA
// 5 NÍVEIS PROGRESSIVOS
// ==========================================================

const MEMORY_LEVELS = {

  1: {
    pairs: 4,
    cards: 9,
    colsMobile: 3,
    colsTablet: 3,
    colsDesktop: 3
  },

  2: {
    pairs: 6,
    cards: 12,
    colsMobile: 3,
    colsTablet: 4,
    colsDesktop: 4
  },

  3: {
    pairs: 10,
    cards: 20,
    colsMobile: 4,
    colsTablet: 5,
    colsDesktop: 5
  }

};


// ==========================================================
// BICICLETAS DO JOGO
// ==========================================================

const MEMORY_BIKES = [

  {
    key: 'trek-session',
    brand: 'TREK',
    model: 'SESSION',
    accent: '#39e69d',
    image: 'bikes/trek-session.png'
  },

  {
    key: 'santa-cruz-v10',
    brand: 'SANTA CRUZ',
    model: 'V10',
    accent: '#246bff',
    image: 'bikes/santa-cruz-v10.png'
  },

  {
    key: 'commencal-supreme-dh-v5',
    brand: 'COMMENCAL',
    model: 'SUPREME DH V5',
    accent: '#ff7a00',
    image: 'bikes/commencal-supreme-dh-v5.png'
  },

  {
    key: 'specialized-demo-race',
    brand: 'SPECIALIZED',
    model: 'DEMO RACE',
    accent: '#ff3030',
    image: 'bikes/specialized-demo-race.png'
  },

  {
    key: 'canyon-sender-cfr',
    brand: 'CANYON',
    model: 'SENDER CFR',
    accent: '#12ddea',
    image: 'bikes/canyon-sender-cfr.png'
  },

  {
    key: 'yt-tues',
    brand: 'YT',
    model: 'TUES',
    accent: '#ffc928',
    image: 'bikes/yt-tues.png'
  },

  {
    key: 'giant-glory-advanced',
    brand: 'GIANT',
    model: 'GLORY ADVANCED',
    accent: '#a347ff',
    image: 'bikes/giant-glory-advanced.png'
  },

  {
    key: 'scott-gambler',
    brand: 'SCOTT',
    model: 'GAMBLER',
    accent: '#d6d9df',
    image: 'bikes/scott-gambler.png'
  },

  {
    key: 'pivot-phoenix',
    brand: 'PIVOT',
    model: 'PHOENIX',
    accent: '#85f018',
    image: 'bikes/pivot-phoenix.png'
  },

  {
    key: 'gt-fury',
    brand: 'GT',
    model: 'FURY',
    accent: '#ff36a8',
    image: 'bikes/gt-fury.png'
  }

];

// ==========================================================
// ESTADO DO JOGO DA MEMÓRIA
// ==========================================================

let memoryDeck = [];

let memoryFlipped = [];

let memoryMatched = 0;

let memoryMoves = 0;

let memoryBusy = false;

let memoryStartedAt = 0;

let memoryFinishedAt = 0;

let memoryTimerId = null;

  let memoryLevel = 1;

let memoryCompletionHandled = false;

let memoryAdvanceTimerId = null;

// ==========================================================
// JOGO DA MEMÓRIA — SISTEMA DE SONS
// ==========================================================

let memoryAudioContext = null;


function getMemoryAudioContext() {

  const AudioCtx =
    window.AudioContext ||
    window.webkitAudioContext;

  if (!AudioCtx) {
    return null;
  }

  if (!memoryAudioContext) {

    memoryAudioContext =
      new AudioCtx();
  }

  return memoryAudioContext;
}


function playMemoryNote(
  ctx,
  frequency,
  delay,
  duration,
  volume = 0.06,
  type = 'sine'
) {

  const start =
    ctx.currentTime +
    delay;


  const oscillator =
    ctx.createOscillator();


  const gain =
    ctx.createGain();


  oscillator.type =
    type;


  oscillator.frequency
    .setValueAtTime(
      frequency,
      start
    );


  gain.gain
    .setValueAtTime(
      0.0001,
      start
    );


 const boostedVolume =
  Math.min(
    volume * 3,
    0.25
  );


gain.gain
  .exponentialRampToValueAtTime(
    Math.max(
      0.0002,
      boostedVolume
    ),
    start + 0.01
  );


  gain.gain
    .exponentialRampToValueAtTime(
      0.0001,
      start + duration
    );


  oscillator.connect(
    gain
  );


  gain.connect(
    ctx.destination
  );


  oscillator.start(
    start
  );


  oscillator.stop(
    start +
    duration +
    0.03
  );
}


function playMemorySound(
  type
) {

  const ctx =
    getMemoryAudioContext();


  if (!ctx) {
    return;
  }


  const tocar = () => {


    // ========================================
    // ACERTOU O PAR
    // ========================================

    if (
      type === 'match'
    ) {

      playMemoryNote(
        ctx,
        659.25,
        0,
        0.13,
        0.065,
        'sine'
      );


      playMemoryNote(
        ctx,
        783.99,
        0.08,
        0.16,
        0.07,
        'sine'
      );


      return;
    }


    // ========================================
    // ERROU O PAR
    // ========================================

    if (
      type === 'wrong'
    ) {

      playMemoryNote(
        ctx,
        220,
        0,
        0.12,
        0.055,
        'triangle'
      );


      playMemoryNote(
        ctx,
        164.81,
        0.09,
        0.18,
        0.05,
        'triangle'
      );


      return;
    }


    // ========================================
    // MUDOU DE NÍVEL
    // ========================================

    if (
      type === 'level'
    ) {

      playMemoryNote(
        ctx,
        523.25,
        0,
        0.16,
        0.06,
        'sine'
      );


      playMemoryNote(
        ctx,
        659.25,
        0.10,
        0.16,
        0.065,
        'sine'
      );


      playMemoryNote(
        ctx,
        783.99,
        0.20,
        0.18,
        0.07,
        'sine'
      );


      playMemoryNote(
        ctx,
        1046.50,
        0.31,
        0.25,
        0.075,
        'sine'
      );
    }

  };


  if (
    ctx.state ===
    'suspended'
  ) {

    ctx.resume()
      .then(
        tocar
      )
      .catch(
        () => {}
      );

  } else {

    tocar();
  }
}
  
  // Guarda a ordem da partida anterior
// para evitar repetir exatamente o mesmo tabuleiro.

let lastMemoryOrderSignature =
  sessionStorage.getItem(
    'dhclub_memory_last_order'
  ) || '';

  // ==========================================================
// JOGO DA MEMÓRIA — EMBARALHAR CARTAS
// ==========================================================

function shuffleMemoryArray(
  array
) {

  const shuffled =
    array.slice();


  // Fisher-Yates Shuffle
  // embaralhamento aleatório das cartas

  for (
    let i =
      shuffled.length - 1;

    i > 0;

    i--
  ) {

    const j =
      Math.floor(
        Math.random() *
        (i + 1)
      );


    const temp =
      shuffled[i];

    shuffled[i] =
      shuffled[j];

    shuffled[j] =
      temp;
  }


  return shuffled;
}


// ==========================================================
// JOGO DA MEMÓRIA — CRIAR AS 32 CARTAS
// ==========================================================

function buildMemoryDeck() {

  const levelConfig =
    MEMORY_LEVELS[memoryLevel] ||
    MEMORY_LEVELS[1];


  const totalPairs =
    levelConfig.pairs;


  if (
    MEMORY_BIKES.length <
    totalPairs
  ) {

    console.error(
      `[MEMORY] Nível ${memoryLevel} precisa de ${totalPairs} bikes diferentes.`
    );

    toast(
      `FALTAM BIKES PARA O NÍVEL ${memoryLevel}`
    );

    return [];
  }


  const selectedBikes =
    shuffleMemoryArray(
      MEMORY_BIKES
    )
      .slice(
        0,
        totalPairs
      );


  const cards =
    selectedBikes
      .flatMap(
        bike => [

          {
            uid: `${bike.key}-A`,
            pairId: bike.key,
            brand: bike.brand,
            model: bike.model,
            accent: bike.accent,
            image: bike.image,
            bonus: false,
            matched: false
          },

          {
            uid: `${bike.key}-B`,
            pairId: bike.key,
            brand: bike.brand,
            model: bike.model,
            accent: bike.accent,
            image: bike.image,
            bonus: false,
            matched: false
          }

        ]
      );


  // ========================================================
  // NÍVEL COM QUANTIDADE ÍMPAR
  // NÍVEL 1 = 8 CARTAS EM PARES + 1 CARTA BÔNUS
  // ========================================================

  if (
    levelConfig.cards % 2 !== 0
  ) {

    cards.push({

      uid:
        `bonus-level-${memoryLevel}`,

      pairId:
        `bonus-level-${memoryLevel}`,

      brand:
        'DH-CLUB',

      model:
        'CARTA BÔNUS',

      accent:
        '#ffdf7a',

      image:
        '',

      bonus:
        true,

      matched:
        false

    });
  }


  let shuffled =
    shuffleMemoryArray(
      cards
    );


  let signature =
    shuffled
      .map(
        card => card.uid
      )
      .join('|');


  if (
    signature ===
    lastMemoryOrderSignature
  ) {

    shuffled =
      shuffleMemoryArray(
        cards
      );


    signature =
      shuffled
        .map(
          card => card.uid
        )
        .join('|');
  }


  if (
    signature ===
      lastMemoryOrderSignature &&
    shuffled.length > 1
  ) {

    const firstCard =
      shuffled.shift();


    shuffled.push(
      firstCard
    );


    signature =
      shuffled
        .map(
          card => card.uid
        )
        .join('|');
  }


  lastMemoryOrderSignature =
    signature;


  sessionStorage.setItem(
    'dhclub_memory_last_order',
    signature
  );


  return shuffled;
}


  // ==========================================================
// JOGO DA MEMÓRIA — INICIAR / REINICIAR PARTIDA
// ==========================================================

function startMemoryGame(level = memoryLevel) {

  stopMemoryTimer();

  if (memoryAdvanceTimerId) {

    clearTimeout(
      memoryAdvanceTimerId
    );

    memoryAdvanceTimerId =
      null;
  }

  const requestedLevel =
  Number(level) || 1;


const previousLevel =
  memoryLevel;


const nextLevel =
  Math.max(
    1,
    Math.min(
      3,
      requestedLevel
    )
  );


// ==========================================
// TOCA SOM SOMENTE SE REALMENTE
// HOUVER MUDANÇA DE NÍVEL
// ==========================================

if (
  nextLevel !==
  previousLevel
) {

  playMemorySound(
    'level'
  );
}


memoryLevel =
  nextLevel;


memoryCompletionHandled =
  false;


memoryDeck =
  buildMemoryDeck();

  memoryFlipped = [];

  memoryMatched = 0;

  memoryMoves = 0;

  memoryBusy = false;

  memoryStartedAt = 0;

  memoryFinishedAt = 0;

  if (
    currentView === 'games' &&
    typeof renderGames ===
      'function'
  ) {

    renderGames();
  }
}


  // ==========================================================
// JOGO DA MEMÓRIA — VIRAR CARTA
// ==========================================================

function flipMemoryCard(
  index
) {

  if (memoryBusy) {
    return;
  }


  const card =
    memoryDeck[index];


  if (!card) {
    return;
  }


  if (card.matched) {
    return;
  }


  if (
    memoryFlipped.includes(index)
  ) {
    return;
  }


  // ========================================================
  // INICIA O CRONÔMETRO NO PRIMEIRO CLIQUE
  // ========================================================

  if (
    memoryStartedAt === 0
  ) {

    memoryStartedAt =
      Date.now();

    startMemoryTimer();
  }


  // ========================================================
  // CARTA BÔNUS DO NÍVEL 1
  // ========================================================

  if (
    card.bonus
  ) {

    card.matched =
      true;


    memoryMatched +=
      1;


    playMemorySound(
      'match'
    );


    if (
      memoryMatched ===
      memoryDeck.length
    ) {

      memoryFinishedAt =
        Date.now();


      stopMemoryTimer();


      const finalTime =
        memoryFinishedAt -
        memoryStartedAt;


      handleMemoryLevelCompleted(
        finalTime,
        memoryMoves
      );
    }


    if (
      currentView === 'games' &&
      typeof renderGames ===
        'function'
    ) {

      renderGames();
    }


    return;
  }


  // ========================================================
  // VIRA A CARTA
  // ========================================================

  memoryFlipped.push(
    index
  );


  if (
    currentView === 'games' &&
    typeof renderGames ===
      'function'
  ) {

    renderGames();
  }


  // ========================================================
  // AGUARDA A SEGUNDA CARTA
  // ========================================================

  if (
    memoryFlipped.length < 2
  ) {

    return;
  }


  memoryMoves++;


  memoryBusy =
    true;


  const firstIndex =
    memoryFlipped[0];


  const secondIndex =
    memoryFlipped[1];


  const firstCard =
    memoryDeck[
      firstIndex
    ];


  const secondCard =
    memoryDeck[
      secondIndex
    ];


  // ========================================================
  // ACERTOU O PAR
  // ========================================================

  if (
    firstCard.pairId ===
    secondCard.pairId
  ) {

    firstCard.matched =
      true;


    secondCard.matched =
      true;


    memoryMatched +=
      2;


    memoryFlipped =
      [];


    memoryBusy =
      false;


    playMemorySound(
      'match'
    );


    // ======================================================
    // TERMINOU O NÍVEL
    // ======================================================

    if (
      memoryMatched ===
      memoryDeck.length
    ) {

      memoryFinishedAt =
        Date.now();


      stopMemoryTimer();


      const finalTime =
        memoryFinishedAt -
        memoryStartedAt;


      handleMemoryLevelCompleted(
        finalTime,
        memoryMoves
      );
    }


    if (
      currentView === 'games' &&
      typeof renderGames ===
        'function'
    ) {

      renderGames();
    }


    return;
  }


  // ========================================================
  // ERROU O PAR
  // ========================================================

  playMemorySound(
    'wrong'
  );


  setTimeout(
    () => {

      memoryFlipped =
        [];


      memoryBusy =
        false;


      if (
        currentView === 'games' &&
        typeof renderGames ===
          'function'
      ) {

        renderGames();
      }

    },

    850
  );
}


// ==========================================================
// JOGO DA MEMÓRIA — FORMATAR TEMPO
// ==========================================================

// ==========================================================
// JOGO DA MEMÓRIA — SALVAR RECORDE E AVANÇAR NÍVEL
// ==========================================================

async function saveMemoryRecord(
  level,
  timeMs,
  moves
) {

  if (!loggedUser) {
    return {
      newGlobalRecord: false
    };
  }

  const cpf =
    cleanCPF(
      loggedUser.cpf
    );

  if (!cpf) {
    return {
      newGlobalRecord: false
    };
  }

  const athleteName =
    loggedUser.nome ||
    'ATLETA';

  const levelKey =
    `level_${level}`;


  // ==========================================
  // GUARDA OS 5 MELHORES TEMPOS DO ATLETA
  // ==========================================

  const personalRef =
    database.ref(
      `${CLUB_ROOT}/memory_game/users/${cpf}/${levelKey}/best5`
    );

  await personalRef.transaction(
    current => {

      const records =
        objValues(
          current
        );

      records.push({

        timeMs:
          Number(timeMs),

        moves:
          Number(moves || 0),

        level:
          Number(level),

        date:
          Date.now()

      });

      return records
        .filter(
          item =>
            Number(item.timeMs) > 0
        )
        .sort(
          (a, b) =>
            Number(a.timeMs) -
            Number(b.timeMs)
        )
        .slice(
          0,
          5
        );
    }
  );


  // ==========================================
  // RECORDE GERAL DO NÍVEL
  // ==========================================

  const globalRef =
    database.ref(
      `${CLUB_ROOT}/memory_game/global/${levelKey}`
    );

  const recordId =
    `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const transactionResult =
    await globalRef.transaction(
      current => {

        const oldTime =
          Number(
            current?.timeMs ||
            Infinity
          );

        if (
          Number(timeMs) <
          oldTime
        ) {

          return {

            recordId,

            cpf,

            name:
              athleteName,

            timeMs:
              Number(timeMs),

            moves:
              Number(moves || 0),

            level:
              Number(level),

            updatedAt:
              Date.now()

          };
        }

        return current;
      }
    );


  const savedGlobal =
    transactionResult.snapshot
      ?.val?.() ||
    null;


  return {

    newGlobalRecord:
      !!savedGlobal &&
      savedGlobal.recordId ===
        recordId

  };
}


// ==========================================================
// TERMINOU O NÍVEL
// ==========================================================

async function handleMemoryLevelCompleted(
  finalTime,
  moves
) {

  if (
    memoryCompletionHandled
  ) {

    return;
  }


  memoryCompletionHandled =
    true;


  const finishedLevel =
    memoryLevel;


  let result = {

    newGlobalRecord:
      false

  };


  try {

    result =
      await saveMemoryRecord(
        finishedLevel,
        finalTime,
        moves
      );

  } catch (error) {

    console.error(
      '[MEMORY] Erro ao salvar recorde:',
      error
    );
  }


  if (
    currentView === 'games' &&
    typeof renderGames ===
      'function'
  ) {

    renderGames();
  }


  // ==========================================
  // NÍVEIS 1 ATÉ 3
  // ==========================================

  if (
    finishedLevel < 3
  ) {

    toast(
      result.newGlobalRecord

        ? `🏆 NOVO RECORDE! NÍVEL ${finishedLevel}. PRÓXIMO: NÍVEL ${finishedLevel + 1}`

        : `NÍVEL ${finishedLevel} CONCLUÍDO! PRÓXIMO: NÍVEL ${finishedLevel + 1}`
    );


    memoryAdvanceTimerId =
      setTimeout(
        () => {

          memoryAdvanceTimerId =
            null;

          startMemoryGame(
            finishedLevel + 1
          );

        },
        2500
      );


    return;
  }


  // ==========================================
  // TERMINOU O NÍVEL 3
  // ==========================================

  toast(
    result.newGlobalRecord

      ? '🏆 NOVO RECORDE! VOCÊ CONCLUIU O NÍVEL 3!'

      : '🏆 PARABÉNS! VOCÊ CONCLUIU OS 3 NÍVEIS!'
  );
}


// ==========================================================
// JOGO DA MEMÓRIA — FORMATAR TEMPO
// ==========================================================

function formatMemoryDuration(
  milliseconds
) {

  const totalMs =
    Math.max(
      0,
      Math.floor(
        Number(
          milliseconds || 0
        )
      )
    );


  const minutes =
    Math.floor(
      totalMs / 60000
    );


  const seconds =
    Math.floor(
      (
        totalMs % 60000
      ) / 1000
    );


  const centiseconds =
    Math.floor(
      (
        totalMs % 1000
      ) / 10
    );


  return (
    String(minutes)
      .padStart(2, '0') +
    ':' +
    String(seconds)
      .padStart(2, '0') +
    '.' +
    String(centiseconds)
      .padStart(2, '0')
  );
}


// ==========================================================
// JOGO DA MEMÓRIA — GARANTE PARTIDA ATIVA
// ==========================================================


// ==========================================================
// JOGO DA MEMÓRIA — CRONÔMETRO VISUAL
// ==========================================================

function stopMemoryTimer() {

  if (
    memoryTimerId
  ) {

    clearInterval(
      memoryTimerId
    );

    memoryTimerId =
      null;
  }
}


function startMemoryTimer() {

  stopMemoryTimer();


  memoryTimerId =
    setInterval(
      () => {

        if (
          !memoryStartedAt ||
          memoryFinishedAt
        ) {

          return;
        }


        const el =
          document.getElementById(
            'memory-time'
          );


        if (!el) {

          return;
        }


        el.textContent =
          formatMemoryDuration(
            Date.now() -
            memoryStartedAt
          );

      },

      250
    );
}
  
  
  function ensureMemoryGameReady() {

  if (
    memoryDeck.length > 0
  ) {
    return;
  }


  memoryDeck =
    buildMemoryDeck();


  memoryFlipped =
    [];


  memoryMatched =
    0;


  memoryMoves =
    0;


  memoryBusy =
    false;


  memoryStartedAt =
  0;


  memoryFinishedAt =
  0;

memoryCompletionHandled =
  false;
}


// ==========================================================
// JOGO DA MEMÓRIA — DESENHO DA BIKE
// ==========================================================

function memoryBikeArt(
  color
) {

  return `

    <svg
      viewBox="0 0 120 70"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      aria-hidden="true"
    >

      <circle
        cx="25"
        cy="50"
        r="15"
        stroke="${color}"
        stroke-width="5"
      ></circle>


      <circle
        cx="94"
        cy="50"
        r="15"
        stroke="${color}"
        stroke-width="5"
      ></circle>


      <path
        d="
          M25 50
          L43 28
          L64 28
          L52 50
          Z
        "
        stroke="${color}"
        stroke-width="5"
        stroke-linecap="round"
        stroke-linejoin="round"
      ></path>


      <path
        d="
          M64 28
          L78 20
          L94 50
        "
        stroke="${color}"
        stroke-width="5"
        stroke-linecap="round"
        stroke-linejoin="round"
      ></path>


      <path
        d="
          M43 28
          L34 18
        "
        stroke="${color}"
        stroke-width="5"
        stroke-linecap="round"
      ></path>


      <path
        d="
          M30 18
          H40
        "
        stroke="${color}"
        stroke-width="5"
        stroke-linecap="round"
      ></path>


      <path
        d="
          M52 50
          L60 15
        "
        stroke="${color}"
        stroke-width="5"
        stroke-linecap="round"
      ></path>


      <path
        d="
          M54 16
          H68
        "
        stroke="${color}"
        stroke-width="5"
        stroke-linecap="round"
      ></path>

    </svg>

  `;
}


// ==========================================================
// JOGO DA MEMÓRIA — HTML DE CADA CARTA
// ==========================================================

function memoryCardMarkup(
  card,
  index
) {

  const isFlipped =
    memoryFlipped.includes(
      index
    ) ||
    card.matched;


  return `

    <button
      class="
        memory-card
        ${
          isFlipped
            ? 'flipped'
            : ''
        }
        ${
          card.matched
            ? 'matched'
            : ''
        }
      "
      type="button"
      onclick="
        Club.flipMemoryCard(
          ${index}
        )
      "
    >

      <div class="memory-card-inner">


        <!-- CARTA FECHADA -->

        <div
          class="
            memory-face
            memory-front
          "
        >

          <i
            class="
              fa-solid
              fa-mountain
            "
          ></i>

          <span>
            DH
          </span>

        </div>


        <!-- CARTA ABERTA -->

        <div
          class="
            memory-face
            memory-back
          "
        >

          <div class="memory-bike-art">

  <img
    class="memory-bike-photo"
    src="${esc(card.image || '')}"
    alt="${esc(card.brand + ' ' + card.model)}"
    loading="lazy"
    onerror="
      this.style.display='none';
      this.nextElementSibling.style.display='block';
    "
  />

  <div
    class="memory-bike-svg-fallback"
    style="display:none;"
  >
    ${
      memoryBikeArt(
        card.accent
      )
    }
  </div>

</div>


          <div
            class="memory-bike-brand"
          >

            ${
              esc(
                card.brand
              )
            }

          </div>


          <div
            class="memory-bike-model"
          >

            ${
              esc(
                card.model
              )
            }

          </div>

        </div>

      </div>

    </button>

  `;
}


// ==========================================================
// JOGOS — TELA PRINCIPAL
// ==========================================================

function renderGames() {

  ensureMemoryGameReady();

  const levelConfig =
  MEMORY_LEVELS[memoryLevel];


const levelKey =
  `level_${memoryLevel}`;


const myCpf =
  cleanCPF(
    loggedUser?.cpf
  );


const globalRecord =
  club.memory_game
    ?.global
    ?.[levelKey] ||
  null;


const myRecords =
  objValues(
    club.memory_game
      ?.users
      ?.[myCpf]
      ?.[levelKey]
      ?.best5
  )
    .sort(
      (a, b) =>
        Number(a.timeMs) -
        Number(b.timeMs)
    )
    .slice(
      0,
      5
    );


  const totalPairs =
  Math.floor(
    memoryDeck.length / 2
  );


const totalCards =
  memoryDeck.length;


  const foundPairs =
    Math.floor(
      memoryMatched / 2
    );


  const elapsed =
    memoryStartedAt

      ? (
          memoryFinishedAt ||
          Date.now()
        ) -
        memoryStartedAt

      : 0;


  const finished =
    memoryDeck.length > 0 &&
    memoryMatched ===
      memoryDeck.length;


  const view =
    document.getElementById(
      'view-games'
    );


  if (!view) {
    return;
  }


  view.innerHTML = `

    <div class="hero">

      <div class="eyebrow">
        DH-CLUB GAMES
      </div>


      <h2>
  Jogo da Memória
</h2>

<div class="memory-level-badge">
  NÍVEL ${memoryLevel} DE 3
</div>


      <p>

        Encontre os pares
        das bikes de downhill.

        <br>

       São ${totalPairs} pares
     e ${totalCards} cartas.

      </p>


      <div class="member-chip">

        <i
          class="
            fa-solid
            fa-gamepad
          "
        ></i>

        ${totalPairs} PARES
         •

        ${totalCards} CARTAS

      </div>

    </div>


    <!-- ESTATÍSTICAS -->

    <div class="grid-stats">

      ${stat(
        'PARES',
        `${foundPairs}/${totalPairs}`,
        'encontrados'
      )}


      ${stat(
        'JOGADAS',
        memoryMoves,
        'tentativas'
      )}


      <div class="stat-card">

  <div class="stat-label">
    TEMPO
  </div>

  <div
    class="stat-value"
    id="memory-time"
  >
    ${
      formatMemoryDuration(
        elapsed
      )
    }
  </div>

  <div class="stat-sub">
    partida atual
  </div>

</div>


      ${stat(
        'CARTAS',
        memoryMatched,
        `de ${memoryDeck.length}`
      )}

    </div>

<div class="memory-global-record">

  <div class="eyebrow">
    🏆 RECORDE GERAL • NÍVEL ${memoryLevel}
  </div>

  ${
    globalRecord

      ? `

        <div class="memory-record-time">

          ${
            formatMemoryDuration(
              globalRecord.timeMs
            )
          }

        </div>

        <div class="memory-record-owner">

          ${
            esc(
              globalRecord.name ||
              'ATLETA'
            )
          }

        </div>

      `

      : `

        <div class="memory-no-record">
          AINDA NÃO HÁ RECORDE
        </div>

      `
  }

</div>

<div class="memory-my-records">

  <div class="eyebrow">
    MEUS 5 MELHORES • NÍVEL ${memoryLevel}
  </div>

  ${
    myRecords.length

      ? myRecords
          .map(
            (record, index) => `

              <div class="memory-record-row">

                <span>
                  ${index + 1}º
                </span>

                <b>
                  ${
                    formatMemoryDuration(
                      record.timeMs
                    )
                  }
                </b>

                <small>
                  ${record.moves || 0}
                  jogadas
                </small>

              </div>

            `
          )
          .join('')

      : `

        <div class="memory-no-record">
          COMPLETE ESTE NÍVEL PARA REGISTRAR SEU TEMPO
        </div>

      `
  }

</div>

    <!-- NOVO JOGO -->

    <div
      class="btn-row"
      style="
        margin-top:12px;
      "
    >

      <button
        class="primary-btn"
        onclick="
          Club.startMemoryGame()
        "
      >

        <i
          class="
            fa-solid
            fa-rotate
          "
        ></i>

        NOVO JOGO

      </button>

    </div>


    <div class="section-title">

      <h3>
        TABULEIRO
      </h3>


      <span>
        ${foundPairs}/${totalPairs}
        PARES
      </span>

    </div>


    <!-- TABULEIRO DINÂMICO POR NÍVEL -->

    <div
  class="memory-board"

  data-level="${memoryLevel}"

  style="
    --memory-cols-mobile:${levelConfig.colsMobile};
    --memory-cols-tablet:${levelConfig.colsTablet};
    --memory-cols-desktop:${levelConfig.colsDesktop};
  "
>

      ${
        memoryDeck
          .map(
            (
              card,
              index
            ) =>
              memoryCardMarkup(
                card,
                index
              )
          )
          .join('')
      }

    </div>


    ${
      finished

        ? `

          <div
            class="premium-card"
            style="
              margin-top:16px;
              text-align:center;
            "
          >

            <div
              style="
                font-size:35px;
                margin-bottom:8px;
              "
            >
              🏆
            </div>


            <div class="eyebrow">
              PARTIDA CONCLUÍDA
            </div>


            <h3>
              Você encontrou
             os ${totalPairs} pares!
            </h3>


            <p
              style="
                color:var(--muted);
                font-size:11px;
                line-height:1.6;
              "
            >

              Tempo:

              <b
                style="
                  color:white;
                "
              >

                ${
                  formatMemoryDuration(
                    elapsed
                  )
                }

              </b>


              <br>


              Jogadas:

              <b
                style="
                  color:white;
                "
              >
                ${memoryMoves}
              </b>

            </p>


            ${
  memoryLevel < 3

    ? `

        <p
          style="
            color:var(--gold2);
            font-size:11px;
            font-weight:900;
          "
        >
          PREPARANDO NÍVEL ${memoryLevel + 1}…
        </p>

        <button
          class="primary-btn"
          style="
            width:100%;
            margin-top:8px;
          "
          onclick="
            Club.startMemoryGame(
              ${memoryLevel + 1}
            )
          "
        >

          IR AGORA PARA O NÍVEL ${memoryLevel + 1}

        </button>

      `

    : `

        <p
          style="
            color:var(--gold2);
            font-size:11px;
            font-weight:900;
          "
        >
          VOCÊ CONCLUIU OS 3 NÍVEIS!
        </p>

        <button
          class="primary-btn"
          style="
            width:100%;
            margin-top:8px;
          "
          onclick="
            Club.startMemoryGame(1)
          "
        >

          RECOMEÇAR NO NÍVEL 1

        </button>

      `
}

          </div>

        `

        : ''
    }

  `;
}
  

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

const isOrganizer = u =>
  !!u &&
  u.role === 'ORGANIZER';


function organizerCanManageEvent(
  user,
  eventId
) {

  if (!user) {
    return false;
  }


  // ADMIN pode gerenciar qualquer evento

  if (
    isAdmin(user)
  ) {

    return true;
  }


  // ORGANIZADOR somente eventos liberados

  if (
    !isOrganizer(user)
  ) {

    return false;
  }


  const allowed =
    Array.isArray(
      user.allowedEvts
    )

      ? user.allowedEvts
          .map(String)

      : [];


  return allowed.includes(
    String(eventId)
  );
}  

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

 if (
  isAdmin(loggedUser) ||
  isOrganizer(loggedUser)
) {

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
// RANKING OFICIAL POR PONTOS — DH-PE
// ==========================================================

function officialPointsRanking() {

  const pointsMap =
    {};


  if (
    !core.events ||
    !core.tempos
  ) {

    return [];
  }


  // ========================================================
  // ADICIONA PONTOS AO ATLETA
  // ========================================================

  const addPoints =
  (
    result,
    points,
    isQualify,
    eventName,
    eventId
  ) => {

      const pts =
        Number(
          points || 0
        );


      if (
        !Number.isFinite(pts) ||
        pts === 0
      ) {

        return;
      }


      const cpf =
        cleanCPF(
          result.cpf
        );


      const category =
        normalizeCat(
          result.cat
        );


      const key =
        `${cpf}_${category}`;


      if (
  !pointsMap[key]
) {

  pointsMap[key] = {

    cpf,

    name:
      result.name ||
      '',

    city:
      result.city ||
      '',

    cat:
      category,

    totalPts:
      0,

    qPts:
      0,

    oPts:
      0,

    evts:
      [],

    pointsByEvent:
      {}

  };
}


      pointsMap[key]
        .totalPts +=
        pts;


      if (
        isQualify
      ) {

        pointsMap[key]
          .qPts +=
          pts;

      } else {

        pointsMap[key]
          .oPts +=
          pts;
      }


      if (
        eventName &&
        !pointsMap[key]
          .evts
          .includes(
            eventName
          )
      ) {

        pointsMap[key]
          .evts
          .push(
            eventName
          );
      }
// ========================================================
// DETALHAMENTO DOS PONTOS POR ETAPA
// ========================================================

const eventKey =
  String(
    eventId ||
    eventName ||
    'evento'
  );


if (
  !pointsMap[key]
    .pointsByEvent[
      eventKey
    ]
) {

  pointsMap[key]
    .pointsByEvent[
      eventKey
    ] = {

      eventId:
        eventId ||
        '',

      eventName:
        eventName ||
        'ETAPA',

      officialPts:
        0,

      qualifyPts:
        0,

      totalPts:
        0

    };
}


const eventEntry =
  pointsMap[key]
    .pointsByEvent[
      eventKey
    ];


eventEntry.totalPts +=
  pts;


if (
  isQualify
) {

  eventEntry.qualifyPts +=
    pts;

} else {

  eventEntry.officialPts +=
    pts;
}
    
    };


  // ========================================================
  // PERCORRE TODAS AS ETAPAS
  // ========================================================

  core.events.forEach(
    event => {

      if (
        !event ||
        event.status ===
          'CANCELLED'
      ) {

        return;
      }


      const eventResults =
        core.tempos.filter(
          result =>
            result &&
            String(
              result.evtId
            ) ===
            String(
              event.id
            )
        );


      const officialByCategory =
        {};


      const qualifyByCategory =
        {};


      eventResults.forEach(
        result => {

          const category =
            normalizeCat(
              result.cat
            );


          if (
            !officialByCategory[
              category
            ]
          ) {

            officialByCategory[
              category
            ] = [];
          }


          if (
            !qualifyByCategory[
              category
            ]
          ) {

            qualifyByCategory[
              category
            ] = [];
          }


          // DESCIDA OFICIAL
          if (
            result.runType ===
              '1st' ||
            !result.runType
          ) {

            officialByCategory[
              category
            ].push(
              result
            );
          }


          // CLASSIFICATÓRIA
          if (
            result.runType ===
              'qualify'
          ) {

            qualifyByCategory[
              category
            ].push(
              result
            );
          }
        }
      );


      // ====================================================
      // ORDENA TEMPOS
      // ====================================================

      const sortResults =
        (
          a,
          b
        ) => {

          if (
            a.val === 'DNF' &&
            b.val !== 'DNF'
          ) {

            return 1;
          }


          if (
            b.val === 'DNF' &&
            a.val !== 'DNF'
          ) {

            return -1;
          }


          return (
            timeMs(a.val) -
            timeMs(b.val)
          );
        };


      // ====================================================
      // MELHOR RESULTADO ÚNICO POR CPF
      // ====================================================

      const uniqueResults =
        list => {

          const map =
            {};


          list
            .slice()
            .sort(
              sortResults
            )
            .forEach(
              result => {

                const cpf =
                  cleanCPF(
                    result.cpf
                  );


                if (!cpf) {

                  return;
                }


                if (
                  !map[cpf]
                ) {

                  map[cpf] =
                    result;

                  return;
                }


                const current =
                  map[cpf];


                if (
                  current.val ===
                    'DNF' &&
                  result.val !==
                    'DNF'
                ) {

                  map[cpf] =
                    result;

                  return;
                }


                if (
                  result.val !==
                    'DNF' &&
                  timeMs(
                    result.val
                  ) <
                  timeMs(
                    current.val
                  )
                ) {

                  map[cpf] =
                    result;
                }
              }
            );


          return Object
            .values(
              map
            )
            .sort(
              sortResults
            );
        };


      // ====================================================
      // PONTOS DA DESCIDA OFICIAL
      // ====================================================

      Object
        .keys(
          officialByCategory
        )
        .forEach(
          category => {

            const results =
              uniqueResults(
                officialByCategory[
                  category
                ]
              );


            results.forEach(
              (
                result,
                index
              ) => {

                let points =
                  0;


                if (
                  result.val !==
                    'DNF' &&
                  Array.isArray(
                    event.points
                  ) &&
                  index <
                    event.points.length &&
                  event.points[
                    index
                  ] !== ''
                ) {

                  points =
                    parseInt(
                      event.points[
                        index
                      ],
                      10
                    ) || 0;
                }


                addPoints(
  result,
  points,
  false,
  event.t,
  event.id
);
              }
            );
          }
        );


      // ====================================================
      // PONTOS DA CLASSIFICATÓRIA
      // ====================================================

      Object
        .keys(
          qualifyByCategory
        )
        .forEach(
          category => {

            const results =
              uniqueResults(
                qualifyByCategory[
                  category
                ]
              );


            results.forEach(
              (
                result,
                index
              ) => {

                let points =
                  0;


                if (
                  result.val !==
                    'DNF' &&
                  Array.isArray(
                    event.qPoints
                  ) &&
                  index <
                    event.qPoints.length &&
                  event.qPoints[
                    index
                  ] !== ''
                ) {

                  points =
                    parseInt(
                      event.qPoints[
                        index
                      ],
                      10
                    ) || 0;
                }


                addPoints(
  result,
  points,
  true,
  event.t,
  event.id
);
              }
            );
          }
        );
    }
  );


  return Object
    .values(
      pointsMap
    )
    .sort(
      (
        a,
        b
      ) =>
        b.totalPts -
        a.totalPts
    );
}


// ==========================================================
// CIDADE OFICIAL DO ATLETA
// ==========================================================

function officialAthleteCity(
  cpf,
  fallbackCity = ''
) {

  const user =
    core.users.find(
      athlete =>
        cleanCPF(
          athlete.cpf
        ) ===
        cleanCPF(
          cpf
        )
    );


  const city =
    String(
      user?.city ||
      user?.cidade ||
      fallbackCity ||
      ''
    )
      .trim()
      .toUpperCase();


  const uf =
    String(
      user?.uf ||
      ''
    )
      .trim()
      .toUpperCase();


  if (
    city &&
    uf
  ) {

    return (
      `${city}-${uf}`
    );
  }


  return city;
}


// ==========================================================
// CHAVE DE CIDADE — IGNORA ACENTOS
// ==========================================================

function officialCityKey(
  city
) {

  return String(
    city ||
    ''
  )
    .trim()
    .toUpperCase()
    .replace(
      /\s*-\s*/g,
      '-'
    )
    .normalize(
      'NFD'
    )
    .replace(
      /[\u0300-\u036f]/g,
      ''
    );
}


// ==========================================================
// RANKING OFICIAL POR CIDADES
// ==========================================================

function officialCityRanking(
  ranking = null
) {

  const list =
    ranking ||
    officialPointsRanking();


  const cityMap =
    {};


  list.forEach(
    athlete => {

      if (
        !athlete ||
        Number(
          athlete.totalPts ||
          0
        ) <= 0
      ) {

        return;
      }


      const city =
        officialAthleteCity(
          athlete.cpf,
          athlete.city
        );


      const key =
        officialCityKey(
          city
        );


      if (!key) {

        return;
      }


      if (
        !cityMap[key]
      ) {

        cityMap[key] = {

          city,

          totalPts:
            0,

          athletes:
            {}

        };
      }


      cityMap[key]
        .totalPts +=
        Number(
          athlete.totalPts ||
          0
        );


      const cpf =
        cleanCPF(
          athlete.cpf
        );


      if (
        !cityMap[key]
          .athletes[
            cpf
          ]
      ) {

        cityMap[key]
          .athletes[
            cpf
          ] = {

            cpf,

            name:
              athlete.name ||
              '',

            totalPts:
              0

          };
      }


      cityMap[key]
        .athletes[
          cpf
        ]
        .totalPts +=
        Number(
          athlete.totalPts ||
          0
        );
    }
  );


  return Object
    .values(
      cityMap
    )
    .map(
      city => ({

        city:
          city.city,

        totalPts:
          city.totalPts,

        athletes:
          Object
            .values(
              city.athletes
            )
            .sort(
              (
                a,
                b
              ) =>
                b.totalPts -
                a.totalPts
            )

      })
    )
    .sort(
      (
        a,
        b
      ) =>
        b.totalPts -
        a.totalPts
    );
}


// ==========================================================
// DADOS OFICIAIS DO ATLETA LOGADO
// ==========================================================

function myOfficialRankingData() {

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


  const ranking =
    officialPointsRanking();


  // ========================================================
  // RANKING DA CATEGORIA
  // ========================================================

  const categoryRanking =
    ranking.filter(
      athlete =>
        normalizeCat(
          athlete.cat
        ) ===
        category
    );


  const categoryIndex =
    categoryRanking
      .findIndex(
        athlete =>
          cleanCPF(
            athlete.cpf
          ) ===
          cpf
      );


  const categoryEntry =
    categoryIndex >= 0

      ? categoryRanking[
          categoryIndex
        ]

      : null;


  // ========================================================
  // RANKING GERAL OFICIAL
  // ========================================================

  const generalIndex =
    ranking.findIndex(
      athlete =>
        cleanCPF(
          athlete.cpf
        ) ===
          cpf &&
        normalizeCat(
          athlete.cat
        ) ===
          category
    );


  // ========================================================
  // RANKING DAS CIDADES
  // ========================================================

  const cityRanking =
    officialCityRanking(
      ranking
    );


  const myCity =
    officialAthleteCity(
      cpf,
      loggedUser.city
    );


  const myCityKey =
    officialCityKey(
      myCity
    );


  const cityIndex =
    cityRanking.findIndex(
      city =>
        officialCityKey(
          city.city
        ) ===
        myCityKey
    );


  const cityEntry =
    cityIndex >= 0

      ? cityRanking[
          cityIndex
        ]

      : null;


  // ========================================================
  // POSIÇÃO DO ATLETA DENTRO DA CIDADE
  // ========================================================

  const cityAthleteIndex =
    cityEntry

      ? cityEntry
          .athletes
          .findIndex(
            athlete =>
              cleanCPF(
                athlete.cpf
              ) ===
              cpf
          )

      : -1;


  const cityAthlete =
    cityAthleteIndex >= 0

      ? cityEntry
          .athletes[
            cityAthleteIndex
          ]

      : null;


  return {

    category,

    // ------------------------------------------------------
    // PONTOS DO ATLETA
    // ------------------------------------------------------

    totalPts:
      categoryEntry
        ?.totalPts ||
      0,

    officialPts:
      categoryEntry
        ?.oPts ||
      0,

    qualifyPts:
      categoryEntry
        ?.qPts ||
      0,

// ------------------------------------------------------
// PONTOS DETALHADOS POR ETAPA
// ------------------------------------------------------

pointsByEvent:
  Object
    .values(
      categoryEntry
        ?.pointsByEvent ||
      {}
    )
    .sort(
      (
        a,
        b
      ) => {

        const indexA =
          core.events.findIndex(
            event =>
              String(event.id) ===
              String(a.eventId)
          );


        const indexB =
          core.events.findIndex(
            event =>
              String(event.id) ===
              String(b.eventId)
          );


        return (
          indexA -
          indexB
        );
      }
    ),
    
    // ------------------------------------------------------
    // RANKING DA CATEGORIA
    // ------------------------------------------------------

    categoryPosition:
      categoryIndex >= 0
        ? categoryIndex + 1
        : null,

    categoryTotal:
      categoryRanking.length,


    // ------------------------------------------------------
    // RANKING GERAL
    // ------------------------------------------------------

    generalPosition:
      generalIndex >= 0
        ? generalIndex + 1
        : null,

    generalTotal:
      ranking.length,


    // ------------------------------------------------------
    // CIDADE
    // ------------------------------------------------------

    city:
      myCity,

    cityPosition:
      cityIndex >= 0
        ? cityIndex + 1
        : null,

    cityTotal:
      cityRanking.length,

    cityPoints:
      cityEntry
        ?.totalPts ||
      0,

    cityAthleteCount:
      cityEntry
        ?.athletes
        ?.length ||
      0,


    // ------------------------------------------------------
    // POSIÇÃO ENTRE ATLETAS DA PRÓPRIA CIDADE
    // ------------------------------------------------------

    athleteCityPosition:
      cityAthleteIndex >= 0
        ? cityAthleteIndex + 1
        : null,

    athleteCityTotal:
      cityEntry
        ?.athletes
        ?.length ||
      0,

    athleteCityPoints:
      cityAthlete
        ?.totalPts ||
      0,


    // ------------------------------------------------------
    // LISTA DOS ATLETAS DA CIDADE
    // ------------------------------------------------------

    cityAthletes:
      cityEntry
        ?.athletes ||
      []

  };
}

// ==========================================================
// CONQUISTAS
// ==========================================================

// ==========================================================
// TEMPORADA OFICIAL DINÂMICA — DH-CLUB
// ==========================================================

function hasOfficialPointsTable(
  table
) {

  return (
    Array.isArray(table) &&
    table.some(
      value => {

        const points =
          Number(value);

        return (
          Number.isFinite(points) &&
          points > 0
        );
      }
    )
  );
}


// ==========================================================
// IDENTIFICA ETAPA VÁLIDA DO CAMPEONATO
// ==========================================================

function isOfficialScoringEvent(
  event
) {

  if (!event) {

    return false;
  }


  // Etapa cancelada não entra
  if (
    String(
      event.status ||
      ''
    ).toUpperCase() ===
      'CANCELLED'
  ) {

    return false;
  }


  const hasOfficial =
    hasOfficialPointsTable(
      event.points
    );


  const hasQualify =
    hasOfficialPointsTable(
      event.qPoints
    );


  // A etapa precisa possuir
  // alguma pontuação configurada.
  return (
    hasOfficial ||
    hasQualify
  );
}


// ==========================================================
// MAIOR PONTUAÇÃO POSSÍVEL EM UMA TABELA
// ==========================================================

function maxPointsFromTable(
  table
) {

  if (
    !Array.isArray(table)
  ) {

    return 0;
  }


  const valid =
    table
      .map(Number)
      .filter(
        value =>
          Number.isFinite(value) &&
          value > 0
      );


  if (!valid.length) {

    return 0;
  }


  return Math.max(
    ...valid
  );
}


// ==========================================================
// SITUAÇÃO REAL DA TEMPORADA
// ==========================================================

function officialSeasonProgress() {

  const events =
    core.events.filter(
      isOfficialScoringEvent
    );


  const eventIds =
    new Set(
      events.map(
        event =>
          String(event.id)
      )
    );


  // --------------------------------------------------------
  // ETAPAS EM QUE O ATLETA REALMENTE PARTICIPOU
  // DNS não conta como participação.
  // DNF continua contando como participação.
  // --------------------------------------------------------

  const participatedIds =
    new Set(
      myOfficialResults()
        .filter(
          result => {

            if (
              !eventIds.has(
                String(
                  result.evtId
                )
              )
            ) {

              return false;
            }


            return (
              String(
                result.val ||
                ''
              ).toUpperCase() !==
                'DNS'
            );
          }
        )
        .map(
          result =>
            String(
              result.evtId
            )
        )
    );


  const total =
    events.length;


  const completed =
    participatedIds.size;


  // --------------------------------------------------------
  // TODAS AS ETAPAS OFICIAIS JÁ ENCERRARAM?
  // --------------------------------------------------------

  const allClosed =
    total > 0 &&
    events.every(
      event =>
        String(
          event.status ||
          ''
        ).toUpperCase() ===
          'CLOSED'
    );


  // --------------------------------------------------------
  // METADE DA TEMPORADA
  // --------------------------------------------------------

  const halfTarget =
    total > 0

      ? Math.max(
          1,
          Math.ceil(
            total * 0.50
          )
        )

      : 0;


  // --------------------------------------------------------
  // VETERANO = 80% DA TEMPORADA
  // --------------------------------------------------------

  const veteranTarget =
    total > 0

      ? Math.max(
          1,
          Math.ceil(
            total * 0.80
          )
        )

      : 0;


  // --------------------------------------------------------
  // MÁXIMO DE PONTOS POSSÍVEIS DA TEMPORADA
  // --------------------------------------------------------

  const maxSeasonPoints =
    events.reduce(
      (
        totalPoints,
        event
      ) => {

        const officialMax =
          maxPointsFromTable(
            event.points
          );


        const qualifyMax =
          maxPointsFromTable(
            event.qPoints
          );


        return (
          totalPoints +
          officialMax +
          qualifyMax
        );
      },
      0
    );


  return {

    events,

    total,

    completed,

    allClosed,

    halfTarget,

    veteranTarget,

    maxSeasonPoints

  };
}
  
  function achievements() {

  const s =
    careerStats();


  const official =
    typeof myOfficialRankingData === 'function'
      ? myOfficialRankingData()
      : {};


  const comparison =
    typeof mySeasonComparison === 'function'
      ? mySeasonComparison()
      : {};

const season =
  officialSeasonProgress();


const officialRaces =
  season.completed;


const officialSeasonTotal =
  season.total;


const veteranTarget =
  season.veteranTarget;


const halfSeasonTarget =
  season.halfTarget;


const maxSeasonPoints =
  season.maxSeasonPoints;
    

  // ========================================================
  // UM RESULTADO POR ETAPA
  // ========================================================

  const byEvent =
    {};


  s.results.forEach(
    result => {

      const key =
        String(
          result.evtId
        );


      if (
        !byEvent[key] ||
        timeMs(result.val) <
        timeMs(
          byEvent[key].val
        )
      ) {

        byEvent[key] =
          result;
      }
    }
  );


  const seasonResults =
    Object
      .values(
        byEvent
      )
      .sort(
        (
          a,
          b
        ) => {

          const indexA =
            core.events.findIndex(
              event =>
                String(event.id) ===
                String(a.evtId)
            );


          const indexB =
            core.events.findIndex(
              event =>
                String(event.id) ===
                String(b.evtId)
            );


          if (
            indexA >= 0 &&
            indexB >= 0
          ) {

            return (
              indexA -
              indexB
            );
          }


          return (
            Number(
              a.evtId || 0
            ) -
            Number(
              b.evtId || 0
            )
          );
        }
      );


  const positions =
    seasonResults
      .map(
        result =>
          resultPlacement(
            result
          )
      )
      .filter(
        position =>
          Number.isFinite(
            Number(position)
          )
      )
      .map(Number);


  const countTop =
    limit =>
      positions.filter(
        position =>
          position <= limit
      ).length;


  const countPosition =
    position =>
      positions.filter(
        resultPosition =>
          resultPosition ===
          position
      ).length;


  const hasPosition =
    position =>
      countPosition(
        position
      ) >= 1;


  const hasTop =
    limit =>
      countTop(
        limit
      ) >= 1;


  const hasTimeBelow =
    milliseconds =>
      seasonResults.some(
        result =>
          timeMs(
            result.val
          ) <
          milliseconds
      );


  // ========================================================
  // SEQUÊNCIA DE RESULTADOS
  // ========================================================

  const hasStreakTop =
    (
      limit,
      target
    ) => {

      let streak =
        0;


      for (
        const position
        of positions
      ) {

        if (
          position <= limit
        ) {

          streak++;

        } else {

          streak =
            0;
        }


        if (
          streak >= target
        ) {

          return true;
        }
      }


      return false;
    };


  const races =
    seasonResults.length;


  const podiums =
    countTop(5);


  const wins =
    countPosition(1);


  const totalPts =
    Number(
      official.totalPts ||
      0
    );


  const categoryPosition =
    Number(
      official.categoryPosition ||
      0
    );


  const categoryTotal =
    Number(
      official.categoryTotal ||
      0
    );


  const cityPosition =
    Number(
      official.athleteCityPosition ||
      0
    );


  const cityAthletes =
    Number(
      official.athleteCityTotal ||
      0
    );


  const cityTeamPosition =
    Number(
      official.cityPosition ||
      0
    );


  const cityTotal =
    Number(
      official.cityTotal ||
      0
    );


  const beatPct =
    Number(
      comparison.categoryBeatPct ||
      0
    );


  const improvement =
    Number(
      comparison.improvement ||
      0
    );


  const topHalfCount =
    Number(
      comparison.topHalfCount ||
      0
    );


  // ========================================================
  // CONSTRUTOR
  // ========================================================

  const A =
    (
      id,
      group,
      rarity,
      icon,
      title,
      desc,
      ok
    ) => ({

      id,

      group,

      rarity,

      icon,

      title,

      desc,

      ok:
        !!ok

    });


  return [

    // ======================================================
    // 01 — PARTICIPAÇÃO
    // ======================================================

    A(
      'first',
      'PARTICIPAÇÃO',
      'COMUM',
      'fa-flag-checkered',
      'PRIMEIRA LARGADA',
      'Registrou seu primeiro resultado oficial no DH-PE.',
      officialRaces >= 1
    ),

    A(
  'halfSeason',
  'PARTICIPAÇÃO',
  'RARO',
  'fa-road',
  'METADE DA TEMPORADA',
  `Participou de pelo menos ${halfSeasonTarget} das ${officialSeasonTotal} etapas oficiais previstas.`,
  officialSeasonTotal > 0 &&
  officialRaces >=
    halfSeasonTarget
),


    A(
  'seasonVeteran',
  'PARTICIPAÇÃO',
  'ÉPICO',
  'fa-mountain',
  'VETERANO DA TEMPORADA',
  `Participou de pelo menos ${veteranTarget} das ${officialSeasonTotal} etapas oficiais da temporada.`,
  officialSeasonTotal >= 2 &&
  officialRaces >=
    veteranTarget
),

    A(
  'season',
  'PARTICIPAÇÃO',
  'LENDÁRIO',
  'fa-calendar-check',
  'TEMPORADA COMPLETA',
  `Participou das ${officialSeasonTotal} etapas oficiais e concluiu a temporada.`,
  officialSeasonTotal > 0 &&

  season.allClosed &&

  officialRaces ===
    officialSeasonTotal
),

    A(
      'club',
      'PARTICIPAÇÃO',
      'COMUM',
      'fa-crown',
      'MEMBRO DH-CLUB',
      'Faz parte da comunidade DH-Club.',
      hasClubAccess()
    ),


    // ======================================================
    // 02 — CLASSIFICAÇÃO EM ETAPA
    // ======================================================

    A(
      'top20',
      'CLASSIFICAÇÃO',
      'COMUM',
      'fa-ranking-star',
      'TOP 20',
      'Terminou uma etapa entre os 20 melhores da categoria.',
      hasTop(20)
    ),

    A(
      'top15',
      'CLASSIFICAÇÃO',
      'COMUM',
      'fa-ranking-star',
      'TOP 15',
      'Terminou uma etapa entre os 15 melhores da categoria.',
      hasTop(15)
    ),

    A(
      'top10',
      'CLASSIFICAÇÃO',
      'RARO',
      'fa-ranking-star',
      'TOP 10',
      'Entrou no grupo dos 10 melhores da categoria.',
      hasTop(10)
    ),

    A(
      'top6',
      'CLASSIFICAÇÃO',
      'RARO',
      'fa-star',
      'TOP 6',
      'Chegou entre os 6 melhores da categoria.',
      hasTop(6)
    ),

    A(
      'fifth',
      'CLASSIFICAÇÃO',
      'RARO',
      'fa-medal',
      '5º LUGAR',
      'Conquistou o 5º lugar em uma etapa oficial.',
      hasPosition(5)
    ),

    A(
      'fourth',
      'CLASSIFICAÇÃO',
      'RARO',
      'fa-medal',
      '4º LUGAR',
      'Conquistou o 4º lugar em uma etapa oficial.',
      hasPosition(4)
    ),

    A(
      'third',
      'CLASSIFICAÇÃO',
      'ÉPICO',
      'fa-medal',
      '3º LUGAR',
      'Subiu ao 3º lugar em uma etapa oficial.',
      hasPosition(3)
    ),

    A(
      'second',
      'CLASSIFICAÇÃO',
      'ÉPICO',
      'fa-medal',
      '2º LUGAR',
      'Conquistou o 2º lugar em uma etapa oficial.',
      hasPosition(2)
    ),

    A(
      'champion',
      'CLASSIFICAÇÃO',
      'LENDÁRIO',
      'fa-trophy',
      'CAMPEÃO DE ETAPA',
      'Venceu uma etapa oficial da sua categoria.',
      hasPosition(1)
    ),


    // ======================================================
    // 03 — REPETIÇÃO DE BONS RESULTADOS
    // ======================================================

    A(
      'top20x3',
      'CONSISTÊNCIA',
      'COMUM',
      'fa-chart-line',
      'TOP 20 — 3X',
      'Terminou pelo menos 3 etapas no Top 20.',
      countTop(20) >= 3
    ),

    A(
      'top15x3',
      'CONSISTÊNCIA',
      'RARO',
      'fa-chart-line',
      'TOP 15 — 3X',
      'Terminou pelo menos 3 etapas no Top 15.',
      countTop(15) >= 3
    ),

    A(
      'top10x2',
      'CONSISTÊNCIA',
      'RARO',
      'fa-fire',
      'TOP 10 — 2X',
      'Conquistou dois resultados no Top 10.',
      countTop(10) >= 2
    ),

    A(
      'top10x3',
      'CONSISTÊNCIA',
      'ÉPICO',
      'fa-fire',
      'TOP 10 — 3X',
      'Conquistou três resultados no Top 10.',
      countTop(10) >= 3
    ),

    A(
      'top10x5',
      'CONSISTÊNCIA',
      'LENDÁRIO',
      'fa-fire-flame-curved',
      'TOP 10 — 5X',
      'Terminou pelo menos cinco etapas no Top 10.',
      countTop(10) >= 5
    ),

    A(
      'top5x2',
      'CONSISTÊNCIA',
      'RARO',
      'fa-medal',
      'TOP 5 — 2X',
      'Conquistou dois resultados entre os cinco melhores.',
      countTop(5) >= 2
    ),

    A(
      'top5x3',
      'CONSISTÊNCIA',
      'ÉPICO',
      'fa-medal',
      'TOP 5 — 3X',
      'Conquistou três resultados entre os cinco melhores.',
      countTop(5) >= 3
    ),

    A(
      'top5x5',
      'CONSISTÊNCIA',
      'LENDÁRIO',
      'fa-gem',
      'TOP 5 — 5X',
      'Terminou pelo menos cinco etapas dentro do Top 5.',
      countTop(5) >= 5
    ),


    // ======================================================
    // 04 — PÓDIOS E VITÓRIAS
    // ======================================================

    A(
      'podium2',
      'PÓDIOS',
      'RARO',
      'fa-award',
      '2 PÓDIOS',
      'Conquistou pelo menos dois resultados no Top 5.',
      podiums >= 2
    ),

    A(
      'podium3',
      'PÓDIOS',
      'ÉPICO',
      'fa-award',
      '3 PÓDIOS',
      'Conquistou pelo menos três resultados no Top 5.',
      podiums >= 3
    ),

    A(
      'podium5',
      'PÓDIOS',
      'LENDÁRIO',
      'fa-award',
      '5 PÓDIOS',
      'Chegou ao Top 5 em pelo menos cinco etapas.',
      podiums >= 5
    ),

    A(
      'win2',
      'VITÓRIAS',
      'ÉPICO',
      'fa-trophy',
      '2 VITÓRIAS',
      'Venceu duas etapas oficiais.',
      wins >= 2
    ),

    A(
      'win3',
      'VITÓRIAS',
      'ÉPICO',
      'fa-trophy',
      '3 VITÓRIAS',
      'Venceu três etapas oficiais.',
      wins >= 3
    ),

    A(
      'win5',
      'VITÓRIAS',
      'LENDÁRIO',
      'fa-crown',
      'DOMINANTE',
      'Conquistou cinco vitórias oficiais.',
      wins >= 5
    ),

    A(
      'streakTop5x2',
      'CONSISTÊNCIA',
      'ÉPICO',
      'fa-bolt',
      'PÓDIOS SEGUIDOS',
      'Terminou duas etapas consecutivas no Top 5.',
      hasStreakTop(
        5,
        2
      )
    ),


    // ======================================================
    // 05 — CRONÔMETRO
    // ======================================================

    A(
      'sub4',
      'CRONÔMETRO',
      'COMUM',
      'fa-stopwatch',
      'ABAIXO DE 4:00',
      'Registrou uma descida oficial abaixo de 4 minutos.',
      hasTimeBelow(
        240000
      )
    ),

    A(
      'sub330',
      'CRONÔMETRO',
      'COMUM',
      'fa-stopwatch',
      'ABAIXO DE 3:30',
      'Registrou uma descida oficial abaixo de 3 minutos e 30 segundos.',
      hasTimeBelow(
        210000
      )
    ),

    A(
      'sub3',
      'CRONÔMETRO',
      'RARO',
      'fa-stopwatch',
      'ABAIXO DE 3:00',
      'Registrou uma descida oficial abaixo de 3 minutos.',
      hasTimeBelow(
        180000
      )
    ),

    A(
      'sub245',
      'CRONÔMETRO',
      'RARO',
      'fa-gauge-high',
      'ABAIXO DE 2:45',
      'Registrou uma descida oficial abaixo de 2 minutos e 45 segundos.',
      hasTimeBelow(
        165000
      )
    ),

    A(
      'sub230',
      'CRONÔMETRO',
      'ÉPICO',
      'fa-bolt',
      'ABAIXO DE 2:30',
      'Registrou uma descida oficial abaixo de 2 minutos e 30 segundos.',
      hasTimeBelow(
        150000
      )
    ),

    A(
      'sub215',
      'CRONÔMETRO',
      'ÉPICO',
      'fa-gauge-high',
      'ABAIXO DE 2:15',
      'Registrou uma descida oficial abaixo de 2 minutos e 15 segundos.',
      hasTimeBelow(
        135000
      )
    ),

    A(
      'sub2',
      'CRONÔMETRO',
      'LENDÁRIO',
      'fa-gauge-high',
      'ABAIXO DE 2:00',
      'Registrou uma descida oficial abaixo de 2 minutos.',
      hasTimeBelow(
        120000
      )
    ),


    // ======================================================
    // 06 — PONTUAÇÃO OFICIAL
    // ======================================================

    A(
  'pointsFirst',
  'PONTOS',
  'COMUM',
  'fa-coins',
  'PRIMEIROS PONTOS',
  'Conquistou seus primeiros pontos oficiais no DH-PE.',
  totalPts > 0
),


A(
  'points25',
  'PONTOS',
  'COMUM',
  'fa-coins',
  '25% DA PONTUAÇÃO MÁXIMA',
  `Alcançou pelo menos 25% dos ${maxSeasonPoints} pontos máximos possíveis da temporada.`,
  maxSeasonPoints > 0 &&
  totalPts >=
    Math.ceil(
      maxSeasonPoints *
      0.25
    )
),


A(
  'points50',
  'PONTOS',
  'RARO',
  'fa-coins',
  'METADE DOS PONTOS',
  `Alcançou pelo menos 50% dos ${maxSeasonPoints} pontos máximos possíveis da temporada.`,
  maxSeasonPoints > 0 &&
  totalPts >=
    Math.ceil(
      maxSeasonPoints *
      0.50
    )
),


A(
  'points75',
  'PONTOS',
  'ÉPICO',
  'fa-sack-dollar',
  '75% DA PONTUAÇÃO MÁXIMA',
  `Alcançou pelo menos 75% dos ${maxSeasonPoints} pontos máximos possíveis da temporada.`,
  maxSeasonPoints > 0 &&
  totalPts >=
    Math.ceil(
      maxSeasonPoints *
      0.75
    )
),


A(
  'points90',
  'PONTOS',
  'ÉPICO',
  'fa-gem',
  'CAMPANHA DE ELITE',
  `Alcançou pelo menos 90% dos ${maxSeasonPoints} pontos máximos possíveis da temporada.`,
  maxSeasonPoints > 0 &&
  totalPts >=
    Math.ceil(
      maxSeasonPoints *
      0.90
    )
),


A(
  'pointsPerfect',
  'PONTOS',
  'LENDÁRIO',
  'fa-crown',
  'PONTUAÇÃO PERFEITA',
  `Alcançou a pontuação máxima possível da temporada: ${maxSeasonPoints} pontos.`,
  maxSeasonPoints > 0 &&
  season.allClosed &&
  totalPts >=
    maxSeasonPoints
),


    // ======================================================
    // 07 — RANKING OFICIAL DA CATEGORIA
    // ======================================================

    A(
      'rankCat20',
      'RANKING',
      'COMUM',
      'fa-list-ol',
      'TOP 20 DO RANKING',
      'Chegou ao Top 20 do ranking oficial da categoria.',
      categoryPosition > 0 &&
      categoryPosition <= 20
    ),

    A(
      'rankCat10',
      'RANKING',
      'RARO',
      'fa-list-ol',
      'TOP 10 DO RANKING',
      'Chegou ao Top 10 do ranking oficial da categoria.',
      categoryPosition > 0 &&
      categoryPosition <= 10
    ),

    A(
      'rankCat5',
      'RANKING',
      'ÉPICO',
      'fa-ranking-star',
      'TOP 5 DO RANKING',
      'Chegou ao Top 5 do ranking oficial da categoria.',
      categoryPosition > 0 &&
      categoryPosition <= 5
    ),

    A(
      'rankCat3',
      'RANKING',
      'ÉPICO',
      'fa-ranking-star',
      'TOP 3 DO RANKING',
      'Chegou ao Top 3 do ranking oficial da categoria.',
      categoryPosition > 0 &&
      categoryPosition <= 3
    ),

    A(
      'rankCat1',
      'RANKING',
      'LENDÁRIO',
      'fa-crown',
      'LÍDER DA CATEGORIA',
      'Assumiu a 1ª posição do ranking oficial da categoria.',
      categoryPosition === 1 &&
      categoryTotal > 0
    ),


    // ======================================================
    // 08 — CIDADE
    // ======================================================

    A(
      'cityTop5',
      'CIDADE',
      'RARO',
      'fa-location-dot',
      'TOP 5 DA CIDADE',
      'Está entre os cinco atletas com mais pontos da sua cidade.',
      cityPosition > 0 &&
      cityPosition <= 5 &&
      cityAthletes >= 2
    ),

    A(
      'cityTop3',
      'CIDADE',
      'ÉPICO',
      'fa-city',
      'TOP 3 DA CIDADE',
      'Está entre os três atletas com mais pontos da sua cidade.',
      cityPosition > 0 &&
      cityPosition <= 3 &&
      cityAthletes >= 2
    ),

    A(
      'city1',
      'CIDADE',
      'LENDÁRIO',
      'fa-location-crosshairs',
      'Nº 1 DA CIDADE',
      'É o atleta com maior pontuação oficial da sua cidade.',
      cityPosition === 1 &&
      cityAthletes >= 2
    ),

    A(
      'cityTeamTop3',
      'CIDADE',
      'ÉPICO',
      'fa-people-group',
      'CIDADE NO TOP 3',
      'Sua cidade está entre as três cidades com maior pontuação somada.',
      cityTeamPosition > 0 &&
      cityTeamPosition <= 3 &&
      cityTotal >= 2
    ),


    // ======================================================
    // 09 — EVOLUÇÃO DH-CLUB
    // ======================================================

    A(
      'half3',
      'EVOLUÇÃO',
      'RARO',
      'fa-chart-simple',
      'METADE SUPERIOR — 3X',
      'Terminou pelo menos três etapas na metade superior da categoria.',
      topHalfCount >= 3
    ),

    A(
      'beat50',
      'EVOLUÇÃO',
      'COMUM',
      'fa-arrow-trend-up',
      'À FRENTE DE 50%',
      'Ficou comparativamente à frente de pelo menos metade da categoria.',
      beatPct >= 50
    ),

    A(
      'beat75',
      'EVOLUÇÃO',
      'RARO',
      'fa-arrow-trend-up',
      'À FRENTE DE 75%',
      'Ficou comparativamente à frente de 75% da categoria.',
      beatPct >= 75
    ),

    A(
      'beat90',
      'EVOLUÇÃO',
      'LENDÁRIO',
      'fa-rocket',
      'TOP 10% DA CATEGORIA',
      'Ficou comparativamente à frente de 90% dos atletas da categoria.',
      beatPct >= 90
    ),

    A(
      'improve5',
      'EVOLUÇÃO',
      'RARO',
      'fa-arrow-up-right-dots',
      'EVOLUÇÃO +5',
      'Melhorou pelo menos 5 pontos no índice relativo durante a temporada.',
      improvement >= 5
    ),

    A(
      'improve10',
      'EVOLUÇÃO',
      'ÉPICO',
      'fa-arrow-up-right-dots',
      'EVOLUÇÃO +10',
      'Melhorou pelo menos 10 pontos no índice relativo durante a temporada.',
      improvement >= 10
    )

  ];
}

// ==========================================================
// JORNADA ANUAL — DH-CLUB
// ==========================================================

function annualGoalPercent(
  current,
  target
) {

  if (
    !target ||
    target <= 0
  ) {

    return 0;
  }


  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (
          Number(current || 0) /
          Number(target)
        ) * 100
      )
    )
  );
}


// ==========================================================
// PROGRESSO DAS METAS DE TEMPO
// ==========================================================

function annualTimeProgress(
  best,
  target
) {

  if (
    !Number.isFinite(
      best
    )
  ) {

    return 0;
  }


  if (
    best <= target
  ) {

    return 100;
  }


  // Base de início para cálculo visual:
  // 4 minutos
  const start =
    240000;


  if (
    best >= start
  ) {

    return 0;
  }


  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (
          (
            start -
            best
          ) /
          (
            start -
            target
          )
        ) * 100
      )
    )
  );
}


// ==========================================================
// METAS DA TEMPORADA
// ==========================================================

function annualGoals() {

  const stats =
    careerStats();


  const comparison =
    mySeasonComparison();


  const positions =
    stats.results
      .map(
        result =>
          resultPlacement(
            result
          )
      )
      .filter(
        position =>
          Number.isFinite(
            Number(position)
          )
      )
      .map(Number);


  const countTop =
    limit =>
      positions.filter(
        position =>
          position <= limit
      ).length;


  const victories =
    positions.filter(
      position =>
        position === 1
    ).length;


  const season =
  officialSeasonProgress();


const totalEvents =
  Math.max(
    1,
    season.total
  );


const officialRaces =
  season.completed;


  const best =
    stats.best;


  const categoryBeat =
    Math.round(
      comparison?.categoryBeatPct ||
      0
    );


  const topHalf =
    Number(
      comparison?.topHalfCount ||
      0
    );


  return [

    // ======================================================
    // PARTICIPAÇÃO
    // ======================================================

    {
  id:
    'annual-half-season',

  icon:
    'fa-flag-checkered',

  title:
    'METADE DA TEMPORADA',

  desc:
    `Participe de pelo menos ${season.halfTarget} das ${season.total} etapas oficiais.`,

  current:
    officialRaces,

  target:
    season.halfTarget,

  currentLabel:
    `${officialRaces}/${season.halfTarget} etapas`,

  progress:
    annualGoalPercent(
      officialRaces,
      season.halfTarget
    ),

  done:
    season.total > 0 &&
    officialRaces >=
      season.halfTarget
},


{
  id:
    'annual-season',

  icon:
    'fa-calendar-check',

  title:
    'TEMPORADA PRESENTE',

  desc:
    `Participe das ${totalEvents} etapas oficiais pontuáveis da temporada.`,

  current:
    officialRaces,

  target:
    totalEvents,

  currentLabel:
    `${officialRaces}/${totalEvents} etapas`,

  progress:
    annualGoalPercent(
      officialRaces,
      totalEvents
    ),

  done:
    season.allClosed &&
    season.total > 0 &&
    officialRaces >=
      season.total
},


    // ======================================================
    // CLASSIFICAÇÃO
    // ======================================================

    {
      id:
        'annual-top20',

      icon:
        'fa-ranking-star',

      title:
        'ENTRAR NO TOP 20',

      desc:
        'Finalize pelo menos uma etapa entre os 20 melhores da sua categoria.',

      current:
        countTop(20),

      target:
        1,

      currentLabel:
        `${countTop(20)}/1`,

      progress:
        annualGoalPercent(
          countTop(20),
          1
        ),

      done:
        countTop(20) >= 1
    },


    {
      id:
        'annual-top10',

      icon:
        'fa-ranking-star',

      title:
        'ENTRAR NO TOP 10',

      desc:
        'Conquiste pelo menos um resultado oficial dentro do Top 10.',

      current:
        countTop(10),

      target:
        1,

      currentLabel:
        `${countTop(10)}/1`,

      progress:
        annualGoalPercent(
          countTop(10),
          1
        ),

      done:
        countTop(10) >= 1
    },


    {
      id:
        'annual-top5-3',

      icon:
        'fa-medal',

      title:
        '3 RESULTADOS TOP 5',

      desc:
        'Termine três etapas diferentes entre os cinco melhores.',

      current:
        countTop(5),

      target:
        3,

      currentLabel:
        `${countTop(5)}/3 Top 5`,

      progress:
        annualGoalPercent(
          countTop(5),
          3
        ),

      done:
        countTop(5) >= 3
    },


    {
      id:
        'annual-podium',

      icon:
        'fa-medal',

      title:
        'PÓDIO — TOP 3',

      desc:
        'Conquiste pelo menos um resultado entre os três primeiros.',

      current:
        countTop(3),

      target:
        1,

      currentLabel:
        `${countTop(3)}/1 pódio`,

      progress:
        annualGoalPercent(
          countTop(3),
          1
        ),

      done:
        countTop(3) >= 1
    },


    {
      id:
        'annual-win',

      icon:
        'fa-trophy',

      title:
        'VENCER UMA ETAPA',

      desc:
        'Conquiste uma vitória oficial na sua categoria.',

      current:
        victories,

      target:
        1,

      currentLabel:
        `${victories}/1 vitória`,

      progress:
        annualGoalPercent(
          victories,
          1
        ),

      done:
        victories >= 1
    },


    // ======================================================
    // TEMPO
    // ======================================================

    {
      id:
        'annual-sub3',

      icon:
        'fa-stopwatch',

      title:
        'QUEBRAR 3:00',

      desc:
        'Registre uma descida oficial abaixo de 3 minutos.',

      current:
        best,

      target:
        180000,

      currentLabel:
        Number.isFinite(best)
          ? bestTimeLabel(best)
          : '--:--.---',

      targetLabel:
        'META 02:59.999',

      progress:
        annualTimeProgress(
          best,
          180000
        ),

      done:
        Number.isFinite(best) &&
        best < 180000
    },


    {
      id:
        'annual-sub230',

      icon:
        'fa-bolt',

      title:
        'QUEBRAR 2:30',

      desc:
        'Registre uma descida oficial abaixo de 2 minutos e 30 segundos.',

      current:
        best,

      target:
        150000,

      currentLabel:
        Number.isFinite(best)
          ? bestTimeLabel(best)
          : '--:--.---',

      targetLabel:
        'META 02:29.999',

      progress:
        annualTimeProgress(
          best,
          150000
        ),

      done:
        Number.isFinite(best) &&
        best < 150000
    },


    // ======================================================
    // CONSISTÊNCIA
    // ======================================================

    {
      id:
        'annual-top-half',

      icon:
        'fa-chart-line',

      title:
        'METADE SUPERIOR 3X',

      desc:
        'Termine pelo menos três etapas na metade superior da sua categoria.',

      current:
        topHalf,

      target:
        3,

      currentLabel:
        `${topHalf}/3 etapas`,

      progress:
        annualGoalPercent(
          topHalf,
          3
        ),

      done:
        topHalf >= 3
    },


    // ======================================================
    // DESEMPENHO NA CATEGORIA
    // ======================================================

    {
      id:
        'annual-beat50',

      icon:
        'fa-arrow-trend-up',

      title:
        'SUPERAR 50% DA CATEGORIA',

      desc:
        'Fique comparativamente à frente de pelo menos metade dos atletas da categoria.',

      current:
        categoryBeat,

      target:
        50,

      currentLabel:
        `${categoryBeat}%`,

      progress:
        annualGoalPercent(
          categoryBeat,
          50
        ),

      done:
        categoryBeat >= 50
    },


    {
      id:
        'annual-beat75',

      icon:
        'fa-fire',

      title:
        'SUPERAR 75% DA CATEGORIA',

      desc:
        'Chegue ao grupo superior da sua categoria na classificação comparativa DH-Club.',

      current:
        categoryBeat,

      target:
        75,

      currentLabel:
        `${categoryBeat}%`,

      progress:
        annualGoalPercent(
          categoryBeat,
          75
        ),

      done:
        categoryBeat >= 75
    }

  ];
}


// ==========================================================
// CARD DA META ANUAL
// ==========================================================

function annualGoalCard(
  goal
) {

  const progress =
    Math.max(
      0,
      Math.min(
        100,
        Number(
          goal.progress ||
          0
        )
      )
    );


  return `

    <div
      class="premium-card"
      style="
        padding:16px;
        margin-bottom:10px;
      "
    >

      <div
        style="
          display:flex;
          align-items:flex-start;
          gap:12px;
        "
      >

        <div
          style="
            width:42px;
            height:42px;
            flex-shrink:0;
            border-radius:13px;
            display:flex;
            align-items:center;
            justify-content:center;
            background:${
              goal.done
                ? 'rgba(255,199,44,.13)'
                : 'rgba(255,255,255,.055)'
            };
            color:${
              goal.done
                ? 'var(--gold2)'
                : 'var(--muted)'
            };
            border:1px solid ${
              goal.done
                ? 'rgba(255,199,44,.28)'
                : 'rgba(255,255,255,.08)'
            };
          "
        >

          <i
            class="
              fa-solid
              ${goal.icon}
            "
          ></i>

        </div>


        <div
          style="
            flex:1;
            min-width:0;
          "
        >

          <div
            style="
              display:flex;
              align-items:flex-start;
              justify-content:space-between;
              gap:8px;
            "
          >

            <b
              style="
                font-size:11px;
                color:${
                  goal.done
                    ? 'var(--gold2)'
                    : 'white'
                };
              "
            >

              ${esc(goal.title)}

            </b>


            <span
              class="
                tag
                ${goal.done ? 'gold' : ''}
              "
            >

              ${
                goal.done
                  ? 'CONCLUÍDA'
                  : `${progress}%`
              }

            </span>

          </div>


          <div
            style="
              font-size:9px;
              color:var(--muted);
              line-height:1.45;
              margin-top:6px;
            "
          >

            ${esc(goal.desc)}

          </div>


          <div
            style="
              display:flex;
              justify-content:space-between;
              gap:10px;
              margin-top:12px;
              font-size:9px;
              font-weight:900;
            "
          >

            <span
              style="
                color:white;
              "
            >

              ${esc(
                goal.currentLabel ||
                goal.current
              )}

            </span>


            ${
              goal.targetLabel

                ? `

                  <span
                    style="
                      color:var(--muted);
                    "
                  >

                    ${esc(
                      goal.targetLabel
                    )}

                  </span>

                `

                : ''
            }

          </div>


          <div
            style="
              width:100%;
              height:8px;
              border-radius:20px;
              overflow:hidden;
              margin-top:8px;
              background:rgba(255,255,255,.08);
            "
          >

            <div
              style="
                width:${progress}%;
                height:100%;
                border-radius:20px;
                background:${
                  goal.done
                    ? 'linear-gradient(90deg,#ffc72c,#ffe17b)'
                    : 'linear-gradient(90deg,#1e6fff,#35d48a)'
                };
                transition:width .4s ease;
              "
            ></div>

          </div>

        </div>

      </div>

    </div>

  `;
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


  const officialRanking =
    typeof myOfficialRankingData === 'function'

      ? myOfficialRankingData()

      : null;


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
        RANKING OFICIAL
      </h3>

      <span>
        PONTUAÇÃO DH-PE
      </span>

    </div>


    <div
      class="premium-card"
      style="
        position:relative;
        overflow:hidden;
      "
    >

      <div
        style="
          position:absolute;
          width:150px;
          height:150px;
          border-radius:50%;
          background:rgba(255,199,44,.08);
          right:-60px;
          top:-70px;
          pointer-events:none;
        "
      ></div>


      <div
        style="
          font-size:9px;
          letter-spacing:1.6px;
          color:var(--gold2);
          font-weight:900;
          margin-bottom:7px;
        "
      >
        PONTUAÇÃO OFICIAL ${SYSTEM_YEAR}
      </div>


      <div
        style="
          display:flex;
          align-items:flex-end;
          gap:7px;
          margin-bottom:5px;
        "
      >

        <div
          style="
            font-size:46px;
            line-height:1;
            font-weight:1000;
            color:white;
          "
        >
          ${
            officialRanking
              ?.totalPts ||
            0
          }
        </div>


        <div
          style="
            font-size:12px;
            font-weight:900;
            color:var(--gold2);
            padding-bottom:5px;
          "
        >
          PTS
        </div>

      </div>


      <div
        style="
          font-size:10px;
          color:var(--muted);
          margin-bottom:17px;
        "
      >
        Pontuação acumulada no
        ranking oficial do campeonato.
      </div>


      <div
        style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:9px;
        "
      >


        <!-- CATEGORIA -->

        <div
          style="
            background:rgba(255,199,44,.07);
            border:1px solid rgba(255,199,44,.18);
            border-radius:15px;
            padding:13px;
          "
        >

          <div
            style="
              font-size:8px;
              color:var(--muted);
              font-weight:900;
              letter-spacing:.8px;
            "
          >
            NA CATEGORIA
          </div>


          <div
            style="
              margin-top:5px;
              font-size:23px;
              font-weight:1000;
              color:var(--gold2);
            "
          >
            ${
              officialRanking
                ?.categoryPosition
                ? `${officialRanking.categoryPosition}º`
                : '—'
            }
          </div>


          <div
            style="
              margin-top:3px;
              font-size:9px;
              color:var(--muted);
            "
          >
            de
            ${
              officialRanking
                ?.categoryTotal ||
              0
            }
            atletas
          </div>

        </div>


        <!-- GERAL -->

        <div
          style="
            background:rgba(255,255,255,.04);
            border:1px solid rgba(255,255,255,.08);
            border-radius:15px;
            padding:13px;
          "
        >

          <div
            style="
              font-size:8px;
              color:var(--muted);
              font-weight:900;
              letter-spacing:.8px;
            "
          >
            RANKING GERAL
          </div>


          <div
            style="
              margin-top:5px;
              font-size:23px;
              font-weight:1000;
              color:white;
            "
          >
            ${
              officialRanking
                ?.generalPosition
                ? `${officialRanking.generalPosition}º`
                : '—'
            }
          </div>


          <div
            style="
              margin-top:3px;
              font-size:9px;
              color:var(--muted);
            "
          >
            de
            ${
              officialRanking
                ?.generalTotal ||
              0
            }
            registros
          </div>

        </div>


        <!-- PONTOS OFICIAL -->

        <div
          style="
            background:rgba(49,208,124,.06);
            border:1px solid rgba(49,208,124,.15);
            border-radius:15px;
            padding:13px;
          "
        >

          <div
            style="
              font-size:8px;
              color:var(--muted);
              font-weight:900;
              letter-spacing:.8px;
            "
          >
            DESCIDA OFICIAL
          </div>


          <div
            style="
              margin-top:5px;
              font-size:20px;
              font-weight:1000;
              color:var(--green);
            "
          >
            ${
              officialRanking
                ?.officialPts ||
              0
            }
            pts
          </div>

        </div>


        <!-- PONTOS QUALIFY -->

        <div
          style="
            background:rgba(100,120,255,.06);
            border:1px solid rgba(100,120,255,.15);
            border-radius:15px;
            padding:13px;
          "
        >

          <div
            style="
              font-size:8px;
              color:var(--muted);
              font-weight:900;
              letter-spacing:.8px;
            "
          >
            CLASSIFICATÓRIA
          </div>


          <div
            style="
              margin-top:5px;
              font-size:20px;
              font-weight:1000;
              color:#8fa5ff;
            "
          >
            ${
              officialRanking
                ?.qualifyPts ||
              0
            }
            pts
          </div>

        </div>

      </div>


      <!-- ================================================= -->
      <!-- CIDADE -->
      <!-- ================================================= -->

      <div
        style="
          height:1px;
          background:rgba(255,255,255,.08);
          margin:18px 0;
        "
      ></div>


      <div
        style="
          display:flex;
          align-items:center;
          gap:10px;
          margin-bottom:13px;
        "
      >

        <div
          style="
            width:39px;
            height:39px;
            border-radius:12px;
            display:flex;
            align-items:center;
            justify-content:center;
            background:rgba(255,199,44,.10);
            color:var(--gold2);
            flex-shrink:0;
          "
        >
          <i class="fa-solid fa-location-dot"></i>
        </div>


        <div>

          <div
            style="
              font-size:8px;
              color:var(--muted);
              font-weight:900;
              letter-spacing:1px;
            "
          >
            REPRESENTANDO
          </div>


          <div
            style="
              font-size:15px;
              color:white;
              font-weight:1000;
              margin-top:3px;
            "
          >
            ${esc(
              officialRanking?.city ||
              loggedUser.city ||
              'CIDADE NÃO INFORMADA'
            )}
          </div>

        </div>

      </div>


      <div
        style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:9px;
        "
      >


        <!-- ATLETA NA CIDADE -->

        <div
          style="
            background:rgba(255,255,255,.04);
            border-radius:15px;
            padding:13px;
          "
        >

          <div
            style="
              font-size:8px;
              color:var(--muted);
              font-weight:900;
            "
          >
            ENTRE ATLETAS DA CIDADE
          </div>


          <div
            style="
              font-size:21px;
              font-weight:1000;
              color:var(--gold2);
              margin-top:5px;
            "
          >
            ${
              officialRanking
                ?.athleteCityPosition
                ? `${officialRanking.athleteCityPosition}º`
                : '—'
            }
          </div>


          <div
            style="
              font-size:9px;
              color:var(--muted);
              margin-top:3px;
            "
          >
            de
            ${
              officialRanking
                ?.athleteCityTotal ||
              0
            }
            atletas
          </div>

        </div>


        <!-- CIDADE NO CAMPEONATO -->

        <div
          style="
            background:rgba(255,255,255,.04);
            border-radius:15px;
            padding:13px;
          "
        >

          <div
            style="
              font-size:8px;
              color:var(--muted);
              font-weight:900;
            "
          >
            POSIÇÃO DA CIDADE
          </div>


          <div
            style="
              font-size:21px;
              font-weight:1000;
              color:white;
              margin-top:5px;
            "
          >
            ${
              officialRanking
                ?.cityPosition
                ? `${officialRanking.cityPosition}º`
                : '—'
            }
          </div>


          <div
            style="
              font-size:9px;
              color:var(--muted);
              margin-top:3px;
            "
          >
            de
            ${
              officialRanking
                ?.cityTotal ||
              0
            }
            cidades
          </div>

        </div>

      </div>


      <div
        style="
          margin-top:10px;
          padding:13px;
          border-radius:15px;
          background:linear-gradient(
            135deg,
            rgba(255,199,44,.12),
            rgba(255,199,44,.03)
          );
          border:1px solid rgba(255,199,44,.18);
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:10px;
        "
      >

        <div>

          <div
            style="
              font-size:8px;
              font-weight:900;
              color:var(--muted);
            "
          >
            PONTOS SOMADOS PELA CIDADE
          </div>


          <div
            style="
              font-size:9px;
              color:var(--muted);
              margin-top:3px;
            "
          >
            ${
              officialRanking
                ?.cityAthleteCount ||
              0
            }
            atleta(s) pontuador(es)
          </div>

        </div>


        <div
          style="
            font-size:22px;
            font-weight:1000;
            color:var(--gold2);
            white-space:nowrap;
          "
        >
          ${
            officialRanking
              ?.cityPoints ||
            0
          }
          pts
        </div>

      </div>


      <div
        style="
          margin-top:12px;
          font-size:8px;
          line-height:1.5;
          color:var(--muted);
        "
      >
        * Estes dados utilizam a pontuação
        configurada oficialmente em cada etapa
        do DH-PE.
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

// ==========================================================
// FILTROS E RARIDADE DAS CONQUISTAS
// ==========================================================

function achievementRarityInfo(
  rarity
) {

  const value =
    String(
      rarity ||
      'COMUM'
    )
      .toUpperCase();


  const map = {

    COMUM: {
      label: 'COMUM',
      color: '#aeb8c6',
      bg: 'rgba(174,184,198,.09)',
      border: 'rgba(174,184,198,.20)'
    },

    RARO: {
      label: 'RARO',
      color: '#55a7ff',
      bg: 'rgba(37,132,255,.10)',
      border: 'rgba(37,132,255,.28)'
    },

    'ÉPICO': {
      label: 'ÉPICO',
      color: '#bf78ff',
      bg: 'rgba(174,79,255,.11)',
      border: 'rgba(174,79,255,.30)'
    },

    LENDÁRIO: {
      label: 'LENDÁRIO',
      color: '#ffc72c',
      bg: 'rgba(255,199,44,.11)',
      border: 'rgba(255,199,44,.30)'
    }

  };


  return (
    map[value] ||
    map.COMUM
  );
}


  // ==========================================================
// XP DAS CONQUISTAS — DH-CLUB
// ==========================================================

function achievementXpValue(
  rarity
) {

  const value =
    String(
      rarity ||
      'COMUM'
    )
      .toUpperCase();


  const xpMap = {

    COMUM:
      20,

    RARO:
      50,

    'ÉPICO':
      100,

    LENDÁRIO:
      200

  };


  return (
    xpMap[value] ||
    20
  );
}


// ==========================================================
// PERFIL DE XP / NÍVEL DO ATLETA
// ==========================================================

function athleteXpProfile(
  list
) {

  const achievementsList =
    Array.isArray(list)
      ? list
      : [];


  const xp =
    achievementsList
      .filter(
        item =>
          item.ok
      )
      .reduce(
        (
          total,
          item
        ) =>
          total +
          achievementXpValue(
            item.rarity
          ),
        0
      );


  const maxXp =
    achievementsList
      .reduce(
        (
          total,
          item
        ) =>
          total +
          achievementXpValue(
            item.rarity
          ),
        0
      );


  // Cada nível exige 250 XP.
  const XP_PER_LEVEL =
    250;


  const level =
    Math.floor(
      xp /
      XP_PER_LEVEL
    ) + 1;


  const currentLevelXp =
    xp %
    XP_PER_LEVEL;


  const levelProgress =
    Math.round(
      (
        currentLevelXp /
        XP_PER_LEVEL
      ) * 100
    );


  const xpToNext =
    XP_PER_LEVEL -
    currentLevelXp;


  const maxLevel =
    Math.floor(
      maxXp /
      XP_PER_LEVEL
    ) + 1;


  let rank =
    'BRONZE';


  let color =
    '#b8865b';


  let icon =
    'fa-shield';


  if (
    level >= 4
  ) {

    rank =
      'PRATA';

    color =
      '#c4ceda';
  }


  if (
    level >= 7
  ) {

    rank =
      'OURO';

    color =
      '#ffc72c';

    icon =
      'fa-medal';
  }


  if (
    level >= 11
  ) {

    rank =
      'ELITE';

    color =
      '#bf78ff';

    icon =
      'fa-crown';
  }


  return {

    xp,

    maxXp,

    level,

    maxLevel,

    currentLevelXp,

    levelProgress,

    xpToNext,

    rank,

    color,

    icon

  };
}
  

// ==========================================================
// TROCA O FILTRO
// ==========================================================

function setAchievementFilter(
  group
) {

  achievementFilter =
    group ||
    'TODAS';


  renderAchievements();
}


// ==========================================================
// CARD DE CONQUISTA
// ==========================================================

function achievementCollectionCard(
  item
) {

  const rarity =
    achievementRarityInfo(
      item.rarity
    );

  const xpValue =
  achievementXpValue(
    item.rarity
  );

  return `

    <div
      class="
        achievement
        ${
          item.ok
            ? ''
            : 'locked'
        }
      "
      style="
        position:relative;
        overflow:hidden;
        border-color:${
          item.ok
            ? rarity.border
            : 'rgba(255,255,255,.07)'
        };
      "
    >

      <!-- RARIDADE -->

      <div
        style="
          position:absolute;
          top:9px;
          right:9px;
          padding:4px 7px;
          border-radius:20px;
          font-size:6px;
          font-weight:1000;
          letter-spacing:.8px;
          color:${
            item.ok
              ? rarity.color
              : '#687587'
          };
          background:${
            item.ok
              ? rarity.bg
              : 'rgba(255,255,255,.04)'
          };
          border:1px solid ${
            item.ok
              ? rarity.border
              : 'rgba(255,255,255,.06)'
          };
        "
      >

        ${rarity.label}

      </div>


      <!-- MEDALHA -->

      <div
        class="medal"
        style="
          color:${
            item.ok
              ? rarity.color
              : ''
          };
        "
      >

        <i
          class="
            fa-solid
            ${item.icon}
          "
        ></i>

      </div>


      <!-- GRUPO -->

      <div
        style="
          margin-top:10px;
          margin-bottom:5px;
          font-size:6px;
          letter-spacing:1px;
          font-weight:900;
          color:var(--muted);
        "
      >

        ${esc(
          item.group ||
          'GERAL'
        )}

      </div>


      <!-- TÍTULO -->

      <b>
        ${esc(item.title)}
      </b>


      <!-- DESCRIÇÃO -->

      <small>
        ${esc(item.desc)}
      </small>


      <div
  style="
    margin-top:12px;
    display:flex;
    gap:6px;
    flex-wrap:wrap;
    align-items:center;
  "
>

  <span
    class="
      tag
      ${
        item.ok
          ? 'gold'
          : ''
      }
    "
    style="
      ${
        item.ok
          ? `
            color:${rarity.color};
            background:${rarity.bg};
            border-color:${rarity.border};
          `
          : ''
      }
    "
  >

    ${
      item.ok
        ? 'DESBLOQUEADA'
        : 'BLOQUEADA'
    }

  </span>


  <span
    class="tag"
    style="
      color:${
        item.ok
          ? rarity.color
          : '#718096'
      };
      background:rgba(
        255,
        255,
        255,
        .04
      );
      border-color:rgba(
        255,
        255,
        255,
        .08
      );
    "
  >

    +${xpValue} XP

  </span>

</div>

    </div>

  `;
}
  
function renderAchievements() {

  const achievementsList =
    achievements();


  const unlocked =
    achievementsList.filter(
      item =>
        item.ok
    ).length;


  const xpProfile =
  athleteXpProfile(
    achievementsList
  );
  
  
  const goals =
    annualGoals();


  const completedGoals =
    goals.filter(
      goal =>
        goal.done
    ).length;


  const annualPct =
    goals.length

      ? Math.round(
          (
            completedGoals /
            goals.length
          ) * 100
        )

      : 0;

  // ========================================================
  // GRUPOS DE CONQUISTAS
  // ========================================================

  const groupOrder = [

    'PARTICIPAÇÃO',

    'CLASSIFICAÇÃO',

    'CONSISTÊNCIA',

    'PÓDIOS',

    'VITÓRIAS',

    'CRONÔMETRO',

    'PONTOS',

    'RANKING',

    'CIDADE',

    'EVOLUÇÃO'

  ];


  const availableGroups =
    groupOrder.filter(
      group =>
        achievementsList.some(
          item =>
            item.group === group
        )
    );


  const filteredAchievements =
    achievementFilter ===
      'TODAS'

      ? achievementsList

      : achievementsList.filter(
          item =>
            item.group ===
            achievementFilter
        );


  const filteredUnlocked =
    filteredAchievements.filter(
      item =>
        item.ok
    ).length;


  const filtersHtml =
    [
      'TODAS',
      ...availableGroups
    ]
      .map(
        group => `

          <button

            onclick="
              Club.setAchievementFilter(
                '${group}'
              )
            "

            style="
              border:1px solid ${
                achievementFilter === group
                  ? 'rgba(255,199,44,.50)'
                  : 'rgba(255,255,255,.08)'
              };

              background:${
                achievementFilter === group
                  ? 'rgba(255,199,44,.13)'
                  : 'rgba(255,255,255,.04)'
              };

              color:${
                achievementFilter === group
                  ? '#ffc72c'
                  : '#9ba8bb'
              };

              padding:9px 12px;
              border-radius:30px;
              font-size:8px;
              font-weight:1000;
              letter-spacing:.7px;
              white-space:nowrap;
              cursor:pointer;
            "
          >

            ${group}

          </button>

        `
      )
      .join('');
  
  document
    .getElementById(
      'view-achievements'
    )
    .innerHTML = `

    <div class="hero">

      <div class="eyebrow">
        EVOLUÇÃO DO ATLETA
      </div>


      <h2>
        Conquistas
      </h2>


      <p>

        Acompanhe suas metas,
        evolução e troféus
        durante a temporada.

      </p>


      <div class="member-chip">

        <i
          class="
            fa-solid
            fa-trophy
          "
        ></i>

        JORNADA ${SYSTEM_YEAR}

      </div>

    </div>


    <!-- ================================================= -->
    <!-- NÍVEL DO ATLETA -->
    <!-- ================================================= -->

    <div class="section-title">

      <h3>
        NÍVEL DO ATLETA
      </h3>

      <span>
        XP DH-CLUB
      </span>

    </div>


    <div
      class="premium-card"
      style="
        margin-bottom:16px;
        position:relative;
        overflow:hidden;
      "
    >

      <div
        style="
          position:absolute;
          width:170px;
          height:170px;
          border-radius:50%;
          right:-75px;
          top:-85px;
          background:${
            xpProfile.color
          }18;
          pointer-events:none;
        "
      ></div>


      <div
        style="
          display:flex;
          align-items:center;
          gap:14px;
        "
      >

        <div
          style="
            width:65px;
            height:65px;
            border-radius:19px;
            display:flex;
            align-items:center;
            justify-content:center;
            background:${
              xpProfile.color
            }14;
            border:1px solid ${
              xpProfile.color
            }44;
            color:${
              xpProfile.color
            };
            font-size:25px;
            flex-shrink:0;
          "
        >

          <i
            class="
              fa-solid
              ${xpProfile.icon}
            "
          ></i>

        </div>


        <div
          style="
            flex:1;
            min-width:0;
          "
        >

          <div
            style="
              font-size:8px;
              letter-spacing:1.5px;
              color:var(--muted);
              font-weight:900;
            "
          >
            CLASSIFICAÇÃO DH-CLUB
          </div>


          <div
            style="
              font-size:24px;
              font-weight:1000;
              color:${
                xpProfile.color
              };
              margin-top:3px;
            "
          >

            ${xpProfile.rank}

          </div>


          <div
            style="
              font-size:10px;
              color:white;
              font-weight:900;
              margin-top:2px;
            "
          >

            NÍVEL
            ${xpProfile.level}

          </div>

        </div>


        <div
          style="
            text-align:right;
          "
        >

          <div
            style="
              font-size:22px;
              font-weight:1000;
              color:white;
            "
          >

            ${xpProfile.xp}

          </div>


          <div
            style="
              font-size:8px;
              color:var(--muted);
              font-weight:900;
            "
          >
            XP TOTAL
          </div>

        </div>

      </div>


      <div
        style="
          margin-top:18px;
          display:flex;
          justify-content:space-between;
          gap:10px;
          font-size:9px;
          font-weight:900;
        "
      >

        <span
          style="
            color:var(--muted);
          "
        >

          NÍVEL
          ${xpProfile.level}

        </span>


        <span
          style="
            color:${
              xpProfile.color
            };
          "
        >

          ${
            xpProfile.xpToNext
          }
          XP PARA O PRÓXIMO

        </span>

      </div>


      <div
        style="
          height:11px;
          border-radius:30px;
          overflow:hidden;
          margin-top:8px;
          background:rgba(
            255,
            255,
            255,
            .08
          );
        "
      >

        <div
          style="
            width:${
              xpProfile.levelProgress
            }%;
            height:100%;
            border-radius:30px;
            background:linear-gradient(
              90deg,
              ${xpProfile.color},
              #ffc72c
            );
            transition:width .4s ease;
          "
        ></div>

      </div>


      <div
        style="
          margin-top:11px;
          font-size:9px;
          line-height:1.5;
          color:var(--muted);
        "
      >

        O XP é exclusivo do DH-Club e
        vem das conquistas desbloqueadas.

        <br>

        Ele não altera sua pontuação
        oficial no campeonato.

      </div>

    </div>


    <!-- ================================================= -->
    <!-- JORNADA ANUAL -->
    <!-- ================================================= -->

    <div class="section-title">

      <h3>
        JORNADA ${SYSTEM_YEAR}
      </h3>

      <span>
        METAS ANUAIS
      </span>

    </div>


    <div
      class="premium-card"
      style="
        margin-bottom:14px;
        overflow:hidden;
      "
    >

      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:flex-end;
          gap:15px;
        "
      >

        <div>

          <div
            style="
              font-size:9px;
              color:var(--muted);
              letter-spacing:1px;
              font-weight:900;
            "
          >

            PROGRESSO DA TEMPORADA

          </div>


          <div
            style="
              font-size:31px;
              line-height:1;
              font-weight:1000;
              color:white;
              margin-top:7px;
            "
          >

            ${completedGoals}
            /
            ${goals.length}

          </div>


          <div
            style="
              font-size:9px;
              color:var(--muted);
              margin-top:5px;
            "
          >

            metas concluídas

          </div>

        </div>


        <div
          style="
            font-size:38px;
            line-height:1;
            font-weight:1000;
            color:var(--gold2);
          "
        >

          ${annualPct}%

        </div>

      </div>


      <div
        style="
          height:12px;
          border-radius:30px;
          overflow:hidden;
          margin-top:17px;
          background:rgba(255,255,255,.08);
        "
      >

        <div
          style="
            width:${annualPct}%;
            height:100%;
            border-radius:30px;
            background:
              linear-gradient(
                90deg,
                #1e6fff,
                #35d48a,
                #ffc72c
              );
            transition:width .4s ease;
          "
        ></div>

      </div>


      <div
        style="
          font-size:9px;
          color:var(--muted);
          margin-top:11px;
          line-height:1.45;
        "
      >

        As metas são atualizadas
        automaticamente conforme
        novos resultados oficiais
        entram no DH-PE.

      </div>

    </div>


    <div>

      ${
        goals
          .map(
            annualGoalCard
          )
          .join('')
      }

    </div>


    <!-- ================================================= -->
    <!-- COLEÇÃO DE TROFÉUS -->
    <!-- ================================================= -->

    <div class="section-title">

      <h3>
        MINHA COLEÇÃO
      </h3>

      <span>

  ${unlocked}
  /
  ${achievementsList.length}

  TOTAL

</span>

    </div>


    <div
      style="
        font-size:10px;
        color:var(--muted);
        line-height:1.5;
        margin:
          -4px
          0
          13px;
      "
    >

      Troféus permanentes
      desbloqueados durante
      sua carreira no DH-PE.

    </div>

    <div
      style="
        display:flex;
        gap:7px;
        overflow-x:auto;
        padding:
          2px
          1px
          12px;
        scrollbar-width:none;
      "
    >

      ${filtersHtml}

    </div>


    <div
      style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        margin:
          2px
          0
          12px;
      "
    >

      <div
        style="
          font-size:9px;
          color:var(--muted);
          font-weight:900;
        "
      >

        ${
          achievementFilter ===
            'TODAS'

            ? 'TODAS AS CONQUISTAS'

            : achievementFilter
        }

      </div>


      <div
        style="
          font-size:9px;
          font-weight:1000;
          color:var(--gold2);
        "
      >

        ${filteredUnlocked}
        /
        ${filteredAchievements.length}

      </div>

    </div>

    ${
  filteredAchievements
    .map(
      achievementCollectionCard
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
// SORTEIOS — MOTOR DE ELEGIBILIDADE E ALEATORIEDADE
// ==========================================================


// ----------------------------------------------------------
// VERIFICA SE A CARTEIRA DIGITAL ESTÁ ATIVA
// Usa a mesma regra do sistema principal DH-PE
// ----------------------------------------------------------

function drawHasActiveDigitalCard(
  user
) {

  if (!user) {
    return false;
  }


  // Liberação global para o ano atual

  if (
    Number(
      core.config?.allowAllIDsYear
    ) ===
    Number(
      SYSTEM_YEAR
    )
  ) {

    return true;
  }


  // Compatibilidade com 2026

  if (
    SYSTEM_YEAR === 2026 &&
    core.config?.allowAllIDs === true
  ) {

    return true;
  }


  // Carteira individual liberada
  // no ano atual

  if (
    Number(
      user.cardReleasedYear
    ) ===
    Number(
      SYSTEM_YEAR
    )
  ) {

    return true;
  }


  // Compatibilidade com atletas
  // já liberados em 2026

  if (
    SYSTEM_YEAR === 2026 &&
    user.idReleased === true
  ) {

    return true;
  }


  return false;
}



// ----------------------------------------------------------
// VERIFICA SE O ATLETA É MEMBRO ATIVO DO DH-CLUB
// ----------------------------------------------------------

function drawIsClubMember(
  user
) {

  if (!user) {
    return false;
  }


  const cpf =
    cleanCPF(
      user.cpf
    );


  const member =
    club.members?.[
      cpf
    ];


  if (!member) {
    return false;
  }


  const status =
    String(
      member.status ||
      ''
    )
      .toUpperCase();


  return [
    'BETA',
    'ACTIVE',
    'FOUNDER'
  ].includes(
    status
  );
}



// ----------------------------------------------------------
// VERIFICA INSCRIÇÃO VÁLIDA EM UM EVENTO
// CONFIRMADO OU ISENTO
// ----------------------------------------------------------

function drawIsRegisteredInEvent(
  user,
  eventId
) {

  if (
    !user ||
    !eventId
  ) {

    return false;
  }


  const registrations =
    objValues(
      user.inscricoes
    );


  return registrations.some(
    registration => {

      if (
        String(
          registration.id
        ) !==
        String(
          eventId
        )
      ) {

        return false;
      }


      const status =
        String(
          registration.status ||
          ''
        )
          .toUpperCase();


      return (
        status ===
          'CONFIRMADO' ||

        status ===
          'ISENTO'
      );
    }
  );
}



// ----------------------------------------------------------
// REMOVE CPFs DUPLICADOS
// ----------------------------------------------------------

function drawUniqueUsers(
  users
) {

  const map =
    new Map();


  users.forEach(
    user => {

      const cpf =
        cleanCPF(
          user?.cpf
        );


      if (!cpf) {
        return;
      }


      if (
        !map.has(
          cpf
        )
      ) {

        map.set(
          cpf,
          user
        );
      }
    }
  );


  return Array.from(
    map.values()
  );
}



// ----------------------------------------------------------
// MONTA A LISTA DE ATLETAS ELEGÍVEIS
//
// TIPOS:
// ALL_APP
// DIGITAL_CARD
// DH_CLUB
// EVENT
// ----------------------------------------------------------

function getDrawEligibleUsers(
  filterType,
  eventId = null
) {

  const type =
    String(
      filterType ||
      ''
    )
      .toUpperCase();

  let eligible =
    core.users
      .filter(
        user =>
          user &&
          cleanCPF(
            user.cpf
          )
      );


  // --------------------------------------------------------
  // TODOS OS ATLETAS DO APP
  // --------------------------------------------------------

  if (
    type ===
    'ALL_APP'
  ) {

    eligible =
      eligible.slice();
  }


  // --------------------------------------------------------
  // CARTEIRA DIGITAL ATIVA
  // --------------------------------------------------------

  else if (
    type ===
    'DIGITAL_CARD'
  ) {

    eligible =
      eligible.filter(
        user =>
          drawHasActiveDigitalCard(
            user
          )
      );
  }


  // --------------------------------------------------------
  // MEMBROS DO DH-CLUB
  // --------------------------------------------------------

  else if (
    type ===
    'DH_CLUB'
  ) {

    eligible =
      eligible.filter(
        user =>
          drawIsClubMember(
            user
          )
      );
  }


  // --------------------------------------------------------
  // INSCRITOS NO EVENTO
  // --------------------------------------------------------

  else if (
    type ===
    'EVENT'
  ) {

    if (!eventId) {
      return [];
    }


    eligible =
      eligible.filter(
        user =>
          drawIsRegisteredInEvent(
            user,
            eventId
          )
      );
  }


  else {

    return [];
  }


  return drawUniqueUsers(
    eligible
  );
}



// ----------------------------------------------------------
// CHAVE DO CICLO ANTI-REPETIÇÃO
// ----------------------------------------------------------

function getDrawCycleKey(
  filterType,
  eventId = null
) {

  const type =
    String(
      filterType ||
      ''
    )
      .toUpperCase();


  if (
    type ===
    'EVENT'
  ) {

    return (
      'EVENT_' +
      String(
        eventId
      )
    );
  }


  return type;
}



// ----------------------------------------------------------
// NÚMERO ALEATÓRIO SEGURO
//
// Evita Math.random()
// Usa crypto.getRandomValues()
// ----------------------------------------------------------

function secureRandomIndex(
  max
) {

  const size =
    Number(
      max
    );


  if (
    !Number.isInteger(
      size
    ) ||
    size <= 0
  ) {

    throw new Error(
      'Quantidade inválida para sorteio.'
    );
  }


  if (
    !window.crypto ||
    !window.crypto.getRandomValues
  ) {

    throw new Error(
      'Navegador sem suporte ao sorteio seguro.'
    );
  }


  const range =
    0x100000000;


  const limit =
    Math.floor(
      range /
      size
    ) *
    size;


  const buffer =
    new Uint32Array(
      1
    );


  let number;


  do {

    window.crypto
      .getRandomValues(
        buffer
      );


    number =
      buffer[0];

  } while (
    number >=
    limit
  );


  return (
    number %
    size
  );
}



// ----------------------------------------------------------
// ESCOLHE VENCEDORES SEM REPETIR
// DENTRO DO MESMO SORTEIO
// ----------------------------------------------------------

function securePickWinners(
  participants,
  quantity = 1
) {

  const available =
    participants.slice();


  const winners =
    [];


  const total =
    Math.min(
      Math.max(
        1,
        Number(
          quantity
        ) || 1
      ),
      available.length
    );


  while (
    winners.length <
    total
  ) {

    const index =
      secureRandomIndex(
        available.length
      );


    const winner =
      available.splice(
        index,
        1
      )[0];


    winners.push(
      winner
    );
  }


  return winners;
}



// ----------------------------------------------------------
// LISTA DE EVENTOS QUE O USUÁRIO PODE USAR
// ----------------------------------------------------------

function getDrawAllowedEvents() {

  // ADMIN vê todos

  if (
    isAdmin(
      loggedUser
    )
  ) {

    return core.events.slice();
  }


  // ORGANIZADOR vê somente allowedEvts

  if (
    isOrganizer(
      loggedUser
    )
  ) {

    const allowed =
      Array.isArray(
        loggedUser.allowedEvts
      )

        ? loggedUser.allowedEvts
            .map(String)

        : [];


    return core.events.filter(
      event =>
        allowed.includes(
          String(
            event.id
          )
        )
    );
  }


  return [];
}

// ==========================================================
// SORTEIOS — INTERFACE E CADASTRO
// ==========================================================


// ----------------------------------------------------------
// NOME DO EVENTO
// ----------------------------------------------------------

function drawEventName(
  eventId
) {

  const event =
    core.events.find(
      item =>
        String(
          item.id
        ) ===
        String(
          eventId
        )
    );


  if (!event) {
    return 'EVENTO';
  }


  return (
    event.t ||
    event.title ||
    event.name ||
    'EVENTO'
  );
}



// ----------------------------------------------------------
// NOME DO FILTRO
// ----------------------------------------------------------

function drawFilterLabel(
  draw
) {

  const type =
    String(
      draw?.filterType ||
      ''
    )
      .toUpperCase();


  if (
    type ===
    'ALL_APP'
  ) {

    return 'TODOS OS ATLETAS DO APP';
  }


  if (
    type ===
    'DIGITAL_CARD'
  ) {

    return 'CARTEIRA DIGITAL ATIVA';
  }


  if (
    type ===
    'DH_CLUB'
  ) {

    return 'MEMBROS DH-CLUB';
  }


  if (
    type ===
    'EVENT'
  ) {

    return (
      'INSCRITOS • ' +
      (
        draw.eventName ||
        drawEventName(
          draw.eventId
        )
      )
    );
  }


  return 'SORTEIO DH-CLUB';
}



// ----------------------------------------------------------
// FORMATA DATA/HORA
// ----------------------------------------------------------

function drawDateTimeText(
  value
) {

  if (!value) {
    return 'DATA A DEFINIR';
  }


  const date =
    new Date(
      Number(value)
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return 'DATA A DEFINIR';
  }


  return date
    .toLocaleString(
      'pt-BR',
      {
        dateStyle:
          'short',

        timeStyle:
          'short'
      }
    );
}



// ----------------------------------------------------------
// USUÁRIO PODE CRIAR SORTEIO?
// ----------------------------------------------------------

function canCreateDraw() {

  return (
    isAdmin(
      loggedUser
    ) ||

    isOrganizer(
      loggedUser
    )
  );
}

// ==========================================================
// SORTEIOS — TRANSPARÊNCIA E AUDITORIA
// ==========================================================


// ----------------------------------------------------------
// ID PÚBLICO
// ----------------------------------------------------------

function getDrawPublicId(
  draw
) {

  if (
    draw?.publicId
  ) {

    return String(
      draw.publicId
    );
  }


  const raw =
    String(
      draw?.id ||
      'SORTEIO'
    )
      .replace(
        /[^a-zA-Z0-9]/g,
        ''
      )
      .toUpperCase();


  return (
    'DH-' +
    SYSTEM_YEAR +
    '-' +
    raw.slice(
      0,
      10
    )
  );
}



// ----------------------------------------------------------
// DATA/HORA COMPLETA
// ----------------------------------------------------------

function drawExactDateTime(
  value
) {

  if (!value) {
    return '--';
  }


  const date =
    new Date(
      Number(value)
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return '--';
  }


  return date
    .toLocaleString(
      'pt-BR',
      {

        day:
          '2-digit',

        month:
          '2-digit',

        year:
          'numeric',

        hour:
          '2-digit',

        minute:
          '2-digit',

        second:
          '2-digit',

        hour12:
          false

      }
    );
}



// ----------------------------------------------------------
// NOME DO PERFIL RESPONSÁVEL
// ----------------------------------------------------------

function drawRoleLabel(
  role
) {

  const value =
    String(
      role ||
      ''
    )
      .toUpperCase();


  if (
    value ===
    'ADMIN'
  ) {

    return 'ADMINISTRAÇÃO';
  }


  if (
    value ===
    'ORGANIZER'
  ) {

    return 'ORGANIZADOR';
  }


  return 'USUÁRIO';
}



// ----------------------------------------------------------
// GERAR HASH SHA-256 DO RESULTADO
//
// IMPORTANTE:
// Isso cria um registro de integridade.
// Não substitui validação em servidor.
// ----------------------------------------------------------

// ----------------------------------------------------------
// IDENTIFICADOR TÉCNICO DO ATLETA PARA SORTEIOS
//
// O CPF é transformado em SHA-256.
// O CPF original NÃO é salvo no sorteio público.
// ----------------------------------------------------------

async function drawOpaqueIdFromCpf(
  cpf
) {

  const clean =
    cleanCPF(
      cpf
    );


  if (!clean) {
    return '';
  }


  if (
    !window.crypto ||
    !window.crypto.subtle ||
    typeof TextEncoder ===
      'undefined'
  ) {

    throw new Error(
      'Navegador sem suporte ao identificador seguro.'
    );
  }


  const encoded =
    new TextEncoder()
      .encode(
        'DHCLUB-RAFFLE-ID-V1|' +
        clean
      );


  const buffer =
    await window.crypto
      .subtle
      .digest(
        'SHA-256',
        encoded
      );


  return Array
    .from(
      new Uint8Array(
        buffer
      )
    )
    .map(
      byte =>
        byte
          .toString(16)
          .padStart(
            2,
            '0'
          )
    )
    .join('');
}
  

async function createDrawAuditHash(
  draw,
  participants,
  winners,
  drawnAt,
  cycleRound
) {

  if (
    !window.crypto ||
    !window.crypto.subtle ||
    typeof TextEncoder ===
      'undefined'
  ) {

    return '';
  }


  const payload = {

    version:
      2,

    drawId:
      String(
        draw?.id ||
        ''
      ),

    publicId:
      String(
        draw?.publicId ||
        ''
      ),

    filterType:
      String(
        draw?.filterType ||
        ''
      ),

    eventId:
      draw?.eventId ||
      null,

    participants:
      participants
        .map(
          participant =>
            String(
              participant.participantId ||
              ''
            )
        )
        .filter(Boolean)
        .sort(),

    winners:
      winners
        .map(
          winner =>
            String(
              winner.participantId ||
              ''
            )
        ),

    drawnAt:
      Number(
        drawnAt ||
        0
      ),

    cycleRound:
      Number(
        cycleRound ||
        1
      )

  };


  const encoded =
    new TextEncoder()
      .encode(
        JSON.stringify(
          payload
        )
      );


  const buffer =
    await window.crypto
      .subtle
      .digest(
        'SHA-256',
        encoded
      );


  return Array
    .from(
      new Uint8Array(
        buffer
      )
    )
    .map(
      byte =>
        byte
          .toString(16)
          .padStart(
            2,
            '0'
          )
    )
    .join('');
}
  
// ----------------------------------------------------------
// CARD DE UM SORTEIO
// ----------------------------------------------------------

function drawCardMarkup(
  draw
) {

  const status =
    String(
      draw?.status ||
      'WAITING'
    )
      .toUpperCase();


  const finished =
    status ===
    'DRAWN';


  let participants =
    [];


  // Sorteio encerrado:
  // usa a lista congelada do momento do sorteio.

  if (
    finished &&
    draw.participants
  ) {

    participants =
      objValues(
        draw.participants
      );

  } else {

    // Sorteio aguardando:
    // mostra quantidade atual de elegíveis.

    participants =
      getDrawEligibleUsers(
        draw.filterType,
        draw.eventId
      );
  }


  const myCpf =
    cleanCPF(
      loggedUser?.cpf
    );


  const participating =
    participants.some(
      participant =>

        cleanCPF(
          participant?.cpf
        ) ===
        myCpf
    );


  const winners =
    objValues(
      draw.winners
    );


  return `

    <div
      class="benefit-card"
      style="
        margin-bottom:12px;
        border:
          1px solid
          ${
            finished
              ? '#2ecc71'
              : 'rgba(255,255,255,.12)'
          };
      "
    >

      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:10px;
          margin-bottom:8px;
        "
      >

        <span
          class="
            tag
            ${
              finished
                ? 'green'
                : 'gold'
            }
          "
        >

          ${
            finished
              ? 'ENCERRADO'
              : 'AGUARDANDO'
          }

        </span>


        <span
          style="
            font-size:10px;
            color:var(--muted);
          "
        >

          ${
            participants.length
          }

          participantes

        </span>

      </div>


      <h4
        style="
          margin-bottom:4px;
        "
      >

        ${esc(
          draw.title ||
          'SORTEIO DH-CLUB'
        )}

      </h4>


      ${
        draw.prize

          ? `

            <div
              style="
                color:var(--gold2);
                font-size:12px;
                font-weight:900;
                margin-bottom:8px;
              "
            >

              <i
                class="
                  fa-solid
                  fa-gift
                "
              ></i>

              ${esc(
                draw.prize
              )}

            </div>

          `

          : ''
      }


      <p
        style="
          margin-bottom:8px;
        "
      >

        ${esc(
          draw.description ||
          ''
        )}

      </p>


      <div
        style="
          font-size:10px;
          color:var(--muted);
          line-height:1.7;
        "
      >

        <div>

          <b>
            PÚBLICO:
          </b>

          ${esc(
            drawFilterLabel(
              draw
            )
          )}

        </div>


        <div>

          <b>
            SORTEIO:
          </b>

          ${esc(
            drawDateTimeText(
              draw.drawAt
            )
          )}

        </div>


        <div>

          <b>
            VENCEDORES:
          </b>

          ${Number(
            draw.winnersCount ||
            1
          )}

        </div>

      </div>


      ${
        !finished

          ? `

            <div
              style="
                margin-top:10px;
                padding:8px;
                border-radius:8px;
                background:
                  ${
                    participating
                      ? 'rgba(46,204,113,.12)'
                      : 'rgba(255,255,255,.05)'
                  };
                font-size:10px;
                font-weight:900;
              "
            >

              ${
                participating

                  ? `

                    <i
                      class="
                        fa-solid
                        fa-circle-check
                      "
                      style="
                        color:#2ecc71;
                      "
                    ></i>

                    VOCÊ ESTÁ PARTICIPANDO

                  `

                  : `

                    <i
                      class="
                        fa-solid
                        fa-circle-xmark
                      "
                    ></i>

                    VOCÊ NÃO ESTÁ ELEGÍVEL

                  `
              }

            </div>

          `

          : ''
      }


      ${
        finished &&
        winners.length

          ? `

            <div
              style="
                margin-top:12px;
                padding:12px;
                border-radius:10px;
                background:
                  rgba(46,204,113,.10);
              "
            >

              <div
                style="
                  font-size:10px;
                  font-weight:900;
                  color:#2ecc71;
                  margin-bottom:6px;
                "
              >

                🏆
                ${
                  winners.length > 1
                    ? 'VENCEDORES'
                    : 'VENCEDOR'
                }

              </div>


              ${
                winners
                  .map(
                    (
                      winner,
                      index
                    ) => `

                      <div
                        style="
                          font-weight:900;
                          margin-top:4px;
                        "
                      >

                        ${index + 1}º

                        ${esc(
                          winner.name ||
                          winner.nome ||
                          'ATLETA'
                        )}

                      </div>

                    `
                  )
                  .join('')
              }

            </div>

          `

          : ''
            }


      <div
        style="
          display:flex;
          gap:8px;
          margin-top:12px;
        "
      >

        <button
          class="secondary-btn"
          style="
            flex:1;
          "
          onclick="
            Club.showDrawParticipants(
              '${esc(draw.id)}'
            )
          "
        >

          <i
            class="
              fa-solid
              fa-users
            "
          ></i>

          PARTICIPANTES

        </button>


        ${
          !finished &&
          canManageDraw(
            draw
          )

            ? `

              <button
                class="primary-btn"
                style="
                  flex:1;
                "
                onclick="
                  Club.confirmDraw(
                    '${esc(draw.id)}'
                  )
                "
              >

                <i
                  class="
                    fa-solid
                    fa-shuffle
                  "
                ></i>

                SORTEAR

              </button>

            `

            : ''
        }

      </div>

      <button
        class="secondary-btn"

        style="
          width:100%;
          margin-top:8px;
        "

        onclick="
          Club.showDrawDetails(
            '${esc(draw.id)}'
          )
        "
      >

        <i
          class="
            fa-solid
            fa-circle-info
          "
        ></i>

        DETALHES DO SORTEIO

      </button>

    </div>

  `;
}



// ----------------------------------------------------------
// TELA PRINCIPAL DOS SORTEIOS
// ----------------------------------------------------------

function renderDraws() {

  const view =
    document.getElementById(
      'view-draws'
    );


  if (!view) {
    return;
  }


  const draws =
    objValues(
      club.draws
    )
      .sort(
        (
          a,
          b
        ) =>

          Number(
            b.createdAt ||
            0
          ) -

          Number(
            a.createdAt ||
            0
          )
      );


  const waiting =
    draws.filter(
      draw =>
        String(
          draw.status ||
          'WAITING'
        )
          .toUpperCase() !==
        'DRAWN'
    );


  const finished =
    draws.filter(
      draw =>
        String(
          draw.status ||
          ''
        )
          .toUpperCase() ===
        'DRAWN'
    );


  view.innerHTML = `

    <div class="hero">

      <div class="eyebrow">

        DH-CLUB

      </div>


      <h2>

        Sorteios

      </h2>


      <p>

        Sorteios transparentes
        entre atletas elegíveis.

        <br>

        Todos participam
        com a mesma chance.

      </p>


      <div class="member-chip">

        <i
          class="
            fa-solid
            fa-shuffle
          "
        ></i>

        SORTEIO JUSTO

      </div>

    </div>


    ${
      canCreateDraw()

        ? `

          <button
            class="primary-btn"
            style="
              width:100%;
              margin-bottom:16px;
            "

            onclick="
              Club.openNewDraw()
            "
          >

            <i
              class="
                fa-solid
                fa-plus
              "
            ></i>

            CRIAR NOVO SORTEIO

          </button>

        `

        : ''
    }


    <div class="section-title">

      <h3>

        AGUARDANDO SORTEIO

      </h3>

      <span>

        ${waiting.length}

      </span>

    </div>


    <div class="list">

      ${
        waiting.length

          ? waiting
              .map(
                drawCardMarkup
              )
              .join('')

          : `

            <div class="empty">

              Nenhum sorteio
              aguardando realização.

            </div>

          `
      }

    </div>


    <div
      class="section-title"
      style="
        margin-top:18px;
      "
    >

      <h3>

        ÚLTIMOS RESULTADOS

      </h3>

      <span>

        ${finished.length}

      </span>

    </div>


    <div class="list">

      ${
        finished.length

          ? finished
              .map(
                drawCardMarkup
              )
              .join('')

          : `

            <div class="empty">

              Nenhum sorteio
              realizado ainda.

            </div>

          `
      }

    </div>

  `;
}



// ----------------------------------------------------------
// ABRIR FORMULÁRIO PARA NOVO SORTEIO
// ----------------------------------------------------------

function openNewDraw() {

  if (
    !canCreateDraw()
  ) {

    toast(
      'SEM PERMISSÃO PARA CRIAR SORTEIO'
    );

    return;
  }


  const organizerOnly =
    isOrganizer(
      loggedUser
    ) &&
    !isAdmin(
      loggedUser
    );


  const events =
    getDrawAllowedEvents();


  if (
    organizerOnly &&
    events.length === 0
  ) {

    toast(
      'VOCÊ NÃO POSSUI EVENTOS LIBERADOS'
    );

    return;
  }


  const defaultType =
    organizerOnly
      ? 'EVENT'
      : 'ALL_APP';


  const defaultEventId =
    organizerOnly &&
    events.length

      ? String(
          events[0].id
        )

      : '';


  const initialParticipants =
    getDrawEligibleUsers(
      defaultType,
      defaultEventId
    );


  const eventOptions =
    events
      .map(
        event => `

          <option
            value="${esc(
              event.id
            )}"
          >

            ${esc(
              event.t ||
              event.title ||
              event.name ||
              'EVENTO'
            )}

          </option>

        `
      )
      .join('');


  openModal(`

    <div class="eyebrow">

      SORTEIO DH-CLUB

    </div>


    <h2>

      Novo Sorteio

    </h2>


    <p
      style="
        color:var(--muted);
        font-size:11px;
        margin-bottom:15px;
      "
    >

      Defina o prêmio
      e quem poderá participar.

    </p>


    <div class="field">

      <label>

        TÍTULO DO SORTEIO

      </label>

      <input
        id="draw-title"
        maxlength="80"

        placeholder="
          Ex: CAPACETE FULL FACE
        "
      >

    </div>


    <div class="field">

      <label>

        PRÊMIO

      </label>

      <input
        id="draw-prize"
        maxlength="100"

        placeholder="
          Ex: 1 Capacete Full Face
        "
      >

    </div>


    <div class="field">

      <label>

        DESCRIÇÃO

      </label>

      <textarea
        id="draw-description"

        rows="3"

        style="
          width:100%;
          padding:12px;
          border-radius:8px;
          border:
            1px solid
            rgba(255,255,255,.15);
          background:
            rgba(255,255,255,.06);
          color:white;
          resize:vertical;
        "

        placeholder="
          Informações sobre o sorteio...
        "
      ></textarea>

    </div>


    <div class="field">

      <label>

        QUANTIDADE DE VENCEDORES

      </label>

      <input
        id="draw-winners-count"

        type="number"

        min="1"

        max="20"

        value="1"
      >

    </div>


    <div class="field">

      <label>

        QUEM PARTICIPA?

      </label>


      ${
        organizerOnly

          ? `

            <select
              id="draw-filter-type"
              onchange="
                Club.changeDrawFilter()
              "
            >

              <option
                value="EVENT"
              >

                INSCRITOS EM EVENTO

              </option>

            </select>

          `

          : `

            <select
              id="draw-filter-type"

              onchange="
                Club.changeDrawFilter()
              "
            >

              <option
                value="ALL_APP"
              >

                TODOS OS ATLETAS DO APP

              </option>


              <option
                value="DIGITAL_CARD"
              >

                CARTEIRA DIGITAL ATIVA

              </option>


              <option
                value="DH_CLUB"
              >

                MEMBROS DO DH-CLUB

              </option>


              <option
                value="EVENT"
              >

                INSCRITOS EM EVENTO

              </option>

            </select>

          `
      }

    </div>


    <div
      class="field"

      id="draw-event-area"

      style="
        display:
          ${
            organizerOnly
              ? 'block'
              : 'none'
          };
      "
    >

      <label>

        EVENTO

      </label>


      <select
        id="draw-event-id"

        onchange="
          Club.updateDrawPreview()
        "
      >

        ${
          organizerOnly

            ? ''

            : `

              <option value="">

                SELECIONE O EVENTO

              </option>

            `
        }

        ${eventOptions}

      </select>

    </div>


    <div class="field">

      <label>

        DATA/HORA PREVISTA

      </label>

      <input
        id="draw-date"

        type="datetime-local"
      >

    </div>


    <div
      style="
        margin:14px 0;
        padding:12px;
        border-radius:10px;
        background:
          rgba(46,204,113,.10);
        border:
          1px solid
          rgba(46,204,113,.25);
      "
    >

      <div
        style="
          font-size:10px;
          color:var(--muted);
        "
      >

        ATLETAS ELEGÍVEIS AGORA

      </div>


      <div
        id="draw-preview-count"

        style="
          font-size:26px;
          font-weight:900;
          margin-top:4px;
        "
      >

        ${initialParticipants.length}

      </div>


      <div
        style="
          font-size:9px;
          color:var(--muted);
          margin-top:4px;
        "
      >

        A lista definitiva
        será congelada
        somente no momento
        da realização do sorteio.

      </div>

    </div>


    <div
      style="
        padding:10px;
        border-radius:8px;
        background:
          rgba(255,193,7,.08);
        font-size:9px;
        line-height:1.6;
        margin-bottom:10px;
      "
    >

      <b>

        REGRA DE JUSTIÇA

      </b>

      <br>

      Nenhum atleta recebe
      vantagem por ranking,
      pódio ou pontuação.

      <br>

      O sistema também utilizará
      proteção contra repetição
      de vencedores.

    </div>


    <button
      class="primary-btn"
      style="
        width:100%;
      "

      onclick="
        Club.createDraw()
      "
    >

      <i
        class="
          fa-solid
          fa-floppy-disk
        "
      ></i>

      PUBLICAR SORTEIO

    </button>

  `);


  setTimeout(
    () => {

      updateDrawPreview();

    },
    50
  );
}



// ----------------------------------------------------------
// ALTEROU O TIPO DE FILTRO
// ----------------------------------------------------------

function changeDrawFilter() {

  const typeEl =
    document.getElementById(
      'draw-filter-type'
    );


  const eventArea =
    document.getElementById(
      'draw-event-area'
    );


  if (
    !typeEl ||
    !eventArea
  ) {

    return;
  }


  const type =
    String(
      typeEl.value ||
      ''
    );


  eventArea.style.display =
    type === 'EVENT'
      ? 'block'
      : 'none';


  updateDrawPreview();
}



// ----------------------------------------------------------
// ATUALIZA QUANTIDADE DE ELEGÍVEIS
// ----------------------------------------------------------

function updateDrawPreview() {

  const typeEl =
    document.getElementById(
      'draw-filter-type'
    );


  const eventEl =
    document.getElementById(
      'draw-event-id'
    );


  const countEl =
    document.getElementById(
      'draw-preview-count'
    );


  if (
    !typeEl ||
    !countEl
  ) {

    return;
  }


  const type =
    typeEl.value;


  const eventId =
    eventEl
      ? eventEl.value
      : null;


  const participants =
    getDrawEligibleUsers(
      type,
      eventId
    );


  countEl.textContent =
    participants.length;
}



// ----------------------------------------------------------
// SALVAR / PUBLICAR NOVO SORTEIO
// ----------------------------------------------------------

async function createDraw() {

  if (
    !canCreateDraw()
  ) {

    toast(
      'SEM PERMISSÃO'
    );

    return;
  }


  const title =
    String(
      document
        .getElementById(
          'draw-title'
        )
        ?.value ||
      ''
    )
      .trim();


  const prize =
    String(
      document
        .getElementById(
          'draw-prize'
        )
        ?.value ||
      ''
    )
      .trim();


  const description =
    String(
      document
        .getElementById(
          'draw-description'
        )
        ?.value ||
      ''
    )
      .trim();


  let filterType =
    String(
      document
        .getElementById(
          'draw-filter-type'
        )
        ?.value ||
      ''
    )
      .toUpperCase();


  const eventId =
    String(
      document
        .getElementById(
          'draw-event-id'
        )
        ?.value ||
      ''
    );


  const winnersCount =
    Math.min(
      20,

      Math.max(
        1,

        Number(
          document
            .getElementById(
              'draw-winners-count'
            )
            ?.value ||
          1
        )
      )
    );


  const dateValue =
    document
      .getElementById(
        'draw-date'
      )
      ?.value ||
    '';


  if (!title) {

    toast(
      'INFORME O TÍTULO DO SORTEIO'
    );

    return;
  }


  // Organizador sempre fica
  // limitado a sorteio por evento.

  if (
    isOrganizer(
      loggedUser
    ) &&
    !isAdmin(
      loggedUser
    )
  ) {

    filterType =
      'EVENT';
  }


  const validTypes = [
    'ALL_APP',
    'DIGITAL_CARD',
    'DH_CLUB',
    'EVENT'
  ];


  if (
    !validTypes.includes(
      filterType
    )
  ) {

    toast(
      'FILTRO INVÁLIDO'
    );

    return;
  }


  if (
    filterType ===
    'EVENT'
  ) {

    if (!eventId) {

      toast(
        'SELECIONE UM EVENTO'
      );

      return;
    }


    if (
      !organizerCanManageEvent(
        loggedUser,
        eventId
      )
    ) {

      toast(
        'VOCÊ NÃO PODE GERENCIAR ESTE EVENTO'
      );

      return;
    }
  }


  const eligibleNow =
    getDrawEligibleUsers(
      filterType,
      eventId
    );


  let drawAt =
    null;


  if (dateValue) {

    const timestamp =
      new Date(
        dateValue
      )
        .getTime();


    if (
      Number.isFinite(
        timestamp
      )
    ) {

      drawAt =
        timestamp;
    }
  }


  const id =
    window.crypto &&
    typeof window.crypto.randomUUID ===
      'function'

      ? window.crypto
          .randomUUID()

      : (
          'draw_' +
          Date.now()
        );

    const createdAt =
    Date.now();


  const publicId =
    (
      'DH-' +
      SYSTEM_YEAR +
      '-' +
      String(
        createdAt
      )
        .slice(
          -6
        ) +
      '-' +
      String(
        id
      )
        .replace(
          /[^a-zA-Z0-9]/g,
          ''
        )
        .slice(
          0,
          4
        )
        .toUpperCase()
    );

    const creatorId =
    await drawOpaqueIdFromCpf(
      loggedUser?.cpf
    );
  
  const draw = {

    id,

    publicId,

    title,

    prize,

    description,

    status:
      'WAITING',

    filterType,

    eventId:
      filterType ===
      'EVENT'

        ? eventId

        : null,

    eventName:
      filterType ===
      'EVENT'

        ? drawEventName(
            eventId
          )

        : null,

    winnersCount,

    drawAt,

    antiRepeat:
      true,

    cycleKey:
      getDrawCycleKey(
        filterType,
        eventId
      ),

    eligiblePreview:
      eligibleNow.length,

    createdAt,

createdBy: {

  participantId:
    creatorId,

  name:
    loggedUser?.nome ||
    'ORGANIZAÇÃO',

  role:
    loggedUser?.role ||
    'USER'

}

  };


  try {

    await database
      .ref(
        `${CLUB_ROOT}/draws/${id}`
      )
      .set(
        draw
      );


    if (!club.draws) {

      club.draws =
        {};
    }


    club.draws[
      id
    ] =
      draw;


    closeModal();


    renderDraws();


    toast(
      'SORTEIO PUBLICADO!'
    );


  } catch (error) {

    console.error(
      '[DH-CLUB] Erro ao criar sorteio:',
      error
    );


    toast(
      'ERRO AO PUBLICAR SORTEIO'
    );
  }
}

// ==========================================================
// SORTEIOS — REALIZAÇÃO, ANTI-REPETIÇÃO E AUDITORIA
// ==========================================================


// ----------------------------------------------------------
// CHAVE SEGURA PARA CAMINHO FIREBASE
// ----------------------------------------------------------

function safeDrawCycleKey(
  value
) {

  return String(
    value || 'GERAL'
  )
    .replace(
      /[.#$\[\]\/]/g,
      '_'
    );
}



// ----------------------------------------------------------
// PODE ADMINISTRAR ESTE SORTEIO?
// ----------------------------------------------------------

function canManageDraw(
  draw
) {

  if (
    !draw ||
    !loggedUser
  ) {

    return false;
  }


  // ADMIN pode gerenciar qualquer sorteio

  if (
    isAdmin(
      loggedUser
    )
  ) {

    return true;
  }


  // ORGANIZADOR somente sorteio de evento

  if (
    isOrganizer(
      loggedUser
    ) &&
    String(
      draw.filterType
    )
      .toUpperCase() ===
      'EVENT'
  ) {

    return organizerCanManageEvent(
      loggedUser,
      draw.eventId
    );
  }


  return false;
}



// ----------------------------------------------------------
// TRANSFORMA USUÁRIO EM REGISTRO PÚBLICO DO SORTEIO
// Não salvamos senha, telefone etc.
// ----------------------------------------------------------

function drawPublicParticipant(
  user
) {

  return {

    name:
      user?.nome ||
      user?.name ||
      'ATLETA',

    city:
      user?.city ||
      '',

    uf:
      user?.uf ||
      'PE',

    category:
      user?.cat ||
      user?.category ||
      ''

  };
}

// ----------------------------------------------------------
// ABRIR CONFIRMAÇÃO ANTES DE SORTEAR
// ----------------------------------------------------------

function confirmDraw(
  drawId
) {

  const draw =
    club.draws?.[
      drawId
    ];


  if (!draw) {

    toast(
      'SORTEIO NÃO ENCONTRADO'
    );

    return;
  }


  if (
    !canManageDraw(
      draw
    )
  ) {

    toast(
      'SEM PERMISSÃO PARA ESTE SORTEIO'
    );

    return;
  }


  if (
    String(
      draw.status
    )
      .toUpperCase() !==
      'WAITING'
  ) {

    toast(
      'ESTE SORTEIO NÃO ESTÁ DISPONÍVEL'
    );

    return;
  }


  const eligible =
    getDrawEligibleUsers(
      draw.filterType,
      draw.eventId
    );


  const winnersCount =
    Math.max(
      1,
      Number(
        draw.winnersCount ||
        1
      )
    );


  openModal(`

    <div class="eyebrow">

      CONFIRMAÇÃO FINAL

    </div>


    <h2>

      Realizar Sorteio

    </h2>


    <div
      style="
        padding:14px;
        border-radius:12px;
        background:
          rgba(255,193,7,.10);
        border:
          1px solid
          rgba(255,193,7,.25);
        margin:15px 0;
      "
    >

      <div
        style="
          font-size:11px;
          color:var(--muted);
        "
      >

        SORTEIO

      </div>


      <div
        style="
          font-size:17px;
          font-weight:900;
          margin-top:3px;
        "
      >

        ${esc(
          draw.title ||
          'SORTEIO DH-CLUB'
        )}

      </div>


      <div
        style="
          margin-top:12px;
          font-size:11px;
          line-height:1.8;
        "
      >

        <b>
          Participantes elegíveis:
        </b>

        ${eligible.length}

        <br>


        <b>
          Quantidade de vencedores:
        </b>

        ${winnersCount}

        <br>


        <b>
          Público:
        </b>

        ${esc(
          drawFilterLabel(
            draw
          )
        )}

      </div>

    </div>


    <div
      style="
        padding:12px;
        background:
          rgba(213,0,0,.08);
        border:
          1px solid
          rgba(213,0,0,.20);
        border-radius:10px;
        font-size:10px;
        line-height:1.6;
        margin-bottom:12px;
      "
    >

      <b>
        ATENÇÃO
      </b>

      <br>

      Ao confirmar, a lista de participantes será congelada.

      <br><br>

      O resultado ficará registrado e este sorteio
      não poderá ser realizado novamente.

    </div>


    <button
      class="primary-btn"

      style="
        width:100%;
      "

      onclick="
        Club.performDraw(
          '${esc(drawId)}'
        )
      "
    >

      <i
        class="
          fa-solid
          fa-shuffle
        "
      ></i>

      CONFIRMAR E SORTEAR

    </button>

  `);
}



// ----------------------------------------------------------
// REALIZAR SORTEIO
// ----------------------------------------------------------

async function performDraw(
  drawId
) {

  const draw =
    club.draws?.[
      drawId
    ];


  if (!draw) {

    toast(
      'SORTEIO NÃO ENCONTRADO'
    );

    return;
  }


  if (
    !canManageDraw(
      draw
    )
  ) {

    toast(
      'SEM PERMISSÃO'
    );

    return;
  }


  const drawRef =
    database.ref(
      `${CLUB_ROOT}/draws/${drawId}`
    );


  const statusRef =
    drawRef.child(
      'status'
    );


  try {

    // ======================================================
    // TRAVA O SORTEIO
    // WAITING -> DRAWING
    // ======================================================

    const lock =
      await statusRef
        .transaction(
          current => {

            if (
              String(
                current ||
                ''
              )
                .toUpperCase() !==
                'WAITING'
            ) {

              return;
            }


            return 'DRAWING';
          }
        );


    if (
      !lock.committed
    ) {

      closeModal();

      toast(
        'ESTE SORTEIO JÁ FOI INICIADO OU REALIZADO'
      );

      return;
    }


    // ======================================================
    // PARTICIPANTES ELEGÍVEIS
    //
    // CPF existe somente temporariamente na memória.
    // ======================================================

    const eligibleUsers =
      getDrawEligibleUsers(
        draw.filterType,
        draw.eventId
      );


    const uniqueUsers =
      drawUniqueUsers(
        eligibleUsers
      );


    const participants =
      (
        await Promise.all(

          uniqueUsers.map(
            async user => {

              const cpf =
                cleanCPF(
                  user?.cpf
                );


              const participantId =
                await drawOpaqueIdFromCpf(
                  cpf
                );


              if (
                !cpf ||
                !participantId
              ) {

                return null;
              }


              return {

                participantId,

                // SOMENTE MEMÓRIA.
                // ESTE CAMPO NÃO SERÁ SALVO.
                _privateCpf:
                  cpf,

                ...drawPublicParticipant(
                  user
                )

              };
            }
          )
        )
      )
        .filter(Boolean)
        .sort(
          (
            a,
            b
          ) =>

            String(
              a.participantId
            )
              .localeCompare(
                String(
                  b.participantId
                )
              )
        );


    const winnersCount =
      Math.max(
        1,
        Number(
          draw.winnersCount ||
          1
        )
      );


    if (
      participants.length <
      winnersCount
    ) {

      await statusRef
        .set(
          'WAITING'
        );


      closeModal();


      toast(
        'NÃO HÁ PARTICIPANTES SUFICIENTES'
      );


      return;
    }


    // ======================================================
    // CICLO ANTI-REPETIÇÃO
    // ======================================================

    const originalCycleKey =
      draw.cycleKey ||
      getDrawCycleKey(
        draw.filterType,
        draw.eventId
      );


    const cycleKey =
      safeDrawCycleKey(
        originalCycleKey
      );


    const cycle =
      club.draw_cycles?.[
        cycleKey
      ] ||
      {};


    let used =
      cycle.used &&
      typeof cycle.used ===
        'object'

        ? {
            ...cycle.used
          }

        : {};


    let round =
      Math.max(
        1,
        Number(
          cycle.round ||
          1
        )
      );


    let cycleReset =
      false;


    // ======================================================
    // MIGRA CICLOS ANTIGOS QUE AINDA USAVAM CPF
    // ======================================================

    participants.forEach(
      participant => {

        if (
          used[
            participant._privateCpf
          ]
        ) {

          used[
            participant.participantId
          ] =
            true;
        }
      }
    );


    // Remove chaves antigas que eram CPF

    Object.keys(
      used
    )
      .forEach(
        key => {

          if (
            /^\d{11}$/.test(
              key
            )
          ) {

            delete used[
              key
            ];
          }
        }
      );


    let available =
      participants.filter(
        participant =>
          !used[
            participant.participantId
          ]
      );


    // ======================================================
    // NOVO CICLO QUANDO NECESSÁRIO
    // ======================================================

        // ======================================================
    // CASO 1:
    // TODOS JÁ GANHARAM NESTE CICLO
    //
    // Só aqui um novo ciclo pode começar.
    // ======================================================

    if (
      available.length ===
      0
    ) {

      used =
        {};


      available =
        participants.slice();


      round++;


      cycleReset =
        true;
    }


    // ======================================================
    // CASO 2:
    // AINDA EXISTEM ATLETAS SEM GANHAR,
    // MAS NÃO HÁ QUANTIDADE SUFICIENTE
    // PARA ESTE SORTEIO.
    //
    // NÃO reinicia o ciclo.
    // NÃO permite repetir vencedor.
    // ======================================================

    else if (
      available.length <
      winnersCount
    ) {

      await statusRef
        .set(
          'WAITING'
        );


      closeModal();


      toast(
        `RESTAM ${available.length} ATLETA(S) NESTE CICLO. ESTE SORTEIO PEDE ${winnersCount} VENCEDOR(ES).`
      );


      return;
    }


    // ======================================================
    // ESCOLHE VENCEDORES
    // ======================================================

    const selected =
      securePickWinners(
        available,
        winnersCount
      );


    // ======================================================
    // VENCEDORES PÚBLICOS
    //
    // SEM CPF.
    // ======================================================

    const winners =
      selected.map(
        (
          participant,
          index
        ) => ({

          position:
            index + 1,

          participantId:
            participant.participantId,

          name:
            participant.name,

          city:
            participant.city,

          uf:
            participant.uf,

          category:
            participant.category

        })
      );


    // ======================================================
    // MARCA VENCEDORES NO CICLO
    // ======================================================

    winners.forEach(
      winner => {

        used[
          winner.participantId
        ] =
          true;
      }
    );


    // ======================================================
    // CONGELA PARTICIPANTES SEM CPF
    // ======================================================

    const participantsObject =
      {};


    participants.forEach(
      participant => {

        participantsObject[
          participant.participantId
        ] = {

          participantId:
            participant.participantId,

          name:
            participant.name,

          city:
            participant.city,

          uf:
            participant.uf,

          category:
            participant.category

        };
      }
    );


    const now =
      Date.now();


    // Identificador técnico de quem realizou o sorteio

    const actorId =
      await drawOpaqueIdFromCpf(
        loggedUser?.cpf
      );


    // ======================================================
    // HASH DE AUDITORIA
    // ======================================================

    const auditHash =
      await createDrawAuditHash(
        draw,
        participants,
        winners,
        now,
        round
      );


    // ======================================================
    // ATUALIZAÇÃO ATÔMICA
    // ======================================================

    const updates =
      {};


    updates[
      `${CLUB_ROOT}/draws/${drawId}/status`
    ] =
      'DRAWN';


    updates[
      `${CLUB_ROOT}/draws/${drawId}/participants`
    ] =
      participantsObject;


    updates[
      `${CLUB_ROOT}/draws/${drawId}/participantCount`
    ] =
      participants.length;


    updates[
      `${CLUB_ROOT}/draws/${drawId}/winners`
    ] =
      winners;


    updates[
      `${CLUB_ROOT}/draws/${drawId}/drawnAt`
    ] =
      now;


    updates[
      `${CLUB_ROOT}/draws/${drawId}/eligibleBeforeAntiRepeat`
    ] =
      participants.length;


    updates[
      `${CLUB_ROOT}/draws/${drawId}/antiRepeatPool`
    ] =
      available.length;


    updates[
      `${CLUB_ROOT}/draws/${drawId}/cycleRound`
    ] =
      round;


    updates[
      `${CLUB_ROOT}/draws/${drawId}/cycleReset`
    ] =
      cycleReset;


    updates[
      `${CLUB_ROOT}/draws/${drawId}/locked`
    ] =
      true;


    updates[
      `${CLUB_ROOT}/draws/${drawId}/auditHash`
    ] =
      auditHash;


    updates[
      `${CLUB_ROOT}/draws/${drawId}/auditVersion`
    ] =
      2;


    updates[
      `${CLUB_ROOT}/draws/${drawId}/randomMethod`
    ] =
      'CRYPTO_GET_RANDOM_VALUES';


    updates[
      `${CLUB_ROOT}/draws/${drawId}/integrityRegistered`
    ] =
      !!auditHash;


    // ======================================================
    // QUEM REALIZOU
    //
    // SEM CPF.
    // ======================================================

    updates[
      `${CLUB_ROOT}/draws/${drawId}/drawnBy`
    ] = {

      participantId:
        actorId,

      name:
        loggedUser?.nome ||
        'ORGANIZAÇÃO',

      role:
        loggedUser?.role ||
        'USER'

    };


    // ======================================================
    // CICLO ANTI-REPETIÇÃO
    //
    // agora também usa participantId
    // ======================================================

    updates[
      `${CLUB_ROOT}/draw_cycles/${cycleKey}`
    ] = {

      key:
        originalCycleKey,

      round,

      used,

      updatedAt:
        now

    };


    await database
      .ref()
      .update(
        updates
      );


    // ======================================================
    // ATUALIZA MEMÓRIA LOCAL
    // ======================================================

    if (
      !club.draw_cycles
    ) {

      club.draw_cycles =
        {};
    }


    club.draw_cycles[
      cycleKey
    ] = {

      key:
        originalCycleKey,

      round,

      used,

      updatedAt:
        now

    };


    if (
      club.draws?.[
        drawId
      ]
    ) {

      club.draws[
        drawId
      ] = {

        ...club.draws[
          drawId
        ],

        status:
          'DRAWN',

        participants:
          participantsObject,

        participantCount:
          participants.length,

        winners,

        drawnAt:
          now,

        eligibleBeforeAntiRepeat:
          participants.length,

        antiRepeatPool:
          available.length,

        cycleRound:
          round,

        cycleReset,

        locked:
          true,

        auditHash,

        auditVersion:
          2,

        randomMethod:
          'CRYPTO_GET_RANDOM_VALUES',

        integrityRegistered:
          !!auditHash,

        drawnBy: {

          participantId:
            actorId,

          name:
            loggedUser?.nome ||
            'ORGANIZAÇÃO',

          role:
            loggedUser?.role ||
            'USER'

        }

      };
    }


    closeModal();


    renderDraws();


    toast(
      winners.length > 1

        ? 'SORTEIO REALIZADO! TEMOS VENCEDORES!'

        : 'SORTEIO REALIZADO! TEMOS UM VENCEDOR!'
    );


  } catch (
    error
  ) {

    console.error(
      '[DH-CLUB] Erro ao realizar sorteio:',
      error
    );


    try {

      const current =
        (
          await statusRef
            .once(
              'value'
            )
        )
          .val();


      if (
        current ===
        'DRAWING'
      ) {

        await statusRef
          .set(
            'WAITING'
          );
      }

    } catch {}


    closeModal();


    toast(
      'ERRO AO REALIZAR SORTEIO'
    );
  }
}
  
// ----------------------------------------------------------
// DETALHES / TRANSPARÊNCIA DO SORTEIO
// ----------------------------------------------------------

function showDrawDetails(
  drawId
) {

  const draw =
    club.draws?.[
      drawId
    ];


  if (!draw) {

    toast(
      'SORTEIO NÃO ENCONTRADO'
    );

    return;
  }


  const status =
    String(
      draw.status ||
      'WAITING'
    )
      .toUpperCase();


  const finished =
    status ===
    'DRAWN';


  const creator =
    draw.createdBy ||
    {};


  const responsible =
    draw.drawnBy ||
    {};


  const winners =
    objValues(
      draw.winners
    );


  const participantCount =
    finished

      ? Number(
          draw.participantCount ||
          objValues(
            draw.participants
          ).length ||
          0
        )

      : getDrawEligibleUsers(
          draw.filterType,
          draw.eventId
        ).length;


  const publicId =
    getDrawPublicId(
      draw
    );


  openModal(`

    <div class="eyebrow">

      TRANSPARÊNCIA DO SORTEIO

    </div>


    <h2>

      ${esc(
        draw.title ||
        'SORTEIO DH-CLUB'
      )}

    </h2>


    <div
      style="
        margin:12px 0;
        padding:12px;
        border-radius:10px;
        background:
          ${
            finished
              ? 'rgba(46,204,113,.10)'
              : 'rgba(255,193,7,.08)'
          };
        border:
          1px solid
          ${
            finished
              ? 'rgba(46,204,113,.30)'
              : 'rgba(255,193,7,.25)'
          };
      "
    >

      <div
        style="
          font-size:10px;
          font-weight:900;
          color:
            ${
              finished
                ? '#2ecc71'
                : 'var(--gold2)'
            };
        "
      >

        ${
          finished
            ? '✓ SORTEIO REGISTRADO'
            : 'AGUARDANDO REALIZAÇÃO'
        }

      </div>


      <div
        style="
          font-size:10px;
          color:var(--muted);
          margin-top:5px;
        "
      >

        ID PÚBLICO

      </div>


      <div
        style="
          font-size:14px;
          font-weight:900;
          margin-top:2px;
          word-break:break-word;
        "
      >

        ${esc(
          publicId
        )}

      </div>

    </div>


    <div
      class="premium-card"
      style="
        margin-top:10px;
      "
    >

      <div
        style="
          font-size:10px;
          line-height:1.9;
        "
      >

        <div>

          <b>
            STATUS:
          </b>

          ${
            finished
              ? 'ENCERRADO'
              : 'AGUARDANDO'
          }

        </div>


        <div>

          <b>
            PÚBLICO:
          </b>

          ${esc(
            drawFilterLabel(
              draw
            )
          )}

        </div>


        <div>

          <b>
            PARTICIPANTES:
          </b>

          ${participantCount}

        </div>


        <div>

          <b>
            Nº DE VENCEDORES:
          </b>

          ${Number(
            draw.winnersCount ||
            1
          )}

        </div>


        <div>

          <b>
            CRIADO EM:
          </b>

          ${esc(
            drawExactDateTime(
              draw.createdAt
            )
          )}

        </div>


        <div>

          <b>
            CRIADO POR:
          </b>

          ${esc(
            creator.name ||
            'ORGANIZAÇÃO'
          )}

          •

          ${esc(
            drawRoleLabel(
              creator.role
            )
          )}

        </div>


        ${
          draw.drawAt

            ? `

              <div>

                <b>
                  DATA PREVISTA:
                </b>

                ${esc(
                  drawExactDateTime(
                    draw.drawAt
                  )
                )}

              </div>

            `

            : ''
        }


        ${
          finished

            ? `

              <div>

                <b>
                  REALIZADO EM:
                </b>

                ${esc(
                  drawExactDateTime(
                    draw.drawnAt
                  )
                )}

              </div>


              <div>

                <b>
                  REALIZADO POR:
                </b>

                ${esc(
                  responsible.name ||
                  'ORGANIZAÇÃO'
                )}

                •

                ${esc(
                  drawRoleLabel(
                    responsible.role
                  )
                )}

              </div>


              <div>

                <b>
                  CICLO ANTI-REPETIÇÃO:
                </b>

                ${Number(
                  draw.cycleRound ||
                  1
                )}

              </div>


              <div>

                <b>
                  POOL DISPONÍVEL:
                </b>

                ${Number(
                  draw.antiRepeatPool ||
                  0
                )}

              </div>


              <div>

                <b>
                  MÉTODO ALEATÓRIO:
                </b>

                Web Crypto API

              </div>

            `

            : ''
        }

      </div>

    </div>


    ${
      finished &&
      winners.length

        ? `

          <div
            style="
              margin-top:12px;
              padding:14px;
              border-radius:10px;
              background:
                rgba(46,204,113,.10);
              border:
                1px solid
                rgba(46,204,113,.20);
            "
          >

            <div
              class="eyebrow"
              style="
                color:#2ecc71;
              "
            >

              🏆 RESULTADO OFICIAL

            </div>


            ${
              winners
                .map(
                  (
                    winner,
                    index
                  ) => `

                    <div
                      style="
                        margin-top:8px;
                        font-size:14px;
                        font-weight:900;
                      "
                    >

                      ${index + 1}º

                      ${esc(
                        winner.name ||
                        'ATLETA'
                      )}

                    </div>

                  `
                )
                .join('')
            }

          </div>

        `

        : ''
    }


    ${
      finished &&
      draw.auditHash

        ? `

          <div
            style="
              margin-top:12px;
              padding:12px;
              border-radius:10px;
              background:
                rgba(255,255,255,.04);
              border:
                1px solid
                rgba(255,255,255,.10);
            "
          >

            <div
              class="eyebrow"
            >

              CÓDIGO DE INTEGRIDADE

            </div>


            <div
              style="
                margin-top:7px;
                font-family:monospace;
                font-size:9px;
                line-height:1.6;
                word-break:break-all;
                color:var(--muted);
              "
            >

              ${esc(
                draw.auditHash
              )}

            </div>


            <p
              style="
                margin-top:8px;
                font-size:9px;
                color:var(--muted);
              "
            >

              SHA-256 gerado no momento
              da realização do sorteio.

            </p>

          </div>

        `

        : ''
    }


    <button
      class="secondary-btn"
      style="
        width:100%;
        margin-top:12px;
      "
      onclick="
        Club.showDrawParticipants(
          '${esc(draw.id)}'
        )
      "
    >

      <i class="fa-solid fa-users"></i>

      VER PARTICIPANTES

    </button>

  `);
}



// ----------------------------------------------------------
// MOSTRAR PARTICIPANTES
// ----------------------------------------------------------

function showDrawParticipants(
  drawId
) {

  const draw =
    club.draws?.[
      drawId
    ];


  if (!draw) {

    toast(
      'SORTEIO NÃO ENCONTRADO'
    );

    return;
  }


  const finished =
    String(
      draw.status ||
      ''
    )
      .toUpperCase() ===
      'DRAWN';


  let participants;


  if (
    finished &&
    draw.participants
  ) {

    // Depois do sorteio:
    // usa obrigatoriamente a lista congelada.

    participants =
      objValues(
        draw.participants
      );

  } else {

    // Antes:
    // mostra a lista elegível neste momento.

    participants =
      getDrawEligibleUsers(
        draw.filterType,
        draw.eventId
      )
        .map(
          drawPublicParticipant
        );
  }


    participants =
    participants
      .filter(Boolean)
      .sort(
        (
          a,
          b
        ) =>

          String(
            a.name ||
            a.nome ||
            ''
          )
            .localeCompare(
              String(
                b.name ||
                b.nome ||
                ''
              ),
              'pt-BR'
            )
      );


  openModal(`

    <div class="eyebrow">

      ${
        finished
          ? 'LISTA OFICIAL'
          : 'LISTA ATUAL'
      }

    </div>


    <h2>

      Participantes

    </h2>


    <p
      style="
        font-size:11px;
        color:var(--muted);
        margin-bottom:12px;
      "
    >

      ${participants.length}
      atleta(s)

      ${
        finished
          ? 'na lista congelada deste sorteio.'
          : 'elegível(is) neste momento.'
      }

    </p>


    ${
      !finished

        ? `

          <div
            style="
              padding:8px;
              margin-bottom:10px;
              border-radius:8px;
              background:
                rgba(255,193,7,.08);
              font-size:9px;
            "
          >

            A lista definitiva
            será congelada
            somente quando
            o sorteio for realizado.

          </div>

        `

        : ''
    }


    <div
      style="
        max-height:55vh;
        overflow:auto;
      "
    >

      ${
        participants.length

          ? participants
              .map(
                (
                  participant,
                  index
                ) => `

                  <div
                    style="
                      display:flex;
                      align-items:center;
                      gap:10px;
                      padding:10px 4px;
                      border-bottom:
                        1px solid
                        rgba(255,255,255,.08);
                    "
                  >

                    <div
                      style="
                        width:28px;
                        height:28px;
                        border-radius:50%;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        background:
                          rgba(255,255,255,.08);
                        font-size:10px;
                        font-weight:900;
                        flex-shrink:0;
                      "
                    >

                      ${index + 1}

                    </div>


                    <div
                      style="
                        flex:1;
                        min-width:0;
                      "
                    >

                      <div
                        style="
                          font-size:11px;
                          font-weight:900;
                        "
                      >

                        ${esc(
                          participant.name ||
                          participant.nome ||
                          'ATLETA'
                        )}

                      </div>


                      <div
                        style="
                          font-size:9px;
                          color:var(--muted);
                        "
                      >

                        ${esc(
                          participant.city ||
                          ''
                        )}

                        ${
                          participant.uf
                            ? ` - ${esc(participant.uf)}`
                            : ''
                        }

                        ${
                          participant.category
                            ? ` • ${esc(participant.category)}`
                            : ''
                        }

                      </div>

                    </div>

                  </div>

                `
              )
              .join('')

          : `

            <div class="empty">

              Nenhum atleta elegível.

            </div>

          `
      }


    </div>

  `);
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


if (
  view ===
  'games'
) {
  renderGames();
}

  if (
  view ===
  'draws'
) {

  renderDraws();
}


if (view === 'admin') {
  renderAdmin();
}
}


function go(view) {

  // ========================================================
  // FECHA TODAS AS TELAS
  // ========================================================

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


  // ========================================================
  // ABRE A TELA SOLICITADA
  // ========================================================

  const el =
    document.getElementById(
      'view-' + view
    );


  if (el) {

    el.classList.add(
      'active'
    );
  }


  // ========================================================
  // DEFINE QUAL BOTÃO INFERIOR FICA ATIVO
  //
  // Carreira, Conquistas, X1 e Admin
  // pertencem ao menu INÍCIO.
  // ========================================================

  const viewsDoInicio = [
    'home',
    'career',
    'achievements',
    'x1',
    'admin'
  ];


  const navView =
    viewsDoInicio.includes(view)

      ? 'home'

      : view;


  // ========================================================
  // ATUALIZA MENU INFERIOR
  // ========================================================

  document
    .querySelectorAll(
      '.club-nav-item'
    )
    .forEach(
      x =>
        x.classList.toggle(
          'active',
          x.dataset.view === navView
        )
    );


  // ========================================================
  // RENDERIZA A TELA
  // ========================================================

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
      display:flex;
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


  // ========================================================
  // RANKING OFICIAL DH-PE
  // ========================================================

  const officialRanking =
    typeof myOfficialRankingData ===
      'function'

      ? myOfficialRankingData()

      : null;


  // ========================================================
  // JORNADA ANUAL
  // ========================================================

  const goals =
    typeof annualGoals ===
      'function'

      ? annualGoals()

      : [];


  const completedGoals =
    goals.filter(
      goal =>
        goal.done
    ).length;


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

    officialRanking,

    goals,

    completedGoals,

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

    // ========================================================
  // DADOS OFICIAIS PARA OS NOVOS STORIES
  // ========================================================

  const o =
    d.officialRanking ||
    {};


  const goals =
    Array.isArray(
      d.goals
    )

      ? d.goals

      : [];


  const completedGoals =
    Number(
      d.completedGoals ||
      0
    );


  const annualProgress =
    goals.length

      ? Math.round(
          (
            completedGoals /
            goals.length
          ) * 100
        )

      : 0;


  const cityAthletesHtml =
    Array.isArray(
      o.cityAthletes
    )

      ? o.cityAthletes
          .slice(
            0,
            5
          )
          .map(
            (
              athlete,
              index
            ) => `

              <div
                style="
                  display:flex;
                  align-items:center;
                  justify-content:space-between;
                  gap:10px;
                  padding:10px 0;
                  border-bottom:
                    1px solid
                    rgba(255,255,255,.07);
                "
              >

                <div
                  style="
                    display:flex;
                    align-items:center;
                    gap:10px;
                    min-width:0;
                  "
                >

                  <div
                    style="
                      width:30px;
                      height:30px;
                      border-radius:10px;
                      display:flex;
                      align-items:center;
                      justify-content:center;
                      background:rgba(255,199,44,.10);
                      color:#ffc72c;
                      font-size:11px;
                      font-weight:1000;
                      flex-shrink:0;
                    "
                  >
                    ${index + 1}º
                  </div>


                  <div
                    style="
                      font-size:11px;
                      font-weight:900;
                      color:white;
                      white-space:nowrap;
                      overflow:hidden;
                      text-overflow:ellipsis;
                    "
                  >
                    ${
                      cleanCPF(
                        athlete.cpf
                      ) ===
                      cleanCPF(
                        loggedUser.cpf
                      )

                        ? 'VOCÊ'

                        : esc(
                            athlete.name ||
                            'ATLETA'
                          )
                    }
                  </div>

                </div>


                <div
                  style="
                    color:#ffc72c;
                    font-size:11px;
                    font-weight:1000;
                    white-space:nowrap;
                  "
                >
                  ${
                    Number(
                      athlete.totalPts ||
                      0
                    )
                  }
                  pts
                </div>

              </div>

            `
          )
          .join('')

      : '';

  // ========================================================
  // DETALHAMENTO DOS PONTOS POR ETAPA
  // ========================================================

  const pointsByEvent =
    Array.isArray(
      o.pointsByEvent
    )

      ? o.pointsByEvent

      : [];


  const bestPointsEvent =
    pointsByEvent.length

      ? pointsByEvent
          .slice()
          .sort(
            (
              a,
              b
            ) =>
              Number(
                b.totalPts || 0
              ) -
              Number(
                a.totalPts || 0
              )
          )[0]

      : null;


  const pointsByEventHtml =
    pointsByEvent
      .slice(
        0,
        5
      )
      .map(
        (
          item,
          index
        ) => `

          <div
            style="
              padding:12px 0;
              border-bottom:
                1px solid
                rgba(255,255,255,.07);
            "
          >

            <div
              style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:10px;
              "
            >

              <div
                style="
                  font-size:11px;
                  font-weight:1000;
                  color:white;
                "
              >

                ${esc(
                  item.eventName ||
                  `ETAPA ${index + 1}`
                )}

              </div>


              <div
                style="
                  color:#ffc72c;
                  font-size:14px;
                  font-weight:1000;
                  white-space:nowrap;
                "
              >

                ${
                  Number(
                    item.totalPts ||
                    0
                  )
                }
                pts

              </div>

            </div>


            <div
              style="
                margin-top:6px;
                display:flex;
                gap:12px;
                flex-wrap:wrap;
                font-size:9px;
                color:#93a1b5;
              "
            >

              <span>

                OFICIAL:
                <b style="color:white">

                  ${
                    Number(
                      item.officialPts ||
                      0
                    )
                  }

                </b>

              </span>


              <span>

                CLASSIFICATÓRIA:
                <b style="color:white">

                  ${
                    Number(
                      item.qualifyPts ||
                      0
                    )
                  }

                </b>

              </span>

            </div>

          </div>

        `
      )
      .join('');
  

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



  // ========================================================
// ETAPAS OFICIAIS JÁ ENCERRADAS
// ========================================================

const closedEvents =
  core.events
    .filter(
      event =>

        isOfficialScoringEvent(
          event
        ) &&

        String(
          event.status || ''
        )
          .toUpperCase() ===
          'CLOSED'
    )
    .length;


// ========================================================
// PERCENTUAL DE PRESENÇA NA TEMPORADA
// ========================================================

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
    // NOVO STORY — PONTOS OFICIAIS
    // ======================================================

    `

      <div class="wrapped-slide">

        <div class="wrapped-eyebrow">
          PONTUAÇÃO OFICIAL
        </div>


        <h1 class="wrapped-title">

          SEUS PONTOS<br>
          NA TEMPORADA.

        </h1>


        <div class="wrapped-rank-box">

          <div class="wrapped-hero-number">

            ${
              Number(
                o.totalPts ||
                0
              )
            }

          </div>


          <div class="wrapped-big-label">
            PONTOS DH-PE
          </div>

        </div>


        <div class="wrapped-grid">

          <div class="wrapped-card green">

            <small>
              DESCIDA OFICIAL
            </small>

            <b>
              ${
                Number(
                  o.officialPts ||
                  0
                )
              }
            </b>

          </div>


          <div class="wrapped-card gold">

            <small>
              CLASSIFICATÓRIA
            </small>

            <b>
              ${
                Number(
                  o.qualifyPts ||
                  0
                )
              }
            </b>

          </div>

        </div>


        <div
          class="wrapped-subtitle"
          style="margin-top:22px"
        >

          Pontuação calculada com
          os valores oficiais configurados
          em cada etapa do campeonato.

        </div>

      </div>

    `,


        // ======================================================
    // NOVO STORY — DE ONDE VIERAM OS PONTOS
    // ======================================================

    `

      <div class="wrapped-slide">

        <div class="wrapped-eyebrow">
          SUA PONTUAÇÃO
        </div>


        <h1 class="wrapped-title">

          DE ONDE VIERAM<br>
          SEUS PONTOS?

        </h1>


        <div
          class="wrapped-card"
          style="
            margin-top:18px;
            padding:16px;
          "
        >

          ${
            pointsByEventHtml ||

            `

              <div
                class="wrapped-subtitle"
                style="
                  padding:18px 0;
                "
              >

                Ainda não há pontuação
                por etapa disponível.

              </div>

            `
          }

        </div>


        ${
          pointsByEvent.length > 5

            ? `

              <div
                class="wrapped-subtitle"
                style="
                  margin-top:10px;
                  text-align:center;
                "
              >

                + ${
                  pointsByEvent.length - 5
                } etapa(s)
                com pontuação.

              </div>

            `

            : ''
        }


        ${
          bestPointsEvent

            ? `

              <div
                class="wrapped-rank-box"
                style="
                  margin-top:16px;
                "
              >

                <div class="wrapped-subtitle">
                  ETAPA QUE MAIS RENDEU PONTOS
                </div>


                <div
                  style="
                    margin-top:8px;
                    color:white;
                    font-size:17px;
                    font-weight:1000;
                  "
                >

                  ${esc(
                    bestPointsEvent.eventName ||
                    'ETAPA'
                  )}

                </div>


                <div
                  class="wrapped-hero-number"
                  style="
                    font-size:53px;
                    margin-top:7px;
                  "
                >

                  ${
                    Number(
                      bestPointsEvent.totalPts ||
                      0
                    )
                  }

                </div>


                <div class="wrapped-big-label">
                  PONTOS
                </div>

              </div>

            `

            : ''
        }

      </div>

    `,
    

    // ======================================================
    // NOVO STORY — RANKING OFICIAL
    // ======================================================

    `

      <div class="wrapped-slide">

        <div class="wrapped-eyebrow">
          RANKING OFICIAL
        </div>


        <h1 class="wrapped-title">

          ONDE SEUS PONTOS<br>
          TE COLOCARAM.

        </h1>


        <div class="wrapped-grid">

          <div class="wrapped-card gold">

            <small>
              ${esc(d.category)}
            </small>

            <b>
              ${
                o.categoryPosition
                  ? `${o.categoryPosition}º`
                  : '—'
              }
            </b>

            <div class="wrapped-subtitle">

              de
              ${
                o.categoryTotal ||
                0
              }
              atletas

            </div>

          </div>


          <div class="wrapped-card">

            <small>
              GERAL
            </small>

            <b>
              ${
                o.generalPosition
                  ? `${o.generalPosition}º`
                  : '—'
              }
            </b>

            <div class="wrapped-subtitle">

              de
              ${
                o.generalTotal ||
                0
              }
              registros

            </div>

          </div>

        </div>


        <div class="wrapped-rank-box">

          <div class="wrapped-subtitle">
            PONTUAÇÃO ACUMULADA
          </div>


          <div
            class="wrapped-hero-number"
            style="font-size:60px"
          >
            ${
              Number(
                o.totalPts ||
                0
              )
            }
          </div>


          <div class="wrapped-big-label">
            PTS
          </div>

        </div>

      </div>

    `,


    // ======================================================
    // NOVO STORY — MINHA CIDADE
    // ======================================================

    `

      <div class="wrapped-slide">

        <div class="wrapped-eyebrow">
          SUA CIDADE
        </div>


        <h1 class="wrapped-title">

          VOCÊ TAMBÉM<br>
          REPRESENTOU.

        </h1>


        <div class="wrapped-rank-box">

          <div
            style="
              color:#ffc72c;
              font-size:13px;
              font-weight:900;
              letter-spacing:1px;
            "
          >

            <i class="fa-solid fa-location-dot"></i>

            ${esc(
              o.city ||
              loggedUser.city ||
              'CIDADE NÃO INFORMADA'
            )}

          </div>


          <div
            class="wrapped-hero-number"
            style="
              margin-top:18px;
            "
          >

            ${
              o.athleteCityPosition
                ? `${o.athleteCityPosition}º`
                : '—'
            }

          </div>


          <div class="wrapped-big-label">

            DE
            ${
              o.athleteCityTotal ||
              0
            }
            ATLETAS DA CIDADE

          </div>

        </div>


        <div
          class="wrapped-card gold"
          style="margin-top:16px"
        >

          <small>
            SEUS PONTOS
          </small>

          <b>
            ${
              Number(
                o.athleteCityPoints ||
                o.totalPts ||
                0
              )
            }
            pts
          </b>

        </div>

      </div>

    `,


    // ======================================================
    // NOVO STORY — FORÇA DA CIDADE
    // ======================================================

    `

      <div class="wrapped-slide">

        <div class="wrapped-eyebrow">
          FORÇA DA CIDADE
        </div>


        <h1 class="wrapped-title">

          SOMANDO FORÇAS<br>
          NA TEMPORADA.

        </h1>


        <div class="wrapped-rank-box">

          <div class="wrapped-subtitle">

            ${esc(
              o.city ||
              loggedUser.city ||
              'SUA CIDADE'
            )}

          </div>


          <div
            class="wrapped-hero-number"
            style="
              font-size:58px;
              margin-top:12px;
            "
          >

            ${
              Number(
                o.cityPoints ||
                0
              )
            }

          </div>


          <div class="wrapped-big-label">
            PONTOS SOMADOS
          </div>

        </div>


        <div class="wrapped-grid">

          <div class="wrapped-card gold">

            <small>
              RANKING DAS CIDADES
            </small>

            <b>
              ${
                o.cityPosition
                  ? `${o.cityPosition}º`
                  : '—'
              }
            </b>

            <div class="wrapped-subtitle">

              de
              ${
                o.cityTotal ||
                0
              }

            </div>

          </div>


          <div class="wrapped-card green">

            <small>
              ATLETAS PONTUADORES
            </small>

            <b>
              ${
                o.cityAthleteCount ||
                0
              }
            </b>

          </div>

        </div>

      </div>

    `,


    // ======================================================
    // NOVO STORY — ATLETAS DA CIDADE
    // ======================================================

    `

      <div class="wrapped-slide">

        <div class="wrapped-eyebrow">
          SUA EQUIPE DE CIDADE
        </div>


        <h1 class="wrapped-title">

          QUEM SOMOU<br>
          JUNTO COM VOCÊ.

        </h1>


        <div
          class="wrapped-card"
          style="
            margin-top:20px;
            padding:16px;
          "
        >

          <div
            style="
              color:#ffc72c;
              font-size:10px;
              font-weight:1000;
              letter-spacing:1px;
              margin-bottom:5px;
            "
          >

            ${esc(
              o.city ||
              loggedUser.city ||
              'CIDADE'
            )}

          </div>


          ${
            cityAthletesHtml ||

            `

              <div
                class="wrapped-subtitle"
                style="
                  padding:18px 0;
                "
              >

                Ainda não há atletas
                pontuadores suficientes
                para montar esta lista.

              </div>

            `
          }

        </div>


        <div
          class="wrapped-subtitle"
          style="
            margin-top:18px;
          "
        >

          Os pontos individuais também
          ajudam a construir a força
          esportiva da sua cidade.

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
// COMPARTILHAR TEMPORADA
// ==========================================================

async function shareWrapped() {

  const d =
    wrappedData();


  const s =
    d.stats;


  const c =
    d.comparison;


  const texto =
`🏁 MINHA TEMPORADA DH-PE ${SYSTEM_YEAR}

🚵 ${s.races} etapas disputadas
⭐ ${s.podiums} resultados em TOP 5
🏆 ${s.wins} vitória(s)
⏱️ Melhor tempo: ${bestTimeLabel(s.best)}
📊 Melhor posição: ${
  c?.bestPosition
    ? `${c.bestPosition}º`
    : '—'
}

${
  c?.categoryPosition

    ? `🔥 ${c.categoryPosition}º de ${c.categoryTotal} na ${d.category}`

    : ''
}

Mais que uma pista, uma comunidade.
DH-PE • Downhill Pernambuco`;


  try {

    if (
      navigator.share
    ) {

      await navigator.share({

        title:
          `Minha temporada DH-PE ${SYSTEM_YEAR}`,

        text:
          texto

      });


      return;
    }


    if (
      navigator.clipboard
    ) {

      await navigator.clipboard
        .writeText(
          texto
        );


      toast(
        'RETROSPECTIVA COPIADA!'
      );


      return;
    }


    alert(
      texto
    );


  } catch (err) {

    if (
      err &&
      err.name ===
        'AbortError'
    ) {

      return;
    }


    console.error(
      '[DH-CLUB] Erro ao compartilhar:',
      err
    );


    alert(
      texto
    );
  }
}

// ==========================================================
// IMAGEM COMPARTILHÁVEL DA TEMPORADA
// ==========================================================

function shareRoundRect(
  ctx,
  x,
  y,
  width,
  height,
  radius
) {

  const r =
    Math.min(
      radius,
      width / 2,
      height / 2
    );


  ctx.beginPath();

  ctx.moveTo(
    x + r,
    y
  );

  ctx.lineTo(
    x + width - r,
    y
  );

  ctx.quadraticCurveTo(
    x + width,
    y,
    x + width,
    y + r
  );

  ctx.lineTo(
    x + width,
    y + height - r
  );

  ctx.quadraticCurveTo(
    x + width,
    y + height,
    x + width - r,
    y + height
  );

  ctx.lineTo(
    x + r,
    y + height
  );

  ctx.quadraticCurveTo(
    x,
    y + height,
    x,
    y + height - r
  );

  ctx.lineTo(
    x,
    y + r
  );

  ctx.quadraticCurveTo(
    x,
    y,
    x + r,
    y
  );

  ctx.closePath();
}


// ==========================================================
// AJUSTA TEXTO PARA NÃO ESTOURAR O CARD
// ==========================================================

function shareFitText(
  ctx,
  text,
  maxWidth,
  startSize,
  minSize = 28
) {

  let size =
    startSize;


  while (
    size > minSize
  ) {

    ctx.font =
      `900 ${size}px Arial`;


    if (
      ctx.measureText(
        text
      ).width <= maxWidth
    ) {

      break;
    }


    size -=
      2;
  }


  ctx.font =
    `900 ${size}px Arial`;


  return size;
}


// ==========================================================
// CARREGA FOTO DO ATLETA
// ==========================================================

function loadWrappedSharePhoto(
  src
) {

  return new Promise(
    resolve => {

      if (!src) {

        resolve(
          null
        );

        return;
      }


      const img =
        new Image();


      let finished =
        false;


      const finish =
        result => {

          if (finished) {

            return;
          }


          finished =
            true;


          clearTimeout(
            timer
          );


          resolve(
            result
          );
        };


      try {

        if (
          /^https?:/i.test(
            src
          )
        ) {

          img.crossOrigin =
            'anonymous';
        }

      } catch {}


      img.onload =
        () =>
          finish(
            img
          );


      img.onerror =
        () =>
          finish(
            null
          );


      const timer =
        setTimeout(
          () =>
            finish(
              null
            ),
          5000
        );


      img.src =
        src;
    }
  );
}


// ==========================================================
// DESENHA FOTO CIRCULAR
// ==========================================================

function drawWrappedSharePhoto(
  ctx,
  img,
  x,
  y,
  size,
  name
) {

  ctx.save();


  ctx.beginPath();

  ctx.arc(
    x + size / 2,
    y + size / 2,
    size / 2,
    0,
    Math.PI * 2
  );

  ctx.closePath();

  ctx.clip();


  if (img) {

    const scale =
      Math.max(
        size / img.width,
        size / img.height
      );


    const width =
      img.width *
      scale;


    const height =
      img.height *
      scale;


    ctx.drawImage(
      img,

      x +
      (
        size -
        width
      ) / 2,

      y +
      (
        size -
        height
      ) / 2,

      width,

      height
    );

  } else {

    const gradient =
      ctx.createLinearGradient(
        x,
        y,
        x + size,
        y + size
      );


    gradient.addColorStop(
      0,
      '#16385d'
    );


    gradient.addColorStop(
      1,
      '#06111f'
    );


    ctx.fillStyle =
      gradient;


    ctx.fillRect(
      x,
      y,
      size,
      size
    );


    ctx.fillStyle =
      '#ffc72c';


    ctx.textAlign =
      'center';


    ctx.textBaseline =
      'middle';


    ctx.font =
      '900 72px Arial';


    ctx.fillText(
      initials(
        name
      ),
      x + size / 2,
      y + size / 2
    );
  }


  ctx.restore();


  ctx.beginPath();

  ctx.arc(
    x + size / 2,
    y + size / 2,
    size / 2 + 5,
    0,
    Math.PI * 2
  );


  ctx.strokeStyle =
    '#ffc72c';


  ctx.lineWidth =
    10;


  ctx.stroke();
}


// ==========================================================
// CARD DE NÚMERO
// ==========================================================

function drawWrappedShareStat(
  ctx,
  x,
  y,
  width,
  label,
  value,
  gold = false
) {

  shareRoundRect(
    ctx,
    x,
    y,
    width,
    150,
    28
  );


  ctx.fillStyle =
    gold
      ? 'rgba(255,199,44,.11)'
      : 'rgba(255,255,255,.055)';


  ctx.fill();


  ctx.strokeStyle =
    gold
      ? 'rgba(255,199,44,.28)'
      : 'rgba(255,255,255,.10)';


  ctx.lineWidth =
    2;


  ctx.stroke();


  ctx.textAlign =
    'left';


  ctx.textBaseline =
    'alphabetic';


  ctx.fillStyle =
    '#8d9caf';


  ctx.font =
    '900 22px Arial';


  ctx.fillText(
    label,
    x + 30,
    y + 45
  );


  ctx.fillStyle =
    gold
      ? '#ffc72c'
      : '#ffffff';


  shareFitText(
    ctx,
    String(value),
    width - 60,
    48,
    27
  );


  ctx.fillText(
    String(value),
    x + 30,
    y + 112
  );
}


// ==========================================================
// GERA O CARD 1080 x 1920
// ==========================================================

async function generateWrappedShareImage() {

  const d =
    wrappedData();


  const s =
    d.stats;


  const c =
    d.comparison;


  const canvas =
    document.createElement(
      'canvas'
    );


  canvas.width =
    1080;


  canvas.height =
    1920;


  const ctx =
    canvas.getContext(
      '2d'
    );


  // ========================================================
  // FUNDO
  // ========================================================

  const bg =
    ctx.createLinearGradient(
      0,
      0,
      1080,
      1920
    );


  bg.addColorStop(
    0,
    '#091c33'
  );


  bg.addColorStop(
    .48,
    '#04111f'
  );


  bg.addColorStop(
    1,
    '#010711'
  );


  ctx.fillStyle =
    bg;


  ctx.fillRect(
    0,
    0,
    1080,
    1920
  );


  // ========================================================
  // LUZ AZUL
  // ========================================================

  const blue =
    ctx.createRadialGradient(
      120,
      320,
      0,
      120,
      320,
      700
    );


  blue.addColorStop(
    0,
    'rgba(27,105,255,.32)'
  );


  blue.addColorStop(
    1,
    'rgba(27,105,255,0)'
  );


  ctx.fillStyle =
    blue;


  ctx.fillRect(
    0,
    0,
    1080,
    1050
  );


  // ========================================================
  // LUZ DOURADA
  // ========================================================

  const goldGlow =
    ctx.createRadialGradient(
      980,
      500,
      0,
      980,
      500,
      520
    );


  goldGlow.addColorStop(
    0,
    'rgba(255,199,44,.22)'
  );


  goldGlow.addColorStop(
    1,
    'rgba(255,199,44,0)'
  );


  ctx.fillStyle =
    goldGlow;


  ctx.fillRect(
    400,
    0,
    680,
    1050
  );


  // ========================================================
  // GRID DISCRETO
  // ========================================================

  ctx.strokeStyle =
    'rgba(255,255,255,.025)';


  ctx.lineWidth =
    1;


  for (
    let x = 0;
    x <= 1080;
    x += 72
  ) {

    ctx.beginPath();

    ctx.moveTo(
      x,
      0
    );

    ctx.lineTo(
      x,
      1920
    );

    ctx.stroke();
  }


  for (
    let y = 0;
    y <= 1920;
    y += 72
  ) {

    ctx.beginPath();

    ctx.moveTo(
      0,
      y
    );

    ctx.lineTo(
      1080,
      y
    );

    ctx.stroke();
  }


  // ========================================================
  // SILHUETA DE MONTANHAS
  // ========================================================

  ctx.beginPath();

  ctx.moveTo(
    0,
    1540
  );

  ctx.lineTo(
    150,
    1360
  );

  ctx.lineTo(
    300,
    1460
  );

  ctx.lineTo(
    505,
    1190
  );

  ctx.lineTo(
    690,
    1415
  );

  ctx.lineTo(
    855,
    1250
  );

  ctx.lineTo(
    1080,
    1480
  );

  ctx.lineTo(
    1080,
    1920
  );

  ctx.lineTo(
    0,
    1920
  );

  ctx.closePath();


  const mountains =
    ctx.createLinearGradient(
      0,
      1180,
      0,
      1920
    );


  mountains.addColorStop(
    0,
    'rgba(14,48,76,.55)'
  );


  mountains.addColorStop(
    1,
    'rgba(1,7,17,.98)'
  );


  ctx.fillStyle =
    mountains;


  ctx.fill();


  // ========================================================
  // FAIXA DE CORES
  // ========================================================

  ctx.fillStyle =
    '#176cff';


  ctx.fillRect(
    70,
    74,
    130,
    9
  );


  ctx.fillStyle =
    '#ffc72c';


  ctx.fillRect(
    200,
    74,
    130,
    9
  );


  ctx.fillStyle =
    '#35d48a';


  ctx.fillRect(
    330,
    74,
    130,
    9
  );


  // ========================================================
  // CABEÇALHO
  // ========================================================

  ctx.textAlign =
    'left';


  ctx.fillStyle =
    '#ffffff';


  ctx.font =
    '900 44px Arial';


  ctx.fillText(
    'DH★PE',
    70,
    150
  );


  ctx.textAlign =
    'right';


  ctx.fillStyle =
    '#ffc72c';


  ctx.font =
    '900 25px Arial';


  ctx.fillText(
    `TEMPORADA ${SYSTEM_YEAR}`,
    1010,
    148
  );


  // ========================================================
  // TÍTULO
  // ========================================================

  ctx.textAlign =
    'left';


  ctx.fillStyle =
    '#ffc72c';


  ctx.font =
    '900 23px Arial';


  ctx.fillText(
    'MINHA RETROSPECTIVA',
    70,
    245
  );


  ctx.fillStyle =
    '#ffffff';


  ctx.font =
    '900 77px Arial';


  ctx.fillText(
    'ESSA TEMPORADA',
    70,
    335
  );


  ctx.fillText(
    'É MINHA.',
    70,
    415
  );


  // ========================================================
  // FOTO + ATLETA
  // ========================================================

  const photo =
    await loadWrappedSharePhoto(
      d.photo
    );


  drawWrappedSharePhoto(
    ctx,
    photo,
    70,
    500,
    230,
    d.name
  );


  ctx.textAlign =
    'left';


  ctx.fillStyle =
    '#ffffff';


  shareFitText(
    ctx,
    String(
      d.name
    ).toUpperCase(),
    665,
    55,
    31
  );


  ctx.fillText(
    String(
      d.name
    ).toUpperCase(),
    345,
    585
  );


  ctx.fillStyle =
    '#ffc72c';


  shareFitText(
    ctx,
    d.category,
    660,
    30,
    22
  );


  ctx.fillText(
    d.category,
    345,
    635
  );


  ctx.fillStyle =
    '#8d9caf';


  ctx.font =
    '700 22px Arial';


  ctx.fillText(
    'ATLETA DH-PE',
    345,
    680
  );


  // ========================================================
  // ESTATÍSTICAS
  // ========================================================

  drawWrappedShareStat(
    ctx,
    70,
    800,
    450,
    'ETAPAS',
    s.races
  );


  drawWrappedShareStat(
    ctx,
    560,
    800,
    450,
    'TOP 5',
    s.podiums,
    true
  );


  drawWrappedShareStat(
    ctx,
    70,
    975,
    450,
    'MELHOR TEMPO',
    bestTimeLabel(
      s.best
    ),
    true
  );


  drawWrappedShareStat(
    ctx,
    560,
    975,
    450,
    'MELHOR POSIÇÃO',
    c?.bestPosition
      ? `${c.bestPosition}º`
      : '—'
  );


  // ========================================================
  // CLASSIFICAÇÃO
  // ========================================================

  shareRoundRect(
    ctx,
    70,
    1170,
    940,
    270,
    34
  );


  ctx.fillStyle =
    'rgba(255,199,44,.075)';


  ctx.fill();


  ctx.strokeStyle =
    'rgba(255,199,44,.25)';


  ctx.lineWidth =
    2;


  ctx.stroke();


  ctx.textAlign =
    'left';


  ctx.fillStyle =
    '#ffc72c';


  ctx.font =
    '900 22px Arial';


  ctx.fillText(
    'CLASSIFICAÇÃO COMPARATIVA',
    110,
    1228
  );


  ctx.fillStyle =
    '#ffffff';


  ctx.font =
    '900 64px Arial';


  ctx.fillText(
    c?.categoryPosition
      ? `${c.categoryPosition}º`
      : '—',
    110,
    1320
  );


  ctx.font =
    '900 29px Arial';


  ctx.fillText(
    `DE ${c?.categoryTotal || 0} NA ${d.category}`,
    280,
    1315
  );


  ctx.fillStyle =
    '#8d9caf';


  ctx.font =
    '700 22px Arial';


  ctx.fillText(
    `À frente de ${
      Math.round(
        c?.categoryBeatPct ||
        0
      )
    }% dos atletas da categoria`,
    110,
    1370
  );


  if (
    c?.generalPosition
  ) {

    ctx.fillText(
      `Geral: ${c.generalPosition}º de ${c.generalTotal || 0} atletas`,
      110,
      1410
    );
  }


  // ========================================================
  // CONQUISTAS
  // ========================================================

  ctx.fillStyle =
    '#ffffff';


  ctx.font =
    '900 30px Arial';


  ctx.fillText(
    `${d.unlocked.length} CONQUISTAS DESBLOQUEADAS`,
    70,
    1535
  );


  ctx.fillStyle =
    '#ffc72c';


  ctx.fillRect(
    70,
    1570,
    Math.min(
      940,
      100 +
      d.unlocked.length *
      70
    ),
    9
  );


  // ========================================================
  // FRASE FINAL
  // ========================================================

  ctx.fillStyle =
    '#ffffff';


  ctx.font =
    '900 40px Arial';


  ctx.fillText(
    'MAIS QUE UMA PISTA,',
    70,
    1690
  );


  ctx.fillStyle =
    '#ffc72c';


  ctx.fillText(
    'UMA COMUNIDADE.',
    70,
    1740
  );


  ctx.fillStyle =
    '#7f90a6';


  ctx.font =
    '700 18px Arial';


  ctx.fillText(
    'Comparativo DH-Club baseado nos resultados oficiais registrados.',
    70,
    1810
  );


  ctx.fillStyle =
    '#ffffff';


  ctx.font =
    '900 24px Arial';


  ctx.fillText(
    'DH-PE • DOWNHILL PERNAMBUCO',
    70,
    1870
  );


  return canvas;
}


// ==========================================================
// NOME DO ARQUIVO
// ==========================================================

function wrappedShareFileName() {

  const name =
    String(
      loggedUser?.nome ||
      'atleta'
    )
      .normalize(
        'NFD'
      )
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        '-'
      )
      .replace(
        /^-|-$/g,
        ''
      );


  return (
    `temporada-dhpe-${SYSTEM_YEAR}-${name || 'atleta'}.png`
  );
}


// ==========================================================
// COMPARTILHAR IMAGEM
// ==========================================================

async function shareWrapped() {

  const d =
    wrappedData();


  const s =
    d.stats;


  const c =
    d.comparison;


  const texto =
`🏁 MINHA TEMPORADA DH-PE ${SYSTEM_YEAR}

🚵 ${s.races} etapas
⭐ ${s.podiums} resultados no Top 5
⏱️ Melhor tempo: ${bestTimeLabel(s.best)}
📊 Melhor posição: ${
  c?.bestPosition
    ? `${c.bestPosition}º`
    : '—'
}

${
  c?.categoryPosition

    ? `🔥 ${c.categoryPosition}º de ${c.categoryTotal} na ${d.category}`

    : ''
}

Mais que uma pista, uma comunidade.
DH-PE • Downhill Pernambuco`;


  try {

    toast(
      'CRIANDO SUA ARTE…'
    );


    const canvas =
      await generateWrappedShareImage();


    const blob =
      await new Promise(
        (
          resolve,
          reject
        ) => {

          canvas.toBlob(
            result => {

              if (result) {

                resolve(
                  result
                );

              } else {

                reject(
                  new Error(
                    'Falha ao criar PNG.'
                  )
                );
              }

            },

            'image/png'
          );
        }
      );


    const fileName =
      wrappedShareFileName();


    const file =
      new File(
        [
          blob
        ],

        fileName,

        {
          type:
            'image/png'
        }
      );


    // ======================================================
    // CELULAR
    // ======================================================

    if (
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({
        files: [
          file
        ]
      })
    ) {

      await navigator.share({

        title:
          `Minha temporada DH-PE ${SYSTEM_YEAR}`,

        text:
          texto,

        files: [
          file
        ]

      });


      return;
    }


    // ======================================================
    // PC / FALLBACK
    // ======================================================

    const url =
      URL.createObjectURL(
        blob
      );


    const link =
      document.createElement(
        'a'
      );


    link.href =
      url;


    link.download =
      fileName;


    document.body.appendChild(
      link
    );


    link.click();


    link.remove();


    setTimeout(
      () => {

        URL.revokeObjectURL(
          url
        );

      },
      3000
    );


    toast(
      'ARTE DA TEMPORADA CRIADA!'
    );


  } catch (err) {

    if (
      err?.name ===
      'AbortError'
    ) {

      return;
    }


    console.error(
      '[DH-CLUB] Erro ao gerar arte:',
      err
    );


    toast(
      'ERRO AO CRIAR A ARTE'
    );
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
      raw?.training_presence || {},

    memory_game:
  raw?.memory_game || {},


draws:
  raw?.draws || {},


draw_cycles:
  raw?.draw_cycles || {}

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

  startMemoryGame,

  flipMemoryCard,

  openNewDraw,

changeDrawFilter,

updateDrawPreview,

createDraw,

  confirmDraw,

performDraw,

showDrawDetails,

showDrawParticipants,

  closeModal,

  setAchievementFilter,

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
