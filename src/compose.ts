export {}

import {ccc, ClientPublicTestnet, hashTypeId, Script, Signer, SignerCkbPrivateKey, Transaction} from "@ckb-ccc/core"
import { createSpore, findSpore, getSporeScriptInfo, getSporeScriptInfos, transferSpore } from "@ckb-ccc/spore";
import * as dotenv from 'dotenv';
import { COMPOSE_CELL_DEPS, SHADOWLOCK_CODEHASH } from "./config";
dotenv.config();

async function composeNervape(nervapeSporeID: string, bundleGearSporeID: string) {
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

    const delegateRef = await findSpore(client, nervapeSporeID); // the nervape cell
    console.log(`delegate ref type hash:${delegateRef?.cell.cellOutput.type?.hash()}`);
    const shadowLockArgs = `0x07${delegateRef?.cell.cellOutput.type?.hash().slice(2)}`;
    const shadowLock =  ccc.Script.from({
        codeHash: SHADOWLOCK_CODEHASH,
        args: shadowLockArgs,
        hashType: "data1",
    });
    console.log(`shadowLock: ${shadowLock.args}`);
    const createShadowSporeTx = await createSpore({ // the shadow cell
        signer,
        data: {
            contentType: "dob/1",
            content: "0x01",
        },
        to: shadowLock,
        clusterMode: "skip"
    });
    console.log(`shadow spore id:${createShadowSporeTx.id}`);

    // now generate delegate lock args from shadow cell
    const shadowLockHash = shadowLock.hash();
    console.log(`shadowLockHash: ${shadowLockHash}`);
    const delegateToShadowLockArgs = `0x00${shadowLockHash.slice(2)}`;
    const delegateToShadowLock = ccc.Script.from({
        codeHash: SHADOWLOCK_CODEHASH,
        args: delegateToShadowLockArgs,
        hashType: "data1",
    });

    const makeBundleTx = await transferSpore(
        {
            signer,
            id: bundleGearSporeID,
            to: delegateToShadowLock,
            tx: createShadowSporeTx.tx,
        }
    );

    const { tx } = makeBundleTx;
    await tx.addCellDeps(COMPOSE_CELL_DEPS);

    await tx.completeFeeChangeToLock(signer, lock);
    const signedTx = await signer.signTransaction(tx);
    const txHash = await client.sendTransaction(signedTx);
    console.log(`txHash: ${txHash}, https://testnet.explorer.nervos.org/transaction/${txHash}`);
}

async function main() {
    // The sporeID is the args field in the Type Script of the spore cell info.
    await composeNervape(
        "0x4ebc380ae48eadd747ee1a29fe555b6c9e7eba28da47027e1fc009dd5eca0807",
        "0x087c963459a8207aa114d8c8ebc2a7afe3376c5f06ba9e224bbc3057f708e4ee"
    );

    // View the result tx here: 
    // https://testnet.explorer.nervos.org/transaction/0x2e0c219502ddf04101d134af1bd2c1aba49d1669c464ce11adce916195c02792
}


main().then(() => {
    console.log("completed successfully.");
    process.exit(0);
}).catch((error) => {
    console.error("Unexpected error occurred:", error);
    process.exit(-1);
});
