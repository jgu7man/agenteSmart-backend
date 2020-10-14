import { IntentsClient } from '@google-cloud/dialogflow';

import { Request, Response  } from "express";
import asyncHandler from '../helpers/asyncHandler';
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
        const client = new IntentsClient({ credentials: keyFilename });

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

            return res.status(201).json({
                intent: operation
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
        const { intent, intentView} = req.body as { intent: IIntent, intentView: number };
        const client = new IntentsClient({ credentials: keyFilename });
        
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
    
    public deleteIntentWithParams = asyncHandler( async (req: Request, res: Response) => {
        const { intent, projectId } = req.query as {intent: string, projectId: string}
        const request = await this.deleteFromDialogFlow(intent, projectId);

        if (request) {
            res.status(204).end();
        }
    })
    public deleteIntent = async (req: Request, res: Response) => {
        const { intent, projectId } = req.params as { intent: string, projectId: string }
        try {
            
            const request = await this.deleteFromDialogFlow(intent, projectId);
            if (request) {
                res.status(204).end();
                return
            }
        } catch (error) {
            if (error.code === 5) {
                res.status(404).json({
                    status: "Error",
                    name: "NOT INTENT AVAILABLE",
                    message: error.message
                }).end()
                return
            }
            res.status(500).json({
                status: "Error",
                name: "INTENT DELATION ERROR",
                message:"Error borrando Intent"
            }).end()

        }
    };


    private deleteFromDialogFlow(intentName: string, projectId: string):
        Promise<object>{
        return new Promise((resolve, reject) => {
            const client = new IntentsClient({ credentials: keyFilename });
            const name = client.intentPath(projectId, intentName)

            client.deleteIntent({ name })
                .then( result => {
                    if (result) {
                        resolve(result[0])
                    }
                })
                .catch( error => {
                   if (error) {
                       reject(error)
                   }
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
        const client = new IntentsClient({ credentials: keyFilename });

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