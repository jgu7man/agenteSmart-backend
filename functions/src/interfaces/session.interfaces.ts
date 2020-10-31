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
export interface PreDefinedOutput {
    estiloRespuesta: string;
    respuesta: object | string;
  }
 export interface ContionalOutput extends PreDefinedOutput{
      condicion: Condition;
      valor: string
      parametro: string;
  
  }
  export interface SearchOutput extends PreDefinedOutput {
    rutaDB:string
    parametro: string;
  
  }
  
 export interface DataParty extends PreDefinedOutput {
      grupoDatos: string;
      key: string;
      parametro: string;
  
  }
export type OutputMessage =
    | PreDefinedOutput
    | DataParty
    | SearchOutput
    | ContionalOutput;
    
type TypeOfAnswer =
    | 'buscar'
    | 'predefinida'
    | 'condicional'
    | 'grupo_datos';
  
  export interface ResponseFromFirebase{
    id: string;
    index: number;
    inputContext: string;
    outputContext: string;
    tipo: TypeOfAnswer;
    outputMessage: OutputMessage;
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

interface fromDialogflowApi<T> {
    kind: T,
    T: any;
}


//PARAMETROS DE API DE DIALOGFLOW
//ESTOS PARAMETROS ES UN MAP DE LA ESTRUCTURA CON SU KEY
// ES DEECIR<STRING, | LISTAS| STRING | MAP/object | NULL | BOOLEAN>
export type GetDocs<doc> = Partial<doc>

export type ApiMessagesSucceeded = OutputMessage & {
    outputContext: string
}