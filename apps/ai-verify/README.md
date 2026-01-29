# AI Verify

A CLI tool that verifies AI-generated outputs with cryptographic receipts. Proves that **M (model) + P (prompt) + C (content) = O (output)** using NEAR AI's TEE-backed attestations.

## How It Works

1. **Generate**: Send your prompt and content to NEAR AI Private Inference (running in a TEE)
2. **Receive**: Get AI output + cryptographic signature from the TEE
3. **Anchor**: Store proof hash on NEAR blockchain for immutable verification
4. **Verify**: Anyone can verify the receipt against the TEE attestation and blockchain

## Quick Start

### 1. Install Dependencies

```bash
cd ai-verify
npm install
npm run build
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required:

- `NEARAI_CLOUD_API_KEY` - Get from [cloud.near.ai](https://cloud.near.ai)

Optional (for on-chain anchoring):

- `NEAR_ACCOUNT_ID` - Your NEAR testnet/mainnet account
- `NEAR_PRIVATE_KEY` - Account private key (ed25519:...)
- `NEAR_NETWORK` - `testnet` or `mainnet`
- `PROOF_CONTRACT_ID` - Deployed proof storage contract

### 3. Generate a Verifiable AI Output

```bash
# Simple prompt
npx ai-verify generate \
  --model "deepseek-ai/DeepSeek-V3.1" \
  --prompt "Explain quantum computing in one sentence" \
  --output receipt.json

# With content/source material
npx ai-verify generate \
  --model "deepseek-ai/DeepSeek-V3.1" \
  --prompt "Summarize this document" \
  --content-file ./document.txt \
  --output receipt.json
```

### 4. Verify a Receipt

```bash
npx ai-verify verify --receipt receipt.json
```

## Commands

### `generate`

Generate AI output with a verifiable receipt.

```
Options:
  -m, --model <model>        Model to use (e.g., deepseek-ai/DeepSeek-V3.1)
  -p, --prompt <prompt>      Prompt to send to the model
  -c, --content <text>       Content/context to include with the prompt
  -f, --content-file <path>  File containing content/context
  -o, --output <path>        Output file for the receipt
  --skip-on-chain            Skip storing proof on NEAR blockchain
```

### `verify`

Verify a receipt against TEE attestation and blockchain.

```
Options:
  -r, --receipt <path>  Path to the receipt JSON file
  --skip-on-chain       Skip on-chain verification
```

## Receipt Format

```json
{
  "version": "1.0",
  "timestamp": "2026-01-28T12:00:00Z",
  "model": "deepseek-ai/DeepSeek-V3.1",
  "prompt": "Summarize this document",
  "contentFile": "./document.txt",
  "requestHash": "b524f8f4b611b43526aa988c636cf1d7e72aa661876c3d969e2c2acae125a8ba",
  "responseHash": "aae79d9de9c46f0a9c478481ceb84df5742a88067a6ab8bac9e98664d712d58f",
  "signature": "0x649b30be41e53ac33cb3fe414c8f5fd30ad72cacaeac0f41c4977fee4b67506e...",
  "signingAddress": "0x319f1b8BB3b723A5d098FFB67005Bdf7BB579ACa",
  "output": "The summarized content...",
  "onChain": {
    "network": "testnet",
    "txHash": "8x7y6z...",
    "contractId": "ai-verify.testnet",
    "proofHash": "..."
  }
}
```

## Smart Contract

The `contract/` directory contains a simple NEAR smart contract for storing proof hashes on-chain.

### Build the Contract

```bash
cd contract
npm install
npm run build
```

### Deploy

```bash
near deploy --accountId your-contract.testnet --wasmFile build/contract.wasm
```

## Verification Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. User Input                                              │
│     ├─ Model: deepseek-ai/DeepSeek-V3.1                    │
│     ├─ Prompt: "Summarize this"                            │
│     └─ Content: [document text]                            │
├─────────────────────────────────────────────────────────────┤
│  2. NEAR AI Private Inference (TEE)                        │
│     ├─ Request hashed (SHA256)                             │
│     ├─ AI inference executed in secure enclave             │
│     ├─ Response hashed (SHA256)                            │
│     └─ TEE signs: request_hash:response_hash               │
├─────────────────────────────────────────────────────────────┤
│  3. On-Chain Anchoring                                     │
│     └─ Proof hash stored on NEAR blockchain                │
├─────────────────────────────────────────────────────────────┤
│  4. Receipt Generated                                      │
│     ├─ Request hash                                        │
│     ├─ Response hash                                       │
│     ├─ TEE signature (ECDSA)                               │
│     ├─ Signing address                                     │
│     └─ On-chain transaction hash                           │
└─────────────────────────────────────────────────────────────┘
```

## Security Guarantees

When verification passes, you have cryptographic proof that:

- **Trusted Hardware**: The AI model ran in a verified TEE
- **Data Integrity**: Request and response haven't been tampered with
- **Authenticity**: Response was signed by the verified TEE
- **Immutability**: Proof is anchored on NEAR blockchain

## License

MIT
