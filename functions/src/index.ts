import * as functions from 'firebase-functions';
import serviceAccount from "./secret/main-agentesmart-589511385b0d.json";

export const keyFilename = serviceAccount;

import { Dialogflow } from "./middlewares/dialogflow.mid";
import { MessengerWebhook } from "./middlewares/messenger.mid";


const dialogflow = new Dialogflow();
const messenger  = new MessengerWebhook();
// server.start();

exports.dialogflow = functions.https.onRequest( dialogflow.app );
exports.messenger  = functions.https.onRequest( messenger.app )
