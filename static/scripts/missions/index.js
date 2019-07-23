app.config(function($stateProvider) {
    $stateProvider.state({
        name: 'missions',
        url: '/Missions',
        redirectTo: 'missions.manage'
    })
    $stateProvider.state({
        name: 'missions.import',
        url: '/Import?edit',
        templateUrl: 'states/missions/import.html',
        params: { edit: null },
        data: {
            title: 'Add Mission'
        },
        resolve: {
            existing: function($http, $stateParams) {
                if(!!$stateParams.edit) {
                    return $http.get('./missions/edit', { params: { logical_identifier: $stateParams.edit }}).then(function(res) { return res.data[0] })
                } else {
                    return null
                }
            }
        },
        controller: 'MissionImportController'
    })
    $stateProvider.state({
        name: 'missions.manage',
        url: '/Manage',
        templateUrl: 'states/missions/manage.html',
        data: {
            title: 'Manage Missions'
        }
    })
})

import MissionImportController from './MissionImportController.js';
import MissionsManageController from './MissionsManageController.js';

app.controller('MissionImportController', MissionImportController);
app.controller('MissionsManageController', MissionsManageController);

app.directive('missionImportForm', function () {
    return {
        templateUrl: 'directives/mission-import-form.html',
        scope: {
            mission: '=',
        },
        controller: 'FormController'
    };
});