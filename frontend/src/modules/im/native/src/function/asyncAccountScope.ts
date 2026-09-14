let accountGeneration = 0

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
