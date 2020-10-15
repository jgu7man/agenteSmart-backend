import { Response, Request } from 'express';
import { keyFilename } from '../index';
import { SessionsClient } from '@google-cloud/dialogflow';
import { v4 as uuidv4 } from 'uuid';
import * as admin from 'firebase-admin';

export default class SessionController {
    private auth: admin.app.App;

    constructor() {
        this.auth = admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            databaseURL: "https://main-agentesmart.firebaseio.com"
        });
    }

    public detectIntent = async (req: Request, res: Response): Promise<void>=> {
        try {  
            const sessionClient = new SessionsClient({ credentials: keyFilename });
            const sessionId = (req.params.sessionId) ? req.params.sessionId : uuidv4(); 
            const { projectId, textInput, clientId } = req.body;
    
            const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);
            const request = {
                session: sessionPath,
                queryInput: {
                    text: {
                        // The query to send to the dialogflow agent
                        text: textInput,
                        // The language used by the client (en-US)
                        languageCode: 'es',
                    }
                }
            }
            
            // console.log(request);
            const response = await sessionClient.detectIntent(request);
            console.log('Respuesta de Dialogflow', response[0].queryResult);
            // console.log("Antes de llegar a la asginacion: ", req.body);
            req.body = { ...response[0], ...req.body, session: sessionPath};
            // const agent = new WebhookClient({ request: req, response: res });
            const sessionResult = response[0].queryResult;
            

            const getRespuestas = await this.retriveMessagesFromFireStore(clientId, projectId, sessionResult.intent.displayName)
            if (getRespuestas) {

                
                res.status(200).json({
                    message: "Exito",
                    respustas: getRespuestas
                })
                return;
            }
            res.status(404).json({
                message:"No se encontro base de datos con ese clientId y projectId"
            })
            // const cuerpo = [{
            //     responseId: 'a1d88574-918b-4aae-bf43-5c1e6369ac5b-d794dba9',
            //     queryResult: [Object],
            //     webhookStatus: "",
            //     outputAudio: "",
            //     outputAudioConfig: ""
            // }];
            // console.log({
            //     intent: agent.intent,
            //     Query: agent.query,
            //     requesSource: agent.requestSource,
            //     session: agent.session,
            //     consoleMessages: agent.consoleMessages
            // });
        

        } catch (error) {
            console.error(error);
            res.status(500).send("Error making session")
        }

    }
    private async retriveMessagesFromFireStore(clientId : string, idProject: string, intentDisplayName: string): Promise<FirebaseFirestore.DocumentData> {
        // /usuarios/{idUser}/agentes/{idProject}/mensajes/{intentName}/respuestas
        const pathToCollection = `/usuarios/${clientId}/agentes/${idProject}/mensajes/${intentDisplayName}/respuestas`;
        const firestore = this.auth.firestore();
        
        const intentRef = firestore.collection(pathToCollection);
        let documents = []

        const responses = await intentRef.get();
        for (const doc of responses.docs) {
            documents.push(doc.data())
        }
        return documents;
    }
}