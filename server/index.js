import server from "./src/server";
import {initContract} from "./src/contract/deploy";

await initContract();
server();