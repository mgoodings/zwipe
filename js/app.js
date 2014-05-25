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
    .controller('ZwipeCtrl', function($scope, AppService) {
      $scope.offset = 0;
      $scope.move = function(value) {
        $scope.offset += value;
        calculateAppPositions();
      };

      var stage = Sprite3D.stage(document.querySelector("#container"));

      function calculateAppPositions() {
        var radius = 150;

        for (var i = 0, length = $scope.apps.length; i < length; i++) {
          var app = $scope.apps[i],
            theta = (360 / length),
            angle = (((i + $scope.offset) % length) * theta),
            radAngle = (angle / 180) * Math.PI,
            positionX = Math.sin(radAngle) * radius,
            positionY = -Math.cos(radAngle) * radius;

          app.sprite
            .origin(positionX + 30, positionY + 30)
            .rotationX(angle / 2)
            .rotationY(angle)
            .update();
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
