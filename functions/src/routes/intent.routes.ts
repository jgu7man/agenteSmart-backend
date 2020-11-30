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
        this.router.route('/')
            .post(this.intentController.createIntent)
            .put(this.intentController.updateIntent)
            .delete(this.intentController.deleteIntentWithParams)

        this.router.get('/:projectId', this.intentController.listAllIntents);

        this.router.delete('/:intent/project/:projectId', this.intentController.deleteIntent);
    }
}