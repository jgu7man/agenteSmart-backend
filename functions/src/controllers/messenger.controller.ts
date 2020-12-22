import { Response, Request } from "express";
import { Event, Entry, } from "../interfaces/webhook.interface";
import { firestore } from "../middlewares/firebase.mid";




export default class MessengerWebhook {



    public listenEvent = async (req: Request, res: Response) => {

        const body: Event = req.body;
        const projectId = req.params.projectId ? req.params.projectId : null;
        const agentsQuery = await firestore
            .collectionGroup( 'agentes' )
            .where( 'projectId', '==', projectId )
            .get()
        console.log(body.entry)
        
        if ( !agentsQuery.empty ) {
            
            const docPath = agentsQuery.docs[ 0 ].ref.path
            
            body.entry.forEach(function(entry: Entry) {
                
                firestore.doc( `${ docPath }/conversaciones/test` )
                .set( entry )
                .catch( error => {console.log(error)})
            } );
            
            res.status( 200 ).send( 'EVENT_RECEIVED' );
            
        } else {
            res.sendStatus(404);
        }

    }


    public requestEvent = async (req: Request, res: Response)=> {
        
        // Parse the query params
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        
        
        if (mode && token) {
        
            if (mode === 'subscribe') {
                
                console.log(token)
                const agents = await firestore
                    .collectionGroup( 'agentes' )
                    .where( 'projectId', '==', token )
                    .get()
                
                if ( !agents.empty ) {
                    console.log( 'WEBHOOK_VERIFIED' );
                    res.status(200).send(challenge);
                } else {
                    res.status(404).send('NOT ALLOWED');
                }
            
            } else {
                res.sendStatus(403);      
            }
        }
    }


}