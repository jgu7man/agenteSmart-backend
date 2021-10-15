import { IntentView, ITrainingPhrase, IParameter } from "./../interfaces/agent.interface";
import { IntentsClient } from "@google-cloud/dialogflow";
import { Request, Response } from "express";
import asyncHandler from "../helpers/asyncHandler";
// ITrainingPhrase,
//     IParameter,
//     IPart
import { keyFilename } from "../index";
import { IIntent } from "../interfaces/agent.interface";

export default class IntentController {
	public createIntent(req: Request, res: Response): void {
		const { intent, projectId } = req.body as { projectId: string; intent: Partial<IIntent> };
		//set webHook if its not provided:
		console.log(intent);
		intent.webHookState = intent.webHookState ||
			"WEBHOOK_STATE_ENABLED_FOR_SLOT_FILLING"

		// let { name, displayName, webHookState, trainingPhrases, action, parameters } = req.body.intent;
		const client = new IntentsClient({ credentials: keyFilename });

		const parent: string = client.agentPath(projectId);
		//falta validar los parametros (intent.Parameters: Array<IParameter>).
		//Aquí o como middleware en otra funcion

		client
			.createIntent({
				parent,
				intent,
				intentView: "INTENT_VIEW_FULL",
			})
			.then(async response => {
				const operation = response[0];
				await client.close();

				return res.status(201).json({
					intent: operation,
				});
			})
			.catch(err => {
				return res.status(500).json({
					status: "error",
					result: "An error has occurred creating intent",
					error: err,
				});
			});
	}

	public updateIntent = async (req: Request, res: Response) => {
		//destructuring we can handle a 400 error here.
		const intent: IIntent = req.body.intent;
		const trainingPhrases = this.mergeParts(req.body.intent.trainingPhrases);
		const parameters = this.checkForParameters(req.body.intent.parameters);
		intent.trainingPhrases = <Array<ITrainingPhrase | null>>trainingPhrases;
		intent.parameters = parameters;

		console.log( intent )
		// console.log(intent.trainingPhrases);
		this.updatedIntent(intent)
			.then(result => {
				// console.info("Resultado de la operacion:", result.trainingPhrases);
				res.status(200).json({
					intent: result,
				});
				return true;
			})
			.catch(error => {
				let message = "Error actualizando intent"
				if (error.code && error.code === 9) message = 'Los parámetros no admiten caracteres especiales'
				console.error( message );
				res.status(400).json({ error,message });
			});
	};
	private mergeParts = (trainingPhrases: [ITrainingPhrase]) => {
		// const mapped = trainingPhrases.map(phrase => {
		//   const mappedParts: Array<ITrainingPhrase> = phrase.parts.map(part => {
		//     if (part.entityType) {
		//       part.entityType = "@" + part.entityType;
		//     }
		//   })
		//   phrase.parts = mappedParts;
		//   return phrase;
		// })
		const trainingPhrasesFixed = [];
    console.log( trainingPhrases )
		for (const trainingPhrase of trainingPhrases) {
      const partes = [];
			for (const part of trainingPhrase.parts) {
        // console.log( part )
				if (part.entityType !== undefined && part.entityType) {
					partes.push({
						...part,
            entityType: part.entityType.trim().startsWith("@")
              ? part.entityType
              : "@" + part.entityType,
						userDefined: true,
          });
				} else if (part.text) {
          partes.push({
            text: part.text,
            entityType: '',
            alias: '',
            userDefined: false
          });
        }
			}
      // console.log( partes )
			trainingPhrasesFixed.push({
				type: trainingPhrase.type,
				parts: partes,
			});
		}
		// console.info("Returned Pharases:", trainingPhrasesFixed);
		return trainingPhrasesFixed;
	};
	private checkForParameters = (parameters: Array<IParameter>) => {
		if (parameters.length < 1) return parameters;
		for (const parameter of parameters) {
			if (parameter) {
				parameter.value = parameter.value.startsWith("$") ? parameter.value : `$${parameter.value}`;
			}
      // console.info("Parametros seteados su valor: ", parameter);
		}
		return parameters;
	};

	private updatedIntent = async (intent: IIntent) => {
		const client = new IntentsClient({ credentials: keyFilename });

		const request = {
			intent: intent,
			intentView: <IntentView>"INTENT_VIEW_FULL",
		};
		const responses = await client
			.updateIntent(request)
			.then(result => {
				return result[0];
			})
			.then();

		return responses;
	};
	public deleteIntentWithParams = asyncHandler(async (req: Request, res: Response) => {
		const { intent, projectId } = req.query as { intent: string; projectId: string };
		const request = await this.deleteFromDialogFlow(intent, projectId);

		if (request) {
			res.status(204).end();
		}
	});
	public deleteIntent = async (req: Request, res: Response) => {
		const { intent, projectId } = req.params as { intent: string; projectId: string };
		try {
			const request = await this.deleteFromDialogFlow(intent, projectId);
			if (request) {
				res.status(204).end();
				return;
			}
		} catch (error: any) {
			if (error.code === 5) {
				res
					.status(404)
					.json({
						status: "Error",
						name: "NOT INTENT AVAILABLE",
						message: error.message,
					})
					.end();
				return;
			}
			res
				.status(500)
				.json({
					status: "Error",
					name: "INTENT DELATION ERROR",
					message: "Error borrando Intent",
				})
				.end();
		}
	};

	private deleteFromDialogFlow(intentName: string, projectId: string): Promise<object> {
		return new Promise((resolve, reject) => {
			const client = new IntentsClient({ credentials: keyFilename });
			const name = client.intentPath(projectId, intentName);

			client
				.deleteIntent({ name })
				.then(result => {
					if (result) {
						resolve(result[0]);
					}
				})
				.catch(error => {
					if (error) {
						reject(error);
					}
				});
		});
	}

	public listAllIntents(req: Request, res: Response): void {
		const { pageSize = 25, pageToken = null } = (req.query as unknown) as {
			intentView: number;
			pageSize: number;
			pageToken: string | null;
		};
		const project: string = req.params.projectId;
		const client = new IntentsClient({ credentials: keyFilename });

		const parent = client.agentPath(project);

		client
			.listIntents({
				parent,
				intentView: "INTENT_VIEW_FULL",
				pageSize,
				pageToken,
			})
			.then(async result => {
				const intents = result[0];
				await client.close();
				return res.status(200).json({
					status: "Success",
					result: {
						intents: intents,
						numberOfIntents: intents.length,
					},
				});
			})
			.catch(error => {
				return res.status(500).json({
					status: "Error",
					error,
				});
			});
	}
}
