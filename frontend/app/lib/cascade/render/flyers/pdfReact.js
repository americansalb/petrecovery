/* global __non_webpack_require__ */
/**
 * The React that @react-pdf/renderer actually runs with.
 *
 * Next bundles the app's server code against its own vendored React (19),
 * while @react-pdf/renderer is kept out of the bundle (next.config.js,
 * serverExternalPackages) and requires node_modules/react (18). An element
 * made by one is a plain object to the other, and react-pdf threw
 * "Minified React error #31" on every flyer in production while the dev
 * server, which does not vendor React for route handlers, rendered them
 * fine. So the flyer's JSX is compiled with the classic runtime against
 * `h` from here, which is createElement of the very module react-pdf
 * loads: node_modules/react, required at run time outside the bundle
 * (webpack leaves `__non_webpack_require__` as Node's own require, which
 * resolves 'react' from the built file's own node_modules chain, exactly
 * as react-pdf's require does; a plain `require('react')` here would be
 * rewritten to the vendored copy).
 */

const nodeRequire = typeof __non_webpack_require__ === 'function' ? __non_webpack_require__ : require;
const React = nodeRequire('react');

export const h = React.createElement;
export const Fragment = React.Fragment;
export default React;
