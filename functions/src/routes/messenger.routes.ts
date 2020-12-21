import {Router} from "express";
import MessengerWebhook from "../controllers/messenger.controller";

export default class WebhooksRoutes {
    public router: Router
    private Messenger: MessengerWebhook;

    constructor (
        _messenger = new MessengerWebhook()
    ) {
        this.router = Router()
        this.Messenger = _messenger
        this.declareRoutes()
    }


    declareRoutes() {
        this.router.get( '/verify', this.Messenger.requestEvent);
        this.router.post('/:userId/:projectId', this.Messenger.listenEvent);
    }
}