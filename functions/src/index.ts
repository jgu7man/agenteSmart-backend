import * as functions from 'firebase-functions';
import errorHandler from './helpers/exceptions';
import path from "path";
import express, { Application } from 'express';
import cors from 'cors';

export const keyFilename = path.join(__dirname +'/main-agentesmart-589511385b0d.json');

//routes
import AgentRoutes from './routes/agentes.routes';
import IntentRoutes from './routes/intent.routes';
import entityRoutes from './routes/entity.routes';
import SessionRoutes from './routes/session.routes';

class app {
	
	public app: Application;
	
	constructor () {
		this.app = express()

		this.initMiddleware()
		this.initRoutes()
		this.initErrorHandler()

	}

	private initRoutes() {
		this.app.use('/agentes', new AgentRoutes().router);
		this.app.use('/intent', new IntentRoutes().router);
		this.app.use('/entity', entityRoutes());
		this.app.use('/session', new SessionRoutes().router)
		
	}
	
	private initMiddleware(): void {

		//middleware SetUp
		this.app.use( express.json() )
		this.app.use( express.urlencoded( { extended: true } ) );
		this.app.use( cors( { origin: true } ) )

	}
	private initErrorHandler(): void {
		this.app.use(errorHandler);
	}

	public start(): void {
		const listener = this.app.listen(3000, () => {
			console.log(`Server up on port: ` + listener.address().port);
		})
	}
}

const server = new app();
// server.start();

exports.dialogflow = functions.https.onRequest(server.app);
