import * as functions from 'firebase-functions';
import path from "path";
import AgentRoutes from './routes/agentes.routes';
import express, { Application } from 'express';
import cors from 'cors';

export const keyFilename = path.join(__dirname +'/main-agentesmart-589511385b0d.json');


class app {
	
	public app: Application;
	
	constructor () {
		this.app = express()
		this.config()
		this.routes()
	}

	public routes() {
		this.app.use('/agentes', new AgentRoutes().router)
	}
	
	private config(): void {
		//for local testing ('cause we have key_file auth)
		// this.app.set('port', process.env.PORT || 3000);

		//middleware SetUp
		this.app.use( express.json() )
		this.app.use( express.urlencoded( { extended: true } ) );
		this.app.use( cors( { origin: true } ) )

	}

}

const server = new app();
// server.start();

exports.dialogflow = functions.https.onRequest(server.app);
