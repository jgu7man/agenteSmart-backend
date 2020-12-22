import { Response, Request } from "express";
import { Event, Entry, } from "../interfaces/webhook.interface";
import { firestore } from "../middlewares/firebase.mid";




export default class MessengerWebhook {



    public listenEvent = async (req: Request, res: Response) => {

        // console.log( req )
        // console.log( req.params )
        const body: Event = req.body;
        const userId = req.params.userId ? req.params.userId : null;
        const projectId = req.params.projectId ? req.params.projectId : null;

        // Checks this is an event from a page subscription
        if (userId && projectId ) {
    
            // Iterates over each entry - there may be multiple if batched
            body.entry.forEach(function(entry: Entry) {
        
                // Gets the message. entry.messaging is an array, but 
                // will only ever contain one message, so we get index 0
                // const webhook_event = entry.messaging[ 0 ];
                // console.log( entry );    
                firestore.doc( `usuarios/${ userId }/agentes/${ projectId }/conversaciones/test` )
                    .set( entry )
                    .catch( error => {console.log(error)})
            } );
                
            
        
            // Returns a '200 OK' response to all requests
            res.status( 200 ).send( 'EVENT_RECEIVED' );
            
        } else {
        // Returns a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
        }

    }


    public requestEvent = async (req: Request, res: Response)=> {
        
        // Parse the query params
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        
        // Verify token by firestore query.
        
        
        // Checks if a token and mode is in the query string of the request
        if (mode && token) {
        
            // Checks the mode and token sent is correct
            if (mode === 'subscribe') {
                
                console.log(token)
                const agents = await firestore
                    .collectionGroup( 'agentes' )
                    .where( 'projectId', '==', token )
                    .get()
                
                if ( !agents.empty ) {
                    console.log('WEBHOOK_VERIFIED');
                    res.status(200).send(challenge);
                } else {
                    res.status(404).send('NOT ALLOWED');
                }
            
            } else {
                // Responds with '403 Forbidden' if verify tokens do not match
                res.sendStatus(403);      
            }
        }
    }


}