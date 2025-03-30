#### TEMPORARY README
~~~

import { carrier } from "jsr:@addermire-guild/carrier";

// Configure once
carrier.configureBaseUrl("https://api.com");
carrier.configureAuth({ type: "bearer", token: "..." });

// Then use
await carrier.get("/data");
if (carrier.ok()) console.log(carrier.container.data);
~~~
