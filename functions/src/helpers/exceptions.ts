import { 
    Response, 
    Request 
} from 'express';

export class ApplicationException extends Error {
    constructor(message: string = 'An unexpected error ocurred.') {
        super(message);
    }
}

export const errorHandler = async (
    error: Error | ApplicationException,
    req: Request, 
    res: Response 
    ): Promise<void>  =>{
        
        console.error("Error en peticion: ", error);
        res.status(500).send("Un error ocurrió");

}