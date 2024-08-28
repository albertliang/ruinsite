'use strict';

/**
 * Module dependencies.
 */
import {IUser, User} from '../../models/user.model';
import {IGamer, Gamer} from '../../models/gamer.model';
import {IValet, Valet} from '../../models/valet.model';
import {UsersController} from '../users/users.controller';
import {GamersController} from '../gamers/gamers.controller';
import {Message} from '../message/message';
import {MakeId, GenerateRandomToken} from '../../util/util';
import * as mongoose from 'mongoose';
import * as express from 'express';
import * as errorHandler from '../errors.controller';
import * as passport from 'passport';
import * as jwt from 'jsonwebtoken';
import * as _ from 'lodash';
import {Config, ISiteConfig} from '../../config/config';
import {IJWTpayload} from '../../config/strategies/jwt';
import * as moment from 'moment';
import {Mailer} from '../message/mailer';
import {ResultsHandler} from '../results.controller';
import * as async from  'async';
let swig = require('swig');

export namespace Authentication {

    /**
     * SignupQuick : create a profile based on minimal info
     */
    export function SignupQuick(req: express.Request, res: express.Response) {
        // For security measurement we remove the roles from the req.body object
        delete req.body.roles;
        delete req.body.expireDate;

        // Init Variables
        let username = req.body.username;
        let email = req.body.email;
        let timezone = req.body.timezone;

        let userInit: any = {
            password: MakeId(5),
            username: username,
            email: email,
            timezone: timezone,
            isQuickJoin: true
        };
        let user = new User(userInit);
        let message: string = null;

        // Then save the user
        UsersController._Create(user, (errSave: Error, userSaved: IUser) => {
            if (errSave) {
                return res.status(401).send({ message: errorHandler.getErrorMessage(errSave) });
            }

            Message.SendVerificationEmail(userSaved, (err: Error) => {});
            //Message.SendOnboardingEmail(userSaved, (err: Error, data: any) => {});

            LogIn(user, req, res);
        });
    };

    /**
     * Signup : first-time user
     */
    export function Signup(req: express.Request, res: express.Response, next: Function) {
        // For security measurement we remove the roles from the req.body object
        delete req.body.roles;
        delete req.body.expireDate;

        async.waterfall([
            function(done: Function) {
                let user = new User(req.body);

                // save the user
                UsersController._Create(user, (errSave: Error, userSaved: IUser) => {
                    if (errSave) return res.status(401).send({ message: errorHandler.getErrorMessage(errSave) });
                    else done(null, userSaved);
                });
            },
            function(userSaved: IUser, done: Function) {
                Message.SendVerificationEmail(userSaved, (err: Error) => { done(err, userSaved); });
            },
            // function(userSaved: IUser, done: Function) {
            //     Message.SendOnboardingEmail(userSaved, (err: Error) => { done(err, userSaved); });
            // },
            function(user: IUser, done: Function) {
                LogIn(user, req, res);
                done();
            }
        ],  function(err) {
            if (err) {
                return res.status(400).send({ message: 'Unknown error occurred: ' + err.message });
            }
        });
    };

    /**
     * VerifyUser: verifies user's e-mail after signup
     */
    export function VerifyUser(req: express.Request, res: express.Response) {
        // Check if user token is correct
        User.findOne({
                emailVerificationToken: req.params.token,
                emailVerificationExpires: {
                    $gt: Date.now()
                }
            }, function(err, user) {
                if (err || !user) {
                    return res.status(400).send({
                        message: 'Email Verification is invalid or has expired.'
                    });
                }
                else {
                    user.emailIsVerified = true;
                    user.emailVerificationToken = undefined;
                    user.emailVerificationExpires = undefined;

                    user.save(function(err) {
                        if (err) {
                            return res.status(400).send({
                                message: errorHandler.getErrorMessage(err)
                            });
                        } else {
                            LogIn(user, req, res);
                        }
                    });

                }
        });
    };

    /**
     * Sends login link to given email if it exists
     * doesn't return a bad response since we don't want to confirm if email exists or not
     */
    export function SendLoginLinkEmail(req: express.Request, res: express.Response) {
        Message.SendLoginLinkEmail(req.body.email, (err: Error) => {});
    };

    /**
     * Signin : user signs in using passport-local/oath, gets jwt token
     */
    export function Signin(req: express.Request, res: express.Response, next: any) {
        passport.authenticate('local', { 'session': false },
            function(err: Error, user: IUser, info: any) {
                if (err || !user) {
                    res.status(401).send(info);
                } else {
                    LogIn(user, req, res);
                }
            }
        )(req, res, next);
    };

    /**
     * Login : handles login for the request and creates jwt token
     */
    export function LogIn(user: IUser, req: express.Request, res: express.Response) {
        // Remove sensitive data before login
        user.password = undefined;
        user.salt = undefined;

        req.logIn(user, function(err) {
            if (err) {
                res.status(401).send(err);
            } else {
                let token = CreateJwtToken(user.id);
                res.json( {'token': token, user: user} );
            }
        });
    }

    // /**
    //  * Get JWT token from Valet collection and remove it
    //  */
    // export function TokenRetrieval(req: express.Request, res: express.Response) {
    //     let tokenkey = req.params.tokenkey;
    //     Valet.findOneAndRemove({_id: new mongoose.Types.ObjectId(tokenkey), expiredBy: {$gte: Date.now()}}, (err: Error, valet: IValet) => {
    //         if (err || !valet) {
    //             res.status(401).send(err);
    //         } else {
    //             UsersController._Read(valet.user.toString(), (err: Error, user: IUser) => {
    //                 res.json( {'token': valet.token, user: user} );
    //             });
    //         }
    //     });
    // }

    /**
     * Signout : user signs out, wipe out jwt token
     */
    export function Signout(req: express.Request, res: express.Response) {
        req.logout();
        res.redirect('/');
    };

     /**
     * Verify token
     */
    export function IsAuthenticated(req: express.Request, res: express.Response, next: any) {

        passport.authenticate('jwt', { 'session': false },
            function(err: Error, user: any, info: any) {
                if (err || !user) {
                    res.status(401).send(info);
                } else {
                    // Remove sensitive data before login
                    user.password = undefined;
                    user.salt = undefined;

                    req.logIn(user, function(err) {
                        if (err) {
                            res.status(401).send(err);
                        } else {
                            next();
                        }
                    });
                }
            }
        )
        (req, res, next);
    };

    /**
     * Verify the user has the required roles
     * */
    export function IsAuthorized(roles: String[]) {
        return function(req: express.Request, res: express.Response, next: () => express.Response) {
            if (_.intersection(req.user.roles, roles).length) {
                return next();
            } else {
                return res.status(403).send({
                    message: 'user_not_authorized'
                });
            }
        };
    }

    // Create a web token and sign it
    export function CreateJwtToken(userId: string, expiresIn: number = Config.jwt.expires) {
        let newtoken: IJWTpayload = {
            exp: moment().add(expiresIn, 'days').valueOf(),
            aud: Config.jwt.audience,
            iss: Config.jwt.issuer,
            uid: userId
        };
        let signedtoken = jwt.sign(newtoken, Config.jwt.secret);
        return signedtoken;
    }

    /*
    VerificationReset: resets verification token and expiration
    */
    export function VerificationReset(req: express.Request, res: express.Response) {

        async.waterfall([
            GenerateRandomToken,
            function(token: string, done: Function) {

                //create User and set verification token and expiration
                User.findOneAndUpdate({email: req.body.email}, {$set: {
                    emailVerificationToken: token,
                    emailVerificationExpires: moment().add('1', 'day').toDate()
                }}, {new: true}, (err: Error, userUpdated: IUser) => {
                    if (err || !userUpdated) {
                        let message = err ? errorHandler.getErrorMessage(err) : 'User not found';
                        return res.status(401).send({ message: message});
                    }
                    else done(null, userUpdated);
                });
            },
            function (user: IUser, done: Function) {
                Message.SendVerificationEmail(user, done);
            }
        ],  function(err) {
            if (err) {
                return res.status(400).send({ message: 'Unknown error occurred: ' + err.message });
            } else {
                return res.send({ message: 'EmailVerificationReset' });
            }
        });
    }

    /**
     * OAuth callback
     */
    // export function OauthCallback(strategy: string) {
    //     return function(req: express.Request, res: express.Response, next: any) {
    //         passport.authenticate(strategy, function(err: Error, user: IUser, redirectURL: string) {
    //             if (err || !user) {
    //                 return res.redirect('/#!/signin');
    //             }
    //             req.login(user, function(err) {
    //                 if (err) {
    //                     return res.redirect('/#!/signin');
    //                 }

    //                 return res.redirect(redirectURL || '/');
    //             });
    //         })(req, res, next);
    //     };
    // };

    /**
     * Helper function to save or update a OAuth user profile
     */
    // export function SaveOAuthUserProfile(req: express.Request, providerUserProfile: any, done: Function) {
    //     if (!req.user) {
    //         // Define a search query fields
    //         let searchMainProviderIdentifierField = 'providerData.' + providerUserProfile.providerIdentifierField;
    //         let searchAdditionalProviderIdentifierField = 'additionalProvidersData.' + providerUserProfile.provider + '.' + providerUserProfile.providerIdentifierField;

    //         // Define main provider search query
    //         let mainProviderSearchQuery: any = {};
    //         mainProviderSearchQuery.provider = providerUserProfile.provider;
    //         mainProviderSearchQuery[searchMainProviderIdentifierField] = providerUserProfile.providerData[providerUserProfile.providerIdentifierField];

    //         // Define additional provider search query
    //         let additionalProviderSearchQuery: any = {};
    //         additionalProviderSearchQuery[searchAdditionalProviderIdentifierField] = providerUserProfile.providerData[providerUserProfile.providerIdentifierField];

    //         // Define a search query to find existing user with current provider profile
    //         let searchQuery = {
    //             $or: [mainProviderSearchQuery, additionalProviderSearchQuery]
    //         };

    //         User.findOne(searchQuery, function(err: Error, user: IUser) {
    //             if (err) {
    //                 return done(err);
    //             } else {
    //                 if (!user) {
    //                     let possibleUsername = providerUserProfile.username || ((providerUserProfile.email) ? providerUserProfile.email.split('@')[0] : '');

    //                     User.findUniqueUsername(possibleUsername, null, function(availableUsername: string) {
    //                         user = new User({
    //                             firstName: providerUserProfile.firstName,
    //                             lastName: providerUserProfile.lastName,
    //                             username: availableUsername,
    //                             email: providerUserProfile.email,
    //                             provider: providerUserProfile.provider,
    //                             providerData: providerUserProfile.providerData
    //                         });

    //                         // And save the user
    //                         user.save(function(err: Error) {
    //                             return done(err, user);
    //                         });
    //                     });
    //                 } else {
    //                     return done(err, user);
    //                 }
    //             }
    //         });
    //     } else {
    //         // User is already logged in, join the provider data to the existing user
    //         let user = req.user;

    //         // Check if user exists, is not signed in using this provider, and doesn't have that provider data already configured
    //         if (user.provider !== providerUserProfile.provider && (!user.additionalProvidersData || !user.additionalProvidersData[providerUserProfile.provider])) {
    //             // Add the provider data to the additional provider data field
    //             if (!user.additionalProvidersData) user.additionalProvidersData = {};
    //             user.additionalProvidersData[providerUserProfile.provider] = providerUserProfile.providerData;

    //             // Then tell mongoose that we've updated the additionalProvidersData field
    //             user.markModified('additionalProvidersData');

    //             // And save the user
    //             user.save(function(err: Error) {
    //                 return done(err, user, '/#!/settings/accounts');
    //             });
    //         } else {
    //             return done(new Error('User is already connected using this provider'), user);
    //         }
    //     }
    // };

    /**
     * Remove OAuth provider
     */
    // export function RemoveOAuthProvider(req: express.Request, res: express.Response, next: Function) {
    //     let user = req.user;
    //     let provider = req.param('provider');

    //     if (user && provider) {
    //         // Delete the additional provider
    //         if (user.additionalProvidersData[provider]) {
    //             delete user.additionalProvidersData[provider];

    //             // Then tell mongoose that we've updated the additionalProvidersData field
    //             user.markModified('additionalProvidersData');
    //         }

    //         user.save(function(err: Error) {
    //             if (err) {
    //                 return res.status(400).send({
    //                     message: errorHandler.getErrorMessage(err)
    //                 });
    //             } else {
    //                 req.login(user, function(err) {
    //                     if (err) {
    //                         res.status(400).send(err);
    //                     } else {
    //                         res.json(user);
    //                     }
    //                 });
    //             }
    //         });
    //     }
    // }
}
