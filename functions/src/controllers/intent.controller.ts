import { IntentsClient } from '@google-cloud/dialogflow';

import { Request, Response } from "express";
// ITrainingPhrase, 
//     IParameter, 
//     IPart 
import { keyFilename } from '../index';
import { 
    IIntent
} from "../interfaces/agent.interface";

export  default class IntentController {
    public createIntent(req: Request, res: Response): void{

        const { intent, projectId } = req.body as { projectId: string, intent: IIntent};
        //set webHook if its not provided:
        intent.webHookState = (typeof intent.webHookState === undefined) ? 0 : intent.webHookState;

        // let { name, displayName, webHookState, trainingPhrases, action, parameters } = req.body.intent; 
        const client = new IntentsClient({ keyFilename });

        const parent: string = client.agentPath(projectId);
        //falta validar los parametros (intent.Parameters: Array<IParameter>). 
        //Aquí o como middleware en otra funcion

        client.createIntent({
            parent,
            intent,
            intentView: "INTENT_VIEW_FULL"
        }).then( async response => {

            const operation = response[0];
            await client.close();

            return res.status(200).json({
                status: "Exito",
                result: operation
            });
        }).catch( err => {
            return res.status(500).json({
                status: "error",
                result: "An error has occurred creating intent",
                error: err
            });
        });

    }

    public updateIntent(req: Request, res: Response): void{
        //destructuring we can handle a 400 error here.
        const { intent , intentView } = req.body as { intent: IIntent, intentView: number };
        const client = new IntentsClient({ keyFilename });

        client.updateIntent({
            intent,
            intentView
        }).then( async result => {
            //inmutable data :P
            const updatedIntent = {...result[0]};
            await client.close();
            return res.status(200).json({
                status: "Success",
                result: updatedIntent
            });
        }).catch( error => {
            return res.status(500).json({
                status: "error",
                error
            })
        });
    }
     

    public deleteIntent(req: Request, res: Response): void {
        const intent:string = (typeof(req.params.intentId) === undefined)? req.params.intentId : req.body.intentId;
        const projectId: string = req.body.projectId;
        
        const client = new IntentsClient({ keyFilename });
        const name = client.intentPath(projectId, intent)
        client.deleteIntent({ name })
            .then( result => {
                return res.status(200).json({
                    status: "Success",
                    result: {
                        message: "Intent Succefully deleted",
                        response: result[0]
                    }
                });
            })
            .catch( error => {
                return res.status(500).json({
                    status: "error",
                    error: error
                })
            })
    }

    public listAllIntents(req: Request, res: Response): void {
        const { 
            intentView = 0, 
            pageSize = 25, 
            pageToken = null 
        } = req.query as unknown as { 
            intentView: number, 
            pageSize: number, 
            pageToken: string | null
        }
        const project: string = req.params.projectId;
        const client = new IntentsClient({ keyFilename });

        const parent = client.agentPath(project);


        client.listIntents({
            parent,
            intentView,
            pageSize,
            pageToken
        }).then( async result => {
            const intents = result[0];
            await client.close();
            return res.status(200).json({
                status: "Success",
                result: {
                    intents: intents,
                    numberOfIntents: intents.length
                }
            })
        }).catch( error => {
            return res.status(500).json({
                status: "Error",
                error
            });
        })


    }
    
}