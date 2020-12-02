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
	Card
} from "./../interfaces/session.interfaces";
import { Response, Request } from "express";
import { ContextsClient, SessionsClient } from "@google-cloud/dialogflow";
import { v4 as uuidv4 } from "uuid";
import * as admin from "firebase-admin";
import { keyFilename } from "../index";
import {IntentDetectedParam, SysInterface, SystemType} from "../interfaces/parameter.interface";

export default class SessionController {
	private auth: admin.app.App;
	_Contexts: Array<any>;
	_parentPath: string;
	constructor() {
		this.auth = admin.initializeApp({
			credential: admin.credential.applicationDefault(),
			databaseURL: "https://main-agentesmart.firebaseio.com",
		});
	}
	public detectIntent = async (req: Request, res: Response): Promise<void> => {
		try {
			const { projectId, textInput, clientId } = req.body;
			const sessionClient = new SessionsClient({ credentials: keyFilename });
			const sessionId = req.body.sessionId ? req.body.sessionId : uuidv4();

			const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);
			this._parentPath = sessionPath;
			const request = {
				session: sessionPath,
				queryInput: {
					text: {
						// The query to send to the dialogflow agent
						text: textInput,
						// The language used by the client (en-US)
						languageCode: "es",
					},
				},
			};

			//Inicia la secuenia
			
			const response = await sessionClient.detectIntent(request).then(result => result[0]);
			//retrive all contextFromSession: 
			// console.log('Respuesta de Dialogflow', response.queryResult);
			
			
			// console.log(response.queryResult.intent.parameters)
			// console.log("Antes de llegar a la asginacion: ", req.body);
			// const agent = new WebhookClient({ request: req, response: res });
			const sessionResult = <QueryResult>{
				...response.queryResult,
				clientId: clientId,
				sessionId,
				projectId,
			};

			const getRespuestas = await this.retriveMessagesFromFireStore(
				clientId,
				projectId,
				sessionResult.intent.name
			);

			// console.log({getRespuestas})
			if (getRespuestas) {
				const validatedResponses = await this.ManageResponsesController(getRespuestas, sessionResult, clientId);

				// console.info("\n\tExito!\n\tSe han retornado las siguientes respuestas:\n\t\t", validatedResponses);

				// if (validatedResponses) {
				// }

				res.status(200).json({
					message: "Exito",
					session: sessionId,
					respuestas: validatedResponses,
				});
				return;
			}

			res.status(404).json({
				message: "No se encontro base de datos con ese clientId y projectId",
			});
		} catch (error) {
			console.error(error);
			res.status(500).send("Error making session");
		}
	};

	private async retriveMessagesFromFireStore(
		clientId: string,
		idProject: string,
		intentName: string
	): Promise<Array<ResponseFromFirebase | null>> {
		// /usuarios/{idUser}/agentes/{idProject}/mensajes/{intentName}/respuestas
		const idName = intentName.slice(intentName.lastIndexOf("/") + 1);

		const pathToCollection = `/usuarios/${clientId}/agentes/${idProject}/mensajes/${idName}/respuestas`;

		const firestore = this.auth.firestore();

		const intentRef = firestore.collection(pathToCollection).orderBy("index", "asc");
		const respuestas: any[] = [];

		const documents = await intentRef.get();

		documents.forEach(doc => {
			respuestas.push(doc.data());
		});

		return respuestas;
	}

	// ANCHOR Parameters of detect intent
	private _parsedResponseFromDialogflow = (parameters: ParameterFromQueryResult) => {
		const newIterator = Object.entries(parameters.fields);

		return new Map(
			newIterator.map(x => {
				// console.log('\x1b[33m%s\x1b[37m', 'x', x)
				const paramValueTypeName = x[1]["kind"];
				const paramName = x[0];
				const paramValue =
					paramValueTypeName === "structValue"
						? this._restructParamObject(x[1][paramValueTypeName]["fields"])
						: x[1][paramValueTypeName];

				console.log("\x1b[32m%s\x1b[37m", "fields", paramValue);

				return [paramName, paramValue];
			})
		);
	};

	// ANCHOR actions map responses
	protected ManageResponsesController = async (
		arrayOfAnswer: Array<ResponseFromFirebase>,
		queryResult: QueryResult,
		clientId: string
	) => {
		const parametersToEvaluate = this._parsedResponseFromDialogflow(
			<ParameterFromQueryResult>queryResult.parameters
		);
		//setNewParams
		queryResult.parameters = parametersToEvaluate;
		console.log(parametersToEvaluate);

		const promisesToHandle: Array<Promise<ApiMessagesSucceeded>> = [];
		// const parameterArray = queryResult.parameters;
		// this._currentQueryResult.parameters.forEach( function(obj) {

		for (const element of arrayOfAnswer) {
			element.result.text = this._replaceParameters(parametersToEvaluate, element.result.text);

			switch (element.tipo) {
				case "grupo_datos":
					promisesToHandle.push(
						this._validateDataGroup(
							<DataParty> element.result,
							element.outputContext,
							parametersToEvaluate)
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
					promisesToHandle.push(
						this._validateSimple(
							<SimpleOutput> element.result,
							element.outputContext
						)
					);
					break;
				default:
					throw new Error("Esa respuesta no la pude procesar");
			}
		}
		const answers: ApiMessagesSucceeded[] = await Promise.all(promisesToHandle)
			.then(async anwsersToSetContext => {
				const outputContextsSetted: Array<string> = [];
				const errors = [];

				try {
					for (const currentResponse of anwsersToSetContext) {
						if (!outputContextsSetted.find(x => x === currentResponse.outputContext)) {
							await this._createContext(currentResponse.outputContext);
							outputContextsSetted.push(currentResponse.outputContext);
						}
					}
				} catch (error) {
					if (error) {
						// console.error('Error en procesando respuesta \n', error)
						errors.push(error);
					}
				}
				return anwsersToSetContext;
			})
			.then()
			.catch(error => {
				console.error("Error en la ejecucion de las validaciones", error);
				return [...error];
			});

		return answers;
		// const responsesReturned = await this._controllerResponse();
		// return responsesReturned;
	};

	// ANCHOR Replace parameters in text
	private _replaceParameters(
		_paramsMap: Map<string, any>,
		text_: string
	) {
		let textReplaced: string
		if (text_.includes("$")) {
			const posibleVariable = text_.split("$")[1].split(" ")[0].split(".");
			// console.log('\x1b[35m%s\x1b[37m','posibleVariable', posibleVariable)
			const variable = posibleVariable[0];

			console.log("\x1b[35m%s\x1b[37m", "variable", variable);
			console.log(posibleVariable);
			const value = _paramsMap.get(variable);
			textReplaced = text_.replace(
				posibleVariable.length > 1
					? posibleVariable[1] === "original"
						? `$${variable}.original`
						: `$${variable}`
					: `$${variable}`,
				value
			);
			console.log('\x1b[32m%s\x1b[37m', "text replaced: ", textReplaced);
		}
		return textReplaced;
	}

	private _validateSearch = async (
		responseToValidate: SearchOutput,
		parameters: Map<string, any>,
		outputContext: string,
		clientId: string
	): Promise<ApiMessagesSucceeded | null> => {
		// **************************************** //
		const value = parameters.get(responseToValidate.parametro)
		console.log( '\x1b[33m%s\x1b[37m%s', 'search criteria',{database: responseToValidate.database,value});
		// console.log();

		if (responseToValidate.database && value ) {
			console.log('response with search');
			const pathToCollection = `/usuarios/${clientId}/${responseToValidate.database}`;

			const firestore = this.auth.firestore();
			const databaseRef = await firestore
				.collection(pathToCollection)
				.where("name", "==", responseToValidate.parametro)
				.get();
			const data = [];

			for (const document of databaseRef.docs) {
				data.push(<any>document.data() as Card);
			}

			return {
				text: responseToValidate.text,
				cards: data,
				outputContext
			};
		}
		return null;
	};

	private _validateConditional = async (
		responseToValidate: ConditionalOutput,
		outputContext: string,
		parameters: Map<string, any>
	): Promise<ApiMessagesSucceeded | null> => {
		let resolve = false;
		const value = parameters.get(responseToValidate.parametro);
		console.log('\x1b[36m%s\x1b[37m', 'condition criteria',{value, criterio: responseToValidate.valor, param: responseToValidate.parametro});
		
		if (value) {
			console.log(value);
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
				case "existe":
					if (value.includes(responseToValidate.valor)) resolve = true;
					break;
				case "no existe":
					if (!value.includes(responseToValidate.valor)) resolve = true;
					break;
				default:
					break;
			}
		}
		if (resolve) {
			console.log('Response with condition');
			return { ...responseToValidate, outputContext };
		}
		return null;
	};
	private _validateDataGroup = async (
		responseToValidate: DataParty,
		outputContext: string,
		parameters: Map<string, any>
	): Promise<ApiMessagesSucceeded | null> => {

		const value = parameters.get(responseToValidate.parametro);
		
		console.log('\x1b[32m%s\x1b[37m','DataGroup Criteria',{current: value, key: responseToValidate.key});
		
		if (value) {
			console.log('response with datagroup');
			await this._createContext(responseToValidate.coleccion);
			return { ...responseToValidate, outputContext };
		}
		return null;
	};
	private _validateSimple = async (
		responseToValidate: SimpleOutput,
		outputContext: string
	): Promise<ApiMessagesSucceeded | null> => {
		
		console.log('\x1b[34m%s\x1b[37m', 'simple criteria');
		console.log(responseToValidate);
		
		if (typeof responseToValidate !== undefined) {
			return { ...responseToValidate, outputContext };
		}
		return null;
	};

	private async _createContext(contextString: string, params?: object) {
		const contextClient = new ContextsClient({ credentials: keyFilename });
		//The trick on Context is to set it greater that 1 so don't expire when finishing the current process 
		//(in the next call will appear as 1)
		const context: Context = {
			name: `${this._parentPath}/contexts/${contextString}`,
			lifespanCount: 2,
			parameters: params ? params : undefined,
		};
		// projects/<Project ID>/agent/sessions/<Session ID>
		// Parent string format
		const contextCreated = await contextClient.createContext({ parent: this._parentPath, context });
		return new Promise((resolve, reject) => {
			// console.info("Succefully Created context: ", contextCreated[0])
			resolve(contextCreated[0]);
		});
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

	private _getSystemEntityTypeName(object: IntentDetectedParam): SystemType {
		let entityTypeName: SystemType;

		for (let key of this.types.keys()) {
			if (key in object) {
				entityTypeName = this.types.get(key);
			}
		}

		return entityTypeName;
	}

	private _restructParamObject(object: IntentDetectedParam): SysInterface {
		let result: any;
		const entityTypeName: SystemType = this._getSystemEntityTypeName(object);

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
		} else if (entityTypeName === "duration" || entityTypeName === "unitcurrency" || entityTypeName === "location") {
			Object.keys(object).forEach(key => {
				const kindValue = object[key]["kind"];
				result[key] = object[key][kindValue];
			});
		} else {
			const kindValue = object["name"]["kind"];
			result = object["name"][kindValue];
		}

		return result;
	}
}
