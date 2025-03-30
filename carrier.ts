// carrier.ts

interface CarrierOptions {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    url: string;
    data?: unknown;
    headers?: Record<string, string>;
    useToken?: boolean;
    credentials?: RequestCredentials;
}

interface CarrierProfiles {
    dev?: string;
    qa?: string;
    prod?: string;
    [key: string]: string | undefined;
}

interface CarrierProfileConfig {
    env?: string;
    profiles: CarrierProfiles;
    token?: string;
}

interface CarrierContainer {
    data: unknown;
    status: number;
    raw: Response | null;
}

export class Carrier {
    public container: CarrierContainer = {
        data: null,
        status: 0,
        raw: null,
    };

    private token: string | null = null;
    private baseUrl: string = "";

    constructor() {
        // vacía por ahora, el usuario debe configurar
    }

    private inferEnv(): string {
        const hostname = globalThis.location?.hostname;
        if (hostname === "localhost") return "dev";
        if (hostname.includes("qacore")) return "qa";
        return "prod";
    }

    configureProfiles(config: CarrierProfileConfig): void {
        const env = config.env || this.inferEnv();
        const url = config.profiles[env];
        if (!url) throw new Error(`No baseUrl found for environment: ${env}`);
        this.baseUrl = url;

        if (config.token) {
            this.setToken(config.token);
        }
    }

    configure(config: { baseUrl?: string; token?: string }): void {
        if (config.baseUrl) this.baseUrl = config.baseUrl;
        if (config.token) {
            this.token = config.token;
            localStorage.setItem("token", config.token);
        }
    }

    setToken(token: string): void {
        this.token = token;
        localStorage.setItem("token", token);
    }

    async send(options: CarrierOptions): Promise<this> {
        const method = options.method || "GET";
        const headers: Record<string, string> = {
            ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
            ...options.headers,
        };

        if (options.useToken !== false && this.token) {
            headers["Authorization"] = `Bearer ${this.token}`;
        }

        const response = await fetch(this.baseUrl + options.url, {
            method,
            headers,
            credentials: options.credentials || "same-origin",
            body: method !== "GET"
                ? JSON.stringify(options.data || {})
                : undefined,
        });

        this.container.status = response.status;
        this.container.raw = response;

        try {
            this.container.data = await response.json();
        } catch (_) {
            this.container.data = null;
        }

        return this;
    }

    get(url: string): Promise<this> {
        return this.send({ method: "GET", url });
    }

    post(url: string, data?: unknown): Promise<this> {
        return this.send({ method: "POST", url, data });
    }

    ok(): boolean {
        return this.container.status >= 200 && this.container.status < 300;
    }

    check(): boolean {
        return this.ok() && this.container.data != null;
    }
}

export const carrier: Carrier = new Carrier();
