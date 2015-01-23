(function(ng, mozApps) {
  function DashApplication(mozApp, entryPoint) {
    this.app = mozApp;
    this.entryPoint = entryPoint;
  }
  DashApplication.prototype = {
    get manifest() {
      return this.app.manifest ? this.app.manifest : this.app.updateManifest;
    },

    get descriptor() {
      return this.entryPoint ? this.manifest.entry_points[this.entryPoint] : this.manifest;
    },

    get name() {
      return this.descriptor.name;
    },

    get role() {
      return this.manifest.role;
    },

    get desc() {
      return this.manifest.description;
    },

    get icon() {
      var i = 60;
      while (i <= 512)
      {
        if (this.descriptor.icons[i])
          return this.descriptor.icons[i];
        i += 2; <!-- Icon have often an even size number -->
      }
      return null;
      return this.descriptor.icons ? this.descriptor.icons['60'] : null;
    },

    get iconUrl() {
      return this.icon ? (this.app.origin + this.icon) : 'img/default.png';
    },

    launch: function() {
      if (this.entryPoint) {
        this.app.launch(this.entryPoint);
      } else {
        this.app.launch();
      }
    }
  };

  ng.module('zwipe', ['ngTouch'])
    .config(['$compileProvider',
      function($compileProvider) {
        $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|app):/);
        $compileProvider.imgSrcSanitizationWhitelist(/^\s*(https?|ftp|mailto|app):/);
      }
    ])
    .factory('AppService', ['$q', function($q) {
      var svc = {},
        hiddenRoles = ['theme', 'system', 'homescreen', 'input', 'search'];

      function filterApplications(applications) {
        var results = [];

        applications.forEach(function(app) {
          var dashApp = new DashApplication(app);

          if (hiddenRoles.indexOf(dashApp.role) !== -1) {
            return;
          }

          if (dashApp.manifest.entry_points) {
            for (var i in dashApp.manifest.entry_points) {
              results.push(new DashApplication(app, i));
            }
          } else {
            results.push(dashApp);
          }
        });

        return results;
      }

      svc.getApplications = function() {
        var deferred = $q.defer(),
          getAll = mozApps.mgmt.getAll();

        getAll.onsuccess = function(event) {
          console.log('getApplications:onsuccess', event);
          console.log(event.target.result[2].manifest.icons);
          var apps = filterApplications(event.target.result);
          deferred.resolve(apps);
        };

        getAll.onerror = function(err) {
          console.log('getApplications:err', err);

          deferred.reject(err);
        };

        return deferred.promise;
      };

      return svc;
    }])
    .controller('ZwipeCtrl', ['$scope', '$swipe', 'AppService', function($scope, $swipe, AppService) {
      function calculateMovement(r, a, t) {
        return {
          x: Math.sin(r + a),
          y: (Math.sin(r + 3 * Math.PI / 2 + a) / 8) * t,
          z: (Math.cos(r + a) + 1) / 2,
          scale: (Math.sin(r + Math.PI / 2 + a) / 2) + 0.5
        };
      }

      function normalize(degrees) {
        var inRange = degrees % 360.0;
        return (inRange < 0) ? 360 + inRange : inRange;
      }

      var stage = document.querySelector('#spinner'), startX;

      $scope.acceleration = 0;
      $scope.bearing = 0;
      $scope.selected = 0;
      $scope.plop = 0;

      $scope.appStyle = function(index, length) {
        var radiusX = 180, radiusY = 200, radiusZ = -100;
        var bearing = index * (360 / length);
        var originX = 0,
            originY = 0,
            originZ = 0,
            rotationX = 0,
            rotationY = 0,
            rotationZ = 0,
            scaleX = 1.0,
            scaleY = 1.0,
            scaleZ = 1;

        var angle = normalize((360 - bearing) + $scope.bearing);
        var rad = (angle * Math.PI) / 180;
        while (rad < 0) {
          rad += (Math.PI * 2);
        }

        while (rad > (Math.PI * 2)) {
          rad -= (Math.PI * 2);
        }

        var movement = calculateMovement(rad, 0, 0);

        originX = (movement.x * radiusX) - 30;
        originY = (movement.z * radiusY) - 30;
        originZ = radiusZ;
        scaleX = scaleY = scaleZ = movement.scale;

        var transform = [
          'translate3d(', originX, 'px,', originY, 'px,', originZ, 'px) ',
          'rotateX(', rotationX, 'deg) ',
          'rotateY(', rotationY, 'deg) ',
          'rotateZ(', rotationZ, 'deg) ',
          'scale3d(', scaleX, ',', scaleY, ',', scaleZ, ')'
        ];

        $scope.plop += 1;
        return {
          'transform': transform.join('')
        };
      };

      $swipe.bind(ng.element(stage), {
        'start': function(coords) {
          startX = coords.x;
        },
        'move': function(coords) {
          var delta = (coords.x - startX) / 32;

          $scope.$apply(function() {
            $scope.bearing += delta;
            $scope.bearing = normalize($scope.bearing);
          });
        },
        'end': function(coords) {
          var length = $scope.apps.length,
            theta = (360 / length);

          $scope.$apply(function() {
            $scope.selected = (Math.round($scope.bearing / theta) % length);
            $scope.bearing = $scope.selected * theta;
          });
        },
        'cancel': function(coords) {}
      });

      AppService.getApplications().then(function(apps) {
        $scope.apps = apps;
      });
    }]);
}(angular, navigator.mozApps));
