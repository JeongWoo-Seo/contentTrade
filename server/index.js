import server from "./src/server";
import {deploy} from "./src/contract/deploy";

await deploy();
server();