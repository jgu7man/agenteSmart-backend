import { Response, Request } from "express";
import {  MessageBody, } from "../interfaces/webhook.interface";
import { firestore } from "../middlewares/firebase.mid";
// import firebase from "firebase-admin";
import FBmessenger from 'fb-messenger'



export default class MessengerWebhook {

    private messenger = new FBmessenger()

    public listenEvent = async ( req: Request, res: Response ) => {
        
        
        const body: MessageBody = req.body;
        const projectId = req.params.projectId ? req.params.projectId : null;
        const agentsQuery = await firestore
            .collectionGroup( 'agentes' )
            .where( 'projectId', '==', projectId )
            .get()
        console.log( body.sender )
        console.log( body )
        
        // ! Falta aregar la obtención del page_access_token
        this.messenger.setToken(  )
        this.messenger.setNotificationType( 'REGULAR' )

            if ( !agentsQuery.empty ) {
                
                const docPath = agentsQuery.docs[ 0 ].ref.path
            
                firestore.doc( `${ docPath }/conversaciones/test` )
                .set( body.message )
                .catch( error => {console.log(error)})
                

                this.messenger.sendTextMessage({id:body.sender.id, text:'hola'})
            
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