import * as admin from "firebase-admin";


export class Firebase {
    public auth: admin.app.App;
    
    constructor () {
        this.auth = admin.initializeApp({
            credential: admin.credential.applicationDefault(),
			databaseURL: "https://main-agentesmart.firebaseio.com",
		});
    }
    
    
}


export const firestore = new Firebase().auth.firestore()