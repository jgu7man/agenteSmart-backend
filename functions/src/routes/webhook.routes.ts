import {Router} from "express";
import MessengerWebhook from "../controllers/webhooks.controller";

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
        this.router.post('/messenger', this.Messenger.listenEvent);
        this.router.get('/messenger', this.Messenger.requestEvent);
    }
}