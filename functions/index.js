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