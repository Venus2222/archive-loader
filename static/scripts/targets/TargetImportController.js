export default function($scope) {
    let config = {
        modelName: 'target',
        lidPrefix: 'urn:nasa:pds:context:target:',
        requiredFields: ['logical_identifier', 'display_name', 'display_description'],
        primaryPostEndpoint: './save/targets',
        lookupReplacements: [
            {
                formField: 'display_name',
                registryField: 'target_name'
            },
            {
                formField: 'display_description',
                registryField: 'target_description'
            },
        ],
        relationshipModelNames: ['spacecraft'],
        relationshipTransformer: function(relationship) {
            return {
                target: $scope.model.target.logical_identifier,
                instrument_host: relationship.lid,
                relationshipId: relationship.relationshipId
            }
        },
        relationshipUnpacker: function(arr, relationship) {
            return arr.concat({
                lid: relationship.instrument_host,
                relationshipId: relationship.relationshipId
            })
        }
    }
    Object.assign($scope.config, config)
}