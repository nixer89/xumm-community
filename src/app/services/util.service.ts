import { Injectable } from '@angular/core';
import { AppService } from './app.service';

@Injectable()
export class UtilService {
    constructor(private app: AppService) {}

    async getTransactionTypes(): Promise<any> {
        let dirList:any[] = await this.app.get('https://api.github.com/repos/ripple/xrpl-dev-portal/contents/content/references/protocol-reference/transactions/transaction-types');
        let relevantFiles:any[] = dirList.filter(r => r.name.match(/^[a-zA-Z]+\.md$/))

        let sources:any[] = [];
    
        for(let i = 0; i < relevantFiles.length; i++) {
            sources.push(this.app.getText(relevantFiles[i].download_url));
        }

        sources = await Promise.all(sources);

        let result:any[] = [];

        for(let i = 0; i < sources.length; i++) {
            let source:string = sources[i];

            result.push({
                transactionType: source.match(/^# ([a-zA-Z]+)/gm)[0].slice(2),
                docLink: 'https://xrpl.org/' + relevantFiles[i].name.split('.')[0] + '.html',
                requiresAmendment: source.match(/^(_\(Requires the).*(:not_enabled:.\).)$/gm) != null,
                codeSamples: source.split(`\n`).join(' ').match(/```.+?```/gm)
                    .map(s => s.split('```')[1].trim().replace(/^json[\n]*/gm, ''))
                    .map(s => s.replace(/,[ \t\n\\t\\n]*}$/, '}'))
                    .map(s => {
                        try {
                            return JSON.parse(s)
                        } catch (e) {
                            return s
                        }
                    })
            });
        }

        return result;
    }
}