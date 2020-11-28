import { EntityTypesClient } from '@google-cloud/dialogflow';
import { Request, Response } from 'express';

import { keyFilename } from '../index';
import { IEntityCreateReq, IListEntityTypes } from "../interfaces/entity";

export default class EntityController {
    public createEntity( req: Request, res: Response ): void {
        const client = new EntityTypesClient({ credentials: keyFilename });
        try {
            const projectId = req.params.projectId || req.body.projectId; 
            const parent = client.agentPath(projectId);
            const { entityType, languageCode = "es" } = req.body;
            const request:IEntityCreateReq = {parent, entityType, languageCode};

            client.createEntityType(request)
              .then( async result => {
                  await client.close();
                  res.status(200).json({
                      status: "success",
                      result: result[0]
                  });
              })
              .catch( error => {
                  res.status(500).json({
                      status: "Error",
                      error
                  });
              })

        } catch (error) {
            console.error(error);
            res.status(400).json({
                status: "Error",
                message:"Bad Request Creating EntityType",
                error
            });
        }
    }

    public async updateEntity(req: Request, res: Response): Promise<void> {
        try {
            const { 
                entityType, 
                languageCode = "es", 
                updateMask = null 
            } = req.body;

            const client = new EntityTypesClient({ credentials:keyFilename });
            
            const request = {
                entityType,
                languageCode,
                updateMask
            };
            client.updateEntityType(request)
              .then( async result => {
                    res.status(204).json({
                      status: "Success",
                      result: result[0]
                    })
                    await client.close();
                })
              .catch( error => {
                res.status(500).json({
                    status: "Error",
                    error
                });   
              })
        } catch (error) {
            res.status(400).json({
                status: "Error",
                message:"Bad Request Updating EntityType",
                error
            });
        }
        
    }

    public async deleteEntity (req: Request, res: Response): Promise<void> {
        try {
            const entityId: string = req.params.entityId || req.body.entityId;
            const projectId: string = req.body.projectId || req.params.projectId;

            const client = new EntityTypesClient({ credentials: keyFilename });

            const name = client.entityTypePath(
                projectId,
                entityId
            );
            await client.deleteEntityType({ name })
              .then( async result => {
                  await client.close();
                res.status(204).end();
                //   json({
                //       status: "Success",
                //       result: result[0],
                //       message: `Entity with path:${name} has been deconsted`
                //   });
              })
              .catch( error => {
                res.status(500).json({
                    status: "Error",
                    error
                });
              })

        } catch (error) {
            res.status(400).json({
                status: "Error",
                message:"Bad Request Creating EntityType",
                error
            });
        }
    }

    public async listEntities(req: Request, res: Response): Promise<void> {
        const projectId:string = req.params.projectId;

        const client = new EntityTypesClient({ credentials: keyFilename });

        const parent = client.agentPath(projectId);

        const { 
            languageCode = "es",
            pageSize = 25, 
            pageToken = null 
        } = req.query as unknown as { 
            languageCode: string;
            pageSize: number, 
            pageToken: string | null
        };

        const request: IListEntityTypes = { parent, pageSize, pageToken, languageCode };

    
        client.listEntityTypes(request)
          .then( async result => {
              await client.close();
              res.status(200).json({
                  status: "Success",
                  result: result[0]
              })
          })
          .catch( error => {
              res.status(500).json({
                status: "Error",
                error
              });
          })
    }
}