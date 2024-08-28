'use strict';

import * as express from 'express';
import * as errorHandler from './errors.controller';

export function ResultsHandler(error: any, doc: any, res: express.Response) {
    if (error) {
        let status = error.status | 400;
        return res.status(status).send({
            message: errorHandler.getErrorMessage(error)
        });
    } else {
        res.json(doc);
    }
}