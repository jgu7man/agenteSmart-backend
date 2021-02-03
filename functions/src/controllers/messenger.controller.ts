import { Response, Request } from "express";
import { Event, Message } from '../interfaces/webhook.interface';
import { firestore } from "../middlewares/firebase.mid";
import firebase from "firebase-admin";
import FBmessenger from 'fb-messenger'



export default class MessengerWebhook {

    private messenger = new FBmessenger()

    public listenEvent = async ( req: Request, res: Response ) => {
        console.log('LISTEN EVENT')
        
        const projectId = req.params.projectId ? req.params.projectId : null;
        const body: Event = req.body;
        const eventTime = new Date( body.entry[ 0 ].time )
        const senderId = body.entry[ 0 ].messaging[ 0 ].sender.id
        
        // Get the message body and update
        let message: Message = body.entry[ 0 ].messaging[ 0 ].message
        message[ 'time' ] = eventTime
        
        // Store message in firestore
        const convItem: ConversationItem = { projectId,senderId, message }
        const page_access_token = await this.updateConv( convItem, res )
        
        if ( page_access_token ) {
            // Respond in messenger platform
            try {
                console.log( 'Post in messenger service' );
                
                this.messenger.setToken( page_access_token )
                this.messenger.setNotificationType( 'REGULAR' )
                
                this.messenger.sendTextMessage( {
                    id: senderId,
                    text: 'hola'
                } )
                
                res.status( 200 ).send( 'EVENT_RECEIVED' );
            } catch (error) {
                console.error(error);
                res.status(424).send('Error posting in messenger service')
            }

        } else {
            res.sendStatus(200)
        }
        
            
                
        
        
    }

    private async updateConv(
       { projectId, senderId, message}: ConversationItem,
        res: Response
    ): Promise<string> {
        const agentsQuery = await firestore
            .collectionGroup( 'agentes' )
            .where( 'projectId', '==', projectId )
            .get()
        
        if ( !agentsQuery.empty ) {
            
            const docPath = agentsQuery.docs[ 0 ].ref.path
            const messengerRef = firestore.doc( `${docPath}/integraciones/messenger` )
            const messengerDoc = await messengerRef.get()
            const page_access_token = messengerDoc.data()[ 'page_access_token' ]
            const active = messengerDoc.data()[ 'activo']
            

            if ( active ) {
                // Get the coversation doc and update in firestore
                try {
                    const addConv = firebase.firestore.FieldValue.arrayUnion
                    const convRef = firestore.doc( `${ docPath }/conversaciones/${ senderId }` )
                    
                    const convDoc = await convRef.get()
                    if ( !convDoc.exists ) {
                        await convRef.set({conversation:[]})
                    }
        
                    await convRef
                        .update( { conversation: addConv( message ) } )
                        .catch( error => {console.error(error)})
                    
        
                } catch (error) {
                    console.error( error );
                    res.status(424).send('Error with the firestore service')
                }

                return page_access_token
            } else {
                return null
            }

        } else {
            res.status( 404 ).send( 'Agent not found' );
            return null
        }
    }


    public requestEvent = async (req: Request, res: Response)=> {
        
        console.log('REQUEST EVENT')
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


export interface ConversationItem {
    projectId: string,
    senderId: string,
    message: Message
}