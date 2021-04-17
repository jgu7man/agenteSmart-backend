// import {Router} from "express";
// import WhatsappWebhook from "../controllers/whatsapp.controller";

// export default class WhatsappRoutes {
//     public router: Router
//     private Whatsapp: WhatsappWebhook;

//     constructor (
//         _messenger = new WhatsappWebhook()
//     ) {
//         this.router = Router()
//         this.Whatsapp = _messenger
//         this.declareRoutes()
//     }


//     declareRoutes() {
//         this.router.get( '/:projectId', this.Whatsapp.requestQR);
//     }
// }