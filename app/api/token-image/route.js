import { ImageResponse } from "next/og";

export const runtime = "edge"; // Required for ImageResponse
export const dynamic = "force-dynamic"; // No caching needed

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tokenName = searchParams.get("tokenName") || "Token Name Here";
  const ticker = searchParams.get("ticker") || "";
  const creator = searchParams.get("creator") || "@someone";

  const logoUrl = new URL(
    "/Vector.png", // replace with your actual image path if different
    `${
      request.headers.get("x-forwarded-proto") || "http"
    }://${request.headers.get("host")}`
  ).toString();

  return new ImageResponse(
    (
      <div
        style={{
          width: "600px",
          height: "400px",
          backgroundColor: "#f97316", // tailwind orange-500
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
          position: "relative",
        }}
      >
        {/* Icon */}
        <img
          src={logoUrl}
          style={{
            width: "80px",
            height: "80px",
            marginBottom: "20px",
          }}
        />

        {/* Token name pill */}
        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "15px 30px",
            borderRadius: "9999px",
            fontSize: "32px",
            fontWeight: 600,
            color: "#f97316",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          {tokenName}
          {ticker && (
            <span
              style={{
                fontSize: "24px",
                opacity: 0.7,
                marginLeft: "8px",
              }}
            >
              ({ticker})
            </span>
          )}
        </div>

        {/* Footer - left */}
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            left: "30px",
            fontSize: "14px",
            color: "rgba(255,255,255,0.7)",
            display: "flex",
            flexDirection: "column",
            lineHeight: 1.4,
          }}
        >
          <span>Created by</span>
          <span style={{ color: "#ffffff", fontWeight: "bold" }}>
            {creator}
          </span>
        </div>

        {/* Footer - right */}
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            right: "30px",
            fontSize: "14px",
            color: "rgba(255,255,255,0.7)",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            lineHeight: 1.4,
          }}
        >
          <span>Created at</span>
          <span style={{ color: "#ffffff", fontWeight: "bold" }}>coincept</span>
        </div>
      </div>
    ),
    {
      width: 600,
      height: 400,
    }
  );
}