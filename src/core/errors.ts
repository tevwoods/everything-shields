export class ShieldError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ShieldError';
    }
}

export class RuneError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RuneError';
    }
}

export function handleError(error: Error): void {
    console.error(`[Everything Shields] ${error.name}: ${error.message}`);
    ui?.notifications?.error(`Everything Shields: ${error.message}`);
}