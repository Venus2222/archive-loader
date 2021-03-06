app.config(function($stateProvider) {
    $stateProvider.state({
        name: 'sync',
        url: '/Sync',
        templateUrl: 'states/tools/sync.html',
        data: {
            title: 'Sync data'
        },
        resolve: {
            lastIndex: ($http) => {
                return $http.get('./solr/last-index').then(res => res.data, console.log)
            },
            syncAvailable: ($http) => {
                return $http.get('./solr/status').then(res => true, err => false)
            }
        },
        controller: function ($scope, $http, lastIndex, syncAvailable) {
            const getSuffix = () => {
                $http.get('./solr/suffix-suggestion').then(res => $scope.model.suffix = res.data, err => $scope.state.error = err.data)
            }
            getSuffix()

            $scope.model = {
                last: lastIndex
            }
            if(syncAvailable) {
                $scope.submit = () => {
                    if($scope.state.loading === true) { return }
                    $scope.state.loading = true
                    $http.post('./solr/sync', { suffix: $scope.model.suffix }).then(res => {
                        getSuffix()
                        $scope.state.loading = false
                        $scope.model.last = res.data
                    }, err => {
                        $scope.state.loading = false
                        $scope.state.error = err.data
                    })
                }
            } else {
                $scope.unavailable = true
            }
        }
    })
})