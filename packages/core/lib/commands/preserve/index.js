const { callbackify } = require("util");

const defaultPlugins = [
  "@truffle/preserve-fs",
  "@truffle/preserve-to-ipfs",
  "@truffle/preserve-to-filecoin"
];

module.exports = {
  command: "preserve",
  description:
    "Save data to decentralized storage platforms like IPFS and Filecoin",
  help: async options => {
    const Config = require("@truffle/config");
    const { Plugin } = require("@truffle/plugins");
    const { loadConstructors } = require("./plugins");

    const config = Config.detect(options);
    const plugins = Plugin.list(config, defaultPlugins);

    const { tags, constructors } = loadConstructors(plugins);

    const flags = [
      {
        option: "--environment",
        description:
          "Environment name, as defined in truffle-config `environments` object"
      }
    ];

    for (const [module, tag] of tags.recipes.entries()) {
      const option = `--${tag}`;
      const description = constructors.recipes.get(module).help;

      flags.push({
        option,
        description
      });
    }

    return {
      usage:
        "truffle preserve [--environment=<environment>] <target-path>... --<recipe-tag>",
      options: flags
    };
  },
  run: callbackify(async options => {
    const TruffleError = require("@truffle/error");
    const Config = require("@truffle/config");
    const { Plugin } = require("@truffle/plugins");
    const { loadConstructors, constructPlugins } = require("./plugins");
    const { consolePreserve } = require("@truffle/preserve");

    const config = Config.detect(options);

    const plugins = Plugin.list(config, defaultPlugins);

    const { tags, modules, constructors } = loadConstructors(plugins);

    const environments = config.environments || {};

    if (config.environment && !(config.environment in environments)) {
      throw new TruffleError(
        `Unknown environment: ${
          config.environment
        }. Check your truffle-config.js?`
      );
    }

    const environment = environments[config.environment || "development"];

    const { recipes, loaders } = constructPlugins({
      tags,
      constructors,
      environment
    });

    // check for tag in options (instead of config, for maybe extra safety)
    const tag = [...tags.recipes.values()].find(tag => tag in options);

    const recipe = modules.recipes.get(tag);

    if (!recipe) {
      throw new Error("No recipe specified");
    }

    for (const path of config._) {
      await consolePreserve({
        recipes,
        loaders,
        console: config.logger,
        request: {
          path,
          recipe
        }
      });
    }
  })
};