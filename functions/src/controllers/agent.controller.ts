import { IProject, Agent, IPreProject } from '../interfaces/agent.interface';
import { keyFilename } from "../index";
import { Resource, Project } from '@google-cloud/resource';
import dialogflow from '@google-cloud/dialogflow';
import { Request, Response } from 'express';
import { firestore } from "../middlewares/firebase.mid";

// Start writing Firebase Functions
// const keyFilename = path.join( __dirname + '/main-agentesmart-589511385b0d.json' );

// https://firebase.google.com/docs/functions/typescript
async function createProject( project: IProject ): Promise<IProject | unknown | any> {
    // This method looks for the GCLOUD_PROJECT and GOOGLE_APPLICATION_CREDENTIALS
    // environment variables.

    const resource = new Resource( { credentials: keyFilename } );
    const options = {
        name: project.displayName,
        parent: {
            type: "organization",
            id: "1039560988340"
        }
    }

    return await resource.createProject( project.projectId, <any> options )
        .then( data => {
            // let project = data[0];
            const operation = data[ 1 ];
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
    agent.enableLoggin = true

    const resource = new dialogflow.AgentsClient( { credentials: keyFilename, projectId: agent.parent } );
    return await resource.setAgent( { agent } )
        .then( res => {
            const newAgent: Agent = res[ 0 ];
            return newAgent;
        } );
}

export function create(req: Request, res: Response): void{

    const {displayName, projectId} = req.body;
        // let { displayName }: Agent = req.body;

    if ( !displayName || !projectId ) {
        console.log( "Need to provide: name:" + displayName + "\nProject ID:" + projectId );
        res.status( 400 ).send( 'Bad Request' );
        return;
    }

    const proyecto: IPreProject = { displayName, projectId };

        createProject( <any> proyecto )
            .then( result => {
                if ( result ) {
                    //aqui se crea proyecto
                    const response = result[ 0 ];
                    return response.response;
                }
            } )
            .then( response => {
                //create Agent
                const currentProject: IProject = response;
                const agent: Agent | any = {
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
                const errorMsg: Error | object = {
                    message: error.message || "Something bad has occurred creating a new Agent",
                    error: error,
                    errorCode: "PIPELINE ERROR CODE",
                }
                console.log( 'An error has occurred with the pipeline method:', error );
                res.status( 500 ).send( JSON.stringify( errorMsg ) );
                return;
            });
}



// export function importAgente( req: Request, res: Response ) {
    
// }


export async function deleteProject( req: Request, res: Response ) {
    const
        projectId: any = req.query['projectId'],
        clientId: any = req.query['clientId'],
        resource = new Resource({ credentials: keyFilename }),
        project = new Project(resource, projectId),
        projectRef = firestore.doc(`usuarios/${clientId}/agentes/${projectId}`),
        collections = ['clientes','colecciones', 'contextos', 'integraciones', 'mensajes', 'parametros', 'tarjetas', 'tipos'];
    
    try {
        let data = await project.delete() 
        .then( () => { console.log('Project deleted') } )
        .catch( error => {
            console.error( error )
            return res.status(500).send({error, message:'Error al borrar el projecto'})
        })
        
        collections.forEach(async col => {
            const currentCol = await (await projectRef.collection(col).get())
            const size = currentCol.size
            if (size > 0) currentCol.forEach( doc => doc.ref.delete())
        })

        projectRef.delete()
        return res.status(200).json({data, message: 'Project deleted'})
    } catch (error) {
        console.error( error )
        return res.status( 400 ).json( {
            error, message: "Falla al borrar en firestore"
        })
    }
    
    
    
}
