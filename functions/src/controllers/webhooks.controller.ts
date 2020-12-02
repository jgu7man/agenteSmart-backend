import { Response, Request } from "express";
import { Event, Entry, } from "../interfaces/webhook.interface";



export default class MessengerWebhook {

    public listenEvent = async (req: Request, res: Response) => {

        const body: Event = req.body

        // Checks this is an event from a page subscription
        if (body.object === 'page') {
    
        // Iterates over each entry - there may be multiple if batched
        body.entry.forEach(function(entry: Entry) {
    
            // Gets the message. entry.messaging is an array, but 
            // will only ever contain one message, so we get index 0
            const webhook_event = entry.messaging[0];
            console.log(webhook_event);
        });
    
        // Returns a '200 OK' response to all requests
        res.status(200).send('EVENT_RECEIVED');
        } else {
        // Returns a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
        }

    }


    public requestEvent = async (req: Request, res: Response)=> {
        // Your verify token. Should be a random string.
        const VERIFY_TOKEN = "agentesmart"
        
        // Parse the query params
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        
        // Checks if a token and mode is in the query string of the request
        if (mode && token) {
        
            // Checks the mode and token sent is correct
            if (mode === 'subscribe' && token === VERIFY_TOKEN) {
                
                // Responds with the challenge token from the request
                console.log('WEBHOOK_VERIFIED');
                res.status(200).send(challenge);
            
            } else {
                // Responds with '403 Forbidden' if verify tokens do not match
                res.sendStatus(403);      
            }
        }
    }


}