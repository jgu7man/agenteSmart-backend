import { EntityTypesClient } from '@google-cloud/dialogflow';
import { Request, Response } from 'express';

import { keyFilename } from '../index';
import { IEntityCreateReq, IListEntityTypes } from "../interfaces/entity";

export default class EntityController {
    public async createEntity( req: Request, res: Response ): Promise<void> {
        let client = new EntityTypesClient({ keyFilename });
        try {
            let projectId = req.params.projectId || req.body.projectId; 
            let parent = client.agentPath(projectId);
            let { entityType, languageCode = "es" } = req.body;
            let request:IEntityCreateReq = {parent, entityType, languageCode};

            await client.createEntityType(request)
              .then( result => {
                  client.close();
                  res.status(200).json({
                      status: "success",
                      result: result[0]
                  });
              })
              .catch( error => {
                  client.close();
                  res.status(500).json({
                      status: "Error",
                      error
                  });
              })

        } catch (error) {
            console.error(error);
            client.close();
            res.status(400).json({
                status: "Error",
                message:"Bad Request Creating EntityType",
                error
            });
        }
    }

    public async updateEntity(req: Request, res: Response): Promise<void> {

    }

    public async deleteEntity (req: Request, res: Response): Promise<void> {
        try {
            let entityId: string = req.params.entityId || req.body.entityId;
            let projectId: string = req.body.projectId || req.params.projectId;

            let client = new EntityTypesClient({ keyFilename });

            let name = client.entityTypePath(
                projectId,
                entityId
            );
            await client.deleteEntityType({ name })
              .then( result => {
                  res.status(200).json({
                      status: "Success",
                      result: result[0],
                      message: `Entity with path:${name} has been deleted`
                  });
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
        let projectId:string = req.params.projectId;

        let client = new EntityTypesClient({ keyFilename });

        let parent = client.agentPath(projectId);

        let { 
            languageCode = "es",
            pageSize = 25, 
            pageToken = null 
        } = req.query as unknown as { 
            languageCode: string;
            pageSize: number, 
            pageToken: string | null
        };
        let request: IListEntityTypes = { parent, pageSize, pageToken, languageCode };
        await client.listEntityTypes(request)
          .then( result => {
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