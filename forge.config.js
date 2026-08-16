const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { VitePlugin } = require('@electron-forge/plugin-vite');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    // Bundle the yt-dlp / ffmpeg binaries as extra resources so they live
    // next to the packaged app (resources/binaries) instead of inside the
    // asar archive, since they must be spawned as real executables.
    extraResource: ['resources/binaries'],
    name: 'VirPull',
    icon: 'build/icon'
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'virpull',
        setupIcon: 'build/icon.ico',
        // Space-free, predictable filename so it can be linked directly,
        // e.g. github.com/<repo>/releases/latest/download/VirPull-Setup.exe
        setupExe: 'VirPull-Setup.exe'
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32']
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {}
    },
    new VitePlugin({
      build: [
        {
          entry: 'src/main/main.js',
          config: 'vite.main.config.mjs',
          target: 'main'
        },
        {
          entry: 'src/preload/preload.js',
          config: 'vite.preload.config.mjs',
          target: 'preload'
        },
        {
          entry: 'src/preload/splash-preload.js',
          config: 'vite.splash-preload.config.mjs',
          target: 'preload'
        }
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mjs'
        },
        {
          name: 'splash_window',
          config: 'vite.splash.config.mjs'
        }
      ]
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true
    })
  ]
};
