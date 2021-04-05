// import { Response, Request } from "express";
// import  {Client} from "whatsapp-web.js"
// import { firestore } from "../middlewares/firebase.mid";
// const waitFor = ( ms: number ) => new Promise( r => setTimeout( r, ms ) ) 

// export default class WhatsappWebhook {

//     private client = new Client({})

//     public requestQR = async ( req: Request, res: Response ) => {

//         const projectId = req.params.projectId
//             ? req.params.projectId
//             : null
        
//         const agentsQuery = await firestore
//             .collectionGroup( 'agentes' )
//             .where( 'projectId', '==', projectId )
//             .get()
        
//         const docPath = agentsQuery.docs[ 0 ].ref.path
//         // console.log( docPath )
//         const projectRef = firestore.doc( docPath + '/integraciones/whatsapp')

//         this.client.on( 'qr', ( qr ) => {
//             res.json( {status:'PENDING'} );
//             projectRef.set({qr}, {merge: true})
//         });
        
//         this.client.on('ready', () => {
//             console.log( 'Client is ready!' );
//             projectRef.set({qr:'',  status:'CONNECTED'}, {merge: true})
//             // res.send('READY')
//         } );
        
//         this.client.on('authenticated', (session) => {
//             console.log('AUTHENTICATED', session);
//             projectRef.set( { session }, { merge: true } )
//         });
        
//         this.client.on( 'message', async msg => {
//             console.log( msg )
//             await waitFor(10000)
//             if (msg.body == '!ping') {
//                 msg.reply('pong');
//             }
//         } );
        
//         this.client.on('disconnected', (reason) => {
//             console.log( 'Client was logged out', reason );
//             projectRef.set( {
//                 status: 'DISCONNECTED',
//                 reason
//             } );
//         });
        
//         this.client.initialize();

//     }
// }
