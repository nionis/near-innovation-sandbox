import anyTest from "ava";
import { NEAR, Worker } from "near-workspaces";

// import { setDefaultResultOrder } from "dns";
// setDefaultResultOrder("ipv4first"); // temp fix for node >v17

/**
 *  @typedef {import('near-workspaces').NearAccount} NearAccount
 *  @type {import('ava').TestFn<{worker: Worker, accounts: Record<string, NearAccount>}>}
 */
const test = anyTest;

test.beforeEach(async (t) => {
  // Init the worker and start a Sandbox server
  const worker = (t.context.worker = await Worker.init());

  // Create accounts
  const root = worker.rootAccount;

  const alice = await root.createSubAccount("alice", {
    initialBalance: NEAR.parse("10 N").toString(),
  });
  const bob = await root.createSubAccount("bob", {
    initialBalance: NEAR.parse("10 N").toString(),
  });
  const contract = await root.createSubAccount("contract", {
    initialBalance: NEAR.parse("10 N").toString(),
  });

  // Deploy contract (input from package.json)
  await contract.deploy(process.argv[2]);

  // Save state for test runs, it is unique for each test
  t.context.worker = worker;
  t.context.accounts = { alice, bob, contract };
});

test.afterEach.always(async (t) => {
  // Stop Sandbox server
  await t.context.worker.tearDown().catch((error) => {
    console.log("Failed to stop the Sandbox:", error);
  });
});

test("Store and retrieve a proof", async (t) => {
  const { alice, contract } = t.context.accounts;

  const proofHash = "abc123hash";
  const timestamp = Date.now();

  // Store a proof
  const result = await alice.call(contract, "store", {
    proofHash,
    timestamp,
  });
  t.is(result, proofHash);

  // Retrieve the proof
  const proof = await contract.view("get", { proofHash });
  t.is(proof.timestamp, timestamp);
  t.is(proof.stored_by, alice.accountId);
});

test("Check if proof exists", async (t) => {
  const { alice, contract } = t.context.accounts;

  const proofHash = "existingProof123";
  const timestamp = Date.now();

  // Proof should not exist initially
  const existsBefore = await contract.view("exists", { proofHash });
  t.is(existsBefore, false);

  // Store the proof
  await alice.call(contract, "store", { proofHash, timestamp });

  // Proof should exist now
  const existsAfter = await contract.view("exists", { proofHash });
  t.is(existsAfter, true);
});

test("Get non-existent proof returns null", async (t) => {
  const { contract } = t.context.accounts;

  const proof = await contract.view("get", { proofHash: "nonexistent" });
  t.is(proof, null);
});

test("Multiple users can store proofs", async (t) => {
  const { alice, bob, contract } = t.context.accounts;

  const aliceProofHash = "aliceProof456";
  const bobProofHash = "bobProof789";
  const timestamp = Date.now();

  // Alice stores a proof
  await alice.call(contract, "store", {
    proofHash: aliceProofHash,
    timestamp,
  });

  // Bob stores a different proof
  await bob.call(contract, "store", {
    proofHash: bobProofHash,
    timestamp: timestamp + 1000,
  });

  // Verify Alice's proof
  const aliceProof = await contract.view("get", {
    proofHash: aliceProofHash,
  });
  t.is(aliceProof.stored_by, alice.accountId);
  t.is(aliceProof.timestamp, timestamp);

  // Verify Bob's proof
  const bobProof = await contract.view("get", { proofHash: bobProofHash });
  t.is(bobProof.stored_by, bob.accountId);
  t.is(bobProof.timestamp, timestamp + 1000);
});

test("Overwriting a proof updates stored_by and timestamp", async (t) => {
  const { alice, bob, contract } = t.context.accounts;

  const proofHash = "sharedProof";
  const timestamp1 = Date.now();
  const timestamp2 = timestamp1 + 5000;

  // Alice stores the proof first
  await alice.call(contract, "store", {
    proofHash,
    timestamp: timestamp1,
  });

  let proof = await contract.view("get", { proofHash });
  t.is(proof.stored_by, alice.accountId);
  t.is(proof.timestamp, timestamp1);

  // Bob overwrites the same proof
  await bob.call(contract, "store", { proofHash, timestamp: timestamp2 });

  proof = await contract.view("get", { proofHash });
  t.is(proof.stored_by, bob.accountId);
  t.is(proof.timestamp, timestamp2);
});
