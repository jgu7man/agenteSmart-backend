import { Response, Request } from "express";
import  {Client} from "whatsapp-web.js"
// import { firestore } from "../middlewares/firebase.mid";

export default class WhatsappWebhook {

    private client = new Client({})

    public requestQR = async (req: Request, res: Response) => {
        this.client.on( 'qr', ( qr ) => {
            console.log( 'QR RECEIVED', qr );
            res.send( {code:qr} );
        });
        
        this.client.on('ready', () => {
            console.log('Client is ready!');
        });
        
        this.client.on('message', msg => {
            if (msg.body == '!ping') {
                msg.reply('pong');
            }
        });
        
        this.client.initialize();
    }
}
