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
    Safe, auditable, and private AI for goverments.
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

It's always striking how the most transformative technologies are adopted last by governments.<br/>
Every day, millions of public officials collectively waste countless hours on repetitive, menial tasks that could be dramatically streamlined or even eliminated with the right tools.<br/>
While some individual employees may quietly use large language models (LLMs) to boost their personal productivity, this approach lacks transparency: there's no record of how AI was applied, which model was used, what prompts were given, or how decisions were influenced.
<br/><br/>
_AttestAI_ is an attempt toward integrating large language models (LLMs) openly and transparently into the machinery of governance.
<br />
Using [NEAR AI private inference](https://www.near.org/ai), printable QR proofs, and auditable chat receipts, we aim to bridge the gap between LLMs and real world use cases.

### Download

### Features

- **Private Inference**: E2EE is always on, using NEAR AI's most private models
- **Verify QR codes**: Attach QR references to your documents for auditable LLM use
- **Share**: You may share encrypted conversations which require a passphrase to be unlocked.
- **Local Embeddings**: Your documents remain on-device
- **Custom Assistants**: Create specialized AI assistants for your tasks
- **Privacy First**: Tailored for privacy preserving requirements

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
