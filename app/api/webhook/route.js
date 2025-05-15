export async function POST(req) {
  try {
    const body = await req.json();
    // You can add your webhook handling logic here
    // For now, just log and return success
    console.log("Received webhook:", body);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}
