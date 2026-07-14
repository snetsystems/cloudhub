import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {nodePolyfills} from 'vite-plugin-node-polyfills'
import path from 'path'
import fs from 'fs'

const fixReactVirtualized = () => {
  return {
    name: 'fix-react-virtualized',
    configResolved() {
      try {
        const file = require.resolve(
          'react-virtualized/dist/es/WindowScroller/utils/onScroll.js'
        )
        const code = fs.readFileSync(file, 'utf-8')
        const modified = code.replace(
          "import { bpfrpt_proptype_WindowScroller } from '../WindowScroller.js';",
          ''
        )
        fs.writeFileSync(file, modified)
      } catch (e) {
        // ignore if file not found
      }
    },
  }
}

const fixDslBuilder = () => {
  return {
    name: 'fix-dsl-builder',
    configResolved() {
      try {
        const file = path.resolve(
          __dirname,
          'node_modules/dsl-builder/dist/opensearch_query/kuery/ast/ast.js'
        )
        const code = fs.readFileSync(file, 'utf-8')
        const modified = code.replace(
          "const parseKuery = require('./_generated_/kuery.js').parse;",
          "import kuery from './_generated_/kuery.js';\nconst parseKuery = kuery.parse;"
        )
        fs.writeFileSync(file, modified)
      } catch (e) {
        // ignore
      }
    },
  }
}

const fixGraphql = () => {
  return {
    name: 'fix-graphql',
    enforce: 'pre' as const,
    resolveId(id: string) {
      if (id === 'graphql') {
        return path.resolve(__dirname, 'node_modules/graphql/index.js')
      }
      if (id.startsWith('graphql/')) {
        return path.resolve(__dirname, 'node_modules', id + '.js')
      }
    }
  }
}

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'classic',
      babel: {
        plugins: [
          ['@babel/plugin-proposal-decorators', { legacy: true }],
          ['@babel/plugin-proposal-class-properties', { loose: true }],
        ],
      },
    }),
    nodePolyfills(),
    fixReactVirtualized(),
    fixDslBuilder(),
    fixGraphql(),
  ],
  resolve: {
    alias: {
      src: path.resolve(__dirname, './src'),
      shared: path.resolve(__dirname, './src/shared'),
      style: path.resolve(__dirname, './src/style'),
      utils: path.resolve(__dirname, './src/utils'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        logger: {
          warn: () => {},
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
    hmr: {
      clientPort: 8443,
      protocol: 'wss',
    },
    proxy: {
      '/cloudhub/v1': {
        target: 'https://127.0.0.1:8443',
        changeOrigin: true,
        secure: false,
      },
      '/cloudhub/v2': {
        target: 'https://127.0.0.1:8443',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'build',
  },
  optimizeDeps: {
    include: [
      'mxgraph',
      '@opensearch-project/oui',
      'lodash',
      'd3',
      'moment',
      'chart.js',
      'axios',
      'react',
      'react-dom',
      'react-router',
      'react-router-redux',
      'redux',
      'graphql'
    ],
    exclude: ['react/jsx-dev-runtime', 'react/jsx-runtime'],
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
      plugins: [
        {
          name: 'fix-graphql-esbuild',
          setup(build) {
            build.onResolve({ filter: /^graphql(\/.*)?$/ }, args => {
              if (args.path === 'graphql') {
                return { path: path.resolve(__dirname, 'node_modules/graphql/index.js') }
              }
              return { path: path.resolve(__dirname, 'node_modules', args.path + '.js') }
            })
          }
        }
      ]
    },
  },
  define: {
    'process.env': {},
  },
})
