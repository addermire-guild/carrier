interface CarrierOptions {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    url: string;
    data?: any;
    headers?: Record<string, string>;
    useToken?: boolean;
    credentials?: RequestCredentials;
}
class Carrier {
    public container: {
        data: any;
        status: number;
        raw: Response | null;
    } = {
        data: null,
        status: 0,
        raw: null,
    };

    private token: string | null = null;
    private baseUrl: string = "";

    constructor() {
        if (globalThis.location?.hostname === "localhost") {
            this.baseUrl = "http://localhost:8080";
        } else {
            this.baseUrl = "https://mailenasistente.com";
        }

        this.token = localStorage.getItem("token");
    }

    configure(config: { baseUrl?: string; token?: string }) {
        if (config.baseUrl) this.baseUrl = config.baseUrl;
        if (config.token) {
            this.token = config.token;
            localStorage.setItem("token", config.token);
        }
    }

    setToken(token: string) {
        this.token = token;
        localStorage.setItem("token", token);
    }

    async send(options: CarrierOptions) {
        const method = options.method || "GET";
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
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

    get(url: string) {
        return this.send({ method: "GET", url });
    }

    post(url: string, data?: any) {
        return this.send({ method: "POST", url, data });
    }

    ok(): boolean {
        return this.container.status >= 200 && this.container.status < 300;
    }

    check(): boolean {
        return this.ok() && this.container.data != null;
    }
}

export const carrier = new Carrier();
