const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
admin.initializeApp();

// A função agora escuta a raiz do banco de dados, independentemente do nó dhpe_vX
exports.processPushQueue = functions.database.ref('/push_queue/{pushId}')
    .onCreate(async (snapshot, context) => {
        const pushData = snapshot.val();
        
        console.log("Nova notificação na fila detectada:", pushData);

        if (!pushData || !pushData.token) {
            console.log("Falha: Token não encontrado ou dados inválidos.");
            return null;
        }

        const payload = {
            notification: {
                title: pushData.title || "Notificação",
                body: pushData.body || "Você tem uma nova mensagem."
            },
            android: {
                notification: {
                    sound: "default"
                }
            },
            apns: {
                payload: {
                    aps: {
                        sound: "default"
                    }
                }
            },
            token: pushData.token
        };

        try {
            await admin.messaging().send(payload);
            console.log("Push enviado com sucesso para o token:", pushData.token);
            // Remove da fila após o envio para não acumular lixo
            return snapshot.ref.remove(); 
        } catch (error) {
            console.error("Erro crítico ao enviar push:", error);
            // Em caso de erro, marca como erro mas não deleta para podermos investigar
            return snapshot.ref.update({ status: "erro", errorMessage: error.message });
        }
    });