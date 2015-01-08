/**
 * This is a manifest file that will be compiled into application, which will
 * include all the files listed below.
 *
 * Any JavaScript file within this directory can be referenced here using a
 * relative path.
 *
 * It's not advisable to add code directly here, but if you do, it will appear
 * at the bottom of the compiled file.
 *
 * If you are planning to include all custom JavaScript inside main then
 * you don't have touch this file at all, otherwise "require" additional
 * scripts down below using //= filename notation.
 */

//= require lib/jquery-2.1.1.min
//= require lib/bootstrap.min

//= require bower_components/angular/angular
//= require bower_components/angular-animate/angular-animate
//= require bower_components/angular-route/angular-route
//= require bower_components/angular-sanitize/angular-sanitize
//= require bower_components/bootstrap/dist/js/bootstrap
//= require bower_components/toastr/toastr
//= require bower_components/moment/moment
//= require bower_components/extras.angular.plus/ngplus-overlay

//= require app/app.module
//= require app/blocks/exception/exception.module
//= require app/blocks/exception/exception-handler
//= require app/blocks/exception/exception
//= require app/blocks/logger/logger.module
//= require app/blocks/logger/logger
//= require app/blocks/router/router.module
//= require app/blocks/router/routehelper

//= require app/core/core.module
//= require app/core/constants
//= require app/core/config
//= require app/core/dataservice

//= require app/layout/layout.module
//= require app/layout/shell
//= require app/layout/sidebar

//= require app/widgets/widgets.module
//= require app/widgets/ccSidebar
//= require app/widgets/ccSpinner
//= require app/widgets/ccWidgetClose
//= require app/widgets/ccWidgetHeader
//= require app/widgets/ccWidgetMinimize

//= require app/dashboard/dashboard.module
//= require app/dashboard/config.route
//= require app/dashboard/dashboard

//= require app/admin/admin.module
//= require app/admin/config.route
//= require app/admin/admin

//= require main