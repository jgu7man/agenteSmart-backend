import { Project, Agent, IPreProject } from '../../interfaces/agent.interface';
import { keyFilename } from "../../index";
import { Resource } from '@google-cloud/resource';
import dialogflow from '@google-cloud/dialogflow';
import { Request, Response } from 'express';

// Start writing Firebase Functions
// const keyFilename = path.join( __dirname + '/main-agentesmart-589511385b0d.json' );

// https://firebase.google.com/docs/functions/typescript
async function createProject( project: Project ): Promise<Project | unknown | any> {
    // This method looks for the GCLOUD_PROJECT and GOOGLE_APPLICATION_CREDENTIALS
    // environment variables.

    let resource = new Resource( { keyFilename } );
    let options = {
        name: project.displayName,
        parent: {
            type: "organization",
            id: "1039560988340"
        }
    }

    return await resource.createProject( project.projectId, <any> options )
        .then( data => {
            // let project = data[0];
            let operation = data[ 1 ];
            // let apiResponse = data[2];
            return operation.promise();

        } )
}

async function createAgent( agent: Agent ): Promise<Agent> {

    //setup default options
    agent.parent = `projects/${ agent.parent }`
    agent.timeZone = ( agent.timeZone ) ? agent.timeZone : 'America/New_York';
    agent.defaultLanguageCode = ( agent.defaultLanguageCode ) ? agent.defaultLanguageCode : 'es';
    agent.apiVersion = 'API_VERSION_V2'
    agent.matchMode = 'MATCH_MODE_HYBRID'
    agent.tier = 'TIER_STANDARD'
    agent.enableLoggin = true

    let resource = new dialogflow.AgentsClient( { keyFilename, projectId: agent.parent } );
    return await resource.setAgent( { agent } )
        .then( res => {
            let newAgent: Agent = res[ 0 ];
            return newAgent;
        } );
}

export function create(req: Request, res: Response) {

        console.log(req.body);
    let displayName = req.body.displayName;
    let projectId = req.body.agenteId
        // let { displayName }: Agent = req.body;

        if ( !displayName || !projectId ) {
            console.log( "Need to provide: name:" + displayName + "\nProject ID:" + projectId );
            res.status( 400 ).send( 'Bad Request' );
            return;
        }
    let proyecto: IPreProject = { displayName, projectId };

        createProject( <any> proyecto )
            .then( result => {
                if ( result ) {
                    //aqui se crea proyecto
                    let response = result[ 0 ];
                    return response.response;
                }
            } )
            .then( response => {
                //create Agent
                let currentProject: Project = response;
                let agent: Agent | any = {
                    parent: currentProject.projectId,
                    displayName: displayName

                }
                return createAgent( agent );
            } )
            .then( result => {
                //Agent Created with success
                res.status( 200 ).send( result );
                return;
            } )
            .catch( error => {
                let errorMsg: Error | object = {
                    message: error.message || "Something bad has occurred creating a new Agent",
                    error: error,
                    errorCode: "PIPELINE ERROR CODE",
                }
                console.log( 'An error has occurred with the pipeline method:', error );
                res.status( 500 ).send( JSON.stringify( errorMsg ) );
                return;
            } );
    }

   