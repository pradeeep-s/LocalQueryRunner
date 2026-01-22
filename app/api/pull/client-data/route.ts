import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-api-key")
  if (apiKey !== process.env.PULL_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  
  // Support either "clientName" (single) or "clientNames" (array)
  let clientNames: string[] = []
  if (body.clientNames && Array.isArray(body.clientNames)) {
    clientNames = body.clientNames
  } else if (body.clientName && typeof body.clientName === "string") {
    clientNames = [body.clientName]
  } else {
    return NextResponse.json(
      { error: "clientName or clientNames array is required" },
      { status: 400 }
    )
  }

  // Run queries in parallel for all clients
  const promises = clientNames.map(async (clientName) => {
    try {
      const clientSnap = await adminDb
        .collection("clients")
        .where("name", "==", clientName)
        .limit(1)
        .get()

      if (clientSnap.empty) {
        return { clientName, error: "Client not found" }
      }

      const agentUid = clientSnap.docs[0].data().agentUid

      const resultSnap = await adminDb
        .collection("temp_query_results")
        .where("agentUid", "==", agentUid)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get()

      if (resultSnap.empty) {
        return { clientName, error: "No data found for client" }
      }

      const resultDoc = resultSnap.docs[0]
      const rowsSnap = await resultDoc.ref.collection("rows").get()
      const data = rowsSnap.docs.map(doc => doc.data())

      return { clientName, data }
    } catch (error) {
      return { clientName, error: "Internal server error" }
    }
  })

  const resultsArray = await Promise.all(promises)

  // Convert results array to object keyed by clientName
  const results = resultsArray.reduce((acc, item) => {
    acc[item.clientName] = item.error ? { error: item.error } : { data: item.data }
    return acc
  }, {} as Record<string, any>)

  return NextResponse.json(results)
}
