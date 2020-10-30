import { IParameter } from './../interfaces/agent.interface';
import { PreDefinedOutput, ContionalOutput, QueryResult, ApiMessagesSucceeded, ResponseFromFirebase, ParameterFromQueryResult, Context } from './../interfaces/session.interfaces';
import { Response, Request } from 'express';
import { ContextsClient, SessionsClient } from '@google-cloud/dialogflow';
import { v4 as uuidv4 } from 'uuid';
import * as admin from 'firebase-admin';
import { keyFilename } from '../index';

export default class SessionController {
  private auth: admin.app.App;
  _sessionControler: Array<Promise<ApiMessagesSucceeded> | null>
  _currentQueryResult: QueryResult;
  _currentSessionId: string;
  _CurrentProjectId: string;
  _Contexts: Array<any>;
  constructor() {
    this.auth = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      databaseURL: "https://main-agentesmart.firebaseio.com"
    });
  }

  public detectIntent = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId, textInput, clientId } = req.body;
      this._CurrentProjectId = projectId;
      const sessionClient = new SessionsClient({ credentials: keyFilename });
      const sessionId = (req.body.sessionId) ? req.body.sessionId : uuidv4();
      this._sessionControler= []
  
      this._currentSessionId = sessionClient.projectAgentSessionPath(projectId, sessionId);
        
      const request = {
        session: this._currentSessionId,
        queryInput: {
          text: {
            // The query to send to the dialogflow agent
            text: textInput,
            // The language used by the client (en-US)
            languageCode: 'es',
          }
        }
      }
          
      // console.log(request);
      const response = await sessionClient.detectIntent(request);
      if (response[0].queryResult) {
          
        this._currentQueryResult = <QueryResult>response[0].queryResult;
      }
      console.log('Respuesta de Dialogflow', response[0].queryResult);
      // console.log("Antes de llegar a la asginacion: ", req.body);
      req.body = { ...response[0], ...req.body, session: this._currentSessionId };
      // const agent = new WebhookClient({ request: req, response: res });
      const sessionResult = response[0].queryResult;
          
      const getRespuestas = await this.retriveMessagesFromFireStore(clientId, projectId, sessionResult.intent.displayName)
      if (getRespuestas) {
        const controllerPerformance = await this.ManageResponsesController(getRespuestas)

        console.info("\n\tExito!\n\tSe han retornado las siguientes respuestas:\n\t\t", controllerPerformance)
        res.status(200).json({
          message: "Exito",
          session: sessionId,
          respustas: controllerPerformance
        })
        return;
      }
      res.status(404).json({
        message: "No se encontro base de datos con ese clientId y projectId"
      })
      
    } catch (error) {
      console.error(error);
      res.status(500).send("Error making session")
    }

  }
  private async retriveMessagesFromFireStore(clientId: string, idProject: string, intentDisplayName: string): Promise<Array<ResponseFromFirebase | null>> {
    // /usuarios/{idUser}/agentes/{idProject}/mensajes/{intentName}/respuestas
    const pathToCollection = `/usuarios/${clientId}/agentes/${idProject}/mensajes/${intentDisplayName}/respuestas`;
    const firestore = this.auth.firestore();
      
    const intentRef = firestore.collection(pathToCollection);
    const documents = []

    const responses = await intentRef.get();
    console.info('Ruta tomado de FireStore:', pathToCollection);
    
    for (const doc of responses.docs) {
        
      documents.push(<ResponseFromFirebase>doc.data())
      console.log('Respustas de FireStore:', doc.data());
    }
    return documents;
  }

  // private _validateSearch = async (responseFromFS: ResponseFromFirebase) => {
  //   let responseFromApi: Array<any>
  // }
  private _validateConditional = async (responseToValidate: ContionalOutput, exitContext: string): Promise<ApiMessagesSucceeded | null> => {
    let resolve = false;
    const current = <IParameter>this._currentQueryResult.parameters;
    if (current.name === responseToValidate.parametro) {
      switch (responseToValidate.condicion) {
        case 'igual a':
          if (current.value === responseToValidate.valor) resolve = true;
          break;
        case 'diferente a':
          if (current.value !== responseToValidate.valor) resolve = true;
          break;
        case 'mayor que':
          if (current.value > responseToValidate.valor) resolve = true;
          break;
        case 'menor que':
          if (current.value < responseToValidate.valor) resolve = true;
          break;
        case 'mayor o igual que':
          if (current.value >= responseToValidate.valor) resolve = true;
          
          break;
        case 'menor o igual que':
          if (current.value >= responseToValidate.valor) resolve = true;
          
          break;
        case 'existe':
          if (current.value.includes(responseToValidate.valor)) resolve = true;
          break;
        case 'no existe':
          if (!current.value.includes(responseToValidate.valor)) resolve = true;
          break;
        default:
          break;
      }
    }
    if (resolve) {
      return { ...responseToValidate, outputContext: exitContext };
    }
    return null;
  }
  // private _validateDataGroup = async (responseToValidate: dataParty): Promise<OutputMessage | null> => {
  //    let resolve = false;
  //   const current = <IParameter>this._currentQueryResult.parameters;
  //   if (condition) {
      
  //   }
  //   return null;
  // }
  private _validatePredefinida = async (responseToValidate: PreDefinedOutput, exitContext: string): Promise<ApiMessagesSucceeded | null> => {
    if (typeof responseToValidate !== undefined) {
      return { ...responseToValidate, outputContext: exitContext };
    }
    return null
  }
  
  private _controllerResponse = async () => { 
   const responsesToReturn: Array<ApiMessagesSucceeded> = []
    const outputContextsSetted: Array<string | null> = [];
    
    //execute all promises mapping a async function for each one
    const responses = await Promise.all(
      this._sessionControler.map(async fxtion => {
        try {
          const currentResponse = await fxtion;
          console.info(`\n\n\tRespuesta Procesada. \n\tResultado: ${currentResponse}`)
          if (!outputContextsSetted.find(x => x === currentResponse.outputContext)) {
            await this._createContext(currentResponse.outputContext)
            outputContextsSetted.push(currentResponse.outputContext)
          }
          responsesToReturn.push(currentResponse)
          return currentResponse;
        } catch (error) {
          if (error) {
            console.error('Error en procesando respuesta \n', error)
          }
          return new Error('Error en setear responeses')
        }
      })
    );
    
    debugger;
    console.info('Respuestas:', responses);
    return responsesToReturn;
    // const errorOcurredToDispla = responses.filter(y => {
    //   if (y instanceof Error) {
    //     return true;
    //   };
    //   return false;
    // })
  
      
  }

  protected ManageResponsesController = async (arrayOfAnswer: Array<ResponseFromFirebase>) => {
    const parametersToEvaluate = <ParameterFromQueryResult<any>>this._currentQueryResult.parameters;
    // this._currentQueryResult.parameters.forEach( function(obj) {
    if (Object.keys(parametersToEvaluate.fields)[0] === undefined) {
      const { intent } = this._currentQueryResult;
      console.info('Intent Actual Respuestas:', intent);
      if (arrayOfAnswer.length > 1 && intent.isFallback) {
        arrayOfAnswer.filter(x => {
          if (x.tipo !== "predefinida") {
            return false;
          }
          this._sessionControler.push(this._validatePredefinida(x.outputMessage,x.outputContext))
          return true;
        });
      }
    } 
    else {
      
      parametersToEvaluate.fields.forEach((x) => {
        console.log('Inspeccionando parametro:', x)
      });
  
      for (const element of arrayOfAnswer) {
        switch (element.tipo) {
          case 'grupo_datos':
            
            break;
          case 'buscar':
            
            break;
          case 'condicional':
            this._sessionControler.push(this._validateConditional(<ContionalOutput>element.outputMessage, element.outputContext))
            break;
          case 'predefinida':
            this._sessionControler.push(this._validatePredefinida(element.outputMessage, element.outputContext))
            break;
          default:
            throw new Error('Esa respuesta no la pude procesar');
        }
      }
    }
    const responsesReturned = await this._controllerResponse();

    return responsesReturned;
  }
 
  private async _createContext(contextString: string) {
    const contextClient = new ContextsClient({ credentials: keyFilename })
    const context: Context = {
      name: `${this._currentSessionId}/contexts/${contextString}`,
      lifespanCount: 1,
    }
    // projects/<Project ID>/agent/sessions/<Session ID>
    // Parent string format
    debugger;
    console.info('Tome parent como:', this._currentSessionId);
    await contextClient.createContext({parent: this._currentSessionId, context})
    console.info('Te Acabo de setear contexto:', contextString)
  }

}