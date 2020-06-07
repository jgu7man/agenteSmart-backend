// import * as functions from 'firebase-functions';
import path from "path";
import express, { Application } from 'express';
import cors from 'cors';

export const keyFilename = path.join(__dirname +'/main-agentesmart-589511385b0d.json');

//routes
import AgentRoutes from './routes/agentes.routes';
import intentRoutes from './routes/intent.routes';

class app {
	
	public app: Application;
	
	constructor () {
		this.app = express()
		this.config()
		this.routes()
	}

	public routes() {
		this.app.use('/agentes', new AgentRoutes().router);
		this.app.use('/intent', new intentRoutes().router);
	}
	
	private config(): void {

		//middleware SetUp
		this.app.use( express.json() )
		this.app.use( express.urlencoded( { extended: true } ) );
		this.app.use( cors( { origin: true } ) )

	}

	public start(): void {
		let listener = this.app.listen(3000, () => {
			console.log(`Server up on port: ` + listener.address().port);
		})
	}
}

const server = new app();
server.start();

// exports.dialogflow = functions.https.onRequest(server.app);
