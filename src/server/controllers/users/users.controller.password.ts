'use strict';

/**
 * Module dependencies.
 */
import * as mongoose from 'mongoose';
import * as express from 'express';
import * as errorHandler from '../errors.controller';
import * as passport from 'passport';
import * as _ from 'lodash';
import * as crypto from 'crypto';
import * as async from  'async';
import {IUser, User} from '../../models/user.model';
import {Config} from '../../config/config';
import {Message} from '../message/message';
import * as log4js from 'log4js';
let swig = require('swig');
let log = log4js.getLogger();

export namespace Password {

    /**
     * Forgot for reset password (forgot POST)
     */
    export function Forgot(req: express.Request, res: express.Response, next: Function) {
        async.waterfall([
            // Generate random token
            function(done: Function) {
                crypto.randomBytes(20, function(err: Error, buffer: Buffer) {
                    let token = buffer.toString('hex');
                    done(err, token);
                });
            },
            // Lookup user by username
            function(token: string, done: Function) {
                let email = req.body.email;
                if (email) {
                    User.findOne({
                        email: email
                    }, '-salt -password -platforms', function(err, user) {
                        if (!user) {
                            return res.status(400).send({
                                message: 'No account with that email has been found'
                            });
                        } else {
                            user.resetPasswordToken = token;
                            user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

                            user.save(function(err) {
                                done(err, token, user);
                            });
                        }
                    });
                } else {
                    return res.status(400).send({
                        message: 'Email field must not be blank'
                    });
                }
            },
            // If valid email, send reset email using service
            function(token: string, user: IUser, done: Function) {
                Message._ForgotPasswordEmail(user, token, (err: Error, result: any) => {
                    done(err, result);
                });
            }
        ], function(err, result) {
            if (err) {
                return res.status(400).send({ message: 'Unknown error occurred: ' + err.message });
            } else {
                return res.send(result);
            }
        });
    };

    /**
     * Reset password GET from email token
     */
    // export function ValidateResetToken(req: express.Request, res: express.Response) {
    //     User.findOne({
    //         resetPasswordToken: req.params.token,
    //         resetPasswordExpires: {
    //             $gt: Date.now()
    //         }
    //     }, function(err, user) {
    //         if (!user) {
    //             return res.redirect('/#!/password/reset/invalid');
    //         }

    //         res.redirect('/#!/password/reset/' + req.params.token);
    //     });
    // };

    /**
     * Reset password POST from email token
     */
    export function Reset(req: express.Request, res: express.Response) {
        // Init Variables
        let passwordDetails = req.body;

        async.waterfall([

            function(done: Function) {
                User.findOne({
                    resetPasswordToken: req.params.token,
                    resetPasswordExpires: {
                        $gt: Date.now()
                    }
                }, function(err, user) {
                    if (!err && user) {
                        if (passwordDetails.newPassword === passwordDetails.verifyPassword) {
                            user.password = passwordDetails.newPassword;
                            user.resetPasswordToken = undefined;
                            user.resetPasswordExpires = undefined;

                            user.save(function(err) {
                                if (err) {
                                    return res.status(400).send({
                                        message: errorHandler.getErrorMessage(err)
                                    });
                                } else {
                                    req.login(user, function(err) {
                                        if (err) {
                                            return res.status(400).send(err);
                                        } else {
                                            done(err, user);
                                        }
                                    });
                                }
                            });
                        } else {
                            return res.status(400).send({
                                message: 'Passwords do not match'
                            });
                        }
                    } else {
                        return res.status(400).send({
                            message: 'Password reset token is invalid or has expired.'
                        });
                    }
                });
            },
            function(user: IUser, done: Function) {
                let template = swig.compileFile(__dirname + '/templates/reset-password-confirm-email.html');
                let emailHTML = template({
                    name: user.username,
                    appName: Config.app.title
                });

                done(null, emailHTML, user);
            },
            // If valid email, send reset email using service
            function(emailHTML: string, user: IUser, done: Function) {
                Message._ResetPasswordEmail(user, done);
            }
        ], function(err) {
            if (err) {
                return res.status(400).send({ message: 'Unknown error occurred: ' + err.message });
            } else {
                return res.status(200).send({ message: 'ok' });
            }
        });
    };

    /**
     * Change Password
     */
    export function ChangePassword(req: express.Request, res: express.Response) {
        // Init Variables
        let passwordDetails = req.body;

        if (req.user) {
            if (passwordDetails.newPassword) {
                User.findById(req.user.id, function(err, user) {
                    if (!err && user) {
                        // if (user.authenticate(passwordDetails.currentPassword)) {
                            if (passwordDetails.newPassword === passwordDetails.verifyPassword) {
                                user.password = passwordDetails.newPassword;

                                user.save(function(err) {
                                    if (err) {
                                        return res.status(400).send({
                                            message: errorHandler.getErrorMessage(err)
                                        });
                                    } else {
                                        req.login(user, function(err) {
                                            if (err) {
                                                res.status(400).send(err);
                                            } else {
                                                res.send({
                                                    message: 'Password changed successfully'
                                                });
                                            }
                                        });
                                    }
                                });
                            } else {
                                res.status(400).send({
                                    message: 'Passwords do not match'
                                });
                            }
                        // } else {
                        //     res.status(400).send({
                        //         message: 'Current password is incorrect'
                        //     });
                        // }
                    } else {
                        res.status(400).send({
                            message: 'User is not found'
                        });
                    }
                });
            } else {
                res.status(400).send({
                    message: 'Please provide a new password'
                });
            }
        } else {
            res.status(400).send({
                message: 'User is not signed in'
            });
        }
    };

}
