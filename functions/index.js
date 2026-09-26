const { onValueCreated } = require("firebase-functions/v2/database");
const { logger } = require("firebase-functions");

const { initializeApp } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

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
            // Isso também permite diagnosticar pelo Firebase.
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
// GOOGLE SHEETS -> RESULTADOS DH-PE
// ==========================================================

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getDatabase } = require("firebase-admin/database");

const SHEETS_SYNC_KEY = defineSecret("SHEETS_SYNC_KEY");


// Banco da temporada 2026 usado atualmente pelo DH-PE
const DHPE_DB_KEY_2026 = "dhpe_v25_final_stable_fix";


function limparCpf(valor) {

    let cpf = String(valor || "")
        .replace(/\D/g, "");

    // Caso o Google Sheets tenha removido zero inicial
    if (cpf.length < 11) {
        cpf = cpf.padStart(11, "0");
    }

    return cpf;
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
        t === "1ª descida"
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
        t === "2ª descida"
    ) {
        return "2nd";
    }

    return null;
}


exports.receberResultadoGoogleSheets = onRequest(
    {
        secrets: [SHEETS_SYNC_KEY]
    },

    async (req, res) => {

        // --------------------------------------------------
        // 1. SOMENTE POST
        // --------------------------------------------------
        if (req.method !== "POST") {

            res.status(405).json({
                ok: false,
                erro: "Use POST."
            });

            return;
        }


        // --------------------------------------------------
        // 2. CONFERE A CHAVE SECRETA
        // --------------------------------------------------
        const authorization =
            String(
                req.get("authorization") || ""
            );

        const chaveEsperada =
            `Bearer ${SHEETS_SYNC_KEY.value()}`;


        if (authorization !== chaveEsperada) {

            res.status(401).json({
                ok: false,
                erro: "Não autorizado."
            });

            return;
        }


        try {

            const body =
                req.body || {};


            // --------------------------------------------------
            // 3. RECEBE OS DADOS DO GOOGLE SHEETS
            // --------------------------------------------------
            const eventId =
                String(
                    body.eventId || ""
                ).trim();


            const cpf =
                limparCpf(
                    body.idSistema
                );


            const categoria =
                normalizarCategoria(
                    body.categoria
                );


            const runType =
                converterTipoVolta(
                    body.tipoVolta
                );


            let resultado =
                String(
                    body.resultadoFinal || ""
                )
                .trim()
                .toUpperCase();


            const horaLargada =
                String(
                    body.horaLargada || ""
                ).trim();


            const horaChegada =
                String(
                    body.horaChegada || ""
                ).trim();


            const penalidade =
                String(
                    body.penalidade || ""
                ).trim();


            const placaRecebida =
                String(
                    body.placa || ""
                ).trim();


            // --------------------------------------------------
            // 4. VALIDAÇÕES
            // --------------------------------------------------
            if (!eventId) {

                res.status(400).json({
                    ok: false,
                    erro: "EVENT_ID não informado."
                });

                return;
            }


            if (!cpf || cpf.length !== 11) {

                res.status(400).json({
                    ok: false,
                    erro: "ID_SISTEMA/CPF inválido."
                });

                return;
            }


            if (!runType) {

                res.status(400).json({
                    ok: false,
                    erro: "TIPO_VOLTA inválido."
                });

                return;
            }


            if (!resultado) {

                res.status(400).json({
                    ok: false,
                    erro: "RESULTADO FINAL vazio."
                });

                return;
            }


            // DNS / DSQ entram no DH-PE como DNF,
            // seguindo o comportamento atual do sistema.
            if (
                resultado === "DNS" ||
                resultado === "DSQ"
            ) {

                resultado = "DNF";
            }


            if (
                resultado !== "DNF" &&
                !/^\d{1,3}:\d{2}\.\d{3}$/.test(resultado)
            ) {

                res.status(400).json({
                    ok: false,
                    erro:
                        "Resultado inválido. Use MM:SS.mmm ou DNF."
                });

                return;
            }


            // --------------------------------------------------
            // 5. CARREGA O BANCO ATUAL
            // --------------------------------------------------
            const database =
                getDatabase();


            const raizRef =
                database.ref(
                    DHPE_DB_KEY_2026
                );


            const raizSnap =
                await raizRef.get();


            const dados =
                raizSnap.val() || {};


            let usuarios =
                dados.users || [];


            if (!Array.isArray(usuarios)) {

                usuarios =
                    Object.values(
                        usuarios
                    );
            }


            let eventos =
                dados.events || [];


            if (!Array.isArray(eventos)) {

                eventos =
                    Object.values(
                        eventos
                    );
            }


            // --------------------------------------------------
            // 6. CONFERE SE O EVENTO EXISTE
            // --------------------------------------------------
            const evento =
                eventos.find(
                    e =>
                        e &&
                        String(e.id) ===
                            String(eventId)
                );


            if (!evento) {

                res.status(404).json({
                    ok: false,
                    erro:
                        "EVENT_ID não encontrado no DH-PE."
                });

                return;
            }


            // --------------------------------------------------
            // 7. CONFERE SE O ATLETA EXISTE
            // --------------------------------------------------
            const atleta =
                usuarios.find(
                    u =>
                        u &&
                        limparCpf(u.cpf) === cpf
                );


            if (!atleta) {

                res.status(404).json({
                    ok: false,
                    erro:
                        "ID_SISTEMA/CPF não encontrado no DH-PE."
                });

                return;
            }


            // --------------------------------------------------
            // 8. PREPARA OS DADOS DO RESULTADO
            // --------------------------------------------------
            const nomeAtleta =
                String(
                    atleta.nome ||
                    atleta.name ||
                    ""
                ).toUpperCase();


            const cidadeAtleta =
                String(
                    atleta.city ||
                    atleta.cidade ||
                    ""
                ).toUpperCase();


            const placa =
                placaRecebida ||
                String(
                    atleta.numero ||
                    atleta.numPlaca ||
                    atleta.placa ||
                    ""
                );


            let penaltyStr = "";


            if (penalidade) {

                penaltyStr =
                    penalidade.startsWith("+")
                        ? penalidade
                        : `+${penalidade}s`;
            }


            // --------------------------------------------------
            // 9. ATUALIZA OU CRIA O TEMPO
            // --------------------------------------------------
            const temposRef =
                database.ref(
                    `${DHPE_DB_KEY_2026}/tempos`
                );


            let operacao =
                "criado";


            await temposRef.transaction(
                (valorAtual) => {

                    let tempos = [];


                    if (
                        Array.isArray(
                            valorAtual
                        )
                    ) {

                        tempos =
                            valorAtual;

                    } else if (
                        valorAtual &&
                        typeof valorAtual ===
                            "object"
                    ) {

                        tempos =
                            Object.values(
                                valorAtual
                            );
                    }


                    const indice =
                        tempos.findIndex(
                            t =>
                                t &&

                                String(t.evtId) ===
                                    String(eventId) &&

                                limparCpf(t.cpf) ===
                                    cpf &&

                                String(t.runType) ===
                                    String(runType) &&

                                normalizarCategoria(t.cat) ===
                                    categoria
                        );


                    const anterior =
                        indice > -1
                            ? tempos[indice]
                            : {};


                    const novoTempo = {

                        ...anterior,

                        evtId:
                            eventId,

                        cpf:
                            cpf,

                        name:
                            nomeAtleta,

                        city:
                            cidadeAtleta,

                        cat:
                            categoria,

                        val:
                            resultado,

                        status:
                            resultado === "DNF"
                                ? "DNF"
                                : "OK",

                        runType:
                            runType,

                        num:
                            placa,

                        penaltyStr:
                            penaltyStr,

                        startClock:
                            horaLargada ||
                            anterior.startClock ||
                            "",

                        finishClock:
                            horaChegada ||
                            anterior.finishClock ||
                            "",

                        source:
                            "GOOGLE_SHEETS",

                        updatedAt:
                            Date.now()
                    };


                    if (indice > -1) {

                        tempos[indice] =
                            novoTempo;

                        operacao =
                            "atualizado";

                    } else {

                        tempos.push(
                            novoTempo
                        );

                        operacao =
                            "criado";
                    }


                    return tempos;
                }
            );


            // --------------------------------------------------
            // 10. RESPOSTA PARA O GOOGLE SHEETS
            // --------------------------------------------------
            res.status(200).json({

                ok: true,

                operacao:
                    operacao,

                evento:
                    evento.t || eventId,

                cpf:
                    cpf,

                atleta:
                    nomeAtleta,

                categoria:
                    categoria,

                tipo:
                    runType,

                resultado:
                    resultado
            });


        } catch (error) {

            logger.error(
                "Erro ao receber resultado do Google Sheets",
                error
            );


            res.status(500).json({

                ok: false,

                erro:
                    error &&
                    error.message
                        ? error.message
                        : String(error)
            });
        }
    }
);
