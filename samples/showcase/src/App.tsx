import { Suspense, useState } from "react";
import { demos } from "./demos";

const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

const colors = isDark
  ? {
      bg: "#1e1e1e",
      text: "#e0e0e0",
      cardBg: "#2a2a2a",
      cardBorder: "#404040",
      btnBg: "#333",
      btnBorder: "#555",
      btnText: "#e0e0e0",
    }
  : {
      bg: "#f5f5f5",
      text: "#333",
      cardBg: "#ffffff",
      cardBorder: "#ddd",
      btnBg: "#fff",
      btnBorder: "#ccc",
      btnText: "#333",
    };

document.documentElement.style.backgroundColor = colors.bg;
document.documentElement.style.color = colors.text;

export function App() {
  const [activeDemo, setActiveDemo] = useState<string | null>(null);

  const demo = demos.find((d) => d.id === activeDemo);

  if (demo) {
    const DemoComponent = demo.component;
    return (
      <div className="demo-wrapper">
        <button
          className="back-btn"
          style={{
            backgroundColor: colors.btnBg,
            borderColor: colors.btnBorder,
            color: colors.btnText,
          }}
          onClick={() => setActiveDemo(null)}
        >
          Back
        </button>
        <Suspense
          fallback={
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100vh",
              }}
            >
              Loading...
            </div>
          }
        >
          <DemoComponent />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="showcase" style={{ backgroundColor: colors.bg }}>
      <div className="showcase-title">AI Chat Samples</div>
      <div className="showcase-subtitle">
        Pick a sample to explore @onlyoffice/ai-chat features
      </div>
      <div className="cards">
        {demos.map((d) => (
          <div
            key={d.id}
            className="card"
            style={{
              backgroundColor: colors.cardBg,
              borderColor: colors.cardBorder,
            }}
            onClick={() => setActiveDemo(d.id)}
          >
            <div className="card-title">{d.title}</div>
            <div className="card-description">{d.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
