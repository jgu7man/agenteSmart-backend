import * as functions from 'firebase-functions';
import serviceAccount from "./secret/main-agentesmart-589511385b0d.json";

export const keyFilename = serviceAccount;

import { Rest } from './middlewares/rest';
import { Api } from './middlewares/api';


const api = new Api();
const rest = new Rest()

exports.api = functions.https.onRequest( api.app );
exports.rest = functions.https.onRequest( rest.app )
