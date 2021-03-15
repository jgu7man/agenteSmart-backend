import { ApiMessagesSucceeded } from "./session.interface";

export interface ClientRequest {
    projectId: string,
    textInput:string,
    clientId: string,
    sessionId?: string,
    inputContexts?: any[],
    userIDs?: UserIDs
}

export interface SessionBody {
    sessionId?: string;
    textInput?: string;
    answers?: ApiMessagesSucceeded[]
    intentId?: string,
    intentName?: string,
    outputContexts?: any[]
}

export interface UserIDs {
    userId?: string,
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