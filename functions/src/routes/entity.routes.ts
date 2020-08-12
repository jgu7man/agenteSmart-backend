import EntityController from "../controllers/entity.controller";
import { Router } from "express";

export default function exportRoutes(): Router{
    const entityController = new EntityController();
    const router = Router();

    router.put('/', entityController.updateEntity);

    router.post('/', entityController.createEntity);
    router.post('/:projectId', entityController.createEntity);

    router.get('/:projectId',entityController.listEntities);

    router.delete('/:entityId', entityController.deleteEntity);
    router.delete('/:projectId/:entityId', entityController.deleteEntity);

    return router;
}