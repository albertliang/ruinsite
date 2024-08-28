'use strict';

import express = require('express');
import cors = require('cors');
import {GamesController} from './controllers/admin/games.controller';
import {GamersController} from './controllers/gamers/gamers.controller';
import {OrgsController} from './controllers/orgs/orgs.controller';
import {RoomsController} from './controllers/rooms/rooms.controller';
import {QueryDashboardController} from './controllers/queries/dashboard.controller';
import {QueryDashboardWeekController} from './controllers/queries/dashboard.week.controller';
import {QueryRecommendationController} from './controllers/queries/recommendation.controller';
import {Message} from './controllers/message/message';
import {UsersController} from './controllers/users/users.controller';
import {Config, ISiteConfig} from './config/config';
import { QuerySuggestionsController } from './controllers/queries/suggestions.controller';
import { PlatformsController } from './controllers/platforms/platforms.controller';


/*
 * Authorization
 *
 */
module.exports = function(app: express.Express) {

    let routerAuth = express.Router();
    let router = express.Router();
    let routerAnon = express.Router();
    let CheckAuth = UsersController.Authentication.IsAuthorized;

    //every route defined for this router requires auth check
    router.use(UsersController.Authentication.IsAuthenticated);

    router.get('/games', GamesController.List);
    router.get('/games/search/:gameName', GamesController.SearchByName);
    router.get('/gamesbyplatform/:platformId/search/:gameName', GamesController.SearchByPlatform);
    router.get('/gamesbyplatform/:platformId', GamesController.ListByPlatform);
    router.post('/games', CheckAuth(['admin']), GamesController.Create);
    router.get('/games/:gameId', GamesController.Read);
    router.put('/games/:gameId', CheckAuth(['admin']), GamesController.Update);
    router.delete('/games/:gameId', CheckAuth(['admin']), GamesController.Delete);
    router.post('/games/custom', GamesController.CreateCustom);

    router.get('/gamers/search/:userName', GamersController.Search);
    router.get('/gamers/:gamerId', GamersController.ReadAndPopulate);
    router.put('/gamers/:gamerId', CheckAuth(['admin']), GamersController.Update);
    router.delete('/gamers/:gamerId', CheckAuth(['admin']), GamersController.Delete);

    router.get('/gamer', GamersController.ReadAndPopulate);
    routerAnon.post('/user/checkusername', UsersController.IsUsernameUnique);
    routerAnon.post('/user/checkemail', UsersController.IsEmailUnique);

    router.get('/gamer/platforms', GamersController.ReadPlatform);
    router.put('/gamer/platforms', GamersController.Platforms.Update);
    router.put('/gamer/games', GamersController.Games.Update);
    router.put('/gamer/games/add/:gameId', GamersController.Games.AddGame);
    router.put('/gamer/games/remove/:gameId', GamersController.Games.RemoveGame);
    router.get('/gamer/games/owned/:gameId', GamersController.Games.OwnsGame);
    router.put('/gamer/preferredgames/add/:gameId', GamersController.Games.AddPreferredGame);
    router.put('/gamer/preferredgames/remove/:gameId', GamersController.Games.RemovePreferredGame);
    router.put('/gamer/preferredgames/replace/:oldGameId/:newGameId', GamersController.Games.ReplacePreferredGame);
    router.put('/gamer/friends/add/:friendId', GamersController.Friends.AddFriend); //todo: add friends via platforms as well
    router.put('/gamer/friends/remove/:friendId', GamersController.Friends.RemoveFriend); //todo: remove friends via platforms as well
    router.put('/gamer/avail/:dayOfWeek/:timeInc30', GamersController.Availabilities.AddAvail);
    //routerAnon.get('/avail/:token', GamersController.Availabilities.AddSpecificAnon); //allow adding avail from email
    router.delete('/gamer/avail/:dayOfWeek/:timeInc30', GamersController.Availabilities.RemoveAvail);
    router.get('/gamer/avail', GamersController.Availabilities.GetAvail);
    router.put('/gamer/searchfilters', GamersController.SearchFilters.Update);
    router.post('/gamer/avatar', GamersController.UpdateAvatar);

    router.get('/orgs/search/:orgName', OrgsController.Search);
    router.get('/orgs/top/:orgCount', OrgsController.Top);
    router.get('/orgs/:orgId/candidates/games/:gameId?', QueryDashboardWeekController.GetDashboardOrgsAvailability);
    routerAnon.get('/orgs/:orgId/candidates/games/:gameId?', QueryDashboardWeekController.GetDashboardOrgsAvailability);
    router.post('/orgs', OrgsController.Create);
    routerAnon.get('/orgs/:orgId', OrgsController.Read);
    router.put('/orgs/:orgId/comment', OrgsController.AddComment);
    router.put('/orgs/:orgId', OrgsController.IsAuthorized(), OrgsController.Update); //only org.admins can edit
    router.put('/orgs/:orgId/join', OrgsController.JoinOrg); //if private, needs invite to join
    router.put('/orgs/:orgId/request', Message.SendJoinOrgRequest);
    router.put('/orgs/accept/:orgId/:userId/:token', OrgsController.AcceptUser);
    router.put('/orgs/:orgId/leave', OrgsController.LeaveOrg);
    router.put('/orgs/:orgId/admin/add/:gamerId', OrgsController.IsAuthorized(), OrgsController.AddAdmin); //only org.admins can add admin
    router.put('/orgs/:orgId/admin/remove/:gamerId', OrgsController.IsAuthorized(), OrgsController.RemoveAdmin); //only org.admins can remove admin
    router.post('/orgs/:orgId/games/:gameId', OrgsController.IsAuthorized(), OrgsController.AddGame); //only org.admins can add games
    router.delete('/orgs/:orgId/games/:gameId', OrgsController.IsAuthorized(), OrgsController.RemoveGame); //only org.admins can remove games
    router.delete('/orgs/:orgId', OrgsController.IsAuthorized(), OrgsController.Delete); //only org.admins can delete the org

    // router.get('/rooms', RoomsController.List);
    router.post('/rooms', RoomsController.Create);
    router.get('/rooms/create/:gameId/:startTimeInc15', RoomsController.CreateFromLink);
    router.get('/rooms/:roomId', RoomsController.Read);
    routerAnon.get('/rooms/:roomId', RoomsController.Read); //Anonymous access allowed
    routerAnon.get('/rooms/:roomId/series/:occurrenceDate?', RoomsController.ReadSeries); //Anonymous access allowed
    router.put('/rooms/:roomId', RoomsController.IsAuthorized(), RoomsController.Update); //only room host can update
    router.put('/rooms/:roomId/join/:occurrenceDate?', RoomsController.JoinRoom);
    router.put('/rooms/:roomId/leave', RoomsController.LeaveRoom);
    router.put('/rooms/:roomId/comment/:occurrenceDate?', RoomsController.AddComment);
    router.delete('/rooms/:roomId', RoomsController.IsAuthorized(), RoomsController.Delete); //only room host can delete
    router.get('/rooms/:roomId/:occurrenceDate/candidates', QueryRecommendationController.GetRoomCandidates);
    router.get('/rooms/:roomId/:occurrenceDate/invite/:userId', Message.SendRoomInviteEmail);
    //router.put('/rooms/:roomId/invite/email', Message.SendRoomInviteEmailNonUser);

    router.get('/dashboard', QueryDashboardController.GetUserDashboard);
    router.get('/dashboard/week', QueryDashboardWeekController.GetUserDashboard);
    routerAnon.get('/dashboard/week', QueryDashboardWeekController.GetAnonDashboard);
    router.get('/dashboard/avail', QueryDashboardWeekController.GetDashboardSelfAvailability);
    router.get('/dashboard/avail/others', QueryDashboardWeekController.GetDashboardOthersAvailability);
    router.get('/dashboard/suggest', QuerySuggestionsController.GetUserSuggestions);

    //platforms/player alias lookup
    routerAnon.get('/rooms/:roomId/platforms/:platform', PlatformsController.GetPlayerAliases);

	router.get('/users/me', UsersController.Profile.Me);
    router.put('/users', UsersController.Profile.Update);

	router.post('/users/password', UsersController.Password.ChangePassword);
    router.post('/contactus', Message.NotifyAdmin_ContactUs);

    // Does not require authentication check
	routerAuth.post('/auth/forgot', UsersController.Password.Forgot);
	//routerAuth.get('/auth/reset/:token', UsersController.Password.ValidateResetToken);
	routerAuth.post('/auth/reset/:token', UsersController.Password.Reset);
	routerAuth.post('/auth/signup', UsersController.Authentication.Signup);
	routerAuth.post('/auth/signupquick', UsersController.Authentication.SignupQuick);
	routerAuth.post('/auth/signin', UsersController.Authentication.Signin);
	routerAuth.get('/auth/signout', UsersController.Authentication.Signout);
    routerAuth.get('/auth/verification/:token', UsersController.Authentication.VerifyUser);
    routerAuth.put('/auth/verification/reset', UsersController.Authentication.VerificationReset);
    routerAuth.post('/auth/loginlink', UsersController.Authentication.SendLoginLinkEmail);
    
    // Finish by binding the user middleware
	//app.param('userId', UsersController.Authorization.UserByID);

    routerAnon.get('/unsubscribe/:username/:subscribedToSetting', UsersController.Profile.Unsubscribe);

    app.use(cors({
        origin: Config.app.realm
    }));
    app.use('/api', router);
    app.use('/anon', routerAnon);
    app.use('/', routerAuth); //hack to get steam passport to work, for some reason it only works when using '/'
};
