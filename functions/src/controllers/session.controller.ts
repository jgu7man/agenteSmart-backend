import { firestore } from "../middlewares/firebase.mid";
firestore.settings({ignoreUndefinedProperties: true})
import  firebase  from "firebase-admin"
import { ContextsClient, SessionsClient } from "@google-cloud/dialogflow";


import { Response, Request } from "express";
import { v4 as uuidv4 } from "uuid";
import { keyFilename } from "../index";

import {
	QueryResult,
	ContionalOutput as ConditionalOutput,
	ApiMessagesSucceeded,
	ResponseFromFirebase,
	ParameterFromQueryResult,
	Context,
	SearchOutput,
	DataParty,
	Card,
	iResponseValidate,
	ParamType,
	// ParamField,
} from "../interfaces/session.interface";
import { IntentDetectedParam, SysInterface, SystemType } from "../interfaces/parameter.interface";
import {
	ClientRequest,
	IntentResponse,
	SessionBody,
	UserIDs
} from "../interfaces/conversation.interface";
import { google } from "@google-cloud/dialogflow/build/protos/protos";




export class SessionController {
	
	private _Contexts: Array<any>;
	private _parentPath: string;
	private _projectPath: string;
	private userIDs: UserIDs
	private sessionPath: string;
	private _sessionParams: {[key:string]:any} = {}
	

	
	// SECTION DETECT INTENT (ROOT)
	public detectIntent = async ( body: ClientRequest ): Promise<IntentResponse> => {
		// console.log("\n\n",  body )
		
		//STUB GET CLIENT DATA
		const {clientId, projectId, textInput, userIDs } = body;
		this.userIDs = userIDs 
		this._projectPath = `/usuarios/${ clientId }/agentes/${ projectId }`;
			

		//STUB GET SESSION DATA
		let session = await this.searchForSessionId(userIDs)
		if (!session) console.log(  "\x1b[35m", 'Sesión nueva' )
		const sessionId = session
			? session.sessionId ? session.sessionId
			: uuidv4() : uuidv4();
		this._Contexts = session ? session.outputContexts : []
		console.log( "\x1b[35m%s\x1b[33m", "Session:", sessionId )
		console.log( "\x1b[35m%s\x1b[33m", "ProjectId:", projectId )
		
		const sessionClient = new SessionsClient({ credentials: keyFilename });
		this._parentPath = sessionClient.projectAgentSessionPath(projectId, sessionId);

		//STUB SET REQUEST BODY
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

		//STUB DETECT INTENT
		const response = await sessionClient.detectIntent( request ).then( result => result[ 0 ] );
		
		//STUB CURATE INTENT DETECTED
		if ( response.queryResult.intent ) {
			const intent = response.queryResult.intent
			console.log("\x1b[35m%s\x1b[33m", "Intent", response.queryResult.intent.displayName );
			// console.log("\x1b[35m%s\x1b[33m", "Response outputContexts:", response.queryResult.outputContexts );
			// console.log("\x1b[35m%s\x1b[33m", "Response Parameters:", response.queryResult.parameters.fields);


			//STUB STRUCTURE CONTEXT PARAMS 
			this._saveSessionParams(response.queryResult.outputContexts)

			
			//STUB SET SESSION RESULT
			const sessionResult = <QueryResult> {
				...response.queryResult,
				clientId,sessionId,projectId,
			};
	
			//STUB GET RESPONSES FROM FIRESTORE
			const responsesGetted = await
				this.retriveMessagesFromFireStore(
					clientId,
					projectId,
					sessionResult.intent.name
				);
				// console.log({getRespuestas})
	
			
			
			//STUB RETURN STRUCTURED RESPONSES
			if (responsesGetted) {
				
				// GET ANSWERS AND OUTPUT CONTEXTS
				const { answers, outputContexts } =
					await this.ManageResponsesController(
						responsesGetted, sessionResult, clientId
					)
					// console.log( "\x1b[34m", "output Contexts", outputContexts.length )
	
				
				//STUB SAVE OR DELETE SESSION
				if (outputContexts.length === 0) {
					this._deleteSession()
				} else {
					const sessionBody: SessionBody = {
						sessionId,textInput,answers,outputContexts,
						intentId: intent.name,
						intentName: intent.displayName,
					}
						
					this._saveSession( sessionBody )
				}

				
				//STUB FINNALIZE EVENT
				return {
					message: "ok",
					respuestas: answers,
				}
	
			} else { return null }

		} else { return null}
		
	}
	// !SECTION
	
	// SECTION RESPONSES
	// ANCHOR FIND RESPUESTAS FIRESTORE
	private async retriveMessagesFromFireStore(
		clientId: string,
		idProject: string,
		intentName: string
	): Promise<Array<ResponseFromFirebase | null>> {
		// /usuarios/{idUser}/agentes/{idProject}/mensajes/{intentName}/respuestas
		const idName = this.trimNames(intentName)

		const pathToCollection = `/usuarios/${clientId}/agentes/${idProject}/mensajes/${idName}/respuestas`;

		console.log( pathToCollection )
		const intentRef = firestore.collection(pathToCollection).orderBy("index", "asc");
		const respuestas: any[] = [];

		const documents = await intentRef.get();

		documents.forEach(doc => {
			respuestas.push(doc.data());
			// console.log( "\x1b[34m", 'respuesta:', doc.data() )
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
		// console.log('params to evaluate', parametersToEvaluate);
		// console.log( 'array of awnsers', arrayOfAnswer )
		// const parameterArray = queryResult.parameters;
		// this._currentQueryResult.parameters.forEach( function(obj) {

		for (const element of arrayOfAnswer) {
			const validateResponse: iResponseValidate = { 
				result: element.result,
				outputContexts: element.outputContexts,
				parameters: parametersToEvaluate
			}
			
			element.result.text = this._replaceParameters(parametersToEvaluate, element.result.text);
			// console.log( 'tipo:', element.tipo )
			switch (element.tipo) {
				case "grupo_datos":
					promisesToHandle.push(
						this._validateDataGroup(validateResponse)
					);
					break;
				case "buscar":
					promisesToHandle.push(
						this._validateSearch( validateResponse, clientId)
					);
					break;
				case "condicional":
					promisesToHandle.push(
						this._validateConditional(validateResponse)
					);
					break;
				case "simple":
					promisesToHandle.push(this._validateSimple(validateResponse));
					break;
				default:
					throw new Error("Esa respuesta no la pude procesar");
			}
		}

		// Validate no errors
		let answers: ApiMessagesSucceeded[] = await Promise.all( promisesToHandle )
			.catch(error => {
				console.error("Error en la ejecucion de las validaciones", error);
				return { ...error };
			} );
		
		// console.log("\x1b[35m", 'answers', answers)
		answers = answers.filter( a => a )
		if (answers.length > 1) {
			answers = answers.filter( a => !a.asDefault)
		}
		
		const outputContexts: Array<Context> = [];
		const errors = [];

		try {
			for (const currentResponse of answers) {
				// console.log( "\x1b[36m", "current response",currentResponse )
				if (currentResponse
					&& currentResponse.outputContexts
					&& currentResponse.outputContexts.length > 0) {
					// console.log("\x1b[36m", "current contextos", currentResponse.outputContexts)

					await this.asyncForEach(currentResponse.outputContexts,
					async (context:string) => {
						if (
							!outputContexts.find(x => x === context)
							&& context !== ""
						) {
							const contextAdded = await this._createContext(context);

							// console.log( context )
							outputContexts.push(contextAdded);
							// console.log( outputContexts )
						}
					})
				}
				
				if (currentResponse
					&& currentResponse.suggestions.length > 0) { 
					const sugContexts: string[] = currentResponse.suggestions
						.map(s => s.context ? s.context : null)
					
					// console.log( "\x1b[31m", "suggests contexts",  sugContexts)
					await this.asyncForEach(sugContexts,async (c:string) => {
						if ( !outputContexts.find(x => x === c) && c !== "" ) {
							const contextAdded = await this._createContext(c);

							// console.log( context )
							outputContexts.push(contextAdded);
							// console.log( outputContexts )
						}
					})
				}
			}
		} 
		catch (error) {
			if (error) {
				console.error('Error en procesando respuesta \n', error)
				errors.push(error);
			}
		}
			
			
		
		
		// console.log( "\x1b[31m%s\x1b[30", "output contexts", outputContexts )
		return {answers, outputContexts}
		// const responsesReturned = await this._controllerResponse();
		// return responsesReturned;
	};
	
	// ANCHOR SEARCH
	private _validateSearch = async (
		{result, outputContexts, parameters}: iResponseValidate,
		clientId: string
	): Promise<ApiMessagesSucceeded | null> => {
		// **************************************** //
		const searchResult = result as SearchOutput;
		const value = parameters.get(searchResult.parametro);
		// console.log("\x1b[33m%s\x1b[37m%s", "search criteria", { database: responseToValidate.database, value });
		// console.log();

		if (searchResult.database && value) {
			console.log("response with search");
			const pathToCollection = `/usuarios/${clientId}/${searchResult.database}`;

			
			const databaseRef = await firestore
				.collection(pathToCollection)
				.where("name", "==", searchResult.parametro)
				.get();
			const data = [];

			for (const document of databaseRef.docs) {
				data.push((<any>document.data()) as Card);
			}

			console.log( "\x1b[33m", 'Response with search' )
			console.log(  "\x1b[33m", searchResult.text )
			return {
				text: searchResult.text,
				cards: data,
				outputContexts:outputContexts,
			};
		}
		return null;
	};

	// ANCHOR CONDITIONAL
	private _validateConditional = async (
		{result, outputContexts, parameters}: iResponseValidate
	): Promise<ApiMessagesSucceeded | null> => {
		const conditional = result as ConditionalOutput
		let resolve = false;
		const param = conditional.parametro.split("$")[1].split(".")[0];
		const value = parameters.get(param);
		// console.log("\x1b[36m%s\x1b[37m", "condition criteria", {
		// 	value,
		// 	condition: conditional.condicion,
		// 	criterio: conditional.valor,
		// 	param: param,
		// });

		if (conditional.condicion === "no existe" && !value) {
			resolve = true;
		} else if (conditional.condicion === "existe" && value) {
			resolve = true;
		} else if (value) {
			switch (conditional.condicion) {
				case "igual a":
					if (value === conditional.valor) resolve = true;
					break;
				case "diferente a":
					if (value !== conditional.valor) resolve = true;
					break;
				case "mayor que":
					if (value > conditional.valor) resolve = true;
					break;
				case "menor que":
					if (value < conditional.valor) resolve = true;
					break;
				case "mayor o igual que":
					if (value >= conditional.valor) resolve = true;
					break;
				case "menor o igual que":
					if (value <= conditional.valor) resolve = true;
					break;
				default:
					break;
			}
			} 
		
		if (resolve) {
			console.log( "\x1b[36m", "Response with condition" );
			console.log( "\x1b[33m",  conditional.text )
			return { ...conditional, outputContexts: outputContexts };
		}
		return null;
	};

	// ANCHOR DATAGROUP
	private _validateDataGroup = async (
		{result, outputContexts, parameters}: iResponseValidate
	): Promise<ApiMessagesSucceeded | null> => {
		const dataParty = result as DataParty
		const value = parameters.get(dataParty.parametro);

		// console.log("\x1b[32m%s\x1b[37m", "DataGroup Criteria", { current: value, key: responseToValidate.key });


		if (value) {
			console.log("\x1b[32m","response with datagroup", value);
			await this._createContext( 'data', parameters, 50 );
			console.log( "\x1b[33m", result.text )
			return { ...result, outputContexts: outputContexts };
		}
		return null;
	};

	// ANCHOR SIMPLE
	private _validateSimple = async (
		{result, outputContexts}: iResponseValidate
	): Promise<ApiMessagesSucceeded | null> => {
		// console.log("\x1b[34m%s\x1b[37m", "simple criteria");
		// console.log(responseToValidate);

		if ( typeof result !== undefined ) {
			console.log( "\x1b[34m", 'Response with simple' )
			console.log( "\x1b[33m",  result.text )
			return { ...result, outputContexts };
		}
		return null;
	};
	// !SECTION


	// SECTION CONTEXT
	// ANCHOR SET CONTEXTS
	private async _createContext(contextString: string, params?: object, lifeSpan?: number) {
		const contextClient = new ContextsClient({ credentials: keyFilename });
		//The trick on Context is to set it greater that 1 so don't expire when finishing the current process
		//(in the next call will appear as 1)
		if (!lifeSpan) lifeSpan = 3
		const context: Context = {
			name: `${this._parentPath}/contexts/${contextString}`,
			lifespanCount: lifeSpan,
			parameters: params ? params : undefined,
		};
		// projects/<Project ID>/agent/sessions/<Session ID>
		// Parent string format
		
		// console.log( context )
		const contextCreated = await contextClient.createContext({ parent: this._parentPath, context });
		return new Promise((resolve, reject) => {
			console.info( "Succefully Created context: ", this.trimNames(contextCreated[ 0 ].name))
			resolve(contextCreated[0]);
		});
	}

	// !SECTION


	// SECTION SESSION
	// ANCHOR DELETE SESSION 
	private async _deleteSession() {
		let sessionRef = firestore.doc(this.sessionPath)
		if ((await sessionRef.get()).exists) {
			const contexts = await (await sessionRef.get()).get('outputContexts')
			console.log('borrar',  contexts.filter((c:any) => this.trimNames(c.name)) )
			await sessionRef.update( {
				sessionId: firebase.firestore.FieldValue.delete(),
				outputContexts: firebase.firestore.FieldValue.delete()
			})
		}
		return
	}
	// private async _retriveAllContexts() {
	// 	const contextClient = new ContextsClient({ credentials: keyFilename });
	// 	// Parent Format: projects/<Project ID>/agent/sessions/<Session ID>
	// 	return await contextClient.listContexts({
	// 		parent: this._parentPath
	// 	});
	// }

	// ANCHOR SAVE SESSION
	private async _saveSession(sessionBody: SessionBody) {
		const clientsColPath = `${ this._projectPath }/clientes`
		const clientsRef = firestore.collection(clientsColPath)
		const session = {
			sessionId: sessionBody.sessionId,
			outputContexts: sessionBody.outputContexts,
			lastUpdate: new Date(),
			sessionParams: this._sessionParams
		} 
		const respuestas = sessionBody.answers.map( a => a.text )
		const conversation = {
			usuario: sessionBody.textInput, 
			agente: respuestas,
			intent: {
				intentId: sessionBody.intentId,
				intentName: sessionBody.intentName
			},
			time: new Date()
		}

		// console.log( this.userIDs )

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

	// ANCHOR Search for session by user IDs
	public async searchForSessionId( userIDs: UserIDs ): Promise<any> {
		const clientsColPath = `${ this._projectPath }/clientes`
		const clientsRef = firestore.collection( clientsColPath )
		if ( userIDs.userId ) {
			this.sessionPath = `${ clientsColPath }/${ this.userIDs.userId }`
			const userDoc = await clientsRef.doc( userIDs.userId ).get()
			if (userDoc.exists) {
				// console.log( 'user exists' )
				const sessionId = userDoc.data()[ 'sessionId' ]
					? userDoc.data()[ 'sessionId' ] : null
				const outputContexts = userDoc.data()[ 'outputContexts' ]
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
						clientsRef.doc(doc.id).update({ userId: doc.id })
						this.sessionPath = `${ clientsColPath }/${ this.userIDs.userId }`
					} )
				return null
			}
				
		} else {
			
			return null
		}

		
	}


	// ANCHOR Save params of session
	private _saveSessionParams(
		sessionContexts: google.cloud.dialogflow.v2.IContext[]
	) {
		sessionContexts.forEach(c => {
			const fields = c.parameters.fields
			Object.keys(fields).forEach(fieldName => {
				
				const valueName = Object.keys(fields[fieldName])[0] as ParamType
				const value = fields[fieldName][valueName]
				if (!this._sessionParams[fieldName] && value ) {
					this._sessionParams[fieldName] = value
				}
			})
			
		})
		console.log("\x1b[35m%s\x1b[33m", "Parameters", this._sessionParams)
		
	}

	// !SECTION
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

	// SECTION PARAMETERS
	// ANCHOR PARAMETERS OF DETECT INTENT
	private _parsedResponseFromDialogflow = (parameters: ParameterFromQueryResult) => {
		const newIterator = Object.entries(parameters.fields);

		return new Map(
			newIterator.map( x => {
				// console.log( '\n', '\x1b[33m%s\x1b[37m', 'x', x, '\n' )
				const paramValueTypeName = x[ 1 ][ "kind" ];
				const paramName = x[ 0 ];
				let paramValue: any
				// console.log( paramValueTypeName )
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

				// console.log("\x1b[32m%s\x1b[37m", paramName, paramValue);

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


	
	// !SECTION
	

	


	// ANCHOR ASYNC FOR EACH
	async asyncForEach(array: any[] | Map<number, any>, callback: any) {
		if (Array.isArray(array)) {
			for (let index = 0; index < array.length; index++) {
				await callback(array[index], index, array);
			}
		} else {
			for (let index = 0; index < array.size; index++) {
				await callback(array.get(index), index, array);
			}
		}
	}

	// ANCHOR API REQUEST 
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

	// STUB TRIM NAMES 
	private trimNames(name: string) {
		return name.slice(name.lastIndexOf('/')+1) 
	}
}
