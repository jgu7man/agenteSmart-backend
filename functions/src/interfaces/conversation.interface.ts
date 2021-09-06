import { ApiMessagesSucceeded } from "./session.interface";

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
    message: string;
    respuestas?: ApiMessagesSucceeded[];
}