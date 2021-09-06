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
	ClientIDs
} from "../interfaces/conversation.interface";
import { google } from "@google-cloud/dialogflow/build/protos/protos";




export class SessionController {
	
	private sessionContexts: Array<Context>;
	private _parentPath: string;
	private _accountPath: string;
	private _projectPath: string;
	private clientIDs: ClientIDs
	private sessionPath: string;
	private _sessionParams: { [key: string]: any } = {}
	private data: { [key: string]:any } = {}
	

	
	// SECTION DETECT INTENT (ROOT)
	public detectIntent = async ( body: ClientRequest ): Promise<IntentResponse> => {
		// console.log("\n\n",  body )
		
		//STUB GET CLIENT DATA
		const { userId, projectId, textInput, clientIDs } = body;
		this.clientIDs = clientIDs
		this._accountPath = `usuarios/${ userId }`
		this._projectPath = `/usuarios/${ userId }/agentes/${ projectId }`;

		

		//STUB GET SESSION DATA
		let session = await this.searchForSessionId(clientIDs)
		if ( !session ) console.log( "\x1b[35m", 'Sesión nueva' )
		
		const sessionId = session
			? session.sessionId ? session.sessionId
			: uuidv4() : uuidv4();
		this.sessionContexts = session ? session.outputContexts : []
		console.log( "\x1b[35m%s\x1b[33m", "UserId:", userId )
		console.log( "\x1b[35m%s\x1b[33m", "Session:", sessionId )
		console.log( "\x1b[35m%s\x1b[33m", "Contextos:", this.sessionContexts )
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
				contexts: this.sessionContexts
			}
		};

		//STUB DETECT INTENT
		const response = await sessionClient.detectIntent( request ).then( result => result[ 0 ] );
		
		//STUB CURATE INTENT DETECTED
		if ( response.queryResult.intent ) {
			const intent = response.queryResult.intent
			console.log("\x1b[35m%s\x1b[33m", "Intent", response.queryResult.intent.displayName );
			// console.log("\x1b[35m%s\x1b[33m", "Query OutputContexts:", response.queryResult.outputContexts );
			// console.log("\x1b[35m%s\x1b[33m", "Response Parameters:", response.queryResult.parameters.fields);


			//STUB STRUCTURE CONTEXT PARAMS 
			this._saveSessionParams(response.queryResult.outputContexts)

			
			//STUB SET SESSION RESULT
			const sessionResult = <QueryResult> {
				...response.queryResult,
				clientId: userId,sessionId,projectId,
			};
	
			//STUB GET RESPONSES FROM FIRESTORE
			const responsesGetted = await
				this.retriveMessagesFromFireStore(
					userId,
					projectId,
					sessionResult.intent.name
				);
				// console.log('Respuestas obtenidas', responsesGetted)
	
			
			
			//STUB RETURN STRUCTURED RESPONSES
			if (responsesGetted) {
				
				// GET ANSWERS AND OUTPUT CONTEXTS
				const { answers, outputContexts } =
					await this.ManageResponsesController(
						responsesGetted, sessionResult, userId
					)
					// console.log( "\x1b[34m", "output Contexts setted", outputContexts )
	
				
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
		userId: string,
		idProject: string,
		intentName: string
	): Promise<Array<ResponseFromFirebase | null>> {
		// /usuarios/{idUser}/agentes/{idProject}/mensajes/{intentName}/respuestas
		const idName = this.trimNames(intentName)

		const pathToCollection = `/usuarios/${userId}/agentes/${idProject}/intents/${idName}/responses`;

		// console.log( pathToCollection )
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
		console.log('params to evaluate', parametersToEvaluate);
		// console.log( 'array of awnsers', arrayOfAnswer )
		// const parameterArray = queryResult.parameters;
		

		for (const answer of arrayOfAnswer) {
			console.log( '\x1b[33m', 'Answer inputContexts', answer.inputContexts )
			console.log( 'Is answer of session?', this.isContextAwnser(answer.inputContexts) )			
			if (this.isContextAwnser(answer.inputContexts)) {
				const validateResponse: iResponseValidate = { 
					result: answer.result,
					outputContexts: answer.outputContexts,
					parameters: parametersToEvaluate,
				}
				
				answer.result.text = this._replaceParameters(parametersToEvaluate, answer.result.text);
				// console.log( 'tipo:', element.tipo )
				switch (answer.tipo) {
					case "catch":
						promisesToHandle.push(
							this._validateDataGroup(validateResponse)
						);
						break;
					case "search":
						promisesToHandle.push(
							this._validateSearch( validateResponse, clientId)
						);
						break;
					case "conditional":
						promisesToHandle.push(
							this._validateConditional(validateResponse)
						);
						break;
					case "default":
						promisesToHandle.push(this._validateSimple(validateResponse));
						break;
					default:
						throw new Error("Esa respuesta no la pude procesar");
				}
			}
		}

		// Validate no errors
		let answers: ApiMessagesSucceeded[] = await Promise.all( promisesToHandle )
			.catch(error => {
				console.error("Error en la ejecucion de las validaciones", error);
				return { ...error };
			} );
		
		// console.log("\x1b[35m", 'answers', answers)
		
		answers = answers.filter( a => a ) // clear of undefined answers
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
					console.log("\x1b[36m", "current contextos", currentResponse.outputContexts)

					await this.asyncForEach(currentResponse.outputContexts,
						async (context: string) => {
							
							if (
								!outputContexts.find(
									c => c.name.slice(
										c.name.lastIndexOf('/') + 1
									) === context
								)
								&& context !== ""
							) {
								const contextAdded: Context = await this._createContext(context);

								outputContexts.push(contextAdded);
								// console.log( contextAdded, "\x1b[36m", 'added to', outputContexts )
							}
					})
				}
				
				if (currentResponse && currentResponse.suggestions
					&& currentResponse.suggestions.length > 0) { 
					const sugContexts: string[] = currentResponse.suggestions
						.map(s => s.context ? s.context : null)
					
					console.log( "\x1b[31m", "suggests contexts",  sugContexts)
					await this.asyncForEach(sugContexts,async (c:string) => {
						if ( !outputContexts.find(x => x === c) && c !== "" ) {
							const contextAdded = await this._createContext(c);

							outputContexts.push(contextAdded);
							// console.log( contextAdded, "\x1b[36m", 'added to', outputContexts )
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
			
			
		
		
		// console.log( "\x1b[31m%s\x1b[30", "output contexts about reponses", outputContexts )
		return {answers, outputContexts}
		// const responsesReturned = await this._controllerResponse();
		// return responsesReturned;
	};
	
	// ANCHOR SEARCH
	private _validateSearch = async (
	{result, outputContexts, parameters}: iResponseValidate,
	userId: string
	): Promise<ApiMessagesSucceeded | null> => {
		// **************************************** //
		const searchResult = result as SearchOutput;
		const value = parameters.get(searchResult.parametro);
		// console.log("\x1b[33m%s\x1b[37m%s", "search criteria", { database: responseToValidate.database, value });
		// console.log();
		console.log( searchResult, value )

		if (searchResult.database && value) {
			// console.log("response with search");
			const pathToCollection = `/usuarios/${userId}/${searchResult.database}`;

			
			const databaseRef = await firestore
				.collection(pathToCollection)
				.where("id", "==",value)
				.get();
			const data = [];

			console.log( databaseRef.size )
			for (const document of databaseRef.docs) {
				console.log( document.data() )
				data.push((<any>document.data()) as Card);
			}

			console.log( "\x1b[33m", 'Response with search' )
			console.log(  "\x1b[33m", searchResult.text )
			console.log(  "\x1b[36m", 'Set context by search', outputContexts )
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
		console.log( conditional.parametro )
		const param = conditional.parametro
			? conditional.parametro.startsWith('$')
				? conditional.parametro.split("$")[1].split(".")[0]
				: conditional.parametro.split('.')[0]
			: ''
		const value = parameters.get(param);
		console.log("\x1b[36m%s\x1b[37m", "contexts for response", outputContexts)
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
			console.log("\x1b[33m", conditional.text)
			console.log(  "\x1b[36m", 'Set context by conditional', outputContexts )
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
		// console.log(dataParty)
		this._sessionParams[dataParty.parametro] = value
		this.data[dataParty.parametro] = value

		console.log( this._projectPath  )
		const clientsColPath = `${ this._accountPath }/clients`
		const clientsRef = firestore.collection(clientsColPath)
		if ( !this.clientIDs.clientId ) {
			clientsRef.add({data:this.data, lastUpdate: new Date()}).then( c => {
				this.clientIDs.clientId = c.id
			})
		} else {
			const clientRef = clientsRef.doc( this.clientIDs.clientId )
			clientRef.set({data:this.data, lastUpdate: new Date()}, {merge: true} )
			// }
		}


		if (value) {
			console.log("\x1b[32m","response with datagroup", value);
			await this._createContext( 'data', parameters, 50 );
			console.log("\x1b[33m", result.text)
			console.log(  "\x1b[36m", 'Set context by dataGroup', outputContexts )
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
			console.log("\x1b[33m", result.text)
			console.log(  "\x1b[36m", 'Set context by simple', outputContexts )
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

	// ANCHOR Validate in Input Contexts
	isContextAwnser(responseInputContexts: string[]) {
		return (!responseInputContexts
			|| responseInputContexts.length === 0
			|| responseInputContexts
			.every(c => this.sessionContexts.find(
			ic => this.trimNames(ic.name) === c)
			)
		)
	}

	// !SECTION


	// SECTION SESSION
	// ANCHOR DELETE SESSION 
	private async _deleteSession() {
		let sessionRef = firestore.doc(this.sessionPath)
		if ((await sessionRef.get()).exists) {
			const contexts = await (await sessionRef.get()).get('outputContexts')
			console.log('borrar',  contexts.map((c:any) => this.trimNames(c.name)) )
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
		const clientsColPath = `${ this._accountPath }/clients`
		const clientsRef = firestore.collection(clientsColPath)
		const interactionsPath = `${ this._projectPath }/interactions`
		const interactionsRef = firestore.collection(interactionsPath)
		// console.log(  "\x1b[35m", 'will save contexts...', sessionBody.outputContexts )
		const session = {
			sessionId: sessionBody.sessionId,
			outputContexts: sessionBody.outputContexts,
			lastUpdate: new Date(),
			sessionParams: this._sessionParams,
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

		// Add on agent interactions for analytics
		interactionsRef.add(conversation)

		if ( !this.clientIDs.clientId ) {
			clientsRef.add( session ).then( c => {
				c.update({clientId: c.id})
				c.collection('conversation').add(conversation)
			} )
		} else {
			const clientRef = clientsRef.doc( this.clientIDs.clientId )
			// const clientDoc = await clientRef.get()
			// if ( clientDoc.exists ) {
			// 	clientRef.update(session)
			// } else {
				clientsRef.doc(this.clientIDs.clientId).set( session, {merge: true} )
			// }
			clientRef.collection( 'conversation' ).add( conversation )
		}
		// let clientPath = this._currentUser ?  `${clientsColPath}/${this._currentUser}`
		
					
	}

	// ANCHOR Search for session by user IDs
	public async searchForSessionId( userIDs: ClientIDs ): Promise<any> {
		const clientsColPath = `${ this._accountPath }/clients`
		const clientsRef = firestore.collection( clientsColPath )
		if ( userIDs.clientId ) {
			this.sessionPath = `${ clientsColPath }/${ this.clientIDs.clientId }`
			const userDoc = await clientsRef.doc( userIDs.clientId ).get()
			if (userDoc.exists) {
				// console.log( 'user exists' )
				const sessionId = userDoc.data()[ 'sessionId' ]
					? userDoc.data()[ 'sessionId' ] : null
				const outputContexts = userDoc.data()[ 'outputContexts' ]
					? userDoc.data()['outputContexts'] : null
				// console.log(  "\x1b[36m", 'contexts finded in session', outputContexts )
				return {sessionId, outputContexts}
			 } else { return null }
			
		} else if ( userIDs.messengerId || userIDs.whatsappId ) {
				
			const platform = userIDs.messengerId 
				? 'messengerId' : 'whatsappId'
			
			const userFinded = await clientsRef
			.where( platform, '==', userIDs[platform] )
			.get()
			
			
			if ( !userFinded.empty ) {
				
				this.clientIDs.clientId = userFinded.docs[ 0 ].id	
				this.clientIDs[platform] = userFinded.docs[0].data()[platform]
				this.sessionPath = `${ clientsColPath }/${ this.clientIDs.clientId }`
				// console.log( this.sessionPath )
				let sessionId = userFinded.docs[ 0 ].data()[ 'sessionId' ]
					? userFinded.docs[ 0 ].data()[ 'sessionId' ] : null
				let outputContexts = userFinded.docs[ 0 ].data()[ 'outputContexts' ]
					? userFinded.docs[ 0 ].data()[ 'outputContexts' ] : null
				console.log(  "\x1b[36m", 'contexts finded in session', outputContexts )
				return { sessionId, outputContexts }
			} else {
				clientsRef.add( this.clientIDs )
					.then( doc => {
						this.clientIDs.clientId = doc.id
						clientsRef.doc(doc.id).update({ userId: doc.id })
						this.sessionPath = `${ clientsColPath }/${ this.clientIDs.clientId }`
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
		console.log( '529 on Save Session Params', sessionContexts.map(c => c.parameters.fields) )
		sessionContexts.forEach(c => {
			if (c.parameters) {
				const fields = c.parameters.fields
				Object.keys(fields).forEach(fieldName => {
					// console.log( fieldName )
					const valueName = Object.keys(fields[fieldName])[0] as ParamType
					const value = fields[fieldName][valueName]
					if (!this._sessionParams[fieldName] && value ) {
						this._sessionParams[fieldName] = value
					}
				})
			}
			
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
				// console.log( '\x1b[33m%s\x1b[37m', 'x', x, '\n' )
				const paramValueTypeName = x[ 1 ][ "kind" ];
				const paramName = x[ 0 ];
				let paramValue: any
				// console.log( paramValueTypeName )
				if (paramValueTypeName === "structValue") {
					// console.log( 'is structValue' )
					const fields = x[ 1 ][ paramValueTypeName ][ "fields" ]
					// console.log( 'structValue',  fields)
					paramValue = this._restructParamObject( fields )
					
				} else if (paramValueTypeName === 'listValue') {	
					// console.log( 'is listValue' )
					// console.log(x[1])
					// console.log( x[1][paramValueTypeName] )
					const values = x[ 1 ][ paramValueTypeName ]['values']
					// console.log('listValue', values)
					// console.log( values[0] )
					// const fields = values[ 0 ][ 'values' ][ 'fields' ]
					// console.log( fields )
					paramValue = this._restructParamObject( values )
					
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
		// console.log( text_ )

		

		if (text_.includes("$")) {
			const posibleVariable = text_.split("$")[1].split(" ")[0].split(".");
			// console.log('\x1b[35m%s\x1b[37m','posibleVariable', posibleVariable)
			const variable = posibleVariable[0];

			// console.log("\x1b[35m%s\x1b[37m", "variable", variable);
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
		// console.log(entityTypeName)
		// console.log( object )

		if (Array.isArray(object)) {
			result = object
		} else {
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
		}

		// console.log( result );
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
			
			console.log(  "\x1b[36m", 'inputContext getted', req.body.inputContexts )
			const body: ClientRequest = {
				projectId, textInput, userId: clientId,
				sessionId: req.body.sessionId ? req.body.sessionId : null,
				inputContexts: req.body.inputContexts ? req.body.inputContexts : null,
				clientIDs: req.body.userIDs
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
