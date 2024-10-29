export {}

import {ccc, ClientPublicTestnet, hashTypeId, Script, Signer, SignerCkbPrivateKey, Transaction} from "@ckb-ccc/core"
import { findSpore, meltSpore, transferSpore } from "@ckb-ccc/spore";
import * as dotenv from 'dotenv';
import { COMPOSE_CELL_DEPS } from "./config";
dotenv.config();

async function decomposeNervape(shadowCellSporeID: string, nervapeSporeID: string, bundleGearSporeID: string) {
    const rpcURL = process.env.CKB_RPC_URL? process.env.CKB_RPC_URL:"https://testnet.ckbapp.dev/"
    console.log(`Using RPC: ${rpcURL}`);
    const client = new ClientPublicTestnet({
        url: rpcURL
    });
    
    const privateKey = process.env.CKB_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("CKB_PRIVATE_KEY is not set in the environment variables");
    }
    const signer = new SignerCkbPrivateKey(client, privateKey);
    const address = await signer.getRecommendedAddressObj();
    console.log(`address:${address}`);
    const lock = address.script;

    // step1, destroy shadow cell
    const destroyShadowCellTx = await meltSpore({
        signer,
        id: shadowCellSporeID,
    });


    // step 2, inject transfer gear
    // we call it decompose
    const transferSporeTx = await transferSpore({
        signer,
        id: bundleGearSporeID,
        to: lock,
        tx: destroyShadowCellTx.tx
    });

    // make sure we input the proper nervape cell
    const injectDelegateRefTx = await transferSpore({
        signer,
        id: nervapeSporeID,
        to: lock,
        tx: transferSporeTx.tx
    });

    const { tx } = injectDelegateRefTx;
    await tx.addCellDeps(COMPOSE_CELL_DEPS);

    await tx.completeFeeChangeToLock(signer, lock);

    console.log(tx.stringify());

    const signedTx = await signer.signTransaction(tx);
    const txHash = await client.sendTransaction(signedTx);
    console.log(`txHash: ${txHash}, https://testnet.explorer.nervos.org/transaction/${txHash}`);
}

async function main() {
    // The sporeID is the args field in the Type Script of the spore cell info.
    await decomposeNervape(
        "0x1ba8978da6bf76c326f994b50f97fc7372c020970f9a00f94076285f9bd2a335",
        "0x4ebc380ae48eadd747ee1a29fe555b6c9e7eba28da47027e1fc009dd5eca0807",
        "0x087c963459a8207aa114d8c8ebc2a7afe3376c5f06ba9e224bbc3057f708e4ee"
    )

    // View the result tx here: 
    // https://testnet.explorer.nervos.org/transaction/0xc645f95710d4b641bcc30b05404378da2dd13a41b435789361a0eb1375e9d8d0
}


main().then(() => {
    console.log("completed successfully.");
    process.exit(0);
}).catch((error) => {
    console.error("Unexpected error occurred:", error);
    process.exit(-1);
});
