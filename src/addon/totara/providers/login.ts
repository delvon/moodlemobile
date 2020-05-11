// (C) Copyright 2019 Catalyst IT Europe Ltd
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Injectable } from '@angular/core';
import { CoreLoggerProvider } from '@providers/logger';
import { CoreSitesProvider } from '@providers/sites';
import { CoreEventsProvider } from '@providers/events';
import { CoreWSProvider } from '@providers/ws';
import { CoreAppProvider } from '@providers/app';

@Injectable()
export class TotaraLoginProvider {
    protected logger;

    constructor(
        logger: CoreLoggerProvider,
        private sitesProvider: CoreSitesProvider,
        private eventsProvider: CoreEventsProvider,
        private wsProvider: CoreWSProvider,
        private appProvider: CoreAppProvider,
    ) {
        this.logger = logger.getInstance('TotaraLoginProvider');

        this.eventsProvider.on(CoreEventsProvider.SITE_POLICY_CONSENT_PENDING, () => {
            this.checkSitePolicy();
        });
    }

    /**
     * Check site policy status.
     *
     * @param {string} [siteId] Site ID. If not defined, current site.
     */
    checkSitePolicy(siteId?: string): Promise<void> {
        return this.sitesProvider.getSite(siteId).then((site) => {
            return this.wsProvider.call('local_mobile_totara_check_site_policy_status', {}, { siteUrl: site.getURL(), wsToken: site.getToken() }).then((data) => {
                if (data.status == false) {
                    this.sitePolicyNotAgreed();
                }
            });
        });
    }

    /**
     * Function called when site policy is not agreed. Reserved for core use.
     *
     * @param {string} [siteId] Site ID. If not defined, current site.
     */
    sitePolicyNotAgreed(siteId?: string): void {
        siteId = siteId || this.sitesProvider.getCurrentSiteId();
        if (!siteId || siteId != this.sitesProvider.getCurrentSiteId()) {
            // Only current site allowed.
            return;
        }

        if (!this.sitesProvider.wsAvailableInCurrentSite('core_user_agree_site_policy')) {
            // WS not available, stop.
            return;
        }

        const rootNavCtrl = this.appProvider.getRootNavController(),
            activePage = rootNavCtrl.getActive();

        // If current page is already site policy, stop.
        if (activePage && activePage.component && activePage.component.name == 'AddonTotaraSitePolicyPage') {
            return;
        }

        rootNavCtrl.setRoot('AddonTotaraSitePolicyPage', { siteId: siteId });
    }

    /**
     * Get the site policy.
     *
     * @param {string} [siteId] Site ID. If not defined, current site.
     * @return {Promise<any>} Promise resolved with the site policy.
     */
    getSitePolicy(siteId?: string): Promise<any> {
        return this.sitesProvider.getSite(siteId).then((site) => {
            return this.wsProvider.call('local_mobile_totara_get_site_policy', {}, { siteUrl: site.getURL(), wsToken: site.getToken() });
        });
    }

    /**
     * Accept site policy.
     *
     * @param {string} [siteId] Site ID. If not defined, current site.
     * @return {Promise<any>} Promise resolved if success, rejected if failure.
     */
    acceptSitePolicy(data: any, siteId?: string): Promise<void> {
        let statements = [];

        for (let item in data) {
            let statement = {};
            statement['dataid'] = item;
            statement['value'] = data[item];
            statements.push(statement);
        }
        return this.sitesProvider.getSite(siteId).then((site) => {
            return site.write('local_mobile_totara_agree_site_policy', { 'statements': statements }).then((result) => {
                if (!result.status) {
                    return Promise.reject(null);
                }
            });
        });
    }
}
