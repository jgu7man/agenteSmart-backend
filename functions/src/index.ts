import * as functions from 'firebase-functions';
import {Resource} from '@google-cloud/resource';
import express, {Application, Request, Response} from 'express';
import dialogflow from '@google-cloud/dialogflow';
import cors from "cors";
import path from "path";
import {Agent, Project, IPreProject} from './interfaces/agent.interface';

// Start writing Firebase Functions
const keyFilename = path.join(__dirname +'/main-agentesmart-589511385b0d.json');

// https://firebase.google.com/docs/functions/typescript
async function createProject(project: Project):Promise<Project | unknown | any>{
  // This method looks for the GCLOUD_PROJECT and GOOGLE_APPLICATION_CREDENTIALS
	// environment variables.

	let resource = new Resource({keyFilename});
	let options = {		
		name: project.name,
		parent: {
			type: "organization",
			id: "1039560988340"
		}
	}

	return await resource.createProject(project.projectId, <any>options)
	.then( data => {
		// let project = data[0];
		let operation = data[1];
		// let apiResponse = data[2];
		return operation.promise();
		
	})
}

async function createAgent(agent: Agent): Promise<Agent>{

	//setup default options
	agent.parent = `projects/${agent.parent}`
	agent.timeZone = (agent.timeZone) ? agent.timeZone : 'America/New_York'; 
	agent.defaultLanguageCode = (agent.defaultLanguageCode) ? agent.defaultLanguageCode : 'es';

	let resource = new dialogflow.AgentsClient({keyFilename, projectId: agent.parent});
	return await resource.setAgent({agent})
		.then( res => {
			let newAgent:Agent = res[0];
			return newAgent;
		});
}

class app {

	public app: Application;

	constructor(){
		this.app = express();
		this.config();
		this.routes();
		// console.log(process.env.GOOGLE_APPLICATION_CREDENTIALS);

	}
	private routes(): void {
		this.app.post('/', (req: Request, res: Response):void => {
			let {name, projectId}:Project = req.body;
			let {displayName}: Agent = req.body;

			if(!name || !projectId) {
				console.log("Need to provide: name:" + name + "\nProject ID:"+projectId);
				res.status(400).send('Bad Request');	
				return;
			}
			let proyecto: IPreProject = {name, projectId};

			createProject(<any>proyecto)
				.then( result => {
					if(result){
						//aqui se crea proyecto
						let response = result[0];
						return response.response;
					}
				})
				.then( response => {
					//create Agent
					let currentProject: Project = response;
					let agent: Agent | any = {
						parent: currentProject.projectId,
						displayName: displayName

					}
					return createAgent(agent);
				})
				.then(result => {
					//Agent Created with success
					res.status(200).send(result);
					return;
				})
				.catch(error => {
					let errorMsg:Error | object = {
						message: error.message || "Something bad has occurred creating a new Agent",
						error: error,
						errorCode: "PIPELINE ERROR CODE",
					}
					console.log('An error has occurred with the pipeline method:', error);
					res.status(500).send(JSON.stringify(errorMsg));
					return;
				});
		});
	}

	private config(): void {
		//for local testing ('cause we have key_file auth)
		// this.app.set('port', process.env.PORT || 3000);
		
		//middleware SetUp
		this.app.use(express.json())
		this.app.use(express.urlencoded({extended: true}));
		this.app.use(cors({origin: true}))
		
	}
	
	// public start(): void {
    //     this.app.listen(this.app.get('port'), () => {
    //         console.log('🚀Server is listenning on port:', this.app.get('port'));
    //     });
    // }
}
var server = new app();
// server.start();

exports.createProject = functions.https.onRequest(server.app);
