import { ImageResponse } from "next/og";

export const shareImageSize = { width: 1200, height: 630 };
export const shareImageContentType = "image/png";

export function ShareImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#f6f6ef",
        }}
      >
        <div style={{ height: 36, width: "100%", background: "#ebb73f" }} />
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            padding: "0 88px",
          }}
        >
          <div
            style={{
              width: 200,
              height: 300,
              background: "#ffffff",
              border: "10px solid #3f679b",
              borderRadius: 16,
              display: "flex",
              justifyContent: "center",
              paddingTop: 42,
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 72,
                background: "#3f679b",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginLeft: 64,
            }}
          >
            <div style={{ fontSize: 76, fontWeight: 700, color: "#1a1a1a" }}>
              Cornhole News
            </div>
            <div style={{ fontSize: 34, color: "#3f679b", marginTop: 18 }}>
              News, discussion, and community
            </div>
          </div>
        </div>
      </div>
    ),
    { ...shareImageSize }
  );
}
