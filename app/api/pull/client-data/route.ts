import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"

export async function POST(req: Request) {

  /* 🔐 STEP 1: API KEY SECURITY */
  const apiKey = req.headers.get("x-api-key")
  if (apiKey !== process.env.PULL_API_KEY) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  /* 📥 STEP 2: READ INPUT */
  const { clientName } = await req.json()

  if (!clientName) {
    return NextResponse.json(
      { error: "clientName is required" },
      { status: 400 }
    )
  }

  /* 🔎 STEP 3: GET agentUid FROM clients */
  const clientSnap = await adminDb
    .collection("clients")
    .where("name", "==", clientName)
    .limit(1)
    .get()

  if (clientSnap.empty) {
    return NextResponse.json(
      { error: "Client not found" },
      { status: 404 }
    )
  }

  const agentUid = clientSnap.docs[0].data().agentUid

  /* 🔎 STEP 4: GET LATEST QUERY RESULT USING agentUid */
  const resultSnap = await adminDb
    .collection("temp_query_results")
    .where("agentUid", "==", agentUid)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get()

  if (resultSnap.empty) {
    return NextResponse.json(
      { error: "No data found for client" },
      { status: 404 }
    )
  }

  const resultDoc = resultSnap.docs[0]

  /* 📦 STEP 5: READ rows SUBCOLLECTION */
  const rowsSnap = await resultDoc.ref.collection("rows").get()

  const data = rowsSnap.docs.map(doc => doc.data())

  /* 📤 STEP 6: RETURN RESPONSE */
  return NextResponse.json({
    clientName,
    data
  })
}
