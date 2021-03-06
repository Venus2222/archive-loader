export default function($scope, $http, $state) {
    $http.get('./status/missions').then(function(res) {
        $scope.status = res.data;
    }, function(err) {
        $scope.state.error = err;
    })

    $scope.edit = function(lidvid) {
        return $state.href('missions.import', {edit: lidvid})
    }
}