const { onValueCreated } = require("firebase-functions/v2/database");
const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { defineSecret } = require("firebase-functions/params");

const {
    initializeApp,
    applicationDefault
} = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");
const { getDatabase } = require("firebase-admin/database");

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
// 4. RECEBE RESULTADO DO GOOGLE SHEETS
// ==========================================================

exports.receberResultadoGoogleSheets = onRequest(
    {
        region: "us-central1",
        secrets: [SHEETS_SYNC_KEY],
        timeoutSeconds: 60,
        memory: "256MiB"
    },

    async (req, res) => {

        // ==================================================
        // 1. SOMENTE POST
        // ==================================================
        if (req.method !== "POST") {

            res.status(405).json({
                ok: false,
                erro: "Use POST."
            });

            return;
        }


        // ==================================================
        // 2. AUTORIZAÇÃO
        // ==================================================
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


            // ==================================================
            // 3. AÇÃO
            // ==================================================
            const acao =
                String(
                    body.acao || "SALVAR"
                )
                .trim()
                .toUpperCase();


            // ==================================================
            // 4. DADOS RECEBIDOS
            // ==================================================
            const eventId =
                String(
                    body.eventId || ""
                ).trim();


            const cpfLimpo =
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


            // ==================================================
            // 5. VALIDAÇÕES BÁSICAS
            // ==================================================
            if (!eventId) {

                res.status(400).json({
                    ok: false,
                    erro: "EVENT_ID não informado."
                });

                return;
            }


            if (
                !cpfLimpo ||
                cpfLimpo.length !== 11
            ) {

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


            // ==================================================
            // 6. FIREBASE
            // ==================================================
            const database =
                getDatabase();


            const base =
                DHPE_DB_KEY_2026;


            const temposRef =
                database.ref(
                    `${base}/tempos`
                );


            // ==================================================
            // 7. EXCLUSÃO
            // APAGOU NA PLANILHA → APAGA NO DH-PE
            // ==================================================
            if (acao === "EXCLUIR") {

                const temposSnap =
                    await temposRef.get();


                const temposComChaves =
                    normalizarTemposComChaves(
                        temposSnap.val()
                    );


                const existente =
                    temposComChaves.find(
                        item => {

                            const t =
                                item.value;


                            if (!t) {
                                return false;
                            }


                            const tipoAtual =
                                t.runType
                                    ? String(t.runType)
                                    : "1st";


                            return (
                                String(t.evtId) ===
                                    String(eventId) &&

                                limparCpf(t.cpf) ===
                                    cpfLimpo &&

                                tipoAtual ===
                                    String(runType) &&

                                normalizarCategoria(
                                    t.cat
                                ) ===
                                    categoria
                            );
                        }
                    ) || null;


                // Já não existia.
                // Consideramos a operação concluída.
                if (!existente) {

                    res.status(200).json({

                        ok:
                            true,

                        operacao:
                            "nao_encontrado",

                        mensagem:
                            "O resultado já não existia no DH-PE."
                    });

                    return;
                }


                // Remove SOMENTE o resultado encontrado.
                await temposRef
                    .child(existente.key)
                    .remove();


                logger.info(
                    "Resultado excluído pelo Google Sheets",
                    {
                        eventId:
                            eventId,

                        cpf:
                            cpfLimpo,

                        categoria:
                            categoria,

                        runType:
                            runType,

                        chave:
                            existente.key
                    }
                );


                res.status(200).json({

                    ok:
                        true,

                    operacao:
                        "excluido",

                    eventId:
                        eventId,

                    cpf:
                        cpfLimpo,

                    categoria:
                        categoria,

                    tipo:
                        runType
                });


                return;
            }


            // ==================================================
            // 8. VALIDA RESULTADO PARA SALVAR
            // ==================================================
            if (!resultado) {

                res.status(400).json({
                    ok: false,
                    erro: "RESULTADO FINAL vazio."
                });

                return;
            }


            // O DH-PE atual trata DNS/DSQ junto com DNF.
            if (
                resultado === "DNS" ||
                resultado === "DSQ"
            ) {

                resultado =
                    "DNF";
            }


            if (
                resultado !== "DNF" &&
                !/^\d{1,3}:\d{2}\.\d{3}$/
                    .test(resultado)
            ) {

                res.status(400).json({
                    ok: false,
                    erro:
                        "Resultado inválido. Use MM:SS.mmm ou DNF."
                });

                return;
            }


            // ==================================================
            // 9. CARREGA EVENTOS E USUÁRIOS
            // ==================================================
            const [
                eventosSnap,
                usuariosSnap
            ] =
                await Promise.all([

                    database
                        .ref(
                            `${base}/events`
                        )
                        .get(),

                    database
                        .ref(
                            `${base}/users`
                        )
                        .get()

                ]);


            const evento =
                encontrarEvento(
                    eventosSnap.val(),
                    eventId
                );


            if (!evento) {

                res.status(404).json({
                    ok: false,
                    erro:
                        "EVENT_ID não encontrado no DH-PE."
                });

                return;
            }


            const atleta =
                encontrarAtleta(
                    usuariosSnap.val(),
                    cpfLimpo
                );


            if (!atleta) {

                res.status(404).json({
                    ok: false,
                    erro:
                        "ID_SISTEMA/CPF não encontrado no DH-PE."
                });

                return;
            }


            // ==================================================
            // 10. DADOS DO ATLETA
            // ==================================================
            const cpfBanco =
                String(
                    atleta.cpf ||
                    formatarCpf(cpfLimpo)
                ).trim();


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


            let penaltyStr =
                "";


            if (penalidade) {

                penaltyStr =
                    penalidade.startsWith("+")
                        ? penalidade
                        : `+${penalidade}s`;
            }


            // ==================================================
            // 11. LÊ OS TEMPOS
            // ==================================================
            const temposSnap =
                await temposRef.get();


            const temposComChaves =
                normalizarTemposComChaves(
                    temposSnap.val()
                );


            // ==================================================
            // 12. PROCURA RESULTADO EXISTENTE
            // ==================================================
            const existente =
                temposComChaves.find(
                    item => {

                        const t =
                            item.value;


                        if (!t) {
                            return false;
                        }


                        const tipoAtual =
                            t.runType
                                ? String(t.runType)
                                : "1st";


                        return (
                            String(t.evtId) ===
                                String(eventId) &&

                            limparCpf(t.cpf) ===
                                cpfLimpo &&

                            tipoAtual ===
                                String(runType) &&

                            normalizarCategoria(
                                t.cat
                            ) ===
                                categoria
                        );
                    }
                ) || null;


            const anterior =
                existente
                    ? existente.value
                    : {};


            // ==================================================
            // 13. DESCOBRE SE HOUVE ALTERAÇÃO REAL
            // ==================================================
            const resultadoAnterior =
                String(
                    anterior.val || ""
                );


            const penalidadeAnterior =
                String(
                    anterior.penaltyStr || ""
                );


            const houveAlteracao =
                !existente ||
                resultadoAnterior !== resultado ||
                penalidadeAnterior !== penaltyStr;


            // ==================================================
            // 14. MONTA O RESULTADO FINAL
            // ==================================================
            const novoTempo = {

                ...anterior,

                evtId:
                    eventId,

                cpf:
                    cpfBanco,

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


            // ==================================================
            // 15. SALVA OU ATUALIZA
            // ==================================================
            let chaveDestino;
            let operacao;


            if (existente) {

                chaveDestino =
                    existente.key;


                operacao =
                    "atualizado";


                await temposRef
                    .child(chaveDestino)
                    .set(novoTempo);

            } else {

                const indiceLivre =
                    primeiroIndiceNumericoLivre(
                        temposComChaves
                    );


                chaveDestino =
                    await gravarNovoTempoEmIndiceLivre(
                        temposRef,
                        indiceLivre,
                        novoTempo
                    );


                operacao =
                    "criado";
            }


            // ==================================================
            // 16. NOTIFICAÇÃO PARA O ATLETA
            // ==================================================
            let notificacaoEnviada =
                false;


            let motivoNotificacao =
                "";


            // Só gera nova notificação se:
            // - o resultado foi criado;
            // - ou realmente mudou.
            if (houveAlteracao) {

                const token =
                    String(
                        atleta.fcmToken || ""
                    ).trim();


                if (token) {

                    let tituloPush;
                    let mensagemPush;


                    if (operacao === "criado") {

                        tituloPush =
                            "Tempo Registrado! ⏱️";


                        mensagemPush =
                            `Seu tempo de ${resultado} acabou de entrar no sistema. Confira sua posição!`;

                    } else {

                        tituloPush =
                            "Tempo Atualizado! ⏱️";


                        mensagemPush =
                            `Seu resultado foi atualizado para ${resultado}. Confira sua posição!`;
                    }


                    await database
                        .ref("push_queue")
                        .push({

                            token:
                                token,

                            title:
                                tituloPush,

                            body:
                                mensagemPush,

                            status:
                                "pending",

                            timestamp:
                                Date.now(),

                            source:
                                "GOOGLE_SHEETS",

                            cpf:
                                cpfBanco,

                            eventId:
                                eventId
                        });


                    notificacaoEnviada =
                        true;


                    logger.info(
                        "Notificação de resultado criada",
                        {
                            cpf:
                                cpfBanco,

                            eventId:
                                eventId,

                            resultado:
                                resultado,

                            operacao:
                                operacao
                        }
                    );

                } else {

                    motivoNotificacao =
                        "Atleta sem fcmToken cadastrado.";


                    logger.info(
                        "Resultado salvo sem push: atleta sem token",
                        {
                            cpf:
                                cpfBanco,

                            eventId:
                                eventId
                        }
                    );
                }

            } else {

                motivoNotificacao =
                    "Resultado não mudou; push duplicado evitado.";
            }


            // ==================================================
            // 17. RESPOSTA DE SUCESSO
            // ==================================================
            res.status(200).json({

                ok:
                    true,

                operacao:
                    operacao,

                chave:
                    chaveDestino,

                evento:
                    evento.t ||
                    eventId,

                cpf:
                    cpfBanco,

                atleta:
                    nomeAtleta,

                categoria:
                    categoria,

                tipo:
                    runType,

                resultado:
                    resultado,

                notificacaoEnviada:
                    notificacaoEnviada,

                motivoNotificacao:
                    motivoNotificacao
            });


        } catch (error) {

            logger.error(
                "Erro ao receber resultado do Google Sheets",
                error
            );


            res.status(500).json({

                ok:
                    false,

                erro:
                    error &&
                    error.message
                        ? error.message
                        : String(error)
            });
        }
    }
);
