import { NextRequest, NextResponse } from "next/server";
import { recallMemories, writeMemory } from "@/lib/memory";
import { buildSystemMessage, extractSalientFacts, getGroqClient } from "@/lib/groq";
import { searchMessages, fetchRecentMessages, fetchFullMessage } from "@/lib/gmail";
import { GROQ_MODEL } from "@/lib/config";
import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";

const gmailTools = [
  {
    type: "function" as const,
    function: {
      name: "gmail_search",
      description: "Search the user's Gmail.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Gmail search query (e.g. 'from:ada', 'invoice')" },
          limit: { type: "number", description: "Max results to return (default 5)" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "gmail_digest",
      description: "Fetch the 25 most recent messages. Use this to give a rundown or summary of new emails. You MUST classify promo vs worth-your-time inline from the snippets and flag the top 1-3.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "gmail_read",
      description: "Fetch the full decoded body of one message by its ID.",
      parameters: {
        type: "object",
        properties: {
          messageId: { type: "string" }
        },
        required: ["messageId"]
      }
    }
  }
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, message, gmailToken, lastMsgId, gmailPermission } = body as {
      userId: string;
      message: string;
      gmailToken?: string;
      lastMsgId?: string;
      gmailPermission?: "read-only" | "read-send";
    };

    if (!userId || !message) {
      return NextResponse.json({ error: "userId and message required" }, { status: 400 });
    }

    // 1. Recall top relevant memories from Walrus
    const recalled = await recallMemories(userId, message, 5);
    const memoryTexts = recalled.map((r) => r.text);

    // 2. Build Groq system prompt
    const systemContent = buildSystemMessage(memoryTexts, { 
      gmailToolsAvailable: !!gmailToken, 
      gmailPermission 
    });

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemContent },
      { role: "user", content: message },
    ];

    const groq = getGroqClient();
    let reply = "";
    let newLastMsgId: string | undefined = lastMsgId;
    let gmailAuthExpired = false;

    let rounds = 0;
    while (rounds < 3) {
      rounds++;

      console.log(`[chat] round ${rounds}: tools offered:`, gmailToken ? gmailTools.map(t => t.function.name) : "NONE (no gmailToken)");

      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages,
        tools: gmailToken ? gmailTools : undefined,
        tool_choice: gmailToken ? "auto" : undefined,
        max_tokens: 1024,
      });

      

      const responseMessage = completion.choices[0]?.message;
      if (!responseMessage) {
        break;
      }

      console.log(`[chat] round ${rounds} model response:`, {
  toolCalls: responseMessage.tool_calls?.map(tc => tc.function.name) ?? "none",
  contentPreview: (responseMessage.content || "").slice(0, 150),
});

      messages.push(responseMessage);

      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0 && gmailToken) {
        // Execute tool calls
        for (const toolCall of responseMessage.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments || "{}");
          let toolResult = "";
          console.log(`[chat] tool ${toolCall.function.name} result:`, toolResult.slice(0, 200));


          try {
            if (toolCall.function.name === "gmail_search") {
              const res = await searchMessages(gmailToken, args.query, args.limit || 5);
              toolResult = JSON.stringify(res);
              if (res.length > 0) newLastMsgId = res[0].id;
            } else if (toolCall.function.name === "gmail_digest") {
              const res = await fetchRecentMessages(gmailToken, 25);
              toolResult = JSON.stringify(res);
              if (res.length > 0) newLastMsgId = res[0].id;
            } else if (toolCall.function.name === "gmail_read") {
              // Fallback to provided lastMsgId if model calls it without a valid ID
              const idToRead = args.messageId || newLastMsgId;
              if (!idToRead) {
                toolResult = "No message ID provided or known.";
              } else {
                const res = await fetchFullMessage(gmailToken, idToRead);
                toolResult = JSON.stringify(res);
                newLastMsgId = res.id;
              }
            } else {
              toolResult = "Unknown tool.";
            }
          } catch (e: any) {
            console.error(`Tool error (${toolCall.function.name}):`, e);
            if (e.name === "GmailAuthExpiredError") {
              toolResult = "The user's Gmail session has expired. Please tell them they need to reconnect their account.";
              gmailAuthExpired = true;
            } else {
              toolResult = `Error executing tool: ${String(e)}`;
            }
          }

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult,
          });
        }
      } else {
        reply = responseMessage.content || "";
        break;
      }
    }

    if (!reply) {
      reply = "Sorry, I couldn't formulate a response.";
    }

    // 5. Extract and store salient facts directly to Walrus (fire-and-forget)
    const factsPromise = extractSalientFacts(message, reply).then(async (facts) => {
      for (const fact of facts) {
        await writeMemory(userId, fact);
      }
    });

    factsPromise.catch((e) => console.error("[chat] fact storage error", e));

    console.log("[chat] incoming:", { userId, hasMessage: !!message, hasGmailToken: !!gmailToken, lastMsgId });
    return NextResponse.json({
      reply,
      recalled: memoryTexts,
      lastMsgId: newLastMsgId,
      gmailAuthExpired,
    });

  } catch (err) {
    console.error("[chat] error", err);
    return NextResponse.json(
      { error: "chat failed", detail: String(err) },
      { status: 500 }
    );
  }
}
