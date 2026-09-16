import rome from 'rome'
import moment from 'moment'

/**
 * rome's own entry (src/rome.moment.js) ends with `rome.use(require('moment'))`,
 * which is what fills in the `momentum.moment` the calendar calls all over.
 *
 * Vite pre-bundles moment as an ES module whose only export is `default`, so
 * when esbuild converts it back for rome's CommonJS `require` the result is the
 * namespace object `{default: moment}` rather than the callable. rome then
 * stores that object and every `momentum.moment()` throws "momentum.moment is
 * not a function" the moment a calendar mounts.
 *
 * Running `use` again with the function the app itself imports repairs it.
 * `use` is a plain assignment, so this is a no-op wherever the interop already
 * handed rome the right value.
 *
 * Import rome from here rather than from 'rome' directly.
 */
rome.use(moment)

export default rome
