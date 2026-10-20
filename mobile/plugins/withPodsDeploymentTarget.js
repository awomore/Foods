// Xcode 27's SDK refuses any target below iOS 15.0, and some pods still ship
// resource-bundle targets pinned to 9.0–13.4 (SDWebImage, RNSVG, AsyncStorage,
// ReachabilitySwift, Sentry). Raise every pod target to the app's own minimum.
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const MIN_IOS = '15.1';
const MARKER = '# withPodsDeploymentTarget';

module.exports = function withPodsDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let src = fs.readFileSync(podfile, 'utf8');
      if (src.includes(MARKER)) return cfg;

      const hook = 'post_install do |installer|';
      if (!src.includes(hook)) {
        throw new Error('withPodsDeploymentTarget: no post_install block in Podfile');
      }
      src = src.replace(
        hook,
        `${hook}
    ${MARKER}
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |c|
        if c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < ${MIN_IOS}
          c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_IOS}'
        end
      end
    end`
      );
      fs.writeFileSync(podfile, src);
      return cfg;
    },
  ]);
};
