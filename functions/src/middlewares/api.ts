import errorHandler from '../helpers/exceptions';
import express, { Application } from 'express';
import cors from 'cors';

import { config } from "dotenv";
import MessengerRoutes  from '../routes/messenger.routes';
// import WhatsappRoutes from '../routes/whatspp.routes';

export class Api {
	
	public app: Application;
	
	constructor () {
		config()
		this.app = express()
		this.initMiddleware()
		this.initRoutes()
		this.initErrorHandler()

	}

	private initRoutes() {
		this.app.use('/messenger', new MessengerRoutes().router);
		// this.app.use('/whatsapp', new WhatsappRoutes().router);
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