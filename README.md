<div align="center">
    <img
      src="./docs/logo.png"
      alt="AttestAI"
      height="64"
    />
  <h3>
    <b>
      AttestAI
    </b>
  </h3>
  <b>
    Safe, auditable, and private AI for governments.
  </b>
  <p>

[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen?logo=github)](https://github.com/nionis/near-innovation-sandbox/pulls)

  </p>
  <p>
    <sub>
      Built with ❤︎ by
      <a href="https://github.com/nionis">
        nioni
      </a>
    </sub>
  </p>
</div>

https://github.com/user-attachments/assets/00c9374c-a718-4e21-82a6-71e977e8b64a

It's always striking how the most transformative technologies are adopted last by governments.<br/>
Every day, millions of public officials collectively waste countless hours on repetitive, menial tasks that could be dramatically streamlined or even eliminated with the right tools.<br/>
While some individual employees may quietly use large language models (LLMs) to boost their personal productivity, this approach lacks transparency: there's no record of how AI was applied, which model was used, what prompts were given, or how decisions were influenced.
<br/><br/>
_AttestAI_ is an attempt toward integrating large language models (LLMs) openly and transparently into the machinery of governance.
<br />
Using [NEAR AI private inference](https://www.near.org/ai), printable QR proofs, and auditable chat receipts, we aim to bridge the gap between LLMs and real world use cases.

## Download

<table>
  <tr>
    <td><b>Platform</b></td>
    <td><b>Download</b></td>
  </tr>
  <tr>
    <td><b>Windows</b></td>
    <td><a href='https://github.com/nionis/near-innovation-sandbox/releases/download/0.0.1/AttestAI-nightly_0.0.1_x64-setup.exe'>attestai.exe</a></td>
  </tr>
  <tr>
    <td><b>macOS</b></td>
    <td><a href='https://github.com/nionis/near-innovation-sandbox/releases/download/0.0.1/AttestAI-nightly_0.0.1_universal.dmg'>attestai.dmg</a></td>
  </tr>
  <tr>
    <td><b>Linux (deb)</b></td>
    <td><a href='https://github.com/nionis/near-innovation-sandbox/releases/download/0.0.1/AttestAI-nightly_0.0.1_amd64.deb'>attestai.deb</a></td>
  </tr>
  <tr>
    <td><b>Linux (AppImage)</b></td>
    <td><a href='https://github.com/nionis/near-innovation-sandbox/releases/download/0.0.1/AttestAI-nightly_0.0.1_amd64.AppImage'>attestai.AppImage</a></td>
  </tr>
</table>

### Features

- **Private Inference**: E2EE is always on, using NEAR AI's most private models
- **Verify QR codes**: Attach QR references to your documents for auditable LLM use
- **Share**: You may share encrypted conversations which require a passphrase to be unlocked
- **Local Embeddings**: Your documents remain on-device
- **Custom Assistants**: Create specialized AI assistants for your tasks
- **Privacy First**: Tailored for privacy preserving requirements

#### Why audits are essential for public sector AI?

Public sector adoption of LLMs is severely limited today, not just by lack of auditability (no transparent record of prompts, models, or influence on decisions), but also by missing privacy guarantees and bias/unbias assurances.

AttestAI addresses this head-on using NEAR AI's private inference:

- Every interaction runs inside Trusted Execution Environments (TEEs) with hardware-backed isolation (Intel TDX / NVIDIA Confidential Computing).
- Prompts, content, and outputs remain confidential, inaccessible to the cloud provider, model host, or even NEAR AI.
- Cryptographic attestation provides verifiable proof that execution occurred in a genuine, unmodified secure enclave.
- This combination enables high-trust use cases (e.g., processing citizen PII, internal policy drafts, legal reviews) where standard hosted AI would be non-compliant or risky.
- Auditability is built-in via signed receipts, making AI usage transparent and accountable without compromising privacy.
- For bias concerns: users can inspect prompts/responses locally and identify which models were used.

Without these verified confidentiality properties, governments cannot responsibly integrate AI into daily workflows. AttestAI makes privacy the default and the enabler of safe, auditable public-sector AI.

#### Why QR codes?

QR codes serve a dual purpose tailored to government realities:

- Physical world bridge: Officials can print and attach QR codes directly to paper documents (still dominant in many public administrations), creating a permanent, scannable link to the AI provenance.
- Verifiable digital trail: Each QR encodes a reference to an encrypted blob containing the full conversation history, signed receipt, and cryptographic attestation report from the TEE.

QR code generation and attachment features were added explicitly after direct conversations with students at the University of Nicosia.

#### Data Ownership & Controls

- All documents, embeddings, and local chats remain on-device (local vector store, no automatic upload).
- Inspect: View full conversation history, embeddings, and metadata directly in the app.
- Export: Download conversations as JSON or PDF (with embedded QR proof when generated).
- Delete: One-click per-conversation or bulk deletion; wiped from local storage.
- Share (optional): If a user chooses to share a conversation (e.g., for collaboration or audit):
- An encrypted blob is uploaded to a simple web server (user controls the link/passphrase).
- No plaintext data is ever stored server-side.
- Revoke / Delete: User can delete the blob from the server at any time (via app or direct link), rendering shares invalid.

No persistent central database; sharing is opt-in and ephemeral by design.
For any on-chain elements (ex: attestation notarization hashes in /contracts/), only public metadata is recorded—sensitive content stays off-chain.

### Breakdown

```
near-innovation-sandbox/
├── apps/
│ ├── attest-app/ # main application, based of Jan
| └── ..
├── contracts/
│ └── attestations/ # for notorizing documents
├── packages/
│ ├── attestations/ # attestation utilities library
│ ├── near-ai-provider/ # NEAR AI integration library
| └── ..
```

## Build from Source

For those who enjoy the scenic route:

### Prerequisites

- Node.js ≥ 20.0.0
- Yarn ≥ 1.22.0
- Make ≥ 3.81
- Rust (for Tauri)

### Run with Make

```bash
git clone https://github.com/nionis/near-innovation-sandbox
cd near-innovation-sandbox
yarn install
yarn build
cd apps/attest-app
make dev
```

This handles everything: installs dependencies, builds core components, and launches the app.

**Available make targets:**

- `make dev` - Full development setup and launch
- `make build` - Production build
- `make test` - Run tests and linting
- `make clean` - Delete everything and start fresh

### Manual Commands

```bash
yarn install
yarn build:tauri:plugin:api
yarn build:core
yarn dev
```

## System Requirements

**Minimum specs for a decent experience:**

- **macOS**: 13.6+ (8GB RAM for 3B models, 16GB for 7B, 32GB for 13B)
- **Windows**: 10+ with GPU support for NVIDIA/AMD/Intel Arc
- **Linux**: Most distributions work, GPU acceleration available

## License

Apache 2.0 - Because sharing is caring.

## Acknowledgements

Built on the shoulders of giants:

- [Jan](https://github.com/janhq/jan)
- [NearAI](https://docs.near.ai/)
- [Llama.cpp](https://github.com/ggerganov/llama.cpp)
- [Tauri](https://tauri.app/)
- [Scalar](https://github.com/scalar/scalar)

## Roadmap

- [] use [nova](https://nova-sdk.com/) for file hosting
- [] intergrate to NEAR AI using NEAR social (whenever it's supported)
- [] import files
