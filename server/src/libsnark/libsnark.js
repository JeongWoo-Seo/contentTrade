import fs from 'fs';
import Config from "../utils/config.js";
import SnarkInput from "./struct/snarkInput.js";
import { SnarkLib, SnarkLibUtils } from "./js-libsnark-opt/src/libsnark.interface.js";
import { snarkPath, crsPath} from "../config/config"

export const CircuitType = ["RegistData", "GenTrade", "AcceptTrade"];

export default class LibSnark {
    constructor(circuitType, verify=false){
        if(!circuitType in CircuitType){return undefined;}
        this.type = verify ?  "verifier" : "prover" ;
        this.CircuitType = circuitType;

        this.pk_file_path = Buffer.alloc(250); this.pk_file_path.write(crsPath+this.CircuitType+'_crs_pk.dat');
        if(verify){
            this.vk_file_path = Buffer.alloc(250); this.vk_file_path.write(crsPath+this.CircuitType+'_crs_vk.dat');
        }
        const circuit_type_buf = Buffer.alloc(30); circuit_type_buf.write(this.CircuitType);

        
        this.contextId = SnarkLib.createCircuitContext(
            circuit_type_buf, 
            Number(Config.R1CS_GG),
            Number(Config.EC_ALT_BN128),
            null, null, null
        );

        SnarkLib.serializeFormat(this.contextId, Number(Config.serializeFormat));
        SnarkLib.buildCircuit(this.contextId); // 5초
        
        if(verify) SnarkLib.readVK(this.contextId,this.vk_file_path)
        else SnarkLib.readPK(this.contextId, this.pk_file_path);
        this.getLastFunctionMsg();
    }

    uploadInputJsonStr(snarkInputJson){
        // const snarkInputJsonStr = JSON.stringify(snarkInputJson);
        const buf=Buffer.alloc(snarkInputJson.length*2); buf.write(snarkInputJson); 
        SnarkLib.updatePrimaryInputFromJson(this.contextId, buf);
    }

    runProof(proofId = ""){
        SnarkLib.runProof(this.contextId); 
        SnarkLibUtils.write_proof_json(this.contextId, snarkPath+this.CircuitType+proofId+'_proof.json');

        // const proof_file_path = Buffer.alloc(300); proof_file_path.write(fileStorePath+this.CircuitType+proofId+'_proof.dat');
        // SnarkLib.writeProof(this.contextId, proof_file_path);
    }

    uploadInputAndRunProof(snarkInputJson, proofId=""){
        this.uploadInputJsonStr(snarkInputJson);
        this.runProof(proofId);
    }

    verifyProof(snarkInputJson, proofId=""){
        if(this.type === "prover"){return undefined;}
        SnarkLibUtils.load_proof_json(
            this.contextId,
            snarkPath+this.CircuitType + proofId + "_proof.json"
        )
        this.uploadInputJsonStr(snarkInputJson);
        const verResult = SnarkLib.runVerify(this.contextId);
        return verResult;
    }

    getLastFunctionMsg(){
        console.log(SnarkLib.getLastFunctionMsg(this.contextId));
    }

    getProofJson(proofId = "") {
        try {
            const proofJson = fs.readFileSync(
                snarkPath + this.CircuitType + proofId + "_proof.json", 
                {encoding: "utf-8"}
            );
            console.log(proofJson)
            return proofJson;
        } catch (e) {
            console.log(e, "getProofJson Error !!");
            return undefined;
        }
    }
}