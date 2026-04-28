export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const { note } = req.body

    if (!note) {
      return res.status(400).json({ error: "Missing note" })
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Rewrite this dental clinical note professionally without adding new information."
          },
          {
            role: "user",
            content: note
          }
        ]
      })
    })

    const data = await response.json()

    return res.status(200).json({
      rewritten_note: data.choices?.[0]?.message?.content || ""
    })

  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: "Internal server error" })
  }
}
