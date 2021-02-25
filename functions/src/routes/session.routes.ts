import { Router } from 'express';
import SessionController from '../controllers/session.controller';

export default class SessionRoutes{
    public router: Router;
    private sessionController: SessionController;

    constructor(sessionController = new SessionController()) {
        this.router = Router();
        this.sessionController = sessionController;
        this.declareRoutes();
    }

    declareRoutes(): void {
        // this.router.post('/detectInput', this.sessionController.intentAttempt)
        this.router.post('/', this.sessionController.agentResponse);
        this.router.post('/:sessionId', this.sessionController.agentResponse);
    }

}