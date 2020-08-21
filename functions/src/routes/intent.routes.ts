import IntentController from '../controllers/intent.controller';

import { Router } from 'express';

export default class IntentRoutes {

    public router: Router;
    private intentController: IntentController;

    constructor(){
        this.router = Router();
        this.intentController = new IntentController();
        //init routes
        this.declareRoutes();
    }

    declareRoutes(): void {
        this.router.post('/', this.intentController.createIntent);

        this.router.get('/:projectId', this.intentController.listAllIntents);

        this.router.delete('/:intentId', this.intentController.deleteIntent);
        this.router.put('/', this.intentController.updateIntent);
    }
}