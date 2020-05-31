import {  Router, Request, Response  } from "express";
import * as agentes from "../functions/agentes/crear-agente";



export default class AgentRoutes {

    router: Router
    constructor () {
        this.router = Router()
        this.routes()
    }

    public routes(): void {
        this.router.post( '/create', ( req: Request, res: Response ): void => { agentes.create( req, res) } )
    }
}