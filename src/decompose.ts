export {}

import {ccc, ClientPublicTestnet, hashTypeId, Script, Signer, SignerCkbPrivateKey, Transaction} from "@ckb-ccc/core"
import { findSpore, meltSpore, transferSpore } from "@ckb-ccc/spore";
import * as dotenv from 'dotenv';
dotenv.config();


async function main() {
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


    const shadowCellSporeID = "0xb1fc3693cc03734b2966276fdc8d834de5821e6ef86896d65396450f447caea0";
    const codeHash = "0x6361d4b20d845953d9c9431bbba08905573005a71e2a2432e7e0e7c685666f24";

    // step1, destroy shadow cell
    const destroyShadowCellTx = await meltSpore({
        signer,
        id: shadowCellSporeID,
    });


    // step 2, inject transfer gear
    // we call it decompose
    const bundleGearSporeID = "0x3d18bb7ed80f10e2a5c98a8e44697a79091e54c081d478d3ae7863e021d527ff";

    const transferSporeTx = await transferSpore({
        signer,
        id: bundleGearSporeID,
        to: lock,
        tx: destroyShadowCellTx.tx
    });

    // make sure we input the proper nervape cell(fake)
    
    const injectDelegateRefTx = await transferSpore({
        signer,
        id: "0x5e0ebfde2891968870b57e52aa8765c39a4f389f69dd575544c7154fd9ffb899",
        to: lock,
        tx: transferSporeTx.tx
    });

    const { tx } = injectDelegateRefTx;
    await tx.addCellDeps({
        outPoint: {
            txHash: "0x2d8a311a55e42d7d6810610149f6e125f0d292112f8ed4a21177aec05da2b905",
            index: 0x0,
        },
        depType: "code",
    });

    await tx.completeFeeChangeToLock(signer, lock);

    console.log(tx.stringify());

    const signedTx = await signer.signTransaction(tx);
    const txHash = await client.sendTransaction(signedTx);
    console.log(`txHash: ${txHash}, https://testnet.explorer.nervos.org/transaction/${txHash}`);

}


main().then(() => {
    console.log("completed successfully.");
    process.exit(0);
}).catch((error) => {
    console.error("Unexpected error occurred:", error);
    process.exit(-1);
});
