import { PGlite } from "@electric-sql/pglite";
import fs from "fs";

async function run() {
  const db = new PGlite();
  console.log("PGlite initialized!");
  await db.query("SELECT 1 as res");
  console.log("Simple query successful!");
}

run().catch(console.error);
