import { firestore } from "../middlewares/firebase.mid";
firestore.settings({ignoreUndefinedProperties: true})
import  firebase  from "firebase-admin"
import { ContextsClient, SessionsClient } from "@google-cloud/dialogflow";

import { Response, Request } from "express";
import { v4 as uuidv4 } from "uuid";
import { keyFilename } from "../index";

import {
	SimpleOutput,
	QueryResult,
	ContionalOutput as ConditionalOutput,
	ApiMessagesSucceeded,
	ResponseFromFirebase,
	ParameterFromQueryResult,
	Context,
	SearchOutput,
	DataParty,
	Card,
} from "./../interfaces/session.interfaces";
import { IntentDetectedParam, SysInterface, SystemType } from "../interfaces/parameter.interface";
import {
	ClientRequest,
	IntentResponse,
	SessionBody,
	UserIDs
} from "../interfaces/conversation.interface";




export class SessionController {
	
	private _Contexts: Array<any>;
	private _parentPath: string;
	private _projectPath: string;
	private userIDs: UserIDs
	private sessionPath: string;
	

	public detectIntent = async ( body: ClientRequest ): Promise<IntentResponse> => {
		console.log( body )
		
		// GET CLIENT DATA
		const {clientId, projectId, textInput, userIDs } = body;
		this.userIDs = userIDs 
		this._projectPath = `/usuarios/${ clientId }/agentes/${ projectId }`;
			

		// GET SESSION DATA
		let session = await this.searchForSessionId( userIDs )
		const sessionId = session
			? session.sessionId ? session.sessionId
			: uuidv4() : uuidv4();
		this._Contexts = session ? session.outputContexts : []
		console.log( "\x1b[35m%s\x1b[33m", "Session:", sessionId )
		// console.log("\x1b[35m%s\x1b[33m", "Contexts length:", this._Contexts.length )
		const sessionClient = new SessionsClient( { credentials: keyFilename } );
		this._parentPath = sessionClient.projectAgentSessionPath(projectId, sessionId);

		
		
		// REVIEW Se integró en el body de la query los contextos pero no se tuvo éxito
		const request = {
			session: this._parentPath,
			queryInput: {
				text: {
					text: textInput,
					languageCode: "es",
				},
			},
			queryParams: {
				contexts: this._Contexts
			}
		};


		
		
		//Inicia la secuenia
		// console.log("\x1b[35m%s\x1b[33m", "Request", request)
		const response = await sessionClient.detectIntent( request ).then( result => result[ 0 ] );
		// console.log( response )

		if ( response.queryResult.intent ) {
			const intent = response.queryResult.intent
			//retrive all contextFromSession:
			// console.log( 'Respuesta de Dialogflow', response.queryResult );
			// console.log( 'Contextos', JSON.stringify(response.queryResult.outputContexts))
			console.log( "\x1b[35m%s\x1b[33m", "Intent", response.queryResult.intent.displayName );
	
			// console.log(response.queryResult.intent.parameters)
			// console.log("Antes de llegar a la asginacion: ", req.body);
			// const agent = new WebhookClient({ request: req, response: res });
			const sessionResult = <QueryResult> {
				...response.queryResult,
				clientId,
				sessionId,
				projectId,
			};
	
			const getRespuestas = await
				this.retriveMessagesFromFireStore(
					clientId,
					projectId,
					sessionResult.intent.name
				);
	
			// console.log({getRespuestas})
			if ( getRespuestas ) {
				const { answers, outputContexts } = await this.ManageResponsesController( getRespuestas, sessionResult, clientId )
	
				if ( outputContexts.length === 0 ) {
					this._deleteSession()
				} else {
					const sessionBody: SessionBody = {
						sessionId,textInput,answers,outputContexts,
						intentId: intent.name,
						intentName: intent.displayName,
					}
						
					this._saveSession( sessionBody )
				}

				
				const response = {
					message: "ok",
					respuestas: answers,
				}

				return response
	
			} else { return null }

		} else { return null}
		
	}

	// ANCHOR DETECT INTENT (ROOT)
	public agentResponse = async (req: Request, res: Response): Promise<void> => {
		try {
			
			const { projectId, textInput, clientId } = req.body;
			
			const body: ClientRequest = {
				projectId, textInput, clientId,
				sessionId: req.body.sessionId ? req.body.sessionId : null,
				inputContexts: req.body.inputContexts ? req.body.inputContexts : null,
				userIDs: req.body.userIDs
			}
			
			const response = await this.detectIntent(body)

			if(response) {

				res.status(200).json(response);
				
			} else {
				res.status(200).json({
					message: "No se detectó intent",
				});
				
			}
		} catch (error) {
			console.error(error);
			res.status(500).send("Error making session");
		}
	};

	// ANCHOR FIND RESPUESTAS FIRESTORE
	private async retriveMessagesFromFireStore(
		clientId: string,
		idProject: string,
		intentName: string
	): Promise<Array<ResponseFromFirebase | null>> {
		// /usuarios/{idUser}/agentes/{idProject}/mensajes/{intentName}/respuestas
		const idName = intentName.slice(intentName.lastIndexOf("/") + 1);

		const pathToCollection = `/usuarios/${clientId}/agentes/${idProject}/mensajes/${idName}/respuestas`;

		const intentRef = firestore.collection(pathToCollection).orderBy("index", "asc");
		const respuestas: any[] = [];

		const documents = await intentRef.get();

		documents.forEach(doc => {
			respuestas.push(doc.data());
		});
		return respuestas;
	}

	// ANCHOR ACTIONS MAP FROM RESPUESTAS
	protected ManageResponsesController = async (
		arrayOfAnswer: Array<ResponseFromFirebase>,
		queryResult: QueryResult,
		clientId: string
	) => {
		const promisesToHandle: Array<Promise<ApiMessagesSucceeded>> = [];
		const parametersToEvaluate = this._parsedResponseFromDialogflow(
			<ParameterFromQueryResult>queryResult.parameters
		);
		//setNewParams
		queryResult.parameters = parametersToEvaluate;
		console.log(parametersToEvaluate);

		// const parameterArray = queryResult.parameters;
		// this._currentQueryResult.parameters.forEach( function(obj) {

		for (const element of arrayOfAnswer) {
			element.result.text = this._replaceParameters(parametersToEvaluate, element.result.text);
			switch (element.tipo) {
				case "grupo_datos":
					promisesToHandle.push(
						this._validateDataGroup(<DataParty>element.result, element.outputContext, parametersToEvaluate)
					);
					break;
				case "buscar":
					promisesToHandle.push(
						this._validateSearch(
							<SearchOutput>element.result,
							parametersToEvaluate,
							element.outputContext,
							clientId
						)
					);
					break;
				case "condicional":
					promisesToHandle.push(
						this._validateConditional(
							<ConditionalOutput>element.result,
							element.outputContext,
							parametersToEvaluate
						)
					);
					break;
				case "simple":
					promisesToHandle.push(this._validateSimple(<SimpleOutput>element.result, element.outputContext));
					break;
				default:
					throw new Error("Esa respuesta no la pude procesar");
			}
		}
		
		// console.log( promisesToHandle )
		let answers: ApiMessagesSucceeded[] = await Promise.all( promisesToHandle )
			.catch(error => {
				console.error("Error en la ejecucion de las validaciones", error);
				return [...error];
			} );
		answers = answers.filter( a => a )
		
		// console.log( answers )
		const outputContexts: Array<Context> = [];
		const errors = [];

			try {
				for ( const currentResponse of answers ) {
					// console.log( currentResponse )
					if ( currentResponse ) {
						if ( currentResponse.outputContext ) {
							if ( !outputContexts.find( x => x === currentResponse.outputContext ) ) {
								const context = await this._createContext( currentResponse.outputContext );
								// console.log( context )
								outputContexts.push(context);
							}
						}
					}
				}
			} catch (error) {
				if (error) {
					console.error('Error en procesando respuesta \n', error)
					errors.push(error);
				}
			}
			
			
		
		

		return {answers, outputContexts}
		// const responsesReturned = await this._controllerResponse();
		// return responsesReturned;
	};

	// ANCHOR SEARCH
	private _validateSearch = async (
		responseToValidate: SearchOutput,
		parameters: Map<string, any>,
		outputContext: string,
		clientId: string
	): Promise<ApiMessagesSucceeded | null> => {
		// **************************************** //
		const value = parameters.get(responseToValidate.parametro);
		// console.log("\x1b[33m%s\x1b[37m%s", "search criteria", { database: responseToValidate.database, value });
		// console.log();

		if (responseToValidate.database && value) {
			console.log("response with search");
			const pathToCollection = `/usuarios/${clientId}/${responseToValidate.database}`;

			
			const databaseRef = await firestore
				.collection(pathToCollection)
				.where("name", "==", responseToValidate.parametro)
				.get();
			const data = [];

			for (const document of databaseRef.docs) {
				data.push((<any>document.data()) as Card);
			}

			console.log( "\x1b[33m", 'Response with search' )
			console.log(  "\x1b[33m", responseToValidate.text )
			return {
				text: responseToValidate.text,
				cards: data,
				outputContext,
			};
		}
		return null;
	};

	// ANCHOR CONDITIONAL
	private _validateConditional = async (
		responseToValidate: ConditionalOutput,
		outputContext: string,
		parameters: Map<string, any>
	): Promise<ApiMessagesSucceeded | null> => {
		let resolve = false;
		const param = responseToValidate.parametro.split("$")[1].split(".")[0];
		const value = parameters.get(param);
		// console.log("\x1b[36m%s\x1b[37m", "condition criteria", {
		// 	value,
		// 	criterio: responseToValidate.valor,
		// 	param: param,
		// });

		// console.log(value);
		if (value) {
			switch (responseToValidate.condicion) {
				case "igual a":
					if (value === responseToValidate.valor) resolve = true;
					break;
				case "diferente a":
					if (value !== responseToValidate.valor) resolve = true;
					break;
				case "mayor que":
					if (value > responseToValidate.valor) resolve = true;
					break;
				case "menor que":
					if (value < responseToValidate.valor) resolve = true;
					break;
				case "mayor o igual que":
					if (value >= responseToValidate.valor) resolve = true;
					break;
				case "menor o igual que":
					if (value <= responseToValidate.valor) resolve = true;
					break;
				default:
					break;
			}
		} else if (responseToValidate.condicion === "no existe" && !value) {
			resolve = true;
		} else if (responseToValidate.condicion === "existe" && value) {
			resolve = true;
		}
		if (resolve) {
			console.log( "\x1b[36m", "Response with condition" );
			console.log( "\x1b[33m",  responseToValidate.text )
			return { ...responseToValidate, outputContext };
		}
		return null;
	};

	// ANCHOR DATAGROUP
	private _validateDataGroup = async (
		responseToValidate: DataParty,
		outputContext: string,
		parameters: Map<string, any>
	): Promise<ApiMessagesSucceeded | null> => {
		const value = parameters.get(responseToValidate.parametro);

		// console.log("\x1b[32m%s\x1b[37m", "DataGroup Criteria", { current: value, key: responseToValidate.key });

		if (value) {
			console.log("\x1b[32m","response with datagroup");
			await this._createContext( responseToValidate.coleccion );
			console.log( "\x1b[33m", responseToValidate.text )
			return { ...responseToValidate, outputContext };
		}
		return null;
	};

	// ANCHOR SIMPLE
	private _validateSimple = async (
		responseToValidate: SimpleOutput,
		outputContext: string
	): Promise<ApiMessagesSucceeded | null> => {
		// console.log("\x1b[34m%s\x1b[37m", "simple criteria");
		// console.log(responseToValidate);

		if ( typeof responseToValidate !== undefined ) {
			console.log( "\x1b[34m", 'Response with simple' )
			console.log( "\x1b[33m",  responseToValidate.text )
			return { ...responseToValidate, outputContext };
		}
		return null;
	};

	// ANCHOR SET CONTEXT
	private async _createContext(contextString: string, params?: object) {
		const contextClient = new ContextsClient({ credentials: keyFilename });
		//The trick on Context is to set it greater that 1 so don't expire when finishing the current process
		//(in the next call will appear as 1)
		const context: Context = {
			name: `${this._parentPath}/contexts/${contextString}`,
			lifespanCount: 3,
			parameters: params ? params : undefined,
		};
		// projects/<Project ID>/agent/sessions/<Session ID>
		// Parent string format
		
		const contextCreated = await contextClient.createContext({ parent: this._parentPath, context });
		return new Promise((resolve, reject) => {
			console.info( "Succefully Created context: ", contextCreated[ 0 ].name.slice(
				contextCreated[ 0 ].name.lastIndexOf('/') + 1
			))
			resolve(contextCreated[0]);
		});
	}


	// ANCHOR DELETE SESSION 
	private async _deleteSession() {
		console.log('borrar',  this.sessionPath )
		let sessionRef= firestore.doc(this.sessionPath)
		await sessionRef.update( {
			sessionId: firebase.firestore.FieldValue.delete(),
			outputContexts: firebase.firestore.FieldValue.delete()
		})
		return
	}
	// private async _retriveAllContexts() {
	// 	const contextClient = new ContextsClient({ credentials: keyFilename });
	// 	// Parent Format: projects/<Project ID>/agent/sessions/<Session ID>
	// 	return await contextClient.listContexts({
	// 		parent: this._parentPath
	// 	});
	// }

	private types = new Map<string, SystemType>([
		["startDateTime", "datetimeperoid"],
		["street-address", "location"],
		["startDate", "dateperiod"],
		["startTime", "timeperiod"],
		["date_time", "datetime"],
		["currency", "unitcurrency"],
		["unit", "duration"],
		["name", "person"],
	]);

	// ANCHOR PARAMETERS OF DETECT INTENT
	private _parsedResponseFromDialogflow = (parameters: ParameterFromQueryResult) => {
		const newIterator = Object.entries(parameters.fields);

		return new Map(
			newIterator.map( x => {
				console.log( '\n', '\x1b[33m%s\x1b[37m', 'x', x, '\n' )
				const paramValueTypeName = x[ 1 ][ "kind" ];
				const paramName = x[ 0 ];
				let paramValue: any
				console.log( paramValueTypeName )
				if ( paramValueTypeName === "structValue" ) {
					const fields = x[ 1 ][ paramValueTypeName ][ "fields" ]
					// console.log( 'structValue',  fields)
					paramValue = this._restructParamObject( fields )
					
				} else if ( paramValueTypeName === 'listValue' ) {	
					const values = x[ 1 ][ paramValueTypeName ]['values']
					// console.log( 'listValue', values )
					const fields = values[ 0 ][ 'structValue' ][ 'fields' ]
					// console.log( fields )
					paramValue = this._restructParamObject( fields )
					
				} else {
					// console.log('otherValue', x[1][paramValueTypeName] )
					paramValue = x[ 1 ][ paramValueTypeName ]
				}

				console.log("\x1b[32m%s\x1b[37m", paramName, paramValue);

				return [paramName, paramValue];
			})
		);
	};

	// ANCHOR Replace parameters in text
	private _replaceParameters( _paramsMap: Map<string, any>, text_: string ) {
		let text
		if (text_.includes("$")) {
			const posibleVariable = text_.split("$")[1].split(" ")[0].split(".");
			// console.log('\x1b[35m%s\x1b[37m','posibleVariable', posibleVariable)
			const variable = posibleVariable[0];

			console.log("\x1b[35m%s\x1b[37m", "variable", variable);
			const value = _paramsMap.get(variable);
			text = text_.replace(
				posibleVariable.length > 1
					? posibleVariable[1] === "original"
						? `$${variable}.original`
						: `$${variable}`
					: `$${variable}`,
				value
			);
			// console.log("\x1b[32m%s\x1b[37m", "text replaced: ", text_);
		}
		return text ? text : text_;
	}

	// ANCHOR Get system entityType name
	private _getSystemEntityTypeName(object: IntentDetectedParam): SystemType {
		let entityTypeName: SystemType;

		for (const key of this.types.keys()) {
			if (key in object) {
				entityTypeName = this.types.get(key);
			}
		}

		return entityTypeName;
	}

	// ANCHOR Restruct param object
	private _restructParamObject(object: IntentDetectedParam): SysInterface {
		let result: any;
		const entityTypeName: SystemType = this._getSystemEntityTypeName( object );
		console.log( entityTypeName )

		// Assing date values
		if (
			entityTypeName === "datetime" ||
			entityTypeName === "dateperiod" ||
			entityTypeName === "datetimeperoid" ||
			entityTypeName === "timeperiod"
		) {
			Object.keys(object).forEach(key => {
				const kindValue = object[key]["kind"];
				result[key] = new Date(object[key][kindValue]);
			});
		} else if (
			entityTypeName === "duration" ||
			entityTypeName === "unitcurrency" ||
			entityTypeName === "location"
		) {
			Object.keys(object).forEach(key => {
				const kindValue = object[key]["kind"];
				result[key] = object[key][kindValue];
			});
		} else {
			const kindValue = object["name"]["kind"];
			result = object["name"][kindValue];
		}

		console.log( result );
		return result;
	}

	// ANCHOR Search for session by user IDs
	public async searchForSessionId( userIDs: UserIDs ): Promise<any> {
		const clientsColPath = `${ this._projectPath }/clientes`
		const clientsRef = firestore.collection( clientsColPath )
		if ( userIDs.userId ) {
			const userDoc = await clientsRef.doc( userIDs.userId ).get()
			if ( userDoc.exists ) {
				this.sessionPath = `${ clientsColPath }/${ this.userIDs.userId }`
				let sessionId = userDoc.data()[ 'sessionId' ]
					? userDoc.data()[ 'sessionId' ] : null
				let outputContexts = userDoc.data()[ 'outputContexts' ]
					? userDoc.data()['outputContexts'] : null
				return {sessionId, outputContexts}
			 } else { return null }
			
		} else if ( userIDs.messengerId || userIDs.whatsappId ) {
				
			const platform = userIDs.messengerId 
				? 'messengerId' : 'whatsappId'
			
			const userFinded = await clientsRef
			.where( platform, '==', userIDs[platform] )
			.get()
			

			if ( !userFinded.empty ) {
			
				this.userIDs.userId = userFinded.docs[ 0 ].id	
				this.userIDs[platform] = userFinded.docs[0].data()[platform]
				this.sessionPath = `${ clientsColPath }/${ this.userIDs.userId }`
				console.log( this.sessionPath )
				let sessionId = userFinded.docs[ 0 ].data()[ 'sessionId' ]
					? userFinded.docs[ 0 ].data()[ 'sessionId' ] : null
				let outputContexts = userFinded.docs[ 0 ].data()[ 'outputContexts' ]
					? userFinded.docs[ 0 ].data()[ 'outputContexts' ] : null
				return {sessionId, outputContexts}
			} else {
				clientsRef.add( this.userIDs )
					.then( doc => {
						this.userIDs.userId = doc.id
						clientsRef.doc( doc.id ).update( { userId: doc.id } )
					} )
				return null
			}
				
		} else {
			
			return null
		}

		
	}

	private async _saveSession(sessionBody: SessionBody) {
		const clientsColPath = `${ this._projectPath }/clientes`
		const clientsRef = firestore.collection( clientsColPath )
		const session = {
			sessionId: sessionBody.sessionId,
			outputContexts: sessionBody.outputContexts
		} 
		const respuestas = sessionBody.answers.map( a => a.text )
		const conversation = {
			usuario: sessionBody.textInput, 
			agente: respuestas,
			intent: {
				intentId: sessionBody.intentId,
				intentName: sessionBody.intentName
			}
		}

		console.log( this.userIDs )

		if ( !this.userIDs.userId ) {
			clientsRef.add(session ).then( c => {
				c.collection('conversacion').add(conversation)
			})
		} else {
			const clientRef = clientsRef.doc( this.userIDs.userId )
			const clientDoc = await clientRef.get()
			if ( clientDoc.exists ) {
				clientRef.update(session)
			} else {
				clientsRef.doc(this.userIDs.userId).set( session )
			}
			clientRef.collection( 'conversacion' ).add( conversation )
		}
		// let clientPath = this._currentUser ?  `${clientsColPath}/${this._currentUser}`
		
					
	}
}
