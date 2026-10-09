const { onValueCreated } = require("firebase-functions/v2/database");
const {
    onRequest,
    onCall,
    HttpsError
} = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { defineSecret } = require("firebase-functions/params");

const {
    initializeApp,
    applicationDefault
} = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");
const { getDatabase } = require("firebase-admin/database");
const crypto = require("node:crypto");

initializeApp({
    credential: applicationDefault(),
    projectId: "fpc-per",
    databaseURL: "https://fpc-per-default-rtdb.firebaseio.com"
});


// ==========================================================
// 1. PUSH NOTIFICATIONS
// ==========================================================

exports.processarPushQueueRtdbV2 = onValueCreated(
    "/push_queue/{pushId}",
    async (event) => {

        const snap = event.data;
        const item = snap.val();

        // Ignora registros inválidos
        if (
            !item ||
            !item.token ||
            !item.title ||
            !item.body
        ) {

            await snap.ref.update({
                status: "error",
                error: "Payload inválido: token, title e body são obrigatórios.",
                processedAt: Date.now()
            });

            return;
        }

        // Só processa itens pendentes
        if (
            item.status &&
            item.status !== "pending"
        ) {
            return;
        }

        try {

            const messageId = await getMessaging().send({

                token: String(item.token),

                // DATA-ONLY:
                // quem monta a notificação visual é seu sw.js.
                data: {
                    title: String(item.title),
                    body: String(item.body),
                    url: "/"
                },

                webpush: {
                    headers: {
                        Urgency: "high"
                    }
                }
            });

            // Marca como enviado.
            await snap.ref.update({
                status: "sent",
                messageId: messageId,
                processedAt: Date.now(),
                error: null
            });

            logger.info(
                "Push enviado com sucesso",
                {
                    pushId: event.params.pushId,
                    messageId: messageId
                }
            );

        } catch (error) {

            logger.error(
                "Falha ao enviar Push",
                error
            );

            await snap.ref.update({
                status: "error",
                error:
                    error && error.message
                        ? error.message
                        : String(error),
                processedAt: Date.now()
            });
        }
    }
);


// ==========================================================
// 2. GOOGLE SHEETS -> RESULTADOS DH-PE
// ==========================================================

const SHEETS_SYNC_KEY = defineSecret("SHEETS_SYNC_KEY");

const SHEETS_WEBAPP_URL =
    defineSecret("SHEETS_WEBAPP_URL");

// Banco da temporada 2026 usado atualmente pelo DH-PE.
const DHPE_DB_KEY_2026 = "dhpe_v25_final_stable_fix";


// ==========================================================
// 3. FUNÇÕES AUXILIARES
// ==========================================================

function limparCpf(valor) {

    let cpf = String(valor || "")
        .replace(/\D/g, "");

    // Caso alguma origem remova zero inicial.
    if (cpf.length < 11) {
        cpf = cpf.padStart(11, "0");
    }

    return cpf;
}


function formatarCpf(cpf) {

    const limpo = limparCpf(cpf);

    if (limpo.length !== 11) {
        return String(cpf || "").trim();
    }

    return limpo.replace(
        /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
        "$1.$2.$3-$4"
    );
}


function normalizarCategoria(cat) {

    let c = String(cat || "")
        .toUpperCase()
        .trim();

    if (!c) {
        return "GERAL";
    }

    if (c === "OPEN") {
        return "OPEN (EXTRA)";
    }

    if (c === "ESTREANTE") {
        return "ESTREANTE (EXTRA)";
    }

    if (
        c === "RÍGIDA" ||
        c === "RIGIDA"
    ) {
        return "RÍGIDA (EXTRA)";
    }

    if (c === "E-BIKE") {
        return "E-BIKE (EXTRA)";
    }

    if (c === "PCD") {
        return "PCD (EXTRA)";
    }

    return c;
}


function converterTipoVolta(tipo) {

    const t = String(tipo || "")
        .toLowerCase()
        .trim();

    if (
        t === "oficial" ||
        t === "1st" ||
        t === "1ª descida" ||
        t === "1a descida"
    ) {
        return "1st";
    }

    if (
        t === "qualify" ||
        t === "classificatória" ||
        t === "classificatoria"
    ) {
        return "qualify";
    }

    if (
        t === "segunda" ||
        t === "2nd" ||
        t === "2ª descida" ||
        t === "2a descida"
    ) {
        return "2nd";
    }

    return null;
}


function transformarEmArray(valor) {

    if (Array.isArray(valor)) {
        return valor;
    }

    if (
        valor &&
        typeof valor === "object"
    ) {
        return Object.values(valor);
    }

    return [];
}


function encontrarEvento(eventosRaw, eventId) {

    const eventos = transformarEmArray(eventosRaw);

    return eventos.find(
        evento =>
            evento &&
            String(evento.id) === String(eventId)
    ) || null;
}


function encontrarAtleta(usuariosRaw, cpfLimpo) {

    const usuarios = transformarEmArray(usuariosRaw);

    return usuarios.find(
        usuario =>
            usuario &&
            limparCpf(usuario.cpf) === cpfLimpo
    ) || null;
}


function normalizarTemposComChaves(temposRaw) {

    const itens = [];

    if (Array.isArray(temposRaw)) {

        temposRaw.forEach((tempo, indice) => {

            if (tempo) {
                itens.push({
                    key: String(indice),
                    value: tempo
                });
            }
        });

        return itens;
    }

    if (
        temposRaw &&
        typeof temposRaw === "object"
    ) {

        Object.entries(temposRaw)
            .forEach(([key, value]) => {

                if (value) {
                    itens.push({
                        key: String(key),
                        value: value
                    });
                }
            });
    }

    return itens;
}


function primeiroIndiceNumericoLivre(itens) {

    const usados = new Set();

    itens.forEach(item => {

        if (/^\d+$/.test(item.key)) {
            usados.add(Number(item.key));
        }
    });

    let indice = 0;

    while (usados.has(indice)) {
        indice++;
    }

    return indice;
}


async function gravarNovoTempoEmIndiceLivre(
    temposRef,
    indiceInicial,
    novoTempo
) {

    let indice = indiceInicial;

    // Em caso de duas gravações quase simultâneas,
    // tenta alguns índices seguintes sem travar o módulo inteiro.
    for (let tentativa = 0; tentativa < 20; tentativa++) {

        const destinoRef =
            temposRef.child(
                String(indice)
            );

        const resultado =
            await destinoRef.transaction(
                atual => {

                    if (atual === null) {
                        return novoTempo;
                    }

                    // undefined aborta sem sobrescrever.
                    return undefined;
                }
            );

        if (resultado.committed) {
            return String(indice);
        }

        indice++;
    }

    throw new Error(
        "Não foi possível reservar uma posição livre em tempos."
    );
}


// ==========================================================
// DH-PE APP -> GOOGLE SHEETS
// SINCRONIZA EXCLUSÕES DE RESULTADOS
// ==========================================================

exports.sincronizarExclusaoGoogleSheets =
    onValueCreated(
        {
            ref: "/dhpe_v25_final_stable_fix/sheets_sync_queue/{syncId}",
            region: "us-central1",

            secrets: [
                SHEETS_SYNC_KEY,
                SHEETS_WEBAPP_URL
            ],

            timeoutSeconds: 60,
            memory: "256MiB"
        },

        async (event) => {

            const snap =
                event.data;


            const item =
                snap.val();


            // --------------------------------------------------
            // IGNORA REGISTRO INVÁLIDO
            // --------------------------------------------------
            if (!item) {
                return;
            }


            // Processa somente itens pendentes.
            if (
                item.status &&
                item.status !== "pending"
            ) {

                return;
            }


            try {

                const url =
                    String(
                        SHEETS_WEBAPP_URL.value() || ""
                    ).trim();


                if (!url) {

                    throw new Error(
                        "SHEETS_WEBAPP_URL não configurada."
                    );
                }


                const chave =
                    String(
                        SHEETS_SYNC_KEY.value() || ""
                    );


                if (!chave) {

                    throw new Error(
                        "SHEETS_SYNC_KEY não configurada."
                    );
                }


                // --------------------------------------------------
                // DADOS ENVIADOS AO GOOGLE SHEETS
                // --------------------------------------------------
                const payload = {

                    chave:
                        chave,

                    acao:
                        "EXCLUIR",

                    eventId:
                        String(
                            item.eventId || ""
                        ),

                    cpf:
                        String(
                            item.cpf || ""
                        ),

                    categoria:
                        String(
                            item.categoria || ""
                        ),

                    runType:
                        String(
                            item.runType || "1st"
                        )
                };


                logger.info(
                    "Enviando exclusão ao Google Sheets",
                    {
                        syncId:
                            event.params.syncId,

                        eventId:
                            payload.eventId,

                        cpf:
                            payload.cpf,

                        categoria:
                            payload.categoria,

                        runType:
                            payload.runType
                    }
                );


                // --------------------------------------------------
                // CHAMA O WEB APP DO APPS SCRIPT
                // --------------------------------------------------
                const resposta =
                    await fetch(
                        url,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify(
                                    payload
                                ),

                            redirect:
                                "follow"
                        }
                    );


                const texto =
                    await resposta.text();


                let retorno = {};


                try {

                    retorno =
                        JSON.parse(texto);

                } catch (erroJson) {

                    retorno = {
                        ok: false,
                        respostaBruta: texto
                    };
                }


                if (
                    !resposta.ok ||
                    retorno.ok !== true
                ) {

                    throw new Error(
                        "Google Sheets respondeu com erro: " +
                        texto
                    );
                }


                // --------------------------------------------------
                // MARCA COMO CONCLUÍDO
                // --------------------------------------------------
                await snap.ref.update({

                    status:
                        "sent",

                    processedAt:
                        Date.now(),

                    linhasAlteradas:
                        Number(
                            retorno.linhasAlteradas || 0
                        ),

                    sheetsOperation:
                        retorno.operacao || "",

                    error:
                        null
                });


                logger.info(
                    "Exclusão sincronizada com Google Sheets",
                    {
                        syncId:
                            event.params.syncId,

                        linhasAlteradas:
                            retorno.linhasAlteradas || 0,

                        operacao:
                            retorno.operacao || ""
                    }
                );


            } catch (error) {

                logger.error(
                    "Falha ao sincronizar exclusão com Google Sheets",
                    error
                );


                await snap.ref.update({

                    status:
                        "error",

                    processedAt:
                        Date.now(),

                    error:
                        error &&
                        error.message
                            ? error.message
                            : String(error)
                });
            }
        }
    );

// ==========================================================
// 4. DH-CLUB — SORTEIO SEGURO NO SERVIDOR
// ==========================================================

const DHCLUB_ROOT = "dhclub";

function sorteioDbKeyAtual() {
    const ano = new Date().getFullYear();

    if (ano === 2027) {
        return "dhpe_2027_active";
    }

    if (ano >= 2028) {
        return `dhpe_${ano}_active`;
    }

    return "dhpe_v25_final_stable_fix";
}


function sorteioCpfLimpo(valor) {
    return String(valor || "")
        .replace(/\D/g, "");
}


function sorteioCpfDoAuth(request) {

    if (!request.auth) {
        throw new HttpsError(
            "unauthenticated",
            "É NECESSÁRIO ESTAR AUTENTICADO."
        );
    }

    const email = String(
        request.auth.token?.email || ""
    )
        .trim()
        .toLowerCase();

    const match =
        email.match(
            /^(\d{11})@dhpe\.com\.br$/
        );

    if (!match) {
        throw new HttpsError(
            "permission-denied",
            "CONTA FIREBASE NÃO VINCULADA AO DH-PE."
        );
    }

    return match[1];
}


function sorteioParticipantId(cpf) {

    const clean =
        sorteioCpfLimpo(cpf);

    if (!clean) {
        return "";
    }

    return crypto
        .createHash("sha256")
        .update(
            "DHCLUB-RAFFLE-ID-V1|" +
            clean
        )
        .digest("hex");
}


function sorteioCycleKey(
    filterType,
    eventId = null
) {

    const type =
        String(
            filterType || ""
        )
            .toUpperCase();

    if (type === "EVENT") {
        return (
            "EVENT_" +
            String(eventId || "")
        );
    }

    return type;
}


function sorteioSafeCycleKey(value) {

    return String(
        value || "GERAL"
    )
        .replace(
            /[.#$[\]\/]/g,
            "_"
        );
}


function sorteioCarteiraAtiva(
    user,
    config,
    ano
) {

    if (!user) {
        return false;
    }

    if (
        Number(
            config?.allowAllIDsYear
        ) ===
        Number(ano)
    ) {
        return true;
    }

    if (
        ano === 2026 &&
        config?.allowAllIDs === true
    ) {
        return true;
    }

    if (
        Number(
            user.cardReleasedYear
        ) ===
        Number(ano)
    ) {
        return true;
    }

    if (
        ano === 2026 &&
        user.idReleased === true
    ) {
        return true;
    }

    return false;
}


function sorteioMembroClub(
    user,
    clubRoot
) {

    const cpf =
        sorteioCpfLimpo(
            user?.cpf
        );

    if (!cpf) {
        return false;
    }

    const member =
        clubRoot?.members?.[cpf];

    if (!member) {
        return false;
    }

    const status =
        String(
            member.status || ""
        )
            .toUpperCase();

    return [
        "BETA",
        "ACTIVE",
        "FOUNDER"
    ].includes(status);
}


function sorteioInscritoEvento(
    user,
    eventId
) {

    if (
        !user ||
        !eventId
    ) {
        return false;
    }

    const inscricoes =
        transformarEmArray(
            user.inscricoes
        );

    return inscricoes.some(
        inscricao => {

            if (
                String(
                    inscricao?.id
                ) !==
                String(eventId)
            ) {
                return false;
            }

            const status =
                String(
                    inscricao?.status || ""
                )
                    .toUpperCase();

            return (
                status === "CONFIRMADO" ||
                status === "ISENTO"
            );
        }
    );
}

function sorteioTemTabelaPontos(
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


function sorteioEventoOficial(
    event
) {

    if (!event) {
        return false;
    }


    if (
        String(
            event.status || ""
        )
            .toUpperCase() ===
        "CANCELLED"
    ) {

        return false;
    }


    return (
        sorteioTemTabelaPontos(
            event.points
        ) ||
        sorteioTemTabelaPontos(
            event.qPoints
        )
    );
}


function sorteioParticipouMetadeTemporada(
    user,
    coreRoot
) {

    const cpf =
        sorteioCpfLimpo(
            user?.cpf
        );


    if (!cpf) {
        return false;
    }


    const officialEvents =
        transformarEmArray(
            coreRoot.events
        )
            .filter(
                sorteioEventoOficial
            );


    const totalEvents =
        officialEvents.length;


    if (
        totalEvents === 0
    ) {

        return false;
    }


    const target =
        Math.max(
            1,
            Math.ceil(
                totalEvents * 0.50
            )
        );


    const officialEventIds =
        new Set(
            officialEvents.map(
                event =>
                    String(
                        event.id
                    )
            )
        );


    const participatedIds =
        new Set(
            transformarEmArray(
                coreRoot.tempos
            )
                .filter(
                    result => {

                        if (!result) {
                            return false;
                        }


                        if (
                            sorteioCpfLimpo(
                                result.cpf
                            ) !==
                            cpf
                        ) {

                            return false;
                        }


                        if (
                            result.runType &&
                            result.runType !==
                            "1st"
                        ) {

                            return false;
                        }


                        if (
                            !officialEventIds.has(
                                String(
                                    result.evtId
                                )
                            )
                        ) {

                            return false;
                        }


                        if (
                            String(
                                result.val || ""
                            )
                                .toUpperCase() ===
                            "DNS"
                        ) {

                            return false;
                        }


                        return true;
                    }
                )
                .map(
                    result =>
                        String(
                            result.evtId
                        )
                )
        );


    return (
        participatedIds.size >=
        target
    );
}

function sorteioElegiveis(
    coreRoot,
    clubRoot,
    filterType,
    eventId
) {

    const tipo =
        String(
            filterType || ""
        )
            .toUpperCase();

    const ano =
        new Date()
            .getFullYear();

    let users =
        transformarEmArray(
            coreRoot.users
        )
            .filter(
                user =>
                    sorteioCpfLimpo(
                        user?.cpf
                    )
            );

    if (
        tipo === "DIGITAL_CARD"
    ) {

        users =
            users.filter(
                user =>
                    sorteioCarteiraAtiva(
                        user,
                        coreRoot.config,
                        ano
                    )
            );

    } else if (
        tipo === "DH_CLUB"
    ) {

        users =
            users.filter(
                user =>
                    sorteioMembroClub(
                        user,
                        clubRoot
                    )
            );

    } else if (
        tipo === "SEASON_50"
    ) {

        users =
            users.filter(
                user =>
                    sorteioParticipouMetadeTemporada(
                        user,
                        coreRoot
                    )
            );

        
    } else if (
        tipo === "EVENT"
    ) {

        if (!eventId) {
            return [];
        }

        users =
            users.filter(
                user =>
                    sorteioInscritoEvento(
                        user,
                        eventId
                    )
            );

    } else if (
        tipo !== "ALL_APP"
    ) {

        return [];
    }

    const mapa =
        new Map();

    users.forEach(
        user => {

            const cpf =
                sorteioCpfLimpo(
                    user?.cpf
                );

            if (
                cpf &&
                !mapa.has(cpf)
            ) {
                mapa.set(
                    cpf,
                    user
                );
            }
        }
    );

    return Array.from(
        mapa.values()
    );
}


function sorteioNomeUtil(
    valor
) {

    const nome =
        String(
            valor ||
            ""
        )
            .trim();


    if (!nome) {
        return "";
    }


    const normalizado =
        nome
            .toUpperCase()
            .trim();


    const nomesInvalidos = [
        "ATLETA",
        "SEM NOME",
        "NÃO INFORMADO",
        "NAO INFORMADO",
        "USUÁRIO",
        "USUARIO",
        "-"
    ];


    if (
        nomesInvalidos.includes(
            normalizado
        )
    ) {

        return "";
    }


    return nome;
}


function sorteioUsuariosMesmoCpf(
    user,
    coreRoot
) {

    const cpf =
        sorteioCpfLimpo(
            user?.cpf
        );


    if (!cpf) {
        return [];
    }


    return transformarEmArray(
        coreRoot?.users
    )
        .filter(
            candidato =>
                sorteioCpfLimpo(
                    candidato?.cpf
                ) ===
                cpf
        );
}


function sorteioNomeAtleta(
    user,
    coreRoot
) {

    const cpf =
        sorteioCpfLimpo(
            user?.cpf
        );


    // ======================================================
    // 1. TENTA O PRÓPRIO CADASTRO RECEBIDO
    // ======================================================

    const nomeDireto =
        sorteioNomeUtil(
            user?.nome ||
            user?.name ||
            user?.nomeCompleto ||
            user?.fullName
        );


    if (nomeDireto) {

        return nomeDireto;
    }


    // ======================================================
    // 2. PROCURA OUTRO CADASTRO COM O MESMO CPF
    // ======================================================

    const usuariosMesmoCpf =
        sorteioUsuariosMesmoCpf(
            user,
            coreRoot
        );


    for (
        const candidato of
        usuariosMesmoCpf
    ) {

        const nome =
            sorteioNomeUtil(
                candidato?.nome ||
                candidato?.name ||
                candidato?.nomeCompleto ||
                candidato?.fullName
            );


        if (nome) {

            return nome;
        }
    }


    // ======================================================
    // 3. PROCURA NOS RESULTADOS OFICIAIS PELO CPF
    // ======================================================

    const resultados =
        transformarEmArray(
            coreRoot?.tempos
        );


    for (
        const resultado of
        resultados
    ) {

        if (
            sorteioCpfLimpo(
                resultado?.cpf
            ) !==
            cpf
        ) {

            continue;
        }


        const nome =
            sorteioNomeUtil(
                resultado?.name ||
                resultado?.nome
            );


        if (nome) {

            return nome;
        }
    }


    // ======================================================
    // 4. ÚLTIMO RECURSO
    // ======================================================

    return "ATLETA";
}


function sorteioCidadeAtleta(
    user,
    coreRoot
) {

    const cidadeDireta =
        String(
            user?.city ||
            user?.cidade ||
            ""
        )
            .trim();


    if (cidadeDireta) {

        return cidadeDireta;
    }


    const usuariosMesmoCpf =
        sorteioUsuariosMesmoCpf(
            user,
            coreRoot
        );


    for (
        const candidato of
        usuariosMesmoCpf
    ) {

        const cidade =
            String(
                candidato?.city ||
                candidato?.cidade ||
                ""
            )
                .trim();


        if (cidade) {

            return cidade;
        }
    }


    return "";
}


function sorteioUfAtleta(
    user,
    coreRoot
) {

    const ufDireta =
        String(
            user?.uf ||
            ""
        )
            .trim()
            .toUpperCase();


    if (ufDireta) {

        return ufDireta;
    }


    const usuariosMesmoCpf =
        sorteioUsuariosMesmoCpf(
            user,
            coreRoot
        );


    for (
        const candidato of
        usuariosMesmoCpf
    ) {

        const uf =
            String(
                candidato?.uf ||
                ""
            )
                .trim()
                .toUpperCase();


        if (uf) {

            return uf;
        }
    }


    return "PE";
}


function sorteioParticipantePublico(
    user,
    coreRoot
) {

    const cpf =
        sorteioCpfLimpo(
            user?.cpf
        );


    return {

        participantId:
            sorteioParticipantId(
                cpf
            ),

        name:
            sorteioNomeAtleta(
                user,
                coreRoot
            ),

        city:
            sorteioCidadeAtleta(
                user,
                coreRoot
            ),

        uf:
            sorteioUfAtleta(
                user,
                coreRoot
            ),

        category:
            user?.cat ||
            user?.category ||
            ""

    };
}


function sorteioPodeExecutar(
    caller,
    draw
) {

    if (!caller) {
        return false;
    }


    const role =
        String(
            caller?.role || ""
        )
            .toUpperCase();


    const callerCpf =
        sorteioCpfLimpo(
            caller?.cpf
        );


    // ======================================================
    // ADMIN CADASTRADO
    // OU ADMINISTRADOR GERAL DO SISTEMA
    // ======================================================

    if (
        role === "ADMIN" ||
        callerCpf === "08327632418"
    ) {

        return true;
    }


    // ======================================================
    // SOMENTE ORGANIZADOR CONTINUA DAQUI
    // ======================================================

    if (
        role !== "ORGANIZER"
    ) {

        return false;
    }


    // ======================================================
    // ORGANIZADOR PODE USAR OS FILTROS GERAIS
    // ======================================================

    const filterType =
        String(
            draw?.filterType || ""
        )
            .toUpperCase();


    const generalTypes = [
        "ALL_APP",
        "DIGITAL_CARD",
        "DH_CLUB",
        "SEASON_50"
    ];


    if (
        generalTypes.includes(
            filterType
        )
    ) {

        return true;
    }


    // ======================================================
    // EVENTO CONTINUA EXIGINDO PERMISSÃO ESPECÍFICA
    // ======================================================

    if (
        filterType !==
        "EVENT"
    ) {

        return false;
    }


    const allowed =
        Array.isArray(
            caller.allowedEvts
        )

            ? caller.allowedEvts
                .map(
                    String
                )

            : [];


    return allowed.includes(
        String(
            draw.eventId
        )
    );
}


function sorteioEscolher(
    participants,
    quantidade
) {

    const disponiveis =
        participants.slice();


    const winners =
        [];


    const trace =
        [];


    while (
        winners.length <
        quantidade
    ) {

        // Quantos atletas estavam disponíveis
        // exatamente antes desta escolha.
        const poolSize =
            disponiveis.length;


        // ESTE É O NÚMERO ALEATÓRIO
        // REAL GERADO PELO SERVIDOR.
        const randomIndex =
            crypto.randomInt(
                poolSize
            );


        // Remove exatamente o atleta
        // correspondente ao índice sorteado.
        const selected =
            disponiveis.splice(
                randomIndex,
                1
            )[0];


        winners.push(
            selected
        );


        // Número público mostrado no replay.
        //
        // Internamente:
        // randomIndex 0 = posição pública 1.
        //
        // Exemplo:
        // índice 73 = número público 000074.
        const publicNumber =
            String(
                randomIndex + 1
            )
                .padStart(
                    3,
                    "0"
                );


        trace.push({

            position:
                winners.length,

            poolSize,

            randomIndex,

            publicNumber,

            participantId:
                String(
                    selected?.participantId ||
                    ""
                )

        });
    }


    return {

        winners,

        trace

    };
}


function sorteioAuditHash(
    draw,
    participants,
    winners,
    selectionTrace,
    drawnAt,
    cycleRound
) {

    const payload = {

        version:
            4,


        drawId:
            String(
                draw?.id ||
                ""
            ),


        publicId:
            String(
                draw?.publicId ||
                ""
            ),


        filterType:
            String(
                draw?.filterType ||
                ""
            ),


        eventId:
            draw?.eventId ||
            null,


        participants:
            participants
                .map(
                    item =>
                        String(
                            item.participantId ||
                            ""
                        )
                )
                .filter(
                    Boolean
                )
                .sort(),


        winners:
            winners
                .map(
                    item =>
                        String(
                            item.participantId ||
                            ""
                        )
                ),


        selectionTrace:
            transformarEmArray(
                selectionTrace
            )
                .map(
                    item => ({

                        position:
                            Number(
                                item?.position ||
                                0
                            ),

                        poolSize:
                            Number(
                                item?.poolSize ||
                                0
                            ),

                        randomIndex:
                            Number(
                                item?.randomIndex ??
                                -1
                            ),

                        publicNumber:
                            String(
                                item?.publicNumber ||
                                ""
                            ),

                        participantId:
                            String(
                                item?.participantId ||
                                ""
                            )

                    })
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


    return crypto
        .createHash(
            "sha256"
        )
        .update(
            JSON.stringify(
                payload
            )
        )
        .digest(
            "hex"
        );
}


exports.performDhClubDraw =
    onCall(
        {
            region:
                "us-central1",

            timeoutSeconds:
                30,

            memory:
                "256MiB"
        },

        async request => {

            const callerCpf =
                sorteioCpfDoAuth(
                    request
                );

            const drawId =
                String(
                    request.data?.drawId ||
                    ""
                )
                    .trim();

            if (!drawId) {

                throw new HttpsError(
                    "invalid-argument",
                    "ID DO SORTEIO NÃO INFORMADO."
                );
            }

            const database =
                getDatabase();

            const dbKey =
                sorteioDbKeyAtual();

            const coreSnap =
                await database
                    .ref(dbKey)
                    .once("value");

            const coreRoot =
                coreSnap.val() ||
                {};

            const caller =
                transformarEmArray(
                    coreRoot.users
                )
                    .find(
                        user =>
                            sorteioCpfLimpo(
                                user?.cpf
                            ) ===
                            callerCpf
                    );

            if (!caller) {

                throw new HttpsError(
                    "permission-denied",
                    "USUÁRIO NÃO ENCONTRADO NO DH-PE."
                );
            }

            const clubRef =
                database.ref(
                    DHCLUB_ROOT
                );

// ======================================================
// PRÉ-CARREGA O DH-CLUB ANTES DA TRANSAÇÃO
// ======================================================
//
// O Firebase pode chamar a função da transação
// inicialmente com "current === null", mesmo quando
// os dados existem no servidor.
//
// Por isso carregamos o estado real antes de iniciar
// a transação.

const initialClubSnap =
    await clubRef
        .once(
            "value"
        );


const initialClubRoot =
    initialClubSnap.val() ||
    {};


// Confirma antes da transação que o sorteio
// realmente existe no banco.

if (
    !initialClubRoot
        ?.draws
        ?.[drawId]
) {

    throw new HttpsError(
        "not-found",
        "SORTEIO NÃO ENCONTRADO."
    );
}
            
            let failureCode =
                null;

            let failureMessage =
                null;

            const result =
                await clubRef
                    .transaction(
                        current => {

                            failureCode =
                                null;

                            failureMessage =
                                null;

                            const clubRoot =
    current == null

        ? JSON.parse(
            JSON.stringify(
                initialClubRoot
            )
        )

        : current;

                            const draw =
                                clubRoot
                                    ?.draws
                                    ?.[drawId];

                            if (!draw) {

                                failureCode =
                                    "not-found";

                                failureMessage =
                                    "SORTEIO NÃO ENCONTRADO.";

                                return;
                            }

                            if (
                                String(
                                    draw.status ||
                                    ""
                                )
                                    .toUpperCase() !==
                                "WAITING"
                            ) {

                                failureCode =
                                    "failed-precondition";

                                failureMessage =
                                    "ESTE SORTEIO JÁ FOI REALIZADO OU ESTÁ INDISPONÍVEL.";

                                return;
                            }

                            if (
                                !sorteioPodeExecutar(
                                    caller,
                                    draw
                                )
                            ) {

                                failureCode =
                                    "permission-denied";

                                failureMessage =
                                    "VOCÊ NÃO TEM PERMISSÃO PARA ESTE SORTEIO.";

                                return;
                            }

                            const eligibleUsers =
                                sorteioElegiveis(
                                    coreRoot,
                                    clubRoot,
                                    draw.filterType,
                                    draw.eventId
                                );

                            const participants =
                                eligibleUsers
                                    .map(
                                        user => ({

                                            _cpf:
                                                sorteioCpfLimpo(
                                                    user.cpf
                                                ),

                                            ...sorteioParticipantePublico(
                                               user,
                                               coreRoot
                                            )
                                        })
                                    )
                                    .filter(
                                        item =>
                                            item._cpf &&
                                            item.participantId
                                    )
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
                                Math.min(
                                    20,

                                    Math.max(
                                        1,

                                        Math.trunc(
                                            Number(
                                                draw.winnersCount ||
                                                1
                                            )
                                        )
                                    )
                                );

                            if (
                                participants.length <
                                winnersCount
                            ) {

                                failureCode =
                                    "failed-precondition";

                                failureMessage =
                                    "NÃO HÁ PARTICIPANTES SUFICIENTES.";

                                return;
                            }

                            const originalCycleKey =
                                draw.cycleKey ||
                                sorteioCycleKey(
                                    draw.filterType,
                                    draw.eventId
                                );

                            const cycleKey =
                                sorteioSafeCycleKey(
                                    originalCycleKey
                                );

                            if (
                                !clubRoot.draw_cycles
                            ) {
                                clubRoot.draw_cycles =
                                    {};
                            }

                            const cycle =
                                clubRoot.draw_cycles[
                                    cycleKey
                                ] ||
                                {};

                            let used =
                                (
                                    cycle.used &&
                                    typeof cycle.used ===
                                        "object"
                                )
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

                            participants.forEach(
                                participant => {

                                    if (
                                        used[
                                            participant._cpf
                                        ]
                                    ) {

                                        used[
                                            participant.participantId
                                        ] =
                                            true;
                                    }
                                }
                            );

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
                                participants
                                    .filter(
                                        participant =>
                                            !used[
                                                participant.participantId
                                            ]
                                    );

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

                            else if (
                                available.length <
                                winnersCount
                            ) {

                                failureCode =
                                    "failed-precondition";

                                failureMessage =
                                    `RESTAM ${available.length} ATLETA(S) NESTE CICLO. ESTE SORTEIO PEDE ${winnersCount} VENCEDOR(ES).`;

                                return;
                            }

                            const selectionResult =
    sorteioEscolher(
        available,
        winnersCount
    );


const selected =
    selectionResult.winners;


const selectionTrace =
    selectionResult.trace;


const winners =
    selected.map(
                                    (
                                        participant,
                                        index
                                    ) => ({

                                        position:
                                            index + 1,

                                        participantId:
                                            participant
                                                .participantId,

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

                            winners.forEach(
                                winner => {

                                    used[
                                        winner.participantId
                                    ] =
                                        true;
                                }
                            );

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

                            const auditHash =
    sorteioAuditHash(
        draw,

        Object.values(
            participantsObject
        ),

        winners,

        selectionTrace,

        now,

        round
    );

                            clubRoot.draws[
                                drawId
                            ] = {

                                ...draw,

                                status:
                                    "DRAWN",

                                participants:
                                    participantsObject,

                                participantCount:
                                    participants.length,

                                winners,

                            selectionTrace,

replayAvailable:
    true,

replayVersion:
    1,

replayNumberMode:
    "SERVER_RANDOM_POOL_POSITION",
                                
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
                                    4,

                                randomMethod:
                                    "NODE_CRYPTO_RANDOM_INT_SERVER",

                                integrityRegistered:
                                    true,

                                serverExecuted:
                                    true,

                                executionVersion:
                                    2,

                                drawnBy: {

                                    participantId:
                                        sorteioParticipantId(
                                            callerCpf
                                        ),

                                    name:
                                        caller.nome ||
                                        caller.name ||
                                        "ORGANIZAÇÃO",

                                    role:
                                        caller.role ||
                                        "USER"
                                }
                            };

                            clubRoot.draw_cycles[
                                cycleKey
                            ] = {

                                key:
                                    originalCycleKey,

                                round,

                                used,

                                updatedAt:
                                    now
                            };

                            return clubRoot;
                        }
                    );

            if (
                !result.committed
            ) {

                throw new HttpsError(
                    failureCode ||
                    "aborted",

                    failureMessage ||
                    "O SORTEIO NÃO PÔDE SER REALIZADO."
                );
            }

            const finalClub =
                result.snapshot
                    .val() ||
                {};

            const finalDraw =
                finalClub
                    ?.draws
                    ?.[drawId];

            if (!finalDraw) {

                throw new HttpsError(
                    "internal",
                    "RESULTADO DO SORTEIO NÃO ENCONTRADO."
                );
            }

          // ==========================================================
// NOTIFICA O(S) VENCEDOR(ES) DO SORTEIO
// ==========================================================
//
// IMPORTANTE:
// fica FORA da transaction para não gerar
// notificações duplicadas caso a transaction seja repetida.
// ==========================================================

try {

    const finalWinners =
        transformarEmArray(
            finalDraw.winners
        );


    const allUsers =
        transformarEmArray(
            coreRoot.users
        );


    const notificationJobs =
        [];


    finalWinners.forEach(
        winner => {

            const participantId =
                String(
                    winner?.participantId ||
                    ""
                );


            if (!participantId) {

                return;
            }


            const winnerUser =
                allUsers.find(
                    user => {

                        const cpf =
                            sorteioCpfLimpo(
                                user?.cpf
                            );


                        if (!cpf) {

                            return false;
                        }


                        return (
                            String(
                                sorteioParticipantId(
                                    cpf
                                )
                            ) ===
                            participantId
                        );
                    }
                );


            if (!winnerUser) {

                logger.warn(
                    "Vencedor não localizado para notificação",
                    {
                        drawId,
                        participantId
                    }
                );

                return;
            }


            const token =
                String(
                    winnerUser.fcmToken ||
                    ""
                )
                    .trim();


            if (!token) {

                logger.info(
                    "Vencedor sem token de notificação",
                    {
                        drawId,
                        participantId
                    }
                );

                return;
            }


            const winnerName =
                String(
                    winner?.name ||
                    winnerUser?.nome ||
                    winnerUser?.name ||
                    "ATLETA"
                )
                    .trim();


            const drawTitle =
                String(
                    finalDraw.title ||
                    "SORTEIO DH-CLUB"
                )
                    .trim();


            const pushRef =
                database
                    .ref(
                        "push_queue"
                    )
                    .push();


            notificationJobs.push(

                pushRef.set({

                    token,

                    title:
                        "🎉 VOCÊ FOI SORTEADO!",

                    body:
                        `Parabéns, ${winnerName}! Você foi o vencedor do sorteio "${drawTitle}" no DH-CLUB.`,

                    status:
                        "pending",

                    timestamp:
                        Date.now(),

                    source:
                        "DHCLUB_DRAW",

                    drawId:
                        String(
                            drawId
                        )

                })
            );
        }
    );


    if (
        notificationJobs.length
    ) {

        await Promise.all(
            notificationJobs
        );
    }


} catch (pushError) {

    // A notificação nunca deve cancelar
    // um sorteio que já foi realizado.

    logger.error(
        "Erro ao registrar notificação do vencedor",
        pushError
    );
}
            
            return {

                ok:
                    true,

                drawId:
                    finalDraw.id ||
                    drawId,

                publicId:
                    finalDraw.publicId ||
                    "",

                drawnAt:
                    finalDraw.drawnAt ||
                    null,

                participantCount:
                    finalDraw.participantCount ||
                    0,

                cycleRound:
                    finalDraw.cycleRound ||
                    1,

                auditHash:
                    finalDraw.auditHash ||
                    "",

                winners:
    transformarEmArray(
        finalDraw.winners
    ),

selectionTrace:
    transformarEmArray(
        finalDraw.selectionTrace
    )
            };
        }
    );
