// carrier.ts

interface CarrierOptions {
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
    url: string;
    data?: unknown;
    headers?: Record<string, string>;
    useToken?: boolean;
    credentials?: RequestCredentials;
    auth?: CarrierAuthConfig;
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

type CarrierHookEvent =
    | "request"
    | "response"
    | "ok"
    | "error"
    | "get"
    | "post"
    | "put"
    | "delete"
    | "patch";

type CarrierHook = (...args: unknown[]) => void;

type CarrierAuthConfig =
    | { type: "bearer"; token: string }
    | { type: "basic"; username: string; password: string }
    | { type: "apikey"; key: string; value: string; in: "header" | "query" };

export class Carrier {
    public container: CarrierContainer = {
        data: null,
        status: 0,
        raw: null,
    };

    private token: string | null = null;
    private baseUrl: string = "";
    private globalAuth: CarrierAuthConfig | null = null;
    private hooks: Partial<Record<CarrierHookEvent, CarrierHook[]>> = {};

    constructor() {}

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

    configureBaseUrl(url: string): void {
        this.baseUrl = url;
    }

    configureToken(token: string): void {
        this.setToken(token);
    }

    configureAuth(auth: CarrierAuthConfig): void {
        this.globalAuth = auth;
    }

    setToken(token: string): void {
        this.token = token;
        localStorage.setItem("token", token);
    }

    on(event: CarrierHookEvent, callback: CarrierHook): void {
        if (!this.hooks[event]) {
            this.hooks[event] = [];
        }
        this.hooks[event]?.push(callback);
    }

    private trigger(event: CarrierHookEvent, ...args: unknown[]): void {
        this.hooks[event]?.forEach((cb) => cb(...args));
    }

    private applyAuth(headers: Record<string, string>, auth?: CarrierAuthConfig, url?: string): string {
        const chosen = auth || this.globalAuth;
        if (!chosen) return url || "";

        switch (chosen.type) {
            case "bearer":
                headers["Authorization"] = `Bearer ${chosen.token}`;
                break;
            case "basic": {
                const encoded = btoa(`${chosen.username}:${chosen.password}`);
                headers["Authorization"] = `Basic ${encoded}`;
                break;
            }
            case "apikey":
                if (chosen.in === "header") {
                    headers[chosen.key] = chosen.value;
                } else if (chosen.in === "query" && url) {
                    const separator = url.includes("?") ? "&" : "?";
                    url += `${separator}${chosen.key}=${encodeURIComponent(chosen.value)}`;
                }
                break;
        }

        return url || "";
    }

    private resolveUrl(requestUrl: string): string {
        const isAbsolute = requestUrl.startsWith("http://") || requestUrl.startsWith("https://");
        return isAbsolute ? requestUrl : (this.baseUrl || "") + requestUrl;
    }

    async send(options: CarrierOptions): Promise<this> {
        const method = options.method || "GET";
        const userHeaders = options.headers ?? {};
        const headers: Record<string, string> = {
            ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
            ...userHeaders,
        };

        if (options.useToken !== false && this.token && !headers["Authorization"]) {
            headers["Authorization"] = `Bearer ${this.token}`;
        }
        

        this.trigger("request", options);
        if (method === "GET") this.trigger("get", options.url);
        if (method === "POST") this.trigger("post", options.url, options.data);
        if (method === "PUT") this.trigger("put", options.url, options.data);
        if (method === "DELETE") this.trigger("delete", options.url, options.data);
        if (method === "PATCH") this.trigger("patch", options.url, options.data);

        let fullUrl = this.resolveUrl(options.url);
        fullUrl = this.applyAuth(headers, options.auth, fullUrl);

        const response = await fetch(fullUrl, {
            method,
            headers,
            credentials: options.credentials || "same-origin",
            body: method !== "GET" && method !== "HEAD"
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

        this.trigger("response", response);
        if (this.ok()) {
            this.trigger("ok", response);
        } else {
            this.trigger("error", response);
        }

        return this;
    }

    get(url: string): Promise<this> {
        return this.send({ method: "GET", url });
    }

    post(url: string, data?: unknown): Promise<this> {
        return this.send({ method: "POST", url, data });
    }

    put(url: string, data?: unknown): Promise<this> {
        return this.send({ method: "PUT", url, data });
    }

    delete(url: string, data?: unknown): Promise<this> {
        return this.send({ method: "DELETE", url, data });
    }

    patch(url: string, data?: unknown): Promise<this> {
        return this.send({ method: "PATCH", url, data });
    }

    options(url: string): Promise<this> {
        return this.send({ method: "OPTIONS", url });
    }

    head(url: string): Promise<this> {
        return this.send({ method: "HEAD", url });
    }

    ok(): boolean {
        return this.container.status >= 200 && this.container.status < 300;
    }

    check(): boolean {
        return this.ok() && this.container.data != null;
    }
}

export const carrier: Carrier = new Carrier();
