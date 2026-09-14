let accountGeneration = 0

export interface NativeAsyncScope {
    accountGeneration: number
    conversationType: string | number
    conversationId: string | number
    viewGeneration?: number
}

export function captureNativeAccountGeneration(): number {
    return accountGeneration
}

export function isNativeAccountGenerationCurrent(generation: number): boolean {
    return generation === accountGeneration
}

export function invalidateNativeAccountGeneration(): void {
    accountGeneration++
}

export function runForNativeAccount(generation: number, callback: () => void): void {
    if (isNativeAccountGenerationCurrent(generation)) callback()
}

export function captureNativeAsyncScope(
    conversationType: string | number,
    conversationId: string | number,
    viewGeneration?: number,
): NativeAsyncScope {
    return {
        accountGeneration: captureNativeAccountGeneration(),
        conversationType,
        conversationId,
        viewGeneration,
    }
}

export function isNativeAsyncScopeCurrent(
    scope: NativeAsyncScope,
    conversationType: string | number,
    conversationId: string | number,
    viewGeneration?: number,
): boolean {
    if (!isNativeAccountGenerationCurrent(scope.accountGeneration)) return false
    if (String(scope.conversationType) !== String(conversationType)) return false
    if (String(scope.conversationId) !== String(conversationId)) return false
    return scope.viewGeneration === undefined ||
        viewGeneration === undefined ||
        scope.viewGeneration === viewGeneration
}
