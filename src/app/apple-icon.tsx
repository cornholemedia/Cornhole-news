import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ebb73f",
        }}
      >
        <div
          style={{
            width: 96,
            height: 140,
            background: "#f6f6ef",
            border: "8px solid #3f679b",
            borderRadius: 10,
            display: "flex",
            justifyContent: "center",
            paddingTop: 22,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 36,
              background: "#3f679b",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
