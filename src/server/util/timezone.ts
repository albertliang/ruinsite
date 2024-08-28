'use strict';

import {IGamer} from '../models/gamer.model';
let moment = require('moment-timezone');

export function CalcDateTimeFromAvailSpecific(sourceDate: Date, sourceTimeInc15: number): Date {
    return moment(sourceDate).add(sourceTimeInc15 * 15, 'minutes').toDate();
}

/**
 * Gets the next instance of the day and time after given date
 * @param sourceDate
 * @param dayIndex
 * @param timeInc30
 * @param localTimezone
 */
export function CalcNextDateTimeFromAvail(sourceDate: Date, dayIndex: number, timeInc30: number, localTimezone: string): Date {
    let resultDate = moment(sourceDate).tz(localTimezone).startOf('day').isoWeekday(dayIndex).add(timeInc30 * 30, 'minutes')
    if (resultDate < sourceDate) {
        resultDate.add(1, 'weeks');
    }
    return resultDate.toDate();
}

export function UtcToLocal(utcDateTime: Date, targetTimezone: string): Date {
    return moment(utcDateTime).tz(targetTimezone).startOf('day').toDate();
}

export function LocalToUtc(sourceDateTime: Date): Date {
    return moment(sourceDateTime).tz('UTC').startOf('day').toDate();
}

export function LocalTimeInc30Offset(localTimezone: string, localDate: Date): number {
    //add 2 hours to datefilter since that's when daylight savings occurs
    return Math.floor(moment(localDate).add(2, 'hour').tz(localTimezone)._offset / 30);
}

export function LocalTimeInc15Offset(localTimezone: string, localDate?: Date): number {
    return Math.floor(moment(localDate).tz(localTimezone)._offset / 15);
}

export function UTCTimeToInc15(utcDateTime: Date): number {
    let utcMoment = moment(utcDateTime);
    return (utcMoment.hour() * 4) + Math.floor(utcMoment.minutes() / 15);
}

export function UTCTimeToLocalTimeInc15(localTimezone: string, utcDateTime: Date): number {
    return UTCTimeInc15ToLocalTimeInc15(localTimezone, utcDateTime, UTCTimeToInc15(utcDateTime));
}

export function LocalTimeInc15ToUTCTimeInc15(localTimezone: string, localDate: Date, localTimeInc15: number): number {
    let offset = LocalTimeInc15Offset(localTimezone, localDate);
    let timeInc = localTimeInc15 - offset;
    if (timeInc < 0) {
        timeInc += 96;
    } else if (timeInc > 95) {
        timeInc -= 96;
    }
    return timeInc;
}

/**
 * Converts an array of gamer availabilities to and from UTC formats
 * @param gamers
 * @param targetDate
 * @param toUTC
 * @param localTimezone
 */
export function OffsetMultiGamerAvail(gamers: IGamer[], targetDate: Date, toUTC: boolean, localTimezone: string): any[] {
    let offset = LocalTimeInc30Offset(localTimezone, targetDate);
    //let dayOffset = targetDate.getUTCDay();
    let dayOffset = 0; //assumes 0 is ALWAYS Sunday, messes other things up otherwise
    let availResult: any[] = [{}, {}, {}, {}, {}, {}, {}];
    if (toUTC) {
        offset *= -1;
        dayOffset *= -1;
    }

    gamers.forEach(gamer => {
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
            let timeslots = Object.keys(gamer.avails[dayIndex]);
            timeslots.forEach(timeslot => {
                let dayOverflow = 0;
                let newTimeslot = parseInt(timeslot) + offset;
                if (newTimeslot < 0) {
                    newTimeslot += 48;
                    if (dayIndex > 0) {
                        dayOverflow = -1;
                    } else {
                        dayOverflow = 6;
                    }
                } else if (newTimeslot > 47) {
                    newTimeslot -= 48;
                    if (dayIndex < 6) {
                        dayOverflow = 1;
                    } else {
                        dayOverflow = -6;
                    }
                }
                let newDayIndex = dayIndex + dayOverflow + dayOffset;
                if (newDayIndex > 6) {
                    newDayIndex -= 7;
                } else if (newDayIndex < 0) {
                    newDayIndex += 7;
                }
                if (availResult[newDayIndex][newTimeslot]) {
                    availResult[newDayIndex][newTimeslot].push(gamer.id);
                } else {
                    availResult[newDayIndex][newTimeslot] = [gamer.id];
                }
            });
        }
    });

    return availResult;
}

/**
 * Convert a gamer's avail to and from UTC formats
 */
export function OffsetGamerAvail(avail: any[], targetDate: Date, toUTC: boolean, localTimezone: string): any[] {

    let offset = LocalTimeInc30Offset(localTimezone, targetDate);
    let dayOffset = 0;
    let availResult: any[] = [{}, {}, {}, {}, {}, {}, {}];
    if (toUTC) {
        offset *= -1;
        dayOffset *= -1;
    }

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        if (avail[dayIndex]) {
            let timeslots = Object.keys(avail[dayIndex]);
            timeslots.forEach(timeslot => {
                let dayOverflow = 0;
                let newTimeslot = parseInt(timeslot) + offset;
                if (newTimeslot < 0) {
                    newTimeslot += 48;
                    if (dayIndex > 0) {
                        dayOverflow = -1;
                    } else {
                        dayOverflow = 6;
                    }
                } else if (newTimeslot > 47) {
                    newTimeslot -= 48;
                    if (dayIndex < 6) {
                        dayOverflow = 1;
                    } else {
                        dayOverflow = -6;
                    }
                }
                let newDayIndex = dayIndex + dayOverflow + dayOffset;
                if (newDayIndex > 6) {
                    newDayIndex -= 7;
                } else if (newDayIndex < 0) {
                    newDayIndex += 7;
                }

                availResult[newDayIndex][newTimeslot] = true;
            });
        }
    }
    return availResult;
}

export function UTCTimeInc15ToLocalTimeInc15(localTimezone: string, utcDate: Date, utcTimeInc15: number): number {
    let offset = LocalTimeInc15Offset(localTimezone, UtcToLocal(utcDate, localTimezone));
    let timeInc = utcTimeInc15 + offset;
    if (timeInc < 0) {
        timeInc += 96;
    } else if (timeInc > 95) {
        timeInc -= 96;
    }
    return timeInc;
}

export function Local30AvailToUTC(localTimezone: string, dayOfWeek: number, timeInc30: number) {
    let offset = LocalTimeInc30Offset(localTimezone, new Date());
    timeInc30 -= offset;
    if (timeInc30 < 0) {
        timeInc30 += 48;
        dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    } else if (timeInc30 > 47) {
        timeInc30 -= 48;
        dayOfWeek = dayOfWeek === 6 ? 0 : dayOfWeek + 1;
    }
    return {dayOfWeek: dayOfWeek, timeInc30: timeInc30};
}

export function UTC30AvailToLocal(localTimezone: string, dayOfWeek: number, timeInc30: number) {
    let offset = LocalTimeInc15Offset(localTimezone);
    timeInc30 += offset;
    if (timeInc30 < 0) {
        timeInc30 += 48;
        dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    } else if (timeInc30 > 47) {
        timeInc30 -= 48;
        dayOfWeek = dayOfWeek === 6 ? 0 : dayOfWeek + 1;
    }
    return {d: dayOfWeek, t: timeInc30};
}

/**
 * Given a date, figure out what's the user's midnight in UTC for that date
 * ie: 12/31/2016 10pm EST => 12/31/2016 12am EST => 12/31/2016 5am UTC
 *  */
export function GetUserMidnight(localTimezone: string, localDate?: Date): Date {
    return moment(localDate || new Date()).tz(localTimezone).startOf('day').toDate();
}

export function GetUtcMidnight(localTimezone: string, dateTime: Date): Date {
    return moment.tz(dateTime, localTimezone).utc().hours(0).minutes(0).seconds(0).toDate();
}