import type { Receipt } from "./index.js";

export interface IpfsClient {
  pinReceipt(receipt: Receipt): Promise<{ cid: string; url: string }>;
  fetchReceipt(cid: string): Promise<Receipt | null>;
}

export class PinataIpfsClient implements IpfsClient {
  private jwt: string;
  constructor(jwt: string) { this.jwt = jwt; }
  async pinReceipt(receipt: Receipt): Promise<{ cid: string; url: string }> {
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
    const formData = new FormData();
    formData.append("file", blob, `${receipt.nonce}.json`);
    formData.append("pinataMetadata", JSON.stringify({ name: `amanah-receipt-${receipt.nonce}`, keyvalues: { eventType: receipt.eventType } }));
    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST", headers: { Authorization: `Bearer ${this.jwt}` }, body: formData,
    });
    if (!res.ok) throw new Error(`IPFS pin failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { IpfsHash: string };
    return { cid: data.IpfsHash, url: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}` };
  }
  async fetchReceipt(cid: string): Promise<Receipt | null> {
    const res = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
    if (!res.ok) return null;
    return (await res.json()) as Receipt;
  }
}

// Default for demos and CI: no keys, deterministic CIDs, in-memory store.
export class MockIpfsClient implements IpfsClient {
  private store = new Map<string, Receipt>();
  async pinReceipt(receipt: Receipt): Promise<{ cid: string; url: string }> {
    const cid = `mock-${receipt.nonce}`;
    this.store.set(cid, receipt);
    return { cid, url: `https://mock.ipfs/${cid}` };
  }
  async fetchReceipt(cid: string): Promise<Receipt | null> {
    return this.store.get(cid) ?? null;
  }
}

export function makeIpfsClient(provider: string, opts: { pinataJwt?: string } = {}): IpfsClient {
  if (provider === "pinata" && opts.pinataJwt) return new PinataIpfsClient(opts.pinataJwt);
  return new MockIpfsClient();
}
