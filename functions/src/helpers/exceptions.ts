import { 
    Response, 
    Request 
} from 'express';

export class ApplicationException extends Error {
    constructor(message: string = 'An unexpected error ocurred.') {
        super(message);
    }
}

function errorHandler(
    error: ApplicationException,
    req: Request, 
    res: Response) {
    
    console.log('Entre al manejo de Error')
    console.error("Error en peticion: ", error);
    res.status(500).json({
        "status": "Error",
        "message": error.message,
        "code": error.name
        });

}

export default errorHandler;
// export const errorHandler = async (
//     error: Error | ApplicationException,
//     req: Request, 
//     res: Response 
//     ): Promise<void>  =>{
//     console.log('Entre al manejo de Error')
//     console.error("Error en peticion: ", error);
//     res.status(500).json({
//         "status": "Error",
//         "message": error.message,
//         "code": error.name
//         });

// }