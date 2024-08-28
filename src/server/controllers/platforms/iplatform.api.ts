'use strict';

import {IUser} from '../../models/user.model';
import {IGamer} from '../../models/gamer.model';

export interface IPlatformApi {

    HasCredentials(user: IUser): boolean;
    GetPlatformUserId(user: IUser): string;
    GetPlatformAlias(gamer: IGamer): string;
    GetUserGames(Id: string): Promise<any>;
    GetUserFriends(Id: string): Promise<any>;
    GetProfiles(Ids: string[]): Promise<any>;
    GetPresences(Ids: string[]): Promise<any>;

    SendMessage(user: IUser, friendId: string, message: string): Promise<any>;
    AddFriend(user: IUser, friendId: string): Promise<any>;
}