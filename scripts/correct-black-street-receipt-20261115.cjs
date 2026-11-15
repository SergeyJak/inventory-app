"use strict";

// One-time production inventory correction approved by the owner on 2026-11-15.
// Never runs for preview/staging environments. Designed for a single Railway
// pre-deploy invocation; safe if Railway retries a deployment.
const { MongoClient } = require("mongodb");

const PRODUCTION_ENVIRONMENT_ID = "2442c956-dbf2-4a43-b30c-9c3939e374d6";
const CORRECTION_ID = "fix-20261115-mwi76p9rqchmg";
const MAX_ID = "mp9g897j";
const STREET_ID = "mp9g899n";
const TRANSACTION_ID = "mwi76p9rqchmg";
const LOT = { qty: 2, buyPrice: 102, date: "2026-11-15" };

async function correctInventory() {
  if (process.env.RAILWAY_ENVIRONMENT_ID !== PRODUCTION_ENVIRONMENT_ID) {
    console.log("[inventory-correction] SKIP: not the intended production environment");
    return;
  }
  if (!process.env.MONGODB_URI) throw new Error("Missing MongoDB connection");

  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db("inventory");
    try {
      await db.createCollection("inventoryCorrectionBackups");
    } catch (error) {
      if (error.code !== 48) throw error;
    }

    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        const products = db.collection("products");
        const transactions = db.collection("transactions");
        const max = await products.findOne({ id: MAX_ID }, { session });
        const street = await products.findOne({ id: STREET_ID }, { session });
        const receipt = await transactions.findOne({ id: TRANSACTION_ID }, { session });
        if (!max || !street || !receipt) throw new Error("Missing expected records");

        const hasLot = lots => JSON.stringify(lots) === JSON.stringify([LOT]);
        if (max.productType !== "Max" || max.color !== "Чёрный"
          || street.productType !== "Street" || street.color !== "Чёрный"
          || receipt.type !== "restock" || receipt.qty !== 2
          || receipt.price !== 102 || receipt.total !== 204) {
          throw new Error("Unexpected product or receipt details");
        }

        if (Array.isArray(max.lots) && max.lots.length === 0 && hasLot(street.lots)
          && receipt.productId === STREET_ID && receipt.productLabel === "Street / Чёрный") {
          console.log("[inventory-correction] ALREADY_APPLIED");
          return;
        }
        if (!hasLot(max.lots) || !Array.isArray(street.lots) || street.lots.length !== 0
          || max.arrivalDate !== LOT.date
          || receipt.productId !== MAX_ID || receipt.productLabel !== "Max / Чёрный") {
          throw new Error("Inventory has changed; no correction was applied");
        }

        await db.collection("inventoryCorrectionBackups").insertOne({
          _id: CORRECTION_ID,
          reason: "15 Nov 2026 receipt recorded against Max black instead of Street black",
          capturedAt: new Date(),
          before: { max, street, receipt }
        }, { session });

        const a = await products.updateOne(
          { id: MAX_ID, productType: "Max", color: "Чёрный", lots: [LOT], arrivalDate: LOT.date },
          { $set: { lots: [] }, $unset: { arrivalDate: "" } },
          { session }
        );
        const b = await products.updateOne(
          { id: STREET_ID, productType: "Street", color: "Чёрный", lots: [] },
          { $set: { lots: [LOT], arrivalDate: LOT.date } },
          { session }
        );
        const c = await transactions.updateOne(
          { id: TRANSACTION_ID, type: "restock", productId: MAX_ID,
            productLabel: "Max / Чёрный", qty: 2, price: 102, total: 204 },
          { $set: { productId: STREET_ID, productLabel: "Street / Чёрный" } },
          { session }
        );
        if ([a, b, c].some(result => result.modifiedCount !== 1)) {
          throw new Error("Unexpected update count; rolling back transaction");
        }

        const updatedMax = await products.findOne({ id: MAX_ID }, { session });
        const updatedStreet = await products.findOne({ id: STREET_ID }, { session });
        const updatedReceipt = await transactions.findOne({ id: TRANSACTION_ID }, { session });
        if (updatedMax.lots.length !== 0 || !hasLot(updatedStreet.lots)
          || updatedReceipt.productId !== STREET_ID
          || updatedReceipt.productLabel !== "Street / Чёрный") {
          throw new Error("Post-update verification failed; rolling back");
        }
        console.log("[inventory-correction] APPLIED: Max black 0; Street black 2; purchase 102 each");
      }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
    } finally {
      await session.endSession();
    }
  } finally {
    await client.close();
  }
}

correctInventory().catch(error => {
  console.error("[inventory-correction] FAILED:", error.message);
  process.exitCode = 1;
});
