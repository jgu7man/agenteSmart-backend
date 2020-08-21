import { Response } from 'express';
import { Request } from 'express';
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
            req.body.agent = response;
            const agent = new WebhookClient({ request: req, response: res });
            console.log(agent);
        
            // console.log({
            //     intent: agent.intent,
            //     Query: agent.query,
            //     requesSource: agent.requestSource,
            //     session: agent.session,
            //     consoleMessages: agent.consoleMessages
            // });
            // console.log(response);
            
        } catch (error) {
            console.log(error);
            res.status(500).send("Error making session")
        }

    }
}