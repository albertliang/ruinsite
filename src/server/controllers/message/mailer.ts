
import {Config} from '../../config/config';
let sendgrid = require('sendgrid')(Config.sendGrid.apikey);
let helper = require('sendgrid').mail;

//(Config.sendGrid.apikey);

export namespace Mailer {
    export function SendMail(emailTo: string, subject: string, body: string, callback: Function) {
        let email = new helper.Mail(
            new helper.Email(Config.sendGrid.from),
            subject,
            new helper.Email(emailTo),
            new helper.Content('text/html', body));

        let request = sendgrid.emptyRequest({
            method: 'POST',
            path: '/v3/mail/send',
            body: email.toJSON()
        });

        // sendgrid.API(request, function(err: Error, response: any) {
        //     callback(err, response.statusCode);
        // });

        callback(null);
    }

    export function SendMailTemplate(emailTo: string, templateId: string, callback: Function) {
        let email = new helper.Mail(
            new helper.Email(Config.sendGrid.from),
            'no_subject',
            new helper.Email(emailTo),
            new helper.Content('text/html', 'no_body'));

        email.setTemplateId(templateId);

        let request = sendgrid.emptyRequest({
            method: 'POST',
            path: '/v3/mail/send',
            body: email.toJSON()
        });

        // sendgrid.API(request, function(err: Error, response: any) {
        //     callback(err, response.statusCode);
        // });
        callback(null);

    }

    export function SendMailMultiple(emailsTo: any, subject: string, body: string, callback: Function) {
        let errEmails: any = [];
        emailsTo.forEach( (emailTo: string) => {
            let email = new helper.Mail(
            new helper.Email(Config.sendGrid.from),
            subject,
            new helper.Email(emailTo),
            new helper.Content('text/html', body));

            let request = sendgrid.emptyRequest({
                method: 'POST',
                path: '/v3/mail/send',
                body: email.toJSON()
            });

            // sendgrid.API(request, function(err: Error, response: any) {
            //     if (err) errEmails.push(email)
            // });
        });

        callback(errEmails);


        // Code to send to multiple recipients in one email
        // emailsTo.slice(1).forEach( (e: any) => {
        //     email.personalizations[0].addTo(new helper.Email(e))
        // })
    }
}
