import * as functions from 'firebase-functions';
import serviceAccount from "./secret/main-agentesmart-589511385b0d.json";

export const keyFilename = serviceAccount;

import errorHandler from './helpers/exceptions';
import express, { Application } from 'express';
import cors from 'cors';

//routes
import AgentRoutes from './routes/agentes.routes';
import IntentRoutes from './routes/intent.routes';
import entityRoutes from './routes/entity.routes';
import SessionRoutes from './routes/session.routes';
import MessengerRoutes from './routes/messenger.routes';

import { config } from "dotenv";

export class App {
	
	public app: Application;
	
	constructor () {
		config()
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
		this.app.use('/messenger', new MessengerRoutes().router);
	}
	
	private initMiddleware(): void {

		//middleware SetUp
		this.app.use( express.json() )
		this.app.use( express.urlencoded( { extended: true } ) );
		this.app.use( cors() )

	}
	private initErrorHandler(): void {
		this.app.use(errorHandler);
	}

	public start(): void {
		const listener = this.app.listen(3000, () => {
			console.log(`Server up on port: ` + listener.address().port);
			console.log(new Date());
		})
	}
}


const api = new App();
exports.api = functions.https.onRequest( api.app );

