import { IIntent } from './agent.interface';
// Response type for conditional Output
type Condition =
| 'igual a'
| 'diferente a'
| 'mayor que'
| 'menor que'
| 'mayor o igual que'
| 'menor o igual que'
| 'existe'
| 'no existe';
 

// Defined types for array of answers received from firestore
export interface SimpleOutput {
    text: string;
    suggests: Suggest[],
}
export interface ContionalOutput extends SimpleOutput {
    condicion: Condition;
    valor: string
    parametro: string;
}
export interface SearchOutput extends SimpleOutput  {
    database:string
    parametro: string;
    card: object
}
export interface DataParty extends SimpleOutput  {
    coleccion: string;
    key: string;
    parametro: string;
    suggests: Suggest[]
}

export interface ResponseResult{
    text?: string,
    suggests?: Suggest[],
    cards?: Card[]
}

export interface Card {
    title: string,
    subtitle?: string,
    body?: string,
    imageUri?: string,
    buttons?: CardButton[]
}export interface CardButton {
        text?: string,
        postback?: string
}

export type Result =
    | SimpleOutput
    | DataParty
    | SearchOutput
    | ContionalOutput;
    
type TypeOfAnswer =
    | 'buscar'
    | 'simple'
    | 'condicional'
    | 'grupo_datos';
  
  export interface ResponseFromFirebase{
    id: string;
    index: number;
    inputContext: string;
    outputContext: string;
    tipo: TypeOfAnswer;
    result: Result;
}

//parameters puede ser un objeto con diferente estrcutura,
//dependiendo del tipo del parametro
export interface Context {
    name?: string | null;
    lifespanCount?: number | null;
    parameters?: object | null;
}

export interface QueryResult {
    queryText: string | null;
    action: string | null;
    parameters?: null | Object | Map<string, any> | ParameterFromQueryResult;
    webhookSource: string| null;
    webhookPayload: object | null;
    outputContexts: Array<Context> | null;
    allRequiredParamsPresent: boolean | null;
    intent: Partial<IIntent>;
    fulfillmentText: string;
    clientId?: string;
    sessionId?: string;
    projectId?: string;
}

export interface ParameterFromQueryResult{
    fields: fromDialogflowApi<any> | object
}

export interface Suggest {
    text: string
    context:string
}

interface fromDialogflowApi<T> {
    kind: T,
    T: any;
}


//PARAMETROS DE API DE DIALOGFLOW
//ESTOS PARAMETROS ES UN MAP DE LA ESTRUCTURA CON SU KEY
// ES DEECIR<STRING, | LISTAS| STRING | MAP/object | NULL | BOOLEAN>
export type GetDocs<doc> = Partial<doc>

export type ApiMessagesSucceeded = ResponseResult & {
    outputContext: string
}