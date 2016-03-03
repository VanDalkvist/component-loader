define('path-provider.factory.js',[],function () {

    var extensions = {js: '.js', html: '.html'};

    return {
        buildProvider: function _getFormatter(formats) {
            return {
                template: _partial(_format, 'text!' + formats.template + extensions.html),
                vm: _partial(_map, formats.vm, extensions.js),
                factory: _partial(_map, formats.factory, extensions.js)
            };
        }
    };

    function _map(str, extension, map) {
        if (map.app && map.app.startsWith('/') && extension) {
            str += extension;
        }
        return _format(str, map);
    }

    function _format(format, map) {
        for (var key in map) {
            if (!map.hasOwnProperty(key)) return;

            format = format.replace(new RegExp('{' + key + '}', 'g'), map[key]);
        }

        return format;
    }

    function _partial(fn) {
        var args = Array.prototype.slice.call(arguments, 1);
        return function () {
            var newArgs = Array.prototype.slice.call(arguments);
            args.push.apply(args, newArgs);
            return fn.apply(fn, args);
        };
    }

});
define('components.settings.js',[],function () {

    return {
        formats: {
            template: '{app}/{components}/{template}/{template}.template',
            vm: '{app}/{components}/{vm}/{vm}.vm',
            factory: '{app}/{components}/{factory}/{factory}.factory'
        }
    };

});
define('component-loader.factory',[
    'require', 'path-provider.factory.js', 'components.settings.js'
], function (require, pathProviderFactory, componentsSettings) {

    var loaderBuilder = {
        buildComponentLoader: function _buildComponentLoader() {
            var pathProvider = pathProviderFactory.buildProvider(componentsSettings.formats);

            return {
                appName: 'app',
                componentsFolder: 'components',
                pathProvider: pathProvider,
                usePathProvider: function (pathProvider) {
                    var loader = this;
                    loader.pathProvider = pathProvider;
                },
                /**
                 * Create config to build component using view-model or factory
                 * @param nameConfig {string/object} if string - just use default component provider by name.
                 *   Otherwise checks arguments to containing configuration like {
                 *     app: {string}, - app name to get component from this name
                 *     vm: {string}, - use if you have a view model for your component
                 *     factory: {string}, - use if you have a factory for your component,
                 *     componentsFolder: {string} - folder where to find components, default is 'components'
                 *   }
                 * @param callback - standard knockout callback to operate with component config
                 */
                getConfig: _getConfig,
                loadViewModel: _loadViewModel
            };
        }
    };

    return loaderBuilder;

    function _getConfig(nameConfig, callback) {
        var loader = this;

        if (_isString(nameConfig)) return callback(null);

        if (!nameConfig.app && !loader.appName) {
            throw new Error(
                "You didn't provide app name as 'app' argument of name. "
                + "Cannot resolve component with name config '" + JSON.stringify(nameConfig) + "'. "
                + "Use component loader 'appName' config or set it to your component as 'app' argument of component 'name'.");
        }

        nameConfig.app = nameConfig.app ? nameConfig.app : loader.appName;

        if (!nameConfig.vm && !nameConfig.factory) {
            throw new Error(
                "You didn't provide neither 'vm' or 'factory' name. "
                + "Cannot resolve component with name config '" + JSON.stringify(nameConfig) + "'. "
                + "Use one of 'vm' or 'factory' arguments to provide view-model or factory name accordingly.");
        }

        if (!!nameConfig.vm && !!nameConfig.factory) {
            throw new Error(
                "You cannot use both of 'vm' and 'factory' arguments. Use one of them."
                + "Cannot resolve component with name config '" + JSON.stringify(nameConfig) + "'.");
        }

        var componentsFolder = nameConfig.componentsFolder ? nameConfig.componentsFolder : loader.componentsFolder;
        var formatMap = {app: nameConfig.app, vm: nameConfig.vm, components: componentsFolder};

        var config = {viewModel: {require: ''}, template: {require: ''}};

        if (nameConfig.vm) {
            config.viewModel.require = loader.pathProvider.vm(formatMap);
            config.template.require = loader.pathProvider.template(nameConfig.vm);
            return callback(config);
        }

        // build using factory
        formatMap.factory = nameConfig.factory;
        var factoryPath = loader.pathProvider.factory(formatMap);

        formatMap.template = nameConfig.factory;
        config.template.require = loader.pathProvider.template(formatMap);

        require([factoryPath], function (factory) {
            config.viewModel = {useFactory: true, factory: factory};
            callback(config);
        });
    }

    function _loadViewModel(name, viewModelConfig, callback) {
        if (viewModelConfig.useFactory !== true) return callback(null);

        callback(viewModelConfig.factory);
    }

    function _isString(obj) {
        return typeof obj == 'string'
            || Object.prototype.toString.call(obj) == '[object String]';
    }

});