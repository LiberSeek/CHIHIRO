/*
 * Runtime compatibility boundary.
 *
 * New backend modules should import Runtime through this path. The concrete
 * implementation remains in apps/runtime until its files can be moved as a
 * cohesive unit without breaking the local QQ/NapCat lifecycle.
 */
export { createRuntime } from '../../../apps/runtime/src/api.mjs'
export { createQqRuntime } from '../../../apps/runtime/src/qq-napcat.mjs'
export { createAstrbotRuntime } from '../../../apps/runtime/src/astrbot.mjs'
export { createAccountStore } from '../../../apps/runtime/src/accounts.mjs'
