import { PreDefinedOutput, QueryResult, ContionalOutput, ApiMessagesSucceeded, ResponseFromFirebase, ParameterFromQueryResult, Context, SearchOutput, DataParty } from './../interfaces/session.interfaces';
import { Response, Request } from 'express';
import { ContextsClient, SessionsClient } from '@google-cloud/dialogflow';
import { v4 as uuidv4 } from 'uuid';
import * as admin from 'firebase-admin';
import { keyFilename } from '../index';

export default class SessionController {
  private auth: admin.app.App;
  _Contexts: Array<any>;
  _parentPath: string;
  constructor() {
    this.auth = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      databaseURL: "https://main-agentesmart.firebaseio.com"
    });
  }
  public detectIntent = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId, textInput, clientId } = req.body;
      const sessionClient = new SessionsClient({ credentials: keyFilename });
      const sessionId = (req.body.sessionId) ? req.body.sessionId : uuidv4();
  
      const sessionPath= sessionClient.projectAgentSessionPath(projectId, sessionId);
      this._parentPath = sessionPath;
      const request = {
        session: sessionPath,
        queryInput: {
          text: {
            // The query to send to the dialogflow agent
            text: textInput,
            // The language used by the client (en-US)
            languageCode: 'es',
          }
        }
      }

      //Inicia la secuenia
      // console.log(request);
      const response = await sessionClient.detectIntent(request).then(result => result[0]);
          
      // console.log('Respuesta de Dialogflow', response.queryResult);
      // console.log("Antes de llegar a la asginacion: ", req.body);
      // const agent = new WebhookClient({ request: req, response: res });
      const sessionResult = <QueryResult>{
        ...response.queryResult,
        clientId: clientId,
        sessionId,
        projectId
      }
          
      const getRespuestas = await this.retriveMessagesFromFireStore(clientId, projectId, sessionResult.intent.name)
      if (getRespuestas) {
        const controllerPerformance = await this.ManageResponsesController(getRespuestas, sessionResult)

        // console.info("\n\tExito!\n\tSe han retornado las siguientes respuestas:\n\t\t", controllerPerformance)
        res.status(200).json({
          message: "Exito",
          session: sessionId,
          respuestas: controllerPerformance
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

  private async retriveMessagesFromFireStore(clientId: string, idProject: string, intentName: string): Promise<Array<ResponseFromFirebase | null>> {
    // /usuarios/{idUser}/agentes/{idProject}/mensajes/{intentName}/respuestas
    const idName = intentName.slice(intentName.lastIndexOf('/') + 1);
    const pathToCollection = `/usuarios/${clientId}/agentes/${idProject}/mensajes/${idName}/respuestas`;
    // console.info('\nPath a la collection es:\t ', pathToCollection)
    const firestore = this.auth.firestore();
      
    const intentRef = firestore.collection(pathToCollection);
    const documents = []

    const responses = await intentRef.get();
    
    for (const doc of responses.docs) {
        
      documents.push(<ResponseFromFirebase>doc.data())
    }
    return documents;
  }


  // private _controllerResponse = async () => { 
  //  const responsesToReturn: Array<ApiMessagesSucceeded> = []
  //   const outputContextsSetted: Array<string | null> = [];
    
  //   //execute all promises mapping a async function for each one
  //   const responses = await Promise.all(
  //     this._sessionControler.map(async fxtion => {
  //       try {
  //         const currentResponse = await fxtion;
  //         console.info(`\n\n\tRespuesta Procesada. \n\tResultado: ${currentResponse}`)
  //         if (!outputContextsSetted.find(x => x === currentResponse.outputContext)) {
  //           await this._createContext(currentResponse.outputContext)
  //           outputContextsSetted.push(currentResponse.outputContext)
  //         }
  //         responsesToReturn.push(currentResponse)
  //         return currentResponse;
  //       } catch (error) {
  //         if (error) {
  //           console.error('Error en procesando respuesta \n', error)
  //         }
  //         return new Error('Error en setear responeses')
  //       }
  //     })
  //   );
    
  //   debugger;
  //   console.info('Respuestas:', responses);
  //   return responsesToReturn;
  //   // const errorOcurredToDispla = responses.filter(y => {
  //   //   if (y instanceof Error) {
  //   //     return true;
  //   //   };
  //   //   return false;
  //   // })
  
      
  // }
  private _parsedResponseFromDialogflow = (parameters: ParameterFromQueryResult) => {
    const newIterator = Object.entries(parameters.fields);

    return new Map(newIterator.map((x) => {
      const paramName = x[0]
      const paramValueTypeName = x[1]['kind'];
      const paramValue = x[1][paramValueTypeName];
      return  [paramName, paramValue ]
    }))
  }
  

  protected ManageResponsesController = async (arrayOfAnswer: Array<ResponseFromFirebase>, queryResult: QueryResult) => {
    const parametersToEvaluate = this._parsedResponseFromDialogflow(<ParameterFromQueryResult>queryResult.parameters)
    //setNewParams
    queryResult.parameters = parametersToEvaluate;
    const promisesToHandle: Array<Promise<ApiMessagesSucceeded>> = [];
    // const parameterArray = queryResult.parameters;
    // this._currentQueryResult.parameters.forEach( function(obj) {
    
    if (!parametersToEvaluate && arrayOfAnswer.length > 1) {
      arrayOfAnswer.forEach(x => {
        if (x.tipo === "predefinida") {
          promisesToHandle.push(this._validatePredefinida(x.outputMessage, x.outputContext))
        }
      });
    }
    else {
      for (const element of arrayOfAnswer) {
        switch (element.tipo) {
          case 'grupo_datos':
            promisesToHandle.push(this._validateDataGroup(<DataParty>element.outputMessage, element.outputContext, parametersToEvaluate));
            break;
          case 'buscar':
            promisesToHandle.push(this._validateSearch(<SearchOutput>element.outputMessage, queryResult ,element.outputContext))
            break;
          case 'condicional':
            promisesToHandle.push(this._validateConditional(<ContionalOutput>element.outputMessage, element.outputContext, parametersToEvaluate))
            break;
          case 'predefinida':
            promisesToHandle.push(this._validatePredefinida(element.outputMessage, element.outputContext))
            break;
          default:
            throw new Error('Esa respuesta no la pude procesar');
        }
      }
    }
    const answers: ApiMessagesSucceeded[] = await Promise.all(promisesToHandle)
      .then( async anwsersToSetContext => {
        const outputContextsSetted: Array<string> = [];
        const errors = []
        try {
          for (const currentResponse of anwsersToSetContext) {
            
            if (!outputContextsSetted.find(x => x === currentResponse.outputContext)) {
              await this._createContext(currentResponse.outputContext);
              outputContextsSetted.push(currentResponse.outputContext)
            }
          }
        } catch (error) {
          if (error) {
            // console.error('Error en procesando respuesta \n', error)
            errors.push(error)
          }
        }
        return anwsersToSetContext;
      })
      .then()
      .catch(error => {
        console.error('Error en la ejecucion de las validaciones', error);
        return [...error]
      })
    
    
    return answers;
    // const responsesReturned = await this._controllerResponse();
    // return responsesReturned;
  }

  private _validateSearch = async (responseToValidate: SearchOutput, queryResult:QueryResult , outputCtx: string): Promise<ApiMessagesSucceeded | null> => {
    const _hashOfParams = <Map<string, any>>queryResult.parameters;
    //condicion: si existe rutaDb y si existe ParamName dentro de Los parametros retornados.
    if (responseToValidate.rutaDB && _hashOfParams.get(responseToValidate.parametro)) {
      const pathToCollection = `/usuarios/${queryResult.clientId}/agentes/${queryResult.projectId}/tarjetas/${responseToValidate.rutaDB}`
      const firestore = this.auth.firestore();
      const databaseRef = await firestore.collection(pathToCollection).get()
      const data = [];

      for (const document of databaseRef.docs) {
        data.push(<any>document.data());
      }
      return {...responseToValidate, respuesta: data, outputContext: outputCtx};
    }
    return null;
  }
 
  private _validateConditional = async (responseToValidate: ContionalOutput, exitContext: string, parameters: Map<string, any>): Promise<ApiMessagesSucceeded | null> => {
    let resolve = false;
    const current = parameters.get(responseToValidate.parametro);
    // console.log(`Valor del paramName: ${responseToValidate.parametro}, valor del value a evaluar:${current}`);
    if (current) {
      switch (responseToValidate.condicion) {
        case 'igual a':
          if (current === responseToValidate.valor) resolve = true;
          break;
        case 'diferente a':
          if (current !== responseToValidate.valor) resolve = true;
          break;
        case 'mayor que':
          if (current > responseToValidate.valor) resolve = true;
          break;
        case 'menor que':
          if (current < responseToValidate.valor) resolve = true;
          break;
        case 'mayor o igual que':
          if (current >= responseToValidate.valor) resolve = true;
          
          break;
        case 'menor o igual que':
          if (current >= responseToValidate.valor) resolve = true;
          
          break;
        case 'existe':
          if (current.includes(responseToValidate.valor)) resolve = true;
          break;
        case 'no existe':
          if (!current.includes(responseToValidate.valor)) resolve = true;
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
  private _validateDataGroup = async (responseToValidate: DataParty, outputCtx: string, parameters: Map<string, any> ): Promise<ApiMessagesSucceeded | null> => {
    const current = parameters.get(responseToValidate.parametro);

    if (current && current=== responseToValidate.key) {
      await this._createContext(responseToValidate.grupoDatos);
      return {...responseToValidate, outputContext: outputCtx}
    } 
    return null;
  }
  private _validatePredefinida = async (responseToValidate: PreDefinedOutput, exitContext: string): Promise<ApiMessagesSucceeded | null> => {
    if (typeof responseToValidate !== undefined) {
      return { ...responseToValidate, outputContext: exitContext };
    }
    return null
  }
  
 
  private async _createContext(contextString: string ,params?: object,) {
    const contextClient = new ContextsClient({ credentials: keyFilename })
    const context: Context = {
      name: `${this._parentPath}/contexts/${contextString}`,
      lifespanCount: 1,
      parameters: params? params : undefined
    }
    // projects/<Project ID>/agent/sessions/<Session ID>
    // Parent string format
    const contextCreated = await contextClient.createContext({ parent: this._parentPath, context })
    return new Promise((resolve, reject) => {
      resolve(contextCreated[0])
    })
  }

}