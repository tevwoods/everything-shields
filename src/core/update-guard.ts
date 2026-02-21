export class UpdateGuard {
    private static updating = new Set<string>();

    public static isUpdating(id: string): boolean {
        return UpdateGuard.updating.has(id);
    }

    public static markStart(id: string): void {
        UpdateGuard.updating.add(id);
    }

    public static markEnd(id: string): void {
        UpdateGuard.updating.delete(id);
    }

    public static async runExclusive<T>(id: string, fn: () => Promise<T>): Promise<T> {
        if (UpdateGuard.isUpdating(id)) {
            // Already updating; just run but do not re-mark
            return fn();
        }
        UpdateGuard.markStart(id);
        try {
            return await fn();
        } finally {
            UpdateGuard.markEnd(id);
        }
    }
}
