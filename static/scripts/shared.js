const isEmptyObject = obj =>  {
    if (obj.constructor === Object) {
        for(var key in obj) {
            if(obj.hasOwnProperty(key) && !key.startsWith('$$') && !!obj[key]) {
                return false;
            }
        }
        return true;
    }
    return false;
}

app.constant('constants', {
    bundleType: 'Bundle',
    collectionType: 'Collection'
});

app.constant('sanitizer', function(formObject, templateModel) {
    if(!formObject) { return null }

    let sanitized = templateModel()
    for (const [key, value] of Object.entries(formObject)) {
        // put each field into the new sanitized object, unless it's inherited or angular-specific
        if (formObject.hasOwnProperty(key) && !key.startsWith('$$') && !!value) {
            if(value.constructor === Array) {
                // trim empty objects from the arrays
                let trimmed = value.filter(item => !isEmptyObject(item)) 
                sanitized[key] = trimmed;
            } else {
                // turn empty objects into nulls
                sanitized[key] = isEmptyObject(value) ? null : value;
            }
        }
    }

    // clean up tags, specifically
    if(!!sanitized.tags) { sanitized.tags = sanitized.tags.map(tag => tag.name)}

    return sanitized;
})

app.constant('prepForForm', function(model, templateFn) {
    if(!model) { return null }

    let template = templateFn()
    let prepped = Object.assign({}, model)

    Object.keys(template).forEach(key =>  {
        if(prepped[key] === undefined) {
            prepped[key] = template[key]
        }
    })

    // prep tags, specifically
    if(!!prepped.tags) { 
        prepped.tags = prepped.tags.map(tag => { 
            if(tag.constructor === Object && !!tag.name) { return tag }
            return {name: tag}
        })
    }

    return prepped;
})

app.service('lidCheck', function($http) {
    return function(lid, fields) {
        return new Promise(function(resolve, reject) {
            if(!!lid && lid.constructor === String && lid.split(':').length > 3 && lid.startsWith('urn:nasa')) {
                $http.get('./lookup', {params: {lid, fields}}).then(function(res) {
                    resolve(res.data)
                }, function(err) {
                    reject(err)
                })
            } else {
                reject('Invalid lid')
            }
        })
    }
})

app.service('relatedLookup', function($http) {
    return function(from, to, lid) {
        return new Promise(function(resolve, reject) {
            if(!!lid && lid.constructor === String && lid.split(':').length > 3 && lid.startsWith('urn:nasa')) {
                $http.get(`./related/${to}?${from}=${lid}`).then(function(res) {
                    resolve(res.data)
                }, function(err) {
                    reject(err)
                })
            } else {
                reject('Invalid lid')
            }
        })
    }
})

app.constant('isPopulated', (val) => val && val.length > 0)

app.controller('FormController', function($scope) {
    $scope.progress = {}
    $scope.groupRepeater = function(array) {
        if(array.length === 0 || !isEmptyObject(array.last())) {
            array.push({})
        }
        return array.filter((val, index) => { return index === array.length-1 || !isEmptyObject(val)})
    }
})

app.controller('ContextObjectImportController', function($scope, $http, sanitizer, prepForForm, lidCheck, isPopulated, existing, tags, targetRelationships, instrumentRelationships, tools) {
    $scope.tags = tags
    $scope.targetRelationships = targetRelationships
    $scope.instrumentRelationships = instrumentRelationships
    $scope.tools = tools
    $scope.config = {}
    $scope.editing = existing ? true : false

    const validate = function() {
        const object = $scope.model[$scope.config.modelName]
        
        const lidValid = isPopulated(object.logical_identifier) && object.logical_identifier.startsWith($scope.config.lidPrefix)
        const requiredFieldsPresent = $scope.config.requiredFields.every(field => isPopulated($scope.model[$scope.config.modelName][field]))
        const relationshipsHaveValues = $scope.config.relationshipModelNames.every(modelName => $scope.model[modelName].every(rel => !!rel.relationshipId))
        return lidValid ? requiredFieldsPresent ? relationshipsHaveValues ? true : 'All relationships must have types set' : 'Some required fields are missing' : 'LID does not start with ' + $scope.config.lidPrefix
    }

    const templateModel = function() {
        return {
            tags: [],
        }
    }

    $scope.submit = function() {
        let validation = validate()
        if(validation === true) {
            $scope.state.error = null;
            $scope.state.loading = true; 
            
            const object = $scope.model[$scope.config.modelName]
            verifyNew(object.logical_identifier).then(() => {
                let postablePrimary = sanitizer(object, templateModel)
                let primaryPost = $http.post($scope.config.primaryPostEndpoint, postablePrimary)
                let backendRequests = [primaryPost]
    
                let postableRelationships = []
                $scope.config.relationshipModelNames.forEach(relName => {
                    postableRelationships = postableRelationships.concat($scope.model[relName].map(rel => $scope.config.relationshipTransformer(rel, relName)))
                })
                if(postableRelationships.length > 0) {
                    backendRequests.push($http.post('./save/relationships', postableRelationships))
                }
    
                Promise.all(backendRequests).then(function(res) {
                    $scope.state.progress();
                    $scope.state.loading = false;
                }, function(err) {
                    $scope.state.error = err.data;
                    $scope.state.loading = false;
                    console.log(err);
                })
            }, error => {
                $scope.state.loading = false;
                $scope.state.error = error
                $scope.$apply()
            })
            
        } else {
            $scope.state.error = validation;
        }
    }

    let configurated = false
    $scope.$watch('config.modelName', function(modelName) {
        if(!modelName || configurated === true) return
        configurated = true

        $scope.model = {
            [modelName]: existing ? prepForForm(existing.object, templateModel) : templateModel()
        }
        $scope.config.relationshipModelNames.forEach(relName => {
            if(!$scope.model[relName]) { $scope.model[relName] = []}
            let relationships = existing ? existing.relationships.reduce((arr, rel) => $scope.config.relationshipUnpacker(arr, rel, relName), []) : []
            $scope.model[relName] = $scope.model[relName].concat(relationships)
        })
        
        if(!$scope.editing) {
            $scope.$watch(`model.${modelName}.logical_identifier`, function(lid) {
                if(!lid) { return }
                $scope.state.loading = true;
                
                verifyNew(lid).then(() => {
                    checkLid(lid)
                }, error => {
                    $scope.state.loading = false;
                    $scope.state.error = error
                    $scope.$apply()
                })
                
            })
        }
    })

    function verifyNew(lid) {
        if($scope.editing) {
            return Promise.resolve()
        }

        return new Promise((resolve, reject) => {
            $http.get('./edit/' + $scope.config.modelName, { params: { logical_identifier: lid }}).then(
                (response) => {
                    if(!!response.data && !!response.data.object) {
                        reject(`${lid} already exists. It should be edited instead of added.`)
                    } else {
                        resolve()
                    }
                }, resolve)
        })
    }

    function checkLid(lid) {
        let registryFields = $scope.config.lookupReplacements.map(replacement => replacement.registryField)
        lidCheck(lid, registryFields).then(function(doc) {
            $scope.state.loading = false;
            const replace = (scopeKey, docKey) => {
                if(!isPopulated($scope.model[$scope.config.modelName][scopeKey])) { $scope.model[$scope.config.modelName][scopeKey] = doc[docKey][0] }
            }
            $scope.config.lookupReplacements.forEach(replacement => replace(replacement.formField, replacement.registryField))
            $scope.$apply()
        }, function(err) { 
            $scope.state.loading = false;
            $scope.$apply()
            // don't care about errors
        })
    }
})

app.filter('pluralizeDumb', function() {
    return function(input) {
      return (angular.isString(input) && !input.toUpperCase().endsWith('SPACECRAFT')) ? `${input}s` : input;
    }
});