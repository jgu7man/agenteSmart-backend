import { ApiMessagesSucceeded, } from '../interfaces/session.interface';
import { Response, Request } from "express";
import { Event, Message } from '../interfaces/webhook.interface';
import { firestore } from "../middlewares/firebase.mid";
import FBmessenger from 'fb-messenger'
import { SessionController } from "./session.controller";
import { ClientRequest } from "../interfaces/conversation.interface";
import { ConversationItem, iInteractionResult, QuickReply, TemplateButton, TemplateCard } from "../interfaces/messenger.interface";



export default class MessengerWebhook {

    private messenger = new FBmessenger()
    private sessionCtr = new SessionController
    // private result: MessengerInteractionResult

    public listenEvent = async ( req: Request, res: Response ) => {
        // console.log('LISTEN EVENT')
        const projectId = req.params.projectId || null;
        const body: Event = req.body;
        const eventTime = new Date( body.entry[ 0 ].time )
        const senderId = body.entry[ 0 ].messaging[ 0 ].sender.id
        
        /* Get the message body and update */
        let message: Message = body.entry[ 0 ].messaging[ 0 ].message
        message[ 'time' ] = eventTime
        
        /* Store message in firestore */
        // console.log( "Getting responses" )
        const convItem: ConversationItem = { projectId,senderId, message }
        const { page_access_token, intent_response } =
            await this.getAgentResponses( convItem, res )
        
        if ( page_access_token ) {
            
            /* Respond in messenger platform */
            try {

                // console.log( 'Post in messenger service' );
                if ( intent_response.state === 'ok' ) {
                    this.messenger.setToken( page_access_token )
                    this.messenger.sendAction(senderId, 'typing_on')
                    this.messenger.setNotificationType( 'REGULAR' )

                    // console.log( "Send messenger messages" )
                    // const response_messages = 
                    await this.sendMessages( senderId, intent_response.respuestas )
                    this.messenger.sendAction( senderId, 'typing_off' )
                    
                    // this.result = new MessengerInteractionResult(
                    //     p
                    // )
                    res.status( 200 ).json( 'Response emited' );
                
                
                } else {
                    res.status( 200 ).json( {
                        state: 'ERROR',
                        message: intent_response.state
                    })
                }


                
            } catch (error) {
                console.error(error);
                res.status(200).send('Error posting in messenger service')
            }

        } else {
            res.status(200).send('There is no response')
        }
    }

    private async getAgentResponses(
       { projectId, senderId, message }: ConversationItem,
        res: Response
    ): Promise<iInteractionResult> {
        // console.log( `Searching for project ${projectId}` )
        const agentsQuery = await firestore
            .collectionGroup( 'agentes' )
            .where( 'projectId', '==', projectId )
            .get()
        
        
            if ( !agentsQuery.empty ) {
                
                const docPath = agentsQuery.docs[ 0 ].ref.path
                // console.log( "Project found: " + docPath )
                
                // console.log( 'Searching for messenge config' )
                const messengerRef = firestore
                    .doc( `${ docPath }/integrations/messenger` )
                const messengerDoc = await messengerRef.get()

                
                if ( messengerDoc.exists ) {
                    
                    const page_access_token: string =  messengerDoc.data()[ 'page_access_token' ]
                    // console.log( 'Messenger config found' )
                    // console.log( `Page access token: ${ page_access_token }` )
                    
                    const active = messengerDoc.data()['active']
                    
                    if ( active ) {
                        
                        // console.log( 'Agent Smart is active!' )
                        const userId: string = docPath.split( '/' )[ 1 ]
                        const detectIntentBody: ClientRequest = {
                            projectId, userId,
                            textInput: message.text,
                            clientIDs: { messengerId: senderId }
                        }
                        
                        
                        /* Get the coversation doc and update in firestore */
                        
                        // console.log( 'Request detect intent:', detectIntentBody )
                        const intent_response =
                            await this.sessionCtr.detectIntent( detectIntentBody )
                        
                        if ( intent_response ) {
                            // console.log( "Intent detected and processed to responding" )
                            return { page_access_token, intent_response, active }
                        } else {
                            const message = '!!! There is nothing to awnser'
                            const result = {message, state: 'ERROR' }
                            console.log( result )
                            throw result
                        }
                    } else {
                        const message = 'Agent is off'
                        const result = { message, state: 'ERROR' }
                        console.log( result)
                        throw result
                    }
                } else {
                    const message = "!!! Don't have credentials"
                    const result = { message, state: 'ERROR' }
                    console.log( result  )
                    throw result
                }
            } else {
                const message = "!!! Agent not found"
                const result = { message, state: 'ERROR' }
                console.log( result )
                throw result
            }
            
        
        
    }



    private sendMessages = async (
        senderId: string,
        responses: ApiMessagesSucceeded[]
    ): Promise<any[]> => {
        const responseMessages: any[] = []
        
        await this.asyncForEach( responses,
            async (response) => {
            // console.log( "process (response):", response )

            /* SEND MESSAGE WITH QUICK RESPONSES */
                if ( response.suggestions && response.suggestions.length > 0 ) {
                    // console.log('send quick responses')
                    let suggests: QuickReply[] = []
                    response.suggestions.forEach( suggestion => {
                        suggests.push( {
                            content_type: "text",
                            title:suggestion.text,
                            payload:suggestion.text,
                            image_url: suggestion.image_url || ""
                            
                        })
                    } )
                    
                    const message = {
                        id: senderId,
                        quickReplies: suggests,
                        attachment: response.text
                    }
                    await this.messenger.sendQuickRepliesMessage( message )
                        .then( () => console.log( 'message sended: ' + message))
                    responseMessages.push( message )

                    
                /* SEND CARD MESSAGE */
                } else if ( response.cards && response.cards.length > 0 ) {
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
                        } )
                        // this.messenger.
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
                
                
                
                // SEND TEXT RESPONSE
                } else if ( response.text ) {
                    // console.log( 'Send text message:', response.text )

                    const message = {
                        id: senderId,
                        text: response.text
                    }
                    await this.messenger.sendTextMessage( message )
                        .then( () => console.log( 'message sended: ' + message))
                    responseMessages.push( message )
                }
                
                let waitSecs = response.text.length * 180
                await this.waitFor( waitSecs > 5000 ? 5000 : waitSecs)
        } )

        return responseMessages
    }


    public requestEvent = async (req: Request, res: Response)=> {
        
        console.log( 'REQUEST EVENT' )
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


    waitFor = ( ms: number ) => new Promise( r => setTimeout( r, ms ) )



    async asyncForEach<T>( array: T[],
        callback: ( item: T, i: number, a?: T[] ) => any ) {
        for ( let index = 0; index < array.length; index++ ) {
            callback( array[ index ], index, array );
        }
    }

    


}

export class MessengerInteractionResult {
    public time: Date = new Date();
    constructor (
        public agent: string,
        public senderId: string,
        public message: string,
        public active: boolean,
        public response_messages: any[]
    ) {
        
    }
}

export interface iMessengerInteraction {
    agent: string;
}

export const emptyMessengerInteraction = {
}
