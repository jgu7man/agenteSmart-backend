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
	ClientIDs,
	iCurrentSession,
	iInteraction
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
	private data: { [ key: string ]: any } = {}
	private intentResponse: { [ key: string ]: any } = {}
	private responsesProcess: { [ key: string ]: any } = {}
	

	
	// ANCHOR API REQUEST 
	public agentResponse = async (req: Request, res: Response): Promise<void> => {
		try {
			
			const { projectId, textInput, clientId } = req.body;
			
			// console.log(  "\x1b[36m", 'inputContext getted', req.body.inputContexts )
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
	
	// SECTION DETECT INTENT (ROOT)
	public detectIntent = async ( body: ClientRequest ): Promise<IntentResponse> => {
		
		/* 1. GET CLIENT DATA */
		const { userId, projectId, textInput, clientIDs } = body;
		
		this.clientIDs = clientIDs
		this._accountPath = `usuarios/${ userId }`
		this._projectPath = `/usuarios/${ userId }/agentes/${ projectId }`;

		

		/* 2. GET SESSION DATA */
		let session = await this.searchForSessionId( clientIDs )
		let wasFallback = session?.wasFallback || false
		const sessionId = session?.sessionId || uuidv4();
		this.sessionContexts = session?.outputContexts || []
		
		this.intentResponse[ 'new_session' ] = session ? false : true
		this.intentResponse[ 'user_id' ] = userId
		this.intentResponse[ 'session_id' ] = sessionId
		this.intentResponse[ 'contexts' ] = this.sessionContexts
		this.intentResponse[ 'project_id' ] = projectId
		
		const sessionClient = new SessionsClient({ credentials: keyFilename });
		this._parentPath = sessionClient.projectAgentSessionPath(projectId, sessionId);

	
			
			/* 3. SET REQUEST BODY */
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



			/* 4. DETECT INTENT */
			const response = await sessionClient.detectIntent( request )
				.then( result => result[ 0 ] );
			


				
			if ( response.queryResult.intent ) {
					
				/* 5. CURATE INTENT DETECTED */
				const intent = response.queryResult.intent;
				const outputContexts = response.queryResult.outputContexts
				const paramFields = response.queryResult.parameters.fields
				this.intentResponse[ 'intent_displayName' ] = intent.displayName;
				this.intentResponse[ 'parametersFields' ] = paramFields;
				this.responsesProcess[ 'parametersFields' ] = paramFields;
				this.responsesProcess[ 'outputContexts' ] = outputContexts



				/* 5.1. STRUCTURE CONTEXT PARAMS  */
				this._saveSessionParams(response.queryResult.outputContexts)

				

				/* 5.2. SET SESSION RESULT */
				const sessionResult = <QueryResult> {
					...response.queryResult,
					userId,
					sessionId,
					projectId,
				};
		
				
				
				let intentName = sessionResult.intent.name
				console.log( intent.displayName )
				if ( session && (
					intent.displayName == 'Default Welcome Intent' ||
					intent.displayName == 'Default Fallback Intent'
				) ) {
					console.log( 'fallback' )
					intentName = await this.getFallbackIntent( projectId ),
					wasFallback = true
				}
				

				/* 5.3. GET RESPONSES FROM FIRESTORE */
				const responsesGetted = await
					this.retriveMessagesFromFireStore(
						userId,
						projectId,
						intentName
					);
				this.responsesProcess['intent_responses'] = responsesGetted;
		
				
				
				/* 5.4. RETURN STRUCTURED RESPONSES */
				if (responsesGetted) {
					
					/* 5.4.1. GET ANSWERS AND OUTPUT CONTEXTS */
					let { answers, outputContexts } =
						await this.ManageResponsesController(
							responsesGetted, sessionResult, userId
						)
					this.intentResponse['outputContexts'] = outputContexts
		
					/* Line breaks */
					if ( answers.length > 0 ) {
						answers = answers.map( ( answer ) => { return {
							...answer,
							text: answer.text.split('\\').join('\u000A')
						}
						})	
					}

					const sessionBody: SessionBody = {
						sessionId, textInput, answers, outputContexts, wasFallback,
						intentId: intent.name,
						intentName: intent.displayName,
					}
					
					/* 5.4.2. SAVE OR DELETE SESSION */
					outputContexts.length === 0 && !wasFallback
						? this._deleteSession()
						: this._saveSession( sessionBody )


							// console.log( this.intentResponse )
					/* 5.4.3. VALIDTE PREVIOUS ATTENTION */
					if ( !wasFallback ) {
					
						/* 5.4.4. FINNALIZE EVENT */
						console.log( "\x1b[34m", 'Intent Response', this.intentResponse )
						console.log( "\x1b[34m", 'Response Process', this.responsesProcess )
						return {
							state: "ok",
							respuestas: answers,
							session: sessionBody
						}

					} else {
						console.log("\x1b[34m", 'Intent Response', this.intentResponse )
						console.log("\x1b[34m", 'Response Process',  this.responsesProcess )
						return null
					}
					
				} else {
					console.log("\x1b[34m", 'Intent Response', this.intentResponse )
					console.log("\x1b[34m", 'Response Process',  this.responsesProcess )
					return null
				}

			} else {
				console.log("\x1b[34m", 'Intent Response', this.intentResponse )
				console.log("\x1b[34m", 'Response Process',  this.responsesProcess )
				return null
			}

		
		
		
	}

	// !SECTION
	




	// SECTION RESPONSES
	/* FIND RESPUESTAS FIRESTORE */
	private async retriveMessagesFromFireStore(
		userId: string,
		idProject: string,
		intentName: string
	): Promise<Array<ResponseFromFirebase | null>> {
		const idName = this.trimNames(intentName)
		const pathToCollection = `/usuarios/${userId}/agentes/${idProject}/intents/${idName}/responses`;
		const intentRef = firestore.collection(pathToCollection).orderBy("index", "asc");
		const documents = await intentRef.get();
		const respuestas: any[] = documents.docs.map(doc => doc.data())

		return respuestas;
	}

	// ANCHOR ACTIONS MAP FROM RESPUESTAS
	protected ManageResponsesController = async (
		arrayOfAnswer: Array<ResponseFromFirebase>,
		queryResult: QueryResult,
		userId: string
	) => {
		const promisesToHandle: Array<Promise<ApiMessagesSucceeded>> = [];
		const parametersToEvaluate = this._parsedResponseFromDialogflow(
			<ParameterFromQueryResult>queryResult.parameters
		);
		this.responsesProcess['params_to_evaluate'] = parametersToEvaluate;

		/* Create callback for every response in firestore */
		for (const answer of arrayOfAnswer) {
			if (this.isContextAwnser(answer.inputContexts)) {
				
				const validateResponse: iResponseValidate = {
					result: answer.result,
					outputContexts: answer.outputContexts,
					parameters: parametersToEvaluate,
				}
				
				/* Replace Parameters for param map entry */
				answer.result.text = this._replaceParameters( parametersToEvaluate, answer.result.text );
				
				/* Validate every response kind */
				switch (answer.tipo) {
					case "catch":
						promisesToHandle.push(
							this._validateDataGroup(validateResponse)
						);
						break;
					case "search":
						promisesToHandle.push(
							this._validateSearch( validateResponse, userId)
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


		/* Validate no errors */
		let answers: ApiMessagesSucceeded[] = await Promise.all( promisesToHandle )
			.catch(error => {
				console.error("Error en la ejecucion de las validaciones", error);
				return { ...error };
			} );
		this.intentResponse[ 'answers' ] = answers
		this.responsesProcess['answers'] = answers
		

		/* Clean answers from undefineds and default */
		answers = answers.filter( a => a ) 
		if (answers.length > 1) {
			answers = answers.filter( a => !a.asDefault)
		}
		

		/* Set contexts form every valid answers */
		const outputContexts: Array<Context> = [];
		const errors = [];
		try {
			for (const currentResponse of answers) {
				
				/* Set contexts of outputContexts */
				if (currentResponse
					&& currentResponse.outputContexts
					&& currentResponse.outputContexts.length > 0) {

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
				

				/* Set context of suggestions */
				if (currentResponse && currentResponse.suggestions
					&& currentResponse.suggestions.length > 0) { 
					const sugContexts: string[] = currentResponse.suggestions
						.map(s => s.context ? s.context : null)
					this.intentResponse[ 'suggests_contexts'] = sugContexts
					
					await this.asyncForEach(sugContexts,async (c:string) => {
						if ( !outputContexts.find(x => x === c) && c !== "" ) {
							const contextAdded = await this._createContext(c);

							outputContexts.push(contextAdded);
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
			
		
		return { answers, outputContexts }
		
	};
	
	// ANCHOR SEARCH
	private _validateSearch = async (
	{result, outputContexts, parameters}: iResponseValidate,
	userId: string
	): Promise<ApiMessagesSucceeded | null> => {
		const searchResult = result as SearchOutput;
		const value = parameters.get( searchResult.parametro );
		this.responsesProcess['search_criteria'] = {result, outputContexts, parameters, value}

		if (searchResult.database && value) {
			const pathToCollection = `/usuarios/${userId}/${searchResult.database}`;
			const databaseRef = await firestore
				.collection(pathToCollection)
				.where("id", "==",value)
				.get();
			const data:Card[] = databaseRef.docs.map(doc => doc.data() as Card)

			this.responsesProcess[ 'search_result' ] = {
				...searchResult, cards: data
			}

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
		const value = parameters.get( conditional.valor ) || this._sessionParams[conditional.valor]
		let resolve = false;
		
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
		
		if ( resolve ) {
			this.responsesProcess[ 'result_conditional' ] = {...conditional }
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

		const clientsColPath = `${ this._accountPath }/clients`
		const clientsRef = firestore.collection(clientsColPath)
		if ( !this.clientIDs.clientId ) {
			clientsRef.add({data:this.data, lastUpdate: new Date()}).then( c => {
				this.clientIDs.clientId = c.id
			})
		} else {
			const clientRef = clientsRef.doc( this.clientIDs.clientId )
			clientRef.set({data:this.data, lastUpdate: new Date()}, {merge: true} )
		}


		if (value) {
			await this._createContext( 'data', parameters, 50 );
			this.responsesProcess['result_save'] = {...result, value}
			return { ...result, outputContexts: outputContexts };
		}
		return null;
	};

	// ANCHOR SIMPLE
	private _validateSimple = async (
		{result, outputContexts}: iResponseValidate
	): Promise<ApiMessagesSucceeded | null> => {

		if ( typeof result !== undefined ) {
			this.responsesProcess['result_default'] = {...result}
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
		
		const contextCreated = await contextClient.createContext({ parent: this._parentPath, context });
		return new Promise((resolve) => {
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

	// ANCHOR SAVE SESSION
	private async _saveSession(sessionBody: SessionBody) {
		const clientsColPath = `${ this._accountPath }/clients`
		const clientsRef = firestore.collection(clientsColPath)
		const interactionsPath = `${ this._projectPath }/interactions`
		const interactionsRef = firestore.collection(interactionsPath)
		// console.log(  "\x1b[35m", 'will save contexts...', sessionBody.outputContexts )
		let session: iCurrentSession = {
			sessionId: sessionBody.sessionId,
			outputContexts: sessionBody.outputContexts,
			lastUpdate: new Date(),
			sessionParams: this._sessionParams,
			wasFallback: sessionBody.wasFallback,
		} 
		const respuestas = sessionBody.answers.map( a => a.text )
		const interactions: iInteraction = {
			client: sessionBody.textInput, 
			agent: respuestas,
			intent: {
				intentId: sessionBody.intentId,
				intentName: sessionBody.intentName
			},
			time: new Date()
		}

		// Add on agent interactions for analytics
		interactionsRef.add(interactions)

		if ( !this.clientIDs.clientId ) {
			clientsRef.add( {session, isNew: true} ).then( c => {
				c.update({clientId: c.id})
				c.collection('conversation').add(interactions)
			} )
		} else {
			const clientRef = clientsRef.doc( this.clientIDs.clientId )
			clientRef.set( {session, wasFallback: sessionBody.wasFallback || false}, { merge: true } ).then( c => {
				clientRef.collection( 'conversation' ).add( interactions )
			})
		}
	}


	public async getFallbackIntent( idProject: string ): Promise<string | null>{
		const intentsPath = `${ this._accountPath }/agentes/${idProject}/intents`;
		const intentsRef = firestore.collection( intentsPath )
		const intentsDocs = await intentsRef
			.where( 'displayName', '==', 'Default Fallback Intent' )
			.get()

		return intentsDocs.size > 0
			? intentsDocs.docs[0].get('name') : null
	}


	// ANCHOR Search for session by user IDs
	async searchForSessionId( clientIDs: ClientIDs ): Promise<iCurrentSession | null> {
		const clientsColPath = `${ this._accountPath }/clients`
		const clientsRef = firestore.collection( clientsColPath )
		// console.log( clientIDs )

		if ( clientIDs.clientId ) {

			// console.log( 'Searching for cliente: ' + clientIDs.clientId)
			this.sessionPath = `${ clientsColPath }/${ this.clientIDs.clientId }`
			const userDoc = await clientsRef.doc( clientIDs.clientId ).get()
			
			if ( userDoc.exists ) {
				// console.log( 'user exists' )
				const session = userDoc.data()[ 'session' ] as iCurrentSession
				
				// console.log(  "\x1b[36m", 'Session result:', session || null )
				return session || null
			} else { return null }
			
		} else if ( clientIDs.messengerId || clientIDs.whatsappId ) {
				

			const platform = clientIDs.messengerId
				? 'messengerId' : 'whatsappId';
			// console.log( `Searching for ${platform}: ${clientIDs	[platform]}` );
			
			const userFinded = await clientsRef
				.where( platform, '==', clientIDs[platform] )
				.get()
			
			
			if ( !userFinded.empty ) {
				
				this.clientIDs.clientId = userFinded.docs[ 0 ].id
				// console.log( `client found ${ this.clientIDs.clientId }` )
				
				this.clientIDs[platform] = userFinded.docs[0].data()[platform]
				this.sessionPath = `${ clientsColPath }/${ this.clientIDs.clientId }`
				const session = userFinded.docs[ 0 ].data()[ 'session' ]
				// console.log( "\x1b[36m", 'session found', session )
				
				return session
			} else {
				clientsRef.add( this.clientIDs )
					.then( doc => {
						this.clientIDs.clientId = doc.id
						clientsRef.doc(doc.id).update({ clientId: doc.id })
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
		// console.log( '529 on Save Session Params', sessionContexts.map(c => c.parameters.fields) )
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
		// console.log("\x1b[35m%s\x1b[33m", "Parameters", this._sessionParams)
		
	}

	// ANCHOR DELETE SESSION 
	private async _deleteSession() {
		const sessionRef = firestore.doc( this.sessionPath )
		const sessionDoc = await sessionRef.get()

		if (sessionDoc.exists) {
			// const contexts = sessionDoc.get('session.outputContexts')
			// console.log('borrar',  contexts.map((c:any) => this.trimNames(c.name)) )
			await sessionRef.update( {
				session: firebase.firestore.FieldValue.delete()
			})
		}
		return
	}
	// !SECTION





	
	// SECTION PARAMETERS
	private paramTypes = new Map<string, SystemType>([
		["startDateTime", "datetimeperoid"],
		["street-address", "location"],
		["startDate", "dateperiod"],
		["startTime", "timeperiod"],
		["date_time", "datetime"],
		["currency", "unitcurrency"],
		["unit", "duration"],
		["name", "person"],
	] );
	
	// ANCHOR PARAMETERS OF DETECT INTENT
	private _parsedResponseFromDialogflow = (parameters: ParameterFromQueryResult) => {
		const paramFields = Object.entries(parameters.fields);

		return new Map(
			paramFields.map( field => {
				const paramValueTypeName = field[ 1 ][ "kind" ];
				const paramName = field[ 0 ];
				let paramValue: any
				this.responsesProcess['paramValueTypeName'] = paramValueTypeName
				
				if ( paramValueTypeName === "structValue" ) {
					const fields = field[ 1 ][ paramValueTypeName ][ "fields" ]
					paramValue = this._restructParamObject( fields )
					
				} else if (paramValueTypeName === 'listValue') {	
					const values = field[ 1 ][ paramValueTypeName ][ 'values' ]
					paramValue = this._restructParamObject( values )

				} else if (typeof field != 'object') {

					paramValue = field[ 1 ]
					
				} else {
					paramValue = field[ 1 ][ paramValueTypeName ]
				}
				
				this.responsesProcess[ 'paramValue' ] = paramValue
				this.responsesProcess[ 'paramName' ] = paramName

				return [paramName, paramValue];
			})
		);
	};

	// ANCHOR Replace parameters in text
	private _replaceParameters( _paramsMap: Map<string, any>, text_: string ) {
		let text: string
		if (text_.includes("$")) {
			const posibleVariable = text_.split("$")[1].split(" ")[0].split(".");
			const variable = posibleVariable[0];

			const value = _paramsMap.get(variable);
			text = text_.replace(
				posibleVariable.length > 1
					? posibleVariable[1] === "original"
						? `$${variable}.original`
						: `$${variable}`
					: `$${variable}`,
				value
			);
		}
		return text ? text : text_;
	}

	// ANCHOR Get system entityType name
	private _getSystemEntityTypeName(object: IntentDetectedParam): SystemType {
		let entityTypeName: SystemType;

		for (const key of this.paramTypes.keys()) {
			if (key in object) {
				entityTypeName = this.paramTypes.get(key);
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

	

	// STUB TRIM NAMES 
	private trimNames(name: string) {
		return name.slice(name.lastIndexOf('/')+1) 
	}
}
