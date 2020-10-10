import { Response, Request } from 'express';
import { keyFilename } from '../index';
import { SessionsClient } from '@google-cloud/dialogflow';
import asyncHandler from '../helpers/asyncHandler';
import { WebhookClient } from 'dialogflow-fulfillment';
import { v4 as uuidv4 } from 'uuid';


export default class SessionController {
    
    intentAttempt = asyncHandler( async (req: Request, res: Response) => {

        const sessionClient = new SessionsClient({ keyFilename });
        const sessionId = (!req.params.sessionId) ? req.params.sessionId : uuidv4(); 
        const { projectId, textInput } = req.body;

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
        await sessionClient.detectIntent(request);
        
        const agent = new WebhookClient({ request: req, response: res });
        // console.log('body: ', req.body);
    
        console.log({
            intent: agent.intent,
            Query: agent.query,
            requesSource: agent.requestSource,
            session: agent.session,
            consoleMessages: agent.consoleMessages
        });
        // console.log(response);
    })

    public async detectIntent( req: Request, res: Response ): Promise<void> {
        try {   
            const sessionClient = new SessionsClient({ keyFilename });
            const sessionId = (req.params.sessionId) ? req.params.sessionId : uuidv4(); 
            const { projectId, textInput } = req.body;
    
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
            // console.log("Antes de llegar a la asginacion: ", req.body);
            req.body = { ...response[0], ...req.body, session: sessionPath};
            console.log("despues de llegar a la asginacion: ", req.body);
            const agent = new WebhookClient({ request: req, response: res });
            
            // const cuerpo = [{
            //     responseId: 'a1d88574-918b-4aae-bf43-5c1e6369ac5b-d794dba9',
            //     queryResult: [Object],
            //     webhookStatus: "",
            //     outputAudio: "",
            //     outputAudioConfig: ""
            // }];
            console.log({
                intent: agent.intent,
                Query: agent.query,
                requesSource: agent.requestSource,
                session: agent.session,
                consoleMessages: agent.consoleMessages
            });
        

        } catch (error) {
            console.error(error);
            res.status(500).send("Error making session")
        }

    }
}