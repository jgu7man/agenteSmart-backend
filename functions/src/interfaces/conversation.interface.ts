import { ApiMessagesSucceeded } from "./session.interface";
import firebase from 'firebase-admin'

export interface ClientRequest {
    projectId: string,
    textInput:string,
    userId: string,
    sessionId?: string,
    inputContexts?: any[],
    clientIDs?: ClientIDs
}

export interface SessionBody {
    sessionId?: string;
    textInput?: string;
    answers?: ApiMessagesSucceeded[]
    intentId?: string,
    intentName?: string,
    outputContexts?: any[]
}

export interface iCurrentSession{
    sessionId: string;
    outputContexts: any[]
    lastUpdate: Date | firebase.firestore.Timestamp
    sessionParams: { [key: string]: any }
}

export interface iInteraction {
    time: Date | firebase.firestore.Timestamp
    client: string,
    agent: string[]
    intent: {
        intentId: string,
        intentName: string,
    }
}

export interface ClientIDs {
    clientId?: string,
    messengerId?: string,
    whatsappId?:string
}

export interface ConversationSession {
    sessionId: string,
    inputContexs: any[]
}

export interface IntentResponse {
    state: string;
    respuestas?: ApiMessagesSucceeded[];
    session: SessionBody
}