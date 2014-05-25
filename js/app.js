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
    .factory('AppService', function($q) {
      var svc = {},
        hiddenRoles = ['system', 'homescreen', 'input', 'search'];

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

        console.log('getApplications');

        getAll.onsuccess = function(event) {
          console.log('getApplications:onsuccess', event);

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
    })
    .controller('ZwipeCtrl', function($scope, $swipe, AppService) {
      var stage = Sprite3D.stage(document.querySelector("#scroller")),
        startX;

      $scope.bearing = 0;
      $scope.selected = 0;

      $swipe.bind(ng.element(stage), {
        'start': function(coords) {
          startX = coords.x;
        },
        'move': function(coords) {
          var delta = (coords.x - startX) / 16;

          $scope.bearing += delta;
          $scope.bearing = normalize($scope.bearing);

          calculateAppPositions();
        },
        'end': function(coords) {
          var length = $scope.apps.length,
            theta = (360 / length);

          $scope.selected = (Math.round($scope.bearing / theta) % length);
          $scope.bearing = $scope.selected * theta;

          calculateAppPositions();
        },
        'cancel': function(coords) {}
      });

      function calculateMovement(r, a, t) {
        return {
          x: Math.sin(r + a),
          y: (Math.sin(r + 3 * Math.PI / 2 + a) / 8) * t,
          z: -(Math.cos(r + a) + 1) / 2,
          scale: (Math.sin(r + Math.PI / 2 + a) / 2) + 0.5
        };
      }

      function normalize(degrees) {
        var inRange = degrees % 360.0;
        return (inRange < 0) ? 360 + inRange : inRange;
      }

      function calculateAppPositions() {
        var radius = 150;

        for (var i = 0, length = $scope.apps.length; i < length; i++) {
          var app = $scope.apps[i];
          var element = ng.element(app.sprite);
          var bearing = i * (360 / length);
          var angle = normalize((360 - bearing) + $scope.bearing);
          var rad = (angle * Math.PI) / 180;

          while (rad < 0) {
            rad += (Math.PI * 2);
          }

          while (rad > (Math.PI * 2)) {
            rad -= (Math.PI * 2);
          }

          var movement = calculateMovement(rad, 0, 0);

          app.sprite
            .origin((movement.x * radius) + 30, (movement.z * radius) + 30, movement.y * radius)
            .scale(movement.scale)
            .update();

          if (i === $scope.selected) {
            element.addClass('selected');
          } else {
            element.removeClass('selected');
          }
        }
      }

      AppService.getApplications().then(function(apps) {
        apps.forEach(function(app) {
          app.sprite = Sprite3D.create('.app-icon');
          app.sprite.style['background'] = 'url(' + app.iconUrl + ')';
          stage.appendChild(app.sprite);
        });

        $scope.apps = apps;
        calculateAppPositions();
      });
    });
}(angular, navigator.mozApps));
