/**
 * tokenBridge — a tiny module that acts as a bridge between the Zustand
 * auth store and the Axios instance, breaking the circular dependency.
 *
 * The store sets the getter; Axios reads it.
 */

let _getToken = () => null;
let _logout = () => {};
let _setToken = (_t) => {};

export const setTokenGetter = (fn) => { _getToken = fn; };
export const setLogoutFn    = (fn) => { _logout  = fn; };
export const setTokenSetter = (fn) => { _setToken = fn; };

export const getToken  = () => _getToken();
export const doLogout  = () => _logout();
export const setToken  = (t) => _setToken(t);
