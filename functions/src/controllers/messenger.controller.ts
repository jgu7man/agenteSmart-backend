import { ApiMessagesSucceeded, } from '../interfaces/session.interface';
import { Response, Request } from "express";
import { Event, Message } from '../interfaces/webhook.interface';
import { firestore } from "../middlewares/firebase.mid";
import FBmessenger from 'fb-messenger'
import { SessionController } from "./session.controller";
import { ClientRequest } from "../interfaces/conversation.interface";
import { ConversationItem, MessengerResponse, QuickReply, TemplateButton, TemplateCard } from "../interfaces/messenger.interface";



export default class MessengerWebhook {

    private messenger = new FBmessenger()
    private sessionCtr = new SessionController

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
        const {page_access_token, intent_response} = await this.getAgentResponses( convItem, res )
        
        if ( page_access_token ) {
            // Respond in messenger platform
            try {
                console.log( 'Post in messenger service' );
                
                if ( intent_response.message === 'ok' ) {
                    this.messenger.setToken( page_access_token )
                    this.messenger.sendAction(senderId, 'typing_on')
                    this.messenger.setNotificationType( 'REGULAR' )
                    await this.sendMessages(senderId, intent_response.respuestas)
                    this.messenger.sendAction(senderId, 'typing_off')
                }

                
                res.status( 200 ).send( 'Response emited' );
            } catch (error) {
                console.error(error);
                res.status(200).send('Error posting in messenger service')
            }

        } else {
            res.status(200).send('There is no response')
        }
        
            
                
        
        
    }

    private async getAgentResponses(
       { projectId, senderId, message}: ConversationItem,
        res: Response
    ): Promise<MessengerResponse> {
        const agentsQuery = await firestore
            .collectionGroup( 'agentes' )
            .where( 'projectId', '==', projectId )
            .get()
        
        
            if ( !agentsQuery.empty ) {
                
                const docPath = agentsQuery.docs[ 0 ].ref.path
                const messengerRef = firestore
                    .doc( `${ docPath }/integraciones/messenger` )
                const messengerDoc = await messengerRef.get()
                
                if ( messengerDoc.exists ) {
                    
                    const page_access_token: string =  messengerDoc.data()[ 'page_access_token' ]
                    const active = messengerDoc.data()[ 'activo']
                    
                    if ( active ) {
                        
                        const userId: string = docPath.split( '/' )[ 1 ]
                        const detectIntent: ClientRequest = {
                            projectId, userId,
                            textInput: message.text,
                            clientIDs: { messengerId: senderId }
                        }
                        
                        // Get the coversation doc and update in firestore
                        const intent_response = await this.sessionCtr.detectIntent( detectIntent )
                        
                        if ( intent_response ) {
                            return { page_access_token, intent_response }
                        } else { 
                            res.status( 200 ).send('There is nothing to awnser')
                            return null
                        }
                            
                        
                    } else {
                        res.status( 200 ).send('Agent is off')
                        return null
                    }
                } else {
                    res.status( 200 ).send("Don't have credentials")
                    return null
                }
    
            } else {
                res.status( 200 ).send("Agent not found")
                return null
            }
            
        
        
    }

    // private waitFor = (ms:number) => new Promise(r => setTimeout(r, ms));

    private sendMessages = async  ( senderId: string, responses: ApiMessagesSucceeded[] ) => {
        responses.forEach( async response => {
            // await this.waitFor(5000)
            console.log( response )
            if ( response.suggestions && response.suggestions.length > 0 ) {
                console.log('send quick responses')
                let suggests: QuickReply[] = []
                response.suggestions.forEach( suggestion => {
                    suggests.push( {
                        content_type: "text",
                        title:suggestion.text,
                        payload:suggestion,
                        image_url: suggestion.image_url ? suggestion.image_url : ""
                        
                    })
                })
                this.messenger.sendQuickRepliesMessage( {
                    id: senderId,
                    quickReplies: suggests,
                    attachment: response.text
                })
            } else
                if ( response.cards && response.cards.length > 0 ) {
                console.log( 'Send template response' )
                let cards: TemplateCard[] = []
                response.cards.forEach( card => {
                    let buttons: TemplateButton[] = []
                    card.buttons.forEach( button => {
                        buttons.push( {
                            type: button.type,
                            title: button.text,
                            url: button.type === 'web_url' ? button.url : null,
                            payload: button.type === 'postback' ? button.postback : null
                        })
                    })
                    cards.push( {
                        title: card.title,
                        image_url: card.imageUri,
                        subtitle: card.subtitle,
                        default_action: {
                            type: 'web_url',
                            url: card.buttons[ 0 ].postback,
                            messenger_extensions: false,
                            webview_height_ratio: 'TALL'
                        },
                        buttons: buttons
                    })
                })
            }else
                if ( response.text ) {
                console.log( 'send text message' )
                this.messenger.sendTextMessage( {
                    id: senderId,
                    text: response.text
                } )
                    }
        } )
        return
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


