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
    public async createIntent(req: Request, res: Response): Promise<void>{

        var { intent, projectId } = req.body as { projectId: string, intent: IIntent};
        //set webHook if its not provided:
        intent.webHookState = (typeof intent.webHookState == undefined) ? 0 : intent.webHookState;

        // let { name, displayName, webHookState, trainingPhrases, action, parameters } = req.body.intent; 
        const client = new IntentsClient({ keyFilename });

        let parent: string = client.agentPath(projectId);
        //falta validar los parametros (intent.Parameters: Array<IParameter>). 
        //Aquí o como middleware en otra funcion
        console.log(parent);

        client.createIntent({
            parent,
            intent,
            intentView: "INTENT_VIEW_FULL"
        }).then( response => {

            let operation = response[0];
            console.log(response);
            client.close();

            res.status(200).json({
                status: "Exito",
                result: operation
            });
        }).catch( err => {
            res.status(500).json({
                status: "error",
                result: "An error has occurred creating intent",
                error: err
            });
        });

    }

    public updateIntent(req: Request, res: Response): void {
        //destructuring we can handle a 400 error here.
        let { intent , intentView } = req.body as { intent: IIntent, intentView: number };
        const client = new IntentsClient({ keyFilename });

        client.updateIntent({
            intent,
            intentView
        }).then( result => {
            console.log(result)
            //inmutable data :P
            let updatedIntent = {...result[0]};
            client.close();
            res.status(200).json({
                status: "Success",
                result: updatedIntent
            });
        }).catch( error => {
            res.status(500).json({
                status: "error",
                error
            })
        });
    }
     

    public deleteIntent(req: Request, res: Response): void {
        let intent:string = (typeof(req.params.intentId) === undefined)? req.params.intentId : req.body.intentId;
        let projectId: string = req.body.projectId;
        
        const client = new IntentsClient({ keyFilename });
        let name = client.intentPath(projectId, intent)
        client.deleteIntent({name})
            .then( result => {
                console.log(result);
                client.close();
                res.status(200).json({
                    status: "Success",
                    result: {
                        message: "Intent Succefully deleted",
                        response: result[0]
                    }
                });
            })
            .catch( error => {
                console.log(error);
                client.close();
                res.status(500).json({
                    status: "error",
                    error: error
                })
            })
    }

    public listAllIntents(req: Request, res: Response): void {
        let { 
            intentView = 0, 
            pageSize = 25, 
            pageToken = null 
        } = req.query as unknown as { 
            intentView: number, 
            pageSize: number, 
            pageToken: string | null
        }
        let project: string = req.params.projectId;
        let parent = `projects/${project}/agent`;

        const client = new IntentsClient({ keyFilename });


        client.listIntents({
            parent,
            intentView,
            pageSize,
            pageToken
        }).then( result => {
            let intents = result[0];
            client.close();
            res.status(200).json({
                status: "Success",
                result: {
                    intents: intents,
                    numberOfIntents: intents.length
                }
            })
        }).catch( error => {
            console.log(error);
            client.close();
            res.status(500).json({
                status: "Error",
                error
            });
        })


    }
    
}