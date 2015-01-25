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


    get icon() {
      var i = 60;
      while (i <= 512)
      {
        if (this.descriptor.icons[i])
          return this.descriptor.icons[i];
        i += 2; <!-- Icon have often an even size number -->
      }
      return null;
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

    .factory('DateFactory', ['$q', function($q) {
      var now = new Date();

      monthTitle = function(month) {
        var text = ['January', 'February', 'March', 'April', 'May', 'June',
          'July', 'Augunst', 'September', 'October', 'November', 'December'];
          return text[month];
      };

        var factory = {
          date: {
            hour: now.getHours(),
            minute: now.getMinutes(),
            day: now.getDate(),
            month: monthTitle(now.getMonth()),
            year: now.getFullYear()
          }
        };

        factory.getDate = function(){
          return factory.date;
        };
        return factory;
    }])

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
    .controller('ZwipeCtrl', ['$scope', '$swipe', 'AppService', 'DateFactory', function($scope, $swipe, AppService, DateFactory) {

      function calculateMovement(r) {
        return {
          x: Math.sin(r),
          y: (Math.sin(r + 3 * Math.PI / 2) / 8),
          z: (Math.cos(r) + 1) / 2,
          scale: (Math.sin(r + Math.PI / 2) / 2) + 0.5
        };
      }

      function normalize(degrees) {
        var inRange = degrees % 360.0;
        return (inRange < 0) ? 360 + inRange : inRange;
      }

      var stage = document.querySelector('#spinner'), startX;
      <!-- stage is a variable containing the content of 'spinner', used by ngTouch -->

      $scope.acceleration = 0;
      $scope.bearing = 0;
      $scope.selected = 0;

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

        var movement = calculateMovement(rad);

        originX = (0.9 * movement.x * radiusX)- 30;
        originY = (0.6 * movement.z * radiusY) + 20;
        originZ = radiusZ;
        scaleX = scaleY = scaleZ = movement.scale;

        var transform = [
          'translate3d(', originX, 'px,', originY, 'px,', originZ, 'px) ',
          'rotateX(', rotationX, 'deg) ',
          'rotateY(', rotationY, 'deg) ',
          'rotateZ(', rotationZ, 'deg) ',
          'scale3d(', scaleX, ',', scaleY, ',', scaleZ, ')'
        ];

        return {
          'transform': transform.join('')
        };
      };

      <!-- We ask AngularJS to watch 'stage' for event and acts depending of what happening -->
      $swipe.bind(ng.element(stage), {
        'start': function(coords) {
          startX = coords.x;
        },
        'move': function(coords) {
          var delta = (coords.x - startX) / 32;

          $scope.bearing += delta;
          $scope.bearing %= 360;
          if ($scope.bearing < 0)
            $scope.bearing += 360
        },
        'end': function(coords) {
            var theta = (360 / $scope.apps.length);

          $scope.$apply(function() {
            $scope.selected = (Math.round($scope.bearing / theta) % $scope.apps.length);
            $scope.bearing = $scope.selected * theta;
          });
        },
        'cancel': function(coords) {
          <!-- We can use this event is user is scrolling down or up -->
        }
      });

      AppService.getApplications().then(function(apps) {
        $scope.apps = apps;
      });
      $scope.date = DateFactory.getDate();
    }]);
}(angular, navigator.mozApps));
