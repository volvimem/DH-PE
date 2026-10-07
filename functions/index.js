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
